"""``routes.marketplace`` package — aggregates every marketplace
sub-module into a single ``router`` so ``server.py`` can register the
whole surface with one ``include_router()`` call.

Sub-modules:
  * ``shared`` — constants, helpers, Pydantic models (no endpoints)
  * ``providers`` — categories, locations, languages, nearest-city,
    public provider profile, and the authed provider self-update.
  * ``gigs`` — gig CRUD, browse, booking flow, and reviews.
  * ``requests`` — the demand board: seekers post what they are
    looking for, owners/providers reach them via chat only.
  * ``orders`` — store orders: entry, list, status transitions and the
    paste-a-WhatsApp-message extraction (docs/orders-and-delivery-spec.md).
  * ``subscription`` — PayPal-backed provider Pro subscription lifecycle
    (upgrade, activate, cancel, webhook handler).

Extracted from the single-file ``marketplace.py`` in the 2026-07
refactor. Zero public-API changes — every URL and response shape is
identical, endpoints just live in smaller modules now.
"""
from fastapi import APIRouter

from . import calendar_sync, occasions, rating_badge, payment_requests, leads, counter_sales, prep_route, pairings, tables, birthdays, restock, basket_reminders, busy_times, deposits, gift_cards, feedback, quotes, sessions, appointment_extras, appointment_reminders, automations, businesses, classes, connections, custom_domains, custom_fields, customer_messages, customers, discounts, dropship, gigs, insights, jobs, member_messages, memberships, notification_prefs, orders, page_edits, page_requests, page_versions, photo_match, product_extract, providers, referrals, requests, sales_summary, staff, subscription

# One router that owns every marketplace endpoint. All three sub-modules
# use the same ``/marketplace`` prefix + ``["marketplace"]`` tag on their
# own routers, so path collision is impossible and OpenAPI groups
# correctly.
router = APIRouter()
router.include_router(providers.router)
router.include_router(calendar_sync.router)
router.include_router(counter_sales.router)
router.include_router(prep_route.router)
router.include_router(businesses.router)
router.include_router(page_versions.router)
router.include_router(page_edits.router)
router.include_router(page_requests.router)
router.include_router(orders.router)
router.include_router(memberships.router)
router.include_router(classes.router)
router.include_router(member_messages.router)
router.include_router(custom_fields.router)
router.include_router(product_extract.router)
router.include_router(customers.router)
router.include_router(customer_messages.router)
router.include_router(occasions.router)
router.include_router(rating_badge.router)
router.include_router(payment_requests.router)
router.include_router(leads.router)
router.include_router(discounts.router)
router.include_router(referrals.router)
router.include_router(appointment_reminders.router)
router.include_router(appointment_extras.router)
router.include_router(quotes.router)
router.include_router(sessions.router)
router.include_router(feedback.router)
router.include_router(gift_cards.router)
router.include_router(basket_reminders.router)
router.include_router(deposits.router)
router.include_router(busy_times.router)
router.include_router(restock.router)
router.include_router(birthdays.router)
router.include_router(pairings.router)
router.include_router(tables.router)
router.include_router(custom_domains.router)
router.include_router(sales_summary.router)
router.include_router(staff.router)
router.include_router(insights.router)
router.include_router(connections.router)
router.include_router(automations.router)
router.include_router(dropship.router)
router.include_router(gigs.router)
router.include_router(photo_match.router)
router.include_router(jobs.router)
router.include_router(requests.router)
router.include_router(notification_prefs.router)
router.include_router(subscription.router)

# Re-export the webhook handler so ``routes/payments.py`` (or any future
# caller) can dispatch inbound PayPal events without knowing about the
# sub-module split.
from .subscription import handle_subscription_webhook_event  # noqa: E402,F401

__all__ = ["router", "handle_subscription_webhook_event"]
