"""Admin "quick add property" endpoint — single-property shortcut
that skips the CSV preview step.

Extracted from ``admin_import.py`` in the 2026-07 refactor.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from routes.deps import db, verify_token
from utils.dedupe import find_duplicate

from .helpers import (
    _build_property_doc,
    _resolve_or_create_owner,
)

router = APIRouter()
api_router = router


class QuickAddPropertyRequest(BaseModel):
    """Single-property "quick add" request used by the admin Import tab.

    Differs from the bulk CSV flow in that:
      * Image / video URLs come from the frontend after the admin uploads
        the actual files via the existing Cloudinary signed-upload path
        (``uploadFilesFast``) — no CSV column needed.
      * Owner is auto-created from ``owner_email`` (with optional name /
        phone) if not already in the DB, and emailed a "set password"
        link, exactly like the bulk CSV flow.
      * Re-submissions with the same ``owner_email`` accumulate under
        the same owner account — perfect for "I have 5 listings from one
        landlord, add them one at a time" workflows.
    """
    owner_email: str
    owner_name: str | None = None
    owner_phone: str | None = None
    title: str
    area: str | None = None
    address: str | None = None
    description: str | None = None
    rental_type: str | None = "long-term"
    property_type: str | None = "apartment"
    bedrooms: int | None = None
    bathrooms: int | None = None
    floor: int | None = None
    square_meters: int | None = None
    monthly_price: float | None = None
    nightly_price: float | None = None
    currency: str | None = "ILS"
    available_from: str | None = None
    image_urls: list[str] = []
    video_urls: list[str] = []


@api_router.post("/admin/import/quick-add")
async def quick_add_property(
    req: QuickAddPropertyRequest, payload: dict = Depends(verify_token)
) -> dict:
    """Create one property under an auto-resolved owner account.

    Returns ``{owner: {id, email, was_created}, property: {id, title}}``
    so the frontend can show a friendly confirmation and offer to "Add
    another listing for this same owner" without re-typing the email.
    """
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    email = (req.owner_email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="owner_email is required")
    if not req.title or not req.title.strip():
        raise HTTPException(status_code=400, detail="title is required")

    try:
        owner_id, was_created = await _resolve_or_create_owner(
            email=email, name=req.owner_name, phone=req.owner_phone,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    # Reuse the same canonical-row → property doc builder so coercions /
    # defaults stay identical to the CSV path.
    remapped = {
        "title": req.title,
        "description": req.description or "",
        "area": req.area or "",
        "address": req.address or "",
        "rental_type": req.rental_type or "long-term",
        "property_type": req.property_type or "apartment",
        "bedrooms": req.bedrooms,
        "bathrooms": req.bathrooms,
        "floor": req.floor,
        "square_meters": req.square_meters,
        "monthly_price": req.monthly_price,
        "nightly_price": req.nightly_price,
        "currency": req.currency or "ILS",
        "available_from": req.available_from or "",
    }
    doc = _build_property_doc(remapped, owner_id)
    # Photos / videos arrive already-Cloudinary-hosted from the frontend
    # uploader, so no mirroring step is needed.
    doc["images"] = [u for u in req.image_urls if u and isinstance(u, str)]
    doc["videos"] = [u for u in req.video_urls if u and isinstance(u, str)]

    # Dedupe (same rule as bulk path) — skip if a collision exists.
    dup = await find_duplicate(
        db, owner_id=owner_id, address=doc["address"], rental_type=doc["rental_type"],
        bedrooms=doc.get("bedrooms"), floor=doc.get("floor"),
    )
    if dup:
        raise HTTPException(
            status_code=409,
            detail=(
                f"This owner already has a listing at the same address with "
                f"rental_type='{doc['rental_type']}' (title: \"{dup.get('title')}\"). "
                "Pick a different address or rental_type."
            ),
        )

    await db.properties.insert_one(doc)
    return {
        "owner": {"id": owner_id, "email": email, "was_created": was_created},
        "property": {"id": doc["id"], "title": doc["title"], "area": doc["area"]},
    }
