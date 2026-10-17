"""Holiday and seasonal products (seasonal.py): hidden from the public
outside their dates, never from the owner. Local dev database only."""
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
M = "_season_test"
IL = ZoneInfo("Asia/Jerusalem")
BIZ, STORE = f"{M}-biz", f"{M}-store"
TODAY = datetime.now(IL).date()
D = lambda n: (TODAY + timedelta(days=n)).isoformat()  # noqa: E731


def test_in_season_bounds_are_inclusive():
    from routes.marketplace.seasonal import in_season
    t = "2026-09-10"
    assert in_season({}, t)
    assert in_season({"available_from": t, "available_until": t}, t)
    assert not in_season({"available_from": "2026-09-11"}, t)
    assert not in_season({"available_until": "2026-09-09"}, t)


def _api_up():
    try:
        return requests.get(f"{API}/health", timeout=3).ok
    except requests.RequestException:
        return False


live = pytest.mark.skipif(not (LOCAL and _api_up()), reason="needs the local API and the local MongoDB")


@pytest.fixture(scope="module")
def shop():
    db = _db()
    db.businesses.insert_one({"_id": BIZ, "slug": "season-test-bakery", "name": "Season Bakery", "owner_user_id": f"{M}-pro", "marker": M})
    db.marketplace_gigs.insert_one({"_id": STORE, "marker": M, "business_id": BIZ, "provider_user_id": f"{M}-pro", "gig_type": "store",
                                    "status": "published", "title": "Breads",
                                    "products": [{"id": "plain", "name": "Challah", "price": 18},
                                                 {"id": "round", "name": "Round challah", "price": 25, "available_from": D(-2), "available_until": D(5)},
                                                 {"id": "sufgan", "name": "Sufganiya", "price": 8, "available_from": D(30), "available_until": D(40)},
                                                 {"id": "old", "name": "Hamantash", "price": 6, "available_until": D(-1)}]})
    yield
    for col, q in (("businesses", {"marker": M}), ("marketplace_gigs", {"marker": M}), ("store_orders", {"business_id": BIZ})):
        db[col].delete_many(q)


def _db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@live
def test_public_sees_only_what_is_in_season(shop):
    form = requests.get(f"{API}/marketplace/order-form/{STORE}", timeout=10).json()
    ids = {p["id"]: p for p in form["products"]}
    assert set(ids) == {"plain", "round"} and ids["round"]["available_until"] == D(5)
    gig = requests.get(f"{API}/marketplace/gigs/{STORE}", timeout=10).json()
    assert {p["id"] for p in gig["products"]} == {"plain", "round"}
    page = requests.get(f"{API}/marketplace/business/season-test-bakery", timeout=10).json()
    listing = next(g for g in page["listings"] if g["id"] == STORE)
    assert {p["id"] for p in listing["products"]} == {"plain", "round"}
    # Still stored, for the owner to use next year.
    assert len(_db().marketplace_gigs.find_one({"_id": STORE})["products"]) == 4


@live
def test_an_out_of_season_item_cannot_be_ordered(shop):
    r = requests.post(f"{API}/marketplace/order-form/{STORE}/orders", json={
        "lines": [{"product_id": "sufgan", "qty": 1}], "fulfilment": "pickup", "date": D(1),
        "customer_name": "Dana", "customer_phone": "054-1234567"}, timeout=10)
    assert r.status_code == 400 and "no longer available" in r.json()["detail"]
