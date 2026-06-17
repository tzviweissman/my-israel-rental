"""Twilio WhatsApp client — outbound transactional notifications.

Why this module exists
----------------------
We send two business-initiated WhatsApp notifications from the
platform's verified Twilio number:

  1. A renter messaged you on your listing.
  2. Your tenant signed the rental contract.

Each message includes a deep link back to the website so the recipient
can land on the exact conversation / contract page with one tap.

Modes
-----
The module supports two run-modes, chosen automatically by which env
vars are set, so the same code-path works in dev (Twilio Sandbox) and
in production (approved business templates):

* **Sandbox / free-form body** (dev). Set ``TWILIO_ACCOUNT_SID``,
  ``TWILIO_AUTH_TOKEN`` and ``TWILIO_WHATSAPP_FROM`` only (the latter
  is e.g. ``whatsapp:+14155238886``). The recipient must have opted-in
  to your Sandbox (Twilio Console gives them a "join <word>" message
  to send first). Outside the 24h conversation window Twilio will
  refuse, so this is dev-only.

* **Production templates** (live). Additionally set
  ``TWILIO_CONTENT_SID_RENTER_MESSAGE`` and
  ``TWILIO_CONTENT_SID_CONTRACT_SIGNED`` to the Content Template SIDs
  (``HX…``) of the two pre-approved WhatsApp Business templates.
  When these are present the helpers use ``content_sid`` +
  ``content_variables`` instead of the free-form body, so messages go
  through Meta's approval system and can be business-initiated at any
  time.

The module is **graceful when not configured** — if ``TWILIO_ACCOUNT_SID``
or ``TWILIO_AUTH_TOKEN`` or ``TWILIO_WHATSAPP_FROM`` is missing, the
helpers log once and return ``False``. Chat send + contract signing
flows must NEVER break because WhatsApp creds are missing.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Optional

log = logging.getLogger(__name__)

# Cached Client — created lazily on first send.
_client_singleton = None  # type: ignore[var-annotated]


def _config() -> Optional[dict]:
    """Return creds dict, or None when the integration isn't configured."""
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    sender = os.environ.get("TWILIO_WHATSAPP_FROM")
    if not (sid and token and sender):
        return None
    # Some users paste the bare number; tolerate either form.
    if not sender.startswith("whatsapp:"):
        sender = f"whatsapp:{sender}"
    return {
        "sid": sid,
        "token": token,
        "sender": sender,
        "public_url": (os.environ.get("PLATFORM_PUBLIC_URL") or "").rstrip("/"),
        "tpl_renter_message": os.environ.get("TWILIO_CONTENT_SID_RENTER_MESSAGE"),
        "tpl_contract_signed": os.environ.get("TWILIO_CONTENT_SID_CONTRACT_SIGNED"),
    }


def _client(cfg: dict):
    """Lazy Twilio Client. Importing twilio at module import time would
    slow every other unrelated test, so we defer it to first send."""
    global _client_singleton
    if _client_singleton is None:
        from twilio.rest import Client
        _client_singleton = Client(cfg["sid"], cfg["token"])
    return _client_singleton


def _to_whatsapp_address(raw: str) -> str:
    """Normalize a user-entered number to Twilio's ``whatsapp:+E.164``
    address form. Returns empty string for an empty/invalid input so
    the caller can short-circuit."""
    if not raw:
        return ""
    digits = "".join(ch for ch in raw if ch.isdigit())
    if not digits:
        return ""
    # If the user saved a leading + already, preserve it. Otherwise
    # assume E.164 with no prefix; Twilio still requires the +.
    return f"whatsapp:+{digits}"


def _build_deep_link(cfg: dict, path: str) -> str:
    """Build a full https URL from a relative path. If the caller
    forgot to set ``PLATFORM_PUBLIC_URL`` we still ship the relative
    path — better a click that fails than a message that never goes
    out."""
    path = path.lstrip("/")
    base = cfg.get("public_url") or ""
    return f"{base}/{path}" if base else f"/{path}"


