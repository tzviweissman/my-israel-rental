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
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI
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
    bookings,
    bulk_upload,
    chat,
    contracts,
    ical,
    misc,
    notifications,
    payments,
    properties,
    saved_searches,
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
    ical,
    misc,
    payments,
):
    api_router.include_router(mod.router)

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
    expose_headers=["Content-Disposition"],
)


@app.on_event("startup")
async def startup_tasks() -> None:
    """Kick off the iCal background sync and make sure the blank-contract
    PDF templates exist on disk."""
    asyncio.create_task(sync_all_ical_feeds())
    asyncio.create_task(mention_email_loop())
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
        await db.bookings.create_index([("property_id", 1), ("status", 1)], background=True)
        await db.bookings.create_index([("start_date", 1), ("end_date", 1)], background=True)
        await db.external_bookings.create_index([("start_date", 1), ("end_date", 1)], background=True)
        await db.admin_blocks.create_index("property_id", background=True)
        await db.users.create_index("email", unique=True, background=True)
        await db.users.create_index("id", unique=True, background=True)
        await db.messages.create_index([("property_id", 1), ("created_at", -1)], background=True)
        await db.liked_properties.create_index([("user_id", 1), ("property_id", 1)], background=True)
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
