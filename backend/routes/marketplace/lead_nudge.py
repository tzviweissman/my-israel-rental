"""Never miss a lead (Tzvi, 11 Nov 2026).

A customer who wrote and heard nothing for WAIT_MINUTES gets the business
a nudge: one bell and one email to the owner listing who is waiting, each
with a reply Claude drafted from the business's own facts
(utils/lead_assist.py). The owner opens the leads board, reads the draft,
changes what they like and presses Send. Nothing goes to a customer on its
own: the automatic "we got your message" is away_reply.py, and it is the
owner's choice.

  * Which enquiries: cards in "new" on the leads board (leads.py) from a
    chat on the site or an email to the business's address
    (email_inbox.py), where the customer wrote last, WAIT_MINUTES to
    MAX_AGE_HOURS ago.
  * Once per customer message: `lead_nudges`, unique on (business, card,
    the customer's last message time), claimed before anything is sent. A
    new message from the same customer can nudge again.
  * At most one nudge email per business every EMAIL_GAP_HOURS; between
    them the cards simply wait for the next one.
  * Not at night (DAY_START to DAY_END Israel time) and not while the
    business is closed for Shabbat (shabbat.py), if it closes.
  * On for every business; the owner can switch it off (businesses.lead_nudge.off).

Also here, for the board itself: a draft on demand for any new card
(POST .../leads/draft) and sending a card's reply (POST .../leads/reply),
which for a chat posts in the chat as the owner and for an email sends it
through email_inbox.send_reply.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from routes.deps import db, logger, verify_token

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

IL = ZoneInfo("Asia/Jerusalem")
WAIT_MINUTES = 60
MAX_AGE_HOURS = 72
EMAIL_GAP_HOURS = 3
DAY_START, DAY_END = 8, 21
MAX_PER_EMAIL = 5
LOOP_SECONDS = 600
SOURCES = ("chat", "email")


# --------------------------------------------------------------------------
# Pure
# --------------------------------------------------------------------------
def waiting(cards: list[dict[str, Any]], now: datetime) -> list[dict[str, Any]]:
    """The cards worth a nudge now, oldest first. Pure."""
    lo = (now - timedelta(hours=MAX_AGE_HOURS)).isoformat()
    hi = (now - timedelta(minutes=WAIT_MINUTES)).isoformat()
    out = [c for c in cards if c.get("stage") == "new" and c.get("source") in SOURCES
           and c.get("last_from_customer") and lo <= (c.get("last_at") or "") <= hi]
    return sorted(out, key=lambda c: c.get("last_at") or "")


def daytime(now: datetime) -> bool:
    return DAY_START <= now.astimezone(IL).hour < DAY_END


def nudge_id(business_id: str, card: dict[str, Any]) -> str:
    return f"{business_id}|{card['key']}|{card.get('last_at') or ''}"


# --------------------------------------------------------------------------
# Drafts for chat cards
# --------------------------------------------------------------------------
def _chat_parts(key: str) -> tuple[str, str]:
    """("chat:<gig>:<customer>") -> (gig, customer)."""
    _, gig, customer = key.split(":", 2)
    return gig, customer


async def chat_messages(biz: dict[str, Any], gig_id: str, customer: str) -> list[dict[str, Any]]:
    owner = biz.get("owner_user_id")
    return await db.messages.find(
        {"property_id": gig_id, "$or": [{"sender_id": owner, "receiver_id": customer},
                                        {"sender_id": customer, "receiver_id": owner}]},
        {"_id": 0, "sender_id": 1, "message": 1, "created_at": 1, "auto": 1},
    ).sort("created_at", 1).to_list(200)


async def make_chat_draft(biz: dict[str, Any], card: dict[str, Any]) -> str | None:
    gig_id, customer = _chat_parts(card["key"])
    gig = await db.marketplace_gigs.find_one({"_id": gig_id, "business_id": biz["_id"]}, {"title": 1})
    if not gig:
        return None
    msgs = [m for m in await chat_messages(biz, gig_id, customer) if not m.get("auto")]
    from utils.lead_assist import draft_for_chat
    text = await draft_for_chat(db, biz, gig.get("title") or "", msgs)
    if text:
        await db.lead_drafts.update_one(
            {"_id": f"{biz['_id']}|{card['key']}"},
            {"$set": {"business_id": biz["_id"], "key": card["key"], "text": text,
                      "for_last_at": card.get("last_at"), "at": datetime.now(UTC).isoformat()}}, upsert=True)
    return text


async def attach_drafts(business_id: str, cards: list[dict[str, Any]]) -> None:
    """Puts each chat card's draft on it, if one was made for the customer's
    latest message (an older draft answers something else)."""
    keys = [c["key"] for c in cards if c.get("source") == "chat" and c.get("stage") == "new"]
    if not keys:
        return
    drafts = {d["key"]: d async for d in db.lead_drafts.find({"business_id": business_id, "key": {"$in": keys}})}
    for c in cards:
        d = drafts.get(c["key"])
        if d and d.get("for_last_at") == c.get("last_at"):
            c["draft"] = d.get("text")


# --------------------------------------------------------------------------
# The pass
# --------------------------------------------------------------------------
async def _candidates(now: datetime) -> set[str]:
    """Businesses with a customer message or email in the window: the only
    ones worth building a board for."""
    lo = (now - timedelta(hours=MAX_AGE_HOURS)).isoformat()
    gig_ids = await db.messages.distinct("property_id", {"created_at": {"$gte": lo}})
    out = set(await db.marketplace_gigs.distinct("business_id", {"_id": {"$in": gig_ids}})) if gig_ids else set()
    out |= set(await db.inbox_emails.distinct("business_id", {"received_at": {"$gte": lo}, "replied_at": None}))
    return {b for b in out if b}


async def run_once(now: datetime | None = None) -> int:
    """One pass. Returns the number of nudge emails sent."""
    now = now or datetime.now(UTC)
    if not daytime(now):
        return 0
    from routes.marketplace.leads import leads_board
    from routes.marketplace.shabbat import closed_at
    sent = 0
    for bid in await _candidates(now):
        biz = await db.businesses.find_one({"_id": bid})
        if not biz or not biz.get("owner_user_id") or (biz.get("lead_nudge") or {}).get("off"):
            continue
        try:
            if closed_at(biz, now):
                continue
        except Exception:  # noqa: BLE001
            pass
        last = (biz.get("lead_nudge") or {}).get("last_email_at")
        if last and last > (now - timedelta(hours=EMAIL_GAP_HOURS)).isoformat():
            continue
        try:
            board = await leads_board(bid, {"user_id": biz["owner_user_id"]})
        except Exception as e:  # noqa: BLE001
            logger.warning("[lead-nudge] board for %s failed: %s", bid, e)
            continue
        claimed = []
        for c in waiting(board["leads"], now):
            if len(claimed) >= MAX_PER_EMAIL:
                break
            try:
                await db.lead_nudges.insert_one({"_id": nudge_id(bid, c), "business_id": bid, "at": now})
            except DuplicateKeyError:
                continue
            claimed.append(c)
        if not claimed:
            continue
        for c in claimed:
            if c["source"] == "chat" and not c.get("draft"):
                try:
                    c["draft"] = await make_chat_draft(biz, c)
                except Exception as e:  # noqa: BLE001
                    logger.warning("[lead-nudge] draft failed: %s", e)
        await db.businesses.update_one({"_id": bid}, {"$set": {"lead_nudge.last_email_at": now.isoformat()}})
        if await _tell_owner(biz, claimed, board["counts"].get("new", len(claimed)), now):
            sent += 1
    return sent


COPY = {
    "en": {
        "subject_one": "A customer is waiting for your answer",
        "subject": "{n} customers are waiting for your answer",
        "lead": "Answering within the hour wins most jobs. We wrote a reply for each one from what your page says. Read it, change anything, and press Send.",
        "asked": "They wrote",
        "draft": "Suggested reply",
        "go": "Review and send",
        "someone": "A customer",
        "bell_one": "A customer is waiting for your answer",
        "bell": "{n} customers are waiting for your answer",
        "off": "You get this when someone waits over an hour. To stop it, switch off \"Remind me about waiting customers\" on your leads board.",
    },
    "he": {
        "subject_one": "לקוח מחכה לתשובה שלכם",
        "subject": "{n} לקוחות מחכים לתשובה שלכם",
        "lead": "מי שעונה תוך שעה זוכה ברוב העבודות. כתבנו תשובה לכל אחד לפי מה שכתוב בעמוד שלכם. קראו, שנו מה שתרצו ולחצו שליחה.",
        "asked": "הם כתבו",
        "draft": "תשובה מוצעת",
        "go": "לבדוק ולשלוח",
        "someone": "לקוח",
        "bell_one": "לקוח מחכה לתשובה שלכם",
        "bell": "{n} לקוחות מחכים לתשובה שלכם",
        "off": "המייל הזה נשלח כשמישהו מחכה יותר משעה. כדי להפסיק, כבו את \"תזכירו לי על לקוחות שמחכים\" בלוח הפניות.",
    },
}


def nudge_email(cards: list[dict[str, Any]], total: int, lang: str, link: str) -> tuple[str, str]:
    """(subject, html) of the nudge. Pure apart from the email helpers."""
    from utils.email import _button, _esc, _wrap
    c = COPY["he" if lang == "he" else "en"]
    n = max(total, len(cards))
    subject = c["subject_one"] if n == 1 else c["subject"].format(n=n)
    side = "right" if lang == "he" else "left"
    rows = []
    for card in cards:
        said = card.get("last_text") or card.get("title") or ""
        block = (f'<div style="border:1px solid #E3E3E3;border-radius:12px;padding:14px 16px;margin:0 0 12px 0;text-align:{side};">'
                 f'<div style="font-weight:700;color:#111827;">{_esc(card.get("name") or c["someone"])}</div>'
                 f'<div style="color:#666666;font-size:13px;margin-top:2px;">{_esc(c["asked"])}: <span dir="auto">{_esc(said[:200])}</span></div>')
        if card.get("draft"):
            block += (f'<div style="margin-top:10px;font-size:12px;color:#666666;">{_esc(c["draft"])}</div>'
                      f'<div dir="auto" style="background:#F9FAFB;border-radius:8px;padding:10px 12px;margin-top:4px;color:#111827;font-size:14px;line-height:1.5;">'
                      f'{_esc(card["draft"][:600]).replace(chr(10), "<br>")}</div>')
        rows.append(block + "</div>")
    inner = (f'<h1 style="font-size:20px;margin:0 0 10px 0;color:#111827;text-align:{side};">{_esc(subject)}</h1>'
             f'<p style="color:#444;font-size:14px;line-height:1.6;text-align:{side};">{_esc(c["lead"])}</p>'
             + "".join(rows) + _button(_esc(c["go"]), link, color="#000000")
             + f'<p style="color:#888;font-size:12px;text-align:{side};">{_esc(c["off"])}</p>')
    return subject, _wrap(inner, preheader=_esc(c["lead"]), lang="he" if lang == "he" else "en")


async def _tell_owner(biz: dict[str, Any], cards: list[dict[str, Any]], total: int, now: datetime) -> bool:
    owner = await db.users.find_one({"id": biz["owner_user_id"]}, {"email": 1, "preferred_language": 1}) or {}
    lang = "he" if str(owner.get("preferred_language") or "").startswith("he") else "en"
    c = COPY[lang]
    n = max(total, len(cards))
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()), "user_id": biz["owner_user_id"], "type": "lead_waiting",
        "message": c["bell_one"] if n == 1 else c["bell"].format(n=n),
        "action_url": "/dashboard?tab=customers&view=leads", "read": False, "created_at": now.isoformat()})
    if not owner.get("email"):
        return False
    from utils.email import FRONTEND_URL, send_email
    subject, body = nudge_email(cards, total, lang, f"{FRONTEND_URL}/dashboard?tab=customers&view=leads")
    return await send_email(owner["email"], subject, body, tag="lead_nudge")


async def lead_nudge_loop() -> None:
    await asyncio.sleep(180)
    while True:
        try:
            n = await run_once()
            if n:
                logger.info("[lead-nudge] sent %s", n)
        except Exception as e:  # noqa: BLE001
            logger.warning("[lead-nudge] pass failed: %s", e)
        await asyncio.sleep(LOOP_SECONDS)


# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------
async def _access(business_id: str, user: dict[str, Any], perm: str | None = "customers") -> dict[str, Any]:
    from utils.business_access import business_access
    return await business_access(db, business_id, user, perm)


class NudgeIn(BaseModel):
    on: bool


@router.put("/businesses/{business_id}/lead-nudge")
async def put_nudge(business_id: str, body: NudgeIn, user=Depends(verify_token)):
    await _access(business_id, user, None)
    await db.businesses.update_one({"_id": business_id}, {"$set": {"lead_nudge.off": not body.on}})
    return {"on": body.on}


async def _card(business_id: str, user: dict[str, Any], key: str) -> dict[str, Any]:
    from routes.marketplace.leads import leads_board
    board = await leads_board(business_id, user)
    card = next((c for c in board["leads"] if c["key"] == key), None)
    if not card:
        raise HTTPException(status_code=404, detail="Lead not found")
    return card


class KeyIn(BaseModel):
    key: str = Field(..., max_length=200)


@router.post("/businesses/{business_id}/leads/draft")
async def draft(business_id: str, body: KeyIn, user=Depends(verify_token)):
    biz = await _access(business_id, user)
    card = await _card(business_id, user, body.key)
    if card["source"] == "email":
        from routes.marketplace.email_inbox import redraft
        return await redraft(business_id, card["email_id"], user)
    if card["source"] != "chat":
        raise HTTPException(status_code=400, detail="Suggested replies are for chats and emails.")
    text = await make_chat_draft(biz, card)
    if not text:
        raise HTTPException(status_code=429, detail="That is today's limit of suggested replies. Write this one yourself, or try tomorrow.")
    return {"draft": text}


class ReplyIn(BaseModel):
    key: str = Field(..., max_length=200)
    text: str = Field(..., min_length=1, max_length=8000)
    subject: str | None = Field(None, max_length=200)


@router.post("/businesses/{business_id}/leads/reply")
async def reply(business_id: str, body: ReplyIn, user=Depends(verify_token)):
    biz = await _access(business_id, user)
    card = await _card(business_id, user, body.key)
    if card["source"] == "email":
        from routes.marketplace.email_inbox import send_reply
        subject = (body.subject or card.get("draft_subject") or f"Re: {card.get('subject') or ''}").strip()
        await send_reply(biz, card["email_id"], subject, body.text, user["user_id"])
        return {"ok": True}
    if card["source"] != "chat":
        raise HTTPException(status_code=400, detail="Open this lead to answer it.")
    gig_id, customer = _chat_parts(card["key"])
    owner = biz["owner_user_id"]
    at = datetime.now(UTC).isoformat()
    text = body.text.strip()
    # The same message, bell and email as one the owner types in the chat (routes/chat.py).
    await db.messages.insert_one({"id": str(uuid.uuid4()), "property_id": gig_id, "sender_id": owner, "receiver_id": customer,
                                  "message": text, "image_url": None, "video_url": None, "mentions": [],
                                  "created_at": at, "read": False})
    try:
        from routes.marketplace.shared import record_chat_reply
        await record_chat_reply(gig_id, owner, customer, at)
    except Exception as e:  # noqa: BLE001
        logger.warning("reply badge from leads board failed: %s", e)
    await db.notifications.insert_one({"id": str(uuid.uuid4()), "user_id": customer, "type": "new_message",
                                       "property_id": gig_id, "sender_id": owner, "message": "You have a new message",
                                       "read": False, "created_at": at})
    from routes.chat import _send_chat_email_safe
    from utils.bg_tasks import spawn
    spawn(_send_chat_email_safe(sender_id=owner, receiver_id=customer, property_id=gig_id,
                                message_body=text, image_url=None, video_url=None))
    await db.lead_drafts.delete_one({"_id": f"{business_id}|{card['key']}"})
    return {"ok": True}


async def ensure_nudge_indexes() -> None:
    await db.lead_nudges.create_index("at", expireAfterSeconds=60 * 60 * 24 * 14)
    await db.lead_drafts.create_index([("business_id", 1), ("key", 1)])
    await db.messages.create_index("created_at")
