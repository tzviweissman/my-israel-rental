"""Ask this business (Tzvi, 24 Oct 2026, from GoHighLevel's website chat
assistant): a visitor types a question on a business page and gets an
answer straight away, at night and on Friday afternoon too.

  * Answers ONLY from what the business has put on the site: its page
    details, its services, prices, products and FAQs. The model is told to
    say it does not know rather than guess, and anything it is not sure of
    comes back `known: false`.
  * Then the visitor can pass the question on (`/ask/forward`): it lands
    on the business's leads board as a new lead, with their name and a
    phone or email, and rings the owner's bell. No sign-in, like ordering.
  * Nothing is promised in the business's name: no prices, times or
    deliveries beyond what it wrote.
  * Rate limited per visitor and per business, because every answer costs
    a call to Claude.
"""
from __future__ import annotations

import json
import re
import uuid
from datetime import UTC, datetime
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from routes.deps import db, logger
from utils.rate_limit import check_rate

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

FACTS_CHARS = 14000

_SYSTEM = (
    "You answer a customer's question on behalf of one small business in Israel, using ONLY the FACTS given "
    "(the business's own page details, services, prices, products and FAQs). "
    "Rules: answer in 1 to 3 short, friendly sentences, in the language named in the request. "
    "Never invent or guess anything: prices, opening times, delivery areas, kashrut, availability, stock or policies "
    "that are not in the FACTS. Never promise anything. If the FACTS do not clearly answer the question, say briefly "
    "that you are not sure and that the business can answer it, and set known to false. "
    "If the question is not about this business, say you can only help with questions about it, known false. "
    "No long dashes, no emoji. "
    'Reply with JSON only: {"answer": "...", "known": true or false}'
)


def _pick(d: dict[str, Any], keys: tuple[str, ...]) -> dict[str, Any]:
    return {k: d[k] for k in keys if d.get(k) not in (None, "", [], {})}


async def facts_for(biz: dict[str, Any]) -> str:
    """What the business itself published, compact, as JSON text."""
    from .businesses import shabbat_public_view
    page = _pick(biz, ("name", "name_he", "description", "description_he", "categories", "areas", "serves_nationwide",
                       "hours", "by_appointment", "languages", "delivery_note", "lead_time", "payment_note",
                       "order_cutoffs", "kosher_certification"))
    page["closed_for_shabbat_and_holidays"] = shabbat_public_view(biz)
    os_ = _pick(biz.get("order_settings") or {}, ("windows", "delivery_fee", "min_order"))
    if os_:
        page["ordering"] = os_
    services = []
    async for g in db.marketplace_gigs.find({"business_id": biz["_id"], "status": "published"}).sort("created_at", -1).limit(40):
        s = _pick(g, ("title", "title_he", "description", "description_en", "description_he", "category", "area"))
        if g.get("tiers"):
            s["prices"] = [_pick(t, ("name", "price", "description")) for t in g["tiers"][:10]]
        if g.get("products"):
            s["products"] = [_pick(p, ("name", "price", "currency", "description", "in_stock")) for p in g["products"][:60]]
        if g.get("faqs"):
            s["faqs"] = g["faqs"][:20]
        services.append(s)
    page["services"] = services
    return json.dumps(page, ensure_ascii=False, default=str)[:FACTS_CHARS]


def parse_answer(raw: str) -> dict[str, Any]:
    """{"answer", "known"} from the model's reply; anything unreadable is
    treated as not known. Pure, for tests."""
    m = re.search(r"\{.*\}", raw or "", re.S)
    try:
        d = json.loads(m.group(0)) if m else {}
    except ValueError:
        d = {}
    answer = str(d.get("answer") or "").strip().replace("—", ",").replace("–", ",")
    return {"answer": answer[:800], "known": bool(d.get("known")) and bool(answer)}


async def _business(slug_or_id: str) -> dict[str, Any]:
    from .businesses import _resolve
    biz = await _resolve(slug_or_id)
    if not biz or not biz.get("active", True) or not await db.marketplace_gigs.find_one(
            {"business_id": biz["_id"], "status": "published"}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Business not found")
    return biz


class AskIn(BaseModel):
    question: str = Field(..., min_length=3, max_length=300)
    lang: Literal["en", "he"] = "en"


@router.post("/business/{slug_or_id}/ask")
async def ask(slug_or_id: str, body: AskIn, request: Request):
    biz = await _business(slug_or_id)
    check_rate(request, bucket="ask-ip-hour", limit=15, window_seconds=3600)
    check_rate(request, bucket="ask-ip-day", limit=40, window_seconds=86400)
    check_rate(request, bucket="ask-biz-day", limit=300, window_seconds=86400, key_extra=biz["_id"], ip_agnostic=True)

    from routes.deps import ANTHROPIC_API_KEY
    from utils.llm import LlmChat, UserMessage
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="Questions are not available right now")
    lang = "Hebrew" if body.lang == "he" else "English"
    prompt = f"Answer in {lang}.\n\nFACTS:\n{await facts_for(biz)}\n\nCUSTOMER QUESTION:\n{body.question.strip()}"
    chat = LlmChat(api_key=ANTHROPIC_API_KEY, session_id=str(uuid.uuid4()), system_message=_SYSTEM)
    # Sonnet: Haiku's Hebrew came back with broken words (review drafts, 24 Oct).
    chat.with_model("anthropic", "claude-sonnet-4-6").with_params(max_tokens=400)
    try:
        out = parse_answer(await chat.send_message(UserMessage(text=prompt)))
    except Exception as exc:  # noqa: BLE001 - the page's message button still works
        logger.warning("[ask] failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not answer right now") from exc
    if not out["answer"]:
        raise HTTPException(status_code=502, detail="Could not answer right now")
    return out


class ForwardIn(BaseModel):
    question: str = Field(..., min_length=3, max_length=300)
    name: str = Field(..., min_length=1, max_length=80)
    contact: str = Field(..., min_length=5, max_length=80)


@router.post("/business/{slug_or_id}/ask/forward")
async def forward(slug_or_id: str, body: ForwardIn, request: Request):
    """The question goes to the business as a new lead (leads.py)."""
    biz = await _business(slug_or_id)
    check_rate(request, bucket="ask-forward-ip", limit=10, window_seconds=86400)
    contact = body.contact.strip()
    is_email = "@" in contact
    if not (is_email or len(re.sub(r"\D", "", contact)) >= 7):
        raise HTTPException(status_code=422, detail="Give a phone number or an email address")
    owner = await db.users.find_one({"id": biz.get("owner_user_id")}, {"preferred_language": 1}) or {}
    he = (owner.get("preferred_language") or "").startswith("he")
    note = f"{'שאלו בדף שלכם' if he else 'Asked on your page'}: {body.question.strip()}"
    if is_email:
        note += f" ({'מייל' if he else 'email'}: {contact})"
    now = datetime.now(UTC).isoformat()
    lead_id = str(uuid.uuid4())
    await db.leads.insert_one({"_id": lead_id, "business_id": biz["_id"], "name": body.name.strip(),
                               "phone": None if is_email else contact, "note": note[:300], "stage": "new",
                               "by": "ask", "created_at": now, "updated_at": now})
    if biz.get("owner_user_id"):
        await db.notifications.insert_one({"id": str(uuid.uuid4()), "user_id": biz["owner_user_id"], "type": "lead",
                                           "action_url": "/dashboard?tab=customers&view=leads",
                                           "message": f"{'שאלה חדשה מ' if he else 'New question from '}{body.name.strip()}: {body.question.strip()[:80]}",
                                           "read": False, "created_at": now})
    return {"ok": True}
