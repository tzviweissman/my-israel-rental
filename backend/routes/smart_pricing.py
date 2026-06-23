"""Internal Smart Pricing (a.k.a. Dynamic Pricing) engine for vacation rentals.

We deliberately do NOT integrate a third-party API (PriceLabs / Beyond /
Wheelhouse). Two reasons:
  1. Those vendors charge per-listing and would forward that cost to our
     hosts — incompatible with the zero-fee promise of MyIsraelRental.
  2. The Israeli vacation-rental market is small and tightly clustered
     around three big cities + Jewish holidays, so a rule-based engine
     beats a black-box ML pricer on transparency and "why did it suggest
     this?" explainability — which is the #1 ask from owners.

The engine is pure: ``compute_suggestion(property, settings, target_date,
signals) -> SuggestionOut``. Signals are pre-computed once per batch so a
60-day calendar generation stays cheap (one Mongo aggregate, one Hebcal
fetch — both cached, no per-day round-trips).

Pricing rules (all percentages tunable per-property):
  • Weekend premium (Friday + Saturday in Israel)
  • Jewish-holiday premium (Hebcal feed — same source the renter-side
    holiday windows already use)
  • Last-minute discount (≤7 days lead) / Early-booking premium (≥90 days)
  • View-based demand premium / Low-demand discount (rolling 14d events)
  • Comparable-rentals nudge (median nightly of similar listings in same
    area, ±1 bedroom, similar guest count) — gentle 10% blend toward the
    market median

Every factor that fires is recorded in the suggestion's ``factors`` array
so the dashboard can render a "why" line per day.
"""
from __future__ import annotations

import asyncio
import statistics
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from routes.deps import db, logger, verify_token

router = APIRouter()
api_router = router


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

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

@api_router.get("/properties/{property_id}/smart-pricing/settings")
async def get_settings(property_id: str, payload: dict = Depends(verify_token)):
    prop = await _load_property_for_owner(property_id, payload)
    return {
        "settings": _settings_from_prop(prop).model_dump(),
        "currency": prop.get("currency") or "ILS",
        "base_fallback": prop.get("nightly_price") or 0,
    }


@api_router.patch("/properties/{property_id}/smart-pricing/settings")
async def patch_settings(
    property_id: str,
    payload_body: SmartPricingSettings,
    payload: dict = Depends(verify_token),
):
    prop = await _load_property_for_owner(property_id, payload)
    _ = prop  # ownership-check side effect; full doc not needed below
    # Sanity: min must be ≤ max
    if payload_body.min_nightly > payload_body.max_nightly:
        raise HTTPException(status_code=400, detail="min_nightly cannot exceed max_nightly")
    update_doc = {
        **payload_body.model_dump(),
        "updated_at": datetime.now(UTC).isoformat(),
    }
    await db.properties.update_one(
        {"id": property_id},
        {"$set": {"smart_pricing": update_doc}},
    )
    return {"ok": True, "settings": update_doc}


