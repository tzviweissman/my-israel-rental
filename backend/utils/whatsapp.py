"""Meta WhatsApp Cloud API client — outbound transactional notifications.

This module sends pre-approved templated WhatsApp messages from the
platform's verified business number. It is **graceful when not
configured**: if any of the required env vars are missing the helpers
log a warning and return ``False`` instead of raising, so unrelated
flows (chat send, contract signing) never break on platforms that
haven't finished Meta Business verification yet.

Required env vars (all four must be present for sends to actually go out):

  WHATSAPP_ACCESS_TOKEN          System User long-lived token from Meta
                                 Business Manager → System Users → Generate Token.
                                 Scopes: whatsapp_business_messaging,
                                         whatsapp_business_management.
  WHATSAPP_PHONE_NUMBER_ID       Phone Number ID from WhatsApp Manager.
  WHATSAPP_API_VERSION           Graph API version, e.g. v20.0. Default: v20.0.
  PLATFORM_PUBLIC_URL            Public base URL used in the deep-link
                                 inside the template (e.g.
                                 https://myisraelrental.com). No trailing
                                 slash.

Templates (must exist + be approved in WhatsApp Manager → Message Templates):

  Name:     renter_message_notification
  Category: UTILITY
  Body:     "Hi {{1}}, you got a new message from {{2}} about your
             listing on MyIsraelRental. Tap below to read and reply."
  Button:   URL — dynamic, params: {{1}} = relative path (e.g.
            /chat/<conversation_id>). Base URL configured in template
            header should be PLATFORM_PUBLIC_URL.
  Languages: en, he

  Name:     contract_signed_notification
  Category: UTILITY
  Body:     "Hi {{1}}, {{2}} just signed the rental contract for your
             property. Tap below to view it."
  Button:   URL — dynamic, params: {{1}} = relative path.
  Languages: en, he
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import httpx

log = logging.getLogger(__name__)

_API_BASE = "https://graph.facebook.com"


def _config() -> Optional[dict]:
    """Return a dict of WhatsApp creds, or None if the integration is
    not configured (missing token or phone id). Callers MUST handle
    None — they should log and skip the send."""
    token = os.environ.get("WHATSAPP_ACCESS_TOKEN")
    phone_id = os.environ.get("WHATSAPP_PHONE_NUMBER_ID")
    if not token or not phone_id:
        return None
    return {
        "token": token,
        "phone_id": phone_id,
        "version": os.environ.get("WHATSAPP_API_VERSION", "v20.0"),
        "public_url": (os.environ.get("PLATFORM_PUBLIC_URL") or "").rstrip("/"),
    }


def _normalize_number(raw: str) -> str:
    """Meta requires E.164 without the leading ``+``. Strip everything
    that isn't a digit. Empty string returned for empty/None input."""
    if not raw:
        return ""
    return "".join(ch for ch in raw if ch.isdigit())


async def _send_template(
    *, to: str, template_name: str, language: str,
    body_params: list[str], button_url_param: Optional[str] = None,
) -> bool:
    """Low-level Graph API call. Returns True on 200, False on any
    failure (logged). Never raises."""
    cfg = _config()
    if not cfg:
        log.info("WhatsApp send skipped: integration not configured (no token/phone id)")
        return False
    to_norm = _normalize_number(to)
    if not to_norm:
        log.info("WhatsApp send skipped: recipient has no phone number on file")
        return False

    components: list[dict] = [{
        "type": "body",
        "parameters": [{"type": "text", "text": p} for p in body_params],
    }]
    if button_url_param is not None:
        components.append({
            "type": "button",
            "sub_type": "url",
            "index": "0",
            "parameters": [{"type": "text", "text": button_url_param}],
        })

    payload = {
        "messaging_product": "whatsapp",
        "to": to_norm,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": "he" if language == "he" else "en"},
            "components": components,
        },
    }

    url = f"{_API_BASE}/{cfg['version']}/{cfg['phone_id']}/messages"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                url,
                json=payload,
                headers={"Authorization": f"Bearer {cfg['token']}"},
            )
        if r.status_code >= 400:
            log.warning(
                "WhatsApp send failed: status=%s template=%s body=%s",
                r.status_code, template_name, r.text[:300],
            )
            return False
        log.info("WhatsApp sent: template=%s to=%s", template_name, to_norm[:6] + "***")
        return True
    except httpx.RequestError as exc:
        log.warning("WhatsApp send error: %s", exc)
        return False


async def send_renter_message_notification(
    *, recipient_phone: str, recipient_name: str, sender_name: str,
    conversation_path: str, language: str = "en",
) -> bool:
    """Notify a lister that a renter messaged them. The deep link
    points to the in-app chat. ``conversation_path`` should be a
    relative URL like ``/chat/<conversation_id>`` (the template appends
    it to the configured base URL)."""
    return await _send_template(
        to=recipient_phone,
        template_name="renter_message_notification",
        language=language,
        body_params=[recipient_name or "there", sender_name or "a renter"],
        button_url_param=conversation_path.lstrip("/"),
    )


async def send_contract_signed_notification(
    *, recipient_phone: str, recipient_name: str, tenant_name: str,
    contract_path: str, language: str = "en",
) -> bool:
    """Notify a lister that a tenant signed the rental contract. The
    deep link points to the contract view page."""
    return await _send_template(
        to=recipient_phone,
        template_name="contract_signed_notification",
        language=language,
        body_params=[recipient_name or "there", tenant_name or "your tenant"],
        button_url_param=contract_path.lstrip("/"),
    )
