"""Auto-extracted from server.py during the 2026-04 refactor."""
import os
import uuid
from datetime import UTC, datetime, timedelta
from typing import List

from fastapi import APIRouter, Body, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel

from models_response import (
    ExchangeRateResponse,
    IdMessageResponse,
    LogoUploadResponse,
    MessageResponse,
    UploadResponse,
)
from routes.deps import (
    optional_user,
    ALLOWED_IMAGE_TYPES,
    ALLOWED_VIDEO_TYPES,
    ANTHROPIC_API_KEY,
    MAX_FILE_SIZE,
    UPLOAD_DIR,
    db,
    logger,
    verify_token,
)
from utils.llm import LlmChat, UserMessage
from utils.rate_limit import check_rate
from utils.cloud_storage import (
    CLOUDINARY_ENABLED,
    delete_from_cloudinary,
    public_id_from_url,
    upload_bytes_to_cloudinary,
)
from utils.helpers import get_usd_ils_rate
from utils.errors import api_error, row_error

router = APIRouter()
api_router = router  # alias so existing @api_router decorators work verbatim


@api_router.get("/exchange-rate", response_model=ExchangeRateResponse)
async def get_exchange_rate() -> dict:
    rate = await get_usd_ils_rate()
    return {"usd_to_ils": round(rate, 4), "ils_to_usd": round(1 / rate, 4)}


class UploadFailureIn(BaseModel):
    where: str = ""
    count: int = 1
    reason: str = ""


@api_router.post("/client/upload-failure")
async def report_upload_failure(
    req: Request,
    payload: UploadFailureIn,
    user=Depends(optional_user),
) -> dict:
    """Record that a browser-side upload failed.

    Media goes from the browser straight to Cloudinary's CDN — our server
    never holds the bytes, which is why large uploads are fast. The cost is
    that a failure there is invisible to us: during an incident the server
    log shows signature requests returning 200 and nothing else, while
    people are stuck being told "upload failed".

    This is the missing half. It stores nothing and returns nothing; it
    writes one WARNING so the reason shows up in the deploy log next to
    everything else.

    Deliberately tolerant: optional auth (a failure while signed out is
    still worth knowing about) and it always returns ok, because a
    reporting endpoint that errors would put a second failure in front of
    someone already looking at one. Rate-limited so it cannot be used to
    flood the log.
    """
    check_rate(req, bucket="upload-failure", limit=20, window_seconds=300)
    logger.warning(
        "client upload failure: where=%s count=%s user=%s reason=%s",
        (payload.where or "")[:60],
        payload.count,
        (user or {}).get("user_id", "anon"),
        (payload.reason or "")[:300],
    )
    return {"ok": True}


@api_router.get("/cloudinary/signature")
async def get_cloudinary_signature(
    req: Request,
    resource_type: str = "image",
    folder: str = "myisraelrental",
    payload: dict = Depends(verify_token),
) -> dict:
    """Sign a direct-to-Cloudinary upload from the browser.

    The browser POSTs the file straight to Cloudinary's CDN edge with this
    signature — bypassing our backend entirely. This is ~2× faster for
    photos and 5–10× faster for big videos, plus our server stays out of
    the upload bandwidth path.

    Auth-gated so anonymous visitors can't sign arbitrary uploads.
    """
    # Rate-limit per user id — 60 signatures / minute is plenty for a
    # legitimate 10-image gallery upload, tight enough to blunt abuse.
    # ip_agnostic=True because the ingress rotates egress IPs; keying
    # on user_id alone is what actually enforces the limit.
    check_rate(
        req, bucket="cloudinary-sign", limit=60, window_seconds=60,
        key_extra=payload.get("user_id", ""), ip_agnostic=True,
    )
    if not CLOUDINARY_ENABLED:
        raise HTTPException(status_code=503, detail="Cloudinary not configured")
    if resource_type not in ("image", "video"):
        raise HTTPException(status_code=400, detail="resource_type must be image or video")
    if not folder.startswith("myisraelrental"):
        raise HTTPException(status_code=400, detail="invalid folder")

    import time
    import cloudinary
    import cloudinary.utils

    timestamp = int(time.time())
    params = {"timestamp": timestamp, "folder": folder}
    signature = cloudinary.utils.api_sign_request(params, cloudinary.config().api_secret)
    return {
        "signature": signature,
        "timestamp": timestamp,
        "cloud_name": cloudinary.config().cloud_name,
        "api_key": cloudinary.config().api_key,
        "folder": folder,
        "resource_type": resource_type,
    }


