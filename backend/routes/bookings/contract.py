"""Booking contract signing + translation flow.

The renter signs on the property owner's contract (either uploaded or
templated). Signature is stamped onto the PDF/PNG and persisted, then
the owner is notified via email. A companion endpoint translates the
contract text between languages using our LLM client.

Extracted from ``bookings.py`` in the 2026-07 refactor.
"""
import logging
import os
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException

from models_response import BookingSignContractResponse, BookingTranslationResponse
from routes.deps import ROOT_DIR, db, logger, verify_token
from utils.contract_signing import stamp_signature_on_contract
from utils.email import send_email
from utils.files import extract_text_from_image, extract_text_from_pdf
from utils.translate import translate_text as _translate_text

router = APIRouter()
api_router = router


@api_router.post("/bookings/{booking_id}/sign-contract", response_model=BookingSignContractResponse)
async def sign_booking_contract(booking_id: str, body: dict = Body(...), payload: dict = Depends(verify_token)) -> dict:
    """Renter signs the rental contract after owner acceptance"""
    booking, property_data = await _load_booking_for_signing(booking_id, payload['user_id'])

    signature_data = body.get('signature_data', '')
    legal_name = (body.get('legal_name') or '').strip()
    if not signature_data:
        raise HTTPException(status_code=400, detail="Signature data is required")
    if not legal_name:
        raise HTTPException(status_code=400, detail="Full legal name is required")

    signed_contract_url = await _stamp_contract_if_present(
        booking_id=booking_id,
        property_data=property_data,
        signature_data=signature_data,
        sig_x=body.get('signature_x', 0),
        sig_y=body.get('signature_y', 0),
        sig_w=body.get('signature_width', 200),
        sig_h=body.get('signature_height', 100),
        display_width=body.get('display_width'),
        display_height=body.get('display_height'),
        legal_name=legal_name,
    )

    await _persist_signed_contract(
        booking_id=booking_id,
        signature_data=signature_data,
        signature_position={
            'x': body.get('signature_x', 0),
            'y': body.get('signature_y', 0),
            'width': body.get('signature_width', 200),
            'height': body.get('signature_height', 100),
        },
        display_width=body.get('display_width'),
        display_height=body.get('display_height'),
        legal_name=legal_name,
        signed_contract_url=signed_contract_url,
    )

    await _notify_owner_contract_signed(booking, property_data, signed_contract_url)

    return {
        "message": "Contract signed successfully",
        "booking_status": "confirmed",
        "signed_contract_url": signed_contract_url,
    }


# ---- sign_booking_contract helpers --------------------------------------

async def _load_booking_for_signing(booking_id: str, user_id: str) -> tuple[dict, dict]:
    """Look up the booking, validate the renter is signing their own
    contract, and confirm a contract was actually sent. Also fetches the
    property doc since both the stamper and the notification need it."""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking['renter_id'] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if not booking.get('contract_sign_token'):
        raise HTTPException(status_code=400, detail="No contract to sign for this booking")
    if booking.get('contract_signed'):
        raise HTTPException(status_code=400, detail="Contract already signed")
    property_data = await db.properties.find_one({"id": booking['property_id']}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    return booking, property_data


async def _stamp_contract_if_present(
    *, booking_id: str, property_data: dict,
    signature_data: str,
    sig_x: float, sig_y: float, sig_w: float, sig_h: float,
    display_width: float | None, display_height: float | None,
    legal_name: str,
) -> str | None:
    """If the property has an attached contract, stamp the signature onto
    a fresh copy in `uploads/` and return its public URL. Otherwise None."""
    if not property_data.get('contract_url'):
        return None
    contract_filename = property_data['contract_url'].split('/')[-1]
    contract_path = ROOT_DIR / "uploads" / contract_filename
    if not contract_path.exists():
        raise HTTPException(status_code=404, detail="Contract file not found")
    signed_filename = f"signed_{booking_id}_{contract_filename}"
    signed_path = ROOT_DIR / "uploads" / signed_filename
    try:
        stamp_signature_on_contract(
            contract_path=contract_path,
            signed_path=signed_path,
            signature_data=signature_data,
            sig_x=sig_x, sig_y=sig_y, sig_w=sig_w, sig_h=sig_h,
            display_width=display_width, display_height=display_height,
            legal_name=legal_name,
            booking_id=booking_id,
            uploads_dir=ROOT_DIR / "uploads",
        )
    except Exception as e:
        logger.error(f"Failed to stamp signature on contract: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process signature: {e}")
    return f"/api/uploads/{signed_filename}"


async def _persist_signed_contract(
    *, booking_id: str,
    signature_data: str,
    signature_position: dict,
    display_width: float | None, display_height: float | None,
    legal_name: str,
    signed_contract_url: str | None,
) -> None:
    """Update the booking doc with signature data + signed-contract URL."""
    update_data: dict[str, Any] = {
        "contract_signed": True,
        "signature_data": signature_data,
        "signature_position": signature_position,
        # Persist the signing-canvas dimensions so we can faithfully re-stamp
        # this contract later (e.g. when stamping logic improves) without
        # asking the renter to re-sign. Falls back to None on legacy clients
        # that don't pass these values.
        "signature_display": {"width": display_width, "height": display_height},
        "signer_legal_name": legal_name,
        "contract_signed_at": datetime.now(UTC).isoformat(),
    }
    if signed_contract_url:
        update_data["signed_contract_url"] = signed_contract_url
    await db.bookings.update_one({"id": booking_id}, {"$set": update_data})


async def _notify_owner_contract_signed(
    booking: dict, property_data: dict, signed_contract_url: str | None,
) -> None:
    """Drop an in-app notification + WhatsApp ping for the owner about
    the signed contract. WhatsApp gracefully no-ops when the integration
    isn't configured or the owner has no phone on file."""
    message = (
        f"The rental contract for {property_data.get('title', 'your property')} "
        "has been signed by the renter. The booking is now fully confirmed!"
    )
    if signed_contract_url:
        message += " View the signed contract in the booking details."
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": booking['owner_id'],
        "type": "contract_signed",
        "booking_id": booking['id'],
        "property_id": booking['property_id'],
        "message": message,
        "read": False,
        "created_at": datetime.now(UTC).isoformat(),
    })

    # WhatsApp the owner. Best-effort — failure must not break the
    # contract-signed response. Fetched separately so we don't keep
    # phone numbers cached in the booking doc.
    try:
        owner = await db.users.find_one(
            {"id": booking['owner_id']},
            {"_id": 0, "name": 1, "phone": 1, "preferred_language": 1},
        )
        renter = await db.users.find_one(
            {"id": booking['renter_id']}, {"_id": 0, "name": 1},
        )
        if owner and owner.get("phone"):
            from utils.whatsapp import send_contract_signed_notification
            await send_contract_signed_notification(
                recipient_phone=owner["phone"],
                recipient_name=owner.get("name") or "",
                tenant_name=(renter or {}).get("name") or "your tenant",
                # Deep link: the owner dashboard booking-detail view.
                contract_path=f"dashboard?tab=bookings&booking_id={booking['id']}",
                language=owner.get("preferred_language") or "en",
            )
    except Exception as exc:  # noqa: BLE001
        logging.getLogger(__name__).warning(
            "WhatsApp notify failed (contract signed): %s", exc
        )



