"""Once a week: "Your ad for X is ready" by email (Tzvi, 10 Nov 2026).

The dashboard already shows this line on a business's card (GET
/ads/summary in routes/short_links.py), but only to an owner who opens the
dashboard. This brings it to them: one email a week per business, only when
a product with a photo and a price has no saved ad yet, linking straight to
the ad maker opened on that product. Nothing is posted or sent anywhere on
the owner's behalf: they look, then share it themselves.
"""
from __future__ import annotations

import asyncio
import html
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import APIRouter, Body, HTTPException, Request

from routes.deps import db, logger
from utils.auth import JWT_SECRET
from utils.notification_tokens import NotificationTokenError, verify_notification_token

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

EVERY = timedelta(days=7)
OPT_OUT_FIELD = "ad_emails_off"
OPT_OUT_PURPOSE = "ad_emails_optout"


def optout_token(user_id: str) -> str:
    return jwt.encode({"purpose": OPT_OUT_PURPOSE, "user_id": user_id,
                       "exp": datetime.now(UTC) + timedelta(days=90)}, JWT_SECRET, algorithm="HS256")


@router.post("/ad-emails/opt-out")
async def ad_emails_opt_out(request: Request, payload: dict = Body(...)):
    """Public: the signed token is the auth, so it works straight from the inbox."""
    from utils.rate_limit import check_rate
    check_rate(request, bucket="emails_optout", limit=30, window_seconds=600)
    try:
        claims = verify_notification_token(payload.get("token") or "", OPT_OUT_PURPOSE)
    except NotificationTokenError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    await db.job_notification_preferences.update_one(
        {"user_id": claims["user_id"]},
        {"$set": {OPT_OUT_FIELD: True, "updated_at": datetime.now(UTC).isoformat()}}, upsert=True)
    return {"ok": True}


def email_html(he: bool, business: str, item: str, link: str, optout: str) -> tuple[str, str]:
    d, side = ("rtl", "right") if he else ("ltr", "left")
    if he:
        subject = f"המודעה שלכם ל{item} מוכנה"
        body = (f"הכנו מודעה ל{item} של {business}, מהתמונה והמחיר שכבר בדף שלכם.\n\n"
                "תסתכלו, תשנו מה שתרצו, ותשתפו בוואטסאפ, בסטטוס או באינסטגרם.")
        button, foot, off = "לראות את המודעה", "בכל שבוע שיש מוצר בלי מודעה, נכין לכם אחת.", "להפסיק את המיילים האלה"
    else:
        subject = f"Your ad for {item} is ready"
        body = (f"We made an ad for {business}'s {item}, from the photo and price already on your page.\n\n"
                "Take a look, change anything you like, then share it on WhatsApp, your status or Instagram.")
        button, foot, off = "See the ad", "Each week a product has no ad yet, we make one for you.", "Stop these emails"
    page = f"""<!DOCTYPE html><html lang="{'he' if he else 'en'}" dir="{d}"><head><meta charset="UTF-8"></head>
<body dir="{d}" style="margin:0;background:#F9FAFB;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #E3E3E3;border-radius:14px;">
<tr><td style="padding:24px 28px 6px;text-align:{side};font-size:18px;font-weight:700;">{html.escape(subject)}</td></tr>
<tr><td style="padding:6px 28px 18px;text-align:{side};font-size:15px;line-height:1.65;">{html.escape(body).replace(chr(10), '<br>')}</td></tr>
<tr><td style="padding:0 28px 24px;text-align:{side};"><a href="{html.escape(link)}" style="background:#000;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">{button}</a></td></tr>
<tr><td style="padding:14px 28px;border-top:1px solid #E3E3E3;text-align:{side};font-size:12px;color:#666;">{foot} <a href="{html.escape(optout)}" style="color:#666;">{off}</a></td></tr>
</table></td></tr></table></body></html>"""
    return subject, page


async def run_once() -> int:
    """One email per business that has a product without an ad, at most once a week.
    Each business is claimed before sending, so two server copies cannot both send."""
    from urllib.parse import urlencode

    from routes.short_links import _ad_facts
    from utils.email import send_email

    from .orders import _frontend_url
    sent = 0
    cutoff = datetime.now(UTC) - EVERY
    async for biz in db.businesses.find(
            {"active": {"$ne": False}, "$or": [{"ad_email_at": None}, {"ad_email_at": {"$lte": cutoff}}]},
            {"_id": 1, "name": 1, "owner_user_id": 1}):
        uid = biz.get("owner_user_id")
        pref = await db.job_notification_preferences.find_one({"user_id": uid}, {OPT_OUT_FIELD: 1}) or {}
        if not uid or pref.get(OPT_OUT_FIELD):
            continue
        _, extra = await _ad_facts("business", biz["_id"])
        done = {r.get("item") for r in await db.saved_ads.find(
            {"owner_user_id": uid, "target_type": "business", "target_id": biz["_id"]}, {"item": 1}).to_list(60)}
        todo = [i["name"] for i in extra.get("items") or [] if i.get("name") and i["name"] not in done]
        user = await db.users.find_one({"id": uid}, {"email": 1, "preferred_language": 1})
        if not todo or not (user or {}).get("email"):
            continue
        claimed = await db.businesses.find_one_and_update(
            {"_id": biz["_id"], "$or": [{"ad_email_at": None}, {"ad_email_at": {"$lte": cutoff}}]},
            {"$set": {"ad_email_at": datetime.now(UTC)}})
        if not claimed:
            continue
        base = _frontend_url()
        link = f"{base}/dashboard?{urlencode({'tab': 'advertising', 'target': biz['_id'], 'item': todo[0]})}"
        subject, page = email_html((user.get("preferred_language") or "") == "he", biz.get("name") or "",
                                   todo[0], link, f"{base}/requests-emails-off?kind=ads&t={optout_token(uid)}")
        if await send_email(user["email"], subject, page, tag="weekly-ad"):
            sent += 1
    return sent


async def weekly_ad_loop() -> None:
    """Checks hourly; each business is due a week after its last email.
    Sunday to Thursday mornings only (Israel's working week, 07:00-10:00 UTC)."""
    await asyncio.sleep(300)
    while True:
        now = datetime.now(UTC)
        if now.weekday() in (6, 0, 1, 2, 3) and 7 <= now.hour < 10:
            try:
                n = await run_once()
                if n:
                    logger.info("[weekly-ad] emails sent %s", n)
            except Exception as e:  # noqa: BLE001
                logger.warning("[weekly-ad] pass failed: %s", e)
        await asyncio.sleep(3600)
