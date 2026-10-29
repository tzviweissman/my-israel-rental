"""A business's sales summary (Tzvi, 15 Oct 2026: the Shopify idea, "a
sales summary per business").

One page across everything the business runs here, for a chosen period
(30, 90 or 365 days, or any dates: insights.window) against the period
before or the same dates a year earlier:

  * orders       the existing order insights (insights.py compute), not a
                 second copy of the same arithmetic
  * memberships  sign-ups, members active now, cancellations, and what
                 the active monthly and yearly memberships come to a month
                 at their plan prices (after any discount code)
  * visits       check-ins at the door, by weekday and by hour
  * appointments requested, accepted, completed, declined
  * discounts    how many orders and sign-ups used a code, and how much
                 it came to
  * customers    people new to the business in the period, and returning
  * visitors     people who opened its page or its listings (utils/
                 view_tracking, one a day each, never the owner or a bot),
                 and orders and appointment requests for every hundred of
                 them (Tzvi, 29 Oct 2026)

Every number is a count or a sum of records that exist. The one figure
that looks ahead (the monthly value of active memberships) is labelled as
"at plan prices", because the site does not take the payments itself yet.
"""
from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query

from routes.deps import db, verify_token
from utils.whatsapp_link import normalize_whatsapp_number

from .insights import compute as order_insights
from .insights import window

router = APIRouter(prefix="/marketplace", tags=["marketplace"])
_IL = ZoneInfo("Asia/Jerusalem")


def _at(s: Any) -> datetime | None:
    try:
        d = datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    return (d if d.tzinfo else d.replace(tzinfo=_IL)).astimezone(_IL)


def _monthly_value(m: dict[str, Any]) -> float:
    plan = m.get("plan") or {}
    price = float((m.get("discount") or {}).get("price_after", plan.get("price") or 0) or 0)
    if plan.get("period") == "month":
        return price
    if plan.get("period") == "year":
        return price / 12
    return 0.0


def _in(w: datetime | None, a: datetime, b: datetime) -> bool:
    return w is not None and a <= w < b


