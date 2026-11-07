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

import re
import uuid
from datetime import UTC, datetime
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
                 f"התקבלה אוטומטית. מעקב: {link}" if o.get("status") != "new" else f"אישור או דחייה: {link}"]
    else:
        how = "Delivery to " + (o.get("address") or "") if o.get("fulfilment") == "delivery" else (f"Table {o['table']}" if o.get("table") else "Pickup")
        parts = [f"New order {order_no(o)} from {o.get('customer_name') or ''}" + (f", {phone}" if phone else ""),
                 (o.get("items") or "").replace("\n", ", ").replace("×", "x"), ", ".join(x for x in (how, _when(o), _money(o, False)) if x),
                 f"Accepted automatically. Follow it: {link}" if o.get("status") != "new" else f"Confirm or decline: {link}"]
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


# The texts a customer gets, in our words; each business can rewrite any of
# them in its own (Tzvi, 7 Nov 2026, "like we can with WhatsApp"). The link is
# never part of the wording: it is added after, so no edit can lose it.
TEMPLATES: dict[str, dict[str, str]] = {
    "order_received": {"en": "We got your order {order} from {business}. We will text you when they confirm it. Track it:",
                       "he": "קיבלנו את הזמנה {order} מ{business}. נעדכן בהודעה כשהעסק יאשר אותה. מעקב:"},
    "order_confirmed": {"en": "Your order {order} from {business} is confirmed. Your tracking link:",
                        "he": "ההזמנה שלך {order} מ{business} אושרה. הקישור שלך למעקב:"},
    "order_declined": {"en": "Sorry, {business} can't take your order {order} this time.",
                       "he": "מצטערים, {business} לא יכולים לקבל את ההזמנה שלך {order} הפעם."},
    "booking_confirmed": {"en": "Your booking for {service} is confirmed. See the details:",
                          "he": "התור שלך ל{service} אושר. פרטים ומעקב:"},
    "booking_declined": {"en": "Sorry, your booking for {service} could not be accepted this time. Details:",
                         "he": "מצטערים, לא ניתן לאשר את התור שלך ל{service} הפעם. פרטים:"},
    "request_received": {"en": "Your request went to {business}. We will let you know when they answer. Track it:",
                         "he": "הבקשה שלך נשלחה ל{business}. נעדכן כשיענו. מעקב:"},
    "reminder": {"en": "Reminder: {service} with {business} {when} at {time}. To change or cancel:",
                 "he": "תזכורת: {service} אצל {business} {when} בשעה {time}. לשינוי או ביטול:"},
    "review": {"en": "Thanks for choosing {business}! How was it? Leave a quick review here:",
               "he": "תודה שבחרת ב{business}! איך היה? אפשר להשאיר ביקורת קצרה כאן:"},
    # Off until the business writes one: the answer to a customer's reply (needs the reply number).
    "auto_reply": {"en": "", "he": ""},
}
PLACEHOLDERS = ("customer", "business", "order", "service", "when", "time")


def compose(biz: dict[str, Any], key: str, lang: str, vals: dict[str, Any], link: Optional[str] = None) -> str:
    """The business's own wording for this text if it wrote one, else ours,
    with the pieces filled in and the link after it."""
    lang = "he" if lang == "he" else "en"
    own = (((biz.get("order_settings") or {}).get("text_templates") or {}).get(key) or {}).get(lang)
    t = own or TEMPLATES[key][lang]
    for k in PLACEHOLDERS:
        t = t.replace("{" + k + "}", str(vals.get(k) or ""))
    t = re.sub(r"[ \t]{2,}", " ", t).strip()
    return f"{t} {link}" if link else t


def clean_templates(raw: Optional[dict[str, Any]]) -> dict[str, dict[str, str]]:
    """What the dashboard sent, kept only where it differs from ours."""
    out: dict[str, dict[str, str]] = {}
    for key, langs in (raw or {}).items():
        if key not in TEMPLATES or not isinstance(langs, dict):
            continue
        for lang in ("en", "he"):
            v = " ".join(str(langs.get(lang) or "").split())[:300]
            if v and v != TEMPLATES[key][lang]:
                out.setdefault(key, {})[lang] = v
    return out


def _note(biz: dict[str, Any]) -> str:
    """The business's own line on texts to its customers (Tzvi, 7 Nov 2026)."""
    n = " ".join(((biz.get("order_settings") or {}).get("text_note") or "").split())
    return f"\n{n}" if n else ""


