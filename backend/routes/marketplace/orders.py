"""Store orders — phase 1 of docs/orders-and-delivery-spec.md (O1 + O2).

What a store owner types when a customer says "two challahs for Friday",
laid out where staff can read it. This replaces the Google Sheet these
businesses pass around; nothing here is a checkout, a cart or a catalogue.

Design facts, from the spec, that this module is built around:

  * **Entry is the product.** The record is the minimum that beats a sheet
    row: name, phone, free-text items, when it is needed, pickup or
    delivery, address, notes. `items` is deliberately free text — a
    product picker on day one is the setup step that sends owners back to
    the sheet, and `ProductItem` has no id to point at anyway.
  * **Money is recorded, never moved.** `total` is the store's own
    bookkeeping of a payment that happens between two people — cash at
    the counter, Bit, whatever they agreed. We store the figure they type
    and never compute, hold, charge or transfer anything. This is the
    first money figure the marketplace stores; keep that line bright
    (compare the escrow disclaimer in shared.py).
  * **Four statuses, two exits, transitions enforced.** `new → preparing →
    ready → done`; `cancelled` from any open state; `failed` only from
    `ready`, only for a delivery. `marketplace_bookings` accepts any status
    from any status and the spec names that as the thing not to copy.
    One step BACK (`preparing → new`, `ready → preparing`) is also allowed:
    the board is used one-handed on a phone and a mis-tap needs an undo
    that is not "cancel and retype the order".
  * **Paste beats typing.** `/extract` turns a pasted WhatsApp message into
    a draft the form fills from. It stores nothing — the owner corrects
    and saves through the normal create. One small model call, and the
    form stays fully usable if it fails.

Deliberately NOT here yet (later phases of the same spec): couriers and
assignment (O5), money at the door and the customer-phone rule (O6), the
customer status link (O7), cutoffs and standing orders (O8). No field for
any of them exists on the record until the surface that uses it does —
an unread field on a model is exactly what the dead-ends audit flags.
"""
from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timedelta
from typing import Any, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator, model_validator

from routes.deps import db, logger, verify_token
from utils.rate_limit import check_rate
from utils.whatsapp_link import normalize_whatsapp_number

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

# The store's clock. `needed_by` is stored as a NAIVE local timestamp
# ("2026-09-11T14:00") in this zone: it is what the customer said and what
# the counter reads, and a UTC conversion would put a Friday-afternoon
# order on Friday morning for anyone reading the raw record.
_IL_TZ = ZoneInfo("Asia/Jerusalem")

STATUSES = ("new", "preparing", "ready", "done", "cancelled", "failed")
OPEN_STATUSES = ("new", "preparing", "ready")

# From -> the set it may become. Forward, one step back, and the exits.
_TRANSITIONS: dict[str, set[str]] = {
    "new": {"preparing", "cancelled"},
    "preparing": {"ready", "new", "cancelled"},
    "ready": {"done", "preparing", "cancelled", "failed"},
    "done": set(),
    "cancelled": set(),
    "failed": set(),
}

_NEEDED_BY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$")
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

MAX_ITEMS_CHARS = 2000
MAX_PASTE_CHARS = 4000


def _clean_needed_by(value: str) -> str:
    """Accept `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM` and reject things that only
    look like a date. A date with no time STAYS date-only: the board sorts
    it first that day and shows no time, which is honest about what the
    owner actually knew."""
    text = (value or "").strip()
    if not _NEEDED_BY_RE.match(text):
        raise ValueError("needed_by must be YYYY-MM-DD or YYYY-MM-DDTHH:MM")
    try:
        if "T" in text:
            datetime.strptime(text, "%Y-%m-%dT%H:%M")
        else:
            datetime.strptime(text, "%Y-%m-%d")
    except ValueError as exc:
        raise ValueError("needed_by is not a real date/time") from exc
    return text


