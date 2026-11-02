"""New orders by text message, with a one-tap Confirm / Decline page.

Tzvi, 2 Nov 2026: owners should not have to sign in for each order. The
business gets a text with the order and a link; the link opens one page
for that one order (/orders/owner/<token>) with Confirm and Decline. On
Confirm the customer and the business each get a text with the order
number and their link. Until Meta approves WhatsApp this is the only
message that reaches a phone; once WhatsApp works, the text goes out
only when the WhatsApp message did not (orders.alert_business_on_whatsapp).

The owner token is the whole credential, like the customer's track token
and the staff board's link: it opens one order, and it can only move
that order out of "new". The status write itself is _transition's
compare-and-set, so a double tap or a tap racing the dashboard cannot
confirm twice.
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Request
from pymongo import ReturnDocument

from routes.deps import db, logger
from utils.rate_limit import check_rate
from utils.sms import send_sms

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

CONFIRMED_STATUS = "preparing"
DECLINED_STATUS = "cancelled"


async def next_order_no(business_id: str) -> int:
    """1001, 1002, ... per business. Atomic: two orders at the same moment
    never share a number."""
    c = await db.counters.find_one_and_update(
        {"_id": f"order_no:{business_id}"}, {"$inc": {"n": 1}},
        upsert=True, return_document=ReturnDocument.AFTER,
    )
    return 1000 + c["n"]


def order_no(o: dict[str, Any]) -> str:
    # Orders from before 2 Nov 2026 have no number; the id's tail is stable.
    return f"#{o['order_no']}" if o.get("order_no") else "#" + str(o.get("_id", ""))[-6:].upper()


def _money(o: dict[str, Any], he: bool) -> str:
    if o.get("total") is None:
        return ""
    # An English text stays in the plain SMS alphabet: one ₪, × or · makes
    # every part of it count 70 letters instead of 160, so it costs double.
    sym = {"ILS": "₪" if he else "ILS ", "USD": "$", "EUR": "€", "GBP": "£"}.get(o.get("currency") or "ILS", "")
    return f"{sym}{o['total']:g}"


def _when(o: dict[str, Any]) -> str:
    nb = o.get("needed_by") or ""
    return f"{nb[8:10]}/{nb[5:7]} {nb[11:16]}".strip() if len(nb) >= 10 else ""


def owner_text(o: dict[str, Any], link: str, he: bool) -> str:
    """Everything the owner needs to decide without opening anything."""
    phone = o.get("customer_phone") or ""
    if he:
        how = "משלוח ל" + (o.get("address") or "") if o.get("fulfilment") == "delivery" else (f"שולחן {o['table']}" if o.get("table") else "איסוף")
        parts = [f"הזמנה חדשה {order_no(o)} מ{o.get('customer_name') or ''}" + (f", {phone}" if phone else ""),
                 (o.get("items") or "").replace("\n", ", "), " · ".join(x for x in (how, _when(o), _money(o, True)) if x),
                 f"אישור או דחייה: {link}"]
    else:
        how = "Delivery to " + (o.get("address") or "") if o.get("fulfilment") == "delivery" else (f"Table {o['table']}" if o.get("table") else "Pickup")
        parts = [f"New order {order_no(o)} from {o.get('customer_name') or ''}" + (f", {phone}" if phone else ""),
                 (o.get("items") or "").replace("\n", ", ").replace("×", "x"), ", ".join(x for x in (how, _when(o), _money(o, False)) if x),
                 f"Confirm or decline: {link}"]
    return "\n".join(p for p in parts if p)


def _frontend() -> str:
    from .orders import _frontend_url
    return _frontend_url()


def owner_link(o: dict[str, Any]) -> str:
    return f"{_frontend()}/orders/owner/{o['owner_token']}"


def track_link(o: dict[str, Any]) -> str:
    return f"{_frontend()}/orders/track/{o['track_token']}"


async def _owner_he(o: dict[str, Any]) -> bool:
    owner = await db.users.find_one({"id": o.get("owner_user_id")}, {"preferred_language": 1}) or {}
    return owner.get("preferred_language") == "he"


async def text_owner_new_order(order_id: str, number: str) -> bool:
    """The new-order text. Never raises."""
    try:
        o = await db.store_orders.find_one({"_id": order_id})
        if not o or not o.get("owner_token"):
            return False
        return await send_sms(to=number, body=owner_text(o, owner_link(o), await _owner_he(o)))
    except Exception as exc:  # noqa: BLE001
        logger.warning("order text to the business failed: %s", type(exc).__name__)
        return False


async def _order_by_owner_token(token: str) -> dict[str, Any]:
    if not token or len(token) < 16:
        raise HTTPException(status_code=404, detail="This link is not valid")
    o = await db.store_orders.find_one({"owner_token": token})
    if not o:
        raise HTTPException(status_code=404, detail="This link is not valid")
    return o


def _view(o: dict[str, Any], biz: dict[str, Any]) -> dict[str, Any]:
    return {
        "order_no": order_no(o),
        "status": o.get("status"),
        "business": {"name": biz.get("name") or "", "name_he": biz.get("name_he"), "logo_url": biz.get("logo_url")},
        "customer_name": o.get("customer_name"),
        "customer_phone": o.get("customer_phone"),
        "customer_email": o.get("customer_email"),
        "items": o.get("items"), "lines": o.get("lines"),
        "total": o.get("total"), "currency": o.get("currency"), "delivery_fee": o.get("delivery_fee"),
        "needed_by": o.get("needed_by"), "fulfilment": o.get("fulfilment"),
        "table": o.get("table"), "address": o.get("address"), "notes": o.get("notes"),
        "created_at": o.get("created_at"),
    }


@router.get("/orders/owner/{token}")
async def owner_order(token: str, request: Request):
    check_rate(request, bucket="orders_owner", limit=300, window_seconds=600)
    o = await _order_by_owner_token(token)
    biz = await db.businesses.find_one({"_id": o["business_id"]}) or {}
    return _view(o, biz)


async def _decide(token: str, request: Request, confirm: bool) -> dict[str, Any]:
    check_rate(request, bucket="orders_owner_move", limit=60, window_seconds=600)
    o = await _order_by_owner_token(token)
    biz = await db.businesses.find_one({"_id": o["business_id"]}) or {}
    if o.get("status") != "new":
        # Already decided (here, on the dashboard or on WhatsApp): say what
        # it is rather than an error, and send nothing again.
        return {**_view(o, biz), "already": True}
    from .orders import StatusIn, _transition
    try:
        await _transition(o, StatusIn(status=CONFIRMED_STATUS if confirm else DECLINED_STATUS), by="text")
    except HTTPException as exc:
        if exc.status_code != 409:
            raise
        fresh = await db.store_orders.find_one({"_id": o["_id"]}) or o
        return {**_view(fresh, biz), "already": True}
    fresh = await db.store_orders.find_one({"_id": o["_id"]}) or o
    await _texts_after(fresh, biz, confirm)
    return {**_view(fresh, biz), "already": False}


async def _texts_after(o: dict[str, Any], biz: dict[str, Any], confirm: bool) -> None:
    """The customer and the business each get one text. Never raises: the
    order has already moved."""
    try:
        name = biz.get("name_he") if o.get("lang") == "he" and biz.get("name_he") else biz.get("name") or ""
        no = order_no(o)
        customer = o.get("customer_phone_e164") or o.get("customer_phone")
        if customer:
            if o.get("lang") == "he":
                body = (f"ההזמנה שלך {no} מ{name} אושרה. מעקב ופרטי ההזמנה: {track_link(o)}" if confirm
                        else f"מצטערים, {name} לא יכולים לקבל את ההזמנה שלך {no} הפעם.")
            else:
                body = (f"Your order {no} from {name} is confirmed. Track it and see the details: {track_link(o)}" if confirm
                        else f"Sorry, {name} can't take your order {no} this time.")
            await send_sms(to=customer, body=body)
        if confirm:
            # The phone that tapped is the business's: the alert went to it.
            number = await _business_number(o)
            if number:
                he = await _owner_he(o)
                body = (f"אישרת את הזמנה {no} ({o.get('customer_name') or ''}). פרטי ההזמנה: {owner_link(o)}" if he
                        else f"Confirmed order {no} ({o.get('customer_name') or ''}). Order details: {owner_link(o)}")
                await send_sms(to=number, body=body)
    except Exception as exc:  # noqa: BLE001
        logger.warning("order texts after %s failed: %s", "confirm" if confirm else "decline", type(exc).__name__)


async def _business_number(o: dict[str, Any]) -> Optional[str]:
    from .gigs import gig_whatsapp_number
    gig = await db.marketplace_gigs.find_one({"_id": o.get("gig_id")}) if o.get("gig_id") else None
    return (await gig_whatsapp_number(gig)) if gig else None


@router.post("/orders/owner/{token}/confirm")
async def owner_confirm(token: str, request: Request):
    return await _decide(token, request, True)


@router.post("/orders/owner/{token}/decline")
async def owner_decline(token: str, request: Request):
    return await _decide(token, request, False)