def _biz_name(biz: dict[str, Any], lang: str) -> str:
    return (biz.get("name_he") if lang == "he" and biz.get("name_he") else biz.get("name")) or ""


def _order_vals(o: dict[str, Any], biz: dict[str, Any], lang: str) -> dict[str, Any]:
    return {"order": order_no(o), "business": _biz_name(biz, lang), "customer": o.get("customer_name") or ""}


async def _text(to: str, body: str, *, biz_id: Optional[str], who: str, kind: str, ref_id: Optional[str] = None, label: str = "") -> bool:
    """One text, kept so its delivery report and any reply can be matched to
    it (sms_status, sms_in). `who`: "customer" or "business"."""
    sid = await send_sms(to=to, body=body, reply=who == "customer")
    if sid:
        from utils.whatsapp_link import normalize_whatsapp_number
        try:
            await db.sms_log.insert_one({
                "_id": sid if isinstance(sid, str) else str(uuid.uuid4()), "to": normalize_whatsapp_number(to),
                "business_id": biz_id, "who": who, "kind": kind, "ref_id": ref_id, "label": label,
                "status": "sent", "reports": isinstance(sid, str), "at": datetime.now(UTC).isoformat(),
            })
        except Exception as exc:  # noqa: BLE001 - the text went; only its record failed
            logger.warning("sms log write failed: %s", type(exc).__name__)
    return bool(sid)


async def text_owner_new_order(order_id: str) -> bool:
    """The new-order text. Never raises."""
    try:
        o = await db.store_orders.find_one({"_id": order_id})
        if not o or not o.get("owner_token"):
            return False
        number = await _business_text_number(o)
        if not number:
            return False
        return await _text(number, owner_text(o, owner_link(o), await _owner_he(o)), biz_id=o.get("business_id"),
                           who="business", kind="order_new", ref_id=o["_id"], label=order_no(o))
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
        return await _text(number, body, biz_id=gig.get("business_id"), who="business", kind="booking_new", label=who)
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
        gig = await db.marketplace_gigs.find_one({"_id": b.get("gig_id")}, {"business_id": 1}) or {}
        biz = await db.businesses.find_one({"_id": gig.get("business_id")}) or {}
        if not texts_on(biz):
            return
        link = f"{_frontend()}/bookings/track/{b['track_token']}"
        lang = "he" if (b.get("lang") or "").startswith("he") else "en"
        vals = {"service": title, "customer": b.get("guest_name") or "", "business": _biz_name(biz, lang)}
        body = compose(biz, "booking_confirmed" if status == "accepted" else "booking_declined", lang, vals, link)
        await _text(phone, body + (_note(biz) if status == "accepted" else ""), biz_id=gig.get("business_id"), who="customer",
                    kind="booking_" + status, ref_id=b.get("_id"), label=title)
    except Exception as exc:  # noqa: BLE001
        logger.warning("booking text to the customer failed: %s", type(exc).__name__)


async def text_customer_received(o: dict[str, Any], biz: dict[str, Any]) -> None:
    """The moment the order is placed: it arrived, the business still has to
    say yes, and here is the link (Tzvi, 6 Nov 2026). Never raises."""
    try:
        phone = o.get("customer_phone_e164") or o.get("customer_phone")
        if not phone or o.get("table") or not texts_on(biz):
            return
        lang = "he" if o.get("lang") == "he" else "en"
        no = order_no(o)
        body = compose(biz, "order_received", lang, _order_vals(o, biz, lang), track_link(o))
        await _text(phone, body, biz_id=o.get("business_id"), who="customer", kind="order_received", ref_id=o.get("_id"), label=no)
    except Exception as exc:  # noqa: BLE001
        logger.warning("order received text failed: %s", type(exc).__name__)


async def text_customer_request(gig: dict[str, Any], phone: Optional[str], path: str, he: bool) -> None:
    """A booking or a price request arrived, when the business has texts on
    (its customers then do not open WhatsApp). Never raises."""
    try:
        biz = await db.businesses.find_one({"_id": gig.get("business_id")}) or {}
        if not phone or not texts_on(biz):
            return
        lang = "he" if he else "en"
        body = compose(biz, "request_received", lang, {"business": _biz_name(biz, lang), "service": gig.get("title") or ""}, f"{_frontend()}{path}")
        await _text(phone, body,
                    biz_id=gig.get("business_id"), who="customer", kind="request_received", label=gig.get("title") or "")
    except Exception as exc:  # noqa: BLE001
        logger.warning("request received text failed: %s", type(exc).__name__)


