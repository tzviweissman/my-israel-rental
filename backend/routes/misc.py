"""Auto-extracted from server.py during the 2026-04 refactor."""
import uuid
from datetime import UTC, datetime
from typing import List

from emergentintegrations.llm.chat import LlmChat, UserMessage
from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile

from models import ContactRequest, DocumentServiceRequest, TranslationRequest
from routes.deps import (
    ALLOWED_IMAGE_TYPES,
    ALLOWED_VIDEO_TYPES,
    EMERGENT_LLM_KEY,
    MAX_FILE_SIZE,
    UPLOAD_DIR,
    db,
    verify_token,
)
from utils.helpers import get_usd_ils_rate

router = APIRouter()
api_router = router  # alias so existing @api_router decorators work verbatim


@api_router.get("/exchange-rate")
async def get_exchange_rate() -> dict:
    rate = await get_usd_ils_rate()
    return {"usd_to_ils": round(rate, 4), "ils_to_usd": round(1 / rate, 4)}


@api_router.post("/translate")
async def translate_text(request: TranslationRequest) -> dict:
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message=f"You are a professional translator. Translate the following text from {request.from_lang} to {request.to_lang}. Only provide the translation, no explanations."
        )
        chat.with_model("anthropic", "claude-sonnet-4-20250514")
        
        message = UserMessage(text=request.text)
        response = await chat.send_message(message)
        
        return {"translation": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")


@api_router.post("/document-service")
async def request_document_service(request: DocumentServiceRequest, payload: dict = Depends(verify_token)) -> dict:
    service_id = str(uuid.uuid4())
    service_doc = request.model_dump()
    service_doc['id'] = service_id
    service_doc['user_id'] = payload['user_id']
    service_doc['status'] = 'pending'
    service_doc['created_at'] = datetime.now(UTC).isoformat()
    
    await db.document_services.insert_one(service_doc)
    return {"id": service_id, "message": "Document service request submitted successfully"}


@api_router.get("/document-service")
async def get_document_services(payload: dict = Depends(verify_token)) -> list[dict]:
    if payload['role'] == 'admin':
        services = await db.document_services.find({}, {"_id": 0}).to_list(1000)
    else:
        services = await db.document_services.find({"user_id": payload['user_id']}, {"_id": 0}).to_list(1000)
    return services


@api_router.post("/service-requests")
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



@api_router.get("/service-requests")
async def list_service_requests(payload: dict = Depends(verify_token)) -> list[dict]:
    query = {"user_id": payload['user_id']} if payload.get('role') != 'admin' else {}
    requests = await db.service_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return requests



@api_router.post("/contact")
async def submit_contact_form(request: ContactRequest) -> dict:
    contact_id = str(uuid.uuid4())
    contact_doc = request.model_dump()
    contact_doc['id'] = contact_id
    contact_doc['created_at'] = datetime.now(UTC).isoformat()
    contact_doc['status'] = 'new'
    
    await db.contacts.insert_one(contact_doc)
    return {"message": "Contact request submitted successfully"}


# --- Property Contracts ---


@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), payload: dict = Depends(verify_token)) -> dict:
    if not file.content_type:
        raise HTTPException(status_code=400, detail="Could not determine file type")

    is_image = file.content_type in ALLOWED_IMAGE_TYPES
    is_video = file.content_type in ALLOWED_VIDEO_TYPES
    if not is_image and not is_video:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}. Allowed: JPEG, PNG, WebP, GIF, MP4, MOV, WebM")

    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "bin"
    file_id = str(uuid.uuid4())
    filename = f"{file_id}.{ext}"
    file_path = UPLOAD_DIR / filename

    size = 0
    with open(file_path, "wb") as f:
        while chunk := await file.read(1024 * 256):
            size += len(chunk)
            if size > MAX_FILE_SIZE:
                f.close()
                file_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="File too large. Max 50MB")
            f.write(chunk)

    file_type = "image" if is_image else "video"
    url = f"/api/uploads/{filename}"

    return {"url": url, "file_type": file_type, "filename": filename, "size": size}


@api_router.post("/upload/multiple")
async def upload_multiple_files(files: List[UploadFile] = File(...), payload: dict = Depends(verify_token)) -> list[dict]:
    results: list[dict] = []
    for file in files:
        is_image = file.content_type in ALLOWED_IMAGE_TYPES
        is_video = file.content_type in ALLOWED_VIDEO_TYPES
        if not is_image and not is_video:
            results.append({"filename": file.filename, "error": f"Unsupported type: {file.content_type}"})
            continue

        ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "bin"
        file_id = str(uuid.uuid4())
        filename = f"{file_id}.{ext}"
        file_path = UPLOAD_DIR / filename

        size = 0
        try:
            with open(file_path, "wb") as f:
                while chunk := await file.read(1024 * 256):
                    size += len(chunk)
                    if size > MAX_FILE_SIZE:
                        raise HTTPException(status_code=413, detail="File too large")
                    f.write(chunk)
            file_type = "image" if is_image else "video"
            url = f"/api/uploads/{filename}"
            results.append({"url": url, "file_type": file_type, "filename": filename, "size": size, "original_name": file.filename})
        except Exception as e:
            file_path.unlink(missing_ok=True)
            results.append({"filename": file.filename, "error": str(e)})

    return results


@api_router.delete("/upload/{filename}")
async def delete_upload(filename: str, payload: dict = Depends(verify_token)) -> dict:
    file_path = UPLOAD_DIR / filename
    if file_path.exists():
        file_path.unlink()
    return {"message": "File deleted"}



@api_router.post("/user/logo")
async def upload_user_logo(file: UploadFile = File(...), payload: dict = Depends(verify_token)) -> dict:
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    ext = (file.filename or "").split(".")[-1] if "." in (file.filename or "") else "png"
    filename = f"logo_{payload['user_id']}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = UPLOAD_DIR / filename
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    logo_url = f"/api/uploads/{filename}"
    await db.users.update_one({"id": payload["user_id"]}, {"$set": {"business_logo": logo_url}})
    return {"logo_url": logo_url}


@api_router.delete("/user/logo")
async def delete_user_logo(payload: dict = Depends(verify_token)) -> dict:
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if user and user.get("business_logo"):
        old_file = UPLOAD_DIR / user["business_logo"].split("/")[-1]
        if old_file.exists():
            old_file.unlink()
    await db.users.update_one({"id": payload["user_id"]}, {"$unset": {"business_logo": ""}})
    return {"message": "Logo removed"}