class OrderIn(BaseModel):
    customer_name: str = Field(..., min_length=1, max_length=120)
    customer_phone: Optional[str] = Field(None, max_length=40)
    items: str = Field(..., min_length=1, max_length=MAX_ITEMS_CHARS)
    # The store's own figure, in ILS. Optional: a regular who "pays the
    # usual" has no number at entry time. Never computed by us.
    total: Optional[float] = Field(None, ge=0, le=1_000_000)
    needed_by: str
    fulfilment: str = Field("pickup", pattern="^(pickup|delivery)$")
    address: Optional[str] = Field(None, max_length=400)
    notes: str = Field("", max_length=1000)
    source: str = Field("manual", pattern="^(manual|chat|assistant|whatsapp_paste)$")

    @field_validator("customer_name", "items", "notes", "address", "customer_phone")
    @classmethod
    def _strip(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("needed_by")
    @classmethod
    def _needed_by(cls, v):
        return _clean_needed_by(v)

    @model_validator(mode="after")
    def _delivery_needs_address(self):
        if self.fulfilment == "delivery":
            if not self.address:
                raise ValueError("A delivery order needs an address")
            if not self.customer_phone:
                raise ValueError("A delivery order needs the customer's phone")
        return self


class OrderPatch(BaseModel):
    """Field edits. Status is NOT here — it goes through /status so the
    transition guard cannot be bypassed by an edit."""
    customer_name: Optional[str] = Field(None, min_length=1, max_length=120)
    customer_phone: Optional[str] = Field(None, max_length=40)
    items: Optional[str] = Field(None, min_length=1, max_length=MAX_ITEMS_CHARS)
    total: Optional[float] = Field(None, ge=0, le=1_000_000)
    needed_by: Optional[str] = None
    fulfilment: Optional[str] = Field(None, pattern="^(pickup|delivery)$")
    address: Optional[str] = Field(None, max_length=400)
    notes: Optional[str] = Field(None, max_length=1000)
    # Explicitly blank the total ("actually, no price yet").
    clear_total: bool = False

    @field_validator("customer_name", "items", "notes", "address", "customer_phone")
    @classmethod
    def _strip(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("needed_by")
    @classmethod
    def _needed_by(cls, v):
        return _clean_needed_by(v) if v is not None else v


class StatusIn(BaseModel):
    status: str = Field(..., pattern="^(new|preparing|ready|done|cancelled|failed)$")
    # Failed deliveries get a reason in O5; until then a free note is the
    # only record. Optional and short.
    note: str = Field("", max_length=300)


class ExtractIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=MAX_PASTE_CHARS)


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

async def _owned_business(business_id: str, user: dict[str, Any]) -> dict[str, Any]:
    """Same rule as businesses.py: the owner, or an admin. Kept local so
    this module does not import a sibling router's private helper."""
    biz = await db.businesses.find_one({"_id": business_id})
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    if biz.get("owner_user_id") != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not your business")
    return biz


async def _owned_order(order_id: str, user: dict[str, Any]) -> dict[str, Any]:
    order = await db.store_orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("owner_user_id") != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not your order")
    return order


def _public(order: dict[str, Any]) -> dict[str, Any]:
    out = dict(order)
    out["id"] = out.pop("_id")
    out.pop("owner_user_id", None)
    return out


def _phone_fields(raw: Optional[str]) -> dict[str, Any]:
    """The number as typed, for display, plus E.164 digits when they can
    be derived, for `tel:` and WhatsApp links. A number that cannot be
    normalised is kept — the owner can still read it — but gets no link,
    for the same reason normalize_whatsapp_number refuses to guess."""
    text = (raw or "").strip() or None
    return {
        "customer_phone": text,
        "customer_phone_e164": normalize_whatsapp_number(text) if text else None,
    }


def _now_iso() -> str:
    return datetime.now(_IL_TZ).replace(microsecond=0).isoformat()


def can_transition(current: str, new: str, fulfilment: str) -> bool:
    """The one place the status rules live. Pure, so it is testable
    without a database."""
    if new not in _TRANSITIONS.get(current, set()):
        return False
    if new == "failed" and fulfilment != "delivery":
        return False
    return True


async def ensure_order_indexes() -> None:
    """The board reads one business's orders by day; the counters read
    them by status. Both are covered by (business_id, needed_by) plus
    (business_id, status). Logged and swallowed on failure like the
    booking index: the queries still work, just slower."""
    try:
        await db.store_orders.create_index([("business_id", 1), ("needed_by", 1)], background=True)
        await db.store_orders.create_index([("business_id", 1), ("status", 1)], background=True)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[orders] index creation failed: %s", exc)


# ---------------------------------------------------------------------------
# endpoints
# ---------------------------------------------------------------------------

@router.get("/businesses/{business_id}/orders")
async def list_orders(
    business_id: str,
    status: Optional[str] = Query(None, pattern="^(new|preparing|ready|done|cancelled|failed|open)$"),
    date_from: Optional[str] = Query(None, alias="from"),
    date_to: Optional[str] = Query(None, alias="to"),
    limit: int = Query(300, ge=1, le=1000),
    user=Depends(verify_token),
):
    """Orders for one business, soonest `needed_by` first.

    `status=open` is the working set (new/preparing/ready). `from`/`to`
    are inclusive dates against `needed_by`. `status_counts` is computed
    over the SAME date window so the pills on the board are counters for
    what is on screen, not for all time.
    """
    await _owned_business(business_id, user)
    q: dict[str, Any] = {"business_id": business_id}
    if date_from or date_to:
        rng: dict[str, str] = {}
        if date_from:
            if not _DATE_RE.match(date_from):
                raise HTTPException(status_code=400, detail="from must be YYYY-MM-DD")
            rng["$gte"] = date_from
        if date_to:
            if not _DATE_RE.match(date_to):
                raise HTTPException(status_code=400, detail="to must be YYYY-MM-DD")
            # A date-only needed_by of the last day sorts before
            # "<day>T00:00"; U+FFFF catches every time on that day.
            rng["$lte"] = date_to + "￿"
        q["needed_by"] = rng

    counts: dict[str, int] = {s: 0 for s in STATUSES}
    async for row in db.store_orders.aggregate([
        {"$match": q},
        {"$group": {"_id": "$status", "n": {"$sum": 1}}},
    ]):
        if row["_id"] in counts:
            counts[row["_id"]] = row["n"]

    if status == "open":
        q["status"] = {"$in": list(OPEN_STATUSES)}
    elif status:
        q["status"] = status

    docs = [
        _public(d)
        async for d in db.store_orders.find(q).sort([("needed_by", 1), ("created_at", 1)]).limit(limit)
    ]
    return {"orders": docs, "status_counts": counts, "total": sum(counts.values())}


@router.post("/businesses/{business_id}/orders")
async def create_order(business_id: str, payload: OrderIn, user=Depends(verify_token)):
    biz = await _owned_business(business_id, user)
    now = _now_iso()
    doc = {
        "_id": str(uuid.uuid4()),
        "business_id": business_id,
        # Denormalised so an order can be authorised without a second
        # lookup, and so a business handed to another owner (spec:
        # owner-sharing) keeps its history attributable.
        "owner_user_id": biz["owner_user_id"],
        "customer_name": payload.customer_name,
        **_phone_fields(payload.customer_phone),
        "items": payload.items,
        "total": payload.total,
        "currency": "ILS",
        "needed_by": payload.needed_by,
        "fulfilment": payload.fulfilment,
        "address": payload.address if payload.fulfilment == "delivery" else None,
        "notes": payload.notes,
        "status": "new",
        "source": payload.source,
        "created_by": user["user_id"],
        "created_at": now,
        "updated_at": now,
        "status_changed_at": now,
        "history": [{"status": "new", "at": now, "by": user["user_id"]}],
    }
    await db.store_orders.insert_one(doc)
    logger.info("[orders] created: business=%s order=%s source=%s", business_id, doc["_id"], payload.source)
    return _public(doc)


@router.patch("/orders/{order_id}")
async def update_order(order_id: str, payload: OrderPatch, user=Depends(verify_token)):
    order = await _owned_order(order_id, user)
    if order["status"] in ("done", "cancelled", "failed"):
        raise HTTPException(status_code=409, detail="This order is closed and cannot be edited")

    update: dict[str, Any] = {}
    for field in ("customer_name", "items", "notes", "needed_by", "fulfilment"):
        v = getattr(payload, field)
        if v is not None:
            update[field] = v
    if payload.customer_phone is not None:
        update.update(_phone_fields(payload.customer_phone))
    if payload.clear_total:
        update["total"] = None
    elif payload.total is not None:
        update["total"] = payload.total
    if payload.address is not None:
        update["address"] = payload.address or None

    merged = {**order, **update}
    if merged["fulfilment"] == "delivery":
        if not merged.get("address"):
            raise HTTPException(status_code=400, detail="A delivery order needs an address")
        if not merged.get("customer_phone"):
            raise HTTPException(status_code=400, detail="A delivery order needs the customer's phone")
    else:
        update["address"] = None

    if not update:
        return _public(order)
    update["updated_at"] = _now_iso()
    await db.store_orders.update_one({"_id": order_id}, {"$set": update})
    fresh = await db.store_orders.find_one({"_id": order_id})
    return _public(fresh)


@router.patch("/orders/{order_id}/status")
async def set_order_status(order_id: str, payload: StatusIn, user=Depends(verify_token)):
    """Move an order along. Refuses anything the transition table does
    not allow, with the current state in the message so the client can
    refresh rather than retry."""
    order = await _owned_order(order_id, user)
    current = order["status"]
    if payload.status == current:
        return _public(order)
    if not can_transition(current, payload.status, order.get("fulfilment", "pickup")):
        raise HTTPException(
            status_code=409,
            detail=f"An order that is '{current}' cannot become '{payload.status}'",
        )
    now = _now_iso()
    entry: dict[str, Any] = {"status": payload.status, "at": now, "by": user["user_id"]}
    if payload.note:
        entry["note"] = payload.note
    await db.store_orders.update_one(
        {"_id": order_id},
        {
            "$set": {"status": payload.status, "status_changed_at": now, "updated_at": now},
            "$push": {"history": entry},
        },
    )
    fresh = await db.store_orders.find_one({"_id": order_id})
    return _public(fresh)


@router.get("/businesses/{business_id}/customers")
async def returning_customers(
    business_id: str,
    q: str = Query("", max_length=80),
    limit: int = Query(8, ge=1, le=50),
    user=Depends(verify_token),
):
    """Names to autocomplete from — spec O2, "returning customer".

    Derived from this business's own orders, nothing else: there is no
    customer table and no cross-business lookup. Grouped by normalised
    phone when there is one, else by name, so "Idan" and "idan" with the
    same number are one person. Most recent order wins for the address.
    """
    await _owned_business(business_id, user)
    needle = q.strip().lower()
    pipeline: list[dict[str, Any]] = [
        {"$match": {"business_id": business_id}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": {"$ifNull": ["$customer_phone_e164", {"$toLower": "$customer_name"}]},
            "customer_name": {"$first": "$customer_name"},
            "customer_phone": {"$first": "$customer_phone"},
            "address": {"$first": "$address"},
            "last_items": {"$first": "$items"},
            "orders": {"$sum": 1},
            "last_at": {"$first": "$created_at"},
        }},
        {"$sort": {"last_at": -1}},
        {"$limit": 400},
    ]
    rows = [r async for r in db.store_orders.aggregate(pipeline)]
    if needle:
        rows = [
            r for r in rows
            if needle in (r.get("customer_name") or "").lower()
            or needle in "".join(ch for ch in (r.get("customer_phone") or "") if ch.isdigit())
        ]
    out = []
    for r in rows[:limit]:
        out.append({
            "customer_name": r.get("customer_name"),
            "customer_phone": r.get("customer_phone"),
            "address": r.get("address"),
            "last_items": r.get("last_items"),
            "orders": r.get("orders", 0),
        })
    return out


