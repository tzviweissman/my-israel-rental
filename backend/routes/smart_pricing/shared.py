"""Smart-Pricing engine — shared Pydantic models and pure compute
helpers used by every sub-module of the ``routes.smart_pricing`` package.

Extracted from the single-file ``smart_pricing.py`` in the 2026-07
refactor. Every function here is pure or read-only against Mongo — no
router, no route decorators. Callers (endpoints, background loops,
insights digest) import what they need.
"""
from __future__ import annotations

import asyncio
import statistics
from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx
from fastapi import HTTPException
from pydantic import BaseModel, Field

from routes.deps import db, logger


class SmartPricingSettings(BaseModel):
    """Per-property pricing rules. All percentages are 0-100 (not 0-1)."""
    enabled: bool = False
    auto_apply: bool = False  # if True, daily cron writes suggestions straight onto the calendar
    base_nightly: float | None = None  # falls back to property.nightly_price
    min_nightly: float = 50
    max_nightly: float = 5000
    weekend_premium_pct: float = 20
    holiday_premium_pct: float = 35
    last_minute_discount_pct: float = 10
    lead_time_premium_pct: float = 5
    high_demand_premium_pct: float = 12
    low_demand_discount_pct: float = 8
    comparable_blend_pct: float = 10  # how strongly to pull toward market median (0=off)


class CalculateRequest(BaseModel):
    days: int = Field(default=60, ge=1, le=180)


class ApplyRequest(BaseModel):
    """Apply suggestions to one or more dates. Empty `dates` = apply all
    open suggestions in the next N days."""
    dates: list[str] = []  # ISO YYYY-MM-DD strings
    days: int = Field(default=60, ge=1, le=180)


class FactorOut(BaseModel):
    name: str
    pct: float  # signed — positive premium, negative discount


class SuggestionOut(BaseModel):
    date: str
    price: int
    base: int
    factors: list[FactorOut]
    reason: str
    override: int | None = None  # current applied override on this date, if any
    booked: bool = False  # date already booked → suggestion is informational only


# ---------------------------------------------------------------------------
# Hebcal — small in-process cache. Diaspora-OFF (i=on) matches Israeli usage.
# ---------------------------------------------------------------------------

_HEBCAL_CACHE: dict[int, dict[str, str]] = {}  # year -> {iso_date: holiday_name}
_HEBCAL_LOCK = asyncio.Lock()

async def _fetch_hebcal_year(year: int) -> dict[str, str]:
    """Return {YYYY-MM-DD: holiday_name} for all `maj=on` Israeli holidays.

    Network failure → empty dict. We log and continue — the engine just
    won't apply a holiday premium that day. Cache is process-lifetime;
    the dataset is tiny (a year's worth of holidays) and changes never
    within a process restart.
    """
    if year in _HEBCAL_CACHE:
        return _HEBCAL_CACHE[year]
    async with _HEBCAL_LOCK:
        if year in _HEBCAL_CACHE:
            return _HEBCAL_CACHE[year]
        try:
            url = f"https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&i=on&year={year}"
            async with httpx.AsyncClient(timeout=8.0) as c:
                r = await c.get(url)
                r.raise_for_status()
                data = r.json()
            out: dict[str, str] = {}
            for item in data.get("items", []) or []:
                # Skip non-yomtov categories — we only want days that
                # actually shift demand (Rosh Hashana, Sukkot, Pesach,
                # Shavuot, Yom Kippur). Hebcal tags those as category
                # "holiday" with `yomtov: true` or as the "holiday"
                # category type. We accept any maj=on item that has a date.
                d = item.get("date", "")[:10]
                if d:
                    out[d] = item.get("title", "Holiday")
            _HEBCAL_CACHE[year] = out
            return out
        except Exception as e:  # noqa: BLE001
            logger.warning(f"smart_pricing: Hebcal fetch for {year} failed ({e}); skipping holiday premium")
            _HEBCAL_CACHE[year] = {}
            return {}