async def text_owner_new_quote(gig: dict[str, Any], q: dict[str, Any]) -> None:
    """A new price request, by text, when the business has texts on. Never raises."""
    try:
        biz = await db.businesses.find_one({"_id": gig.get("business_id")}) or {}
        if not texts_on(biz):
            return
        number = await _business_text_number({"business_id": gig.get("business_id"), "gig_id": gig.get("_id")})
        if not number:
            return
        link = f"{_frontend()}/dashboard?tab=appointments"
        he = await _owner_he({"owner_user_id": gig.get("provider_user_id")})
        await _text(number, f"בקשת מחיר חדשה מ{q['name']}: {q['description'][:120]}\nלתשובה: {link}" if he
                    else f"New price request from {q['name']}: {q['description'][:120]}\nAnswer it: {link}",
                    biz_id=gig.get("business_id"), who="business", kind="quote_new", ref_id=q.get("_id"), label=q["name"])
    except Exception as exc:  # noqa: BLE001
        logger.warning("quote text failed: %s", type(exc).__name__)


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
        if customer and texts_on(biz):
            lang = "he" if o.get("lang") == "he" else "en"
            body = (compose(biz, "order_confirmed", lang, _order_vals(o, biz, lang), track_link(o)) if confirm
                    else compose(biz, "order_declined", lang, _order_vals(o, biz, lang)))
            await _text(customer, body + (_note(biz) if confirm else ""), biz_id=o.get("business_id"), who="customer",
                        kind="order_confirmed" if confirm else "order_declined", ref_id=o.get("_id"), label=no)
        await _email_customer(o, name, no, confirm)
        if confirm and tell_business:
            # The phone that tapped is the business's: the alert went to it.
            number = await _business_text_number(o)
            if number:
                he = await _owner_he(o)
                body = (f"אישרת את הזמנה {no} של {o.get('customer_name') or ''}. הקישור של העסק למעקב: {owner_link(o)}" if he
                        else f"You confirmed order {no} for {o.get('customer_name') or ''}. Your store's link to follow it: {owner_link(o)}")
                await _text(number, body, biz_id=o.get("business_id"), who="business", kind="order_confirmed", ref_id=o.get("_id"), label=no)
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
    """The number the business chose for texts, else its WhatsApp number.
    None while its switch is off: texts go only to a business that turned them
    on (Tzvi, 6 Nov 2026)."""
    biz = await db.businesses.find_one({"_id": o.get("business_id")}) or {}
    if not texts_on(biz):
        return None
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


# ---------------------------------------------------------------------------
# a review request when the order or booking is done (Tzvi, 7 Nov 2026)
# ---------------------------------------------------------------------------

async def _review_text(coll: str, doc: dict[str, Any], biz: dict[str, Any], phone: Optional[str], link: str, kind: str) -> None:
    """Once per order or booking, only with texts on and reviews open. The
    link is the customer's own status page, which asks for the review with
    no sign-in."""
    from utils.reviews import native_enabled
    if not phone or not texts_on(biz) or not native_enabled():
        return
    claimed = await db[coll].update_one({"_id": doc["_id"], "review_text_at": {"$exists": False}},
                                        {"$set": {"review_text_at": datetime.now(UTC).isoformat()}})
    if not claimed.modified_count:
        return
    lang = "he" if (doc.get("lang") or "").startswith("he") else "en"
    vals = {"business": _biz_name(biz, lang), "customer": doc.get("customer_name") or doc.get("guest_name") or "",
            "order": order_no(doc) if coll == "store_orders" else ""}
    body = compose(biz, "review", lang, vals, link)
    await _text(phone, body, biz_id=biz.get("_id"), who="customer", kind=kind, ref_id=doc["_id"],
                label=order_no(doc) if coll == "store_orders" else "")


async def text_review_order(o: dict[str, Any]) -> None:
    """The order just reached "done". Never raises."""
    try:
        if o.get("source") != "website" or o.get("table"):
            return
        biz = await db.businesses.find_one({"_id": o.get("business_id")}) or {}
        await _review_text("store_orders", o, biz, o.get("customer_phone_e164") or o.get("customer_phone"), track_link(o), "order_review")
    except Exception as exc:  # noqa: BLE001
        logger.warning("order review text failed: %s", type(exc).__name__)


