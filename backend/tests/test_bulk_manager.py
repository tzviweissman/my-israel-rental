"""Pytest coverage for the Bulk Manager endpoints:
- POST /api/properties/bulk-edit (whitelist, title_prefix idempotence, amenities modes, ownership, undo)
- POST /api/properties/bulk-images (shared, per_property, ownership)
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL", "https://where-am-i-project.preview.emergentagent.com"
).rstrip("/")
API = f"{BASE_URL}/api"

OWNER_EMAIL = "owner@test.com"
OWNER_PASSWORD = "Test1234!"
OTHER_OWNER_EMAIL = "owner@rental.com"
OTHER_OWNER_PASSWORD = "owner123"
ADMIN_EMAIL = "admin@rental.com"
ADMIN_PASSWORD = "Admin1234!"
RENTER_EMAIL = "renter@test.com"
RENTER_PASSWORD = "Test1234!"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"login failed for {email}: {r.status_code} {r.text[:200]}")
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="module")
def owner_token():
    return _login(OWNER_EMAIL, OWNER_PASSWORD)


@pytest.fixture(scope="module")
def other_owner_token():
    return _login(OTHER_OWNER_EMAIL, OTHER_OWNER_PASSWORD)


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


def _create_prop(token, title, extra=None):
    body = {
        "title": title,
        "description": "test",
        "rental_type": "long-term",
        "property_type": "apartment",
        "bedrooms": 2,
        "bathrooms": 1,
        "area": "Tel Aviv - Center",
        "monthly_price": 5000,
        "currency": "ILS",
        "amenities": ["wifi"],
        "images": [],
    }
    if extra:
        body.update(extra)
    r = requests.post(f"{API}/properties", json=body, headers={"Authorization": f"Bearer {token}"}, timeout=15)
    assert r.status_code in (200, 201), f"create failed: {r.status_code} {r.text[:200]}"
    return r.json()["id"]


def _get_prop(pid, token):
    r = requests.get(f"{API}/properties/{pid}", headers={"Authorization": f"Bearer {token}"}, timeout=15)
    assert r.status_code == 200, f"get failed {pid}: {r.text[:200]}"
    return r.json()


def _delete_prop(pid, token):
    try:
        requests.delete(f"{API}/properties/{pid}", headers={"Authorization": f"Bearer {token}"}, timeout=15)
    except Exception:
        pass


@pytest.fixture
def two_owner_props(owner_token):
    pid1 = _create_prop(owner_token, f"TEST_BulkA_{uuid.uuid4().hex[:6]}", {"amenities": ["wifi", "ac"]})
    pid2 = _create_prop(owner_token, f"TEST_BulkB_{uuid.uuid4().hex[:6]}", {"amenities": ["wifi"]})
    yield pid1, pid2
    _delete_prop(pid1, owner_token)
    _delete_prop(pid2, owner_token)


class TestBulkEdit:
    # 1. Whitelist patching + snapshot returned
    def test_bulk_edit_applies_whitelisted_and_returns_snapshots(self, owner_token, two_owner_props):
        pid1, pid2 = two_owner_props
        r = requests.post(
            f"{API}/properties/bulk-edit",
            json={
                "property_ids": [pid1, pid2],
                "updates": {"has_elevator": True, "monthly_price": 7777, "checkin_time": "15:00"},
            },
            headers={"Authorization": f"Bearer {owner_token}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["summary"]["updated"] == 2
        assert data["summary"]["skipped"] == 0
        for item in data["updated"]:
            assert "id" in item and "snapshot" in item
            # snapshot must contain exactly the patched keys
            assert set(item["snapshot"].keys()) == {"has_elevator", "monthly_price", "checkin_time"}
            # No _id leakage
            assert "_id" not in item
        # Verify persistence
        p1 = _get_prop(pid1, owner_token)
        assert p1["has_elevator"] is True
        assert p1["monthly_price"] == 7777
        assert p1["checkin_time"] == "15:00"

    # 2. Non-whitelisted keys silently ignored (owner_id, status, images). monthly_price still applied.
    def test_bulk_edit_ignores_non_whitelisted(self, owner_token, two_owner_props):
        pid1, _ = two_owner_props
        orig = _get_prop(pid1, owner_token)
        orig_owner = orig["owner_id"]
        orig_status = orig.get("status")
        orig_images = orig.get("images", [])
        r = requests.post(
            f"{API}/properties/bulk-edit",
            json={
                "property_ids": [pid1],
                "updates": {"owner_id": "HACKED", "status": "inactive", "images": ["x"], "monthly_price": 9999},
            },
            headers={"Authorization": f"Bearer {owner_token}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["summary"]["updated"] == 1
        # snapshot should only have monthly_price (other keys filtered out)
        assert list(data["updated"][0]["snapshot"].keys()) == ["monthly_price"]
        after = _get_prop(pid1, owner_token)
        assert after["owner_id"] == orig_owner, "owner_id must not change"
        assert after.get("status") == orig_status, "status must not change"
        assert after.get("images", []) == orig_images, "images must not change"
        assert after["monthly_price"] == 9999

    # 3. title_prefix prepends once (idempotent)
    def test_title_prefix_idempotent(self, owner_token, two_owner_props):
        pid1, _ = two_owner_props
        orig = _get_prop(pid1, owner_token)
        orig_title = orig["title"]
        body = {"property_ids": [pid1], "updates": {}, "title_prefix": "[Building A]"}
        r1 = requests.post(f"{API}/properties/bulk-edit", json=body, headers={"Authorization": f"Bearer {owner_token}"}, timeout=15)
        assert r1.status_code == 200, r1.text
        t1 = _get_prop(pid1, owner_token)["title"]
        assert t1.startswith("[Building A]")
        assert orig_title in t1
        # Run again — must remain idempotent
        r2 = requests.post(f"{API}/properties/bulk-edit", json=body, headers={"Authorization": f"Bearer {owner_token}"}, timeout=15)
        assert r2.status_code == 200, r2.text
        t2 = _get_prop(pid1, owner_token)["title"]
        assert t2 == t1, f"prefix was applied twice: {t2}"

    # 4. amenities append merges (no duplicates); replace overwrites
    def test_amenities_append_and_replace(self, owner_token, two_owner_props):
        pid1, _ = two_owner_props
        # Start state: amenities ["wifi", "ac"]
        _get_prop(pid1, owner_token)
        r_app = requests.post(
            f"{API}/properties/bulk-edit",
            json={
                "property_ids": [pid1],
                "updates": {"amenities": ["ac", "parking"]},  # "ac" is duplicate
                "amenities_mode": "append",
            },
            headers={"Authorization": f"Bearer {owner_token}"}, timeout=15,
        )
        assert r_app.status_code == 200, r_app.text
        after_app = _get_prop(pid1, owner_token)["amenities"]
        assert set(after_app) == {"wifi", "ac", "parking"}
        assert len(after_app) == len(set(after_app)), f"duplicates present: {after_app}"

        r_rep = requests.post(
            f"{API}/properties/bulk-edit",
            json={
                "property_ids": [pid1],
                "updates": {"amenities": ["pool"]},
                "amenities_mode": "replace",
            },
            headers={"Authorization": f"Bearer {owner_token}"}, timeout=15,
        )
        assert r_rep.status_code == 200, r_rep.text
        after_rep = _get_prop(pid1, owner_token)["amenities"]
        assert after_rep == ["pool"]

    # 5. Ownership check — non-admin cannot edit other owners' properties (skipped forbidden)
    def test_ownership_check_forbidden(self, other_owner_token, two_owner_props):
        pid1, _ = two_owner_props  # these belong to owner@test.com
        r = requests.post(
            f"{API}/properties/bulk-edit",
            json={"property_ids": [pid1], "updates": {"monthly_price": 1}},
            headers={"Authorization": f"Bearer {other_owner_token}"}, timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["summary"]["updated"] == 0
        assert data["summary"]["skipped"] == 1
        assert data["skipped"][0]["id"] == pid1
        assert data["skipped"][0]["reason"] == "forbidden"

    # 6. Undo flow — reposting server snapshots reverts the values
    def test_undo_via_snapshots(self, owner_token, two_owner_props):
        pid1, _ = two_owner_props
        before = _get_prop(pid1, owner_token)
        original_price = before.get("monthly_price")
        original_elevator = bool(before.get("has_elevator"))

        r1 = requests.post(
            f"{API}/properties/bulk-edit",
            json={"property_ids": [pid1], "updates": {"monthly_price": 12345, "has_elevator": not original_elevator}},
            headers={"Authorization": f"Bearer {owner_token}"}, timeout=15,
        )
        assert r1.status_code == 200
        snapshot = r1.json()["updated"][0]["snapshot"]
        assert snapshot["monthly_price"] == original_price
        assert snapshot["has_elevator"] == original_elevator

        # Now ship snapshot back = Undo
        r_undo = requests.post(
            f"{API}/properties/bulk-edit",
            json={"property_ids": [pid1], "updates": snapshot},
            headers={"Authorization": f"Bearer {owner_token}"}, timeout=15,
        )
        assert r_undo.status_code == 200
        after = _get_prop(pid1, owner_token)
        assert after.get("monthly_price") == original_price
        assert bool(after.get("has_elevator")) == original_elevator

    # 7. Empty updates AND empty title_prefix => 400
    def test_empty_update_rejected(self, owner_token, two_owner_props):
        pid1, _ = two_owner_props
        r = requests.post(
            f"{API}/properties/bulk-edit",
            json={"property_ids": [pid1], "updates": {}},
            headers={"Authorization": f"Bearer {owner_token}"}, timeout=15,
        )
        assert r.status_code == 400

    # 8. No property_ids => 400
    def test_no_ids_rejected(self, owner_token):
        r = requests.post(
            f"{API}/properties/bulk-edit",
            json={"property_ids": [], "updates": {"monthly_price": 1}},
            headers={"Authorization": f"Bearer {owner_token}"}, timeout=15,
        )
        assert r.status_code == 400

    # 9. Admin can bulk-edit other owners' properties
    def test_admin_can_bulk_edit(self, admin_token, two_owner_props, owner_token):
        pid1, pid2 = two_owner_props
        r = requests.post(
            f"{API}/properties/bulk-edit",
            json={"property_ids": [pid1, pid2], "updates": {"has_elevator": True}},
            headers={"Authorization": f"Bearer {admin_token}"}, timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["summary"]["updated"] == 2


class TestBulkImages:
    # 10. Shared images fan-out + append
    def test_bulk_images_shared(self, owner_token, two_owner_props):
        pid1, pid2 = two_owner_props
        before1 = len(_get_prop(pid1, owner_token).get("images", []))
        before2 = len(_get_prop(pid2, owner_token).get("images", []))
        urls = ["https://x.test/a.jpg", "https://x.test/b.jpg"]
        r = requests.post(
            f"{API}/properties/bulk-images",
            json={"property_ids": [pid1, pid2], "image_urls": urls},
            headers={"Authorization": f"Bearer {owner_token}"}, timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["summary"]["updated"] == 2
        after1 = _get_prop(pid1, owner_token).get("images", [])
        after2 = _get_prop(pid2, owner_token).get("images", [])
        assert len(after1) == before1 + 2 and after1[-2:] == urls
        assert len(after2) == before2 + 2 and after2[-2:] == urls

    # 11. per_property mode assigns distinct urls
    def test_bulk_images_per_property(self, owner_token, two_owner_props):
        pid1, pid2 = two_owner_props
        per = {pid1: ["https://x.test/p1-only.jpg"], pid2: ["https://x.test/p2-only.jpg", "https://x.test/p2-two.jpg"]}
        r = requests.post(
            f"{API}/properties/bulk-images",
            json={"property_ids": [pid1, pid2], "image_urls": [], "per_property": per},
            headers={"Authorization": f"Bearer {owner_token}"}, timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["summary"]["updated"] == 2
        assert any(u["id"] == pid1 and u["added"] == 1 for u in data["updated"])
        assert any(u["id"] == pid2 and u["added"] == 2 for u in data["updated"])
        p1 = _get_prop(pid1, owner_token)["images"]
        p2 = _get_prop(pid2, owner_token)["images"]
        assert "https://x.test/p1-only.jpg" in p1
        assert "https://x.test/p1-only.jpg" not in p2
        assert "https://x.test/p2-only.jpg" in p2 and "https://x.test/p2-two.jpg" in p2

    # 12. Ownership check enforced on bulk-images
    def test_bulk_images_ownership_forbidden(self, other_owner_token, two_owner_props):
        pid1, _ = two_owner_props
        r = requests.post(
            f"{API}/properties/bulk-images",
            json={"property_ids": [pid1], "image_urls": ["https://x.test/z.jpg"]},
            headers={"Authorization": f"Bearer {other_owner_token}"}, timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["summary"]["updated"] == 0
        assert data["skipped"][0]["reason"] == "forbidden"

    # 13. No ids => 400
    def test_bulk_images_no_ids(self, owner_token):
        r = requests.post(
            f"{API}/properties/bulk-images",
            json={"property_ids": [], "image_urls": ["https://x.test/z.jpg"]},
            headers={"Authorization": f"Bearer {owner_token}"}, timeout=15,
        )
        assert r.status_code == 400


# Quick smoke: no MongoDB _id leaks in bulk responses
def test_no_mongo_id_leak(owner_token, two_owner_props):
    pid1, _ = two_owner_props
    r = requests.post(
        f"{API}/properties/bulk-edit",
        json={"property_ids": [pid1], "updates": {"monthly_price": 5555}},
        headers={"Authorization": f"Bearer {owner_token}"}, timeout=15,
    )
    assert r.status_code == 200
    assert "_id" not in r.text
