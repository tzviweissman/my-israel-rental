"""Automatic messages to guests of a stay (Tzvi, 16 Oct 2026, from Airbnb:
"check-in instructions the day before arrival, a how-is-everything message
on the first evening, and a checkout reminder; hosts set them once").

Per property, for stays (vacation and short-term rentals), on confirmed
bookings only:

    before    the day before arrival, from 10:00: the address, the check-in
              time and the host's own check-in instructions (key, door code,
              parking, Wi-Fi), which live only here and only go to a guest
              with a confirmed booking
    evening   the arrival day, from 19:00: is everything all right
    checkout  the checkout day, from 08:00 until the checkout time

Each goes once per booking (a log with a unique key, like
member_messages.py), never at night, in the guest's language (their
preferred_language), from the property's name with replies going to the
host. The host can switch each off or write it in their own words.

Stored on the property as `guest_messages`, written only by its own
endpoint: PUT /properties/{id} replaces the whole document, and settings
kept there would be wiped by any older client saving the listing.
"""
from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from routes.deps import db, logger, verify_token

router = APIRouter()
IL = ZoneInfo("Asia/Jerusalem")
LOOP_SECONDS = 900
TRIGGERS = ("before", "evening", "checkout")
STAY_TYPES = ("vacation", "short-term")

TEXT = {
    "en": {
        "before": ("Your stay at {property} starts tomorrow",
                   "Hi {name},\n\nWe're looking forward to having you tomorrow at {property}.\n\nAddress: {address}\nCheck-in from {checkin}\n\n{instructions}\n\nIf anything comes up on the way, just reply to this email."),
        "evening": ("How is everything at {property}?",
                    "Hi {name},\n\nWe hope you've settled in well. If anything is missing or not working, reply to this email and we'll sort it out."),
        "checkout": ("Checkout today at {checkout}",
                     "Hi {name},\n\nA reminder that checkout today is at {checkout}. Thank you for staying at {property}, we hope you enjoyed it."),
    },
    "he": {
        "before": ("השהייה שלכם ב{property} מתחילה מחר",
                   "שלום {name},\n\nאנחנו מחכים לכם מחר ב{property}.\n\nכתובת: {address}\nכניסה מהשעה {checkin}\n\n{instructions}\n\nאם משהו משתנה בדרך, אפשר פשוט להשיב למייל הזה."),
        "evening": ("איך הכול ב{property}?",
                    "שלום {name},\n\nמקווים שהתמקמתם טוב. אם משהו חסר או לא עובד, השיבו למייל הזה ונסדר את זה."),
        "checkout": ("יציאה היום בשעה {checkout}",
                     "שלום {name},\n\nתזכורת שהיציאה היום היא בשעה {checkout}. תודה שהתארחתם ב{property}, מקווים שנהניתם."),
    },
}


class MessageIn(BaseModel):
    on: bool = True
    subject: str = Field("", max_length=150)
    text: str = Field("", max_length=3000)


class GuestMessagesIn(BaseModel):
    # What only a guest with a confirmed booking should see: the key box,
    # the door code, parking, Wi-Fi. Goes in the day-before message.
    instructions: str = Field("", max_length=3000)
    before: MessageIn = Field(default_factory=MessageIn)
    evening: MessageIn = Field(default_factory=MessageIn)
    checkout: MessageIn = Field(default_factory=MessageIn)


def settings_of(prop: dict[str, Any]) -> dict[str, Any]:
    s = prop.get("guest_messages") or {}
    out: dict[str, Any] = {"instructions": s.get("instructions") or ""}
    for t in TRIGGERS:
        out[t] = {**MessageIn().model_dump(), **(s.get(t) or {})}
    return out


async def _own_property(property_id: str, user: dict[str, Any]) -> dict[str, Any]:
    prop = await db.properties.find_one({"id": property_id})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    if prop.get("owner_id") != user.get("user_id") and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not your property")
    return prop


@router.get("/properties/{property_id}/guest-messages")
async def get_guest_messages(property_id: str, lang: str = "en", user=Depends(verify_token)):
    prop = await _own_property(property_id, user)
    out = settings_of(prop)
    tx = TEXT["he" if lang == "he" else "en"]
    for t in TRIGGERS:
        out[t]["default_subject"], out[t]["default_text"] = tx[t]
    out["is_stay"] = prop.get("rental_type") in STAY_TYPES
    return out


@router.put("/properties/{property_id}/guest-messages")
async def put_guest_messages(property_id: str, body: GuestMessagesIn, user=Depends(verify_token)):
    await _own_property(property_id, user)
    data = body.model_dump()
    data["instructions"] = data["instructions"].strip()
    await db.properties.update_one({"id": property_id}, {"$set": {"guest_messages": data}})
    return await get_guest_messages(property_id, "en", user)


# ---------------------------------------------------------------------------
# sending
# ---------------------------------------------------------------------------

