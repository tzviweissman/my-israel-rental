"""Auto-extracted from server.py during the 2026-04 refactor."""
import asyncio
import logging
import uuid
from datetime import UTC, datetime, timedelta
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
    property_data, sublease_data = await _load_property_and_sublease(booking_data)
    _assert_within_availability_window(booking_data, property_data, sublease_data)
    await _assert_no_booking_overlap(booking_data)

    booking_doc = _build_booking_doc(
        booking_data=booking_data,
        property_data=property_data,
        sublease_data=sublease_data,
        renter_id=payload['user_id'],
    )
    await db.bookings.insert_one(booking_doc)

    await _send_booking_notifications(
        booking_doc=booking_doc,
        booking_data=booking_data,
        property_data=property_data,
        sublease_data=sublease_data,
    )

    _queue_booking_emails(
        booking_doc=booking_doc,
        booking_data=booking_data,
        property_data=property_data,
        sublease_data=sublease_data,
    )

    return {
        "id": booking_doc['id'],
        "status": booking_doc['status'],
        "message": (
            "Booking confirmed!" if booking_doc['status'] == 'confirmed'
            else "Booking request sent successfully"
        ),
    }


# ---- create_booking helpers ----------------------------------------------

async def _load_property_and_sublease(
    booking_data: BookingCreate,
) -> tuple[dict, dict | None]:
    """Look up the target property and (if applicable) the sublease.
    For sublease bookings the property still loads, but downstream pricing
    + routing prefers the sublease's data over the property's."""
    property_data = await db.properties.find_one(
        {"id": booking_data.property_id}, {"_id": 0},
    )
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    sublease_data: dict | None = None
    if booking_data.sublease_id:
        sublease_data = await db.subleases.find_one(
            {"id": booking_data.sublease_id}, {"_id": 0},
        )
        if not sublease_data:
            raise HTTPException(status_code=404, detail="Sublease not found")
        if not sublease_data.get("active", True):
            raise HTTPException(
                status_code=400, detail="This sublease is no longer active",
            )
    return property_data, sublease_data


def _assert_within_availability_window(
    booking_data: BookingCreate,
    property_data: dict,
    sublease_data: dict | None,
) -> None:
    """Reject bookings that fall outside the lister's availability window.

    Two windows can apply:
      • ``property.available_from`` / ``property.available_to`` — the owner
        explicitly capped their listing's availability (e.g. "I'm only
        renting for one week while I travel"). Both ends inclusive.
      • ``sublease.available_from`` / ``sublease.available_to`` — the
        sublessor's stricter window for that specific sublease. Sublease
        bounds override the property's own window because the sublessor
        is the de-facto owner during that period.

    Past dates are NOT validated here — the calendar UI hides them and the
    overlap check would reject any meaningfully-conflicting historical
    booking anyway.
    """
    # Sublease window wins when the booking is sublease-scoped.
    if sublease_data:
        sub_from = sublease_data.get("available_from")
        sub_to = sublease_data.get("available_to")
        if sub_from and booking_data.start_date < sub_from:
            raise HTTPException(
                status_code=400,
                detail=f"This sublease is only available from {sub_from} onwards.",
            )
        if sub_to and booking_data.end_date > sub_to:
            raise HTTPException(
                status_code=400,
                detail=f"This sublease is only available until {sub_to}.",
            )
        return  # sublease window fully governs sublease bookings

    avail_from = property_data.get("available_from")
    avail_to = property_data.get("available_to")
    if avail_from and booking_data.start_date < avail_from:
        raise HTTPException(
            status_code=400,
            detail=f"This property is only available from {avail_from} onwards.",
        )
    if avail_to and booking_data.end_date > avail_to:
        raise HTTPException(
            status_code=400,
            detail=(
                f"This property is only available until {avail_to}. "
                "Please pick checkout dates within the window."
            ),
        )


async def _assert_no_booking_overlap(booking_data: BookingCreate) -> None:
    """Reject overlapping bookings up front so we never end up with two
    confirmed/pending bookings on the same property for the same dates.
    Same overlap rule used by /properties search: start < new_end AND end > new_start.
    For SUBLEASE bookings, we deliberately scope the overlap check to OTHER
    bookings on the SAME sublease — the sublessor's own underlying long-term
    booking covers the entire sublease window, so a global property-level
    check would always reject (defeating the whole sublease feature)."""
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


def _build_booking_doc(
    *,
    booking_data: BookingCreate,
    property_data: dict,
    sublease_data: dict | None,
    renter_id: str,
) -> dict:
    """Assemble the booking document with id, owner routing, and the
    auto-confirm/pending status decision baked in.
    Auto-confirm only for vacation rentals (and never for sublease bookings,
    which always require sublessor accept/deny)."""
    is_instant_confirm = (
        property_data.get('rental_type') == 'vacation' and sublease_data is None
    )
    booking_doc = booking_data.model_dump()
    booking_doc.update({
        'id': str(uuid.uuid4()),
        'renter_id': renter_id,
        # Route owner_id: sublessor for sublease bookings, property owner otherwise
        'owner_id': (
            sublease_data['subleasor_id'] if sublease_data
            else property_data['owner_id']
        ),
        'status': 'confirmed' if is_instant_confirm else 'pending',
        'created_at': datetime.now(UTC).isoformat(),
    })
    return booking_doc


