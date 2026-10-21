"""A business emails its customers (Tzvi, 15 Oct 2026: the Shopify idea,
"messages to customers").

The business picks a group from its customer list (customers.py: everyone,
those who ordered, active members, those who booked, or a tag), writes a
subject and a message, sends itself a test, then sends. The rules, each
for a reason:

  * Email only, to customers who gave one. Never SMS or WhatsApp: those
    cost per message and the law is stricter.
  * Every email has an unsubscribe link for THIS business, and a
    List-Unsubscribe header. Anyone who unsubscribed is never sent to
    again by that business. Israeli law (Communications Law s.30A) requires
    the option on any marketing message, and inboxes require it too.
  * A promotion is marked as one. When the business ticks "this is a
    promotion", the subject starts with "פרסומת" / "Advertisement", as the
    same law requires.
  * The broadcast stream. Postmark keeps bulk mail on its own stream, away
    from order and booking mail, so a complaint about a newsletter never
    hurts delivery of someone's order confirmation.
  * Limits: MAX_PER_SEND recipients a send, MONTHLY_CAP a month and
    SENDS_PER_DAY sends a day per business. Our sending reputation is
    shared by every business on the site.
  * Replies go to the business owner, not to us.

The message is the business's own words, sent as plain text (escaped,
line breaks kept): no HTML from the business ever reaches an inbox.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import html
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from routes.deps import JWT_SECRET, db, logger, verify_token
from utils.bg_tasks import spawn
from utils.rate_limit import check_rate

from .customers import build_customers
from .occasions import is_lapsed
from .orders import _frontend_url, _subject

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

MAX_PER_SEND = 500
MONTHLY_CAP = 2000
SENDS_PER_DAY = 3


async def _owned(business_id: str, user: dict[str, Any]) -> dict[str, Any]:
    """The owner, an admin, or staff with the Messages area (utils/business_access.py)."""
    from utils.business_access import business_access
    return await business_access(db, business_id, user, "messages")


# ---------------------------------------------------------------------------
# unsubscribe links
# ---------------------------------------------------------------------------

def _sig(business_id: str, email: str) -> str:
    return hmac.new(JWT_SECRET.encode(), f"unsub|{business_id}|{email}".encode(), hashlib.sha256).hexdigest()[:32]


def unsubscribe_url(business_id: str, email: str) -> str:
    e = base64.urlsafe_b64encode(email.encode()).decode().rstrip("=")
    return f"{_frontend_url()}/unsubscribe/{business_id}/{e}/{_sig(business_id, email)}"


def _decode(e: str) -> str:
    try:
        return base64.urlsafe_b64decode(e + "=" * (-len(e) % 4)).decode().strip().lower()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=404, detail="This link is not valid") from exc


async def _check_link(business_id: str, e: str, sig: str) -> tuple[dict[str, Any], str]:
    email = _decode(e)
    if not hmac.compare_digest(_sig(business_id, email), sig or ""):
        raise HTTPException(status_code=404, detail="This link is not valid")
    biz = await db.businesses.find_one({"_id": business_id}, {"name": 1, "name_he": 1})
    if not biz:
        raise HTTPException(status_code=404, detail="This link is not valid")
    return biz, email


@router.get("/messages/unsubscribe/{business_id}/{e}/{sig}")
async def unsubscribe_info(business_id: str, e: str, sig: str, request: Request):
    check_rate(request, bucket="unsubscribe", limit=120, window_seconds=600)
    biz, email = await _check_link(business_id, e, sig)
    done = bool(await db.message_unsubscribes.find_one({"business_id": business_id, "email": email}))
    return {"business": {"name": biz.get("name"), "name_he": biz.get("name_he")}, "unsubscribed": done}


@router.post("/messages/unsubscribe/{business_id}/{e}/{sig}")
async def unsubscribe(business_id: str, e: str, sig: str, request: Request, resubscribe: bool = False):
    """One click, no sign-in: the link itself is the proof. Also what the
    List-Unsubscribe-Post header points at, for the inbox's own button."""
    check_rate(request, bucket="unsubscribe", limit=120, window_seconds=600)
    await _check_link(business_id, e, sig)
    email = _decode(e)
    if resubscribe:
        await db.message_unsubscribes.delete_one({"business_id": business_id, "email": email})
        return {"unsubscribed": False}
    await db.message_unsubscribes.update_one(
        {"business_id": business_id, "email": email},
        {"$setOnInsert": {"_id": str(uuid.uuid4()), "at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    return {"unsubscribed": True}


# ---------------------------------------------------------------------------
# audience
# ---------------------------------------------------------------------------

class Audience(BaseModel):
    kind: Literal["all", "orders", "members", "active_members", "bookings", "lapsed"] = "all"
    tag: Optional[str] = Field(None, max_length=30)
    # "lapsed" (occasions.py): not back for this many days.
    days: int = Field(90, ge=30, le=730)


async def _recipients(business_id: str, aud: Audience) -> dict[str, Any]:
    people = await build_customers(business_id)
    off = {u["email"] async for u in db.message_unsubscribes.find({"business_id": business_id}, {"email": 1})}
    chosen, no_email, unsub, seen = [], 0, 0, set()
    for c in people.values():
        if aud.tag and aud.tag not in c["tags"]:
            continue
        m = c["membership"] or {}
        if aud.kind == "orders" and not c["orders"]:
            continue
        if aud.kind == "members" and not m:
            continue
        if aud.kind == "active_members" and m.get("status") != "active":
            continue
        if aud.kind == "bookings" and not c["bookings"]:
            continue
        if aud.kind == "lapsed" and not is_lapsed(c, aud.days):
            continue
        email = (c["email"] or "").strip().lower()
        if not email or "@" not in email:
            no_email += 1
            continue
        if email in off:
            unsub += 1
            continue
        if email in seen:
            continue
        seen.add(email)
        chosen.append({"email": email, "name": c["name"]})
    return {"recipients": chosen, "in_group": len(chosen) + no_email + unsub, "no_email": no_email, "unsubscribed": unsub}


async def _sent_this_month(business_id: str) -> int:
    start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    n = 0
    async for m in db.business_messages.find({"business_id": business_id, "created_at": {"$gte": start}}, {"recipients": 1}):
        n += m.get("recipients", 0)
    return n


@router.post("/businesses/{business_id}/messages/preview")
async def preview(business_id: str, aud: Audience, user=Depends(verify_token)):
    await _owned(business_id, user)
    r = await _recipients(business_id, aud)
    used = await _sent_this_month(business_id)
    return {"will_receive": len(r["recipients"]), "in_group": r["in_group"], "no_email": r["no_email"],
            "unsubscribed": r["unsubscribed"], "max_per_send": MAX_PER_SEND,
            "left_this_month": max(0, MONTHLY_CAP - used), "monthly_cap": MONTHLY_CAP}


# ---------------------------------------------------------------------------
# composing and sending
# ---------------------------------------------------------------------------

# A ready-made message (occasions) marks the parts the business must write
# itself in square brackets. Nothing is sent while one is left.
_UNFILLED = re.compile(r"\[[^\]\n]{3,}\]")


class MessageIn(BaseModel):
    subject: str = Field(..., min_length=2, max_length=120)
    body: str = Field(..., min_length=2, max_length=5000)
    promo: bool = False
    lang: Literal["en", "he"] = "en"
    audience: Audience = Field(default_factory=Audience)


def _subject_line(m: MessageIn) -> str:
    s = _subject(m.subject)
    if m.promo:
        s = f"{'פרסומת' if m.lang == 'he' else 'Advertisement'}: {s}"
    return s


def _html(biz: dict[str, Any], m: MessageIn, unsub: Optional[str]) -> str:
    he = m.lang == "he"
    d, side = ("rtl", "right") if he else ("ltr", "left")
    name = html.escape((he and biz.get("name_he")) or biz.get("name") or "")
    body = html.escape(m.body.strip()).replace("\n", "<br>")
    page = f"{_frontend_url()}/business/{biz.get('slug') or biz['_id']}"
    why = (f"קיבלתם את ההודעה כי אתם לקוחות של {name}." if he else f"You are receiving this because you are a customer of {name}.")
    off = ("להסרה מרשימת התפוצה" if he else "Unsubscribe")
    logo = f'<img src="{html.escape(biz["logo_url"])}" alt="" width="48" height="48" style="border-radius:10px;display:block;margin-bottom:12px;">' if biz.get("logo_url") else ""
    foot = (f'{why}<br><a href="{html.escape(unsub)}" style="color:#666;">{off}</a>' if unsub
            else ("זוהי הודעת ניסיון ששלחתם לעצמכם." if he else "This is a test you sent yourself."))
    return f"""<!DOCTYPE html><html lang="{m.lang}" dir="{d}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body dir="{d}" style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 14px;"><tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #E3E3E3;border-radius:14px;">
<tr><td style="padding:28px 30px 8px;text-align:{side};">{logo}<div style="font-size:18px;font-weight:700;">{name}</div></td></tr>
<tr><td style="padding:8px 30px 26px;text-align:{side};font-size:15px;line-height:1.65;">{body}</td></tr>
<tr><td style="padding:0 30px 26px;text-align:{side};"><a href="{page}" style="color:#167AB8;font-weight:600;text-decoration:none;">{'לעמוד של' if he else 'Visit'} {name}</a></td></tr>
<tr><td style="padding:16px 30px;border-top:1px solid #E3E3E3;text-align:center;font-size:12px;color:#666;line-height:1.6;">{foot}</td></tr>
</table></td></tr></table></body></html>"""


async def _owner_email(biz: dict[str, Any]) -> Optional[str]:
    u = await db.users.find_one({"id": biz["owner_user_id"]}, {"email": 1})
    return (u or {}).get("email")


def _check_filled(m: MessageIn) -> None:
    if _UNFILLED.search(m.subject) or _UNFILLED.search(m.body):
        raise HTTPException(status_code=400, detail="Replace the parts in square brackets with your own words first")


@router.post("/businesses/{business_id}/messages/test")
async def send_test(business_id: str, m: MessageIn, request: Request, user=Depends(verify_token)):
    check_rate(request, bucket="messages_test", limit=20, window_seconds=3600)
    biz = await _owned(business_id, user)
    # To whoever pressed the button: the owner, or the staff member.
    to = ((await db.users.find_one({"id": user["user_id"]}, {"email": 1})) or {}).get("email")
    if not to:
        raise HTTPException(status_code=400, detail="Your account has no email to send the test to")
    from utils.email import send_email
    ok = await send_email(to, f"[TEST] {_subject_line(m)}", _html(biz, m, None), tag="business-message-test",
                          from_name=biz.get("name"), message_stream="outbound")
    return {"sent": ok, "to": to}


async def _deliver(msg_id: str, biz: dict[str, Any], m: MessageIn, recipients: list[dict[str, Any]], reply_to: Optional[str]) -> None:
    from utils.email import send_email
    sent = failed = 0
    subject = _subject_line(m)
    for r in recipients:
        # Not sent to anyone who unsubscribed while the send was running.
        if await db.message_unsubscribes.find_one({"business_id": biz["_id"], "email": r["email"]}, {"_id": 1}):
            continue
        unsub = unsubscribe_url(biz["_id"], r["email"])
        api_unsub = unsub.replace(f"{_frontend_url()}/unsubscribe/", f"{_frontend_url()}/api/marketplace/messages/unsubscribe/")
        ok = await send_email(
            r["email"], subject, _html(biz, m, unsub), tag="business-message", message_stream="broadcast",
            from_name=biz.get("name"), reply_to=reply_to,
            headers={"List-Unsubscribe": f"<{api_unsub}>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"},
        )
        sent += ok
        failed += not ok
    await db.business_messages.update_one({"_id": msg_id}, {"$set": {"status": "sent", "sent": sent, "failed": failed,
                                                                     "finished_at": datetime.now(timezone.utc).isoformat()}})
    logger.info("[messages] business=%s message=%s sent=%d failed=%d", biz["_id"], msg_id, sent, failed)


@router.post("/businesses/{business_id}/messages")
async def send_message(business_id: str, m: MessageIn, user=Depends(verify_token)):
    biz = await _owned(business_id, user)
    _check_filled(m)
    day_ago = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    if await db.business_messages.count_documents({"business_id": business_id, "created_at": {"$gte": day_ago}}) >= SENDS_PER_DAY:
        raise HTTPException(status_code=429, detail=f"You can send up to {SENDS_PER_DAY} messages a day. Try again tomorrow.")
    r = await _recipients(business_id, m.audience)
    rec = r["recipients"]
    if not rec:
        raise HTTPException(status_code=400, detail="No one in this group has an email address to send to")
    if len(rec) > MAX_PER_SEND:
        raise HTTPException(status_code=400, detail=f"That is {len(rec)} people. A message can go to up to {MAX_PER_SEND} at a time: pick a smaller group or a tag.")
    left = MONTHLY_CAP - await _sent_this_month(business_id)
    if len(rec) > left:
        raise HTTPException(status_code=400, detail=f"This month you can still send to {max(left, 0)} people. The allowance renews on the 1st.")
    now = datetime.now(timezone.utc).isoformat()
    doc = {"_id": str(uuid.uuid4()), "business_id": business_id, "by": user["user_id"], "subject": m.subject, "body": m.body,
           "promo": m.promo, "lang": m.lang, "audience": m.audience.model_dump(), "recipients": len(rec),
           "status": "sending", "sent": 0, "failed": 0, "created_at": now}
    await db.business_messages.insert_one(doc)
    spawn(_deliver(doc["_id"], biz, m, rec, await _owner_email(biz)))
    return {"id": doc["_id"], "recipients": len(rec), "status": "sending"}


@router.get("/businesses/{business_id}/messages")
async def list_messages(business_id: str, user=Depends(verify_token)):
    await _owned(business_id, user)
    rows = await db.business_messages.find({"business_id": business_id}).sort("created_at", -1).to_list(50)
    return [{"id": x["_id"], "subject": x["subject"], "promo": x.get("promo"), "audience": x.get("audience"),
             "recipients": x.get("recipients", 0), "sent": x.get("sent", 0), "failed": x.get("failed", 0),
             "status": x.get("status"), "created_at": x.get("created_at")} for x in rows]


async def ensure_message_indexes() -> None:
    await db.message_unsubscribes.create_index([("business_id", 1), ("email", 1)], unique=True)
    await db.business_messages.create_index([("business_id", 1), ("created_at", -1)])
