"""3D walkthrough tours for property listings.

Named `tours_3d`, not `tours`, because `frontend/src/components/tour/` is
already the onboarding coach-mark tour. Two unrelated features called
"tour" in one codebase is a trap for whoever greps next.

THE DOCUMENT (`property_tours`)

    {
      id:              uuid4 str        # ours; what the URLs use
      property_id:     str              # -> properties.id (NOT _id)
      owner_id:        str              # denormalised so the poller can
                                        # authorise without a join
      status:          pending | processing | ready | failed
      video_url:       str | None       # Cloudinary secure_url
      video_public_id: str | None       # needed to delete the source
      duration_seconds: float | None    # as Cloudinary measured it
      bytes:           int | None
      provider:        str | None       # which vendor holds the job
      external_id:     str | None       # the vendor's id for it
      tour_embed_url:  str | None       # set once, on success
      error:           str | None       # why it failed, for the owner
      attempts:        int              # poll count, for giving up
      created_at:      datetime
      updated_at:      datetime
    }

ONE TOUR PER LISTING. A second upload replaces the first. There is no
history: an owner who re-shoots a flat wants the new walkthrough shown,
and keeping the old one costs storage to preserve something nobody asks
for.

WHAT RENTERS SEE. `GET` returns the full document to the owner and to
admins, and only a `ready` tour to anybody else. A failed reconstruction
is the owner's problem to fix and nobody else's business — the brief asks
for exactly this, and it is also the difference between a listing that
looks unfinished and one that looks normal.
"""
from __future__ import annotations

import asyncio
import os
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field

from routes.deps import db, logger, optional_user, verify_token
from utils.rate_limit import check_rate
from utils.tour_provider import (
    STATUS_FAILED,
    STATUS_PENDING,
    STATUS_PROCESSING,
    STATUS_READY,
    ProviderError,
    get_provider,
)

router = APIRouter()

# Limits. The brief sets 500MB / 5 minutes; both are enforced again on the
# server because the client checks are a courtesy, not a control — anyone
# can POST straight to the attach endpoint.
MAX_TOUR_BYTES = 500 * 1024 * 1024
MAX_TOUR_SECONDS = 5 * 60
# A little slack: browsers and Cloudinary disagree about duration in the
# last frame, and rejecting a 300.4s video the client measured at 299.9s
# would be a bug the owner cannot diagnose.
DURATION_TOLERANCE_SECONDS = 2.0

TOUR_FOLDER_ROOT = "myisraelrental/tours"

# Give up after this many polls so a vendor that loses a job does not
# leave a listing saying "coming soon" forever. At the recommended
# 5-minute cron this is about two hours.
MAX_POLL_ATTEMPTS = 24


def _now() -> datetime:
    return datetime.now(UTC)


# --------------------------------------------------------------------------
# Access
# --------------------------------------------------------------------------

async def _load_property_for_owner(property_id: str, user: dict) -> dict:
    """Fetch a property, or 404/403. Admins pass."""
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0, "id": 1, "owner_id": 1})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    if prop.get("owner_id") != user.get("user_id") and user.get("role") != "admin":
        # 404 rather than 403: whether a listing exists is not something a
        # non-owner needs confirmed.
        raise HTTPException(status_code=404, detail="Property not found")
    return prop


def _public_view(tour: dict) -> dict:
    """What a renter may see. Only ever a finished tour."""
    return {
        "id": tour["id"],
        "status": STATUS_READY,
        "tour_embed_url": tour.get("tour_embed_url"),
    }


def _owner_view(tour: dict) -> dict:
    return {
        "id": tour["id"],
        "property_id": tour["property_id"],
        "status": tour["status"],
        "video_url": tour.get("video_url"),
        "tour_embed_url": tour.get("tour_embed_url"),
        "error": tour.get("error"),
        "duration_seconds": tour.get("duration_seconds"),
        "created_at": tour.get("created_at"),
        "updated_at": tour.get("updated_at"),
    }


# --------------------------------------------------------------------------
# 1. Start — reserve a tour and sign the upload
# --------------------------------------------------------------------------

