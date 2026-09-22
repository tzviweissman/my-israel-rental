"""Admin core routes — dashboard, bookings, user management, site settings.

After the 2026-07 refactor, admin functionality is split across sibling
modules inside the ``routes.admin`` package:
  * ``events`` — SSE, Postmark webhook, email-health
  * ``duplicates`` — duplicate detection + auto-cleanup
  * ``chats_nudge`` — chat list, reattach, owner-nudge system
  * ``properties_bulk`` — bulk delete/restore/mark-booked, managed/featured toggles
"""
import asyncio
import uuid
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
from routes.deps import db, logger, verify_token
from utils import view_tracking
from utils.auth import JWT_SECRET
from utils.contract_files import resolve_private_contract_file
from routes.site_visits import site_summary
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


async def _qr_scans_by_owner(rng: str) -> dict:
    """QR / short-link scans per owner for a range key.

    short_links keeps no events: a running `scan_count` plus per-Israel-day
    buckets under `daily.YYYY-MM-DD`. "All time" reads the total; any other
    range sums the buckets inside the window, keyed the way the scan writer
    keys them, so a 23:30 scan lands on the day it happened in.
    """
    out: dict = {}
    wanted = None
    if rng != "all":
        _, day_keys = view_tracking.il_day_window(max(METRIC_RANGES.get(rng) or 1, 1))
        wanted = set(day_keys)
    async for link in db.short_links.find({}, {"owner_user_id": 1, "scan_count": 1, "daily": 1}):
        if wanted is None:
            n = int(link.get("scan_count") or 0)
        else:
            n = sum(int(v) for k, v in (link.get("daily") or {}).items() if k in wanted)
        if n:
            owner = link.get("owner_user_id")
            out[owner] = out.get(owner, 0) + n
    return out


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

    # The demand side, which this endpoint never reported (Tzvi, 18 Sep
    # 2026: "how many WhatsApp clicks, so I can track growth"). Every one of
    # these was already being RECORDED - owners see their own numbers - but
    # the site-wide total reached no screen, so the console could say how
    # many listings existed and not whether anyone wanted them.
    #
    # Three collections, three timestamp shapes, per the note above:
    #   marketplace_view_events.at   - datetime (same writer style as
    #                                  property views; gigs + business pages)
    #   lead_events.created_at       - ISO string (every WhatsApp redirect)
    #   short_links.daily.YYYY-MM-DD - per-Israel-day counters, no events
    # gig + business only. This stream ALSO carries property visitors
    # (entity_type "property"), and counting them here double-reported
    # properties under a "services" label - caught 18 Sep, the day after
    # this card shipped.
    flow["service_views"] = await db.marketplace_view_events.count_documents(
        {**view_q, "entity_type": {"$in": ["gig", "business"]}}
    )
    flow["whatsapp_clicks"] = await db.lead_events.count_documents(
        {"type": "whatsapp_click", **since}
    )
    flow["qr_scans"] = sum((await _qr_scans_by_owner(range)).values())

    # The whole site, not just listings (Tzvi, 18 Sep 2026): the home page,
    # Stays, search, the Requests board - where most people land and which
    # no other counter here sees. Israel-day keys, like the QR buckets, so
    # "today" means since midnight in Jerusalem.
    site_days = None
    if range != "all":
        _, site_days = view_tracking.il_day_window(max(METRIC_RANGES.get(range) or 1, 1))
    site = await site_summary(site_days)
    flow["site_visitors"] = site["visitors"]
    flow["site_pageviews"] = site["pageviews"]

    # When view logging actually began, so "all time" can say what it means
    # instead of implying it covers the whole life of the site.
    # Some old rows hold `at` as an ISO string, and Mongo sorts every string
    # before every date, so the earliest of each type is read and compared.
    # Assuming a datetime put a 500 on the admin overview (22 Sep 2026).
    starts = []
    for kind in ("date", "string"):
        row = await db.property_view_events.find_one({"at": {"$type": kind}}, {"at": 1}, sort=[("at", 1)])
        at = (row or {}).get("at")
        if isinstance(at, str):
            try:
                at = datetime.fromisoformat(at)
            except ValueError:
                at = None
        if isinstance(at, datetime):
            starts.append(at if at.tzinfo else at.replace(tzinfo=UTC))
    views_since = min(starts).isoformat() if starts else None

    return {
        "range": range,
        "flow": flow,
        "stock": stock,
        "views_source": "events",
        "views_since": views_since,
        # First day the site-wide counter ran. Lifetime means "since then":
        # nothing before it was recorded, and saying so is the honest label.
        "site_since": site["since"],
    }


