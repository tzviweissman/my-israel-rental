"""Admin routes for real-time events (SSE), Postmark deliverability
webhook, and the email-health dashboard.

Extracted from ``admin.py`` in the 2026-07 refactor. Behaviour is
identical — same endpoints, same auth gates, same helper contracts.
"""
import asyncio
import json
import os
import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from models_response import (
    AdminEmailHealthResponse,
    OkResponse,
    SubscribersResponse,
)
from routes.deps import POSTMARK_WEBHOOK_SECRET, db, logger, verify_token
from utils.auth import decode_query_token
from utils.events import publish, subscribe, subscriber_count, unsubscribe

router = APIRouter()
api_router = router

# `publish` is exported here so other refactored admin modules can import
# invalidation events from a single place without pulling in the whole
# `utils.events` module surface. Keeping this line prevents "unused
# import" complaints from linters when the file grows.
__all__ = ["router", "publish"]


# ---------------------------------------------------------------------------
# Live event channel for the admin dashboard.
# ---------------------------------------------------------------------------
# When any of the admin mutation handlers run, they ``publish()`` a tiny
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

    # Loud check on POSTMARK_SERVER_TOKEN — surfaces a broken pipeline
    # to the admin without them having to shell into the pod.
    postmark_token_present = bool(os.environ.get("POSTMARK_SERVER_TOKEN"))

    # Recent send failures (30-day window) — grouped so the admin can
    # spot patterns (e.g. suppression cascade, Postmark token missing).
    send_failure_pipeline = [
        {"$match": {"received_at": {"$gte": thirty_days_ago}}},
        {"$group": {"_id": "$reason_code", "count": {"$sum": 1}}},
    ]
    fail_agg = await db.email_send_failures.aggregate(send_failure_pipeline).to_list(50)
    send_failure_counts = {row["_id"]: row["count"] for row in fail_agg}
    recent_failures = await db.email_send_failures.find(
        {}, {"_id": 0}
    ).sort("received_at", -1).limit(50).to_list(50)

    return {
        "window_days": 30,
        "delivered": delivered,
        "bounced": bounced,
        "complained": complained,
        "delivery_rate_pct": delivery_rate,
        "suppressed_users": suppressed_users,
        "recent_events": recent,
        "postmark_token_present": postmark_token_present,
        "send_failure_counts": send_failure_counts,
        "recent_failures": recent_failures,
    }


# ── Per-user email diagnostic ─────────────────────────────────────────
# One-shot admin lookup: given an email or user_id, dump the exact
# suppression state, throttle rows, and last N deliverability events so
# support can answer "why didn't user X get the email?" in one click
# instead of grepping Mongo shells.
@api_router.get("/admin/email/diagnose")
async def admin_email_diagnose(
    email: str | None = None,
    user_id: str | None = None,
    payload: dict = Depends(verify_token),
) -> dict:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    if not email and not user_id:
        raise HTTPException(status_code=400, detail="Provide email or user_id")

    query = {"id": user_id} if user_id else {"email": (email or "").strip().lower()}
    user = await db.users.find_one(
        query,
        {"_id": 0, "id": 1, "email": 1, "name": 1, "role": 1,
         "email_verified": 1, "email_suppressed": 1,
         "email_suppressed_reason": 1, "email_suppressed_at": 1,
         "created_at": 1},
    )
    if not user:
        # Fall back to a case-insensitive scan for legacy mixed-case rows
        # written before the 2026-07 lowercase normalization.
        if email:
            user = await db.users.find_one(
                {"email": {"$regex": f"^{email}$", "$options": "i"}},
                {"_id": 0, "id": 1, "email": 1, "name": 1, "role": 1,
                 "email_verified": 1, "email_suppressed": 1,
                 "email_suppressed_reason": 1, "email_suppressed_at": 1,
                 "created_at": 1},
            )
        if not user:
            return {"found": False, "queried": query}

    lookup_email = (user.get("email") or "").lower()
    recent_events = await db.email_events.find(
        {"email": lookup_email}, {"_id": 0, "raw": 0},
    ).sort("received_at", -1).limit(20).to_list(20)
    throttle_rows = await db.chat_email_throttle.find(
        {"to_email": lookup_email}, {"_id": 0},
    ).sort("last_sent_at", -1).limit(10).to_list(10)
    recent_failures = await db.email_send_failures.find(
        {"to_email": lookup_email}, {"_id": 0},
    ).sort("received_at", -1).limit(20).to_list(20)

    return {
        "found": True,
        "user": user,
        "recent_events": recent_events,
        "chat_throttle": throttle_rows,
        "recent_send_failures": recent_failures,
    }
