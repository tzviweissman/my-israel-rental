"""Auto-extracted from server.py during the 2026-04 refactor."""
import asyncio
import json
import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

import jwt
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

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
from utils.auth import JWT_SECRET, decode_query_token
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
        # Legacy alias — older versions of the dashboard rendered this as
        # "Inquiries". We now also surface it under the clearer
        # `total_bookings` key so the new Overview card can read it without
        # mislabeling the data.
        "total_inquiries": total_bookings,
        "total_bookings": total_bookings,
        "total_users": total_users,
        "pending_services": pending_services,
        "recent_properties": recent_properties
    }


@api_router.get("/admin/bookings")
async def get_admin_bookings(
    payload: dict = Depends(verify_token),
    status: str | None = None,
    limit: int = 200,
    skip: int = 0,
) -> dict:
    """Paginated bookings list for the Super Admin → Bookings tab. Joins
    in the property thumbnail + title + area so the admin can scan visually
    instead of resolving each `property_id` against the listings tab.

    Filters:
      • ``status`` — confirmed / pending / cancelled / completed (omit for all).
    """
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    match: dict = {}
    if status:
        match["status"] = status

    # Single aggregate — newest first, with property fields joined in.
    # `$lookup` runs on the bookings collection's own index (no sub-find
    # per row), so this scales fine for tens of thousands of rows.
    pipeline = [
        {"$match": match},
        {"$sort": {"created_at": -1}},
        {"$skip": skip},
        {"$limit": min(limit, 500)},  # hard cap so a bad URL can't OOM us
        {"$lookup": {
            "from": "properties",
            "localField": "property_id",
            "foreignField": "id",
            "as": "property",
        }},
        {"$unwind": {"path": "$property", "preserveNullAndEmptyArrays": True}},
        # Join in the property owner (manager) so the admin can reach out
        # directly from the bookings tab without cross-referencing the
        # Users table. Owner is optional — deleted-owner rows keep
        # rendering the guest info gracefully.
        {"$lookup": {
            "from": "users",
            "localField": "property.owner_id",
            "foreignField": "id",
            "as": "owner",
        }},
        {"$unwind": {"path": "$owner", "preserveNullAndEmptyArrays": True}},
        {"$project": {
            "_id": 0,
            "id": 1,
            "property_id": 1,
            "start_date": 1,
            "end_date": 1,
            "status": 1,
            "created_at": 1,
            "guest_name": 1,
            "guest_email": 1,
            "guest_phone": 1,
            "number_of_guests": 1,
            "sublease_id": 1,
            # Property fields surfaced for the admin's visual scan
            "property_title": "$property.title",
            "property_area": "$property.area",
            "property_rental_type": "$property.rental_type",
            "property_nightly_price": "$property.nightly_price",
            "property_monthly_price": "$property.monthly_price",
            "property_currency": "$property.currency",
            "property_images": "$property.images",
            "property_videos": "$property.videos",
            "property_owner_id": "$property.owner_id",
            # Manager (owner) contact — email is always present; the
            # WhatsApp number lives in the `phone` field per our
            # /auth/whatsapp write path (auth.py).
            "manager_name": "$owner.name",
            "manager_email": "$owner.email",
            "manager_whatsapp": "$owner.phone",
            "manager_role": "$owner.role",
        }},
    ]
    rows = await db.bookings.aggregate(pipeline).to_list(length=500)
    total = await db.bookings.count_documents(match)
    # Status counts — drives the filter chip badges in the UI
    status_counts_raw = await db.bookings.aggregate([
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]).to_list(length=20)
    status_counts = {row["_id"] or "unknown": row["count"] for row in status_counts_raw}
    return {
        "bookings": rows,
        "total": total,
        "limit": limit,
        "skip": skip,
        "status_counts": status_counts,
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


@api_router.post("/admin/users/{user_id}/impersonate")
async def impersonate_user(user_id: str, payload: dict = Depends(verify_token)) -> dict:
    """Return a short-lived JWT for the target user so the admin can drive
    that user's dashboard directly (support flows: add properties on the
    owner's behalf, reproduce bugs, etc.).

    Guardrails:
      • Admin-only; another admin cannot be impersonated (privilege boundary).
      • JWT TTL is 4h — much shorter than a normal 30-day token — so an
        impersonation session doesn't linger past its intent.
      • Every impersonation is written to `db.admin_impersonation_log`
        for audit. Admin never sees the target's password.
    """
    if payload.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    if user_id == payload['user_id']:
        raise HTTPException(status_code=400, detail="Cannot impersonate yourself")

    target = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get('role') == 'admin':
        raise HTTPException(status_code=403, detail="Cannot impersonate another admin")

    # Short-lived token that carries an `impersonated_by` claim. The
    # existing verify_token doesn't look at this field so all existing
    # authorization checks continue to work using the target user's role
    # — exactly what we need for the admin to act as them.
    token_payload = {
        'user_id': target['id'],
        'role': target.get('role', 'renter'),
        'impersonated_by': payload['user_id'],
        'exp': datetime.now(UTC) + timedelta(hours=4),
    }
    token = jwt.encode(token_payload, JWT_SECRET, algorithm='HS256')

    # Audit trail — never delete these rows; they're the only record that
    # a given action was performed by an admin acting-as another user.
    await db.admin_impersonation_log.insert_one({
        'admin_id': payload['user_id'],
        'target_user_id': target['id'],
        'target_email': target.get('email'),
        'started_at': datetime.now(UTC).isoformat(),
    })
    return {"token": token, "user": target}


@api_router.get("/admin/duplicates")
async def list_duplicate_listings(payload: dict = Depends(verify_token)) -> dict:
    """Return groups of properties that share (owner_id, normalized address,
    rental_type) so the admin can review and clean up legacy duplicates.

    Each group has 2+ properties. Useful as a one-shot audit after we
    shipped the dedupe gate — pre-existing dupes weren't blocked at the
    door, so admins need a way to find them.
    """
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    from utils.dedupe import dedupe_signature
    # Pull the fields needed to group AND to help the admin decide which
    # copy to keep (image count, cover URL, age).
    rows = await db.properties.find(
        {"status": {"$in": ["active", "pending", "draft"]}},
        {
            "_id": 0, "id": 1, "owner_id": 1, "title": 1, "address": 1,
            "rental_type": 1, "created_at": 1, "images": 1,
            "description": 1, "monthly_price": 1, "nightly_price": 1,
            "bedrooms": 1, "floor": 1,
        },
    ).to_list(5000)

    # Group by composite dedupe signature (owner_id, normalized_address,
    # rental_type, bedrooms, floor). Distinct units in the same building
    # — common in Jerusalem — no longer collapse into a single bogus group.
    groups: dict[tuple, list[dict]] = {}
    for r in rows:
        sig = dedupe_signature(
            owner_id=r.get("owner_id"),
            address=r.get("address"),
            rental_type=r.get("rental_type"),
            bedrooms=r.get("bedrooms"),
            floor=r.get("floor"),
        )
        if sig is None:
            continue
        # Trim each property to the shape the admin UI needs — keeps the
        # response payload small even when there are dozens of groups.
        images = r.get("images") or []
        groups.setdefault(sig, []).append({
            "id": r["id"],
            "title": r.get("title"),
            "created_at": r.get("created_at"),
            "image_count": len(images),
            "cover_url": images[0] if images else None,
            "description_length": len(r.get("description") or ""),
            "monthly_price": r.get("monthly_price"),
            "nightly_price": r.get("nightly_price"),
            "bedrooms": r.get("bedrooms"),
            "floor": r.get("floor"),
        })

    # Keep only groups with 2+ properties
    out = []
    for sig, props in groups.items():
        if len(props) < 2:
            continue
        owner_id, addr, rt, bedrooms, floor = sig
        owner = await db.users.find_one({"id": owner_id}, {"_id": 0, "name": 1, "email": 1})
        out.append({
            "owner_id": owner_id,
            "owner_name": owner.get("name") if owner else None,
            "owner_email": owner.get("email") if owner else None,
            "address": addr,
            "rental_type": rt,
            "bedrooms": bedrooms,
            "floor": floor,
            "properties": sorted(props, key=lambda p: p.get("created_at", "")),
        })
    # Newest collisions first — they're the freshest cleanup targets.
    out.sort(key=lambda g: max(p.get("created_at", "") for p in g["properties"]), reverse=True)
    return {"groups": out, "total_groups": len(out)}


class DuplicateResolveRequest(BaseModel):
    """Bulk-resolve duplicate groups.

    `mode`:
      - "keep_newest"  → delete all but the most recently created listing in each group
      - "keep_oldest"  → delete all but the earliest-created (preserves booking history)
      - "keep_richest" → delete all but the one with the most images + longest description

    `keys` (optional) restricts the action to specific groups. Each key is
    "<owner_id>|<normalized_address>|<rental_type>". When omitted, all
    groups returned by `/admin/duplicates` are resolved.
    """
    mode: str = "keep_richest"
    keys: list[str] | None = None
    # When True, only resolve groups where every duplicate has functionally
    # identical user-facing data (title, description, amenities, prices,
    # image URLs). Used by the auto-cleanup endpoint / background task so
    # we never silently delete a listing that's only "similar" to another.
    strict_only: bool = False


def _norm_str(s: str | None) -> str:
    """Case-insensitive, whitespace-collapsed string comparator."""
    if not s:
        return ""
    return " ".join(s.strip().lower().split())


def _group_is_strictly_identical(props: list[dict]) -> bool:
    """True when every property in the group agrees on every field a
    renter would see. Used by the auto-resolve path — we only auto-delete
    listings that are pixel-for-pixel the same twin, never merely
    "similar" listings (different price, different title, missing photos)
    which need human judgement.
    """
    if len(props) < 2:
        return False
    # Numeric / categorical fields: exact equality.
    numeric_fields = (
        "monthly_price", "nightly_price", "currency", "bathrooms",
        "square_meters", "property_type",
    )
    for f in numeric_fields:
        vals = {p.get(f) for p in props}
        # None + missing collapse to a single value, which is fine.
        if len(vals) > 1:
            return False
    # Text fields: normalized comparison (case / whitespace tolerant).
    for f in ("title", "description"):
        vals = {_norm_str(p.get(f)) for p in props}
        if len(vals) > 1:
            return False
    # Set-valued fields: order-independent equality.
    amenity_sets = {frozenset(p.get("amenities") or []) for p in props}
    if len(amenity_sets) > 1:
        return False
    image_sets = {frozenset(p.get("images") or []) for p in props}
    if len(image_sets) > 1:
        return False
    return True


@api_router.post("/admin/duplicates/resolve")
async def resolve_duplicates(
    req: DuplicateResolveRequest, payload: dict = Depends(verify_token)
) -> dict:
    """Bulk-delete the redundant listings in each duplicate group based on a
    chosen "keep" strategy. Returns the count of properties deleted and a
    brief report keyed by group.
    """
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    if req.mode not in {"keep_newest", "keep_oldest", "keep_richest"}:
        raise HTTPException(
            status_code=400,
            detail="mode must be one of: keep_newest, keep_oldest, keep_richest",
        )

    from utils.dedupe import dedupe_signature
    rows = await db.properties.find(
        {"status": {"$in": ["active", "pending", "draft"]}},
        {
            "_id": 0, "id": 1, "owner_id": 1, "address": 1, "rental_type": 1,
            "created_at": 1, "images": 1, "videos": 1, "description": 1,
            "bedrooms": 1, "floor": 1,
            # Extra fields loaded so `strict_only` can compare every
            # user-visible piece of data. Small overhead when strict_only
            # is off — worth it to keep both paths using the same query.
            "title": 1, "amenities": 1, "monthly_price": 1, "nightly_price": 1,
            "currency": 1, "bathrooms": 1, "square_meters": 1, "property_type": 1,
        },
    ).to_list(5000)

    # Same grouping logic as /admin/duplicates — composite signature so
    # distinct units at the same building address don't collide. Holiday
    # pricing lives on a single listing (lump + per-night toggle), not
    # split across two — so holiday_tags is not part of the signature.
    groups: dict[tuple, list[dict]] = {}
    for r in rows:
        sig = dedupe_signature(
            owner_id=r.get("owner_id"),
            address=r.get("address"),
            rental_type=r.get("rental_type"),
            bedrooms=r.get("bedrooms"),
            floor=r.get("floor"),
        )
        if sig is None:
            continue
        groups.setdefault(sig, []).append(r)

    target_keys = (
        set(req.keys) if req.keys is not None else None
    )

    # Bulk-prefetch per-property activity counts (messages + bookings)
    # in one round-trip each. Used below to bias keeper-selection toward
    # the twin that already has chat history — that way the renter's
    # bookmarked URL keeps working instead of pointing at a deleted id.
    all_prop_ids = [r["id"] for r in rows]
    activity: dict[str, int] = {pid: 0 for pid in all_prop_ids}
    if all_prop_ids:
        async for row in db.messages.aggregate([
            {"$match": {"property_id": {"$in": all_prop_ids}}},
            {"$group": {"_id": "$property_id", "n": {"$sum": 1}}},
        ]):
            activity[row["_id"]] = activity.get(row["_id"], 0) + row["n"]
        async for row in db.bookings.aggregate([
            {"$match": {"property_id": {"$in": all_prop_ids}}},
            {"$group": {"_id": "$property_id", "n": {"$sum": 1}}},
        ]):
            # Bookings count as activity too — they're even more valuable
            # to preserve a stable property_id for than chats.
            activity[row["_id"]] = activity.get(row["_id"], 0) + row["n"]

    def score_richness(p: dict) -> tuple[int, int, str]:
        # Bigger is better: image count first, then description length,
        # then created_at as a stable tie-breaker (newer wins ties).
        return (
            len(p.get("images") or []),
            len(p.get("description") or ""),
            p.get("created_at") or "",
        )

    deleted_total = 0
    reattached_total = {"messages": 0, "bookings": 0, "likes": 0, "nudges": 0, "blocks": 0, "subleases": 0}
    report: list[dict] = []
    for sig, props in groups.items():
        if len(props) < 2:
            continue
        owner_id, addr, rt, bedrooms, floor = sig
        # Group key string: matches the shape returned by /admin/duplicates
        # so the frontend can target specific groups via `keys`.
        key_str = f"{owner_id}|{addr}|{rt}|{bedrooms or ''}|{floor or ''}"
        if target_keys is not None and key_str not in target_keys:
            continue

        # Strict-only guardrail: skip groups where properties differ on
        # any user-visible field. Used by the auto-cleanup path so we
        # only ever silently delete an EXACT twin — never a listing
        # that's only "similar". Any group that fails this check gets
        # surfaced for manual review via the normal /admin/duplicates
        # endpoint instead.
        if req.strict_only and not _group_is_strictly_identical(props):
            continue

        # When at least one twin already has chat/booking history,
        # restrict the keeper candidates to ONLY those. This keeps the
        # renter's bookmarked URL alive (no re-attach needed) and beats
        # the requested mode for ties. If multiple twins have history,
        # the requested mode picks between them; if exactly one has
        # history, it always wins.
        active_props = [p for p in props if activity.get(p["id"], 0) > 0]
        keeper_candidates = active_props if active_props else props
        # All non-candidates become losers regardless of mode — we never
        # delete a property with chat history when an inactive twin
        # exists to absorb the delete.
        forced_losers = [p for p in props if p not in keeper_candidates]

        if req.mode == "keep_newest":
            sorted_candidates = sorted(keeper_candidates, key=lambda p: p.get("created_at") or "")
            keeper = sorted_candidates[-1]
            mode_losers = sorted_candidates[:-1]
        elif req.mode == "keep_oldest":
            sorted_candidates = sorted(keeper_candidates, key=lambda p: p.get("created_at") or "")
            keeper = sorted_candidates[0]
            mode_losers = sorted_candidates[1:]
        else:  # keep_richest
            sorted_candidates = sorted(keeper_candidates, key=score_richness)
            keeper = sorted_candidates[-1]
            mode_losers = sorted_candidates[:-1]
        losers = forced_losers + mode_losers

        loser_ids = [p["id"] for p in losers]
        if not loser_ids:
            continue

        keeper_id = keeper["id"]
        # Re-attach everything that was hanging off the losers to the keeper
        # BEFORE we delete the loser docs. Without this, a renter's
        # inquiry about the deleted twin becomes a dead chat that opens
        # to "Property not found". Duplicates are by definition the
        # same physical apartment (same owner + same address + same
        # rental_type), so moving the chats/bookings/likes is safe.
        msgs_r = await db.messages.update_many(
            {"property_id": {"$in": loser_ids}},
            {"$set": {"property_id": keeper_id}},
        )
        bookings_r = await db.bookings.update_many(
            {"property_id": {"$in": loser_ids}},
            {"$set": {"property_id": keeper_id}},
        )
        nudges_r = await db.chat_nudges.update_many(
            {"property_id": {"$in": loser_ids}},
            {"$set": {"property_id": keeper_id}},
        )
        blocks_r = await db.admin_blocks.update_many(
            {"property_id": {"$in": loser_ids}},
            {"$set": {"property_id": keeper_id}},
        )
        subleases_r = await db.subleases.update_many(
            {"original_property_id": {"$in": loser_ids}},
            {"$set": {"original_property_id": keeper_id}},
        )
        # Likes need extra care: a user might have liked BOTH the keeper
        # and a loser. Re-pointing would create a duplicate row. Drop the
        # loser-side likes for any user who already liked the keeper, then
        # re-point the rest.
        keeper_likers = {
            row["user_id"]
            async for row in db.liked_properties.find(
                {"property_id": keeper_id}, {"_id": 0, "user_id": 1}
            )
        }
        if keeper_likers:
            await db.liked_properties.delete_many({
                "property_id": {"$in": loser_ids},
                "user_id": {"$in": list(keeper_likers)},
            })
        likes_r = await db.liked_properties.update_many(
            {"property_id": {"$in": loser_ids}},
            {"$set": {"property_id": keeper_id}},
        )

        reattached_total["messages"] += msgs_r.modified_count
        reattached_total["bookings"] += bookings_r.modified_count
        reattached_total["likes"] += likes_r.modified_count
        reattached_total["nudges"] += nudges_r.modified_count
        reattached_total["blocks"] += blocks_r.modified_count
        reattached_total["subleases"] += subleases_r.modified_count

        # Merge images + videos from losers into the keeper BEFORE we
        # delete them. Without this step, picking a keeper with chat
        # history (active_props preference) or a newer-but-empty twin
        # would wipe out photo URLs that lived on the loser docs — the
        # admin re-mirror tool would then report "no image URLs" for
        # listings the admin is sure had photos at import time.
        # Order: keeper's images first (so its preferred cover stays
        # the cover), then any new URLs from each loser in turn.
        # Dedupe is by exact URL string. Cap matches the importer.
        keeper_imgs = list(keeper.get("images") or [])
        keeper_vids = list(keeper.get("videos") or [])
        seen_img_urls = {u for u in keeper_imgs if u}
        seen_vid_urls = {u for u in keeper_vids if u}
        for loser in losers:
            for u in (loser.get("images") or []):
                if u and u not in seen_img_urls:
                    keeper_imgs.append(u)
                    seen_img_urls.add(u)
            for u in (loser.get("videos") or []):
                if u and u not in seen_vid_urls:
                    keeper_vids.append(u)
                    seen_vid_urls.add(u)
        merged_imgs = keeper_imgs[:30]
        merged_vids = keeper_vids[:5]
        merged_image_count_delta = len(merged_imgs) - len(keeper.get("images") or [])
        if merged_image_count_delta > 0 or len(merged_vids) > len(keeper.get("videos") or []):
            # Some merged URLs may be raw source URLs (not on Cloudinary);
            # mark the keeper for the re-mirror sweep so a subsequent
            # /admin/properties/remirror call (or the next import pass)
            # uploads them to the CDN.
            needs_mirror = any(
                "cloudinary.com" not in (u or "") for u in merged_imgs + merged_vids
            )
            update_doc = {"images": merged_imgs, "videos": merged_vids}
            if needs_mirror:
                update_doc["mirror_pending"] = True
            await db.properties.update_one({"id": keeper_id}, {"$set": update_doc})

        res = await db.properties.delete_many({"id": {"$in": loser_ids}})
        deleted_total += res.deleted_count
        report.append({
            "key": key_str,
            "kept_id": keeper_id,
            "deleted_ids": loser_ids,
            "deleted_count": res.deleted_count,
            "images_merged": max(0, merged_image_count_delta),
            "reattached": {
                "messages": msgs_r.modified_count,
                "bookings": bookings_r.modified_count,
                "likes": likes_r.modified_count,
                "nudges": nudges_r.modified_count,
                "blocks": blocks_r.modified_count,
                "subleases": subleases_r.modified_count,
            },
        })

    if deleted_total:
        await publish("invalidate", {
            "prefixes": ["/api/admin/properties", "/api/admin/dashboard", "/api/properties"],
        })
    return {
        "mode": req.mode,
        "deleted": deleted_total,
        "groups_resolved": len(report),
        "reattached": reattached_total,
        "report": report,
    }


# ---------------------------------------------------------------------------
# Auto-cleanup — safe autopilot for perfectly-identical twins
# ---------------------------------------------------------------------------
#
# Every 30 minutes (see `server.py` startup hook) and on demand from the
# admin UI, we scan for property groups whose members agree on every
# user-visible field (title, description, amenities, prices, image set)
# and merge them into one, re-attaching all chats / bookings / likes to
# the surviving listing. This is the "if all information is the same,
# just clean it up" behaviour the admin asked for — no clicks needed.
#
# The strict-identity check lives in `_group_is_strictly_identical` and
# is enforced in the shared resolve loop via `req.strict_only=True`. Any
# group that fails the strict check is left alone for the admin to
# resolve manually via the Duplicates modal.


async def run_duplicate_auto_cleanup(logger_prefix: str = "auto-cleanup") -> dict:
    """Run one pass of strict-identical duplicate resolution. Returns
    the same shape as `/admin/duplicates/resolve` so the background task
    and the admin endpoint can share formatting. Records the summary in
    `db.admin_auto_cleanup_log` for the "last run" widget.
    """
    req = DuplicateResolveRequest(mode="keep_richest", strict_only=True)
    # Reuse the existing resolver — it already knows how to re-attach
    # chats, bookings, likes, nudges, blocks, subleases and to merge
    # images across the losers. We fake a payload of {'role': 'admin'}
    # because this function is invoked from trusted server-side callers.
    result = await resolve_duplicates(req, payload={"role": "admin", "user_id": "system"})
    await db.admin_auto_cleanup_log.insert_one({
        "at": datetime.now(UTC).isoformat(),
        "deleted": result.get("deleted", 0),
        "groups_resolved": result.get("groups_resolved", 0),
        "reattached": result.get("reattached", {}),
    })
    logger.info(
        "[%s] deleted=%d groups_resolved=%d reattached=%s",
        logger_prefix,
        result.get("deleted", 0),
        result.get("groups_resolved", 0),
        result.get("reattached", {}),
    )
    return result


@api_router.post("/admin/duplicates/auto-resolve")
async def auto_resolve_duplicates(payload: dict = Depends(verify_token)) -> dict:
    """Admin-triggered strict-identical dedupe. Deletes only twins that
    match on every user-visible field; anything else is left for manual
    review. Chats, bookings, likes and photos are re-attached to the
    survivor before deletion.
    """
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return await run_duplicate_auto_cleanup(logger_prefix="admin-triggered")


@api_router.get("/admin/duplicates/auto-status")
async def get_auto_cleanup_status(payload: dict = Depends(verify_token)) -> dict:
    """Return the last N auto-cleanup runs so the Duplicates modal can
    show "Last run: X min ago · Y properties merged" and give the admin
    a sense of what the background task has been doing.
    """
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    cursor = db.admin_auto_cleanup_log.find({}, {"_id": 0}).sort("at", -1).limit(20)
    runs = await cursor.to_list(20)
    return {"runs": runs}



class ReattachChatsRequest(BaseModel):
    """Move every chat / booking / like / block that points at one
    property_id over to another. Used to rescue orphan conversations
    when a duplicate listing was deleted in the past without re-linking.
    """
    from_property_id: str
    to_property_id: str


@api_router.post("/admin/chats/reattach")
async def admin_reattach_chats(
    req: ReattachChatsRequest, payload: dict = Depends(verify_token),
) -> dict:
    """Manually re-point all references from one property_id to another.

    Use case: a duplicate was deleted before we shipped the
    auto-reattach on duplicate-resolve. The renter's chat now opens
    "Property not found"; pasting the dead id + the surviving twin's id
    here fixes it. Validates the target exists. Source must NOT exist
    (we don't merge two live listings via this API)."""
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    src = (req.from_property_id or "").strip()
    dst = (req.to_property_id or "").strip()
    if not src or not dst:
        raise HTTPException(status_code=400, detail="Both property ids are required")
    if src == dst:
        raise HTTPException(status_code=400, detail="Source and target must differ")

    dst_doc = await db.properties.find_one({"id": dst}, {"_id": 0, "id": 1, "title": 1})
    if not dst_doc:
        raise HTTPException(status_code=404, detail=f"Target property '{dst}' not found")
    src_doc = await db.properties.find_one({"id": src}, {"_id": 0, "id": 1})
    if src_doc:
        raise HTTPException(
            status_code=400,
            detail=f"Source property '{src}' still exists — use the duplicate resolver to merge two live listings",
        )

    msgs_r = await db.messages.update_many(
        {"property_id": src}, {"$set": {"property_id": dst}},
    )
    bookings_r = await db.bookings.update_many(
        {"property_id": src}, {"$set": {"property_id": dst}},
    )
    nudges_r = await db.chat_nudges.update_many(
        {"property_id": src}, {"$set": {"property_id": dst}},
    )
    blocks_r = await db.admin_blocks.update_many(
        {"property_id": src}, {"$set": {"property_id": dst}},
    )
    subleases_r = await db.subleases.update_many(
        {"original_property_id": src}, {"$set": {"original_property_id": dst}},
    )
    # Likes need the same de-dupe pass as the duplicate resolver: a user
    # who already liked the destination would otherwise end up with a
    # second row that points at the same property.
    keeper_likers = {
        row["user_id"]
        async for row in db.liked_properties.find(
            {"property_id": dst}, {"_id": 0, "user_id": 1}
        )
    }
    if keeper_likers:
        await db.liked_properties.delete_many({
            "property_id": src, "user_id": {"$in": list(keeper_likers)},
        })
    likes_r = await db.liked_properties.update_many(
        {"property_id": src}, {"$set": {"property_id": dst}},
    )

    await publish("invalidate", {
        "prefixes": ["/api/chat", "/api/admin/chats", "/api/properties"],
    })
    return {
        "from_property_id": src,
        "to_property_id": dst,
        "to_property_title": dst_doc.get("title"),
        "reattached": {
            "messages": msgs_r.modified_count,
            "bookings": bookings_r.modified_count,
            "likes": likes_r.modified_count,
            "nudges": nudges_r.modified_count,
            "blocks": blocks_r.modified_count,
            "subleases": subleases_r.modified_count,
        },
    }



class BulkDeletePropertiesRequest(BaseModel):
    """Super-admin: hard-delete many properties at once.

    Cascades cleanup across collections that reference the property by
    ``property_id`` so we don't leave orphan chats / blocks / bookings
    pointing at deleted listings. Subleases that referenced the deleted
    properties are detached (set ``original_property_id`` to None) so
    they survive as standalone listings.

    When ``auto_rescue_duplicates`` is true (admin opt-in for "I'm just
    clearing out known dupes"), for each row we look up a surviving
    duplicate twin (same owner + address + rental_type + bedrooms +
    floor, excluding the ids being deleted). If a twin is found we
    reattach the row's chats / bookings / likes / nudges / blocks /
    subleases AND merge its images + videos into the twin BEFORE the
    cascade-delete runs. Rows without a twin go through the standard
    tombstone path so the Undo button still works for those.
    """
    property_ids: list[str] = Field(..., max_length=500)
    auto_rescue_duplicates: bool = False


@api_router.delete("/admin/properties/bulk")
async def admin_bulk_delete_properties(
    req: BulkDeletePropertiesRequest, payload: dict = Depends(verify_token),
) -> dict:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    if not req.property_ids:
        raise HTTPException(status_code=400, detail="property_ids must not be empty")

    # Only operate on ids that actually exist so the count we report back
    # to the UI is honest (not "deleted 50" when 30 of them never existed).
    existing_props = await db.properties.find(
        {"id": {"$in": req.property_ids}}, {"_id": 0}
    ).to_list(len(req.property_ids))
    valid_ids = [p["id"] for p in existing_props]
    if not valid_ids:
        return {
            "deleted": 0, "skipped": len(req.property_ids),
            "messages_deleted": 0, "bookings_deleted": 0,
            "snapshot_id": None,
            "rescued_count": 0, "rescue_totals": {},
        }

    # ---- Auto-rescue pass (opt-in). For each property scheduled for
    # deletion, see if a duplicate twin exists in the rest of the DB
    # (excluding everything ALSO being deleted in this batch). If so,
    # reattach related rows and merge images into the twin BEFORE the
    # snapshot+cascade runs. ----
    rescued_ids: set[str] = set()
    rescue_totals = {
        "messages": 0, "bookings": 0, "likes": 0, "nudges": 0,
        "blocks": 0, "subleases": 0, "images_merged": 0,
    }
    if req.auto_rescue_duplicates:
        from utils.dedupe import find_duplicate
        valid_ids_set = set(valid_ids)
        for prop in existing_props:
            # The duplicate lookup must also exclude any other id in this
            # delete batch so we don't reattach onto a sibling that's
            # about to be wiped too.
            twin = await find_duplicate(
                db,
                owner_id=prop.get("owner_id"),
                address=prop.get("address"),
                rental_type=prop.get("rental_type"),
                bedrooms=prop.get("bedrooms"),
                floor=prop.get("floor"),
                exclude_property_id=prop["id"],
            )
            if not twin or twin["id"] in valid_ids_set:
                continue
            twin_id = twin["id"]
            prop_id = prop["id"]

            # Likes-collision guard (same as single delete path).
            twin_likers = {
                row["user_id"]
                async for row in db.liked_properties.find(
                    {"property_id": twin_id}, {"_id": 0, "user_id": 1}
                )
            }
            if twin_likers:
                await db.liked_properties.delete_many({
                    "property_id": prop_id,
                    "user_id": {"$in": list(twin_likers)},
                })

            msgs_r = await db.messages.update_many(
                {"property_id": prop_id}, {"$set": {"property_id": twin_id}}
            )
            bookings_r = await db.bookings.update_many(
                {"property_id": prop_id}, {"$set": {"property_id": twin_id}}
            )
            likes_r = await db.liked_properties.update_many(
                {"property_id": prop_id}, {"$set": {"property_id": twin_id}}
            )
            nudges_r = await db.chat_nudges.update_many(
                {"property_id": prop_id}, {"$set": {"property_id": twin_id}}
            )
            blocks_r = await db.admin_blocks.update_many(
                {"property_id": prop_id}, {"$set": {"property_id": twin_id}}
            )
            subleases_r = await db.subleases.update_many(
                {"original_property_id": prop_id},
                {"$set": {"original_property_id": twin_id}},
            )

            # Merge images + videos into the twin (dedupe by URL, cap
            # 30/5, mirror_pending=True for non-CDN URLs).
            twin_full = await db.properties.find_one(
                {"id": twin_id}, {"_id": 0, "images": 1, "videos": 1}
            ) or {}
            twin_imgs = list(twin_full.get("images") or [])
            twin_vids = list(twin_full.get("videos") or [])
            seen_imgs = {u for u in twin_imgs if u}
            seen_vids = {u for u in twin_vids if u}
            for u in (prop.get("images") or []):
                if u and u not in seen_imgs:
                    twin_imgs.append(u)
                    seen_imgs.add(u)
            for u in (prop.get("videos") or []):
                if u and u not in seen_vids:
                    twin_vids.append(u)
                    seen_vids.add(u)
            merged_imgs = twin_imgs[:30]
            merged_vids = twin_vids[:5]
            new_image_count = max(0, len(merged_imgs) - len(twin_full.get("images") or []))
            if new_image_count > 0 or len(merged_vids) > len(twin_full.get("videos") or []):
                needs_mirror = any(
                    "cloudinary.com" not in (u or "") for u in merged_imgs + merged_vids
                )
                patch = {"images": merged_imgs, "videos": merged_vids}
                if needs_mirror:
                    patch["mirror_pending"] = True
                await db.properties.update_one({"id": twin_id}, {"$set": patch})

            rescued_ids.add(prop_id)
            rescue_totals["messages"] += msgs_r.modified_count
            rescue_totals["bookings"] += bookings_r.modified_count
            rescue_totals["likes"] += likes_r.modified_count
            rescue_totals["nudges"] += nudges_r.modified_count
            rescue_totals["blocks"] += blocks_r.modified_count
            rescue_totals["subleases"] += subleases_r.modified_count
            rescue_totals["images_merged"] += new_image_count

    # Ids that DIDN'T find a twin (or rescue was off) still go through
    # the snapshot+cascade path so the Undo button keeps working.
    tombstone_ids = [pid for pid in valid_ids if pid not in rescued_ids]
    tombstone_props = [p for p in existing_props if p["id"] not in rescued_ids]

    # ---- Snapshot every row about to be touched so the admin can Undo. ----
    # We capture the *full* documents (sans `_id` since pymongo strips it)
    # so a restore is a straight `insert_many` — no schema reconstruction
    # needed. Includes the featured-list state and a list of detached
    # sublease ids so we can re-link them on restore. Only the rows that
    # weren't auto-rescued land in the tombstone (rescued rows had their
    # related data moved into the twin and don't need restoring).
    snapshot_id = str(uuid.uuid4())
    now_iso = datetime.now(UTC).isoformat()
    if not tombstone_ids:
        # Everything was rescued — no tombstone needed, no snapshot id.
        snapshot_id = None
        related = {k: [] for k in
                   ("messages", "bookings", "admin_blocks", "chat_nudges", "liked_properties")}
        featured_present = []
        detached_sub_ids = []
    else:
        related = {
            "messages": await db.messages.find(
                {"property_id": {"$in": tombstone_ids}}, {"_id": 0}
            ).to_list(20000),
            "bookings": await db.bookings.find(
                {"property_id": {"$in": tombstone_ids}}, {"_id": 0}
            ).to_list(20000),
            "admin_blocks": await db.admin_blocks.find(
                {"property_id": {"$in": tombstone_ids}}, {"_id": 0}
            ).to_list(20000),
            "chat_nudges": await db.chat_nudges.find(
                {"property_id": {"$in": tombstone_ids}}, {"_id": 0}
            ).to_list(20000),
            "liked_properties": await db.liked_properties.find(
                {"property_id": {"$in": tombstone_ids}}, {"_id": 0}
            ).to_list(20000),
        }
        settings = await db.site_settings.find_one({"key": "global"}, {"_id": 0, "featured_property_ids": 1}) or {}
        featured_present = [pid for pid in (settings.get("featured_property_ids") or []) if pid in set(tombstone_ids)]
        detached_sub_ids = [
            s["id"]
            async for s in db.subleases.find(
                {"original_property_id": {"$in": tombstone_ids}}, {"_id": 0, "id": 1}
            )
        ]
        await db.property_tombstones.insert_one({
            "id": snapshot_id,
            "deleted_at": now_iso,
            "deleted_by": payload.get("user_id"),
            "property_ids": tombstone_ids,
            "properties": tombstone_props,
            "related": related,
            "featured_property_ids_present": featured_present,
            "detached_sublease_ids": detached_sub_ids,
        })

        # Detach any subleases that referenced these properties (keep them
        # as standalone listings — same behavior as the single delete path
        # when no twin exists).
        await db.subleases.update_many(
            {"original_property_id": {"$in": tombstone_ids}},
            {"$set": {"original_property_id": None}},
        )

    # Cascade cleanup of everything tied to the tombstoned ids only.
    # Rescued rows already had their related rows moved to the twin so
    # they shouldn't be wiped here.
    msgs_res = await db.messages.delete_many({"property_id": {"$in": tombstone_ids}}) if tombstone_ids else None
    bookings_res = await db.bookings.delete_many({"property_id": {"$in": tombstone_ids}}) if tombstone_ids else None
    if tombstone_ids:
        await db.admin_blocks.delete_many({"property_id": {"$in": tombstone_ids}})
        await db.chat_nudges.delete_many({"property_id": {"$in": tombstone_ids}})
        await db.liked_properties.delete_many({"property_id": {"$in": tombstone_ids}})

        # Pull the deleted ids out of the global featured list so the
        # homepage stops trying to render ghost cards.
        await db.site_settings.update_one(
            {"key": "global"},
            {"$pull": {"featured_property_ids": {"$in": tombstone_ids}}},
        )

    # The actual property doc delete still runs for ALL valid ids — both
    # rescued and tombstoned — since the rescue moved everything *off*
    # the loser doc; the loser itself still needs to go.
    props_res = await db.properties.delete_many({"id": {"$in": valid_ids}})

    await publish("invalidate", {
        "prefixes": [
            "/api/admin/properties", "/api/admin/dashboard", "/api/admin/chats",
            "/api/properties",
        ],
    })
    return {
        "deleted": props_res.deleted_count,
        "skipped": len(req.property_ids) - len(valid_ids),
        "messages_deleted": msgs_res.deleted_count if msgs_res else 0,
        "bookings_deleted": bookings_res.deleted_count if bookings_res else 0,
        "snapshot_id": snapshot_id,
        "rescued_count": len(rescued_ids),
        "rescue_totals": rescue_totals,
    }


class BulkRestoreRequest(BaseModel):
    """Restore a tombstone created by /admin/properties/bulk delete."""
    snapshot_id: str


@api_router.post("/admin/properties/bulk-restore")
async def admin_bulk_restore_properties(
    req: BulkRestoreRequest, payload: dict = Depends(verify_token),
) -> dict:
    """Undo a recent bulk-delete by reinserting the snapshotted documents.

    Idempotent in a "best-effort" sense — if a property id was recreated
    between delete and restore, the snapshot insert is skipped (we don't
    clobber the new doc). Snapshots remain valid until the
    ``property_tombstones`` row is removed.
    """
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    snap = await db.property_tombstones.find_one({"id": req.snapshot_id}, {"_id": 0})
    if not snap:
        raise HTTPException(status_code=404, detail="Snapshot not found or already restored")

    # Restore the properties themselves — only the ones that don't currently
    # exist (so we don't overwrite a fresh recreation with the same id).
    props_to_restore = snap.get("properties") or []
    existing_now = {
        p["id"]
        for p in await db.properties.find(
            {"id": {"$in": [p["id"] for p in props_to_restore]}}, {"_id": 0, "id": 1}
        ).to_list(len(props_to_restore))
    }
    fresh_props = [p for p in props_to_restore if p["id"] not in existing_now]
    if fresh_props:
        await db.properties.insert_many(fresh_props)

    # Restore the related rows. We use insert_many per collection;
    # duplicate ids (from a concurrent admin reseed) are silently swallowed.
    related = snap.get("related") or {}
    for coll_name, rows in related.items():
        if not rows:
            continue
        try:
            await db[coll_name].insert_many(rows, ordered=False)
        except Exception:
            # Best-effort: an inserted-since dup shouldn't block the rest.
            pass

    # Restore featured-list membership for any ids that were featured before.
    feat_ids = snap.get("featured_property_ids_present") or []
    if feat_ids:
        await db.site_settings.update_one(
            {"key": "global"},
            {"$addToSet": {"featured_property_ids": {"$each": feat_ids}}},
            upsert=True,
        )

    # Re-link any subleases that were detached.
    detached = snap.get("detached_sublease_ids") or []
    if detached:
        # Each detached sublease referenced one of the property_ids in
        # snap.property_ids — but we don't know which, so we can't safely
        # re-attach by id. We accept this — the subleases survived as
        # standalone listings; the admin can manually link if needed.
        pass

    # Tombstone consumed — remove it so a second "Undo" doesn't duplicate.
    await db.property_tombstones.delete_one({"id": req.snapshot_id})

    await publish("invalidate", {
        "prefixes": [
            "/api/admin/properties", "/api/admin/dashboard", "/api/admin/chats",
            "/api/properties",
        ],
    })
    return {
        "restored": len(fresh_props),
        "snapshot_id": req.snapshot_id,
    }


@api_router.get("/admin/properties", response_model=list[PropertyOut])
async def get_all_properties_admin(payload: dict = Depends(verify_token)) -> list[dict]:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    properties = await db.properties.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)

    # Pull every admin block in one go and group by property
    blocks_by_prop: dict = {}
    async for block in db.admin_blocks.find({}, {"_id": 0}):
        blocks_by_prop.setdefault(block["property_id"], []).append(block)

    # Fetch featured-property-ids set once; used to stamp `is_featured`
    # on every row so the admin UI can show a ★ toggle inline.
    settings = await db.site_settings.find_one({"key": "global"}, {"_id": 0, "featured_property_ids": 1})
    featured_ids = set((settings or {}).get("featured_property_ids") or [])

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
        prop["is_featured"] = prop["id"] in featured_ids

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


