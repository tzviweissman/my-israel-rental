"""Auto-extracted from server.py during the 2026-04 refactor."""
import asyncio
import json
import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from models import SiteSettings
from models_response import (
    AdminBlockOut,
    AdminBulkMarkBookedResponse,
    AdminDashboardResponse,
    AdminEmailHealthResponse,
    AdminMarkBookedResponse,
    AdminToggleStatusResponse,
    AnyResponse,
    ConversationOut,
    MessageResponse,
    OkResponse,
    PropertyOut,
    ServiceRequestOut,
    ServiceRevenueResponse,
    SubscribersResponse,
    UserPublic,
)
from routes.deps import POSTMARK_WEBHOOK_SECRET, db, logger, verify_token
from routes.payments import SERVICE_PRETTY, VALID_DOC_SERVICES
from utils.auth import decode_query_token
from utils.events import publish, subscribe, subscriber_count, unsubscribe

router = APIRouter()
api_router = router  # alias so existing @api_router decorators work verbatim


# ---------------------------------------------------------------------------
# Live event channel for the admin dashboard.
# ---------------------------------------------------------------------------
# When any of the mutation handlers below run, they ``publish()`` a tiny
# event with the URL prefix the frontend should evict from its SWR cache.
# Other admins viewing the dashboard receive the event over SSE within a
# second and re-fetch only what changed — no 30 s polling.
#
# Token is passed via query string because EventSource cannot set custom
# headers. The token has the same lifetime / scope as the regular Bearer.

@api_router.get("/admin/events")
async def admin_events_stream(token: str) -> StreamingResponse:
    """SSE stream of cache-invalidation events for super admins."""
    payload = decode_query_token(token)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    async def gen() -> AsyncGenerator[str, None]:
        try:
            q = await subscribe()
        except RuntimeError:
            yield "event: error\ndata: too many subscribers\n\n"
            return
        try:
            # Initial hello — tells the client the stream is live.
            yield "event: hello\ndata: {}\n\n"
            while True:
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=20.0)
                    yield f"data: {json.dumps(msg)}\n\n"
                except TimeoutError:
                    # Periodic comment line keeps the connection open through
                    # idle proxies (kubernetes ingress, browsers, etc).
                    yield ": ping\n\n"
        except asyncio.CancelledError:
            raise
        finally:
            unsubscribe(q)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@api_router.get("/admin/events/health", response_model=SubscribersResponse)
async def admin_events_health(payload: dict = Depends(verify_token)) -> dict:
    """How many live admin SSE subscribers we currently have."""
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return {"subscribers": subscriber_count()}


@api_router.post("/webhooks/postmark", response_model=OkResponse)
async def postmark_webhook(request: Request, token: str | None = None) -> dict:
    """Receive delivery / bounce / spam-complaint events from Postmark.

    Configure the URL in Postmark → Servers → Message Streams → outbound →
    Webhooks as: {BACKEND_URL}/api/webhooks/postmark?token={POSTMARK_WEBHOOK_SECRET}
    Enable Delivery, Bounce, and SpamComplaint events.
    """
    _assert_webhook_token(token)
    payload = await _read_postmark_json(request)
    event_doc = _build_email_event(payload)
    await db.email_events.insert_one(event_doc)

    update = _user_email_update_from(event_doc, payload)
    if update and event_doc["email"]:
        await db.users.update_one({"email": event_doc["email"]}, {"$set": update})

    logger.info(
        "Postmark webhook: %s for %s (tag=%s, msg=%s)",
        event_doc["record_type"],
        event_doc["email"],
        event_doc["tag"],
        event_doc["message_id"],
    )
    return {"ok": True}


def _assert_webhook_token(token: str | None) -> None:
    """401 if a shared secret is configured and the caller did not match."""
    if POSTMARK_WEBHOOK_SECRET and token != POSTMARK_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid webhook token")


async def _read_postmark_json(request: Request) -> dict:
    """Parse the JSON body or raise 400."""
    try:
        return await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body") from None


def _build_email_event(payload: dict) -> dict:
    """Snapshot the inbound webhook into our ``email_events`` collection."""
    record_type = payload.get("RecordType", "Unknown")
    # Postmark uses "Email" on Bounce/Complaint, "Recipient" on Delivery
    raw_email = payload.get("Email") or payload.get("Recipient") or ""
    return {
        "id": str(uuid.uuid4()),
        "record_type": record_type,
        "email": raw_email.lower() if raw_email else "",
        "message_id": payload.get("MessageID"),
        "tag": payload.get("Tag"),
        "bounce_type": payload.get("Type"),  # HardBounce, SoftBounce, Transient, etc.
        "description": payload.get("Description") or payload.get("Details"),
        "raw": payload,
        "received_at": datetime.now(UTC).isoformat(),
    }


# Maps Postmark's RecordType → our internal user.email_status value.
_EMAIL_STATUS_MAP = {
    "Bounce": "bounced",
    "SpamComplaint": "complained",
    "Delivery": "delivered",
}


