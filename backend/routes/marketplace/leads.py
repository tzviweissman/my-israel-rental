"""The leads board (Tzvi, 22 Oct 2026, from GoHighLevel's sales pipeline):
every enquiry a business has, in stages, so none is forgotten.

    new      someone asked; nobody has answered yet
    replied  the business answered
    quoted   a price was sent (quotes.py)
    won      they booked, accepted the price, or the business says so
    lost     they declined, or the business says so

Cards are worked out from what already exists, nothing is copied:

  * chats about the business's listings (db.messages, property_id = the
    listing): "new" until the business has written back, then "replied";
  * quote requests and prices (db.quote_requests): new / quoted / won /
    lost from their status;
  * leads the business adds by hand (db.leads), for a phone call or a
    walk-in: whatever stage it puts them in.

The business can move any card. A move is kept with the stage the card
had when it was moved, and holds until the enquiry itself changes (the
customer accepts the price, the business replies): then the card follows
the enquiry again. So a move is never silently undone, and a real event
is never hidden behind an old move.

The board is for new leads, not old customers (Tzvi, 23 Oct 2026): a chat
from someone who had already ordered or booked from the business before it
is left out, and a chat card never shows the customer's profile phone (they
did not give it to the business; the card links to the chat instead).

Only enquiries active in the last DAYS days are shown, and a card that
has sat in "won" or "lost" for more than a fortnight drops off.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from routes.deps import db, verify_token

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

STAGES = ("new", "replied", "quoted", "won", "lost")
Stage = Literal["new", "replied", "quoted", "won", "lost"]
DAYS = 90
CLOSED_KEEP_DAYS = 14

_QUOTE_STAGE = {"new": "new", "quoted": "quoted", "accepted": "won", "declined": "lost", "declined_by_customer": "lost"}


async def _owned(business_id: str, user: dict[str, Any]) -> dict[str, Any]:
    """The owner, an admin, or staff with the Customers area (utils/business_access.py)."""
    from utils.business_access import business_access
    return await business_access(db, business_id, user, "customers")


def chat_leads(messages: list[dict[str, Any]], owner_id: str, titles: dict[str, str]) -> dict[str, dict[str, Any]]:
    """One card per (listing, customer) from the chat messages about the
    business's listings, oldest first. A conversation the business started
    is not an enquiry and is left out. Pure, for tests."""
    convs: dict[str, dict[str, Any]] = {}
    for m in messages:
        other = m["receiver_id"] if m["sender_id"] == owner_id else m["sender_id"]
        if other == owner_id:
            continue
        key = f"chat:{m['property_id']}:{other}"
        c = convs.get(key)
        if c is None:
            if m["sender_id"] == owner_id:
                continue
            c = convs[key] = {"key": key, "source": "chat", "customer_id": other, "gig_id": m["property_id"],
                              "title": titles.get(m["property_id"], ""), "replied": False,
                              "created_at": m["created_at"]}
        if m.get("auto"):
            continue            # the automatic "we got your message" (away_reply.py) is not an answer
        if m["sender_id"] == owner_id:
            c["replied"] = True
        c["last_text"] = (m.get("message") or "").strip()[:140]
        c["last_at"] = m["created_at"]
        c["last_from_customer"] = m["sender_id"] != owner_id
    for c in convs.values():
        c["auto_stage"] = "replied" if c["replied"] else "new"
    return convs


def new_leads_only(cards: dict[str, dict[str, Any]], first_bought: dict[str, str]) -> dict[str, dict[str, Any]]:
    """Drops chat cards from people who had already ordered or booked from the
    business before the chat began (first_bought: user id -> their earliest
    order or booking). Pure, for tests."""
    return {k: c for k, c in cards.items()
            if not (c.get("source") == "chat" and first_bought.get(c["customer_id"], "~") <= (c.get("created_at") or ""))}


def apply_move(card: dict[str, Any], move: Optional[dict[str, Any]]) -> str:
    """The stage shown: the business's move while the enquiry is where it
    was when moved, else the enquiry's own stage. Pure."""
    if move and move.get("from_stage") == card["auto_stage"]:
        return move["stage"]
    return card["auto_stage"]


