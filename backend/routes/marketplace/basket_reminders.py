"""One reminder about a basket left behind (Tzvi, 16 Oct 2026, from
Shopify's abandoned checkout email).

When someone on a website order form (/order/<gig>) has items chosen and
has typed their email, the form saves the basket here (the form says so
under the email box). If no order from that email reaches the business
within about three hours, they get ONE email listing what they chose,
with a button back to the form filled in again. Never a second one for
the same basket, never between 21:00 and 09:00 Israel time, never to
someone who unsubscribed from this business, and not at all if the
business switched it off. Baskets are deleted after two weeks.
"""
from __future__ import annotations

import asyncio
import html
import re
from datetime import UTC, datetime, timedelta
from typing import Any, Literal, Optional
from urllib.parse import quote
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from routes.deps import db, logger, verify_token
from utils.rate_limit import check_rate

router = APIRouter(prefix="/marketplace", tags=["marketplace"])
IL = ZoneInfo("Asia/Jerusalem")
WAIT = timedelta(hours=3)
GIVE_UP = timedelta(hours=48)
LOOP_SECONDS = 900
_ID = re.compile(r"^[A-Za-z0-9_-]{16,64}$")
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _on(biz: dict[str, Any]) -> bool:
    return biz.get("basket_reminder_on", True) is not False


class Line(BaseModel):
    key: str = Field(..., min_length=1, max_length=120)
    qty: int = Field(..., ge=1, le=99)


class BasketIn(BaseModel):
    basket_id: str
    email: str = Field(..., max_length=200)
    name: Optional[str] = Field(None, max_length=80)
    lines: list[Line] = Field(..., min_length=1, max_length=60)
    lang: Literal["en", "he"] = "en"

    @field_validator("basket_id")
    @classmethod
    def _bid(cls, v: str) -> str:
        if not _ID.match(v):
            raise ValueError("bad basket id")
        return v

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL.match(v):
            raise ValueError("Please check the email address")
        return v


@router.post("/order-form/{gig_id}/basket")
async def save_basket(gig_id: str, body: BasketIn, request: Request):
    check_rate(request, bucket="basket_save", limit=60, window_seconds=600)
    gig = await db.marketplace_gigs.find_one({"_id": gig_id, "gig_type": "store"}, {"business_id": 1})
    if not gig or not gig.get("business_id"):
        raise HTTPException(status_code=404, detail="Not found")
    now = datetime.now(UTC).isoformat()
    existing = await db.order_baskets.find_one({"_id": body.basket_id}, {"gig_id": 1, "reminded_at": 1})
    if existing and existing.get("gig_id") != gig_id:
        raise HTTPException(status_code=409, detail="Not this basket")
    await db.order_baskets.update_one(
        {"_id": body.basket_id},
        {"$set": {"gig_id": gig_id, "business_id": gig["business_id"], "email": body.email, "name": (body.name or "").strip() or None,
                  "lines": [ln.model_dump() for ln in body.lines], "lang": body.lang, "updated_at": now},
         "$setOnInsert": {"created_at": now, "reminded_at": None, "ordered": False}},
        upsert=True)
    return {"ok": True}


@router.post("/order-form/{gig_id}/basket/{basket_id}/ordered")
async def basket_ordered(gig_id: str, basket_id: str, request: Request):
    """The form placed its order: nothing to remind about."""
    check_rate(request, bucket="basket_save", limit=60, window_seconds=600)
    if _ID.match(basket_id):
        await db.order_baskets.update_one({"_id": basket_id, "gig_id": gig_id}, {"$set": {"ordered": True}})
    return {"ok": True}


async def _ordered_since(b: dict[str, Any]) -> bool:
    """Any order from this email at this business since the basket began.
    Orders stamp Israel time, so the basket's UTC start is converted."""
    since = datetime.fromisoformat(b["created_at"]).astimezone(IL).replace(microsecond=0).isoformat()
    return bool(await db.store_orders.find_one(
        {"business_id": b["business_id"], "customer_email": {"$regex": f"^{re.escape(b['email'])}$", "$options": "i"},
         "created_at": {"$gte": since}}, {"_id": 1}))


async def run_once(now: Optional[datetime] = None) -> int:
    now = now or datetime.now(UTC)
    if not (9 <= now.astimezone(IL).hour < 21):
        return 0
    await db.order_baskets.delete_many({"updated_at": {"$lt": (now - timedelta(days=14)).isoformat()}})
    sent = 0
    q = {"ordered": False, "reminded_at": None,
         "updated_at": {"$lte": (now - WAIT).isoformat(), "$gte": (now - GIVE_UP).isoformat()}}
    async for b in db.order_baskets.find(q):
        biz = await db.businesses.find_one({"_id": b["business_id"]})
        gig = await db.marketplace_gigs.find_one({"_id": b["gig_id"]})
        if not biz or not gig or not _on(biz) or gig.get("status", "published") != "published":
            continue
        if await _ordered_since(b):
            await db.order_baskets.update_one({"_id": b["_id"]}, {"$set": {"ordered": True}})
            continue
        if await db.message_unsubscribes.find_one({"business_id": biz["_id"], "email": b["email"]}, {"_id": 1}):
            continue
        # Claimed first, so a second pass (or replica) never sends it twice.
        r = await db.order_baskets.update_one({"_id": b["_id"], "reminded_at": None}, {"$set": {"reminded_at": now.isoformat()}})
        if not r.modified_count:
            continue
        try:
            await _email(b, gig, biz)
            sent += 1
        except Exception as e:  # noqa: BLE001
            logger.warning("[basket] email failed for %s: %s", b["_id"], e)
    return sent


