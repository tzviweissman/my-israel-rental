"""The weekly "how your listings did" email. Monday 09:00 Israel time.

One email per person, covering everything they list: their services and
business pages, and their rentals. Every figure is a count of recorded
events in a fixed window of Israel calendar days; nothing is estimated.

  visitors   marketplace_view_events (one visitor per listing per day, the
             owner never counted, bots never counted: utils/view_tracking)
  taps       lead_events "whatsapp_click", services by provider_id and
             rentals by owner_id + source "property", as the dashboard does
  saves      liked_properties, rentals only (a business has no "save")
  reviews    marketplace_reviews, services only (rentals have none)

Rules from the brief (23 Sep 2026):
  * A week with no activity at all sends NO email. "0 visitors" in an
    inbox teaches people to unsubscribe.
  * A comparison with the week before is shown only when that figure was
    already being counted before the earlier week began (the same rule as
    view_tracking.week_compare). Otherwise the number stands alone.
  * Never twice for one week: a row in `weekly_insights_sent`, unique on
    (user_id, week), is claimed BEFORE sending. Two replicas, a restart
    or a manual run all lose the race cleanly.
  * Its own opt-out, stored on the same preferences document the
    requests digest uses (job_notification_preferences), so "how should
    we email you" stays one place. Hard bounces are skipped by send_email.
  * Monday, so it never lands beside the Sunday 07:00 UTC pricing email,
    and it says nothing about availability windows: that reminder has its
    own email (routes/availability_reminders.py).

Dry run: `python -m scripts.weekly_insights` lists who would get it and
what it would say, and writes the English and Hebrew HTML to look at.
"""
from __future__ import annotations

import asyncio
from datetime import UTC, date, datetime, time, timedelta
from typing import Any, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Body, HTTPException, Request
from pymongo.errors import DuplicateKeyError

from routes.deps import db, logger
from utils.email import FRONTEND_URL, _button, _esc, _wrap, send_email
from utils.rate_limit import check_rate
from utils.notification_tokens import (
    NotificationTokenError,
    _encode,
    verify_notification_token,
)

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

IL = ZoneInfo("Asia/Jerusalem")
SENT = "weekly_insights_sent"
OPT_OUT_FIELD = "insights_emails_off"
OPT_OUT_PURPOSE = "insights_optout"
OPT_OUT_TTL_DAYS = 90
SERVICE_TYPES = ["gig", "business"]


# --------------------------------------------------------------------------
# The window
# --------------------------------------------------------------------------
def week_windows(now: datetime) -> dict[str, Any]:
    """The last 7 whole Israel days before `now`, and the 7 before those.

    Run on a Monday this is Monday to Sunday of the week just ended. Keyed
    by the ISO week of its last day, so a re-run the same week finds the
    same key."""
    today = now.astimezone(IL).date()
    end = today - timedelta(days=1)             # yesterday, the last whole day
    start = end - timedelta(days=6)
    prev_start = start - timedelta(days=7)
    iso = end.isocalendar()
    return {
        "key": f"{iso.year}-W{iso.week:02d}",
        "start": start, "end": end, "prev_start": prev_start,
        "days": [str(start + timedelta(days=i)) for i in range(7)],
        "prev_days": [str(prev_start + timedelta(days=i)) for i in range(7)],
    }


def _utc_iso(d: date) -> str:
    """Midnight of an Israel day, as the UTC ISO string the event logs store."""
    return datetime.combine(d, time.min, tzinfo=IL).astimezone(UTC).isoformat()


def _il_day(iso: Optional[str]) -> Optional[str]:
    try:
        dt = datetime.fromisoformat(iso)
    except (TypeError, ValueError):
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return str(dt.astimezone(IL).date())