def compose(trigger: str, prop: dict[str, Any], guest: dict[str, Any], lang: str) -> tuple[str, str]:
    st = settings_of(prop)[trigger]
    d_subject, d_text = TEXT[lang][trigger]
    subject = (st.get("subject") or "").strip() or d_subject
    text = (st.get("text") or "").strip() or d_text
    instr = (prop.get("guest_messages") or {}).get("instructions") or ""
    if trigger == "before" and instr and "{instructions}" not in text:
        text = text + "\n\n" + instr
    values = {
        "name": (guest.get("name") or "").split(" ")[0] or ("אורחים יקרים" if lang == "he" else "there"),
        "property": prop.get("title") or "",
        "address": prop.get("address") or prop.get("location") or "",
        "checkin": prop.get("checkin_time") or "15:00",
        "checkout": prop.get("checkout_time") or "11:00",
        "instructions": instr,
    }

    class _Safe(dict):
        def __missing__(self, k):  # an unknown {word} stays as written
            return "{" + k + "}"
    fill = lambda s: s.format_map(_Safe(values))  # noqa: E731
    body = fill(text)
    # A label left with nothing after it ("Address:" on a listing with no
    # address) is dropped, and lines left empty close up.
    body = "\n".join(line for line in body.split("\n") if not line.rstrip().endswith(":"))
    while "\n\n\n" in body:
        body = body.replace("\n\n\n", "\n\n")
    return fill(subject), body.strip()


async def send(trigger: str, booking: dict[str, Any], prop: dict[str, Any], now: datetime) -> bool:
    guest = await db.users.find_one({"id": booking.get("renter_id")}, {"email": 1, "name": 1, "preferred_language": 1}) or {}
    to = (guest.get("email") or "").strip()
    if not to:
        return False
    try:
        await db.guest_message_log.insert_one({"_id": f"{booking['id']}:{trigger}", "booking_id": booking["id"],
                                               "trigger": trigger, "at": now.isoformat()})
    except DuplicateKeyError:
        return False
    lang = "he" if str(guest.get("preferred_language") or "").startswith("he") else "en"
    subject, body = compose(trigger, prop, guest, lang)
    from utils import email as em
    host = await db.users.find_one({"id": prop.get("owner_id")}, {"email": 1}) or {}
    paragraphs = "".join(
        f'<p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px;white-space:pre-line;">{em._esc(p)}</p>'
        for p in body.split("\n\n") if p.strip())
    ok = await em.send_email(to, subject, em._wrap(paragraphs, preheader=subject, lang=lang), tag=f"guest-{trigger}",
                             from_name=(prop.get("title") or None), reply_to=host.get("email"))
    if not ok:
        logger.warning("[guest-messages] send failed booking=%s trigger=%s", booking["id"], trigger)
    return True


def _due(trigger: str, booking: dict[str, Any], prop: dict[str, Any], local: datetime) -> bool:
    today = local.date().isoformat()
    tomorrow = (local.date() + timedelta(days=1)).isoformat()
    start = str(booking.get("start_date") or "")[:10]
    end = str(booking.get("end_date") or "")[:10]
    if trigger == "before":
        return start == tomorrow and 10 <= local.hour < 21
    if trigger == "evening":
        return start == today and 19 <= local.hour < 22
    if trigger == "checkout":
        try:
            h, m = (prop.get("checkout_time") or "11:00").split(":")
            cutoff = int(h) * 60 + int(m)
        except ValueError:
            cutoff = 11 * 60
        return end == today and 8 <= local.hour and local.hour * 60 + local.minute < cutoff
    return False


async def run_once(now: Optional[datetime] = None) -> int:
    now = now or datetime.now(UTC)
    local = now.astimezone(IL)
    days = [(local.date() + timedelta(days=i)).isoformat() for i in (0, 1)]
    sent = 0
    props: dict[str, dict] = {}
    # Dates are stored as "YYYY-MM-DD" (sometimes with a time after it).
    date_or = [{"start_date": {"$regex": f"^{d}"}} for d in days] + [{"end_date": {"$regex": f"^{days[0]}"}}]
    async for b in db.bookings.find({"status": "confirmed", "sublease_id": None, "$or": date_or}):
        pid = b.get("property_id")
        if pid not in props:
            props[pid] = await db.properties.find_one({"id": pid}) or {}
        prop = props[pid]
        if prop.get("rental_type") not in STAY_TYPES:
            continue
        st = settings_of(prop)
        for t in TRIGGERS:
            if st[t]["on"] and _due(t, b, prop, local) and await send(t, b, prop, now):
                sent += 1
    return sent


async def guest_messages_loop() -> None:
    await asyncio.sleep(150)
    while True:
        try:
            n = await run_once()
            if n:
                logger.info("[guest-messages] sent %s", n)
        except Exception as e:  # noqa: BLE001
            logger.warning("[guest-messages] pass failed: %s", e)
        await asyncio.sleep(LOOP_SECONDS)


async def ensure_guest_message_indexes() -> None:
    await db.guest_message_log.create_index("booking_id")
