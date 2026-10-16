"""Gift cards (gift_cards.py), the left-behind basket reminder
(basket_reminders.py), appointment deposits (deposits.py) and busy times
(busy_times.py).

Writes marked records into the local dev database (never Atlas) and
removes them afterwards. Owner-side steps call the module functions
directly; no email leaves a test machine.
"""
import asyncio
import os
import sys
from datetime import UTC, datetime, timedelta
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
M = "_gbd_test"
IL = ZoneInfo("Asia/Jerusalem")
BIZ = f"{M}-biz"
STORE = f"{M}-store"


def _api_up():
    try:
        return requests.get(f"{API}/health", timeout=3).ok
    except requests.RequestException:
        return False


pytestmark = pytest.mark.skipif(not (LOCAL and _api_up()), reason="needs the local API and the local MongoDB")


def _db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _run(coro):
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


@pytest.fixture(scope="module", autouse=True)
def business():
    db = _db()
    db.businesses.insert_one({"_id": BIZ, "slug": "gbd-test-bakery", "name": "GBD Bakery", "owner_user_id": f"{M}-pro", "marker": M,
                              "gift_card_settings": {"on": True, "amounts": [100, 200], "custom": False, "note": "Bit to 050"}})
    db.marketplace_gigs.insert_one({"_id": STORE, "marker": M, "business_id": BIZ, "provider_user_id": f"{M}-pro", "gig_type": "store",
                                    "status": "published", "title": "Breads",
                                    "products": [{"id": "challah", "name": "Challah", "price": 20, "options": [{"id": "big", "name": "Large", "price": 30}]}]})
    yield
    for col, q in (("businesses", {"marker": M}), ("marketplace_gigs", {"marker": M}), ("gift_cards", {"business_id": BIZ}),
                   ("order_baskets", {"business_id": BIZ}), ("member_checkins", {"business_id": BIZ}),
                   ("marketplace_bookings", {"marker": M}), ("store_orders", {"business_id": BIZ}), ("notifications", {"user_id": f"{M}-pro"})):
        db[col].delete_many(q)


# --- gift cards ---------------------------------------------------------------

def test_gift_card_from_order_to_spent():
    db = _db()
    page = requests.get(f"{API}/marketplace/gift-cards/gbd-test-bakery", timeout=10).json()
    assert page["amounts"] == [100, 200] and page["custom"] is False
    # An amount the business does not offer is refused while "other" is off.
    bad = requests.post(f"{API}/marketplace/gift-cards/gbd-test-bakery/buy", json={
        "amount": 150, "buyer_name": "Dana", "buyer_email": "dana@example.com", "to_name": "Avi"}, timeout=10)
    assert bad.status_code == 400
    r = requests.post(f"{API}/marketplace/gift-cards/gbd-test-bakery/buy", json={
        "amount": 100, "buyer_name": "Dana", "buyer_email": "dana@example.com", "to_name": "Avi", "to_email": "avi@example.com",
        "message": "Happy birthday"}, timeout=10)
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    card = requests.get(f"{API}/marketplace/gift/{token}", timeout=10).json()
    assert card["status"] == "awaiting_payment" and card["code"] is None and card["note"] == "Bit to 050"

    # Not paid yet: the code does not exist, so it cannot be used.
    from routes.marketplace import gift_cards
    biz = db.businesses.find_one({"_id": BIZ})
    doc = db.gift_cards.find_one({"token": token})
    _run(gift_cards._activate(doc, biz))
    card = requests.get(f"{API}/marketplace/gift/{token}", timeout=10).json()
    assert card["status"] == "active" and card["code"].startswith("GIFT-") and card["balance"] == 100
    assert card["expires_on"] >= (datetime.now(IL).date() + timedelta(days=365 * 5 - 2)).isoformat()

    # On the order form it takes up to its balance off.
    chk = requests.post(f"{API}/marketplace/businesses/{BIZ}/discount-codes/check",
                        json={"code": card["code"].lower(), "form": "orders", "amount": 60}, timeout=10).json()
    assert chk["ok"] and chk["discount"] == 60
    from routes.marketplace import discounts
    c, off = _run(discounts.evaluate(BIZ, card["code"], "orders", 60, None))
    assert _run(discounts.redeem(c, off, None))
    assert db.gift_cards.find_one({"token": token})["balance"] == 40
    c, off = _run(discounts.evaluate(BIZ, card["code"], "orders", 500, None))
    assert off == 40
    assert _run(discounts.redeem(c, off, None))
    assert db.gift_cards.find_one({"token": token})["status"] == "used_up"
    chk = requests.post(f"{API}/marketplace/businesses/{BIZ}/discount-codes/check",
                        json={"code": card["code"], "form": "orders", "amount": 60}, timeout=10).json()
    assert chk == {"ok": False, "reason": "This gift card has been used up"}


def test_gift_card_cannot_be_overspent_at_once():
    db = _db()
    from routes.marketplace import gift_cards
    biz = db.businesses.find_one({"_id": BIZ})
    card = {"_id": f"{M}-g2", "business_id": BIZ, "amount": 50.0, "balance": 50.0, "buyer": {"name": "X", "email": None},
            "to": None, "status": "awaiting_payment", "token": f"{M}-tok-g2-xxxxxxxxxxxx", "uses": []}
    db.gift_cards.insert_one(card)
    fresh = _run(gift_cards._activate(card, biz))
    assert _run(gift_cards._take(fresh, 30, {"where": "counter"}))
    assert not _run(gift_cards._take(fresh, 30, {"where": "counter"}))   # only 20 left
    assert db.gift_cards.find_one({"_id": f"{M}-g2"})["balance"] == 20


# --- basket reminder ----------------------------------------------------------

