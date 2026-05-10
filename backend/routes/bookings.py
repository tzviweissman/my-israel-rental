"""Auto-extracted from server.py during the 2026-04 refactor."""
import asyncio
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException

from models import BookingCreate
from models_response import (
    BookingAcceptResponse,
    BookingCreateResponse,
    BookingOut,
    BookingSignContractResponse,
    BookingTranslationResponse,
    MessageResponse,
)
from routes.deps import ROOT_DIR, db, logger, verify_token
from utils.contract_signing import stamp_signature_on_contract
from utils.email import (
    send_booking_confirmation_email,
    send_booking_notification_email,
    send_email,
)
from utils.files import extract_text_from_image, extract_text_from_pdf
from utils.saved_search import match_property_against_searches
from utils.translate import translate_text as _translate_text

router = APIRouter()
api_router = router  # alias so existing @api_router decorators work verbatim


@api_router.post("/bookings", response_model=BookingCreateResponse)
async def create_booking(booking_data: BookingCreate, payload: dict = Depends(verify_token)) -> dict:
    property_data = await db.properties.find_one({"id": booking_data.property_id}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")

    # If this booking is tied to a sublease, route it to the sublessor and
    # use the sublease's price/dates for downstream calculations. The
    # underlying property owner is NOT notified.
    sublease_data: dict | None = None
    if booking_data.sublease_id:
        sublease_data = await db.subleases.find_one(
            {"id": booking_data.sublease_id}, {"_id": 0}
        )
        if not sublease_data:
            raise HTTPException(status_code=404, detail="Sublease not found")
        if not sublease_data.get("active", True):
            raise HTTPException(status_code=400, detail="This sublease is no longer active")

    # No contract signature required at booking time
    # Contract will be sent after owner accepts for long-term/short-term rentals

    # Reject overlapping bookings up front so we never end up with two
    # confirmed/pending bookings on the same property for the same dates.
    # Same overlap rule used by /properties search: start < new_end AND end > new_start.
    # For SUBLEASE bookings, we deliberately scope the overlap check to OTHER
    # bookings on the SAME sublease — the sublessor's own underlying long-term
    # booking covers the entire sublease window, so a global property-level
    # check would always reject (defeating the whole sublease feature).
    if booking_data.sublease_id:
        overlap_filter: dict = {
            "sublease_id": booking_data.sublease_id,
            "status": {"$in": ["pending", "confirmed", "cancellation_requested"]},
            "start_date": {"$lt": booking_data.end_date},
            "end_date": {"$gt": booking_data.start_date},
        }
    else:
        overlap_filter = {
            "property_id": booking_data.property_id,
            # Ignore sublease-scoped bookings here — they live in a separate
            # logical calendar (the sublease window).
            "sublease_id": None,
            "status": {"$in": ["pending", "confirmed", "cancellation_requested"]},
            "start_date": {"$lt": booking_data.end_date},
            "end_date": {"$gt": booking_data.start_date},
        }
    overlap = await db.bookings.find_one(
        overlap_filter,
        {"_id": 0, "id": 1, "start_date": 1, "end_date": 1},
    )
    if overlap:
        raise HTTPException(
            status_code=409,
            detail=(
                "These dates overlap an existing booking "
                f"({overlap['start_date']} → {overlap['end_date']}). "
                "Please pick dates outside that window."
            ),
        )

    booking_id = str(uuid.uuid4())
    booking_doc = booking_data.model_dump()
    booking_doc['id'] = booking_id
    booking_doc['renter_id'] = payload['user_id']
    # Route owner_id: sublessor for sublease bookings, property owner otherwise
    booking_doc['owner_id'] = (
        sublease_data['subleasor_id'] if sublease_data else property_data['owner_id']
    )

    # Auto-confirm for vacation rentals only. Sublease bookings now require
    # the sublessor to accept/deny just like long-term/short-term bookings —
    # the renter sends a request, the sublessor (the lister of the sublease)
    # gets a "booking_request" notification and confirms it from their dashboard.
    is_instant_confirm = property_data.get('rental_type') == 'vacation' and sublease_data is None
    if is_instant_confirm:
        booking_doc['status'] = 'confirmed'
        listing_title = property_data['title']
        notification_message = f"Your booking for {listing_title} is confirmed!"
        notification_type = "booking_confirmed"
        # Notify renter of confirmation
        renter_notification = {
            "id": str(uuid.uuid4()),
            "user_id": payload['user_id'],
            "type": notification_type,
            "property_id": booking_data.property_id,
            "booking_id": booking_id,
            "message": notification_message,
            "read": False,
            "created_at": datetime.now(UTC).isoformat()
        }
        await db.notifications.insert_one(renter_notification)
    else:
        booking_doc['status'] = 'pending'
        listing_title = (
            sublease_data.get('title') if sublease_data else property_data['title']
        )
        notification_message = f"New booking request for {listing_title}"
        notification_type = "booking_request"

    booking_doc['created_at'] = datetime.now(UTC).isoformat()
    await db.bookings.insert_one(booking_doc)

    # Notify the sublessor (sublease) or property owner (regular) of the new booking
    target_user_id = booking_doc['owner_id']
    target_listing_title = (
        sublease_data.get('title') if sublease_data else property_data['title']
    )
    owner_notification = {
        "id": str(uuid.uuid4()),
        "user_id": target_user_id,
        "type": notification_type,
        "property_id": booking_data.property_id,
        "booking_id": booking_id,
        "message": (
            notification_message
            if booking_doc['status'] == 'pending'
            else f"New booking for {target_listing_title}"
        ),
        "read": False,
        "created_at": datetime.now(UTC).isoformat()
    }
    await db.notifications.insert_one(owner_notification)

    # --- Send transactional emails via Postmark (fire-and-forget) ---
    try:
        renter = await db.users.find_one({"id": payload['user_id']}, {"_id": 0, "email": 1, "name": 1})
        owner = await db.users.find_one({"id": target_user_id}, {"_id": 0, "email": 1, "name": 1})

        # Use sublease's currency/price/title when this is a sublease booking
        currency = (
            sublease_data.get('currency', 'ILS') if sublease_data
            else property_data.get('currency', 'ILS')
        )
        listing_title = target_listing_title
        listing_location = (
            sublease_data.get('area', '') if sublease_data
            else property_data.get('location', property_data.get('area', ''))
        )

        # Compute total
        total_price: float | None = None
        try:
            start = datetime.fromisoformat(booking_data.start_date.replace('Z', ''))
            end = datetime.fromisoformat(booking_data.end_date.replace('Z', ''))
            nights = max(1, (end - start).days)
        except Exception:
            nights = 1
        if sublease_data:
            if sublease_data.get('price_type') == 'per_night':
                total_price = float(sublease_data.get('price', 0)) * nights
            else:
                # Flat rate — one total
                total_price = float(sublease_data.get('price', 0))
        elif property_data.get('rental_type') == 'vacation' and property_data.get('nightly_price'):
            total_price = float(property_data['nightly_price']) * nights

        if renter and renter.get('email'):
            asyncio.create_task(send_booking_confirmation_email(
                to_email=renter['email'],
                guest_name=renter.get('name', ''),
                property_title=listing_title,
                property_location=listing_location,
                check_in=booking_data.start_date,
                check_out=booking_data.end_date,
                total_price=total_price,
                currency=currency,
                booking_id=booking_id,
                status=booking_doc['status'],
            ))

        if owner and owner.get('email'):
            asyncio.create_task(send_booking_notification_email(
                to_email=owner['email'],
                owner_name=owner.get('name', ''),
                guest_name=(renter or {}).get('name', 'A guest'),
                guest_email=(renter or {}).get('email', ''),
                property_title=listing_title,
                property_location=listing_location,
                check_in=booking_data.start_date,
                check_out=booking_data.end_date,
                total_price=total_price,
                currency=currency,
                booking_id=booking_id,
                is_pending=(booking_doc['status'] == 'pending'),
            ))
    except Exception as e:
        logger.warning(f"Failed to queue booking emails for booking {booking_id}: {e}")

    return {"id": booking_id, "status": booking_doc['status'], "message": "Booking confirmed!" if booking_doc['status'] == 'confirmed' else "Booking request sent successfully"}


@api_router.get("/bookings", response_model=list[BookingOut])
async def get_bookings(payload: dict = Depends(verify_token)) -> list[dict]:
    query: dict = {}
    if payload['role'] == 'renter':
        # Renters see bookings where they are the guest OR where they're
        # the sublessor (owner_id on a sublease booking points to them).
        query['$or'] = [
            {'renter_id': payload['user_id']},
            {'owner_id': payload['user_id']},
        ]
    elif payload['role'] == 'owner' or payload['role'] == 'manager':
        query['owner_id'] = payload['user_id']
    
    bookings = await db.bookings.find(query, {"_id": 0}).to_list(1000)
    
    # Enrich bookings with property details (or sublease details when the
    # booking was for a sublease — sublessors should see the sublease title
    # in their dashboard, not the underlying property's).
    for booking in bookings:
        if booking.get('sublease_id'):
            sub = await db.subleases.find_one(
                {"id": booking['sublease_id']},
                {"_id": 0, "title": 1, "area": 1},
            )
            if sub:
                booking['property_title'] = sub.get('title', 'Sublease')
                booking['property_location'] = sub.get('area', '')
                booking['property_rental_type'] = 'sublease'
                continue

        property_data = await db.properties.find_one(
            {"id": booking['property_id']},
            {"_id": 0, "title": 1, "location": 1, "rental_type": 1},
        )
        if property_data:
            booking['property_title'] = property_data.get('title', 'Unknown Property')
            booking['property_location'] = property_data.get('location', '')
            booking['property_rental_type'] = property_data.get('rental_type', '')
    
    return bookings

# Booking Cancellation Endpoints


@api_router.post("/bookings/{booking_id}/accept", response_model=BookingAcceptResponse)
async def accept_booking(booking_id: str, payload: dict = Depends(verify_token)) -> dict:
    """Owner/Manager accepts a pending booking"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Authorization: the booking's "owner" (listing owner OR sublessor) accepts.
    if booking['owner_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if booking is pending
    if booking['status'] != 'pending':
        raise HTTPException(status_code=400, detail="Only pending bookings can be accepted")
    
    # Get property details
    property_data = await db.properties.find_one({"id": booking['property_id']}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    # Update booking to confirmed
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": "confirmed",
            "confirmed_at": datetime.now(UTC).isoformat()
        }}
    )

    # Send acceptance email to the renter (Postmark, fire-and-forget)
    try:
        renter = await db.users.find_one({"id": booking['renter_id']}, {"_id": 0, "email": 1, "name": 1})
        if renter and renter.get('email'):
            asyncio.create_task(send_booking_confirmation_email(
                to_email=renter['email'],
                guest_name=renter.get('name', ''),
                property_title=property_data.get('title', 'your rental'),
                property_location=property_data.get('location', property_data.get('area', '')),
                check_in=booking.get('start_date', ''),
                check_out=booking.get('end_date', ''),
                total_price=None,
                currency=property_data.get('currency', 'ILS'),
                booking_id=booking_id,
                status='confirmed',
            ))
    except Exception as e:
        logger.warning(f"Failed to queue acceptance email for booking {booking_id}: {e}")
    
    # Check if property has a contract (check both contract_path and contract_url)
    if property_data.get('contract_path') or property_data.get('contract_url'):
        # Create a contract signing request for the renter
        contract_sign_token = str(uuid.uuid4())
        
        # Store contract signing info in booking
        await db.bookings.update_one(
            {"id": booking_id},
            {"$set": {
                "contract_sign_token": contract_sign_token,
                "contract_sent_at": datetime.now(UTC).isoformat(),
                "contract_signed": False
            }}
        )
        
        # Notify renter to sign the contract
        renter_notification = {
            "id": str(uuid.uuid4()),
            "user_id": booking['renter_id'],
            "type": "contract_pending",
            "booking_id": booking_id,
            "property_id": booking['property_id'],
            "message": f"Your booking for {property_data.get('title', 'the property')} was accepted! Please sign the rental contract to complete your booking.",
            "read": False,
            "created_at": datetime.now(UTC).isoformat()
        }
        await db.notifications.insert_one(renter_notification)
        
        # Notify owner that contract was sent
        owner_notification = {
            "id": str(uuid.uuid4()),
            "user_id": booking['owner_id'],
            "type": "contract_sent",
            "booking_id": booking_id,
            "property_id": booking['property_id'],
            "message": f"The rental contract for {property_data.get('title', 'your property')} has been automatically sent to the renter for signing.",
            "read": False,
            "created_at": datetime.now(UTC).isoformat()
        }
        await db.notifications.insert_one(owner_notification)
        
        return {
            "message": "Booking accepted and contract sent to renter for signing",
            "contract_sent": True
        }
    else:
        # No contract - just notify renter of acceptance
        renter_notification = {
            "id": str(uuid.uuid4()),
            "user_id": booking['renter_id'],
            "type": "booking_confirmed",
            "booking_id": booking_id,
            "property_id": booking['property_id'],
            "message": f"Your booking request for {property_data.get('title', 'the property')} has been accepted!",
            "read": False,
            "created_at": datetime.now(UTC).isoformat()
        }
        await db.notifications.insert_one(renter_notification)
        
        return {
            "message": "Booking accepted successfully",
            "contract_sent": False
        }


@api_router.post("/bookings/{booking_id}/cancel", response_model=MessageResponse)
async def cancel_booking(booking_id: str, reason: str = Body(..., embed=True), payload: dict = Depends(verify_token)) -> dict:
    """Owner/Manager direct cancellation"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Authorization: the user identified by ``booking.owner_id`` may cancel —
    # this is the listing owner/manager for regular bookings, OR the sublessor
    # for sublease bookings (we re-write owner_id to the sublessor's id when
    # creating sublease bookings so they own the calendar).
    if booking['owner_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update booking
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_by": payload['user_id'],
            "cancelled_at": datetime.now(UTC).isoformat(),
            "cancellation_reason": reason
        }}
    )
    
    # The lister (owner or sublessor) is cancelling — notify the renter.
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": booking['renter_id'],
        "type": "booking_cancelled",
        "booking_id": booking_id,
        "message": f"Your booking has been cancelled by the lister. Reason: {reason}",
        "read": False,
        "created_at": datetime.now(UTC).isoformat()
    }
    await db.notifications.insert_one(notification)

    # Fire saved-search alerts — the freed-up dates might match pending alerts
    try:
        asyncio.create_task(match_property_against_searches(
            db, booking['property_id'], reason="booking_freed", send_email_fn=send_email,
        ))
    except Exception as e:
        logger.warning(f"saved-search trigger failed (cancel): {e}")

    return {"message": "Booking cancelled successfully"}


