"""Auto-extracted from server.py during the 2026-04 refactor."""
import asyncio
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile
from pymongo import ReturnDocument

from models import SubleaseCreate
from models_response import (
    ContractSignResponse,
    IdMessageResponse,
    MessageResponse,
    PublicContractResponse,
    SubleaseContractUploadResponse,
    SubleaseOut,
)
from routes.deps import ALLOWED_CONTRACT_TYPES, CONTRACT_DIR, MAX_FILE_SIZE, db, logger, verify_token
from utils.area_filter import area_mongo_query
from utils.property_rows import keep_valid_rows
from utils.files import extract_text_from_docx, extract_text_from_image, extract_text_from_pdf
from utils.contract_files import load_contract_by_sign_token, sign_token_expiry
from utils.signed_contract import build_signed_pdf

router = APIRouter()
api_router = router  # alias so existing @api_router decorators work verbatim


@api_router.post("/subleases", response_model=IdMessageResponse)
async def create_sublease(sublease_data: SubleaseCreate, payload: dict = Depends(verify_token)) -> dict:
    # Two flows:
    #  (a) Linked sublease — renter booked through us. property_id is set,
    #      we verify the booking exists, and copy the property's title /
    #      area / images so the listing looks consistent with the original.
    #  (b) Manual sublease — renter booked elsewhere. property_id is None,
    #      the renter supplies title / area / images themselves. We skip
    #      the booking guard and just require the minimum metadata.
    linked = bool(sublease_data.property_id)
    property_data = None

    if linked:
        booking = await db.bookings.find_one({
            "property_id": sublease_data.property_id,
            "renter_id": payload['user_id'],
            "status": {"$in": ["pending", "confirmed"]}
        }, {"_id": 0})
        if not booking:
            raise HTTPException(status_code=403, detail="You can only sublease properties you have an active booking for")

        property_data = await db.properties.find_one({"id": sublease_data.property_id}, {"_id": 0})
        if not property_data:
            raise HTTPException(status_code=404, detail="Property not found")
    else:
        # Manual sublease requires at least a title + area so the public
        # listing is recognisable. Everything else falls back to sane defaults.
        if not (sublease_data.title or "").strip():
            raise HTTPException(status_code=400, detail="Title is required when subleasing a property booked elsewhere")
        if not (sublease_data.area or "").strip():
            raise HTTPException(status_code=400, detail="Area is required when subleasing a property booked elsewhere")

    sublease_id = str(uuid.uuid4())
    base_bedrooms = (property_data or {}).get('bedrooms', 0) if linked else (sublease_data.bedrooms or 0)
    sublease_doc = {
        "id": sublease_id,
        "original_property_id": sublease_data.property_id,  # None for manual
        "subleasor_id": payload['user_id'],
        "available_from": sublease_data.available_from,
        "available_to": sublease_data.available_to,
        "price": sublease_data.price,
        "price_type": sublease_data.price_type,
        "currency": sublease_data.currency or 'ILS',
        "holiday_tags": sublease_data.holiday_tags or [],
        "bedrooms_available": (
            sublease_data.bedrooms_available
            if sublease_data.bedrooms_available is not None
            else base_bedrooms
        ),
        "notes": sublease_data.notes or "",
        # Linked: copy from property record. Manual: take from request body.
        "title": (property_data.get('title', '') if linked else (sublease_data.title or '')),
        "description": (property_data.get('description', '') if linked else (sublease_data.description or '')),
        "area": (property_data.get('area', '') if linked else (sublease_data.area or '')),
        "address": (property_data.get('address', '') if linked else (sublease_data.address or '')),
        "bathrooms": (property_data.get('bathrooms', 0) if linked else (sublease_data.bathrooms or 0)),
        "images": (property_data.get('images', []) if linked else (sublease_data.images or [])),
        "amenities": (property_data.get('amenities', []) if linked else (sublease_data.amenities or [])),
        "property_type": (property_data.get('property_type', '') if linked else (sublease_data.property_type or 'apartment')),
        "active": True,
        "created_at": datetime.now(UTC).isoformat(),
        "updated_at": datetime.now(UTC).isoformat()
    }

    await db.subleases.insert_one(sublease_doc)
    return {"id": sublease_id, "message": "Sublease listed successfully"}



