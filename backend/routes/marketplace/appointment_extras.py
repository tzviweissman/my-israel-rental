"""The waiting list and "time to book again" for appointments (Tzvi,
16 Oct 2026, from Fresha and Booksy).

Waiting list: a customer who finds no time that suits them on a day leaves
a name and an email for that day (and, with a team, optionally for one
person). When a time on that day frees up (a customer cancels or moves,
the business declines or cancels, or an unanswered request lapses),
everyone waiting for that day is emailed a link back to the listing. Each
entry is told once; first come, first served from there.

Book again: an appointment listing can say "suggest booking again after N
weeks" (`rebook_after_weeks`). Once an appointment the business marked done
is that old, and the customer has booked nothing with the listing since,
they get one email inviting them back, with an unsubscribe link (the same
per-business list customer_messages.py keeps), during the day only.
"""
from __future__ import annotations

import asyncio
import html
import re
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from routes.deps import db, logger
from utils.rate_limit import check_rate

router = APIRouter(prefix="/marketplace", tags=["marketplace"])
IL = ZoneInfo("Asia/Jerusalem")
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
LOOP_SECONDS = 3600


def _today() -> date:
    return datetime.now(IL).date()


# ---------------------------------------------------------------------------
# waiting list
# ---------------------------------------------------------------------------

class WaitIn(BaseModel):
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    name: str = Field(..., min_length=2, max_length=80)
    email: str = Field(..., max_length=200)
    lang: Optional[str] = Field(None, pattern="^(en|he)$")
    staff_id: Optional[str] = Field(None, max_length=32)


@router.post("/gigs/{gig_id}/waitlist")
async def join_waitlist(gig_id: str, body: WaitIn, request: Request):
    check_rate(request, bucket="appointment_waitlist", limit=10, window_seconds=3600)
    email = body.email.strip().lower()
    if not _EMAIL.match(email):
        raise HTTPException(status_code=400, detail="Please check the email address")
    gig = await db.marketplace_gigs.find_one({"_id": gig_id}, {"gig_type": 1, "status": 1, "team": 1})
    if not gig or gig.get("gig_type") != "appointment" or gig.get("status", "published") != "published":
        raise HTTPException(status_code=404, detail="This listing is not taking bookings")
    if body.date < _today().isoformat() or body.date > (_today() + timedelta(days=120)).isoformat():
        raise HTTPException(status_code=400, detail="Pick a day in the coming months")
    staff = body.staff_id if body.staff_id and any(m.get("id") == body.staff_id for m in gig.get("team") or []) else None
    await db.appointment_waitlist.update_one(
        {"gig_id": gig_id, "date": body.date, "email": email, "staff_id": staff},
        {"$set": {"name": body.name.strip(), "lang": body.lang or "en"},
         "$setOnInsert": {"_id": str(uuid.uuid4()), "created_at": datetime.now(UTC).isoformat(), "notified_at": None}},
        upsert=True)
    return {"ok": True}


async def on_slot_freed(gig_id: Optional[str], day: Optional[str], staff_id: Optional[str] = None) -> int:
    """A time on `day` is free again: tell everyone waiting for it, once.
    Never raises: the cancellation that called it has already happened."""
    if not gig_id or not day or day < _today().isoformat():
        return 0
    try:
        gig = await db.marketplace_gigs.find_one({"_id": gig_id}, {"title": 1, "title_he": 1, "business_id": 1}) or {}
        biz = await db.businesses.find_one({"_id": gig.get("business_id")}, {"name": 1, "name_he": 1, "owner_user_id": 1}) or {}
        q: dict[str, Any] = {"gig_id": gig_id, "date": day, "notified_at": None}
        # Waiting for someone else on the team: their time did not free.
        q["staff_id"] = {"$in": [None, staff_id]} if staff_id else None
        sent = 0
        async for w in db.appointment_waitlist.find(q).sort("created_at", 1).limit(50):
            r = await db.appointment_waitlist.update_one({"_id": w["_id"], "notified_at": None},
                                                         {"$set": {"notified_at": datetime.now(UTC).isoformat()}})
            if r.modified_count:
                await _email_waiter(w, gig, biz)
                sent += 1
        return sent
    except Exception:  # noqa: BLE001
        logger.exception("[waitlist] could not tell the waiting list gig=%s day=%s", gig_id, day)
        return 0


async def _email_waiter(w: dict[str, Any], gig: dict[str, Any], biz: dict[str, Any]) -> None:
    from utils import email as em
    from .orders import _frontend_url, _subject
    he = w.get("lang") == "he"
    service = (gig.get("title_he") if he and gig.get("title_he") else gig.get("title")) or ""
    business = (biz.get("name_he") if he and biz.get("name_he") else biz.get("name")) or ""
    d = date.fromisoformat(w["date"]).strftime("%d.%m.%Y")
    head = f"התפנה תור ב־{d}" if he else f"A time opened on {d}"
    line = (f"שלום {w.get('name')}, התפנה תור ל<b>{em._esc(service)}</b> אצל <b>{em._esc(business)}</b> ביום שרצית. "
            "הראשון שקובע מקבל אותו." if he else
            f"Hi {em._esc(w.get('name'))}, a time has opened for <b>{em._esc(service)}</b> with <b>{em._esc(business)}</b> "
            "on the day you wanted. The first to book it gets it.")
    link = f"{_frontend_url()}/businesses/{gig.get('_id')}?date={w['date']}"
    inner = (f'<h2 style="color:#222;font-size:22px;margin:0 0 8px;">{em._esc(head)}</h2>'
             f'<p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 18px;">{line}</p>'
             + em._button("לקביעת התור" if he else "Book it", link))
    owner = await db.users.find_one({"id": biz.get("owner_user_id")}, {"email": 1}) or {}
    await em.send_email(w["email"], _subject(head), em._wrap(inner, preheader=head, lang="he" if he else "en"),
                        tag="appointment-waitlist", from_name=business or None, reply_to=owner.get("email"))


