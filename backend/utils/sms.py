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

Delivery reports (Tzvi, 7 Nov 2026): every Cellact text carries a
``webhook_url`` (routes/marketplace/order_texts.py, /sms/status/<key>) and
Cellact posts mt_ok, then mt_del or mt_nok / mt_rej, to it. Replies: a text
to a customer goes from ``CELLACT_REPLY_NUMBER`` when it is set, a virtual
number bought from Cellact whose replies Cellact posts to /sms/in/<key>.
Without it customer texts come from the sender name and cannot be answered.

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


def hook_key() -> str:
    """The secret part of the addresses Cellact posts to. Derived from the API
    key, so there is no second secret to set, and it changes with the key."""
    import hashlib
    import hmac
    key = os.environ.get("CELLACT_API_KEY") or ""
    return hmac.new(key.encode(), b"sms-hook", hashlib.sha256).hexdigest()[:32] if key else ""


def _request_for(digits: str, body: str, reply: bool = False) -> dict | None:
    """The HTTP call that sends this text, or None when no route is set up."""
    key, cellact_from = os.environ.get("CELLACT_API_KEY"), os.environ.get("CELLACT_SENDER")
    if digits.startswith("972") and key and cellact_from:
        site = (os.environ.get("FRONTEND_URL") or "").rstrip("/")
        out = {"to_s": ["+" + digits], "text": body, "sender": (reply and os.environ.get("CELLACT_REPLY_NUMBER")) or cellact_from}
        if site.startswith("https://"):
            out["webhook_url"] = f"{site}/api/marketplace/sms/status/{hook_key()}"
        return {"url": CELLACT_URL, "json": out, "headers": {"Authorization": f"Bearer {key}"}}
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


async def send_sms(*, to: str, body: str, reply: bool = False) -> str | bool:
    """Cellact's id for the text when it was taken (its delivery reports carry
    the same id), True for one sent another way, False when nothing went.
    `reply`: a text to a customer, who may answer it."""
    digits = normalize_whatsapp_number(to)
    if not digits or not body:
        return False
    req = _request_for(digits, body, reply)
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
        sid = r.json().get("id") if "json" in req else None
        log.info("SMS sent to=%s*** id=%s", digits[:6], sid or "")
        return sid or True
    except Exception as exc:  # noqa: BLE001
        log.warning("SMS send failed: %s", type(exc).__name__)
        return False
