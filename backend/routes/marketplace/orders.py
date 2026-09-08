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

Later phases of the same spec live further down this file: the staff
link, export and import (O3, O9), couriers, the run sheet, money at the
door and the customer-phone rule (O5, O6), the customer's status link
(O7), and cutoffs plus standing orders (O8).
"""
from __future__ import annotations

import csv
import io
import json
import os
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator, model_validator

from routes.deps import db, logger, optional_user, verify_token
from utils.rate_limit import check_rate
from utils.whatsapp_link import normalize_whatsapp_number

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

# The store's clock. `needed_by` is stored as a NAIVE local timestamp
# ("2026-09-11T14:00") in this zone: it is what the customer said and what
# the counter reads, and a UTC conversion would put a Friday-afternoon
# order on Friday morning for anyone reading the raw record.
_IL_TZ = ZoneInfo("Asia/Jerusalem")

STATUSES = ("new", "preparing", "ready", "done", "cancelled", "failed")
_CURRENCY_SYMBOL = {"ILS": "₪", "USD": "$", "EUR": "€", "GBP": "£"}
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
    source: str = Field("manual", pattern="^(manual|chat|assistant|whatsapp_paste)$")   # "standing" is set by the generator only

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
        await db.businesses.create_index("orders_staff_token", sparse=True, background=True)
        await db.businesses.create_index("couriers.token", sparse=True, background=True)
        await db.store_orders.create_index([("business_id", 1), ("courier.id", 1)], background=True)
        await db.store_orders.create_index("track_token", sparse=True, background=True)
        # One generated order per standing order per date, even if two
        # requests generate at once.
        await db.store_orders.create_index(
            [("standing_id", 1), ("occurrence_date", 1)], unique=True, sparse=True, background=True,
        )
        await db.store_standing_orders.create_index([("business_id", 1), ("active", 1)], background=True)
        await db.store_customers.create_index([("business_id", 1), ("key", 1)], unique=True, background=True)
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
    await generate_standing_orders(business_id)
    return await _list(business_id, status, date_from, date_to, limit)


async def _list(
    business_id: str,
    status: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    limit: int,
) -> dict[str, Any]:
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

    docs = []
    async for d in db.store_orders.find(q).sort([("needed_by", 1), ("created_at", 1)]).limit(limit):
        if not d.get("track_token"):
            # Orders from before the status link existed get one the
            # first time the owner looks at them. One write, once.
            d["track_token"] = secrets.token_urlsafe(16)
            await db.store_orders.update_one({"_id": d["_id"]}, {"$set": {"track_token": d["track_token"]}})
        docs.append(_public(d))
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
        "courier": None,
        "assigned_at": None,
        "created_by": user["user_id"],
        "created_at": now,
        "updated_at": now,
        "status_changed_at": now,
        "history": [{"status": "new", "at": now, "by": user["user_id"]}],
        # The customer's status link (spec O7). Minted with the order so
        # the owner can send it from the chat thread in the same breath.
        "track_token": secrets.token_urlsafe(16),
    }
    await db.store_orders.insert_one(doc)
    logger.info("[orders] created: business=%s order=%s source=%s", business_id, doc["_id"], payload.source)
    doc = await auto_assign(doc, biz)
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
    return await _transition(order, payload, by=user["user_id"])


async def _transition(order: dict[str, Any], payload: StatusIn, *, by: str) -> dict[str, Any]:
    current = order["status"]
    if payload.status == current:
        return _public(order)
    if not can_transition(current, payload.status, order.get("fulfilment", "pickup")):
        raise HTTPException(
            status_code=409,
            detail=f"An order that is '{current}' cannot become '{payload.status}'",
        )
    now = _now_iso()
    entry: dict[str, Any] = {"status": payload.status, "at": now, "by": by}
    if payload.note:
        entry["note"] = payload.note
    await db.store_orders.update_one(
        {"_id": order["_id"]},
        {
            "$set": {"status": payload.status, "status_changed_at": now, "updated_at": now},
            "$push": {"history": entry},
        },
    )
    fresh = await db.store_orders.find_one({"_id": order["_id"]})
    return _public(fresh)


# ---------------------------------------------------------------------------
# the shared staff link (spec O3)
# ---------------------------------------------------------------------------
#
# The sheet's second job, the one nobody names: it is the screen the person
# at the counter has open. Without a way for staff to see the day without
# the owner's login, the sheet stays open "just in case" and the migration
# never finishes. So: one link per business, no account, read the board
# and move orders along. Not create, not edit, not export - the counter
# reads and ticks; the owner types. (Creating from the counter is a likely
# follow-up; it is not in the spec's O3 and it widens what a leaked link
# can do, so it waits for a real ask.)
#
# The token is a capability. It lives on the business document in the
# clear so the owner can re-open the same link next week; rotating it
# replaces it and every old copy stops working at once. The rate limit is
# per IP and generous - a counter refreshes a lot - and exists to make a
# brute-force of a 32-character token not worth starting.

async def _business_by_staff_token(token: str) -> dict[str, Any]:
    if not token or len(token) < 20:
        raise HTTPException(status_code=404, detail="This link is not valid")
    biz = await db.businesses.find_one({"orders_staff_token": token})
    if not biz or not biz.get("active", True):
        raise HTTPException(status_code=404, detail="This link is not valid")
    return biz


@router.get("/businesses/{business_id}/orders/staff-link")
async def get_staff_link(business_id: str, user=Depends(verify_token)):
    biz = await _owned_business(business_id, user)
    return {"token": biz.get("orders_staff_token")}


@router.post("/businesses/{business_id}/orders/staff-link")
async def create_staff_link(business_id: str, rotate: bool = False, user=Depends(verify_token)):
    """Create the link, or return the one that exists. `rotate=true`
    replaces it - the old link dies immediately."""
    biz = await _owned_business(business_id, user)
    token = biz.get("orders_staff_token")
    if token and not rotate:
        return {"token": token, "created": False}
    token = secrets.token_urlsafe(24)
    await db.businesses.update_one(
        {"_id": business_id},
        {"$set": {"orders_staff_token": token, "orders_staff_token_at": _now_iso()}},
    )
    logger.info("[orders] staff link %s: business=%s", "rotated" if biz.get("orders_staff_token") else "created", business_id)
    return {"token": token, "created": True}


@router.delete("/businesses/{business_id}/orders/staff-link")
async def revoke_staff_link(business_id: str, user=Depends(verify_token)):
    await _owned_business(business_id, user)
    await db.businesses.update_one(
        {"_id": business_id},
        {"$unset": {"orders_staff_token": "", "orders_staff_token_at": ""}},
    )
    return {"ok": True}


@router.get("/orders/staff/{token}")
async def staff_board(
    token: str,
    request: Request,
    status: Optional[str] = Query(None, pattern="^(new|preparing|ready|done|cancelled|failed|open)$"),
    date_from: Optional[str] = Query(None, alias="from"),
    date_to: Optional[str] = Query(None, alias="to"),
):
    check_rate(request, bucket="orders_staff", limit=600, window_seconds=600)
    biz = await _business_by_staff_token(token)
    await generate_standing_orders(biz["_id"])
    out = await _list(biz["_id"], status, date_from, date_to, 300)
    out["business"] = {"name": biz.get("name") or "", "name_he": biz.get("name_he"), "logo_url": biz.get("logo_url")}
    return out


@router.patch("/orders/staff/{token}/{order_id}/status")
async def staff_set_status(token: str, order_id: str, payload: StatusIn, request: Request):
    check_rate(request, bucket="orders_staff", limit=600, window_seconds=600)
    biz = await _business_by_staff_token(token)
    order = await db.store_orders.find_one({"_id": order_id, "business_id": biz["_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return await _transition(order, payload, by="staff")


# ---------------------------------------------------------------------------
# export (spec O9): never make the site the only copy
# ---------------------------------------------------------------------------

_CSV_COLUMNS = (
    "date", "time", "customer", "phone", "items", "fulfilment", "address",
    "total", "currency", "status", "notes", "source", "created_at",
)


def _csv_number(v: Any) -> Any:
    """85.0 prints as 85 - a sheet shows whole shekels without a decimal
    and the owner's eye is used to that column."""
    if v is None:
        return ""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return v
    return int(f) if f.is_integer() else f


