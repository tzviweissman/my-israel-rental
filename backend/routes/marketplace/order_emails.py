"""Order and booking emails, with the same controls the business has for
texts (Tzvi, 11 Nov 2026: "a similar feature for email like we have for
automated texts").

- The business's own emails (a new order, booking or quote request) can be
  switched off (`order_settings.email_on`, on unless set to False: email
  costs nothing) and sent to an address of its choice (`email_to`, else the
  account's email). They carry the same one-tap Confirm / Decline link as
  the text, so nobody signs in to answer an order.
- Customer emails always go when the customer gave an address: they are the
  customer's receipt. They use the business's own wording from the texts
  panel (order_texts.TEMPLATES), its own line on confirmations, and Hebrew
  for a Hebrew order.
- Every one is kept in `db.email_log`; Postmark's delivery and bounce
  reports carry its `log_id` back (utils.email.send_email metadata), so the
  dashboard shows whether each one arrived.
"""
from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any, Optional

from routes.deps import db, logger

from .order_texts import PLACEHOLDERS, TEMPLATES, _biz_name, _money, _order_vals, _owner_he, _when, order_no, owner_link, track_link

# Where the text's own wording says "we will text you", which an email must
# not promise: the customer may have given no phone.
EMAIL_WORDS: dict[str, dict[str, str]] = {
    "order_received": {"en": "We got your order {order} from {business}. We will email you when they confirm it.",
                       "he": "קיבלנו את הזמנה {order} מ{business}. נעדכן במייל כשהעסק יאשר אותה."},
}


def emails_on(biz: dict[str, Any]) -> bool:
    return (biz.get("order_settings") or {}).get("email_on") is not False


async def business_email(biz: dict[str, Any]) -> Optional[str]:
    """Where the business's own emails go, or None while it turned them off."""
    if not emails_on(biz):
        return None
    own = (biz.get("order_settings") or {}).get("email_to")
    if own:
        return own
    owner = await db.users.find_one({"id": biz.get("owner_user_id")}, {"email": 1}) or {}
    return owner.get("email")


def email_line(biz: dict[str, Any], key: str, lang: str, vals: dict[str, Any]) -> str:
    """The business's own wording for this message if it wrote one, else ours.
    Plain text: the caller escapes it."""
    lang = "he" if lang == "he" else "en"
    own = (((biz.get("order_settings") or {}).get("text_templates") or {}).get(key) or {}).get(lang)
    t = own or (EMAIL_WORDS.get(key) or TEMPLATES[key])[lang]
    for k in PLACEHOLDERS:
        t = t.replace("{" + k + "}", str(vals.get(k) or ""))
    t = re.sub(r"[ \t]{2,}", " ", t).strip()
    # A text's wording ends by pointing at the link that follows it ("Your tracking link:"). In an email the
    # link is a button further down, so that closing pointer is dropped.
    return re.sub(r"(?<=[.!?])\s+[^.!?:]*:$", "", t)


def note_html(biz: dict[str, Any]) -> str:
    """The business's own line (texts panel), as it appears on confirmations."""
    from .orders import _esc
    n = " ".join(((biz.get("order_settings") or {}).get("text_note") or "").split())
    return f"<p>{_esc(n)}</p>" if n else ""


def _how(o: dict[str, Any], he: bool) -> str:
    if o.get("fulfilment") == "delivery":
        return ("משלוח ל" if he else "Delivery to ") + (o.get("address") or "")
    if o.get("table"):
        return f"שולחן {o['table']}" if he else f"Table {o['table']}"
    return "איסוף" if he else "Pickup"


def _phone(phone: str) -> str:
    from .orders import _esc
    return f' · <span dir="ltr">{_esc(phone)}</span>' if phone else ""


def _log(o: dict[str, Any], who: str, kind: str) -> dict[str, Any]:
    return {"business_id": o.get("business_id"), "who": who, "kind": kind, "ref_id": o.get("_id"), "label": order_no(o)}