class BulkFeaturedBody(BaseModel):
    property_ids: list[str]
    featured: bool


@api_router.post("/admin/properties/bulk-featured", response_model=AdminToggleStatusResponse)
async def bulk_set_featured(
    body: BulkFeaturedBody,
    payload: dict = Depends(verify_token),
) -> dict:
    """Super-admin: add or remove many properties from the Featured grid
    in a single round-trip. Idempotent — adding an already-featured
    property (or removing a non-featured one) is a no-op.
    """
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    if not body.property_ids:
        raise HTTPException(status_code=400, detail="No properties provided")

    # Validate every id exists so we don't silently inject ghost ids
    existing = await db.properties.find(
        {"id": {"$in": body.property_ids}}, {"_id": 0, "id": 1}
    ).to_list(len(body.property_ids))
    valid_ids = {p["id"] for p in existing}
    missing = [pid for pid in body.property_ids if pid not in valid_ids]
    if missing:
        raise HTTPException(status_code=404, detail=f"Properties not found: {missing}")

    settings = await db.site_settings.find_one({"key": "global"}, {"_id": 0, "featured_property_ids": 1}) or {}
    current = list(settings.get("featured_property_ids") or [])
    if body.featured:
        for pid in body.property_ids:
            if pid not in current:
                current.append(pid)
        verb = "added to"
    else:
        current = [pid for pid in current if pid not in set(body.property_ids)]
        verb = "removed from"

    await db.site_settings.update_one(
        {"key": "global"},
        {"$set": {
            "featured_property_ids": current,
            "updated_at": datetime.now(UTC).isoformat(),
        }},
        upsert=True,
    )
    await publish("invalidate", {"prefixes": ["/api/admin/properties", "/api/admin/settings"]})
    return {
        "message": f"{len(body.property_ids)} properties {verb} featured listings",
        "status": "featured" if body.featured else "unfeatured",
    }


