"""Appointment reminders to customers, and cancel or change from the link
(Tzvi, 16 Oct 2026, from Fresha and Booksy: "appointment reminders to
customers the day before, with a link to cancel or move it").

  * The reminder: an email to the customer a set number of hours before an
    accepted appointment (24 by default), in the language they booked in,
    from the business's name with replies going to the owner. Once per
    appointment (a log with a unique index, as member_messages.py does),
    never between 22:00 and 08:00 Israel time, and only where the customer
    gave an email. The business can switch it off or change the hours in
    the Appointments tab.
  * Cancel: the customer's own status link (the track token, no account)
    can now cancel a pending or accepted appointment before it starts. The
    slot frees at once and the business is told.
  * Change the time: the same link can ask for another time. The new time
    must be within the listing's opening hours, in the future and free;
    the appointment goes back to waiting for the business to accept it, as
    a new request would, with a fresh hold.
"""
from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from routes.deps import db, logger, verify_token
from utils.rate_limit import check_rate

router = APIRouter(prefix="/marketplace", tags=["marketplace"])
IL = ZoneInfo("Asia/Jerusalem")
LOOP_SECONDS = 900
DEFAULTS = {"on": True, "hours": 24}
_DAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")

TEXT = {
    "en": {
        "subject": "Reminder: {service}, {when}",
        "head": "See you {when}",
        "body": "This is a reminder of your appointment for <b>{service}</b> with <b>{business}</b> on {date} at {time}.",
        "change": "If you can't make it, please cancel or pick another time, so the slot can go to someone else.",
        "button": "Change or cancel",
        "today": "today", "tomorrow": "tomorrow",
    },
    "he": {
        "subject": "תזכורת: {service}, {when}",
        "head": "נתראה {when}",
        "body": "תזכורת לתור שלך ל<b>{service}</b> אצל <b>{business}</b> ב־{date} בשעה {time}.",
        "change": "אם לא תוכלו להגיע, אפשר לבטל או לבחור שעה אחרת, כדי שהתור יתפנה למישהו אחר.",
        "button": "שינוי או ביטול",
        "today": "היום", "tomorrow": "מחר",
    },
}


def settings_of(biz: dict[str, Any]) -> dict[str, Any]:
    return {**DEFAULTS, **(biz.get("appointment_reminders") or {})}


class ReminderSettingsIn(BaseModel):
    on: bool = True
    hours: int = Field(24, ge=1, le=72)


@router.get("/businesses/{business_id}/appointment-reminders")
async def get_settings(business_id: str, user=Depends(verify_token)):
    from utils.business_access import business_access
    biz = await business_access(db, business_id, user, None)
    return settings_of(biz)


@router.put("/businesses/{business_id}/appointment-reminders")
async def put_settings(business_id: str, body: ReminderSettingsIn, user=Depends(verify_token)):
    from utils.business_access import business_access
    await business_access(db, business_id, user, None)
    await db.businesses.update_one({"_id": business_id}, {"$set": {"appointment_reminders": body.model_dump()}})
    return body.model_dump()


# ---------------------------------------------------------------------------
# the reminder
# ---------------------------------------------------------------------------

def _start(b: dict[str, Any]) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(f"{b['preferred_date']}T{b['time_slot']}").replace(tzinfo=IL)
    except (KeyError, TypeError, ValueError):
        return None


def _date_label(d: datetime, lang: str) -> str:
    if lang == "he":
        days = ["יום שני", "יום שלישי", "יום רביעי", "יום חמישי", "יום שישי", "שבת", "יום ראשון"]
        return f"{days[d.weekday()]} {d.day}.{d.month}"
    return f"{d.strftime('%A')} {d.day} {d.strftime('%B')}"


