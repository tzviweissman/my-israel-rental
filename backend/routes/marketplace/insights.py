"""How your business is doing: what a business's own orders say about it.

Tzvi, 14 Oct 2026: orders sent through the order pages are saved, so
businesses can "use the information to help them grow". Read-only, the
owner's (or an admin's) own orders, nothing estimated: every number is a
count or a sum of orders that exist, and the screen says from when.

GET /api/marketplace/businesses/<id>/insights?days=30|90|365

Cancelled and failed orders are left out. Money is summed in the currency
most of the orders use; orders in another currency are counted but not
added in, and the answer says how many.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Any, Iterable
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query

from routes.deps import db, verify_token

router = APIRouter(prefix="/marketplace", tags=["marketplace"])
_IL = ZoneInfo("Asia/Jerusalem")
_SKIP = {"cancelled", "failed"}


def _when(o: dict[str, Any]) -> datetime | None:
    try:
        d = datetime.fromisoformat(str(o.get("created_at")).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    return (d if d.tzinfo else d.replace(tzinfo=_IL)).astimezone(_IL)


def _money(o: dict[str, Any]) -> float | None:
    for k in ("total", "subtotal"):
        try:
            if o.get(k) is not None:
                return float(o[k])
        except (TypeError, ValueError):
            pass
    return None


def _city(o: dict[str, Any]) -> str | None:
    if o.get("fulfilment") != "delivery":
        return None
    c = (o.get("city") or "").strip()
    if not c and o.get("address"):
        c = str(o["address"]).split(",")[-1].strip()
    return c.title() if c and not any(ch.isdigit() for ch in c) else None


def _who(o: dict[str, Any]) -> str | None:
    return o.get("customer_phone_e164") or (o.get("customer_phone") or "").replace(" ", "").replace("-", "") or None


def compute(orders: Iterable[dict[str, Any]], days: int, now: datetime) -> dict[str, Any]:
    live = [(o, _when(o)) for o in orders if o.get("status") not in _SKIP]
    live = [(o, w) for o, w in live if w is not None]
    live.sort(key=lambda x: x[1])
    start, prev_start = now - timedelta(days=days), now - timedelta(days=2 * days)
    cur = Counter((o.get("currency") or "ILS").upper() for o, _ in live).most_common(1)
    currency = cur[0][0] if cur else "ILS"

    def money_of(rows):
        same = [m for o, _ in rows if (o.get("currency") or "ILS").upper() == currency and (m := _money(o)) is not None]
        return round(sum(same), 2), len(same)

    now_rows = [(o, w) for o, w in live if w >= start]
    prev_rows = [(o, w) for o, w in live if prev_start <= w < start]
    revenue, priced = money_of(now_rows)
    prev_revenue, _ = money_of(prev_rows)

    # Months: the last twelve, oldest first, empty months included.
    months = []
    y, m = now.year, now.month
    for _ in range(12):
        months.append((y, m))
        y, m = (y, m - 1) if m > 1 else (y - 1, 12)
    months.reverse()
    by_month = defaultdict(lambda: [0, 0.0])
    for o, w in live:
        k = (w.year, w.month)
        by_month[k][0] += 1
        if (o.get("currency") or "ILS").upper() == currency and (mv := _money(o)) is not None:
            by_month[k][1] += mv

    # Weekdays, Sunday first (the Israeli week).
    weekdays = [0] * 7
    for _, w in now_rows:
        weekdays[(w.weekday() + 1) % 7] += 1

    # Best sellers: products picked from their list. Orders typed by hand
    # have no lines, so they are counted apart rather than guessed at.
    sold: dict[str, list[float]] = defaultdict(lambda: [0, 0.0])
    typed = 0
    for o, _ in now_rows:
        lines = o.get("lines") or []
        if not lines:
            typed += 1
        for ln in lines:
            name = (ln.get("name") or "").strip()
            if not name:
                continue
            q = int(ln.get("qty") or 0)
            sold[name][0] += q
            try:
                sold[name][1] += q * float(ln.get("price") or 0)
            except (TypeError, ValueError):
                pass
    best = sorted(sold.items(), key=lambda kv: (-kv[1][0], -kv[1][1], kv[0]))[:6]

    cities = Counter(c for o, _ in now_rows if (c := _city(o))).most_common(6)

    # Customers: new in this period, or back again (an order before this one, ever).
    first_seen: dict[str, datetime] = {}
    for o, w in live:
        k = _who(o)
        if k and k not in first_seen:
            first_seen[k] = w
    period_customers: dict[str, dict[str, Any]] = {}
    for o, _ in now_rows:
        k = _who(o)
        if not k:
            continue
        c = period_customers.setdefault(k, {"name": o.get("customer_name") or "", "orders": 0, "spent": 0.0})
        c["orders"] += 1
        if (o.get("currency") or "ILS").upper() == currency and (mv := _money(o)) is not None:
            c["spent"] += mv
    returning = sum(1 for k in period_customers if first_seen[k] < start)
    top_customers = sorted(period_customers.values(), key=lambda c: (-c["orders"], -c["spent"]))[:5]

    sources = Counter("website" if o.get("source") == "website" else "entered" for o, _ in now_rows)

    return {
        "days": days,
        "since": live[0][1].date().isoformat() if live else None,
        "currency": currency,
        "orders": len(now_rows),
        "orders_before": len(prev_rows),
        "revenue": revenue,
        "revenue_before": prev_revenue,
        "average": round(revenue / priced, 2) if priced else None,
        "other_currency_orders": len(now_rows) - priced - sum(1 for o, _ in now_rows if _money(o) is None),
        # Whether the period before was counted at all: an answer of "up"
        # against a period with no orders yet would only be counting starting.
        "compare": bool(live) and live[0][1] < start,
        "months": [{"month": f"{y:04d}-{m:02d}", "orders": by_month[(y, m)][0], "revenue": round(by_month[(y, m)][1], 2)} for y, m in months],
        "weekdays": weekdays,
        "best_sellers": [{"name": n, "qty": int(v[0]), "revenue": round(v[1], 2)} for n, v in best],
        "typed_orders": typed,
        "cities": [{"city": c, "orders": n} for c, n in cities],
        "customers": len(period_customers),
        "returning": returning,
        "new_customers": len(period_customers) - returning,
        "top_customers": [{**c, "spent": round(c["spent"], 2)} for c in top_customers],
        "sources": {"website": sources.get("website", 0), "entered": sources.get("entered", 0)},
    }


@router.get("/businesses/{business_id}/insights")
async def business_insights(business_id: str, days: int = Query(30, ge=7, le=366), user=Depends(verify_token)):
    biz = await db.businesses.find_one({"_id": business_id}, {"owner_user_id": 1})
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    from utils.business_access import business_access
    await business_access(db, business_id, user, "summary")
    fields = {"_id": 0, "status": 1, "created_at": 1, "total": 1, "subtotal": 1, "currency": 1, "lines": 1, "fulfilment": 1,
              "city": 1, "address": 1, "customer_phone_e164": 1, "customer_phone": 1, "customer_name": 1, "source": 1}
    orders = await db.store_orders.find({"business_id": business_id}, fields).to_list(20000)
    return compute(orders, days, datetime.now(_IL))