@api_router.post("/properties/{property_id}/smart-pricing/calculate")
async def calculate_suggestions(
    property_id: str,
    body: CalculateRequest,
    payload: dict = Depends(verify_token),
):
    """Generate (don't apply) suggestions for the next N days. Returns one
    SuggestionOut per day plus a revenue forecast for the host. Suggestions
    are persisted with ``applied=False`` so the calendar UI can render them
    on next load without recomputing."""
    prop = await _load_property_for_owner(property_id, payload)
    settings = _settings_from_prop(prop)
    today = datetime.now(UTC).date()
    end = today + timedelta(days=body.days)
    signals = await _gather_signals(prop, today, end)

    # Load existing applied overrides so the calendar can show "applied" status
    existing = {
        d["date"]: d for d in await db.nightly_price_overrides.find(
            {
                "property_id": property_id,
                "date": {"$gte": today.isoformat(), "$lte": end.isoformat()},
            },
            {"_id": 0},
        ).to_list(length=500)
    }

    suggestions: list[SuggestionOut] = []
    bulk_ops: list[Any] = []
    for i in range(body.days):
        d = today + timedelta(days=i)
        s = compute_suggestion(prop, settings, d, signals, today=today)
        s.booked = d.isoformat() in signals["booked_dates"]
        if d.isoformat() in existing and existing[d.isoformat()].get("applied"):
            s.override = int(existing[d.isoformat()].get("price") or 0)
        suggestions.append(s)
        # Upsert suggestion (applied=False unless an applied override already exists)
        if existing.get(d.isoformat(), {}).get("applied"):
            continue  # don't overwrite an applied override with a fresh suggestion
        bulk_ops.append({
            "property_id": property_id,
            "date": d.isoformat(),
            "price": s.price,
            "base": s.base,
            "factors": [f.model_dump() for f in s.factors],
            "reason": s.reason,
            "source": "smart",
            "applied": False,
            "updated_at": datetime.now(UTC).isoformat(),
        })

    # Bulk upsert — one round-trip even for a 60-day window
    if bulk_ops:
        from pymongo import UpdateOne
        await db.nightly_price_overrides.bulk_write([
            UpdateOne(
                {"property_id": op["property_id"], "date": op["date"]},
                {"$set": op, "$setOnInsert": {"id": str(uuid.uuid4())}},
                upsert=True,
            )
            for op in bulk_ops
        ])

    forecast = _forecast(prop, suggestions, signals["booked_dates"], settings)
    return {
        "ok": True,
        "currency": prop.get("currency") or "ILS",
        "base": settings.base_nightly or prop.get("nightly_price") or 0,
        "suggestions": [s.model_dump() for s in suggestions],
        "forecast": forecast,
    }


@api_router.post("/properties/{property_id}/smart-pricing/apply")
async def apply_suggestions(
    property_id: str,
    body: ApplyRequest,
    payload: dict = Depends(verify_token),
):
    """Mark one or more suggestions as ``applied=True``. Empty ``dates`` =
    apply ALL outstanding suggestions in the next N days. The calendar
    layer reads `applied=True` overrides when computing the per-night
    booking total."""
    await _load_property_for_owner(property_id, payload)
    today = datetime.now(UTC).date()
    if body.dates:
        date_filter = {"$in": body.dates}
    else:
        end = today + timedelta(days=body.days)
        date_filter = {"$gte": today.isoformat(), "$lte": end.isoformat()}
    res = await db.nightly_price_overrides.update_many(
        {
            "property_id": property_id,
            "date": date_filter,
            "source": "smart",
        },
        {
            "$set": {
                "applied": True,
                "applied_at": datetime.now(UTC).isoformat(),
            },
        },
    )
    return {"ok": True, "applied_count": res.modified_count}


@api_router.delete("/properties/{property_id}/smart-pricing/apply/{day}")
async def revert_applied(
    property_id: str,
    day: str,
    payload: dict = Depends(verify_token),
):
    """Un-apply a single date's suggestion — sets applied=False so the
    booking flow falls back to the base nightly_price for that night."""
    await _load_property_for_owner(property_id, payload)
    res = await db.nightly_price_overrides.update_one(
        {"property_id": property_id, "date": day, "source": "smart"},
        {"$set": {"applied": False}},
    )
    return {"ok": True, "reverted": res.modified_count == 1}


# ---------------------------------------------------------------------------
# Revenue forecast
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

async def record_view_event(property_id: str) -> None:
    """Fire-and-forget timestamped view log. Drives the demand signal.
    Failures are swallowed so a Mongo hiccup never breaks a property page
    render. Idempotency is intentionally not enforced — duplicate refreshes
    DO count as repeat interest, which is the signal we want."""
    try:
        await db.property_view_events.insert_one({
            "property_id": property_id,
            "at": datetime.now(UTC),
        })
    except Exception as e:  # noqa: BLE001
        logger.debug(f"property_view_events insert failed (non-fatal): {e}")