def _user_email_update_from(event: dict, payload: dict) -> dict | None:
    """Derive the ``users`` update doc for an inbound event, or None to skip.

    Hard bounces and spam complaints suppress future sends; deliveries clear
    suppression so a recovered mailbox can be reached again.
    """
    record_type = event["record_type"]
    user_status = _EMAIL_STATUS_MAP.get(record_type)
    if not user_status:
        return None
    update = {
        "email_status": user_status,
        "last_email_event_at": event["received_at"],
        "last_email_event_type": record_type,
    }
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
    return update



@api_router.get("/admin/email-health", response_model=AdminEmailHealthResponse)
async def admin_email_health(payload: dict = Depends(verify_token)) -> dict:
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


@api_router.get("/admin/dashboard", response_model=AdminDashboardResponse)
async def get_admin_dashboard(payload: dict = Depends(verify_token)) -> dict:
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


@api_router.get("/admin/users", response_model=list[UserPublic])
async def get_all_users(payload: dict = Depends(verify_token)) -> list[dict]:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    users = await db.users.find({}, {"_id": 0, "password": 0}).sort("created_at", -1).to_list(1000)
    return users


@api_router.put("/admin/users/{user_id}/status", response_model=AdminToggleStatusResponse)
async def update_user_status(user_id: str, payload: dict = Depends(verify_token)) -> dict:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    new_status = "blocked" if user.get("status", "active") == "active" else "active"
    await db.users.update_one({"id": user_id}, {"$set": {"status": new_status}})
    await publish("invalidate", {"prefixes": ["/api/admin/users", "/api/admin/dashboard"]})
    return {"message": f"User {new_status}", "status": new_status}


@api_router.delete("/admin/users/{user_id}", response_model=MessageResponse)
async def delete_user(user_id: str, payload: dict = Depends(verify_token)) -> dict:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    if user_id == payload['user_id']:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    await db.users.delete_one({"id": user_id})
    await db.properties.delete_many({"owner_id": user_id})
    await publish("invalidate", {"prefixes": ["/api/admin/users", "/api/admin/properties", "/api/admin/dashboard"]})
    return {"message": "User and their properties deleted"}


@api_router.get("/admin/properties", response_model=list[PropertyOut])
async def get_all_properties_admin(payload: dict = Depends(verify_token)) -> list[dict]:
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


@api_router.put("/admin/properties/{property_id}/managed", response_model=AdminToggleStatusResponse)
async def toggle_property_admin_managed(
    property_id: str,
    payload: dict = Depends(verify_token),
) -> dict:
    """Super-admin: flip the `managed_by_admin` flag on a property.

    This is the "I'm managing this property for the owner" marker. It does
    not change ownership or permissions — admins already have full control.
    It just lets us filter the listings table to "Properties I manage" so
    super-admins can find them quickly when handling the day-to-day
    (renters, maintenance, contracts) on the owner's behalf.
    """
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0, "id": 1, "managed_by_admin": 1})
    if prop is None:
        raise HTTPException(status_code=404, detail="Property not found")
    new_value = not bool(prop.get("managed_by_admin"))
    await db.properties.update_one(
        {"id": property_id},
        {"$set": {
            "managed_by_admin": new_value,
            "managed_by_admin_id": payload["user_id"] if new_value else None,
            "managed_by_admin_at": datetime.now(UTC).isoformat() if new_value else None,
        }},
    )
    await publish("invalidate", {"prefixes": ["/api/admin/properties", "/api/admin/dashboard"]})
    return {
        "message": "Managing this property" if new_value else "No longer managing",
        "status": "managed" if new_value else "unmanaged",
    }


class AdminBlockIn(BaseModel):
    start_date: str | None = None  # ISO string; None => starts now
    end_date: str | None = None    # ISO string; None => indefinite
    indefinite: bool | None = False


@api_router.post("/admin/properties/{property_id}/mark-booked", response_model=AdminMarkBookedResponse)
async def admin_mark_property_booked(
    property_id: str,
    block: AdminBlockIn,
    payload: dict = Depends(verify_token),
) -> dict:
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
    await publish("invalidate", {"prefixes": ["/api/admin/properties"]})
    return {"message": "Property marked as booked", "block": block_doc}


