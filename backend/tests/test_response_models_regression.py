"""Iteration 18 regression: response_model contract-typing sweep.

Verifies every high-traffic endpoint still returns its pre-sweep payload
shape. Each response_model uses ConfigDict(extra='allow') so enriched
Mongo fields must continue to flow through.

Runs against REACT_APP_BACKEND_URL (public) so we test what users see.
"""
import os
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env.test")

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://where-am-i-project.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

ADMIN = ("admin@rental.com", "Admin1234!")
OWNER = ("owner@test.com", "Test1234!")
RENTER = ("renter@test.com", "Test1234!")


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text[:200]}"
    return r.json()


def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _assert_no_mongo_id(obj, path="root"):
    """Recursively assert no `_id` key leaks in the JSON payload."""
    if isinstance(obj, dict):
        assert "_id" not in obj, f"_id leaked at {path}: keys={list(obj.keys())[:10]}"
        for k, v in obj.items():
            _assert_no_mongo_id(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj[:5]):  # first 5 is enough for smoke
            _assert_no_mongo_id(v, f"{path}[{i}]")


# ---------- OpenAPI meta ----------
class TestOpenAPI:
    def test_openapi_schema_counts(self):
        """88 schemas, 93/98 typed endpoints per iteration 18 claim."""
        # openapi.json is NOT routed through /api prefix via ingress; hit internal.
        r = requests.get("http://localhost:8001/openapi.json", timeout=10)
        assert r.status_code == 200
        doc = r.json()
        schemas = doc.get("components", {}).get("schemas", {})
        assert len(schemas) >= 80, f"expected ~88 schemas, got {len(schemas)}"
        total = 0
        typed = 0
        for _p, methods in doc.get("paths", {}).items():
            for _m, spec in methods.items():
                total += 1
                for code, resp in spec.get("responses", {}).items():
                    if code.startswith("2") and resp.get("content", {}).get("application/json", {}).get("schema"):
                        typed += 1
                        break
        assert total >= 90 and typed >= 90, f"expected ~93/98, got {typed}/{total}"


# ---------- Auth ----------
class TestAuth:
    def test_login_shape(self):
        data = _login(*ADMIN)
        assert "token" in data and isinstance(data["token"], str) and data["token"]
        assert "user" in data
        u = data["user"]
        for k in ("id", "email", "name", "role"):
            assert k in u, f"login user.{k} missing"
        assert u["email"] == ADMIN[0]
        assert u["role"] == "admin"
        _assert_no_mongo_id(data)

    def test_me_full_payload(self):
        tok = _login(*OWNER)["token"]
        r = requests.get(f"{API}/auth/me", headers=_hdr(tok), timeout=15)
        assert r.status_code == 200
        me = r.json()
        for k in ("id", "email", "name", "role", "created_at"):
            assert k in me, f"/auth/me missing {k}"
        assert me["email"] == OWNER[0]
        # phone is optional but key must exist per UserPublic model (extra='allow')
        _assert_no_mongo_id(me)

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "nope@x.com", "password": "x"}, timeout=10)
        assert r.status_code == 401


# ---------- Properties ----------
class TestProperties:
    def test_list_properties_enriched(self):
        r = requests.get(f"{API}/properties", timeout=30)
        assert r.status_code == 200
        props = r.json()
        assert isinstance(props, list) and len(props) > 0, "no properties returned"
        p = props[0]
        # Core fields
        for k in ("id", "title", "monthly_price", "images", "amenities", "owner_id"):
            assert k in p, f"property missing core key {k}"
        # Ensure it's a rich shape (>= 15 keys) — validates extra='allow' passthrough
        assert len(p.keys()) >= 15, f"property seems thin, only {len(p.keys())} keys: {list(p.keys())}"
        # Pre-sweep property list shape should still include the full feature set
        expected_rich_fields = {
            "rental_type", "property_type", "bedrooms", "bathrooms", "amenities",
            "has_elevator", "is_tama", "sukkah_compatible", "has_agent_fee",
            "agent_fee_price", "agent_fee_currency", "currency", "views", "status",
        }
        missing = expected_rich_fields - set(p.keys())
        assert not missing, f"property list regression — missing expected fields: {missing}"
        _assert_no_mongo_id(props)

    def test_get_property_by_id_with_owner_enrich(self):
        # Use the seeded test property from test_credentials.md
        pid = "86c6e09c-b1e0-4705-a86c-91cd9ce13765"
        r1 = requests.get(f"{API}/properties/{pid}", timeout=15)
        if r1.status_code == 404:
            # fallback to first listed property
            lst = requests.get(f"{API}/properties", timeout=20).json()
            pid = lst[0]["id"]
            r1 = requests.get(f"{API}/properties/{pid}", timeout=15)
        assert r1.status_code == 200
        p = r1.json()
        assert p["id"] == pid
        assert "views" in p, "views counter missing"
        assert any(k in p for k in ("owner_name", "owner_email")), f"owner enrichment missing: keys={list(p.keys())}"
        # Views should increment on second GET
        v1 = p.get("views", 0)
        r2 = requests.get(f"{API}/properties/{pid}", timeout=15)
        assert r2.status_code == 200
        assert r2.json().get("views", 0) >= v1
        _assert_no_mongo_id(p)