# ---------------------------------------------------------------------------
# Daily cron — recalculates suggestions for every enabled property
# ---------------------------------------------------------------------------

async def smart_pricing_daily_loop() -> None:
    """Sleeps until the next 03:00 UTC, then refreshes every enabled
    property's suggestions. Re-entrant — survives reboots cleanly because
    the wakeup pegs to a wall-clock minute, not "X hours from start"."""
    while True:
        now = datetime.now(UTC)
        # Next 03:00 UTC (chosen to land after most Israeli-evening view
        # bursts have settled and before the morning booking peak).
        next_run = now.replace(hour=3, minute=0, second=0, microsecond=0)
        if next_run <= now:
            next_run += timedelta(days=1)
        await asyncio.sleep((next_run - now).total_seconds())
        try:
            await _refresh_all_enabled()
        except Exception as e:  # noqa: BLE001
            logger.warning(f"smart_pricing daily loop crashed: {e}")


async def _refresh_all_enabled() -> None:
    """For every property with smart_pricing.enabled=True, recompute next
    60 days. If auto_apply=True, the suggestions are applied immediately."""
    cursor = db.properties.find(
        {"smart_pricing.enabled": True, "rental_type": "vacation"},
        {"_id": 0},
    )
    today = datetime.now(UTC).date()
    end = today + timedelta(days=60)
    refreshed = 0
    auto_applied = 0
    async for prop in cursor:
        try:
            settings = _settings_from_prop(prop)
            signals = await _gather_signals(prop, today, end)
            from pymongo import UpdateOne
            ops = []
            for i in range(60):
                d = today + timedelta(days=i)
                s = compute_suggestion(prop, settings, d, signals, today=today)
                ops.append(UpdateOne(
                    {"property_id": prop["id"], "date": d.isoformat()},
                    {
                        "$set": {
                            "price": s.price,
                            "base": s.base,
                            "factors": [f.model_dump() for f in s.factors],
                            "reason": s.reason,
                            "source": "smart",
                            "applied": settings.auto_apply,
                            "updated_at": datetime.now(UTC).isoformat(),
                            **({"applied_at": datetime.now(UTC).isoformat()} if settings.auto_apply else {}),
                        },
                        "$setOnInsert": {"id": str(uuid.uuid4())},
                    },
                    upsert=True,
                ))
            if ops:
                await db.nightly_price_overrides.bulk_write(ops)
            refreshed += 1
            if settings.auto_apply:
                auto_applied += 1
        except Exception as e:  # noqa: BLE001
            logger.warning(f"smart_pricing refresh failed for {prop.get('id')}: {e}")
    if refreshed:
        logger.info(f"smart_pricing daily refresh: {refreshed} properties, {auto_applied} with auto-apply")



# ---------------------------------------------------------------------------
# Weekly Pricing Insights digest (Sunday 07:00 UTC ≈ Sunday 10:00 IDT)
# ---------------------------------------------------------------------------

