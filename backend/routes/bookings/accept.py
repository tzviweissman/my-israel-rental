"""Booking acceptance flow — owner clicks Accept on a pending
booking, contract is attached (if any), renter is notified.

Extracted from ``bookings.py`` in the 2026-07 refactor.
"""
import asyncio
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException

from models_response import BookingAcceptResponse
from routes.deps import db, logger, verify_token
from utils.email import send_booking_confirmation_email, send_email

router = APIRouter()
api_router = router


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