# ---------------------------------------------------------------------------
# paste → draft
# ---------------------------------------------------------------------------

_EXTRACT_SYSTEM = """You read ONE message a customer sent to a small Israeli shop (bakery, caterer, florist, grocer...) and turn it into an order draft. The message may be Hebrew, English, or mixed.

Return ONLY a JSON object with these keys. Omit a key when the message does not say; never invent.

customer_name   string — the customer's name if they give one (e.g. a sign-off, "this is Idan", "מדבר יוסי").
customer_phone  string — a phone number exactly as written.
items           string — what they want, one line per item, quantity first, e.g. "2 challahs\\n1 chocolate babka". Keep the customer's own words for the products.
total           number — only if the message states a total price in shekels.
needed_by       string — "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM" in Israel local time. Resolve relative words ("Friday", "tomorrow", "ערב שבת", "מחר") against TODAY given below. "Friday" means the coming Friday; if today is Friday and no time has passed, it means today. When only a day is given, omit the time.
fulfilment      "delivery" if they ask for it to be brought/delivered/משלוח, "pickup" if they say they will collect/איסוף. Omit if unclear.
address         string — a street address if delivery. Keep it as written.
notes           string — anything else that matters for preparing it: allergies, "no nuts", "leave with the neighbour", gift wrapping.

Rules:
- Quantities: "2 challahs" → items "2 challahs". "a babka" → "1 babka".
- Do not put the address, phone or time into `items` or `notes`.
- No markdown, no code fences, no commentary. JSON only."""


