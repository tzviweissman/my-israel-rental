"""FastAPI app entry-point — slim assembler.

All endpoints live in ``/app/backend/routes/`` split by domain.
This file owns:
  * FastAPI app + CORS + static /api/uploads mount
  * Logging setup
  * Startup / shutdown hooks (iCal background sync + contract-template bootstrap)
  * Aggregating every domain router under the /api prefix
"""
import asyncio
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

UTC = timezone.utc

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# Import the shared db + constants first so side-effects (connection, dir creation) run once
# Domain routers — order doesn't matter (all share the /api prefix)
from routes import (  # noqa: E402
    admin,
    admin_area_aliases,
    admin_import,
    admin_smart_lists,
    auth,
    availability_reminders,
    bookings,
    bulk_upload,
    chat,
    contracts,
    geocode,
    ical,
    marketplace,
    misc,
    notifications,
    payments,
    properties,
    saved_searches,
    services_waitlist,
    smart_pricing,
    subleases,
)
from routes.deps import UPLOAD_DIR, client, db  # noqa: E402  (import after load_dotenv on purpose)
from utils.contract_template import ensure_templates as ensure_contract_templates  # noqa: E402
from utils.helpers import sync_all_ical_feeds  # noqa: E402
from utils.mention_email import mention_email_loop  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("server")

app = FastAPI()
api_router = APIRouter(prefix="/api")

for mod in (
    auth,
    properties,
    bulk_upload,
    bookings,
    subleases,
    contracts,
    chat,
    notifications,
    admin,
    admin_area_aliases,
    admin_import,
    admin_smart_lists,
    saved_searches,
    services_waitlist,
    smart_pricing,
    availability_reminders,
    ical,
    marketplace,
    misc,
    payments,
    geocode,
):
    api_router.include_router(mod.router)

@app.get("/api/health")
async def health() -> dict:
    """Liveness + dependency probe used by the platform health check.

    Deliberately cheap and unauthenticated: it reports whether the process is
    up and whether Mongo actually answers, so a deploy that boots but can't
    reach the database is reported as unhealthy instead of silently serving
    errors. Exposes no data beyond booleans.
    """
    db_ok = False
    try:
        await client.admin.command("ping")
        db_ok = True
    except Exception as e:  # noqa: BLE001
        logger.warning(f"health check: mongo ping failed: {e}")
    return {
        "status": "ok" if db_ok else "degraded",
        "database": db_ok,
        "cloudinary": bool(os.environ.get("CLOUDINARY_CLOUD_NAME")),
    }


app.include_router(api_router)
app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

_DEFAULT_CORS = (
    "https://myisraelrental.com,"
    "https://www.myisraelrental.com,"
    "http://localhost:3000"
)
_raw_origins = os.environ.get("CORS_ORIGINS", _DEFAULT_CORS)
# Tolerate trailing slashes, accidental whitespace, and empty entries —
# easy to introduce when editing the env via a control panel.
_cors_origins = [o.strip().rstrip("/") for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_cors_origins,
    # Also allow any *.preview.emergentagent.com domain so preview URLs
    # always work even if the env var doesn't list this specific run.
    allow_origin_regex=r"https://.*\.preview\.emergentagent\.com",
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Build-Id"],
)

# Compress every JSON response ≥500 bytes so property lists, gig feeds,
# and other large payloads don't ship uncompressed. The 500-byte floor
# avoids the tiny overhead of gzipping already-small responses (e.g.
# a plain {"ok": true}) while still catching everything the client
# would actually benefit from. Uses Accept-Encoding negotiation so
# clients that don't want gzip (rare) still get plain JSON.
app.add_middleware(GZipMiddleware, minimum_size=500)


# Stable build-id stamp for the lifetime of THIS backend process. The
# frontend reads the first X-Build-Id header it sees on a session as the
# expected baseline; if subsequent responses carry a different value
# (because the backend got redeployed and the worker swapped under
# them), it pops the "newer version of the site is available" toast.
# We use the process startup ISO timestamp because we don't have a
# commit SHA readily available in this env — any monotonic value works.
BACKEND_BUILD_ID = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")


