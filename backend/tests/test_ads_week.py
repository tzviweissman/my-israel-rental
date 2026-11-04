"""Visits per ad over the last 7 days (routes/short_links.py, _ads_week)."""
from datetime import datetime, timedelta

from routes.short_links import _IL_TZ, _ads_week


def test_counts_only_the_last_seven_days():
    today = datetime.now(_IL_TZ).date()
    day = lambda n: (today - timedelta(days=n)).strftime("%Y-%m-%d")  # noqa: E731
    days = {
        day(0): {"behind-cream": 2, "custom": 1},
        day(6): {"behind-cream": 3},
        day(7): {"behind-cream": 100},  # eight days ago: not this week
    }
    assert _ads_week(days) == {"behind-cream": 5, "custom": 1}
    assert _ads_week({}) == {}
