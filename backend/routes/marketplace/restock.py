"""'Tell me when it's back' (Tzvi, 16 Oct 2026, from Shopify's back-in-stock
alerts).

A product that is sold out (switched off, or a counted product at 0) is
still listed on the order form, with a button to leave an email. When the
business has it again (switched back on, or a count above 0), everyone
waiting for it gets ONE email with a button to the order form with that
product already chosen. Checked every ten minutes rather than hooked into
each way a product can come back (the listing editor, a stock count, a
cancelled order putting stock back), so none of them can be missed.

Never between 21:00 and 09:00 Israel time (they wait until morning), never
to someone who unsubscribed from this business. A request nobody acted on
is dropped after 90 days. The business sees how many people wait for each
product, which says what to make or reorder first.
"""
from __future__ import annotations

import asyncio
import html
import re
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal, Optional
from urllib.parse import quote
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from pymongo.errors import DuplicateKeyError

from routes.deps import db, logger, verify_token
from utils.rate_limit import check_rate

router = APIRouter(prefix="/marketplace", tags=["marketplace"])
IL = ZoneInfo("Asia/Jerusalem")
LOOP_SECONDS = 600
KEEP_DAYS = 90
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def available(p: dict[str, Any]) -> bool:
    """On sale and not counted down to nothing."""
    return p.get("in_stock", True) is not False and (p.get("stock") is None or int(p.get("stock") or 0) > 0)


def _product(gig: dict[str, Any], product_id: str) -> Optional[dict[str, Any]]:
    for i, p in enumerate(gig.get("products") or []):
        if (p.get("id") or f"idx:{i}") == product_id:
            return p
    return None


class WaitIn(BaseModel):
    product_id: str = Field(..., min_length=1, max_length=80)
    email: str = Field(..., max_length=200)
    lang: Literal["en", "he"] = "en"

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL.match(v):
            raise ValueError("Please check the email address")
        return v


@router.post("/order-form/{gig_id}/notify-when-back")
async def wait_for_it(gig_id: str, body: WaitIn, request: Request):
    check_rate(request, bucket="restock_wait", limit=20, window_seconds=600)
    gig = await db.marketplace_gigs.find_one({"_id": gig_id, "gig_type": "store"})
    p = _product(gig or {}, body.product_id) if gig else None
    if not gig or not p:
        raise HTTPException(status_code=404, detail="This product is not on the list")
    if available(p):
        raise HTTPException(status_code=400, detail="This one is available now: you can order it")
    try:
        await db.restock_waits.insert_one({
            "_id": str(uuid.uuid4()), "gig_id": gig_id, "business_id": gig.get("business_id"), "product_id": body.product_id,
            "product_name": p.get("name") or "", "email": body.email, "lang": body.lang,
            "created_at": datetime.now(UTC).isoformat(), "notified_at": None})
    except DuplicateKeyError:
        # Already waiting: the same answer. Told once before and sold out
        # again: waiting afresh.
        await db.restock_waits.update_one(
            {"gig_id": gig_id, "product_id": body.product_id, "email": body.email, "notified_at": {"$ne": None}},
            {"$set": {"notified_at": None, "created_at": datetime.now(UTC).isoformat(), "lang": body.lang}})
    return {"ok": True}


async def run_once(now: Optional[datetime] = None) -> int:
    now = now or datetime.now(UTC)
    await db.restock_waits.delete_many({"created_at": {"$lt": (now - timedelta(days=KEEP_DAYS)).isoformat()}})
    if not (9 <= now.astimezone(IL).hour < 21):
        return 0
    sent = 0
    gigs: dict[str, Any] = {}
    async for w in db.restock_waits.find({"notified_at": None}):
        if w["gig_id"] not in gigs:
            gigs[w["gig_id"]] = await db.marketplace_gigs.find_one({"_id": w["gig_id"]})
        gig = gigs[w["gig_id"]]
        if not gig or gig.get("status", "published") != "published":
            continue
        p = _product(gig, w["product_id"])
        if not p or not available(p):
            continue
        if await db.message_unsubscribes.find_one({"business_id": w.get("business_id"), "email": w["email"]}, {"_id": 1}):
            await db.restock_waits.delete_one({"_id": w["_id"]})
            continue
        # Claimed first, so a second pass never sends it twice.
        r = await db.restock_waits.update_one({"_id": w["_id"], "notified_at": None}, {"$set": {"notified_at": now.isoformat()}})
        if not r.modified_count:
            continue
        biz = await db.businesses.find_one({"_id": gig.get("business_id")}) or {}
        try:
            await _email(w, gig, p, biz)
            sent += 1
        except Exception as e:  # noqa: BLE001
            logger.warning("[restock] email failed for %s: %s", w["_id"], e)
    return sent


