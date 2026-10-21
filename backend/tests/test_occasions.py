"""Holiday dates and the win-back group (routes/marketplace/occasions.py)."""
import datetime as dt

from routes.marketplace.customer_messages import _UNFILLED
from routes.marketplace.occasions import _year_holidays, is_lapsed, upcoming_holidays


def test_holiday_dates_5787_and_5788():
    h = dict(_year_holidays(5787))
    assert h["chanukah"] == dt.date(2026, 12, 5)
    assert h["purim"] == dt.date(2027, 3, 23)          # leap year: Adar II
    assert h["pesach"] == dt.date(2027, 4, 22)
    assert h["yom_haatzmaut"] == dt.date(2027, 5, 12)
    assert h["shavuot"] == dt.date(2027, 6, 11)
    assert dict(_year_holidays(5788))["rosh_hashana"] == dt.date(2027, 10, 2)


def test_upcoming_window():
    got = upcoming_holidays(dt.date(2026, 11, 20), days=45)
    assert [h["key"] for h in got] == ["chanukah"]
    assert got[0]["days_away"] == 15
    # crosses into the next Hebrew year
    assert upcoming_holidays(dt.date(2027, 9, 20), days=20)[0]["key"] == "rosh_hashana"


def _c(last, **kw):
    return {"orders": 1, "bookings": 0, "membership": None, "last_seen": last, **kw}


def test_lapsed():
    now = dt.datetime(2026, 10, 21, tzinfo=dt.timezone.utc)
    assert is_lapsed(_c("2026-06-01T10:00:00+00:00"), 90, now)
    assert not is_lapsed(_c("2026-09-01T10:00:00+00:00"), 90, now)
    # imported, never bought here: no date to judge by
    assert not is_lapsed({"orders": 0, "bookings": 0, "membership": None, "last_seen": "2025-01-01"}, 90, now)
    # an active member is still a customer
    assert not is_lapsed(_c("2026-01-01T00:00:00+00:00", membership={"status": "active"}), 90, now)


def test_unfilled_brackets():
    assert _UNFILLED.search("Hi\n[What is new: a product]\nBye")
    assert not _UNFILLED.search("Size [M] only")