# --------------------------------------------------------------------------
# The numbers
# --------------------------------------------------------------------------
async def _count_iso(coll: str, query: dict, w: dict) -> dict[str, Any]:
    """This week, the week before, and whether the week before is fair to
    show: counting must have begun on or before its first day."""
    this = await db[coll].count_documents({**query, "created_at": {"$gte": _utc_iso(w["start"]), "$lt": _utc_iso(w["end"] + timedelta(days=1))}})
    before = await db[coll].count_documents({**query, "created_at": {"$gte": _utc_iso(w["prev_start"]), "$lt": _utc_iso(w["start"])}})
    first = await db[coll].find(query, {"created_at": 1}).sort("created_at", 1).limit(1).to_list(1)
    since = _il_day(first[0].get("created_at")) if first else None
    return {"n": this, "before": before if since and since <= str(w["prev_start"]) else None}


async def _count_views(owner_id: str, types: list[str], w: dict) -> dict[str, Any]:
    q = {"owner_id": owner_id, "entity_type": {"$in": types}}
    this = await db.marketplace_view_events.count_documents({**q, "day": {"$in": w["days"]}})
    before = await db.marketplace_view_events.count_documents({**q, "day": {"$in": w["prev_days"]}})
    first = await db.marketplace_view_events.find(q, {"day": 1}).sort("at", 1).limit(1).to_list(1)
    since = first[0].get("day") if first else None
    return {"n": this, "before": before if since and since <= str(w["prev_start"]) else None}


async def stats_for(user_id: str, w: dict) -> dict[str, Any]:
    """{"services": {...} | None, "rentals": {...} | None} for one person.
    A half is None when they have nothing of that kind listed."""
    out: dict[str, Any] = {"services": None, "rentals": None}
    if await db.marketplace_gigs.count_documents({"provider_user_id": user_id, "status": "published"}, limit=1):
        out["services"] = {
            "views": await _count_views(user_id, SERVICE_TYPES, w),
            "taps": await _count_iso("lead_events", {"provider_id": user_id, "type": "whatsapp_click"}, w),
            "reviews": await _count_iso("marketplace_reviews", {"provider_user_id": user_id}, w),
        }
    prop_ids = await db.properties.distinct("id", {"owner_id": user_id, "status": {"$ne": "archived"}})
    if prop_ids:
        out["rentals"] = {
            "views": await _count_views(user_id, ["property"], w),
            "taps": await _count_iso("lead_events", {"owner_id": user_id, "source": "property", "type": "whatsapp_click"}, w),
            "saves": await _count_iso("liked_properties", {"property_id": {"$in": prop_ids}}, w),
        }
    return out


def has_activity(stats: dict) -> bool:
    return any(m["n"] for half in stats.values() if half for m in half.values())


# --------------------------------------------------------------------------
# The email
# --------------------------------------------------------------------------
COPY = {
    "en": {
        "subject": "Your week on MyIsraelRental: {n} visitors",
        "subject_quiet": "Your week on MyIsraelRental",
        "subject_one": "Your week on MyIsraelRental: 1 visitor",
        "hi": "Hi {name},",
        "hi_anon": "Hi,",
        "lead": "Here is how your listings did from {start} to {end}.",
        "services": "Your business",
        "rentals": "Your rentals",
        "views": "Visitors",
        "taps": "Tapped to message you",
        "reviews": "New reviews",
        "saves": "Saved",
        "up": "up from {b}",
        "down": "down from {b}",
        "same": "same as the week before",
        "button": "Open your dashboard",
        "why": "You get this once a week because you list on MyIsraelRental. Weeks with no activity send nothing.",
        "stop": "Stop these weekly emails",
    },
    "he": {
        "subject": "השבוע שלכם ב-MyIsraelRental: {n} מבקרים",
        "subject_quiet": "השבוע שלכם ב-MyIsraelRental",
        "subject_one": "השבוע שלכם ב-MyIsraelRental: מבקר אחד",
        "hi": "שלום {name},",
        "hi_anon": "שלום,",
        "lead": "כך הלך לרישומים שלכם בין {start} ל-{end}.",
        "services": "העסק שלכם",
        "rentals": "הנכסים שלכם",
        "views": "מבקרים",
        "taps": "לחצו כדי לשלוח לכם הודעה",
        "reviews": "ביקורות חדשות",
        "saves": "נשמר",
        "up": "עלייה מ-{b}",
        "down": "ירידה מ-{b}",
        "same": "כמו בשבוע שלפני",
        "button": "לוח הבקרה שלכם",
        "why": "המייל הזה נשלח פעם בשבוע כי יש לכם רישום ב-MyIsraelRental. בשבוע בלי פעילות לא נשלח כלום.",
        "stop": "הפסקת המיילים השבועיים",
    },
}

