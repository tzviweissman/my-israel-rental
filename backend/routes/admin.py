"""Auto-extracted from server.py during the 2026-04 refactor."""
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from models import SiteSettings
from routes.deps import POSTMARK_WEBHOOK_SECRET, db, logger, verify_token

router = APIRouter()
api_router = router  # alias so existing @api_router decorators work verbatim


@api_router.post("/webhooks/postmark")
async def postmark_webhook(request: Request, token: str | None = None) -> Any:
    """Receive delivery / bounce / spam-complaint events from Postmark.

    Configure the URL in Postmark → Servers → Message Streams → outbound →
    Webhooks as: {BACKEND_URL}/api/webhooks/postmark?token={POSTMARK_WEBHOOK_SECRET}
    Enable Delivery, Bounce, and SpamComplaint events.
    """
    # Optional shared-secret check (query param). If secret env is unset we accept anything.
    if POSTMARK_WEBHOOK_SECRET and token != POSTMARK_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid webhook token")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    record_type = payload.get("RecordType", "Unknown")
    message_id = payload.get("MessageID")
    tag = payload.get("Tag")

    # Postmark uses "Email" on Bounce/Complaint, "Recipient" on Delivery
    email = payload.get("Email") or payload.get("Recipient") or ""

    event_doc = {
        "id": str(uuid.uuid4()),
        "record_type": record_type,
        "email": email.lower() if email else "",
        "message_id": message_id,
        "tag": tag,
        "bounce_type": payload.get("Type"),  # HardBounce, SoftBounce, Transient, etc.
        "description": payload.get("Description") or payload.get("Details"),
        "raw": payload,
        "received_at": datetime.now(UTC).isoformat(),
    }
    await db.email_events.insert_one(event_doc)

    # Update the user's email health flag so admins can see deliverability state
    if email:
        status_map = {
            "Bounce": "bounced",
            "SpamComplaint": "complained",
            "Delivery": "delivered",
        }
        user_status = status_map.get(record_type)
        if user_status:
            update = {
                "email_status": user_status,
                "last_email_event_at": event_doc["received_at"],
                "last_email_event_type": record_type,
            }
            # Hard bounces and complaints should suppress future sends — track it
            if record_type in ("Bounce", "SpamComplaint"):
                update["email_suppressed"] = True
                if payload.get("Type") == "HardBounce" or record_type == "SpamComplaint":
                    update["email_suppressed_reason"] = (
                        payload.get("Description")
                        or payload.get("Details")
                        or f"{record_type} ({payload.get('Type', '')})".strip()
                    )
            elif record_type == "Delivery":
                # Clear suppression if a later delivery succeeds (rare but possible)
                update["email_suppressed"] = False
            await db.users.update_one({"email": email.lower()}, {"$set": update})

    logger.info(
        "Postmark webhook: %s for %s (tag=%s, msg=%s)",
        record_type, email, tag, message_id
    )
    return {"ok": True}



@api_router.get("/admin/email-health")
async def admin_email_health(payload: dict = Depends(verify_token)) -> Any:
    """Admin-only: email deliverability stats + recent events."""
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    # Aggregate counts by record_type for the last 30 days
    thirty_days_ago = (datetime.now(UTC) - timedelta(days=30)).isoformat()
    pipeline = [
        {"$match": {"received_at": {"$gte": thirty_days_ago}}},
        {"$group": {"_id": "$record_type", "count": {"$sum": 1}}},
    ]
    agg = await db.email_events.aggregate(pipeline).to_list(100)
    counts = {row["_id"]: row["count"] for row in agg}

    delivered = counts.get("Delivery", 0)
    bounced = counts.get("Bounce", 0)
    complained = counts.get("SpamComplaint", 0)
    total_attempts = delivered + bounced + complained
    delivery_rate = round((delivered / total_attempts) * 100, 1) if total_attempts else None

    recent = await db.email_events.find(
        {}, {"_id": 0, "raw": 0}
    ).sort("received_at", -1).limit(50).to_list(50)

    suppressed_users = await db.users.count_documents({"email_suppressed": True})

    return {
        "window_days": 30,
        "delivered": delivered,
        "bounced": bounced,
        "complained": complained,
        "delivery_rate_pct": delivery_rate,
        "suppressed_users": suppressed_users,
        "recent_events": recent,
    }


# --- Hot Reload Helper --------------------------------------------------

# Exchange rate cache
_exchange_cache = {"rate": None, "fetched_at": None}


