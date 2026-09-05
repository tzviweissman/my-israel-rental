"""Pausing a listing, and the line between the provider's choice and an
admin's decision.

`status` has been on the model since the marketplace was built with three
values in a comment, no validation, and nothing that set it (dead-ends
audit 2026-09-03, #11). Three things have to hold now:

  * a provider can pause and resume their own listing, and a paused one
    is gone from browse AND from its own URL - a link that still books is
    exactly what "I am away" has to stop;
  * `unpublished` is an admin's moderation decision and the provider
    cannot PATCH their way out of it. Before the pattern was added, any
    string was accepted, so `{"status": "published"}` undid a takedown;
  * a rubbish status is refused rather than stored, because a typo took a
    listing off every surface with no way back through the UI.

Runs against the live local API (see backend/tests/.env.test).
"""
import os
from datetime import UTC, datetime

import pytest
import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")
ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "admin@rental.com")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "Admin1234!")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _account(tag):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"pause-{tag}-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": f"Pause {tag}", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def owner():
    return _account("owner")


def _gig(token):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/marketplace/gigs", json={
        "title": f"TEST_pause_{stamp}", "description": "pause test listing",
        "category": "home-services-repair", "area": "Tel Aviv", "gig_type": "deliverable",
        "budget_currency": "ILS", "booking_mode": "in_platform",
        "whatsapp": "+972501234567", "gallery": ["https://example.com/photo.jpg"],
        "tiers": [{"name": "Basic", "price": 200, "currency": "ILS"}],
    }, headers=_auth(token), timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _in_browse(gig_id):
    rows = requests.get(f"{BASE}/marketplace/gigs", params={"limit": 200}, timeout=30).json()
    return gig_id in [g["id"] for g in rows]


def test_pause_takes_it_off_the_site_and_resume_puts_it_back(owner):
    gig_id = _gig(owner)
    try:
        assert _in_browse(gig_id), "a new listing is live"
        assert requests.get(f"{BASE}/marketplace/gigs/{gig_id}", timeout=30).status_code == 200

        r = requests.patch(f"{BASE}/marketplace/gigs/{gig_id}", json={"status": "paused"},
                           headers=_auth(owner), timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "paused"

        assert not _in_browse(gig_id), "a paused listing is off browse"
        # ...and off its own URL, which the detail route did not check.
        assert requests.get(f"{BASE}/marketplace/gigs/{gig_id}", timeout=30).status_code == 404
        # ...but its owner still reaches it, to preview and to turn it back on.
        mine = requests.get(f"{BASE}/marketplace/gigs/{gig_id}", headers=_auth(owner), timeout=30)
        assert mine.status_code == 200 and mine.json()["status"] == "paused"

        r = requests.patch(f"{BASE}/marketplace/gigs/{gig_id}", json={"status": "published"},
                           headers=_auth(owner), timeout=30)
        assert r.status_code == 200, r.text
        assert _in_browse(gig_id)
        assert requests.get(f"{BASE}/marketplace/gigs/{gig_id}", timeout=30).status_code == 200
    finally:
        requests.delete(f"{BASE}/marketplace/gigs/{gig_id}", headers=_auth(owner), timeout=30)


def test_a_paused_listing_takes_no_bookings(owner):
    gig_id = _gig(owner)
    buyer = _account("buyer")
    try:
        requests.patch(f"{BASE}/marketplace/gigs/{gig_id}", json={"status": "paused"},
                       headers=_auth(owner), timeout=30)
        r = requests.post(f"{BASE}/marketplace/gigs/{gig_id}/book", json={
            "tier_name": "Basic", "message": "while you are away",
            "contact_email": "buyer@example.com",
        }, headers=_auth(buyer), timeout=30)
        assert r.status_code == 400, r.text
        assert "not taking bookings" in r.text
    finally:
        requests.delete(f"{BASE}/marketplace/gigs/{gig_id}", headers=_auth(owner), timeout=30)


def _admin_token():
    r = requests.post(f"{BASE}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    if r.status_code != 200:
        pytest.skip("no local admin account (backend/tests/.env.test)")
    return r.json()["token"]


def test_a_provider_cannot_undo_a_takedown(owner):
    """The hole the missing validation left open.

    Two locks, because either alone is thin: the provider cannot NAME
    `unpublished` (the pattern), and cannot change the status of a listing
    that is already in it (the check in patch_gig). The second is the one
    that matters - without it, "paused" then "published" would walk a
    moderated listing back onto the site in two hops.
    """
    admin = _admin_token()
    gig_id = _gig(owner)
    try:
        r = requests.patch(f"{BASE}/admin/gigs/{gig_id}/status", json={"status": "unpublished"},
                           headers=_auth(admin), timeout=30)
        assert r.status_code == 200, r.text
        assert not _in_browse(gig_id)
        assert requests.get(f"{BASE}/marketplace/gigs/{gig_id}", timeout=30).status_code == 404

        # The provider cannot name that state...
        r = requests.patch(f"{BASE}/marketplace/gigs/{gig_id}", json={"status": "unpublished"},
                           headers=_auth(owner), timeout=30)
        assert r.status_code == 422, r.text
        # ...nor publish their way out of it, nor pause their way out of it.
        for attempt in ("published", "paused"):
            r = requests.patch(f"{BASE}/marketplace/gigs/{gig_id}", json={"status": attempt},
                               headers=_auth(owner), timeout=30)
            assert r.status_code == 403, f"{attempt!r}: {r.text}"
        assert not _in_browse(gig_id), "and it stayed down"

        # Everything else about their own listing is still theirs to edit.
        r = requests.patch(f"{BASE}/marketplace/gigs/{gig_id}", json={"description": "still editable"},
                           headers=_auth(owner), timeout=30)
        assert r.status_code == 200, r.text

        # The admin can put it back.
        r = requests.patch(f"{BASE}/admin/gigs/{gig_id}/status", json={"status": "published"},
                           headers=_auth(admin), timeout=30)
        assert r.status_code == 200, r.text
        assert _in_browse(gig_id)
    finally:
        requests.delete(f"{BASE}/marketplace/gigs/{gig_id}", headers=_auth(owner), timeout=30)


def test_a_rubbish_status_is_refused(owner):
    gig_id = _gig(owner)
    try:
        for bad in ("pblished", "", "deleted", "PAUSED"):
            r = requests.patch(f"{BASE}/marketplace/gigs/{gig_id}", json={"status": bad},
                               headers=_auth(owner), timeout=30)
            assert r.status_code == 422, f"{bad!r} was accepted: {r.text}"
        assert requests.get(f"{BASE}/marketplace/gigs/{gig_id}", timeout=30).json()["status"] == "published"
    finally:
        requests.delete(f"{BASE}/marketplace/gigs/{gig_id}", headers=_auth(owner), timeout=30)


def test_someone_elses_listing_cannot_be_paused(owner):
    gig_id = _gig(owner)
    other = _account("other")
    try:
        r = requests.patch(f"{BASE}/marketplace/gigs/{gig_id}", json={"status": "paused"},
                           headers=_auth(other), timeout=30)
        assert r.status_code == 403, r.text
        assert _in_browse(gig_id), "and it is still live"
    finally:
        requests.delete(f"{BASE}/marketplace/gigs/{gig_id}", headers=_auth(owner), timeout=30)
