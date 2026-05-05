"""PayPal payments router.

Endpoints (all /api-prefixed by the global api_router):
    POST   /payments/orders              — create a PayPal order
    POST   /payments/orders/{id}/capture — capture an approved order
    GET    /payments/orders/{id}         — fetch the order (for the success page)
    GET    /payments/my                  — list the caller's paid orders
    POST   /payments/webhooks/paypal     — PayPal webhook receiver (signed)

Only one product type is supported:
    product_type="document_service"
        metadata = { "services": ["arnona_discount", "property_name_change"], "details": {...} }
        Amount is computed server-side: $150 per single service, $250 for both.

All money math is server-authoritative — the frontend cannot dictate the
capture amount.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Request
import httpx

from routes.deps import db, verify_token
from utils import paypal
from utils.email import send_payment_confirmation_email

logger = logging.getLogger(__name__)
router = APIRouter()

FRONTEND_URL = os.environ.get("FRONTEND_URL", "").rstrip("/")
PAYPAL_ADMIN_EMAIL = os.environ.get("PAYPAL_ADMIN_EMAIL", "admin@rental.com")
PAYPAL_WEBHOOK_ID = os.environ.get("PAYPAL_WEBHOOK_ID", "")

# Bituach Leumi & municipal/utility document services (USD).
# Each service is $150. Customers save $50 for every completed pair, so the
# server-authoritative formula is:  total = n*150 - floor(n/2)*50
# - 1 service  = $150
# - 2 services = $250 (save $50)
# - 3 services = $400 (save $50)
# - 4 services = $500 (save $100)
# - 5 services = $650 (save $100)
DOCUMENT_SERVICE_PRICE_PER = 150.0
DOCUMENT_SERVICE_PAIR_DISCOUNT = 50.0
VALID_DOC_SERVICES = {
    "kitzvat_yeladim",
    "maanak_leidah",
    "birth_expenses",
    "arnona_discount",
    "name_change",
}
SERVICE_PRETTY = {
    "kitzvat_yeladim": "Kitzvat Yeladim (Child Stipend)",
    "maanak_leidah": "Maanak Leidah (Birth Grant)",
    "birth_expenses": "Birth expenses",
    "arnona_discount": "Arnona discount filing",
    "name_change": "Apartment name change",
}

# What we ask the customer to send us on WhatsApp so we can file the form.
SERVICE_REQUIRED_INFO = {
    "kitzvat_yeladim": [
        "Parent's full name and Teudat Zehut (ID)",
        "Each child's full name and date of birth",
        "Bank account details (bank, branch, account number) for the deposit",
        "A clear photo of the parent's Teudat Zehut",
    ],
    "maanak_leidah": [
        "Mother's full name and Teudat Zehut (ID)",
        "Hospital discharge / birth confirmation document",
        "Bank account details (bank, branch, account number)",
    ],
    "birth_expenses": [
        "Claimant's full name and Teudat Zehut (ID)",
        "Proof of the baby's birth (birth certificate or hospital discharge)",
        "Receipts / invoices for the birth-related expenses you're claiming",
        "Bank account details (bank, branch, account number)",
    ],
    "arnona_discount": [
        "Full name and Teudat Zehut (ID) of the lease holder",
        "Full property address (city, street, number, apartment)",
        "A clear photo of your most recent Arnona bill",
        "Eligibility proof (student ID, pensioner card, income statement, etc.)",
        "Bank account details for any refund",
    ],
    "name_change": [
        "Full name and Teudat Zehut of the previous lease holder",
        "Full name and Teudat Zehut of the new lease holder",
        "Full property address",
        "A photo of the signed lease agreement",
        "Account numbers for electricity, water, and Arnona (if known)",
    ],
}


def _build_required_info_html(services: list[str]) -> str:
    """Build an inline-styled HTML block listing what the customer must send
    via WhatsApp for each purchased Bituach Leumi service."""
    sections: list[str] = []
    for svc in services:
        items = SERVICE_REQUIRED_INFO.get(svc) or []
        if not items:
            continue
        bullets = "".join(
            f'<li style="margin:0 0 6px;color:#555;font-size:13px;line-height:1.6;">{item}</li>'
            for item in items
        )
        sections.append(
            f'<div style="margin-bottom:12px;">'
            f'<div style="color:#222;font-size:13px;font-weight:700;margin-bottom:6px;">{SERVICE_PRETTY.get(svc, svc)}</div>'
            f'<ul style="margin:0 0 0 18px;padding:0;">{bullets}</ul>'
            f'</div>'
        )
    return "".join(sections)


def _compute_amount(product_type: str, metadata: dict[str, Any]) -> tuple[float, str, str]:
    """Return (amount, currency, description) computed server-side.

    Document service pricing: $150 per service, with $50 off for every
    completed pair (formula: ``n*150 - (n//2)*50``).
    """
    if product_type == "document_service":
        services = metadata.get("services") or []
        services = [s for s in services if s in VALID_DOC_SERVICES]
        services = list(dict.fromkeys(services))  # de-dupe, preserve order
        if not services:
            raise HTTPException(400, "At least one valid service required")
        n = len(services)
        amount = n * DOCUMENT_SERVICE_PRICE_PER - (n // 2) * DOCUMENT_SERVICE_PAIR_DISCOUNT
        if n == 1:
            desc = f"Document service — {SERVICE_PRETTY[services[0]]}"
        else:
            desc = "Document services — " + " + ".join(SERVICE_PRETTY[s] for s in services)
        return amount, "USD", desc

    raise HTTPException(400, f"Unknown product_type: {product_type}")


@router.post("/payments/orders")
async def create_payment_order(
    payload: dict[str, Any] = Body(...),
    auth: dict = Depends(verify_token),
) -> dict:
    product_type = payload.get("product_type")
    metadata = payload.get("metadata") or {}

    amount, currency, description = _compute_amount(product_type, metadata)

    return_url = f"{FRONTEND_URL}/payment/success"
    cancel_url = f"{FRONTEND_URL}/payment/cancel"

    order_id = str(uuid.uuid4())
    try:
        pp_order = await paypal.create_order(
            amount=amount,
            currency=currency,
            description=description,
            reference_id=order_id,
            return_url=return_url,
            cancel_url=cancel_url,
        )
    except Exception as e:  # noqa: BLE001
        logger.exception("PayPal create_order failed")
        raise HTTPException(502, f"PayPal error: {e}") from e

    doc = {
        "id": order_id,
        "paypal_order_id": pp_order["id"],
        "user_id": auth["user_id"],
        "product_type": product_type,
        "metadata": metadata,
        "amount": amount,
        "currency": currency,
        "description": description,
        "status": "created",  # created -> approved -> captured | cancelled | failed
        "created_at": datetime.now(UTC).isoformat(),
        "captured_at": None,
        "paypal_capture": None,
    }
    await db.orders.insert_one(doc)

    # Extract the approve URL so the frontend can offer a full-page redirect
    # checkout as an alternative to the in-page Smart Buttons popup.
    approve_url = next(
        (link.get("href") for link in (pp_order.get("links") or []) if link.get("rel") == "approve"),
        None,
    )

    return {
        "id": order_id,
        "paypal_order_id": pp_order["id"],
        "amount": amount,
        "currency": currency,
        "description": description,
        "status": "created",
        "approve_url": approve_url,
    }


async def _apply_business_side_effects(order: dict[str, Any]) -> None:
    """After capture, carry out the domain work tied to the order."""
    product_type = order["product_type"]
    metadata = order.get("metadata") or {}

    if product_type == "document_service":
        # Create a document_services row (one per service) in 'pending' state.
        now_iso = datetime.now(UTC).isoformat()
        for svc in (metadata.get("services") or []):
            if svc not in VALID_DOC_SERVICES:
                continue
            service_doc = {
                "id": str(uuid.uuid4()),
                "user_id": order["user_id"],
                "service_type": svc,
                "property_id": metadata.get("property_id"),
                "property_address": metadata.get("property_address"),
                "tenant_name": metadata.get("tenant_name"),
                "details": metadata.get("details") or {},
                "status": "pending",
                "paid": True,
                "order_id": order["id"],
                "paid_amount_usd": order["amount"] if len(metadata.get("services") or []) == 1 else None,
                "created_at": now_iso,
            }
            await db.document_services.insert_one(service_doc)


async def _finalize_captured_order(order_id: str, capture_payload: dict[str, Any]) -> dict[str, Any] | None:
    """Idempotent finalizer invoked both by the user-facing capture endpoint
    and the PayPal webhook.

    - Updates the order status → captured.
    - Runs domain side-effects (insert document_services rows / flag booking).
    - Sends confirmation emails (customer + admin), non-fatal on failure.

    If the order is already ``captured``, returns the existing order unchanged.
    Returns the fresh order document on success, or None if not found.
    """
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        return None
    if order.get("status") == "captured":
        return order

    captured_at = datetime.now(UTC).isoformat()
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "captured",
            "captured_at": captured_at,
            "paypal_capture": capture_payload,
        }},
    )
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    await _apply_business_side_effects(order)

    # Look up the buyer for the confirmation email
    user = await db.users.find_one({"id": order["user_id"]}, {"_id": 0})
    customer_email = (user or {}).get("email")
    customer_name = (user or {}).get("name", "")

    # For Bituach Leumi (document_service) orders, the customer email also
    # needs the "what to send us on WhatsApp" block + the WhatsApp number
    # taken from the global site settings.
    required_info_html = ""
    whatsapp_number = ""
    if order["product_type"] == "document_service":
        services = [
            s for s in (order.get("metadata") or {}).get("services", [])
            if s in VALID_DOC_SERVICES
        ]
        services = list(dict.fromkeys(services))
        required_info_html = _build_required_info_html(services)
        site_settings = await db.site_settings.find_one({"key": "global"}, {"_id": 0}) or {}
        whatsapp_number = site_settings.get("whatsapp_number") or ""

    try:
        if customer_email:
            await send_payment_confirmation_email(
                customer_email,
                customer_name,
                order_id=order["id"],
                paypal_order_id=order["paypal_order_id"],
                description=order["description"],
                amount=order["amount"],
                currency=order["currency"],
                captured_at=captured_at.split("T")[0],
                required_info_html=required_info_html,
                whatsapp_number=whatsapp_number,
            )
        if PAYPAL_ADMIN_EMAIL:
            await send_payment_confirmation_email(
                PAYPAL_ADMIN_EMAIL,
                customer_name or customer_email or "unknown",
                order_id=order["id"],
                paypal_order_id=order["paypal_order_id"],
                description=order["description"],
                amount=order["amount"],
                currency=order["currency"],
                captured_at=captured_at.split("T")[0],
                is_admin_copy=True,
            )
    except Exception as e:  # noqa: BLE001
        logger.warning("Payment confirmation email failed (non-fatal): %s", e)

    return order


@router.post("/payments/orders/{order_id}/capture")
async def capture_payment_order(
    order_id: str,
    auth: dict = Depends(verify_token),
) -> dict:
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if order["user_id"] != auth["user_id"] and auth.get("role") != "admin":
        raise HTTPException(403, "Not your order")

    if order["status"] == "captured":
        return {"status": "captured", "order": order}

    try:
        capture = await paypal.capture_order(order["paypal_order_id"])
    except httpx.HTTPStatusError as http_err:
        # Parse PayPal's structured error body so we can surface the right HTTP
        # status to the frontend.
        try:
            body = http_err.response.json() or {}
        except Exception:  # noqa: BLE001
            body = {}
        details = body.get("details") or []
        issues = [d.get("issue") for d in details if isinstance(d, dict)]

        if "ORDER_ALREADY_CAPTURED" in issues:
            # Reconcile: fetch the PayPal order (which now has the capture info)
            # and run our idempotent finalizer so the DB + emails catch up.
            try:
                pp_order = await paypal.get_order(order["paypal_order_id"])
                finalized = await _finalize_captured_order(order_id, pp_order)
                return {"status": "captured", "order": finalized}
            except Exception:  # noqa: BLE001
                logger.exception("ORDER_ALREADY_CAPTURED reconciliation failed")
                raise HTTPException(502, "PayPal says this order is already captured, but we couldn't reconcile.") from http_err

        if "ORDER_NOT_APPROVED" in issues:
            # User opened the popup but didn't finish the approval. Keep the
            # order in 'created' state so they can retry.
            logger.info("Capture attempted before approval for order %s", order_id)
            raise HTTPException(
                409,
                "You haven't finished approving this payment at PayPal yet. Please click the PayPal button again and complete the approval.",
            ) from http_err

        logger.error("PayPal capture failed (%s): %s", http_err.response.status_code, http_err.response.text)
        await db.orders.update_one({"id": order_id}, {"$set": {"status": "failed"}})
        raise HTTPException(502, f"PayPal capture failed: {issues or http_err.response.status_code}") from http_err
    except Exception as e:  # noqa: BLE001
        logger.exception("PayPal capture failed for order %s", order_id)
        await db.orders.update_one({"id": order_id}, {"$set": {"status": "failed"}})
        raise HTTPException(502, f"PayPal capture failed: {e}") from e

    pp_status = capture.get("status")
    if pp_status != "COMPLETED":
        await db.orders.update_one({"id": order_id}, {"$set": {"status": pp_status.lower() if pp_status else "failed"}})
        raise HTTPException(502, f"Capture did not complete: {pp_status}")

    order = await _finalize_captured_order(order_id, capture)
    return {"status": "captured", "order": order}


@router.get("/payments/orders/{order_id}")
async def get_payment_order(
    order_id: str,
    auth: dict = Depends(verify_token),
) -> dict:
    order = await db.orders.find_one({"id": order_id}, {"_id": 0, "paypal_capture": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if order["user_id"] != auth["user_id"] and auth.get("role") != "admin":
        raise HTTPException(403, "Not your order")
    return order


@router.get("/payments/my")
async def list_my_orders(auth: dict = Depends(verify_token)) -> list[dict]:
    orders = await (
        db.orders.find({"user_id": auth["user_id"]}, {"_id": 0, "paypal_capture": 0})
        .sort("created_at", -1)
        .to_list(200)
    )
    return orders


# --- Webhook receiver ------------------------------------------------------
# Configure this endpoint in the PayPal developer dashboard:
#   Sandbox:  https://developer.paypal.com/dashboard/applications/sandbox
#       → your app → Webhooks → Add Webhook
#       URL:   {FRONTEND_URL}/api/payments/webhooks/paypal
#       Event types:
#           PAYMENT.CAPTURE.COMPLETED
#           PAYMENT.CAPTURE.REFUNDED
#           PAYMENT.CAPTURE.REVERSED
#           PAYMENT.CAPTURE.DENIED
#   After creation, copy the Webhook ID into PAYPAL_WEBHOOK_ID in .env.
#
# The endpoint fail-closes: a bad signature or missing webhook id is treated
# as "ignore" (200 OK with reason) to prevent forged webhooks marking orders
# as paid. Every handler is idempotent.
@router.post("/payments/webhooks/paypal")
async def paypal_webhook(request: Request) -> dict:
    headers = request.headers

    # PayPal signs the raw body; re-parse for forwarding to verify-webhook-signature
    try:
        event = await request.json()
    except Exception:  # noqa: BLE001
        logger.warning("PayPal webhook: malformed JSON body")
        return {"status": "ignored", "reason": "malformed"}

    if not PAYPAL_WEBHOOK_ID:
        # Without a configured webhook id we cannot verify — reject loudly.
        logger.error("PAYPAL_WEBHOOK_ID env var not set; ignoring webhook")
        return {"status": "ignored", "reason": "webhook_id_unset"}

    verified = await paypal.verify_webhook_signature(
        transmission_id=headers.get("paypal-transmission-id", ""),
        transmission_time=headers.get("paypal-transmission-time", ""),
        cert_url=headers.get("paypal-cert-url", ""),
        auth_algo=headers.get("paypal-auth-algo", ""),
        transmission_sig=headers.get("paypal-transmission-sig", ""),
        webhook_id=PAYPAL_WEBHOOK_ID,
        webhook_event=event,
    )
    if not verified:
        logger.warning("PayPal webhook signature verification failed")
        return {"status": "ignored", "reason": "bad_signature"}

    event_type = event.get("event_type", "")
    resource = event.get("resource", {}) or {}
    event_id = event.get("id")

    # Idempotency: record the event id so we don't reprocess on retry
    try:
        await db.paypal_webhook_events.insert_one({
            "id": event_id,
            "event_type": event_type,
            "received_at": datetime.now(UTC).isoformat(),
            "resource_id": resource.get("id"),
        })
    except Exception:  # noqa: BLE001
        # duplicate id (unique index) or any other error → already processed
        logger.info("PayPal webhook event %s already processed; skipping", event_id)
        return {"status": "ignored", "reason": "duplicate"}

    # Most capture/refund events carry supplementary_data.related_ids.order_id
    supp = (resource.get("supplementary_data") or {}).get("related_ids") or {}
    paypal_order_id = supp.get("order_id") or resource.get("id")

    order = None
    if paypal_order_id:
        order = await db.orders.find_one(
            {"paypal_order_id": paypal_order_id}, {"_id": 0}
        )

    if not order:
        logger.info("PayPal webhook %s: no matching order for %s", event_type, paypal_order_id)
        return {"status": "ignored", "reason": "unknown_order"}

    if event_type == "PAYMENT.CAPTURE.COMPLETED":
        finalized = await _finalize_captured_order(order["id"], resource)
        return {"status": "captured", "order_id": finalized.get("id") if finalized else None}

    if event_type in {"PAYMENT.CAPTURE.REFUNDED", "PAYMENT.CAPTURE.REVERSED"}:
        await db.orders.update_one(
            {"id": order["id"]},
            {"$set": {
                "status": "refunded" if event_type.endswith("REFUNDED") else "reversed",
                "refunded_at": datetime.now(UTC).isoformat(),
                "paypal_refund": resource,
            }},
        )
        logger.info("PayPal webhook: order %s marked %s", order["id"], event_type)
        return {"status": "refunded", "order_id": order["id"]}

    if event_type == "PAYMENT.CAPTURE.DENIED":
        await db.orders.update_one(
            {"id": order["id"]},
            {"$set": {"status": "denied", "paypal_denial": resource}},
        )
        return {"status": "denied", "order_id": order["id"]}

    # Unhandled event type — acknowledged so PayPal stops retrying
    logger.info("PayPal webhook: unhandled event_type=%s", event_type)
    return {"status": "ignored", "reason": "unhandled_event"}