def orders_to_csv(orders: list[dict[str, Any]]) -> str:
    """One row per order, the columns the sheet had. UTF-8 with a BOM so
    Excel on Windows opens Hebrew correctly without an import wizard."""
    buf = io.StringIO()
    buf.write("\ufeff")
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(_CSV_COLUMNS)
    for o in orders:
        nb = o.get("needed_by") or ""
        w.writerow([
            nb[:10], nb[11:16] if "T" in nb else "",
            o.get("customer_name") or "", o.get("customer_phone") or "",
            o.get("items") or "", o.get("fulfilment") or "", o.get("address") or "",
            _csv_number(o.get("total")), o.get("currency") or "ILS",
            o.get("status") or "", o.get("notes") or "", o.get("source") or "",
            o.get("created_at") or "",
        ])
    return buf.getvalue()


@router.get("/businesses/{business_id}/orders/export.csv")
async def export_orders_csv(
    business_id: str,
    status: Optional[str] = Query(None, pattern="^(new|preparing|ready|done|cancelled|failed|open)$"),
    date_from: Optional[str] = Query(None, alias="from"),
    date_to: Optional[str] = Query(None, alias="to"),
    user=Depends(verify_token),
):
    await _owned_business(business_id, user)
    data = await _list(business_id, status, date_from, date_to, 1000)
    body = orders_to_csv(data["orders"])
    name = f"orders-{date_from or 'all'}-{date_to or 'all'}.csv"
    return StreamingResponse(
        iter([body.encode("utf-8")]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


# ---------------------------------------------------------------------------
# import (spec O9): day one with forty names, not zero
# ---------------------------------------------------------------------------

_NAME_HEADERS = ("name", "customer", "client", "\u05e9\u05dd", "\u05dc\u05e7\u05d5\u05d7")
_PHONE_HEADERS = ("phone", "mobile", "tel", "whatsapp", "\u05d8\u05dc\u05e4\u05d5\u05df", "\u05e0\u05d9\u05d9\u05d3", "\u05e4\u05dc\u05d0\u05e4\u05d5\u05df")
_ADDRESS_HEADERS = ("address", "street", "\u05db\u05ea\u05d5\u05d1\u05ea", "\u05e8\u05d7\u05d5\u05d1")


def _pick_column(headers: list[str], wanted: tuple[str, ...]) -> Optional[int]:
    for i, h in enumerate(headers):
        low = (h or "").strip().lower()
        if any(w in low for w in wanted):
            return i
    return None


def parse_customers_csv(text: str) -> tuple[list[dict[str, Any]], dict[str, Optional[str]]]:
    """Rows of {name, phone, address} from a pasted sheet. Headers are
    matched by keyword in either language (the escaped strings above are
    Hebrew: name/customer, phone/mobile, address/street); with no
    recognisable header row the first column is the name and the second
    the phone, which is what a sheet of customers almost always is."""
    text = (text or "").lstrip("\ufeff")
    if not text.strip():
        return [], {}
    first = text.splitlines()[0]
    delim = "\t" if "\t" in first else (";" if first.count(";") > first.count(",") else ",")
    rows = list(csv.reader(io.StringIO(text), delimiter=delim))
    if not rows:
        return [], {}
    headers = [c.strip() for c in rows[0]]
    ni = _pick_column(headers, _NAME_HEADERS)
    pi = _pick_column(headers, _PHONE_HEADERS)
    ai = _pick_column(headers, _ADDRESS_HEADERS)
    headerless = ni is None and pi is None
    if headerless:
        ni, pi, ai = 0, 1, 2
        body = rows
    else:
        body = rows[1:]
    out = []
    for r in body:
        def cell(i, r=r):
            return r[i].strip() if i is not None and i < len(r) else ""
        name, phone, address = cell(ni), cell(pi), cell(ai)
        if not name and not phone:
            continue
        out.append({"name": name[:120], "phone": phone[:40], "address": address[:400]})
    if headerless:
        return out, {"name": None, "phone": None, "address": None}
    used = {
        "name": headers[ni] if ni is not None and ni < len(headers) else None,
        "phone": headers[pi] if pi is not None and pi < len(headers) else None,
        "address": headers[ai] if ai is not None and ai < len(headers) else None,
    }
    return out, used


class CustomersImportIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=400_000)


@router.post("/businesses/{business_id}/customers/import")
async def import_customers(business_id: str, payload: CustomersImportIn, user=Depends(verify_token)):
    """Upsert by normalised phone (or lowercased name when there is no
    usable phone). Re-importing the same sheet changes nothing; a row
    with a new address updates the old one."""
    await _owned_business(business_id, user)
    rows, used = parse_customers_csv(payload.text)
    if len(rows) > 5000:
        raise HTTPException(status_code=413, detail="Too many rows (max 5000)")
    now = _now_iso()
    imported = 0
    for r in rows:
        e164 = normalize_whatsapp_number(r["phone"]) if r["phone"] else None
        key = e164 or (r["name"].lower() if r["name"] else None)
        if not key:
            continue
        doc = {
            "business_id": business_id,
            "key": key,
            "customer_name": r["name"] or r["phone"],
            "customer_phone": r["phone"] or None,
            "customer_phone_e164": e164,
            "address": r["address"] or None,
            "updated_at": now,
        }
        await db.store_customers.update_one(
            {"business_id": business_id, "key": key},
            {"$set": doc, "$setOnInsert": {"_id": str(uuid.uuid4()), "created_at": now, "source": "import"}},
            upsert=True,
        )
        imported += 1
    return {"imported": imported, "rows": len(rows), "columns": used}


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
    # Imported customers (spec O9) fill in behind the ones who have
    # actually ordered, so a sheet of forty names is in the autocomplete
    # on day one without outranking the regulars.
    seen = {r["_id"] for r in rows}
    async for c in db.store_customers.find({"business_id": business_id}).sort("customer_name", 1).limit(2000):
        if c["key"] in seen:
            continue
        rows.append({
            "_id": c["key"], "customer_name": c.get("customer_name"), "customer_phone": c.get("customer_phone"),
            "address": c.get("address"), "last_items": None, "orders": 0, "last_at": c.get("updated_at"),
        })
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

# ---------------------------------------------------------------------------
# couriers, assignment, and money at the door (spec O5 + O6, revised)
# ---------------------------------------------------------------------------
#
# Revised 2026-09-08 on Tzvi's decision: a courier is a PERSON WITH AN
# ACCOUNT, not a link. The business invites by email; the courier accepts
# from their own dashboard, which then gains a Deliveries tab; every
# delivery for that business lands there. No texts, no capability links.
#
# Assignment is automatic: a business names a default courier and every
# delivery order - typed, pasted, ordered on the site, or generated from a
# standing order - is theirs the moment it exists. The business can move
# it to another courier on the card. A business with no default courier
# sees the order unassigned, which is a visible state, not a silent one.
#
# The phone rule (O6) is unchanged: the customer's number is on the
# courier's screen only while the order is `ready`, and every reveal is
# written on the order. Money (O6) is unchanged: the store's own payment
# link first, "cash to me" one tap further, and the tap at the door is the
# record. We record money; we never move it.

FAILED_REASONS = ("nobody_home", "wrong_address", "refused", "not_found", "other")
PAYMENT_METHODS = ("cash", "bit", "other")


class CourierInviteIn(BaseModel):
    email: str = Field(..., min_length=5, max_length=200)

    @field_validator("email")
    @classmethod
    def _email(cls, v):
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("That does not look like an email address")
        return v


class AssignIn(BaseModel):
    courier_user_id: Optional[str] = None      # None = take it off the courier


class PaymentIn(BaseModel):
    # method None = "not paid" (clears the record)
    method: Optional[str] = Field(None, pattern="^(cash|bit|other)$")
    amount: Optional[float] = Field(None, ge=0, le=1_000_000)


class CourierStatusIn(BaseModel):
    status: str = Field(..., pattern="^(done|failed)$")
    reason: Optional[str] = Field(None, pattern="^(nobody_home|wrong_address|refused|not_found|other)$")
    note: str = Field("", max_length=300)
    photo_url: Optional[str] = Field(None, max_length=600)
    payment: Optional[PaymentIn] = None


def _public_courier(c: dict[str, Any]) -> dict[str, Any]:
    return {k: c.get(k) for k in ("user_id", "email", "name", "phone", "phone_e164", "status", "invited_at", "accepted_at")}


def _payment_record(p: Optional[PaymentIn], by: str) -> Optional[dict[str, Any]]:
    if p is None or p.method is None:
        return None
    return {"method": p.method, "amount": p.amount, "at": _now_iso(), "by": by}


def _frontend_url() -> str:
    return (os.environ.get("FRONTEND_URL") or os.environ.get("PLATFORM_PUBLIC_URL") or "").rstrip("/")


async def _notify(user_id: str, *, type_: str, message: str, action_url: str, **extra: Any) -> None:
    """One in-app notification, the same shape chat.py writes, so the
    bell in the nav and its deep link work without knowing about orders."""
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": type_,
        "message": message,
        "action_url": action_url,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        **extra,
    })


