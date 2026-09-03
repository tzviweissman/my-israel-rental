"""The owner's scan rollup behind the dashboard's Overview.

`GET /short-links/mine` returns every link the caller minted with its scan
count, a total, and one summed daily series. The things that matter:

  * it is scoped - another owner's links never appear;
  * scans are counted where they are counted everywhere else (on follow);
  * the daily series sums across links and is zero-filled, so the front
    page can draw one chart;
  * it is declared before `/short-links/{slug}`, or "mine" would be read
    as a slug and 404 for everyone.

Runs against the live local API (see backend/tests/.env.test).
"""
import os
from datetime import UTC, datetime

import pytest
import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _owner(tag):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"links-{tag}-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": f"Links {tag}", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


def _property(token):
    r = requests.post(f"{BASE}/properties", json={
        "title": f"TEST_links_{datetime.now(UTC).strftime('%H%M%S%f')}", "rental_type": "long-term",
        "property_type": "apartment", "area": "Tel Aviv", "bedrooms": 1,
        "monthly_price": 4000, "currency": "ILS", "images": ["https://example.com/p.jpg"],
    }, headers=_auth(token), timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _link(token, prop_id):
    r = requests.post(f"{BASE}/short-links", json={"target_type": "property", "target_id": prop_id},
                      headers=_auth(token), timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["slug"]


def test_mine_is_not_read_as_a_slug():
    token = _owner("route")
    r = requests.get(f"{BASE}/short-links/mine", headers=_auth(token), timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["links"] == [] and body["total_scans"] == 0
    assert len(body["daily"]) == 30 and all(d["count"] == 0 for d in body["daily"])


def test_rollup_sums_scans_across_links_and_is_scoped():
    me, other = _owner("me"), _owner("other")
    p1, p2 = _property(me), _property(me)
    s1, s2 = _link(me, p1), _link(me, p2)
    theirs = _link(other, _property(other))
    try:
        for slug, n in ((s1, 3), (s2, 2), (theirs, 5)):
            for _ in range(n):
                assert requests.get(f"{BASE}/short-links/{slug}/resolve", timeout=30).status_code == 200

        mine = requests.get(f"{BASE}/short-links/mine", headers=_auth(me), timeout=30).json()
        assert {l["slug"] for l in mine["links"]} == {s1, s2}, "another owner's link leaked in"
        assert mine["total_scans"] == 5
        assert sum(d["count"] for d in mine["daily"]) == 5, "the summed series disagrees with the total"
        # biggest first, the order a shelf is read in
        assert [l["scan_count"] for l in mine["links"]] == [3, 2]

        theirs_view = requests.get(f"{BASE}/short-links/mine", headers=_auth(other), timeout=30).json()
        assert theirs_view["total_scans"] == 5 and len(theirs_view["links"]) == 1
    finally:
        for tok, pid in ((me, p1), (me, p2)):
            requests.delete(f"{BASE}/properties/{pid}", headers=_auth(tok), timeout=30)


def test_requires_a_signed_in_owner():
    r = requests.get(f"{BASE}/short-links/mine", timeout=30)
    assert r.status_code in (401, 403)