@router.get("/businesses/{business_id}/leads")
async def leads_board(business_id: str, user=Depends(verify_token)):
    biz = await _owned(business_id, user)
    owner = biz.get("owner_user_id")
    since = (datetime.now(UTC) - timedelta(days=DAYS)).isoformat()
    gigs = {g["_id"]: g.get("title") or "" async for g in db.marketplace_gigs.find({"business_id": business_id}, {"title": 1})}

    cards: dict[str, dict[str, Any]] = {}
    if gigs:
        msgs = await db.messages.find({"property_id": {"$in": list(gigs)}, "created_at": {"$gte": since},
                                       "$or": [{"sender_id": owner}, {"receiver_id": owner}]},
                                      {"_id": 0, "property_id": 1, "sender_id": 1, "receiver_id": 1, "message": 1, "created_at": 1, "auto": 1}
                                      ).sort("created_at", 1).to_list(5000)
        chats = chat_leads(msgs, owner, gigs)
        ids = list({c["customer_id"] for c in chats.values()})
        first: dict[str, str] = {}
        async for o in db.store_orders.find({"business_id": business_id, "customer_user_id": {"$in": ids}}, {"_id": 0, "customer_user_id": 1, "created_at": 1}):
            first[o["customer_user_id"]] = min(first.get(o["customer_user_id"], "~"), str(o.get("created_at") or "~"))
        async for b in db.marketplace_bookings.find({"gig_id": {"$in": list(gigs)}, "client_user_id": {"$in": ids}}, {"_id": 0, "client_user_id": 1, "created_at": 1}):
            first[b["client_user_id"]] = min(first.get(b["client_user_id"], "~"), str(b.get("created_at") or "~"))
        chats = new_leads_only(chats, first)
        cards.update(chats)
        users = {u["id"]: u async for u in db.users.find({"id": {"$in": ids}}, {"_id": 0, "id": 1, "name": 1})}
        for c in chats.values():
            c["name"], c["phone"] = users.get(c["customer_id"], {}).get("name") or "", None
            c["link"] = f"/chat/{c['gig_id']}?with={c['customer_id']}"

    async for q in db.quote_requests.find({"business_id": business_id, "updated_at": {"$gte": since}}):
        key = f"quote:{q['_id']}"
        cards[key] = {"key": key, "source": "quote", "name": q.get("name") or "", "phone": q.get("phone"),
                      "title": gigs.get(q.get("gig_id"), "") or (q.get("description") or "")[:80],
                      "last_text": (q.get("description") or "")[:140], "created_at": q.get("created_at"),
                      "last_at": q.get("updated_at") or q.get("created_at"),
                      "price": (q.get("quote") or {}).get("price"),
                      "auto_stage": _QUOTE_STAGE.get(q.get("status"), "new"), "link": "/dashboard?tab=appointments"}

    async for ld in db.leads.find({"business_id": business_id}):
        key = f"lead:{ld['_id']}"
        cards[key] = {"key": key, "source": "manual", "id": ld["_id"], "name": ld.get("name") or "", "phone": ld.get("phone"),
                      "title": ld.get("note") or "", "last_text": "", "created_at": ld["created_at"],
                      "last_at": ld.get("updated_at") or ld["created_at"], "auto_stage": ld.get("stage", "new")}

    moves = {m["key"]: m async for m in db.lead_moves.find({"business_id": business_id})}
    closed_cut = (datetime.now(UTC) - timedelta(days=CLOSED_KEEP_DAYS)).isoformat()
    out = []
    for c in cards.values():
        mv = moves.get(c["key"])
        c["stage"] = c["auto_stage"] if c["source"] == "manual" else apply_move(c, mv)
        c["moved_at"] = (mv or {}).get("at") if c["stage"] != c["auto_stage"] else None
        touched = max(filter(None, [c.get("last_at"), c.get("moved_at")]), default="")
        if c["stage"] in ("won", "lost") and touched < closed_cut:
            continue
        c.pop("replied", None)
        out.append(c)
    out.sort(key=lambda c: c.get("last_at") or "", reverse=True)
    return {"stages": list(STAGES), "leads": out, "counts": {s: sum(1 for c in out if c["stage"] == s) for s in STAGES}}


class MoveIn(BaseModel):
    key: str = Field(..., max_length=200)
    stage: Stage


@router.post("/businesses/{business_id}/leads/move")
async def move_lead(business_id: str, body: MoveIn, user=Depends(verify_token)):
    await _owned(business_id, user)
    now = datetime.now(UTC).isoformat()
    if body.key.startswith("lead:"):
        r = await db.leads.update_one({"_id": body.key[5:], "business_id": business_id},
                                      {"$set": {"stage": body.stage, "updated_at": now}})
        if not r.matched_count:
            raise HTTPException(status_code=404, detail="Lead not found")
        return {"ok": True}
    # The stage the card has right now, from the board itself, so the move
    # remembers what it was moved away from.
    board = await leads_board(business_id, user)
    card = next((c for c in board["leads"] if c["key"] == body.key), None)
    if not card:
        raise HTTPException(status_code=404, detail="Lead not found")
    if body.stage == card["auto_stage"]:
        await db.lead_moves.delete_one({"business_id": business_id, "key": body.key})
    else:
        await db.lead_moves.update_one({"business_id": business_id, "key": body.key},
                                       {"$set": {"stage": body.stage, "from_stage": card["auto_stage"], "at": now}}, upsert=True)
    return {"ok": True}


class LeadIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    phone: Optional[str] = Field(None, max_length=40)
    note: str = Field("", max_length=300)
    stage: Stage = "new"


@router.post("/businesses/{business_id}/leads")
async def add_lead(business_id: str, body: LeadIn, user=Depends(verify_token)):
    await _owned(business_id, user)
    if await db.leads.count_documents({"business_id": business_id}) >= 1000:
        raise HTTPException(status_code=400, detail="Up to 1,000 leads you add yourself. Delete some old ones first.")
    now = datetime.now(UTC).isoformat()
    doc = {"_id": str(uuid.uuid4()), "business_id": business_id, "name": body.name.strip(), "phone": (body.phone or "").strip() or None,
           "note": body.note.strip(), "stage": body.stage, "by": user["user_id"], "created_at": now, "updated_at": now}
    await db.leads.insert_one(doc)
    return {"key": f"lead:{doc['_id']}"}


@router.delete("/businesses/{business_id}/leads/{lead_id}")
async def delete_lead(business_id: str, lead_id: str, user=Depends(verify_token)):
    await _owned(business_id, user)
    await db.leads.delete_one({"_id": lead_id, "business_id": business_id})
    return {"ok": True}


async def ensure_lead_indexes() -> None:
    await db.leads.create_index([("business_id", 1), ("created_at", -1)])
    await db.lead_moves.create_index([("business_id", 1), ("key", 1)], unique=True)
    await db.messages.create_index([("property_id", 1), ("created_at", 1)])
