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

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from routes.deps import db, optional_user, verify_token
from utils import view_tracking
from utils.businesses import (
    MAX_BUSINESSES_PER_USER,
    ensure_default_business,
    new_business_doc,
    unique_slug,
)

from .shared import (
    TOP_RATED_MIN_AVG,
    TOP_RATED_MIN_COUNT,
    _batch_rating_aggregate,
    _cheapest_tier_price,
    _clean_gig,
    _response_bucket,
)

router = APIRouter(prefix="/marketplace", tags=["marketplace"])


class Collection(BaseModel):
    """One owner-defined group of a business's own services (spec C1).

    Held on the business document rather than in its own collection: a
    group is meaningless away from the business that owns it, there are
    at most a handful, and this way reordering them is one write.

    `service_ids` is ORDERED and a service may appear in more than one
    group — a Shabbos package belongs under both "Shabbos" and "Packages"
    and forcing a single home would make the owner choose for no reason.
    Ids are not validated against the gig list here: a service deleted
    later would otherwise make the whole business un-saveable, so stale
    ids are simply ignored when the page is built.
    """
    id: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=80)
    name_he: Optional[str] = Field(None, max_length=80)
    description: Optional[str] = Field(None, max_length=200)
    service_ids: list[str] = Field(default_factory=list)


class KosherCert(BaseModel):
    """Certifying body, and optionally proof of it (spec C6).

    `body` is the only required part: a name with no scan still tells a
    customer more than nothing, and demanding a photo would stop most
    businesses filling it in at all.
    """
    body: str = Field(..., min_length=2, max_length=120)
    logo_url: Optional[str] = None
    certificate_url: Optional[str] = None


class BusinessIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    description: str = Field("", max_length=2000)
    categories: list[str] = Field(default_factory=list)
    areas: list[str] = Field(default_factory=list)
    logo_url: Optional[str] = None
    hours: Optional[str] = Field(None, max_length=200)
    languages: Optional[list[str]] = None
    founded_year: Optional[int] = Field(None, ge=1800, le=2100)
    delivery_note: Optional[str] = Field(None, max_length=300)
    lead_time: Optional[str] = Field(None, max_length=120)
    payment_note: Optional[str] = Field(None, max_length=200)
    kosher_certification: Optional[KosherCert] = None
    collections: Optional[list[Collection]] = None
    # C5 — capped at three by the MODEL, not by the UI. A page where
    # everything is featured features nothing, and a cap enforced only in
    # a form is a cap that a second client ignores.
    pinned_service_ids: Optional[list[str]] = Field(None, max_length=3)


class BusinessPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=80)
    description: Optional[str] = Field(None, max_length=2000)
    categories: Optional[list[str]] = None
    areas: Optional[list[str]] = None
    logo_url: Optional[str] = None
    active: Optional[bool] = None
    hours: Optional[str] = Field(None, max_length=200)
    languages: Optional[list[str]] = None
    founded_year: Optional[int] = Field(None, ge=1800, le=2100)
    delivery_note: Optional[str] = Field(None, max_length=300)
    lead_time: Optional[str] = Field(None, max_length=120)
    payment_note: Optional[str] = Field(None, max_length=200)
    kosher_certification: Optional[KosherCert] = None
    collections: Optional[list[Collection]] = None
    # C5 — capped at three by the MODEL, not by the UI. A page where
    # everything is featured features nothing, and a cap enforced only in
    # a form is a cap that a second client ignores.
    pinned_service_ids: Optional[list[str]] = Field(None, max_length=3)



def _public(doc: dict[str, Any], gig_count: int = 0, has_listing_photo: bool = False) -> dict[str, Any]:
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
        # B6 — the completeness prompt needs to know whether any listing
        # actually carries a photo. Counted on the server because the
        # dashboard list does not fetch the listings themselves.
        "has_listing_photo": bool(has_listing_photo),
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

    # Self-healing, and it matters more than it looks: listings are reached
    # THROUGH a business now, so someone who has listings but no business
    # record would find them unreachable — their own work, invisible to
    # them. That is the state of anyone whose listings predate the
    # businesses model.
    #
    # Rather than a bulk migration over the production database, each
    # person is repaired the moment they look, using the same idempotent
    # helper the gig-create path uses. No write happens for the vast
    # majority who already have one.
    if not docs:
        has_listings = await db.marketplace_gigs.count_documents(
            {"provider_user_id": user["user_id"]},
        )
        if has_listings:
            created = await ensure_default_business(user["user_id"])
            await db.marketplace_gigs.update_many(
                {
                    "provider_user_id": user["user_id"],
                    "$or": [{"business_id": {"$exists": False}}, {"business_id": None}],
                },
                {"$set": {"business_id": created["_id"]}},
            )
            docs = [created]
    counts = {}
    photos = {}
    for b in docs:
        counts[b["_id"]] = await db.marketplace_gigs.count_documents({"business_id": b["_id"]})
        # One matching document is enough — this is a yes/no, not a count.
        photos[b["_id"]] = bool(await db.marketplace_gigs.find_one(
            {"business_id": b["_id"], "gallery.0": {"$exists": True}}, {"_id": 1},
        ))
    docs.sort(key=lambda b: (not b.get("active", True), b.get("created_at") or ""))
    return [_public(b, counts.get(b["_id"], 0), photos.get(b["_id"], False)) for b in docs]


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

    # C6 fields. Keyed off model_fields_set rather than `is not None`,
    # which every field above uses: with that test an owner can SET a
    # value but never CLEAR one, because null reads as "not supplied".
    # Fine for a name, which must always exist; wrong for optional facts,
    # where deleting the line is the whole point of an edit form.
    provided = payload.model_fields_set
    if "pinned_service_ids" in provided:
        update["pinned_service_ids"] = (payload.pinned_service_ids or [])[:3]
    if "collections" in provided:
        update["collections"] = [c.model_dump() for c in (payload.collections or [])]
    for key in ("hours", "delivery_note", "lead_time", "payment_note",
                "founded_year", "kosher_certification"):
        if key in provided:
            value = getattr(payload, key)
            # Pydantic hands back a model for the nested cert; Mongo wants
            # a plain dict.
            if key == "kosher_certification" and value is not None:
                value = value.model_dump()
            update[key] = value
    if "languages" in provided:
        update["languages"] = payload.languages or []

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


