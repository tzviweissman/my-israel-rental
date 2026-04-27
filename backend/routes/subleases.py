"""Auto-extracted from server.py during the 2026-04 refactor."""
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile

from models import SubleaseCreate
from models_response import (
    ContractSignResponse,
    IdMessageResponse,
    MessageResponse,
    PublicContractResponse,
    SubleaseContractUploadResponse,
    SubleaseOut,
)
from routes.deps import ALLOWED_CONTRACT_TYPES, CONTRACT_DIR, MAX_FILE_SIZE, db, verify_token
from utils.files import extract_text_from_docx, extract_text_from_image, extract_text_from_pdf

router = APIRouter()
api_router = router  # alias so existing @api_router decorators work verbatim


@api_router.post("/subleases", response_model=IdMessageResponse)
async def create_sublease(sublease_data: SubleaseCreate, payload: dict = Depends(verify_token)) -> dict:
    # Verify the renter has a booking for this property
    booking = await db.bookings.find_one({
        "property_id": sublease_data.property_id,
        "renter_id": payload['user_id'],
        "status": {"$in": ["pending", "confirmed"]}
    }, {"_id": 0})

    if not booking:
        raise HTTPException(status_code=403, detail="You can only sublease properties you have an active booking for")

    # Get the original property details
    property_data = await db.properties.find_one({"id": sublease_data.property_id}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")

    sublease_id = str(uuid.uuid4())
    sublease_doc = {
        "id": sublease_id,
        "original_property_id": sublease_data.property_id,
        "subleasor_id": payload['user_id'],
        "available_from": sublease_data.available_from,
        "available_to": sublease_data.available_to,
        "price": sublease_data.price,
        "price_type": sublease_data.price_type,
        "bedrooms_available": sublease_data.bedrooms_available if sublease_data.bedrooms_available is not None else property_data.get('bedrooms', 0),
        "notes": sublease_data.notes or "",
        # Copy key property details for the listing
        "title": f"Sublease: {property_data.get('title', '')}",
        "description": property_data.get('description', ''),
        "area": property_data.get('area', ''),
        "address": property_data.get('address', ''),
        "bathrooms": property_data.get('bathrooms', 0),
        "images": property_data.get('images', []),
        "amenities": property_data.get('amenities', []),
        "property_type": property_data.get('property_type', ''),
        "active": True,
        "created_at": datetime.now(UTC).isoformat(),
        "updated_at": datetime.now(UTC).isoformat()
    }

    await db.subleases.insert_one(sublease_doc)
    return {"id": sublease_id, "message": "Sublease listed successfully"}



@api_router.get("/subleases", response_model=list[SubleaseOut])
async def list_subleases(area: str | None = None) -> list[dict]:
    query: dict = {"active": True}
    if area:
        query["area"] = {"$regex": area, "$options": "i"}
    subleases = await db.subleases.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return subleases



@api_router.get("/my-subleases", response_model=list[SubleaseOut])
async def get_my_subleases(payload: dict = Depends(verify_token)) -> list[dict]:
    subleases = await db.subleases.find(
        {"subleasor_id": payload['user_id']}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    # Enrich with contract signing status
    for sub in subleases:
        if sub.get("contract_id"):
            contract = await db.contracts.find_one({"id": sub["contract_id"]}, {"_id": 0, "signed": 1})
            sub["contract_signed"] = contract.get("signed", False) if contract else False
        else:
            sub["contract_signed"] = False
    return subleases



@api_router.put("/subleases/{sublease_id}", response_model=MessageResponse)
async def update_sublease(sublease_id: str, updates: dict = Body(...), payload: dict = Depends(verify_token)) -> dict:
    sublease = await db.subleases.find_one({"id": sublease_id}, {"_id": 0})
    if not sublease:
        raise HTTPException(status_code=404, detail="Sublease not found")
    if sublease['subleasor_id'] != payload['user_id'] and payload.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")

    allowed = {"available_from", "available_to", "price", "price_type", "bedrooms_available", "notes", "active"}
    update_fields = {k: v for k, v in updates.items() if k in allowed}
    update_fields["updated_at"] = datetime.now(UTC).isoformat()

    await db.subleases.update_one({"id": sublease_id}, {"$set": update_fields})
    return {"message": "Sublease updated successfully"}



@api_router.post("/subleases/{sublease_id}/contract", response_model=SubleaseContractUploadResponse)
async def upload_sublease_contract(
    sublease_id: str,
    file: UploadFile = File(...),
    payload: dict = Depends(verify_token)
) -> dict:
    sublease = await db.subleases.find_one({"id": sublease_id}, {"_id": 0})
    if not sublease:
        raise HTTPException(status_code=404, detail="Sublease not found")
    if sublease['subleasor_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Only the subleasor can upload contracts")

    content_type = file.content_type or ""
    if content_type not in ALLOWED_CONTRACT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type. Allowed: PDF, DOCX, JPG, PNG, WebP")

    file_ext = ALLOWED_CONTRACT_TYPES[content_type]
    contract_id = str(uuid.uuid4())
    filename = f"{contract_id}.{file_ext}"
    file_path = CONTRACT_DIR / filename

    size = 0
    with open(file_path, "wb") as f:
        while chunk := await file.read(1024 * 256):
            size += len(chunk)
            if size > MAX_FILE_SIZE:
                f.close()
                file_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="File too large. Max 50MB")
            f.write(chunk)

    extracted_text = ""
    if file_ext == "pdf":
        extracted_text = extract_text_from_pdf(str(file_path))
    elif file_ext == "docx":
        extracted_text = extract_text_from_docx(str(file_path))
    elif file_ext in ("jpg", "png", "webp"):
        extracted_text = extract_text_from_image(str(file_path))

    sign_token = str(uuid.uuid4())

    contract_doc = {
        "id": contract_id,
        "sublease_id": sublease_id,
        "property_id": sublease.get("original_property_id", ""),
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
        "sign_token": sign_token,
        "created_at": datetime.now(UTC).isoformat(),
        "updated_at": datetime.now(UTC).isoformat(),
    }

    await db.contracts.insert_one(contract_doc)
    await db.subleases.update_one(
        {"id": sublease_id},
        {"$set": {"contract_id": contract_id, "sign_token": sign_token, "updated_at": datetime.now(UTC).isoformat()}}
    )

    return {
        "id": contract_id,
        "sign_token": sign_token,
        "original_filename": file.filename,
        "message": "Contract uploaded. Share the signing link with your sublessee."
    }



@api_router.get("/contracts/sign/{sign_token}", response_model=PublicContractResponse)
async def get_contract_for_signing(sign_token: str) -> dict:
    """Public endpoint - sublessee accesses contract via sign_token (no auth needed)"""
    contract = await db.contracts.find_one({"sign_token": sign_token}, {"_id": 0})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found or link is invalid")

    sublease = None
    if contract.get("sublease_id"):
        sublease = await db.subleases.find_one({"id": contract["sublease_id"]}, {"_id": 0})

    return {
        "id": contract["id"],
        "original_filename": contract.get("original_filename"),
        "file_type": contract.get("file_type"),
        "extracted_text": contract.get("extracted_text"),
        "translated_text": contract.get("translated_text"),
        "translation_status": contract.get("translation_status"),
        "signatures": contract.get("signatures", []),
        "signed": contract.get("signed", False),
        "sublease": {
            "title": sublease.get("title", "") if sublease else "",
            "area": sublease.get("area", "") if sublease else "",
            "available_from": sublease.get("available_from", "") if sublease else "",
            "available_to": sublease.get("available_to", "") if sublease else "",
            "price": sublease.get("price", 0) if sublease else 0,
            "price_type": sublease.get("price_type", "") if sublease else "",
        } if sublease else None
    }



@api_router.post("/contracts/sign/{sign_token}", response_model=ContractSignResponse)
async def sign_contract_public(sign_token: str, body: dict = Body(...)) -> dict:
    """Public endpoint - sublessee signs the contract via sign_token"""
    contract = await db.contracts.find_one({"sign_token": sign_token}, {"_id": 0})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found or link is invalid")

    signer_name = body.get("signer_name", "").strip()
    signature_data = body.get("signature_data", "")

    if not signer_name or not signature_data:
        raise HTTPException(status_code=400, detail="Name and signature are required")

    new_signature = {
        "signer_id": "sublessee",
        "signer_name": signer_name,
        "signature_data": signature_data,
        "signed_at": datetime.now(UTC).isoformat()
    }

    await db.contracts.update_one(
        {"sign_token": sign_token},
        {
            "$push": {"signatures": new_signature},
            "$set": {"signed": True, "updated_at": datetime.now(UTC).isoformat()}
        }
    )
    
    # Update sublease to mark contract as signed
    if contract.get("sublease_id"):
        await db.subleases.update_one(
            {"id": contract["sublease_id"]},
            {"$set": {"contract_signed": True}}
        )
        
        # Notify the subleasor (renter who posted the sublease)
        sublease = await db.subleases.find_one({"id": contract["sublease_id"]}, {"_id": 0})
        if sublease:
            notification = {
                "id": str(uuid.uuid4()),
                "user_id": sublease["subleasor_id"],
                "type": "sublease_contract_signed",
                "sublease_id": contract["sublease_id"],
                "message": f"{signer_name} has signed the sublease contract for {sublease.get('title', 'your property')}",
                "read": False,
                "created_at": datetime.now(UTC).isoformat()
            }
            await db.notifications.insert_one(notification)

    return {"message": "Contract signed successfully", "signed_at": new_signature['signed_at']}



@api_router.delete("/subleases/{sublease_id}", response_model=MessageResponse)
async def delete_sublease(sublease_id: str, payload: dict = Depends(verify_token)) -> dict:
    sublease = await db.subleases.find_one({"id": sublease_id}, {"_id": 0})
    if not sublease:
        raise HTTPException(status_code=404, detail="Sublease not found")
    if sublease['subleasor_id'] != payload['user_id'] and payload.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.subleases.delete_one({"id": sublease_id})
    return {"message": "Sublease removed successfully"}
