"""Plain text messages (SMS), until WhatsApp is approved.

Tzvi, 2 Nov 2026: Meta's business check has WhatsApp locked, so new
orders go to the business by text, with a one-tap link to confirm.

Two routes, chosen by the recipient's number:

* Israel (+972): Cellact's Scribo (Tzvi, 4 Nov 2026: 1 agora a text
  against Twilio's ~1 shekel) when ``CELLACT_API_KEY`` and
  ``CELLACT_SENDER`` are set. ``CELLACT_SENDER`` is a sender name of up
  to 11 letters that Cellact support has approved; an unapproved one is
  dropped by them (errorId 2035). Without Cellact, Twilio's
  ``TWILIO_SMS_FROM_IL`` sender name. Nobody can reply to a name -
  which is why every text carries a link, never "reply 1".
* Everywhere else: Twilio, ``TWILIO_SMS_FROM``, the US number
  (registered with the US carriers, or they block it). Needs
  ``TWILIO_ACCOUNT_SID`` and ``TWILIO_AUTH_TOKEN`` too.

Not configured = the text is logged and dropped; ``SMS_DRY_RUN=1`` does
the same with the keys set. Never raises: an order is already saved when
this runs.
"""
from __future__ import annotations

import logging
import os

from utils.whatsapp_link import normalize_whatsapp_number

log = logging.getLogger(__name__)

CELLACT_URL = "https://la.cellactpro.com/v1/messages"


def _sender_for(digits: str) -> str:
    if digits.startswith("972"):
        return os.environ.get("TWILIO_SMS_FROM_IL") or os.environ.get("TWILIO_SMS_FROM") or ""
    return os.environ.get("TWILIO_SMS_FROM") or ""


def _request_for(digits: str, body: str) -> dict | None:
    """The HTTP call that sends this text, or None when no route is set up."""
    key, cellact_from = os.environ.get("CELLACT_API_KEY"), os.environ.get("CELLACT_SENDER")
    if digits.startswith("972") and key and cellact_from:
        return {
            "url": CELLACT_URL,
            "json": {"to_s": ["+" + digits], "text": body, "sender": cellact_from},
            "headers": {"Authorization": f"Bearer {key}"},
        }
    sid = os.environ.get("TWILIO_ACCOUNT_SID") or ""
    token = os.environ.get("TWILIO_AUTH_TOKEN") or ""
    sender = _sender_for(digits)
    if not (sid and token and sender):
        return None
    return {
        "url": f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
        "data": {"To": "+" + digits, "From": sender, "Body": body},
        "auth": (sid, token),
    }


async def send_sms(*, to: str, body: str) -> bool:
    digits = normalize_whatsapp_number(to)
    if not digits or not body:
        return False
    req = _request_for(digits, body)
    if req is None or os.environ.get("SMS_DRY_RUN") == "1":
        log.info("SMS not sent (not configured or dry run) to=%s***: %s", digits[:6], body)
        return False
    import httpx
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(**req)
        # Cellact answers 200 with {"result": false, ...} when it refuses.
        failed = r.status_code >= 400 or ("json" in req and r.json().get("result") is not True)
        if failed:
            # The error body names the problem (unregistered number, sender
            # not approved, no balance) and holds no secret.
            log.warning("SMS send failed: %s %s", r.status_code, r.text[:300])
            return False
        # Cellact's id is what its support needs to trace one text.
        log.info("SMS sent to=%s*** id=%s", digits[:6], r.json().get("id") if "json" in req else "")
        return True
    except Exception as exc:  # noqa: BLE001
        log.warning("SMS send failed: %s", type(exc).__name__)
        return False
