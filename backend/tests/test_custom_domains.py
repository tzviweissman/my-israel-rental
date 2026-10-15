"""A business's own domain (custom_domains.py): owner-only, checked and
normalised, one business per domain, resolvable by host for
frontend/server.js, removable. No Railway token locally, so a new domain
waits as "setting_up" (the admins are told), and the live check fails.

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
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"{tag}-{stamp}@example.com", "password": f"Pw-{stamp}-ok1", "name": f"{tag} owner", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


def test_own_domain_lifecycle():
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    owner = _owner("domain")
    biz = requests.post(f"{BASE}/marketplace/businesses", json={"name": f"TEST_domain shop {stamp}"}, headers=_auth(owner), timeout=30).json()
    url = f"{BASE}/marketplace/businesses/{biz['id']}/custom-domain"
    domain = f"www.test-{stamp}.co.il"

    assert requests.get(url, headers=_auth(owner), timeout=30).json()["domain"] is None
    for bad in ("not a domain", "shop.myisraelrental.com", "x.up.railway.app"):
        assert requests.put(url, json={"domain": bad}, headers=_auth(owner), timeout=30).status_code == 422, bad
    stranger = _owner("domain-stranger")
    assert requests.put(url, json={"domain": domain}, headers=_auth(stranger), timeout=30).status_code == 403

    r = requests.put(url, json={"domain": f"https://{domain.upper()}/"}, headers=_auth(owner), timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["domain"] == domain and r.json()["status"] == "setting_up"

    res = requests.get(f"{BASE}/marketplace/domains/{domain}", timeout=30)
    assert res.status_code == 200 and res.json()["slug"] == biz["slug"]
    assert requests.get(f"{BASE}/marketplace/domains/www.nobody-{stamp}.com", timeout=30).status_code == 404

    other = requests.post(f"{BASE}/marketplace/businesses", json={"name": f"TEST_domain other {stamp}"}, headers=_auth(stranger), timeout=30).json()
    taken = requests.put(f"{BASE}/marketplace/businesses/{other['id']}/custom-domain", json={"domain": domain}, headers=_auth(stranger), timeout=30)
    assert taken.status_code == 409

    chk = requests.post(f"{url}/check", headers=_auth(owner), timeout=30).json()
    assert chk["status"] == "setting_up" and chk["checked_at"]

    assert requests.delete(url, headers=_auth(owner), timeout=30).status_code == 200
    assert requests.get(f"{BASE}/marketplace/domains/{domain}", timeout=30).status_code == 404