# --- Property Contracts ---


async def _read_validated_upload(file: UploadFile) -> tuple[bytes, bool]:
    """Read an UploadFile fully, enforcing type + size limits.

    Returns (content_bytes, is_video). Raises HTTPException on rejection.
    """
    if not file.content_type:
        raise HTTPException(status_code=400, detail="Could not determine file type")
    is_image = file.content_type in ALLOWED_IMAGE_TYPES
    is_video = file.content_type in ALLOWED_VIDEO_TYPES
    if not is_image and not is_video:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Allowed: JPEG, PNG, WebP, GIF, MP4, MOV, WebM",
        )

    chunks: list[bytes] = []
    size = 0
    while chunk := await file.read(1024 * 256):
        size += len(chunk)
        if size > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="File too large. Max 50MB")
        chunks.append(chunk)
    return b"".join(chunks), is_video


async def _store_upload(content: bytes, is_video: bool, original_filename: str | None) -> dict:
    """Persist a validated upload to Cloudinary (if configured) or local disk.

    Returns dict with `url`, `filename` (public_id or local name), `size`, `file_type`.
    """
    file_type = "video" if is_video else "image"

    if CLOUDINARY_ENABLED:
        try:
            res = await upload_bytes_to_cloudinary(content, is_video=is_video)
            return {
                "url": res["url"],
                "file_type": file_type,
                "filename": res["public_id"],
                "size": res["bytes"],
            }
        except Exception as e:
            logger.error(f"Cloudinary upload failed, falling back to local: {e}")

    # Local-disk fallback (preview env without Cloudinary creds, or upload error)
    ext = (original_filename or "").rsplit(".", 1)[-1].lower() if "." in (original_filename or "") else "bin"
    file_id = str(uuid.uuid4())
    filename = f"{file_id}.{ext}"
    file_path = UPLOAD_DIR / filename
    with open(file_path, "wb") as f:
        f.write(content)
    # ABSOLUTE when we know our own public address, relative otherwise.
    #
    # This returned a bare "/api/uploads/…" and that string is STORED — on
    # a listing, an item, a property — so it is later rendered by whoever
    # reads the record. A root-relative path resolves against the page's
    # origin, and the frontend and the API are different hosts in every
    # deployed environment, so every photo uploaded through this fallback
    # 404'd. It renders as an empty box, which is why nobody noticed:
    # nothing errors, the record looks fine, and the picture is simply
    # not there.
    #
    # Local dev keeps the relative form, where the dev server proxies
    # /api to the backend and same-origin is the correct answer.
    base = (os.environ.get("PUBLIC_API_URL") or "").rstrip("/")
    path = f"/api/uploads/{filename}"
    return {
        "url": f"{base}{path}" if base else path,
        "file_type": file_type,
        "filename": filename,
        "size": len(content),
    }


@api_router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...), payload: dict = Depends(verify_token)) -> dict:
    content, is_video = await _read_validated_upload(file)
    return await _store_upload(content, is_video, file.filename)


@api_router.post("/upload/multiple", response_model=list[UploadResponse])
async def upload_multiple_files(files: List[UploadFile] = File(...), payload: dict = Depends(verify_token)) -> list[dict]:
    results: list[dict] = []
    for file in files:
        try:
            content, is_video = await _read_validated_upload(file)
            stored = await _store_upload(content, is_video, file.filename)
            stored["original_name"] = file.filename
            results.append(stored)
        except HTTPException as e:
            results.append({"filename": file.filename, "error": e.detail})
        except Exception as e:
            # The HTTPException branch above returns OUR written detail, which
            # is right. This one was returning the raw exception.
            results.append({
                "filename": file.filename,
                "error": row_error(e, logger=logger, context="file upload",
                                   extra={"filename": file.filename}),
            })
    return results