@api_router.post("/bookings/{booking_id}/request-cancel", response_model=MessageResponse)
async def request_cancel_booking(booking_id: str, reason: str = Body(..., embed=True), payload: dict = Depends(verify_token)) -> dict:
    """Renter requests cancellation"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Verify user is the renter
    if booking['renter_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Save previous status before changing
    previous_status = booking.get('status', 'confirmed')
    
    # Update booking
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": "cancellation_requested",
            "previous_status": previous_status,
            "cancellation_reason": reason,
            "cancellation_requested_at": datetime.now(UTC).isoformat()
        }}
    )
    
    # Notify owner
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": booking['owner_id'],
        "type": "cancellation_request",
        "booking_id": booking_id,
        "message": f"Renter has requested to cancel their booking. Reason: {reason}",
        "read": False,
        "created_at": datetime.now(UTC).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Cancellation request submitted"}


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
    """Drop an in-app notification for the owner about the signed contract."""
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


@api_router.post("/bookings/{booking_id}/approve-cancel", response_model=MessageResponse)
async def approve_cancel_request(booking_id: str, payload: dict = Depends(verify_token)) -> dict:
    """Owner approves cancellation request"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Authorization: the booking's "owner" (listing owner OR sublessor) approves.
    if booking['owner_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if booking.get('status') != 'cancellation_requested':
        raise HTTPException(status_code=400, detail="No cancellation request pending")
    
    # Update booking
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_by": payload['user_id'],
            "cancelled_at": datetime.now(UTC).isoformat()
        }}
    )
    
    # Notify renter
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": booking['renter_id'],
        "type": "cancellation_approved",
        "booking_id": booking_id,
        "message": "Your cancellation request has been approved",
        "read": False,
        "created_at": datetime.now(UTC).isoformat()
    }
    await db.notifications.insert_one(notification)

    # Fire saved-search alerts — dates freed up
    try:
        asyncio.create_task(match_property_against_searches(
            db, booking['property_id'], reason="booking_freed", send_email_fn=send_email,
        ))
    except Exception as e:
        logger.warning(f"saved-search trigger failed (approve-cancel): {e}")

    return {"message": "Cancellation approved"}


