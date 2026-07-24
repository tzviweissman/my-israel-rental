"""Auto-extracted from server.py during the 2026-04 refactor."""
import io
import uuid
from datetime import UTC, datetime
from pathlib import PurePosixPath

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse

from models import ContractSignature
from models_response import (
    ContractOut,
    ContractSignResponse,
    ContractTranslateResponse,
    ContractUploadResponse,
    MessageResponse,
)
from routes.deps import ALLOWED_CONTRACT_TYPES, CONTRACT_DIR, MAX_FILE_SIZE, ROOT_DIR, db, logger, verify_token
from utils.cloud_storage import fetch_contract_from_cloudinary
from utils.contract_template import ensure_templates as ensure_contract_templates
from utils.files import extract_text_from_docx, extract_text_from_image, extract_text_from_pdf
from utils.translate import translate_text as _translate_text

router = APIRouter()
api_router = router  # alias so existing @api_router decorators work verbatim


@api_router.get("/contract-template/{lang}")
async def download_contract_template(lang: str) -> FileResponse:
    """Serve the MyIsraelRental blank fillable rental-contract PDF.
    Public endpoint — owners and renters alike can download a blank template.
    Supported languages: 'en' (English) and 'he' (Hebrew)."""
    if lang not in ("en", "he"):
        raise HTTPException(status_code=404, detail="Language not available. Use 'en' or 'he'.")
    pdf_path = ROOT_DIR / "uploads" / "templates" / f"myisraelrental_contract_{lang}.pdf"
    if not pdf_path.exists():
        try:
            ensure_contract_templates(ROOT_DIR / "uploads")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Template generation failed: {e}")
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Contract template not found")
    return FileResponse(
        str(pdf_path),
        media_type="application/pdf",
        filename=f"myisraelrental-rental-contract-{lang}.pdf",
    )




@api_router.post("/contracts/upload", response_model=ContractUploadResponse)
async def upload_contract(
    file: UploadFile = File(...),
    property_id: str = Form(...),
    payload: dict = Depends(verify_token)
) -> dict:
    # Verify property exists and user is owner
    property_data = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    if property_data.get('owner_id') != payload['user_id'] and payload.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Only property owners can upload contracts")

    # Validate file type
    content_type = file.content_type or ""
    if content_type not in ALLOWED_CONTRACT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type}. Allowed: PDF, DOCX, JPG, PNG, WebP"
        )

    file_ext = ALLOWED_CONTRACT_TYPES[content_type]
    contract_id = str(uuid.uuid4())
    filename = f"{contract_id}.{file_ext}"
    file_path = CONTRACT_DIR / filename

    # Save file to disk
    size = 0
    with open(file_path, "wb") as f:
        while chunk := await file.read(1024 * 256):
            size += len(chunk)
            if size > MAX_FILE_SIZE:
                f.close()
                file_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="File too large. Max 50MB")
            f.write(chunk)

    # Extract text based on file type
    extracted_text = ""
    if file_ext == "pdf":
        extracted_text = extract_text_from_pdf(str(file_path))
    elif file_ext == "docx":
        extracted_text = extract_text_from_docx(str(file_path))
    elif file_ext in ("jpg", "png", "webp"):
        extracted_text = extract_text_from_image(str(file_path))

    contract_doc = {
        "id": contract_id,
        "property_id": property_id,
        "owner_id": payload['user_id'],
        "original_filename": file.filename,
        "stored_filename": filename,
        "file_type": file_ext,
        "file_size": size,
        "extracted_text": extracted_text,
        "translated_text": None,
        "translation_direction": None,
        "translation_status": "none",
        "signatures": [],
        "signed": False,
        "created_at": datetime.now(UTC).isoformat(),
        "updated_at": datetime.now(UTC).isoformat(),
    }

    await db.contracts.insert_one(contract_doc)
    return {
        "id": contract_id,
        "original_filename": file.filename,
        "file_type": file_ext,
        "extracted_text_length": len(extracted_text),
        "message": "Contract uploaded successfully"
    }



@api_router.get("/contracts", response_model=list[ContractOut])
async def list_contracts(property_id: str | None = None, payload: dict = Depends(verify_token)) -> list[dict]:
    query = {}
    if payload.get('role') != 'admin':
        query["owner_id"] = payload['user_id']
    if property_id:
        query["property_id"] = property_id
    contracts = await db.contracts.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return contracts



