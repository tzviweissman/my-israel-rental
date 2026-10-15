"""Discount codes (Tzvi, 15 Oct 2026: the Shopify idea, "discount codes").

A business makes a code ("FIRST10", "SHABBAT20") for 10% or ₪20 off, and
customers type it on the order form (orders.py) or the membership sign-up
(memberships.py). The site takes no payment yet, so a discount changes the
total the business sees and charges: it is recorded on the order or the
membership, with the code, so the business knows what to collect.

Conditions a code can carry, each optional:

    starts_on / ends_on   the dates it works between (Israel time)
    min_order             the smallest order it applies to (orders only)
    max_uses              how many times in total
    once_per_customer     once per phone number
    first_order_only      only for someone who has never ordered from or
                          joined this business before
    applies_to            orders, memberships, or both

A percentage never takes more than the order, and a fixed amount never
makes a total negative. Codes are per business, never shared: SUMMER at
the bakery is not SUMMER at the gym. Checked on the server every time;
the form's live check is only a preview of the same rules.
"""
from __future__ import annotations

import re
import uuid
from datetime import date, datetime
from typing import Any, Literal, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from routes.deps import db, verify_token
from utils.rate_limit import check_rate
from utils.whatsapp_link import normalize_whatsapp_number

router = APIRouter(prefix="/marketplace", tags=["marketplace"])
IL = ZoneInfo("Asia/Jerusalem")
_CODE = re.compile(r"^[A-Z0-9][A-Z0-9_-]{2,23}$")


def norm_code(code: str) -> str:
    return re.sub(r"\s+", "", code or "").upper()


async def _owned(business_id: str, user: dict[str, Any]) -> dict[str, Any]:
    """The owner, an admin, or staff with the Discounts area (utils/business_access.py)."""
    from utils.business_access import business_access
    return await business_access(db, business_id, user, "discounts")


class CodeIn(BaseModel):
    code: str = Field(..., min_length=3, max_length=24)
    kind: Literal["percent", "amount"] = "percent"
    value: float = Field(..., gt=0, le=100000)
    applies_to: Literal["orders", "memberships", "both"] = "both"
    starts_on: Optional[date] = None
    ends_on: Optional[date] = None
    min_order: Optional[float] = Field(None, ge=0, le=100000)
    max_uses: Optional[int] = Field(None, ge=1, le=100000)
    once_per_customer: bool = True
    first_order_only: bool = False
    active: bool = True


def _check_in(b: CodeIn) -> str:
    code = norm_code(b.code)
    if not _CODE.match(code):
        raise HTTPException(status_code=422, detail="A code is 3 to 24 letters or numbers (English letters), no spaces")
    if b.kind == "percent" and b.value > 100:
        raise HTTPException(status_code=422, detail="A percentage can be at most 100")
    if b.starts_on and b.ends_on and b.ends_on < b.starts_on:
        raise HTTPException(status_code=422, detail="The end date is before the start date")
    return code


def _out(d: dict[str, Any]) -> dict[str, Any]:
    return {"id": d["_id"], "code": d["code"], "kind": d["kind"], "value": d["value"], "applies_to": d.get("applies_to", "both"),
            "starts_on": d.get("starts_on"), "ends_on": d.get("ends_on"), "min_order": d.get("min_order"),
            "max_uses": d.get("max_uses"), "once_per_customer": d.get("once_per_customer", True),
            "first_order_only": d.get("first_order_only", False), "active": d.get("active", True),
            "uses": d.get("uses", 0), "discount_given": round(d.get("discount_given", 0.0), 2), "created_at": d.get("created_at")}


def _doc_fields(b: CodeIn, code: str) -> dict[str, Any]:
    return {**b.model_dump(), "code": code,
            "starts_on": b.starts_on.isoformat() if b.starts_on else None,
            "ends_on": b.ends_on.isoformat() if b.ends_on else None}


@router.get("/businesses/{business_id}/discount-codes")
async def list_codes(business_id: str, user=Depends(verify_token)):
    await _owned(business_id, user)
    # Thank-you codes from referrals (referrals.py) are left out: one per
    # friend sent, they would bury the business's own codes.
    rows = await db.discount_codes.find({"business_id": business_id, "deleted": {"$ne": True}, "referral_reward": {"$ne": True}}).sort("created_at", -1).to_list(200)
    return [_out(d) for d in rows]


@router.post("/businesses/{business_id}/discount-codes")
async def create_code(business_id: str, body: CodeIn, user=Depends(verify_token)):
    await _owned(business_id, user)
    code = _check_in(body)
    if await db.discount_codes.count_documents({"business_id": business_id, "deleted": {"$ne": True}, "referral_reward": {"$ne": True}}) >= 100:
        raise HTTPException(status_code=400, detail="A business can have up to 100 codes")
    doc = {"_id": str(uuid.uuid4()), "business_id": business_id, **_doc_fields(body, code), "uses": 0, "discount_given": 0.0,
           "used_by": [], "created_at": datetime.now(IL).isoformat(timespec="seconds")}
    try:
        await db.discount_codes.insert_one(doc)
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail=f"You already have a code called {code}") from exc
    return _out(doc)


