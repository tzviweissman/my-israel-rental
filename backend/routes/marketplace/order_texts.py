"""New orders by text message, with a one-tap Confirm / Decline page.

Tzvi, 2 Nov 2026: owners should not have to sign in for each order. The
business gets a text with the order and a link; the link opens one page
for that one order (/orders/owner/<token>) with Confirm and Decline. On
Confirm the customer and the business each get a text with the order
number and their link. Until Meta approves WhatsApp this is the only
message that reaches a phone; once WhatsApp works, the text goes out
only when the WhatsApp message did not (orders.alert_business_on_whatsapp).
Texts go to the number the business chose in its order settings, or its
WhatsApp number if it chose none.

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
from pymongo.errors import DuplicateKeyError

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


async def insert_order(doc: dict[str, Any]) -> None:
    """Every new order of every kind (website, dashboard, counter sale,
    standing, partner, automation) is saved here, so every one gets the
    store's next number. The unique index on (business_id, order_no) is the
    second lock: if the counter were ever behind (reset, restored from a
    backup), the clash moves the counter past the highest number in use and
    tries again, instead of reusing a number. Any other clash (a standing
    order's date already made) is raised to the caller as before."""
    for _ in range(5):
        doc["order_no"] = await next_order_no(doc["business_id"])
        try:
            await db.store_orders.insert_one(doc)
            return
        except DuplicateKeyError as exc:
            if "order_no" not in str(exc):
                raise
            top = await db.store_orders.find_one(
                {"business_id": doc["business_id"], "order_no": {"$exists": True}}, sort=[("order_no", -1)])
            await db.counters.update_one(
                {"_id": f"order_no:{doc['business_id']}"}, {"$max": {"n": (top or {}).get("order_no", 1000) - 1000}},
                upsert=True)
    raise RuntimeError("could not give the order a number")


def matches(o: dict[str, Any], q: str) -> bool:
    """The Orders page search: "1042", "#1042", part of a name, or a phone
    number in any format (052-111-2222, +972521112222)."""
    q = (q or "").strip().lower().lstrip("#")
    if not q:
        return True
    digits = "".join(ch for ch in q if ch.isdigit())
    if digits and digits == q.replace(" ", "").replace("-", "").replace("+", ""):
        if str(o.get("order_no") or "") == digits or order_no(o).lstrip("#").lower() == q:
            return True
        phones = "".join(ch for ch in f"{o.get('customer_phone') or ''} {o.get('customer_phone_e164') or ''}" if ch.isdigit() or ch == " ")
        # Israeli numbers are stored both as 05x and 9725x: drop the leading 0.
        if len(digits) >= 6 and digits.lstrip("0") in phones:
            return True
        # A number is exact: "104" is not #1042.
        return False
    text = f"{o.get('customer_name') or ''} {o.get('customer_email') or ''} {order_no(o)}".lower()
    return q in text


def texts_on(biz: dict[str, Any]) -> bool:
    """The business turned text notifications on. A number chosen before the
    switch existed means the same."""
    st = biz.get("order_settings") or {}
    return bool(st.get("text_on") or st.get("text_number"))


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


async def text_owner_new_order(order_id: str) -> bool:
    """The new-order text. Never raises."""
    try:
        o = await db.store_orders.find_one({"_id": order_id})
        if not o or not o.get("owner_token"):
            return False
        number = await _business_text_number(o)
        if not number:
            return False
        return await send_sms(to=number, body=owner_text(o, owner_link(o), await _owner_he(o)))
    except Exception as exc:  # noqa: BLE001
        logger.warning("order text to the business failed: %s", type(exc).__name__)
        return False


async def text_owner_new_booking(gig: dict[str, Any], customer_name: str, summary: str, token: str, owner_user_id: Optional[str]) -> bool:
    """A new booking, by text, only when the business turned texts on: its
    customers then no longer open WhatsApp to tell it. The link is the
    business's one-booking page, no sign-in, like an order's. Never raises."""
    try:
        biz = await db.businesses.find_one({"_id": gig.get("business_id")}) or {}
        if not texts_on(biz):
            return False
        number = await _business_text_number({"business_id": gig.get("business_id"), "gig_id": gig.get("_id")})
        if not number:
            return False
        link = f"{_frontend()}/bookings/owner/{token}"
        who = customer_name or ""
        he = await _owner_he({"owner_user_id": owner_user_id})
        body = f"בקשת תור חדשה מ{who}: {summary}\nאישור או דחייה: {link}" if he else f"New booking from {who}: {summary}\nConfirm or decline: {link}"
        return await send_sms(to=number, body=body)
    except Exception as exc:  # noqa: BLE001
        logger.warning("booking text to the business failed: %s", type(exc).__name__)
        return False


async def text_customer_booking(b: dict[str, Any], status: str, title: str) -> None:
    """The customer's answer by text, with their link, signed in or a guest
    (Tzvi, 6 Nov 2026). Never raises: the booking has already moved."""
    try:
        phone = b.get("contact_phone")
        if not phone or not b.get("track_token"):
            return
        link = f"{_frontend()}/bookings/track/{b['track_token']}"
        he = (b.get("lang") or "").startswith("he")
        if status == "accepted":
            body = f"התור שלך ל{title} אושר. פרטים ומעקב: {link}" if he else f"Your booking for {title} is confirmed. See the details: {link}"
        else:
            body = f"מצטערים, לא ניתן לאשר את התור שלך ל{title} הפעם. פרטים: {link}" if he else f"Sorry, your booking for {title} could not be accepted this time. Details: {link}"
        await send_sms(to=phone, body=body)
    except Exception as exc:  # noqa: BLE001
        logger.warning("booking text to the customer failed: %s", type(exc).__name__)


async def text_customer_received(o: dict[str, Any], biz: dict[str, Any]) -> None:
    """The moment the order is placed: it arrived, the business still has to
    say yes, and here is the link (Tzvi, 6 Nov 2026). Never raises."""
    try:
        phone = o.get("customer_phone_e164") or o.get("customer_phone")
        if not phone or o.get("table"):
            return
        he = o.get("lang") == "he"
        name = biz.get("name_he") if he and biz.get("name_he") else biz.get("name") or ""
        no = order_no(o)
        body = (f"קיבלנו את הזמנה {no} מ{name}. נעדכן בהודעה כשהעסק יאשר אותה. מעקב: {track_link(o)}" if he
                else f"We got your order {no} from {name}. We will text you when they confirm it. Track it: {track_link(o)}")
        await send_sms(to=phone, body=body)
    except Exception as exc:  # noqa: BLE001
        logger.warning("order received text failed: %s", type(exc).__name__)


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


async def customer_told_of_decision(o: dict[str, Any], status: str) -> None:
    """Answered from the dashboard, not the texted link: the customer hears
    all the same (Tzvi, 6 Nov 2026). `o` is the order before the move. Website
    orders only: a customer does not expect a text about an order the business
    typed in. The business made the decision on screen, so it gets no text."""
    if o.get("status") != "new" or o.get("source") != "website" or status not in (CONFIRMED_STATUS, "ready", "done", DECLINED_STATUS):
        return
    biz = await db.businesses.find_one({"_id": o["business_id"]}) or {}
    await _texts_after(o, biz, status != DECLINED_STATUS, tell_business=False)


async def _texts_after(o: dict[str, Any], biz: dict[str, Any], confirm: bool, tell_business: bool = True) -> None:
    """The customer and the business each get one text. Never raises: the
    order has already moved."""
    try:
        name = biz.get("name_he") if o.get("lang") == "he" and biz.get("name_he") else biz.get("name") or ""
        no = order_no(o)
        customer = o.get("customer_phone_e164") or o.get("customer_phone")
        if customer:
            if o.get("lang") == "he":
                body = (f"ההזמנה שלך {no} מ{name} אושרה. הקישור שלך למעקב: {track_link(o)}" if confirm
                        else f"מצטערים, {name} לא יכולים לקבל את ההזמנה שלך {no} הפעם.")
            else:
                body = (f"Your order {no} from {name} is confirmed. Your tracking link: {track_link(o)}" if confirm
                        else f"Sorry, {name} can't take your order {no} this time.")
            await send_sms(to=customer, body=body)
        await _email_customer(o, name, no, confirm)
        if confirm and tell_business:
            # The phone that tapped is the business's: the alert went to it.
            number = await _business_text_number(o)
            if number:
                he = await _owner_he(o)
                body = (f"אישרת את הזמנה {no} של {o.get('customer_name') or ''}. הקישור של העסק למעקב: {owner_link(o)}" if he
                        else f"You confirmed order {no} for {o.get('customer_name') or ''}. Your store's link to follow it: {owner_link(o)}")
                await send_sms(to=number, body=body)
    except Exception as exc:  # noqa: BLE001
        logger.warning("order texts after %s failed: %s", "confirm" if confirm else "decline", type(exc).__name__)


async def _email_customer(o: dict[str, Any], name: str, no: str, confirm: bool) -> None:
    """The same news by email (Tzvi, 6 Nov 2026), with the tracking link."""
    from .orders import _email, _esc, _esc_ml
    he = o.get("lang") == "he"
    if confirm:
        subject = f"ההזמנה שלך {no} מ{name} אושרה" if he else f"Your order {no} from {name} is confirmed"
        html = f"<p>{_esc(subject)}.</p><p>{_esc_ml(o.get('items') or '')}</p>"
        button = ("מעקב אחר ההזמנה" if he else "Follow your order", track_link(o))
    else:
        subject = f"ההזמנה שלך {no} מ{name}" if he else f"Your order {no} from {name}"
        sorry = f"מצטערים, {name} לא יכולים לקבל את ההזמנה שלך {no} הפעם." if he else f"Sorry, {name} can't take your order {no} this time."
        html, button = f"<p>{_esc(sorry)}</p>", None
    await _email(o.get("customer_email"), subject, html, tag="order-confirmed" if confirm else "order-declined", button=button)


async def _business_text_number(o: dict[str, Any]) -> Optional[str]:
    """The number the business chose for texts, else its WhatsApp number."""
    biz = await db.businesses.find_one({"_id": o.get("business_id")}) or {}
    own = (biz.get("order_settings") or {}).get("text_number")
    if own:
        return own
    from .gigs import gig_whatsapp_number
    gig = await db.marketplace_gigs.find_one({"_id": o.get("gig_id")}) if o.get("gig_id") else None
    return (await gig_whatsapp_number(gig)) if gig else None


@router.post("/orders/owner/{token}/confirm")
async def owner_confirm(token: str, request: Request):
    return await _decide(token, request, True)


@router.post("/orders/owner/{token}/decline")
async def owner_decline(token: str, request: Request):
    return await _decide(token, request, False)


async def _booking_by_owner_token(token: str) -> dict[str, Any]:
    if not token or len(token) < 16:
        raise HTTPException(status_code=404, detail="This link is not valid")
    b = await db.marketplace_bookings.find_one({"owner_token": token})
    if not b:
        raise HTTPException(status_code=404, detail="This link is not valid")
    return b


async def _booking_view(b: dict[str, Any]) -> dict[str, Any]:
    gig = await db.marketplace_gigs.find_one({"_id": b.get("gig_id")}) or {}
    biz = await db.businesses.find_one({"_id": gig.get("business_id")}) or {}
    client = await db.users.find_one({"id": b.get("client_user_id")}, {"name": 1}) if b.get("client_user_id") else None
    return {
        "status": b.get("status"),
        "business": {"name": biz.get("name") or "", "name_he": biz.get("name_he"), "logo_url": biz.get("logo_url")},
        "customer_name": b.get("guest_name") or (client or {}).get("name"),
        "customer_phone": b.get("contact_phone"), "customer_email": b.get("contact_email"),
        "title": gig.get("title"), "tier_name": b.get("tier_name"),
        "date": b.get("preferred_date"), "time": b.get("time_slot"), "message": b.get("message"),
    }


@router.get("/bookings/owner/{token}")
async def owner_booking(token: str, request: Request):
    check_rate(request, bucket="orders_owner", limit=300, window_seconds=600)
    return await _booking_view(await _booking_by_owner_token(token))


async def _decide_booking(token: str, request: Request, confirm: bool) -> dict[str, Any]:
    """The owner token opens one booking and can only answer it while it is
    waiting. update_booking does the rest, as if from the dashboard, and
    that is what tells the customer."""
    check_rate(request, bucket="orders_owner_move", limit=60, window_seconds=600)
    b = await _booking_by_owner_token(token)
    if b.get("status") != "pending":
        return {**await _booking_view(b), "already": True}
    from .gigs import update_booking
    from .shared import BookingPatch
    await update_booking(b["_id"], BookingPatch(status="accepted" if confirm else "declined"), user={"user_id": b["provider_user_id"]})
    fresh = await db.marketplace_bookings.find_one({"_id": b["_id"]}) or b
    return {**await _booking_view(fresh), "already": False}


@router.post("/bookings/owner/{token}/confirm")
async def owner_booking_confirm(token: str, request: Request):
    return await _decide_booking(token, request, True)


@router.post("/bookings/owner/{token}/decline")
async def owner_booking_decline(token: str, request: Request):
    return await _decide_booking(token, request, False)
