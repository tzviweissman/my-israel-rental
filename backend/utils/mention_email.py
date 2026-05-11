"""Background task: email users about unread @-mentions.

When someone is @-mentioned in a chat message (``@owner`` / ``@renter`` /
``@manager``) we already mark it on the message document at write-time
(``mentions: [...]``). If the mentioned recipient does not open the chat
within ~10 minutes, we send them a Postmark email so they know to come
back. This bridges the in-app bell to the recipient's inbox.

Design notes:
  * Idempotent — once we send an email for a given message we set
    ``mention_email_sent: True`` on it. We also set the flag for false
    positives (e.g. an "@manager" sent to a renter) so we don't re-scan
    them forever.
  * Cheap — runs every 2 minutes, queries only messages that have a
    non-empty mentions array AND are still unread AND lack the sent flag.
  * Sublease-aware fallback — if the receiver looks like the sublessor of
    an active sublease on the property, they are treated as ``owner`` for
    mention resolution.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from routes.deps import db
from utils.email import send_mention_notification_email
from utils.mentions import current_user_role_in_property

logger = logging.getLogger("server")

# How long an unread mention must sit before we email the recipient.
_DELAY_MINUTES = 10
# Loop sleep between scans.
_SLEEP_SECONDS = 120


async def _resolve_role_for_receiver(
    receiver_id: str, property_id: str
) -> str | None:
    """Resolve which mention token the receiver responds to.

    Returns 'owner', 'renter', or None when we can't determine.
    Sublease participants who are the sublessor of an active sublease on
    this property are treated as 'owner' (mirrors the inbox highlight
    logic in chat.get_conversations).
    """
    prop = await db.properties.find_one(
        {"id": property_id}, {"_id": 0, "owner_id": 1}
    )
    if not prop:
        return None
    # Sublease fallback: if there's an active sublease on this property
    # and the receiver is its sublessor, they're the "owner" of this thread.
    sublease = await db.subleases.find_one(
        {"property_id": property_id, "active": True, "subleasor_id": receiver_id},
        {"_id": 0, "subleasor_id": 1},
    )
    return current_user_role_in_property(receiver_id, prop, sublease)


async def _process_message(msg: dict[str, Any]) -> None:
    """Resolve receiver/sender/property and either email + flag, or just flag."""
    message_id = msg["id"]
    receiver_id = msg.get("receiver_id")
    property_id = msg.get("property_id")
    if not receiver_id or not property_id:
        # Malformed — mark as handled so we don't keep retrying.
        await db.messages.update_one(
            {"id": message_id}, {"$set": {"mention_email_sent": True}}
        )
        return

    role = await _resolve_role_for_receiver(receiver_id, property_id)
    mentions = msg.get("mentions") or []

    # If the recipient's role isn't in the mention set, swallow and flag.
    if not role or role not in mentions:
        await db.messages.update_one(
            {"id": message_id}, {"$set": {"mention_email_sent": True}}
        )
        return

    receiver = await db.users.find_one(
        {"id": receiver_id},
        {"_id": 0, "email": 1, "name": 1},
    )
    if not receiver or not receiver.get("email"):
        await db.messages.update_one(
            {"id": message_id}, {"$set": {"mention_email_sent": True}}
        )
        return

    sender = await db.users.find_one(
        {"id": msg.get("sender_id")},
        {"_id": 0, "name": 1, "email": 1},
    )
    sender_name = (sender or {}).get("name") or "Someone"

    prop = await db.properties.find_one(
        {"id": property_id}, {"_id": 0, "title": 1, "area": 1}
    )
    property_title = (prop or {}).get("title") or "your conversation"

    sent = await send_mention_notification_email(
        to_email=receiver["email"],
        receiver_name=receiver.get("name") or "",
        sender_name=sender_name,
        role_mentioned=role,
        message_snippet=msg.get("message") or "",
        property_id=property_id,
        property_title=property_title,
        sender_id=msg.get("sender_id") or "",
    )

    # Even if Postmark returned False (e.g. suppressed recipient) flag the
    # message — there's no point retrying the same suppression on every loop.
    await db.messages.update_one(
        {"id": message_id},
        {
            "$set": {
                "mention_email_sent": True,
                "mention_email_sent_at": datetime.now(UTC).isoformat(),
                "mention_email_delivered": bool(sent),
            }
        },
    )


async def scan_once() -> int:
    """One pass over the messages collection. Returns count of emails attempted."""
    cutoff = (datetime.now(UTC) - timedelta(minutes=_DELAY_MINUTES)).isoformat()
    query: dict[str, Any] = {
        "mentions": {"$exists": True, "$ne": []},
        "read": False,
        "created_at": {"$lte": cutoff},
        "$or": [
            {"mention_email_sent": {"$exists": False}},
            {"mention_email_sent": False},
        ],
    }
    # Cap each pass so a backlog doesn't block the loop.
    docs = await db.messages.find(query, {"_id": 0}).limit(50).to_list(50)
    for msg in docs:
        try:
            await _process_message(msg)
        except Exception as e:  # noqa: BLE001
            logger.error(
                "mention email task: failed to process message %s: %s",
                msg.get("id"),
                e,
            )
    return len(docs)


async def mention_email_loop() -> None:
    """Background task: scan for unread mentions every 2 minutes."""
    while True:
        try:
            n = await scan_once()
            if n:
                logger.info("Mention-email scan processed %d message(s)", n)
        except Exception as e:  # noqa: BLE001
            logger.error("mention email background loop error: %s", e)
        await asyncio.sleep(_SLEEP_SECONDS)
