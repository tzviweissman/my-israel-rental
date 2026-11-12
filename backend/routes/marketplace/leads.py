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
    walk-in: whatever stage it puts them in;
  * emails sent or forwarded to the business's own address
    (email_inbox.py): "new" until answered, with Claude's draft reply.

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

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from routes.deps import db, verify_token
from utils.rate_limit import check_rate

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
        cards[key] = {"key": key, "source": "quote", "name": q.get("name") or "", "phone": q.get("phone"), "email": q.get("email"),
                      "title": gigs.get(q.get("gig_id"), "") or (q.get("description") or "")[:80],
                      "last_text": (q.get("description") or "")[:140], "created_at": q.get("created_at"),
                      "last_at": q.get("updated_at") or q.get("created_at"),
                      "price": (q.get("quote") or {}).get("price"),
                      "auto_stage": _QUOTE_STAGE.get(q.get("status"), "new"), "link": "/dashboard?tab=appointments"}

    async for ld in db.leads.find({"business_id": business_id}):
        key = f"lead:{ld['_id']}"
        cards[key] = {"key": key, "source": "manual", "id": ld["_id"], "name": ld.get("name") or "", "phone": ld.get("phone"), "email": ld.get("email"),
                      "title": ld.get("note") or "", "last_text": "", "created_at": ld["created_at"],
                      "last_at": ld.get("updated_at") or ld["created_at"], "auto_stage": ld.get("stage", "new")}

    # Emails to the business's own address (email_inbox.py).
    from .email_inbox import email_cards
    cards.update(await email_cards(business_id, since))

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
    now_iso = datetime.now(UTC).isoformat()
    for c in out:
        c["next"] = next_step(c, now_iso)
    out.sort(key=lambda c: c.get("last_at") or "", reverse=True)
    # The suggested reply a nudge or the owner asked for (lead_nudge.py).
    from .lead_nudge import attach_drafts
    await attach_drafts(business_id, out)
    return {"stages": list(STAGES), "leads": out, "counts": {s: sum(1 for c in out if c["stage"] == s) for s in STAGES},
            "found": await found_requests(biz, gigs)}


def _days_since(iso: Optional[str], now_iso: str) -> float:
    try:
        return (datetime.fromisoformat(now_iso) - datetime.fromisoformat(iso)).total_seconds() / 86400
    except (TypeError, ValueError):
        return 0.0


def next_step(card: dict[str, Any], now_iso: str) -> Optional[str]:
    """What the business should do about a card now (the "next best action"
    of Apollo-style sales tools, Tzvi 12 Nov 2026), or None:

        answer     they asked and are waiting for the business
        follow_up  a price went out 2+ days ago and nothing came back
        check_in   the business answered 3+ days ago and it went quiet

    Pure, for tests."""
    stage, waited = card.get("stage"), _days_since(card.get("last_at"), now_iso)
    if stage == "new" or (stage == "replied" and card.get("last_from_customer")):
        return "answer"
    if stage == "quoted" and waited >= 2:
        return "follow_up"
    if stage == "replied" and waited >= 3:
        return "check_in"
    return None


async def found_requests(biz: dict[str, Any], gigs: dict[str, str]) -> list[dict[str, Any]]:
    """New leads to go and get: open posts on the Requests board from people
    looking for what this business does (its categories and its listings'
    categories), newest first, the business's own area first. Only the public
    shape (requests._public): no phone, no email; the business answers on the
    request page, in chat."""
    from .requests import _poster_identity, _public
    cats = set(biz.get("categories") or [])
    if gigs:
        cats |= {g.get("category") async for g in db.marketplace_gigs.find({"_id": {"$in": list(gigs)}}, {"category": 1}) if g.get("category")}
    if not cats:
        return []
    since = (datetime.now(UTC) - timedelta(days=30)).isoformat()
    docs = await db.requests.find({"status": "open", "hidden_by_admin": {"$ne": True}, "category": {"$in": list(cats)},
                                   "post_kind": {"$ne": "have"}, "poster_user_id": {"$ne": biz.get("owner_user_id")},
                                   "created_at": {"$gte": since}}).sort("created_at", -1).limit(30).to_list(30)
    areas = {a.lower() for a in (biz.get("areas") or []) if isinstance(a, str)}
    docs.sort(key=lambda d: (str(d.get("area") or "").lower() not in areas))   # stable: area first, still newest first
    ids = await _poster_identity([d["poster_user_id"] for d in docs if d.get("poster_user_id")])
    keep = ("id", "title", "description", "area", "category", "budget_type", "budget_amount", "budget_currency",
            "preferred_date", "created_at", "poster_display_name", "poster_verified")
    return [{k: p.get(k) for k in keep} for p in (_public(d, ids.get(d.get("poster_user_id"))) for d in docs[:12])]


