"""Automatic messages to members (Tzvi, 15 Oct 2026: "do the automatic
messages next"). Set once by the business, then they run on their own:

    welcome       when a membership is activated
    renewal       N days before it renews (monthly and yearly plans)
    class         a few hours before a class they booked (classes.py)
    winback       an active member not seen for N days, at most once per
                  N days ("we haven't seen you")

Each can be switched off, and its wording replaced; the default wording
is in the member's language. Placeholders the business can use:
{name} {business} {plan} {date} {class} {time}.

Welcome, renewal and class reminders are about the member's own
membership, so they go on the transactional stream like an order
confirmation. "We haven't seen you" invites someone back, which is
marketing: it goes on the broadcast stream with the business's
unsubscribe link (customer_messages.py), and anyone who unsubscribed
never gets it.

Every message is written to member_message_log under a key that makes
it once-only (the renewal date, the class, the week), so the loop can
run as often as it likes. Email only, to members who gave one.
"""
from __future__ import annotations

import asyncio
import html
import uuid
from datetime import datetime, timedelta
from typing import Any, Literal, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from routes.deps import db, logger, verify_token
from utils.business_access import business_access
from utils.rate_limit import check_rate

from .orders import _frontend_url, _subject

router = APIRouter(prefix="/marketplace", tags=["marketplace"])
IL = ZoneInfo("Asia/Jerusalem")
TRIGGERS = ("welcome", "renewal", "class", "winback")
LOOP_SECONDS = 900

DEFAULTS: dict[str, dict[str, Any]] = {
    "welcome": {"on": True, "days": None},
    "renewal": {"on": True, "days": 3},
    "class": {"on": True, "days": None, "hours": 3},
    "winback": {"on": False, "days": 21},
}
TEXT = {
    "en": {
        "welcome": ("Welcome to {business}", "Hi {name},\n\nWelcome to {business}! Your {plan} membership is active. Your membership pass is below: show it at the door.\n\nSee you soon."),
        "renewal": ("Your membership renews on {date}", "Hi {name},\n\nA reminder that your {plan} membership at {business} renews on {date}."),
        "class": ("Today: {class} at {time}", "Hi {name},\n\nA reminder that you are booked for {class} at {time} today at {business}. If you can't make it, please cancel from your membership page so someone on the waiting list can come."),
        "winback": ("We haven't seen you for a while", "Hi {name},\n\nWe haven't seen you at {business} for a while. We'd love to see you back. Your membership is active, so come in any time."),
    },
    "he": {
        "welcome": ("ברוכים הבאים ל{business}", "שלום {name},\n\nברוכים הבאים ל{business}! המנוי שלך ({plan}) פעיל. כרטיס המנוי שלך מצורף למטה: הציגו אותו בכניסה.\n\nנתראה בקרוב."),
        "renewal": ("המנוי מתחדש ב־{date}", "שלום {name},\n\nתזכורת: המנוי שלך ({plan}) ב{business} מתחדש ב־{date}."),
        "class": ("היום: {class} ב־{time}", "שלום {name},\n\nתזכורת: נרשמת ל{class} היום ב־{time} ב{business}. אם לא תוכלו להגיע, בטלו בדף המנוי כדי שמישהו מרשימת ההמתנה יוכל לבוא."),
        "winback": ("מזמן לא ראינו אותך", "שלום {name},\n\nמזמן לא ראינו אותך ב{business}. נשמח לראות אותך שוב. המנוי שלך פעיל, אפשר לבוא בכל זמן."),
    },
}


def _now() -> datetime:
    return datetime.now(IL)


def settings_of(biz: dict[str, Any]) -> dict[str, dict[str, Any]]:
    saved = biz.get("member_messages") or {}
    return {t: {**DEFAULTS[t], **(saved.get(t) or {})} for t in TRIGGERS}


def _fill(s: str, vals: dict[str, str]) -> str:
    for k, v in vals.items():
        s = s.replace("{" + k + "}", v or "")
    return s


def compose(biz: dict[str, Any], m: dict[str, Any], trigger: str, extra: Optional[dict[str, str]] = None) -> tuple[str, str]:
    st = settings_of(biz)[trigger]
    lang = "he" if m.get("lang") == "he" else "en"
    subj, body = TEXT[lang][trigger]
    if st.get("subject"):
        subj = st["subject"]
    if st.get("text"):
        body = st["text"]
    vals = {"name": (m.get("name") or "").split(" ")[0], "business": biz.get("name") or "",
            "plan": (m.get("plan") or {}).get("name") or "", "date": m.get("renews_on") or "", **(extra or {})}
    return _fill(subj, vals), _fill(body, vals)


