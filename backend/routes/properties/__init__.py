"""``routes.properties`` package — aggregates every property-related
sub-module into a single ``router`` so ``server.py`` can register the
whole surface with one ``include_router()`` call.

Sub-modules:
  * ``shared`` — helpers used by every sub-module (no endpoints)
  * ``browse`` — public list, detail, and manager listing
  * ``crud`` — POST / PUT / DELETE / cover-image endpoints (owner CRUD)
  * ``bulk`` — bulk-edit and bulk-images endpoints
  * ``likes`` — renter like-toggle + liked-properties reads
  * ``contract`` — property contract upload / view / delete
  * ``availability`` — owner-facing availability calendar
  * ``quote`` — public price-a-date-window endpoint

Extracted from the single-file ``properties.py`` in the 2026-07 refactor.
Zero public-API changes — every URL and response shape is identical.
"""
from fastapi import APIRouter

from . import availability, browse, bulk, contract, crud, likes, quote

# One router that owns every property endpoint. Sub-module inclusion
# order is irrelevant because every path is unique.
router = APIRouter()
router.include_router(browse.router)
router.include_router(crud.router)
router.include_router(bulk.router)
router.include_router(likes.router)
router.include_router(contract.router)
router.include_router(availability.router)
router.include_router(quote.router)

__all__ = ["router", "delete_property"]

# Legacy re-export — test files import ``delete_property`` directly from
# ``routes.properties`` to invoke the handler in-process. Kept alive by
# the sub-module split so those tests don't need to change import paths.
from .crud import delete_property  # noqa: E402,F401
