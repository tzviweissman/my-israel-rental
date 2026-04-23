"""Auto-extracted from server.py during the 2026-04 refactor."""
import asyncio
import base64
import json as _json
import logging
import os
import shutil
import uuid
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from typing import List, Optional

import bcrypt
import httpx
from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel

from models import *
from routes.deps import db, logger, verify_token, create_token, EMERGENT_LLM_KEY, POSTMARK_WEBHOOK_SECRET, ROOT_DIR, UPLOAD_DIR, CONTRACT_DIR, MAX_FILE_SIZE, ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES, ALLOWED_CONTRACT_TYPES
from utils.email import (
    send_email,
    send_welcome_email,
    send_password_reset_email,
    send_booking_confirmation_email,
    send_booking_notification_email,
)
from utils.pdf import stamp_signature_on_document
from utils.saved_search import match_property_against_searches
from utils.helpers import get_usd_ils_rate, parse_ical_feed, sync_property_ical
from utils.files import extract_text_from_pdf, extract_text_from_docx, extract_text_from_image
from utils.translate import translate_text as _translate_text
from utils.contract_template import ensure_templates as ensure_contract_templates

from emergentintegrations.llm.chat import LlmChat, UserMessage

router = APIRouter()
api_router = router  # alias so existing @api_router decorators work verbatim


@api_router.get("/contract-template/{lang}")
async def download_contract_template(lang: str):
    """Serve the MyIsraelRental blank fillable rental-contract PDF.
    Public endpoint — owners and renters alike can download a blank template.
    Supported languages: 'en' (English) and 'he' (Hebrew)."""
    from starlette.responses import FileResponse
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




@api_router.post("/contracts/upload")
async def upload_contract(
    file: UploadFile = File(...),
    property_id: str = Form(...),
    payload=Depends(verify_token)
):
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
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.contracts.insert_one(contract_doc)
    return {
        "id": contract_id,
        "original_filename": file.filename,
        "file_type": file_ext,
        "extracted_text_length": len(extracted_text),
        "message": "Contract uploaded successfully"
    }



@api_router.get("/contracts")
async def list_contracts(property_id: Optional[str] = None, payload=Depends(verify_token)):
    query = {}
    if payload.get('role') != 'admin':
        query["owner_id"] = payload['user_id']
    if property_id:
        query["property_id"] = property_id
    contracts = await db.contracts.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return contracts



@api_router.get("/contracts/download/{contract_id}")
async def download_contract(contract_id: str):
    from starlette.responses import FileResponse
    contract = await db.contracts.find_one({"id": contract_id}, {"_id": 0})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

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



@api_router.get("/contracts/{contract_id}")
async def get_contract(contract_id: str, payload=Depends(verify_token)):
    contract = await db.contracts.find_one({"id": contract_id}, {"_id": 0})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if contract['owner_id'] != payload['user_id'] and payload.get('role') != 'admin':
        # Also allow signers to view
        signer_ids = [s.get('signer_id') for s in contract.get('signatures', [])]
        if payload['user_id'] not in signer_ids:
            raise HTTPException(status_code=403, detail="Not authorized")
    return contract



@api_router.post("/contracts/{contract_id}/translate")
async def translate_contract(contract_id: str, direction: str = Form("he-en"), payload=Depends(verify_token)):
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
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return {"translated_text": translated, "direction": direction, "status": "completed"}
    except Exception as e:
        logger.error(f"Translation failed for contract {contract_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")



@api_router.post("/contracts/{contract_id}/sign")
async def sign_contract(contract_id: str, signature: ContractSignature, payload=Depends(verify_token)):
    contract = await db.contracts.find_one({"id": contract_id}, {"_id": 0})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    new_signature = {
        "signer_id": payload['user_id'],
        "signer_name": signature.signer_name,
        "signature_data": signature.signature_data,
        "signed_at": datetime.now(timezone.utc).isoformat()
    }

    await db.contracts.update_one(
        {"id": contract_id},
        {
            "$push": {"signatures": new_signature},
            "$set": {"signed": True, "updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )

    return {"message": "Contract signed successfully", "signed_at": new_signature['signed_at']}



@api_router.delete("/contracts/{contract_id}")
async def delete_contract(contract_id: str, payload=Depends(verify_token)):
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
