"""What visits are made of, for every business and rental (Tzvi, 6 Nov 2026: "we
should be tracking all the data we can").

Each visit already written by utils/view_tracking now says where the person came
from, phone or laptop, language and new or returning. This adds taps on a designed
site (they use their own wa.me and tel: links, so nothing else sees them) and shows
all of it to the owner. Super Admin can ask for the whole site.

Kept to the same rule as the rest of the tracking: an anonymous browser id, no IP,
no city, no full address of the page someone came from (source_of).
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import BaseModel, Field

from routes.deps import db, verify_token
from utils import view_tracking
from utils.rate_limit import check_rate

from .businesses import _resolve

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

# "order" and "button" added 12 Nov 2026 (Tzvi: "track clicks on the business pages too"): every other button or link
# on a business page, with the words on it, so the owner sees which ones people press.
Tap = Literal["whatsapp", "phone", "email", "directions", "instagram", "facebook", "tiktok", "order", "button"]


class TapIn(BaseModel):
    kind: Tap
    page: Optional[str] = Field(None, max_length=40)
    label: Optional[str] = Field(None, max_length=80)


@router.post("/business/{slug_or_id}/tap", status_code=204)
async def designed_site_tap(slug_or_id: str, body: TapIn, request: Request):
    check_rate(request, bucket="designed_tap", limit=150, window_seconds=600)
    if view_tracking.is_bot(request.headers.get("user-agent") or ""):
        return Response(status_code=204)
    biz = await _resolve(slug_or_id)
    if biz:
        now = datetime.now(UTC)
        await db.site_taps.insert_one({
            "business_id": biz["_id"], "owner_id": biz.get("owner_user_id"), "kind": body.kind,
            "page": view_tracking.page_name(body.page), "label": " ".join((body.label or "").split())[:40] or None, "at": now, "day": view_tracking.il_day_of(now),
            **view_tracking.visit_facts(request),
        })
    return Response(status_code=204)


def _rows(counts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{"key": r["_id"], "n": r["n"]} for r in sorted(counts, key=lambda r: -r["n"]) if r["_id"] not in (None, "")]


async def _names(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for r in rows:
        kind, entity = r["_id"]["t"], r["_id"]["id"]
        if kind == view_tracking.ENTITY_BUSINESS:
            d = await db.businesses.find_one({"_id": entity}, {"name": 1})
            name = (d or {}).get("name")
        elif kind == view_tracking.ENTITY_GIG:
            d = await db.marketplace_gigs.find_one({"_id": entity}, {"title": 1})
            name = (d or {}).get("title")
        else:
            d = await db.properties.find_one({"id": entity}, {"title": 1})
            name = (d or {}).get("title")
        if name:
            out.append({"id": entity, "type": kind, "name": name, "n": r["n"]})
    return out


@router.get("/visits/breakdown")
async def visits_breakdown(days: int = Query(30, ge=1, le=365), everyone: bool = False, user=Depends(verify_token)):
    start = (datetime.now(view_tracking._IL_TZ).date() - timedelta(days=days - 1)).isoformat()
    match: dict[str, Any] = {"day": {"$gte": start}}
    if not (everyone and user.get("role") == "admin"):
        match["owner_id"] = user["user_id"]
    def by(field: str) -> list[dict[str, Any]]:
        return [{"$group": {"_id": f"${field}", "n": {"$sum": 1}}}]
    facets = await db[view_tracking.COLLECTION].aggregate([
        {"$match": match},
        {"$facet": {
            "total": [{"$count": "n"}],
            "sources": by("source"), "devices": by("device"), "langs": by("lang"), "returning": by("returning"),
            "since": [{"$match": {"source": {"$exists": True}}}, {"$group": {"_id": None, "day": {"$min": "$day"}}}],
            "listings": [{"$group": {"_id": {"t": "$entity_type", "id": "$entity_id"}, "n": {"$sum": 1}}}, {"$sort": {"n": -1}}, {"$limit": 15}],
        }},
    ]).to_list(1)
    f = facets[0] if facets else {}
    taps = await db.site_taps.aggregate([{"$match": match}, *by("kind")]).to_list(20)
    buttons = await db.site_taps.aggregate([
        {"$match": {**match, "label": {"$type": "string"}}}, *by("label"), {"$sort": {"n": -1}}, {"$limit": 12},
    ]).to_list(12)
    pages = await db.page_view_counts.aggregate([
        {"$match": match}, {"$group": {"_id": "$page", "n": {"$sum": "$n"}}}, {"$sort": {"n": -1}}, {"$limit": 10},
    ]).to_list(10)
    back = {r["_id"]: r["n"] for r in f.get("returning") or []}
    return {
        "days": days,
        "visits": (f.get("total") or [{"n": 0}])[0]["n"],
        "since": (f.get("since") or [{"day": None}])[0]["day"],
        "sources": _rows(f.get("sources") or []),
        "devices": _rows(f.get("devices") or []),
        "langs": _rows(f.get("langs") or []),
        "new": back.get(False, 0),
        "returning": back.get(True, 0),
        "taps": _rows(taps),
        "buttons": _rows(buttons),
        "pages": _rows(pages),
        "listings": await _names(f.get("listings") or []),
    }
