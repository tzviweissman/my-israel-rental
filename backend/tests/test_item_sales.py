"""item_sales: per-item counts, margins and the hints (insights.py). Pure, no API needed."""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from routes.marketplace.insights import item_sales, window

IL = ZoneInfo("Asia/Jerusalem")
NOW = datetime(2026, 11, 13, 12, tzinfo=IL)
WIN = window(90, None, None, "prev", NOW)
DAY = (NOW - timedelta(days=3)).isoformat()


def test_item_sales():
    products = [("g", {"id": "a", "name": "Cake", "price": 100}), ("g", {"id": "b", "name": "Cookie", "price": 10}),
                ("g", {"id": "c", "name": "Bread", "price": 20})]
    orders = [
        {"gig_id": "g", "status": "done", "created_at": DAY, "lines": [{"product_id": "a", "qty": 3, "price": 100}, {"product_id": "b", "qty": 1, "price": 10}]},
        {"gig_id": "g", "status": "new", "created_at": DAY, "lines": [{"product_id": "a", "qty": 2, "price": 100}, {"name": "Old jam", "qty": 1, "price": 15}]},
        {"gig_id": "g", "status": "cancelled", "created_at": DAY, "lines": [{"product_id": "c", "qty": 9, "price": 20}]},
        {"gig_id": "g", "status": "done", "created_at": (NOW - timedelta(days=200)).isoformat(), "lines": [{"product_id": "c", "qty": 9, "price": 20}]},
    ]
    rows = {r["name"]: r for r in item_sales(products, orders, {("g", "a"): 60, ("g", "b"): 12, ("g", "c"): 18}, WIN)}
    assert [r["name"] for r in item_sales(products, orders, {}, WIN)][0] == "Cake"
    a, b, c = rows["Cake"], rows["Cookie"], rows["Bread"]
    assert (a["qty"], a["orders"], a["revenue"], a["margin"], a["margin_pct"], a["profit"], a["flags"]) == (5, 2, 500, 40, 40.0, 200, [])
    assert b["margin"] == -2 and b["flags"] == ["slow", "loss"]
    assert c["qty"] == 0 and c["flags"] == ["slow", "thin"]          # cancelled and old orders not counted
    assert rows["Old jam"]["listed"] is False and rows["Old jam"]["flags"] == []
