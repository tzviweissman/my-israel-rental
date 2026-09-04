"""The price sort and the price card have to name the same option.

`cheapest_price` is the sort key for "price: low to high" and the figure
the price filter compares against. It is now the cheapest option IN
SHEKELS, converted at the same rate the card uses (gigPrice.js,
cheapestRow): before, a $30 item beside a ₪90 one made the listing sort
as if it cost ₪30 while its card printed ₪90 (2026-09-04 audit, #2).

Runs against the live local API (see backend/tests/.env.test).
"""
import os
from datetime import UTC, datetime

import pytest
import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")
USD_TO_ILS = 3.65   # routes/marketplace/shared.py, mirrored from listingPrice.js


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def owner():
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"pricesort-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": "Price Sort", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


def _gig(token, tiers, title):
    r = requests.post(f"{BASE}/marketplace/gigs", json={
        "title": title, "description": "price sort test", "category": "home-services-repair",
        "area": "Tel Aviv", "gig_type": "deliverable", "budget_currency": "ILS",
        "booking_mode": "whatsapp", "whatsapp": "+972501234567",
        "gallery": ["https://example.com/photo.jpg"], "tiers": tiers,
    }, headers=_auth(token), timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def test_mixed_currency_listing_sorts_by_its_real_cheapest_option(owner):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    mixed = _gig(owner, [
        {"name": "Dollar", "price": 30, "currency": "USD"},
        {"name": "Shekel", "price": 90, "currency": "ILS"},
    ], f"TEST_pricesort_mixed_{stamp}")
    plain = _gig(owner, [{"name": "Only", "price": 100, "currency": "ILS"}], f"TEST_pricesort_plain_{stamp}")
    try:
        detail = requests.get(f"{BASE}/marketplace/gigs/{mixed}", timeout=30).json()
        # ₪90 is the cheaper option: $30 is ₪109.50.
        assert detail["cheapest_price"] == 90, detail.get("cheapest_price")

        rows = requests.get(f"{BASE}/marketplace/gigs", params={"sort": "price_asc", "limit": 200}, timeout=30).json()
        order = [g["id"] for g in rows if g["id"] in (mixed, plain)]
        assert order == [mixed, plain], order
        by_id = {g["id"]: g for g in rows}
        assert by_id[mixed]["cheapest_price"] == 90
        assert by_id[plain]["cheapest_price"] == 100
    finally:
        for gid in (mixed, plain):
            requests.delete(f"{BASE}/marketplace/gigs/{gid}", headers=_auth(owner), timeout=30)


def test_a_dollar_only_listing_is_compared_in_shekels(owner):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    dollars = _gig(owner, [{"name": "USD", "price": 30, "currency": "USD"}], f"TEST_pricesort_usd_{stamp}")
    shekels = _gig(owner, [{"name": "ILS", "price": 100, "currency": "ILS"}], f"TEST_pricesort_ils_{stamp}")
    try:
        rows = requests.get(f"{BASE}/marketplace/gigs", params={"sort": "price_asc", "limit": 200}, timeout=30).json()
        by_id = {g["id"]: g for g in rows}
        assert abs(by_id[dollars]["cheapest_price"] - 30 * USD_TO_ILS) < 0.01
        order = [g["id"] for g in rows if g["id"] in (dollars, shekels)]
        # ₪100 comes before $30 (₪109.50)
        assert order == [shekels, dollars], order
    finally:
        for gid in (dollars, shekels):
            requests.delete(f"{BASE}/marketplace/gigs/{gid}", headers=_auth(owner), timeout=30)
