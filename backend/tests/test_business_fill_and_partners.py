"""Two things a business owner should not have to do twice or hunt for.

  * The first listing's description and city fill an empty business, so
    the page checklist does not ask for them again.
  * Find partners lists other businesses, filtered by kind, never your own.

Needs the local API and Mongo (backend/tests/.env.test).
"""
from __future__ import annotations

import os
import uuid
from datetime import UTC, datetime

import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")


def _owner(tag):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"fill-{tag}-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": f"Fill {tag}", "role": "owner"}, timeout=30)
    assert r.status_code in (200, 201), r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _business_with_gig(h, category):
    biz = requests.post(f"{BASE}/marketplace/businesses", json={"name": f"TEST_fill {uuid.uuid4().hex[:6]}"},
                        headers=h, timeout=30).json()
    r = requests.post(f"{BASE}/marketplace/gigs", json={
        "title": "TEST_fill gig", "description": "We deliver across Tel Aviv, same day.", "category": category,
        "area": "Tel Aviv, Florentin", "gig_type": "deliverable", "booking_mode": "in_platform",
        "gallery": ["https://example.com/p.jpg"], "business_id": biz["id"],
        "tiers": [{"name": "Basic", "price": 50, "currency": "ILS"}]}, headers=h, timeout=30)
    assert r.status_code in (200, 201), r.text
    return biz


def test_first_listing_fills_the_business_and_partners_are_findable():
    a, b = _owner("a"), _owner("b")
    mine = _business_with_gig(a, "home-services-repair")
    theirs = _business_with_gig(b, "transportation")

    got = next(x for x in requests.get(f"{BASE}/marketplace/businesses", headers=a, timeout=30).json() if x["id"] == mine["id"])
    assert got["description"] == "We deliver across Tel Aviv, same day."
    assert got["areas"] == ["tel-aviv"]

    url = f"{BASE}/marketplace/businesses/{mine['id']}/partner-search"
    res = requests.get(url, params={"category": "transportation", "q": theirs["name"]}, headers=a, timeout=30).json()
    assert [r["id"] for r in res["results"]] == [theirs["id"]]
    assert res["results"][0]["status"] == "none"
    assert any(c["slug"] == "transportation" for c in res["categories"])

    other_kind = requests.get(url, params={"category": "pet-services", "q": theirs["name"]}, headers=a, timeout=30).json()
    assert other_kind["results"] == []
    own = requests.get(url, params={"q": mine["name"]}, headers=a, timeout=30).json()
    assert own["results"] == [], "never your own business"
    assert requests.get(url, headers=b, timeout=30).status_code in (403, 404), "only as a business you own"