@api_router.delete("/upload/{filename:path}", response_model=MessageResponse)
async def delete_upload(filename: str, payload: dict = Depends(verify_token)) -> dict:
    # SEC-004 defence-in-depth: reject any traversal payload BEFORE we
    # branch on storage backend. Any legit local-disk filename or
    # Cloudinary public_id we generate cannot contain '..' segments or
    # backslashes, so refusing them here is a zero-risk hardening.
    if ".." in filename.replace("\\", "/").split("/") or "\x00" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    # Cloudinary public_ids look like "myisraelrental/abc123" (contains slash).
    # Local fallback filenames look like "{uuid}.{ext}" (no slash).
    if CLOUDINARY_ENABLED and ("/" in filename or not (UPLOAD_DIR / filename).exists()):
        # Try image first, then video
        if not delete_from_cloudinary(filename, is_video=False):
            delete_from_cloudinary(filename, is_video=True)
        return {"message": "File deleted"}

    # Second-layer path-traversal guard: even after the '..' filter above,
    # resolve the final path and confirm it lives strictly inside UPLOAD_DIR.
    upload_root = UPLOAD_DIR.resolve()
    try:
        file_path = (UPLOAD_DIR / filename).resolve()
    except (RuntimeError, OSError):
        raise HTTPException(status_code=400, detail="Invalid filename")
    if not str(file_path).startswith(str(upload_root) + os.sep) and file_path != upload_root:
        raise HTTPException(status_code=400, detail="Invalid filename")
    if file_path.exists() and file_path.is_file():
        file_path.unlink()
    return {"message": "File deleted"}



@api_router.post("/user/logo", response_model=LogoUploadResponse)
async def upload_user_logo(file: UploadFile = File(...), payload: dict = Depends(verify_token)) -> dict:
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Max 50MB")

    # Clean up old logo first
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    old_logo_url = (user or {}).get("business_logo")
    if old_logo_url:
        old_public_id, old_is_video = public_id_from_url(old_logo_url)
        if old_public_id:
            delete_from_cloudinary(old_public_id, is_video=old_is_video)
        else:
            old_file = UPLOAD_DIR / old_logo_url.split("/")[-1]
            if old_file.exists():
                old_file.unlink()

    if CLOUDINARY_ENABLED:
        try:
            res = await upload_bytes_to_cloudinary(
                content,
                is_video=False,
                folder="myisraelrental/logos",
                public_id_hint=f"logo_{payload['user_id']}_{uuid.uuid4().hex[:8]}",
            )
            logo_url = res["url"]
        except Exception as e:
            logger.error(f"Cloudinary logo upload failed: {e}")
            logo_url = None
    else:
        logo_url = None

    if not logo_url:
        ext = (file.filename or "").split(".")[-1] if "." in (file.filename or "") else "png"
        filename = f"logo_{payload['user_id']}_{uuid.uuid4().hex[:8]}.{ext}"
        filepath = UPLOAD_DIR / filename
        with open(filepath, "wb") as f:
            f.write(content)
        logo_url = f"/api/uploads/{filename}"

    await db.users.update_one({"id": payload["user_id"]}, {"$set": {"business_logo": logo_url}})
    return {"logo_url": logo_url}


@api_router.delete("/user/logo", response_model=MessageResponse)
async def delete_user_logo(payload: dict = Depends(verify_token)) -> dict:
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if user and user.get("business_logo"):
        logo_url = user["business_logo"]
        public_id, is_video = public_id_from_url(logo_url)
        if public_id:
            delete_from_cloudinary(public_id, is_video=is_video)
        else:
            old_file = UPLOAD_DIR / logo_url.split("/")[-1]
            if old_file.exists():
                old_file.unlink()
    await db.users.update_one({"id": payload["user_id"]}, {"$unset": {"business_logo": ""}})
    return {"message": "Logo removed"}