# ---------------------------------------------------------------- M4 + M5


async def _resolve(slug_or_id: str) -> dict[str, Any] | None:
    """Find a business by slug OR id.

    Both, permanently. The spec allows either as the canonical form and
    the short-link table already points at /business/{id}, so accepting
    only one would have broken links that already exist. Slug is tried
    first because it is the pretty form people share.
    """
    return (
        await db.businesses.find_one({"slug": slug_or_id})
        or await db.businesses.find_one({"_id": slug_or_id})
    )


async def business_rating(business_id: str) -> dict[str, Any]:
    """Stars for a BUSINESS, aggregated over its own listings (spec M5).

    Never per person. One human may run a five-star bakery and a
    one-star moving company, and averaging those into a single number
    describes neither — it quietly punishes the good business and
    launders the bad one.
    """
    gig_ids = [
        g["_id"] async for g in db.marketplace_gigs.find({"business_id": business_id}, {"_id": 1})
    ]
    if not gig_ids:
        return {"rating_avg": None, "rating_count": 0}
    pipeline = [
        {"$match": {"gig_id": {"$in": gig_ids}}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
    ]
    async for row in db.marketplace_reviews.aggregate(pipeline):
        return {
            "rating_avg": round(row["avg"], 1) if row.get("avg") is not None else None,
            "rating_count": row.get("count", 0),
        }
    return {"rating_avg": None, "rating_count": 0}


# Contact fields that must never leave this endpoint (spec B1). The public
# business page is chat-only: a visitor talks to the business through the
# site, so no phone number or address reaches the browser at all.
#
# This is not cosmetic. Before B1 the endpoint served every gig field
# verbatim, which published each provider's WhatsApp number to anyone who
# fetched the URL unauthenticated — no login, no rate limit, trivially
# scrapeable across every business on the site.
_CONTACT_FIELDS = ("whatsapp", "contact_email", "contact_phone", "phone", "email")


def _public_listing(gig: dict[str, Any]) -> dict[str, Any]:
    """A gig as the public business page may see it: no contact details.

    ``contact_channels`` is pinned to in-platform rather than dropped,
    because the front end reads it to decide what to offer and an absent
    key would read as "no way to contact at all".
    """
    clean = dict(_clean_gig(dict(gig)))
    for field in _CONTACT_FIELDS:
        clean.pop(field, None)
    clean["contact_channels"] = ["in_platform"]
    return clean


@router.get("/business/{slug_or_id}")
async def public_business(
    slug_or_id: str, request: Request, viewer=Depends(optional_user),
):
    """The public page for one business (spec M4).

    A person with two businesses gets two of these. There is deliberately
    no public page for the PERSON: the thing a customer is choosing is a
    business, and merging them would put a plumber's reviews on a
    bakery.
    """
    biz = await _resolve(slug_or_id)
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    # A hidden business is hidden from the public, exactly like its
    # listings. Its owner still reaches it from the dashboard.
    if not biz.get("active", True):
        raise HTTPException(status_code=404, detail="Business not found")

    raw = [
        g async for g in db.marketplace_gigs.find(
            {"business_id": biz["_id"], "status": "published"},
        ).sort("created_at", -1)
    ]
    # A business with nothing published is not a page worth sending anyone
    # to (spec B8). It renders as a name, an empty "Services" heading and
    # "Nothing listed yet" - and, because the Message thread is addressed
    # through a listing, without any way to make contact either. So it is
    # not publicly linkable at all rather than linkable and useless.
    #
    # 404 and not an empty 200: the front end already has the "no longer
    # listed" state for a business that has gone, and this is the same
    # situation from a visitor's side. The owner still reaches it from
    # their dashboard, which reads a different endpoint.
    if not raw:
        raise HTTPException(status_code=404, detail="Business not found")

    # L2 — count the visit, and only here: all three 404s above mean nobody
    # saw a page, and counting them would credit a hidden or empty business
    # with traffic it never received. Fire-and-forget; `viewer` is optional
    # auth solely so the owner's own visits are skipped.
    view_tracking.spawn(view_tracking.record_view(
        view_tracking.ENTITY_BUSINESS, biz["_id"],
        owner_id=biz.get("owner_user_id"),
        viewer_id=(viewer or {}).get("user_id"),
        visitor=request.headers.get("X-Visitor-Id"),
    ))

    ratings = await _batch_rating_aggregate([g["_id"] for g in raw])
    for g in raw:
        agg = ratings.get(g["_id"], {"rating_avg": None, "rating_count": 0})
        g["rating_avg"] = agg["rating_avg"]
        g["rating_count"] = agg["rating_count"]
        g["cheapest_price"] = _cheapest_tier_price(g)
        g["is_top_rated"] = (
            agg["rating_avg"] is not None
            and agg["rating_avg"] >= TOP_RATED_MIN_AVG
            and agg["rating_count"] >= TOP_RATED_MIN_COUNT
        )

    rating = await business_rating(biz["_id"])
    return {
        "id": biz["_id"],
        "slug": biz.get("slug"),
        "name": biz.get("name") or "",
        "name_he": biz.get("name_he"),
        "description": biz.get("description") or "",
        "logo_url": biz.get("logo_url"),
        "categories": biz.get("categories") or [],
        "areas": biz.get("areas") or [],
        # M5 — verification belongs to the BUSINESS. Verifying that
        # someone owns an apartment says nothing about their trade
        # licence, so the user-level flag is not borrowed here.
        "verified": bool(biz.get("verified")),
        "verified_at": biz.get("verified_at"),
        "rating_avg": rating["rating_avg"],
        "rating_count": rating["rating_count"],
        "member_since": (biz.get("created_at") or "")[:4] or None,
        # Needed to address a chat thread at this business's owner. An
        # opaque id, not contact information — the whole point of B1 is
        # that a visitor reaches them THROUGH the site.
        "owner_user_id": biz.get("owner_user_id"),
        # B5 — how quickly they actually reply, from the rolling EMA the
        # marketplace already keeps. Reused rather than recomputed, so the
        # figure on this page cannot disagree with the badge on their
        # cards. None below MIN_RESPONSES_FOR_BADGE: a single lucky reply
        # is not a response time, and a claim we cannot stand behind is
        # worse than no claim.
        # C6 — passed through as stored. Absent fields stay absent; the
        # page renders a row only where there is something to say.
        "hours": biz.get("hours"),
        "languages": biz.get("languages") or [],
        "founded_year": biz.get("founded_year"),
        "delivery_note": biz.get("delivery_note"),
        "lead_time": biz.get("lead_time"),
        "payment_note": biz.get("payment_note"),
        "kosher_certification": biz.get("kosher_certification"),
        # C1 — raw groups. Which services actually land in which group,
        # and what happens to the ones in none, is decided in one place
        # on the client (utils/businessCollections.js) so the rules cannot
        # drift between here and there.
        "collections": biz.get("collections") or [],
        "pinned_service_ids": (biz.get("pinned_service_ids") or [])[:3],
        "response_bucket": _response_bucket(
            await db.marketplace_providers.find_one({"user_id": biz.get("owner_user_id")}) or {}
        ),
        "listings": [_public_listing(g) for g in raw],
    }


@router.get("/providers/{user_id}/default-business")
async def provider_default_business(user_id: str):
    """Where /providers/{user_id} should send someone (spec M4).

    The old provider URL is linked from existing gigs and may be indexed,
    so it must keep working — but there is no person page any more, so it
    resolves to that person's first active business and the front end
    redirects. Returns 404 when they have none, which the caller renders
    as "no longer listed" rather than a blank page.
    """
    biz = await db.businesses.find_one({"owner_user_id": user_id, "active": True})
    if not biz:
        raise HTTPException(status_code=404, detail="No business for this provider")
    return {"id": biz["_id"], "slug": biz.get("slug"), "name": biz.get("name")}


class VerifyIn(BaseModel):
    verified: bool


@router.patch("/businesses/{business_id}/verified")
async def set_verified(business_id: str, payload: VerifyIn, user=Depends(verify_token)):
    """Admin-only. Verification is a claim the PLATFORM makes, so an owner
    may never set it on their own business (spec M5)."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    biz = await db.businesses.find_one({"_id": business_id})
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    now = datetime.now(UTC).isoformat()
    await db.businesses.update_one(
        {"_id": business_id},
        {"$set": {
            "verified": payload.verified,
            "verified_at": now if payload.verified else None,
            "updated_at": now,
        }},
    )
    return {"id": business_id, "verified": payload.verified}