async def _build_owner_digest(owner_id: str) -> dict | None:
    """Aggregate one owner's Smart Pricing activity into a digest payload.

    Returns ``None`` when the owner has zero enabled vacation properties.
    Empty / zero-delta payloads ARE returned — the caller decides whether
    to actually email them (cron skips, /send-sample sends regardless).
    """
    props = await db.properties.find(
        {
            "owner_id": owner_id,
            "rental_type": "vacation",
            "smart_pricing.enabled": True,
        },
        {"_id": 0},
    ).to_list(length=200)
    if not props:
        return None

    today = datetime.now(UTC).date()
    end_30 = today + timedelta(days=30)
    week_ago = datetime.now(UTC) - timedelta(days=7)

    # Count overrides actually applied to the calendar in the last 7 days —
    # this is the "X nights applied this week" line in the email hero.
    applied_this_week = await db.nightly_price_overrides.count_documents({
        "property_id": {"$in": [p["id"] for p in props]},
        "applied": True,
        "applied_at": {"$gte": week_ago.isoformat()},
    })

    properties_data: list[dict] = []
    total_delta = 0.0
    primary_currency = props[0].get("currency") or "ILS"
    for prop in props:
        try:
            settings = _settings_from_prop(prop)
            signals = await _gather_signals(prop, today, end_30)
            suggestions = []
            for i in range(30):
                d = today + timedelta(days=i)
                suggestions.append(compute_suggestion(prop, settings, d, signals, today=today))
            forecast = _forecast(
                prop,
                suggestions,
                signals.get("booked_dates", set()),
                settings,
            )
            # Pick the single most interesting recent adjustment to surface
            # in the digest. Largest |delta| from base in the next 14 days
            # — gives the host a concrete "see, the engine is working" beat.
            notable = max(
                (s for s in suggestions[:14] if s.price != s.base),
                key=lambda s: abs(s.price - s.base),
                default=None,
            )
            notable_text = None
            if notable:
                sym = "₪" if (prop.get("currency") or "ILS") == "ILS" else "$"
                direction = "↑" if notable.price > notable.base else "↓"
                first_factor = notable.factors[0].name if notable.factors else "Smart Pricing"
                notable_text = (
                    f"{direction} {sym}{notable.price} on {notable.date} "
                    f"(was {sym}{notable.base}) — {first_factor.lower()}"
                )

            properties_data.append({
                "id": prop["id"],
                "title": prop.get("title", "Untitled"),
                "area": prop.get("area", ""),
                "currency": prop.get("currency") or "ILS",
                "delta": forecast["delta"],
                "delta_pct": forecast["delta_pct"],
                "notable_adjustment": notable_text,
            })
            # Sum deltas only when currencies match — mixing $/₪ would
            # produce a nonsense total. Multi-currency portfolios are
            # rare in practice; the email just shows the dominant ccy.
            if (prop.get("currency") or "ILS") == primary_currency:
                total_delta += forecast["delta"]
        except Exception as e:  # noqa: BLE001
            logger.warning(f"insights aggregate failed for {prop.get('id')}: {e}")

    return {
        "properties_data": properties_data,
        "week_summary": {
            "total_delta": int(round(total_delta)),
            "currency": primary_currency,
            "property_count": len(properties_data),
            "applied_this_week": applied_this_week,
        },
    }


async def _send_owner_digest_if_eligible(owner: dict) -> bool:
    """Per-owner digest send for the weekly cron. Returns True if an email
    was queued, False if skipped (opt-out, suppression, or no activity)."""
    if owner.get("pricing_insights_optout"):
        return False
    if owner.get("email_suppressed"):
        return False
    payload = await _build_owner_digest(owner["id"])
    if not payload:
        return False
    # Skip purely-noise digests in the automated cron — but a manual
    # /send-sample call gets through regardless (see endpoint below).
    if (
        payload["week_summary"]["total_delta"] == 0
        and payload["week_summary"]["applied_this_week"] == 0
    ):
        return False
    from utils.email import send_pricing_insights_email
    try:
        ok = await send_pricing_insights_email(
            to_email=owner["email"],
            owner_name=owner.get("name", ""),
            properties_data=payload["properties_data"],
            week_summary=payload["week_summary"],
        )
        if ok:
            await db.users.update_one(
                {"id": owner["id"]},
                {"$set": {"last_pricing_insights_sent_at": datetime.now(UTC).isoformat()}},
            )
        return ok
    except Exception as e:  # noqa: BLE001
        logger.warning(f"pricing_insights send failed for {owner.get('email')}: {e}")
        return False


