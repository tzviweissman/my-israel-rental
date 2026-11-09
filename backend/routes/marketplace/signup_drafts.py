"""A business's half-filled sign-up, kept on our server (Tzvi, 9 Nov 2026).

The wizard (frontend/src/pages/CreateGig.jsx) is open to visitors with no
account. The email they give on the first screen is the one personal detail
we have, so their progress is saved here under a random draft id the browser
keeps, and one "finish your page" email with a link back goes out if they
stop. The link is the draft id: unguessable, so it is the only key needed.

Nothing here creates an account or a listing. Publishing still needs the
account, and deletes the draft.
"""
from __future__ import annotations

import asyncio
import html
import json
import re
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from routes.deps import db, logger
from utils.rate_limit import check_rate

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

REMIND_AFTER = timedelta(hours=2)   # quiet this long, unpublished: one email
KEEP_FOR_DAYS = 60                  # then the draft is deleted (TTL index)
MAX_BYTES = 200_000                 # text only: photos are links, not files
LOOP_SECONDS = 600
_ID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")


class DraftIn(BaseModel):
    email: str
    data: dict
    lang: str = "en"


def _check_id(draft_id: str) -> str:
    if not _ID.match(draft_id or ""):
        raise HTTPException(status_code=404, detail="That link has expired. Start again, it only takes a minute.")
    return draft_id


@router.put("/signup-draft/{draft_id}")
async def save_draft(draft_id: str, body: DraftIn, request: Request):
    _check_id(draft_id)
    check_rate(request, bucket="signup_draft", limit=240, window_seconds=3600)
    email = body.email.strip().lower()
    if not _EMAIL.match(email) or len(email) > 200:
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    if len(json.dumps(body.data)) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="That is too much to save at once.")
    now = datetime.now(UTC)
    existing = await db.signup_drafts.find_one({"_id": draft_id}, {"email": 1})
    if not existing:
        # New drafts are the only thing that can lead to an email, so they are the ones capped.
        check_rate(request, bucket="signup_draft_new", limit=10, window_seconds=86400)
    changes = {"email": email, "data": body.data, "lang": "he" if body.lang == "he" else "en", "updated_at": now}
    if existing and existing.get("email") != email:
        changes["reminded_at"] = None   # a corrected address may still get its one email
    await db.signup_drafts.update_one(
        {"_id": draft_id},
        {"$set": changes, "$setOnInsert": {"created_at": now, **({} if existing else {"reminded_at": None})}},
        upsert=True,
    )
    return {"ok": True}


@router.get("/signup-draft/{draft_id}")
async def load_draft(draft_id: str, request: Request):
    _check_id(draft_id)
    check_rate(request, bucket="signup_draft_read", limit=60, window_seconds=3600)
    d = await db.signup_drafts.find_one({"_id": draft_id}, {"email": 1, "data": 1})
    if not d:
        raise HTTPException(status_code=404, detail="That link has expired. Start again, it only takes a minute.")
    return {"email": d["email"], "data": d.get("data") or {}}


@router.delete("/signup-draft/{draft_id}")
async def finish_draft(draft_id: str):
    """Called when the page is published: the draft has done its job."""
    _check_id(draft_id)
    await db.signup_drafts.delete_one({"_id": draft_id})
    return {"ok": True}


def _email_html(he: bool, name: str, link: str) -> tuple[str, str]:
    d, side = ("rtl", "right") if he else ("ltr", "left")
    if he:
        subject = f"הדף של {name} כמעט מוכן" if name else "הדף של העסק שלכם כמעט מוכן"
        body = ("התחלתם להוסיף את העסק שלכם ל-MyIsraelRental ושמרנו את כל מה שמילאתם.\n\n"
                "עוד כמה דקות והדף שלכם באוויר, בחינם וללא עמלות.")
        button, why = "להמשיך מאיפה שעצרתם", "קיבלתם את המייל הזה כי הכתובת הוזנה בזמן הוספת עסק ל-MyIsraelRental. לא אתם? אפשר להתעלם ממנו."
    else:
        subject = f"Your page for {name} is almost ready" if name else "Your business page is almost ready"
        body = ("You started adding your business to MyIsraelRental and we saved everything you filled in.\n\n"
                "A few more minutes and your page is live, free and with no commission.")
        button, why = "Carry on where you stopped", "You got this because this address was entered while adding a business to MyIsraelRental. Not you? You can ignore it."
    page = f"""<!DOCTYPE html><html lang="{'he' if he else 'en'}" dir="{d}"><head><meta charset="UTF-8"></head>
<body dir="{d}" style="margin:0;background:#F9FAFB;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #E3E3E3;border-radius:14px;">
<tr><td style="padding:24px 28px 6px;text-align:{side};font-size:18px;font-weight:700;">{html.escape(subject)}</td></tr>
<tr><td style="padding:6px 28px 18px;text-align:{side};font-size:15px;line-height:1.65;">{html.escape(body).replace(chr(10), '<br>')}</td></tr>
<tr><td style="padding:0 28px 24px;text-align:{side};"><a href="{html.escape(link)}" style="background:#000;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">{button}</a></td></tr>
<tr><td style="padding:14px 28px;border-top:1px solid #E3E3E3;text-align:{side};font-size:12px;color:#666;">{why}</td></tr>
</table></td></tr></table></body></html>"""
    return subject, page


async def run_once() -> int:
    """Email every draft that went quiet, once. Claimed first, so two copies of the server cannot both send."""
    from utils.email import send_email
    from .orders import _frontend_url
    sent = 0
    cutoff = datetime.now(UTC) - REMIND_AFTER
    while True:
        d = await db.signup_drafts.find_one_and_update(
            {"reminded_at": None, "updated_at": {"$lte": cutoff}},
            {"$set": {"reminded_at": datetime.now(UTC)}},
        )
        if not d:
            return sent
        data = d.get("data") or {}
        name = str(data.get("bizName") or (data.get("form") or {}).get("title") or "").strip()[:80]
        subject, page = _email_html(d.get("lang") == "he", name, f"{_frontend_url()}/businesses/add?draft={d['_id']}")
        if await send_email(d["email"], subject, page, tag="signup-draft"):
            sent += 1


async def signup_draft_loop() -> None:
    await asyncio.sleep(240)
    while True:
        try:
            n = await run_once()
            if n:
                logger.info("[signup-draft] reminders sent %s", n)
        except Exception as e:  # noqa: BLE001
            logger.warning("[signup-draft] pass failed: %s", e)
        await asyncio.sleep(LOOP_SECONDS)


async def ensure_signup_draft_indexes() -> None:
    await db.signup_drafts.create_index([("reminded_at", 1), ("updated_at", 1)])
    await db.signup_drafts.create_index("updated_at", expireAfterSeconds=KEEP_FOR_DAYS * 86400, name="signup_drafts_ttl")