async def _holiday_lookup(start: date, end: date) -> dict[str, str]:
    """Union holidays across the year range so a 60-day window that
    straddles Jan 1 still gets both years' holidays."""
    out: dict[str, str] = {}
    for y in range(start.year, end.year + 1):
        out.update(await _fetch_hebcal_year(y))
    return out


# ---------------------------------------------------------------------------
# Signal computation (one-shot per batch)
# ---------------------------------------------------------------------------

async def _gather_signals(prop: dict[str, Any], start: date, end: date) -> dict[str, Any]:
    """Pre-compute every signal the engine needs for a date window.

    Single Mongo aggregate for comparable median + area-avg views, single
    Hebcal fetch (cached). Per-day computation in compute_suggestion is
    then arithmetic only.
    """
    # 1. Holidays
    holidays = await _holiday_lookup(start, end)

    # 2. Comparable rentals — median nightly of OTHER vacation listings
    #    in the same area, similar bedrooms / guests. Excludes this property.
    bedrooms = prop.get("bedrooms") or 0
    comp_filter = {
        "rental_type": "vacation",
        "area": prop.get("area"),
        "id": {"$ne": prop["id"]},
        "nightly_price": {"$gt": 0},
    }
    if bedrooms:
        comp_filter["bedrooms"] = {"$gte": max(0, bedrooms - 1), "$lte": bedrooms + 1}
    comps = await db.properties.find(
        comp_filter,
        {"_id": 0, "nightly_price": 1, "currency": 1, "max_guests": 1, "amenities": 1, "views": 1},
    ).to_list(length=500)
    # Normalize foreign-currency comps to the property's own currency so a
    # USD-quoted neighbor doesn't poison an ILS median.
    own_ccy = prop.get("currency") or "ILS"
    USD_TO_ILS = 3.7  # rough — full FX is fetched live elsewhere; pricing engine cares about order-of-magnitude
    nightly_values: list[float] = []
    for c in comps:
        np = c.get("nightly_price") or 0
        if np <= 0:
            continue
        ccy = c.get("currency") or "ILS"
        if ccy == own_ccy:
            nightly_values.append(np)
        elif ccy == "USD" and own_ccy == "ILS":
            nightly_values.append(np * USD_TO_ILS)
        elif ccy == "ILS" and own_ccy == "USD":
            nightly_values.append(np / USD_TO_ILS)
    comparable_median = statistics.median(nightly_values) if nightly_values else None

    # 3. Demand: count this property's view events in the last 14 days.
    fourteen_days_ago = datetime.now(UTC) - timedelta(days=14)
    views_14d = await db.property_view_events.count_documents({
        "property_id": prop["id"],
        "at": {"$gte": fourteen_days_ago},
    })
    # Area-average over the same window — gives us a "normal" baseline so
    # we don't flag every property in a low-traffic area as low-demand.
    area_view_pipe = [
        {"$match": {"at": {"$gte": fourteen_days_ago}}},
        {"$lookup": {
            "from": "properties",
            "localField": "property_id",
            "foreignField": "id",
            "as": "p",
        }},
        {"$unwind": "$p"},
        {"$match": {
            "p.area": prop.get("area"),
            "p.rental_type": "vacation",
        }},
        {"$group": {"_id": "$property_id", "count": {"$sum": 1}}},
    ]
    area_counts = [doc["count"] async for doc in db.property_view_events.aggregate(area_view_pipe)]
    area_avg_views = statistics.median(area_counts) if area_counts else 0

    # 4. Booked dates inside the window — suggestions for those dates are
    #    informational only (we still compute and store them so when the
    #    booking gets cancelled the suggestion is fresh).
    booked = await db.bookings.find({
        "property_id": prop["id"],
        "status": {"$in": ["pending", "confirmed"]},
        "start_date": {"$lte": end.isoformat()},
        "end_date": {"$gte": start.isoformat()},
    }, {"_id": 0, "start_date": 1, "end_date": 1}).to_list(length=200)
    booked_dates: set[str] = set()
    for b in booked:
        try:
            s = datetime.fromisoformat(b["start_date"]).date()
            e = datetime.fromisoformat(b["end_date"]).date()
            d = s
            while d <= e:
                booked_dates.add(d.isoformat())
                d += timedelta(days=1)
        except Exception:  # noqa: BLE001
            continue

    return {
        "holidays": holidays,
        "comparable_median": comparable_median,
        "views_14d": views_14d,
        "area_avg_views": area_avg_views,
        "booked_dates": booked_dates,
    }


