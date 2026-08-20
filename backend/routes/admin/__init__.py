"""``routes.admin`` package — aggregates every admin sub-module into a
single ``router`` so ``server.py`` can register the whole admin surface
with one ``include_router()`` call.

Sub-modules:
  * ``core`` — dashboard, bookings, users, settings
  * ``events`` — SSE stream, Postmark webhook, email-health
  * ``duplicates`` — duplicate detection + auto-cleanup
  * ``chats_nudge`` — chat list, reattach, owner-nudge system
  * ``properties_bulk`` — bulk delete/restore/mark-booked, featured/managed toggles
  * ``marketplace`` — services, marketplace counts, attention queue

Public names historically exported from ``routes.admin`` (background
task hooks + shared helpers) are re-exported here for import stability.
"""
from fastapi import APIRouter

from . import chats_nudge, core, duplicates, events, marketplace, properties_bulk

# One router that owns every admin endpoint. Order of inclusion is
# irrelevant because each sub-module attaches to its own path prefix.
router = APIRouter()
router.include_router(core.router)
router.include_router(events.router)
router.include_router(duplicates.router)
router.include_router(chats_nudge.router)
router.include_router(marketplace.router)
router.include_router(properties_bulk.router)

# Re-exports so callers that used to do ``from routes.admin import X``
# keep working without touching the call site. ``server.py``'s startup
# hook imports these at runtime for the background loops.
from .chats_nudge import (  # noqa: E402,F401
    AUTO_NUDGE_LOOP_INTERVAL_SEC,
    run_auto_owner_nudge_pass,
)
from .duplicates import run_duplicate_auto_cleanup  # noqa: E402,F401

__all__ = [
    "router",
    "run_duplicate_auto_cleanup",
    "run_auto_owner_nudge_pass",
    "AUTO_NUDGE_LOOP_INTERVAL_SEC",
]
