"""Ordering from the table (tables.py, orders.py) and "add to your order"
(pairings.py). Local dev database only; marked records removed after."""
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pymongo import MongoClient  # noqa: E402

API = os.environ.get("TEST_API", "http://localhost:8001/api")
LOCAL = any(h in os.environ.get("MONGO_URL", "") for h in ("localhost", "127.0.0.1"))
M = "_tbp_test"
IL = ZoneInfo("Asia/Jerusalem")
BIZ, STORE = f"{M}-biz", f"{M}-store"


def _api_up():
    try:
        return requests.get(f"{API}/health", timeout=3).ok
    except requests.RequestException:
        return False


pytestmark = pytest.mark.skipif(not (LOCAL and _api_up()), reason="needs the local API and the local MongoDB")


def _db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.fixture(scope="module", autouse=True)
def cafe():
    db = _db()
    # Pickup only Fridays and a cutoff that has always passed: a table order
    # must ignore both.
    db.businesses.insert_one({"_id": BIZ, "slug": "tbp-test-cafe", "name": "TBP Cafe", "owner_user_id": f"{M}-pro", "marker": M,
                              "order_settings": {"windows": {"pickup": [{"weekday": 5, "start": "08:00", "end": "09:00"}]}},
                              "table_ordering": {"on": True, "tables": 8}})
    db.marketplace_gigs.insert_one({"_id": STORE, "marker": M, "business_id": BIZ, "provider_user_id": f"{M}-pro", "gig_type": "store",
                                    "status": "published", "title": "Menu",
                                    "products": [{"id": "coffee", "name": "Coffee", "price": 12, "goes_with": ["cake", "ghost"]},
                                                 {"id": "cake", "name": "Cake", "price": 20},
                                                 {"id": "toast", "name": "Toast", "price": 30}]})
    yield
    for col, q in (("businesses", {"marker": M}), ("marketplace_gigs", {"marker": M}), ("store_orders", {"business_id": BIZ}),
                   ("notifications", {"user_id": f"{M}-pro"})):
        db[col].delete_many(q)


def _order(**kw):
    body = {"lines": [{"product_id": "coffee", "qty": 2}], "fulfilment": "pickup",
            "date": (datetime.now(IL).date() + timedelta(days=1)).isoformat(), **kw}
    return requests.post(f"{API}/marketplace/order-form/{STORE}/orders", json=body, timeout=15)


def test_table_order_needs_no_phone_date_or_window():
    r = _order(table=3)
    assert r.status_code == 200, r.text
    o = _db().store_orders.find_one({"_id": r.json()["order_id"]})
    assert o["table"] == 3 and o["customer_name"] == "Table 3" and o["customer_phone"] is None
    assert o["needed_by"].startswith(datetime.now(IL).date().isoformat()) and "T" in o["needed_by"]
    track = requests.get(f"{API}/marketplace/orders/track/{o['track_token']}", timeout=10).json()
    assert track["table"] == 3


def test_table_numbers_and_switch_are_checked():
    assert _order(table=9).status_code == 400          # only 8 tables
    _db().businesses.update_one({"_id": BIZ}, {"$set": {"table_ordering.on": False}})
    try:
        assert _order(table=2).status_code == 400
    finally:
        _db().businesses.update_one({"_id": BIZ}, {"$set": {"table_ordering.on": True}})


def test_ordinary_orders_still_need_name_and_phone():
    assert _order().status_code == 422
    assert _order(customer_name="Dana").status_code == 422
    today = datetime.now(IL).date()
    friday = next(today + timedelta(days=i) for i in range(1, 8) if ((today + timedelta(days=i)).weekday() + 1) % 7 == 5)
    r = _order(customer_name="Dana", customer_phone="054-1234567", date=friday.isoformat())
    assert r.status_code == 400 and "window" in r.json()["detail"]   # the pickup window still applies without a table


def test_goes_with_owner_choice_first_then_learned():
    db = _db()
    now = datetime.now(IL)
    db.store_orders.insert_many([{"_id": f"{M}-h{i}", "business_id": BIZ, "gig_id": STORE, "source": "website", "status": "done",
                                  "created_at": (now - timedelta(days=i + 1)).isoformat(),
                                  "lines": [{"product_id": "toast"}, {"product_id": "cake"}]} for i in range(3)])
    d = requests.get(f"{API}/marketplace/order-form/{STORE}/goes-with", timeout=10).json()
    assert d["coffee"][0] == "cake" and "ghost" not in d["coffee"]      # the business's pick, unknown ids dropped
    assert d["toast"] == ["cake"] and d["cake"] == ["toast"]             # learned: ordered together 3 times
    form = requests.get(f"{API}/marketplace/order-form/{STORE}", timeout=10).json()
    assert form["business"]["tables_on"] is True
    assert {p["id"]: p for p in form["products"]}["coffee"]["goes_with"] == ["cake", "ghost"]
