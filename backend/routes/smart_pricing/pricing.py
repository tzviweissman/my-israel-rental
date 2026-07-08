"""Smart-Pricing per-property owner endpoints.

Get/patch settings, calculate suggestions for the next 30 days, apply
them (with a 7-day rollback window), revert a specific day, and the
``record_view_event`` hook that the public property-detail route calls
to feed demand signal.

Extracted from ``smart_pricing.py`` in the 2026-07 refactor.
"""
from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from routes.deps import db, logger, verify_token

from .shared import (
    ApplyRequest,
    CalculateRequest,
    SmartPricingSettings,
    SuggestionOut,
    _forecast,
    _gather_signals,
    _load_property_for_owner,
    _settings_from_prop,
    compute_suggestion,
)

router = APIRouter()
api_router = router


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
