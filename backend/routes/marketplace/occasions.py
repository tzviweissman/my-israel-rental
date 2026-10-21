"""Ready-made reasons to email customers (Tzvi, 21 Oct 2026, from
GoHighLevel's "Reactivate": win-back and seasonal campaigns).

  * HOLIDAYS: the Jewish and Israeli holidays coming up, with their dates,
    so the Customers tab can say "Rosh Hashanah is in 12 days" and open the
    email composer with a holiday message ready to finish. The message text
    lives in the locale files (messages.occasion.*): this only says which
    holiday and when.
  * WIN-BACK: how many customers have not been back for 60, 90 or 180 days,
    so "Customers we have not seen in a while" can be picked as a group.
    The group itself is the "lapsed" audience in customer_messages.py.

Sending goes through customer_messages.py like every other message, with
its unsubscribe link, limits and "Advertisement" rule.

Dates are worked out from the Hebrew calendar (hdate's HebrewDate), not by
scanning day by day: HDateInfo costs about a quarter of a second a day here.
"""
from __future__ import annotations

import datetime as dt
from functools import lru_cache
from typing import Any, Optional

from fastapi import APIRouter, Depends

from routes.deps import db, verify_token

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

LOOKAHEAD_DAYS = 45          # holidays shown this far ahead
LAPSED_CHOICES = (60, 90, 180)

# key -> (month, day). Purim uses Adar II in a leap year (handled below).
# Yom Ha'atzmaut moves to avoid Shabbat (handled below).
_FIXED = {
    "rosh_hashana": ("TISHREI", 1),
    "sukkot": ("TISHREI", 15),
    "chanukah": ("KISLEV", 25),
    "tu_bishvat": ("SHVAT", 15),
    "purim": ("ADAR", 14),
    "pesach": ("NISAN", 15),
    "shavuot": ("SIVAN", 6),
}


def _yom_haatzmaut(year: int) -> dt.date:
    """5 Iyar, moved the way Israel moves it: Friday or Shabbat -> the
    Thursday before; Monday -> Tuesday."""
    from hdate.hebrew_date import HebrewDate, Months
    d = HebrewDate(year, Months.IYYAR, 5).to_gdate()
    wd = d.weekday()            # Mon=0 .. Sun=6
    if wd == 4:
        return d - dt.timedelta(days=1)
    if wd == 5:
        return d - dt.timedelta(days=2)
    if wd == 0:
        return d + dt.timedelta(days=1)
    return d


@lru_cache(maxsize=8)
def _year_holidays(year: int) -> tuple[tuple[str, dt.date], ...]:
    from hdate.hebrew_date import HebrewDate, Months, is_leap_year
    out = []
    for key, (month, day) in _FIXED.items():
        m = Months[month]
        if key == "purim" and is_leap_year(year):
            m = Months.ADAR_II
        out.append((key, HebrewDate(year, m, day).to_gdate()))
    out.append(("yom_haatzmaut", _yom_haatzmaut(year)))
    return tuple(sorted(out, key=lambda kv: kv[1]))


def upcoming_holidays(today: Optional[dt.date] = None, days: int = LOOKAHEAD_DAYS) -> list[dict[str, Any]]:
    """Holidays starting today or within `days`, soonest first. `date` is the
    holiday's first day; it begins the evening before. Pure, for tests."""
    from hdate.hebrew_date import HebrewDate
    today = today or dt.date.today()
    hy = HebrewDate.from_gdate(today).year
    seen, out = set(), []
    for y in (hy, hy + 1):
        for key, d in _year_holidays(y):
            if today <= d <= today + dt.timedelta(days=days) and (key, d) not in seen:
                seen.add((key, d))
                out.append({"key": key, "date": d.isoformat(), "days_away": (d - today).days})
    return sorted(out, key=lambda h: h["date"])


def last_visit(c: dict[str, Any]) -> Optional[str]:
    """When a customer last bought, booked or visited. Imported customers
    with nothing on the site have no date, so they are never "lapsed": we
    cannot tell when they last came."""
    if not (c.get("orders") or c.get("bookings") or c.get("membership")):
        return None
    return c.get("last_seen")


def is_lapsed(c: dict[str, Any], days: int, now: Optional[dt.datetime] = None) -> bool:
    seen = last_visit(c)
    if not seen:
        return False
    if (c.get("membership") or {}).get("status") == "active":
        return False            # still paying; not someone to win back
    now = now or dt.datetime.now(dt.timezone.utc)
    cut = (now - dt.timedelta(days=days)).isoformat()
    return seen < cut


@router.get("/businesses/{business_id}/messages/occasions")
async def occasions(business_id: str, user=Depends(verify_token)):
    from .customer_messages import _owned
    from .customers import build_customers
    await _owned(business_id, user)
    people = (await build_customers(business_id)).values()
    now = dt.datetime.now(dt.timezone.utc)
    lapsed = {str(d): sum(1 for c in people if is_lapsed(c, d, now)) for d in LAPSED_CHOICES}
    return {"holidays": upcoming_holidays(), "lapsed": lapsed}
