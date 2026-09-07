"""Twilio SMS — the courier's run-sheet link (docs/orders-and-delivery-spec.md O5).

Why SMS and not WhatsApp: the two Meta-approved WhatsApp templates the
site has are for renters and contracts, and a third one is a Meta
approval with lead time, not a code change. SMS needs no approval, reaches
a phone on a scooter, and costs next to nothing at this volume.

Graceful when not configured: `TWILIO_SMS_FROM` unset means `send_sms`
returns False and nothing else happens. The owner is never stuck — the
assign panel always offers "Send on WhatsApp", which opens the owner's
own WhatsApp with the link prefilled and needs no infrastructure at all.
"""
from __future__ import annotations

import asyncio
import logging
import os

log = logging.getLogger("sms")
_client = None


def configured() -> bool:
    return bool(
        os.environ.get("TWILIO_ACCOUNT_SID")
        and os.environ.get("TWILIO_AUTH_TOKEN")
        and os.environ.get("TWILIO_SMS_FROM")
    )


def _send_blocking(to_digits: str, body: str) -> bool:
    global _client
    try:
        if _client is None:
            from twilio.rest import Client  # deferred: importing twilio is slow
            _client = Client(os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"])
        msg = _client.messages.create(from_=os.environ["TWILIO_SMS_FROM"], to=f"+{to_digits}", body=body)
        log.info("SMS sent: sid=%s to=+%s*** status=%s", msg.sid, to_digits[:6], msg.status)
        return True
    except Exception as exc:  # noqa: BLE001
        log.warning("SMS send failed: %s", exc)
        return False


async def send_sms(to_digits: str | None, body: str) -> bool:
    """`to_digits` is bare E.164 digits (what normalize_whatsapp_number
    returns). False when unconfigured, unaddressed, or refused."""
    if not configured() or not to_digits:
        return False
    return await asyncio.to_thread(_send_blocking, to_digits, body)
