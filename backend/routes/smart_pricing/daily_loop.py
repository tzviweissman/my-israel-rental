"""Smart-Pricing background sweep — runs once a day, computing
suggestions for every property with smart-pricing enabled and applying
them when the owner opted into auto-apply.

Extracted from ``smart_pricing.py`` in the 2026-07 refactor.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from routes.deps import db, logger

from .shared import (
    _gather_signals,
    _settings_from_prop,
    compute_suggestion,
)


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