async def pricing_insights_weekly_loop() -> None:
    """Every Sunday at 07:00 UTC (≈ 10:00 Israel time — well-timed for
    Sunday morning when Israeli hosts start their work week and check
    earnings before heading out)."""
    while True:
        now = datetime.now(UTC)
        # Find next Sunday 07:00. weekday(): Mon=0 … Sun=6.
        days_ahead = (6 - now.weekday()) % 7
        next_run = (now + timedelta(days=days_ahead)).replace(
            hour=7, minute=0, second=0, microsecond=0,
        )
        if next_run <= now:
            next_run += timedelta(days=7)
        await asyncio.sleep((next_run - now).total_seconds())
        try:
            await _send_pricing_insights_to_all()
        except Exception as e:  # noqa: BLE001
            logger.warning(f"pricing_insights weekly loop crashed: {e}")


async def _send_pricing_insights_to_all() -> None:
    """Iterate every distinct owner with at least one enabled vacation
    listing and send each their digest. Sequential by design — Postmark
    will rate-limit if we fan out 1000 concurrent sends, and on our scale
    (low hundreds of owners) the latency is irrelevant."""
    owner_ids = await db.properties.distinct(
        "owner_id",
        {"rental_type": "vacation", "smart_pricing.enabled": True},
    )
    if not owner_ids:
        return
    owners = await db.users.find(
        {"id": {"$in": owner_ids}},
        {"_id": 0, "id": 1, "email": 1, "name": 1, "pricing_insights_optout": 1, "email_suppressed": 1},
    ).to_list(length=2000)
    sent = 0
    for owner in owners:
        if not owner.get("email"):
            continue
        if await _send_owner_digest_if_eligible(owner):
            sent += 1
    logger.info(f"pricing_insights weekly: {sent}/{len(owners)} sent")


# Owner-facing "send me a sample now" endpoint — lets owners preview the
# weekly digest from their dashboard without waiting until Sunday.
@api_router.post("/smart-pricing/insights/send-sample")
async def send_sample_insights(payload: dict = Depends(verify_token)):
    """Owner clicks this in their dashboard to preview the weekly digest in
    their own inbox. Bypasses the "0-delta skip" guard so they always see
    a real email, even when their listings have no notable adjustments yet.
    """
    user = await db.users.find_one(
        {"id": payload.get("user_id")},
        {"_id": 0, "id": 1, "email": 1, "name": 1, "pricing_insights_optout": 1},
    )
    if not user or not user.get("email"):
        raise HTTPException(status_code=404, detail="User not found")
    digest = await _build_owner_digest(user["id"])
    if not digest:
        raise HTTPException(
            status_code=400,
            detail="Enable Smart Pricing on at least one vacation listing to preview the digest.",
        )
    from utils.email import send_pricing_insights_email
    ok = await send_pricing_insights_email(
        to_email=user["email"],
        owner_name=user.get("name", ""),
        properties_data=digest["properties_data"],
        week_summary=digest["week_summary"],
    )
    if not ok:
        raise HTTPException(
            status_code=500,
            detail="Couldn't send the sample (Postmark suppression or transient error). Try again in a minute.",
        )
    return {"ok": True, "sent_to": user["email"]}


# Opt-out toggle — owners can disable weekly digest from settings
class InsightsPrefBody(BaseModel):
    optout: bool


@api_router.patch("/smart-pricing/insights/preferences")
async def update_insights_pref(
    body: InsightsPrefBody,
    payload: dict = Depends(verify_token),
):
    await db.users.update_one(
        {"id": payload.get("user_id")},
        {"$set": {"pricing_insights_optout": body.optout}},
    )
    return {"ok": True, "optout": body.optout}


@api_router.get("/smart-pricing/insights/preferences")
async def get_insights_pref(payload: dict = Depends(verify_token)):
    user = await db.users.find_one(
        {"id": payload.get("user_id")},
        {"_id": 0, "pricing_insights_optout": 1, "last_pricing_insights_sent_at": 1},
    )
    return {
        "optout": bool((user or {}).get("pricing_insights_optout")),
        "last_sent_at": (user or {}).get("last_pricing_insights_sent_at"),
    }
