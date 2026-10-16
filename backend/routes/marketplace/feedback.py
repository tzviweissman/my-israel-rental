"""Private feedback after a visit (Tzvi, 16 Oct 2026, from Square: "the
day after an appointment or order, 'How did we do?'; a low score goes
privately to the business so it can make things right").

The day after an appointment the business marked done, a website order
marked done, or a tour/workshop date, the customer gets one email with
five stars. Tapping one opens a short page: the rating and, if they like,
a few words, which go to the business only (email, bell, and the feedback
list on Overview). Never shown on the site.

The public review is offered to EVERYONE after, whatever their score,
where the site's verified reviews allow one. Inviting only the happy ones
to review publicly ("review gating") would skew the ratings other
customers rely on, and Google forbids it for its own reviews.

Who is skipped: no email given, the business switched it off
(`feedback_on`), or a signed-in appointment customer while verified
reviews are on (they already get the review request, utils/reviews.py,
and two emails about one visit is one too many).
"""
from __future__ import annotations

import asyncio
import secrets
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
LOOP_SECONDS = 1800


def _on(biz: dict[str, Any]) -> bool:
    return biz.get("feedback_on", True) is not False


async def _candidates(now: datetime) -> list[dict[str, Any]]:
    """Visits that ended between about a day and four days ago."""
    late = (now - timedelta(hours=18)).isoformat()
    early = (now - timedelta(days=4)).isoformat()
    from utils import reviews as rv
    native = rv.native_enabled()
    out: list[dict[str, Any]] = []
    async for b in db.marketplace_bookings.find({"status": "completed", "no_show": {"$ne": True}, "contact_email": {"$nin": [None, ""]},
                                                 "completed_at": {"$gte": early, "$lte": late}}):
        if native and b.get("client_user_id"):
            continue
        gig = await db.marketplace_gigs.find_one({"_id": b["gig_id"]}, {"business_id": 1, "title": 1, "title_he": 1}) or {}
        out.append({"kind": "appointment", "ref": b["_id"], "business_id": gig.get("business_id"), "email": b["contact_email"],
                    "name": b.get("guest_name") or "", "lang": b.get("lang") or "en", "what": gig.get("title") or "",
                    "track_token": b.get("track_token")})
    # Orders stamp Israel time (orders._now_iso), so compare in it.
    late_il = (now - timedelta(hours=18)).astimezone(IL).replace(microsecond=0).isoformat()
    early_il = (now - timedelta(days=4)).astimezone(IL).replace(microsecond=0).isoformat()
    async for o in db.store_orders.find({"status": "done", "source": "website", "customer_email": {"$nin": [None, ""]},
                                         "status_changed_at": {"$gte": early_il, "$lte": late_il}}):
        out.append({"kind": "order", "ref": o["_id"], "business_id": o.get("business_id"), "email": o["customer_email"],
                    "name": o.get("customer_name") or "", "lang": o.get("lang") or "en", "what": "",
                    "track_token": o.get("track_token")})
    yesterday = (now.astimezone(IL).date() - timedelta(days=1)).isoformat()
    async for r in db.session_reservations.find({"status": "reserved", "session_date": yesterday, "email": {"$nin": [None, ""]}}):
        gig = await db.marketplace_gigs.find_one({"_id": r["gig_id"]}, {"title": 1}) or {}
        out.append({"kind": "reservation", "ref": r["_id"], "business_id": r.get("business_id"), "email": r["email"],
                    "name": r.get("name") or "", "lang": r.get("lang") or "en", "what": gig.get("title") or "", "track_token": None})
    return out


async def run_once(now: Optional[datetime] = None) -> int:
    now = now or datetime.now(UTC)
    local = now.astimezone(IL)
    if not (10 <= local.hour < 20):
        return 0
    sent = 0
    for c in await _candidates(now):
        biz = await db.businesses.find_one({"_id": c["business_id"]}) if c.get("business_id") else None
        if not biz or not _on(biz):
            continue
        doc = {"_id": f"{c['kind']}:{c['ref']}", **{k: c[k] for k in ("kind", "ref", "business_id", "email", "name", "lang", "what", "track_token")},
               "email": c["email"].strip().lower(), "token": secrets.token_urlsafe(16), "sent_at": now.isoformat(),
               "rating": None, "comment": None}
        try:
            await db.feedback_requests.insert_one(doc)
        except DuplicateKeyError:
            continue
        await _email(doc, biz)
        sent += 1
    return sent


async def _email(f: dict[str, Any], biz: dict[str, Any]) -> None:
    from utils import email as em
    from .orders import _frontend_url, _subject
    he = f.get("lang") == "he"
    business = (biz.get("name_he") if he and biz.get("name_he") else biz.get("name")) or ""
    head = f"איך היה אצל {business}?" if he else f"How did {business} do?"
    line = ("נשמח לשמוע, במשפט או בכוכב. מה שתכתבו מגיע לעסק בלבד." if he
            else "A tap or a sentence helps. What you write goes to the business only.")
    base = f"{_frontend_url()}/feedback/{f['token']}"
    stars = "".join(
        f'<a href="{base}?rating={n}" style="display:inline-block;margin:0 3px;font-size:30px;line-height:1;color:#F5B301;text-decoration:none;">&#9733;</a>'
        for n in range(1, 6))
    inner = (f'<h2 style="color:#222;font-size:22px;margin:0 0 8px;">{em._esc(head)}</h2>'
             f'<p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 14px;">{em._esc(line)}</p>'
             f'<p style="margin:0 0 6px;" dir="ltr">{stars}</p>'
             f'<p style="color:#666;font-size:12px;margin:0;">{"לחצו על כוכב" if he else "Tap a star"}</p>')
    owner = await db.users.find_one({"id": biz.get("owner_user_id")}, {"email": 1}) or {}
    await em.send_email(f["email"], _subject(head), em._wrap(inner, preheader=head, lang="he" if he else "en"),
                        tag="feedback-request", from_name=business or None, reply_to=owner.get("email"))


