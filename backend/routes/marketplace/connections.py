"""Business-to-business connections (docs/business-network-spec.md, Phase 1).

A connection is a mutual, LinkedIn-style relationship between two
BUSINESSES - not two people. One side asks, the other accepts or
declines, either side can disconnect later. Only an accepted connection
can carry automations (Phase 2), which is why this exists first.

It generalises the one special case the site already had: a shop
inviting a courier, stored as `businesses.couriers[]`. That list keeps
working unchanged; `scripts/migrate_couriers_to_connections.py` mirrors
the couriers who run a business of their own into this collection.

ONE DOCUMENT PER PAIR. `a_id`/`b_id` are the two business ids sorted, so
"bakery asks courier" and "courier asks bakery" land on the same row and
a unique index can hold the rule that two businesses have at most one
relationship. `requested_by` records which side asked, and therefore
which side may accept.

Ownership is checked on every call against the business the caller is
acting AS. A person who runs several businesses acts for one at a time,
and nothing here lets a connection made by one of their businesses be
used by another.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator

from routes.deps import db, logger, verify_token
from utils.rate_limit import check_rate

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

STATUSES = ("pending", "accepted", "declined", "disconnected")
Relationship = Literal["supplier", "customer", "courier", "partner"]
MAX_NOTE = 500


class ConnectIn(BaseModel):
    target_business_id: str = Field(min_length=1, max_length=100)
    note: Optional[str] = Field(None, max_length=MAX_NOTE)
    relationship: Optional[Relationship] = None

    @field_validator("note")
    @classmethod
    def _strip(cls, v: Optional[str]) -> Optional[str]:
        v = (v or "").strip()
        return v or None


class RelationshipIn(BaseModel):
    relationship: Optional[Relationship] = None


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _now() -> str:
    return datetime.now(UTC).isoformat()


def _pair(x: str, y: str) -> tuple[str, str]:
    return (x, y) if x < y else (y, x)


def _other(conn: dict[str, Any], business_id: str) -> str:
    return conn["b_id"] if conn["a_id"] == business_id else conn["a_id"]


async def _owned(business_id: str, user: dict[str, Any]) -> dict[str, Any]:
    """The business, if the caller may act as it: its owner, or an admin.

    The same rule `businesses._owned` and `orders._owned_business` apply.
    Kept local for the reason orders.py gives - a router importing a
    sibling router's private helper couples the two - and it is three
    lines; consolidating all three into utils/businesses is its own tidy.
    """
    biz = await db.businesses.find_one({"_id": business_id})
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    if biz.get("owner_user_id") != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not your business")
    return biz


async def _connection_for(conn_id: str, user: dict[str, Any]) -> tuple[dict[str, Any], set[str]]:
    """The connection plus which of its two sides the caller owns.

    404 rather than 403 when the caller is on neither side: a connection id
    is not public, and confirming it exists would tell a stranger that two
    businesses have a relationship.
    """
    conn = await db.business_connections.find_one({"_id": conn_id})
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    mine: set[str] = set()
    if user.get("role") == "admin":
        mine = {conn["a_id"], conn["b_id"]}
    else:
        async for b in db.businesses.find(
            {"_id": {"$in": [conn["a_id"], conn["b_id"]]}, "owner_user_id": user["user_id"]},
            {"_id": 1},
        ):
            mine.add(b["_id"])
    if not mine:
        raise HTTPException(status_code=404, detail="Connection not found")
    return conn, mine


async def _notify(user_id: Optional[str], *, message: str, action_url: str, **extra: Any) -> None:
    """One in-app notification, the shape chat.py and orders._notify write,
    so the bell and its deep link work without knowing about connections."""
    if not user_id:
        return
    try:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()), "user_id": user_id, "type": "business_connection",
            "message": message, "action_url": action_url, "read": False,
            "created_at": _now(), **extra,
        })
    except Exception:  # noqa: BLE001 - a lost bell must not fail the request
        logger.exception("connection notification failed")


async def _card(biz: dict[str, Any]) -> dict[str, Any]:
    """The other business, as the network screens show it.

    Public facts only - the same ones its business page already shows -
    plus what the Message button needs: the chat backend keys a thread by a
    listing, and the business page does the same (BusinessPage.jsx).
    """
    from routes.marketplace.businesses import business_rating  # the one ratings system
    rating = await business_rating(biz["_id"])
    first_gig = await db.marketplace_gigs.find_one(
        {"business_id": biz["_id"], "status": {"$in": [None, "published"]}},
        {"_id": 1}, sort=[("created_at", 1)],
    )
    return {
        "id": biz["_id"],
        "name": biz.get("name") or "",
        "name_he": biz.get("name_he"),
        "slug": biz.get("slug"),
        "logo_url": biz.get("logo_url"),
        "categories": biz.get("categories") or [],
        "areas": biz.get("areas") or [],
        "verified": bool(biz.get("verified")),
        "rating_avg": rating["rating_avg"],
        "rating_count": rating["rating_count"],
        "owner_user_id": biz.get("owner_user_id"),
        "message_listing_id": (first_gig or {}).get("_id"),
    }


def _out(conn: dict[str, Any], me: str, other: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    status = conn["status"]
    if status == "pending":
        # The one status that reads differently from each side.
        direction = "outgoing" if conn["requested_by"] == me else "incoming"
    else:
        direction = None
    return {
        "id": conn["_id"],
        "status": status,
        "direction": direction,
        "requested_by": conn["requested_by"],
        "note": conn.get("note"),
        "relationship": conn.get("relationship"),
        "created_at": conn.get("created_at"),
        "responded_at": conn.get("responded_at"),
        "other_business_id": _other(conn, me),
        "other": other,
    }


# ---------------------------------------------------------------------------
# endpoints
# ---------------------------------------------------------------------------

@router.get("/businesses/{business_id}/connections")
async def list_connections(
    business_id: str,
    status: Optional[str] = Query(None, pattern="^(pending|accepted|declined|disconnected)$"),
    user=Depends(verify_token),
):
    """This business's connections, each with the other side's public card.

    Default is what the Network tab shows: accepted plus pending both ways.
    Declined and disconnected rows are history, returned only when asked.
    """
    await _owned(business_id, user)
    q: dict[str, Any] = {"$or": [{"a_id": business_id}, {"b_id": business_id}]}
    q["status"] = status if status else {"$in": ["pending", "accepted"]}
    rows = await db.business_connections.find(q).sort("updated_at", -1).to_list(500)

    others = {
        b["_id"]: b async for b in db.businesses.find(
            {"_id": {"$in": [_other(c, business_id) for c in rows]}},
        )
    }
    out = []
    for c in rows:
        other = others.get(_other(c, business_id))
        # A business deleted since the connection was made: the row is
        # meaningless to show and impossible to act on.
        if other is None:
            continue
        out.append(_out(c, business_id, await _card(other)))
    return {
        "connections": out,
        "counts": {
            "accepted": sum(1 for c in out if c["status"] == "accepted"),
            "incoming": sum(1 for c in out if c["direction"] == "incoming"),
            "outgoing": sum(1 for c in out if c["direction"] == "outgoing"),
        },
    }


@router.post("/businesses/{business_id}/connections")
async def request_connection(business_id: str, payload: ConnectIn, request: Request, user=Depends(verify_token)):
    """Ask another business to connect.

    Idempotent where it should be, and helpful where the naive version is
    not:
      * already pending from me, or accepted - returns the existing row;
      * pending FROM THEM - this is an accept. Two businesses that both
        pressed Connect want the same thing; making the second one wait
        for a reply to a request the first already sent is a dead end;
      * declined or disconnected - reopens as a fresh request from me.
    """
    me = await _owned(business_id, user)
    target_id = payload.target_business_id
    if target_id == business_id:
        raise HTTPException(status_code=400, detail="A business cannot connect to itself")
    target = await db.businesses.find_one({"_id": target_id})
    if not target or not target.get("active", True):
        raise HTTPException(status_code=404, detail="Business not found")

    # Generous for a real owner, and enough to make blanket-requesting
    # every business on the site slow and visible.
    check_rate(request, bucket="biz-connect", limit=30, window_seconds=3600, key_extra=business_id)

    a_id, b_id = _pair(business_id, target_id)
    existing = await db.business_connections.find_one({"a_id": a_id, "b_id": b_id})
    now = _now()

    if existing and existing["status"] == "accepted":
        return _out(existing, business_id, await _card(target))
    if existing and existing["status"] == "pending":
        if existing["requested_by"] == business_id:
            return _out(existing, business_id, await _card(target))
        return await _accept(existing, business_id, me, target)

    if existing:  # declined or disconnected: ask again
        await db.business_connections.update_one({"_id": existing["_id"]}, {"$set": {
            "status": "pending", "requested_by": business_id, "note": payload.note,
            "relationship": payload.relationship or existing.get("relationship"),
            "responded_at": None, "updated_at": now,
        }})
        conn = await db.business_connections.find_one({"_id": existing["_id"]})
    else:
        conn = {
            "_id": str(uuid.uuid4()), "a_id": a_id, "b_id": b_id,
            "requested_by": business_id, "status": "pending",
            "note": payload.note, "relationship": payload.relationship,
            "created_at": now, "responded_at": None, "updated_at": now,
        }
        try:
            await db.business_connections.insert_one(conn)
        except Exception:  # noqa: BLE001 - the unique pair index: someone got there first
            conn = await db.business_connections.find_one({"a_id": a_id, "b_id": b_id})
            if conn is None:
                raise
            return _out(conn, business_id, await _card(target))

    await _notify(
        target.get("owner_user_id"),
        message=f"{me.get('name') or 'A business'} wants to connect with {target.get('name') or 'your business'}",
        action_url="/dashboard?tab=network&view=requests",
        business_id=target_id, connection_id=conn["_id"],
    )
    return _out(conn, business_id, await _card(target))


async def _accept(conn: dict[str, Any], acting_as: str, me: dict[str, Any], other: dict[str, Any]) -> dict[str, Any]:
    now = _now()
    # Filtered on status, so two accept taps (or accept racing a withdraw)
    # cannot both land - the same compare-and-swap order status uses.
    res = await db.business_connections.update_one(
        {"_id": conn["_id"], "status": "pending"},
        {"$set": {"status": "accepted", "responded_at": now, "updated_at": now}},
    )
    if res.modified_count == 0:
        raise HTTPException(status_code=409, detail="This request was already answered. Refresh to see where it stands.")
    fresh = await db.business_connections.find_one({"_id": conn["_id"]})
    await _notify(
        other.get("owner_user_id"),
        message=f"{me.get('name') or 'A business'} accepted your connection request",
        action_url="/dashboard?tab=network",
        business_id=other["_id"], connection_id=conn["_id"],
    )
    return _out(fresh, acting_as, await _card(other))


@router.post("/connections/{conn_id}/accept")
async def accept_connection(conn_id: str, user=Depends(verify_token)):
    """Only the side that was ASKED may accept."""
    conn, mine = await _connection_for(conn_id, user)
    recipient = _other(conn, conn["requested_by"])
    if recipient not in mine:
        raise HTTPException(status_code=403, detail="Only the business that was asked can accept")
    if conn["status"] != "pending":
        raise HTTPException(status_code=409, detail="This request was already answered. Refresh to see where it stands.")
    me = await db.businesses.find_one({"_id": recipient})
    other = await db.businesses.find_one({"_id": conn["requested_by"]}) or {"_id": conn["requested_by"]}
    return await _accept(conn, recipient, me or {}, other)


@router.post("/connections/{conn_id}/decline")
async def decline_connection(conn_id: str, user=Depends(verify_token)):
    """Only the side that was asked may decline. The asker is not
    notified: a decline is a quiet no, as it is everywhere this pattern
    exists, and a notification saying "rejected" invites a second try."""
    conn, mine = await _connection_for(conn_id, user)
    recipient = _other(conn, conn["requested_by"])
    if recipient not in mine:
        raise HTTPException(status_code=403, detail="Only the business that was asked can decline")
    now = _now()
    res = await db.business_connections.update_one(
        {"_id": conn_id, "status": "pending"},
        {"$set": {"status": "declined", "responded_at": now, "updated_at": now}},
    )
    if res.modified_count == 0:
        raise HTTPException(status_code=409, detail="This request was already answered. Refresh to see where it stands.")
    fresh = await db.business_connections.find_one({"_id": conn_id})
    return _out(fresh, recipient)


@router.post("/connections/{conn_id}/disconnect")
async def disconnect(conn_id: str, user=Depends(verify_token)):
    """Either side ends an accepted connection, or the asker withdraws a
    pending one. Every automation on the pair stops with it: an automation
    may only ever target a business its owner is connected to."""
    conn, mine = await _connection_for(conn_id, user)
    if conn["status"] == "pending" and conn["requested_by"] not in mine:
        raise HTTPException(status_code=403, detail="Decline the request instead")
    if conn["status"] not in ("accepted", "pending"):
        raise HTTPException(status_code=409, detail="You are not connected")
    acting_as = conn["requested_by"] if conn["requested_by"] in mine else next(iter(mine))
    now = _now()
    await db.business_connections.update_one(
        {"_id": conn_id}, {"$set": {"status": "disconnected", "updated_at": now}},
    )
    # Phase 2's collection. Empty until then, and the rule belongs here
    # from day one so it cannot be forgotten when automations arrive.
    paused = await db.business_automations.update_many(
        {"$or": [
            {"business_id": conn["a_id"], "partner_business_id": conn["b_id"]},
            {"business_id": conn["b_id"], "partner_business_id": conn["a_id"]},
        ], "enabled": True},
        {"$set": {"enabled": False, "paused_reason": "disconnected", "updated_at": now}},
    )
    if paused.modified_count:
        logger.info("[connections] %s disconnected; paused %d automation(s)", conn_id, paused.modified_count)
    fresh = await db.business_connections.find_one({"_id": conn_id})
    return _out(fresh, acting_as)


@router.patch("/connections/{conn_id}")
async def set_relationship(conn_id: str, payload: RelationshipIn, user=Depends(verify_token)):
    """The label ("supplier", "courier"...) is editable by either side."""
    conn, mine = await _connection_for(conn_id, user)
    await db.business_connections.update_one(
        {"_id": conn_id}, {"$set": {"relationship": payload.relationship, "updated_at": _now()}},
    )
    fresh = await db.business_connections.find_one({"_id": conn_id})
    return _out(fresh, next(iter(mine)))


PARTNER_SEARCH_LIMIT = 30


@router.get("/businesses/{business_id}/partner-search")
async def partner_search(
    business_id: str,
    q: str = Query("", max_length=80),
    category: str = Query("", max_length=60),
    user=Depends(verify_token),
):
    """Businesses to connect with, for the Network tab's Find partners.

    That view used to send people to /businesses, the services list, whose
    cards open a SERVICE page - and Connect lives only on a business's own
    page, so nobody found it (Tzvi, 22 Sep 2026). This lists businesses
    directly, with where each stands with the caller's business, and can
    be narrowed to one kind ("I need a delivery person, not every
    business on the site").

    Only businesses someone could actually find on the site: active, with
    at least one published service. Never the caller's own. A business's
    kinds are its services' categories plus any it set on itself.

    Returns {"results": [...], "categories": [{slug, count}]}, the second
    being the kinds that have at least one business, for the picker.
    """
    await _owned(business_id, user)
    import re
    kinds: dict[str, set[str]] = {}
    async for row in db.marketplace_gigs.aggregate([
        {"$match": {"status": "published", "business_id": {"$nin": [None, "", business_id]}}},
        {"$group": {"_id": "$business_id", "cats": {"$addToSet": "$category"}}},
    ]):
        kinds[row["_id"]] = {c for c in row["cats"] if c}
    query: dict[str, Any] = {
        "_id": {"$in": list(kinds)},
        "active": {"$ne": False},
        "owner_user_id": {"$ne": user["user_id"]},
    }
    q = q.strip()
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [{"name": rx}, {"name_he": rx}]
    docs = await db.businesses.find(
        query, {"name": 1, "name_he": 1, "slug": 1, "logo_url": 1, "categories": 1, "areas": 1},
    ).sort("name", 1).to_list(500)
    # Only real categories: `businesses.categories` also holds free text
    # from before there was a picker ("graphic-designer"), which would show
    # up raw in the kind picker.
    from routes.marketplace.shared import CATEGORIES
    valid = {c["slug"] for c in CATEGORIES}
    for d in docs:
        d["_kinds"] = sorted((kinds.get(d["_id"], set()) | set(d.get("categories") or [])) & valid)

    counts: dict[str, int] = {}
    for d in docs:
        for k in d["_kinds"]:
            counts[k] = counts.get(k, 0) + 1
    if category:
        docs = [d for d in docs if category in d["_kinds"]]
    docs = docs[:PARTNER_SEARCH_LIMIT]

    ids = [d["_id"] for d in docs]
    conns = {}
    async for c in db.business_connections.find({"$or": [
        {"a_id": business_id, "b_id": {"$in": ids}}, {"b_id": business_id, "a_id": {"$in": ids}},
    ]}):
        conns[_other(c, business_id)] = _out(c, business_id)
    results = []
    for d in docs:
        c = conns.get(d["_id"])
        results.append({
            "id": d["_id"], "name": d.get("name") or "", "name_he": d.get("name_he"),
            "slug": d.get("slug"), "logo_url": d.get("logo_url"),
            "categories": d["_kinds"], "areas": d.get("areas") or [],
            "status": c["status"] if c else "none",
            "connection_id": c["id"] if c else None,
            "direction": c["direction"] if c else None,
        })
    return {
        "results": results,
        "categories": [{"slug": k, "count": n} for k, n in sorted(counts.items(), key=lambda kv: -kv[1])],
    }


@router.get("/businesses/{business_id}/connections/{other_id}")
async def connection_status(business_id: str, other_id: str, user=Depends(verify_token)):
    """What the Connect button on another business's page should say."""
    await _owned(business_id, user)
    if other_id == business_id:
        return {"status": "self", "connection_id": None, "direction": None}
    a_id, b_id = _pair(business_id, other_id)
    conn = await db.business_connections.find_one({"a_id": a_id, "b_id": b_id})
    if not conn:
        return {"status": "none", "connection_id": None, "direction": None}
    o = _out(conn, business_id)
    return {"status": o["status"], "connection_id": o["id"], "direction": o["direction"]}


async def ensure_connection_indexes() -> None:
    """At most one relationship per pair of businesses, enforced by the
    database rather than by a check-then-insert that two taps can race."""
    await db.business_connections.create_index([("a_id", 1), ("b_id", 1)], unique=True, background=True)
    await db.business_connections.create_index([("a_id", 1), ("status", 1)], background=True)
    await db.business_connections.create_index([("b_id", 1), ("status", 1)], background=True)


async def incoming_request_count(user_id: str) -> int:
    """Pending requests waiting on any business this person owns - the
    Network tab's badge on the dashboard summary."""
    mine = [b["_id"] async for b in db.businesses.find({"owner_user_id": user_id}, {"_id": 1})]
    if not mine:
        return 0
    n = 0
    async for c in db.business_connections.find(
        {"status": "pending", "$or": [{"a_id": {"$in": mine}}, {"b_id": {"$in": mine}}]},
        {"a_id": 1, "b_id": 1, "requested_by": 1},
    ):
        if _other(c, c["requested_by"]) in mine and c["requested_by"] not in mine:
            n += 1
    return n