def _day(now_il_hour=12):
    return datetime.now(IL).replace(hour=now_il_hour, minute=0, second=0, microsecond=0).astimezone(UTC)


def test_basket_reminder_once_and_not_after_ordering():
    db = _db()
    from routes.marketplace import basket_reminders as br
    ok = requests.post(f"{API}/marketplace/order-form/{STORE}/basket", json={
        "basket_id": f"{M}basket000000001", "email": "Noa@Example.com", "name": "Noa",
        "lines": [{"key": "challah::big", "qty": 2}], "lang": "en"}, timeout=10)
    assert ok.status_code == 200, ok.text
    requests.post(f"{API}/marketplace/order-form/{STORE}/basket", json={
        "basket_id": f"{M}basket000000002", "email": "eli@example.com", "lines": [{"key": "challah", "qty": 1}]}, timeout=10)
    requests.post(f"{API}/marketplace/order-form/{STORE}/basket/{M}basket000000002/ordered", timeout=10)
    # Make them three and a half hours old.
    old = (_day(12) - timedelta(hours=3, minutes=30)).isoformat()
    db.order_baskets.update_many({"business_id": BIZ}, {"$set": {"updated_at": old, "created_at": old}})
    assert _run(br.run_once(now=_day(22))) == 0          # night: nothing
    _run(br.run_once(now=_day(12)))
    _run(br.run_once(now=_day(12) + timedelta(minutes=20)))
    b1 = db.order_baskets.find_one({"_id": f"{M}basket000000001"})
    b2 = db.order_baskets.find_one({"_id": f"{M}basket000000002"})
    assert b1["reminded_at"] and b1["email"] == "noa@example.com"
    assert b2["reminded_at"] is None
    assert br._names(b1, db.marketplace_gigs.find_one({"_id": STORE})) == ["2 × Challah (Large)"]


def test_basket_skipped_when_they_ordered_anyway_or_business_off():
    db = _db()
    from routes.marketplace import basket_reminders as br
    for i, email in ((3, "ord@example.com"), (4, "off@example.com")):
        requests.post(f"{API}/marketplace/order-form/{STORE}/basket", json={
            "basket_id": f"{M}basket00000000{i}", "email": email, "lines": [{"key": "challah", "qty": 1}]}, timeout=10)
    start = _day(12) - timedelta(hours=4)
    db.order_baskets.update_many({"_id": {"$in": [f"{M}basket000000003", f"{M}basket000000004"]}},
                                 {"$set": {"updated_at": start.isoformat(), "created_at": start.isoformat()}})
    db.store_orders.insert_one({"_id": f"{M}-o1", "business_id": BIZ, "customer_email": "ORD@example.com",
                                "created_at": (start + timedelta(minutes=10)).astimezone(IL).isoformat()})
    db.message_unsubscribes.insert_one({"_id": f"{M}-u", "business_id": BIZ, "email": "off@example.com"})
    try:
        _run(br.run_once(now=_day(12)))
        assert db.order_baskets.find_one({"_id": f"{M}basket000000003"})["ordered"] is True
        assert db.order_baskets.find_one({"_id": f"{M}basket000000004"})["reminded_at"] is None
    finally:
        db.message_unsubscribes.delete_one({"_id": f"{M}-u"})


# --- deposits -----------------------------------------------------------------

def _booking(i, hours_ahead, dep_status):
    start = datetime.now(IL) + timedelta(hours=hours_ahead)
    return {"_id": f"{M}-b{i}", "marker": M, "gig_id": STORE, "provider_user_id": f"{M}-pro", "status": "accepted",
            "preferred_date": start.date().isoformat(), "time_slot": start.strftime("%H:%M"), "guest_name": "Dana",
            "deposit": {"amount": 50.0, "status": dep_status}}


def test_deposit_returned_only_when_cancelled_in_time():
    db = _db()
    from routes.marketplace.deposits import owed_back
    db.marketplace_bookings.insert_many([_booking(1, 72, "paid"), _booking(2, 5, "paid"), _booking(3, 6, "paid"), _booking(4, 73, "due")])
    _run(owed_back(db.marketplace_bookings.find_one({"_id": f"{M}-b1"}), by_business=False))   # 3 days ahead
    _run(owed_back(db.marketplace_bookings.find_one({"_id": f"{M}-b2"}), by_business=False))   # 5 hours ahead
    _run(owed_back(db.marketplace_bookings.find_one({"_id": f"{M}-b3"}), by_business=True))    # the business called it off
    _run(owed_back(db.marketplace_bookings.find_one({"_id": f"{M}-b4"}), by_business=False))   # never paid
    st = {b["_id"]: b["deposit"]["status"] for b in db.marketplace_bookings.find({"marker": M})}
    assert st == {f"{M}-b1": "to_return", f"{M}-b2": "paid", f"{M}-b3": "to_return", f"{M}-b4": "waived"}


# --- busy times ---------------------------------------------------------------

def test_busy_times_only_with_enough_visits():
    db = _db()
    assert requests.get(f"{API}/marketplace/businesses/{BIZ}/busy-times", timeout=10).json() == {"enough": False}
    base = datetime.now(IL).replace(minute=5, second=0, microsecond=0) - timedelta(days=7)
    rows = [{"_id": f"{M}-c{i}", "business_id": BIZ, "member_id": "x",
             "at": base.replace(hour=18 if i < 24 else 9).isoformat()} for i in range(32)]
    db.member_checkins.insert_many(rows)
    d = requests.get(f"{API}/marketplace/businesses/{BIZ}/busy-times", timeout=10).json()
    assert d["enough"] is True
    day = str((base.weekday() + 1) % 7)
    assert d["days"][day]["18"] == 100 and d["days"][day]["9"] == 33