async def send_reminder(b: dict[str, Any], gig: dict[str, Any], biz: dict[str, Any], now: datetime) -> bool:
    """Email one reminder, once. True if this call sent it."""
    to = (b.get("contact_email") or "").strip()
    start = _start(b)
    if not to or not start or not b.get("track_token"):
        return False
    try:
        await db.appointment_reminder_log.insert_one({"_id": b["_id"], "at": now.isoformat()})
    except DuplicateKeyError:
        return False
    lang = "he" if b.get("lang") == "he" else "en"
    tx = TEXT[lang]
    from utils import email as em
    from .orders import _frontend_url, _subject
    service = (gig.get("title_he") if lang == "he" and gig.get("title_he") else gig.get("title")) or ""
    business = (biz.get("name_he") if lang == "he" and biz.get("name_he") else biz.get("name")) or ""
    when = tx["today"] if start.date() == now.astimezone(IL).date() else (
        tx["tomorrow"] if start.date() == now.astimezone(IL).date() + timedelta(days=1) else _date_label(start, lang))
    date_s = start.strftime("%d.%m.%Y")
    time_s = start.strftime("%H:%M")
    link = f"{_frontend_url()}/bookings/track/{b['track_token']}"
    inner = (
        f'<h2 style="color:#222;font-size:22px;margin:0 0 8px;">{em._esc(tx["head"].format(when=when))}</h2>'
        f'<p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 10px;">'
        + tx["body"].format(service=em._esc(service), business=em._esc(business), date=date_s, time=time_s) + "</p>"
        f'<p style="color:#555;font-size:14px;line-height:1.7;margin:0 0 18px;">{em._esc(tx["change"])}</p>'
        + em._button(tx["button"], link)
    )
    owner = await db.users.find_one({"id": biz.get("owner_user_id")}, {"email": 1}) or {}
    subject = _subject(tx["subject"].format(service=service, when=when))
    ok = await em.send_email(to, subject, em._wrap(inner, preheader=subject, lang=lang), tag="appointment-reminder",
                             from_name=business or None, reply_to=owner.get("email"))
    if not ok:
        logger.warning("[appointment-reminders] send failed booking=%s", b["_id"])
    return True


async def run_once(now: Optional[datetime] = None) -> int:
    """Reminders due now: accepted appointments starting within each
    business's window and not yet reminded. Quiet hours wait."""
    now = now or datetime.now(UTC)
    local = now.astimezone(IL)
    if not (8 <= local.hour < 22):
        return 0
    horizon = local + timedelta(hours=72)
    dates = sorted({(local + timedelta(days=i)).date().isoformat() for i in range((horizon.date() - local.date()).days + 1)})
    sent = 0
    gigs: dict[str, dict] = {}
    bizes: dict[str, dict] = {}
    async for b in db.marketplace_bookings.find({"status": "accepted", "preferred_date": {"$in": dates},
                                                 "contact_email": {"$nin": [None, ""]}}):
        start = _start(b)
        if not start or start <= local:
            continue
        gid = b.get("gig_id")
        if gid not in gigs:
            gigs[gid] = await db.marketplace_gigs.find_one({"_id": gid}, {"title": 1, "title_he": 1, "business_id": 1}) or {}
        gig = gigs[gid]
        bid = gig.get("business_id")
        if bid not in bizes:
            bizes[bid] = await db.businesses.find_one({"_id": bid}) or {} if bid else {}
        biz = bizes[bid]
        st = settings_of(biz)
        if not st["on"] or start - local > timedelta(hours=int(st["hours"])):
            continue
        if await send_reminder(b, gig, biz, now):
            sent += 1
    return sent


async def appointment_reminders_loop() -> None:
    await asyncio.sleep(120)
    while True:
        try:
            n = await run_once()
            if n:
                logger.info("[appointment-reminders] sent %s", n)
        except Exception as e:  # noqa: BLE001 - one bad pass must not end the loop
            logger.warning("[appointment-reminders] pass failed: %s", e)
        await asyncio.sleep(LOOP_SECONDS)


async def ensure_appointment_reminder_indexes() -> None:
    # `_id` is the booking id, so the log is unique by construction; the
    # index on `at` lets old rows be cleared if it ever grows.
    await db.appointment_reminder_log.create_index("at")


# ---------------------------------------------------------------------------
# cancel or change, from the customer's own link
# ---------------------------------------------------------------------------

async def _by_token(token: str, request: Request) -> dict[str, Any]:
    check_rate(request, bucket="bookings_track_change", limit=30, window_seconds=600)
    if not token or len(token) < 16:
        raise HTTPException(status_code=404, detail="This link is not valid")
    b = await db.marketplace_bookings.find_one({"track_token": token})
    if not b:
        raise HTTPException(status_code=404, detail="This link is not valid")
    if b.get("status") not in ("pending", "accepted"):
        raise HTTPException(status_code=409, detail="This booking can no longer be changed")
    start = _start(b)
    if start and start <= datetime.now(IL):
        raise HTTPException(status_code=409, detail="This appointment has already started")
    return b


