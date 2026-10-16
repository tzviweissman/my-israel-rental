"""Tours and workshops: dates with a limited number of places (Tzvi,
16 Oct 2026, from Eventbrite: "a date, a time and a number of places;
people reserve, it closes when full, with a waiting list").

A listing (any kind but a shop) can carry `sessions`: [{id, date, time,
places, note}]. The listing page shows the coming ones with the places
left, and anyone reserves without an account:

  * Places are counted in one document per session (`session_seats`) with
    a conditional update, so two people taking the last place at once
    cannot both get it.
  * Each reservation has its own link (`track_token`) to see it and to
    cancel, which gives the places back and tells the waiting list.
  * A full date takes a waiting list: when places free up, everyone
    waiting is emailed once.
  * The day before, everyone reserved gets a reminder with the cancel link.
  * The business sees who is coming, per date, in Appointments.
"""
from __future__ import annotations

import asyncio
import re
import secrets
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any, Literal, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from routes.deps import db, logger, verify_token
from utils.rate_limit import check_rate

router = APIRouter(prefix="/marketplace", tags=["marketplace"])
IL = ZoneInfo("Asia/Jerusalem")
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
LOOP_SECONDS = 900


def _now_il() -> datetime:
    return datetime.now(IL)


def _start(s: dict[str, Any]) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(f"{s['date']}T{s.get('time') or '00:00'}").replace(tzinfo=IL)
    except (KeyError, ValueError):
        return None


async def _taken(gig_id: str, sids: list[str]) -> dict[str, int]:
    return {d["_id"].split(":", 1)[1]: int(d.get("taken", 0))
            async for d in db.session_seats.find({"_id": {"$in": [f"{gig_id}:{s}" for s in sids]}})}


@router.get("/gigs/{gig_id}/sessions")
async def public_sessions(gig_id: str):
    """The coming dates with the places left. Nothing about who is coming."""
    gig = await db.marketplace_gigs.find_one({"_id": gig_id}, {"sessions": 1, "status": 1})
    if not gig or gig.get("status", "published") != "published":
        raise HTTPException(status_code=404, detail="Not found")
    now = _now_il()
    coming = [s for s in gig.get("sessions") or [] if (_start(s) or now) > now]
    taken = await _taken(gig_id, [s["id"] for s in coming])
    coming.sort(key=lambda s: (s["date"], s.get("time") or ""))
    return [{"id": s["id"], "date": s["date"], "time": s.get("time"), "note": s.get("note") or "",
             "places": int(s["places"]), "left": max(0, int(s["places"]) - taken.get(s["id"], 0))} for s in coming]


class ReserveIn(BaseModel):
    seats: int = Field(1, ge=1, le=20)
    name: str = Field(..., min_length=2, max_length=80)
    phone: Optional[str] = Field(None, max_length=40)
    email: Optional[str] = Field(None, max_length=200)
    lang: Optional[Literal["en", "he"]] = None


async def _session(gig_id: str, sid: str) -> tuple[dict[str, Any], dict[str, Any]]:
    gig = await db.marketplace_gigs.find_one({"_id": gig_id})
    if not gig or gig.get("status", "published") != "published":
        raise HTTPException(status_code=404, detail="Not found")
    s = next((x for x in gig.get("sessions") or [] if x.get("id") == sid), None)
    if not s:
        raise HTTPException(status_code=404, detail="This date is no longer offered")
    return gig, s


