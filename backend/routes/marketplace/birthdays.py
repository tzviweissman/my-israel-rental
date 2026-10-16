"""A birthday treat (Tzvi, 16 Oct 2026, from Square and Booksy).

A business switches it on (Discounts → Birthday treat) and chooses the
gift: a percentage or an amount off, valid for some days. From then the
order form, the membership sign-up and the booking form ask, optionally,
for the customer's birthday: day and month only, never the year. A few
days before it, the customer gets one email from the business with a
code of their own (BDAY-XXXXX), good once, until the end of those days.
It works in the same discount box as any other code (discounts.py).

Once a year per customer per business, never between 20:00 and 10:00
Israel time, never to someone who unsubscribed from this business.
Someone born on 29 February is treated on the 28th in other years.
"""
from __future__ import annotations

import asyncio
import html
import secrets
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any, Literal, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from routes.deps import db, logger, verify_token

router = APIRouter(prefix="/marketplace", tags=["marketplace"])
IL = ZoneInfo("Asia/Jerusalem")
DEFAULTS = {"on": False, "kind": "percent", "value": 10, "days": 7}
DAYS_BEFORE = 3
LOOP_SECONDS = 3600
_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def settings_of(biz: dict[str, Any]) -> dict[str, Any]:
    return {**DEFAULTS, **(biz.get("birthday_settings") or {})}


def is_on(biz: Optional[dict[str, Any]]) -> bool:
    return bool(biz) and settings_of(biz)["on"]


def _valid_md(md: Optional[str]) -> Optional[tuple[int, int]]:
    try:
        m, d = (int(x) for x in str(md).split("-"))
        date(2024, m, d)   # a leap year, so 02-29 is allowed
        return m, d
    except (TypeError, ValueError):
        return None


async def remember(business_id: Optional[str], email: Optional[str], name: Optional[str], birthday: Optional[str],
                   lang: Optional[str], source: str) -> None:
    """Called by the order form, the membership sign-up and the booking
    form. Never raises: a birthday must not fail an order."""
    try:
        md = _valid_md(birthday)
        email = (email or "").strip().lower()
        if not business_id or not md or "@" not in email:
            return
        biz = await db.businesses.find_one({"_id": business_id}, {"birthday_settings": 1})
        if not is_on(biz):
            return
        await db.customer_birthdays.update_one(
            {"_id": f"{business_id}:{email}"},
            {"$set": {"business_id": business_id, "email": email, "name": (name or "").strip() or None, "month": md[0], "day": md[1],
                      "lang": "he" if lang == "he" else "en", "source": source, "updated_at": datetime.now(UTC).isoformat()},
             "$setOnInsert": {"last_sent_year": None}},
            upsert=True)
    except Exception as e:  # noqa: BLE001
        logger.warning("[birthdays] could not save: %s", e)


def next_birthday(month: int, day: int, today: date) -> date:
    for year in (today.year, today.year + 1):
        try:
            d = date(year, month, day)
        except ValueError:          # 29 February, not a leap year
            d = date(year, 2, 28)
        if d >= today:
            return d
    return date(today.year + 1, month, min(day, 28))


async def run_once(now: Optional[datetime] = None) -> int:
    now = now or datetime.now(UTC)
    local = now.astimezone(IL)
    if not (10 <= local.hour < 20):
        return 0
    today = local.date()
    sent = 0
    async for biz in db.businesses.find({"birthday_settings.on": True}):
        st = settings_of(biz)
        async for c in db.customer_birthdays.find({"business_id": biz["_id"]}):
            bday = next_birthday(c["month"], c["day"], today)
            if (bday - today).days > DAYS_BEFORE or c.get("last_sent_year") == bday.year:
                continue
            if await db.message_unsubscribes.find_one({"business_id": biz["_id"], "email": c["email"]}, {"_id": 1}):
                continue
            r = await db.customer_birthdays.update_one({"_id": c["_id"], "last_sent_year": c.get("last_sent_year")},
                                                       {"$set": {"last_sent_year": bday.year, "sent_at": now.isoformat()}})
            if not r.modified_count:
                continue
            code = await _make_code(biz, st, c, today)
            try:
                await _email(c, biz, st, code, bday)
                sent += 1
            except Exception as e:  # noqa: BLE001
                logger.warning("[birthdays] email failed for %s: %s", c["_id"], e)
    return sent


async def _make_code(biz: dict[str, Any], st: dict[str, Any], c: dict[str, Any], today: date) -> dict[str, Any]:
    ends = today + timedelta(days=DAYS_BEFORE + int(st["days"]))
    for _ in range(20):
        code = "BDAY-" + "".join(secrets.choice(_CHARS) for _ in range(5))
        if not await db.discount_codes.find_one({"business_id": biz["_id"], "code": code}, {"_id": 1}):
            break
    doc = {"_id": str(uuid.uuid4()), "business_id": biz["_id"], "code": code, "kind": st["kind"], "value": float(st["value"]),
           "applies_to": "both", "starts_on": today.isoformat(), "ends_on": ends.isoformat(), "min_order": None, "max_uses": 1,
           "once_per_customer": True, "first_order_only": False, "active": True, "uses": 0, "discount_given": 0.0, "used_by": [],
           "created_at": datetime.now(UTC).isoformat(), "birthday_gift": True, "for_email": c["email"]}
    await db.discount_codes.insert_one(doc)
    return doc