async def _email(to: Optional[str], subject: str, inner_html: str, *, tag: str, button: tuple[str, str] | None = None) -> None:
    """Fire-and-forget through the site's Postmark wrapper. Missing address
    or unconfigured mail is a no-op, never an error on the request."""
    if not to:
        return
    try:
        from utils.email import _button, _wrap, send_email
        html = inner_html + (_button(button[0], button[1]) if button else "")
        await send_email(to, subject, _wrap(html), tag=tag)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[orders] email '%s' to %s failed: %s", tag, (to or "")[:3] + "***", exc)


def _order_line(o: dict[str, Any]) -> str:
    nb = o.get("needed_by") or ""
    when = f"{nb[:10]} {nb[11:16]}".strip()
    return f"{o.get('customer_name')} · {when} · {'delivery' if o.get('fulfilment') == 'delivery' else 'pickup'}"


async def _courier_entry(biz: dict[str, Any], user_id: str) -> Optional[dict[str, Any]]:
    return next((c for c in biz.get("couriers") or [] if c.get("user_id") == user_id and c.get("status") == "active"), None)


async def _assign_to(order: dict[str, Any], biz: dict[str, Any], courier: dict[str, Any], *, by: str, automatic: bool) -> dict[str, Any]:
    """Put a delivery on a courier and tell them: a dashboard badge, the
    bell, and one email. Returns the fresh order."""
    now = _now_iso()
    await db.store_orders.update_one(
        {"_id": order["_id"]},
        {"$set": {"courier": {"user_id": courier["user_id"], "name": courier.get("name") or courier.get("email")}, "assigned_at": now, "updated_at": now},
         "$push": {"history": {"status": order["status"], "at": now, "by": by, "event": "assigned", "courier": courier.get("name") or courier.get("email"), "automatic": automatic}}},
    )
    await _notify(
        courier["user_id"], type_="delivery_assigned",
        message=f"{biz.get('name') or 'A store'}: delivery for {_order_line(order)}",
        action_url="/dashboard?tab=deliveries", order_id=order["_id"],
    )
    await _email(
        courier.get("email"),
        f"New delivery from {biz.get('name') or 'a store'}",
        f"<p>{biz.get('name') or 'A store'} has a delivery for you:</p><p><strong>{_order_line(o=order)}</strong><br>{(order.get('address') or '')}</p><p>Open your Deliveries tab for the full list.</p>",
        tag="order-delivery-assigned", button=("Open my deliveries", f"{_frontend_url()}/dashboard?tab=deliveries"),
    )
    return await db.store_orders.find_one({"_id": order["_id"]})


async def auto_assign(order: dict[str, Any], biz: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    """The default courier gets every delivery the moment it exists. No
    default, or the default no longer active: the order stays unassigned
    and the card says so."""
    if order.get("fulfilment") != "delivery" or order.get("courier"):
        return order
    biz = biz or await db.businesses.find_one({"_id": order["business_id"]})
    default_id = ((biz or {}).get("order_settings") or {}).get("default_courier_user_id")
    if not biz or not default_id:
        return order
    courier = await _courier_entry(biz, default_id)
    if not courier:
        return order
    return await _assign_to(order, biz, courier, by="auto", automatic=True)


# ---- the business's courier list ----------------------------------------------

@router.get("/businesses/{business_id}/couriers")
async def list_couriers(business_id: str, user=Depends(verify_token)):
    biz = await _owned_business(business_id, user)
    couriers = biz.get("couriers") or []
    # Entries from the link-based model (before 2026-09-08) have no email
    # and no account; they cannot be invited or assigned, so they go.
    kept = [c for c in couriers if c.get("email")]
    if len(kept) != len(couriers):
        await db.businesses.update_one({"_id": business_id}, {"$set": {"couriers": kept}})
    return [_public_courier(c) for c in kept]


@router.post("/businesses/{business_id}/couriers/invite")
async def invite_courier(business_id: str, payload: CourierInviteIn, user=Depends(verify_token)):
    """Invite by email. An account with that email gets the invite in
    their dashboard now; an email that has no account yet is held until
    someone signs up with it. Either way, one email goes out."""
    biz = await _owned_business(business_id, user)
    couriers = list(biz.get("couriers") or [])
    if any(c.get("email") == payload.email for c in couriers):
        raise HTTPException(status_code=400, detail="That person is already on your courier list")
    if len(couriers) >= 20:
        raise HTTPException(status_code=400, detail="Up to 20 couriers per business")
    account = await db.users.find_one({"email": payload.email}, {"_id": 0, "id": 1, "name": 1, "phone": 1, "whatsapp_number": 1})
    if account and account["id"] == biz.get("owner_user_id"):
        raise HTTPException(status_code=400, detail="That is your own account")
    now = _now_iso()
    entry = {
        "user_id": account["id"] if account else None,
        "email": payload.email,
        "name": (account or {}).get("name"),
        "phone": (account or {}).get("whatsapp_number") or (account or {}).get("phone"),
        "phone_e164": normalize_whatsapp_number((account or {}).get("whatsapp_number") or (account or {}).get("phone")),
        "status": "invited",
        "invited_at": now,
        "accepted_at": None,
    }
    couriers.append(entry)
    await db.businesses.update_one({"_id": business_id}, {"$set": {"couriers": couriers}})
    if account:
        await _notify(account["id"], type_="courier_invite", message=f"{biz.get('name')} invited you to deliver for them", action_url="/dashboard?tab=deliveries", business_id=business_id)
    await _email(
        payload.email, f"{biz.get('name')} wants you as their courier",
        f"<p>{biz.get('name')} on MyIsraelRental would like you to deliver their orders.</p>"
        + ("<p>Open your dashboard to accept.</p>" if account else "<p>Sign up with this email address, then accept the invite in your dashboard.</p>"),
        tag="order-courier-invite",
        button=("Open my dashboard", f"{_frontend_url()}/dashboard?tab=deliveries") if account else ("Sign up", f"{_frontend_url()}/join"),
    )
    return _public_courier(entry)


@router.delete("/businesses/{business_id}/couriers/{key}")
async def remove_courier(business_id: str, key: str, user=Depends(verify_token)):
    """Removing a courier takes them off every OPEN order, which then
    shows as unassigned. Closed orders keep the name for the record.
    `key` is the courier's user id, or their email for a pending invite."""
    biz = await _owned_business(business_id, user)
    couriers = [c for c in biz.get("couriers") or [] if c.get("user_id") != key and c.get("email") != key.lower()]
    sets: dict[str, Any] = {"couriers": couriers}
    settings = dict(biz.get("order_settings") or {})
    if settings.get("default_courier_user_id") == key:
        settings["default_courier_user_id"] = None
        sets["order_settings"] = settings
    await db.businesses.update_one({"_id": business_id}, {"$set": sets})
    await db.store_orders.update_many(
        {"business_id": business_id, "courier.user_id": key, "status": {"$in": list(OPEN_STATUSES)}},
        {"$set": {"courier": None, "assigned_at": None, "updated_at": _now_iso()}},
    )
    return {"ok": True}


@router.patch("/orders/{order_id}/assign")
async def assign_order(order_id: str, payload: AssignIn, user=Depends(verify_token)):
    """Move a delivery to one of the business's active couriers, or take
    it off them. The courier is told either way."""
    order = await _owned_order(order_id, user)
    if order.get("fulfilment") != "delivery":
        raise HTTPException(status_code=400, detail="Only delivery orders are assigned to a courier")
    if order["status"] not in OPEN_STATUSES:
        raise HTTPException(status_code=409, detail="This order is closed")
    biz = await db.businesses.find_one({"_id": order["business_id"]}) or {}
    now = _now_iso()
    if payload.courier_user_id is None:
        prev = (order.get("courier") or {}).get("user_id")
        await db.store_orders.update_one(
            {"_id": order_id},
            {"$set": {"courier": None, "assigned_at": None, "updated_at": now},
             "$push": {"history": {"status": order["status"], "at": now, "by": user["user_id"], "event": "unassigned"}}},
        )
        if prev:
            await _notify(prev, type_="delivery_unassigned", message=f"{biz.get('name')}: the delivery for {order.get('customer_name')} was taken off you", action_url="/dashboard?tab=deliveries", order_id=order_id)
        return {"order": _public(await db.store_orders.find_one({"_id": order_id}))}
    courier = await _courier_entry(biz, payload.courier_user_id)
    if not courier:
        raise HTTPException(status_code=404, detail="That courier has not accepted your invite yet")
    fresh = await _assign_to(order, biz, courier, by=user["user_id"], automatic=False)
    return {"order": _public(fresh)}


@router.patch("/orders/{order_id}/payment")
async def set_payment(order_id: str, payload: PaymentIn, user=Depends(verify_token)):
    """The owner's own record of a payment at the counter or after the
    fact. Method None clears it. We never move money; this is a note."""
    order = await _owned_order(order_id, user)
    rec = _payment_record(payload, by=user["user_id"])
    await db.store_orders.update_one({"_id": order_id}, {"$set": {"payment": rec, "updated_at": _now_iso()}})
    fresh = await db.store_orders.find_one({"_id": order_id})
    return _public(fresh)


# ---- the courier's side (their own account) ------------------------------------

async def _my_courier_businesses(user: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], Optional[str]]:
    """(active memberships, pending invites, my email). Invites made
    before the person signed up are matched by email and claimed here."""
    me = await db.users.find_one({"id": user["user_id"]}, {"_id": 0, "email": 1, "name": 1, "phone": 1, "whatsapp_number": 1})
    email = (me or {}).get("email")
    q = {"couriers": {"$elemMatch": {"$or": [{"user_id": user["user_id"]}, {"email": email}]}}} if email else {"couriers.user_id": user["user_id"]}
    active, invites = [], []
    async for biz in db.businesses.find(q):
        for c in biz.get("couriers") or []:
            mine = c.get("user_id") == user["user_id"] or (email and c.get("email") == email)
            if not mine:
                continue
            row = {"business_id": biz["_id"], "business_name": biz.get("name") or "", "logo_url": biz.get("logo_url"), "invited_at": c.get("invited_at"), "accepted_at": c.get("accepted_at")}
            (active if c.get("status") == "active" else invites).append(row)
    return active, invites, email


