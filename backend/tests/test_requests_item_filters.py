"""The requests board's item filters, and a listing's FAQs, end to end.

The board accepted `condition`, `min_price`, `max_price` and `include_sold`
for as long as items have been on it and the page never sent them
(dead-ends audit 2026-09-03, #7). A listing has carried `faqs` since the
marketplace was built and nothing let anyone write one (#9). These pin the
API side of both so the new UI has something true to stand on.

Runs against the live local API (see backend/tests/.env.test).
"""
import os
from datetime import UTC, datetime

import pytest
import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _account(tag):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"items-{tag}-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": f"Item {tag}", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def seller():
    return _account("seller")


def _item(token, title, condition, price, currency="ILS"):
    # The board has its own per-account posting cooldown, which the
    # rate-limit flag does not cover, so each item comes from its own
    # account. Returns (id, that account's token).
    token = _account(title[-6:])
    r = requests.post(f"{BASE}/marketplace/requests", json={
        "request_type": "item", "post_kind": "have", "title": title,
        "description": "item filter test, a description long enough",
        "area": "Jerusalem", "budget_type": "fixed", "budget_amount": price,
        "budget_currency": currency, "condition": condition,
    }, headers=_auth(token), timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"], token


def _ids(params):
    r = requests.get(f"{BASE}/marketplace/requests", params={"request_type": "item", "limit": 200, **params}, timeout=30)
    assert r.status_code == 200, r.text
    return {d["id"] for d in r.json()}


def test_condition_price_and_sold_filters(seller):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    new_cheap, t1 = _item(seller, f"TEST_item_new_{stamp}", "new", 150)
    used_dear, t2 = _item(seller, f"TEST_item_used_{stamp}", "used", 900)
    gone, t3 = _item(seller, f"TEST_item_sold_{stamp}", "good", 400)
    owners = {new_cheap: t1, used_dear: t2, gone: t3}
    try:
        r = requests.post(f"{BASE}/marketplace/requests/{gone}/sold", json={"sold": True}, headers=_auth(t3), timeout=30)
        assert r.status_code == 200, r.text

        everything = _ids({})
        assert new_cheap in everything and used_dear in everything
        assert gone not in everything, "a sold item is hidden by default"

        assert gone in _ids({"include_sold": "true"}), "and shown when asked for"

        by_condition = _ids({"condition": "new"})
        assert new_cheap in by_condition and used_dear not in by_condition

        under_500 = _ids({"max_price": 500})
        assert new_cheap in under_500 and used_dear not in under_500

        over_500 = _ids({"min_price": 500})
        assert used_dear in over_500 and new_cheap not in over_500
    finally:
        for rid, tok in owners.items():
            requests.delete(f"{BASE}/marketplace/requests/{rid}", headers=_auth(tok), timeout=30)


def test_a_price_filter_in_shekels_compares_in_shekels(seller):
    """The bounds are shekels and a post carries its own currency.

    A raw comparison let "under 500" return a $500 item (about 1,850
    shekels) under a filter labelled with a shekel sign, and hide a 600
    shekel one (2026-09-05 audit, finding 2).
    """
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    # $200 is about 730 shekels: outside a 500 ceiling, inside a 1000 one.
    dollars, td = _item(seller, f"TEST_item_usd_{stamp}", "good", 200, currency="USD")
    shekels, ts = _item(seller, f"TEST_item_ils_{stamp}", "good", 400)
    owners = {dollars: td, shekels: ts}
    try:
        under_500 = _ids({"max_price": 500})
        assert shekels in under_500, "400 shekels is under 500"
        assert dollars not in under_500, "$200 is about 730 shekels, not under 500"

        under_1000 = _ids({"max_price": 1000})
        assert dollars in under_1000 and shekels in under_1000

        over_500 = _ids({"min_price": 500})
        assert dollars in over_500 and shekels not in over_500
    finally:
        for rid, tok in owners.items():
            requests.delete(f"{BASE}/marketplace/requests/{rid}", headers=_auth(tok), timeout=30)


def test_faqs_round_trip(seller):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    faqs = [{"q": "How far ahead should I book?", "a": "A week is plenty."}]
    r = requests.post(f"{BASE}/marketplace/gigs", json={
        "title": f"TEST_faq_{stamp}", "description": "faq round trip", "category": "home-services-repair",
        "area": "Tel Aviv", "gig_type": "deliverable", "budget_currency": "ILS",
        "booking_mode": "whatsapp", "whatsapp": "+972501234567",
        "gallery": ["https://example.com/photo.jpg"],
        "tiers": [{"name": "Basic", "price": 200, "currency": "ILS"}],
        "faqs": faqs,
    }, headers=_auth(seller), timeout=30)
    assert r.status_code in (200, 201), r.text
    gig_id = r.json()["id"]
    try:
        assert requests.get(f"{BASE}/marketplace/gigs/{gig_id}", timeout=30).json()["faqs"] == faqs

        more = faqs + [{"q": "Do you deliver?", "a": "Within the city, yes."}]
        r = requests.patch(f"{BASE}/marketplace/gigs/{gig_id}", json={"faqs": more}, headers=_auth(seller), timeout=30)
        assert r.status_code == 200, r.text
        assert requests.get(f"{BASE}/marketplace/gigs/{gig_id}", timeout=30).json()["faqs"] == more

        r = requests.patch(f"{BASE}/marketplace/gigs/{gig_id}", json={"faqs": []}, headers=_auth(seller), timeout=30)
        assert r.status_code == 200, r.text
        assert requests.get(f"{BASE}/marketplace/gigs/{gig_id}", timeout=30).json()["faqs"] == []
    finally:
        requests.delete(f"{BASE}/marketplace/gigs/{gig_id}", headers=_auth(seller), timeout=30)