# The two public sublease reads never return the contract's sign_token. It is
# the ONLY credential on /contracts/sign/{token} (view, download, sign), and
# until 20 Sep 2026 both endpoints handed it to anyone (security scan F1).
# The subleasor still gets it from /my-subleases, which is behind a login.
_PUBLIC_FIELDS = {"_id": 0, "sign_token": 0}


@api_router.get("/subleases", response_model=list[SubleaseOut])
async def list_subleases(area: str | None = None, holiday_tag: str | None = None) -> list[dict]:
    query: dict = {"active": True}
    if area:
        # Mirror the /properties area filter: city-scoped, prefix-anchored
        # match. See utils/area_filter.py for the full reasoning.
        area_q = area_mongo_query(area)
        if area_q is not None:
            query["area"] = area_q
    if holiday_tag:
        query["holiday_tags"] = holiday_tag
    subleases = await db.subleases.find(query, _PUBLIC_FIELDS).sort("created_at", -1).to_list(500)
    # One malformed row must not 500 the whole board - see utils/property_rows.py.
    return keep_valid_rows(subleases, SubleaseOut, route="GET /subleases", logger=logger)


@api_router.get("/subleases/{sublease_id}", response_model=SubleaseOut)
async def get_sublease_by_id(sublease_id: str) -> dict:
    sublease = await db.subleases.find_one({"id": sublease_id}, _PUBLIC_FIELDS)
    if not sublease:
        raise HTTPException(status_code=404, detail="Sublease not found")
    return sublease



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
    return keep_valid_rows(subleases, SubleaseOut, route="GET /my-subleases", logger=logger)



