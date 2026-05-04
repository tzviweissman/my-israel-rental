"""PayPal REST v2 client — Sandbox-first, zero external SDK.

We avoid the deprecated `paypalcheckoutsdk` and talk to PayPal's REST v2 API
directly via httpx. This keeps the dependency surface small and stays on the
officially-supported endpoints.

Only four operations are exposed:
    - get_access_token()     -> cached OAuth2 bearer token
    - create_order(...)      -> POST /v2/checkout/orders
    - capture_order(id)      -> POST /v2/checkout/orders/{id}/capture
    - get_order(id)          -> GET  /v2/checkout/orders/{id}
"""
from __future__ import annotations

import logging
import os
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_SANDBOX_BASE = "https://api-m.sandbox.paypal.com"
_LIVE_BASE = "https://api-m.paypal.com"


def _base_url() -> str:
    mode = os.environ.get("PAYPAL_MODE", "sandbox").lower()
    return _LIVE_BASE if mode == "live" else _SANDBOX_BASE


def _credentials() -> tuple[str, str]:
    client_id = os.environ.get("PAYPAL_CLIENT_ID", "")
    client_secret = os.environ.get("PAYPAL_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        raise RuntimeError("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET env vars not set")
    return client_id, client_secret


# --- OAuth2 token cache -----------------------------------------------------
_token_cache: dict[str, Any] = {"value": None, "expires_at": 0.0}


async def get_access_token() -> str:
    """Fetch and cache the OAuth2 token. Refreshes 60s before expiry."""
    now = time.time()
    if _token_cache["value"] and _token_cache["expires_at"] > now + 60:
        return _token_cache["value"]

    client_id, client_secret = _credentials()
    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.post(
            f"{_base_url()}/v1/oauth2/token",
            auth=(client_id, client_secret),
            data={"grant_type": "client_credentials"},
            headers={"Accept": "application/json", "Accept-Language": "en_US"},
        )
    res.raise_for_status()
    payload = res.json()
    _token_cache["value"] = payload["access_token"]
    _token_cache["expires_at"] = now + float(payload.get("expires_in", 3600))
    return payload["access_token"]


# --- Orders -----------------------------------------------------------------
async def create_order(
    *,
    amount: float,
    currency: str,
    description: str,
    reference_id: str,
    return_url: str,
    cancel_url: str,
) -> dict[str, Any]:
    """Create a PayPal order in CAPTURE intent. Returns the full PayPal order
    payload which includes the `id` that the frontend's PayPal buttons need."""
    token = await get_access_token()
    body = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "reference_id": reference_id,
                "description": description[:127],  # PayPal caps at 127
                "amount": {"currency_code": currency, "value": f"{amount:.2f}"},
            }
        ],
        "application_context": {
            "return_url": return_url,
            "cancel_url": cancel_url,
            "user_action": "PAY_NOW",
            "shipping_preference": "NO_SHIPPING",
            "brand_name": "My Israel Rental",
        },
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(
            f"{_base_url()}/v2/checkout/orders",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json=body,
        )
    if res.status_code not in (200, 201):
        logger.error("PayPal create_order failed: %s %s", res.status_code, res.text)
        res.raise_for_status()
    return res.json()


async def capture_order(order_id: str) -> dict[str, Any]:
    """Capture funds for an approved order."""
    token = await get_access_token()
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(
            f"{_base_url()}/v2/checkout/orders/{order_id}/capture",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
    if res.status_code not in (200, 201):
        logger.error("PayPal capture_order failed: %s %s", res.status_code, res.text)
        res.raise_for_status()
    return res.json()


async def get_order(order_id: str) -> dict[str, Any]:
    token = await get_access_token()
    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.get(
            f"{_base_url()}/v2/checkout/orders/{order_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
    res.raise_for_status()
    return res.json()
