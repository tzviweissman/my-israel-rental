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
    """Capture funds for an approved order.

    Returns the parsed JSON body on success (2xx). On any non-2xx response,
    raises :class:`httpx.HTTPStatusError` so the caller can inspect the
    PayPal error details (e.g. ORDER_NOT_APPROVED, ORDER_ALREADY_CAPTURED).
    """
    token = await get_access_token()
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(
            f"{_base_url()}/v2/checkout/orders/{order_id}/capture",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
    if res.status_code >= 300:
        logger.error("PayPal capture_order failed: %s %s", res.status_code, res.text)
        res.raise_for_status()
    try:
        body = res.json()
    except Exception as e:  # noqa: BLE001
        logger.error("PayPal capture_order non-JSON body: %s", res.text)
        raise RuntimeError("PayPal returned an empty body") from e
    if not isinstance(body, dict):
        raise RuntimeError(f"PayPal returned unexpected body type: {type(body).__name__}")
    return body


# --- Webhook signature verification ---------------------------------------
async def verify_webhook_signature(
    *,
    transmission_id: str,
    transmission_time: str,
    cert_url: str,
    auth_algo: str,
    transmission_sig: str,
    webhook_id: str,
    webhook_event: dict[str, Any],
) -> bool:
    """Verify a PayPal webhook signature via the Verify Webhook Signature API.

    Returns True if PayPal confirms the signature. Any failure returns False
    (fail-closed) so a bad/forged webhook is ignored.
    """
    if not all([transmission_id, transmission_time, cert_url, auth_algo, transmission_sig, webhook_id]):
        return False
    token = await get_access_token()
    body = {
        "transmission_id": transmission_id,
        "transmission_time": transmission_time,
        "cert_url": cert_url,
        "auth_algo": auth_algo,
        "transmission_sig": transmission_sig,
        "webhook_id": webhook_id,
        "webhook_event": webhook_event,
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                f"{_base_url()}/v1/notifications/verify-webhook-signature",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
        if res.status_code != 200:
            logger.warning("PayPal verify-webhook-signature HTTP %s: %s", res.status_code, res.text)
            return False
        return res.json().get("verification_status") == "SUCCESS"
    except Exception as e:  # noqa: BLE001
        logger.exception("PayPal verify-webhook-signature call failed: %s", e)
        return False

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


# --- Subscriptions (recurring billing) -------------------------------------
async def create_product(name: str, description: str) -> dict[str, Any]:
    """Create a PayPal catalog product — required before creating a plan."""
    token = await get_access_token()
    body = {
        "name": name,
        "description": description[:256],
        "type": "SERVICE",
        "category": "SOFTWARE",
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.post(
            f"{_base_url()}/v1/catalogs/products",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json=body,
        )
    if res.status_code not in (200, 201):
        logger.error("PayPal create_product failed: %s %s", res.status_code, res.text)
        res.raise_for_status()
    return res.json()


async def create_plan(
    *,
    product_id: str,
    name: str,
    amount: float,
    currency: str,
    interval_unit: str = "MONTH",
    interval_count: int = 1,
) -> dict[str, Any]:
    """Create a monthly billing plan tied to a product. Infinite total_cycles
    (0) so it renews indefinitely until cancelled."""
    token = await get_access_token()
    body = {
        "product_id": product_id,
        "name": name[:127],
        "status": "ACTIVE",
        "billing_cycles": [{
            "frequency": {"interval_unit": interval_unit, "interval_count": interval_count},
            "tenure_type": "REGULAR",
            "sequence": 1,
            "total_cycles": 0,  # 0 = renew forever
            "pricing_scheme": {"fixed_price": {"value": f"{amount:.2f}", "currency_code": currency}},
        }],
        "payment_preferences": {
            "auto_bill_outstanding": True,
            "setup_fee": {"value": "0", "currency_code": currency},
            "setup_fee_failure_action": "CONTINUE",
            "payment_failure_threshold": 3,
        },
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.post(
            f"{_base_url()}/v1/billing/plans",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            json=body,
        )
    if res.status_code not in (200, 201):
        logger.error("PayPal create_plan failed: %s %s", res.status_code, res.text)
        res.raise_for_status()
    return res.json()


async def create_subscription(
    *,
    plan_id: str,
    custom_id: str,
    return_url: str,
    cancel_url: str,
    subscriber_email: str | None = None,
) -> dict[str, Any]:
    """Start a subscription approval flow. Returns the PayPal subscription
    payload with an `id` (I-XXX) and a `links[rel=approve].href` for the
    frontend to redirect the user to."""
    token = await get_access_token()
    body: dict[str, Any] = {
        "plan_id": plan_id,
        "custom_id": custom_id,
        "application_context": {
            "brand_name": "My Israel Rental",
            "user_action": "SUBSCRIBE_NOW",
            "shipping_preference": "NO_SHIPPING",
            "return_url": return_url,
            "cancel_url": cancel_url,
        },
    }
    if subscriber_email:
        body["subscriber"] = {"email_address": subscriber_email}
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(
            f"{_base_url()}/v1/billing/subscriptions",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            json=body,
        )
    if res.status_code not in (200, 201):
        logger.error("PayPal create_subscription failed: %s %s", res.status_code, res.text)
        res.raise_for_status()
    return res.json()


async def get_subscription(subscription_id: str) -> dict[str, Any]:
    """Fetch a subscription's current status + billing_info."""
    token = await get_access_token()
    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.get(
            f"{_base_url()}/v1/billing/subscriptions/{subscription_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
    res.raise_for_status()
    return res.json()


class PayPalCancelError(Exception):
    """A cancel that PayPal refused, carrying enough to decide what to do.

    httpx's own message is just "Client error '422 Unknown Error' for url
    …", which says nothing about WHY. PayPal puts the actual reason in the
    response body as an issue name, and the caller needs it: a 422
    SUBSCRIPTION_STATUS_INVALID (the subscription isn't in a cancellable
    state) means the user's intent is already satisfied, while other 422s
    are genuine failures.
    """

    def __init__(self, status_code: int, body: str, issues: list[str]) -> None:
        detail = ", ".join(issues) if issues else (body[:200] or "no detail")
        super().__init__(f"PayPal cancel failed ({status_code}): {detail}")
        self.status_code = status_code
        self.body = body
        self.issues = issues

    @property
    def already_final(self) -> bool:
        """True when the subscription can't be cancelled because it is
        already cancelled/expired, or was never approved."""
        if self.status_code == 404:
            return True
        return any(
            i in {"SUBSCRIPTION_STATUS_INVALID", "RESOURCE_NOT_FOUND"}
            for i in self.issues
        )


async def cancel_subscription(subscription_id: str, reason: str = "User requested cancel") -> None:
    """Cancel a subscription. PayPal returns 204 No Content on success.

    Raises ``PayPalCancelError`` (not a bare httpx error) so the caller can
    tell "already cancelled / never approved" apart from a real failure.
    """
    token = await get_access_token()
    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.post(
            f"{_base_url()}/v1/billing/subscriptions/{subscription_id}/cancel",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={"reason": reason[:127]},
        )
    if res.status_code not in (204, 200):
        logger.error("PayPal cancel_subscription failed: %s %s", res.status_code, res.text)
        issues: list[str] = []
        try:
            payload = res.json()
            issues = [
                str(d.get("issue")) for d in (payload.get("details") or []) if d.get("issue")
            ]
            if not issues and payload.get("name"):
                issues = [str(payload["name"])]
        except Exception:  # noqa: BLE001 — a non-JSON body is still reportable
            pass
        raise PayPalCancelError(res.status_code, res.text or "", issues)
