"""A business can put an offer on its own listing, and take it down.

Covers the rules that are easy to get wrong and invisible when they are:

  * an offer only reaches the public through `active_discount`, so one
    that has finished is gone from every read on the day after it ends;
  * sending `discount: null` REMOVES it — the patch handler drops None
    values wholesale, so without the fields-set branch a business could
    put an offer up and never take it down;
  * the shelf at /marketplace/deals holds exactly the listings with a
    live offer, biggest saving first;
  * only the owner can set one.

Runs against the live local API (see backend/tests/.env.test).
"""
import os
from datetime import UTC, date, datetime, timedelta

import pytest
import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")

# Israel's date, the one active_discount uses: with UTC here, the "ends
# today" test fails every evening between 21:00 UTC and midnight.
from zoneinfo import ZoneInfo
TODAY = datetime.now(ZoneInfo("Asia/Jerusalem")).date()
YESTERDAY = (TODAY - timedelta(days=1)).isoformat()
NEXT_WEEK = (TODAY + timedelta(days=7)).isoformat()


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def owner():
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    body = {
        "email": f"discount-{stamp}@example.com",
        "password": f"Pw-{stamp}-ok1",
        "name": "Discount Test",
        "role": "owner",
    }
    r = requests.post(f"{BASE}/auth/register", json=body, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


def _make_gig(token, **extra):
    body = {
        "title": f"TEST_discount_{datetime.now(UTC).strftime('%H%M%S%f')}",
        "description": "discount test listing",
        "category": "home-services-repair",
        "area": "Tel Aviv",
        "gig_type": "deliverable",
        "budget_currency": "ILS",
        "booking_mode": "whatsapp",
        "whatsapp": "+972501234567",
        "gallery": ["https://example.com/photo.jpg"],
        "tiers": [{"name": "Basic", "price": 200, "currency": "ILS"}],
        **extra,
    }
    r = requests.post(f"{BASE}/marketplace/gigs", json=body, headers=_auth(token), timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _get(gig_id):
    r = requests.get(f"{BASE}/marketplace/gigs/{gig_id}", timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def _cleanup(token, gig_id):
    requests.delete(f"{BASE}/marketplace/gigs/{gig_id}", headers=_auth(token), timeout=30)


def test_offer_set_at_create_is_public(owner):
    gig_id = _make_gig(owner, discount={"percent": 20, "label": "First job"})
    try:
        disc = _get(gig_id)["discount"]
        assert disc["percent"] == 20
        assert disc["label"] == "First job"
    finally:
        _cleanup(owner, gig_id)


def test_offer_added_by_patch_and_then_removed(owner):
    gig_id = _make_gig(owner)
    try:
        assert _get(gig_id)["discount"] is None

        r = requests.patch(
            f"{BASE}/marketplace/gigs/{gig_id}",
            json={"discount": {"percent": 15, "label": "New customers", "ends_at": NEXT_WEEK}},
            headers=_auth(owner), timeout=30,
        )
        assert r.status_code == 200, r.text
        assert _get(gig_id)["discount"]["percent"] == 15

        # The whole point of reading model_fields_set: null means remove.
        r = requests.patch(
            f"{BASE}/marketplace/gigs/{gig_id}", json={"discount": None},
            headers=_auth(owner), timeout=30,
        )
        assert r.status_code == 200, r.text
        assert _get(gig_id)["discount"] is None
    finally:
        _cleanup(owner, gig_id)


def test_finished_offer_is_never_served(owner):
    gig_id = _make_gig(owner, discount={"percent": 30, "ends_at": YESTERDAY})
    try:
        assert _get(gig_id)["discount"] is None
        rows = requests.get(f"{BASE}/marketplace/gigs", params={"limit": 200}, timeout=30).json()
        mine = [g for g in rows if g["id"] == gig_id]
        if mine:
            assert mine[0].get("discount") is None
        deals = requests.get(f"{BASE}/marketplace/deals", timeout=30).json()
        assert gig_id not in [d["id"] for d in deals]
    finally:
        _cleanup(owner, gig_id)


def test_offer_ending_today_still_runs(owner):
    """An offer "until the 9th" is on all day on the 9th, not until its eve."""
    gig_id = _make_gig(owner, discount={"percent": 10, "ends_at": TODAY.isoformat()})
    try:
        assert _get(gig_id)["discount"]["percent"] == 10
    finally:
        _cleanup(owner, gig_id)


def test_deals_shelf_lists_live_offers_biggest_first(owner):
    small = _make_gig(owner, discount={"percent": 10})
    big = _make_gig(owner, discount={"percent": 45})
    plain = _make_gig(owner)
    try:
        deals = requests.get(f"{BASE}/marketplace/deals", timeout=30).json()
        ids = [d["id"] for d in deals]
        assert big in ids and small in ids
        assert plain not in ids
        assert ids.index(big) < ids.index(small)
        row = next(d for d in deals if d["id"] == big)
        assert row["discount"]["percent"] == 45
        assert "title" in row and "gallery" in row
    finally:
        for gid in (small, big, plain):
            _cleanup(owner, gid)


def test_percent_is_bounded(owner):
    for bad in (0, 4, 91, 300):
        r = requests.post(
            f"{BASE}/marketplace/gigs",
            json={
                "title": "TEST_discount_bad", "description": "x",
                "category": "home-services-repair", "area": "Tel Aviv",
                "booking_mode": "whatsapp", "whatsapp": "+972501234567",
                "gallery": ["https://example.com/p.jpg"],
                "discount": {"percent": bad},
            },
            headers=_auth(owner), timeout=30,
        )
        assert r.status_code == 422, f"percent {bad} was accepted: {r.text}"


def test_someone_elses_listing_cannot_be_discounted(owner):
    gig_id = _make_gig(owner)
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    other = requests.post(
        f"{BASE}/auth/register",
        json={"email": f"nosy-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
              "name": "Nosy", "role": "owner"},
        timeout=30,
    ).json()["token"]
    try:
        r = requests.patch(
            f"{BASE}/marketplace/gigs/{gig_id}", json={"discount": {"percent": 50}},
            headers=_auth(other), timeout=30,
        )
        assert r.status_code == 403, r.text
        assert _get(gig_id)["discount"] is None
    finally:
        _cleanup(owner, gig_id)


def test_prices_are_not_restated_by_the_discount(owner):
    """The site shows the offer, never a price the business did not write.

    Bookings here are a conversation, and payment happens between the two
    people — so a tier silently rewritten to 0.8x would be a promise the
    business never made and nothing downstream would honour.
    """
    gig_id = _make_gig(owner, discount={"percent": 25})
    try:
        gig = _get(gig_id)
        assert gig["tiers"][0]["price"] == 200
    finally:
        _cleanup(owner, gig_id)
