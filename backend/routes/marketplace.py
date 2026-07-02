"""Services Marketplace — Phase 1a MVP.

Fee model: monthly subscription for providers (30-day trial on first gig,
`subscription_status` gates public visibility once the trial ends). Real
payment wiring lands in Phase 1b — for now the "Upgrade to Pro" flow
just flips the flag server-side.

Booking: each gig picks one of two modes at creation time —
  * `whatsapp` — clients see a WhatsApp deep-link on the gig detail
  * `in_platform` — clients submit a booking request, which stores a
    row and (Phase 1b) fires notifications to the provider.

Endpoints:
  GET  /api/marketplace/categories                — 12 seed categories
  GET  /api/marketplace/gigs                      — public browse, ?category, ?q
  POST /api/marketplace/gigs                      — auth: create a gig
  GET  /api/marketplace/gigs/{id}                 — public detail
  PATCH /api/marketplace/gigs/{id}                — auth: owner update
  DELETE /api/marketplace/gigs/{id}               — auth: owner delete
  POST /api/marketplace/gigs/{id}/book            — auth: in-platform booking
  GET  /api/marketplace/providers/{user_id}       — public provider profile
  PATCH /api/marketplace/providers/me             — auth: update own profile
  POST /api/marketplace/subscription/upgrade      — auth: flip subscription flag
  GET  /api/marketplace/my-gigs                   — auth: gigs I own
"""
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from routes.deps import db, logger, verify_token
from utils import paypal

UTC = timezone.utc

# ---- Subscription plan constants -------------------------------------------
SUBSCRIPTION_PRICE = 25.00
SUBSCRIPTION_CURRENCY = "USD"
SUBSCRIPTION_INTERVAL = "MONTH"
PLAN_NAME = "MyIsraelRental Pro (monthly)"
PLAN_DESCRIPTION = "Publish unlimited gigs on the MyIsraelRental Services Marketplace."
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://myisraelrental.com").rstrip("/")

# 12 seed categories per user's Phase 1 scope (2026-07-01).
CATEGORIES = [
    {"slug": "cleaning",           "label": "Cleaning",           "icon": "sparkles"},
    {"slug": "moving",             "label": "Moving",             "icon": "truck"},
    {"slug": "locksmith",          "label": "Locksmith",          "icon": "key"},
    {"slug": "handyman",           "label": "Handyman",           "icon": "wrench"},
    {"slug": "photography",        "label": "Photography",        "icon": "camera"},
    {"slug": "interior-design",    "label": "Interior design",    "icon": "palette"},
    {"slug": "tour-guide",         "label": "Tour guide",         "icon": "map"},
    {"slug": "furniture-assembly", "label": "Furniture assembly", "icon": "hammer"},
    {"slug": "barber",             "label": "Barber",             "icon": "scissors"},
    {"slug": "ac-cleaner",         "label": "AC cleaner",         "icon": "wind"},
    {"slug": "plumber",            "label": "Plumber",            "icon": "droplet"},
    {"slug": "electrician",        "label": "Electrician",        "icon": "zap"},
]
_CATEGORY_SLUGS = {c["slug"] for c in CATEGORIES}

router = APIRouter(prefix="/marketplace", tags=["marketplace"])


# --------------------------- Models --------------------------- #

class PricingTier(BaseModel):
    name: str = "Basic"            # Basic / Standard / Premium (free-form)
    price: float                   # ILS by default
    currency: str = "ILS"
    delivery_days: Optional[int] = None
    description: str = ""
    features: list[str] = Field(default_factory=list)


class GigIn(BaseModel):
    title: str
    category: str
    description: str = ""
    tiers: list[PricingTier] = Field(default_factory=list)
    gallery: list[str] = Field(default_factory=list)      # image URLs
    booking_mode: str = "whatsapp"                        # "whatsapp" | "in_platform"
    whatsapp: Optional[str] = None                        # required if booking_mode = whatsapp
    area: Optional[str] = None                            # Tel Aviv / Jerusalem / etc.
    faqs: list[dict[str, str]] = Field(default_factory=list)  # [{q, a}]


