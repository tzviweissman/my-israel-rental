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
    # An amount off is money in one currency (Tzvi, 6 Nov 2026); a percentage fits any total.
    currency: Literal["ILS", "USD"] = "ILS"
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
    return {"id": d["_id"], "code": d["code"], "kind": d["kind"], "currency": d.get("currency", "ILS"), "value": d["value"], "applies_to": d.get("applies_to", "both"),
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
    rows = await db.discount_codes.find({"business_id": business_id, "deleted": {"$ne": True}, "referral_reward": {"$ne": True}, "birthday_gift": {"$ne": True}}).sort("created_at", -1).to_list(200)
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
    # A service counts as much as a product. ponytail: only bookings since 6 Nov 2026 carry these two fields.
    if await db.marketplace_bookings.count_documents({"business_id": business_id, "contact_phone_e164": phone_e164}, limit=1):
        return True
    if await db.quote_requests.count_documents({"business_id": business_id, "phone_e164": phone_e164, "status": "accepted"}, limit=1):
        return True
    async for m in db.business_members.find({"business_id": business_id}, {"phone": 1}):
        if normalize_whatsapp_number(m.get("phone")) == phone_e164:
            return True
    return False


async def evaluate(business_id: str, code: str, form: Literal["orders", "memberships"], amount: float,
                   phone: Optional[str], currency: Optional[str] = None) -> tuple[dict[str, Any], float]:
    """(code document, discount in the total's currency), or CodeRefused(reason)
    with a sentence the customer can read."""
    c = await db.discount_codes.find_one({"business_id": business_id, "code": norm_code(code), "deleted": {"$ne": True}})
    if not c:
        # Someone's personal referral code (referrals.py).
        from .referrals import as_code
        c = await as_code(business_id, norm_code(code))
    if not c:
        # A gift card's code (gift_cards.py): up to its balance off.
        from . import gift_cards
        c = await gift_cards.as_code(business_id, norm_code(code))
    if not c or not c.get("active", True):
        raise CodeRefused("This code is not valid")
    # A gift card or an amount off is money in one currency, and there is no exchange rate here. Only codes
    # that say their currency: older ones and referral or birthday codes carry none, and work as they did.
    if c["kind"] == "amount" and c.get("currency") and currency and c["currency"] != currency.upper():
        raise CodeRefused(("This gift card is in " if c.get("gift_card") else "This code is in ")
                          + ("dollars" if c["currency"] == "USD" else "shekels")
                          + " and this total is not, so it cannot be used here")
    if c.get("applies_to", "both") not in (form, "both"):
        raise CodeRefused("This code is for " + ("orders" if form == "memberships" else "memberships") + " only")
    today = datetime.now(IL).date().isoformat()
    if c.get("starts_on") and today < c["starts_on"]:
        raise CodeRefused(f"This code starts on {c['starts_on']}")
    if c.get("ends_on") and today > c["ends_on"]:
        raise CodeRefused("This code has expired")
    if c.get("max_uses") and c.get("uses", 0) >= c["max_uses"]:
        raise CodeRefused("This code has been used up")
    if form == "orders" and c.get("min_order") and 0 < amount < c["min_order"]:
        raise CodeRefused(f"This code needs an order of at least {'$' if (currency or c.get('currency')) == 'USD' else '₪'}{c['min_order']:g}")
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
    if c.get("gift_card"):
        from . import gift_cards
        return await gift_cards.redeem(c, discount)
    q: dict[str, Any] = {"_id": c["_id"], "active": True, "deleted": {"$ne": True}}
    if c.get("max_uses"):
        q["uses"] = {"$lt": c["max_uses"]}
    e164 = normalize_whatsapp_number(phone) if phone else None
    upd: dict[str, Any] = {"$inc": {"uses": 1, "discount_given": discount}}
    if e164:
        upd["$push"] = {"used_by": {"$each": [e164], "$slice": -5000}}
    return (await db.discount_codes.update_one(q, upd)).modified_count == 1


_HE = {
    "This code is not valid": "הקוד הזה לא תקף",
    "This code has expired": "תוקף הקוד הסתיים",
    "This code has been used up": "הקוד הזה כבר נוצל עד הסוף",
    "This code is for orders only": "הקוד הזה מיועד להזמנות בלבד",
    "This code is for memberships only": "הקוד הזה מיועד למנויים בלבד",
    "This is your own code: send it to a friend": "זה הקוד שלך: שלחו אותו לחבר או חברה",
    "You have already used this code": "כבר השתמשת בקוד הזה",
    "This code is for first-time customers": "הקוד הזה מיועד ללקוחות חדשים",
    "This gift card has been used up": "יתרת שובר המתנה נוצלה",
    "This gift card has expired": "תוקף שובר המתנה הסתיים",
    "This code is in dollars and this total is not, so it cannot be used here": "הקוד הזה בדולרים והסכום כאן לא, ולכן אי אפשר להשתמש בו",
    "This code is in shekels and this total is not, so it cannot be used here": "הקוד הזה בשקלים והסכום כאן לא, ולכן אי אפשר להשתמש בו",
    "This gift card is in dollars and this total is not, so it cannot be used here": "שובר המתנה הזה בדולרים והסכום כאן לא, ולכן אי אפשר להשתמש בו",
    "This gift card is in shekels and this total is not, so it cannot be used here": "שובר המתנה הזה בשקלים והסכום כאן לא, ולכן אי אפשר להשתמש בו",
}


def say(reason: str, lang: Optional[str]) -> str:
    """A refusal in the customer's language. The two with a date or an amount in them are built here."""
    if not (lang or "").startswith("he"):
        return reason
    if reason.startswith("This code starts on "):
        return "הקוד הזה מתחיל ב-" + reason.rsplit(" ", 1)[1]
    if reason.startswith("This code needs an order of at least "):
        return "הקוד הזה דורש הזמנה של " + reason.rsplit(" ", 1)[1] + " לפחות"
    return _HE.get(reason, reason)


async def use_code(business_id: Optional[str], code: str, amount: Optional[float], phone: Optional[str], currency: Optional[str]) -> dict[str, Any]:
    """Check a code against a service's price and count one use: what a booking or
    an accepted price keeps. Raises CodeRefused. No price yet (amount None or 0): the
    code is still noted with what it gives, for the business to take off its own price."""
    c, off = await evaluate(business_id, code, "orders", amount or 0, phone, currency)
    if not await redeem(c, off, phone):
        raise CodeRefused("This code has been used up")
    return {"id": c["_id"], "code": c["code"], "amount": off, "kind": c["kind"], "value": c["value"],
            "gift_card": bool(c.get("gift_card")), "referral": bool(c.get("referral_of")), "currency": currency or "ILS"}


async def give_back_booking(booking_id: str) -> None:
    """A booking that was declined, cancelled or ran out never happened, so its code is
    good again and a gift card gets its money back. Once only, whoever calls first.
    ponytail: a friend's referral code stays counted; its reward has already gone out (referrals.redeem)."""
    b = await db.marketplace_bookings.find_one_and_update(
        {"_id": booking_id, "discount": {"$type": "object"}, "discount.returned": {"$ne": True}},
        {"$set": {"discount.returned": True}}, {"discount": 1, "contact_phone": 1})
    if b:
        await return_use(b["discount"], b.get("contact_phone"))


async def return_use(d: dict[str, Any], phone: Optional[str]) -> None:
    if d.get("referral") or not d.get("id"):
        return
    if d.get("gift_card"):
        if d.get("amount"):
            await db.gift_cards.update_one({"_id": d["id"]}, {"$inc": {"balance": d["amount"]}, "$set": {"status": "active"},
                                                              "$push": {"uses": {"at": datetime.now(IL).isoformat(), "amount": -d["amount"], "where": "booking not taken"}}})
        return
    upd: dict[str, Any] = {"$inc": {"uses": -1, "discount_given": -(d.get("amount") or 0)}}
    e164 = normalize_whatsapp_number(phone) if phone else None
    if e164:
        upd["$pull"] = {"used_by": e164}
    await db.discount_codes.update_one({"_id": d["id"]}, upd)


async def has_codes(biz: dict[str, Any]) -> bool:
    """Whether a customer could be holding a code here, so a designed site's
    order form knows to offer the box (public/pages/mir-code.js). A code past
    its end date or kept for memberships does not count."""
    from . import referrals
    today = datetime.now(IL).date().isoformat()
    if await db.discount_codes.count_documents(
        {"business_id": biz["_id"], "active": True, "deleted": {"$ne": True}, "applies_to": {"$ne": "memberships"},
         "$or": [{"ends_on": None}, {"ends_on": {"$gte": today}}]}, limit=1):
        return True
    return bool(referrals.settings_of(biz)["on"]) or bool(await db.gift_cards.count_documents({"business_id": biz["_id"]}, limit=1))


class CheckIn(BaseModel):
    code: str = Field(..., min_length=1, max_length=40)
    form: Literal["orders", "memberships"] = "orders"
    amount: float = Field(0, ge=0, le=1_000_000)
    phone: Optional[str] = Field(None, max_length=40)
    currency: Optional[str] = Field(None, max_length=3)
    lang: Optional[str] = Field(None, max_length=5)


@router.get("/gigs/{gig_id}/code-box")
async def code_box(gig_id: str):
    """What a designed site's form needs to know about any listing, product or service
    (public/pages/mir-code.js): the business, and whether to offer the box."""
    from .orders import pause_of
    gig = await db.marketplace_gigs.find_one({"_id": gig_id}, {"business_id": 1, "status": 1})
    biz = await db.businesses.find_one({"_id": gig.get("business_id")}) if gig and gig.get("business_id") else None
    if not gig or gig.get("status", "published") != "published" or not biz or not biz.get("active", True):
        raise HTTPException(status_code=404, detail="This listing is not taking orders")
    return {"business": {"id": biz["_id"]}, "has_codes": await has_codes(biz), "paused": pause_of(biz)}


@router.post("/businesses/{business_id}/discount-codes/check")
async def check_code(business_id: str, body: CheckIn, request: Request):
    """The form's live check, before the customer sends. Rate-limited:
    it must not become a way to guess a business's codes."""
    check_rate(request, bucket="discount_check", limit=30, window_seconds=600)
    try:
        c, off = await evaluate(business_id, body.code, body.form, body.amount, body.phone, body.currency)
    except CodeRefused as e:
        return {"ok": False, "reason": say(str(e), body.lang)}
    return {"ok": True, "code": c["code"], "kind": c["kind"], "value": c["value"], "discount": off}


async def ensure_discount_indexes() -> None:
    await db.marketplace_bookings.create_index([("business_id", 1), ("contact_phone_e164", 1)], sparse=True)
    await db.discount_codes.create_index([("business_id", 1), ("code", 1)], unique=True)
