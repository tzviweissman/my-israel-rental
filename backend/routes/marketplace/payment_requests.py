"""Payment requests sent by message (Tzvi, 22 Oct 2026, from GoHighLevel's
"Text-2-Pay").

The business types an amount and what it is for, and gets a link to send
the customer on WhatsApp, by text or by email. The link opens a short page:
"{business} asks you to pay 120 for: deep clean, 3 rooms", with the
business's OWN payment buttons (Bit, PayBox, Grow and the rest, the same
allowlisted links its page shows) and a button "I have paid".

We never touch the money, as everywhere on the site (utils/payment_links):
the customer pays on the provider's site, and "I have paid" only tells the
business to check. The business marks the request paid once the money is
in. So the statuses are:

    open           sent, nothing heard yet
    customer_paid  the customer pressed "I have paid" (the business checks)
    paid           the business marked it paid
    cancelled      the business withdrew it; the page then says so

The customer does not sign in (standing rule): the unguessable token in
the link is the proof, as with order tracking links. The page shows only
the request itself, the business's name and its payment options, never
the customer's phone or email.

A business without any payment link or payment note cannot send one: the
page would have nothing to offer.
"""
from __future__ import annotations

import re
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from routes.deps import db, verify_token
from utils.payment_links import allowed_payment_links
from utils.rate_limit import check_rate
from utils.whatsapp_link import normalize_whatsapp_number

from .orders import _frontend_url, _notify

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

PER_DAY = 100     # requests a business can create in a day


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _owned(business_id: str, user: dict[str, Any]) -> dict[str, Any]:
    """The owner, an admin, or staff with the Orders area (utils/business_access.py)."""
    from utils.business_access import business_access
    return await business_access(db, business_id, user, "orders")


def _can_take_payment(biz: dict[str, Any]) -> bool:
    return bool(allowed_payment_links(biz.get("payment_links")) or (biz.get("payment_note") or "").strip())


class RequestIn(BaseModel):
    amount: float = Field(..., gt=0, le=100000)
    description: str = Field(..., min_length=2, max_length=160)
    customer_name: Optional[str] = Field(None, max_length=80)
    customer_phone: Optional[str] = Field(None, max_length=30)
    customer_email: Optional[str] = Field(None, max_length=120)
    lang: Literal["en", "he"] = "en"


class StatusIn(BaseModel):
    status: Literal["open", "paid", "cancelled"]


def _link(token: str) -> str:
    return f"{_frontend_url()}/pay/{token}"


def _money(amount: float) -> str:
    return f"₪{amount:,.2f}".replace(".00", "")


def message_text(biz_name: str, r: dict[str, Any]) -> str:
    """The message the business sends, in the request's language. Pure."""
    first = (r.get("customer_name") or "").strip().split(" ")[0]
    amount, what, link = _money(r["amount"]), r["description"], _link(r["token"])
    if r.get("lang") == "he":
        hi = f"שלום {first}," if first else "שלום,"
        return f"{hi}\nזו בקשת תשלום מ-{biz_name} על סך {amount} עבור: {what}.\nאפשר לשלם כאן: {link}"
    hi = f"Hello {first}," if first else "Hello,"
    return f"{hi}\nHere is a payment request from {biz_name} for {amount}, for: {what}.\nYou can pay here: {link}"


def _owner_view(biz: dict[str, Any], r: dict[str, Any]) -> dict[str, Any]:
    phone = normalize_whatsapp_number(r.get("customer_phone")) if r.get("customer_phone") else None
    return {"id": r["_id"], "amount": r["amount"], "description": r["description"],
            "customer_name": r.get("customer_name"), "customer_phone": r.get("customer_phone"),
            "customer_email": r.get("customer_email"), "lang": r.get("lang", "en"),
            "status": r["status"], "created_at": r["created_at"], "customer_paid_at": r.get("customer_paid_at"),
            "paid_at": r.get("paid_at"), "link": _link(r["token"]),
            "message": message_text(biz.get("name") or "", r),
            "whatsapp_to": phone.lstrip("+") if phone else None}


