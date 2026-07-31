"""Marketplace provider subscription (Pro monthly) + PayPal webhook.

Handles the "upgrade → activate → cancel" lifecycle plus the inbound
PayPal event router. The Pro subscription unlocks unlimited published
gigs; without it, gigs go inactive when the free trial ends.

Extracted from ``marketplace.py`` in the 2026-07 refactor.
"""
import os
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from routes.deps import db, logger, verify_token
from utils import paypal
from utils.helpers import get_usd_ils_rate

from .shared import (
    DEFAULT_PLAN_KEY,
    FRONTEND_URL,
    PLAN_DESCRIPTION,
    PLAN_NAME,
    SUBSCRIPTION_CURRENCY,
    SUBSCRIPTION_INTERVAL,
    SUBSCRIPTION_PLANS,
    SUBSCRIPTION_PRICE,
    UTC,
    _ensure_provider_record,
    plan_for,
)

router = APIRouter(prefix="/marketplace", tags=["marketplace"])


@router.get("/subscription/plans")
async def list_subscription_plans() -> dict:
    """The commitment ladder, plus the live USD→ILS rate.

    One endpoint rather than letting the frontend hardcode the ladder: the
    prices then live in exactly one place, and the shekel figure beside each
    is computed from the same live rate the rentals side uses instead of a
    constant that quietly goes stale.

    Read-only and safe — it touches no PayPal object. Plans are created on
    PayPal lazily, on the first real upgrade (see
    ``_get_or_create_billing_plan``).
    """
    rate = await get_usd_ils_rate()
    return {
        "currency": SUBSCRIPTION_CURRENCY,
        "interval": SUBSCRIPTION_INTERVAL,
        "default_plan_key": DEFAULT_PLAN_KEY,
        # Advisory only. The subscription is billed in USD; this figure moves
        # with the market and must always be presented as approximate.
        "usd_to_ils": rate,
        "plans": [
            {
                "key": p["key"],
                "months": p["months"],
                "monthly_price": p["monthly_price"],
                "total_price": round(p["monthly_price"] * p["months"], 2),
                "headline": p["headline"],
                "approx_monthly_ils": round(p["monthly_price"] * rate),
            }
            for p in SUBSCRIPTION_PLANS
        ],
    }


async def _get_or_create_billing_plan(plan_key: str | None = None) -> str:
    """PayPal plan_id for one commitment tier, creating it on first use.

    Each tier gets its OWN PayPal plan, cached under its own key in the
    `marketplace_settings` doc. Deliberately additive: the pre-ladder
    single-plan document stored its id at the top level as `plan_id`, and
    that stays exactly where it is and keeps resolving for the default
    tier. Nobody's existing subscription is touched — PayPal subscriptions
    are bound to the plan they were created against, so an existing
    subscriber keeps billing at the price they agreed to.

    Creating a plan is a WRITE to PayPal, in whatever environment
    PAYPAL_MODE points at — sandbox by default, real billing objects when
    it is "live". It happens lazily on the first upgrade at a given tier,
    never on deploy or on a page load. Use the admin bootstrap endpoint at
    the bottom of this module to create them deliberately instead.
    """
    plan = plan_for(plan_key)
    key = plan["key"]

    settings = await db.marketplace_settings.find_one({"_id": "paypal_plan"}) or {}

    # Legacy layout: one plan, id at the top level. Reuse it for the default
    # tier rather than creating a duplicate at the same price.
    if key == DEFAULT_PLAN_KEY and settings.get("plan_id"):
        return settings["plan_id"]
    cached = (settings.get("plans") or {}).get(key, {}).get("plan_id")
    if cached:
        return cached

    # One PayPal product covers every tier; only the plan differs.
    product_id = settings.get("product_id")
    if not product_id:
        product = await paypal.create_product(name=PLAN_NAME, description=PLAN_DESCRIPTION)
        product_id = product["id"]

    # Billed monthly at the tier's rate. The commitment length is what earns
    # the lower rate; it is not a single up-front charge.
    created = await paypal.create_plan(
        product_id=product_id,
        name=f"{PLAN_NAME} — {plan['months']}-month commitment",
        amount=plan["monthly_price"],
        currency=SUBSCRIPTION_CURRENCY,
        interval_unit=SUBSCRIPTION_INTERVAL,
        interval_count=1,
    )
    plan_id = created["id"]
    await db.marketplace_settings.update_one(
        {"_id": "paypal_plan"},
        {"$set": {
            "product_id": product_id,
            f"plans.{key}": {
                "plan_id": plan_id,
                "amount": plan["monthly_price"],
                "months": plan["months"],
                "currency": SUBSCRIPTION_CURRENCY,
                "created_at": datetime.now(UTC).isoformat(),
            },
        }},
        upsert=True,
    )
    logger.info(
        "[marketplace] Created PayPal plan key=%s product=%s plan=%s amount=%s",
        key, product_id, plan_id, plan["monthly_price"],
    )
    return plan_id

