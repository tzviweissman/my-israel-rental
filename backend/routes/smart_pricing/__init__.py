"""``routes.smart_pricing`` package — dynamic pricing suggestions,
per-property auto-apply, and the weekly owner insights digest.

Sub-modules:
  * ``shared`` — Pydantic models + pure compute helpers (no endpoints)
  * ``pricing`` — per-property owner endpoints + ``record_view_event``
  * ``daily_loop`` — background sweep (compute + optional auto-apply)
  * ``insights`` — weekly digest email + preferences endpoints

Extracted from the single-file ``smart_pricing.py`` in the 2026-07
refactor. Public functions imported by ``server.py`` and
``routes/properties/browse.py`` are re-exported here so external
callers keep their existing ``from routes.smart_pricing import X``
statements without any change.
"""
from fastapi import APIRouter

from . import insights, pricing

# One router that owns every smart-pricing endpoint.
router = APIRouter()
router.include_router(pricing.router)
router.include_router(insights.router)

# Re-exports — ``server.py`` schedules the two background loops via
# these names, ``routes/properties/browse.py`` records view events
# through ``record_view_event``, and test files import symbols from
# ``shared`` and ``insights`` directly. Keeping them at the package root
# means nothing outside this file needs to know about the split.
from .daily_loop import smart_pricing_daily_loop  # noqa: E402,F401
from .insights import (  # noqa: E402,F401
    _send_owner_digest_if_eligible,
    pricing_insights_weekly_loop,
)
from .pricing import record_view_event  # noqa: E402,F401
from .shared import (  # noqa: E402,F401
    SmartPricingSettings,
    compute_suggestion,
)

__all__ = [
    "router",
    "SmartPricingSettings",
    "compute_suggestion",
    "smart_pricing_daily_loop",
    "pricing_insights_weekly_loop",
    "record_view_event",
    "_send_owner_digest_if_eligible",
]
