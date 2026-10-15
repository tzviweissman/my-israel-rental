"""A business's own colour and fonts (businesses.py BusinessPatch
brand_color / brand_fonts): stored, served on the page, cleared, and
refused when not a colour or not one of the offered fonts.

Runs against the live local API (see backend/tests/.env.test).
"""
import os
from datetime import UTC, datetime

import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_brand_colour_and_fonts():
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    owner = requests.post(f"{BASE}/auth/register", json={
        "email": f"brand-{stamp}@example.com", "password": f"Pw-{stamp}-ok1", "name": "Brand owner", "role": "owner"}, timeout=30).json()["token"]
    biz = requests.post(f"{BASE}/marketplace/businesses", json={"name": f"TEST_brand {stamp}"}, headers=_auth(owner), timeout=30).json()
    url = f"{BASE}/marketplace/businesses/{biz['id']}"
    page = f"{BASE}/marketplace/business/{biz['slug']}"

    r = requests.patch(url, json={"brand_color": "#e85d75", "brand_fonts": {"heading": "suez-one", "body": "assistant"}}, headers=_auth(owner), timeout=30)
    assert r.status_code == 200, r.text
    p = requests.get(page, headers=_auth(owner), timeout=30).json()
    assert p["brand_color"] == "#E85D75" and p["brand_fonts"] == {"heading": "suez-one", "body": "assistant"}

    assert requests.patch(url, json={"brand_color": "red"}, headers=_auth(owner), timeout=30).status_code == 422
    assert requests.patch(url, json={"brand_fonts": {"heading": "comic-sans"}}, headers=_auth(owner), timeout=30).status_code == 422

    requests.patch(url, json={"brand_color": "", "brand_fonts": {"heading": None, "body": None}}, headers=_auth(owner), timeout=30)
    p = requests.get(page, headers=_auth(owner), timeout=30).json()
    assert p["brand_color"] is None and p["brand_fonts"] == {"heading": None, "body": None}