@api_router.get("/admin/metrics/by-user")
async def get_admin_metrics_by_user(
    payload: dict = Depends(verify_token),
    range: str = "all",
    limit: int = 200,
) -> dict:
    """WhatsApp taps, visitors and QR scans per person, for a range.

    The site-wide cards say whether demand is growing; this says whose it
    is (Tzvi, 18 Sep 2026). Each person's numbers are the sum across
    everything they own - flats, services, business pages, Requests posts.

    Who a tap belongs to is stored under a different name per source, read
    off the real documents: `owner_id` for a property, `provider_id` for a
    service, `poster_id` for a Requests post. Coalesced here rather than
    migrated, so no row is rewritten to answer a report.

    "Visitors" is the deduplicated stream (one visitor per listing per day,
    never the owner) - the same number each person sees on their own
    dashboard, so the two screens cannot disagree about one listing.
    """
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if range not in METRIC_RANGES:
        raise HTTPException(status_code=400, detail=f"range must be one of {sorted(METRIC_RANGES)}")
    limit = max(1, min(limit, 1000))

    dt_cut, iso_cut = _range_cutoffs(range)
    since = {} if iso_cut is None else {"created_at": {"$gte": iso_cut}}
    view_q = {} if dt_cut is None else {"at": {"$gte": dt_cut}}

    taps: dict = {}
    async for row in db.lead_events.aggregate([
        {"$match": {"type": "whatsapp_click", **since}},
        {"$group": {
            "_id": {"$ifNull": ["$owner_id", {"$ifNull": ["$provider_id", "$poster_id"]}]},
            "n": {"$sum": 1},
        }},
    ]):
        taps[row["_id"]] = row["n"]

    visitors: dict = {}
    async for row in db.marketplace_view_events.aggregate([
        {"$match": view_q},
        {"$group": {"_id": "$owner_id", "n": {"$sum": 1}}},
    ]):
        visitors[row["_id"]] = row["n"]

    scans = await _qr_scans_by_owner(range)

    ids = [i for i in set(taps) | set(visitors) | set(scans) if i]
    people = {
        u["id"]: u async for u in db.users.find(
            {"id": {"$in": ids}}, {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1},
        )
    }
    rows = []
    for uid in ids:
        u = people.get(uid) or {}
        rows.append({
            "user_id": uid,
            # None when the account has since been deleted: their taps and
            # visitors still happened, and dropping them would make the
            # per-person total disagree with the site-wide card above it.
            "name": u.get("name"),
            "email": u.get("email"),
            "role": u.get("role"),
            "whatsapp_clicks": taps.get(uid, 0),
            "visitors": visitors.get(uid, 0),
            "qr_scans": scans.get(uid, 0),
        })
    rows.sort(key=lambda r: (-r["whatsapp_clicks"], -r["visitors"], -r["qr_scans"], r["name"] or ""))
    return {"range": range, "people": len(rows), "rows": rows[:limit]}


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
    upd: dict = {"status": new_status}
    if new_status == "blocked":
        # Their open sessions end now, not in up to 30 days (security scan
        # F9); verify_token refuses a blocked account either way.
        upd["tokens_valid_after"] = int(datetime.now(UTC).timestamp())
    await db.users.update_one({"id": user_id}, {"$set": upd})
    from utils.auth import forget_user
    forget_user(user_id)
    await publish("invalidate", {"prefixes": ["/api/admin/users", "/api/admin/dashboard"]})
    return {"message": f"User {new_status}", "status": new_status}


# Everything that belongs to ONE person and to nobody else. Deleting the
# account deletes these, because leaving them behind is what produced live
# gigs by a ghost provider, businesses with no owner, and a Requests board
# advertising people who no longer exist.
#
# `(collection, field)`. The fields are not guessable and were read off the
# real documents rather than inferred from the route code, which names the
# same thing `user_id`, `owner_id`, `owner_user_id`, `provider_user_id`,
# `poster_user_id` and `subleasor_id` in different places.
_USER_OWNED = (
    ("properties", "owner_id"),
    ("businesses", "owner_user_id"),
    ("marketplace_gigs", "provider_user_id"),
    ("marketplace_providers", "user_id"),
    ("marketplace_jobs", "poster_user_id"),
    ("marketplace_job_searches", "user_id"),
    ("requests", "poster_user_id"),
    ("subleases", "subleasor_id"),
    ("smart_lists", "owner_id"),
    ("short_links", "owner_user_id"),
    ("saved_searches", "user_id"),
    ("saved_search_alerts", "user_id"),
    ("liked_properties", "user_id"),
    ("notification_preferences", "user_id"),
    ("job_notification_preferences", "user_id"),
    ("notifications", "user_id"),
    ("onboarding_dismissals", "user_id"),
    ("onboarding_tour", "user_id"),
    ("onboarding_tour_events", "user_id"),
    ("password_resets", "user_id"),
    ("chat_email_throttle", "sender_id"),
    ("marketplace_view_events", "owner_id"),
    ("lead_events", "poster_id"),
)

