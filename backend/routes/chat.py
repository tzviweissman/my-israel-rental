"""Auto-extracted from server.py during the 2026-04 refactor."""
import asyncio
import logging
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException

from models import ChatMessage, EditMessage, TranslateMessageRequest, TypingPing
from models_response import (
    ConversationOut,
    IdMessageResponse,
    MessageOut,
    MessageResponse,
    TranslatedMessageResponse,
    TypingStatusResponse,
)
from routes.deps import db, verify_token
from utils.chat_translate import detect_language, translate_chat_message
from utils.email import send_chat_message_email
from utils.mentions import current_user_role_in_property, extract_mentions

router = APIRouter()
api_router = router  # alias so existing @api_router decorators work verbatim

logger = logging.getLogger(__name__)

# How long a typing ping is considered "live" for the counterparty.
_TYPING_TTL_SECONDS = 5


@api_router.post("/chat/messages", response_model=IdMessageResponse)
async def send_message(chat_data: ChatMessage, payload: dict = Depends(verify_token)) -> dict:
    message_id = str(uuid.uuid4())
    mentions = extract_mentions(chat_data.message)
    # Image-only / video-only messages are allowed — but message must be
    # non-empty if no media is attached.
    has_media = bool(chat_data.image_url or chat_data.video_url)
    if not chat_data.message.strip() and not has_media:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    message_doc = {
        "id": message_id,
        "property_id": chat_data.property_id,
        "sender_id": payload['user_id'],
        "receiver_id": chat_data.receiver_id,
        "message": chat_data.message,
        "image_url": chat_data.image_url,
        "video_url": chat_data.video_url,
        # Stored at write-time so the inbox can flag unread @-mentions of the
        # current user without re-scanning every message body on each fetch.
        "mentions": mentions,
        "created_at": datetime.now(UTC).isoformat(),
        "read": False
    }
    
    await db.messages.insert_one(message_doc)
    
    # Notification body adapts to what was sent — image vs video vs text.
    if chat_data.message.strip():
        notif_body = "You have a new message"
    elif chat_data.video_url:
        notif_body = "Sent you a video 🎬"
    elif chat_data.image_url:
        notif_body = "Sent you a photo 📷"
    else:
        notif_body = "You have a new message"
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": chat_data.receiver_id,
        "type": "new_message",
        "property_id": chat_data.property_id,
        # Capture the sender so the lister can deep-link straight into the
        # conversation (knowing who they are replying to).
        "sender_id": payload['user_id'],
        "message": notif_body,
        "read": False,
        "created_at": datetime.now(UTC).isoformat()
    }
    await db.notifications.insert_one(notification)

    # Fire-and-forget email to the recipient. We don't await it so the HTTP
    # response stays snappy; Postmark calls run on a worker thread inside
    # send_email() itself.
    asyncio.create_task(
        _send_chat_email_safe(
            sender_id=payload["user_id"],
            receiver_id=chat_data.receiver_id,
            property_id=chat_data.property_id,
            message_body=chat_data.message,
            image_url=chat_data.image_url,
            video_url=chat_data.video_url,
        )
    )

    return {"id": message_id, "message": "Message sent successfully"}


async def _recipient_is_actively_in_chat(
    *, sender_id: str, receiver_id: str, property_id: str, window_seconds: int = 120
) -> bool:
    """Did the recipient open/read a message from this sender in the last N
    seconds? If so they're already inside the conversation and we shouldn't
    pile on with a "new message" email."""
    cutoff = (datetime.now(UTC) - timedelta(seconds=window_seconds)).isoformat()
    recent = await db.messages.find_one(
        {
            "property_id": property_id,
            "sender_id": sender_id,
            "receiver_id": receiver_id,
            "read": True,
            "read_at": {"$gte": cutoff},
        },
        {"_id": 0, "id": 1},
    )
    return bool(recent)


async def _was_recently_emailed(
    *, sender_id: str, receiver_id: str, property_id: str, window_seconds: int = 300
) -> bool:
    """Did we already email this recipient for this conversation in the last
    N seconds? Throttles bursts so a 20-message exchange doesn't generate
    20 emails."""
    cutoff = (datetime.now(UTC) - timedelta(seconds=window_seconds)).isoformat()
    last = await db.chat_email_throttle.find_one(
        {
            "receiver_id": receiver_id,
            "sender_id": sender_id,
            "property_id": property_id,
            "sent_at": {"$gte": cutoff},
        },
        {"_id": 0, "sent_at": 1},
    )
    return bool(last)