@router.post("/gigs/{gig_id}/sessions/{sid}/reserve")
async def reserve(gig_id: str, sid: str, body: ReserveIn, request: Request):
    check_rate(request, bucket="session_reserve", limit=10, window_seconds=3600)
    email = (body.email or "").strip().lower() or None
    phone = (body.phone or "").strip() or None
    if not (email or phone):
        raise HTTPException(status_code=400, detail="Please add an email or a phone number so the business can reach you")
    if email and not _EMAIL.match(email):
        raise HTTPException(status_code=400, detail="Please check the email address")
    gig, s = await _session(gig_id, sid)
    start = _start(s)
    if not start or start <= _now_il():
        raise HTTPException(status_code=409, detail="This date has passed")
    places = int(s["places"])
    if body.seats > places:
        raise HTTPException(status_code=400, detail=f"There are only {places} places")
    # Take the places in one step: only if enough are left.
    key = f"{gig_id}:{sid}"
    await db.session_seats.update_one({"_id": key}, {"$setOnInsert": {"taken": 0}}, upsert=True)
    got = await db.session_seats.find_one_and_update(
        {"_id": key, "taken": {"$lte": places - body.seats}}, {"$inc": {"taken": body.seats}},
        return_document=ReturnDocument.AFTER)
    if not got:
        left = max(0, places - int((await db.session_seats.find_one({"_id": key}) or {}).get("taken", 0)))
        raise HTTPException(status_code=409, detail=(f"Only {left} places left" if left else "This date is full"))
    now = datetime.now(UTC).isoformat()
    r = {"_id": str(uuid.uuid4()), "gig_id": gig_id, "session_id": sid, "session_date": s["date"], "session_time": s.get("time"),
         "business_id": gig.get("business_id"), "provider_user_id": gig.get("provider_user_id"),
         "seats": body.seats, "name": body.name.strip(), "phone": phone, "email": email, "lang": body.lang or "en",
         "status": "reserved", "track_token": secrets.token_urlsafe(16), "created_at": now}
    await db.session_reservations.insert_one(r)
    from .gigs import _notify
    await _notify(gig.get("provider_user_id"), "session_reserved",
                  f"{r['name']} reserved {body.seats} place(s) for {gig.get('title') or 'your date'} on {s['date']} {s.get('time') or ''}.", r["_id"])
    await _email_customer(r, gig, "reserved")
    logger.info("[sessions] reserved gig=%s session=%s seats=%s", gig_id, sid, body.seats)
    return {"ok": True, "track_path": f"/reservations/{r['track_token']}", "left": places - int(got["taken"])}


async def _email_customer(r: dict[str, Any], gig: dict[str, Any], event: str) -> None:
    if not r.get("email"):
        return
    from utils import email as em
    from .orders import _frontend_url, _subject
    he = r.get("lang") == "he"
    biz = await db.businesses.find_one({"_id": gig.get("business_id")}, {"name": 1, "name_he": 1}) or {}
    business = (biz.get("name_he") if he and biz.get("name_he") else biz.get("name")) or ""
    title = (gig.get("title_he") if he and gig.get("title_he") else gig.get("title")) or ""
    when = f"{date.fromisoformat(r['session_date']).strftime('%d.%m.%Y')} {r.get('session_time') or ''}".strip()
    texts = {
        "reserved": (f"השמירה נקלטה: {title}", f"שמרנו לך {r['seats']} מקומות ל<b>{em._esc(title)}</b> ב־{when}.")
        if he else (f"You're booked: {title}", f"We saved you {r['seats']} place(s) for <b>{em._esc(title)}</b> on {when}."),
        "reminder": (f"מחר: {title}", f"תזכורת: <b>{em._esc(title)}</b> מחר, {when}. אם לא תוכלו להגיע, בטלו כדי שהמקום יתפנה.")
        if he else (f"Tomorrow: {title}", f"A reminder: <b>{em._esc(title)}</b> is tomorrow, {when}. If you can't come, please cancel so the place can go to someone else."),
    }
    head, line = texts[event]
    link = f"{_frontend_url()}/reservations/{r['track_token']}"
    inner = (f'<h2 style="color:#222;font-size:22px;margin:0 0 8px;">{em._esc(head)}</h2>'
             f'<p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 18px;">{line}</p>'
             + em._button("להזמנה שלך" if he else "Your reservation", link))
    owner = await db.users.find_one({"id": gig.get("provider_user_id")}, {"email": 1}) or {}
    await em.send_email(r["email"], _subject(head), em._wrap(inner, preheader=head, lang="he" if he else "en"),
                        tag=f"session-{event}", from_name=business or None, reply_to=owner.get("email"))


async def _by_token(token: str, request: Request) -> dict[str, Any]:
    check_rate(request, bucket="reservation_track", limit=120, window_seconds=600)
    if not token or len(token) < 16:
        raise HTTPException(status_code=404, detail="This link is not valid")
    r = await db.session_reservations.find_one({"track_token": token})
    if not r:
        raise HTTPException(status_code=404, detail="This link is not valid")
    return r