def _send_blocking(
    *, to_address: str, body: Optional[str],
    content_sid: Optional[str], content_variables: Optional[dict], cfg: dict,
) -> bool:
    """Synchronous Twilio call. We wrap this in ``asyncio.to_thread``
    from the async helpers so we don't block the FastAPI event loop."""
    client = _client(cfg)
    try:
        kwargs = {"from_": cfg["sender"], "to": to_address}
        if content_sid:
            kwargs["content_sid"] = content_sid
            if content_variables:
                # Twilio expects a JSON string here.
                kwargs["content_variables"] = json.dumps(content_variables)
        else:
            kwargs["body"] = body or ""
        msg = client.messages.create(**kwargs)
        log.info(
            "WhatsApp sent via Twilio: sid=%s to=%s status=%s",
            msg.sid, to_address.split("+")[-1][:6] + "***", msg.status,
        )
        return True
    except Exception as exc:  # noqa: BLE001
        log.warning("Twilio WhatsApp send failed: %s", exc)
        return False


async def _send(
    *, recipient_phone: str, free_form_body: str,
    content_sid_env_key: str, content_variables: dict,
) -> bool:
    """Shared async dispatch — picks template mode or free-form body
    based on env-var configuration."""
    cfg = _config()
    if not cfg:
        log.info("WhatsApp send skipped: Twilio not configured (missing SID/token/from)")
        return False
    to_address = _to_whatsapp_address(recipient_phone)
    if not to_address:
        log.info("WhatsApp send skipped: no phone number on file")
        return False
    content_sid = cfg.get(content_sid_env_key)
    return await asyncio.to_thread(
        _send_blocking,
        to_address=to_address,
        body=free_form_body if not content_sid else None,
        content_sid=content_sid,
        content_variables=content_variables if content_sid else None,
        cfg=cfg,
    )


# --------------------------------------------------------------------- #
# Public helpers — keep the names stable; chat.py and bookings.py import #
# these directly and we don't want to churn those call sites.            #
# --------------------------------------------------------------------- #

async def send_renter_message_notification(
    *, recipient_phone: str, recipient_name: str, sender_name: str,
    conversation_path: str, language: str = "en",
) -> bool:
    """Notify a lister that a renter messaged them."""
    cfg = _config()
    if not cfg:
        return False
    link = _build_deep_link(cfg, conversation_path)
    name = recipient_name or ("שלום" if language == "he" else "there")
    sender = sender_name or ("שוכר" if language == "he" else "a renter")
    body = (
        f"שלום {name}, קיבלת הודעה חדשה מ-{sender} בנוגע למודעה שלך ב-MyIsraelRental. "
        f"לקריאה ולתגובה: {link}"
        if language == "he"
        else f"Hi {name}, you got a new message from {sender} about your listing "
             f"on MyIsraelRental. Tap to read and reply: {link}"
    )
    return await _send(
        recipient_phone=recipient_phone,
        free_form_body=body,
        content_sid_env_key="tpl_renter_message",
        content_variables={"1": name, "2": sender, "3": link},
    )


async def send_contract_signed_notification(
    *, recipient_phone: str, recipient_name: str, tenant_name: str,
    contract_path: str, language: str = "en",
) -> bool:
    """Notify a lister that a tenant signed the rental contract."""
    cfg = _config()
    if not cfg:
        return False
    link = _build_deep_link(cfg, contract_path)
    name = recipient_name or ("שלום" if language == "he" else "there")
    tenant = tenant_name or ("השוכר שלך" if language == "he" else "your tenant")
    body = (
        f"שלום {name}, {tenant} חתם זה עתה על חוזה השכירות לנכס שלך. "
        f"לצפייה: {link}"
        if language == "he"
        else f"Hi {name}, {tenant} just signed the rental contract for your "
             f"property. View it: {link}"
    )
    return await _send(
        recipient_phone=recipient_phone,
        free_form_body=body,
        content_sid_env_key="tpl_contract_signed",
        content_variables={"1": name, "2": tenant, "3": link},
    )