async def _send_chat_email_safe(
    *,
    sender_id: str,
    receiver_id: str,
    property_id: str,
    message_body: str,
    image_url: str | None,
    video_url: str | None = None,
) -> None:
    """Resolve sender/receiver/property and email the recipient. Swallows all
    errors — chat sends must never fail because of an email problem."""
    try:
        if not receiver_id or sender_id == receiver_id:
            return

        # Rule A: throttle so a rapid back-and-forth doesn't spam inboxes.
        if await _was_recently_emailed(
            sender_id=sender_id, receiver_id=receiver_id, property_id=property_id
        ):
            return

        # Rule B: skip if the recipient is actively reading this conversation.
        if await _recipient_is_actively_in_chat(
            sender_id=sender_id, receiver_id=receiver_id, property_id=property_id
        ):
            return

        receiver = await db.users.find_one(
            {"id": receiver_id}, {"_id": 0, "email": 1, "name": 1}
        )
        if not receiver or not receiver.get("email"):
            return
        sender = await db.users.find_one(
            {"id": sender_id}, {"_id": 0, "name": 1}
        )
        sender_name = (sender or {}).get("name") or "Someone"
        prop = await db.properties.find_one(
            {"id": property_id}, {"_id": 0, "title": 1}
        )
        property_title = (prop or {}).get("title") or "your conversation"

        sent = await send_chat_message_email(
            to_email=receiver["email"],
            receiver_name=receiver.get("name") or "",
            sender_name=sender_name,
            message_snippet=message_body or "",
            has_image=bool(image_url) or bool(video_url),
            property_id=property_id,
            property_title=property_title,
            sender_id=sender_id,
        )

        # Record the send (even on Postmark failure) so we still throttle —
        # otherwise a permanently-bouncing inbox would retry every message.
        await db.chat_email_throttle.update_one(
            {
                "receiver_id": receiver_id,
                "sender_id": sender_id,
                "property_id": property_id,
            },
            {
                "$set": {
                    "sent_at": datetime.now(UTC).isoformat(),
                    "delivered": bool(sent),
                }
            },
            upsert=True,
        )
    except Exception as e:  # noqa: BLE001 - never let chat sends fail
        logger.error("chat email task failed: %s", e)


@api_router.delete("/chat/messages/{message_id}", response_model=MessageResponse)
async def delete_message(
    message_id: str, payload: dict = Depends(verify_token)
) -> dict:
    """Hard-delete a single message. Only the sender may delete their own.

    Both participants stop seeing the message after this. Notifications are
    not affected — the recipient may have already opened the chat."""
    msg = await db.messages.find_one({"id": message_id}, {"_id": 0, "sender_id": 1})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.get("sender_id") != payload['user_id']:
        raise HTTPException(status_code=403, detail="You can only delete your own messages")
    await db.messages.delete_one({"id": message_id})
    return {"message": "Message deleted"}


# Edit window (seconds): callers may amend their own message for the first 5
# minutes after sending, mirroring WhatsApp/Slack-style etiquette.
_EDIT_WINDOW_SECONDS = 5 * 60


@api_router.put("/chat/messages/{message_id}", response_model=MessageResponse)
async def edit_message(
    message_id: str,
    body: EditMessage,
    payload: dict = Depends(verify_token),
) -> dict:
    """Edit a single message body. Sender-only, within the 5-minute window.

    Sets ``edited_at`` so the UI can render an *edited* tag. Stale cached
    translations are wiped so the next translate request re-runs Claude."""
    if not body.message or not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    msg = await db.messages.find_one(
        {"id": message_id},
        {"_id": 0, "sender_id": 1, "created_at": 1},
    )
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.get("sender_id") != payload['user_id']:
        raise HTTPException(status_code=403, detail="You can only edit your own messages")
    try:
        created = datetime.fromisoformat(msg['created_at'])
    except (KeyError, ValueError):
        raise HTTPException(status_code=400, detail="Message timestamp invalid") from None
    age = (datetime.now(UTC) - created).total_seconds()
    if age > _EDIT_WINDOW_SECONDS:
        raise HTTPException(
            status_code=400,
            detail=f"Edit window expired ({_EDIT_WINDOW_SECONDS // 60} minutes after sending)",
        )
    now_iso = datetime.now(UTC).isoformat()
    new_text = body.message.strip()
    await db.messages.update_one(
        {"id": message_id},
        {
            "$set": {
                "message": new_text,
                "edited_at": now_iso,
                # Re-extract mentions on edit so removing/adding "@owner" in
                # an edit is reflected in the inbox flag.
                "mentions": extract_mentions(new_text),
            },
            # Cached translations no longer match the new content
            "$unset": {"translations": ""},
        },
    )
    return {"message": "Message updated"}


@api_router.get("/chat/messages/{property_id}", response_model=list[MessageOut])
async def get_messages(
    property_id: str,
    with_user: str | None = None,
    payload: dict = Depends(verify_token),
) -> list[dict]:
    user_id = payload['user_id']
    # Default: all messages this user has on the property (legacy behaviour for renters
    # who only ever talk to the owner). Owners may have multiple renters per property,
    # so the frontend can pin the conversation to a single counterparty via `with_user`.
    if with_user:
        query: dict = {
            "property_id": property_id,
            "$or": [
                {"sender_id": user_id, "receiver_id": with_user},
                {"sender_id": with_user, "receiver_id": user_id},
            ],
        }
    else:
        query = {
            "property_id": property_id,
            "$or": [
                {"sender_id": user_id},
                {"receiver_id": user_id},
            ],
        }
    messages = await db.messages.find(query, {"_id": 0}).sort("created_at", 1).to_list(1000)

    mark_filter: dict = {"property_id": property_id, "receiver_id": user_id}
    if with_user:
        mark_filter["sender_id"] = with_user
    # Stamp read_at so the chat-email throttle can detect "recipient is
    # actively in the chat" and suppress noisy emails on fast exchanges.
    await db.messages.update_many(
        {**mark_filter, "read": {"$ne": True}},
        {"$set": {"read": True, "read_at": datetime.now(UTC).isoformat()}},
    )
    
    return messages