def parse_extract_response(raw: str) -> dict[str, Any]:
    """Model text → the subset of keys the form accepts, validated the
    same way a manual entry is. Anything malformed is dropped rather than
    passed through: the draft only ever contains values the create
    endpoint would have accepted."""
    cleaned = (raw or "").strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```", 2)[1]
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip().strip("`").strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        return {}
    if not isinstance(data, dict):
        return {}

    draft: dict[str, Any] = {}
    for key, cap in (
        ("customer_name", 120), ("customer_phone", 40), ("items", MAX_ITEMS_CHARS),
        ("address", 400), ("notes", 1000),
    ):
        v = data.get(key)
        if isinstance(v, str) and v.strip():
            draft[key] = v.strip()[:cap]
    total = data.get("total")
    if isinstance(total, (int, float)) and not isinstance(total, bool) and 0 <= total <= 1_000_000:
        draft["total"] = float(total)
    nb = data.get("needed_by")
    if isinstance(nb, str):
        try:
            draft["needed_by"] = _clean_needed_by(nb)
        except ValueError:
            pass
    ful = data.get("fulfilment")
    if ful in ("pickup", "delivery"):
        draft["fulfilment"] = ful
    return draft


@router.post("/businesses/{business_id}/orders/extract")
async def extract_order(business_id: str, payload: ExtractIn, request: Request, user=Depends(verify_token)):
    """A pasted WhatsApp message → a draft for the form. Stores nothing.

    Small model, small cap: the input is one chat message and the output
    is a handful of fields. Rate-limited per user because each call is
    real (if tiny) spend and the endpoint takes free text.
    """
    await _owned_business(business_id, user)
    check_rate(request, bucket="order_extract", limit=60, window_seconds=3600,
               key_extra=user["user_id"], ip_agnostic=True)

    from routes.deps import ANTHROPIC_API_KEY
    from utils.llm import LlmChat, UserMessage

    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="Message reading is not available right now")

    today = datetime.now(_IL_TZ)
    context = (
        f"TODAY is {today.strftime('%A')} {today.date().isoformat()} {today.strftime('%H:%M')} (Israel).\n"
        f"Tomorrow is {(today + timedelta(days=1)).date().isoformat()}.\n\n"
        f"Customer message:\n{payload.text.strip()}"
    )
    chat = LlmChat(api_key=ANTHROPIC_API_KEY, session_id=str(uuid.uuid4()), system_message=_EXTRACT_SYSTEM)
    # Haiku, as the spec asks: one message in, eight fields out.
    chat.with_model("anthropic", "claude-haiku-4-5").with_params(max_tokens=1024)
    try:
        raw = await chat.send_message(UserMessage(text=context))
    except Exception as exc:  # noqa: BLE001 — the form must stay usable
        logger.warning("[orders] extract failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not read that message — fill the form by hand") from exc

    draft = parse_extract_response(raw)
    if not draft:
        raise HTTPException(status_code=502, detail="Could not read that message — fill the form by hand")
    draft["source"] = "whatsapp_paste"
    return {"draft": draft}