# ---------------------------------------------------------------------------
# White-label configuration for the public /manager/{id} page
# ---------------------------------------------------------------------------
#
# Managers can hide the MyIsraelRental global nav, recolor their hero,
# swap the "N Properties Available" subtitle for a custom tagline, and
# render their own contact footer — turning their agency page into a
# quasi-branded microsite. Attribution mode keeps the corner pill on
# so we still get a subtle brand-lift. "off" mode is meant to be gated
# behind a paid agency tier later; for now it's simply available to any
# manager or admin.

class ManagerServiceItem(BaseModel):
    title: str
    description: str | None = None


class WhiteLabelRequest(BaseModel):
    # Public-page overrides for the manager's /manager/{id} agency page.
    # `bio` renders as a paragraph under the hero. `services` is a small
    # list of extra offerings (cleaning, airport pickup, concierge…) each
    # with an optional description. Kept intentionally lightweight — no
    # pricing, no images; if managers want richer offerings they can
    # publish real Gigs in the Services Marketplace.
    bio: str | None = None
    services: list[ManagerServiceItem] | None = None
    contact_email: str | None = None


@api_router.patch("/user/white-label", response_model=MessageResponse)
async def update_white_label(
    req: WhiteLabelRequest, payload: dict = Depends(verify_token),
) -> dict:
    role = (payload.get("role") or "").lower()
    if role not in {"manager", "admin"}:
        raise HTTPException(
            status_code=403,
            detail="These controls are available on manager and admin accounts.",
        )

    # Normalize services: strip whitespace, drop empties, cap at 20 rows
    # to keep the manager page from turning into an ad-wall.
    services_clean: list[dict] = []
    for s in (req.services or []):
        title = (s.title or "").strip()
        if not title:
            continue
        desc = (s.description or "").strip()
        services_clean.append({
            "title": title[:80],
            "description": desc[:400] if desc else None,
        })
        if len(services_clean) >= 20:
            break

    doc = {
        "bio": (req.bio or "").strip()[:2000] or None,
        "services": services_clean,
        "contact_email": (req.contact_email or "").strip() or None,
        "updated_at": datetime.now(UTC).isoformat(),
    }
    await db.users.update_one({"id": payload["user_id"]}, {"$set": {"white_label": doc}})
    return {"message": "Settings saved"}


# ---------------------------------------------------------------------------
# Services Marketplace upsell — one-time popup shown to every existing user
# on their next sign-in and to every new signup. Accepting the offer starts
# a 30-day free provider trial ($0). We store `services_pitch_seen_at` so
# the modal is never shown twice, and `provider_trial` so any downstream
# gating (e.g. My Gigs tab unlock) can check for an active trial.
# ---------------------------------------------------------------------------


class ServicesPitchActionRequest(BaseModel):
    accepted: bool


@api_router.post("/user/services-pitch/action", response_model=MessageResponse)
async def act_on_services_pitch(
    req: ServicesPitchActionRequest, payload: dict = Depends(verify_token),
) -> dict:
    """Idempotent record of the user's decision on the "Take Your Services
    to the Next Level" upsell modal.

    - `accepted=false`: just stamp `services_pitch_seen_at` so the modal
      never opens again.
    - `accepted=true`: same stamp, PLUS provision a real $0 provider
      subscription — a `marketplace_providers` row with a 30-day trial
      (idempotent via `_ensure_provider_record`) so the user can
      immediately publish gigs. The trial window is also mirrored onto
      the `users.provider_trial` field so the frontend can unlock the
      "My Gigs" tab without needing a separate marketplace round-trip.
    """
    user_id = payload["user_id"]
    now = datetime.now(UTC)
    update: dict = {"services_pitch_seen_at": now.isoformat()}

    if req.accepted:
        # Lazy-import to avoid an import cycle between misc and marketplace.
        # Import from the submodule that defines it, not the package: the
        # 2026-07 split moved this out of marketplace.py into shared.py, and
        # the package only re-exports `router` + the webhook handler. The
        # package-level import raised ImportError on every accepted upsell.
        from routes.marketplace.shared import _ensure_provider_record

        prov = await _ensure_provider_record(user_id)
        trial_ends_at = prov.get("trial_ends_at") or (now + timedelta(days=30)).isoformat()
        update["provider_trial"] = {
            "started_at": prov.get("created_at", now.isoformat()),
            "ends_at": trial_ends_at,
            "source": "services-popup",
            "status": prov.get("subscription_status", "trial"),
        }
    await db.users.update_one({"id": user_id}, {"$set": update})
    return {"message": "OK"}


