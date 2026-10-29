"""Site-wide visits: how many people came, and how many pages they opened.

Asked for by Tzvi on 18 Sep 2026 ("can you make it for the site as a
whole"). Until now the site counted visits to listings, services and
business pages and nothing else: the home page, Stays, search, the
Requests board - where most people actually land - were invisible. The
only whole-site tracker in the page was a PostHog snippet added by
Emergent in March, reporting to an account that is not his.

WHAT IS STORED, and what is deliberately not:

  * One document per visitor per Israel day: the day, the anonymous
    browser id from utils/visitorId.js, when they first arrived, and how
    many pages they opened. That is all.
  * NO page path. Several routes carry a credential IN the path -
    /sign/<token>, /orders/track/<token>, /orders/staff/<token> - and a
    table of "most visited pages" would quietly become a table of live
    signing links and staff-board keys. If per-page numbers are ever
    wanted, they need an allow-list of route shapes, not raw paths.
  * No IP, no user-agent, no account id. The same rule utils/visitorId.js
    set for listing views.

Who is NOT counted: link-preview crawlers and search bots (they are not
visitors), and admins (Tzvi checking his own dashboard would otherwise be
his site's most loyal reader).

Storage is bounded by people x days, not by page loads, because repeat
page views increment a counter on the day's document instead of adding
rows.
"""
from __future__ import annotations

import time
from datetime import UTC, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel

from routes.deps import db, logger
from utils.auth import optional_user
from utils.rate_limit import check_rate
from utils.view_tracking import il_day_of, is_bot as _is_bot_ua

router = APIRouter()

COLLECTION = "site_visits"
_MAX_VISITOR_LEN = 64

# Crawlers are not visitors: one list, in utils/view_tracking, shared with
# the listings' own counts.
def _is_bot(request: Request) -> bool:
    return _is_bot_ua(request.headers.get("user-agent"))


@router.post("/site/visit", status_code=204)
async def record_site_visit(request: Request, viewer=Depends(optional_user)) -> Response:
    """Count one page opened. Always answers 204 - a lost metric must never
    become an error in a visitor's console."""
    if _is_bot(request) or (viewer or {}).get("role") == "admin":
        return Response(status_code=204)
    # Generous: a real person clicking around opens a page every few
    # seconds at most. This is here so a script cannot inflate the count,
    # not to shape honest traffic.
    try:
        check_rate(request, bucket="site-visit", limit=120, window_seconds=60)
    except Exception:  # noqa: BLE001 - over the limit: drop the count, quietly
        return Response(status_code=204)

    now = datetime.now(UTC)
    day = il_day_of(now)
    visitor = (request.headers.get("X-Visitor-Id") or "").strip()[:_MAX_VISITOR_LEN] or None
    try:
        if visitor:
            await db[COLLECTION].update_one(
                {"day": day, "visitor": visitor},
                {"$setOnInsert": {"day": day, "visitor": visitor, "first_at": now},
                 "$inc": {"pageviews": 1}},
                upsert=True,
            )
        else:
            # Private browsing can refuse localStorage. Still a visit;
            # counted without dedupe rather than lost.
            await db[COLLECTION].insert_one(
                {"day": day, "visitor": None, "first_at": now, "pageviews": 1},
            )
    except Exception:  # noqa: BLE001
        logger.exception("site visit insert failed")
    return Response(status_code=204)


async def site_summary(day_keys: list[str] | None) -> dict:
    """Visitors and page views for a set of Israel days, or all time.

    "Visitors" is distinct people across the whole window - someone who came
    on Monday and Tuesday is one visitor for the week, not two. Anonymous
    visits (no browser id) cannot be told apart, so each counts once.
    """
    match = {} if day_keys is None else {"day": {"$in": day_keys}}
    agg = await db[COLLECTION].aggregate([
        {"$match": match},
        {"$group": {
            "_id": None,
            "pageviews": {"$sum": "$pageviews"},
            "named": {"$addToSet": "$visitor"},
            "anonymous": {"$sum": {"$cond": [{"$eq": ["$visitor", None]}, 1, 0]}},
        }},
    ]).to_list(1)
    if not agg:
        visitors = pageviews = 0
    else:
        row = agg[0]
        named = [v for v in row["named"] if v]
        visitors = len(named) + int(row["anonymous"])
        pageviews = int(row["pageviews"])

    first = await db[COLLECTION].find_one({}, {"day": 1}, sort=[("day", 1)])
    return {"visitors": visitors, "pageviews": pageviews, "since": (first or {}).get("day")}