async def text_review_booking(b: dict[str, Any]) -> None:
    """The booking was just marked complete. Never raises."""
    try:
        if not b.get("track_token"):
            return
        gig = await db.marketplace_gigs.find_one({"_id": b.get("gig_id")}, {"business_id": 1}) or {}
        biz = await db.businesses.find_one({"_id": gig.get("business_id")}) or {}
        await _review_text("marketplace_bookings", b, biz, b.get("contact_phone"),
                           f"{_frontend()}/bookings/track/{b['track_token']}", "booking_review")
    except Exception as exc:  # noqa: BLE001
        logger.warning("booking review text failed: %s", type(exc).__name__)


async def text_booking_reminder(b: dict[str, Any], biz: dict[str, Any], service: str, when: str, time_s: str) -> bool:
    """A reminder before an appointment, with the link to change or cancel it
    (appointment_reminders.py decides when). Only with texts on."""
    phone = b.get("contact_phone")
    if not phone or not b.get("track_token") or not texts_on(biz):
        return False
    lang = "he" if b.get("lang") == "he" else "en"
    link = f"{_frontend()}/bookings/track/{b['track_token']}"
    vals = {"service": service, "business": _biz_name(biz, lang), "when": when, "time": time_s, "customer": b.get("guest_name") or ""}
    body = compose(biz, "reminder", lang, vals, link)
    return await _text(phone, body + _note(biz), biz_id=biz.get("_id"), who="customer", kind="booking_reminder",
                       ref_id=b.get("_id"), label=service)


# ---------------------------------------------------------------------------
# what Cellact tells us back: delivery reports and replies (Tzvi, 7 Nov 2026)
# ---------------------------------------------------------------------------

# Cellact's reasons, as the dashboard says them (docs: JSON API guide 1.3.5, section 8).
PROBLEMS = {"2050": "blocked", "7001": "unreachable", "2055": "kosher", "4002": "service", "2035": "service"}


def _key_ok(key: str) -> None:
    import hmac
    from utils.sms import hook_key
    expected = hook_key()
    if not expected or not hmac.compare_digest(str(key), expected):
        raise HTTPException(status_code=404, detail="Not found")


@router.post("/sms/status/{key}")
async def sms_status(key: str, request: Request):
    """mt_ok, then mt_del (delivered) or mt_nok / mt_rej (not). Up to two per
    text, the second sometimes hours later; the same id on both."""
    _key_ok(key)
    try:
        ev = await request.json()
    except Exception:  # noqa: BLE001
        return {"ok": True}
    sid, event, err = str(ev.get("id") or ""), ev.get("event"), str(ev.get("errorId") or "")
    if not sid or event not in ("mt_ok", "mt_del", "mt_nok", "mt_rej"):
        return {"ok": True}
    if event == "mt_ok":
        return {"ok": True}
    status = "delivered" if event == "mt_del" else "failed"
    row = await db.sms_log.find_one_and_update(
        {"_id": sid, "status": "sent"},
        {"$set": {"status": status, "error": err or None, "problem": None if status == "delivered" else PROBLEMS.get(err, "other"),
                  "reported_at": datetime.now(UTC).isoformat()}},
        return_document=ReturnDocument.AFTER)
    if row and status == "failed":
        logger.warning("SMS not delivered id=%s error=%s who=%s", sid, err, row.get("who"))
        if row.get("who") == "business" and row.get("business_id"):
            await _tell_owner_texts_fail(row)
    return {"ok": True}


async def _tell_owner_texts_fail(row: dict[str, Any]) -> None:
    """Their own number does not get our texts (a typo, like 0553778799 on 6
    Nov 2026): one email a day per number, and the bell."""
    day = datetime.now(UTC).date().isoformat()
    try:
        await db.sms_alerts.insert_one({"_id": f"{row['business_id']}:{row['to']}:{day}"})
    except DuplicateKeyError:
        return
    biz = await db.businesses.find_one({"_id": row["business_id"]}) or {}
    owner_id = biz.get("owner_user_id")
    shown = "0" + row["to"][3:] if row["to"].startswith("972") else "+" + row["to"]
    from .orders import _email, _notify
    msg = f"Your order texts are not reaching {shown}. Check the number in Text notifications."
    await _notify(owner_id, type_="texts_failed", message=msg, action_url="/dashboard?tab=text-notifications")
    owner = await db.users.find_one({"id": owner_id}, {"email": 1}) or {}
    await _email(owner.get("email"), "Your order texts are not arriving",
                 f"<p>We could not deliver the texts about new orders to <b>{shown}</b>. If the number is wrong, fix it in "
                 "Text notifications so you hear about your next order.</p>",
                 tag="texts-failed", button=("Open Text notifications", f"{_frontend()}/dashboard?tab=text-notifications"))