async def email_owner_new_order(o: dict[str, Any], biz: dict[str, Any]) -> None:
    """The new order, to the business, with the Confirm / Decline link."""
    from .orders import _email, _esc, _esc_ml
    to = await business_email(biz)
    if not to:
        return
    he = await _owner_he(o)
    who, no = o.get("customer_name") or "", order_no(o)
    if o.get("table"):
        subject = f"הזמנה חדשה {no} משולחן {o['table']}" if he else f"New order {no} from table {o['table']}"
    else:
        subject = f"הזמנה חדשה {no} מ{who}" if he else f"New order {no} from {who}"
    phone = o.get("customer_phone") or ""
    facts = " · ".join(x for x in (_how(o, he), _when(o), _money(o, True)) if x)
    auto = o.get("status") != "new"
    html = (f"<p><strong>{_esc(who)}</strong>{_phone(phone)}{' הזמין/ה:' if he else ' ordered:'}</p><p dir='auto'>{_esc_ml(o.get('items') or '')}</p><p>{_esc(facts)}</p>"
            + (f"<p>{'ההזמנה התקבלה אוטומטית.' if he else 'Accepted automatically.'}</p>" if auto else ""))
    button = ((("מעקב אחר ההזמנה" if he else "See the order") if auto else ("אישור או דחייה" if he else "Confirm or decline")),
              owner_link(o))
    await _email(to, subject, html, tag="order-new", button=button, lang="he" if he else "en", log=_log(o, "business", "order_new"))


async def email_customer_received(o: dict[str, Any], biz: dict[str, Any]) -> None:
    """The customer's receipt the moment they order: what, when, how to pay."""
    from utils.payment_links import allowed_payment_links
    from .orders import _email, _esc, _esc_ml
    if not o.get("customer_email"):
        return
    lang = "he" if o.get("lang") == "he" else "en"
    he = lang == "he"
    auto = o.get("status") != "new"
    line = email_line(biz, "order_confirmed" if auto else "order_received", lang, _order_vals(o, biz, lang))
    facts = " · ".join(x for x in (_how(o, he), _when(o), _money(o, True)) if x)
    pay = biz.get("payment_note") or ""
    links = "".join(f'<p><a href="{_esc(l.get("url"))}">{_esc(l.get("label") or l.get("url"))}</a></p>'
                    for l in allowed_payment_links(biz.get("payment_links")))
    pays = "התשלום ישירות לעסק." if he else "Payment goes to the store directly."
    html = (f"<p>{_esc(line)}</p><p dir='auto'>{_esc_ml(o.get('items') or '')}</p><p>{_esc(facts)}</p>"
            + (note_html(biz) if auto else "")
            + f"<p>{pays} {_esc(pay)}</p>{links}")
    from .order_explore import email_html as explore_html
    extra = await explore_html(o, biz, lang)
    name = _biz_name(biz, lang)
    subject = f"ההזמנה שלך {order_no(o)} מ{name}" if he else f"Your order {order_no(o)} from {name}"
    await _email(o["customer_email"], subject, html, tag="order-confirmation",
                 button=("מעקב אחר ההזמנה" if he else "Follow your order", track_link(o)), lang=lang, log=_log(o, "customer", "order_received"),
                 after_button=extra)


async def email_customer_decision(o: dict[str, Any], biz: dict[str, Any], confirm: bool) -> None:
    """Confirmed or declined, in the business's words."""
    from .orders import _email, _esc, _esc_ml
    if not o.get("customer_email"):
        return
    lang = "he" if o.get("lang") == "he" else "en"
    he, name, no = lang == "he", _biz_name(biz, lang), order_no(o)
    line = email_line(biz, "order_confirmed" if confirm else "order_declined", lang, _order_vals(o, biz, lang))
    if confirm:
        subject = f"ההזמנה שלך {no} מ{name} אושרה" if he else f"Your order {no} from {name} is confirmed"
        html = f"<p>{_esc(line)}</p><p dir='auto'>{_esc_ml(o.get('items') or '')}</p>" + note_html(biz)
        button = ("מעקב אחר ההזמנה" if he else "Follow your order", track_link(o))
        from .order_explore import email_html as explore_html
        extra = await explore_html(o, biz, lang)
    else:
        subject = f"ההזמנה שלך {no} מ{name}" if he else f"Your order {no} from {name}"
        html, button, extra = f"<p>{_esc(line)}</p>", None, ""
    await _email(o["customer_email"], subject, html, tag="order-confirmed" if confirm else "order-declined", button=button,
                 lang=lang, log=_log(o, "customer", "order_confirmed" if confirm else "order_declined"), after_button=extra)


