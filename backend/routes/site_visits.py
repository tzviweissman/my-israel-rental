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

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request, Response

from routes.deps import db, logger
from utils.auth import optional_user
from utils.rate_limit import check_rate
from utils.view_tracking import il_day_of

router = APIRouter()

COLLECTION = "site_visits"
_MAX_VISITOR_LEN = 64

# Crawlers are not visitors. Deliberately broad - a missed bot inflates the
# number a person reads as growth, a false positive loses one real view.
_BOT_MARKERS = (
    "bot", "crawler", "spider", "slurp", "preview", "facebookexternalhit",
    "whatsapp", "headless", "lighthouse", "pingdom", "uptimerobot", "monitor",
)


def _is_bot(request: Request) -> bool:
    ua = (request.headers.get("user-agent") or "").lower()
    return not ua or any(m in ua for m in _BOT_MARKERS)


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