@router.get("/businesses/{business_id}/summary")
async def sales_summary(business_id: str, days: int = Query(30, ge=1, le=366), start: str | None = None, end: str | None = None,
                        compare: str = Query("prev", pattern="^(prev|year)$"), user=Depends(verify_token)):
    biz = await db.businesses.find_one({"_id": business_id}, {"owner_user_id": 1})
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    from utils.business_access import business_access
    await business_access(db, business_id, user, "summary")
    win = window(days, start, end, compare, datetime.now(_IL))
    # The names below were "now" and "prev" when every period ended today; they stay, meaning the window's edges.
    start, now, prev, prev_end = win.start, win.end, win.prev_start, win.prev_end

    # --- orders ---------------------------------------------------------
    fields = {"_id": 0, "status": 1, "created_at": 1, "total": 1, "subtotal": 1, "currency": 1, "lines": 1, "fulfilment": 1,
              "city": 1, "address": 1, "customer_phone_e164": 1, "customer_phone": 1, "customer_name": 1, "source": 1, "discount": 1}
    orders = await db.store_orders.find({"business_id": business_id}, fields).to_list(20000)
    o = order_insights(orders, win.days, now, win)
    live_orders = [x for x in orders if x.get("status") not in ("cancelled", "failed")]
    disc_orders = [x for x in live_orders if x.get("discount") and _in(_at(x.get("created_at")), start, now)]

    # --- memberships -----------------------------------------------------
    members = await db.business_members.find({"business_id": business_id}).to_list(20000)
    joined = [m for m in members if _in(_at(m.get("created_at")), start, now)]
    joined_before = [m for m in members if _in(_at(m.get("created_at")), prev, prev_end)]
    cancelled = [m for m in members if any(h.get("event") == "cancel" and _in(_at(h.get("at")), start, now)
                                           for h in (m.get("history") or []))]
    active = [m for m in members if m.get("status") == "active"]
    plans = Counter((m.get("plan") or {}).get("name") or "" for m in active)
    disc_members = [m for m in joined if m.get("discount")]

    # --- visits (door check-ins) ----------------------------------------
    checkins = await db.member_checkins.find({"business_id": business_id, "at": {"$gte": min(prev, start).isoformat()}},
                                             {"_id": 0, "at": 1}).to_list(100000)
    visit_now = [w for c in checkins if _in(w := _at(c["at"]), start, now)]
    visit_before = [w for c in checkins if _in(_at(c["at"]), prev, prev_end)]
    weekdays = [0] * 7
    hours = [0] * 24
    for w in visit_now:
        weekdays[(w.weekday() + 1) % 7] += 1     # Sunday first
        hours[w.hour] += 1

    # --- appointments ---------------------------------------------------
    gig_ids = [g["_id"] async for g in db.marketplace_gigs.find({"business_id": business_id}, {"_id": 1})]
    bookings = await db.marketplace_bookings.find({"gig_id": {"$in": gig_ids}}, {"_id": 0, "status": 1, "created_at": 1}).to_list(20000) if gig_ids else []
    b_now = [b for b in bookings if _in(_at(b.get("created_at")), start, now)]
    b_before = [b for b in bookings if _in(_at(b.get("created_at")), prev, prev_end)]
    b_status = Counter(b.get("status") or "pending" for b in b_now)

    # --- customers across everything ------------------------------------
    first: dict[str, datetime] = {}

    def see(key: str | None, w: datetime | None) -> None:
        if key and w and (key not in first or w < first[key]):
            first[key] = w
    period_people: set[str] = set()
    for x in live_orders:
        k = x.get("customer_phone_e164") or normalize_whatsapp_number(x.get("customer_phone"))
        w = _at(x.get("created_at"))
        see(k, w)
        if k and _in(w, start, now):
            period_people.add(k)
    for m in members:
        k = normalize_whatsapp_number(m.get("phone"))
        w = _at(m.get("created_at"))
        see(k, w)
        if k and (_in(w, start, now) or _in(_at(m.get("last_visit_at")), start, now)):
            period_people.add(k)
    new_people = sum(1 for k in period_people if first.get(k) and first[k] >= start)

    # --- visitors, and how many of them ordered or asked for an appointment ----
    owner = biz.get("owner_user_id")
    seen_ids = [business_id, *gig_ids]
    views = db.marketplace_view_events
    v_now = await views.count_documents({"entity_id": {"$in": seen_ids}, "at": {"$gte": start.astimezone(UTC), "$lt": now.astimezone(UTC)}})
    v_before = await views.count_documents({"entity_id": {"$in": seen_ids}, "at": {"$gte": prev.astimezone(UTC), "$lt": prev_end.astimezone(UTC)}})
    asked_now, asked_before = o["orders"] + len(b_now), o["orders_before"] + len(b_before)

    def rate(n: int, v: int) -> float | None:
        return round(100 * n / v, 1) if v >= 20 else None   # fewer than 20 visitors is too few to make a rate of

    return {
        "days": win.days,
        "start": o["start"], "end": o["end"], "compare_with": win.compare,
        "visitors": {"count": v_now, "before": v_before, "asked": asked_now, "rate": rate(asked_now, v_now),
                     "rate_before": rate(asked_before, v_before), "tracked": owner is not None},
        "currency": o["currency"],
        "orders": o,
        "memberships": {
            "joined": len(joined), "joined_before": len(joined_before), "cancelled": len(cancelled),
            "active": len(active), "waiting_payment": sum(1 for m in members if m.get("status") == "pending"),
            "monthly_value": round(sum(_monthly_value(m) for m in active), 2),
            "by_plan": [{"plan": p, "active": n} for p, n in plans.most_common(6)],
            "has_any": bool(members),
        },
        "visits": {"count": len(visit_now), "before": len(visit_before), "weekdays": weekdays, "hours": hours,
                   "busiest_hour": max(range(24), key=lambda h: hours[h]) if visit_now else None},
        "appointments": {"count": len(b_now), "before": len(b_before), "accepted": b_status.get("accepted", 0),
                         "completed": b_status.get("completed", 0), "declined": b_status.get("declined", 0),
                         "pending": b_status.get("pending", 0), "has_any": bool(bookings)},
        "discounts": {"orders": len(disc_orders), "orders_amount": round(sum(float(x["discount"].get("amount") or 0) for x in disc_orders), 2),
                      "members": len(disc_members),
                      "members_amount": round(sum(float(m["discount"].get("amount") or 0) for m in disc_members), 2),
                      "top_codes": [{"code": c, "uses": n} for c, n in Counter(
                          [x["discount"]["code"] for x in disc_orders] + [m["discount"]["code"] for m in disc_members]).most_common(5)]},
        "customers": {"in_period": len(period_people), "new": new_people, "returning": len(period_people) - new_people},
    }
