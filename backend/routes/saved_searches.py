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
from typing import List, Optional

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


@api_router.post("/saved-searches")
async def create_saved_search(body: SavedSearchCreate, payload=Depends(verify_token)):
    """Renter subscribes to an availability alert for a given criteria+dates.
    Auto-expires after 60 days. Requires sign-in."""
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0, "email": 1, "name": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    filters = body.filters.model_dump()
    # Derive a name if the user didn't provide one
    name = body.name
    if not name:
        parts = []
        if filters.get("area"):
            parts.append(filters["area"])
        if filters.get("rental_type"):
            parts.append(filters["rental_type"].replace("-", " ").title())
        if filters.get("bedrooms_min"):
            parts.append(f"{filters['bedrooms_min']}+ BR")
        if filters.get("max_price"):
            parts.append(f"≤ {int(filters['max_price']):,}")
        if filters.get("start_date") and filters.get("end_date"):
            parts.append(f"{filters['start_date']} → {filters['end_date']}")
        name = " · ".join(parts) or "My alert"

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=60)
    search_id = str(uuid.uuid4())

    # Dedupe: if the exact same filters already exist & are active, return it
    existing = await db.saved_searches.find_one({
        "user_id": payload['user_id'],
        "filters": filters,
        "active": True,
        "expires_at": {"$gt": now.isoformat()},
    }, {"_id": 0})
    if existing:
        return {"id": existing["id"], "message": "Alert already active", "existing": True}

    await db.saved_searches.insert_one({
        "id": search_id,
        "user_id": payload['user_id'],
        "email": user.get("email"),
        "user_name": user.get("name", ""),
        "name": name,
        "filters": filters,
        "date_fuzziness_days": int(body.date_fuzziness_days or 30),
        "active": True,
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
    })
    return {"id": search_id, "message": "Alert saved", "expires_at": expires_at.isoformat()}



@api_router.get("/saved-searches")
async def list_saved_searches(payload=Depends(verify_token)):
    """List the current user's active saved searches (newest first)."""
    now = datetime.now(timezone.utc).isoformat()
    rows = await db.saved_searches.find(
        {"user_id": payload['user_id'], "active": True, "expires_at": {"$gt": now}},
        {"_id": 0},
    ).sort("created_at", -1).to_list(200)
    return rows



@api_router.delete("/saved-searches/{search_id}")
async def delete_saved_search(search_id: str, payload=Depends(verify_token)):
    """Renter deletes (deactivates) a saved search."""
    search = await db.saved_searches.find_one({"id": search_id}, {"_id": 0})
    if not search:
        raise HTTPException(status_code=404, detail="Saved search not found")
    if search['user_id'] != payload['user_id'] and payload.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.saved_searches.delete_one({"id": search_id})
    return {"message": "Alert removed"}



# --- Liked Properties ---