@api_router.get("/admin/dashboard")
async def get_admin_dashboard(payload: dict = Depends(verify_token)) -> Any:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    total_properties = await db.properties.count_documents({"status": "active"})
    total_views = await db.properties.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$views"}}}
    ]).to_list(1)
    
    total_bookings = await db.bookings.count_documents({})
    total_users = await db.users.count_documents({})
    pending_services = await db.document_services.count_documents({"status": "pending"})
    
    recent_properties = await db.properties.find({}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    
    return {
        "active_listings": total_properties,
        "total_views": total_views[0]['total'] if total_views else 0,
        "total_inquiries": total_bookings,
        "total_users": total_users,
        "pending_services": pending_services,
        "recent_properties": recent_properties
    }


@api_router.get("/admin/users")
async def get_all_users(payload: dict = Depends(verify_token)) -> Any:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    users = await db.users.find({}, {"_id": 0, "password": 0}).sort("created_at", -1).to_list(1000)
    return users


@api_router.put("/admin/users/{user_id}/status")
async def update_user_status(user_id: str, payload: dict = Depends(verify_token)) -> Any:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    new_status = "blocked" if user.get("status", "active") == "active" else "active"
    await db.users.update_one({"id": user_id}, {"$set": {"status": new_status}})
    return {"message": f"User {new_status}", "status": new_status}


@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, payload: dict = Depends(verify_token)) -> Any:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    if user_id == payload['user_id']:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    await db.users.delete_one({"id": user_id})
    await db.properties.delete_many({"owner_id": user_id})
    return {"message": "User and their properties deleted"}


@api_router.get("/admin/properties")
async def get_all_properties_admin(payload: dict = Depends(verify_token)) -> Any:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    properties = await db.properties.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)

    # Pull every admin block in one go and group by property
    blocks_by_prop: dict = {}
    async for block in db.admin_blocks.find({}, {"_id": 0}):
        blocks_by_prop.setdefault(block["property_id"], []).append(block)

    now_iso = datetime.now(UTC).isoformat()

    for prop in properties:
        owner = await db.users.find_one({"id": prop.get("owner_id")}, {"_id": 0, "name": 1, "email": 1})
        prop["owner_name"] = owner.get("name", "Unknown") if owner else "Unknown"
        prop["owner_email"] = owner.get("email", "") if owner else ""

        prop_blocks = blocks_by_prop.get(prop["id"], [])
        # A block is "active" if its date window covers "now"
        # (indefinite = null end, or start_date null = open-ended past)
        active_blocks = []
        for b in prop_blocks:
            bs = b.get("start_date")
            be = b.get("end_date")
            if (bs is None or bs <= now_iso) and (be is None or be >= now_iso):
                active_blocks.append(b)
        prop["admin_blocks"] = prop_blocks
        prop["admin_blocked_now"] = len(active_blocks) > 0
        prop["active_admin_block"] = active_blocks[0] if active_blocks else None

    return properties


class AdminBlockIn(BaseModel):
    start_date: str | None = None  # ISO string; None => starts now
    end_date: str | None = None    # ISO string; None => indefinite
    indefinite: bool | None = False


@api_router.post("/admin/properties/{property_id}/mark-booked")
async def admin_mark_property_booked(
    property_id: str,
    block: AdminBlockIn,
    payload: dict = Depends(verify_token),
) -> Any:
    """Super-admin: block a property for a date range or indefinitely.

    The block is additive — existing renter bookings are NOT modified.
    When renters search with overlapping dates, the property is filtered out.
    """
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    prop = await db.properties.find_one({"id": property_id}, {"_id": 0, "id": 1})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    start = block.start_date or None
    end = None if block.indefinite else (block.end_date or None)

    # Validate that end_date > start_date if both provided
    if start and end and end <= start:
        raise HTTPException(status_code=400, detail="end_date must be after start_date")

    block_doc = {
        "id": str(uuid.uuid4()),
        "property_id": property_id,
        "start_date": start,
        "end_date": end,
        "indefinite": bool(block.indefinite) or end is None,
        "created_by": payload["user_id"],
        "created_at": datetime.now(UTC).isoformat(),
    }
    await db.admin_blocks.insert_one(block_doc)
    block_doc.pop("_id", None)
    return {"message": "Property marked as booked", "block": block_doc}