async def _email(c: dict[str, Any], biz: dict[str, Any], st: dict[str, Any], code: dict[str, Any], bday: date) -> None:
    from utils.email import send_email
    from .customer_messages import unsubscribe_url
    from .orders import _frontend_url, _subject
    he = c.get("lang") == "he"
    business = (biz.get("name_he") if he and biz.get("name_he") else biz.get("name")) or ""
    first = (c.get("name") or "").split(" ")[0]
    gift = f"{st['value']:g}%" if st["kind"] == "percent" else f"₪{st['value']:g}"
    until = date.fromisoformat(code["ends_on"]).strftime("%d.%m.%Y")
    subject = f"יום הולדת שמח מ{business}" if he else f"Happy birthday from {business}"
    hello = (f"שלום {first}," if first else "שלום,") if he else (f"Hi {first}," if first else "Hi,")
    body = (f"יום ההולדת שלך מתקרב, ויש לנו מתנה קטנה: {gift} הנחה על ההזמנה או ההרשמה הבאה, עד {until}." if he else
            f"Your birthday is coming up, and we have a small gift for you: {gift} off your next order or sign-up, until {until}.")
    how = "מקלידים את הקוד בתיבת קוד ההנחה, או מראים את המייל הזה." if he else "Type the code in the discount code box, or show this email."
    link = f"{_frontend_url()}/business/{biz.get('slug') or biz['_id']}"
    unsub = unsubscribe_url(biz["_id"], c["email"])
    d, side = ("rtl", "right") if he else ("ltr", "left")
    page = f"""<!DOCTYPE html><html lang="{'he' if he else 'en'}" dir="{d}"><head><meta charset="UTF-8"></head>
<body dir="{d}" style="margin:0;background:#F9FAFB;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #E3E3E3;border-radius:14px;">
<tr><td style="padding:24px 28px 6px;text-align:{side};font-size:17px;font-weight:700;">{html.escape(business)}</td></tr>
<tr><td style="padding:6px 28px 14px;text-align:{side};font-size:15px;line-height:1.65;">{html.escape(hello)}<br><br>{html.escape(body)}</td></tr>
<tr><td style="padding:0 28px 8px;text-align:center;"><div style="display:inline-block;border:1px dashed #111827;border-radius:12px;padding:12px 22px;font-size:20px;font-weight:700;letter-spacing:2px;" dir="ltr">{html.escape(code['code'])}</div></td></tr>
<tr><td style="padding:4px 28px 18px;text-align:center;font-size:13px;color:#666;">{html.escape(how)}</td></tr>
<tr><td style="padding:0 28px 24px;text-align:{side};"><a href="{html.escape(link)}" style="background:#000;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">{"לדף שלנו" if he else "Visit us"}</a></td></tr>
<tr><td style="padding:14px 28px;border-top:1px solid #E3E3E3;text-align:center;font-size:12px;color:#666;"><a href="{html.escape(unsub)}" style="color:#666;">{"להסרה מרשימת התפוצה" if he else "Unsubscribe"}</a></td></tr>
</table></td></tr></table></body></html>"""
    owner = await db.users.find_one({"id": biz.get("owner_user_id")}, {"email": 1}) or {}
    await send_email(c["email"], _subject(subject), page, tag="birthday-treat", message_stream="broadcast",
                     from_name=business or None, reply_to=owner.get("email"),
                     headers={"List-Unsubscribe": f"<{unsub.replace('/unsubscribe/', '/api/marketplace/messages/unsubscribe/')}>",
                              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"})


async def birthday_loop() -> None:
    await asyncio.sleep(260)
    while True:
        try:
            n = await run_once()
            if n:
                logger.info("[birthdays] treats sent %s", n)
        except Exception as e:  # noqa: BLE001
            logger.warning("[birthdays] pass failed: %s", e)
        await asyncio.sleep(LOOP_SECONDS)


# ---------------------------------------------------------------------------
# the business's switch
# ---------------------------------------------------------------------------

class SettingsIn(BaseModel):
    on: bool
    kind: Literal["percent", "amount"] = "percent"
    value: float = Field(10, gt=0, le=1000)
    days: int = Field(7, ge=1, le=60)


async def _access(business_id: str, user: dict[str, Any]) -> dict[str, Any]:
    from utils.business_access import business_access
    return await business_access(db, business_id, user, "discounts")


@router.get("/businesses/{business_id}/birthday-settings")
async def get_settings(business_id: str, user=Depends(verify_token)):
    biz = await _access(business_id, user)
    year = datetime.now(IL).year
    return {**settings_of(biz),
            "saved": await db.customer_birthdays.count_documents({"business_id": business_id}),
            "sent_this_year": await db.customer_birthdays.count_documents({"business_id": business_id, "last_sent_year": year}),
            "used": await db.discount_codes.count_documents({"business_id": business_id, "birthday_gift": True, "uses": {"$gt": 0}})}


@router.put("/businesses/{business_id}/birthday-settings")
async def put_settings(business_id: str, body: SettingsIn, user=Depends(verify_token)):
    await _access(business_id, user)
    if body.kind == "percent" and body.value > 100:
        body.value = 100
    await db.businesses.update_one({"_id": business_id}, {"$set": {"birthday_settings": body.model_dump()}})
    return body.model_dump()


async def ensure_birthday_indexes() -> None:
    await db.customer_birthdays.create_index("business_id")