@router.get("/courier/me")
async def courier_me(user=Depends(verify_token)):
    active, invites, _ = await _my_courier_businesses(user)
    open_count = await db.store_orders.count_documents({"courier.user_id": user["user_id"], "status": {"$in": list(OPEN_STATUSES)}})
    return {"businesses": active, "invites": invites, "deliveries_open": open_count}


@router.post("/courier/invites/{business_id}/accept")
async def accept_invite(business_id: str, user=Depends(verify_token)):
    biz = await db.businesses.find_one({"_id": business_id})
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    me = await db.users.find_one({"id": user["user_id"]}, {"_id": 0, "email": 1, "name": 1, "phone": 1, "whatsapp_number": 1}) or {}
    couriers = list(biz.get("couriers") or [])
    entry = next((c for c in couriers if c.get("user_id") == user["user_id"] or (me.get("email") and c.get("email") == me.get("email"))), None)
    if not entry:
        raise HTTPException(status_code=404, detail="No invite from this business")
    entry.update({
        "user_id": user["user_id"], "status": "active", "accepted_at": _now_iso(),
        "name": me.get("name") or entry.get("name") or entry.get("email"),
        "phone": me.get("whatsapp_number") or me.get("phone") or entry.get("phone"),
        "phone_e164": normalize_whatsapp_number(me.get("whatsapp_number") or me.get("phone") or entry.get("phone")),
    })
    await db.businesses.update_one({"_id": business_id}, {"$set": {"couriers": couriers}})
    await _notify(biz["owner_user_id"], type_="courier_accepted", message=f"{entry['name']} accepted your courier invite", action_url="/dashboard?tab=orders", business_id=business_id)
    # First courier in? Make them the default so deliveries start flowing
    # without a second setup step. The owner can change it.
    settings = dict(biz.get("order_settings") or {})
    if not settings.get("default_courier_user_id"):
        settings["default_courier_user_id"] = user["user_id"]
        await db.businesses.update_one({"_id": business_id}, {"$set": {"order_settings": settings}})
        await _assign_unassigned(business_id)
    return {"ok": True, "business_id": business_id}


@router.post("/courier/invites/{business_id}/decline")
async def decline_invite(business_id: str, user=Depends(verify_token)):
    return await courier_leave(business_id, user)


@router.post("/courier/businesses/{business_id}/leave")
async def courier_leave(business_id: str, user=Depends(verify_token)):
    biz = await db.businesses.find_one({"_id": business_id})
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    me = await db.users.find_one({"id": user["user_id"]}, {"_id": 0, "email": 1}) or {}
    couriers = [c for c in biz.get("couriers") or [] if not (c.get("user_id") == user["user_id"] or (me.get("email") and c.get("email") == me.get("email")))]
    sets: dict[str, Any] = {"couriers": couriers}
    settings = dict(biz.get("order_settings") or {})
    if settings.get("default_courier_user_id") == user["user_id"]:
        settings["default_courier_user_id"] = None
        sets["order_settings"] = settings
    await db.businesses.update_one({"_id": business_id}, {"$set": sets})
    await db.store_orders.update_many(
        {"business_id": business_id, "courier.user_id": user["user_id"], "status": {"$in": list(OPEN_STATUSES)}},
        {"$set": {"courier": None, "assigned_at": None, "updated_at": _now_iso()}},
    )
    return {"ok": True}


def _stop(order: dict[str, Any], biz: dict[str, Any], *, reveal_phone: bool) -> dict[str, Any]:
    """What a courier sees of an order: enough to deliver it, and no
    more. Never the history, never the owner's private record."""
    out = {k: order.get(k) for k in (
        "customer_name", "items", "notes", "needed_by", "window", "address", "status", "total", "currency",
        "fulfilment", "assigned_at", "delivery", "payment", "status_changed_at",
    )}
    out["id"] = order["_id"]
    out["business"] = {
        "id": biz["_id"], "name": biz.get("name") or "", "name_he": biz.get("name_he"), "logo_url": biz.get("logo_url"),
        "payment_links": biz.get("payment_links") or [], "payment_note": biz.get("payment_note"),
    }
    if reveal_phone:
        out["customer_phone"] = order.get("customer_phone")
        out["customer_phone_e164"] = order.get("customer_phone_e164")
    return out