@router.get("/reservations/{token}")
async def track_reservation(token: str, request: Request):
    r = await _by_token(token, request)
    gig = await db.marketplace_gigs.find_one({"_id": r["gig_id"]}, {"title": 1, "title_he": 1, "business_id": 1}) or {}
    biz = await db.businesses.find_one({"_id": gig.get("business_id")}, {"name": 1, "name_he": 1, "slug": 1, "logo_url": 1}) or {}
    start = _start({"date": r["session_date"], "time": r.get("session_time")})
    return {"business": {"name": biz.get("name") or "", "name_he": biz.get("name_he"), "slug": biz.get("slug"), "logo_url": biz.get("logo_url")},
            "gig_id": r["gig_id"], "gig_title": gig.get("title") or "", "gig_title_he": gig.get("title_he"),
            "date": r["session_date"], "time": r.get("session_time"), "seats": r["seats"], "status": r["status"],
            "can_cancel": r["status"] == "reserved" and bool(start and start > _now_il())}


@router.post("/reservations/{token}/cancel")
async def cancel_reservation(token: str, request: Request):
    r = await _by_token(token, request)
    start = _start({"date": r["session_date"], "time": r.get("session_time")})
    if r["status"] != "reserved" or not start or start <= _now_il():
        raise HTTPException(status_code=409, detail="This reservation can no longer be cancelled")
    res = await db.session_reservations.update_one({"_id": r["_id"], "status": "reserved"},
                                                   {"$set": {"status": "cancelled", "cancelled_at": datetime.now(UTC).isoformat()}})
    if not res.modified_count:
        raise HTTPException(status_code=409, detail="This reservation was just changed. Refresh to see it.")
    await db.session_seats.update_one({"_id": f"{r['gig_id']}:{r['session_id']}"}, {"$inc": {"taken": -int(r["seats"])}})
    from .gigs import _notify
    await _notify(r.get("provider_user_id"), "session_cancelled",
                  f"{r['name']} cancelled {r['seats']} place(s) on {r['session_date']}.", r["_id"])
    await _tell_waiting(r["gig_id"], r["session_id"])
    return {"ok": True, "status": "cancelled"}


# ---------------------------------------------------------------------------
# waiting list for a full date
# ---------------------------------------------------------------------------

class WaitIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    email: str = Field(..., max_length=200)
    lang: Optional[Literal["en", "he"]] = None


@router.post("/gigs/{gig_id}/sessions/{sid}/waitlist")
async def session_waitlist(gig_id: str, sid: str, body: WaitIn, request: Request):
    check_rate(request, bucket="session_waitlist", limit=10, window_seconds=3600)
    email = body.email.strip().lower()
    if not _EMAIL.match(email):
        raise HTTPException(status_code=400, detail="Please check the email address")
    await _session(gig_id, sid)
    await db.session_waitlist.update_one(
        {"gig_id": gig_id, "session_id": sid, "email": email},
        {"$set": {"name": body.name.strip(), "lang": body.lang or "en"},
         "$setOnInsert": {"_id": str(uuid.uuid4()), "created_at": datetime.now(UTC).isoformat(), "notified_at": None}},
        upsert=True)
    return {"ok": True}