async def feedback_loop() -> None:
    await asyncio.sleep(240)
    while True:
        try:
            n = await run_once()
            if n:
                logger.info("[feedback] requests sent %s", n)
        except Exception as e:  # noqa: BLE001
            logger.warning("[feedback] pass failed: %s", e)
        await asyncio.sleep(LOOP_SECONDS)


# ---------------------------------------------------------------------------
# the customer's page
# ---------------------------------------------------------------------------

async def _by_token(token: str, request: Request) -> dict[str, Any]:
    check_rate(request, bucket="feedback", limit=60, window_seconds=600)
    if not token or len(token) < 16:
        raise HTTPException(status_code=404, detail="This link is not valid")
    f = await db.feedback_requests.find_one({"token": token})
    if not f:
        raise HTTPException(status_code=404, detail="This link is not valid")
    return f


@router.get("/feedback/{token}")
async def feedback_page(token: str, request: Request):
    f = await _by_token(token, request)
    biz = await db.businesses.find_one({"_id": f.get("business_id")}, {"name": 1, "name_he": 1, "logo_url": 1}) or {}
    return {"business": {"name": biz.get("name") or "", "name_he": biz.get("name_he"), "logo_url": biz.get("logo_url")},
            "kind": f["kind"], "what": f.get("what") or "", "rating": f.get("rating"), "comment": f.get("comment"),
            # Where the public review starts, for any score.
            "review_track_token": f.get("track_token") if f["kind"] in ("appointment", "order") else None}


class FeedbackIn(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: str = Field("", max_length=2000)
    # The page saves the star from the email at once (final=False, so a tap
    # and nothing more still counts) and tells the business on Send.
    final: bool = True


@router.post("/feedback/{token}")
async def give_feedback(token: str, body: FeedbackIn, request: Request):
    f = await _by_token(token, request)
    told = bool(f.get("told_at"))
    await db.feedback_requests.update_one({"_id": f["_id"]}, {"$set": {
        "rating": body.rating, "comment": body.comment.strip() or None, "answered_at": datetime.now(UTC).isoformat()}})
    biz = await db.businesses.find_one({"_id": f.get("business_id")}) or {}
    if body.final and (not told or body.comment.strip()):
        await db.feedback_requests.update_one({"_id": f["_id"]}, {"$set": {"told_at": datetime.now(UTC).isoformat()}})
        from .gigs import _notify
        from .orders import _email, _esc
        stars = "★" * body.rating + "☆" * (5 - body.rating)
        await _notify(biz.get("owner_user_id"), "private_feedback", f"Private feedback from {f.get('name') or 'a customer'}: {stars}", f["_id"])
        owner = await db.users.find_one({"id": biz.get("owner_user_id")}, {"email": 1}) or {}
        await _email(owner.get("email"), f"Private feedback: {stars}",
                     f"<p><b>{_esc(f.get('name') or 'A customer')}</b> rated {body.rating} of 5"
                     + (f" ({_esc(f.get('what'))})" if f.get("what") else "") + ".</p>"
                     + (f"<p>{_esc(body.comment.strip())}</p>" if body.comment.strip() else "")
                     + (f"<p>Reply to them at {_esc(f['email'])}.</p>" if body.rating <= 3 else ""),
                     tag="private-feedback", button=("Open your dashboard", "/dashboard?tab=overview"))
    return {"ok": True}


# ---------------------------------------------------------------------------
# the business's side
# ---------------------------------------------------------------------------

@router.get("/businesses/{business_id}/feedback")
async def business_feedback(business_id: str, days: int = 90, user=Depends(verify_token)):
    from utils.business_access import business_access
    biz = await business_access(db, business_id, user, "summary")
    since = (datetime.now(UTC) - timedelta(days=max(1, min(days, 365)))).isoformat()
    rows = await db.feedback_requests.find({"business_id": business_id, "rating": {"$ne": None}, "answered_at": {"$gte": since}}) \
        .sort("answered_at", -1).to_list(200)
    sent = await db.feedback_requests.count_documents({"business_id": business_id, "sent_at": {"$gte": since}})
    avg = round(sum(r["rating"] for r in rows) / len(rows), 1) if rows else None
    return {"on": _on(biz), "sent": sent, "answered": len(rows), "average": avg,
            "latest": [{"rating": r["rating"], "comment": r.get("comment"), "name": r.get("name"), "email": r.get("email"),
                        "what": r.get("what"), "at": r.get("answered_at")} for r in rows[:20]]}


class FeedbackSetting(BaseModel):
    on: bool


@router.put("/businesses/{business_id}/feedback-setting")
async def feedback_setting(business_id: str, body: FeedbackSetting, user=Depends(verify_token)):
    from utils.business_access import business_access
    await business_access(db, business_id, user, None)
    await db.businesses.update_one({"_id": business_id}, {"$set": {"feedback_on": body.on}})
    return {"on": body.on}


async def ensure_feedback_indexes() -> None:
    await db.feedback_requests.create_index("token", unique=True)
    await db.feedback_requests.create_index([("business_id", 1), ("answered_at", -1)])
