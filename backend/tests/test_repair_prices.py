"""Regression: generic ``price`` column routing + repair endpoint.

Older imports without explicit ``nightly_price`` / ``monthly_price`` columns
mapped the generic ``price`` column to ``monthly_price`` for every row.
Vacation listings then displayed ₪0/night because nightly_price was empty.

Two fixes covered here:
  1. ``_build_property_doc`` now routes the price to the field that matches
     ``rental_type`` (vacation/short-term → nightly, long-term → monthly)
     when only one of the two fields is populated.
  2. ``POST /admin/properties/repair-prices`` retroactively moves
     misplaced prices on already-imported listings.
"""
import asyncio
import os
import uuid
from datetime import datetime, timezone

import requests
from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = dotenv_values("/app/frontend/.env").get("REACT_APP_BACKEND_URL", "").rstrip("/")
_env = dotenv_values("/app/backend/.env")
MONGO_URL = _env.get("MONGO_URL") or os.environ["MONGO_URL"]
DB_NAME = _env.get("DB_NAME") or os.environ["DB_NAME"]


def _login(email, pw):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": pw}, timeout=10)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def test_build_property_doc_routes_price_to_nightly_for_vacation():
    """Direct unit-style check: when only monthly_price is set on a vacation
    row, _build_property_doc moves it onto nightly_price."""
    import sys
    sys.path.insert(0, "/app/backend")
    from routes.admin_import import _build_property_doc

    doc = _build_property_doc(
        {"title": "Vac Test", "monthly_price": 450},
        owner_id="test-owner",
        default_rental_type="vacation",
    )
    assert doc["nightly_price"] == 450
    assert doc["monthly_price"] == 0

    # And the inverse for long-term
    doc2 = _build_property_doc(
        {"title": "LT Test", "nightly_price": 4500},
        owner_id="test-owner",
        default_rental_type="long-term",
    )
    assert doc2["monthly_price"] == 4500
    assert doc2["nightly_price"] == 0

    # When BOTH are explicitly set the routing leaves them alone.
    doc3 = _build_property_doc(
        {"title": "Both", "monthly_price": 4000, "nightly_price": 200},
        owner_id="test-owner",
        default_rental_type="vacation",
    )
    assert doc3["monthly_price"] == 4000
    assert doc3["nightly_price"] == 200


def test_repair_prices_endpoint_swaps_misplaced_values():
    """Seeds two misplaced listings + a control row, hits the repair
    endpoint, asserts the swap happened and the control is untouched."""
    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    owner = loop.run_until_complete(db.users.find_one({"email": "owner@test.com"}))
    owner_id = owner["id"]
    now = datetime.now(timezone.utc).isoformat()
    vac_id = str(uuid.uuid4())
    lt_id = str(uuid.uuid4())
    ok_id = str(uuid.uuid4())
    loop.run_until_complete(db.properties.insert_many([
        # Misplaced vacation: only monthly_price set
        {"id": vac_id, "owner_id": owner_id, "title": "Misplaced Vac",
         "address": f"X St {uuid.uuid4().hex[:6]}", "rental_type": "vacation",
         "property_type": "apartment", "bedrooms": 2, "floor": 1,
         "monthly_price": 450, "nightly_price": 0, "currency": "ILS",
         "status": "active", "country": "IL", "images": [], "videos": [],
         "created_at": now},
        # Misplaced long-term: only nightly_price set
        {"id": lt_id, "owner_id": owner_id, "title": "Misplaced LT",
         "address": f"Y St {uuid.uuid4().hex[:6]}", "rental_type": "long-term",
         "property_type": "apartment", "bedrooms": 3, "floor": 2,
         "monthly_price": 0, "nightly_price": 4500, "currency": "ILS",
         "status": "active", "country": "IL", "images": [], "videos": [],
         "created_at": now},
        # Control: vacation with BOTH fields set — must remain untouched
        {"id": ok_id, "owner_id": owner_id, "title": "Ok",
         "address": f"Z St {uuid.uuid4().hex[:6]}", "rental_type": "vacation",
         "property_type": "apartment", "bedrooms": 1, "floor": 0,
         "monthly_price": 4000, "nightly_price": 200, "currency": "ILS",
         "status": "active", "country": "IL", "images": [], "videos": [],
         "created_at": now},
    ]))
    try:
        token = _login("admin@rental.com", "Admin1234!")
        r = requests.post(
            f"{BASE_URL}/api/admin/properties/repair-prices",
            headers={"Authorization": f"Bearer {token}"}, timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["vacation_short_term_swapped"] >= 1
        assert body["long_term_swapped"] >= 1

        vac_after = loop.run_until_complete(db.properties.find_one({"id": vac_id}))
        lt_after = loop.run_until_complete(db.properties.find_one({"id": lt_id}))
        ok_after = loop.run_until_complete(db.properties.find_one({"id": ok_id}))

        assert vac_after["nightly_price"] == 450
        assert vac_after["monthly_price"] == 0
        assert lt_after["monthly_price"] == 4500
        assert lt_after["nightly_price"] == 0
        # Control untouched
        assert ok_after["monthly_price"] == 4000
        assert ok_after["nightly_price"] == 200

        # Idempotency check: running again is a no-op for these rows.
        r2 = requests.post(
            f"{BASE_URL}/api/admin/properties/repair-prices",
            headers={"Authorization": f"Bearer {token}"}, timeout=20,
        )
        assert r2.status_code == 200
        body2 = r2.json()
        # Our 3 test rows are healthy now, but other dev-DB rows may need
        # repair too — so we only check that ours weren't touched.
        vac_check = loop.run_until_complete(db.properties.find_one({"id": vac_id}))
        assert vac_check["nightly_price"] == 450
        assert vac_check["monthly_price"] == 0
    finally:
        loop.run_until_complete(db.properties.delete_many({"id": {"$in": [vac_id, lt_id, ok_id]}}))
        loop.close()
