"""An "Add to Google Calendar" link for an email (Tzvi, 16 Oct 2026, from
Calendly and Booksy: "add to calendar on every confirmation").

The pages build the same link, and an .ics file for Apple and Outlook, in
the browser (frontend/src/utils/calendarLinks.js); an email can only carry
a link, so this is the one it carries.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

IL = ZoneInfo("Asia/Jerusalem")


def google_calendar_url(title: str, day: str, time: str | None, minutes: int = 60,
                        details: str = "", location: str = "") -> str | None:
    """`day` YYYY-MM-DD and `time` HH:MM in Israel time. None if unusable."""
    try:
        start = datetime.fromisoformat(f"{day}T{time or '09:00'}").replace(tzinfo=IL).astimezone(UTC)
    except (TypeError, ValueError):
        return None
    end = start + timedelta(minutes=max(15, int(minutes or 60)))
    fmt = "%Y%m%dT%H%M%SZ"
    q = {"action": "TEMPLATE", "text": title[:200], "dates": f"{start.strftime(fmt)}/{end.strftime(fmt)}"}
    if details:
        q["details"] = details[:1000]
    if location:
        q["location"] = location[:200]
    return "https://calendar.google.com/calendar/render?" + urlencode(q)