async def _email(w: dict[str, Any], gig: dict[str, Any], p: dict[str, Any], biz: dict[str, Any]) -> None:
    from utils.email import send_email
    from .customer_messages import unsubscribe_url
    from .orders import _frontend_url, _subject
    he = w.get("lang") == "he"
    business = (biz.get("name_he") if he and biz.get("name_he") else biz.get("name")) or ""
    name = p.get("name") or w.get("product_name") or ""
    subject = f"{business}: {name} חזר למלאי" if he else f"{name} is back at {business}"
    body = (f"ביקשת שנודיע לך: {name} שוב זמין להזמנה." if he else f"You asked us to tell you: {name} can be ordered again.")
    link = f"{_frontend_url()}/order/{quote(gig['_id'])}?add={quote(w['product_id'], safe='')}"
    unsub = unsubscribe_url(biz.get("_id") or w.get("business_id"), w["email"])
    d, side = ("rtl", "right") if he else ("ltr", "left")
    img = (p.get("images") or [None])[0] or p.get("image")
    pic = (f'<tr><td style="padding:0 28px 14px;text-align:{side};"><img src="{html.escape(img)}" alt="" width="160" '
           f'style="width:160px;height:160px;object-fit:cover;border-radius:12px;"></td></tr>') if img and str(img).startswith("http") else ""
    page = f"""<!DOCTYPE html><html lang="{'he' if he else 'en'}" dir="{d}"><head><meta charset="UTF-8"></head>
<body dir="{d}" style="margin:0;background:#F9FAFB;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #E3E3E3;border-radius:14px;">
<tr><td style="padding:24px 28px 6px;text-align:{side};font-size:17px;font-weight:700;">{html.escape(business)}</td></tr>
<tr><td style="padding:6px 28px 14px;text-align:{side};font-size:15px;line-height:1.65;">{html.escape(body)}</td></tr>
{pic}
<tr><td style="padding:0 28px 24px;text-align:{side};"><a href="{html.escape(link)}" style="background:#000;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">{"להזמנה" if he else "Order it"}</a></td></tr>
<tr><td style="padding:14px 28px;border-top:1px solid #E3E3E3;text-align:center;font-size:12px;color:#666;"><a href="{html.escape(unsub)}" style="color:#666;">{"להסרה מרשימת התפוצה" if he else "Unsubscribe"}</a></td></tr>
</table></td></tr></table></body></html>"""
    owner = await db.users.find_one({"id": biz.get("owner_user_id")}, {"email": 1}) or {}
    await send_email(w["email"], _subject(subject), page, tag="back-in-stock", message_stream="broadcast",
                     from_name=business or None, reply_to=owner.get("email"),
                     headers={"List-Unsubscribe": f"<{unsub.replace('/unsubscribe/', '/api/marketplace/messages/unsubscribe/')}>",
                              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"})


async def restock_loop() -> None:
    await asyncio.sleep(200)
    while True:
        try:
            n = await run_once()
            if n:
                logger.info("[restock] back-in-stock emails sent %s", n)
        except Exception as e:  # noqa: BLE001
            logger.warning("[restock] pass failed: %s", e)
        await asyncio.sleep(LOOP_SECONDS)


@router.get("/businesses/{business_id}/restock-waits")
async def waiting(business_id: str, user=Depends(verify_token)):
    """How many people wait for each product, most wanted first."""
    from utils.business_access import business_access
    await business_access(db, business_id, user, "orders")
    rows = await db.restock_waits.aggregate([
        {"$match": {"business_id": business_id, "notified_at": None}},
        {"$group": {"_id": {"gig": "$gig_id", "product": "$product_id"}, "name": {"$last": "$product_name"}, "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}, {"$limit": 50}]).to_list(50)
    return [{"gig_id": r["_id"]["gig"], "product_id": r["_id"]["product"], "name": r["name"], "count": r["count"]} for r in rows]


async def ensure_restock_indexes() -> None:
    await db.restock_waits.create_index([("gig_id", 1), ("product_id", 1), ("email", 1)], unique=True)
    await db.restock_waits.create_index([("notified_at", 1)])
