"""'Order again' (orders.reorder_path): the same items, once an order is
done. Local dev database only; marked records removed after."""
import os
import sys
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pymongo import MongoClient  # noqa: E402

API = os.environ.get("TEST_API", "http://localhost:8001/api")
LOCAL = any(h in os.environ.get("MONGO_URL", "") for h in ("localhost", "127.0.0.1"))
M = "_reorder_test"


def test_reorder_path_keeps_items_options_and_quantities():
    from routes.marketplace.orders import reorder_path
    o = {"gig_id": "g1", "lines": [{"product_id": "a", "qty": 2}, {"product_id": "b", "option_id": "o2", "qty": 1}, {"name": "x"}]}
    assert reorder_path(o) == "/order/g1?items=a~2,b%3A%3Ao2~1"
    assert reorder_path({"gig_id": "g1", "lines": []}) is None
    assert reorder_path({"lines": [{"product_id": "a", "qty": 1}]}) is None


def _api_up():
    try:
        return requests.get(f"{API}/health", timeout=3).ok
    except requests.RequestException:
        return False


@pytest.mark.skipif(not (LOCAL and _api_up()), reason="needs the local API and the local MongoDB")
def test_tracking_page_offers_it_only_when_done():
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    db.businesses.insert_one({"_id": f"{M}-biz", "slug": "reorder-test-cafe", "name": "Reorder Cafe", "owner_user_id": f"{M}-pro", "marker": M})
    db.store_orders.insert_one({"_id": f"{M}-o", "business_id": f"{M}-biz", "gig_id": "g1", "status": "ready",
                                "track_token": f"{M}-track-token-1234", "lines": [{"product_id": "a", "qty": 3}]})
    try:
        url = f"{API}/marketplace/orders/track/{M}-track-token-1234"
        assert requests.get(url, timeout=10).json()["reorder_path"] is None
        db.store_orders.update_one({"_id": f"{M}-o"}, {"$set": {"status": "done"}})
        assert requests.get(url, timeout=10).json()["reorder_path"] == "/order/g1?items=a~3"
    finally:
        db.store_orders.delete_many({"_id": f"{M}-o"})
        db.businesses.delete_many({"marker": M})