@router.post("/properties/{property_id}/tour")
async def begin_tour_upload(
    property_id: str,
    req: Request,
    user: dict = Depends(verify_token),
) -> dict:
    """Create (or reset) the tour record and sign a direct browser upload.

    The signature is scoped to this listing's own folder, and `attach`
    later refuses any public_id outside it. Without that, a valid
    signature would be a licence to attach any asset in the cloud —
    including someone else's listing video — to your own listing.
    """
    check_rate(
        req, bucket="tour-begin", limit=12, window_seconds=3600,
        key_extra=user.get("user_id", ""), ip_agnostic=True,
    )
    if get_provider() is None:
        raise HTTPException(status_code=503, detail="3D tours are not configured")
    if not os.environ.get("CLOUDINARY_CLOUD_NAME"):
        raise HTTPException(status_code=503, detail="Cloudinary not configured")

    await _load_property_for_owner(property_id, user)

    import time

    import cloudinary
    import cloudinary.utils

    tour_id = str(uuid.uuid4())
    folder = f"{TOUR_FOLDER_ROOT}/{property_id}"
    timestamp = int(time.time())
    params = {"timestamp": timestamp, "folder": folder, "public_id": tour_id}
    signature = cloudinary.utils.api_sign_request(params, cloudinary.config().api_secret)

    # Replace whatever was there. One tour per listing.
    await db.property_tours.delete_many({"property_id": property_id})
    await db.property_tours.insert_one({
        "id": tour_id,
        "property_id": property_id,
        "owner_id": user["user_id"],
        "status": STATUS_PENDING,
        "video_url": None,
        "video_public_id": None,
        "duration_seconds": None,
        "bytes": None,
        "provider": None,
        "external_id": None,
        "tour_embed_url": None,
        "error": None,
        "attempts": 0,
        "created_at": _now(),
        "updated_at": _now(),
    })

    return {
        "tour_id": tour_id,
        "upload": {
            "signature": signature,
            "timestamp": timestamp,
            "cloud_name": cloudinary.config().cloud_name,
            "api_key": cloudinary.config().api_key,
            "folder": folder,
            "public_id": tour_id,
            "resource_type": "video",
        },
        "limits": {
            "max_bytes": MAX_TOUR_BYTES,
            "max_seconds": MAX_TOUR_SECONDS,
        },
    }


# --------------------------------------------------------------------------
# 2. Attach — the upload finished; hand it to the provider
# --------------------------------------------------------------------------

class AttachIn(BaseModel):
    public_id: str = Field(min_length=1, max_length=300)


async def _cloudinary_video_facts(public_id: str) -> dict[str, Any]:
    """Read a video's real size and duration from Cloudinary.

    Deliberately NOT taken from the request body. The browser knows both
    numbers and could simply send smaller ones; asking Cloudinary is the
    only version of these facts the client cannot choose. It also tells us
    the asset actually exists, which a forged body would not.

    The SDK is synchronous, so it goes to a thread — this runs inside the
    request and would otherwise block the event loop for every other
    caller.
    """
    import cloudinary.api

    def _fetch() -> dict[str, Any]:
        return cloudinary.api.resource(public_id, resource_type="video")

    try:
        return await asyncio.to_thread(_fetch)
    except Exception as e:  # noqa: BLE001 - SDK raises its own error types
        logger.warning("tour attach: cloudinary lookup failed for %s: %s", public_id, e)
        raise HTTPException(status_code=400, detail="Uploaded video could not be found") from e


@router.post("/properties/{property_id}/tour/attach")
async def attach_tour_video(
    property_id: str,
    body: AttachIn,
    req: Request,
    user: dict = Depends(verify_token),
) -> dict:
    """Validate the uploaded video and start the reconstruction."""
    check_rate(
        req, bucket="tour-attach", limit=12, window_seconds=3600,
        key_extra=user.get("user_id", ""), ip_agnostic=True,
    )
    provider = get_provider()
    if provider is None:
        raise HTTPException(status_code=503, detail="3D tours are not configured")

    await _load_property_for_owner(property_id, user)
    tour = await db.property_tours.find_one({"property_id": property_id}, {"_id": 0})
    if not tour:
        raise HTTPException(status_code=404, detail="Start an upload first")

    # The public_id must be the one we signed, in the folder we signed it
    # into. See `begin_tour_upload` for why.
    expected = f"{TOUR_FOLDER_ROOT}/{property_id}/{tour['id']}"
    if body.public_id != expected:
        raise HTTPException(status_code=400, detail="Video does not belong to this listing")

    facts = await _cloudinary_video_facts(body.public_id)
    size = int(facts.get("bytes") or 0)
    duration = float(facts.get("duration") or 0.0)
    secure_url = facts.get("secure_url") or ""

    if size > MAX_TOUR_BYTES:
        await _fail(tour["id"], f"Video is {size // (1024 * 1024)}MB; the limit is 500MB")
        raise HTTPException(status_code=413, detail="Video is larger than 500MB")
    if duration > MAX_TOUR_SECONDS + DURATION_TOLERANCE_SECONDS:
        await _fail(tour["id"], f"Video is {int(duration)}s long; the limit is 5 minutes")
        raise HTTPException(status_code=400, detail="Video is longer than 5 minutes")
    if not secure_url:
        raise HTTPException(status_code=400, detail="Uploaded video has no URL")

    await db.property_tours.update_one(
        {"id": tour["id"]},
        {"$set": {
            "video_url": secure_url,
            "video_public_id": body.public_id,
            "bytes": size,
            "duration_seconds": duration,
            "updated_at": _now(),
        }},
    )

    callback_url = None
    if provider.supports_webhook:
        base = (os.environ.get("PUBLIC_API_URL") or "").rstrip("/")
        if base:
            callback_url = f"{base}/api/tours/webhook/{provider.name}"

    try:
        job = await provider.submit(
            video_url=secure_url, tour_id=tour["id"], callback_url=callback_url
        )
    except ProviderError as e:
        # Log the vendor detail, show the owner something they can act on.
        logger.error("tour %s: provider submit failed: %s", tour["id"], e)
        await _fail(tour["id"], "The 3D service could not accept this video. Please try again.")
        raise HTTPException(status_code=502, detail="The 3D service is unavailable right now") from e

    await db.property_tours.update_one(
        {"id": tour["id"]},
        {"$set": {
            "status": STATUS_PROCESSING,
            "provider": provider.name,
            "external_id": job.external_id,
            "error": None,
            "updated_at": _now(),
        }},
    )
    return {"tour_id": tour["id"], "status": STATUS_PROCESSING}