@router.post("/bookings/track/{token}/cancel")
async def customer_cancel(token: str, request: Request):
    b = await _by_token(token, request)
    now = datetime.now(UTC).isoformat()
    r = await db.marketplace_bookings.update_one(
        {"_id": b["_id"], "status": b["status"]},
        {"$set": {"status": "cancelled", "cancelled_by": "customer", "updated_at": now, "cancelled_at": now}})
    if not r.modified_count:
        raise HTTPException(status_code=409, detail="This booking was just changed. Refresh to see it.")
    from .gigs import _notify
    gig = await db.marketplace_gigs.find_one({"_id": b.get("gig_id")}) or {}
    who = b.get("guest_name") or "A customer"
    await _notify(b.get("provider_user_id"), "booking_cancelled",
                  f"{who} cancelled {gig.get('title') or 'an appointment'} on {b.get('preferred_date')} at {b.get('time_slot')}.", b["_id"])
    from routes.marketplace.automations import fire_in_background
    fire_in_background("appointment.cancelled", {"booking": {**b, "status": "cancelled"}, "gig": gig})
    from .appointment_extras import on_slot_freed
    await on_slot_freed(b.get("gig_id"), b.get("preferred_date"), b.get("staff_id"))
    return {"ok": True, "status": "cancelled"}


class MoveIn(BaseModel):
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(..., pattern=r"^\d{2}:\d{2}$")


def _within_hours(gig: dict[str, Any], start: datetime, minutes: int) -> bool:
    """Inside one of the listing's opening windows for that weekday. A
    listing with no weekly hours set takes any time, as booking does."""
    weekly = gig.get("weekly_availability") or {}
    if not any(weekly.values()):
        return True
    from .gigs import _minutes
    s = start.hour * 60 + start.minute
    for w in weekly.get(_DAYS[start.weekday()]) or []:
        a, z = _minutes(w.get("start")), _minutes(w.get("end"))
        if a is not None and z is not None and a <= s and s + minutes <= z:
            return True
    return False


@router.post("/bookings/track/{token}/move")
async def customer_move(token: str, body: MoveIn, request: Request):
    b = await _by_token(token, request)
    gig = await db.marketplace_gigs.find_one({"_id": b.get("gig_id")}) or {}
    try:
        start = datetime.fromisoformat(f"{body.date}T{body.time}").replace(tzinfo=IL)
    except ValueError:
        raise HTTPException(status_code=400, detail="Pick a real date and time") from None
    if start <= datetime.now(IL):
        raise HTTPException(status_code=400, detail="That time has passed - please pick a later one.")
    duration = int(b.get("duration_minutes") or gig.get("slot_duration_minutes") or 30)
    if not _within_hours(gig, start, duration):
        raise HTTPException(status_code=400, detail="That time is outside the business's hours")
    from .gigs import _busy_spans, _hold_hours, _minutes, _notify, _overlaps
    # With a team, the same person's calendar (TeamMember).
    if gig.get("team"):
        taken = (await _busy_spans(b["gig_id"], gig.get("provider_user_id"), body.date, b.get("staff_id"))).get(body.date, [])
    else:
        taken = (await _busy_spans(b["gig_id"], gig.get("provider_user_id"), body.date)).get(body.date, [])
    # Its own current slot does not count against it.
    own = _minutes(b.get("time_slot"))
    if b.get("preferred_date") == body.date and own is not None:
        taken = [s for s in taken if s != (own, own + duration)]
    s = _minutes(body.time)
    if _overlaps(s, s + duration, taken):
        raise HTTPException(status_code=409, detail="That time has just been taken - please pick another.")
    now = datetime.now(UTC)
    hold = await _hold_hours(gig.get("provider_user_id"))
    try:
        r = await db.marketplace_bookings.update_one(
            {"_id": b["_id"], "status": b["status"]},
            {"$set": {"preferred_date": body.date, "time_slot": body.time, "status": "pending",
                      "hold_expires_at": (now + timedelta(hours=hold)).isoformat(), "hold_hours": hold,
                      "updated_at": now.isoformat(), "moved_from": {"date": b.get("preferred_date"), "time": b.get("time_slot")}},
             "$unset": {"hold_nudged_at": ""}})
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="That time has just been taken - please pick another.") from None
    if not r.modified_count:
        raise HTTPException(status_code=409, detail="This booking was just changed. Refresh to see it.")
    # A new time means a new reminder, and the old time is free again.
    await db.appointment_reminder_log.delete_one({"_id": b["_id"]})
    from .appointment_extras import on_slot_freed
    await on_slot_freed(b.get("gig_id"), b.get("preferred_date"), b.get("staff_id"))
    who = b.get("guest_name") or "A customer"
    await _notify(b.get("provider_user_id"), "booking_request",
                  f"{who} asked to move {gig.get('title') or 'an appointment'} to {body.date} at {body.time}. Accept or decline the new time.",
                  b["_id"])
    return {"ok": True, "status": "pending", "preferred_date": body.date, "time_slot": body.time}
