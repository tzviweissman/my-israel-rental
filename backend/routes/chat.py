"""Auto-extracted from server.py during the 2026-04 refactor."""
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException

from models import ChatMessage, TranslateMessageRequest, TypingPing
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

router = APIRouter()
api_router = router  # alias so existing @api_router decorators work verbatim

# How long a typing ping is considered "live" for the counterparty.
_TYPING_TTL_SECONDS = 5


@api_router.post("/chat/messages", response_model=IdMessageResponse)
async def send_message(chat_data: ChatMessage, payload: dict = Depends(verify_token)) -> dict:
    message_id = str(uuid.uuid4())
    message_doc = {
        "id": message_id,
        "property_id": chat_data.property_id,
        "sender_id": payload['user_id'],
        "receiver_id": chat_data.receiver_id,
        "message": chat_data.message,
        "created_at": datetime.now(UTC).isoformat(),
        "read": False
    }
    
    await db.messages.insert_one(message_doc)
    
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": chat_data.receiver_id,
        "type": "new_message",
        "property_id": chat_data.property_id,
        # Capture the sender so the lister can deep-link straight into the
        # conversation (knowing who they are replying to).
        "sender_id": payload['user_id'],
        "message": "You have a new message",
        "read": False,
        "created_at": datetime.now(UTC).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"id": message_id, "message": "Message sent successfully"}


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
    await db.messages.update_many(mark_filter, {"$set": {"read": True}})
    
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
            property_data = await db.properties.find_one({"id": msg['property_id']}, {"_id": 0, "title": 1})
            other_user = await db.users.find_one({"id": other_user_id}, {"_id": 0, "id": 1, "name": 1, "email": 1})
            
            conversations[conv_key] = {
                "property_id": msg['property_id'],
                "property_title": property_data.get('title', 'Unknown') if property_data else 'Unknown',
                "other_user": other_user if other_user else {},
                "last_message": msg['message'],
                "last_message_time": msg['created_at'],
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
