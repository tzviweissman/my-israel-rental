"""Property contract upload / view / delete endpoints.

Extracted from ``properties.py`` in the 2026-07 refactor.
"""
import asyncio
import os
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from models_response import ContractStatusResponse, MessageResponse, PropertyContractUploadResponse
from routes.deps import ROOT_DIR, db, logger, verify_token
from utils.email import send_email
from utils.events import publish

router = APIRouter()
api_router = router


@api_router.post("/properties/{property_id}/contract", response_model=PropertyContractUploadResponse)
async def upload_property_contract(
    property_id: str,
    file: UploadFile = File(...),
    payload: dict = Depends(verify_token)
) -> dict:
    """Upload contract for a property (owner/manager only)"""
    # Verify property exists and user is owner
    property_data = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if property_data['owner_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if property is long-term or short-term
    rental_type = property_data.get('rental_type', '')
    if rental_type not in ['long-term', 'short-term']:
        raise HTTPException(status_code=400, detail="Contracts only available for long-term and short-term rentals")
    
    # Validate file type (PDF and image formats)
    ALLOWED_TYPES = [
        'application/pdf',
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif'
    ]
    if not file.content_type or file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only PDF and image files (JPG, PNG, WEBP, HEIC) are allowed for contracts")
    
    # Save file
    UPLOAD_DIR = ROOT_DIR / "uploads"
    UPLOAD_DIR.mkdir(exist_ok=True)
    file_id = str(uuid.uuid4())
    
    # Get file extension from content type
    extension_map = {
        'application/pdf': 'pdf',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/heic': 'heic',
        'image/heif': 'heif'
    }
    ext = extension_map.get(file.content_type, 'pdf')
    filename = f"contract_{file_id}.{ext}"
    file_path = UPLOAD_DIR / filename
    
    size = 0
    MAX_CONTRACT_SIZE = 10 * 1024 * 1024  # 10MB
    with open(file_path, "wb") as f:
        while chunk := await file.read(1024 * 256):
            size += len(chunk)
            if size > MAX_CONTRACT_SIZE:
                f.close()
                file_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="Contract file too large. Max 10MB")
            f.write(chunk)
    
    contract_url = f"/api/uploads/{filename}"
    
    # Update property with contract URL
    await db.properties.update_one(
        {"id": property_id},
        {"$set": {
            "contract_url": contract_url,
            "contract_uploaded_at": datetime.now(UTC).isoformat()
        }}
    )

    # Retroactively send the contract to any already-confirmed bookings that
    # haven't had one yet (owner accepted the booking BEFORE uploading a contract)
    pending_bookings = await db.bookings.find({
        "property_id": property_id,
        "status": "confirmed",
        "contract_signed": {"$ne": True},
        "contract_sign_token": {"$in": [None, ""]},
    }, {"_id": 0}).to_list(500)

    notified_count = 0
    for bk in pending_bookings:
        sign_token = str(uuid.uuid4())
        await db.bookings.update_one(
            {"id": bk["id"]},
            {"$set": {
                "contract_sign_token": sign_token,
                "contract_sent_at": datetime.now(UTC).isoformat(),
                "contract_signed": False,
            }}
        )
        # Notify renter
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": bk["renter_id"],
            "type": "contract_pending",
            "booking_id": bk["id"],
            "property_id": property_id,
            "message": f"The owner has uploaded a contract for {property_data.get('title', 'your booking')}. Please sign it to finalize your rental.",
            "read": False,
            "created_at": datetime.now(UTC).isoformat(),
        })
        # Email the renter
        try:
            renter = await db.users.find_one({"id": bk["renter_id"]}, {"_id": 0, "email": 1, "name": 1})
            if renter and renter.get("email"):
                frontend = os.environ.get("FRONTEND_URL", "").rstrip("/")
                dashboard_link = f"{frontend}/dashboard?tab=bookings" if frontend else "/dashboard"
                html = f"""
                <p>Hi {renter.get('name','there')},</p>
                <p>The owner of <strong>{property_data.get('title', 'your rental')}</strong> has uploaded the rental contract.
                Please review and sign it to finalize your booking.</p>
                <p><a href="{dashboard_link}" style="background:#1E6A6A;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;">Open your dashboard to sign</a></p>
                """
                asyncio.create_task(send_email(
                    renter["email"],
                    f"Action needed: sign your rental contract — {property_data.get('title', 'My Israel Rental')}",
                    html,
                    tag="contract-pending",
                ))
        except Exception as e:
            logger.warning(f"Failed to queue contract-pending email for booking {bk['id']}: {e}")
        notified_count += 1

    return {
        "contract_url": contract_url,
        "message": "Contract uploaded successfully",
        "retroactive_notifications_sent": notified_count,
    }



@api_router.get("/properties/{property_id}/contract", response_model=ContractStatusResponse)
async def get_property_contract(property_id: str) -> dict:
    """Get contract details for a property"""
    property_data = await db.properties.find_one(
        {"id": property_id}, 
        {"_id": 0, "contract_url": 1, "contract_uploaded_at": 1, "rental_type": 1}
    )
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    return {
        "has_contract": bool(property_data.get('contract_url')),
        "contract_url": property_data.get('contract_url'),
        "uploaded_at": property_data.get('contract_uploaded_at'),
        "rental_type": property_data.get('rental_type')
    }



@api_router.delete("/properties/{property_id}/contract", response_model=MessageResponse)
async def delete_property_contract(property_id: str, payload: dict = Depends(verify_token)) -> dict:
    """Delete contract for a property"""
    property_data = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if property_data['owner_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Delete file from disk
    if property_data.get('contract_url'):
        filename = property_data['contract_url'].split('/')[-1]
        file_path = ROOT_DIR / "uploads" / filename
        file_path.unlink(missing_ok=True)
    
    # Remove from database
    await db.properties.update_one(
        {"id": property_id},
        {"$unset": {"contract_url": "", "contract_uploaded_at": ""}}
    )
    
    return {"message": "Contract deleted successfully"}


