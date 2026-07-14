"""Weekly pricing-insights digest email + owner preferences.

Builds an owner-scoped digest of every enabled property's suggested
7-day price adjustments, sends via Postmark once a week, and exposes
GET/PATCH preferences endpoints so owners can opt in / out or choose a
different send day.

Extracted from ``smart_pricing.py`` in the 2026-07 refactor.
"""
from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from routes.deps import db, logger, verify_token

from .shared import (
    _forecast,
    _gather_signals,
    _settings_from_prop,
    compute_suggestion,
)

router = APIRouter()
api_router = router


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
