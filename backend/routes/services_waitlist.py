"""Services marketplace — waitlist endpoint.

The Services page on the renter side is a stub today: businesses can
register their interest in a paid monthly listing, but the actual
subscription billing + business-profile CRUD is a separate workstream.

This module exposes the minimal piece needed to capture demand from the
landing page so the user can reach out the moment full Services ships.
Each submission lands in ``db.services_waitlist`` and the platform
admin can pull the list straight out of Mongo when ready.

Anti-abuse:
  • Hard cap on submission size (Pydantic limits below).
  • Dedup by lowercase email — re-submitting the same email is a noop,
    not an error (keeps the UX friendly when a business owner fills the
    form twice from two devices).
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter
from pydantic import BaseModel, EmailStr, Field

from routes.deps import db, logger

router = APIRouter()
api_router = router


class WaitlistEntryIn(BaseModel):
    email: EmailStr
    business_name: str = Field(..., min_length=2, max_length=120)
    category: str | None = Field(default=None, max_length=80)


@api_router.post("/services/waitlist")
async def join_services_waitlist(payload: WaitlistEntryIn) -> dict:
    """Persist a business's interest in being featured. Idempotent on
    ``email`` so a repeat submission updates the latest details instead
    of creating a duplicate row."""
    doc = {
        "id": str(uuid.uuid4()),
        "email": payload.email.lower(),
        "business_name": payload.business_name.strip(),
        "category": (payload.category or "").strip() or None,
        "created_at": datetime.now(UTC).isoformat(),
    }
    existing = await db.services_waitlist.find_one(
        {"email": doc["email"]},
        {"_id": 0, "id": 1},
    )
    if existing:
        # Refresh the row with the latest business_name / category so the
        # user can correct a typo by re-submitting without ending up with
        # two conflicting entries.
        await db.services_waitlist.update_one(
            {"id": existing["id"]},
            {"$set": {
                "business_name": doc["business_name"],
                "category": doc["category"],
                "updated_at": datetime.now(UTC).isoformat(),
            }},
        )
        return {"ok": True, "deduped": True}
    await db.services_waitlist.insert_one(doc)
    logger.info(f"services_waitlist: new entry for {doc['email']} ({doc['business_name']})")
    return {"ok": True, "deduped": False}