# ---------------------------------------------------------------------------
# Pricing engine — pure function, fully unit-testable
# ---------------------------------------------------------------------------

def compute_suggestion(
    prop: dict[str, Any],
    settings: SmartPricingSettings,
    target: date,
    signals: dict[str, Any],
    today: date | None = None,
) -> SuggestionOut:
    """Apply rules in fixed order. Multiplicative so percentages compound
    sanely (a Friday + holiday gets premium-on-premium, not flat-summed).
    Order:
      1. weekend_premium
      2. holiday_premium
      3. lead_time (last-minute discount OR early-booking premium)
      4. demand (views_14d vs area_avg)
      5. comparable median nudge (blend, not full pull)
      6. clamp [min_nightly, max_nightly]
    """
    today = today or datetime.now(UTC).date()
    base = settings.base_nightly or prop.get("nightly_price") or 0
    price = float(base)
    factors: list[FactorOut] = []

    # 1. Weekend (Israeli weekend = Fri+Sat, weekday() 4 and 5)
    if target.weekday() in (4, 5):
        pct = settings.weekend_premium_pct
        if pct:
            price *= 1 + pct / 100
            factors.append(FactorOut(name="Weekend premium (Fri/Sat)", pct=pct))

    # 2. Jewish holiday (Hebcal)
    holiday_name = signals.get("holidays", {}).get(target.isoformat())
    if holiday_name and settings.holiday_premium_pct:
        price *= 1 + settings.holiday_premium_pct / 100
        factors.append(FactorOut(
            name=f"Holiday: {holiday_name}", pct=settings.holiday_premium_pct,
        ))

    # 3. Lead time
    lead_days = (target - today).days
    if lead_days < 0:
        # Don't suggest for past dates — short-circuit the rest, return base.
        return SuggestionOut(
            date=target.isoformat(),
            price=int(round(base)),
            base=int(round(base)),
            factors=[],
            reason="Past date — no suggestion.",
        )
    if lead_days <= 7 and settings.last_minute_discount_pct:
        price *= 1 - settings.last_minute_discount_pct / 100
        factors.append(FactorOut(
            name="Last-minute discount", pct=-settings.last_minute_discount_pct,
        ))
    elif lead_days >= 90 and settings.lead_time_premium_pct:
        price *= 1 + settings.lead_time_premium_pct / 100
        factors.append(FactorOut(
            name="Early-booking premium", pct=settings.lead_time_premium_pct,
        ))

    # 4. Demand — views in last 14d vs area median
    v14 = signals.get("views_14d", 0)
    area_avg = signals.get("area_avg_views", 0)
    # Need a non-trivial sample size or the signal is just noise on a quiet area
    if area_avg >= 5:
        if v14 >= area_avg * 1.3 and settings.high_demand_premium_pct:
            price *= 1 + settings.high_demand_premium_pct / 100
            factors.append(FactorOut(
                name=f"High demand ({v14} views in 14d, area avg {int(area_avg)})",
                pct=settings.high_demand_premium_pct,
            ))
        elif v14 <= area_avg * 0.5 and settings.low_demand_discount_pct:
            price *= 1 - settings.low_demand_discount_pct / 100
            factors.append(FactorOut(
                name=f"Soft demand ({v14} views in 14d, area avg {int(area_avg)})",
                pct=-settings.low_demand_discount_pct,
            ))

    # 5. Comparable nudge — gentle blend toward area median
    comp = signals.get("comparable_median")
    if comp and settings.comparable_blend_pct:
        blend = settings.comparable_blend_pct / 100
        new_price = price * (1 - blend) + comp * blend
        delta_pct = ((new_price - price) / price) * 100 if price else 0
        if abs(delta_pct) >= 1:
            price = new_price
            ccy_sym = "₪" if (prop.get("currency") or "ILS") == "ILS" else "$"
            factors.append(FactorOut(
                name=f"Comparable rentals (median {ccy_sym}{int(comp)})",
                pct=round(delta_pct, 1),
            ))

    # 6. Clamp
    price = max(settings.min_nightly, min(settings.max_nightly, price))

    reason = _build_reason(factors, int(round(price)), int(round(base)))

    return SuggestionOut(
        date=target.isoformat(),
        price=int(round(price)),
        base=int(round(base)),
        factors=factors,
        reason=reason,
    )