@api_router.get("/admin/properties/{property_id}/blocks")
async def admin_list_property_blocks(property_id: str, payload: dict = Depends(verify_token)) -> Any:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    blocks = await db.admin_blocks.find(
        {"property_id": property_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return blocks


@api_router.delete("/admin/properties/blocks/{block_id}")
async def admin_remove_block(block_id: str, payload: dict = Depends(verify_token)) -> Any:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await db.admin_blocks.delete_one({"id": block_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Block not found")
    return {"message": "Block removed"}


class BulkMarkBookedIn(BaseModel):
    property_ids: List[str]
    start_date: str | None = None
    end_date: str | None = None
    indefinite: bool | None = False


@api_router.post("/admin/properties/bulk-mark-booked")
async def admin_bulk_mark_booked(
    data: BulkMarkBookedIn,
    payload: dict = Depends(verify_token),
) -> Any:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    if not data.property_ids:
        raise HTTPException(status_code=400, detail="property_ids must not be empty")

    start = data.start_date or None
    end = None if data.indefinite else (data.end_date or None)
    if start and end and end <= start:
        raise HTTPException(status_code=400, detail="end_date must be after start_date")

    # Only insert blocks for properties that actually exist
    existing_ids = set()
    async for prop in db.properties.find(
        {"id": {"$in": data.property_ids}}, {"_id": 0, "id": 1}
    ):
        existing_ids.add(prop["id"])

    now = datetime.now(UTC).isoformat()
    docs = [
        {
            "id": str(uuid.uuid4()),
            "property_id": pid,
            "start_date": start,
            "end_date": end,
            "indefinite": bool(data.indefinite) or end is None,
            "created_by": payload["user_id"],
            "created_at": now,
        }
        for pid in data.property_ids
        if pid in existing_ids
    ]
    if docs:
        await db.admin_blocks.insert_many(docs)
    return {
        "message": f"{len(docs)} properties marked as booked",
        "created": len(docs),
        "skipped": len(data.property_ids) - len(docs),
    }


@api_router.put("/admin/properties/{property_id}/status")
async def toggle_property_status(property_id: str, payload: dict = Depends(verify_token)) -> Any:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    new_status = "inactive" if prop.get("status") == "active" else "active"
    await db.properties.update_one({"id": property_id}, {"$set": {"status": new_status}})
    return {"message": f"Property {new_status}", "status": new_status}


@api_router.get("/admin/chats")
async def get_all_chats(payload: dict = Depends(verify_token)) -> Any:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    messages = await db.messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    conversations = {}
    for msg in messages:
        conv_key = f"{msg['property_id']}_{min(msg['sender_id'], msg['receiver_id'])}_{max(msg['sender_id'], msg['receiver_id'])}"
        if conv_key not in conversations:
            prop = await db.properties.find_one({"id": msg["property_id"]}, {"_id": 0, "title": 1})
            sender = await db.users.find_one({"id": msg["sender_id"]}, {"_id": 0, "name": 1, "role": 1})
            receiver = await db.users.find_one({"id": msg["receiver_id"]}, {"_id": 0, "name": 1, "role": 1})
            conversations[conv_key] = {
                "property_id": msg["property_id"],
                "property_title": prop.get("title", "Unknown") if prop else "Unknown",
                "participants": [
                    {"id": msg["sender_id"], "name": sender.get("name", "Unknown") if sender else "Unknown", "role": sender.get("role", "") if sender else ""},
                    {"id": msg["receiver_id"], "name": receiver.get("name", "Unknown") if receiver else "Unknown", "role": receiver.get("role", "") if receiver else ""}
                ],
                "messages": [],
                "last_message_time": msg["created_at"]
            }
        conversations[conv_key]["messages"].append({
            "sender_id": msg["sender_id"],
            "message": msg["message"],
            "created_at": msg["created_at"]
        })
    
    return list(conversations.values())


@api_router.get("/admin/document-services")
async def get_all_document_services(payload: dict = Depends(verify_token)) -> Any:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    services = await db.document_services.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for svc in services:
        user = await db.users.find_one({"id": svc.get("user_id")}, {"_id": 0, "name": 1, "email": 1})
        svc["user_name"] = user.get("name", "Unknown") if user else "Unknown"
        svc["user_email"] = user.get("email", "") if user else ""
    return services


@api_router.put("/admin/document-services/{service_id}/status")
async def update_service_status(service_id: str, status: str, payload: dict = Depends(verify_token)) -> Any:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    if status not in ["pending", "in_progress", "completed", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    await db.document_services.update_one({"id": service_id}, {"$set": {"status": status}})
    return {"message": f"Service status updated to {status}"}


@api_router.get("/admin/settings")
async def get_site_settings(payload: dict = Depends(verify_token)) -> Any:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    settings = await db.site_settings.find_one({"key": "global"}, {"_id": 0})
    if not settings:
        return {"whatsapp_number": "", "contact_email": "", "contact_phone": "", "featured_property_ids": []}
    return settings


@api_router.put("/admin/settings")
async def update_site_settings(settings: SiteSettings, payload: dict = Depends(verify_token)) -> Any:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    settings_doc = settings.model_dump()
    settings_doc["key"] = "global"
    settings_doc["updated_at"] = datetime.now(UTC).isoformat()
    await db.site_settings.update_one({"key": "global"}, {"$set": settings_doc}, upsert=True)
    return {"message": "Settings updated successfully"}