@router.get("/courier/deliveries")
async def courier_deliveries(user=Depends(verify_token)):
    """One ordered list across every business this person delivers for:
    open stops plus today's closed ones. Phone only on `ready`, reveal
    written once."""
    today = datetime.now(_IL_TZ).date().isoformat()
    active, _, _ = await _my_courier_businesses(user)
    if not active:
        return {"stops": []}
    q = {
        "courier.user_id": user["user_id"],
        "business_id": {"$in": [a["business_id"] for a in active]},
        "$or": [
            {"status": {"$in": list(OPEN_STATUSES)}},
            {"status": {"$in": ["done", "failed"]}, "status_changed_at": {"$gte": today}},
        ],
    }
    bizes: dict[str, dict[str, Any]] = {}
    stops = []
    async for o in db.store_orders.find(q).sort([("needed_by", 1), ("created_at", 1)]).limit(300):
        biz = bizes.get(o["business_id"])
        if biz is None:
            biz = await db.businesses.find_one({"_id": o["business_id"]}) or {"_id": o["business_id"]}
            bizes[o["business_id"]] = biz
        reveal = o["status"] == "ready"
        if reveal and not any(r.get("courier_id") == user["user_id"] for r in o.get("phone_reveals") or []):
            await db.store_orders.update_one(
                {"_id": o["_id"]},
                {"$push": {"phone_reveals": {"at": _now_iso(), "courier_id": user["user_id"], "courier": (o.get("courier") or {}).get("name")}}},
            )
        stops.append(_stop(o, biz, reveal_phone=reveal))
    return {"stops": stops}


