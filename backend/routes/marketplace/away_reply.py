"""The "we got your message" reply (Tzvi, 24 Oct 2026, from GoHighLevel's
missed-call text back): a customer who writes to a business on the site
and hears nothing for a few minutes gets one friendly reply in the chat,
so they wait instead of going to the next business.

  * Off until the business switches it on (Customers tab). It speaks in
    the business's name, so the business chooses it; it can use its own
    words or ours, which are in the customer's language.
  * Only chats about the business's own listings (db.messages,
    property_id = a gig of the business), only when the customer wrote
    last and the business has not answered for DELAY_MINUTES.
  * Once per customer per business per day, and never twice for one
    message (`away_replies`, unique on the customer's message id, claimed
    before sending).
  * The reply is marked `auto: "away_reply"`. It is NOT the business
    answering: the leads board still shows the chat as new, and the reply
    badge still waits for the business's own first answer.
  * WhatsApp chats happen on WhatsApp, which the site cannot see.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from routes.deps import db, logger, verify_token

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

DELAY_MINUTES = 10
LOOK_BACK_MINUTES = 120       # a message older than this is left alone (e.g. after downtime)
ONCE_PER_HOURS = 24
LOOP_SECONDS = 60
AUTO = "away_reply"

DEFAULT_TEXT = {
    "en": "Thanks for your message! We've got it and will get back to you as soon as we can.",
    "he": "תודה על ההודעה! קיבלנו אותה ונחזור אליכם בהקדם.",
}


def reply_text(setting: dict[str, Any], lang: Optional[str]) -> str:
    own = (setting.get("text") or "").strip()
    if own:
        return own
    return DEFAULT_TEXT["he" if (lang or "").startswith("he") else "en"]


async def run_once(now: Optional[datetime] = None) -> int:
    """One pass over every business that has it on. Returns replies sent."""
    now = now or datetime.now(UTC)
    newest = (now - timedelta(minutes=DELAY_MINUTES)).isoformat()
    oldest = (now - timedelta(minutes=LOOK_BACK_MINUTES)).isoformat()
    sent = 0
    async for biz in db.businesses.find({"away_reply.on": True}, {"owner_user_id": 1, "away_reply": 1}):
        owner = biz.get("owner_user_id")
        gigs = [g["_id"] async for g in db.marketplace_gigs.find({"business_id": biz["_id"]}, {"_id": 1})]
        if not owner or not gigs:
            continue
        waiting = db.messages.find({"property_id": {"$in": gigs}, "receiver_id": owner, "sender_id": {"$ne": owner},
                                    "created_at": {"$gte": oldest, "$lte": newest}}).sort("created_at", 1)
        done: set[str] = set()
        async for m in waiting:
            customer = m["sender_id"]
            if customer in done:
                continue
            done.add(customer)
            # The business answered (itself, not this feature) since they wrote: nothing to do.
            if await db.messages.find_one({"property_id": m["property_id"], "sender_id": owner, "receiver_id": customer,
                                           "created_at": {"$gte": m["created_at"]}, "auto": {"$exists": False}}, {"_id": 1}):
                continue
            day_ago = (now - timedelta(hours=ONCE_PER_HOURS)).isoformat()
            if await db.messages.find_one({"property_id": {"$in": gigs}, "sender_id": owner, "receiver_id": customer,
                                           "auto": AUTO, "created_at": {"$gte": day_ago}}, {"_id": 1}):
                continue
            try:
                await db.away_replies.insert_one({"_id": m["id"], "business_id": biz["_id"], "at": now})
            except DuplicateKeyError:
                continue
            who = await db.users.find_one({"id": customer}, {"preferred_language": 1}) or {}
            await _send(m["property_id"], owner, customer, reply_text(biz["away_reply"], who.get("preferred_language")), now)
            sent += 1
    return sent


async def _send(gig_id: str, owner: str, customer: str, text: str, now: datetime) -> None:
    """A chat message from the business, the same shape and the same bell
    and email as one the owner types (routes/chat.py)."""
    at = now.isoformat()
    await db.messages.insert_one({"id": str(uuid.uuid4()), "property_id": gig_id, "sender_id": owner, "receiver_id": customer,
                                  "message": text, "image_url": None, "video_url": None, "mentions": [],
                                  "created_at": at, "read": False, "auto": AUTO})
    await db.notifications.insert_one({"id": str(uuid.uuid4()), "user_id": customer, "type": "new_message",
                                       "property_id": gig_id, "sender_id": owner, "message": "You have a new message",
                                       "read": False, "created_at": at})
    from routes.chat import _send_chat_email_safe
    await _send_chat_email_safe(sender_id=owner, receiver_id=customer, property_id=gig_id,
                                message_body=text, image_url=None, video_url=None)


async def away_reply_loop() -> None:
    await asyncio.sleep(120)
    while True:
        try:
            n = await run_once()
            if n:
                logger.info("[away-reply] sent %s", n)
        except Exception as e:  # noqa: BLE001
            logger.warning("[away-reply] pass failed: %s", e)
        await asyncio.sleep(LOOP_SECONDS)


class AwayIn(BaseModel):
    on: bool
    text: str = Field("", max_length=500)


@router.get("/businesses/{business_id}/away-reply")
async def get_away(business_id: str, user=Depends(verify_token)):
    from utils.business_access import business_access
    biz = await business_access(db, business_id, user, "customers")
    s = biz.get("away_reply") or {}
    return {"on": bool(s.get("on")), "text": s.get("text") or "", "minutes": DELAY_MINUTES,
            "sent": await db.away_replies.count_documents({"business_id": business_id})}


@router.put("/businesses/{business_id}/away-reply")
async def put_away(business_id: str, body: AwayIn, user=Depends(verify_token)):
    from utils.business_access import business_access
    await business_access(db, business_id, user, None)
    s = {"on": body.on, "text": body.text.strip()}
    await db.businesses.update_one({"_id": business_id}, {"$set": {"away_reply": s}})
    return s


async def ensure_away_indexes() -> None:
    await db.businesses.create_index("away_reply.on", sparse=True)
    await db.away_replies.create_index([("business_id", 1), ("at", -1)])
    await db.messages.create_index([("receiver_id", 1), ("created_at", 1)])
