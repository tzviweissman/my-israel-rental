"""Marketplace provider subscription (Pro monthly) + PayPal webhook.

Handles the "upgrade → activate → cancel" lifecycle plus the inbound
PayPal event router. The Pro subscription unlocks unlimited published
gigs; without it, gigs go inactive when the free trial ends.

Extracted from ``marketplace.py`` in the 2026-07 refactor.
"""
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from routes.deps import db, logger, verify_token
from utils import paypal

from .shared import (
    FRONTEND_URL,
    PLAN_DESCRIPTION,
    PLAN_NAME,
    SUBSCRIPTION_CURRENCY,
    SUBSCRIPTION_INTERVAL,
    SUBSCRIPTION_PRICE,
    UTC,
    _ensure_provider_record,
)

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

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

@router.post("/subscription/upgrade")
async def upgrade_subscription(user=Depends(verify_token)):
    """Start a real PayPal subscription flow. Returns an `approval_url`
    the client must redirect the provider to. PayPal will redirect the
    user back to `{FRONTEND_URL}/payment/success?subscription_id=I-XXX`
    (see `/subscription/activate` for the completion step)."""
    # Ensure the provider row exists (creates a fresh trial on first call).
    await _ensure_provider_record(user["user_id"])
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

