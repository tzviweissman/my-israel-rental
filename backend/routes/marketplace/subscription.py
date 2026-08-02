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
from pydantic import BaseModel

from routes.deps import db, logger, verify_token
from utils.errors import api_error
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


def paypal_mode() -> str:
    """Which PayPal environment this process talks to: "live" or "sandbox"."""
    return os.environ.get("PAYPAL_MODE", "sandbox").lower()


def _env_settings(settings: dict, mode: str) -> dict:
    """Stored product/plan ids for ONE PayPal environment.

    Plan ids are environment-specific: a sandbox plan id means nothing to
    live PayPal and vice versa. They were originally stored flat, so
    switching PAYPAL_MODE to "live" would have found the cached SANDBOX ids
    and handed them to live PayPal — and the admin panel would have reported
    "all tiers ready" while being entirely broken.

    The pre-existing flat layout is read as sandbox, which is what it is:
    every plan created so far was made while PAYPAL_MODE was sandbox. Going
    live therefore starts from an empty set and creates real plans, which is
    exactly what should happen.
    """
    env = ((settings or {}).get("env") or {}).get(mode)
    if env:
        return env
    if mode != "sandbox":
        return {}
    legacy_plans = dict((settings or {}).get("plans") or {})
    # The original single-plan document kept one id at the top level.
    if (settings or {}).get("plan_id") and DEFAULT_PLAN_KEY not in legacy_plans:
        legacy_plans[DEFAULT_PLAN_KEY] = {"plan_id": settings["plan_id"]}
    return {"product_id": (settings or {}).get("product_id"), "plans": legacy_plans}


def _future_trial_end(prov: dict | None) -> str | None:
    """Trial end as an RFC 3339 UTC string, or None if it isn't in the future.

    PayPal's ``start_time`` must be in the future and must carry a timezone.
    Stored trial dates are ISO strings that may or may not have one, and a
    naive value compared against an aware ``now`` raises TypeError — so
    anything unparseable or already past returns None and the subscription
    simply bills immediately, which is the correct behaviour once a trial
    has ended.
    """
    raw = (prov or {}).get("trial_ends_at")
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    if parsed <= datetime.now(UTC):
        return None
    # PayPal wants "…Z", not "+00:00".
    return parsed.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


class PlanSelection(BaseModel):
    """Payload for POST /subscription/select-plan."""
    plan_key: str


@router.post("/subscription/select-plan")
async def select_plan(body: PlanSelection, user=Depends(verify_token)) -> dict:
    """Record which tier a provider intends to pay for, WITHOUT charging.

    The gig wizard makes this a required choice so nobody publishes without
    knowing what they will eventually pay. But the first 30 days are free,
    and taking a payment method at that point would misrepresent that — so
    this touches no PayPal object and moves no money. It only writes the
    intent onto the provider row.

    Deliberately idempotent and re-callable: a provider changing their mind
    during the trial just overwrites the choice, and the actual charge only
    ever happens when they complete the PayPal flow in /upgrade.

    Returns the trial end date so the UI can say exactly when the plan
    starts rather than a vague "after your trial".
    """
    prov = await _ensure_provider_record(user["user_id"])
    plan = plan_for(body.plan_key)

    await db.marketplace_providers.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "selected_plan_key": plan["key"],
            "selected_plan_months": plan["months"],
            "selected_plan_price": plan["monthly_price"],
            "selected_plan_at": datetime.now(UTC).isoformat(),
        }},
    )
    return {
        "ok": True,
        "plan_key": plan["key"],
        "months": plan["months"],
        "monthly_price": plan["monthly_price"],
        "currency": SUBSCRIPTION_CURRENCY,
        # Present already when the row exists; _ensure_provider_record sets
        # it 30 days out on first creation.
        "trial_ends_at": prov.get("trial_ends_at"),
        "subscription_status": prov.get("subscription_status", "trial"),
    }