async def _may_access_contract(contract: dict, payload: dict) -> bool:
    """True when the caller is entitled to read this contract.

    Contracts are signed legal documents, so access is limited to the people
    actually party to them: the property owner, an admin, or a renter who has
    a booking against the same property.
    """
    if payload.get("role") == "admin":
        return True
    user_id = payload.get("user_id")
    if contract.get("owner_id") == user_id:
        return True
    property_id = contract.get("property_id")
    if property_id and user_id:
        booking = await db.bookings.find_one(
            {"property_id": property_id, "renter_id": user_id}, {"_id": 1}
        )
        if booking:
            return True
    return False


@api_router.get("/contracts/download/{contract_id}")
async def download_contract(
    contract_id: str, payload: dict = Depends(verify_token)
) -> FileResponse:
    contract = await db.contracts.find_one({"id": contract_id}, {"_id": 0})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    # Was previously unauthenticated: any contract_id could be downloaded by
    # anyone. Signed contracts carry personal data + signatures, so gate it.
    if not await _may_access_contract(contract, payload):
        raise HTTPException(status_code=403, detail="Not authorized to access this contract")

    file_path = CONTRACT_DIR / contract.get('stored_filename', '')
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Contract file not found on disk")

    media_types = {
        "pdf": "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "jpg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
    }
    media_type = media_types.get(contract.get('file_type', ''), "application/octet-stream")

    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=contract.get('original_filename', f"contract.{contract.get('file_type', 'pdf')}")
    )



_CONTRACT_MEDIA_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
}


def _resolve_private_contract_file(stored: str):
    """Map a stored contract reference to a file inside CONTRACT_DIR.

    Accepts BOTH the legacy public-URL form ("/api/uploads/signed_x.pdf") and a
    bare filename, so this works before and after the stored values are
    normalised — no flag day, and old records keep resolving.

    Returns the resolved Path, or None if it's missing/outside CONTRACT_DIR.
    """
    if not stored:
        return None
    # basename only — defeats "../" traversal in the stored value
    filename = PurePosixPath(stored.replace("\\", "/")).name
    if not filename or filename in (".", ".."):
        return None
    root = CONTRACT_DIR.resolve()
    candidate = (root / filename).resolve()
    if not str(candidate).startswith(str(root)):
        return None
    return candidate if candidate.exists() else None


async def _serve_contract(doc: dict, url_field: str, pid_field: str, download_name: str):
    """Stream a contract from private Cloudinary storage, falling back to disk.

    Cloudinary holds it as an `authenticated` raw asset, which is not publicly
    fetchable — we pull the bytes server-side with a short-lived signed URL and
    stream them ourselves, so no signed URL ever reaches the browser.
    """
    public_id = doc.get(pid_field)
    if public_id:
        data = await fetch_contract_from_cloudinary(public_id)
        if data is not None:
            ext = (doc.get(url_field) or "").rsplit(".", 1)[-1].lower()
            return StreamingResponse(
                io.BytesIO(data),
                media_type=_CONTRACT_MEDIA_TYPES.get(ext, "application/octet-stream"),
                headers={"Content-Disposition": f'attachment; filename="{download_name}.{ext or "pdf"}"'},
            )
        logger.warning(f"Cloudinary fetch failed for {public_id}; trying local disk")

    file_path = _resolve_private_contract_file(doc.get(url_field) or "")
    if file_path is None:
        return None
    ext = file_path.suffix.lstrip(".").lower()
    return FileResponse(
        path=str(file_path),
        media_type=_CONTRACT_MEDIA_TYPES.get(ext, "application/octet-stream"),
        filename=f"{download_name}.{ext or 'pdf'}",
    )


@api_router.get("/bookings/{booking_id}/signed-contract")
async def download_signed_contract(
    booking_id: str, payload: dict = Depends(verify_token)
):
    """Serve a booking's signed contract to the parties involved.

    Replaces the old pattern of storing a public `/api/uploads/...` URL and
    letting the static mount serve it — that bypassed all access control, so
    anyone holding the URL could read a signed agreement.
    """
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    user_id = payload.get("user_id")
    if payload.get("role") != "admin" and user_id not in (
        booking.get("renter_id"),
        booking.get("owner_id"),
    ):
        raise HTTPException(status_code=403, detail="Not authorized to access this contract")

    resp = await _serve_contract(
        booking, "signed_contract_url", "signed_contract_public_id",
        f"signed-contract-{booking_id}",
    )
    if resp is None:
        raise HTTPException(status_code=404, detail="Signed contract not available")
    return resp