@api_router.post("/bookings/{booking_id}/deny-cancel", response_model=MessageResponse)
async def deny_cancel_request(booking_id: str, denial_reason: str = Body(..., embed=True), payload: dict = Depends(verify_token)) -> dict:
    """Owner denies cancellation request"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Authorization: the booking's "owner" (listing owner OR sublessor) denies.
    if booking['owner_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if booking.get('status') != 'cancellation_requested':
        raise HTTPException(status_code=400, detail="No cancellation request pending")
    
    # Revert to previous status (confirmed or pending)
    previous_status = booking.get('previous_status', 'confirmed')
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": previous_status,
            "cancellation_denied": True,
            "cancellation_denial_reason": denial_reason,
            "cancellation_denied_at": datetime.now(UTC).isoformat()
        },
         "$unset": {"cancellation_requested_at": ""}
        }
    )
    
    # Notify renter
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": booking['renter_id'],
        "type": "cancellation_denied",
        "booking_id": booking_id,
        "message": f"Your cancellation request has been denied. Reason: {denial_reason}",
        "read": False,
        "created_at": datetime.now(UTC).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Cancellation request denied"}


# --- Subleases ---


@api_router.post("/bookings/{booking_id}/translate-contract", response_model=BookingTranslationResponse)
async def translate_booking_contract(booking_id: str, body: dict = Body(default={}), payload: dict = Depends(verify_token)) -> dict:
    """Translate the property contract associated with a booking.

    Designed for RENTERS who receive a contract in a language they don't read.
    The translation is cached on the booking so repeat calls are free.
    Request body: { "direction": "he-en" | "en-he" }  (default "he-en")
    """
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    # Renter (signing party) or the booking owner can request a translation
    if booking['renter_id'] != payload['user_id'] and booking['owner_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")

    direction = (body.get('direction') or 'he-en').lower()

    # Return cached translation if direction matches
    if booking.get('contract_translated_text') and booking.get('contract_translation_direction') == direction:
        return {
            "translated_text": booking['contract_translated_text'],
            "direction": direction,
            "status": "completed",
            "cached": True,
        }

    property_data = await db.properties.find_one({"id": booking['property_id']}, {"_id": 0})
    if not property_data or not property_data.get('contract_url'):
        raise HTTPException(status_code=404, detail="No contract available for this booking")

    contract_filename = property_data['contract_url'].split('/')[-1]
    contract_path = ROOT_DIR / "uploads" / contract_filename
    if not contract_path.exists():
        raise HTTPException(status_code=404, detail="Contract file not found on server")

    ext = contract_path.suffix.lower()
    if ext == '.pdf':
        text = extract_text_from_pdf(str(contract_path))
    elif ext in ('.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'):
        text = extract_text_from_image(str(contract_path))
    else:
        raise HTTPException(status_code=400, detail="Unsupported contract format")

    if not text or len(text.strip()) < 10:
        raise HTTPException(status_code=400, detail="Could not extract readable text from the contract. It may be a low-quality scan.")

    try:
        translated = await _translate_text(text, direction)
    except Exception as e:
        logger.error(f"Booking contract translation failed for {booking_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")

    # Cache on booking to avoid repeated LLM calls
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "contract_original_text": text,
            "contract_translated_text": translated,
            "contract_translation_direction": direction,
            "contract_translated_at": datetime.now(UTC).isoformat(),
        }}
    )

    return {
        "translated_text": translated,
        "original_text": text,
        "direction": direction,
        "status": "completed",
        "cached": False,
    }