def _build_reason(factors: list[FactorOut], price: int, base: int) -> str:
    if not factors:
        return f"At your base rate ({base}). No active demand or seasonal signals."
    pos = [f for f in factors if f.pct > 0]
    neg = [f for f in factors if f.pct < 0]
    bits: list[str] = []
    if pos:
        bits.append("up due to " + ", ".join(f.name.lower() for f in pos))
    if neg:
        bits.append("down due to " + ", ".join(f.name.lower() for f in neg))
    delta = price - base
    direction = "Suggested" if delta == 0 else (f"Suggested ↑ +{delta}" if delta > 0 else f"Suggested ↓ {delta}")
    return f"{direction} ({price} vs base {base}) — " + "; ".join(bits) + "."


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _load_property_for_owner(property_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    # Smart Pricing is currently vacation-only — guards against accidental
    # enabling on a long-term listing where the engine wouldn't add value.
    if prop.get("rental_type") != "vacation":
        raise HTTPException(
            status_code=400,
            detail="Smart Pricing is only available on vacation rentals for now.",
        )
    # Owners can only touch their own properties. Admins bypass.
    if payload.get("role") != "admin" and prop.get("owner_id") != payload.get("user_id"):
        raise HTTPException(status_code=403, detail="Not your property")
    return prop


def _settings_from_prop(prop: dict[str, Any]) -> SmartPricingSettings:
    raw = prop.get("smart_pricing") or {}
    # Backfill defaults from the model when the doc is missing fields.
    merged = {**SmartPricingSettings().model_dump(), **raw}
    return SmartPricingSettings(**merged)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

def _forecast(
    prop: dict[str, Any],
    suggestions: list[SuggestionOut],
    booked_dates: set[str],
    settings: SmartPricingSettings,
) -> dict[str, Any]:
    """Naive forecast — assumes every OPEN night gets booked. Overstates
    revenue (real occupancy is rarely 100%) but the delta between
    `base_total` and `smart_total` is occupancy-invariant and that's the
    number the host actually cares about. We surface both totals and the
    delta so they can read it however they want.
    """
    base = settings.base_nightly or prop.get("nightly_price") or 0
    open_nights = [s for s in suggestions if s.date not in booked_dates]
    base_total = sum(base for _ in open_nights)
    smart_total = sum(s.price for s in open_nights)
    delta = smart_total - base_total
    delta_pct = (delta / base_total * 100) if base_total else 0
    return {
        "open_nights": len(open_nights),
        "booked_nights": len(suggestions) - len(open_nights),
        "base_total": int(round(base_total)),
        "smart_total": int(round(smart_total)),
        "delta": int(round(delta)),
        "delta_pct": round(delta_pct, 1),
    }


# ---------------------------------------------------------------------------
# View-event recording (called from the public detail-page endpoint)
# ---------------------------------------------------------------------------