async def _tell_waiting(gig_id: str, sid: str) -> None:
    try:
        gig = await db.marketplace_gigs.find_one({"_id": gig_id}) or {}
        s = next((x for x in gig.get("sessions") or [] if x.get("id") == sid), None)
        if not s:
            return
        from utils import email as em
        from .orders import _frontend_url, _subject
        async for w in db.session_waitlist.find({"gig_id": gig_id, "session_id": sid, "notified_at": None}).sort("created_at", 1).limit(50):
            done = await db.session_waitlist.update_one({"_id": w["_id"], "notified_at": None},
                                                        {"$set": {"notified_at": datetime.now(UTC).isoformat()}})
            if not done.modified_count:
                continue
            he = w.get("lang") == "he"
            title = (gig.get("title_he") if he and gig.get("title_he") else gig.get("title")) or ""
            head = f"התפנה מקום: {title}" if he else f"A place opened: {title}"
            line = (f"התפנה מקום ל<b>{em._esc(title)}</b> ב־{s['date']} {s.get('time') or ''}. הראשון שמזמין מקבל אותו."
                    if he else f"A place opened for <b>{em._esc(title)}</b> on {s['date']} {s.get('time') or ''}. The first to reserve it gets it.")
            inner = (f'<h2 style="color:#222;font-size:22px;margin:0 0 8px;">{em._esc(head)}</h2>'
                     f'<p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 18px;">{line}</p>'
                     + em._button("להזמנת מקום" if he else "Reserve it", f"{_frontend_url()}/businesses/{gig_id}"))
            await em.send_email(w["email"], _subject(head), em._wrap(inner, preheader=head, lang="he" if he else "en"), tag="session-waitlist")
    except Exception:  # noqa: BLE001
        logger.exception("[sessions] could not tell the waiting list gig=%s session=%s", gig_id, sid)


# ---------------------------------------------------------------------------
# the business's side
# ---------------------------------------------------------------------------

@router.get("/session-reservations")
async def my_sessions(user=Depends(verify_token)):
    """Coming dates across the owner's listings, with who is coming."""
    today = _now_il().date().isoformat()
    out = []
    async for g in db.marketplace_gigs.find({"provider_user_id": user["user_id"], "sessions.0": {"$exists": True}},
                                            {"title": 1, "sessions": 1}):
        coming = [s for s in g.get("sessions") or [] if s.get("date", "") >= today]
        if not coming:
            continue
        taken = await _taken(g["_id"], [s["id"] for s in coming])
        res: dict[str, list] = {}
        async for r in db.session_reservations.find({"gig_id": g["_id"], "status": "reserved", "session_date": {"$gte": today}}).sort("created_at", 1):
            res.setdefault(r["session_id"], []).append({"name": r["name"], "seats": r["seats"], "phone": r.get("phone"), "email": r.get("email")})
        for s in sorted(coming, key=lambda x: (x["date"], x.get("time") or "")):
            out.append({"gig_id": g["_id"], "gig_title": g.get("title") or "", "id": s["id"], "date": s["date"], "time": s.get("time"),
                        "places": int(s["places"]), "taken": taken.get(s["id"], 0), "people": res.get(s["id"], [])})
    return out


# ---------------------------------------------------------------------------
# the day-before reminder
# ---------------------------------------------------------------------------

async def run_reminders_once(now: Optional[datetime] = None) -> int:
    now = now or datetime.now(UTC)
    local = now.astimezone(IL)
    if not (10 <= local.hour < 21):
        return 0
    tomorrow = (local.date() + timedelta(days=1)).isoformat()
    sent = 0
    gigs: dict[str, dict] = {}
    async for r in db.session_reservations.find({"status": "reserved", "session_date": tomorrow, "email": {"$nin": [None, ""]}}):
        try:
            await db.session_reminder_log.insert_one({"_id": r["_id"], "at": now.isoformat()})
        except DuplicateKeyError:
            continue
        if r["gig_id"] not in gigs:
            gigs[r["gig_id"]] = await db.marketplace_gigs.find_one({"_id": r["gig_id"]}) or {}
        await _email_customer(r, gigs[r["gig_id"]], "reminder")
        sent += 1
    return sent


async def session_reminders_loop() -> None:
    await asyncio.sleep(200)
    while True:
        try:
            n = await run_reminders_once()
            if n:
                logger.info("[sessions] reminders sent %s", n)
        except Exception as e:  # noqa: BLE001
            logger.warning("[sessions] reminder pass failed: %s", e)
        await asyncio.sleep(LOOP_SECONDS)


async def ensure_session_indexes() -> None:
    await db.session_reservations.create_index("track_token", unique=True)
    await db.session_reservations.create_index([("gig_id", 1), ("session_id", 1), ("status", 1)])
    await db.session_reservations.create_index([("status", 1), ("session_date", 1)])
    await db.session_waitlist.create_index([("gig_id", 1), ("session_id", 1), ("email", 1)], unique=True)