@api_router.post("/bookings/{booking_id}/translate-contract", response_model=BookingTranslationResponse)
async def translate_booking_contract(booking_id: str, body: dict = Body(default={}), payload: dict = Depends(verify_token)) -> dict:
    """Translate the property contract associated with a booking.

    Designed for RENTERS who receive a contract in a language they don't read.
    The translation is cached on the booking so repeat calls are free.
    Request body: { "direction": "he-en" | "en-he" }  (default "he-en")
    """
    booking = await _load_translatable_booking(booking_id, payload["user_id"])
    direction = (body.get("direction") or "he-en").lower()

    cached = _cached_translation(booking, direction)
    if cached:
        return cached

    contract_path = await _resolve_contract_path(booking)
    text = _extract_contract_text(contract_path)
    translated = await _do_translate(text, direction, booking_id)

    # Cache on booking to avoid repeated LLM calls
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "contract_original_text": text,
            "contract_translated_text": translated,
            "contract_translation_direction": direction,
            "contract_translated_at": datetime.now(UTC).isoformat(),
        }},
    )

    return {
        "translated_text": translated,
        "original_text": text,
        "direction": direction,
        "status": "completed",
        "cached": False,
    }


async def _load_translatable_booking(booking_id: str, user_id: str) -> dict:
    """Fetch the booking, asserting the caller is one of its two parties."""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    # Renter (signing party) or the booking owner can request a translation
    if booking["renter_id"] != user_id and booking["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return booking


def _cached_translation(booking: dict, direction: str) -> dict | None:
    """Return a ready-to-send response if a matching translation is stored."""
    if (
        booking.get("contract_translated_text")
        and booking.get("contract_translation_direction") == direction
    ):
        return {
            "translated_text": booking["contract_translated_text"],
            "direction": direction,
            "status": "completed",
            "cached": True,
        }
    return None


async def _resolve_contract_path(booking: dict):
    """Locate the contract file on disk, raising 404 if missing."""
    property_data = await db.properties.find_one({"id": booking["property_id"]}, {"_id": 0})
    if not property_data or not property_data.get("contract_url"):
        raise HTTPException(status_code=404, detail="No contract available for this booking")
    contract_filename = property_data["contract_url"].split("/")[-1]
    contract_path = ROOT_DIR / "uploads" / contract_filename
    if not contract_path.exists():
        raise HTTPException(status_code=404, detail="Contract file not found on server")
    return contract_path


# File extensions we know how to OCR / extract text from.
_IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif")


def _extract_contract_text(contract_path) -> str:
    """Run extension-specific extraction and ensure the result is meaningful."""
    ext = contract_path.suffix.lower()
    if ext == ".pdf":
        text = extract_text_from_pdf(str(contract_path))
    elif ext in _IMAGE_EXTS:
        text = extract_text_from_image(str(contract_path))
    else:
        raise HTTPException(status_code=400, detail="Unsupported contract format")
    if not text or len(text.strip()) < 10:
        raise HTTPException(
            status_code=400,
            detail="Could not extract readable text from the contract. It may be a low-quality scan.",
        )
    return text


async def _do_translate(text: str, direction: str, booking_id: str) -> str:
    """Invoke the LLM translator, mapping any failure to a 500."""
    try:
        return await _translate_text(text, direction)
    except Exception as e:
        logger.error(f"Booking contract translation failed for {booking_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}") from None