@router.patch("/courier/deliveries/{order_id}/status")
async def courier_set_status(order_id: str, payload: CourierStatusIn, user=Depends(verify_token)):
    """Delivered or failed, at the door, timestamped. Delivered needs a
    photo - it is the proof the customer sees in their email and their
    orders. Failed needs a reason from the short list."""
    order = await db.store_orders.find_one({"_id": order_id, "courier.user_id": user["user_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] != "ready":
        raise HTTPException(status_code=409, detail="This order is not out for delivery yet")
    if payload.status == "done" and not payload.photo_url:
        raise HTTPException(status_code=400, detail="Add a photo of the delivery first")
    if payload.status == "failed" and not payload.reason:
        raise HTTPException(status_code=400, detail="Pick a reason")
    biz = await db.businesses.find_one({"_id": order["business_id"]}) or {"_id": order["business_id"]}
    courier_name = (order.get("courier") or {}).get("name") or "courier"
    now = _now_iso()
    delivery: dict[str, Any] = dict(order.get("delivery") or {})
    if payload.status == "done":
        delivery.update({"delivered_at": now, "photo_url": payload.photo_url, "by": courier_name})
    else:
        delivery.update({"failed_at": now, "failed_reason": payload.reason, "failed_photo_url": payload.photo_url, "by": courier_name})
    sets: dict[str, Any] = {"delivery": delivery}
    if payload.payment is not None and payload.payment.method is not None:
        if payload.payment.method == "cash" and payload.payment.amount is None:
            raise HTTPException(status_code=400, detail="Enter the amount collected")
        sets["payment"] = _payment_record(payload.payment, by=f"courier:{user['user_id']}")
    await db.store_orders.update_one({"_id": order_id}, {"$set": sets})
    order = await db.store_orders.find_one({"_id": order_id})
    fresh = await _transition(order, StatusIn(status=payload.status, note=payload.note), by=f"courier:{user['user_id']}")

    # Tell the store, and tell the customer - with the photo, the way a
    # parcel company does, so "it never came" has an answer.
    if payload.status == "done":
        await _notify(biz.get("owner_user_id"), type_="order_delivered", message=f"Delivered: {order.get('customer_name')} by {courier_name}", action_url="/dashboard?tab=orders", order_id=order_id)
        track = f"{_frontend_url()}/orders/track/{order.get('track_token')}"
        await _email(
            order.get("customer_email"), f"Delivered: your order from {biz.get('name')}",
            f"<p>Your order from {biz.get('name')} was delivered at {now[11:16]}.</p>"
            f"<p><img src=\"{payload.photo_url}\" alt=\"Delivery photo\" style=\"max-width:100%;border-radius:12px\"></p>"
            f"<p>{(order.get('items') or '').replace(chr(10), '<br>')}</p>",
            tag="order-delivered", button=("See your order", track),
        )
        if order.get("customer_user_id"):
            await _notify(order["customer_user_id"], type_="order_delivered", message=f"Your order from {biz.get('name')} was delivered", action_url="/dashboard?tab=my-orders", order_id=order_id)
    else:
        await _notify(biz.get("owner_user_id"), type_="order_failed", message=f"Not delivered: {order.get('customer_name')} ({payload.reason})", action_url="/dashboard?tab=orders", order_id=order_id)
    return _stop({**fresh, "_id": fresh["id"]}, biz, reveal_phone=False)


async def _assign_unassigned(business_id: str) -> int:
    """When a default courier is set, open deliveries nobody has go to
    them. Returns how many moved."""
    biz = await db.businesses.find_one({"_id": business_id})
    n = 0
    async for o in db.store_orders.find({"business_id": business_id, "fulfilment": "delivery", "courier": None, "status": {"$in": list(OPEN_STATUSES)}}):
        before = o.get("courier")
        after = await auto_assign(o, biz)
        if after.get("courier") and not before:
            n += 1
    return n


# ---------------------------------------------------------------------------
# the customer's status link (spec O7)
# ---------------------------------------------------------------------------
#
# "Where's my order?" is most of a food business's inbound on a Friday.
# One link, sent once in the chat thread, answers it for the rest of the
# day. No login: the token is the credential, minted per order. What it
# shows is what the customer already knows plus the one thing they want
# — the step it is at — and, for a delivery, the line the spec requires:
# the delivery person will see your number to reach you.

@router.get("/orders/track/{token}")
async def track_order(token: str, request: Request):
    check_rate(request, bucket="orders_track", limit=300, window_seconds=600)
    if not token or len(token) < 16:
        raise HTTPException(status_code=404, detail="This link is not valid")
    o = await db.store_orders.find_one({"track_token": token})
    if not o:
        raise HTTPException(status_code=404, detail="This link is not valid")
    biz = await db.businesses.find_one({"_id": o["business_id"]}) or {}
    delivered_at = (o.get("delivery") or {}).get("delivered_at")
    return {
        "business": {
            "name": biz.get("name") or "",
            "name_he": biz.get("name_he"),
            "logo_url": biz.get("logo_url"),
            "slug": biz.get("slug"),
        },
        "customer_name": o.get("customer_name"),
        "items": o.get("items"),
        "needed_by": o.get("needed_by"),
        "fulfilment": o.get("fulfilment"),
        "address": o.get("address"),
        "total": o.get("total"),
        "currency": o.get("currency") or "ILS",
        "status": o.get("status"),
        "status_changed_at": o.get("status_changed_at"),
        # Only the fact of it, never the courier's own details.
        "out_for_delivery": bool(o.get("fulfilment") == "delivery" and o.get("status") == "ready" and o.get("courier")),
        "delivered_at": delivered_at,
        # The proof, the way a parcel company shows it.
        "delivered_photo_url": (o.get("delivery") or {}).get("photo_url") if o.get("status") == "done" else None,
        "window": o.get("window"),
        "lines": o.get("lines"),
        "delivery_fee": o.get("delivery_fee"),
        "paid": bool((o.get("payment") or {}).get("method")),
    }


# ---------------------------------------------------------------------------
# Israel-specific: cutoffs and standing orders (spec O8)
# ---------------------------------------------------------------------------
#
# Friday is the day. For a food business here Shabbat orders are the
# week's peak and the week's deadline, so two things the sheet never did:
#
#   * CUTOFFS — "Friday orders close Thursday 2pm". Set here, shown on
#     the business page's good-to-know band, and the entry form warns
#     when an order is typed past it. Warns, not refuses: the owner on
#     the phone with a regular is the one who decides.
#   * STANDING ORDERS — challah every Friday, a box every Sunday. One
#     record that regenerates weekly. Generated lazily, whenever the
#     board is read, for the next occurrence within seven days — no
#     scheduler, and a unique index makes a double-generate impossible.
#
# Weekdays are JS-style throughout (0 = Sunday … 6 = Saturday), because
# the client sets them and the Israeli week starts on Sunday anyway.

_TIME_RE = re.compile(r"^\d{2}:\d{2}$")


def _js_weekday(d) -> int:
    """Python's Monday=0 to JS's Sunday=0."""
    return (d.weekday() + 1) % 7


class CutoffIn(BaseModel):
    for_day: int = Field(..., ge=0, le=6)        # orders FOR this weekday…
    closes_day: int = Field(..., ge=0, le=6)     # …close on this weekday…
    closes_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")   # …at this time

    @field_validator("closes_time")
    @classmethod
    def _real_time(cls, v):
        h, m = v.split(":")
        if not (0 <= int(h) <= 23 and 0 <= int(m) <= 59):
            raise ValueError("closes_time must be HH:MM")
        return v


class WindowIn(BaseModel):
    """A pickup or delivery window on one weekday: "Friday 08:00-12:00"."""
    weekday: int = Field(..., ge=0, le=6)
    start: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    end: str = Field(..., pattern=r"^\d{2}:\d{2}$")

    @model_validator(mode="after")
    def _ordered(self):
        if self.end <= self.start:
            raise ValueError("A window must end after it starts")
        return self


class OrderSettingsIn(BaseModel):
    cutoffs: list[CutoffIn] = Field(default_factory=list, max_length=7)
    pickup_windows: list[WindowIn] = Field(default_factory=list, max_length=28)
    delivery_windows: list[WindowIn] = Field(default_factory=list, max_length=28)
    delivery_fee: Optional[float] = Field(None, ge=0, le=10_000)
    min_order: Optional[float] = Field(None, ge=0, le=100_000)
    default_courier_user_id: Optional[str] = None

    @model_validator(mode="after")
    def _one_per_day(self):
        days = [c.for_day for c in self.cutoffs]
        if len(days) != len(set(days)):
            raise ValueError("One cutoff per weekday")
        return self


def _settings_out(biz: dict[str, Any]) -> dict[str, Any]:
    st = biz.get("order_settings") or {}
    return {
        "cutoffs": biz.get("order_cutoffs") or [],
        "pickup_windows": (st.get("windows") or {}).get("pickup") or [],
        "delivery_windows": (st.get("windows") or {}).get("delivery") or [],
        "delivery_fee": st.get("delivery_fee"),
        "min_order": st.get("min_order"),
        "default_courier_user_id": st.get("default_courier_user_id"),
    }


@router.get("/businesses/{business_id}/orders/settings")
async def get_order_settings(business_id: str, user=Depends(verify_token)):
    biz = await _owned_business(business_id, user)
    return _settings_out(biz)


@router.put("/businesses/{business_id}/orders/settings")
async def put_order_settings(business_id: str, payload: OrderSettingsIn, user=Depends(verify_token)):
    biz = await _owned_business(business_id, user)
    cutoffs = [c.model_dump() for c in sorted(payload.cutoffs, key=lambda c: c.for_day)]
    if payload.default_courier_user_id and not await _courier_entry(biz, payload.default_courier_user_id):
        raise HTTPException(status_code=400, detail="That courier has not accepted your invite yet")
    settings = {
        "windows": {
            "pickup": [w.model_dump() for w in sorted(payload.pickup_windows, key=lambda w: (w.weekday, w.start))],
            "delivery": [w.model_dump() for w in sorted(payload.delivery_windows, key=lambda w: (w.weekday, w.start))],
        },
        "delivery_fee": payload.delivery_fee,
        "min_order": payload.min_order,
        "default_courier_user_id": payload.default_courier_user_id,
    }
    await db.businesses.update_one({"_id": business_id}, {"$set": {"order_cutoffs": cutoffs, "order_settings": settings}})
    if payload.default_courier_user_id:
        await _assign_unassigned(business_id)
    fresh = await db.businesses.find_one({"_id": business_id})
    return _settings_out(fresh)


def past_cutoff(needed_by: str, cutoffs: list[dict[str, Any]], now: datetime) -> Optional[dict[str, Any]]:
    """The cutoff an order for `needed_by` has already missed, or None.
    Pure, so the client's copy and this one can be checked against each
    other. The cutoff for a day is the most recent `closes_day
    closes_time` at or before that day."""
    try:
        day = datetime.strptime(needed_by[:10], "%Y-%m-%d").date()
    except ValueError:
        return None
    wd = _js_weekday(day)
    for c in cutoffs or []:
        if c.get("for_day") != wd:
            continue
        back = (wd - int(c.get("closes_day", wd))) % 7
        closes_date = day - timedelta(days=back)
        h, m = (c.get("closes_time") or "00:00").split(":")
        closes_at = datetime(closes_date.year, closes_date.month, closes_date.day, int(h), int(m), tzinfo=now.tzinfo)
        if now > closes_at:
            return {**c, "closed_at": closes_at.replace(microsecond=0).isoformat()}
    return None


# ---- standing orders --------------------------------------------------------

class StandingPatch(BaseModel):
    active: Optional[bool] = None


def _public_standing(d: dict[str, Any]) -> dict[str, Any]:
    out = dict(d)
    out["id"] = out.pop("_id")
    out.pop("owner_user_id", None)
    return out


@router.get("/businesses/{business_id}/standing-orders")
async def list_standing_orders(business_id: str, user=Depends(verify_token)):
    await _owned_business(business_id, user)
    docs = [
        _public_standing(d)
        async for d in db.store_standing_orders.find({"business_id": business_id}).sort([("weekday", 1), ("time", 1)])
    ]
    return docs


@router.post("/orders/{order_id}/repeat-weekly")
async def repeat_weekly(order_id: str, user=Depends(verify_token)):
    """Turn an order into a standing one: same customer, same items,
    same weekday and time, every week from now. The order it came from
    is left as it is; the first generated copy is next week's."""
    order = await _owned_order(order_id, user)
    if order.get("standing_id"):
        existing = await db.store_standing_orders.find_one({"_id": order["standing_id"]})
        if existing:
            return _public_standing(existing)
    nb = order.get("needed_by") or ""
    if not nb:
        raise HTTPException(status_code=400, detail="This order has no date to repeat from")
    day = datetime.strptime(nb[:10], "%Y-%m-%d").date()
    now = _now_iso()
    doc = {
        "_id": str(uuid.uuid4()),
        "business_id": order["business_id"],
        "owner_user_id": order["owner_user_id"],
        "customer_name": order.get("customer_name"),
        "customer_phone": order.get("customer_phone"),
        "customer_phone_e164": order.get("customer_phone_e164"),
        "items": order.get("items"),
        "total": order.get("total"),
        "currency": order.get("currency") or "ILS",
        "weekday": _js_weekday(day),
        "time": nb[11:16] if "T" in nb else None,
        "fulfilment": order.get("fulfilment") or "pickup",
        "address": order.get("address"),
        "notes": order.get("notes") or "",
        "active": True,
        "from_order_id": order["_id"],
        # Generation starts AFTER the source order's date, so the week it
        # was typed for is not produced twice.
        "last_generated_date": day.isoformat(),
        "created_at": now,
        "updated_at": now,
    }
    await db.store_standing_orders.insert_one(doc)
    await db.store_orders.update_one({"_id": order_id}, {"$set": {"standing_id": doc["_id"]}})
    await generate_standing_orders(order["business_id"])
    return _public_standing(doc)


@router.patch("/standing-orders/{standing_id}")
async def patch_standing(standing_id: str, payload: StandingPatch, user=Depends(verify_token)):
    d = await db.store_standing_orders.find_one({"_id": standing_id})
    if not d:
        raise HTTPException(status_code=404, detail="Standing order not found")
    if d.get("owner_user_id") != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not your standing order")
    sets: dict[str, Any] = {"updated_at": _now_iso()}
    if payload.active is not None:
        sets["active"] = payload.active
    await db.store_standing_orders.update_one({"_id": standing_id}, {"$set": sets})
    if payload.active:
        await generate_standing_orders(d["business_id"])
    fresh = await db.store_standing_orders.find_one({"_id": standing_id})
    return _public_standing(fresh)


@router.delete("/standing-orders/{standing_id}")
async def delete_standing(standing_id: str, user=Depends(verify_token)):
    """Stops future weeks. Orders already generated stay - they are real
    orders the customer is expecting, and cancelling them is a separate,
    visible decision on each card."""
    d = await db.store_standing_orders.find_one({"_id": standing_id})
    if not d:
        raise HTTPException(status_code=404, detail="Standing order not found")
    if d.get("owner_user_id") != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not your standing order")
    await db.store_standing_orders.delete_one({"_id": standing_id})
    return {"ok": True}


async def generate_standing_orders(business_id: str, *, horizon_days: int = 7) -> int:
    """Create the next occurrence of every active standing order that
    falls within `horizon_days` and has not been created yet. Called on
    every board read; cheap because a business has a handful of these
    and the query is indexed. Returns how many were created."""
    today = datetime.now(_IL_TZ).date()
    created = 0
    async for sd in db.store_standing_orders.find({"business_id": business_id, "active": True}):
        wd = int(sd.get("weekday", 0))
        ahead = (wd - _js_weekday(today)) % 7
        occurrence = today + timedelta(days=ahead)
        last = sd.get("last_generated_date") or ""
        if occurrence.isoformat() <= last:
            # This week's is already made (or was the order it came
            # from); the next one is a week on.
            occurrence += timedelta(days=7)
            ahead += 7
        if ahead > horizon_days:
            continue
        needed_by = occurrence.isoformat() + (f"T{sd['time']}" if sd.get("time") else "")
        now = _now_iso()
        doc = {
            "_id": str(uuid.uuid4()),
            "business_id": business_id,
            "owner_user_id": sd["owner_user_id"],
            "customer_name": sd.get("customer_name"),
            "customer_phone": sd.get("customer_phone"),
            "customer_phone_e164": sd.get("customer_phone_e164"),
            "items": sd.get("items"),
            "total": sd.get("total"),
            "currency": sd.get("currency") or "ILS",
            "needed_by": needed_by,
            "fulfilment": sd.get("fulfilment") or "pickup",
            "address": sd.get("address") if sd.get("fulfilment") == "delivery" else None,
            "notes": sd.get("notes") or "",
            "status": "new",
            "source": "standing",
        "courier": None,
        "assigned_at": None,
            "standing_id": sd["_id"],
            "occurrence_date": occurrence.isoformat(),
            "created_by": "standing",
            "created_at": now,
            "updated_at": now,
            "status_changed_at": now,
            "history": [{"status": "new", "at": now, "by": "standing"}],
            "track_token": secrets.token_urlsafe(16),
        }
        try:
            await db.store_orders.insert_one(doc)
            created += 1
            await auto_assign(doc)
        except Exception as exc:  # noqa: BLE001 — the unique index caught a race
            logger.info("[orders] standing occurrence already exists: %s", exc)
        await db.store_standing_orders.update_one(
            {"_id": sd["_id"]}, {"$set": {"last_generated_date": occurrence.isoformat()}},
        )
    return created


# ---------------------------------------------------------------------------
# ordering on the website (Tzvi, 2026-09-08)
# ---------------------------------------------------------------------------
#
# Every store listing takes orders. The customer picks from the products
# the store already lists, with quantities, plus a free line; pickup or
# delivery; a date the cutoffs allow and one of the store's windows for
# that weekday; a city the store serves plus the street address. No
# account needed - signing in only fills the form and keeps a history.
#
# The order lands on the board as `new` with everything filled in, goes
# to the default courier if it is a delivery, the store is told (badge,
# bell, email), and the customer gets the status link on screen and by
# email if they gave one. Nothing about payment happens here: the
# confirmation says how the store takes payment, and that is all.

class OrderLineIn(BaseModel):
    product_id: str = Field(..., min_length=1, max_length=64)
    qty: int = Field(..., ge=1, le=99)


class WebsiteOrderIn(BaseModel):
    lines: list[OrderLineIn] = Field(default_factory=list, max_length=40)
    extra_items: str = Field("", max_length=500)
    notes: str = Field("", max_length=1000)
    fulfilment: str = Field("pickup", pattern="^(pickup|delivery)$")
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    window: Optional[WindowIn] = None
    city: Optional[str] = Field(None, max_length=80)          # location slug
    address: Optional[str] = Field(None, max_length=400)
    customer_name: str = Field(..., min_length=1, max_length=120)
    customer_phone: str = Field(..., min_length=5, max_length=40)
    customer_email: Optional[str] = Field(None, max_length=200)
    # How the customer intends to pay, in the store's own terms (its
    # payment_note lists them). Recorded, never charged: the site does
    # not process payments.
    pay_by: Optional[str] = Field(None, max_length=60)

    @field_validator("extra_items", "notes", "address", "customer_name", "customer_phone", "customer_email", "pay_by")
    @classmethod
    def _strip(cls, v):
        return v.strip() if isinstance(v, str) else v

    @model_validator(mode="after")
    def _shape(self):
        if not self.lines and not self.extra_items:
            raise ValueError("Pick something to order")
        if self.customer_email and ("@" not in self.customer_email or "." not in self.customer_email.split("@")[-1]):
            raise ValueError("That does not look like an email address")
        return self


def _products_for_order(gig: dict[str, Any]) -> list[dict[str, Any]]:
    """Products with a stable id. Listings saved before ids existed are
    addressed by position (`idx:N`) until their next save."""
    out = []
    for i, p in enumerate(gig.get("products") or []):
        out.append({
            "id": p.get("id") or f"idx:{i}",
            "name": p.get("name"),
            "price": p.get("price"),
            "currency": p.get("currency") or "ILS",
            "description": p.get("description") or "",
            "image": (p.get("images") or [None])[0] or p.get("image"),
            "in_stock": p.get("in_stock", True),
            "group": p.get("group") or None,
            "serves": p.get("serves") or None,
        })
    return out


async def _store_for_ordering(gig_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
    gig = await db.marketplace_gigs.find_one({"_id": gig_id})
    if not gig or (gig.get("gig_type") or "deliverable") != "store" or gig.get("status", "published") != "published":
        raise HTTPException(status_code=404, detail="This store is not taking orders")
    biz = await db.businesses.find_one({"_id": gig.get("business_id")}) if gig.get("business_id") else None
    if not biz or not biz.get("active", True):
        raise HTTPException(status_code=404, detail="This store is not taking orders")
    return gig, biz


def _areas_out(biz: dict[str, Any]) -> list[dict[str, Any]]:
    from .shared import _LOCATION_BY_SLUG
    out = []
    for slug in biz.get("areas") or []:
        loc = _LOCATION_BY_SLUG.get(slug)
        out.append({"slug": slug, "label": (loc or {}).get("label") or slug, "label_he": (loc or {}).get("label_he")})
    return out


@router.get("/order-form/{gig_id}")
async def order_form(gig_id: str):
    gig, biz = await _store_for_ordering(gig_id)
    st = biz.get("order_settings") or {}
    return {
        "gig": {"id": gig["_id"], "title": gig.get("title"), "title_he": gig.get("title_he")},
        "business": {
            "id": biz["_id"], "name": biz.get("name") or "", "name_he": biz.get("name_he"), "logo_url": biz.get("logo_url"), "slug": biz.get("slug"),
            "areas": _areas_out(biz), "serves_nationwide": bool(biz.get("serves_nationwide")),
            "payment_links": biz.get("payment_links") or [], "payment_note": biz.get("payment_note"),
        },
        "products": _products_for_order(gig),
        "settings": {
            "cutoffs": biz.get("order_cutoffs") or [],
            "pickup_windows": (st.get("windows") or {}).get("pickup") or [],
            "delivery_windows": (st.get("windows") or {}).get("delivery") or [],
            "delivery_fee": st.get("delivery_fee"),
            "min_order": st.get("min_order"),
        },
        "today": datetime.now(_IL_TZ).date().isoformat(),
    }


@router.post("/order-form/{gig_id}/orders")
async def place_website_order(gig_id: str, payload: WebsiteOrderIn, request: Request, viewer=Depends(optional_user)):
    check_rate(request, bucket="orders_website", limit=20, window_seconds=600)
    gig, biz = await _store_for_ordering(gig_id)
    st = biz.get("order_settings") or {}
    now = datetime.now(_IL_TZ)

    # The date: real, not past, not past its cutoff.
    try:
        day = datetime.strptime(payload.date, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Pick a real date") from exc
    if day < now.date():
        raise HTTPException(status_code=400, detail="That day has passed")
    if past_cutoff(payload.date, biz.get("order_cutoffs") or [], now):
        raise HTTPException(status_code=400, detail="Orders for that day have closed")

    # The window: if the store has any for that weekday and kind, one of them.
    wd = _js_weekday(day)
    windows = [w for w in ((st.get("windows") or {}).get(payload.fulfilment) or []) if int(w.get("weekday", -1)) == wd]
    if windows:
        if not payload.window or not any(w["start"] == payload.window.start and w["end"] == payload.window.end for w in windows):
            raise HTTPException(status_code=400, detail="Pick one of the store's time windows")
    elif payload.window:
        payload.window = None

    # The lines: products the store lists, in stock, with the store's price,
    # in the store's currency. One currency per order: a total is one number.
    products = {p["id"]: p for p in _products_for_order(gig)}
    lines, subtotal = [], 0.0
    currencies: set[str] = set()
    for ln in payload.lines:
        prod = products.get(ln.product_id)
        if not prod or not prod.get("in_stock", True):
            raise HTTPException(status_code=400, detail="One of those items is no longer available")
        price = float(prod.get("price") or 0)
        lines.append({"product_id": prod["id"], "name": prod["name"], "price": price, "qty": ln.qty})
        subtotal += price * ln.qty
        currencies.add((prod.get("currency") or "ILS").upper())
    if len(currencies) > 1:
        raise HTTPException(status_code=400, detail="Those items are priced in different currencies; order them separately")
    currency = next(iter(currencies), "ILS")
    sym = _CURRENCY_SYMBOL.get(currency, currency + " ")

    # Delivery: a city the store serves, an address, the minimum, the fee.
    fee = 0.0
    address = None
    if payload.fulfilment == "delivery":
        if not payload.address:
            raise HTTPException(status_code=400, detail="A delivery needs an address")
        if not biz.get("serves_nationwide"):
            if not payload.city or payload.city not in (biz.get("areas") or []):
                raise HTTPException(status_code=400, detail="This store does not deliver there")
        min_order = st.get("min_order")
        if min_order and subtotal < float(min_order):
            raise HTTPException(status_code=400, detail=f"Delivery needs an order of at least {sym}{float(min_order):g}")
        fee = float(st.get("delivery_fee") or 0)
        city_label = next((a["label"] for a in _areas_out(biz) if a["slug"] == payload.city), payload.city or "")
        address = f"{payload.address}, {city_label}".strip(", ") if city_label and city_label.lower() not in payload.address.lower() else payload.address

    phone_e164 = normalize_whatsapp_number(payload.customer_phone)
    if not phone_e164:
        raise HTTPException(status_code=400, detail="Please enter a mobile number with the leading 0 or a country code")

    items_text = "\n".join(f"{ln['qty']} × {ln['name']}" for ln in lines)
    if payload.extra_items:
        items_text = (items_text + "\n" if items_text else "") + payload.extra_items
    # The stated way to pay goes into the notes, where every surface the
    # store already has (board, print sheet, run sheet) shows it.
    notes = payload.notes
    if payload.pay_by:
        notes = (notes + "\n" if notes else "") + f"Pays by: {payload.pay_by}"
    needed_by = payload.date + (f"T{payload.window.start}" if payload.window else "")
    total = round(subtotal + fee, 2) if lines else None

    stamp = _now_iso()
    doc = {
        "_id": str(uuid.uuid4()),
        "business_id": biz["_id"],
        "owner_user_id": biz["owner_user_id"],
        "gig_id": gig["_id"],
        "customer_name": payload.customer_name,
        "customer_phone": payload.customer_phone,
        "customer_phone_e164": phone_e164,
        "customer_email": payload.customer_email or None,
        "customer_user_id": (viewer or {}).get("user_id"),
        "items": items_text,
        "lines": lines,
        "subtotal": round(subtotal, 2) if lines else None,
        "delivery_fee": fee if payload.fulfilment == "delivery" else 0.0,
        "total": total,
        "currency": currency,
        "pay_by": payload.pay_by or None,
        "needed_by": needed_by,
        "window": payload.window.model_dump() if payload.window else None,
        "fulfilment": payload.fulfilment,
        "city": payload.city if payload.fulfilment == "delivery" else None,
        "address": address,
        "notes": notes,
        "status": "new",
        "source": "website",
        "courier": None,
        "assigned_at": None,
        "created_by": (viewer or {}).get("user_id") or "customer",
        "created_at": stamp,
        "updated_at": stamp,
        "status_changed_at": stamp,
        "history": [{"status": "new", "at": stamp, "by": "customer"}],
        "track_token": secrets.token_urlsafe(16),
    }
    await db.store_orders.insert_one(doc)
    doc = await auto_assign(doc, biz)
    track = f"{_frontend_url()}/orders/track/{doc['track_token']}"

    # Tell the store: badge, bell, email.
    await _notify(biz["owner_user_id"], type_="order_new", message=f"New order: {_order_line(doc)}", action_url="/dashboard?tab=orders", order_id=doc["_id"])
    owner = await db.users.find_one({"id": biz["owner_user_id"]}, {"_id": 0, "email": 1})
    await _email(
        (owner or {}).get("email"), f"New order from {payload.customer_name}",
        f"<p><strong>{payload.customer_name}</strong> ordered on your page:</p><p>{items_text.replace(chr(10), '<br>')}</p>"
        f"<p>{'Delivery to ' + (address or '') if payload.fulfilment == 'delivery' else 'Pickup'} · {needed_by.replace('T', ' ')}"
        + (f" · {sym}{total:g}" if total is not None else "") + "</p>",
        tag="order-new", button=("Open my orders", f"{_frontend_url()}/dashboard?tab=orders"),
    )
    # Tell the customer, with the link and how to pay.
    pay = biz.get("payment_note") or ""
    links = "".join(f'<p><a href="{l.get("url")}">{l.get("label") or l.get("url")}</a></p>' for l in biz.get("payment_links") or [])
    await _email(
        payload.customer_email, f"Your order from {biz.get('name')}",
        f"<p>Thanks, {payload.customer_name}. {biz.get('name')} has your order:</p><p>{items_text.replace(chr(10), '<br>')}</p>"
        f"<p>{'Delivery to ' + (address or '') if payload.fulfilment == 'delivery' else 'Pickup at the store'} · {needed_by.replace('T', ' ')}"
        + (f" · {sym}{total:g}" if total is not None else "") + "</p>"
        + (f"<p>Payment goes to the store directly. {pay}</p>{links}" if (pay or links) else "<p>Payment goes to the store directly.</p>"),
        tag="order-confirmation", button=("Follow your order", track),
    )
    return {"order_id": doc["_id"], "track_token": doc["track_token"], "track_url": track, "total": total, "currency": currency, "delivery_fee": doc["delivery_fee"]}


@router.get("/orders/mine")
async def my_orders(user=Depends(verify_token)):
    """A signed-in customer's own orders, newest first, with the same
    face the status link shows plus the delivery photo."""
    out = []
    bizes: dict[str, dict[str, Any]] = {}
    async for o in db.store_orders.find({"customer_user_id": user["user_id"]}).sort("created_at", -1).limit(100):
        biz = bizes.get(o["business_id"])
        if biz is None:
            biz = await db.businesses.find_one({"_id": o["business_id"]}) or {}
            bizes[o["business_id"]] = biz
        out.append({
            "id": o["_id"],
            "business": {"name": biz.get("name") or "", "name_he": biz.get("name_he"), "logo_url": biz.get("logo_url"), "slug": biz.get("slug")},
            "items": o.get("items"), "lines": o.get("lines"), "total": o.get("total"), "delivery_fee": o.get("delivery_fee"),
            "needed_by": o.get("needed_by"), "window": o.get("window"), "fulfilment": o.get("fulfilment"), "address": o.get("address"),
            "status": o.get("status"), "status_changed_at": o.get("status_changed_at"), "created_at": o.get("created_at"),
            "delivered_at": (o.get("delivery") or {}).get("delivered_at"),
            "delivered_photo_url": (o.get("delivery") or {}).get("photo_url") if o.get("status") == "done" else None,
            "paid": bool((o.get("payment") or {}).get("method")),
            "track_token": o.get("track_token"),
        })
    return out
