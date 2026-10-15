"""Referrals (Tzvi, 15 Oct 2026, from the Shopify list: "a member or
customer gets a personal link; when a friend joins through it, both get
a discount").

Built on discount codes (discounts.py), so the order form and the
membership sign-up need nothing new:

  * The business switches referrals on and sets two discounts: what the
    friend gets off their first order or membership, and what the person
    who sent them gets as thanks.
  * Every customer and member sees their own link on their order's
    tracking page or their membership pass (no account: the link's token
    is the credential, same as everywhere else). The link carries their
    personal code, e.g. NOA-7K3P, and the form fills it in.
  * A personal code works like a first-time-only code: it is refused for
    anyone who has ordered from or joined the business before, and for
    the sender's own phone.
  * When the friend's order or sign-up goes through, the sender gets a
    one-use thank-you code of their own, emailed to them if the business
    has their email, and listed on their page either way.

Thank-you codes are ordinary discount codes marked `referral_reward`;
the business's code list leaves them out so it is not buried in them.
"""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime
from typing import Any, Literal, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from routes.deps import db, logger, verify_token
from utils.rate_limit import check_rate
from utils.whatsapp_link import normalize_whatsapp_number

router = APIRouter(prefix="/marketplace", tags=["marketplace"])
IL = ZoneInfo("Asia/Jerusalem")
_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def _now() -> str:
    return datetime.now(IL).isoformat(timespec="seconds")


class ReferralSettingsIn(BaseModel):
    on: bool = False
    friend_kind: Literal["percent", "amount"] = "percent"
    friend_value: float = Field(10, gt=0, le=100000)
    reward_kind: Literal["percent", "amount"] = "amount"
    reward_value: float = Field(20, gt=0, le=100000)


def settings_of(biz: dict[str, Any]) -> dict[str, Any]:
    return {**ReferralSettingsIn().model_dump(), **(biz.get("referral_settings") or {})}


@router.get("/businesses/{business_id}/referrals")
async def get_referrals(business_id: str, user=Depends(verify_token)):
    from utils.business_access import business_access
    biz = await business_access(db, business_id, user, "discounts")
    joined = await db.referral_codes.aggregate([
        {"$match": {"business_id": business_id}},
        {"$group": {"_id": None, "senders": {"$sum": {"$cond": [{"$gt": ["$uses", 0]}, 1, 0]}}, "friends": {"$sum": "$uses"}}},
    ]).to_list(1)
    stats = joined[0] if joined else {"senders": 0, "friends": 0}
    return {**settings_of(biz), "senders": stats["senders"], "friends": stats["friends"]}


@router.put("/businesses/{business_id}/referrals")
async def put_referrals(business_id: str, body: ReferralSettingsIn, user=Depends(verify_token)):
    from utils.business_access import business_access
    await business_access(db, business_id, user, "discounts")
    for kind, value in ((body.friend_kind, body.friend_value), (body.reward_kind, body.reward_value)):
        if kind == "percent" and value > 100:
            raise HTTPException(status_code=422, detail="A percentage can be at most 100")
    await db.businesses.update_one({"_id": business_id}, {"$set": {"referral_settings": body.model_dump()}})
    return await get_referrals(business_id, user)


# ---------------------------------------------------------------------------
# the customer's own link
# ---------------------------------------------------------------------------

async def _code_for(biz: dict[str, Any], name: str, phone: Optional[str], email: Optional[str]) -> dict[str, Any]:
    """The person's one code at this business, made the first time."""
    e164 = normalize_whatsapp_number(phone) if phone else None
    if not e164:
        raise HTTPException(status_code=404, detail="No referral link for this one")
    row = await db.referral_codes.find_one({"business_id": biz["_id"], "phone_e164": e164})
    if row:
        if email and not row.get("email"):
            await db.referral_codes.update_one({"_id": row["_id"]}, {"$set": {"email": email}})
        return row
    first = "".join(ch for ch in (name or "").split(" ")[0].upper() if "A" <= ch <= "Z")[:8] or "FRIEND"
    for _ in range(20):
        code = f"{first}-{''.join(secrets.choice(_CHARS) for _ in range(4))}"
        if await db.discount_codes.find_one({"business_id": biz["_id"], "code": code}, {"_id": 1}):
            continue
        row = {"_id": str(uuid.uuid4()), "business_id": biz["_id"], "code": code, "phone_e164": e164,
               "name": name, "email": email, "uses": 0, "rewards": [], "created_at": _now()}
        try:
            await db.referral_codes.insert_one(row)
            return row
        except DuplicateKeyError:
            again = await db.referral_codes.find_one({"business_id": biz["_id"], "phone_e164": e164})
            if again:
                return again
    raise HTTPException(status_code=500, detail="Could not make a referral code")


def _rule(kind: str, value: float) -> dict[str, Any]:
    return {"kind": kind, "value": value}


async def _link_out(biz: dict[str, Any], row: dict[str, Any], to: str) -> dict[str, Any]:
    from .orders import _frontend_url
    st = settings_of(biz)
    rewards = []
    if row.get("rewards"):
        async for c in db.discount_codes.find({"_id": {"$in": row["rewards"]}}):
            rewards.append({"code": c["code"], "kind": c["kind"], "value": c["value"], "used": c.get("uses", 0) >= (c.get("max_uses") or 1)})
    return {"on": True, "code": row["code"], "url": f"{_frontend_url()}{to}?ref={row['code']}",
            "friend": _rule(st["friend_kind"], st["friend_value"]), "reward": _rule(st["reward_kind"], st["reward_value"]),
            "friends": row.get("uses", 0), "rewards": rewards}


