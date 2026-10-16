"""When a business is usually busy (Tzvi, 16 Oct 2026, from Google's
"Popular times").

Counted from the business's own records over the last 12 weeks: check-ins
at the door (memberships.py) and appointments that went ahead (accepted
or done, at their booked time). Nothing is estimated and nothing comes
from outside. A business with fewer than MIN_VISITS of these shows
nothing, because a chart from a handful of visits would claim a pattern
that is not there.

Public: only the shape (per weekday, per hour, scaled 0 to 100), never a
count, a name or a date.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Request, Response

from routes.deps import db
from utils.rate_limit import check_rate

router = APIRouter(prefix="/marketplace", tags=["marketplace"])
IL = ZoneInfo("Asia/Jerusalem")
WEEKS = 12
MIN_VISITS = 30


def _js_day(d: datetime) -> int:
    """0 Sunday ... 6 Saturday, as the browser counts."""
    return (d.weekday() + 1) % 7


@router.get("/businesses/{business_id}/busy-times")
async def busy_times(business_id: str, request: Request, response: Response):
    check_rate(request, bucket="busy_times", limit=120, window_seconds=600)
    biz = await db.businesses.find_one({"_id": business_id}, {"active": 1})
    if not biz or not biz.get("active", True):
        raise HTTPException(status_code=404, detail="Business not found")
    since = datetime.now(IL) - timedelta(weeks=WEEKS)
    grid: dict[int, dict[int, int]] = defaultdict(lambda: defaultdict(int))
    total = 0
    async for c in db.member_checkins.find({"business_id": business_id, "at": {"$gte": since.isoformat()}}, {"at": 1}):
        try:
            at = datetime.fromisoformat(c["at"]).astimezone(IL)
        except (KeyError, TypeError, ValueError):
            continue
        grid[_js_day(at)][at.hour] += 1
        total += 1
    gig_ids = [g["_id"] async for g in db.marketplace_gigs.find({"business_id": business_id}, {"_id": 1})]
    if gig_ids:
        async for b in db.marketplace_bookings.find(
                {"gig_id": {"$in": gig_ids}, "status": {"$in": ["accepted", "completed"]}, "no_show": {"$ne": True},
                 "preferred_date": {"$gte": since.date().isoformat(), "$lte": datetime.now(IL).date().isoformat()},
                 "time_slot": {"$nin": [None, ""]}},
                {"preferred_date": 1, "time_slot": 1}):
            try:
                at = datetime.fromisoformat(f"{b['preferred_date']}T{b['time_slot']}")
            except (KeyError, TypeError, ValueError):
                continue
            grid[_js_day(at)][at.hour] += 1
            total += 1
    response.headers["Cache-Control"] = "public, max-age=3600"
    if total < MIN_VISITS:
        return {"enough": False}
    top = max(n for day in grid.values() for n in day.values())
    days = {str(d): {str(h): round(100 * n / top) for h, n in sorted(hours.items())} for d, hours in grid.items()}
    return {"enough": True, "days": days, "weeks": WEEKS}