DraftGoal = Literal["answer", "follow_up", "check_in", "win_back", "introduce"]
_GOAL_TEXT = {
    "answer": "Reply to their enquiry: answer what they asked and offer one clear next step (a time, a price, a question that moves it on).",
    "follow_up": "Follow up on the price that was sent and got no answer. Friendly, no pressure, make it easy to say yes or ask a question.",
    "check_in": "Check in after the conversation went quiet. Short, helpful, one easy question to restart it.",
    "win_back": "They decided not to go ahead. Thank them, leave the door open, and offer one reason to come back. No guilt.",
    "introduce": "They posted publicly that they are looking for this. Introduce the business as the answer to exactly what they asked for, and suggest a next step.",
}
_DRAFT_SYSTEM = """You write short, personal messages that a small business owner in Israel copies and sends to one potential customer.
Rules:
- Write as the business, in first person ("we" or "I"), warm and human, like a real person typed it. Not salesy, no hype words.
- Make it specific to what this person asked for. Mention their actual need in the first line.
- Use ONLY facts from BUSINESS FACTS and the LEAD. Never invent prices, dates, discounts, guarantees or experience.
- 50 to 110 words. Plain text. No emojis, no hashtags, no long dashes (use a comma or a full stop), no placeholders in brackets.
- End with one clear, easy next step. Sign off with the business name only, never a person's name.
Return ONLY JSON: {"subject": "<email subject, under 60 characters>", "body": "<the message>"}"""


def parse_draft(raw: str) -> dict[str, str]:
    """{"subject", "body"} from the model's reply, long dashes swapped for
    commas (brand/voice.md bans them). Empty when unreadable. Pure, for tests."""
    import json
    import re
    m = re.search(r"\{.*\}", raw or "", re.S)
    try:
        d = json.loads(m.group(0)) if m else {}
    except ValueError:
        d = {}
    clean = lambda s: re.sub(r"\s*[—–]\s*", ", ", str(s or "")).strip()  # noqa: E731
    return {"subject": clean(d.get("subject"))[:120], "body": clean(d.get("body"))[:2000]}


class DraftIn(BaseModel):
    key: Optional[str] = Field(None, max_length=200)
    request_id: Optional[str] = Field(None, max_length=80)
    goal: DraftGoal = "answer"
    lang: Literal["en", "he"] = "en"
    extra: str = Field("", max_length=300)


@router.post("/businesses/{business_id}/leads/write")
async def draft_message(business_id: str, body: DraftIn, request: Request, user=Depends(verify_token)):
    """A personal message for one lead, written by Claude from what the
    business published and what the lead asked, for the owner to read, edit,
    copy and send themselves. Nothing is sent from here."""
    biz = await _owned(business_id, user)
    check_rate(request, bucket="lead-draft-biz-day", limit=80, window_seconds=86400, key_extra=business_id, ip_agnostic=True)
    if body.request_id:
        r = await db.requests.find_one({"_id": body.request_id, "status": "open", "hidden_by_admin": {"$ne": True}})
        if not r:
            raise HTTPException(status_code=404, detail="That request is no longer open")
        lead = {"posted_on_requests_board": r.get("title"), "details": (r.get("description") or "")[:800],
                "area": r.get("area"), "wanted_date": r.get("preferred_date"),
                "budget": r.get("budget_amount") if r.get("budget_type") == "fixed" else r.get("budget_type")}
    elif body.key:
        board = await leads_board(business_id, user)
        c = next((x for x in board["leads"] if x["key"] == body.key), None)
        if not c:
            raise HTTPException(status_code=404, detail="Lead not found")
        lead = {"name": c.get("name"), "about": c.get("title"), "their_last_message": c.get("last_text"),
                "stage": c.get("stage"), "price_we_sent_ils": c.get("price"), "last_contact": c.get("last_at")}
    else:
        raise HTTPException(status_code=422, detail="Choose a lead")

    from routes.deps import ANTHROPIC_API_KEY
    from utils.llm import LlmChat, UserMessage
    from .ask import facts_for
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="Message writing is not available right now")
    import json
    prompt = (f"Write in {'Hebrew' if body.lang == 'he' else 'English'}.\n\nGOAL: {_GOAL_TEXT[body.goal]}\n\n"
              f"BUSINESS FACTS:\n{await facts_for(biz)}\n\nLEAD:\n{json.dumps(lead, ensure_ascii=False, default=str)}"
              + (f"\n\nTHE OWNER ALSO WANTS: {body.extra.strip()}" if body.extra.strip() else ""))
    chat = LlmChat(api_key=ANTHROPIC_API_KEY, session_id=str(uuid.uuid4()), system_message=_DRAFT_SYSTEM)
    # Sonnet, as in ask.py: Haiku's Hebrew came back with broken words.
    chat.with_model("anthropic", "claude-sonnet-4-6").with_params(max_tokens=700)
    try:
        out = parse_draft(await chat.send_message(UserMessage(text=prompt)))
    except Exception as exc:  # noqa: BLE001 - the owner can still write it themselves
        raise HTTPException(status_code=502, detail="Could not write it right now. Try again.") from exc
    if not out["body"]:
        raise HTTPException(status_code=502, detail="Could not write it right now. Try again.")
    return out


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
    email: Optional[str] = Field(None, max_length=120)
    note: str = Field("", max_length=300)
    stage: Stage = "new"


@router.post("/businesses/{business_id}/leads")
async def add_lead(business_id: str, body: LeadIn, user=Depends(verify_token)):
    await _owned(business_id, user)
    if await db.leads.count_documents({"business_id": business_id}) >= 1000:
        raise HTTPException(status_code=400, detail="Up to 1,000 leads you add yourself. Delete some old ones first.")
    now = datetime.now(UTC).isoformat()
    doc = {"_id": str(uuid.uuid4()), "business_id": business_id, "name": body.name.strip(), "phone": (body.phone or "").strip() or None,
           "email": (body.email or "").strip() or None,
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
