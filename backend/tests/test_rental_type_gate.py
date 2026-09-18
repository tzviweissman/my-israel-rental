"""A listing cannot be created with a discontinued rental type.

Storage rentals were discontinued and every frontend picker dropped the
option on 16 Sep. The backend still accepted any string for `rental_type`
on the form path and listed "storage" explicitly on the CSV path, so a
direct API call or a spreadsheet row could still create the dead category
(17 Sep audit). One allow-list, on the model, now gates both.

Existing storage rows are untouched: this is about what comes in.

Needs the live local API (see backend/tests/.env.test).
"""
from __future__ import annotations

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
        "email": f"rtgate-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": "Rental Type Gate", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


def _create(owner, rental_type):
    return requests.post(f"{BASE}/properties", json={
        "title": f"TEST_rtgate {rental_type}", "description": "x",
        "rental_type": rental_type, "property_type": "apartment",
        "area": "Jerusalem", "address": "Test St 1", "monthly_price": 4000,
    }, headers=_auth(owner), timeout=30)


def test_storage_is_refused_on_the_form_path(owner):
    r = _create(owner, "storage")
    assert r.status_code == 422, f"expected a validation refusal, got {r.status_code}: {r.text}"
    assert "rental_type" in r.text


def test_a_made_up_type_is_refused_too(owner):
    assert _create(owner, "houseboat").status_code == 422


def test_the_live_types_still_work(owner):
    for rt in ("long-term", "short-term", "vacation"):
        r = _create(owner, rt)
        assert r.status_code in (200, 201), f"{rt}: {r.status_code} {r.text}"
        pid = r.json().get("id")
        if pid:
            requests.delete(f"{BASE}/properties/{pid}", headers=_auth(owner), timeout=30)


def test_the_csv_path_shares_the_same_list():
    """The CSV validator must be the model's list, not its own copy."""
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from models import RENTAL_TYPES
    from routes.bulk_upload import _VALID_RENTAL_TYPES
    assert _VALID_RENTAL_TYPES is RENTAL_TYPES
    assert "storage" not in _VALID_RENTAL_TYPES
