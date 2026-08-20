"""Admin core routes — dashboard, bookings, user management, site settings.

After the 2026-07 refactor, admin functionality is split across sibling
modules inside the ``routes.admin`` package:
  * ``events`` — SSE, Postmark webhook, email-health
  * ``duplicates`` — duplicate detection + auto-cleanup
  * ``chats_nudge`` — chat list, reattach, owner-nudge system
  * ``properties_bulk`` — bulk delete/restore/mark-booked, managed/featured toggles
"""
import asyncio
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import jwt

from fastapi import APIRouter, Depends, HTTPException

from models import SiteSettings
from models_response import (
    AdminDashboardResponse,
    AdminToggleStatusResponse,
    AnyResponse,
    MessageResponse,
    UserPublic,
)
from routes.deps import db, verify_token
from utils.auth import JWT_SECRET
from utils.events import publish

router = APIRouter()
api_router = router  # alias so existing @api_router decorators work verbatim




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
        "recent_properties": recent_properties
    }


# Ranges the Overview offers (spec A6). Value is days back; None is all time.
# "today" is a CALENDAR day in Israel, not the last 24 hours — an admin
# asking "today" means since this morning, and the business runs on Israel
# time. Same timezone the QR scan buckets already use.
METRIC_RANGES: dict[str, int | None] = {"today": 0, "7d": 7, "30d": 30, "all": None}


def _range_cutoffs(rng: str) -> tuple[datetime | None, str | None]:
    """Return (datetime cutoff, naive-ISO-string cutoff) for a range key.

    BOTH forms are returned because this database stores the same idea two
    ways and Mongo will not compare across them: every business collection
    writes ``created_at`` as an ISO *string*, while ``property_view_events``
    writes ``at`` as a real datetime. Querying a string field with a
    datetime matches nothing and returns a confident 0 — verified against
    real data, where a 30-day user count read 33 by string and 0 by
    datetime. So each query below must pick the form that matches its own
    collection.

    The string cutoff is deliberately built WITHOUT a timezone offset:
    stored values are mostly naive, and a naive cutoff orders correctly
    against both naive and offset-suffixed values.
    """
    if rng == "all":
        return None, None
    now = datetime.now(UTC)
    if rng == "today":
        israel = ZoneInfo("Asia/Jerusalem")
        local_midnight = now.astimezone(israel).replace(hour=0, minute=0, second=0, microsecond=0)
        cutoff = local_midnight.astimezone(UTC)
    else:
        cutoff = now - timedelta(days=METRIC_RANGES.get(rng) or 0)
    return cutoff, cutoff.replace(tzinfo=None).isoformat()


@api_router.get("/admin/metrics")
async def get_admin_metrics(
    payload: dict = Depends(verify_token),
    range: str = "all",
) -> dict:
    """KPI numbers for a time range (spec A6).

    Split into ``flow`` and ``stock`` because conflating them is how a
    dashboard starts lying. Flow is "how many happened in the period" and
    genuinely responds to the range. Stock is "how many exist right now" —
    active listings, open requests — and a date range simply does not apply
    to it. Rather than silently leave stock unfiltered while it sits beside
    filtered numbers under one range control, the two are returned
    separately so the console can label them differently.

    Views come from ``property_view_events`` for EVERY range including
    "all", never from the ``properties.views`` counter. Mixing the two was
    the first attempt and it produced a dashboard that contradicted itself:
    all-time read 14 while the last 30 days read 93, because the counter
    and the event log have different histories and are reset by different
    things. A total smaller than one of its own subsets reads as a broken
    console, and rightly so. One source keeps the series monotonic, at the
    cost of only counting views since event logging began — which is what
    ``views_since`` reports, so the number can be labelled honestly rather
    than passing itself off as all of history.
    """
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if range not in METRIC_RANGES:
        raise HTTPException(status_code=400, detail=f"range must be one of {sorted(METRIC_RANGES)}")

    dt_cut, iso_cut = _range_cutoffs(range)
    now_iso = datetime.now(UTC).isoformat()

    # --- stock: true right now, unaffected by the range ---
    stock = {
        "active_listings": await db.properties.count_documents({"status": "active"}),
        "active_services": await db.marketplace_gigs.count_documents({"status": "published"}),
        "businesses": await db.businesses.count_documents({"active": True}),
        "open_requests": await db.requests.count_documents(
            {"status": "open", "expires_at": {"$gte": now_iso}}
        ),
    }

    # --- flow: things that happened inside the range ---
    # String cutoffs for these four; an empty filter when the range is all
    # time. See _range_cutoffs for why the type has to match the collection.
    since = {} if iso_cut is None else {"created_at": {"$gte": iso_cut}}
    flow = {
        "new_listings": await db.properties.count_documents(since),
        "new_users": await db.users.count_documents(since),
        "bookings": await db.bookings.count_documents(since),
        "new_services": await db.marketplace_gigs.count_documents(since),
    }

    # Datetime cutoff here — different collection, different stored type.
    view_q = {} if dt_cut is None else {"at": {"$gte": dt_cut}}
    flow["views"] = await db.property_view_events.count_documents(view_q)

    # When view logging actually began, so "all time" can say what it means
    # instead of implying it covers the whole life of the site.
    first = await db.property_view_events.find_one({}, {"at": 1}, sort=[("at", 1)])
    views_since = first["at"].isoformat() if first and first.get("at") else None

    return {
        "range": range,
        "flow": flow,
        "stock": stock,
        "views_source": "events",
        "views_since": views_since,
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


@api_router.post("/admin/users/{user_id}/resend-set-password", response_model=MessageResponse)
async def resend_set_password_email(user_id: str, payload: dict = Depends(verify_token)) -> dict:
    """Re-send the "Set your password" email to an admin-imported owner
    who hasn't finished onboarding yet.

    Guardrails:
      • Admin-only.
      • Only imported accounts (`admin_imported=True`) are eligible —
        we don't want an admin accidentally spamming legitimate
        self-signup users with a reset link.
      • Refuses if the owner has already completed onboarding
        (`password_set_at` is set). If they've forgotten their password
        after that, they use the normal /auth/forgot-password flow.
      • Reuses `_issue_reset_token` from admin_import so the email +
        expiry semantics stay identical to the original invite.
    """
    if payload.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    target = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if not target.get('admin_imported'):
        raise HTTPException(status_code=400, detail="Only admin-imported accounts can be re-sent a set-password email")
    if target.get('password_set_at'):
        raise HTTPException(status_code=400, detail="This owner has already set their password")

    from routes.admin_import import _issue_reset_token, _frontend_origin
    from utils.email import send_email

    email_lc = (target.get('email') or '').strip().lower()
    display_name = target.get('name') or email_lc
    raw_token = await _issue_reset_token(target['id'], email_lc)
    link = f"{_frontend_origin()}/auth/reset-password?token={raw_token}"
    asyncio.create_task(send_email(
        to_email=email_lc,
        subject="Your MyIsraelRental account is ready — set your password",
        html_body=(
            f"<p>Hi {display_name},</p>"
            "<p>This is a friendly reminder — your <b>MyIsraelRental.com</b> owner account "
            "is set up and waiting for you.</p>"
            "<p>To finish onboarding, please set your password using the link below "
            "(valid for 24 hours):</p>"
            f"<p><a href=\"{link}\" style='background:#1E6A6A;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;'>Set my password</a></p>"
            f"<p>Or copy and paste: {link}</p>"
        ),
        tag="admin-imported-owner-resend",
        skip_suppression_check=True,
    ))
    return {"message": f"Set-password email re-sent to {email_lc}"}














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
