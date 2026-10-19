"""Closed for Shabbat and holidays, automatically (Tzvi, 19 Oct 2026; the
idea from Wolt and 10bis).

A business that ticks "Closed on Shabbat and holidays" (`shabbat_closing`)
stops taking orders and bookings from candle lighting to havdalah, for
every Shabbat and every yom tov, in its own city, without blocking each one
by hand. During a closure:
  * the order form refuses a new order, and says when it opens again;
  * no pickup or delivery time inside a closure can be chosen;
  * no appointment time inside one can be booked (`busy_minutes`, used by
    gigs._busy_spans, so the slot picker and the booking check agree);
  * the business page and order page say "Closed for Shabbat".
Orders placed before Shabbat for after it are untouched.

Times come from `hdate`, computed here, so nothing depends on an outside
service being up. Israel rules (one day of yom tov). Candle lighting by the
city's custom: 40 minutes before sunset in Jerusalem, 30 in Haifa, 20
elsewhere. The business's city is its first service area; a business that
serves all of Israel uses Jerusalem's times, the earliest closing.
"""
from __future__ import annotations

import datetime as dt
from functools import lru_cache
from typing import Any, Optional
from zoneinfo import ZoneInfo

IL = ZoneInfo("Asia/Jerusalem")
CANDLE_MINUTES = {"jerusalem": 40, "haifa": 30}
DEFAULT_CANDLE_MINUTES = 20
HORIZON_DAYS = 60


def _city(biz: dict[str, Any]) -> tuple[str, float, float]:
    from .shared import LOCATIONS
    areas = [] if biz.get("serves_nationwide") else (biz.get("areas") or [])
    for slug in areas + ["jerusalem"]:
        for loc in LOCATIONS:
            if loc["slug"] == slug:
                return slug, loc["lat"], loc["lng"]
    return "jerusalem", 31.784, 35.217


@lru_cache(maxsize=64)
def _closures_for(slug: str, lat: float, lng: float, start: dt.date, days: int) -> tuple[tuple[dt.datetime, dt.datetime, str], ...]:
    """(start, end, kind) for each closure that ends on or after `start`.
    kind is "shabbat" or "holiday" (any yom tov inside it)."""
    from hdate import HDateInfo, Location, Zmanim
    loc = Location(name=slug, latitude=lat, longitude=lng, timezone="Asia/Jerusalem", diaspora=False)
    offset = CANDLE_MINUTES.get(slug, DEFAULT_CANDLE_MINUTES)
    out = []
    day = start - dt.timedelta(days=3)   # a closure that began before `start`
    last = start + dt.timedelta(days=days)
    open_at: Optional[dt.datetime] = None
    holiday = False
    while day <= last + dt.timedelta(days=3):
        z = Zmanim(date=day, location=loc, candle_lighting_offset=offset, havdalah_offset=0)
        info = HDateInfo(day, diaspora=False)
        if open_at is not None and info.is_yom_tov:
            holiday = True
        if z.candle_lighting and open_at is None and not (info.is_shabbat or info.is_yom_tov):
            open_at = z.candle_lighting.astimezone(IL)
            holiday = False
        if z.havdalah and open_at is not None:
            end = z.havdalah.astimezone(IL)
            if end.date() >= start and open_at.date() <= last:
                out.append((open_at, end, "holiday" if holiday else "shabbat"))
            open_at = None
        day += dt.timedelta(days=1)
    return tuple(out)


def closures(biz: dict[str, Any], days: int = HORIZON_DAYS, today: Optional[dt.date] = None) -> list[tuple[dt.datetime, dt.datetime, str]]:
    """The business's closures from today, or [] when it does not close."""
    if not biz or not biz.get("shabbat_closing"):
        return []
    slug, lat, lng = _city(biz)
    return list(_closures_for(slug, lat, lng, today or dt.datetime.now(IL).date(), days))


def closed_at(biz: dict[str, Any], when: dt.datetime) -> Optional[tuple[dt.datetime, dt.datetime, str]]:
    when = when if when.tzinfo else when.replace(tzinfo=IL)
    for c in closures(biz, today=(when.astimezone(IL).date())):
        if c[0] <= when < c[1]:
            return c
    return None


def public_view(biz: dict[str, Any]) -> Optional[dict[str, Any]]:
    """What a page needs: whether it is closed now, and the next weeks'
    closures, so a date or time inside one is never offered."""
    if not biz.get("shabbat_closing"):
        return None
    now = dt.datetime.now(IL)
    rows = closures(biz, days=30)
    current = next((c for c in rows if c[0] <= now < c[1]), None)
    return {
        "on": True,
        "closed_now": {"until": current[1].isoformat(), "kind": current[2]} if current else None,
        "closures": [{"start": s.isoformat(), "end": e.isoformat(), "kind": k} for s, e, k in rows],
    }


def busy_minutes(biz: dict[str, Any], date_iso: Optional[str] = None) -> dict[str, list[tuple[int, int]]]:
    """Closures as {date: [(start_min, end_min)]}, the shape of gigs._busy_spans."""
    out: dict[str, list[tuple[int, int]]] = {}
    for s, e, _k in closures(biz):
        day = s.date()
        while day <= e.date():
            iso = day.isoformat()
            if date_iso is None or iso == date_iso:
                a = s.hour * 60 + s.minute if day == s.date() else 0
                b = e.hour * 60 + e.minute if day == e.date() else 24 * 60
                if b > a:
                    out.setdefault(iso, []).append((a, b))
            day += dt.timedelta(days=1)
    return out


def refuse_reason(when_iso: str, until: dt.datetime, kind: str, lang: str = "en") -> str:
    days_en = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    days_he = ["שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת", "ראשון"]
    t = until.strftime("%H:%M")
    if lang == "he":
        what = "בשבת" if kind == "shabbat" else "בחג"
        return f"סגור {what}. אפשר להזמין שוב ב{'מוצאי שבת' if until.weekday() == 5 else 'יום ' + days_he[until.weekday()]} ב-{t}."
    what = "Shabbat" if kind == "shabbat" else "the holiday"
    return f"Closed for {what}. Orders open again {days_en[until.weekday()]} at {t}."
