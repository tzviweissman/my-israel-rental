"""Auto-extracted from server.py during the 2026-04 refactor."""
import asyncio
import json
import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
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
    from utils.dedupe import normalize_address
    # Pull the fields needed to group AND to help the admin decide which
    # copy to keep (image count, cover URL, age).
    rows = await db.properties.find(
        {"status": {"$in": ["active", "pending", "draft"]}},
        {
            "_id": 0, "id": 1, "owner_id": 1, "title": 1, "address": 1,
            "rental_type": 1, "created_at": 1, "images": 1,
            "description": 1, "monthly_price": 1, "nightly_price": 1,
        },
    ).to_list(5000)

    # Group by (owner_id, normalized_address, rental_type)
    groups: dict[tuple[str, str, str], list[dict]] = {}
    for r in rows:
        addr = normalize_address(r.get("address"))
        rt = r.get("rental_type")
        if not addr or not rt or not r.get("owner_id"):
            continue
        key = (r["owner_id"], addr, rt)
        # Trim each property to the shape the admin UI needs — keeps the
        # response payload small even when there are dozens of groups.
        images = r.get("images") or []
        groups.setdefault(key, []).append({
            "id": r["id"],
            "title": r.get("title"),
            "created_at": r.get("created_at"),
            "image_count": len(images),
            "cover_url": images[0] if images else None,
            "description_length": len(r.get("description") or ""),
            "monthly_price": r.get("monthly_price"),
            "nightly_price": r.get("nightly_price"),
        })

    # Keep only groups with 2+ properties
    out = []
    for (owner_id, addr, rt), props in groups.items():
        if len(props) < 2:
            continue
        owner = await db.users.find_one({"id": owner_id}, {"_id": 0, "name": 1, "email": 1})
        out.append({
            "owner_id": owner_id,
            "owner_name": owner.get("name") if owner else None,
            "owner_email": owner.get("email") if owner else None,
            "address": addr,
            "rental_type": rt,
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

    from utils.dedupe import normalize_address
    rows = await db.properties.find(
        {"status": {"$in": ["active", "pending", "draft"]}},
        {
            "_id": 0, "id": 1, "owner_id": 1, "address": 1, "rental_type": 1,
            "created_at": 1, "images": 1, "description": 1,
        },
    ).to_list(5000)

    # Same grouping logic as /admin/duplicates.
    groups: dict[tuple[str, str, str], list[dict]] = {}
    for r in rows:
        addr = normalize_address(r.get("address"))
        rt = r.get("rental_type")
        if not addr or not rt or not r.get("owner_id"):
            continue
        groups.setdefault((r["owner_id"], addr, rt), []).append(r)

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
    for (owner_id, addr, rt), props in groups.items():
        if len(props) < 2:
            continue
        key_str = f"{owner_id}|{addr}|{rt}"
        if target_keys is not None and key_str not in target_keys:
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

        res = await db.properties.delete_many({"id": {"$in": loser_ids}})
        deleted_total += res.deleted_count
        report.append({
            "key": key_str,
            "kept_id": keeper_id,
            "deleted_ids": loser_ids,
            "deleted_count": res.deleted_count,
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
    """
    property_ids: list[str] = Field(..., max_length=500)


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
        }

    # ---- Snapshot every row about to be touched so the admin can Undo. ----
    # We capture the *full* documents (sans `_id` since pymongo strips it)
    # so a restore is a straight `insert_many` — no schema reconstruction
    # needed. Includes the featured-list state and a list of detached
    # sublease ids so we can re-link them on restore.
    snapshot_id = str(uuid.uuid4())
    now_iso = datetime.now(UTC).isoformat()
    related = {
        "messages": await db.messages.find(
            {"property_id": {"$in": valid_ids}}, {"_id": 0}
        ).to_list(20000),
        "bookings": await db.bookings.find(
            {"property_id": {"$in": valid_ids}}, {"_id": 0}
        ).to_list(20000),
        "admin_blocks": await db.admin_blocks.find(
            {"property_id": {"$in": valid_ids}}, {"_id": 0}
        ).to_list(20000),
        "chat_nudges": await db.chat_nudges.find(
            {"property_id": {"$in": valid_ids}}, {"_id": 0}
        ).to_list(20000),
        "liked_properties": await db.liked_properties.find(
            {"property_id": {"$in": valid_ids}}, {"_id": 0}
        ).to_list(20000),
    }
    settings = await db.site_settings.find_one({"key": "global"}, {"_id": 0, "featured_property_ids": 1}) or {}
    featured_present = [pid for pid in (settings.get("featured_property_ids") or []) if pid in set(valid_ids)]
    detached_sub_ids = [
        s["id"]
        async for s in db.subleases.find(
            {"original_property_id": {"$in": valid_ids}}, {"_id": 0, "id": 1}
        )
    ]
    await db.property_tombstones.insert_one({
        "id": snapshot_id,
        "deleted_at": now_iso,
        "deleted_by": payload.get("user_id"),
        "property_ids": valid_ids,
        "properties": existing_props,
        "related": related,
        "featured_property_ids_present": featured_present,
        "detached_sublease_ids": detached_sub_ids,
    })

    # Detach any subleases that referenced these properties (keep them as
    # standalone listings — same behavior as the single-property delete).
    await db.subleases.update_many(
        {"original_property_id": {"$in": valid_ids}},
        {"$set": {"original_property_id": None}},
    )

    # Cascade cleanup of everything tied to these property ids.
    msgs_res = await db.messages.delete_many({"property_id": {"$in": valid_ids}})
    bookings_res = await db.bookings.delete_many({"property_id": {"$in": valid_ids}})
    await db.admin_blocks.delete_many({"property_id": {"$in": valid_ids}})
    await db.chat_nudges.delete_many({"property_id": {"$in": valid_ids}})
    await db.liked_properties.delete_many({"property_id": {"$in": valid_ids}})

    # Pull the deleted ids out of the global featured list so the homepage
    # stops trying to render ghost cards.
    await db.site_settings.update_one(
        {"key": "global"},
        {"$pull": {"featured_property_ids": {"$in": valid_ids}}},
    )

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
        "messages_deleted": msgs_res.deleted_count,
        "bookings_deleted": bookings_res.deleted_count,
        "snapshot_id": snapshot_id,
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
