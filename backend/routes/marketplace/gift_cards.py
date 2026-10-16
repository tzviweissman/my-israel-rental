"""Gift cards (Tzvi, 16 Oct 2026, from Square, Shopify and Booksy).

A customer buys a gift card on the business's page (/gift-cards/<slug>)
for someone else or for themselves. The site takes no payment, so the
card waits until the business confirms it was paid, exactly as a
membership does; only then is a code made and the card emailed to the
person it is for, with the buyer's message. A business can also sell one
at the counter from the dashboard, already paid.

The code is used like a discount code, in the same box on the order form
and the membership sign-up (discounts.evaluate falls through to
`as_code` here): it takes up to its balance off the total, and what is
left stays on the card. At the counter the business deducts by hand.

Valid five years from the day it is paid: Israel's consumer protection
rules do not allow a gift card to expire sooner.
"""
from __future__ import annotations

import secrets
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any, Literal, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from pymongo import ReturnDocument

from routes.deps import db, logger, verify_token
from utils.payment_links import allowed_payment_links
from utils.rate_limit import check_rate

from .orders import _email, _esc, _frontend_url, _notify, _subject

router = APIRouter(prefix="/marketplace", tags=["marketplace"])
IL = ZoneInfo("Asia/Jerusalem")
_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
VALID_YEARS = 5
DEFAULTS = {"on": False, "amounts": [100, 200, 300], "custom": True, "note": ""}
MIN_AMOUNT, MAX_AMOUNT = 20, 5000


def settings_of(biz: dict[str, Any]) -> dict[str, Any]:
    return {**DEFAULTS, **(biz.get("gift_card_settings") or {})}


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _today() -> date:
    return datetime.now(IL).date()


async def _business(slug_or_id: str) -> dict[str, Any]:
    biz = await db.businesses.find_one({"$or": [{"_id": slug_or_id}, {"slug": slug_or_id.lower()}]})
    if not biz or not biz.get("active", True) or not settings_of(biz)["on"]:
        raise HTTPException(status_code=404, detail="Gift cards are not available here")
    return biz


async def _new_code() -> str:
    for _ in range(20):
        code = "GIFT-" + "".join(secrets.choice(_CHARS) for _ in range(4)) + "-" + "".join(secrets.choice(_CHARS) for _ in range(4))
        if not await db.gift_cards.find_one({"code": code}, {"_id": 1}):
            return code
    raise HTTPException(status_code=500, detail="Could not make a gift card code")


def _valid(card: dict[str, Any]) -> bool:
    return card.get("status") == "active" and (card.get("expires_on") or "9999") >= _today().isoformat()


# ---------------------------------------------------------------------------
# the business's settings
# ---------------------------------------------------------------------------

class SettingsIn(BaseModel):
    on: bool
    amounts: list[int] = Field(default_factory=lambda: [100, 200, 300], max_length=6)
    custom: bool = True
    note: str = Field("", max_length=400)

    @field_validator("amounts")
    @classmethod
    def _amounts(cls, v: list[int]) -> list[int]:
        out = sorted({a for a in v if MIN_AMOUNT <= a <= MAX_AMOUNT})
        if not out:
            raise ValueError(f"Add at least one amount between {MIN_AMOUNT} and {MAX_AMOUNT}")
        return out


async def _access(business_id: str, user: dict[str, Any]) -> dict[str, Any]:
    from utils.business_access import business_access
    return await business_access(db, business_id, user, "discounts")


@router.get("/businesses/{business_id}/gift-card-settings")
async def get_settings(business_id: str, user=Depends(verify_token)):
    return settings_of(await _access(business_id, user))


@router.put("/businesses/{business_id}/gift-card-settings")
async def put_settings(business_id: str, body: SettingsIn, user=Depends(verify_token)):
    await _access(business_id, user)
    await db.businesses.update_one({"_id": business_id}, {"$set": {"gift_card_settings": body.model_dump()}})
    return body.model_dump()


# ---------------------------------------------------------------------------
# buying one (no account)
# ---------------------------------------------------------------------------