class GigPatch(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    tiers: Optional[list[PricingTier]] = None
    gallery: Optional[list[str]] = None
    booking_mode: Optional[str] = None
    whatsapp: Optional[str] = None
    area: Optional[str] = None
    faqs: Optional[list[dict[str, str]]] = None
    status: Optional[str] = None      # "draft" | "published" | "paused"


class ProviderPatch(BaseModel):
    bio: Optional[str] = None
    whatsapp: Optional[str] = None
    avatar: Optional[str] = None
    tagline: Optional[str] = None


class BookingIn(BaseModel):
    tier_name: str
    message: str = ""
    contact_email: str
    contact_phone: Optional[str] = None
    preferred_date: Optional[str] = None                  # ISO YYYY-MM-DD


class ReviewIn(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    # Cap at 1000 chars so an attacker can't post 10 MB of text to the
    # public reviews collection (bandwidth + storage DoS).
    comment: str = Field("", max_length=1000)


# --------------------------- Helpers --------------------------- #

def _validate_category(cat: str) -> None:
    if cat not in _CATEGORY_SLUGS:
        raise HTTPException(status_code=400, detail=f"Unknown category '{cat}'")


async def _ensure_provider_record(user_id: str) -> dict[str, Any]:
    """Create the marketplace_providers row on first gig create. Every
    provider starts with a 30-day trial — after that their gigs stop
    showing publicly until subscription_status flips to 'active'."""
    prov = await db.marketplace_providers.find_one({"user_id": user_id})
    if prov:
        return prov
    now = datetime.now(UTC)
    prov = {
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "bio": "",
        "tagline": "",
        "avatar": None,
        "whatsapp": None,
        "subscription_status": "trial",
        "trial_ends_at": (now + timedelta(days=30)).isoformat(),
        "subscribed_until": None,
        "created_at": now.isoformat(),
    }
    await db.marketplace_providers.insert_one(prov)
    return prov


def _provider_is_active(prov: dict[str, Any]) -> bool:
    """True while the provider can still publish new/active gigs."""
    if prov.get("subscription_status") == "active":
        return True
    trial_end = prov.get("trial_ends_at")
    if not trial_end:
        return False
    try:
        return datetime.fromisoformat(trial_end) > datetime.now(UTC)
    except (ValueError, TypeError):
        return False


def _clean_gig(gig: dict[str, Any]) -> dict[str, Any]:
    """Strip Mongo internals + rename `_id` → `id` for the API surface."""
    gig["id"] = gig.pop("_id", gig.get("id"))
    return gig


async def _rating_aggregate(gig_id: str) -> dict[str, Any]:
    """Compute {rating_avg, rating_count} for one gig. Small scale — a
    single `$group` over the reviews collection. `rating_avg` is rounded
    to 1 decimal so the UI can render '4.7' without runtime math."""
    pipeline = [
        {"$match": {"gig_id": gig_id}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
    ]
    async for row in db.marketplace_reviews.aggregate(pipeline):
        return {
            "rating_avg": round(row["avg"], 1) if row.get("avg") is not None else None,
            "rating_count": row.get("count", 0),
        }
    return {"rating_avg": None, "rating_count": 0}


async def _batch_rating_aggregate(gig_ids: list[str]) -> dict[str, dict[str, Any]]:
    """Batched version — single aggregation across many gigs at once so
    the public browse route doesn't fire N+1 review queries."""
    if not gig_ids:
        return {}
    pipeline = [
        {"$match": {"gig_id": {"$in": gig_ids}}},
        {"$group": {"_id": "$gig_id", "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
    ]
    result: dict[str, dict[str, Any]] = {}
    async for row in db.marketplace_reviews.aggregate(pipeline):
        result[row["_id"]] = {
            "rating_avg": round(row["avg"], 1) if row.get("avg") is not None else None,
            "rating_count": row.get("count", 0),
        }
    return result


async def _get_or_create_billing_plan() -> str:
    """Return the PayPal plan_id for our Pro subscription. Caches the id
    (plus the parent product_id) in the `marketplace_settings` singleton
    doc so repeated deploys don't create duplicate plans on PayPal."""
    settings = await db.marketplace_settings.find_one({"_id": "paypal_plan"})
    if settings and settings.get("plan_id"):
        return settings["plan_id"]

    # Idempotent bootstrap: create the product first, then the plan.
    product = await paypal.create_product(name=PLAN_NAME, description=PLAN_DESCRIPTION)
    product_id = product["id"]
    plan = await paypal.create_plan(
        product_id=product_id,
        name=PLAN_NAME,
        amount=SUBSCRIPTION_PRICE,
        currency=SUBSCRIPTION_CURRENCY,
        interval_unit=SUBSCRIPTION_INTERVAL,
        interval_count=1,
    )
    plan_id = plan["id"]
    await db.marketplace_settings.update_one(
        {"_id": "paypal_plan"},
        {"$set": {
            "product_id": product_id,
            "plan_id": plan_id,
            "amount": SUBSCRIPTION_PRICE,
            "currency": SUBSCRIPTION_CURRENCY,
            "created_at": datetime.now(UTC).isoformat(),
        }},
        upsert=True,
    )
    logger.info("[marketplace] Created PayPal product=%s plan=%s", product_id, plan_id)
    return plan_id


# --------------------------- Routes --------------------------- #

@router.get("/categories")
async def list_categories():
    return CATEGORIES


@router.get("/gigs")
async def list_gigs(
    category: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = Query(60, ge=1, le=200),
):
    query: dict[str, Any] = {"status": "published"}
    if category:
        _validate_category(category)
        query["category"] = category
    if q:
        # SEC-003: escape the user input so it's treated as a literal
        # substring, not a regex — prevents catastrophic-backtracking DoS
        # on this unauthenticated endpoint. Also cap the length to keep
        # the query size sane.
        needle = re.escape(q[:80])
        query["$or"] = [
            {"title": {"$regex": needle, "$options": "i"}},
            {"description": {"$regex": needle, "$options": "i"}},
        ]
    cursor = db.marketplace_gigs.find(query).sort("created_at", -1).limit(limit)
    raw = [g async for g in cursor]
    # Filter to active providers first, then batch-load ratings in one query.
    kept: list[dict[str, Any]] = []
    for gig in raw:
        prov = await db.marketplace_providers.find_one({"user_id": gig.get("provider_user_id")})
        if not prov or not _provider_is_active(prov):
            continue  # Hide expired-trial providers from public browse.
        user = await db.users.find_one({"_id": gig.get("provider_user_id")}) \
            or await db.users.find_one({"id": gig.get("provider_user_id")})
        gig["provider"] = {
            "user_id": gig.get("provider_user_id"),
            "name": (user or {}).get("name", "Provider"),
            "avatar": prov.get("avatar"),
            "tagline": prov.get("tagline"),
        }
        kept.append(gig)
    ratings = await _batch_rating_aggregate([g["_id"] for g in kept])
    for gig in kept:
        agg = ratings.get(gig["_id"], {"rating_avg": None, "rating_count": 0})
        gig["rating_avg"] = agg["rating_avg"]
        gig["rating_count"] = agg["rating_count"]
    return [_clean_gig(g) for g in kept]


@router.post("/gigs")
async def create_gig(payload: GigIn, user=Depends(verify_token)):
    _validate_category(payload.category)
    if payload.booking_mode not in ("whatsapp", "in_platform"):
        raise HTTPException(status_code=400, detail="booking_mode must be 'whatsapp' or 'in_platform'")
    if payload.booking_mode == "whatsapp" and not (payload.whatsapp or "").strip():
        raise HTTPException(status_code=400, detail="WhatsApp number required for WhatsApp booking mode")
    prov = await _ensure_provider_record(user["user_id"])
    now = datetime.now(UTC).isoformat()
    gig = {
        "_id": str(uuid.uuid4()),
        "provider_user_id": user["user_id"],
        "provider_id": prov["_id"],
        "title": payload.title.strip(),
        "category": payload.category,
        "description": payload.description,
        "tiers": [t.model_dump() for t in payload.tiers],
        "gallery": payload.gallery,
        "booking_mode": payload.booking_mode,
        "whatsapp": payload.whatsapp,
        "area": payload.area,
        "faqs": payload.faqs,
        "status": "published",
        "created_at": now,
        "updated_at": now,
    }
    await db.marketplace_gigs.insert_one(gig)
    return _clean_gig(gig)


@router.get("/gigs/{gig_id}")
async def get_gig(gig_id: str):
    gig = await db.marketplace_gigs.find_one({"_id": gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    prov = await db.marketplace_providers.find_one({"user_id": gig["provider_user_id"]})
    user = await db.users.find_one({"_id": gig["provider_user_id"]}) \
        or await db.users.find_one({"id": gig["provider_user_id"]})
    gig["provider"] = {
        "user_id": gig["provider_user_id"],
        "name": (user or {}).get("name", "Provider"),
        "avatar": (prov or {}).get("avatar"),
        "tagline": (prov or {}).get("tagline"),
        "bio": (prov or {}).get("bio"),
        "active": _provider_is_active(prov or {}),
    }
    agg = await _rating_aggregate(gig_id)
    gig["rating_avg"] = agg["rating_avg"]
    gig["rating_count"] = agg["rating_count"]
    return _clean_gig(gig)


@router.patch("/gigs/{gig_id}")
async def patch_gig(gig_id: str, payload: GigPatch, user=Depends(verify_token)):
    gig = await db.marketplace_gigs.find_one({"_id": gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    if gig["provider_user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your gig")
    update = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if "tiers" in update:
        update["tiers"] = [t if isinstance(t, dict) else t.model_dump() for t in update["tiers"]]
    if "category" in update:
        _validate_category(update["category"])
    update["updated_at"] = datetime.now(UTC).isoformat()
    await db.marketplace_gigs.update_one({"_id": gig_id}, {"$set": update})
    fresh = await db.marketplace_gigs.find_one({"_id": gig_id})
    return _clean_gig(fresh)


@router.delete("/gigs/{gig_id}")
async def delete_gig(gig_id: str, user=Depends(verify_token)):
    gig = await db.marketplace_gigs.find_one({"_id": gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    if gig["provider_user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your gig")
    await db.marketplace_gigs.delete_one({"_id": gig_id})
    return {"ok": True}


@router.get("/my-gigs")
async def my_gigs(user=Depends(verify_token)):
    cursor = db.marketplace_gigs.find({"provider_user_id": user["user_id"]}).sort("created_at", -1)
    out = [_clean_gig(g) async for g in cursor]
    prov = await db.marketplace_providers.find_one({"user_id": user["user_id"]})
    return {
        "gigs": out,
        "provider": {
            "subscription_status": (prov or {}).get("subscription_status", "trial"),
            "trial_ends_at": (prov or {}).get("trial_ends_at"),
            "subscribed_until": (prov or {}).get("subscribed_until"),
            "active": _provider_is_active(prov or {}),
        },
    }


@router.post("/gigs/{gig_id}/book")
async def book_gig(gig_id: str, payload: BookingIn, user=Depends(verify_token)):
    gig = await db.marketplace_gigs.find_one({"_id": gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    if gig.get("booking_mode") != "in_platform":
        raise HTTPException(status_code=400, detail="This gig only accepts WhatsApp bookings")
    booking = {
        "_id": str(uuid.uuid4()),
        "gig_id": gig_id,
        "provider_user_id": gig["provider_user_id"],
        "client_user_id": user["user_id"],
        "tier_name": payload.tier_name,
        "message": payload.message,
        "contact_email": payload.contact_email,
        "contact_phone": payload.contact_phone,
        "preferred_date": payload.preferred_date,
        "status": "pending",
        "created_at": datetime.now(UTC).isoformat(),
    }
    await db.marketplace_bookings.insert_one(booking)
    logger.info("[marketplace] booking created: gig=%s client=%s tier=%s", gig_id, user["user_id"], payload.tier_name)
    return {"ok": True, "booking_id": booking["_id"]}


@router.get("/providers/{user_id}")
async def public_provider(user_id: str):
    prov = await db.marketplace_providers.find_one({"user_id": user_id})
    if not prov:
        raise HTTPException(status_code=404, detail="Provider not found")
    user = await db.users.find_one({"_id": user_id}) or await db.users.find_one({"id": user_id})
    cursor = db.marketplace_gigs.find({"provider_user_id": user_id, "status": "published"}).sort("created_at", -1)
    raw = [g async for g in cursor]
    ratings = await _batch_rating_aggregate([g["_id"] for g in raw])
    for g in raw:
        agg = ratings.get(g["_id"], {"rating_avg": None, "rating_count": 0})
        g["rating_avg"] = agg["rating_avg"]
        g["rating_count"] = agg["rating_count"]
    gigs = [_clean_gig(g) for g in raw]
    return {
        "user_id": user_id,
        "name": (user or {}).get("name", "Provider"),
        "bio": prov.get("bio", ""),
        "tagline": prov.get("tagline", ""),
        "avatar": prov.get("avatar"),
        "active": _provider_is_active(prov),
        "gigs": gigs,
    }


@router.patch("/providers/me")
async def update_provider(payload: ProviderPatch, user=Depends(verify_token)):
    await _ensure_provider_record(user["user_id"])
    update = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    await db.marketplace_providers.update_one({"user_id": user["user_id"]}, {"$set": update})
    prov = await db.marketplace_providers.find_one({"user_id": user["user_id"]})
    prov["id"] = prov.pop("_id")
    return prov


@router.post("/subscription/upgrade")
async def upgrade_subscription(user=Depends(verify_token)):
    """Start a real PayPal subscription flow. Returns an `approval_url`
    the client must redirect the provider to. PayPal will redirect the
    user back to `{FRONTEND_URL}/payment/success?subscription_id=I-XXX`
    (see `/subscription/activate` for the completion step)."""
    prov = await _ensure_provider_record(user["user_id"])
    plan_id = await _get_or_create_billing_plan()

    # Look up provider email for a smoother PayPal checkout prefill.
    u = await db.users.find_one({"_id": user["user_id"]}) or await db.users.find_one({"id": user["user_id"]})
    email = (u or {}).get("email")

    return_url = f"{FRONTEND_URL}/payment/success?flow=marketplace-subscription"
    cancel_url = f"{FRONTEND_URL}/payment/cancel?flow=marketplace-subscription"
    try:
        sub = await paypal.create_subscription(
            plan_id=plan_id,
            custom_id=user["user_id"],
            return_url=return_url,
            cancel_url=cancel_url,
            subscriber_email=email,
        )
    except Exception as e:  # noqa: BLE001
        logger.exception("PayPal create_subscription error")
        raise HTTPException(status_code=502, detail=f"PayPal error: {e}") from e

    approval_url = next(
        (link["href"] for link in sub.get("links", []) if link.get("rel") == "approve"),
        None,
    )
    if not approval_url:
        raise HTTPException(status_code=502, detail="PayPal did not return an approval URL")

    # Record the pending subscription so the webhook + activate flow can
    # look it up. Status is intentionally 'pending' until PayPal confirms.
    await db.marketplace_providers.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "paypal_subscription_id": sub["id"],
            "paypal_subscription_status": sub.get("status", "APPROVAL_PENDING"),
            "pending_since": datetime.now(UTC).isoformat(),
        }},
    )
    return {
        "ok": True,
        "subscription_id": sub["id"],
        "approval_url": approval_url,
        "amount": SUBSCRIPTION_PRICE,
        "currency": SUBSCRIPTION_CURRENCY,
    }


@router.post("/subscription/activate")
async def activate_subscription(user=Depends(verify_token)):
    """Called by the frontend after PayPal redirects the provider back
    to /payment/success. Re-fetches the subscription from PayPal to
    confirm its status is ACTIVE (or APPROVED — some flows land here
    first). Flips the provider row to `subscription_status='active'`
    and stores the next_billing_time so the UI can show it."""
    prov = await db.marketplace_providers.find_one({"user_id": user["user_id"]})
    if not prov or not prov.get("paypal_subscription_id"):
        raise HTTPException(status_code=400, detail="No pending subscription to activate")

    sub_id = prov["paypal_subscription_id"]
    try:
        sub = await paypal.get_subscription(sub_id)
    except Exception as e:  # noqa: BLE001
        logger.exception("PayPal get_subscription error during activate")
        raise HTTPException(status_code=502, detail=f"PayPal error: {e}") from e

    status = sub.get("status", "").upper()
    if status not in ("ACTIVE", "APPROVED"):
        return {
            "ok": False,
            "status": status,
            "message": f"Subscription is {status}; try again in a moment.",
        }

    next_billing = (sub.get("billing_info") or {}).get("next_billing_time")
    await db.marketplace_providers.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "subscription_status": "active",
            "paypal_subscription_status": status,
            "subscribed_until": next_billing,
            "activated_at": datetime.now(UTC).isoformat(),
        }, "$unset": {"pending_since": ""}},
    )
    return {"ok": True, "status": status, "subscribed_until": next_billing}


@router.post("/subscription/cancel")
async def cancel_subscription_route(user=Depends(verify_token)):
    """Cancel the caller's active PayPal subscription. The provider
    keeps access until the current period ends (paypal_subscription_status
    flips to CANCELLED but subscribed_until stays the same until the
    webhook fires BILLING.SUBSCRIPTION.EXPIRED)."""
    prov = await db.marketplace_providers.find_one({"user_id": user["user_id"]})
    if not prov or not prov.get("paypal_subscription_id"):
        raise HTTPException(status_code=400, detail="No active subscription")
    try:
        await paypal.cancel_subscription(prov["paypal_subscription_id"])
    except Exception as e:  # noqa: BLE001
        # PayPal returns 404 for subscriptions that are still APPROVAL_PENDING
        # (never approved) or already cancelled/expired. In both cases the
        # provider's intent is clear — mark it cancelled locally and move on.
        msg = str(e)
        if "404" not in msg and "RESOURCE_NOT_FOUND" not in msg:
            logger.exception("PayPal cancel_subscription error")
            raise HTTPException(status_code=502, detail=f"PayPal error: {e}") from e
        logger.info("PayPal cancel: subscription already gone (%s); marking cancelled locally", prov["paypal_subscription_id"])

    await db.marketplace_providers.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "paypal_subscription_status": "CANCELLED",
            "cancelled_at": datetime.now(UTC).isoformat(),
        }},
    )
    return {"ok": True, "message": "Subscription cancelled. Access continues until the current period ends."}


# --------------------------- Webhook side-effect helper --------------------- #

async def handle_subscription_webhook_event(event: dict[str, Any]) -> None:
    """Called by the shared PayPal webhook handler in routes/payments.py
    for any BILLING.SUBSCRIPTION.* or PAYMENT.SALE.* event that references
    a subscription in `resource.billing_agreement_id` or `resource.id`.
    Idempotent: safe to call twice on the same event."""
    event_type = event.get("event_type", "")
    resource = event.get("resource") or {}
    # Subscription-scoped events carry resource.id = subscription id.
    # Payment/sale events carry resource.billing_agreement_id = subscription id.
    sub_id = resource.get("id") if event_type.startswith("BILLING.SUBSCRIPTION.") else resource.get("billing_agreement_id")
    if not sub_id:
        return

    prov = await db.marketplace_providers.find_one({"paypal_subscription_id": sub_id})
    if not prov:
        logger.info("[marketplace] webhook %s: no provider matches subscription %s", event_type, sub_id)
        return

    now = datetime.now(UTC).isoformat()
    if event_type in ("BILLING.SUBSCRIPTION.ACTIVATED", "BILLING.SUBSCRIPTION.RE_ACTIVATED"):
        try:
            sub = await paypal.get_subscription(sub_id)
            next_billing = (sub.get("billing_info") or {}).get("next_billing_time")
        except Exception:  # noqa: BLE001
            next_billing = None
        await db.marketplace_providers.update_one(
            {"user_id": prov["user_id"]},
            {"$set": {
                "subscription_status": "active",
                "paypal_subscription_status": "ACTIVE",
                "subscribed_until": next_billing,
                "activated_at": now,
            }, "$unset": {"pending_since": ""}},
        )
    elif event_type == "PAYMENT.SALE.COMPLETED":
        # Auto-renewal succeeded — refresh the subscribed_until.
        try:
            sub = await paypal.get_subscription(sub_id)
            next_billing = (sub.get("billing_info") or {}).get("next_billing_time")
        except Exception:  # noqa: BLE001
            next_billing = None
        await db.marketplace_providers.update_one(
            {"user_id": prov["user_id"]},
            {"$set": {
                "subscription_status": "active",
                "paypal_subscription_status": "ACTIVE",
                "subscribed_until": next_billing,
                "last_renewal_at": now,
            }},
        )
    elif event_type in ("BILLING.SUBSCRIPTION.CANCELLED", "BILLING.SUBSCRIPTION.SUSPENDED"):
        await db.marketplace_providers.update_one(
            {"user_id": prov["user_id"]},
            {"$set": {
                "paypal_subscription_status": event_type.split(".")[-1],
                "cancelled_at": now,
            }},
        )
    elif event_type in ("BILLING.SUBSCRIPTION.EXPIRED", "BILLING.SUBSCRIPTION.PAYMENT.FAILED"):
        await db.marketplace_providers.update_one(
            {"user_id": prov["user_id"]},
            {"$set": {
                "subscription_status": "expired",
                "paypal_subscription_status": "EXPIRED",
                "expired_at": now,
            }},
        )
    else:
        logger.info("[marketplace] webhook %s: no side-effect mapping for %s", event_type, sub_id)


# --------------------------- Reviews --------------------------- #

@router.get("/gigs/{gig_id}/reviews")
async def list_reviews(gig_id: str):
    """Public list of reviews for one gig. Attaches a lightweight
    reviewer snapshot (name) so the UI can render '★ 5.0 — from Sarah'
    without a second round-trip per row."""
    gig = await db.marketplace_gigs.find_one({"_id": gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    cursor = db.marketplace_reviews.find({"gig_id": gig_id}).sort("created_at", -1)
    reviews = []
    async for r in cursor:
        client = await db.users.find_one({"_id": r["client_user_id"]}) \
            or await db.users.find_one({"id": r["client_user_id"]})
        reviews.append({
            "id": r["_id"],
            "gig_id": r["gig_id"],
            "client_user_id": r["client_user_id"],
            "client_name": (client or {}).get("name", "Client"),
            "rating": r["rating"],
            "comment": r.get("comment", ""),
            "created_at": r.get("created_at"),
            "updated_at": r.get("updated_at"),
        })
    agg = await _rating_aggregate(gig_id)
    return {"reviews": reviews, **agg}


@router.post("/gigs/{gig_id}/reviews")
async def upsert_review(gig_id: str, payload: ReviewIn, user=Depends(verify_token)):
    """Create or update the caller's review for a gig. Providers can't
    review their own gigs. One review per user per gig — a second POST
    updates the existing row (upsert semantics)."""
    gig = await db.marketplace_gigs.find_one({"_id": gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    if gig["provider_user_id"] == user["user_id"]:
        raise HTTPException(status_code=400, detail="You cannot review your own gig")
    now = datetime.now(UTC).isoformat()
    existing = await db.marketplace_reviews.find_one({"gig_id": gig_id, "client_user_id": user["user_id"]})
    if existing:
        await db.marketplace_reviews.update_one(
            {"_id": existing["_id"]},
            {"$set": {"rating": payload.rating, "comment": payload.comment, "updated_at": now}},
        )
        review_id = existing["_id"]
    else:
        review_id = str(uuid.uuid4())
        await db.marketplace_reviews.insert_one({
            "_id": review_id,
            "gig_id": gig_id,
            "provider_user_id": gig["provider_user_id"],
            "client_user_id": user["user_id"],
            "rating": payload.rating,
            "comment": payload.comment,
            "created_at": now,
            "updated_at": now,
        })
    return {"ok": True, "review_id": review_id}


@router.delete("/gigs/{gig_id}/reviews/mine")
async def delete_my_review(gig_id: str, user=Depends(verify_token)):
    """Let the caller withdraw their review."""
    res = await db.marketplace_reviews.delete_one(
        {"gig_id": gig_id, "client_user_id": user["user_id"]},
    )
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No review to delete")
    return {"ok": True}
