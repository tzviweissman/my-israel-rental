"""Deposits that hold an appointment (Tzvi, 16 Oct 2026, from Booksy and
Fresha's no-show protection).

A business sets an amount on an appointment listing (the listing editor,
"Who does it, booking again and deposit") and a line on how to pay it:
Bit, PayBox, a transfer. The site takes no payment, so the customer pays
the business directly; the booking page shows what is due and the
business's payment links, and the business ticks it off.

    due        asked for, not yet received
    paid       the business says it arrived
    kept       the customer did not come, so the business kept it
    to_return  the appointment was called off in time: give it back
    returned   the business says it went back
    waived     the business let it go (never paid, appointment went ahead)

The rule the customer is shown: cancel at least 24 hours before and the
deposit is returned. The business can always return it later anyway.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from routes.deps import db, verify_token

router = APIRouter(prefix="/marketplace", tags=["marketplace"])
IL = ZoneInfo("Asia/Jerusalem")
FREE_CANCEL_HOURS = 24


def _start(b: dict[str, Any]) -> datetime | None:
    try:
        return datetime.fromisoformat(f"{b['preferred_date']}T{b.get('time_slot') or '00:00'}").replace(tzinfo=IL)
    except (KeyError, TypeError, ValueError):
        return None


async def owed_back(b: dict[str, Any], *, by_business: bool) -> None:
    """The appointment is off. A paid deposit goes back if the business
    called it off, or the customer did with the notice the page promised."""
    dep = b.get("deposit") or {}
    if dep.get("status") != "paid":
        if dep.get("status") == "due":
            await db.marketplace_bookings.update_one({"_id": b["_id"]}, {"$set": {"deposit.status": "waived"}})
        return
    start = _start(b)
    in_time = by_business or (start is not None and start - datetime.now(IL) >= timedelta(hours=FREE_CANCEL_HOURS))
    if not in_time:
        return
    await db.marketplace_bookings.update_one({"_id": b["_id"]}, {"$set": {"deposit.status": "to_return"}})
    from .gigs import _notify
    await _notify(b.get("provider_user_id"), "deposit_to_return",
                  f"Return the ₪{dep.get('amount', 0):g} deposit to {b.get('guest_name') or 'the customer'}: the appointment on "
                  f"{b.get('preferred_date')} was called off in time.", b["_id"])


class DepositIn(BaseModel):
    status: Literal["paid", "kept", "returned", "waived", "due"]


@router.post("/bookings/{booking_id}/deposit")
async def set_deposit(booking_id: str, body: DepositIn, user=Depends(verify_token)):
    b = await db.marketplace_bookings.find_one({"_id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b.get("provider_user_id") != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not your booking")
    if not b.get("deposit"):
        raise HTTPException(status_code=400, detail="This booking has no deposit")
    update: dict[str, Any] = {"deposit.status": body.status, "deposit.updated_at": datetime.now(UTC).isoformat()}
    if body.status == "kept":
        # Kept means they did not come: the visit is over, and recorded so.
        update["no_show"] = True
        if b.get("status") == "accepted":
            update["status"] = "completed"
            update["completed_at"] = datetime.now(UTC).isoformat()
    await db.marketplace_bookings.update_one({"_id": booking_id}, {"$set": update})
    return {"ok": True, "deposit": {**b["deposit"], "status": body.status}}