def _biz_out(biz: dict[str, Any]) -> dict[str, Any]:
    return {"id": biz["_id"], "slug": biz.get("slug"), "name": biz.get("name") or "", "name_he": biz.get("name_he"),
            "logo_url": biz.get("logo_url"), "brand_color": biz.get("brand_color")}


@router.get("/gift-cards/{slug_or_id}")
async def public_gift_cards(slug_or_id: str):
    biz = await _business(slug_or_id)
    st = settings_of(biz)
    return {"business": _biz_out(biz), "amounts": st["amounts"], "custom": st["custom"], "note": st["note"],
            "min": MIN_AMOUNT, "max": MAX_AMOUNT, "valid_years": VALID_YEARS,
            "payment_links": allowed_payment_links(biz.get("payment_links"))}


class BuyIn(BaseModel):
    amount: int = Field(..., ge=MIN_AMOUNT, le=MAX_AMOUNT)
    buyer_name: str = Field(..., min_length=2, max_length=80)
    buyer_email: str = Field(..., min_length=5, max_length=200)
    buyer_phone: Optional[str] = Field(None, max_length=20)
    for_self: bool = False
    to_name: Optional[str] = Field(None, max_length=80)
    to_email: Optional[str] = Field(None, max_length=200)
    message: Optional[str] = Field(None, max_length=400)
    lang: Literal["en", "he"] = "en"

    @field_validator("buyer_email", "to_email")
    @classmethod
    def _email_ok(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Please check the email address")
        return v


@router.post("/gift-cards/{slug_or_id}/buy")
async def buy(slug_or_id: str, body: BuyIn, request: Request):
    check_rate(request, bucket="gift_card_buy", limit=10, window_seconds=3600)
    biz = await _business(slug_or_id)
    st = settings_of(biz)
    if body.amount not in st["amounts"] and not st["custom"]:
        raise HTTPException(status_code=400, detail="Please choose one of the amounts")
    if not body.for_self and not (body.to_name or "").strip():
        raise HTTPException(status_code=422, detail="Who is the gift card for?")
    card = {
        "_id": str(uuid.uuid4()), "business_id": biz["_id"], "owner_user_id": biz.get("owner_user_id"),
        "amount": float(body.amount), "balance": float(body.amount), "currency": "ILS",
        "buyer": {"name": body.buyer_name.strip(), "email": body.buyer_email, "phone": (body.buyer_phone or "").strip() or None},
        "to": None if body.for_self else {"name": (body.to_name or "").strip(), "email": body.to_email},
        "message": (body.message or "").strip() or None, "lang": body.lang,
        "status": "awaiting_payment", "code": None, "token": secrets.token_urlsafe(16),
        "source": "website", "created_at": _now(), "paid_at": None, "expires_on": None, "uses": [],
    }
    await db.gift_cards.insert_one(card)
    who = card["to"]["name"] if card["to"] else card["buyer"]["name"]
    await _notify(biz["owner_user_id"], type_="gift_card_bought",
                  message=f"Gift card ordered: ₪{body.amount} from {card['buyer']['name']} for {who}. Mark it paid when you have the money.",
                  action_url="/dashboard?tab=discounts")
    owner = await db.users.find_one({"id": biz.get("owner_user_id")}, {"email": 1}) or {}
    await _email(owner.get("email"), f"Gift card ordered: ₪{body.amount}",
                 f"<p><b>{_esc(card['buyer']['name'])}</b> ordered a ₪{body.amount} gift card for <b>{_esc(who)}</b>.</p>"
                 f"<p>Email {_esc(body.buyer_email)}" + (f", phone {_esc(card['buyer']['phone'])}" if card["buyer"]["phone"] else "") + ".</p>"
                 "<p>Once they have paid you, mark it paid in Discounts and the card goes out with its code.</p>",
                 tag="gift-card-ordered", button=("Open gift cards", "/dashboard?tab=discounts"))
    he = body.lang == "he"
    name = (biz.get("name_he") if he and biz.get("name_he") else biz.get("name")) or ""
    await _email(body.buyer_email, _subject(f"{name}: " + ("הזמנת כרטיס מתנה" if he else "your gift card order")),
                 (f"<p>שלום {_esc(card['buyer']['name'])},</p><p>הזמנת כרטיס מתנה על סך ₪{body.amount} מ{_esc(name)}. "
                  "העסק ייצור איתך קשר לגבי התשלום, ומיד אחריו הכרטיס יישלח עם הקוד.</p>"
                  if he else
                  f"<p>Hi {_esc(card['buyer']['name'])},</p><p>You ordered a ₪{body.amount} gift card from {_esc(name)}. "
                  "Pay the business as shown on the page; as soon as they confirm it, the card is sent with its code.</p>")
                 + (f"<p>{_esc(st['note'])}</p>" if st["note"] else ""),
                 tag="gift-card-ordered-customer", button=("לכרטיס" if he else "Your gift card", f"{_frontend_url()}/gift/{card['token']}"))
    logger.info("[gift_cards] ordered business=%s amount=%s", biz["_id"], body.amount)
    return {"token": card["token"], "path": f"/gift/{card['token']}"}


@router.get("/gift/{token}")
async def card_page(token: str, request: Request):
    """The card itself, for whoever holds the link (the buyer and the person
    it is for): the code only once it is paid."""
    check_rate(request, bucket="gift_card_view", limit=120, window_seconds=600)
    card = await db.gift_cards.find_one({"token": token}) if token and len(token) >= 16 else None
    if not card:
        raise HTTPException(status_code=404, detail="This link is not valid")
    biz = await db.businesses.find_one({"_id": card["business_id"]}) or {}
    paid = card["status"] in ("active", "used_up")
    return {"business": _biz_out(biz) if biz else None, "status": card["status"], "valid": _valid(card),
            "amount": card["amount"], "balance": card["balance"], "currency": card.get("currency", "ILS"),
            "to_name": (card.get("to") or {}).get("name") or card["buyer"]["name"], "from_name": card["buyer"]["name"],
            "for_self": not card.get("to"), "message": card.get("message"),
            "code": card.get("code") if paid else None, "expires_on": card.get("expires_on"),
            "note": settings_of(biz).get("note") if card["status"] == "awaiting_payment" else None,
            "payment_links": allowed_payment_links(biz.get("payment_links")) if card["status"] == "awaiting_payment" else []}


# ---------------------------------------------------------------------------
# the business's side
# ---------------------------------------------------------------------------

def _card_out(c: dict[str, Any]) -> dict[str, Any]:
    return {"id": c["_id"], "code": c.get("code"), "status": c["status"] if c["status"] != "active" or _valid(c) else "expired",
            "amount": c["amount"], "balance": c["balance"], "buyer": c["buyer"], "to": c.get("to"), "message": c.get("message"),
            "source": c.get("source"), "created_at": c.get("created_at"), "paid_at": c.get("paid_at"), "expires_on": c.get("expires_on"),
            "uses": c.get("uses", [])[-10:], "token": c.get("token")}


@router.get("/businesses/{business_id}/gift-cards")
async def list_cards(business_id: str, user=Depends(verify_token)):
    biz = await _access(business_id, user)
    rows = await db.gift_cards.find({"business_id": business_id, "status": {"$ne": "cancelled"}}).sort("created_at", -1).to_list(500)
    outstanding = round(sum(c["balance"] for c in rows if _valid(c)), 2)
    return {"settings": settings_of(biz), "cards": [_card_out(c) for c in rows], "outstanding": outstanding}


async def _activate(card: dict[str, Any], biz: dict[str, Any]) -> dict[str, Any]:
    code = await _new_code()
    paid = datetime.now(IL).date()
    expires = paid.replace(year=paid.year + VALID_YEARS) if not (paid.month == 2 and paid.day == 29) else paid + timedelta(days=365 * VALID_YEARS)
    fresh = await db.gift_cards.find_one_and_update(
        {"_id": card["_id"], "status": "awaiting_payment"},
        {"$set": {"status": "active", "code": code, "paid_at": _now(), "expires_on": expires.isoformat()}},
        return_document=ReturnDocument.AFTER)
    if not fresh:
        raise HTTPException(status_code=409, detail="This gift card is not waiting for payment")
    await _send_card(fresh, biz)
    return fresh


async def _send_card(card: dict[str, Any], biz: dict[str, Any]) -> None:
    from utils import email as em
    he = card.get("lang") == "he"
    name = (biz.get("name_he") if he and biz.get("name_he") else biz.get("name")) or ""
    link = f"{_frontend_url()}/gift/{card['token']}"
    to = card.get("to") or {}
    gift_for = to.get("name") or card["buyer"]["name"]
    head = (f"כרטיס מתנה מ{name}" if he else f"A gift card for {name}")
    lines = (f"<p style='font-size:15px;line-height:1.7;color:#333;margin:0 0 10px;'>"
             + (f"{_esc(card['buyer']['name'])} שלח/ה לך כרטיס מתנה." if he and to else
                f"{_esc(card['buyer']['name'])} sent you a gift card." if to else
                ("כרטיס המתנה שלך מוכן." if he else "Your gift card is ready."))
             + "</p>")
    if card.get("message"):
        lines += f"<p style='font-size:15px;line-height:1.7;color:#333;font-style:italic;margin:0 0 14px;' dir='auto'>“{_esc(card['message'])}”</p>"
    box = (f"<div style='border:1px solid #E3E3E3;border-radius:14px;padding:18px;text-align:center;margin:0 0 16px;'>"
           f"<div style='font-size:13px;color:#666;'>{_esc(name)}</div>"
           f"<div style='font-size:30px;font-weight:700;color:#111827;margin:6px 0;'>₪{card['balance']:g}</div>"
           f"<div style='font-size:18px;letter-spacing:2px;font-weight:700;color:#111827;' dir='ltr'>{_esc(card['code'])}</div>"
           f"<div style='font-size:12px;color:#666;margin-top:6px;'>"
           + (f"בתוקף עד {card['expires_on']}. מקלידים את הקוד בהזמנה או מציגים אותו בעסק." if he else
              f"Valid until {card['expires_on']}. Type the code when you order, or show it at the business.")
           + "</div></div>")
    inner = f"<h2 style='color:#222;font-size:22px;margin:0 0 10px;'>{_esc(head)}</h2>" + lines + box + em._button("לכרטיס" if he else "See your gift card", link)
    owner = await db.users.find_one({"id": biz.get("owner_user_id")}, {"email": 1}) or {}
    target = to.get("email") or card["buyer"]["email"]
    if target:
        await em.send_email(target, _subject(head), em._wrap(inner, preheader=head, lang="he" if he else "en"),
                            tag="gift-card", from_name=name or None, reply_to=owner.get("email"))
    if to and to.get("email") and card["buyer"].get("email") and card["buyer"]["email"] != to["email"]:
        await _email(card["buyer"]["email"],
                     ("כרטיס המתנה נשלח" if he else f"Your gift card was sent to {gift_for}"),
                     (f"<p>{_esc(name)} אישר/ה את התשלום, וכרטיס המתנה על סך ₪{card['amount']:g} נשלח ל{_esc(gift_for)}.</p>" if he else
                      f"<p>{_esc(name)} confirmed your payment, and the ₪{card['amount']:g} gift card is on its way to {_esc(gift_for)}.</p>"),
                     tag="gift-card-sent", button=("לכרטיס" if he else "See the card", link))


@router.post("/businesses/{business_id}/gift-cards/{card_id}/paid")
async def mark_paid(business_id: str, card_id: str, user=Depends(verify_token)):
    biz = await _access(business_id, user)
    card = await db.gift_cards.find_one({"_id": card_id, "business_id": business_id})
    if not card:
        raise HTTPException(status_code=404, detail="Gift card not found")
    return _card_out(await _activate(card, biz))


@router.post("/businesses/{business_id}/gift-cards/{card_id}/cancel")
async def cancel(business_id: str, card_id: str, user=Depends(verify_token)):
    await _access(business_id, user)
    r = await db.gift_cards.update_one({"_id": card_id, "business_id": business_id, "status": "awaiting_payment"},
                                       {"$set": {"status": "cancelled", "cancelled_at": _now()}})
    if not r.modified_count:
        raise HTTPException(status_code=409, detail="Only an unpaid gift card can be cancelled")
    return {"ok": True}


class SellIn(BaseModel):
    amount: int = Field(..., ge=MIN_AMOUNT, le=MAX_AMOUNT)
    to_name: Optional[str] = Field(None, max_length=80)
    email: Optional[str] = Field(None, max_length=200)
    lang: Literal["en", "he"] = "en"


@router.post("/businesses/{business_id}/gift-cards")
async def sell_at_counter(business_id: str, body: SellIn, user=Depends(verify_token)):
    """Sold and paid in person: the code at once, emailed if an address is given."""
    biz = await _access(business_id, user)
    email = (body.email or "").strip().lower() or None
    card = {"_id": str(uuid.uuid4()), "business_id": business_id, "owner_user_id": biz.get("owner_user_id"),
            "amount": float(body.amount), "balance": float(body.amount), "currency": "ILS",
            "buyer": {"name": (body.to_name or "").strip() or "Counter sale", "email": email, "phone": None},
            "to": None, "message": None, "lang": body.lang, "status": "awaiting_payment", "code": None,
            "token": secrets.token_urlsafe(16), "source": "counter", "created_at": _now(), "paid_at": None,
            "expires_on": None, "uses": []}
    await db.gift_cards.insert_one(card)
    return _card_out(await _activate(card, biz))


class UseIn(BaseModel):
    amount: float = Field(..., gt=0, le=MAX_AMOUNT)
    note: Optional[str] = Field(None, max_length=200)


@router.post("/businesses/{business_id}/gift-cards/{card_id}/use")
async def use_at_counter(business_id: str, card_id: str, body: UseIn, user=Depends(verify_token)):
    await _access(business_id, user)
    card = await db.gift_cards.find_one({"_id": card_id, "business_id": business_id})
    if not card or not _valid(card):
        raise HTTPException(status_code=400, detail="This gift card cannot be used")
    if not await _take(card, round(body.amount, 2), {"where": "counter", "note": body.note}):
        raise HTTPException(status_code=400, detail=f"Only ₪{card['balance']:g} left on this card")
    return _card_out(await db.gift_cards.find_one({"_id": card_id}))


async def _take(card: dict[str, Any], amount: float, info: dict[str, Any]) -> bool:
    """Atomically, so two orders at once cannot both spend the last shekels."""
    res = await db.gift_cards.find_one_and_update(
        {"_id": card["_id"], "status": "active", "balance": {"$gte": amount}},
        {"$inc": {"balance": -amount}, "$push": {"uses": {"at": _now(), "amount": amount, **info}}},
        return_document=ReturnDocument.AFTER)
    if res and res["balance"] <= 0.001:
        await db.gift_cards.update_one({"_id": card["_id"]}, {"$set": {"status": "used_up", "balance": 0.0}})
    return bool(res)


# ---------------------------------------------------------------------------
# used as a code on the order form and the membership sign-up (discounts.py)
# ---------------------------------------------------------------------------

async def as_code(business_id: str, code: str) -> Optional[dict[str, Any]]:
    if not code.startswith("GIFT-"):
        return None
    card = await db.gift_cards.find_one({"business_id": business_id, "code": code})
    if not card:
        return None
    if card["status"] == "used_up" or card["balance"] <= 0:
        from .discounts import CodeRefused
        raise CodeRefused("This gift card has been used up")
    if not _valid(card):
        from .discounts import CodeRefused
        raise CodeRefused("This gift card has expired")
    return {"_id": card["_id"], "code": card["code"], "kind": "amount", "value": float(card["balance"]),
            "applies_to": "both", "once_per_customer": False, "first_order_only": False, "active": True,
            "gift_card": True, "used_by": []}


async def redeem(c: dict[str, Any], amount: float) -> bool:
    if amount <= 0:
        return True
    return await _take(c, round(amount, 2), {"where": "online"})


async def ensure_gift_card_indexes() -> None:
    await db.gift_cards.create_index("token", unique=True)
    await db.gift_cards.create_index("code", unique=True, partialFilterExpression={"code": {"$type": "string"}})
    await db.gift_cards.create_index([("business_id", 1), ("created_at", -1)])
