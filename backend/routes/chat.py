"""Auto-extracted from server.py during the 2026-04 refactor."""
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends

from models import ChatMessage
from routes.deps import db, verify_token

router = APIRouter()
api_router = router  # alias so existing @api_router decorators work verbatim


@api_router.post("/chat/messages")
async def send_message(chat_data: ChatMessage, payload: dict = Depends(verify_token)) -> Any:
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
        "message": "You have a new message",
        "read": False,
        "created_at": datetime.now(UTC).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"id": message_id, "message": "Message sent successfully"}


@api_router.get("/chat/messages/{property_id}")
async def get_messages(property_id: str, payload: dict = Depends(verify_token)) -> Any:
    messages = await db.messages.find(
        {
            "property_id": property_id,
            "$or": [
                {"sender_id": payload['user_id']},
                {"receiver_id": payload['user_id']}
            ]
        },
        {"_id": 0}
    ).sort("created_at", 1).to_list(1000)
    
    await db.messages.update_many(
        {"property_id": property_id, "receiver_id": payload['user_id']},
        {"$set": {"read": True}}
    )
    
    return messages


@api_router.get("/chat/conversations")
async def get_conversations(payload: dict = Depends(verify_token)) -> Any:
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
            other_user = await db.users.find_one({"id": other_user_id}, {"_id": 0, "name": 1, "email": 1})
            
            conversations[conv_key] = {
                "property_id": msg['property_id'],
                "property_title": property_data.get('title', 'Unknown') if property_data else 'Unknown',
                "other_user": other_user if other_user else {},
                "last_message": msg['message'],
                "last_message_time": msg['created_at'],
                "unread": not msg['read'] and msg['receiver_id'] == payload['user_id']
            }
    
    return list(conversations.values())
