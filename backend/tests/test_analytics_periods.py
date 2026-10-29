"""Any dates and the comparison (routes/marketplace/insights.window), the day-by-day series, the orders
spreadsheet, and the rental figures (routes/properties/browse.rental_figures). Pure functions, no database."""
import csv
import io
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi import HTTPException

from routes.marketplace.insights import compute, orders_csv, window
from routes.properties.browse import rental_figures

IL = ZoneInfo("Asia/Jerusalem")
NOW = datetime(2026, 10, 14, 12, 0, tzinfo=IL)


def order(at, total, phone="+1", **kw):
    return {"created_at": at.isoformat(), "status": kw.get("status", "new"), "total": total, "currency": "ILS", "lines": [],
            "fulfilment": "pickup", "customer_phone_e164": phone, "customer_name": kw.get("name", "C"), "source": "website"}


def test_dates_are_inclusive_and_compare_with_the_period_before_or_last_year():
    w = window(None, "2026-10-01", "2026-10-10", "prev", NOW)
    assert w.days == 10 and w.prev_end == w.start and w.prev_start == w.start - timedelta(days=10)
    y = window(None, "2026-10-01", "2026-10-10", "year", NOW)
    assert y.prev_start.year == 2025 and y.prev_start.day == 1 and (y.prev_end - y.prev_start).days == 10
    with pytest.raises(HTTPException):
        window(None, "2026-10-10", "2026-10-01", "prev", NOW)
    with pytest.raises(HTTPException):
        window(None, "Oct 1", None, "prev", NOW)


def test_series_by_day_with_last_year_beside_it():
    w = window(None, "2026-10-01", "2026-10-07", "year", NOW)
    out = compute([
        order(datetime(2026, 10, 2, 9, tzinfo=IL), 50),
        order(datetime(2026, 10, 2, 20, tzinfo=IL), 30, "+2"),
        order(datetime(2025, 10, 2, 9, tzinfo=IL), 10, "+3"),
        order(datetime(2026, 9, 30, 9, tzinfo=IL), 999, "+4"),
    ], w.days, NOW, w)
    assert out["series"]["unit"] == "day" and len(out["series"]["points"]) == 7
    day2 = out["series"]["points"][1]
    assert day2 == {"at": "2026-10-02", "orders": 2, "revenue": 80.0, "orders_before": 1, "revenue_before": 10.0}
    assert out["orders"] == 2 and out["revenue"] == 80 and out["orders_before"] == 1 and out["compare"] is True


def test_a_long_range_is_by_month():
    w = window(None, "2026-01-01", "2026-10-14", "prev", NOW)
    out = compute([order(datetime(2026, 3, 5, tzinfo=IL), 20)], w.days, NOW, w)
    assert out["series"]["unit"] == "month" and out["series"]["points"][0]["at"] == "2026-01"
    assert out["series"]["points"][2]["orders"] == 1 and len(out["series"]["points"]) == 10


def test_spreadsheet_has_the_orders_in_range_and_no_formulas():
    w = window(None, "2026-10-01", "2026-10-10", "prev", NOW)
    text = orders_csv([order(datetime(2026, 10, 3, 9, tzinfo=IL), 40, name="=HYPERLINK(1)"),
                       order(datetime(2026, 11, 3, tzinfo=IL), 1)], w)
    assert text.startswith("﻿")
    rows = list(csv.reader(io.StringIO(text[1:])))
    assert len(rows) == 2 and rows[1][3] == "'=HYPERLINK(1)" and float(rows[1][6]) == 40


def test_rentals_nights_occupancy_and_value():
    w = window(None, "2026-10-01", "2026-10-10", "prev", NOW)
    props = [{"id": "p1", "title": "Flat", "rental_type": "vacation"}, {"id": "p2", "title": "Long", "rental_type": "long_term"}]
    bookings = [
        {"property_id": "p1", "start_date": "2026-09-29", "end_date": "2026-10-03", "status": "confirmed",
         "created_at": "2026-09-20T10:00:00+00:00", "total_price": 800, "currency": "ILS"},
        {"property_id": "p1", "start_date": "2026-10-05", "end_date": "2026-10-07", "status": "completed",
         "created_at": "2026-10-02T10:00:00+00:00", "total_price": 400, "currency": "ILS"},
        {"property_id": "p1", "start_date": "2026-10-08", "end_date": "2026-10-09", "status": "cancelled",
         "created_at": "2026-10-03T10:00:00+00:00", "total_price": 200, "currency": "ILS"},
    ]
    out = rental_figures(props, bookings, w, views_now=40, views_before=0)
    assert out["now"]["nights"] == 4          # 1 and 2 October, then 5 and 6
    assert out["now"]["occupancy"] == 40.0    # 4 of 10 nights of the one vacation rental
    assert out["now"]["value"] == 400 and out["now"]["stays"] == 1   # the stay that started in the period
    assert out["now"]["requests"] == 2 and out["now"]["cancelled"] == 1
    assert out["before"]["nights"] == 2 and out["before"]["value"] == 800
    assert out["visitors"]["rate"] == 5.0 and out["visitors"]["rate_before"] is None
    assert out["series"]["points"][0] == {"at": "2026-10-01", "nights": 1, "value": 0.0, "nights_before": 0, "value_before": 0.0}
    assert out["by_listing"][0]["id"] == "p1"
