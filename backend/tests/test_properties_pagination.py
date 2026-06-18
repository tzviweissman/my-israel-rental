"""Regression test: GET /properties supports page/limit query params for
infinite-scroll. Backwards compatible — omitting the params returns the
full result set (existing callers like Home, Dashboard, admin tooling
keep working).
"""
import os
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


def test_no_params_returns_all_properties():
    """Default behavior: no `limit` query param → return everything."""
    if not BASE_URL:
        return  # CI without backend reachable — skip silently
    r = requests.get(f"{BASE_URL}/api/properties")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_page_limit_slice():
    """`page=1&limit=N` returns first N results; `page=2&limit=N` returns
    the next slice with no overlap."""
    if not BASE_URL:
        return
    full = requests.get(f"{BASE_URL}/api/properties").json()
    if len(full) < 4:
        return  # not enough data — skip
    p1 = requests.get(f"{BASE_URL}/api/properties?page=1&limit=2").json()
    p2 = requests.get(f"{BASE_URL}/api/properties?page=2&limit=2").json()
    assert len(p1) == 2
    assert len(p2) >= 1
    p1_ids = {p["id"] for p in p1}
    p2_ids = {p["id"] for p in p2}
    assert not (p1_ids & p2_ids), "Page 1 and page 2 must not overlap"


def test_limit_only_in_list_response_cover_image():
    """List endpoint trims `images` to the cover (cards only render one)."""
    if not BASE_URL:
        return
    r = requests.get(f"{BASE_URL}/api/properties?page=1&limit=5")
    assert r.status_code == 200
    for prop in r.json():
        imgs = prop.get("images") or []
        assert len(imgs) <= 1, f"List endpoint must ship at most 1 image; got {len(imgs)}"


def test_past_last_page_returns_empty():
    """Asking for a page well past the catalog size returns []."""
    if not BASE_URL:
        return
    r = requests.get(f"{BASE_URL}/api/properties?page=9999&limit=10")
    assert r.status_code == 200
    assert r.json() == []