@router.post("/businesses/{business_id}/payment-requests")
async def create_request(business_id: str, body: RequestIn, user=Depends(verify_token)):
    biz = await _owned(business_id, user)
    if not _can_take_payment(biz):
        raise HTTPException(status_code=400, detail="Add a payment link (Bit, PayBox, Grow...) or a payment note to your business details first, so the customer has a way to pay.")
    day_ago = datetime.fromtimestamp(datetime.now(timezone.utc).timestamp() - 86400, timezone.utc).isoformat()
    if await db.payment_requests.count_documents({"business_id": business_id, "created_at": {"$gte": day_ago}}) >= PER_DAY:
        raise HTTPException(status_code=429, detail=f"Up to {PER_DAY} payment requests a day.")
    email = (body.customer_email or "").strip().lower() or None
    if email and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(status_code=400, detail="That email address does not look right")
    doc = {"_id": str(uuid.uuid4()), "token": secrets.token_urlsafe(12), "business_id": business_id,
           "amount": round(body.amount, 2), "currency": "ILS", "description": body.description.strip(),
           "customer_name": (body.customer_name or "").strip() or None,
           "customer_phone": (body.customer_phone or "").strip() or None, "customer_email": email,
           "lang": body.lang, "status": "open", "by": user["user_id"], "created_at": _now()}
    await db.payment_requests.insert_one(doc)
    return _owner_view(biz, doc)


@router.get("/businesses/{business_id}/payment-requests")
async def list_requests(business_id: str, user=Depends(verify_token)):
    biz = await _owned(business_id, user)
    rows = await db.payment_requests.find({"business_id": business_id}).sort("created_at", -1).to_list(50)
    return {"can_take_payment": _can_take_payment(biz), "requests": [_owner_view(biz, r) for r in rows]}


@router.post("/businesses/{business_id}/payment-requests/{request_id}/status")
async def set_status(business_id: str, request_id: str, body: StatusIn, user=Depends(verify_token)):
    biz = await _owned(business_id, user)
    stamp = {"paid": {"paid_at": _now()}, "cancelled": {"cancelled_at": _now()}}.get(body.status, {})
    res = await db.payment_requests.find_one_and_update(
        {"_id": request_id, "business_id": business_id}, {"$set": {"status": body.status, **stamp}}, return_document=True)
    if not res:
        raise HTTPException(status_code=404, detail="Payment request not found")
    return _owner_view(biz, res)


async def _by_token(token: str) -> tuple[dict[str, Any], dict[str, Any]]:
    r = await db.payment_requests.find_one({"token": token})
    biz = r and await db.businesses.find_one({"_id": r["business_id"]})
    if not r or not biz:
        raise HTTPException(status_code=404, detail="This payment link is not valid")
    return r, biz


@router.get("/pay/{token}")
async def public_request(token: str, request: Request):
    check_rate(request, bucket="pay_page", limit=120, window_seconds=600)
    r, biz = await _by_token(token)
    first = (r.get("customer_name") or "").strip().split(" ")[0] or None
    return {"amount": r["amount"], "currency": r.get("currency", "ILS"), "description": r["description"],
            "customer_first_name": first, "lang": r.get("lang", "en"), "status": r["status"],
            "created_at": r["created_at"],
            "business": {"name": biz.get("name"), "name_he": biz.get("name_he"), "logo_url": biz.get("logo_url"),
                         "slug": biz.get("slug") or biz["_id"],
                         "payment_links": allowed_payment_links(biz.get("payment_links")),
                         "payment_note": biz.get("payment_note")}}


@router.post("/pay/{token}/paid")
async def customer_says_paid(token: str, request: Request):
    """The customer pressed "I have paid". Tells the business to check;
    does not mark the request paid."""
    check_rate(request, bucket="pay_paid", limit=20, window_seconds=600)
    r, biz = await _by_token(token)
    if r["status"] != "open":
        return {"status": r["status"]}
    await db.payment_requests.update_one({"_id": r["_id"], "status": "open"},
                                         {"$set": {"status": "customer_paid", "customer_paid_at": _now()}})
    owner = await db.users.find_one({"id": biz["owner_user_id"]}, {"preferred_language": 1}) or {}
    if str(owner.get("preferred_language") or "").startswith("he"):
        who = r.get("customer_name") or "הלקוח"
        message = f"לפי {who}, שולמו {_money(r['amount'])} עבור {r['description']}. בדקו שהכסף נכנס וסמנו ששולם."
    else:
        who = r.get("customer_name") or "A customer"
        message = f"{who} says they paid {_money(r['amount'])} for {r['description']}. Check it came in, then mark it paid."
    await _notify(biz["owner_user_id"], type_="payment_request_paid", message=message,
                  action_url="/dashboard?tab=customers&pay=1", business_id=biz["_id"])
    return {"status": "customer_paid"}


async def ensure_payment_request_indexes() -> None:
    await db.payment_requests.create_index("token", unique=True)
    await db.payment_requests.create_index([("business_id", 1), ("created_at", -1)])