async def ensure_site_visit_indexes() -> None:
    # Unique per visitor per day, but only where there IS a visitor id:
    # anonymous rows are many per day by design and would collide on null.
    await db[COLLECTION].create_index(
        [("day", 1), ("visitor", 1)], unique=True,
        partialFilterExpression={"visitor": {"$type": "string"}}, background=True,
    )
    await db[COLLECTION].create_index("day", background=True)
    await db[SEARCHES].create_index(
        [("day", 1), ("visitor", 1), ("kind", 1), ("area", 1), ("what", 1)],
        unique=True, background=True,
    )
    # Searches are only ever read for the last week; keep three months.
    await db[SEARCHES].create_index("at", expireAfterSeconds=90 * 86400, background=True)


# ---------------------------------------------------------------------------
# Searches and demand (Tzvi, 29 Oct 2026: "build the real-demand lines").
# Why list, Why host and join show what people are looking for right now,
# so a lister sees the demand before signing up. Every number is counted
# here, never estimated, and below MIN_SHOWN it is not sent at all: the page
# leaves the line out rather than say "1 person searched".
#
# A search is one row per browser per Israel day per (kind, area, what), so
# changing filters back and forth or reloading counts once. Same privacy
# rule as visits: the anonymous browser id, no IP, no account. Without a
# browser id nothing is recorded, because it could not be told apart.
# ---------------------------------------------------------------------------

SEARCHES = "site_searches"
MIN_SHOWN = 3
_DEMAND_CACHE: dict = {"at": 0.0, "data": None}


class SearchIn(BaseModel):
    kind: Literal["stays", "services"]
    area: str = ""
    what: str = ""


@router.post("/site/search", status_code=204)
async def record_site_search(body: SearchIn, request: Request, viewer=Depends(optional_user)) -> Response:
    """Note one search. Always 204, like a visit."""
    visitor = (request.headers.get("X-Visitor-Id") or "").strip()[:_MAX_VISITOR_LEN]
    if not visitor or _is_bot(request) or (viewer or {}).get("role") == "admin":
        return Response(status_code=204)
    try:
        check_rate(request, bucket="site-search", limit=60, window_seconds=60)
    except Exception:  # noqa: BLE001 - over the limit: drop it, quietly
        return Response(status_code=204)
    now = datetime.now(UTC)
    key = {"day": il_day_of(now), "visitor": visitor, "kind": body.kind,
           "area": body.area.strip()[:80], "what": body.what.strip()[:60]}
    try:
        await db[SEARCHES].update_one(key, {"$setOnInsert": {"at": now}}, upsert=True)
    except Exception:  # noqa: BLE001 - a duplicate race or a lost metric, never an error
        pass
    return Response(status_code=204)


def _shown(n: int) -> int | None:
    return n if n >= MIN_SHOWN else None


@router.get("/site/demand")
async def site_demand(response: Response) -> dict:
    """People searching in the last 7 days, the most searched stays area,
    and requests posted in the last 30 days. Cached ten minutes."""
    now = time.time()
    if _DEMAND_CACHE["data"] is None or now - _DEMAND_CACHE["at"] > 600:
        since = datetime.now(UTC) - timedelta(days=7)
        people = {r["_id"]: r["n"] for r in await db[SEARCHES].aggregate([
            {"$match": {"at": {"$gte": since}}},
            {"$group": {"_id": "$kind", "v": {"$addToSet": "$visitor"}}},
            {"$project": {"n": {"$size": "$v"}}},
        ]).to_list(5)}
        top = await db[SEARCHES].aggregate([
            {"$match": {"at": {"$gte": since}, "kind": "stays", "area": {"$ne": ""}}},
            {"$group": {"_id": {"a": "$area", "v": "$visitor"}}},
            {"$group": {"_id": "$_id.a", "n": {"$sum": 1}}},
            {"$sort": {"n": -1}}, {"$limit": 1},
        ]).to_list(1)
        requests = await db.requests.count_documents({
            "created_at": {"$gte": (datetime.now(UTC) - timedelta(days=30)).isoformat()},
            "hidden_by_admin": {"$ne": True},
        })
        _DEMAND_CACHE["data"] = {
            "stays_people_7d": _shown(people.get("stays", 0)),
            "services_people_7d": _shown(people.get("services", 0)),
            "top_area": ({"area": top[0]["_id"], "people": top[0]["n"]}
                         if top and top[0]["n"] >= MIN_SHOWN else None),
            "requests_30d": _shown(requests),
        }
        _DEMAND_CACHE["at"] = now
    response.headers["Cache-Control"] = "public, max-age=300"
    return _DEMAND_CACHE["data"]