@api_router.get("/chat/conversations", response_model=list[ConversationOut])
async def get_conversations(payload: dict = Depends(verify_token)) -> list[dict]:
    messages = await db.messages.find(
        {"$or": [{"sender_id": payload['user_id']}, {"receiver_id": payload['user_id']}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    conversations = {}
    for msg in messages:
        other_user_id = msg['receiver_id'] if msg['sender_id'] == payload['user_id'] else msg['sender_id']
        conv_key = f"{msg['property_id']}_{other_user_id}"

        if conv_key not in conversations:
            property_data = await db.properties.find_one({"id": msg['property_id']}, {"_id": 0, "title": 1, "owner_id": 1})
            other_user = await db.users.find_one({"id": other_user_id}, {"_id": 0, "id": 1, "name": 1, "email": 1})

            # Was the CURRENT user @-mentioned by their counterpart in the
            # last message? Only true when (a) the message wasn't sent by
            # me and (b) my role-token appears in the message's stored
            # mentions list. Drives the inbox bell + gold ring.
            my_role = current_user_role_in_property(payload['user_id'], property_data)
            sent_by_me = msg['sender_id'] == payload['user_id']
            mentions_me = bool(
                not sent_by_me and my_role and my_role in (msg.get('mentions') or [])
            )

            conversations[conv_key] = {
                "property_id": msg['property_id'],
                "property_title": property_data.get('title', 'Unknown') if property_data else 'Unknown',
                "other_user": other_user if other_user else {},
                "last_message": msg['message'],
                "last_message_time": msg['created_at'],
                "last_message_from_me": sent_by_me,
                "last_message_mentions_me": mentions_me,
                "unread": not msg['read'] and msg['receiver_id'] == payload['user_id']
            }

    return list(conversations.values())



@api_router.post("/chat/typing", response_model=MessageResponse)
async def post_typing(ping: TypingPing, payload: dict = Depends(verify_token)) -> dict:
    """Record that the caller is typing in the (property, with_user) thread.
    Upserted with the current timestamp; counterparty polls
    ``GET /chat/typing/{property_id}?with_user=…`` and treats anything within
    the TTL window as actively typing."""
    user_id = payload['user_id']
    await db.typing.update_one(
        {"property_id": ping.property_id, "user_id": user_id, "target_user": ping.with_user},
        {"$set": {"updated_at": datetime.now(UTC).isoformat()}},
        upsert=True,
    )
    return {"message": "ok"}


@api_router.get("/chat/typing/{property_id}", response_model=TypingStatusResponse)
async def get_typing(
    property_id: str,
    with_user: str,
    payload: dict = Depends(verify_token),
) -> dict:
    """Return whether ``with_user`` is currently typing to the caller in
    ``property_id``. A ping older than ``_TYPING_TTL_SECONDS`` is ignored."""
    cutoff = (datetime.now(UTC) - timedelta(seconds=_TYPING_TTL_SECONDS)).isoformat()
    doc = await db.typing.find_one(
        {
            "property_id": property_id,
            "user_id": with_user,
            "target_user": payload['user_id'],
            "updated_at": {"$gte": cutoff},
        },
        {"_id": 0, "updated_at": 1},
    )
    return {"typing": doc is not None}



@api_router.post(
    "/chat/messages/{message_id}/translate",
    response_model=TranslatedMessageResponse,
)
async def translate_message(
    message_id: str,
    body: TranslateMessageRequest,
    payload: dict = Depends(verify_token),
) -> dict:
    """Translate a single chat message into ``target_lang`` ('en' or 'he').

    The result is cached on the message document so subsequent reads are
    instant. Only participants in the conversation may call this."""
    if body.target_lang not in ("en", "he"):
        raise HTTPException(status_code=400, detail="target_lang must be 'en' or 'he'")

    msg = await db.messages.find_one({"id": message_id}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    user_id = payload['user_id']
    if user_id not in (msg.get('sender_id'), msg.get('receiver_id')):
        raise HTTPException(status_code=403, detail="Not a participant in this conversation")

    cached = (msg.get('translations') or {}).get(body.target_lang)
    source_lang = detect_language(msg.get('message', ''))
    if cached:
        return {
            "message_id": message_id,
            "source_lang": source_lang,
            "target_lang": body.target_lang,
            "translated_text": cached,
        }

    translated = await translate_chat_message(msg['message'], body.target_lang)
    await db.messages.update_one(
        {"id": message_id},
        {"$set": {f"translations.{body.target_lang}": translated}},
    )
    return {
        "message_id": message_id,
        "source_lang": source_lang,
        "target_lang": body.target_lang,
        "translated_text": translated,
    }