async def email_owner_new_booking(gig: dict[str, Any], booking: dict[str, Any], customer_name: str, summary: str) -> None:
    """A new booking request, to the business, with its Confirm / Decline
    link. Until now a booking reached the business only by bell, WhatsApp
    or text. Never raises."""
    try:
        from .order_texts import _frontend
        from .orders import _email, _esc
        biz = await db.businesses.find_one({"_id": gig.get("business_id")}) or {}
        to = await business_email(biz)
        if not to or not booking.get("owner_token"):
            return
        he = await _owner_he({"owner_user_id": gig.get("provider_user_id")})
        phone = booking.get("contact_phone") or ""
        subject = f"בקשת תור חדשה מ{customer_name}" if he else f"New booking request from {customer_name}"
        html = (f"<p><strong>{_esc(customer_name)}</strong>{_phone(phone)}</p>"
                f"<p>{_esc(summary)}</p>")
        await _email(to, subject, html, tag="booking-new", button=("אישור או דחייה" if he else "Confirm or decline",
                     f"{_frontend()}/bookings/owner/{booking['owner_token']}"), lang="he" if he else "en",
                     log={"business_id": gig.get("business_id"), "who": "business", "kind": "booking_new",
                          "ref_id": booking.get("_id"), "label": customer_name})
    except Exception as exc:  # noqa: BLE001
        logger.warning("booking email to the business failed: %s", type(exc).__name__)


def _mask(addr: str) -> str:
    local, _, domain = (addr or "").partition("@")
    return f"{local[:2]}…@{domain}" if domain else "…"


async def keep(log_id: str, to: str, subject: str, log: dict[str, Any]) -> None:
    try:
        await db.email_log.insert_one({"_id": log_id, **log, "to_end": _mask(to), "subject": subject[:120],
                                       "at": datetime.now(UTC).isoformat()})
    except Exception as exc:  # noqa: BLE001 - the email went; only its record failed
        logger.warning("email log write failed: %s", type(exc).__name__)


_STATUS = {"Delivery": "delivered", "Bounce": "bounced", "SpamComplaint": "spam"}


async def recent_emails(business_id: str) -> list[dict[str, Any]]:
    """The last emails about this business's orders and bookings, each with
    Postmark's report: sent (no report yet), delivered, bounced or spam."""
    rows = await db.email_log.find({"business_id": business_id}).sort("at", -1).limit(20).to_list(20)
    found: dict[str, str] = {}
    async for e in db.email_events.find({"raw.Metadata.log_id": {"$in": [r["_id"] for r in rows]}},
                                        {"record_type": 1, "raw.Metadata.log_id": 1}):
        lid, st = ((e.get("raw") or {}).get("Metadata") or {}).get("log_id"), _STATUS.get(e.get("record_type"))
        if st and found.get(lid) not in ("bounced", "spam"):   # a bounce outranks a delivery
            found[lid] = st
    return [{"who": r.get("who"), "kind": r.get("kind"), "label": r.get("label") or "", "to_end": r.get("to_end"),
             "subject": r.get("subject") or "", "at": r.get("at"), "status": found.get(r["_id"], "sent")} for r in rows]


async def ensure_email_indexes() -> None:
    await db.email_log.create_index([("business_id", 1), ("at", -1)])
    await db.email_events.create_index("raw.Metadata.log_id", sparse=True)
