"""``routes.bookings`` package — booking lifecycle endpoints.

Sub-modules:
  * ``shared`` — cross-endpoint helpers (property/sublease loader,
    overlap check, notifications, ``_compute_booking_total`` engine).
  * ``crud`` — POST /bookings, GET /bookings.
  * ``accept`` — POST /bookings/{id}/accept + helpers.
  * ``cancel`` — cancel, request-cancel, approve-cancel, deny-cancel.
  * ``contract`` — sign-contract, translate-contract.

Extracted from the single-file ``bookings.py`` in the 2026-07 refactor.
Zero public-API changes.

``BookingCreate`` and ``_compute_booking_total`` are re-exported so
``tests/test_smart_pricing_extra.py`` keeps working with its existing
``from routes.bookings import ...`` line.
"""
from fastapi import APIRouter

from . import accept, cancel, contract, crud

# One router that owns every booking endpoint.
router = APIRouter()
router.include_router(crud.router)
router.include_router(accept.router)
router.include_router(cancel.router)
router.include_router(contract.router)

# Legacy re-exports.
from models import BookingCreate  # noqa: E402,F401
from .shared import _compute_booking_total  # noqa: E402,F401

__all__ = ["router", "BookingCreate", "_compute_booking_total"]