async def send(biz: dict[str, Any], m: dict[str, Any], trigger: str, key: str, extra: Optional[dict[str, str]] = None,
               to: Optional[str] = None, test: bool = False) -> bool:
    """Send once per (trigger, member, key). `to`+`test`: a test to the owner."""
    if not test:
        if not settings_of(biz)[trigger]["on"] or not m.get("email"):
            return False
        if trigger == "winback" and await db.message_unsubscribes.find_one({"business_id": biz["_id"], "email": m["email"].lower()}):
            return False
        try:
            await db.member_message_log.insert_one({"_id": str(uuid.uuid4()), "business_id": biz["_id"], "member_id": m["_id"],
                                                    "trigger": trigger, "key": key, "at": _now().isoformat(timespec="seconds")})
        except DuplicateKeyError:
            return False            # already sent
    subject, body = compose(biz, m, trigger, extra)
    he = m.get("lang") == "he"
    unsub = None
    if trigger == "winback" and not test:
        from .customer_messages import unsubscribe_url
        unsub = unsubscribe_url(biz["_id"], m["email"].lower())
    d, side = ("rtl", "right") if he else ("ltr", "left")
    pass_url = f"{_frontend_url()}/members/{m.get('manage_token')}" if m.get("manage_token") else None
    foot = ""
    if unsub:
        foot = (f'<tr><td style="padding:14px 28px;border-top:1px solid #E3E3E3;text-align:center;font-size:12px;color:#666;">'
                f'<a href="{html.escape(unsub)}" style="color:#666;">{"להסרה מרשימת התפוצה" if he else "Unsubscribe"}</a></td></tr>')
    page = f"""<!DOCTYPE html><html lang="{'he' if he else 'en'}" dir="{d}"><head><meta charset="UTF-8"></head>
<body dir="{d}" style="margin:0;background:#F9FAFB;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #E3E3E3;border-radius:14px;">
<tr><td style="padding:24px 28px 6px;text-align:{side};font-size:17px;font-weight:700;">{html.escape(biz.get('name') or '')}</td></tr>
<tr><td style="padding:6px 28px 20px;text-align:{side};font-size:15px;line-height:1.65;">{html.escape(body).replace(chr(10), '<br>')}</td></tr>
{f'<tr><td style="padding:0 28px 24px;text-align:{side};"><a href="{html.escape(pass_url)}" style="background:#000;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">{"לכרטיס המנוי" if he else "Your membership"}</a></td></tr>' if pass_url else ''}
{foot}</table></td></tr></table></body></html>"""
    from utils.email import send_email
    owner = await db.users.find_one({"id": biz["owner_user_id"]}, {"email": 1})
    ok = await send_email(to or m["email"], _subject(("[TEST] " if test else "") + subject), page, tag=f"member-{trigger}",
                          message_stream="broadcast" if (trigger == "winback" and not test) else "outbound",
                          from_name=biz.get("name"), reply_to=(owner or {}).get("email"),
                          headers=({"List-Unsubscribe": f"<{unsub.replace('/unsubscribe/', '/api/marketplace/messages/unsubscribe/')}>",
                                    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"} if unsub else None))
    return ok


async def on_activated(biz_id: str, member: dict[str, Any]) -> None:
    """Called by memberships.py when a membership becomes active."""
    biz = await db.businesses.find_one({"_id": biz_id})
    if biz:
        await send(biz, member, "welcome", key=member.get("start_date") or "first")


# ---------------------------------------------------------------------------
# the loop
# ---------------------------------------------------------------------------

async def run_once() -> dict[str, int]:
    now = _now()
    today = now.date()
    counts = {t: 0 for t in TRIGGERS}
    bizes = {b["_id"]: b async for b in db.businesses.find({"member_messages": {"$exists": True}})}
    # Businesses that never opened the settings get the defaults: every one with active members.
    for bid in await db.business_members.distinct("business_id", {"status": "active"}):
        if bid not in bizes:
            b = await db.businesses.find_one({"_id": bid})
            if b:
                bizes[bid] = b
    for bid, biz in bizes.items():
        if not biz.get("active", True):
            continue
        st = settings_of(biz)
        if st["renewal"]["on"]:
            target = (today + timedelta(days=int(st["renewal"]["days"] or 3))).isoformat()
            async for m in db.business_members.find({"business_id": bid, "status": "active", "renews_on": {"$lte": target, "$gte": today.isoformat()},
                                                     "plan.period": {"$in": ["month", "year"]}, "email": {"$nin": [None, ""]}}):
                counts["renewal"] += await send(biz, m, "renewal", key=m["renews_on"])
        if st["winback"]["on"]:
            days = int(st["winback"]["days"] or 21)
            cutoff = (now - timedelta(days=days)).isoformat()
            async for m in db.business_members.find({"business_id": bid, "status": "active", "email": {"$nin": [None, ""]},
                                                     "$or": [{"last_visit_at": {"$lt": cutoff}},
                                                             {"last_visit_at": None, "created_at": {"$lt": cutoff}}]}):
                # Once per `days`: the key is the period number.
                period = int(now.timestamp() // (days * 86400))
                counts["winback"] += await send(biz, m, "winback", key=f"p{period}")
        if st["class"]["on"]:
            hours = int(st["class"].get("hours") or 3)
            soon = (now + timedelta(hours=hours)).isoformat()
            async for b in db.class_bookings.find({"business_id": bid, "status": "booked", "starts_at": {"$gt": now.isoformat(), "$lte": soon}}):
                m = await db.business_members.find_one({"_id": b["member_id"]})
                s = await db.class_sessions.find_one({"_id": b["session_id"]}, {"title": 1, "start": 1, "cancelled": 1})
                if m and s and not s.get("cancelled"):
                    counts["class"] += await send(biz, m, "class", key=b["session_id"], extra={"class": s.get("title") or "", "time": s.get("start") or ""})
    return counts


async def member_messages_loop() -> None:
    await asyncio.sleep(90)
    while True:
        try:
            c = await run_once()
            if any(c.values()):
                logger.info("[member-messages] sent %s", c)
        except Exception as e:  # noqa: BLE001 - the loop must survive one bad pass
            logger.warning("[member-messages] pass failed: %s", e)
        await asyncio.sleep(LOOP_SECONDS)


# ---------------------------------------------------------------------------
# settings
# ---------------------------------------------------------------------------

class TriggerIn(BaseModel):
    on: bool
    days: Optional[int] = Field(None, ge=1, le=120)
    hours: Optional[int] = Field(None, ge=1, le=24)
    subject: Optional[str] = Field(None, max_length=150)
    text: Optional[str] = Field(None, max_length=3000)


class SettingsIn(BaseModel):
    welcome: Optional[TriggerIn] = None
    renewal: Optional[TriggerIn] = None
    winback: Optional[TriggerIn] = None
    class_: Optional[TriggerIn] = Field(None, alias="class")


def _out(biz: dict[str, Any], lang: str) -> dict[str, Any]:
    st = settings_of(biz)
    return {t: {**st[t], "default_subject": TEXT[lang][t][0], "default_text": TEXT[lang][t][1]} for t in TRIGGERS}


@router.get("/businesses/{business_id}/member-messages")
async def get_settings(business_id: str, lang: Literal["en", "he"] = "en", user=Depends(verify_token)):
    biz = await business_access(db, business_id, user, "members")
    return _out(biz, lang)


@router.put("/businesses/{business_id}/member-messages")
async def put_settings(business_id: str, body: SettingsIn, lang: Literal["en", "he"] = "en", user=Depends(verify_token)):
    biz = await business_access(db, business_id, user, "members")
    sets = {}
    for t, v in (("welcome", body.welcome), ("renewal", body.renewal), ("winback", body.winback), ("class", body.class_)):
        if v is not None:
            d = v.model_dump()
            d["subject"] = (d.get("subject") or "").strip() or None
            d["text"] = (d.get("text") or "").strip() or None
            sets[f"member_messages.{t}"] = d
    if sets:
        await db.businesses.update_one({"_id": business_id}, {"$set": sets})
    biz = await db.businesses.find_one({"_id": business_id})
    return _out(biz, lang)


@router.post("/businesses/{business_id}/member-messages/{trigger}/test")
async def send_test(business_id: str, trigger: Literal["welcome", "renewal", "class", "winback"], request: Request,
                    lang: Literal["en", "he"] = "en", user=Depends(verify_token)):
    check_rate(request, bucket="member_msg_test", limit=20, window_seconds=3600)
    biz = await business_access(db, business_id, user, "members")
    me = await db.users.find_one({"id": user["user_id"]}, {"email": 1, "name": 1}) or {}
    if not me.get("email"):
        raise HTTPException(status_code=400, detail="Your account has no email to send the test to")
    sample = {"_id": "test", "name": me.get("name") or "Dana", "lang": lang, "plan": {"name": "Monthly"},
              "renews_on": (_now().date() + timedelta(days=3)).isoformat(), "manage_token": None}
    ok = await send(biz, sample, trigger, key="test", extra={"class": "Yoga", "time": "18:00"}, to=me["email"], test=True)
    return {"sent": ok, "to": me["email"]}


async def ensure_member_message_indexes() -> None:
    await db.member_message_log.create_index([("trigger", 1), ("member_id", 1), ("key", 1)], unique=True)
