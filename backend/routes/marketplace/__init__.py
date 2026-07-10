"""``routes.marketplace`` package — aggregates every marketplace
sub-module into a single ``router`` so ``server.py`` can register the
whole surface with one ``include_router()`` call.

Sub-modules:
  * ``shared`` — constants, helpers, Pydantic models (no endpoints)
  * ``providers`` — categories, locations, languages, nearest-city,
    public provider profile, and the authed provider self-update.
  * ``gigs`` — gig CRUD, browse, booking flow, and reviews.
  * ``subscription`` — PayPal-backed provider Pro subscription lifecycle
    (upgrade, activate, cancel, webhook handler).

Extracted from the single-file ``marketplace.py`` in the 2026-07
refactor. Zero public-API changes — every URL and response shape is
identical, endpoints just live in smaller modules now.
"""
from fastapi import APIRouter

from . import gigs, jobs, providers, subscription

# One router that owns every marketplace endpoint. All three sub-modules
# use the same ``/marketplace`` prefix + ``["marketplace"]`` tag on their
# own routers, so path collision is impossible and OpenAPI groups
# correctly.
router = APIRouter()
router.include_router(providers.router)
router.include_router(gigs.router)
router.include_router(jobs.router)
router.include_router(subscription.router)

# Re-export the webhook handler so ``routes/payments.py`` (or any future
# caller) can dispatch inbound PayPal events without knowing about the
# sub-module split.
from .subscription import handle_subscription_webhook_event  # noqa: E402,F401

__all__ = ["router", "handle_subscription_webhook_event"]
