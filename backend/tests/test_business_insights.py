"""How your business is doing (routes/marketplace/insights.py): every number is
a count or sum of the business's own orders, nothing estimated."""
import sys
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routes.marketplace.insights import compute  # noqa: E402

IL = ZoneInfo("Asia/Jerusalem")
NOW = datetime(2026, 10, 14, 12, 0, tzinfo=IL)   # a Wednesday


def order(days_ago, total, phone, *, status="new", lines=None, city=None, currency="USD", source="website", name="C"):
    return {
        "created_at": (NOW - timedelta(days=days_ago)).isoformat(), "status": status, "total": total, "currency": currency,
        "lines": lines or [], "fulfilment": "delivery" if city else "pickup", "city": city, "address": None,
        "customer_phone_e164": phone, "customer_name": name, "source": source,
    }


def test_totals_compare_and_leave_out_cancelled():
    out = compute([
        order(2, 55, "+1", lines=[{"name": "White Vase", "qty": 1, "price": 55}], city="ramat beit shemesh"),
        order(3, 90, "+2", lines=[{"name": "Bottle Opener", "qty": 2, "price": 45}], city="Jerusalem"),
        order(4, 999, "+3", status="cancelled"),
        order(40, 30, "+1", source="dashboard"),
    ], 30, NOW)
    assert out["orders"] == 2 and out["orders_before"] == 1
    assert out["revenue"] == 145 and out["revenue_before"] == 30 and out["average"] == 72.5
    assert out["compare"] is True and out["currency"] == "USD"
    assert out["best_sellers"][0] == {"name": "Bottle Opener", "qty": 2, "revenue": 90.0}
    assert {c["city"] for c in out["cities"]} == {"Ramat Beit Shemesh", "Jerusalem"}


def test_new_and_returning_customers():
    out = compute([order(1, 10, "+1"), order(2, 10, "+2"), order(60, 10, "+1")], 30, NOW)
    assert out["customers"] == 2 and out["returning"] == 1 and out["new_customers"] == 1


def test_no_comparison_when_counting_only_just_started():
    out = compute([order(1, 10, "+1")], 30, NOW)
    assert out["compare"] is False and out["since"] == (NOW - timedelta(days=1)).date().isoformat()


def test_other_currencies_are_counted_not_added():
    out = compute([order(1, 100, "+1"), order(2, 100, "+2"), order(3, 50, "+3", currency="ILS")], 30, NOW)
    assert out["currency"] == "USD" and out["revenue"] == 200 and out["other_currency_orders"] == 1 and out["orders"] == 3


def test_twelve_months_and_weekdays_sunday_first():
    out = compute([order(0, 10, "+1")], 30, NOW)
    assert len(out["months"]) == 12 and out["months"][-1] == {"month": "2026-10", "orders": 1, "revenue": 10.0}
    assert out["weekdays"] == [0, 0, 0, 1, 0, 0, 0]      # Wednesday


def test_typed_orders_are_counted_apart():
    out = compute([order(1, 10, "+1"), order(1, 10, "+2", lines=[{"name": "A", "qty": 1, "price": 10}])], 30, NOW)
    assert out["typed_orders"] == 1 and out["best_sellers"] == [{"name": "A", "qty": 1, "revenue": 10.0}]


def test_empty():
    out = compute([], 30, NOW)
    assert out["orders"] == 0 and out["since"] is None and out["average"] is None and out["compare"] is False


def test_served_where_the_dashboard_asks():
    import server
    assert "/api/marketplace/businesses/{business_id}/insights" in {getattr(r, "path", "") for r in server.app.routes}