async def _fail(tour_id: str, reason: str) -> None:
    await db.property_tours.update_one(
        {"id": tour_id},
        {"$set": {"status": STATUS_FAILED, "error": reason[:500], "updated_at": _now()}},
    )


# --------------------------------------------------------------------------
# 3. Read
# --------------------------------------------------------------------------

@router.get("/properties/{property_id}/tour")
async def get_tour(property_id: str, user: dict | None = Depends(optional_user)) -> dict:
    """The tour for a listing. Renters only ever see a finished one."""
    tour = await db.property_tours.find_one({"property_id": property_id}, {"_id": 0})
    if not tour:
        return {"tour": None}

    is_owner = bool(user) and (
        tour.get("owner_id") == user.get("user_id") or user.get("role") == "admin"
    )
    if is_owner:
        return {"tour": _owner_view(tour)}
    if tour.get("status") == STATUS_READY and tour.get("tour_embed_url"):
        return {"tour": _public_view(tour)}
    # Processing and failed are both "nothing here" to a renter. The
    # listing page shows its placeholder from the owner-only endpoint, not
    # this one.
    return {"tour": None}


@router.delete("/properties/{property_id}/tour")
async def delete_tour(
    property_id: str,
    req: Request,
    user: dict = Depends(verify_token),
) -> dict:
    """Remove a tour so the owner can re-upload after a failure."""
    check_rate(
        req, bucket="tour-delete", limit=20, window_seconds=3600,
        key_extra=user.get("user_id", ""), ip_agnostic=True,
    )
    await _load_property_for_owner(property_id, user)
    tour = await db.property_tours.find_one({"property_id": property_id}, {"_id": 0})
    if not tour:
        return {"deleted": False}

    # Best effort: a stranded Cloudinary video is untidy, a 500 here is
    # worse — the owner still needs the record gone so they can retry.
    public_id = tour.get("video_public_id")
    if public_id:
        try:
            import cloudinary.uploader

            await asyncio.to_thread(
                cloudinary.uploader.destroy, public_id, resource_type="video"
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("tour %s: could not delete source video: %s", tour["id"], e)

    await db.property_tours.delete_one({"id": tour["id"]})
    return {"deleted": True}


# --------------------------------------------------------------------------
# 4. Webhook
# --------------------------------------------------------------------------

@router.post("/tours/webhook/{provider_name}")
async def tour_webhook(provider_name: str, req: Request) -> dict:
    """Provider callback. Unauthenticated by nature, so signed or refused.

    Note the ordering: verify the signature over the RAW body before the
    JSON is parsed or the tour is looked up. Doing any work first is how a
    webhook becomes an oracle for which tour ids exist.
    """
    provider = get_provider()
    if provider is None or provider.name != provider_name:
        raise HTTPException(status_code=404, detail="Unknown provider")
    if not provider.supports_webhook:
        # Not merely unconfigured — this provider has no signing scheme, so
        # an accepted callback would be an unauthenticated write of the URL
        # we put in an iframe.
        raise HTTPException(status_code=404, detail="Unknown provider")

    raw = await req.body()
    if not provider.verify_webhook(headers=dict(req.headers), raw_body=raw):
        logger.warning("tour webhook: rejected an unverified %s callback", provider_name)
        raise HTTPException(status_code=401, detail="Bad signature")

    try:
        job = provider.parse_webhook(await req.json())
    except (ProviderError, ValueError) as e:
        logger.warning("tour webhook: unusable %s payload: %s", provider_name, e)
        raise HTTPException(status_code=400, detail="Unusable payload") from e

    updated = await _apply_job(job)
    return {"ok": True, "updated": updated}


# --------------------------------------------------------------------------
# 5. Poller (Railway cron)
# --------------------------------------------------------------------------

@router.post("/tours/poll-pending")
async def poll_pending_tours(
    req: Request,
    x_tour_poll_secret: str = Header(default=""),
) -> dict:
    """Advance every `processing` tour. Called on a schedule by Railway.

    A plain endpoint rather than an in-process loop: it survives redeploys,
    cannot double-run when the backend scales past one instance, and can be
    curled by hand when something looks stuck.

    Guarded by a shared secret rather than a user token because the caller
    is a scheduler, not a person.
    """
    secret = os.environ.get("TOUR_POLL_SECRET", "")
    if not secret:
        raise HTTPException(status_code=503, detail="Polling is not configured")
    import hmac as _hmac

    if not _hmac.compare_digest(secret, x_tour_poll_secret or ""):
        # Rate-limited so the secret cannot be brute-forced quietly.
        check_rate(req, bucket="tour-poll-bad", limit=10, window_seconds=300)
        raise HTTPException(status_code=401, detail="Bad secret")

    provider = get_provider()
    if provider is None:
        return {"checked": 0, "ready": 0, "failed": 0, "note": "no provider configured"}

    pending = await db.property_tours.find(
        {"status": STATUS_PROCESSING, "provider": provider.name},
        {"_id": 0, "id": 1, "external_id": 1, "attempts": 1},
    ).to_list(200)

    ready = failed = 0
    for tour in pending:
        external_id = tour.get("external_id")
        if not external_id:
            await _fail(tour["id"], "Lost track of this reconstruction. Please upload again.")
            failed += 1
            continue

        attempts = int(tour.get("attempts") or 0) + 1
        try:
            job = await provider.fetch_status(external_id)
        except ProviderError as e:
            # A transport failure is not a failed reconstruction. Count the
            # attempt and try again next tick; only the attempt ceiling
            # ends it, so a five-minute vendor outage does not discard
            # everyone's work.
            logger.warning("tour %s: status check failed: %s", tour["id"], e)
            await db.property_tours.update_one(
                {"id": tour["id"]},
                {"$set": {"attempts": attempts, "updated_at": _now()}},
            )
            if attempts >= MAX_POLL_ATTEMPTS:
                await _fail(tour["id"], "The 3D service stopped responding. Please upload again.")
                failed += 1
            continue

        await db.property_tours.update_one(
            {"id": tour["id"]}, {"$set": {"attempts": attempts}}
        )
        if job.status == STATUS_READY:
            await _apply_job(job)
            ready += 1
        elif job.status == STATUS_FAILED:
            await _apply_job(job)
            failed += 1
        elif attempts >= MAX_POLL_ATTEMPTS:
            await _fail(tour["id"], "The 3D service did not finish in time. Please upload again.")
            failed += 1

    return {"checked": len(pending), "ready": ready, "failed": failed}


async def _apply_job(job) -> bool:
    """Write a provider verdict onto its tour. Returns whether one matched.

    Matches on `external_id`, and only while the tour is still
    `processing`: a duplicate or late callback must not resurrect a tour
    the owner has since deleted and re-uploaded.
    """
    query = {"external_id": job.external_id, "status": STATUS_PROCESSING}
    if job.status == STATUS_READY:
        if not job.embed_url:
            res = await db.property_tours.update_one(
                query,
                {"$set": {
                    "status": STATUS_FAILED,
                    "error": "The 3D service returned no viewer link.",
                    "updated_at": _now(),
                }},
            )
            return res.matched_count > 0
        res = await db.property_tours.update_one(
            query,
            {"$set": {
                "status": STATUS_READY,
                "tour_embed_url": job.embed_url,
                "error": None,
                "updated_at": _now(),
            }},
        )
        return res.matched_count > 0

    if job.status == STATUS_FAILED:
        res = await db.property_tours.update_one(
            query,
            {"$set": {
                "status": STATUS_FAILED,
                "error": (job.error or "The 3D reconstruction failed.")[:500],
                "updated_at": _now(),
            }},
        )
        return res.matched_count > 0

    return False