async def ensure_waitlist_indexes() -> None:
    await db.appointment_waitlist.create_index([("gig_id", 1), ("date", 1), ("email", 1), ("staff_id", 1)], unique=True)
    await db.appointment_waitlist.create_index([("gig_id", 1), ("date", 1), ("notified_at", 1)])
    await db.rebook_log.create_index("at")


# ---------------------------------------------------------------------------
# time to book again
# ---------------------------------------------------------------------------

async def run_rebook_once(now: Optional[datetime] = None) -> int:
    now = now or datetime.now(UTC)
    local = now.astimezone(IL)
    if not (10 <= local.hour < 20):
        return 0
    sent = 0
    async for gig in db.marketplace_gigs.find({"rebook_after_weeks": {"$gte": 1}, "status": "published"},
                                              {"title": 1, "title_he": 1, "business_id": 1, "rebook_after_weeks": 1}):
        weeks = int(gig["rebook_after_weeks"])
        due_to = (local.date() - timedelta(weeks=weeks)).isoformat()
        # Appointments that became due in the last week: one that came due
        # long ago, before the setting was switched on, is not chased.
        due_from = (local.date() - timedelta(weeks=weeks, days=7)).isoformat()
        biz = await db.businesses.find_one({"_id": gig.get("business_id")}) or {}
        if not biz:
            continue
        async for b in db.marketplace_bookings.find({"gig_id": gig["_id"], "status": "completed", "no_show": {"$ne": True},
                                                     "preferred_date": {"$gte": due_from, "$lte": due_to},
                                                     "contact_email": {"$nin": [None, ""]}}):
            email = b["contact_email"].strip().lower()
            later = await db.marketplace_bookings.find_one({
                "gig_id": gig["_id"], "contact_email": {"$regex": f"^{re.escape(email)}$", "$options": "i"},
                "preferred_date": {"$gt": b.get("preferred_date") or ""},
                "status": {"$in": ["pending", "accepted", "completed"]}}, {"_id": 1})
            if later:
                continue
            if await db.message_unsubscribes.find_one({"business_id": biz["_id"], "email": email}, {"_id": 1}):
                continue
            try:
                await db.rebook_log.insert_one({"_id": b["_id"], "at": now.isoformat()})
            except DuplicateKeyError:
                continue
            await _email_rebook(b, gig, biz, email)
            sent += 1
    return sent


async def _email_rebook(b: dict[str, Any], gig: dict[str, Any], biz: dict[str, Any], email: str) -> None:
    from utils.email import send_email
    from .customer_messages import unsubscribe_url
    from .orders import _frontend_url, _subject
    he = b.get("lang") == "he"
    service = (gig.get("title_he") if he and gig.get("title_he") else gig.get("title")) or ""
    business = (biz.get("name_he") if he and biz.get("name_he") else biz.get("name")) or ""
    name = (b.get("guest_name") or "").split(" ")[0]
    subject = f"הגיע הזמן ל{service}?" if he else f"Time for your next {service}?"
    body = (f"שלום {name},\n\nעברו כמה שבועות מאז הביקור האחרון שלך אצל {business}. אם הגיע הזמן לפעם הבאה, אפשר לקבוע כאן."
            if he else
            f"Hi {name or 'there'},\n\nIt's been a few weeks since your last visit to {business}. If it's time for the next one, you can book here.")
    unsub = unsubscribe_url(biz["_id"], email)
    link = f"{_frontend_url()}/businesses/{gig['_id']}"
    d, side = ("rtl", "right") if he else ("ltr", "left")
    page = f"""<!DOCTYPE html><html lang="{'he' if he else 'en'}" dir="{d}"><head><meta charset="UTF-8"></head>
<body dir="{d}" style="margin:0;background:#F9FAFB;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #E3E3E3;border-radius:14px;">
<tr><td style="padding:24px 28px 6px;text-align:{side};font-size:17px;font-weight:700;">{html.escape(business)}</td></tr>
<tr><td style="padding:6px 28px 20px;text-align:{side};font-size:15px;line-height:1.65;">{html.escape(body).replace(chr(10), '<br>')}</td></tr>
<tr><td style="padding:0 28px 24px;text-align:{side};"><a href="{html.escape(link)}" style="background:#000;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">{"לקביעת תור" if he else "Book a time"}</a></td></tr>
<tr><td style="padding:14px 28px;border-top:1px solid #E3E3E3;text-align:center;font-size:12px;color:#666;"><a href="{html.escape(unsub)}" style="color:#666;">{"להסרה מרשימת התפוצה" if he else "Unsubscribe"}</a></td></tr>
</table></td></tr></table></body></html>"""
    owner = await db.users.find_one({"id": biz.get("owner_user_id")}, {"email": 1}) or {}
    await send_email(email, _subject(subject), page, tag="appointment-rebook", message_stream="broadcast",
                     from_name=business or None, reply_to=owner.get("email"),
                     headers={"List-Unsubscribe": f"<{unsub.replace('/unsubscribe/', '/api/marketplace/messages/unsubscribe/')}>",
                              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"})


async def rebook_loop() -> None:
    await asyncio.sleep(180)
    while True:
        try:
            n = await run_rebook_once()
            if n:
                logger.info("[rebook] sent %s", n)
        except Exception as e:  # noqa: BLE001
            logger.warning("[rebook] pass failed: %s", e)
        await asyncio.sleep(LOOP_SECONDS)