@api_router.put("/admin/properties/{property_id}/featured", response_model=AdminToggleStatusResponse)
async def toggle_property_featured(
    property_id: str,
    payload: dict = Depends(verify_token),
) -> dict:
    """Super-admin: add/remove a property from the homepage Featured grid.

    Mutates `site_settings.featured_property_ids`. Idempotent in both
    directions — clicking the toggle twice ends up at the same state.
    Publishes cache-invalidation so admin dashboards refresh instantly.
    """
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0, "id": 1})
    if prop is None:
        raise HTTPException(status_code=404, detail="Property not found")

    settings = await db.site_settings.find_one({"key": "global"}, {"_id": 0, "featured_property_ids": 1}) or {}
    current = list(settings.get("featured_property_ids") or [])
    if property_id in current:
        current.remove(property_id)
        new_state = False
    else:
        current.append(property_id)
        new_state = True

    await db.site_settings.update_one(
        {"key": "global"},
        {"$set": {
            "featured_property_ids": current,
            "updated_at": datetime.now(UTC).isoformat(),
        }},
        upsert=True,
    )
    await publish("invalidate", {"prefixes": ["/api/admin/properties", "/api/admin/settings"]})
    return {
        "message": "Added to featured listings" if new_state else "Removed from featured listings",
        "status": "featured" if new_state else "unfeatured",
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

    # Pre-fetch every user + property referenced by these messages in a
    # couple of bulk queries — avoids the per-message find_one round-trips
    # that used to dominate the runtime for large message sets.
    user_ids = {m["sender_id"] for m in messages} | {m["receiver_id"] for m in messages}
    prop_ids = {m["property_id"] for m in messages}
    users_by_id = {
        u["id"]: u
        for u in await db.users.find(
            {"id": {"$in": list(user_ids)}},
            {"_id": 0, "id": 1, "name": 1, "role": 1, "email": 1},
        ).to_list(len(user_ids) + 1)
    }
    props_by_id = {
        p["id"]: p
        for p in await db.properties.find(
            {"id": {"$in": list(prop_ids)}},
            {"_id": 0, "id": 1, "title": 1, "owner_id": 1},
        ).to_list(len(prop_ids) + 1)
    }

    conversations: dict[str, dict] = {}
    for msg in messages:
        conv_key = f"{msg['property_id']}_{min(msg['sender_id'], msg['receiver_id'])}_{max(msg['sender_id'], msg['receiver_id'])}"
        if conv_key not in conversations:
            prop = props_by_id.get(msg["property_id"])
            sender = users_by_id.get(msg["sender_id"]) or {}
            receiver = users_by_id.get(msg["receiver_id"]) or {}
            conversations[conv_key] = {
                "conv_key": conv_key,
                "property_id": msg["property_id"],
                "property_title": (prop or {}).get("title", "Unknown"),
                "owner_id": (prop or {}).get("owner_id"),
                # True when the referenced property has been deleted — lets
                # the admin UI render a "Listing removed — re-attach to a
                # surviving listing?" badge with a one-click resolver.
                "property_missing": prop is None,
                "participants": [
                    {"id": msg["sender_id"], "name": sender.get("name", "Unknown"), "role": sender.get("role", ""), "email": sender.get("email", "")},
                    {"id": msg["receiver_id"], "name": receiver.get("name", "Unknown"), "role": receiver.get("role", ""), "email": receiver.get("email", "")},
                ],
                "messages": [],
                # Filled in below — `messages` is iterated newest-first so
                # the first encountered message is the latest one.
                "last_message_time": msg["created_at"],
                "last_message_sender_id": msg["sender_id"],
                "last_message_preview": (msg.get("message") or "")[:160],
            }
        conversations[conv_key]["messages"].append({
            "sender_id": msg["sender_id"],
            "message": msg["message"],
            "image_url": msg.get("image_url"),
            "video_url": msg.get("video_url"),
            "created_at": msg["created_at"],
        })

    # Sort each conv's messages chronologically (oldest → newest) so the UI
    # reads top-to-bottom like a normal chat thread. Then compute the
    # "owner unresponsive" signal: the *renter* sent the latest message
    # AND it's been > 24h with no owner reply. Per-conv metadata also
    # carries last_nudge_sent_at so the frontend can hide the nudge
    # button after a recent email was sent.
    now = datetime.now(UTC)
    out: list[dict] = []
    for conv in conversations.values():
        conv["messages"].sort(key=lambda m: m.get("created_at") or "")
        owner_id = conv.get("owner_id")
        # Identify the renter participant — whichever participant isn't the owner.
        renter = next(
            (p for p in conv["participants"] if p["id"] != owner_id),
            None,
        )
        last_sender_role = "owner" if conv["last_message_sender_id"] == owner_id else "renter"
        # Hours since the most recent message, only if last sender is the
        # renter (we don't nudge owners who've already replied).
        hours_since = None
        unresponsive = False
        try:
            last_dt = datetime.fromisoformat(conv["last_message_time"].replace("Z", "+00:00"))
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=UTC)
            hours_since = (now - last_dt).total_seconds() / 3600.0
        except Exception:
            hours_since = None
        if last_sender_role == "renter" and hours_since is not None and hours_since >= 24:
            unresponsive = True

        # Read throttle: when was the last nudge email sent for this conv?
        nudge_doc = await db.chat_nudges.find_one({"conv_key": conv["conv_key"]}, {"_id": 0, "sent_at": 1})
        last_nudge_at = (nudge_doc or {}).get("sent_at")

        conv["last_sender_role"] = last_sender_role
        conv["hours_since_last_message"] = round(hours_since, 1) if hours_since is not None else None
        conv["owner_unresponsive"] = unresponsive
        conv["renter_id"] = (renter or {}).get("id")
        conv["last_nudge_sent_at"] = last_nudge_at
        out.append(conv)

    # Sort the whole list newest-first so the admin sees the active
    # conversations at the top of the page.
    out.sort(key=lambda c: c.get("last_message_time") or "", reverse=True)
    return out


