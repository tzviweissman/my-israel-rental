"""Auto-extracted from server.py during the 2026-04 refactor."""
import os
import uuid
from datetime import UTC, datetime, timedelta
from typing import List

from emergentintegrations.llm.chat import LlmChat, UserMessage
from fastapi import APIRouter, Body, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel

from models import ContactRequest, DocumentServiceRequest, TranslationRequest
from models_response import (
    ExchangeRateResponse,
    IdMessageResponse,
    LogoUploadResponse,
    MessageResponse,
    ServiceRequestOut,
    TranslationResponse,
    UploadResponse,
)
from routes.deps import (
    ALLOWED_IMAGE_TYPES,
    ALLOWED_VIDEO_TYPES,
    EMERGENT_LLM_KEY,
    MAX_FILE_SIZE,
    UPLOAD_DIR,
    db,
    logger,
    verify_token,
)
from utils.rate_limit import check_rate
from utils.cloud_storage import (
    CLOUDINARY_ENABLED,
    delete_from_cloudinary,
    public_id_from_url,
    upload_bytes_to_cloudinary,
)
from utils.helpers import get_usd_ils_rate

router = APIRouter()
api_router = router  # alias so existing @api_router decorators work verbatim


@api_router.get("/exchange-rate", response_model=ExchangeRateResponse)
async def get_exchange_rate() -> dict:
    rate = await get_usd_ils_rate()
    return {"usd_to_ils": round(rate, 4), "ils_to_usd": round(1 / rate, 4)}


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


@api_router.post("/translate", response_model=TranslationResponse)
async def translate_text(request: TranslationRequest) -> dict:
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message=f"You are a professional translator. Translate the following text from {request.from_lang} to {request.to_lang}. Only provide the translation, no explanations."
        )
        chat.with_model("anthropic", "claude-sonnet-4-6")
        
        message = UserMessage(text=request.text)
        response = await chat.send_message(message)
        
        return {"translation": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")


@api_router.post("/document-service", response_model=IdMessageResponse)
async def request_document_service(request: DocumentServiceRequest, payload: dict = Depends(verify_token)) -> dict:
    service_id = str(uuid.uuid4())
    service_doc = request.model_dump()
    service_doc['id'] = service_id
    service_doc['user_id'] = payload['user_id']
    service_doc['status'] = 'pending'
    service_doc['created_at'] = datetime.now(UTC).isoformat()
    
    await db.document_services.insert_one(service_doc)
    return {"id": service_id, "message": "Document service request submitted successfully"}


@api_router.get("/document-service", response_model=list[ServiceRequestOut])
async def get_document_services(payload: dict = Depends(verify_token)) -> list[dict]:
    if payload['role'] == 'admin':
        services = await db.document_services.find({}, {"_id": 0}).to_list(1000)
    else:
        services = await db.document_services.find({"user_id": payload['user_id']}, {"_id": 0}).to_list(1000)
    return services


@api_router.post("/service-requests", response_model=IdMessageResponse)
async def create_service_request(request_data: dict = Body(...), payload: dict = Depends(verify_token)) -> dict:
    request_id = str(uuid.uuid4())
    service_doc = {
        "id": request_id,
        "user_id": payload['user_id'],
        "service_type": request_data.get('service_type', 'unknown'),
        "details": request_data,
        "status": "pending",
        "created_at": datetime.now(UTC).isoformat(),
        "updated_at": datetime.now(UTC).isoformat()
    }
    await db.service_requests.insert_one(service_doc)
    return {"id": request_id, "message": "Service request submitted successfully"}



@api_router.get("/service-requests", response_model=list[ServiceRequestOut])
async def list_service_requests(payload: dict = Depends(verify_token)) -> list[dict]:
    query = {"user_id": payload['user_id']} if payload.get('role') != 'admin' else {}
    requests = await db.service_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return requests



@api_router.post("/contact", response_model=MessageResponse)
async def submit_contact_form(request: ContactRequest) -> dict:
    contact_id = str(uuid.uuid4())
    contact_doc = request.model_dump()
    contact_doc['id'] = contact_id
    contact_doc['created_at'] = datetime.now(UTC).isoformat()
    contact_doc['status'] = 'new'
    
    await db.contacts.insert_one(contact_doc)
    return {"message": "Contact request submitted successfully"}


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
    return {
        "url": f"/api/uploads/{filename}",
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
            results.append({"filename": file.filename, "error": str(e)})
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
    now = datetime.now(UTC)
    update: dict = {"services_pitch_seen_at": now.isoformat()}
    if req.accepted:
        trial_end = now + timedelta(days=30)
        update["provider_trial"] = {
            "started_at": now.isoformat(),
            "ends_at": trial_end.isoformat(),
            "source": "services-popup",
            "status": "trial",
        }
    await db.users.update_one({"id": payload["user_id"]}, {"$set": update})
    return {"message": "OK"}
