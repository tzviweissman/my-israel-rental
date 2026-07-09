"""Booking cancellation flow — direct cancel (owner or admin) plus
the two-step renter cancellation request / owner approve-or-deny path.

Extracted from ``bookings.py`` in the 2026-07 refactor.
"""
import asyncio
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Body, Depends, HTTPException

from models_response import MessageResponse
from routes.deps import db, logger, verify_token
from utils.email import send_email
from utils.saved_search import match_property_against_searches

router = APIRouter()
api_router = router


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