@api_router.get("/dashboard/summary")
async def dashboard_summary(payload: dict = Depends(verify_token)) -> dict:
    """Every count the dashboard needs, in one call (spec D4/D5).

    One endpoint rather than three, deliberately. The tab badges and the
    "needs your attention" strip show the same facts in two places, and two
    endpoints would let them disagree — a badge saying 2 above a strip
    saying 3 is worse than no badge at all.

    Everything here is a count_documents over data that already exists. No
    field is invented, and a count that cannot be computed honestly is
    absent rather than guessed:

      * bookings_awaiting_reply — pending bookings on the user's OWN
        listings. A renter's own pending booking is not waiting on them, so
        it is matched on owner_id only.
      * work_offers_open — open jobs matching a category this provider
        publishes in, that they have not already applied to. Same query the
        Work Offers tab renders from, so the number and the list agree.
      * requests_with_responses — the user's open requests that somebody
        has contacted. NOT "new since you last looked": nothing records
        when a poster last read them, so "new" would be a guess. Naming it
        for what it is beats inventing a freshness we do not track.
      * requests_expiring_soon — open requests within a week of expiry,
        which is the moment renewing still helps.
      * gigs_count — services this user owns, used to decide whether the
        My Gigs tab is shown at all. Not a badge; a visibility test.
    """
    uid = payload["user_id"]
    now = datetime.now(UTC)
    week = (now + timedelta(days=7)).isoformat()

    bookings_awaiting = await db.bookings.count_documents({
        "owner_id": uid, "status": "pending",
    })

    # Every gig this person owns, whatever their role. The dashboard uses
    # this to decide whether to SHOW the My Gigs tab: the tab used to be
    # gated on role alone, so an owner or manager who also offered a
    # service could create gigs and then had nowhere to manage them —
    # their own listings were invisible to them. Owning one is the honest
    # test of whether the tab is useful to you.
    #
    # This does NOT change who may CREATE a gig; that is still the
    # provider check on the create path.
    gigs_count = await db.marketplace_gigs.count_documents({"provider_user_id": uid})

    my_cats = await db.marketplace_gigs.distinct(
        "category", {"provider_user_id": uid, "status": "published"},
    )
    work_offers = 0
    if my_cats:
        applied = await db.marketplace_job_applications.distinct("job_id", {"provider_user_id": uid})
        work_offers = await db.marketplace_jobs.count_documents({
            "status": "open",
            "category": {"$in": my_cats},
            "poster_user_id": {"$ne": uid},
            "_id": {"$nin": applied},
        })

    requests_with_responses = await db.requests.count_documents({
        "poster_user_id": uid, "status": "open", "contact_count": {"$gt": 0},
    })
    requests_expiring = await db.requests.count_documents({
        "poster_user_id": uid, "status": "open",
        "expires_at": {"$lte": week, "$gte": now.isoformat()},
    })

    return {
        "bookings_awaiting_reply": bookings_awaiting,
        "work_offers_open": work_offers,
        "requests_with_responses": requests_with_responses,
        "requests_expiring_soon": requests_expiring,
        "gigs_count": gigs_count,
    }