async def _get_or_create_billing_plan(plan_key: str | None = None) -> str:
    """PayPal plan_id for one commitment tier, creating it on first use.

    Each tier gets its OWN PayPal plan, cached per ENVIRONMENT under
    `env.<sandbox|live>` in the `marketplace_settings` doc. The environment
    split matters: a sandbox plan id is meaningless to live PayPal, so
    sharing one cache across both would break the moment PAYPAL_MODE
    changed. The pre-ladder flat layout is read as sandbox — see
    `_env_settings`.

    Nobody's existing subscription is touched — PayPal subscriptions are
    bound to the plan they were created against, so an existing subscriber
    keeps billing at the price they agreed to.

    Creating a plan is a WRITE to PayPal, in whatever environment
    PAYPAL_MODE points at — sandbox by default, real billing objects when
    it is "live". It happens lazily on the first upgrade at a given tier,
    never on deploy or on a page load. Use the admin bootstrap endpoint at
    the bottom of this module to create them deliberately instead.
    """
    plan = plan_for(plan_key)
    key = plan["key"]

    settings = await db.marketplace_settings.find_one({"_id": "paypal_plan"}) or {}
    mode = paypal_mode()
    env = _env_settings(settings, mode)

    cached = (env.get("plans") or {}).get(key, {}).get("plan_id")
    if cached:
        return cached

    # One PayPal product covers every tier; only the plan differs.
    product_id = env.get("product_id")
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
            f"env.{mode}.product_id": product_id,
            f"env.{mode}.plans.{key}": {
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
        "[marketplace] Created PayPal plan mode=%s key=%s product=%s plan=%s amount=%s",
        mode, key, product_id, plan_id, plan["monthly_price"],
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
    prov = await _ensure_provider_record(user["user_id"])
    plan = plan_for(plan_key)
    plan_id = await _get_or_create_billing_plan(plan["key"])

    # Don't charge before the free trial is over. PayPal bills on approval
    # unless given a start_time, so a provider who subscribed on day 3 of
    # their 30-day trial paid immediately and forfeited the other 27 — while
    # the signup flow told them the first 30 days were free.
    #
    # Only sent when it is genuinely in the future: PayPal rejects a past
    # start_time outright, which would turn an expired trial into a failed
    # upgrade.
    billing_starts_at = _future_trial_end(prov)

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
            start_time=billing_starts_at,
        )
    except Exception as e:  # noqa: BLE001
        raise api_error(
            status_code=502,
            message=(
                "We couldn't start the subscription with PayPal. Nothing has "
                "been charged. Please try again in a moment."
            ),
            exc=e, logger=logger, context="PayPal create_subscription",
        ) from e

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
        # None means "billing starts now" (trial already over). When set, no
        # charge happens until this moment — the UI should say so rather than
        # implying an immediate payment.
        "billing_starts_at": billing_starts_at,
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
        raise api_error(
            status_code=502,
            message=(
                "We couldn't confirm your subscription with PayPal just now. "
                "If you completed the payment it will activate shortly — check "
                "My Gigs in a few minutes before trying again."
            ),
            exc=e, logger=logger, context="PayPal get_subscription during activate",
        ) from e

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
    except paypal.PayPalCancelError as e:
        # PayPal refuses to cancel a subscription that isn't ACTIVE or
        # SUSPENDED: 404 when it's gone, 422 SUBSCRIPTION_STATUS_INVALID when
        # it's already cancelled/expired or was never approved (created by
        # /upgrade but the provider never completed checkout). In every one of
        # those the provider's intent is already satisfied, so record it
        # locally instead of showing them a raw PayPal error for a
        # subscription that was never going to bill them.
        #
        # This previously matched on the httpx message, which reads "Client
        # error '422 Unknown Error'" and carries no reason at all — so 422
        # fell through to the 502 branch and surfaced as a wall of URL.
        if not e.already_final:
            # PayPalCancelError's message is one WE compose and it names the
            # PayPal issue — that's the entire reason the class exists, so
            # this is the rare case where the exception text is safe to show.
            raise api_error(
                status_code=502, message=str(e),
                exc=e, logger=logger, context="PayPal cancel_subscription",
            ) from e
        logger.info(
            "PayPal cancel: %s not cancellable (%s); marking cancelled locally",
            prov["paypal_subscription_id"], ", ".join(e.issues) or e.status_code,
        )
    except Exception as e:  # noqa: BLE001 — network/auth failures are real
        raise api_error(
            status_code=502,
            message=(
                "We couldn't reach PayPal to cancel the subscription. Your "
                "access is unchanged — please try again in a moment."
            ),
            exc=e, logger=logger, context="PayPal cancel_subscription",
        ) from e

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


def _plan_settings_summary(settings: dict, mode: str | None = None) -> list[dict]:
    """Which tiers resolve to a PayPal plan id IN THIS ENVIRONMENT.

    Mode-scoped on purpose: reporting sandbox ids while the backend is
    pointed at live would show "all tiers ready" for plans live PayPal has
    never heard of — the most dangerous possible answer on a billing screen.
    """
    env = _env_settings(settings, mode or paypal_mode())
    stored = env.get("plans") or {}
    rows = []
    for plan in SUBSCRIPTION_PLANS:
        key = plan["key"]
        entry = stored.get(key) or {}
        plan_id = entry.get("plan_id")
        source = "per-tier"
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
    mode = paypal_mode()
    rows = _plan_settings_summary(settings, mode)
    return {
        # Which PayPal environment the backend is pointed at. Worth seeing
        # before creating anything — sandbox plan ids are useless in live and
        # vice versa, and the rows above are scoped to this environment.
        "paypal_mode": mode,
        "product_id": _env_settings(settings, mode).get("product_id"),
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

    mode = paypal_mode()
    before = await db.marketplace_settings.find_one({"_id": "paypal_plan"}) or {}
    summary = _plan_settings_summary(before, mode)
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
        "plans": _plan_settings_summary(after, mode),
    }
