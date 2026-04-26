"""Auto-extracted from server.py during the 2026-04 refactor."""
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException

from models import NotificationPreferences
from routes.deps import db, verify_token

router = APIRouter()
api_router = router  # alias so existing @api_router decorators work verbatim


@api_router.post("/notifications/preferences")
async def set_notification_preferences(prefs: NotificationPreferences, payload: dict = Depends(verify_token)) -> dict:
    pref_doc = prefs.model_dump()
    pref_doc['user_id'] = payload['user_id']
    pref_doc['created_at'] = datetime.now(UTC).isoformat()
    
    await db.notification_preferences.update_one(
        {"user_id": payload['user_id']},
        {"$set": pref_doc},
        upsert=True
    )
    
    return {"message": "Preferences saved successfully"}


@api_router.get("/notifications")
async def get_notifications(payload: dict = Depends(verify_token)) -> list[dict]:
    notifications = await db.notifications.find(
        {"user_id": payload['user_id']},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return notifications


@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, payload: dict = Depends(verify_token)) -> dict:
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": payload['user_id']},
        {"$set": {"read": True}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification marked as read"}


@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(payload: dict = Depends(verify_token)) -> dict:
    """Mark all notifications as read"""
    await db.notifications.update_many(
        {"user_id": payload['user_id'], "read": False},
        {"$set": {"read": True}}
    )
    return {"message": "All notifications marked as read"}


@api_router.delete("/notifications/clear-all")
async def clear_all_notifications(payload: dict = Depends(verify_token)) -> dict:
    """Delete all notifications for the current user"""
    result = await db.notifications.delete_many(
        {"user_id": payload['user_id']}
    )
    return {"message": f"{result.deleted_count} notifications cleared"}