def _names(b: dict[str, Any], gig: dict[str, Any]) -> list[str]:
    from .orders import _products_for_order
    products = {p["id"]: p for p in _products_for_order(gig)}
    out = []
    for ln in b["lines"]:
        pid, _, oid = ln["key"].partition("::")
        p = products.get(pid)
        if not p:
            continue
        opt = next((o for o in p["options"] if o["id"] == oid), None) if oid else None
        out.append(f"{ln['qty']} × {p['name']}" + (f" ({opt['name']})" if opt else ""))
    return out


async def _email(b: dict[str, Any], gig: dict[str, Any], biz: dict[str, Any]) -> None:
    from utils.email import send_email
    from .customer_messages import unsubscribe_url
    from .orders import _frontend_url, _subject
    he = b.get("lang") == "he"
    business = (biz.get("name_he") if he and biz.get("name_he") else biz.get("name")) or ""
    items = _names(b, gig)
    if not items:
        return
    first = (b.get("name") or "").split(" ")[0]
    subject = f"השארת משהו אצל {business}" if he else f"You left something at {business}"
    intro = (f"שלום {first}," if first else "שלום,") + "\n\nבחרת כמה דברים ולא סיימת את ההזמנה. הם עדיין מחכים לך:" if he else \
        (f"Hi {first}," if first else "Hi,") + "\n\nYou chose a few things but didn't finish your order. They are still waiting:"
    link = f"{_frontend_url()}/order/{quote(gig['_id'])}?items=" + ",".join(f"{quote(ln['key'], safe='')}~{ln['qty']}" for ln in b["lines"])
    unsub = unsubscribe_url(biz["_id"], b["email"])
    d, side = ("rtl", "right") if he else ("ltr", "left")
    rows = "".join(f'<li style="margin:2px 0;">{html.escape(x)}</li>' for x in items[:12])
    page = f"""<!DOCTYPE html><html lang="{'he' if he else 'en'}" dir="{d}"><head><meta charset="UTF-8"></head>
<body dir="{d}" style="margin:0;background:#F9FAFB;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #E3E3E3;border-radius:14px;">
<tr><td style="padding:24px 28px 6px;text-align:{side};font-size:17px;font-weight:700;">{html.escape(business)}</td></tr>
<tr><td style="padding:6px 28px 8px;text-align:{side};font-size:15px;line-height:1.65;">{html.escape(intro).replace(chr(10), '<br>')}</td></tr>
<tr><td style="padding:0 28px 18px;text-align:{side};font-size:15px;line-height:1.6;"><ul style="margin:0;padding-{side}:18px;">{rows}</ul></td></tr>
<tr><td style="padding:0 28px 24px;text-align:{side};"><a href="{html.escape(link)}" style="background:#000;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">{"לסיום ההזמנה" if he else "Finish your order"}</a></td></tr>
<tr><td style="padding:14px 28px;border-top:1px solid #E3E3E3;text-align:center;font-size:12px;color:#666;"><a href="{html.escape(unsub)}" style="color:#666;">{"להסרה מרשימת התפוצה" if he else "Unsubscribe"}</a></td></tr>
</table></td></tr></table></body></html>"""
    owner = await db.users.find_one({"id": biz.get("owner_user_id")}, {"email": 1}) or {}
    await send_email(b["email"], _subject(subject), page, tag="basket-reminder", message_stream="broadcast",
                     from_name=business or None, reply_to=owner.get("email"),
                     headers={"List-Unsubscribe": f"<{unsub.replace('/unsubscribe/', '/api/marketplace/messages/unsubscribe/')}>",
                              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"})


async def basket_reminder_loop() -> None:
    await asyncio.sleep(300)
    while True:
        try:
            n = await run_once()
            if n:
                logger.info("[basket] reminders sent %s", n)
        except Exception as e:  # noqa: BLE001
            logger.warning("[basket] pass failed: %s", e)
        await asyncio.sleep(LOOP_SECONDS)


class SwitchIn(BaseModel):
    on: bool


@router.get("/businesses/{business_id}/basket-reminder")
async def get_switch(business_id: str, user=Depends(verify_token)):
    from utils.business_access import business_access
    biz = await business_access(db, business_id, user, "orders")
    sent = await db.order_baskets.count_documents({"business_id": business_id, "reminded_at": {"$ne": None}})
    return {"on": _on(biz), "sent": sent}


@router.put("/businesses/{business_id}/basket-reminder")
async def put_switch(business_id: str, body: SwitchIn, user=Depends(verify_token)):
    from utils.business_access import business_access
    await business_access(db, business_id, user, None)
    await db.businesses.update_one({"_id": business_id}, {"$set": {"basket_reminder_on": body.on}})
    return {"on": body.on}


async def ensure_basket_indexes() -> None:
    await db.order_baskets.create_index([("ordered", 1), ("reminded_at", 1), ("updated_at", 1)])
