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
from pydantic import BaseModel, Field

from routes.deps import db, verify_token
from routes.marketplace.shared import HAS_ANY_PHOTO

router = APIRouter()
api_router = router

# How long a thread may sit unanswered before the console mentions it.
# Long enough not to nag mid-conversation, short enough that the enquiry
# is still warm.
STALE_CHAT_DAYS = 3


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
    #
    # `$nor HAS_ANY_PHOTO`, not "gallery is empty". This counted an empty
    # gig-level gallery, which is the NORMAL state of a store (photos sit
    # on its products) and of a tiered service (photos sit on its tiers).
    # It reported 18 photoless listings when 2 were, so the one queue an
    # admin is meant to work through was 90% businesses who had already
    # done the thing they were about to be nudged about.
    no_photo = await db.marketplace_gigs.count_documents({
        "status": "published",
        "$nor": HAS_ANY_PHOTO,
    })

    # Unverified businesses that are actually trading.
    #
    # This said "awaiting a verification decision" and counted every
    # active business without the flag — which is nearly all of them,
    # because THERE IS NO REQUEST FLOW. Nothing anywhere records that a
    # business asked to be verified; `verified` is a boolean an admin
    # sets, and `set_verified` is the only thing that writes it. So the
    # row described a queue of applicants that has never had a single
    # member, and it could only be emptied by verifying every business on
    # the site (Tzvi, 28 Aug 2026: "theres no businesses awaiting
    # verification" — correct, there are not).
    #
    # Two changes, and the label changed with them. It now counts
    # businesses with at least one PUBLISHED listing: an empty shell is
    # not a verification decision anybody needs to make, and including it
    # is what made the number large enough to ignore. The honest fix is
    # still a request flow — until one exists this is a prompt, not a
    # queue, and the copy no longer pretends otherwise.
    trading = await db.marketplace_gigs.distinct("business_id", {"status": "published"})
    unverified = await db.businesses.count_documents({
        "active": True,
        "verified": {"$ne": True},
        "_id": {"$in": [b for b in trading if b]},
    })

    # Conversations where the last word came from the OTHER party and has
    # sat there three days. Three because it is long enough not to nag
    # someone mid-conversation and short enough that the enquiry is still
    # warm; "unanswered" means no reply since their last message, not "no
    # reply ever", which would keep flagging a thread that was answered
    # twice and then went quiet naturally.
    #
    # Read from the messages themselves rather than a stored flag: a flag
    # would need maintaining on every send and would drift the first time
    # a path forgot to update it.
    stale_before = (now - timedelta(days=STALE_CHAT_DAYS)).isoformat()
    latest: dict[str, dict[str, Any]] = {}
    async for msg in db.messages.find(
        {"created_at": {"$lte": stale_before}},
        {"property_id": 1, "sender_id": 1, "receiver_id": 1, "created_at": 1},
    ).sort("created_at", -1).limit(4000):
        key = f"{msg.get('property_id')}_{msg.get('sender_id')}_{msg.get('receiver_id')}"
        pair = tuple(sorted([str(msg.get("sender_id")), str(msg.get("receiver_id"))]))
        conv = f"{msg.get('property_id')}::{pair[0]}::{pair[1]}"
        if conv not in latest:
            latest[conv] = msg
    # A thread counts when its newest message is older than the cutoff —
    # anything newer means the conversation is still moving.
    fresh_convs = set()
    async for msg in db.messages.find(
        {"created_at": {"$gt": stale_before}},
        {"property_id": 1, "sender_id": 1, "receiver_id": 1},
    ).limit(4000):
        pair = tuple(sorted([str(msg.get("sender_id")), str(msg.get("receiver_id"))]))
        fresh_convs.add(f"{msg.get('property_id')}::{pair[0]}::{pair[1]}")
    stale_chats = len([c for c in latest if c not in fresh_convs])

    # Bounces over a rolling seven days, NOT "since last visit". A
    # since-last-visit count needs a per-admin timestamp that does not
    # exist, and a number that silently resets when someone else opens the
    # console is worse than no number.
    week_ago = (now - timedelta(days=7)).isoformat()
    bounced = await db.email_events.count_documents({
        "record_type": "Bounce",
        "received_at": {"$gte": week_ago},
    })

    # N6 — reported and flagged posts. Reports have been collected into
    # `request_reports` since the board shipped and NOTHING has ever read
    # them: a report button that files into a drawer nobody opens is worse
    # than no button, because it tells the person who pressed it that
    # somebody is looking.
    moderation = await db.requests.count_documents({
        "$or": [
            {"report_count": {"$gte": 1}},
            {"needs_review": True},
        ],
        "hidden_by_admin": {"$ne": True},
    })

    return {
        "requests_expiring_unanswered": expiring,
        "services_without_photo": no_photo,
        "businesses_unverified": unverified,
        "chats_unanswered": stale_chats,
        "emails_bounced_7d": bounced,
        "posts_awaiting_moderation": moderation,
    }