@router.post("/sms/in/{key}")
async def sms_in(key: str, request: Request):
    """A customer answered one of our texts (only possible from the virtual
    number, CELLACT_REPLY_NUMBER). The business gets it by text when its
    texts are on, and always in the bell and by email."""
    _key_ok(key)
    try:
        ev = await request.json()
    except Exception:  # noqa: BLE001
        return {"ok": True}
    from utils.whatsapp_link import normalize_whatsapp_number
    sender = normalize_whatsapp_number(str(ev.get("sender") or ""))
    content = " ".join(str(ev.get("content") or "").split())[:600]
    if ev.get("event") != "mo" or not sender or not content:
        return {"ok": True}
    last = await db.sms_log.find_one({"to": sender, "who": "customer", "business_id": {"$ne": None}}, sort=[("at", -1)])
    if not last:
        logger.info("SMS reply from %s*** matched no text", sender[:6])
        return {"ok": True}
    try:
        await db.sms_replies.insert_one({"_id": str(ev.get("id") or uuid.uuid4()), "from": sender, "content": content,
                                         "business_id": last["business_id"], "kind": last.get("kind"), "ref_id": last.get("ref_id"),
                                         "label": last.get("label"), "at": datetime.now(UTC).isoformat()})
    except DuplicateKeyError:
        return {"ok": True}  # Cellact sent the same reply twice
    biz = await db.businesses.find_one({"_id": last["business_id"]}) or {}
    shown = "0" + sender[3:] if sender.startswith("972") else "+" + sender
    about = f" about {last['label']}" if last.get("label") else ""
    tab = "orders" if (last.get("kind") or "").startswith("order") else "appointments"
    from .orders import _email, _esc, _notify
    await _notify(biz.get("owner_user_id"), type_="text_reply", message=f"Reply from {shown}{about}: {content[:140]}",
                  action_url=f"/dashboard?tab={tab}")
    owner = await db.users.find_one({"id": biz.get("owner_user_id")}, {"email": 1}) or {}
    await _email(owner.get("email"), f"A customer replied{about}",
                 f"<p><b>{_esc(shown)}</b> answered your text{_esc(about)}:</p><p>{_esc(content)}</p>",
                 tag="text-reply", button=("Open the dashboard", f"{_frontend()}/dashboard?tab={tab}"))
    number = await _business_text_number({"business_id": last["business_id"]})
    if number:
        await _text(number, f"Reply from {shown}{about}: {content[:300]}", biz_id=last["business_id"], who="business",
                    kind="reply", ref_id=last.get("ref_id"), label=last.get("label") or "")
    await _auto_reply(biz, sender, last)
    return {"ok": True}


async def _auto_reply(biz: dict[str, Any], sender: str, last: dict[str, Any]) -> None:
    """The business's own answer to a customer who replied, like WhatsApp's
    away message: only if it wrote one, with texts on, once a day per customer."""
    own = ((biz.get("order_settings") or {}).get("text_templates") or {}).get("auto_reply") or {}
    if not own or not texts_on(biz):
        return
    lang = "he" if own.get("he") and (sender.startswith("972") or not own.get("en")) else "en"
    try:
        await db.sms_auto_replies.insert_one({"_id": f"{biz['_id']}:{sender}:{datetime.now(UTC).date().isoformat()}"})
    except DuplicateKeyError:
        return
    body = compose(biz, "auto_reply", lang, {"business": _biz_name(biz, lang)})
    if body:
        await _text(sender, body, biz_id=biz["_id"], who="customer", kind="auto_reply", ref_id=last.get("ref_id"), label=last.get("label") or "")


async def recent_texts(business_id: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """The last texts about this business, for its own dashboard."""
    out = []
    async for r in db.sms_log.find({"business_id": business_id}).sort("at", -1).limit(15):
        out.append({"at": r.get("at"), "who": r.get("who"), "kind": r.get("kind"), "label": r.get("label") or "",
                    "status": r.get("status"), "problem": r.get("problem"), "reports": r.get("reports", True),
                    "to_end": (r.get("to") or "")[-4:]})
    replies = [{"at": r.get("at"), "from_end": (r.get("from") or "")[-4:], "label": r.get("label") or "", "content": r.get("content")}
               async for r in db.sms_replies.find({"business_id": business_id}).sort("at", -1).limit(10)]
    return out, replies


async def ensure_sms_indexes() -> None:
    await db.sms_log.create_index([("business_id", 1), ("at", -1)])
    await db.sms_log.create_index([("to", 1), ("at", -1)])
    await db.sms_replies.create_index([("business_id", 1), ("at", -1)])