async def _send_booking_notifications(
    *,
    booking_doc: dict,
    booking_data: BookingCreate,
    property_data: dict,
    sublease_data: dict | None,
) -> None:
    """In-app notifications: confirmation to renter for instant-confirm
    bookings, plus a notification to the sublessor/owner in every case."""
    listing_title = (
        sublease_data.get('title') if sublease_data else property_data['title']
    )
    is_confirmed = booking_doc['status'] == 'confirmed'

    if is_confirmed:
        # Notify renter of the auto-confirmed booking
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": booking_doc['renter_id'],
            "type": "booking_confirmed",
            "property_id": booking_data.property_id,
            "booking_id": booking_doc['id'],
            "message": f"Your booking for {listing_title} is confirmed!",
            "read": False,
            "created_at": datetime.now(UTC).isoformat(),
        })

    # Always notify the sublessor (sublease) or property owner (regular)
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": booking_doc['owner_id'],
        "type": "booking_confirmed" if is_confirmed else "booking_request",
        "property_id": booking_data.property_id,
        "booking_id": booking_doc['id'],
        "message": (
            f"New booking for {listing_title}" if is_confirmed
            else f"New booking request for {listing_title}"
        ),
        "read": False,
        "created_at": datetime.now(UTC).isoformat(),
    })


async def _compute_booking_total(
    booking_data: BookingCreate,
    property_data: dict,
    sublease_data: dict | None,
) -> float | None:
    """Best-effort total for the confirmation email. Sublease pricing wins
    when set; otherwise vacation rentals get nightly × N — with per-date
    Smart Pricing overrides applied when present (the host can dynamically
    price specific nights via the Smart Pricing engine; each applied
    override REPLACES the base nightly rate for that night). Long-term/
    short-term rentals don't expose a single total, so we leave it as
    None."""
    try:
        start = datetime.fromisoformat(booking_data.start_date.replace('Z', ''))
        end = datetime.fromisoformat(booking_data.end_date.replace('Z', ''))
        nights = max(1, (end - start).days)
    except Exception:
        nights = 1
        start = None
        end = None
    if sublease_data:
        price = float(sublease_data.get('price', 0))
        return price * nights if sublease_data.get('price_type') == 'per_night' else price
    if property_data.get('rental_type') == 'vacation' and property_data.get('nightly_price'):
        base = float(property_data['nightly_price'])
        # Layer in any applied Smart-Pricing overrides for the night window.
        if start is not None and end is not None:
            try:
                overrides = await db.nightly_price_overrides.find(
                    {
                        "property_id": property_data.get('id'),
                        "applied": True,
                        "date": {
                            "$gte": start.date().isoformat(),
                            "$lt": end.date().isoformat(),
                        },
                    },
                    {"_id": 0, "date": 1, "price": 1},
                ).to_list(length=400)
            except Exception:  # noqa: BLE001
                overrides = []
            override_map = {o["date"]: float(o.get("price") or base) for o in overrides}
            total = 0.0
            d = start.date()
            for _ in range(nights):
                total += override_map.get(d.isoformat(), base)
                d += timedelta(days=1)
            return total
        return base * nights
    return None


