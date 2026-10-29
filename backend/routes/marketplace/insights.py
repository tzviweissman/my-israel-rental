"""How your business is doing: what a business's own orders say about it.

Tzvi, 14 Oct 2026: orders sent through the order pages are saved, so
businesses can "use the information to help them grow". Read-only, the
owner's (or an admin's) own orders, nothing estimated: every number is a
count or a sum of orders that exist, and the screen says from when.

GET /api/marketplace/businesses/<id>/insights?days=30|90|365
GET /api/marketplace/businesses/<id>/insights?start=YYYY-MM-DD&end=YYYY-MM-DD&compare=prev|year

Any dates, Israel days, both inclusive (Tzvi, 29 Oct 2026: track "by month
day or year" as on Shopify), against the same length before or the same
dates a year earlier. A range of up to 92 days is shown day by day, a longer
one month by month, each point with its counterpart in the period compared.

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


class Window:
    """The period asked for and the one it is compared with: [start, end) in Israel time."""

    def __init__(self, start: datetime, end: datetime, prev_start: datetime, prev_end: datetime, compare: str) -> None:
        self.start, self.end, self.prev_start, self.prev_end, self.compare = start, end, prev_start, prev_end, compare

    @property
    def days(self) -> int:
        return max(1, round((self.end - self.start).total_seconds() / 86400))


def _year_back(d: datetime) -> datetime:
    try:
        return d.replace(year=d.year - 1)
    except ValueError:   # 29 February
        return d.replace(year=d.year - 1, day=28)


def window(days: int | None, start: str | None, end: str | None, compare: str, now: datetime) -> Window:
    """From ?days, or ?start and ?end (dates, both included), compared with the period before or a year earlier."""
    if start or end:
        try:
            a = datetime.fromisoformat(str(start)).replace(tzinfo=_IL) if start else None
            b = datetime.fromisoformat(str(end)).replace(tzinfo=_IL) + timedelta(days=1) if end else None
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="Dates are YYYY-MM-DD") from exc
        b = b or now
        a = a or b - timedelta(days=30)
        if b <= a or (b - a).days > 3 * 366:
            raise HTTPException(status_code=422, detail="Choose an end date after the start, at most three years apart")
    else:
        # up to and including this moment
        b, a = now + timedelta(microseconds=1), now - timedelta(days=days or 30)
    if compare == "year":
        return Window(a, b, _year_back(a), _year_back(b), "year")
    return Window(a, b, a - (b - a), a, "prev")


def _series(live, win: Window, currency: str) -> dict[str, Any]:
    """Points across the window (days up to 92, else months), each with the period compared beside it."""
    by_day = (win.end - win.start).days <= 92

    def key(w: datetime) -> str:
        return w.date().isoformat() if by_day else f"{w.year:04d}-{w.month:02d}"

    if by_day:
        # Calendar days, the first and the last included even when the period starts or ends partway through one.
        first, last = win.start.date(), (win.end - timedelta(microseconds=1)).date()
        labels = [(first + timedelta(days=i)).isoformat() for i in range((last - first).days + 1)]
    else:
        labels, y, m = [], win.start.year, win.start.month
        while (y, m) <= ((win.end - timedelta(seconds=1)).year, (win.end - timedelta(seconds=1)).month):
            labels.append(f"{y:04d}-{m:02d}")
            y, m = (y, m + 1) if m < 12 else (y + 1, 1)
    now_b = {k: [0, 0.0] for k in labels}
    before = [[0, 0.0] for _ in labels]
    for o, w in live:
        mv = _money(o) if (o.get("currency") or "ILS").upper() == currency else None
        if win.start <= w < win.end:
            k = key(w)
            if k in now_b:
                now_b[k][0] += 1
                now_b[k][1] += mv or 0
        elif win.prev_start <= w < win.prev_end:
            # Lined up by position: day 3 beside day 3 of the period compared, a month beside the same month.
            if by_day:
                i = (w.date() - win.prev_start.date()).days
            else:
                i = (w.year - win.prev_start.year) * 12 + w.month - win.prev_start.month
            if 0 <= i < len(before):
                before[i][0] += 1
                before[i][1] += mv or 0
    return {"unit": "day" if by_day else "month", "points": [
        {"at": k, "orders": now_b[k][0], "revenue": round(now_b[k][1], 2), "orders_before": before[i][0], "revenue_before": round(before[i][1], 2)}
        for i, k in enumerate(labels)]}


def compute(orders: Iterable[dict[str, Any]], days: int, now: datetime, win: Window | None = None) -> dict[str, Any]:
    live = [(o, _when(o)) for o in orders if o.get("status") not in _SKIP]
    live = [(o, w) for o, w in live if w is not None]
    live.sort(key=lambda x: x[1])
    win = win or window(days, None, None, "prev", now)
    start = win.start
    cur = Counter((o.get("currency") or "ILS").upper() for o, _ in live).most_common(1)
    currency = cur[0][0] if cur else "ILS"

    def money_of(rows):
        same = [m for o, _ in rows if (o.get("currency") or "ILS").upper() == currency and (m := _money(o)) is not None]
        return round(sum(same), 2), len(same)

    now_rows = [(o, w) for o, w in live if start <= w < win.end]
    prev_rows = [(o, w) for o, w in live if win.prev_start <= w < win.prev_end]
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
        "days": win.days,
        "start": win.start.date().isoformat(),
        "end": (win.end - timedelta(seconds=1)).date().isoformat(),
        "compare_with": win.compare,
        "series": _series(live, win, currency),
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
        "compare": bool(live) and live[0][1] < win.prev_end,
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
async def business_insights(business_id: str, days: int = Query(30, ge=1, le=366), start: str | None = None, end: str | None = None,
                            compare: str = Query("prev", pattern="^(prev|year)$"), user=Depends(verify_token)):
    biz = await db.businesses.find_one({"_id": business_id}, {"owner_user_id": 1})
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    from utils.business_access import business_access
    await business_access(db, business_id, user, "summary")
    fields = {"_id": 0, "status": 1, "created_at": 1, "total": 1, "subtotal": 1, "currency": 1, "lines": 1, "fulfilment": 1,
              "city": 1, "address": 1, "customer_phone_e164": 1, "customer_phone": 1, "customer_name": 1, "source": 1}
    orders = await db.store_orders.find({"business_id": business_id}, fields).to_list(20000)
    now = datetime.now(_IL)
    return compute(orders, days, now, window(days, start, end, compare, now))


def orders_csv(orders: Iterable[dict[str, Any]], win: Window) -> str:
    """The orders in the window as a spreadsheet, oldest first. Cancelled ones are in it, marked: it is their record."""
    import csv
    import io
    buf = io.StringIO()
    w = csv.writer(buf)

    def cell(v: Any) -> Any:
        # Names and notes come from anyone who orders: one starting with = + - or @ would run as a formula in Excel.
        return "'" + v if isinstance(v, str) and v[:1] in ("=", "+", "-", "@", "\t", "\r") else v
    w.writerow(["Date", "Time", "Order", "Customer", "Phone", "Items", "Total", "Currency", "Status",
                "Delivery or pickup", "Address", "Came from", "Notes"])
    rows = sorted(((o, _when(o)) for o in orders), key=lambda x: x[1] or win.start)
    for o, at in rows:
        if at is None or not (win.start <= at < win.end):
            continue
        lines = o.get("lines") or []
        items = "; ".join(f"{int(ln.get('qty') or 0)} x {ln.get('name') or ''}" for ln in lines) if lines else (o.get("items") or "")
        w.writerow([cell(v) for v in [at.date().isoformat(), at.strftime("%H:%M"), str(o.get("_id") or "")[:8], o.get("customer_name") or "",
                    o.get("customer_phone_e164") or o.get("customer_phone") or "", items,
                    "" if _money(o) is None else _money(o), (o.get("currency") or "ILS").upper(), o.get("status") or "",
                    o.get("fulfilment") or "", o.get("address") or "",
                    "Your page" if o.get("source") == "website" else "Entered by you", (o.get("notes") or "").replace("\n", " ")]])
    # A byte-order mark, so Excel reads Hebrew names as Hebrew.
    return "\ufeff" + buf.getvalue()


@router.get("/businesses/{business_id}/orders.csv")
async def business_orders_csv(business_id: str, days: int = Query(30, ge=1, le=366), start: str | None = None, end: str | None = None,
                              user=Depends(verify_token)):
    from fastapi import Response
    biz = await db.businesses.find_one({"_id": business_id}, {"slug": 1})
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    from utils.business_access import business_access
    await business_access(db, business_id, user, "summary")
    now = datetime.now(_IL)
    win = window(days, start, end, "prev", now)
    orders = await db.store_orders.find({"business_id": business_id}).to_list(20000)
    name = f"orders-{biz.get('slug') or 'business'}-{win.start.date().isoformat()}-to-{(win.end - timedelta(seconds=1)).date().isoformat()}.csv"
    return Response(orders_csv(orders, win), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})
