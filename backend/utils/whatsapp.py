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

from utils.whatsapp_link import normalize_whatsapp_number

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
        # New order or booking, one template per language (Meta approves
        # wording per language). Variables: 1 = "order"/"booking" word,
        # 2 = customer name, 3 = what they want, 4 = link.
        "tpl_new_order": os.environ.get("TWILIO_CONTENT_SID_NEW_ORDER"),
        "tpl_new_order_he": os.environ.get("TWILIO_CONTENT_SID_NEW_ORDER_HE"),
    }


def _meta_config() -> Optional[dict]:
    """Meta's own WhatsApp Cloud API (Tzvi chose it over Twilio, 22 Oct
    2026). Used for the new-order alert only; set both or neither.
    The token is a permanent System User token from Business Settings."""
    token = os.environ.get("WHATSAPP_ACCESS_TOKEN")
    phone_id = os.environ.get("WHATSAPP_PHONE_NUMBER_ID")
    if not (token and phone_id):
        return None
    return {
        "token": token, "phone_id": phone_id,
        "public_url": (os.environ.get("PLATFORM_PUBLIC_URL") or "").rstrip("/"),
        # The template is approved per language under one name; the
        # Meta language codes are "en" and "he".
        "template": os.environ.get("WHATSAPP_TEMPLATE_NEW_ORDER") or "new_order",
    }


async def _post_meta(cfg: dict, payload: dict) -> bool:
    """POST one message to the Graph API. Never raises."""
    import httpx
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"https://graph.facebook.com/v21.0/{cfg['phone_id']}/messages",
                json=payload, headers={"Authorization": f"Bearer {cfg['token']}"},
            )
        if r.status_code >= 400:
            # The error body names the problem (template not approved,
            # wrong language code, no payment method) and holds no secret.
            log.warning("Meta WhatsApp send failed: %s %s", r.status_code, r.text[:300])
            return False
        log.info("WhatsApp sent via Meta to=%s***", payload["to"][:6])
        return True
    except Exception as exc:  # noqa: BLE001
        log.warning("Meta WhatsApp send failed: %s", type(exc).__name__)
        return False


async def _send_meta_template(
    cfg: dict, raw_phone: str, lang: str, params: list,
    template: Optional[str] = None, buttons: Optional[list] = None,
) -> bool:
    """Send one template message. `buttons` are extra components, e.g. the
    quick-reply buttons of the order-confirm template. Never raises."""
    digits = normalize_whatsapp_number(raw_phone)
    if not digits:
        return False
    components = [{"type": "body", "parameters": [
        # Meta refuses an empty parameter, so a blank becomes "-".
        {"type": "text", "text": str(p) or "-"} for p in params]}]
    components += buttons or []
    return await _post_meta(cfg, {
        "messaging_product": "whatsapp", "to": digits, "type": "template",
        "template": {"name": template or cfg["template"],
                     "language": {"code": lang}, "components": components},
    })


def _quick_reply(index: int, payload: str) -> dict:
    return {"type": "button", "sub_type": "quick_reply", "index": str(index),
            "parameters": [{"type": "payload", "payload": payload}]}


async def send_order_confirmed_to_customer(
    *, recipient_phone: str, business_name: str, track_url: str, language: str = "he",
) -> bool:
    """Tell the customer the business confirmed, with their private order
    link. Template named by WHATSAPP_TEMPLATE_ORDER_CONFIRMED."""
    meta = _meta_config()
    if not meta:
        return False
    return await _send_meta_template(
        meta, recipient_phone, "he" if language == "he" else "en",
        [business_name, track_url],
        template=os.environ.get("WHATSAPP_TEMPLATE_ORDER_CONFIRMED") or "order_confirmed",
    )


async def send_whatsapp_text(*, recipient_phone: str, body: str) -> bool:
    """Free-form text. Only delivered inside Meta's 24-hour window, e.g.
    right after the owner tapped a button. Never raises."""
    meta = _meta_config()
    digits = normalize_whatsapp_number(recipient_phone) if meta else None
    if not digits:
        return False
    return await _post_meta(meta, {
        "messaging_product": "whatsapp", "to": digits,
        "type": "text", "text": {"body": body},
    })


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
    the caller can short-circuit.

    Delegates to ``utils.whatsapp_link`` so this agrees with the wa.me
    deep-links. It previously just stripped non-digits and prepended ``+``,
    which meant a number saved in Israeli national format ("050-123-4567" —
    how essentially every local user types it) became ``+0501234567``: a
    valid-looking address that Twilio can never deliver to. The trunk ``0``
    has to be replaced by the country code, not kept alongside it.
    """
    digits = normalize_whatsapp_number(raw)
    if not digits:
        return ""
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


async def send_new_order_notification(
    *, recipient_phone: str, customer_name: str, summary: str,
    path: str, kind: str = "order", language: str = "he",
    order_id: Optional[str] = None,
) -> bool:
    """Tell a business on WhatsApp that an order or booking came in on the
    site (Tzvi, 22 Oct 2026).

    Why: production had two real orders sitting at "new" for three days.
    The owner was told by email and by the bell on the site, and opened
    neither. These owners live in WhatsApp, so the order goes there too.

    Business-initiated, so in production it needs an approved template
    (TWILIO_CONTENT_SID_NEW_ORDER, and _HE for Hebrew). Until one is set,
    Twilio refuses the free-form body outside a 24-hour window and this
    returns False quietly; the email and the bell still go out.
    With Meta, an order_id and WHATSAPP_TEMPLATE_NEW_ORDER_CONFIRM set, the
    message carries Confirm / Decline quick-reply buttons whose payloads
    (order_confirm:<id>, order_decline:<id>) the webhook reads.
    `summary` is cut short because a template variable over ~1000
    characters is refused, and a long basket reads better on the page.
    """
    meta = _meta_config()
    cfg = meta or _config()
    if not cfg:
        return False
    link = _build_deep_link(cfg, path)
    he = language == "he"
    word = ("הזמנה" if kind == "order" else "בקשת תור") if he else kind
    who = customer_name or ("לקוח" if he else "a customer")
    what = (summary or "").replace("\n", ", ")[:300]
    body = (
        f"{word} חדשה ב-MyIsraelRental מ{who}: {what}\nלצפייה ולמענה: {link}"
        if he else
        f"New {word} on MyIsraelRental from {who}: {what}\nSee it and reply: {link}"
    )
    if meta:
        params = [word, who, what, link]
        confirm_tpl = os.environ.get("WHATSAPP_TEMPLATE_NEW_ORDER_CONFIRM")
        if order_id and confirm_tpl:
            return await _send_meta_template(
                meta, recipient_phone, "he" if he else "en", params, template=confirm_tpl,
                buttons=[_quick_reply(0, f"order_confirm:{order_id}"),
                         _quick_reply(1, f"order_decline:{order_id}")])
        return await _send_meta_template(meta, recipient_phone, "he" if he else "en", params)
    key = "tpl_new_order_he" if he and cfg.get("tpl_new_order_he") else "tpl_new_order"
    return await _send(
        recipient_phone=recipient_phone,
        free_form_body=body,
        content_sid_env_key=key,
        content_variables={"1": word, "2": who, "3": what, "4": link},
    )