@api_router.get("/properties/{property_id}/contract-file")
async def download_property_contract(
    property_id: str, payload: dict = Depends(verify_token)
):
    """Serve a property's uploaded contract template to entitled users.

    Same rationale as the booking endpoint: this file used to be reachable at
    a public `/api/uploads/contract_<uuid>.pdf` URL with no access control.
    """
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    user_id = payload.get("user_id")
    allowed = payload.get("role") == "admin" or prop.get("owner_id") == user_id
    if not allowed and user_id:
        # Renters need to read the contract for a property they've booked.
        booking = await db.bookings.find_one(
            {"property_id": property_id, "renter_id": user_id}, {"_id": 1}
        )
        allowed = booking is not None
    if not allowed:
        raise HTTPException(status_code=403, detail="Not authorized to access this contract")

    resp = await _serve_contract(
        prop, "contract_url", "contract_public_id", f"contract-{property_id}",
    )
    if resp is None:
        raise HTTPException(status_code=404, detail="Contract not available")
    return resp


@api_router.get("/contracts/{contract_id}", response_model=ContractOut)
async def get_contract(contract_id: str, payload: dict = Depends(verify_token)) -> dict:
    contract = await db.contracts.find_one({"id": contract_id}, {"_id": 0})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if contract['owner_id'] != payload['user_id'] and payload.get('role') != 'admin':
        # Also allow signers to view
        signer_ids = [s.get('signer_id') for s in contract.get('signatures', [])]
        if payload['user_id'] not in signer_ids:
            raise HTTPException(status_code=403, detail="Not authorized")
    return contract



@api_router.post("/contracts/{contract_id}/translate", response_model=ContractTranslateResponse)
async def translate_contract(contract_id: str, direction: str = Form("he-en"), payload: dict = Depends(verify_token)) -> dict:
    contract = await db.contracts.find_one({"id": contract_id}, {"_id": 0})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if contract['owner_id'] != payload['user_id'] and payload.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")

    text = contract.get('extracted_text', '')
    if not text or len(text.strip()) < 10:
        raise HTTPException(status_code=400, detail="No sufficient text extracted from the contract to translate. Please ensure the document contains readable text.")

    try:
        translated = await _translate_text(text, direction)
        await db.contracts.update_one(
            {"id": contract_id},
            {"$set": {
                "translated_text": translated,
                "translation_status": "completed",
                "translation_direction": direction,
                "updated_at": datetime.now(UTC).isoformat()
            }}
        )
        return {"translated_text": translated, "direction": direction, "status": "completed"}
    except Exception as e:
        logger.error(f"Translation failed for contract {contract_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")



@api_router.post("/contracts/{contract_id}/sign", response_model=ContractSignResponse)
async def sign_contract(contract_id: str, signature: ContractSignature, payload: dict = Depends(verify_token)) -> dict:
    contract = await db.contracts.find_one({"id": contract_id}, {"_id": 0})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    new_signature = {
        "signer_id": payload['user_id'],
        "signer_name": signature.signer_name,
        "signature_data": signature.signature_data,
        "signed_at": datetime.now(UTC).isoformat()
    }

    await db.contracts.update_one(
        {"id": contract_id},
        {
            "$push": {"signatures": new_signature},
            "$set": {"signed": True, "updated_at": datetime.now(UTC).isoformat()}
        }
    )

    return {"message": "Contract signed successfully", "signed_at": new_signature['signed_at']}



@api_router.delete("/contracts/{contract_id}", response_model=MessageResponse)
async def delete_contract(contract_id: str, payload: dict = Depends(verify_token)) -> dict:
    contract = await db.contracts.find_one({"id": contract_id}, {"_id": 0})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if contract['owner_id'] != payload['user_id'] and payload.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")

    # Delete file from disk
    file_path = CONTRACT_DIR / contract.get('stored_filename', '')
    if file_path.exists():
        file_path.unlink()

    await db.contracts.delete_one({"id": contract_id})
    return {"message": "Contract deleted successfully"}
