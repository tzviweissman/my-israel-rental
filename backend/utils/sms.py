"""Plain text messages (SMS) through Twilio, until WhatsApp is approved.

Tzvi, 2 Nov 2026: Meta's business check has WhatsApp locked, so new
orders go to the business by text, with a one-tap link to confirm.

Two senders, chosen by the recipient's number:

* Israel (+972): ``TWILIO_SMS_FROM_IL``, a sender name of up to 11
  letters (Twilio's "alphanumeric sender ID"). Israel does not let a
  business send from a foreign number's fixed line, and nobody can reply
  to a name - which is why every text carries a link, never "reply 1".
* Everywhere else: ``TWILIO_SMS_FROM``, the US number (registered with
  the US carriers, or they block it).

Needs ``TWILIO_ACCOUNT_SID`` and ``TWILIO_AUTH_TOKEN`` too. Not configured
= the text is logged and dropped; ``SMS_DRY_RUN=1`` does the same with
the keys set. Never raises: an order is already saved when this runs.
"""
from __future__ import annotations

import logging
import os

from utils.whatsapp_link import normalize_whatsapp_number

log = logging.getLogger(__name__)


def _sender_for(digits: str) -> str:
    if digits.startswith("972"):
        return os.environ.get("TWILIO_SMS_FROM_IL") or os.environ.get("TWILIO_SMS_FROM") or ""
    return os.environ.get("TWILIO_SMS_FROM") or ""


async def send_sms(*, to: str, body: str) -> bool:
    digits = normalize_whatsapp_number(to)
    if not digits or not body:
        return False
    sid = os.environ.get("TWILIO_ACCOUNT_SID") or ""
    token = os.environ.get("TWILIO_AUTH_TOKEN") or ""
    sender = _sender_for(digits)
    if not (sid and token and sender) or os.environ.get("SMS_DRY_RUN") == "1":
        log.info("SMS not sent (not configured or dry run) to=%s***: %s", digits[:6], body)
        return False
    import httpx
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
                data={"To": "+" + digits, "From": sender, "Body": body},
                auth=(sid, token),
            )
        if r.status_code >= 400:
            # Twilio's error body names the problem (unregistered number,
            # country not enabled) and holds no secret.
            log.warning("SMS send failed: %s %s", r.status_code, r.text[:300])
            return False
        log.info("SMS sent to=%s***", digits[:6])
        return True
    except Exception as exc:  # noqa: BLE001
        log.warning("SMS send failed: %s", type(exc).__name__)
        return False
