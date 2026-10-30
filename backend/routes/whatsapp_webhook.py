"""Meta's WhatsApp webhook: the owner taps Confirm or Decline on a new-order
message and the order moves, with no sign-in anywhere.

The buttons carry `order_confirm:<order_id>` / `order_decline:<order_id>`
(utils/whatsapp.py send_new_order_notification). Three things keep this safe:
the body is signed by Meta (X-Hub-Signature-256), only the business's own
WhatsApp number may move its order, and a re-delivered message is a no-op.

Always answers 200 for a validly signed body: Meta retries anything else.
"""
from __future__ import annotations

import hashlib
import hmac
import os
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from pymongo.errors import DuplicateKeyError

from routes.deps import db, logger
from utils.whatsapp_link import normalize_whatsapp_number

router = APIRouter()

# "Confirm" means accepted and being made; the board's own word for that.
CONFIRMED_STATUS = "preparing"
DECLINED_STATUS = "cancelled"
# How the owner's "already ..." answer names each status.
_STATUS_WORDS = {
    "preparing": ("confirmed", "אושרה"), "ready": ("ready", "מוכנה"), "done": ("done", "הושלמה"),
    "cancelled": ("cancelled", "בוטלה"), "failed": ("marked as not delivered", "סומנה כלא נמסרה"),
}


@router.get("/whatsapp/webhook")
async def verify_webhook(
    mode: str = Query("", alias="hub.mode"),
    token: str = Query("", alias="hub.verify_token"),
    challenge: str = Query("", alias="hub.challenge"),
):
    expected = os.environ.get("WHATSAPP_VERIFY_TOKEN") or ""
    if mode == "subscribe" and expected and hmac.compare_digest(token, expected):
        return PlainTextResponse(challenge)
    raise HTTPException(status_code=403, detail="Not allowed")


def _signed(raw: bytes, header: str) -> bool:
    secret = os.environ.get("WHATSAPP_APP_SECRET") or ""
    if not secret:
        return False
    want = "sha256=" + hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(want, header or "")


@router.post("/whatsapp/webhook")
async def receive_webhook(request: Request):
    raw = await request.body()
    if not _signed(raw, request.headers.get("X-Hub-Signature-256", "")):
        raise HTTPException(status_code=403, detail="Bad signature")
    try:
        body = await request.json()
        for entry in body.get("entry") or []:
            for change in entry.get("changes") or []:
                for msg in (change.get("value") or {}).get("messages") or []:
                    try:
                        await _handle_message(msg)
                    except Exception as exc:  # noqa: BLE001
                        logger.warning("WhatsApp webhook message failed: %s", type(exc).__name__)
    except Exception as exc:  # noqa: BLE001
        logger.warning("WhatsApp webhook body unreadable: %s", type(exc).__name__)
    return {"ok": True}


def _payload_of(msg: dict[str, Any]) -> str:
    if msg.get("type") == "button":
        return str((msg.get("button") or {}).get("payload") or "")
    if msg.get("type") == "interactive":
        return str(((msg.get("interactive") or {}).get("button_reply") or {}).get("id") or "")
    return ""


async def _first_time(msg_id: str) -> bool:
    """Meta re-delivers; the message id is the primary key, so a second
    insert is the unique-index refusal."""
    try:
        await db.whatsapp_webhook_events.insert_one({"_id": msg_id})
        return True
    except DuplicateKeyError:
        return False


async def _owner_numbers(order: dict[str, Any]) -> set[str]:
    """Digits of every number that speaks for this order's business: the
    listing's WhatsApp (where the alert went) and the owner's own."""
    from routes.marketplace.gigs import gig_whatsapp_number
    from utils.user_contact import user_whatsapp

    nums: list[Any] = []
    gig = await db.marketplace_gigs.find_one({"_id": order.get("gig_id")}) if order.get("gig_id") else None
    if gig:
        nums.append(await gig_whatsapp_number(gig))
    biz = await db.businesses.find_one({"_id": order.get("business_id")}) or {}
    owner = await db.users.find_one({"id": biz.get("owner_user_id")}) if biz.get("owner_user_id") else None
    nums.append(user_whatsapp(owner))
    return {n for n in (normalize_whatsapp_number(x) for x in nums) if n}


async def _handle_message(msg: dict[str, Any]) -> None:
    action, _, order_id = _payload_of(msg).partition(":")
    if action not in ("order_confirm", "order_decline") or not order_id or not msg.get("id"):
        return
    if not await _first_time(msg["id"]):
        return
    sender = normalize_whatsapp_number(msg.get("from"))
    order = await db.store_orders.find_one({"_id": order_id})
    if not sender or not order:
        return
    if sender not in await _owner_numbers(order):
        logger.warning("WhatsApp button from a number that is not the business's, order %s", order_id)
        return

    from routes.marketplace.orders import StatusIn, _frontend_url, _transition
    from utils.whatsapp import send_order_confirmed_to_customer, send_whatsapp_text

    biz = await db.businesses.find_one({"_id": order.get("business_id")}) or {}
    owner = await db.users.find_one({"id": biz.get("owner_user_id")}, {"preferred_language": 1}) or {}
    he = owner.get("preferred_language") == "he"
    who = order.get("customer_name") or ""

    async def tell_owner(en: str, hebrew: str) -> None:
        await send_whatsapp_text(recipient_phone=sender, body=hebrew if he else en)

    if order.get("status") != "new":
        en, hebrew = _STATUS_WORDS.get(order.get("status"), (order.get("status"), order.get("status")))
        await tell_owner(f"This order is already {en}.", f"ההזמנה כבר {hebrew}.")
        return

    confirm = action == "order_confirm"
    await _transition(order, StatusIn(status=CONFIRMED_STATUS if confirm else DECLINED_STATUS), by="whatsapp")
    if not confirm:
        # _transition emails nobody on a cancel, so say only what happened.
        await tell_owner("Declined.", "ההזמנה נדחתה.")
        return

    phone = order.get("customer_phone_e164") or normalize_whatsapp_number(order.get("customer_phone"))
    if phone:
        await send_order_confirmed_to_customer(
            recipient_phone=phone, business_name=biz.get("name") or "",
            track_url=f"{_frontend_url()}/orders/track/{order.get('track_token')}", language="he",
        )
        await tell_owner(f"Confirmed. {who} was sent their order link.", f"ההזמנה אושרה. {who} קיבל/ה את קישור ההזמנה.")
    else:
        await tell_owner(f"Confirmed. {who} has no phone number, they have the link by email.",
                         f"ההזמנה אושרה. ל{who} אין מספר טלפון, הקישור נשלח במייל.")
