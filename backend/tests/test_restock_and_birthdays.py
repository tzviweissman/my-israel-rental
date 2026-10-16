"""'Tell me when it's back' (restock.py) and the birthday treat
(birthdays.py). Local dev database only; marked records removed after.
The passes are run directly with a chosen "now"; no email leaves."""
import asyncio
import os
import sys
from datetime import UTC, date, datetime, timedelta
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
M = "_rsb_test"
IL = ZoneInfo("Asia/Jerusalem")
BIZ, STORE = f"{M}-biz", f"{M}-store"


def _api_up():
    try:
        return requests.get(f"{API}/health", timeout=3).ok
    except requests.RequestException:
        return False


def _db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _run(coro):
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


def _noon():
    return datetime.now(IL).replace(hour=12, minute=0, second=0, microsecond=0).astimezone(UTC)


def test_next_birthday_handles_year_end_and_29_february():
    from routes.marketplace.birthdays import next_birthday
    assert next_birthday(1, 2, date(2026, 12, 30)) == date(2027, 1, 2)
    assert next_birthday(2, 29, date(2027, 2, 1)) == date(2027, 2, 28)
    assert next_birthday(2, 29, date(2028, 2, 1)) == date(2028, 2, 29)
    assert next_birthday(10, 16, date(2026, 10, 16)) == date(2026, 10, 16)


live = pytest.mark.skipif(not (LOCAL and _api_up()), reason="needs the local API and the local MongoDB")


@pytest.fixture(scope="module")
def shop():
    db = _db()
    db.businesses.insert_one({"_id": BIZ, "slug": "rsb-test-bakery", "name": "RSB Bakery", "owner_user_id": f"{M}-pro", "marker": M})
    db.marketplace_gigs.insert_one({"_id": STORE, "marker": M, "business_id": BIZ, "provider_user_id": f"{M}-pro", "gig_type": "store",
                                    "status": "published", "title": "Breads",
                                    "products": [{"id": "rye", "name": "Rye", "price": 20, "in_stock": False},
                                                 {"id": "babka", "name": "Babka", "price": 40, "stock": 0},
                                                 {"id": "challah", "name": "Challah", "price": 18}]})
    yield
    for col, q in (("businesses", {"marker": M}), ("marketplace_gigs", {"marker": M}), ("restock_waits", {"business_id": BIZ}),
                   ("customer_birthdays", {"business_id": BIZ}), ("discount_codes", {"business_id": BIZ})):
        db[col].delete_many(q)


@live
def test_waiting_for_a_sold_out_product(shop):
    db = _db()
    from routes.marketplace import restock
    url = f"{API}/marketplace/order-form/{STORE}/notify-when-back"
    assert requests.post(url, json={"product_id": "rye", "email": "Noa@Example.com"}, timeout=10).status_code == 200
    assert requests.post(url, json={"product_id": "rye", "email": "noa@example.com"}, timeout=10).status_code == 200   # same, no error
    assert requests.post(url, json={"product_id": "babka", "email": "eli@example.com"}, timeout=10).status_code == 200  # counted down to 0
    assert requests.post(url, json={"product_id": "challah", "email": "eli@example.com"}, timeout=10).status_code == 400  # on sale
    assert requests.post(url, json={"product_id": "nope", "email": "eli@example.com"}, timeout=10).status_code == 404
    assert db.restock_waits.count_documents({"gig_id": STORE}) == 2

    _run(restock.run_once(now=_noon()))
    assert db.restock_waits.count_documents({"gig_id": STORE, "notified_at": {"$ne": None}}) == 0   # still sold out

    db.marketplace_gigs.update_one({"_id": STORE}, {"$set": {"products.0.in_stock": True, "products.1.stock": 5}})
    night = _noon().astimezone(IL).replace(hour=23).astimezone(UTC)
    assert _run(restock.run_once(now=night)) == 0
    _run(restock.run_once(now=_noon()))
    _run(restock.run_once(now=_noon() + timedelta(minutes=10)))
    assert db.restock_waits.count_documents({"gig_id": STORE, "notified_at": {"$ne": None}}) == 2

    # Sold out again: the same person can wait afresh.
    db.marketplace_gigs.update_one({"_id": STORE}, {"$set": {"products.0.in_stock": False}})
    requests.post(url, json={"product_id": "rye", "email": "noa@example.com"}, timeout=10)
    assert db.restock_waits.find_one({"gig_id": STORE, "product_id": "rye", "email": "noa@example.com"})["notified_at"] is None


@live
def test_birthday_saved_only_when_on_then_one_treat_a_year(shop):
    db = _db()
    from routes.marketplace import birthdays, discounts
    soon = datetime.now(IL).date() + timedelta(days=2)
    md = f"{soon.month:02d}-{soon.day:02d}"
    _run(birthdays.remember(BIZ, "dana@example.com", "Dana Levi", md, "en", "order"))
    assert db.customer_birthdays.count_documents({"business_id": BIZ}) == 0          # the business has it off

    db.businesses.update_one({"_id": BIZ}, {"$set": {"birthday_settings": {"on": True, "kind": "percent", "value": 15, "days": 7}}})
    _run(birthdays.remember(BIZ, "Dana@Example.com", "Dana Levi", md, "en", "order"))
    later = datetime.now(IL).date() + timedelta(days=12)
    _run(birthdays.remember(BIZ, "avi@example.com", "Avi", f"{later.month:02d}-{later.day:02d}", "he", "booking"))
    _run(birthdays.remember(BIZ, "bad@example.com", "Bad", "13-40", "en", "order"))   # not a date: ignored
    assert db.customer_birthdays.count_documents({"business_id": BIZ}) == 2

    _run(birthdays.run_once(now=_noon()))
    _run(birthdays.run_once(now=_noon() + timedelta(hours=1)))
    codes = list(db.discount_codes.find({"business_id": BIZ, "birthday_gift": True}))
    assert [c["for_email"] for c in codes] == ["dana@example.com"]
    assert db.customer_birthdays.find_one({"_id": f"{BIZ}:dana@example.com"})["last_sent_year"] == soon.year

    c, off = _run(discounts.evaluate(BIZ, codes[0]["code"], "orders", 100, None))
    assert off == 15
    # The personal gift codes do not crowd the business's own list.
    assert all(not r.get("birthday_gift") for r in db.discount_codes.find({"business_id": BIZ, "referral_reward": {"$ne": True}, "birthday_gift": {"$ne": True}}))


@live
def test_order_form_says_whether_to_ask(shop):
    d = requests.get(f"{API}/marketplace/order-form/{STORE}", timeout=10).json()
    assert d["business"]["birthday_on"] is True
    names = {p["id"]: p for p in d["products"]}
    assert names["rye"]["in_stock"] is False and names["babka"]["stock"] == 5