HE_MONTHS = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"]


def _day(d: date, lang: str) -> str:
    return f"{d.day} {HE_MONTHS[d.month - 1]}" if lang == "he" else f"{d.day} {d.strftime('%b')}"


def _change(m: dict, c: dict) -> str:
    b = m["before"]
    if b is None:
        return ""
    if m["n"] > b:
        return "↑ " + c["up"].format(b=b)
    if m["n"] < b:
        return "↓ " + c["down"].format(b=b)
    return c["same"]


def render(name: str, stats: dict, w: dict, lang: str, optout_url: str) -> tuple[str, str]:
    """(subject, html). Plain rows of number + change: an arrow and words,
    so the direction survives a client that drops colour."""
    c = COPY["he" if lang == "he" else "en"]
    side = "right" if lang == "he" else "left"
    other = "left" if lang == "he" else "right"
    sections = []
    total_views = 0
    for half, metrics in (("services", ("views", "taps", "reviews")), ("rentals", ("views", "taps", "saves"))):
        s = stats.get(half)
        if not s:
            continue
        total_views += s["views"]["n"]
        rows = "".join(
            f'<tr><td style="padding:10px 0;padding-{other}:12px;border-bottom:1px solid #eee;color:#555;font-size:14px;text-align:{side};">{c[k]}</td>'
            f'<td style="padding:10px 0;border-bottom:1px solid #eee;text-align:{other};white-space:nowrap;">'
            f'<strong style="color:#111827;font-size:16px;">{s[k]["n"]}</strong>'
            + (f'<span style="color:#666;font-size:12px;padding-{side}:8px;">{_change(s[k], c)}</span>' if _change(s[k], c) else "")
            + '</td></tr>'
            for k in metrics
        )
        sections.append(
            f'<h3 style="font-size:15px;color:#111827;margin:24px 0 4px;text-align:{side};">{c[half]}</h3>'
            f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">{rows}</table>'
        )
    subject = (c["subject_one"] if total_views == 1 else c["subject"].format(n=total_views)) if total_views else c["subject_quiet"]
    hi = c["hi"].format(name=_esc(name)) if name else c["hi_anon"]
    inner = (
        f'<div style="text-align:{side};">'
        f'<p style="color:#111827;font-size:15px;margin:0 0 6px;">{hi}</p>'
        f'<p style="color:#555;font-size:14px;line-height:1.7;margin:0;">'
        f'{c["lead"].format(start=_day(w["start"], lang), end=_day(w["end"], lang))}</p>'
        + "".join(sections)
        + _button(c["button"], f"{FRONTEND_URL}/dashboard?tab=overview")
        + f'<p style="color:#888;font-size:12px;line-height:1.6;margin:24px 0 0;">{c["why"]}<br>'
        f'<a href="{_esc(optout_url)}" style="color:#1C8DD4;">{c["stop"]}</a></p></div>'
    )
    return subject, _wrap(inner, preheader=subject, lang=lang)


# --------------------------------------------------------------------------
# Opt-out
# --------------------------------------------------------------------------
def create_optout_token(user_id: str) -> str:
    return _encode({"purpose": OPT_OUT_PURPOSE, "user_id": user_id,
                    "exp": datetime.now(UTC) + timedelta(days=OPT_OUT_TTL_DAYS)})


