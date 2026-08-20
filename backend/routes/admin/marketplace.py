"""Admin surfaces for the marketplace (spec A1).

The console covered rentals only: eight tabs, all about properties, while
services became the lead offering and requests and businesses shipped with
no admin view at all. You could not answer "how is the marketplace doing?"
from the admin console, because nothing in it knew the marketplace existed.

Kept deliberately thin. ListingsTab is 62 KB of behaviour and reproducing
that for services would be a week of work to reach the same maintenance
problem; this is a list, a few counts, and the two actions an admin
actually needs.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from routes.deps import db, verify_token

router = APIRouter()
api_router = router


def _admin_only(payload: dict) -> None:
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


@api_router.get("/admin/gigs")
async def admin_gigs(
    payload: dict = Depends(verify_token),
    status: Optional[str] = Query(None, pattern="^(published|draft|unpublished)$"),
    q: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
) -> list[dict[str, Any]]:
    """Every service, with the business it belongs to.

    The business name is resolved in ONE query for the whole page rather
    than per row — the same batching the chat inbox needed, for the same
    reason: a per-row lookup is invisible at ten rows and unusable at two
    hundred.
    """
    _admin_only(payload)
    query: dict[str, Any] = {}
    if status:
        query["status"] = status
    if q:
        query["title"] = {"$regex": q.strip()[:80], "$options": "i"}

    gigs = [
        g async for g in db.marketplace_gigs.find(query).sort("created_at", -1).limit(limit)
    ]
    biz_ids = list({g.get("business_id") for g in gigs if g.get("business_id")})
    businesses = {
        b["_id"]: b
        async for b in db.businesses.find({"_id": {"$in": biz_ids}}, {"_id": 1, "name": 1})
    } if biz_ids else {}

    out = []
    for g in gigs:
        tiers = g.get("tiers") or []
        prices = [t.get("price") for t in tiers if t.get("price") is not None]
        products = g.get("products") or []
        if not prices and products:
            prices = [p.get("price") for p in products if p.get("price") is not None]
        out.append({
            "id": g["_id"],
            "title": g.get("title") or "",
            "business_id": g.get("business_id"),
            # None, not "Unknown": a missing business is a real state worth
            # seeing in the console rather than a label that hides it.
            "business_name": (businesses.get(g.get("business_id")) or {}).get("name"),
            "provider_user_id": g.get("provider_user_id"),
            "category": g.get("category"),
            "area": g.get("area"),
            "price_from": min(prices) if prices else None,
            "currency": (tiers[0].get("currency") if tiers else None) or "ILS",
            "status": g.get("status"),
            "featured": bool(g.get("featured")),
            "created_at": g.get("created_at"),
        })
    return out


class GigStatusIn(BaseModel):
    status: str


@api_router.patch("/admin/gigs/{gig_id}/status")
async def admin_set_gig_status(
    gig_id: str, body: GigStatusIn, payload: dict = Depends(verify_token),
) -> dict[str, Any]:
    """Unpublish or restore one service.

    Reversible on purpose, and the reason it is a status flip rather than a
    delete: an admin acting on a report needs to stop something showing
    NOW, and be able to undo it when the report turns out to be wrong.
    Deleting would take the reviews and the owner's work with it.
    """
    _admin_only(payload)
    if body.status not in ("published", "unpublished"):
        raise HTTPException(status_code=400, detail="status must be published or unpublished")
    gig = await db.marketplace_gigs.find_one({"_id": gig_id}, {"_id": 1, "status": 1})
    if not gig:
        raise HTTPException(status_code=404, detail="Service not found")
    await db.marketplace_gigs.update_one(
        {"_id": gig_id},
        {"$set": {"status": body.status, "updated_at": datetime.now(UTC).isoformat()}},
    )
    # The previous status travels back so the UI can offer a real undo
    # rather than guessing what to restore to.
    return {"id": gig_id, "status": body.status, "previous_status": gig.get("status")}


@api_router.get("/admin/marketplace/summary")
async def admin_marketplace_summary(payload: dict = Depends(verify_token)) -> dict[str, Any]:
    """The counts the Overview row was missing (spec A1).

    Every one is a count over data that exists. Nothing is estimated, and
    a number that cannot be counted honestly is absent rather than guessed.
    """
    _admin_only(payload)
    now = datetime.now(UTC)
    return {
        "active_services": await db.marketplace_gigs.count_documents({"status": "published"}),
        "businesses": await db.businesses.count_documents({"active": True}),
        "open_requests": await db.requests.count_documents({
            "status": "open",
            "expires_at": {"$gte": now.isoformat()},
        }),
    }


@api_router.get("/admin/attention")
async def admin_attention(payload: dict = Depends(verify_token)) -> dict[str, Any]:
    """What needs a person today (spec A3).

    Every row is a COUNT plus the filter that reaches it, so the console
    can link straight to the thing rather than describing it. Rows the
    caller does not need are simply zero — the client renders nothing when
    everything is zero, with no "all caught up" filler.
    """
    _admin_only(payload)
    now = datetime.now(UTC)
    soon = (now + timedelta(days=3)).isoformat()

    # Requests expiring within three days that nobody has answered. Three
    # days is the point where renewing still helps; a request expiring
    # tomorrow with no responses is already lost.
    expiring = await db.requests.count_documents({
        "status": "open",
        "expires_at": {"$gte": now.isoformat(), "$lte": soon},
        "contact_count": {"$lte": 0},
    })

    # Services with no photo. Not a rule violation — S5 says a photoless
    # business is never hidden or down-ranked — but it is the single
    # highest-value thing an admin could nudge someone about.
    no_photo = await db.marketplace_gigs.count_documents({
        "status": "published",
        "$or": [{"gallery": {"$size": 0}}, {"gallery": {"$exists": False}}],
    })

    # Businesses with listings but no verification decision yet.
    unverified = await db.businesses.count_documents({"active": True, "verified": {"$ne": True}})

    return {
        "requests_expiring_unanswered": expiring,
        "services_without_photo": no_photo,
        "businesses_unverified": unverified,
    }