@router.post("/subscription/upgrade")
async def upgrade_subscription(
    user=Depends(verify_token),
    plan_key: str | None = Query(None, description="Commitment tier: 12mo | 6mo | 3mo"),
):
    """Start a real PayPal subscription flow. Returns an `approval_url`
    the client must redirect the provider to. PayPal will redirect the
    user back to `{FRONTEND_URL}/payment/success?subscription_id=I-XXX`
    (see `/subscription/activate` for the completion step).

    `plan_key` is optional so a client that predates the commitment ladder
    still works — it lands on the default tier.
    """
    # Ensure the provider row exists (creates a fresh trial on first call).
    await _ensure_provider_record(user["user_id"])
    plan = plan_for(plan_key)
    plan_id = await _get_or_create_billing_plan(plan["key"])

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
            # Which tier they committed to. Stored so support and the
            # dashboard can answer "what am I paying?" without a PayPal
            # round-trip, and so a later plan-price change can't rewrite
            # history for someone already subscribed.
            "plan_key": plan["key"],
            "plan_months": plan["months"],
            "plan_monthly_price": plan["monthly_price"],
        }},
    )
    return {
        "ok": True,
        "subscription_id": sub["id"],
        "approval_url": approval_url,
        # The tier's rate, not the default — a provider picking 3mo was
        # being told $25 while PayPal charged $35.
        "amount": plan["monthly_price"],
        "plan_key": plan["key"],
        "months": plan["months"],
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


# --------------------- Admin: PayPal plan bootstrap --------------------- #
# Plans are normally created lazily, on the first upgrade at a given tier.
# That is fine for correctness but means the FIRST REAL PROVIDER's checkout
# is also the first time the plan-creation path ever runs — so a
# misconfiguration surfaces during someone's actual payment attempt.
#
# These two endpoints make it a deliberate, inspectable step instead: check
# what exists, then create what's missing, before anyone tries to subscribe.


def _plan_settings_summary(settings: dict) -> list[dict]:
    """Which tiers currently resolve to a PayPal plan id. No PayPal calls."""
    stored = (settings or {}).get("plans") or {}
    legacy_id = (settings or {}).get("plan_id")
    rows = []
    for plan in SUBSCRIPTION_PLANS:
        key = plan["key"]
        entry = stored.get(key) or {}
        plan_id = entry.get("plan_id")
        source = "per-tier"
        # The pre-ladder document held a single id at the top level; it still
        # serves the default tier so we don't create a duplicate at the same
        # price. Surface that explicitly rather than showing it as missing.
        if not plan_id and key == DEFAULT_PLAN_KEY and legacy_id:
            plan_id, source = legacy_id, "legacy single-plan document"
        rows.append({
            "key": key,
            "months": plan["months"],
            "monthly_price": plan["monthly_price"],
            "plan_id": plan_id,
            "exists": bool(plan_id),
            "source": source if plan_id else None,
        })
    return rows


@router.get("/subscription/plans/status")
async def admin_plan_status(payload: dict = Depends(verify_token)) -> dict:
    """Read-only: which tiers already have a PayPal plan.

    Touches nothing. Safe to call at any time, in any mode.
    """
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    settings = await db.marketplace_settings.find_one({"_id": "paypal_plan"}) or {}
    rows = _plan_settings_summary(settings)
    return {
        # Which PayPal environment the backend is pointed at. Worth seeing
        # before creating anything — sandbox plan ids are useless in live and
        # vice versa.
        "paypal_mode": os.environ.get("PAYPAL_MODE", "sandbox").lower(),
        "product_id": settings.get("product_id"),
        "plans": rows,
        "missing": [r["key"] for r in rows if not r["exists"]],
    }


@router.post("/subscription/plans/bootstrap")
async def admin_bootstrap_plans(payload: dict = Depends(verify_token)) -> dict:
    """Create any missing PayPal plans, deliberately.

    Idempotent: a tier that already resolves to a plan id is skipped, never
    recreated. Duplicate plans at the same price are the main hazard here —
    they're hard to tell apart afterwards and subscriptions bind to whichever
    one was used.

    Creating a plan is a WRITE to PayPal in whatever mode the backend is
    configured for. In sandbox this is free and reversible. In live it
    creates real billing objects against the merchant account.
    """
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    mode = os.environ.get("PAYPAL_MODE", "sandbox").lower()
    before = await db.marketplace_settings.find_one({"_id": "paypal_plan"}) or {}
    summary = _plan_settings_summary(before)
    missing = [r["key"] for r in summary if not r["exists"]]

    created, failed = [], []
    for key in missing:
        try:
            plan_id = await _get_or_create_billing_plan(key)
            created.append({"key": key, "plan_id": plan_id})
        except Exception as e:  # noqa: BLE001
            # Keep going: one bad tier shouldn't block the others, and the
            # response needs to say exactly which failed and why.
            logger.exception("[marketplace] plan bootstrap failed for %s", key)
            failed.append({"key": key, "error": str(e)})

    after = await db.marketplace_settings.find_one({"_id": "paypal_plan"}) or {}
    return {
        "paypal_mode": mode,
        "already_existed": [r["key"] for r in summary if r["exists"]],
        "created": created,
        "failed": failed,
        "plans": _plan_settings_summary(after),
    }