@api_router.put("/subleases/{sublease_id}", response_model=MessageResponse)
async def update_sublease(sublease_id: str, updates: dict = Body(...), payload: dict = Depends(verify_token)) -> dict:
    sublease = await db.subleases.find_one({"id": sublease_id}, {"_id": 0})
    if not sublease:
        raise HTTPException(status_code=404, detail="Sublease not found")
    if sublease['subleasor_id'] != payload['user_id'] and payload.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")

    allowed = {"available_from", "available_to", "price", "price_type", "currency", "holiday_tags", "bedrooms_available", "notes", "active"}
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
        extracted_text = await asyncio.to_thread(extract_text_from_pdf, str(file_path))
    elif file_ext == "docx":
        extracted_text = await asyncio.to_thread(extract_text_from_docx, str(file_path))
    elif file_ext in ("jpg", "png", "webp"):
        extracted_text = await asyncio.to_thread(extract_text_from_image, str(file_path))

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
    """Public endpoint - sublessee accesses contract via sign_token (no auth needed)

    The third endpoint on this token, `GET /contracts/sign/{sign_token}/file`,
    lives in routes/contracts.py rather than here. It serves the contract's
    BYTES, and every route that does is kept together so the access rule on
    each can be read in one place.
    """
    contract = await load_contract_by_sign_token(sign_token)

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
    contract = await load_contract_by_sign_token(sign_token)

    # A contract is signed once. The booking flow next door has always said
    # so (`_load_booking_for_signing`: "Contract already signed"); this one
    # did not, and since f4a96e9 made each signing REBUILD the combined PDF
    # that omission stopped being a duplicate row in signatures[] and became
    # a rewrite of the document itself.
    #
    # The sign_token is a bearer credential with no expiry and no single-use
    # enforcement, so anyone still holding the link - it was emailed - could
    # call this directly and quietly replace an already-signed legal
    # agreement with one carrying a different name. The UI hides the form
    # once `signed` is true, which is why nobody hit it by accident.
    if contract.get("signed"):
        raise HTTPException(status_code=400, detail="This contract has already been signed")

    signer_name = body.get("signer_name", "").strip()
    signature_data = body.get("signature_data", "")

    if not signer_name or not signature_data:
        raise HTTPException(status_code=400, detail="Name and signature are required")

    signed_at = datetime.now(UTC)
    new_signature = {
        "signer_id": "sublessee",
        "signer_name": signer_name,
        "signature_data": signature_data,
        "signed_at": signed_at.isoformat()
    }

    # `"signed": {"$ne": True}` in the FILTER, for the same reason the order
    # status write carries its starting status (17 Sep audit): the guard
    # above ran against a document read a moment ago. Two signers with the
    # same emailed link, submitting at once, could both pass it, and the
    # second write would push a second signature and rebuild the PDF over
    # the first person's. Now only one write can land; the other is told.
    signed_now = await db.contracts.find_one_and_update(
        {"sign_token": sign_token, "signed": {"$ne": True}},
        {
            "$push": {"signatures": new_signature},
            "$set": {
                "signed": True,
                "updated_at": signed_at.isoformat(),
                # The link stops working a month from now. Until this moment
                # it had no deadline at all, which is what the 10 Sep audit
                # found: a forwarded link, a screenshot, or browser history on
                # a shared device kept serving a finished legal agreement
                # forever. The window is measured from the signature rather
                # than the upload so the signer keeps a real chance to
                # download their own executed copy - this link is their only
                # route to it. See utils/contract_files.SIGN_TOKEN_GRACE_DAYS.
                "sign_token_expires_at": sign_token_expiry(signed_at),
            }
        },
        return_document=ReturnDocument.AFTER,
    )
    if signed_now is None:
        # Someone else's signature landed between our read and our write.
        # Theirs is the contract now; say so rather than silently losing
        # this one or, worse, stacking it on top.
        raise HTTPException(
            status_code=409,
            detail="This contract was signed by someone else a moment ago. Refresh to see it.",
        )

    # Build the document the two of them can actually send someone: the
    # agreement with a signature page after it.
    #
    # AFTER the signature is stored, and deliberately so. The signature is
    # the part that cannot be recreated - the signer has closed the tab by
    # the time anything here runs - so it is written down first and the PDF
    # is assembled from it. If assembly fails, the signature survives, the
    # page still says signed, and the original is still downloadable; the
    # only thing lost is the combined copy, which can be rebuilt from what
    # was saved. The other order round would trade a signature for a
    # rendering error.
    try:
        source = CONTRACT_DIR / (contract.get("stored_filename") or "")
        if source.exists():
            sublease_doc = await db.subleases.find_one(
                {"id": contract.get("sublease_id")}, {"_id": 0, "title": 1},
            ) if contract.get("sublease_id") else None
            # Stamped with the signing time, so a rebuild can never land on
            # top of a file someone has already downloaded and kept. The
            # guard above should mean there is only ever one, but a fixed
            # name makes "only ever one" a thing the filesystem assumes
            # rather than a thing the code enforces - and this is the one
            # directory in the app where losing a file is unrecoverable.
            signed_name = f"signed_{contract['id']}_{datetime.now(UTC).strftime('%Y%m%dT%H%M%S')}.pdf"
            build_signed_pdf(
                source,
                CONTRACT_DIR / signed_name,
                signer_name=signer_name,
                signed_at=datetime.now(UTC),
                signature_data=signature_data,
                document_title=(sublease_doc or {}).get("title", ""),
                original_filename=contract.get("original_filename") or "",
            )
            # PRIVATE, like every other contract file. Not `uploads/`, which
            # is the public static mount - a signed agreement served from
            # there bypasses every permission check, which is the bug this
            # codebase shipped three times and once paid for with a real
            # contract (CLAUDE.md).
            await db.contracts.update_one(
                {"sign_token": sign_token},
                {"$set": {"signed_filename": signed_name}},
            )
    except Exception as e:
        logger.warning(
            "signed contract PDF could not be built for %s: %s", contract.get("id"), e,
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
