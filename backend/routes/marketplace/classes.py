"""Class timetable and booking (Tzvi, 15 Oct 2026: "start with the class
timetable"). What makes a gym or studio run here day to day.

  * The weekly timetable (class_templates): "Yoga, Sunday 07:00, 60 min,
    12 places, with Dana". Optionally only for some plans.
  * The classes themselves (class_sessions): made from the timetable for
    the next BOOK_DAYS days, the first time anyone looks. A class can be
    cancelled on its own day without touching the timetable.
  * Bookings (class_bookings): a member books from their membership page
    (memberships.py, the link is the credential, no account). A full class
    takes a waiting list; when someone cancels, the first person waiting
    gets the place and an email. Checking in at the door marks the class
    attended (memberships.py calls mark_attended).

Places are taken atomically (a booked count with a capacity condition),
so two people pressing Book for the last place get one place, not two.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from typing import Any, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from routes.deps import db, logger, verify_token
from utils.business_access import business_access
from utils.rate_limit import check_rate

from .orders import _email, _esc, _frontend_url, _subject

router = APIRouter(prefix="/marketplace", tags=["marketplace"])
IL = ZoneInfo("Asia/Jerusalem")
BOOK_DAYS = 14            # how far ahead members can book
MAX_AHEAD = 10            # bookings one member may hold at a time
ATTEND_BEFORE = timedelta(minutes=60)
ATTEND_AFTER = timedelta(minutes=30)


def _now() -> datetime:
    return datetime.now(IL)


def _iso() -> str:
    return _now().isoformat(timespec="seconds")


def _starts(s: dict[str, Any]) -> datetime:
    return datetime.fromisoformat(f"{s['date']}T{s['start']}").replace(tzinfo=IL)


# ---------------------------------------------------------------------------
# the timetable
# ---------------------------------------------------------------------------

class TemplateIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=80)
    weekday: int = Field(..., ge=0, le=6)                       # 0 = Sunday
    start: str = Field(..., pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    duration_min: int = Field(60, ge=10, le=600)
    capacity: int = Field(..., ge=1, le=500)
    instructor: Optional[str] = Field(None, max_length=80)
    location: Optional[str] = Field(None, max_length=80)
    plan_ids: list[str] = Field(default_factory=list, max_length=30)   # empty = any active member
    active: bool = True


def _tpl_out(t: dict[str, Any]) -> dict[str, Any]:
    return {"id": t["_id"], **{k: t.get(k) for k in ("title", "weekday", "start", "duration_min", "capacity", "instructor",
                                                     "location", "plan_ids", "active")}}


SESSION_FIELDS = ("title", "start", "duration_min", "capacity", "instructor", "location", "plan_ids")


async def ensure_sessions(business_id: str) -> None:
    """Make the classes for the next BOOK_DAYS days from the timetable."""
    today = _now().date()
    async for t in db.class_templates.find({"business_id": business_id, "active": True, "deleted": {"$ne": True}}):
        for i in range(BOOK_DAYS + 1):
            d = today + timedelta(days=i)
            if (d.weekday() + 1) % 7 != t["weekday"]:
                continue
            try:
                await db.class_sessions.update_one(
                    {"business_id": business_id, "template_id": t["_id"], "date": d.isoformat()},
                    {"$setOnInsert": {"_id": str(uuid.uuid4()), **{k: t.get(k) for k in SESSION_FIELDS},
                                      "booked": 0, "waitlist": 0, "cancelled": False, "created_at": _iso()}},
                    upsert=True)
            except DuplicateKeyError:
                pass          # made by a request at the same moment


@router.get("/businesses/{business_id}/classes")
async def list_templates(business_id: str, user=Depends(verify_token)):
    await business_access(db, business_id, user, "members")
    rows = await db.class_templates.find({"business_id": business_id, "deleted": {"$ne": True}}).sort([("weekday", 1), ("start", 1)]).to_list(300)
    return [_tpl_out(t) for t in rows]


@router.post("/businesses/{business_id}/classes")
async def create_template(business_id: str, body: TemplateIn, user=Depends(verify_token)):
    await business_access(db, business_id, user, "members")
    if await db.class_templates.count_documents({"business_id": business_id, "deleted": {"$ne": True}}) >= 200:
        raise HTTPException(status_code=400, detail="A timetable can have up to 200 classes a week")
    doc = {"_id": str(uuid.uuid4()), "business_id": business_id, **body.model_dump(), "created_at": _iso()}
    await db.class_templates.insert_one(doc)
    await ensure_sessions(business_id)
    return _tpl_out(doc)


@router.put("/businesses/{business_id}/classes/{template_id}")
async def update_template(business_id: str, template_id: str, body: TemplateIn, user=Depends(verify_token)):
    """Changes apply to classes from today on that nobody has booked yet;
    a booked class keeps its time and size, so nobody's booking moves
    under them. A changed weekday makes new classes on the new day."""
    await business_access(db, business_id, user, "members")
    t = await db.class_templates.find_one_and_update(
        {"_id": template_id, "business_id": business_id, "deleted": {"$ne": True}},
        {"$set": {**body.model_dump(), "updated_at": _iso()}}, return_document=ReturnDocument.AFTER)
    if not t:
        raise HTTPException(status_code=404, detail="Class not found")
    today = _now().date().isoformat()
    await db.class_sessions.delete_many({"template_id": template_id, "date": {"$gte": today}, "booked": 0, "waitlist": 0})
    await db.class_sessions.update_many({"template_id": template_id, "date": {"$gte": today}},
                                        {"$set": {"title": t["title"], "instructor": t.get("instructor"), "location": t.get("location"),
                                                  "plan_ids": t.get("plan_ids") or []}})
    await ensure_sessions(business_id)
    return _tpl_out(t)


@router.delete("/businesses/{business_id}/classes/{template_id}")
async def delete_template(business_id: str, template_id: str, user=Depends(verify_token)):
    """Off the timetable. Classes already booked stay until you cancel
    them, so nobody is dropped without being told."""
    await business_access(db, business_id, user, "members")
    r = await db.class_templates.update_one({"_id": template_id, "business_id": business_id},
                                            {"$set": {"deleted": True, "active": False}})
    if not r.matched_count:
        raise HTTPException(status_code=404, detail="Class not found")
    await db.class_sessions.delete_many({"template_id": template_id, "date": {"$gte": _now().date().isoformat()},
                                         "booked": 0, "waitlist": 0})
    return {"ok": True}


def _session_out(s: dict[str, Any]) -> dict[str, Any]:
    return {"id": s["_id"], "date": s["date"], **{k: s.get(k) for k in SESSION_FIELDS},
            "booked": s.get("booked", 0), "waitlist": s.get("waitlist", 0), "cancelled": s.get("cancelled", False),
            "spots_left": max(0, (s.get("capacity") or 0) - s.get("booked", 0))}


@router.get("/businesses/{business_id}/class-sessions")
async def list_sessions(business_id: str, days: int = 7, start: Optional[date] = None, user=Depends(verify_token)):
    """The classes for a week (or `days`), each with who is booked."""
    await business_access(db, business_id, user, "checkin")
    await ensure_sessions(business_id)
    a = start or _now().date()
    b = a + timedelta(days=max(1, min(days, 31)))
    sessions = await db.class_sessions.find({"business_id": business_id, "date": {"$gte": a.isoformat(), "$lt": b.isoformat()}}) \
        .sort([("date", 1), ("start", 1)]).to_list(1000)
    ids = [s["_id"] for s in sessions]
    roster: dict[str, list[dict[str, Any]]] = {}
    async for bk in db.class_bookings.find({"session_id": {"$in": ids}, "status": {"$ne": "cancelled"}}).sort("created_at", 1):
        roster.setdefault(bk["session_id"], []).append({"id": bk["_id"], "member_id": bk["member_id"], "name": bk.get("name"),
                                                         "status": bk["status"]})
    return [{**_session_out(s), "roster": roster.get(s["_id"], [])} for s in sessions]


class CancelIn(BaseModel):
    reason: Optional[str] = Field(None, max_length=300)


@router.post("/businesses/{business_id}/class-sessions/{session_id}/cancel")
async def cancel_session(business_id: str, session_id: str, body: CancelIn, user=Depends(verify_token)):
    """One class off (illness, a holiday). Everyone booked or waiting is
    emailed. The timetable is unchanged."""
    biz = await business_access(db, business_id, user, "members")
    s = await db.class_sessions.find_one_and_update({"_id": session_id, "business_id": business_id, "cancelled": False},
                                                    {"$set": {"cancelled": True, "cancel_reason": body.reason, "cancelled_at": _iso()}})
    if not s:
        raise HTTPException(status_code=404, detail="Class not found or already cancelled")
    async for bk in db.class_bookings.find({"session_id": session_id, "status": {"$in": ["booked", "waitlist"]}}):
        await db.class_bookings.update_one({"_id": bk["_id"]}, {"$set": {"status": "cancelled", "cancelled_by": "business"}})
        await _tell(bk, biz, s, "cancelled", body.reason)
    return {"ok": True}


# ---------------------------------------------------------------------------
# members booking (memberships.py's link is the credential)
# ---------------------------------------------------------------------------

async def _member(token: str) -> dict[str, Any]:
    if not token or len(token) < 16:
        raise HTTPException(status_code=404, detail="This link is not valid")
    m = await db.business_members.find_one({"manage_token": token})
    if not m:
        raise HTTPException(status_code=404, detail="This link is not valid")
    return m


async def _tell(bk: dict[str, Any], biz: dict[str, Any], s: dict[str, Any], what: str, reason: Optional[str] = None) -> None:
    m = await db.business_members.find_one({"_id": bk["member_id"]}, {"email": 1, "name": 1, "lang": 1, "manage_token": 1})
    if not m or not m.get("email"):
        return
    he = m.get("lang") == "he"
    when = f"{s['date']} {s['start']}"
    title, name = _esc(s.get("title")), _esc(biz.get("name"))
    if what == "promoted":
        subj = f"{biz.get('name')}: {'התפנה מקום' if he else 'a place opened up'} - {s.get('title')}"
        body = (f"<p>התפנה מקום ב{title}, {_esc(when)}. המקום שמור לכם.</p>" if he
                else f"<p>A place opened up in {title} on {_esc(when)}. It is yours.</p>")
    else:
        subj = f"{biz.get('name')}: {'השיעור בוטל' if he else 'class cancelled'} - {s.get('title')}"
        body = (f"<p>השיעור {title} ב-{_esc(when)} ב{name} בוטל.</p>" if he
                else f"<p>{title} on {_esc(when)} at {name} is cancelled.</p>")
        if reason:
            body += f"<p>{_esc(reason)}</p>"
    await _email(m["email"], _subject(subj), body, tag=f"class-{what}",
                 button=("לכרטיס המנוי" if he else "Your membership", f"/members/{m['manage_token']}"))


def _may_book(m: dict[str, Any], s: dict[str, Any]) -> Optional[str]:
    from .memberships import _member_state
    st = _member_state(m)
    if m.get("status") != "active" or (st["reason"] in ("due", "expired", "not_started", "paused", "cancelled", "pending")):
        return "Your membership needs to be active to book"
    if s.get("plan_ids") and m.get("plan_id") not in s["plan_ids"]:
        return "This class is not part of your plan"
    if s.get("cancelled"):
        return "This class is cancelled"
    if _starts(s) <= _now():
        return "This class has started"
    if s["date"] > (_now().date() + timedelta(days=BOOK_DAYS)).isoformat():
        return "Too early to book this class"
    return None


@router.get("/memberships/me/{token}/classes")
async def my_classes(token: str, request: Request):
    check_rate(request, bucket="classes_me", limit=300, window_seconds=600)
    m = await _member(token)
    await ensure_sessions(m["business_id"])
    today = _now().date()
    sessions = await db.class_sessions.find({"business_id": m["business_id"], "date": {"$gte": today.isoformat(),
                                                                                       "$lte": (today + timedelta(days=BOOK_DAYS)).isoformat()}}) \
        .sort([("date", 1), ("start", 1)]).to_list(1000)
    mine = {b["session_id"]: b async for b in db.class_bookings.find({"member_id": m["_id"], "status": {"$in": ["booked", "waitlist"]}})}
    out = []
    for s in sessions:
        if _starts(s) <= _now() and s["_id"] not in mine:
            continue
        if s.get("plan_ids") and m.get("plan_id") not in s["plan_ids"]:
            continue
        b = mine.get(s["_id"])
        pos = None
        if b and b["status"] == "waitlist":
            pos = 1 + await db.class_bookings.count_documents({"session_id": s["_id"], "status": "waitlist", "created_at": {"$lt": b["created_at"]}})
        out.append({**_session_out(s), "my_status": b["status"] if b else None, "waitlist_position": pos})
    return {"classes": out, "can_book": _may_book(m, {"date": today.isoformat(), "start": "23:59", "plan_ids": []}) is None}


@router.post("/memberships/me/{token}/classes/{session_id}")
async def book_class(token: str, session_id: str, request: Request):
    check_rate(request, bucket="classes_book", limit=60, window_seconds=600)
    m = await _member(token)
    s = await db.class_sessions.find_one({"_id": session_id, "business_id": m["business_id"]})
    if not s:
        raise HTTPException(status_code=404, detail="Class not found")
    why = _may_book(m, s)
    if why:
        raise HTTPException(status_code=400, detail=why)
    if await db.class_bookings.find_one({"session_id": session_id, "member_id": m["_id"], "status": {"$in": ["booked", "waitlist"]}}):
        raise HTTPException(status_code=409, detail="You are already booked for this class")
    if await db.class_bookings.count_documents({"member_id": m["_id"], "status": {"$in": ["booked", "waitlist"]},
                                                "starts_at": {"$gt": _iso()}}) >= MAX_AHEAD:
        raise HTTPException(status_code=400, detail=f"You can hold up to {MAX_AHEAD} bookings at a time")
    # A place, if there is one: the count only moves while it is under capacity.
    got = await db.class_sessions.find_one_and_update(
        {"_id": session_id, "cancelled": False, "$expr": {"$lt": ["$booked", "$capacity"]}}, {"$inc": {"booked": 1}})
    status = "booked" if got else "waitlist"
    if not got:
        await db.class_sessions.update_one({"_id": session_id}, {"$inc": {"waitlist": 1}})
    await db.class_bookings.insert_one({"_id": str(uuid.uuid4()), "session_id": session_id, "business_id": m["business_id"],
                                        "member_id": m["_id"], "name": m["name"], "status": status,
                                        "starts_at": _starts(s).isoformat(), "created_at": _iso()})
    return {"status": status}


@router.delete("/memberships/me/{token}/classes/{session_id}")
async def cancel_booking(token: str, session_id: str, request: Request):
    """Gives the place back; the first person waiting gets it and an email."""
    check_rate(request, bucket="classes_book", limit=60, window_seconds=600)
    m = await _member(token)
    b = await db.class_bookings.find_one_and_update(
        {"session_id": session_id, "member_id": m["_id"], "status": {"$in": ["booked", "waitlist"]}},
        {"$set": {"status": "cancelled", "cancelled_at": _iso(), "cancelled_by": "member"}})
    if not b:
        raise HTTPException(status_code=404, detail="You are not booked for this class")
    if b["status"] == "waitlist":
        await db.class_sessions.update_one({"_id": session_id}, {"$inc": {"waitlist": -1}})
        return {"ok": True}
    await db.class_sessions.update_one({"_id": session_id}, {"$inc": {"booked": -1}})
    await promote(session_id)
    return {"ok": True}


async def promote(session_id: str) -> None:
    """Fill a free place from the waiting list, oldest first."""
    s = await db.class_sessions.find_one({"_id": session_id})
    if not s or s.get("cancelled") or _starts(s) <= _now():
        return
    while True:
        nxt = await db.class_bookings.find_one({"session_id": session_id, "status": "waitlist"}, sort=[("created_at", 1)])
        if not nxt:
            return
        got = await db.class_sessions.find_one_and_update(
            {"_id": session_id, "$expr": {"$lt": ["$booked", "$capacity"]}}, {"$inc": {"booked": 1, "waitlist": -1}})
        if not got:
            return
        moved = await db.class_bookings.update_one({"_id": nxt["_id"], "status": "waitlist"},
                                                   {"$set": {"status": "booked", "promoted_at": _iso()}})
        if moved.modified_count:
            biz = await db.businesses.find_one({"_id": s["business_id"]}, {"name": 1}) or {}
            await _tell(nxt, biz, s, "promoted")
            return
        await db.class_sessions.update_one({"_id": session_id}, {"$inc": {"booked": -1, "waitlist": 1}})


async def mark_attended(member_id: str) -> Optional[str]:
    """A check-in at the door near a class this member booked marks it
    attended. Returns the class title, for the door screen."""
    now = _now()
    async for b in db.class_bookings.find({"member_id": member_id, "status": "booked",
                                           "starts_at": {"$gte": (now - ATTEND_AFTER).isoformat(),
                                                         "$lte": (now + ATTEND_BEFORE).isoformat()}}):
        await db.class_bookings.update_one({"_id": b["_id"]}, {"$set": {"status": "attended", "attended_at": _iso()}})
        s = await db.class_sessions.find_one({"_id": b["session_id"]}, {"title": 1, "start": 1})
        return f"{(s or {}).get('title')} {(s or {}).get('start')}"
    return None


@router.get("/memberships/{slug_or_id}/timetable")
async def public_timetable(slug_or_id: str):
    """The week's classes for the sign-up page: times and places left,
    never names."""
    biz = await db.businesses.find_one({"$or": [{"_id": slug_or_id}, {"slug": slug_or_id.lower()}]}, {"_id": 1, "active": 1})
    if not biz or not biz.get("active", True):
        raise HTTPException(status_code=404, detail="Business not found")
    await ensure_sessions(biz["_id"])
    today = _now().date()
    rows = await db.class_sessions.find({"business_id": biz["_id"], "cancelled": False,
                                         "date": {"$gte": today.isoformat(), "$lt": (today + timedelta(days=7)).isoformat()}}) \
        .sort([("date", 1), ("start", 1)]).to_list(500)
    return [{k: v for k, v in _session_out(s).items() if k not in ("booked", "waitlist", "plan_ids")} for s in rows if _starts(s) > _now()]


async def ensure_class_indexes() -> None:
    await db.class_templates.create_index("business_id")
    await db.class_sessions.create_index([("business_id", 1), ("template_id", 1), ("date", 1)], unique=True)
    await db.class_sessions.create_index([("business_id", 1), ("date", 1)])
    await db.class_bookings.create_index([("session_id", 1), ("status", 1), ("created_at", 1)])
    await db.class_bookings.create_index([("member_id", 1), ("status", 1), ("starts_at", 1)])
