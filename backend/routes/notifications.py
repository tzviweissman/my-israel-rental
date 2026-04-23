"""Auto-extracted from server.py during the 2026-04 refactor."""
import asyncio
import base64
import json as _json
import logging
import os
import shutil
import uuid
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from typing import Any, List, Optional

import bcrypt
import httpx
from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel

from models import *
from routes.deps import db, logger, verify_token, create_token, EMERGENT_LLM_KEY, POSTMARK_WEBHOOK_SECRET, ROOT_DIR
from utils.email import (
    send_email,
    send_welcome_email,
    send_password_reset_email,
    send_booking_confirmation_email,
    send_booking_notification_email,
)
from utils.pdf import stamp_signature_on_document
from utils.saved_search import match_property_against_searches
from utils.helpers import get_usd_ils_rate, parse_ical_feed, sync_property_ical
from utils.files import extract_text_from_pdf, extract_text_from_docx, extract_text_from_image
from utils.translate import translate_text as _translate_text
from utils.contract_template import ensure_templates as ensure_contract_templates

from emergentintegrations.llm.chat import LlmChat, UserMessage

router = APIRouter()
api_router = router  # alias so existing @api_router decorators work verbatim


@api_router.post("/notifications/preferences")
async def set_notification_preferences(prefs: NotificationPreferences, payload: dict = Depends(verify_token)) -> Any:
    pref_doc = prefs.model_dump()
    pref_doc['user_id'] = payload['user_id']
    pref_doc['created_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.notification_preferences.update_one(
        {"user_id": payload['user_id']},
        {"$set": pref_doc},
        upsert=True
    )
    
    return {"message": "Preferences saved successfully"}


@api_router.get("/notifications")
async def get_notifications(payload: dict = Depends(verify_token)) -> Any:
    notifications = await db.notifications.find(
        {"user_id": payload['user_id']},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return notifications


@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, payload: dict = Depends(verify_token)) -> Any:
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": payload['user_id']},
        {"$set": {"read": True}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification marked as read"}


@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(payload: dict = Depends(verify_token)) -> Any:
    """Mark all notifications as read"""
    await db.notifications.update_many(
        {"user_id": payload['user_id'], "read": False},
        {"$set": {"read": True}}
    )
    return {"message": "All notifications marked as read"}


@api_router.delete("/notifications/clear-all")
async def clear_all_notifications(payload: dict = Depends(verify_token)) -> Any:
    """Delete all notifications for the current user"""
    result = await db.notifications.delete_many(
        {"user_id": payload['user_id']}
    )
    return {"message": f"{result.deleted_count} notifications cleared"}
