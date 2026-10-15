"""Draft and publish for Design your page (businesses.py page-draft):
a draft is checked like a real save, kept owner-only, never touches the
live page, and goes when deleted.

Runs against the live local API (see backend/tests/.env.test).
"""
import os
from datetime import UTC, datetime

import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _owner(tag):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    return requests.post(f"{BASE}/auth/register", json={
        "email": f"{tag}-{stamp}@example.com", "password": f"Pw-{stamp}-ok1", "name": f"{tag} owner", "role": "owner"}, timeout=30).json()["token"]


def test_draft_is_separate_from_the_live_page():
    owner = _owner("draft")
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    biz = requests.post(f"{BASE}/marketplace/businesses", json={"name": f"TEST_draft {stamp}"}, headers=_auth(owner), timeout=30).json()
    url = f"{BASE}/marketplace/businesses/{biz['id']}"
    live = lambda: requests.get(f"{BASE}/marketplace/business/{biz['slug']}", headers=_auth(owner), timeout=30).json()

    assert requests.get(f"{url}/page-draft", headers=_auth(owner), timeout=30).json() is None
    body = {"brand_color": "#123456", "notice": {"text": "Opening soon"}}
    r = requests.put(f"{url}/page-draft", json=body, headers=_auth(owner), timeout=30)
    assert r.status_code == 200, r.text
    d = requests.get(f"{url}/page-draft", headers=_auth(owner), timeout=30).json()
    assert d["payload"]["brand_color"] == "#123456" and d["saved_at"]
    page = live()
    assert page["brand_color"] is None and page["notice"] is None and "page_draft" not in page

    assert requests.put(f"{url}/page-draft", json={"name": "Renamed"}, headers=_auth(owner), timeout=30).status_code == 422
    assert requests.put(f"{url}/page-draft", json={"brand_fonts": {"heading": "nope"}}, headers=_auth(owner), timeout=30).status_code == 422
    stranger = _owner("draft-stranger")
    assert requests.get(f"{url}/page-draft", headers=_auth(stranger), timeout=30).status_code in (403, 404)

    # Publishing is the normal save, then the draft goes.
    assert requests.patch(url, json=body, headers=_auth(owner), timeout=30).status_code == 200
    assert requests.delete(f"{url}/page-draft", headers=_auth(owner), timeout=30).status_code == 200
    assert live()["brand_color"] == "#123456"
    assert requests.get(f"{url}/page-draft", headers=_auth(owner), timeout=30).json() is None


def test_draft_preview_link():
    """The link from Save draft shows the draft to whoever holds it, keeps
    working through later saves, and ends with the draft."""
    owner = _owner("draftlink")
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    biz = requests.post(f"{BASE}/marketplace/businesses", json={"name": f"TEST_draftlink {stamp}"}, headers=_auth(owner), timeout=30).json()
    url = f"{BASE}/marketplace/businesses/{biz['id']}"
    # A page the public can see: one published listing.
    requests.post(f"{BASE}/marketplace/gigs", json={
        "title": "TEST_draftlink shop", "description": "for the preview", "category": "shops-products", "area": "Jerusalem",
        "gig_type": "store", "budget_currency": "ILS", "booking_mode": "whatsapp", "whatsapp": "+972501234567", "gallery": [],
        "products": [{"name": "Cake", "price": 100, "currency": "ILS", "images": ["https://example.com/c.jpg"]}],
    }, headers=_auth(owner), timeout=30)
    page = f"{BASE}/marketplace/business/{biz['slug']}"

    d1 = requests.put(f"{url}/page-draft", json={"notice": {"text": "Draft notice"}}, headers=_auth(owner), timeout=30).json()
    token = d1["preview_token"]
    seen = requests.get(page, params={"draft": token}, timeout=30)
    assert seen.status_code == 200 and seen.json()["notice"]["text"] == "Draft notice" and seen.json()["draft_preview"] is True
    assert "noindex" in seen.headers.get("X-Robots-Tag", "")
    public = requests.get(page, timeout=30).json()
    assert public["notice"] is None and "draft_preview" not in public
    assert "draft_preview" not in requests.get(page, params={"draft": "wrong-token-123"}, timeout=30).json()

    d2 = requests.put(f"{url}/page-draft", json={"notice": {"text": "Second"}}, headers=_auth(owner), timeout=30).json()
    assert d2["preview_token"] == token
    assert requests.get(page, params={"draft": token}, timeout=30).json()["notice"]["text"] == "Second"

    requests.delete(f"{url}/page-draft", headers=_auth(owner), timeout=30)
    assert "draft_preview" not in requests.get(page, params={"draft": token}, timeout=30).json()