@api_router.get("/admin/properties/{property_id}/blocks", response_model=list[AdminBlockOut])
async def admin_list_property_blocks(property_id: str, payload: dict = Depends(verify_token)) -> list[dict]:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    blocks = await db.admin_blocks.find(
        {"property_id": property_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return blocks


@api_router.delete("/admin/properties/blocks/{block_id}", response_model=MessageResponse)
async def admin_remove_block(block_id: str, payload: dict = Depends(verify_token)) -> dict:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await db.admin_blocks.delete_one({"id": block_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Block not found")
    await publish("invalidate", {"prefixes": ["/api/admin/properties"]})
    return {"message": "Block removed"}


class BulkMarkBookedIn(BaseModel):
    property_ids: List[str]
    start_date: str | None = None
    end_date: str | None = None
    indefinite: bool | None = False


@api_router.post("/admin/properties/bulk-mark-booked", response_model=AdminBulkMarkBookedResponse)
async def admin_bulk_mark_booked(
    data: BulkMarkBookedIn,
    payload: dict = Depends(verify_token),
) -> dict:
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
        await publish("invalidate", {"prefixes": ["/api/admin/properties"]})
    return {
        "message": f"{len(docs)} properties marked as booked",
        "created": len(docs),
        "skipped": len(data.property_ids) - len(docs),
    }


@api_router.put("/admin/properties/{property_id}/status", response_model=AdminToggleStatusResponse)
async def toggle_property_status(property_id: str, payload: dict = Depends(verify_token)) -> dict:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    new_status = "inactive" if prop.get("status") == "active" else "active"
    await db.properties.update_one({"id": property_id}, {"$set": {"status": new_status}})
    await publish("invalidate", {"prefixes": ["/api/admin/properties", "/api/admin/dashboard"]})
    return {"message": f"Property {new_status}", "status": new_status}


@api_router.get("/admin/chats", response_model=list[ConversationOut])
async def get_all_chats(payload: dict = Depends(verify_token)) -> list[dict]:
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


@api_router.get("/admin/document-services", response_model=list[ServiceRequestOut])
async def get_all_document_services(payload: dict = Depends(verify_token)) -> list[dict]:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    services = await db.document_services.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for svc in services:
        user = await db.users.find_one({"id": svc.get("user_id")}, {"_id": 0, "name": 1, "email": 1})
        svc["user_name"] = user.get("name", "Unknown") if user else "Unknown"
        svc["user_email"] = user.get("email", "") if user else ""
    return services


@api_router.put("/admin/document-services/{service_id}/status", response_model=MessageResponse)
async def update_service_status(service_id: str, status: str, payload: dict = Depends(verify_token)) -> dict:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    if status not in ["pending", "in_progress", "completed", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    await db.document_services.update_one({"id": service_id}, {"$set": {"status": status}})
    await publish("invalidate", {"prefixes": ["/api/admin/document-services", "/api/admin/dashboard"]})
    return {"message": f"Service status updated to {status}"}


@api_router.get("/admin/document-services/revenue", response_model=ServiceRevenueResponse)
async def get_document_services_revenue(
    window_days: int = 30,
    payload: dict = Depends(verify_token),
) -> dict:
    """Per-service revenue breakdown for the admin dashboard widget.

    Sums the per-row ``paid_amount_usd`` field on ``document_services``
    entries created within the last ``window_days``. Pass ``window_days=0``
    to get the all-time total.
    """
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    window_days = max(0, min(window_days, 3650))

    match: dict = {"paid": True}
    if window_days > 0:
        cutoff = (datetime.now(UTC) - timedelta(days=window_days)).isoformat()
        match["created_at"] = {"$gte": cutoff}

    pipeline = [
        {"$match": match},
        {
            "$group": {
                "_id": "$service_type",
                "count": {"$sum": 1},
                "revenue_usd": {"$sum": {"$ifNull": ["$paid_amount_usd", 0]}},
            }
        },
    ]
    cursor = db.document_services.aggregate(pipeline)
    raw = await cursor.to_list(100)

    # Make sure every catalog service is represented (even if it earned $0
    # this window) so the widget can always render the full ladder.
    by_type = {row["_id"]: row for row in raw if row.get("_id")}
    rows = []
    for service_type in VALID_DOC_SERVICES:
        agg = by_type.get(service_type) or {}
        rows.append({
            "service_type": service_type,
            "label": SERVICE_PRETTY.get(service_type, service_type),
            "count": int(agg.get("count", 0)),
            "revenue_usd": round(float(agg.get("revenue_usd", 0.0)), 2),
        })
    rows.sort(key=lambda r: r["revenue_usd"], reverse=True)

    return {
        "window_days": window_days,
        "total_revenue_usd": round(sum(r["revenue_usd"] for r in rows), 2),
        "total_filings": sum(r["count"] for r in rows),
        "rows": rows,
    }


@api_router.get("/admin/settings", response_model=AnyResponse)
async def get_site_settings(payload: dict = Depends(verify_token)) -> dict:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    settings = await db.site_settings.find_one({"key": "global"}, {"_id": 0})
    if not settings:
        return {"whatsapp_number": "", "contact_email": "", "contact_phone": "", "featured_property_ids": []}
    return settings


@api_router.put("/admin/settings", response_model=MessageResponse)
async def update_site_settings(settings: SiteSettings, payload: dict = Depends(verify_token)) -> dict:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    settings_doc = settings.model_dump()
    settings_doc["key"] = "global"
    settings_doc["updated_at"] = datetime.now(UTC).isoformat()
    await db.site_settings.update_one({"key": "global"}, {"$set": settings_doc}, upsert=True)
    await publish("invalidate", {"prefixes": ["/api/admin/settings"]})
    return {"message": "Settings updated successfully"}