# Deliberately NOT deleted, and this is the decision rather than an omission
# (Tzvi, 16 Sep 2026). Each of these has a SECOND person in it, and that
# person did not ask to be forgotten:
#
#   bookings, marketplace_bookings  - the other party's booking
#   contracts                       - a signed contract belongs to both
#   messages                        - the other half of a conversation
#   marketplace_reviews             - what they wrote about someone else
#   store_orders, store_standing_orders, marketplace_job_applications
#   request_reports                 - moderation evidence about a third party
#
# The /terms page states this in as many words ("a signed contract belongs
# to both parties"), so changing it here means changing that too.
_TWO_PARTY_KEPT = (
    "bookings", "marketplace_bookings", "contracts", "messages",
    "marketplace_reviews", "store_orders", "store_standing_orders",
    "marketplace_job_applications", "request_reports",
)


@api_router.delete("/admin/users/{user_id}", response_model=MessageResponse)
async def delete_user(user_id: str, payload: dict = Depends(verify_token)) -> dict:
    """Delete an account and everything that was only ever theirs.

    THE BUG. This used to delete exactly two things: the user row and their
    properties. Everything else keyed to them stayed: their business pages,
    their service listings, their posts on the Requests board, their saved
    searches and alerts, their subleases. A deleted landlord's gigs went on
    being browsable and messageable by people who could never get a reply.

    IT TAKES A SNAPSHOT FIRST. Every document about to be removed is written
    to `user_tombstones` before anything is deleted, the same way the bulk
    property delete works, and POST /admin/users/deleted/{id}/restore puts
    it back. Two things a restore cannot return, and the admin screen says
    so before the delete: the password (never snapshotted; the person signs
    in with Google or sets a new one) and uploaded contract files (removed
    from disk below).

    WITH `_id`. Until 22 Sep 2026 the snapshot read `{"_id": 0}`, and for
    businesses, gigs, providers, requests, short links and lead events the
    `_id` IS the record's identity - orders, connections and pages point
    at it. Those snapshots could not have been restored into anything that
    still connected; the restore reports such rows instead of inventing
    new ids for them.
    """
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    if user_id == payload['user_id']:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # ---- snapshot, before a single delete runs ----------------------------
    snapshot: dict[str, list] = {}
    for collection, field in _USER_OWNED:
        rows = await db[collection].find({field: user_id}).to_list(5000)
        if rows:
            snapshot[collection] = rows

    snapshot_id = str(uuid.uuid4())
    await db.user_tombstones.insert_one({
        "id": snapshot_id,
        "user_id": user_id,
        # The account row carries the password hash; it is not wanted in a
        # snapshot an admin can read back, and it is not needed to restore
        # who the person was.
        "user": {k: v for k, v in user.items() if k != "password"},
        "collections": snapshot,
        "deleted_by": payload['user_id'],
        "deleted_at": datetime.now(UTC).isoformat(),
        "kept_two_party": list(_TWO_PARTY_KEPT),
        "keeps_ids": True,
    })

    # ---- the one thing a delete_many cannot reach: files on disk ----------
    # A property's uploaded contract is a real file under CONTRACT_DIR,
    # pointed to by the row's `contract_url`. Deleting the row deleted the
    # pointer and left the file - a legal document with a tenant's name in
    # it - on the persistent volume with no code path that would ever find
    # it again (17 Sep audit). These belong to the deleted owner alone, so
    # they go; contracts in the `contracts` collection, which have a second
    # party, are kept along with their files.
    #
    # Resolved by basename through the same helper every contract reader
    # uses, so a stored value containing "../" unlinks nothing.
    files_removed = 0
    for prop in snapshot.get("properties", []):
        for key in ("contract_url", "contract_path"):
            path = resolve_private_contract_file(prop.get(key) or "")
            if path is None:
                continue
            try:
                path.unlink()
                files_removed += 1
            except OSError as e:  # noqa: PERF203
                logger.warning("could not remove contract file %s: %s", path.name, e)
    if files_removed:
        logger.info("[admin] removed %d contract file(s) for user %s", files_removed, user_id)

    # ---- delete ------------------------------------------------------------
    removed: dict[str, int] = {}
    for collection, field in _USER_OWNED:
        res = await db[collection].delete_many({field: user_id})
        if res.deleted_count:
            removed[collection] = res.deleted_count
    await db.users.delete_one({"id": user_id})

    logger.info(
        "[admin] user %s deleted by %s: %s (snapshot %s)",
        user_id, payload['user_id'], removed or "nothing else", snapshot_id,
    )

    await publish("invalidate", {"prefixes": [
        "/api/admin/users", "/api/admin/properties", "/api/admin/dashboard",
        "/api/marketplace", "/api/requests", "/api/businesses",
    ]})
    total = sum(removed.values())
    return {
        "message": (
            f"Account deleted, along with {total} of their own record(s). "
            "Bookings, contracts, orders, reviews and chats involving other "
            "people were kept."
        ),
        "snapshot_id": snapshot_id,
    }