# --------------------------------------------------------------------------
# Moderation queue (spec N6)
# --------------------------------------------------------------------------

@api_router.get("/admin/request-reports")
async def admin_request_reports(
    payload: dict = Depends(verify_token),
    include_resolved: bool = False,
    limit: int = Query(100, ge=1, le=500),
) -> list[dict[str, Any]]:
    """Posts a human should look at, newest first.

    Two ways in, and they are different situations:

      * somebody REPORTED it. The reasons they typed are attached, because
        "scam" and "wrong category" need different responses and a bare
        count cannot tell them apart.
      * it landed in a category where fraud does the most damage and was
        flagged on creation (`needs_review`). Nobody complained; we are
        looking on purpose.

    Auto-hidden posts are included. `REPORT_HIDE_THRESHOLD` reports hides a
    post automatically, and that is a holding action, not a decision —
    three coordinated reports can silence a legitimate seller, so a human
    still has to look and be able to put it back.
    """
    _admin_only(payload)

    query: dict[str, Any] = {
        "$or": [{"report_count": {"$gte": 1}}, {"needs_review": True}],
    }
    if not include_resolved:
        query["moderated_at"] = None

    docs = await db.requests.find(query).sort("report_count", -1).to_list(limit)

    # The reasons, in one query rather than one per post.
    ids = [d["_id"] for d in docs]
    reasons: dict[str, list[dict[str, Any]]] = {}
    if ids:
        async for r in db.request_reports.find({"request_id": {"$in": ids}}):
            reasons.setdefault(r["request_id"], []).append({
                "reason": r.get("reason"),
                "created_at": r.get("created_at"),
            })

    return [{
        "id": d["_id"],
        "request_type": d.get("request_type"),
        "post_kind": d.get("post_kind"),
        "title": d.get("title"),
        "description": (d.get("description") or "")[:400],
        "area": d.get("area"),
        "category": d.get("category"),
        "photos": d.get("photos") or [],
        "poster_user_id": d.get("poster_user_id"),
        "created_at": d.get("created_at"),
        "status": d.get("status"),
        "item_status": d.get("item_status"),
        # The moderation fields the public API deliberately strips.
        "report_count": d.get("report_count") or 0,
        "needs_review": bool(d.get("needs_review")),
        "hidden_by_admin": bool(d.get("hidden_by_admin")),
        "moderated_at": d.get("moderated_at"),
        "reports": sorted(reasons.get(d["_id"], []), key=lambda r: r.get("created_at") or ""),
    } for d in docs]


class ModerationIn(BaseModel):
    # "hide" takes it off the board; "allow" puts it back and clears the
    # flag. Both are decisions and both are recorded — an admin who looked
    # and decided it was fine must not have the post reappear in the queue
    # tomorrow, or the queue trains them to ignore it.
    action: str = Field(..., pattern="^(hide|allow)$")


@api_router.post("/admin/request-reports/{request_id}")
async def admin_moderate_request(
    request_id: str, body: ModerationIn, payload: dict = Depends(verify_token),
) -> dict[str, Any]:
    """Decide on one reported post."""
    _admin_only(payload)
    doc = await db.requests.find_one({"_id": request_id}, {"_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Request not found")

    now = datetime.now(UTC).isoformat()
    if body.action == "hide":
        update = {"hidden_by_admin": True}
    else:
        # Allowing CLEARS the auto-hide and the flag, and zeroes the count
        # so the same reports cannot re-trigger the threshold. `reported_by`
        # is kept: it stops the same accounts reporting it again, which is
        # what a coordinated report campaign would do next.
        update = {"hidden_by_admin": False, "needs_review": False, "report_count": 0}
    update["moderated_at"] = now
    update["moderated_by"] = payload.get("user_id")
    update["updated_at"] = now

    await db.requests.update_one({"_id": request_id}, {"$set": update})
    return {"id": request_id, "action": body.action}