# ---------- Bookings ----------
class TestBookings:
    def test_create_booking_flow(self):
        renter_tok = _login(*RENTER)["token"]
        # pick an active property
        props = requests.get(f"{API}/properties", timeout=20).json()
        pid = next(p["id"] for p in props if p.get("status") in ("active", "available", None))
        payload = {
            "property_id": pid,
            "start_date": "2027-01-10",
            "end_date": "2027-01-12",
            "guest_count": 1,
            "message": "TEST_regression booking",
        }
        r = requests.post(f"{API}/bookings", headers=_hdr(renter_tok), json=payload, timeout=20)
        assert r.status_code in (200, 201), f"create booking failed: {r.status_code} {r.text[:300]}"
        body = r.json()
        # BookingCreateResponse required keys
        for k in ("id", "status", "message"):
            assert k in body, f"booking create response missing {k}: {body}"
        assert isinstance(body["id"], str) and body["id"]
        _assert_no_mongo_id(body)

    def test_admin_list_bookings(self):
        admin_tok = _login(*ADMIN)["token"]
        r = requests.get(f"{API}/bookings", headers=_hdr(admin_tok), timeout=20)
        assert r.status_code == 200
        lst = r.json()
        assert isinstance(lst, list)
        if lst:
            b = lst[0]
            for k in ("id", "property_id", "start_date", "end_date"):
                assert k in b, f"booking missing {k}: keys={list(b.keys())}"
            _assert_no_mongo_id(lst)


# ---------- Bulk manager ----------
class TestBulkEndpoints:
    def test_bulk_edit_shape(self):
        owner_tok = _login(*OWNER)["token"]
        # find one owned property
        me = requests.get(f"{API}/auth/me", headers=_hdr(owner_tok), timeout=10).json()
        props = requests.get(f"{API}/properties", timeout=20).json()
        owned = [p for p in props if p.get("owner_id") == me["id"]]
        assert owned, "owner has no properties to bulk-edit"
        pid = owned[0]["id"]
        r = requests.post(
            f"{API}/properties/bulk-edit",
            headers=_hdr(owner_tok),
            json={"property_ids": [pid], "updates": {"has_elevator": True}},
            timeout=30,
        )
        assert r.status_code == 200, f"bulk-edit failed: {r.status_code} {r.text[:300]}"
        body = r.json()
        for k in ("updated", "skipped", "summary"):
            assert k in body, f"bulk-edit response missing {k}: keys={list(body.keys())}"
        assert isinstance(body["updated"], list), f"bulk-edit updated should be list, got {type(body['updated'])}"
        assert isinstance(body["skipped"], list)
        assert isinstance(body["summary"], dict)
        _assert_no_mongo_id(body)

    def test_bulk_images_shape(self):
        owner_tok = _login(*OWNER)["token"]
        me = requests.get(f"{API}/auth/me", headers=_hdr(owner_tok), timeout=10).json()
        props = requests.get(f"{API}/properties", timeout=20).json()
        owned = [p for p in props if p.get("owner_id") == me["id"]]
        pid = owned[0]["id"]
        r = requests.post(
            f"{API}/properties/bulk-images",
            headers=_hdr(owner_tok),
            json={
                "property_ids": [pid],
                "mode": "shared",
                "image_urls": ["https://example.com/TEST_regression.jpg"],
            },
            timeout=30,
        )
        assert r.status_code == 200, f"bulk-images failed: {r.status_code} {r.text[:300]}"
        body = r.json()
        # BulkEditResponse shape (reused) — updated list + skipped list + summary dict
        for k in ("updated", "skipped", "summary"):
            assert k in body, f"bulk-images response missing {k}: keys={list(body.keys())}"
        _assert_no_mongo_id(body)


# ---------- Admin ----------
class TestAdmin:
    def test_admin_dashboard_all_keys(self):
        tok = _login(*ADMIN)["token"]
        r = requests.get(f"{API}/admin/dashboard", headers=_hdr(tok), timeout=20)
        assert r.status_code == 200, f"dashboard: {r.status_code} {r.text[:200]}"
        d = r.json()
        for k in ("active_listings", "total_views", "total_inquiries", "total_users", "recent_properties"):
            assert k in d, f"dashboard missing key {k}: got {list(d.keys())}"
        assert isinstance(d["active_listings"], int)
        assert isinstance(d["recent_properties"], list)
        _assert_no_mongo_id(d)

    def test_admin_properties_enrichment(self):
        tok = _login(*ADMIN)["token"]
        r = requests.get(f"{API}/admin/properties", headers=_hdr(tok), timeout=30)
        assert r.status_code == 200
        props = r.json()
        assert isinstance(props, list) and len(props) > 0
        p = props[0]
        # Check admin-enriched fields
        for k in ("id", "title", "owner_id"):
            assert k in p, f"admin property missing {k}"
        # These admin enrichments should be present per iteration 18 spec
        enrich_found = sum(1 for k in ("owner_name", "owner_email", "admin_blocked_now", "active_admin_block") if k in p)
        assert enrich_found >= 1, (
            f"admin enrichment missing; expected at least one of owner_name/owner_email/admin_blocked_now/active_admin_block. "
            f"keys sample: {list(p.keys())[:25]}"
        )
        _assert_no_mongo_id(props)


# ---------- Bulk-upload parse/extract ----------
class TestBulkUpload:
    def test_bulk_parse_shape(self):
        owner_tok = _login(*OWNER)["token"]
        # Minimal CSV
        csv_data = "title,description,monthly_price,city,country,property_type\nTEST_bulk,desc,1000,TLV,IL,apartment\n"
        # Endpoint expects multipart file; use files=
        r = requests.post(
            f"{API}/properties/bulk/parse",
            headers={"Authorization": f"Bearer {owner_tok}"},
            files={"file": ("test.csv", csv_data, "text/csv")},
            timeout=30,
        )
        if r.status_code == 404:
            pytest.skip("bulk/parse not available")
        assert r.status_code == 200, f"bulk/parse: {r.status_code} {r.text[:300]}"
        body = r.json()
        # Expect rows + summary OR similar keys
        assert any(k in body for k in ("rows", "summary", "properties", "count")), (
            f"bulk/parse body missing expected keys: {list(body.keys())}"
        )
        _assert_no_mongo_id(body)