# Never put back. A reset token restored days later is a live way into the
# account that nobody asked for; the throttle is a timer that has expired.
_NOT_RESTORED = {"password_resets", "chat_email_throttle"}


@api_router.get("/admin/users/deleted")
async def list_deleted_users(payload: dict = Depends(verify_token)) -> dict:
    """Accounts deleted and not yet restored, newest first - the place an
    admin goes when they realise, a day later, that it was the wrong one."""
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    rows = await db.user_tombstones.find(
        {"restored_at": None}, {"_id": 0, "id": 1, "user": 1, "deleted_at": 1, "collections": 1},
    ).sort("deleted_at", -1).to_list(100)
    return {"deleted": [{
        "id": r["id"],
        "name": (r.get("user") or {}).get("name"),
        "email": (r.get("user") or {}).get("email"),
        "role": (r.get("user") or {}).get("role"),
        "deleted_at": r.get("deleted_at"),
        "records": sum(len(v) for k, v in (r.get("collections") or {}).items() if k not in _NOT_RESTORED),
    } for r in rows]}


@api_router.post("/admin/users/deleted/{snapshot_id}/restore")
async def restore_deleted_user(snapshot_id: str, payload: dict = Depends(verify_token)) -> dict:
    """Put a deleted account back from its snapshot.

    Refuses if the account id or email has since been taken - two accounts
    with one email is worse than a deletion. Any single record whose id has
    since been reused is skipped, never overwritten. The snapshot is marked
    restored (not deleted) with what came back, so it cannot be applied
    twice and still records what happened.
    """
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    snap = await db.user_tombstones.find_one({"id": snapshot_id, "restored_at": None})
    if not snap:
        raise HTTPException(status_code=404, detail="Nothing to restore: not found, or already restored")
    user = dict(snap.get("user") or {})
    if not user.get("id"):
        raise HTTPException(status_code=409, detail="This snapshot has no account to restore")
    clash = await db.users.find_one(
        {"$or": [{"id": user["id"]}, *([{"email": user["email"]}] if user.get("email") else [])]}, {"_id": 1},
    )
    if clash:
        raise HTTPException(status_code=409, detail="That account id or email is in use again, so restoring would make a duplicate")

    user.pop("_id", None)
    await db.users.insert_one(user)

    restored: dict[str, int] = {}
    skipped: dict[str, int] = {}
    unrestorable: dict[str, int] = {}
    for collection, rows in (snap.get("collections") or {}).items():
        if collection in _NOT_RESTORED:
            continue
        for row in rows:
            key = "_id" if "_id" in row else ("id" if "id" in row else None)
            if key is None:
                # Snapshot from before 22 Sep 2026, of a collection whose
                # only identity was `_id`. Inventing a new one would bring
                # back a record nothing points at.
                unrestorable[collection] = unrestorable.get(collection, 0) + 1
                continue
            if await db[collection].find_one({key: row[key]}, {"_id": 1}):
                skipped[collection] = skipped.get(collection, 0) + 1
                continue
            await db[collection].insert_one(row)
            restored[collection] = restored.get(collection, 0) + 1

    await db.user_tombstones.update_one({"id": snapshot_id}, {"$set": {
        "restored_at": datetime.now(UTC).isoformat(), "restored_by": payload['user_id'],
        "restore_result": {"restored": restored, "skipped": skipped, "unrestorable": unrestorable},
    }})
    logger.info("[admin] user %s restored by %s: %s", user["id"], payload['user_id'], restored)
    await publish("invalidate", {"prefixes": [
        "/api/admin/users", "/api/admin/properties", "/api/admin/dashboard",
        "/api/marketplace", "/api/requests", "/api/businesses",
    ]})
    return {
        "user_id": user["id"],
        "restored": restored,
        "skipped": skipped,
        "unrestorable": unrestorable,
        "message": (
            f"{user.get('name') or user.get('email') or 'Account'} is back, with "
            f"{sum(restored.values())} of their record(s). They sign in with Google "
            "or use Forgot password; uploaded contract files do not come back."
        ),
    }


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