@router.put("/businesses/{business_id}/discount-codes/{code_id}")
async def update_code(business_id: str, code_id: str, body: CodeIn, user=Depends(verify_token)):
    await _owned(business_id, user)
    code = _check_in(body)
    try:
        d = await db.discount_codes.find_one_and_update(
            {"_id": code_id, "business_id": business_id, "deleted": {"$ne": True}},
            {"$set": _doc_fields(body, code)}, return_document=ReturnDocument.AFTER)
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail=f"You already have a code called {code}") from exc
    if not d:
        raise HTTPException(status_code=404, detail="Code not found")
    return _out(d)


@router.delete("/businesses/{business_id}/discount-codes/{code_id}")
async def delete_code(business_id: str, code_id: str, user=Depends(verify_token)):
    """Retired, not erased: orders that used it still name it. The code
    itself is freed for reuse."""
    await _owned(business_id, user)
    r = await db.discount_codes.update_one({"_id": code_id, "business_id": business_id},
                                           {"$set": {"deleted": True, "active": False, "code": f"~{code_id}"}})
    if not r.matched_count:
        raise HTTPException(status_code=404, detail="Code not found")
    return {"ok": True}


# ---------------------------------------------------------------------------
# checking and using a code
# ---------------------------------------------------------------------------

class CodeRefused(Exception):
    pass


async def _is_returning(business_id: str, phone_e164: Optional[str]) -> bool:
    if not phone_e164:
        return False
    if await db.store_orders.count_documents({"business_id": business_id, "customer_phone_e164": phone_e164}, limit=1):
        return True
    async for m in db.business_members.find({"business_id": business_id}, {"phone": 1}):
        if normalize_whatsapp_number(m.get("phone")) == phone_e164:
            return True
    return False


async def evaluate(business_id: str, code: str, form: Literal["orders", "memberships"], amount: float,
                   phone: Optional[str]) -> tuple[dict[str, Any], float]:
    """(code document, discount in shekels), or CodeRefused(reason) with a
    sentence the customer can read."""
    c = await db.discount_codes.find_one({"business_id": business_id, "code": norm_code(code), "deleted": {"$ne": True}})
    if not c:
        # Someone's personal referral code (referrals.py).
        from .referrals import as_code
        c = await as_code(business_id, norm_code(code))
    if not c or not c.get("active", True):
        raise CodeRefused("This code is not valid")
    if c.get("applies_to", "both") not in (form, "both"):
        raise CodeRefused("This code is for " + ("orders" if form == "memberships" else "memberships") + " only")
    today = datetime.now(IL).date().isoformat()
    if c.get("starts_on") and today < c["starts_on"]:
        raise CodeRefused(f"This code starts on {c['starts_on']}")
    if c.get("ends_on") and today > c["ends_on"]:
        raise CodeRefused("This code has expired")
    if c.get("max_uses") and c.get("uses", 0) >= c["max_uses"]:
        raise CodeRefused("This code has been used up")
    if form == "orders" and c.get("min_order") and amount < c["min_order"]:
        raise CodeRefused(f"This code needs an order of at least ₪{c['min_order']:g}")
    e164 = normalize_whatsapp_number(phone) if phone else None
    if c.get("referral_of") and e164 == c["referral_of"]:
        raise CodeRefused("This is your own code: send it to a friend")
    if c.get("once_per_customer", True) and e164 and e164 in (c.get("used_by") or []):
        raise CodeRefused("You have already used this code")
    if c.get("first_order_only") and await _is_returning(business_id, e164):
        raise CodeRefused("This code is for first-time customers")
    off = amount * c["value"] / 100 if c["kind"] == "percent" else c["value"]
    return c, round(max(0.0, min(off, amount)), 2)


async def redeem(c: dict[str, Any], discount: float, phone: Optional[str]) -> bool:
    """Count one use, atomically: a code with max_uses=1 used by two people
    at the same moment goes to one of them."""
    if c.get("referral_of"):
        from . import referrals
        return await referrals.redeem(c, discount, phone)
    q: dict[str, Any] = {"_id": c["_id"], "active": True, "deleted": {"$ne": True}}
    if c.get("max_uses"):
        q["uses"] = {"$lt": c["max_uses"]}
    e164 = normalize_whatsapp_number(phone) if phone else None
    upd: dict[str, Any] = {"$inc": {"uses": 1, "discount_given": discount}}
    if e164:
        upd["$push"] = {"used_by": {"$each": [e164], "$slice": -5000}}
    return (await db.discount_codes.update_one(q, upd)).modified_count == 1


class CheckIn(BaseModel):
    code: str = Field(..., min_length=1, max_length=40)
    form: Literal["orders", "memberships"] = "orders"
    amount: float = Field(0, ge=0, le=1_000_000)
    phone: Optional[str] = Field(None, max_length=40)


@router.post("/businesses/{business_id}/discount-codes/check")
async def check_code(business_id: str, body: CheckIn, request: Request):
    """The form's live check, before the customer sends. Rate-limited:
    it must not become a way to guess a business's codes."""
    check_rate(request, bucket="discount_check", limit=30, window_seconds=600)
    try:
        c, off = await evaluate(business_id, body.code, body.form, body.amount, body.phone)
    except CodeRefused as e:
        return {"ok": False, "reason": str(e)}
    return {"ok": True, "code": c["code"], "kind": c["kind"], "value": c["value"], "discount": off}


async def ensure_discount_indexes() -> None:
    await db.discount_codes.create_index([("business_id", 1), ("code", 1)], unique=True)