@router.post("/insights/emails/opt-out")
async def insights_optout(request: Request, payload: dict = Body(...)):
    """Public: the signed token is the auth, so the link works from the
    inbox without signing in. Throttled like any unauthenticated POST."""
    check_rate(request, bucket="emails_optout", limit=30, window_seconds=600)
    try:
        claims = verify_notification_token(payload.get("token") or "", OPT_OUT_PURPOSE)
    except NotificationTokenError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    await db.job_notification_preferences.update_one(
        {"user_id": claims["user_id"]},
        {"$set": {OPT_OUT_FIELD: True, "updated_at": datetime.now(UTC).isoformat()}},
        upsert=True,
    )
    return {"ok": True}


# --------------------------------------------------------------------------
# The run
# --------------------------------------------------------------------------
async def run(now: Optional[datetime] = None, *, dry_run: bool = False,
              only: Optional[set[str]] = None) -> list[dict[str, Any]]:
    """One pass. Returns a row per person considered, with what happened:
    sent, would_send (dry run), quiet, opted_out, no_email, already_sent,
    failed. `only` limits it to those user ids (tests, a one-person check)."""
    w = week_windows(now or datetime.now(UTC))
    ids = set(await db.marketplace_gigs.distinct("provider_user_id", {"status": "published"}))
    ids |= set(await db.properties.distinct("owner_id", {"status": {"$ne": "archived"}}))
    ids.discard(None)
    if only is not None:
        ids &= only
    off = set(await db.job_notification_preferences.distinct("user_id", {OPT_OUT_FIELD: True}))
    report = []
    async for u in db.users.find({"id": {"$in": list(ids)}},
                                 {"_id": 0, "id": 1, "name": 1, "email": 1, "preferred_language": 1, "status": 1}):
        row = {"user_id": u["id"], "email": u.get("email"), "week": w["key"]}
        report.append(row)
        if u["id"] in off:
            row["result"] = "opted_out"
            continue
        if not u.get("email") or u.get("status") in ("blocked", "deleted"):
            row["result"] = "no_email"
            continue
        stats = await stats_for(u["id"], w)
        row["stats"] = stats
        if not has_activity(stats):
            row["result"] = "quiet"
            continue
        lang = "he" if (u.get("preferred_language") or "").startswith("he") else "en"
        row["lang"] = lang
        if dry_run:
            if await db[SENT].find_one({"user_id": u["id"], "week": w["key"]}):
                row["result"] = "already_sent"
            else:
                row["result"] = "would_send"
            continue
        try:
            await db[SENT].insert_one({"user_id": u["id"], "week": w["key"], "at": datetime.now(UTC)})
        except DuplicateKeyError:
            row["result"] = "already_sent"
            continue
        subject, html = render(u.get("name") or "", stats, w, lang,
                               f"{FRONTEND_URL}/insights-emails-off?t={create_optout_token(u['id'])}")
        ok = await send_email(u["email"], subject, html, tag="weekly-insights")
        row["result"] = "sent" if ok else "failed"
        if not ok:
            # Release the claim so a manual re-run this week can try again.
            await db[SENT].delete_one({"user_id": u["id"], "week": w["key"]})
    return report


async def ensure_indexes() -> None:
    await db[SENT].create_index([("user_id", 1), ("week", 1)], unique=True, background=True)


async def weekly_insights_loop() -> None:
    """Mondays at 09:00 Israel time, summer or winter."""
    await ensure_indexes()
    while True:
        now = datetime.now(IL)
        nxt = datetime.combine(now.date() + timedelta(days=(0 - now.weekday()) % 7), time(9), tzinfo=IL)
        if nxt <= now:
            nxt += timedelta(days=7)
        await asyncio.sleep((nxt - now).total_seconds())
        try:
            report = await run()
            logger.info("[weekly-insights] %s sent", sum(r.get("result") == "sent" for r in report))
        except Exception as e:  # noqa: BLE001
            logger.warning("[weekly-insights] loop crashed: %s", e)
