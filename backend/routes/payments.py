"""PayPal payments router.

Endpoints (all /api-prefixed by the global api_router):
    POST   /payments/orders              — create a PayPal order
    POST   /payments/orders/{id}/capture — capture an approved order
    GET    /payments/orders/{id}         — fetch the order (for the success page)
    GET    /payments/my                  — list the caller's paid orders

Two product types are supported in the same flow:
    1. product_type="document_service"
         metadata = { "services": ["arnona_discount", "property_name_change"], "details": {...} }
         Amount is computed server-side: $150 per single service, $250 for both.
    2. product_type="sublease_booking"
         metadata = { "sublease_id": "...", "booking_amount": 1234.56, "currency": "USD" }
         Amount is computed server-side: 2.5% of booking_amount.

All money math is server-authoritative — the frontend cannot dictate the
capture amount.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException

from routes.deps import db, verify_token
from utils import paypal
from utils.email import send_payment_confirmation_email

logger = logging.getLogger(__name__)
router = APIRouter()

FRONTEND_URL = os.environ.get("FRONTEND_URL", "").rstrip("/")
PAYPAL_ADMIN_EMAIL = os.environ.get("PAYPAL_ADMIN_EMAIL", "admin@rental.com")

# Flat prices for document services (USD)
DOCUMENT_SERVICE_PRICE_SINGLE = 150.0
DOCUMENT_SERVICE_PRICE_BOTH = 250.0
VALID_DOC_SERVICES = {"arnona_discount", "property_name_change"}

# Sublease service fee rate
SUBLEASE_SERVICE_FEE_RATE = 0.025  # 2.5 %


def _compute_amount(product_type: str, metadata: dict[str, Any]) -> tuple[float, str, str]:
    """Return (amount, currency, description) computed server-side."""
    if product_type == "document_service":
        services = metadata.get("services") or []
        services = [s for s in services if s in VALID_DOC_SERVICES]
        services = list(dict.fromkeys(services))  # de-dupe, preserve order
        if not services:
            raise HTTPException(400, "At least one valid service required")
        if len(services) == 1:
            amount = DOCUMENT_SERVICE_PRICE_SINGLE
            pretty = {
                "arnona_discount": "Arnona discount",
                "property_name_change": "Property name change",
            }[services[0]]
            desc = f"Document service — {pretty}"
        else:
            amount = DOCUMENT_SERVICE_PRICE_BOTH
            desc = "Document services — Arnona discount + Property name change"
        return amount, "USD", desc

    if product_type == "sublease_booking":
        try:
            booking_amount = float(metadata.get("booking_amount") or 0.0)
        except (TypeError, ValueError):
            raise HTTPException(400, "Invalid booking_amount") from None
        currency = str(metadata.get("currency") or "USD").upper()
        if currency not in {"USD", "ILS"}:
            raise HTTPException(400, "Unsupported currency")
        if booking_amount <= 0:
            raise HTTPException(400, "booking_amount must be positive")
        fee = round(booking_amount * SUBLEASE_SERVICE_FEE_RATE, 2)
        if fee < 0.01:
            raise HTTPException(400, "Computed service fee below minimum")
        return fee, currency, f"Sublease service fee (2.5%) — order {metadata.get('sublease_id', '')[:8]}"

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

    return {
        "id": order_id,
        "paypal_order_id": pp_order["id"],
        "amount": amount,
        "currency": currency,
        "description": description,
        "status": "created",
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

    elif product_type == "sublease_booking":
        booking_id = metadata.get("booking_id")
        sublease_id = metadata.get("sublease_id")
        if booking_id:
            await db.bookings.update_one(
                {"id": booking_id},
                {"$set": {
                    "service_fee_paid": True,
                    "service_fee_order_id": order["id"],
                    "service_fee_amount": order["amount"],
                    "service_fee_currency": order["currency"],
                }},
            )
        elif sublease_id:
            # Fallback for older flows that only track sublease_id
            await db.subleases.update_one(
                {"id": sublease_id},
                {"$set": {
                    "service_fee_paid": True,
                    "service_fee_order_id": order["id"],
                }},
            )


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
    except Exception as e:  # noqa: BLE001
        logger.exception("PayPal capture failed for order %s", order_id)
        await db.orders.update_one({"id": order_id}, {"$set": {"status": "failed"}})
        raise HTTPException(502, f"PayPal capture failed: {e}") from e

    pp_status = capture.get("status")
    if pp_status != "COMPLETED":
        await db.orders.update_one({"id": order_id}, {"$set": {"status": pp_status.lower() if pp_status else "failed"}})
        raise HTTPException(502, f"Capture did not complete: {pp_status}")

    captured_at = datetime.now(UTC).isoformat()
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "captured",
            "captured_at": captured_at,
            "paypal_capture": capture,
        }},
    )

    # Re-fetch + run side effects
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    await _apply_business_side_effects(order)

    # Send confirmation emails (non-fatal if they fail — the payment already captured)
    user = await db.users.find_one({"id": auth["user_id"]}, {"_id": 0})
    customer_email = (user or {}).get("email")
    customer_name = (user or {}).get("name", "")
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
