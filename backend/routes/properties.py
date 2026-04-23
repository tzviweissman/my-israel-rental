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
from routes.deps import db, logger, verify_token, create_token, EMERGENT_LLM_KEY, POSTMARK_WEBHOOK_SECRET, ROOT_DIR, UPLOAD_DIR
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


@api_router.post("/properties")
async def create_property(property_data: PropertyCreate, payload = Depends(verify_token)):
    property_id = str(uuid.uuid4())
    property_doc = property_data.model_dump()
    property_doc['id'] = property_id
    property_doc['owner_id'] = payload['user_id']
    property_doc['created_at'] = datetime.now(timezone.utc).isoformat()
    property_doc['views'] = 0
    property_doc['status'] = 'active'
    
    await db.properties.insert_one(property_doc)

    # Fire saved-search alerts (non-blocking)
    try:
        asyncio.create_task(match_property_against_searches(
            db, property_id, reason="new_listing", send_email_fn=send_email,
        ))
    except Exception as e:
        logger.warning(f"saved-search trigger failed (create): {e}")

    return {"id": property_id, "message": "Property created successfully"}


@api_router.get("/properties")
async def get_properties(
    rental_type: Optional[str] = None,
    min_bedrooms: Optional[float] = None,
    max_price: Optional[float] = None,
    area: Optional[str] = None,
    owner_id: Optional[str] = None,
    min_price: Optional[float] = None,
    currency: Optional[str] = None,
    min_bathrooms: Optional[float] = None,
    max_floor: Optional[float] = None,
    min_porches: Optional[int] = None,
    has_elevator: Optional[bool] = None,
    condition: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    query = {}
    if rental_type:
        query['rental_type'] = rental_type
    if min_bedrooms:
        query['bedrooms'] = {"$gte": min_bedrooms}
    if area:
        query['area'] = {"$regex": area, "$options": "i"}
    if owner_id:
        query['owner_id'] = owner_id
    if min_bathrooms:
        query['bathrooms'] = {"$gte": min_bathrooms}
    if max_floor is not None:
        query['floor'] = {"$lte": max_floor}
    if min_porches:
        query['porches'] = {"$gte": min_porches}
    if has_elevator is not None:
        query['has_elevator'] = has_elevator
    if condition:
        query['condition'] = condition
    
    properties = await db.properties.find(query, {"_id": 0}).to_list(1000)
    
    # Cross-currency price filtering
    if min_price or max_price:
        rate = await get_usd_ils_rate()
        filtered = []
        for p in properties:
            # Use whichever price the property has
            raw_price = p.get('monthly_price') or p.get('nightly_price') or 0
            prop_currency = p.get('currency', 'ILS')
            # Convert property price to the filter currency
            if currency and prop_currency != currency:
                if currency == 'USD' and prop_currency == 'ILS':
                    price_in_filter_currency = raw_price / rate
                elif currency == 'ILS' and prop_currency == 'USD':
                    price_in_filter_currency = raw_price * rate
                else:
                    price_in_filter_currency = raw_price
            else:
                price_in_filter_currency = raw_price
            if min_price and price_in_filter_currency < min_price:
                continue
            if max_price and price_in_filter_currency > max_price:
                continue
            filtered.append(p)
        properties = filtered
    
    # Filter out properties that have overlapping bookings for requested dates
    if date_from and date_to:
        booked_property_ids = set()
        overlapping_bookings = await db.bookings.find(
            {
                "status": {"$in": ["pending", "confirmed"]},
                "start_date": {"$lt": date_to},
                "end_date": {"$gt": date_from}
            },
            {"_id": 0, "property_id": 1}
        ).to_list(10000)
        for b in overlapping_bookings:
            booked_property_ids.add(b['property_id'])
        # Also check external iCal bookings
        external_overlaps = await db.external_bookings.find(
            {
                "start_date": {"$lt": date_to},
                "end_date": {"$gt": date_from}
            },
            {"_id": 0, "property_id": 1}
        ).to_list(10000)
        for b in external_overlaps:
            booked_property_ids.add(b['property_id'])
        properties = [p for p in properties if p['id'] not in booked_property_ids]
    
    return properties


@api_router.get("/properties/{property_id}")
async def get_property(property_id: str):
    property_data = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    await db.properties.update_one({"id": property_id}, {"$inc": {"views": 1}})
    property_data['views'] = property_data.get('views', 0) + 1
    
    owner = await db.users.find_one({"id": property_data.get("owner_id")}, {"_id": 0, "name": 1, "email": 1})
    if owner:
        property_data['owner_name'] = owner.get('name', '')
        property_data['owner_email'] = owner.get('email', '')
    
    return property_data


@api_router.put("/properties/{property_id}")
async def update_property(property_id: str, property_data: PropertyCreate, payload = Depends(verify_token)):
    existing = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if existing['owner_id'] != payload['user_id'] and payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_doc = property_data.model_dump()
    await db.properties.update_one({"id": property_id}, {"$set": update_doc})

    # Fire saved-search alerts when price drops or listing re-activates
    try:
        old_price = existing.get("monthly_price") or existing.get("nightly_price")
        new_price = update_doc.get("monthly_price") or update_doc.get("nightly_price")
        old_status = existing.get("status")
        new_status = update_doc.get("status", old_status)
        reason = None
        if old_status != "active" and new_status == "active":
            reason = "reactivated"
        elif old_price and new_price and float(new_price) < float(old_price):
            reason = "price_drop"
        if reason:
            asyncio.create_task(match_property_against_searches(
                db, property_id, reason=reason, send_email_fn=send_email,
            ))
    except Exception as e:
        logger.warning(f"saved-search trigger failed (update): {e}")

    return {"message": "Property updated successfully"}


@api_router.delete("/properties/{property_id}")
async def delete_property(property_id: str, payload = Depends(verify_token)):
    existing = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if existing['owner_id'] != payload['user_id'] and payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.properties.delete_one({"id": property_id})
    return {"message": "Property deleted successfully"}


# --- Saved Searches (renter availability alerts) ---


@api_router.post("/properties/{property_id}/like")
async def toggle_like_property(property_id: str, payload=Depends(verify_token)):
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    existing_like = await db.liked_properties.find_one({
        "user_id": payload['user_id'],
        "property_id": property_id
    })

    if existing_like:
        await db.liked_properties.delete_one({"user_id": payload['user_id'], "property_id": property_id})
        return {"liked": False, "message": "Property removed from favorites"}
    else:
        await db.liked_properties.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": payload['user_id'],
            "property_id": property_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        return {"liked": True, "message": "Property saved to favorites"}



@api_router.get("/liked-properties")
async def get_liked_properties(payload=Depends(verify_token)):
    likes = await db.liked_properties.find(
        {"user_id": payload['user_id']}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)

    property_ids = [like['property_id'] for like in likes]
    if not property_ids:
        return []

    properties = await db.properties.find(
        {"id": {"$in": property_ids}}, {"_id": 0}
    ).to_list(500)

    # Preserve order from likes
    prop_map = {p['id']: p for p in properties}
    result = []
    for pid in property_ids:
        if pid in prop_map:
            prop_map[pid]['liked'] = True
            result.append(prop_map[pid])
    return result



@api_router.get("/liked-property-ids")
async def get_liked_property_ids(payload=Depends(verify_token)):
    likes = await db.liked_properties.find(
        {"user_id": payload['user_id']}, {"_id": 0, "property_id": 1}
    ).to_list(500)
    return [like['property_id'] for like in likes]


@api_router.post("/properties/{property_id}/contract")
async def upload_property_contract(
    property_id: str,
    file: UploadFile = File(...),
    payload=Depends(verify_token)
):
    """Upload contract for a property (owner/manager only)"""
    # Verify property exists and user is owner
    property_data = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if property_data['owner_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if property is long-term or short-term
    rental_type = property_data.get('rental_type', '')
    if rental_type not in ['long-term', 'short-term']:
        raise HTTPException(status_code=400, detail="Contracts only available for long-term and short-term rentals")
    
    # Validate file type (PDF and image formats)
    ALLOWED_TYPES = [
        'application/pdf',
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif'
    ]
    if not file.content_type or file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only PDF and image files (JPG, PNG, WEBP, HEIC) are allowed for contracts")
    
    # Save file
    UPLOAD_DIR = ROOT_DIR / "uploads"
    UPLOAD_DIR.mkdir(exist_ok=True)
    file_id = str(uuid.uuid4())
    
    # Get file extension from content type
    extension_map = {
        'application/pdf': 'pdf',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/heic': 'heic',
        'image/heif': 'heif'
    }
    ext = extension_map.get(file.content_type, 'pdf')
    filename = f"contract_{file_id}.{ext}"
    file_path = UPLOAD_DIR / filename
    
    size = 0
    MAX_CONTRACT_SIZE = 10 * 1024 * 1024  # 10MB
    with open(file_path, "wb") as f:
        while chunk := await file.read(1024 * 256):
            size += len(chunk)
            if size > MAX_CONTRACT_SIZE:
                f.close()
                file_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="Contract file too large. Max 10MB")
            f.write(chunk)
    
    contract_url = f"/api/uploads/{filename}"
    
    # Update property with contract URL
    await db.properties.update_one(
        {"id": property_id},
        {"$set": {
            "contract_url": contract_url,
            "contract_uploaded_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    # Retroactively send the contract to any already-confirmed bookings that
    # haven't had one yet (owner accepted the booking BEFORE uploading a contract)
    pending_bookings = await db.bookings.find({
        "property_id": property_id,
        "status": "confirmed",
        "contract_signed": {"$ne": True},
        "contract_sign_token": {"$in": [None, ""]},
    }, {"_id": 0}).to_list(500)

    notified_count = 0
    for bk in pending_bookings:
        sign_token = str(uuid.uuid4())
        await db.bookings.update_one(
            {"id": bk["id"]},
            {"$set": {
                "contract_sign_token": sign_token,
                "contract_sent_at": datetime.now(timezone.utc).isoformat(),
                "contract_signed": False,
            }}
        )
        # Notify renter
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": bk["renter_id"],
            "type": "contract_pending",
            "booking_id": bk["id"],
            "property_id": property_id,
            "message": f"The owner has uploaded a contract for {property_data.get('title', 'your booking')}. Please sign it to finalize your rental.",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        # Email the renter
        try:
            renter = await db.users.find_one({"id": bk["renter_id"]}, {"_id": 0, "email": 1, "name": 1})
            if renter and renter.get("email"):
                frontend = os.environ.get("FRONTEND_URL", "").rstrip("/")
                dashboard_link = f"{frontend}/dashboard?tab=bookings" if frontend else "/dashboard"
                html = f"""
                <p>Hi {renter.get('name','there')},</p>
                <p>The owner of <strong>{property_data.get('title', 'your rental')}</strong> has uploaded the rental contract.
                Please review and sign it to finalize your booking.</p>
                <p><a href="{dashboard_link}" style="background:#1E6A6A;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;">Open your dashboard to sign</a></p>
                """
                asyncio.create_task(send_email(
                    renter["email"],
                    f"Action needed: sign your rental contract — {property_data.get('title', 'My Israel Rental')}",
                    html,
                    tag="contract-pending",
                ))
        except Exception as e:
            logger.warning(f"Failed to queue contract-pending email for booking {bk['id']}: {e}")
        notified_count += 1

    return {
        "contract_url": contract_url,
        "message": "Contract uploaded successfully",
        "retroactive_notifications_sent": notified_count,
    }



@api_router.get("/properties/{property_id}/contract")
async def get_property_contract(property_id: str):
    """Get contract details for a property"""
    property_data = await db.properties.find_one(
        {"id": property_id}, 
        {"_id": 0, "contract_url": 1, "contract_uploaded_at": 1, "rental_type": 1}
    )
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    return {
        "has_contract": bool(property_data.get('contract_url')),
        "contract_url": property_data.get('contract_url'),
        "uploaded_at": property_data.get('contract_uploaded_at'),
        "rental_type": property_data.get('rental_type')
    }



@api_router.delete("/properties/{property_id}/contract")
async def delete_property_contract(property_id: str, payload=Depends(verify_token)):
    """Delete contract for a property"""
    property_data = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if property_data['owner_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Delete file from disk
    if property_data.get('contract_url'):
        filename = property_data['contract_url'].split('/')[-1]
        file_path = ROOT_DIR / "uploads" / filename
        file_path.unlink(missing_ok=True)
    
    # Remove from database
    await db.properties.update_one(
        {"id": property_id},
        {"$unset": {"contract_url": "", "contract_uploaded_at": ""}}
    )
    
    return {"message": "Contract deleted successfully"}


@api_router.get("/manager/{manager_id}/properties")
async def get_manager_properties(manager_id: str):
    properties = await db.properties.find({"owner_id": manager_id}, {"_id": 0}).to_list(1000)
    manager = await db.users.find_one({"id": manager_id, "role": {"$in": ["manager", "owner"]}}, {"_id": 0, "password": 0})
    
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")
    
    return {
        "manager": manager,
        "properties": properties
    }
