"""Smart Lists: who may use it, and whose saved lists they can reach.

WHY. The other Smart Lists tests call the filter functions directly, so
nothing exercised the routes themselves: the admin-only check on each of the
six endpoints, and the owner_id scoping that keeps one admin's saved lists
away from another's (site audit 2026-09-14, finding 6). Both looked correct
on reading; these make them stay that way.

There is one local test admin, so a second admin's list is written straight
into the LOCAL database rather than created through a second account.

Runs against the live local API (see backend/tests/.env.test).
"""
from __future__ import annotations

import os
import re
import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from conftest import (  # noqa: E402
    TEST_ADMIN_EMAIL,
    TEST_ADMIN_PASSWORD,
    TEST_API_BASE,
    TEST_OWNER_EMAIL,
    TEST_OWNER_PASSWORD,
)

BASE = TEST_API_BASE


def _login(email: str, password: str) -> str:
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.ok, f"login failed for a test account: {r.status_code}"
    return r.json()["token"]


def _auth(token: str | None) -> dict:
    return {"Authorization": f"Bearer {token}"} if token else {}


@pytest.fixture(scope="module")
def admin() -> str:
    if not TEST_ADMIN_EMAIL:
        pytest.skip("TEST_ADMIN_EMAIL is not set in tests/.env.test")
    return _login(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def owner() -> str:
    if not TEST_OWNER_EMAIL:
        pytest.skip("TEST_OWNER_EMAIL is not set in tests/.env.test")
    return _login(TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD)


@pytest.fixture(scope="module")
def local_db():
    url = os.environ["MONGO_URL"]
    assert re.match(r"^mongodb://(localhost|127\.0\.0\.1)", url), "refusing to write to a non-local database"
    client = MongoClient(url)
    yield client[os.environ["DB_NAME"]]
    client.close()


ROUTES = [
    ("get", "/admin/smart-lists/locations", None),
    ("post", "/admin/smart-lists/generate", {}),
    ("get", "/admin/smart-lists", None),
    ("post", "/admin/smart-lists", {"name": "access test"}),
    ("get", "/admin/smart-lists/does-not-matter", None),
    ("delete", "/admin/smart-lists/does-not-matter", None),
]


@pytest.mark.parametrize("method, path, body", ROUTES)
def test_a_non_admin_is_refused_on_every_route(owner, method, path, body):
    r = requests.request(method, f"{BASE}{path}", json=body, headers=_auth(owner), timeout=30)
    assert r.status_code == 403, f"{method.upper()} {path} answered {r.status_code} to a non-admin"


@pytest.mark.parametrize("method, path, body", ROUTES)
def test_no_token_is_refused_on_every_route(method, path, body):
    r = requests.request(method, f"{BASE}{path}", json=body, timeout=30)
    assert r.status_code in (401, 403), f"{method.upper()} {path} answered {r.status_code} with no token"


def test_an_admin_can_save_open_and_delete_their_own_list(admin):
    name = f"access test {uuid.uuid4().hex[:8]}"
    r = requests.post(f"{BASE}/admin/smart-lists", json={"name": name, "listed_within_days": 30},
                      headers=_auth(admin), timeout=60)
    assert r.ok, r.text
    list_id = r.json()["id"]
    try:
        listed = requests.get(f"{BASE}/admin/smart-lists", headers=_auth(admin), timeout=30).json()
        assert any(x["id"] == list_id for x in listed)
        opened = requests.get(f"{BASE}/admin/smart-lists/{list_id}", headers=_auth(admin), timeout=60)
        assert opened.ok and opened.json()["filters"]["listed_within_days"] == 30
    finally:
        d = requests.delete(f"{BASE}/admin/smart-lists/{list_id}", headers=_auth(admin), timeout=30)
    assert d.ok, d.text
    assert requests.get(f"{BASE}/admin/smart-lists/{list_id}", headers=_auth(admin), timeout=30).status_code == 404


def test_another_admins_list_is_invisible_and_untouchable(admin, local_db):
    """404, not 403: an admin must not learn that someone else's list exists."""
    list_id = f"other-admin-{uuid.uuid4()}"
    local_db.smart_lists.insert_one({
        "id": list_id,
        "owner_id": f"someone-else-{uuid.uuid4()}",
        "name": "Another admin's list",
        "filters": {"rental_category": "any"},
        "snapshot_count": 0,
        "created_at": datetime.now(UTC).isoformat(),
    })
    try:
        listed = requests.get(f"{BASE}/admin/smart-lists", headers=_auth(admin), timeout=30).json()
        assert all(x["id"] != list_id for x in listed), "another admin's list appears in this admin's list"
        assert requests.get(f"{BASE}/admin/smart-lists/{list_id}", headers=_auth(admin), timeout=30).status_code == 404
        assert requests.delete(f"{BASE}/admin/smart-lists/{list_id}", headers=_auth(admin), timeout=30).status_code == 404
        assert local_db.smart_lists.find_one({"id": list_id}), "the delete removed another admin's list"
    finally:
        local_db.smart_lists.delete_one({"id": list_id})


def test_an_inverted_range_is_a_422_through_the_route(admin):
    r = requests.post(f"{BASE}/admin/smart-lists/generate", json={"min_bedrooms": 4, "max_bedrooms": 2},
                      headers=_auth(admin), timeout=30)
    assert r.status_code == 422, r.text