@router.get("/referrals/order/{track_token}")
async def referral_for_order(track_token: str, request: Request):
    """The customer's link, shown on their order's tracking page."""
    check_rate(request, bucket="referral_link", limit=120, window_seconds=600)
    o = await db.store_orders.find_one({"track_token": track_token}) if len(track_token or "") >= 16 else None
    if not o:
        raise HTTPException(status_code=404, detail="This link is not valid")
    biz = await db.businesses.find_one({"_id": o["business_id"]})
    if not biz or not settings_of(biz)["on"] or o.get("status") == "cancelled":
        return {"on": False}
    row = await _code_for(biz, o.get("customer_name") or "", o.get("customer_phone_e164") or o.get("customer_phone"), o.get("customer_email"))
    return await _link_out(biz, row, f"/order/{o['gig_id']}" if o.get("gig_id") else f"/business/{biz.get('slug')}")


@router.get("/referrals/member/{manage_token}")
async def referral_for_member(manage_token: str, request: Request):
    """The member's link, shown on their membership pass."""
    check_rate(request, bucket="referral_link", limit=120, window_seconds=600)
    m = await db.business_members.find_one({"manage_token": manage_token}) if len(manage_token or "") >= 16 else None
    if not m:
        raise HTTPException(status_code=404, detail="This link is not valid")
    biz = await db.businesses.find_one({"_id": m["business_id"]})
    if not biz or not settings_of(biz)["on"] or m.get("status") in ("pending", "cancelled"):
        return {"on": False}
    row = await _code_for(biz, m.get("name") or "", m.get("phone"), m.get("email"))
    return await _link_out(biz, row, f"/memberships/{biz.get('slug') or biz['_id']}")


# ---------------------------------------------------------------------------
# used by discounts.evaluate / redeem
# ---------------------------------------------------------------------------

async def as_code(business_id: str, code: str) -> Optional[dict[str, Any]]:
    """A personal code, dressed as a discount code: first-time only, once
    per customer, the friend's discount. None if it is not one, or the
    business has referrals off."""
    row = await db.referral_codes.find_one({"business_id": business_id, "code": code})
    if not row:
        return None
    biz = await db.businesses.find_one({"_id": business_id}, {"referral_settings": 1})
    st = settings_of(biz or {})
    if not st["on"]:
        return None
    return {"_id": row["_id"], "code": row["code"], "kind": st["friend_kind"], "value": st["friend_value"],
            "applies_to": "both", "once_per_customer": True, "first_order_only": True, "active": True,
            "referral_of": row["phone_e164"], "used_by": []}


async def redeem(c: dict[str, Any], discount: float, phone: Optional[str]) -> bool:
    """The friend's order or sign-up went through: count it, and give the
    sender their thank-you code."""
    e164 = normalize_whatsapp_number(phone) if phone else None
    q: dict[str, Any] = {"_id": c["_id"]}
    if e164:
        q["friends"] = {"$ne": e164}
    row = await db.referral_codes.find_one_and_update(
        q,
        {"$inc": {"uses": 1, "discount_given": discount}, "$push": {"friends": e164}}, return_document=True)
    if not row:
        return False
    biz = await db.businesses.find_one({"_id": row["business_id"]})
    st = settings_of(biz or {})
    reward = {"_id": str(uuid.uuid4()), "business_id": row["business_id"],
              "code": f"THANKS-{''.join(secrets.choice(_CHARS) for _ in range(5))}",
              "kind": st["reward_kind"], "value": st["reward_value"], "applies_to": "both",
              "starts_on": None, "ends_on": None, "min_order": None, "max_uses": 1,
              "once_per_customer": True, "first_order_only": False, "active": True,
              "uses": 0, "discount_given": 0.0, "used_by": [], "created_at": _now(),
              "referral_reward": True, "for_phone": row["phone_e164"]}
    await db.discount_codes.insert_one(reward)
    await db.referral_codes.update_one({"_id": row["_id"]}, {"$push": {"rewards": reward["_id"]}})
    logger.info("[referrals] business=%s code=%s reward=%s", row["business_id"], row["code"], reward["code"])
    if row.get("email"):
        from .orders import _email, _esc
        off = f"{st['reward_value']:g}%" if st["reward_kind"] == "percent" else f"₪{st['reward_value']:g}"
        await _email(row["email"], f"A thank-you from {(biz or {}).get('name') or 'us'}",
                     f"<p>Someone you sent to {_esc((biz or {}).get('name'))} has just ordered or joined.</p>"
                     f"<p>Here is {off} off your next order or membership, once: <b>{_esc(reward['code'])}</b></p>",
                     tag="referral-reward")
    return True


async def ensure_referral_indexes() -> None:
    await db.referral_codes.create_index([("business_id", 1), ("code", 1)], unique=True)
    await db.referral_codes.create_index([("business_id", 1), ("phone_e164", 1)], unique=True)