@app.middleware("http")
async def stamp_build_id(request, call_next):
    response = await call_next(request)
    response.headers["X-Build-Id"] = BACKEND_BUILD_ID
    # SEC hardening: security headers on every response so intermediary
    # scrubbers, browsers, and search-engines get consistent guidance.
    # We intentionally keep CSP off (SPA loads Cloudinary + PayPal +
    # Stripe iframes; enforcing here would break the app until it's
    # audited end-to-end). Everything else is safe to apply globally.
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
    # HSTS: only send on HTTPS responses. FastAPI/Starlette exposes the
    # scheme via `request.url.scheme`. 6-month max-age keeps browsers
    # locked to HTTPS well past the next deploy cycle.
    if request.url.scheme == "https":
        response.headers.setdefault(
            "Strict-Transport-Security",
            "max-age=15552000; includeSubDomains",
        )
    return response


@app.on_event("startup")
async def startup_tasks() -> None:
    """Kick off the iCal background sync and make sure the blank-contract
    PDF templates exist on disk."""
    # Loud check on the Postmark token — historically we've had prod
    # deploys where POSTMARK_SERVER_TOKEN was missing and every email
    # silently failed for days before anyone noticed. Log at CRITICAL so
    # the deployer sees it in the container boot log and can fix it
    # before the pipeline goes stale.
    import logging as _log
    import os as _os
    _startup_log = _log.getLogger(__name__)
    if not _os.environ.get("POSTMARK_SERVER_TOKEN"):
        _startup_log.critical(
            "POSTMARK_SERVER_TOKEN is not set — outbound email will be "
            "SKIPPED on this instance. GET /api/admin/email-health will "
            "return postmark_token_present=false. Set the env var and "
            "restart before assuming email works."
        )
    asyncio.create_task(sync_all_ical_feeds())
    asyncio.create_task(mention_email_loop())
    # Daily Smart Pricing refresh — sleeps until 03:00 UTC, then loops.
    # Cheap (only runs against properties with smart_pricing.enabled=true).
    asyncio.create_task(smart_pricing.smart_pricing_daily_loop())
    # Weekly Pricing Insights digest — every Sunday 07:00 UTC. No-op for
    # owners without smart_pricing-enabled vacation listings.
    asyncio.create_task(smart_pricing.pricing_insights_weekly_loop())
    # Availability-expiry reminders — daily at 06:00 UTC. Nudges hosts
    # whose available_to is rolling past in the next 4-6 days.
    asyncio.create_task(availability_reminders.availability_reminders_daily_loop())
    # Requests board lifecycle — daily at 05:00 UTC. Flips open->expired
    # once a request's 30 days are up. A soft flip, not a TTL index, so
    # the seeker can still renew it. See the single-replica note in
    # routes/marketplace/requests.py.
    from routes.marketplace.requests import (
        requests_digest_daily_loop,
        requests_lifecycle_daily_loop,
    )
    asyncio.create_task(requests_lifecycle_daily_loop())
    # "Someone is looking for what you offer" — the daily matching email
    # to owners and providers. Separate loop from the lifecycle one so a
    # crash in either cannot silence the other.
    asyncio.create_task(requests_digest_daily_loop())
    # Auto-dedupe loop — every 30 minutes, silently merge property groups
    # where every user-visible field is identical. Re-attaches chats /
    # bookings / likes / photos to the surviving twin before deleting
    # the losers, so bookmarked URLs and inbox conversations survive.
    from routes.admin import run_duplicate_auto_cleanup

    async def duplicate_auto_cleanup_loop() -> None:
        # Small initial delay so startup completes cleanly (and gives
        # the DB indexes above time to finish building) before we run
        # the first pass.
        await asyncio.sleep(120)
        while True:
            try:
                await run_duplicate_auto_cleanup(logger_prefix="dedupe-loop")
            except Exception as e:  # noqa: BLE001
                logger.warning("duplicate_auto_cleanup_loop iteration failed: %s", e)
            await asyncio.sleep(1800)  # 30 minutes

    asyncio.create_task(duplicate_auto_cleanup_loop())

    # Auto owner-nudge loop — every 30 min, email owners whose renter
    # inbound message has been unanswered for 12h+. Reuses the same
    # `chat_nudges` throttle collection as the admin-manual nudge so
    # neither surface double-emails owners.
    from routes.admin import run_auto_owner_nudge_pass, AUTO_NUDGE_LOOP_INTERVAL_SEC

    async def auto_owner_nudge_loop() -> None:
        await asyncio.sleep(180)  # Wait for indexes + templates.
        while True:
            try:
                await run_auto_owner_nudge_pass(logger_prefix="auto-nudge-loop")
            except Exception as e:  # noqa: BLE001
                logger.warning("auto_owner_nudge_loop iteration failed: %s", e)
            await asyncio.sleep(AUTO_NUDGE_LOOP_INTERVAL_SEC)

    asyncio.create_task(auto_owner_nudge_loop())

    # One-shot backfill: geocode any published gig that doesn't yet
    # carry per-gig (lat, lng). Sleeps a bit so startup indexes finish
    # first, then trickles through Nominatim at ~1 req/sec — the ToS
    # cap. Since this only runs against gigs missing coords, it becomes
    # a no-op after the first pass. Wrapped so exceptions don't kill
    # unrelated startup tasks.
    async def backfill_gig_geocoding() -> None:
        await asyncio.sleep(60)
        try:
            from utils.geocode import geocode_gig_area_bg
            cursor = db.marketplace_gigs.find(
                {
                    "status": "published",
                    "area": {"$exists": True, "$ne": ""},
                    "$or": [
                        {"lat": {"$exists": False}},
                        {"lat": None},
                    ],
                    "geocode_miss": {"$ne": True},  # skip previously-tried misses
                },
                {"_id": 1, "area": 1},
            )
            count = 0
            async for row in cursor:
                await geocode_gig_area_bg(row["_id"], row.get("area") or "")
                count += 1
            if count:
                logger.info("Gig geocode backfill processed %d gigs", count)
        except Exception as e:  # noqa: BLE001
            logger.warning("gig geocode backfill failed (non-fatal): %s", e)

    asyncio.create_task(backfill_gig_geocoding())

    # One-shot backfill for properties: pin every active listing to a
    # street-level lat/lng so the Stays map view works immediately —
    # not just for freshly-listed inventory. Same Nominatim 1 rps
    # trickle as the gig backfill; wraps around asynchronously so
    # unrelated startup steps don't get blocked if OSM is slow.
    async def backfill_property_geocoding() -> None:
        await asyncio.sleep(90)  # Land after gig backfill so we don't stampede Nominatim.
        try:
            from utils.geocode import geocode_property_bg
            cursor = db.properties.find(
                {
                    "status": "active",
                    "$or": [
                        {"lat": {"$exists": False}},
                        {"lat": None},
                    ],
                    "geocode_miss": {"$ne": True},
                },
                {"id": 1, "address": 1, "area": 1, "_id": 0},
            )
            count = 0
            async for row in cursor:
                await geocode_property_bg(
                    row["id"], row.get("address"), row.get("area"),
                )
                count += 1
            if count:
                logger.info("Property geocode backfill processed %d listings", count)
        except Exception as e:  # noqa: BLE001
            logger.warning("property geocode backfill failed (non-fatal): %s", e)

    asyncio.create_task(backfill_property_geocoding())
    try:
        ensure_contract_templates(ROOT_DIR / "uploads")
        logger.info("Contract templates ready")
    except Exception as e:
        logger.warning(f"Contract template generation failed (non-fatal): {e}")
    # Ensure PayPal webhook event idempotency index
    try:
        await db.paypal_webhook_events.create_index("id", unique=True)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"paypal_webhook_events index creation failed (non-fatal): {e}")

    # Hot-path indexes. Without these every public listings query and
    # owner-dashboard fetch does a full collection scan — fine at 8
    # properties, painful at 100+. `background=True` so a long-running
    # build never blocks startup on a large prod collection.
    try:
        await db.properties.create_index([("rental_type", 1), ("status", 1)], background=True)
        await db.properties.create_index("owner_id", background=True)
        await db.properties.create_index("area", background=True)
        await db.properties.create_index("id", unique=True, background=True)
        await db.properties.create_index("created_at", background=True)
        # Requests board. The board query is always status+type, the
        # dashboard is always poster_user_id, and the daily expiry pass
        # scans status+expires_at.
        await db.requests.create_index([("status", 1), ("request_type", 1), ("created_at", -1)], background=True)
        await db.requests.create_index("poster_user_id", background=True)
        await db.requests.create_index([("status", 1), ("expires_at", 1)], background=True)
        await db.requests.create_index("category", background=True)
        await db.bookings.create_index([("property_id", 1), ("status", 1)], background=True)
        await db.bookings.create_index([("start_date", 1), ("end_date", 1)], background=True)
        await db.external_bookings.create_index([("start_date", 1), ("end_date", 1)], background=True)
        await db.admin_blocks.create_index("property_id", background=True)
        await db.users.create_index("email", unique=True, background=True)
        await db.users.create_index("id", unique=True, background=True)
        await db.messages.create_index([("property_id", 1), ("created_at", -1)], background=True)
        # `GET /chat/conversations` filters `$or: [{sender_id}, {receiver_id}]`
        # and sorts by created_at. Navigation.js polls it every 20s for every
        # signed-in user, so without these it's a full collection scan plus an
        # in-memory sort on every poll. Compound with created_at so Mongo can
        # satisfy both branches of the $or and the sort from the index.
        await db.messages.create_index([("sender_id", 1), ("created_at", -1)], background=True)
        await db.messages.create_index([("receiver_id", 1), ("created_at", -1)], background=True)
        # Notifications are polled every 30s per signed-in user and the
        # collection had no indexes at all.
        await db.notifications.create_index([("user_id", 1), ("created_at", -1)], background=True)
        await db.liked_properties.create_index([("user_id", 1), ("property_id", 1)], background=True)
        # Smart Pricing — composite key for per-property daily overrides, and
        # a time index on the view events so 14-day demand queries don't scan.
        await db.nightly_price_overrides.create_index(
            [("property_id", 1), ("date", 1)], unique=True, background=True,
        )
        await db.property_view_events.create_index("at", background=True)
        await db.property_view_events.create_index("property_id", background=True)
        # Provider lead attribution: the analytics dashboard reads these by
        # gig and by provider over a date window, so index both with the
        # timestamp trailing.
        await db.lead_events.create_index([("gig_id", 1), ("created_at", -1)], background=True)
        await db.lead_events.create_index(
            [("provider_id", 1), ("created_at", -1)], background=True,
        )
        logger.info("Hot-path indexes ensured")
    except Exception as e:  # noqa: BLE001
        logger.warning(f"hot-path index creation failed (non-fatal): {e}")

    # One-time grandfather migration: any pre-existing user that does not
    # carry the new `email_verified` field is treated as verified. This
    # keeps the door open for everyone who signed up before we shipped
    # email verification while still hard-blocking unverified new signups.
    try:
        res = await db.users.update_many(
            {"email_verified": {"$exists": False}},
            {"$set": {"email_verified": True}},
        )
        if res.modified_count:
            logger.info(f"Grandfathered {res.modified_count} existing users as email_verified=True")
    except Exception as e:  # noqa: BLE001
        logger.warning(f"email_verified migration failed (non-fatal): {e}")


@app.on_event("shutdown")
async def shutdown_db_client() -> None:
    """Close the Motor client on graceful shutdown."""
    client.close()
