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
door and the customer-phone rule (O5, O6). Deliberately NOT here yet: the
customer status link (O7), cutoffs and standing orders (O8). No field for
either exists on the record until the surface that uses it does — an
unread field on a model is exactly what the dead-ends audit flags.
"""
from __future__ import annotations

import csv
import io
import json
import os
import re
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Any, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator, model_validator

from routes.deps import db, logger, verify_token
from utils.rate_limit import check_rate
from utils.sms import send_sms
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
        await db.businesses.create_index("orders_staff_token", sparse=True, background=True)
        await db.businesses.create_index("couriers.token", sparse=True, background=True)
        await db.store_orders.create_index([("business_id", 1), ("courier.id", 1)], background=True)
        await db.store_orders.create_index("track_token", sparse=True, background=True)
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
# couriers, the run sheet, and money at the door (spec O5 + O6)
# ---------------------------------------------------------------------------
#
# A courier is a RELATIONSHIP, not a status. The store adds the friend
# with the scooter to its own trusted list, by name and phone; there is
# no marketplace pool, no rating, no new role on the user model. Each
# courier gets a capability token, like the staff link, and their run
# sheet lives behind it: one ordered list of the stops assigned to them,
# each with Waze, the items, the amount due and — only while the order is
# `ready` — the customer's phone.
#
# The phone rule (O6) is the one genuinely new surface here. Today no
# user learns another user's number as data; a courier reaching a
# customer is that, so: visible only on the assigned courier's sheet,
# only while `ready`, and every reveal is written on the order.
#
# Money (O6): the courier's screen shows the store's own payment link and
# note first ("pay the store on your phone") and "Collected cash" one tap
# further. What is recorded is the courier's tap at the door, timestamped,
# which is the store's reconciliation. We record money; we never move it.

FAILED_REASONS = ("nobody_home", "wrong_address", "refused", "not_found", "other")
PAYMENT_METHODS = ("cash", "bit", "other")


class CourierIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    phone: str = Field(..., min_length=5, max_length=40)

    @field_validator("name", "phone")
    @classmethod
    def _strip(cls, v):
        return v.strip()


class AssignIn(BaseModel):
    courier_id: Optional[str] = None      # None = take it off the courier


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


def _public_courier(c: dict[str, Any], *, with_token: bool) -> dict[str, Any]:
    out = {k: c.get(k) for k in ("id", "name", "phone", "phone_e164", "added_at")}
    if with_token:
        out["token"] = c.get("token")
    return out


def _payment_record(p: Optional[PaymentIn], by: str) -> Optional[dict[str, Any]]:
    if p is None or p.method is None:
        return None
    return {"method": p.method, "amount": p.amount, "at": _now_iso(), "by": by}


@router.get("/businesses/{business_id}/couriers")
async def list_couriers(business_id: str, user=Depends(verify_token)):
    biz = await _owned_business(business_id, user)
    return [_public_courier(c, with_token=True) for c in biz.get("couriers") or []]


@router.post("/businesses/{business_id}/couriers")
async def add_courier(business_id: str, payload: CourierIn, user=Depends(verify_token)):
    """Add by phone. The number must normalise — a courier we cannot
    text or the owner cannot WhatsApp is not a courier we can hand an
    order to. Same phone twice updates the name rather than duplicating."""
    biz = await _owned_business(business_id, user)
    e164 = normalize_whatsapp_number(payload.phone)
    if not e164:
        raise HTTPException(status_code=400, detail="Please enter the courier's mobile number with the leading 0 or a country code")
    couriers = list(biz.get("couriers") or [])
    for c in couriers:
        if c.get("phone_e164") == e164:
            c["name"] = payload.name
            c["phone"] = payload.phone
            await db.businesses.update_one({"_id": business_id}, {"$set": {"couriers": couriers}})
            return _public_courier(c, with_token=True)
    if len(couriers) >= 20:
        raise HTTPException(status_code=400, detail="Up to 20 couriers per business")
    c = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "phone": payload.phone,
        "phone_e164": e164,
        "token": secrets.token_urlsafe(24),
        "added_at": _now_iso(),
    }
    couriers.append(c)
    await db.businesses.update_one({"_id": business_id}, {"$set": {"couriers": couriers}})
    return _public_courier(c, with_token=True)


@router.delete("/businesses/{business_id}/couriers/{courier_id}")
async def remove_courier(business_id: str, courier_id: str, user=Depends(verify_token)):
    """Removing a courier kills their link and takes them off every OPEN
    order, which then shows as unassigned so the owner sees it needs a
    new pair of hands. Closed orders keep the name for the record."""
    biz = await _owned_business(business_id, user)
    couriers = [c for c in biz.get("couriers") or [] if c.get("id") != courier_id]
    await db.businesses.update_one({"_id": business_id}, {"$set": {"couriers": couriers}})
    await db.store_orders.update_many(
        {"business_id": business_id, "courier.id": courier_id, "status": {"$in": list(OPEN_STATUSES)}},
        {"$set": {"courier": None, "assigned_at": None, "updated_at": _now_iso()}},
    )
    return {"ok": True}


def _runsheet_url(token: str) -> str:
    base = (os.environ.get("FRONTEND_URL") or os.environ.get("PLATFORM_PUBLIC_URL") or "").rstrip("/")
    return f"{base}/orders/courier/{token}"


@router.patch("/orders/{order_id}/assign")
async def assign_order(order_id: str, payload: AssignIn, user=Depends(verify_token)):
    """Hand a delivery to one of the business's couriers, or take it
    back. Texts the courier the run-sheet link when SMS is configured;
    always returns the link so the owner can send it themselves."""
    order = await _owned_order(order_id, user)
    if order.get("fulfilment") != "delivery":
        raise HTTPException(status_code=400, detail="Only delivery orders are assigned to a courier")
    if order["status"] not in OPEN_STATUSES:
        raise HTTPException(status_code=409, detail="This order is closed")
    biz = await db.businesses.find_one({"_id": order["business_id"]})
    now = _now_iso()
    if payload.courier_id is None:
        await db.store_orders.update_one(
            {"_id": order_id},
            {"$set": {"courier": None, "assigned_at": None, "updated_at": now},
             "$push": {"history": {"status": order["status"], "at": now, "by": user["user_id"], "event": "unassigned"}}},
        )
        fresh = await db.store_orders.find_one({"_id": order_id})
        return {"order": _public(fresh), "runsheet_url": None, "sms_sent": False}

    courier = next((c for c in (biz or {}).get("couriers") or [] if c.get("id") == payload.courier_id), None)
    if not courier:
        raise HTTPException(status_code=404, detail="Courier not found on this business")
    await db.store_orders.update_one(
        {"_id": order_id},
        {"$set": {"courier": {"id": courier["id"], "name": courier["name"]}, "assigned_at": now, "updated_at": now},
         "$push": {"history": {"status": order["status"], "at": now, "by": user["user_id"], "event": "assigned", "courier": courier["name"]}}},
    )
    url = _runsheet_url(courier["token"])
    nb = order.get("needed_by") or ""
    when = f"{nb[:10]} {nb[11:16]}".strip()
    sms_sent = await send_sms(
        courier.get("phone_e164"),
        f"{biz.get('name') or 'A store'}: delivery for {order.get('customer_name')} ({when}). Your run sheet: {url}",
    )
    fresh = await db.store_orders.find_one({"_id": order_id})
    return {"order": _public(fresh), "runsheet_url": url, "sms_sent": sms_sent}


@router.patch("/orders/{order_id}/payment")
async def set_payment(order_id: str, payload: PaymentIn, user=Depends(verify_token)):
    """The owner's own record of a payment at the counter or after the
    fact. Method None clears it. We never move money; this is a note."""
    order = await _owned_order(order_id, user)
    rec = _payment_record(payload, by=user["user_id"])
    await db.store_orders.update_one({"_id": order_id}, {"$set": {"payment": rec, "updated_at": _now_iso()}})
    fresh = await db.store_orders.find_one({"_id": order_id})
    return _public(fresh)


async def _courier_by_token(token: str) -> tuple[dict[str, Any], dict[str, Any]]:
    if not token or len(token) < 20:
        raise HTTPException(status_code=404, detail="This link is not valid")
    biz = await db.businesses.find_one({"couriers.token": token})
    if not biz or not biz.get("active", True):
        raise HTTPException(status_code=404, detail="This link is not valid")
    courier = next((c for c in biz.get("couriers") or [] if c.get("token") == token), None)
    if not courier:
        raise HTTPException(status_code=404, detail="This link is not valid")
    return biz, courier


def _stop(order: dict[str, Any], *, reveal_phone: bool) -> dict[str, Any]:
    """What a courier sees of an order: enough to deliver it, and no
    more. Never the history, never the owner's notes to self, and the
    phone only under the rule above."""
    out = {k: order.get(k) for k in (
        "customer_name", "items", "notes", "needed_by", "address", "status", "total", "currency",
        "fulfilment", "assigned_at", "delivery", "payment", "status_changed_at",
    )}
    out["id"] = order["_id"]
    if reveal_phone:
        out["customer_phone"] = order.get("customer_phone")
        out["customer_phone_e164"] = order.get("customer_phone_e164")
    return out


@router.get("/orders/courier/{token}")
async def courier_runsheet(token: str, request: Request):
    """One ordered list, not five notifications. Open stops assigned to
    this courier plus today's closed ones (so a finished run still
    reads as a run). Soonest first. Phone revealed only on `ready`, and
    the reveal is written on the order the first time it happens."""
    check_rate(request, bucket="orders_courier", limit=600, window_seconds=600)
    biz, courier = await _courier_by_token(token)
    today = datetime.now(_IL_TZ).date().isoformat()
    q = {
        "business_id": biz["_id"],
        "courier.id": courier["id"],
        "$or": [
            {"status": {"$in": list(OPEN_STATUSES)}},
            {"status": {"$in": ["done", "failed"]}, "status_changed_at": {"$gte": today}},
        ],
    }
    stops = []
    async for o in db.store_orders.find(q).sort([("needed_by", 1), ("created_at", 1)]).limit(200):
        reveal = o["status"] == "ready"
        if reveal and not any(r.get("courier_id") == courier["id"] for r in o.get("phone_reveals") or []):
            await db.store_orders.update_one(
                {"_id": o["_id"]},
                {"$push": {"phone_reveals": {"at": _now_iso(), "courier_id": courier["id"], "courier": courier["name"]}}},
            )
        stops.append(_stop(o, reveal_phone=reveal))
    return {
        "business": {
            "name": biz.get("name") or "",
            "name_he": biz.get("name_he"),
            "logo_url": biz.get("logo_url"),
            # The store's own way of being paid, shown to the customer on
            # the courier's phone. Never the courier's.
            "payment_links": biz.get("payment_links") or [],
            "payment_note": biz.get("payment_note"),
        },
        "courier": {"name": courier["name"]},
        "stops": stops,
    }


@router.patch("/orders/courier/{token}/{order_id}/status")
async def courier_set_status(token: str, order_id: str, payload: CourierStatusIn, request: Request):
    """Delivered or failed, at the door, timestamped. Delivered needs a
    photo — it is what protects the courier when a customer says it never
    came. Failed needs a reason from the short list, for the same reason
    in the other direction."""
    check_rate(request, bucket="orders_courier", limit=600, window_seconds=600)
    biz, courier = await _courier_by_token(token)
    order = await db.store_orders.find_one({"_id": order_id, "business_id": biz["_id"], "courier.id": courier["id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] != "ready":
        raise HTTPException(status_code=409, detail="This order is not out for delivery yet")
    if payload.status == "done" and not payload.photo_url:
        raise HTTPException(status_code=400, detail="Add a photo of the delivery first")
    if payload.status == "failed" and not payload.reason:
        raise HTTPException(status_code=400, detail="Pick a reason")
    now = _now_iso()
    delivery: dict[str, Any] = dict(order.get("delivery") or {})
    if payload.status == "done":
        delivery.update({"delivered_at": now, "photo_url": payload.photo_url, "by": courier["name"]})
    else:
        delivery.update({"failed_at": now, "failed_reason": payload.reason, "failed_photo_url": payload.photo_url, "by": courier["name"]})
    sets: dict[str, Any] = {"delivery": delivery}
    if payload.payment is not None and payload.payment.method is not None:
        if payload.payment.method == "cash" and payload.payment.amount is None:
            raise HTTPException(status_code=400, detail="Enter the amount collected")
        sets["payment"] = _payment_record(payload.payment, by=f"courier:{courier['id']}")
    await db.store_orders.update_one({"_id": order_id}, {"$set": sets})
    order = await db.store_orders.find_one({"_id": order_id})
    fresh = await _transition(order, StatusIn(status=payload.status, note=payload.note), by=f"courier:{courier['id']}")
    return _stop({**fresh, "_id": fresh["id"]}, reveal_phone=False)


@router.post("/orders/courier/{token}/{order_id}/photo")
async def courier_photo(token: str, order_id: str, request: Request, file: UploadFile = File(...)):
    """The delivery photo. Same validation and storage as every other
    upload on the site, keyed by the courier's token instead of a session."""
    check_rate(request, bucket="orders_courier_photo", limit=60, window_seconds=600)
    biz, courier = await _courier_by_token(token)
    order = await db.store_orders.find_one({"_id": order_id, "business_id": biz["_id"], "courier.id": courier["id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    from routes.misc import _read_validated_upload, _store_upload
    content, is_video = await _read_validated_upload(file)
    if is_video:
        raise HTTPException(status_code=400, detail="A photo, not a video")
    stored = await _store_upload(content, False, file.filename)
    return {"url": stored["url"]}


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
        "paid": bool((o.get("payment") or {}).get("method")),
    }