class NudgeOwnerRequest(BaseModel):
    """Sends a courtesy email reminding the property owner to reply to a
    renter inquiry. Throttled to one nudge per ``conv_key`` per 24h to
    avoid spamming owners after the admin auto-batches a scan."""
    conv_key: str


@api_router.post("/admin/chats/nudge-owner")
async def nudge_owner(req: NudgeOwnerRequest, payload: dict = Depends(verify_token)) -> dict:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    # conv_key shape from get_all_chats: "<property_id>_<user_a>_<user_b>"
    try:
        property_id, user_a, user_b = req.conv_key.split("_", 2)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Malformed conv_key") from e

    prop = await db.properties.find_one({"id": property_id}, {"_id": 0, "title": 1, "owner_id": 1})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    owner_id = prop.get("owner_id")
    renter_id = user_b if user_a == owner_id else (user_a if user_b == owner_id else None)
    if not owner_id or not renter_id:
        raise HTTPException(status_code=400, detail="Couldn't identify owner / renter for this conversation")

    owner = await db.users.find_one({"id": owner_id}, {"_id": 0, "name": 1, "email": 1})
    renter = await db.users.find_one({"id": renter_id}, {"_id": 0, "name": 1})
    if not owner or not owner.get("email"):
        raise HTTPException(status_code=400, detail="Owner has no email on file")

    # Re-verify the conversation is still actually waiting on the owner —
    # don't send a nudge if they've replied in the interim (UI may be stale).
    latest = await db.messages.find_one(
        {
            "property_id": property_id,
            "$or": [
                {"sender_id": owner_id, "receiver_id": renter_id},
                {"sender_id": renter_id, "receiver_id": owner_id},
            ],
        },
        {"_id": 0, "sender_id": 1, "created_at": 1},
        sort=[("created_at", -1)],
    )
    if not latest or latest["sender_id"] == owner_id:
        raise HTTPException(
            status_code=409,
            detail="Owner has already replied — no nudge needed.",
        )

    # 24h throttle.
    now = datetime.now(UTC)
    existing = await db.chat_nudges.find_one({"conv_key": req.conv_key}, {"_id": 0, "sent_at": 1})
    if existing and existing.get("sent_at"):
        try:
            sent_dt = datetime.fromisoformat(existing["sent_at"].replace("Z", "+00:00"))
            if sent_dt.tzinfo is None:
                sent_dt = sent_dt.replace(tzinfo=UTC)
            hours_since = (now - sent_dt).total_seconds() / 3600.0
            if hours_since < 24:
                raise HTTPException(
                    status_code=429,
                    detail=f"A nudge was already sent {round(hours_since, 1)}h ago — try again after 24h.",
                )
        except HTTPException:
            raise
        except Exception:
            pass

    # Compose the courtesy email. We deliberately keep it gentle — these
    # owners are usually individual landlords, not staff.
    # Fire-and-forget the actual Postmark call so the admin gets a snappy
    # response — Postmark API latency through some regions can exceed the
    # Cloudflare 30s edge timeout and we don't want the request to fail
    # *after* doing all the DB work.
    from utils.email import send_email, FRONTEND_URL
    inbox_link = f"{(FRONTEND_URL or 'https://myisraelrental.com').rstrip('/')}/chat/{property_id}"
    renter_name = (renter or {}).get("name") or "a prospective renter"
    prop_title = prop.get("title") or "your listing"

    # Record the throttle row BEFORE dispatching so a second click within
    # seconds gets 429'd (the response hasn't returned yet).
    await db.chat_nudges.update_one(
        {"conv_key": req.conv_key},
        {"$set": {
            "conv_key": req.conv_key,
            "property_id": property_id,
            "owner_id": owner_id,
            "renter_id": renter_id,
            "sent_at": now.isoformat(),
            "sent_by_admin": payload.get("user_id"),
            "email_status": "queued",
        }},
        upsert=True,
    )

    asyncio.create_task(send_email(
        to_email=owner["email"],
        subject=f"Reminder: {renter_name} is waiting to hear from you about {prop_title}",
        html_body=(
            f"<p>Hi {owner.get('name') or ''},</p>"
            f"<p><b>{renter_name}</b> messaged you about <b>{prop_title}</b> on MyIsraelRental "
            f"more than 24 hours ago and hasn't heard back yet.</p>"
            f"<p>Replies within a day dramatically increase the chance the listing gets rented — "
            f"prospective tenants usually message several owners in parallel and lock in with whoever replies first.</p>"
            f"<p style='margin:24px 0;'>"
            f"<a href=\"{inbox_link}\" style='background:#1E6A6A;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;'>Open the conversation</a>"
            f"</p>"
            f"<p style='color:#888;font-size:13px;'>If you no longer have this listing available, "
            f"please mark it as unavailable in your dashboard so we stop showing it.</p>"
        ),
        tag="admin-owner-nudge",
        skip_suppression_check=False,
    ))

    return {
        "owner_email": owner["email"],
        "owner_name": owner.get("name"),
        "sent_at": now.isoformat(),
    }


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
