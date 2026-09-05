"""What a business page leads with, and how it is grouped.

`pinned_service_ids` and `collections` have been on the business document
since the page was built, and the public page renders both. Neither had an
editor, so outside the demo seed no business ever had either (dead-ends
audit 2026-09-03, #10). The editor exists now; these pin the round trip it
depends on:

  * both fields save and come back on the page payload;
  * the featured cap is the MODEL's, not the form's - a second client
    cannot feature ten services;
  * a group whose services were later deleted does not break the page,
    because ids are not validated against a list that changes underneath.

Runs against the live local API (see backend/tests/.env.test).
"""
import os
from datetime import UTC, datetime

import pytest
import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def owner():
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"shelf-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": "Shelf Owner", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def business(owner):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/marketplace/businesses", json={"name": f"TEST shelf {stamp}"},
                      headers=_auth(owner), timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _gig(token, business_id, title):
    r = requests.post(f"{BASE}/marketplace/gigs", json={
        "title": title, "description": "shelf test listing", "category": "home-services-repair",
        "area": "Tel Aviv", "gig_type": "deliverable", "budget_currency": "ILS",
        "booking_mode": "whatsapp", "whatsapp": "+972501234567",
        "gallery": ["https://example.com/photo.jpg"],
        "tiers": [{"name": "Basic", "price": 200, "currency": "ILS"}],
        "business_id": business_id,
    }, headers=_auth(token), timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _page(business_id, token=None):
    # The public page, by slug or id. The owner's token is what makes a
    # page with nothing published still serve to them.
    r = requests.get(f"{BASE}/marketplace/business/{business_id}",
                     headers=_auth(token) if token else None, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def test_featured_and_groups_save_and_come_back(owner, business):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    a = _gig(owner, business, f"TEST_shelf_a_{stamp}")
    b = _gig(owner, business, f"TEST_shelf_b_{stamp}")
    try:
        r = requests.patch(f"{BASE}/marketplace/businesses/{business}", json={
            "pinned_service_ids": [b, a],
            "collections": [
                {"id": "c1", "name": "Shabbos", "description": "For the week", "service_ids": [a]},
                {"id": "c2", "name": "Packages", "service_ids": [a, b]},
            ],
        }, headers=_auth(owner), timeout=30)
        assert r.status_code == 200, r.text

        page = _page(business, owner)
        assert page["pinned_service_ids"] == [b, a], "order is the owner's, not the list's"
        names = [c["name"] for c in page["collections"]]
        assert names == ["Shabbos", "Packages"], names
        # A service may belong to more than one group.
        assert [c for c in page["collections"] if c["name"] == "Packages"][0]["service_ids"] == [a, b]
    finally:
        for gid in (a, b):
            requests.delete(f"{BASE}/marketplace/gigs/{gid}", headers=_auth(owner), timeout=30)


def test_the_featured_cap_is_the_models(owner, business):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    ids = [_gig(owner, business, f"TEST_shelf_cap{i}_{stamp}") for i in range(4)]
    try:
        r = requests.patch(f"{BASE}/marketplace/businesses/{business}",
                           json={"pinned_service_ids": ids}, headers=_auth(owner), timeout=30)
        # Either refused outright or truncated - never four on the page.
        assert r.status_code in (200, 422), r.text
        if r.status_code == 200:
            assert len(_page(business, owner)["pinned_service_ids"]) <= 3
    finally:
        for gid in ids:
            requests.delete(f"{BASE}/marketplace/gigs/{gid}", headers=_auth(owner), timeout=30)


def test_a_deleted_service_does_not_break_the_page(owner, business):
    """Stale ids are skipped, not fatal - the reason ids are not validated."""
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    keep = _gig(owner, business, f"TEST_shelf_keep_{stamp}")
    doomed = _gig(owner, business, f"TEST_shelf_gone_{stamp}")
    try:
        requests.patch(f"{BASE}/marketplace/businesses/{business}", json={
            "pinned_service_ids": [doomed, keep],
            "collections": [{"id": "c1", "name": "Both", "service_ids": [keep, doomed]}],
        }, headers=_auth(owner), timeout=30)
        requests.delete(f"{BASE}/marketplace/gigs/{doomed}", headers=_auth(owner), timeout=30)

        page = _page(business, owner)
        listed = [g["id"] for g in page.get("listings", [])]
        assert keep in listed and doomed not in listed
        # The stored ids may still name it; what matters is the page serves.
        assert page["collections"][0]["name"] == "Both"
    finally:
        requests.delete(f"{BASE}/marketplace/gigs/{keep}", headers=_auth(owner), timeout=30)


def test_someone_else_cannot_arrange_your_page(owner, business):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"shelf-other-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": "Other", "role": "owner",
    }, timeout=30)
    other = r.json()["token"]
    r = requests.patch(f"{BASE}/marketplace/businesses/{business}",
                       json={"pinned_service_ids": []}, headers=_auth(other), timeout=30)
    assert r.status_code in (403, 404), r.text