def _queue_booking_emails(
    *,
    booking_doc: dict,
    booking_data: BookingCreate,
    property_data: dict,
    sublease_data: dict | None,
) -> None:
    """Fire-and-forget Postmark dispatch. Wrapped in try/except so an email
    outage never 500s a successful booking."""
    try:
        async def _send() -> None:
            renter = await db.users.find_one(
                {"id": booking_doc['renter_id']}, {"_id": 0, "email": 1, "name": 1},
            )
            owner = await db.users.find_one(
                {"id": booking_doc['owner_id']}, {"_id": 0, "email": 1, "name": 1},
            )
            currency = (
                sublease_data.get('currency', 'ILS') if sublease_data
                else property_data.get('currency', 'ILS')
            )
            listing_title = (
                sublease_data.get('title') if sublease_data else property_data['title']
            )
            listing_location = (
                sublease_data.get('area', '') if sublease_data
                else property_data.get('location', property_data.get('area', ''))
            )
            total_price = await _compute_booking_total(booking_data, property_data, sublease_data)

            if renter and renter.get('email'):
                await send_booking_confirmation_email(
                    to_email=renter['email'],
                    guest_name=renter.get('name', ''),
                    property_title=listing_title,
                    property_location=listing_location,
                    check_in=booking_data.start_date,
                    check_out=booking_data.end_date,
                    total_price=total_price,
                    currency=currency,
                    booking_id=booking_doc['id'],
                    status=booking_doc['status'],
                )
            if owner and owner.get('email'):
                await send_booking_notification_email(
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
                    booking_id=booking_doc['id'],
                    is_pending=(booking_doc['status'] == 'pending'),
                )
        asyncio.create_task(_send())
    except Exception as e:
        logger.warning(f"Failed to queue booking emails for booking {booking_doc['id']}: {e}")


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
    """Owner/Manager accepts a pending booking.

    Composed pipeline:
      1. Authorize + load (booking, property).
      2. Flip status → confirmed.
      3. Queue acceptance email (fire-and-forget).
      4. If the property has a contract, attach a signing token + notify both
         parties. Otherwise just notify the renter of plain acceptance.
    """
    booking, property_data = await _load_and_authorize_pending(booking_id, payload["user_id"])

    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": "confirmed", "confirmed_at": datetime.now(UTC).isoformat()}},
    )

    _queue_acceptance_email(booking, booking_id, property_data)

    if property_data.get("contract_path") or property_data.get("contract_url"):
        await _attach_contract_signing(booking_id, booking, property_data)
        return {"message": "Booking accepted and contract sent to renter for signing", "contract_sent": True}

    await _notify_renter_accepted(booking, booking_id, property_data)
    return {"message": "Booking accepted successfully", "contract_sent": False}


async def _load_and_authorize_pending(
    booking_id: str, user_id: str
) -> tuple[dict, dict]:
    """Fetch the booking + its property, asserting owner-only + pending state.

    Returns ``(booking, property_data)``. Raises HTTPException on failure.
    """
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    # Authorization: the booking's "owner" (listing owner OR sublessor) accepts.
    if booking["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if booking["status"] != "pending":
        raise HTTPException(status_code=400, detail="Only pending bookings can be accepted")
    property_data = await db.properties.find_one({"id": booking["property_id"]}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    return booking, property_data


def _queue_acceptance_email(booking: dict, booking_id: str, property_data: dict) -> None:
    """Fire the Postmark confirmation email to the renter (non-blocking)."""
    try:
        renter_id = booking.get("renter_id")
        # Lazy fetch — wrap in a coroutine so we can fire-and-forget via create_task.
        async def _send() -> None:
            renter = await db.users.find_one(
                {"id": renter_id}, {"_id": 0, "email": 1, "name": 1}
            )
            if not renter or not renter.get("email"):
                return
            await send_booking_confirmation_email(
                to_email=renter["email"],
                guest_name=renter.get("name", ""),
                property_title=property_data.get("title", "your rental"),
                property_location=property_data.get("location", property_data.get("area", "")),
                check_in=booking.get("start_date", ""),
                check_out=booking.get("end_date", ""),
                total_price=None,
                currency=property_data.get("currency", "ILS"),
                booking_id=booking_id,
                status="confirmed",
            )
        asyncio.create_task(_send())
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Failed to queue acceptance email for booking {booking_id}: {e}")


async def _attach_contract_signing(
    booking_id: str, booking: dict, property_data: dict
) -> None:
    """Mint a signing token, save it on the booking, and notify both parties."""
    contract_sign_token = str(uuid.uuid4())
    await db.bookings.update_one(
        {"id": booking_id},
        {
            "$set": {
                "contract_sign_token": contract_sign_token,
                "contract_sent_at": datetime.now(UTC).isoformat(),
                "contract_signed": False,
            }
        },
    )
    title = property_data.get("title", "the property")
    await db.notifications.insert_many(
        [
            _notification(
                user_id=booking["renter_id"],
                type_="contract_pending",
                booking_id=booking_id,
                property_id=booking["property_id"],
                message=f"Your booking for {title} was accepted! Please sign the rental contract to complete your booking.",
            ),
            _notification(
                user_id=booking["owner_id"],
                type_="contract_sent",
                booking_id=booking_id,
                property_id=booking["property_id"],
                message=f"The rental contract for {title} has been automatically sent to the renter for signing.",
            ),
        ]
    )


async def _notify_renter_accepted(
    booking: dict, booking_id: str, property_data: dict
) -> None:
    """No-contract path: drop a single ``booking_confirmed`` notification."""
    await db.notifications.insert_one(
        _notification(
            user_id=booking["renter_id"],
            type_="booking_confirmed",
            booking_id=booking_id,
            property_id=booking["property_id"],
            message=f"Your booking request for {property_data.get('title', 'the property')} has been accepted!",
        )
    )


def _notification(
    *, user_id: str, type_: str, booking_id: str, property_id: str, message: str
) -> dict:
    """Build a unread-notification doc with shared boilerplate."""
    return {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": type_,
        "booking_id": booking_id,
        "property_id": property_id,
        "message": message,
        "read": False,
        "created_at": datetime.now(UTC).isoformat(),
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
