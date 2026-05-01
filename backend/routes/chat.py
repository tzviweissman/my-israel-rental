"""Auto-extracted from server.py during the 2026-04 refactor."""
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends

from models import ChatMessage
from models_response import ConversationOut, IdMessageResponse, MessageOut
from routes.deps import db, verify_token

router = APIRouter()
api_router = router  # alias so existing @api_router decorators work verbatim


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
