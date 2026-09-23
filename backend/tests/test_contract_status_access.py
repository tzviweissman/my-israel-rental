"""GET /properties/{id}/contract says whether a lease exists and when. Only
the owner, a renter with a booking on the property, or an admin may ask.
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


def _account(tag):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"cst-{tag}-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": f"Cst {tag}", "role": "owner"}, timeout=30)
    assert r.status_code in (200, 201), r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["user"]["id"]


def test_only_parties_see_contract_status():
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    owner_h, owner_id = _account("owner")
    renter_h, renter_id = _account("renter")
    stranger_h, _ = _account("stranger")
    pid = f"TEST_cst_{uuid.uuid4().hex[:8]}"
    db.properties.insert_one({"id": pid, "owner_id": owner_id, "title": "TEST_cst", "status": "active",
                              "contract_url": "/api/uploads/x.pdf", "contract_uploaded_at": "2026-09-01T00:00:00+00:00"})
    db.bookings.insert_one({"id": f"TEST_cst_b_{pid}", "property_id": pid, "renter_id": renter_id, "owner_id": owner_id})
    try:
        url = f"{BASE}/properties/{pid}/contract"
        assert requests.get(url, timeout=30).status_code in (401, 403), "not signed in"
        assert requests.get(url, headers=stranger_h, timeout=30).status_code == 403
        for h in (owner_h, renter_h):
            r = requests.get(url, headers=h, timeout=30)
            assert r.status_code == 200 and r.json()["has_contract"] is True
    finally:
        db.properties.delete_one({"id": pid})
        db.bookings.delete_many({"property_id": pid})
