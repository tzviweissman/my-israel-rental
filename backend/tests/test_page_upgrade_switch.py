"""The paid page upgrade switch (utils/page_upgrade, 23 Sep 2026).

Off by default. An admin switches it on for a person; their business,
service and property payloads then all say page_upgrade: true, and false
again when it is switched off. Nobody but an admin can switch it.
Needs the local API and Mongo (backend/tests/.env.test).
"""
from __future__ import annotations

import os
import uuid
from datetime import UTC, datetime
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

from pymongo import MongoClient  # noqa: E402

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")


def _login(email, password):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_switch_reaches_all_three_pages_and_only_admins_can_flip_it():
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    admin = _login(os.environ["TEST_ADMIN_EMAIL"], os.environ["TEST_ADMIN_PASSWORD"])
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={"email": f"pu-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
                                                    "name": "Page Upgrade", "role": "owner"}, timeout=30)
    owner_h, uid = {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["user"]["id"]
    biz = requests.post(f"{BASE}/marketplace/businesses", json={"name": f"TEST_pu {stamp}"}, headers=owner_h, timeout=30).json()
    gig = requests.post(f"{BASE}/marketplace/gigs", json={
        "title": "TEST_pu service", "description": "Test.", "category": "home-services-repair", "area": "Jerusalem",
        "gig_type": "deliverable", "booking_mode": "in_platform", "business_id": biz["id"],
        "gallery": ["https://example.com/a.jpg"], "tiers": [{"name": "Basic", "price": 100, "currency": "ILS"}]},
        headers=owner_h, timeout=30).json()
    pid = f"TEST_pu_{uuid.uuid4().hex[:8]}"
    db.properties.insert_one({"id": pid, "owner_id": uid, "title": "TEST_pu flat", "area": "Jerusalem",
                              "rental_type": "long-term", "property_type": "apartment", "status": "active", "monthly_price": 5000})

    def flags():
        return (
            requests.get(f"{BASE}/marketplace/business/{biz['id']}", timeout=30).json()["page_upgrade"],
            requests.get(f"{BASE}/marketplace/gigs/{gig['id']}", timeout=30).json()["page_upgrade"],
            requests.get(f"{BASE}/properties/{pid}", timeout=30).json()["page_upgrade"],
        )

    try:
        assert flags() == (False, False, False), "off by default"
        url = f"{BASE}/admin/users/{uid}/page-upgrade"
        assert requests.put(url, json={"on": True}, headers=owner_h, timeout=30).status_code == 403, "an owner cannot upgrade themselves"
        assert requests.put(url, json={"on": True}, headers=admin, timeout=30).status_code == 200
        assert flags() == (True, True, True)
        assert requests.put(url, json={"on": False}, headers=admin, timeout=30).status_code == 200
        assert flags() == (False, False, False), "switched off returns every page to standard"
    finally:
        db.properties.delete_one({"id": pid})
        db.marketplace_gigs.delete_one({"_id": gig["id"]})
        db.businesses.delete_one({"_id": biz["id"]})
