"""Managing your businesses (spec M8).

List, add, edit, deactivate. This is the surface that makes M1–M3 mean
something: until a person can create a SECOND business, the model change
is invisible.

Two rules carried over from the earlier steps, both deliberate:

  * `owner_user_id` is who owns a business, and `provider_user_id` is
    still what authorises a gig. Nothing here touches gig authorisation.
  * Deactivating is not deleting. A business that goes quiet hides its
    gigs and keeps its reviews, because reviews are the one thing a
    person cannot recreate and the one thing a rival would most like
    them to lose.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from routes.deps import db, verify_token
from utils.businesses import (
    MAX_BUSINESSES_PER_USER,
    new_business_doc,
    unique_slug,
)

router = APIRouter(prefix="/marketplace", tags=["marketplace"])


class BusinessIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    description: str = Field("", max_length=2000)
    categories: list[str] = Field(default_factory=list)
    areas: list[str] = Field(default_factory=list)
    logo_url: Optional[str] = None


class BusinessPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=80)
    description: Optional[str] = Field(None, max_length=2000)
    categories: Optional[list[str]] = None
    areas: Optional[list[str]] = None
    logo_url: Optional[str] = None
    active: Optional[bool] = None


def _public(doc: dict[str, Any], gig_count: int = 0) -> dict[str, Any]:
    return {
        "id": doc["_id"],
        "name": doc.get("name") or "",
        "name_he": doc.get("name_he"),
        "slug": doc.get("slug"),
        "description": doc.get("description") or "",
        "logo_url": doc.get("logo_url"),
        "categories": doc.get("categories") or [],
        "areas": doc.get("areas") or [],
        "verified": bool(doc.get("verified")),
        "active": doc.get("active", True),
        "created_at": doc.get("created_at"),
        # Shown next to each business so "deactivate" is an informed
        # decision rather than a guess about what it will hide.
        "gig_count": gig_count,
    }


async def _owned(business_id: str, user: dict[str, Any]) -> dict[str, Any]:
    biz = await db.businesses.find_one({"_id": business_id})
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    if biz.get("owner_user_id") != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not your business")
    return biz


@router.get("/businesses")
async def my_businesses(user=Depends(verify_token)):
    """Every business this person owns, active or not.

    Deactivated ones are INCLUDED: they are hidden from the public, not
    from their owner, who needs to see them to switch them back on.
    """
    docs = [b async for b in db.businesses.find({"owner_user_id": user["user_id"]})]
    counts = {}
    for b in docs:
        counts[b["_id"]] = await db.marketplace_gigs.count_documents({"business_id": b["_id"]})
    docs.sort(key=lambda b: (not b.get("active", True), b.get("created_at") or ""))
    return [_public(b, counts.get(b["_id"], 0)) for b in docs]


@router.post("/businesses")
async def create_business(payload: BusinessIn, user=Depends(verify_token)):
    uid = user["user_id"]
    # The cap is per the spec: enough for a real person with several
    # trades, few enough that the categories cannot be papered with
    # near-identical shells. Counts ACTIVE ones only, so deactivating an
    # old business frees the slot rather than permanently spending it.
    active_count = await db.businesses.count_documents({"owner_user_id": uid, "active": True})
    if active_count >= MAX_BUSINESSES_PER_USER:
        raise HTTPException(
            status_code=400,
            detail=f"You can have up to {MAX_BUSINESSES_PER_USER} active businesses.",
        )

    name = payload.name.strip()
    # Same name twice is almost always a double-submit or a mistake, and
    # two identical entries in a switcher are indistinguishable.
    #
    # Checked across ALL of this person's businesses, hidden ones included:
    # scoping it to active let someone hide "Cohen Movers" and create a
    # second "Cohen Movers", which then appear as two identical rows in the
    # list with no way to tell which is which. Seen in a screenshot of this
    # very screen.
    if await db.businesses.find_one({"owner_user_id": uid, "name": name}):
        raise HTTPException(status_code=400, detail="You already have a business with that name.")

    doc = new_business_doc(
        uid,
        name,
        slug=await unique_slug(name),
        description=payload.description.strip(),
        categories=payload.categories,
        areas=payload.areas,
    )
    if payload.logo_url:
        doc["logo_url"] = payload.logo_url
    await db.businesses.insert_one(doc)
    return _public(doc, 0)


@router.patch("/businesses/{business_id}")
async def update_business(business_id: str, payload: BusinessPatch, user=Depends(verify_token)):
    biz = await _owned(business_id, user)
    update: dict[str, Any] = {}

    for field in ("description", "logo_url", "categories", "areas"):
        value = getattr(payload, field)
        if value is not None:
            update[field] = value.strip() if isinstance(value, str) else value

    if payload.name is not None:
        name = payload.name.strip()
        clash = await db.businesses.find_one(
            {"owner_user_id": biz["owner_user_id"], "name": name, "_id": {"$ne": business_id}},
        )
        if clash:
            raise HTTPException(status_code=400, detail="You already have a business with that name.")
        update["name"] = name
        # The SLUG DOES NOT FOLLOW THE NAME. /business/{slug} is public and
        # may already be shared or printed on a QR; renaming the business
        # must not break a link that exists in the world. Same rule as the
        # short links.
        #
        # The Hebrew name is cleared so the translation pipeline refills it
        # for the new name rather than leaving the old one, which would
        # show a Hebrew reader the previous business name indefinitely.
        update["name_he"] = None

    if payload.active is not None:
        update["active"] = bool(payload.active)
        if payload.active:
            active_count = await db.businesses.count_documents(
                {"owner_user_id": biz["owner_user_id"], "active": True, "_id": {"$ne": business_id}},
            )
            if active_count >= MAX_BUSINESSES_PER_USER:
                raise HTTPException(
                    status_code=400,
                    detail=f"You can have up to {MAX_BUSINESSES_PER_USER} active businesses.",
                )

    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")

    update["updated_at"] = datetime.now(UTC).isoformat()
    await db.businesses.update_one({"_id": business_id}, {"$set": update})
    fresh = await db.businesses.find_one({"_id": business_id})
    count = await db.marketplace_gigs.count_documents({"business_id": business_id})
    return _public(fresh, count)


@router.get("/businesses/{business_id}/listings")
async def business_listings(business_id: str, user=Depends(verify_token)):
    """What deactivating this business would hide — asked before doing it."""
    await _owned(business_id, user)
    gigs = [
        {"id": g["_id"], "title": g.get("title"), "status": g.get("status")}
        async for g in db.marketplace_gigs.find(
            {"business_id": business_id}, {"title": 1, "status": 1},
        )
    ]
    return {"count": len(gigs), "listings": gigs}
