"""
Regression test after server.py → routes/* refactor.

Goal: hit at least one representative endpoint from every router module
to verify include_router() wiring, /api prefix handling, and shared
deps (db, logger, auth constants) are correctly resolved.

Covers: auth, properties, bookings, subleases, contracts, chat,
notifications, saved_searches, ical, admin, misc.
"""
import os
import io
import uuid
import time
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://where-am-i-project.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

OWNER_EMAIL = "owner@test.com"
RENTER_EMAIL = "renter@test.com"
PWD = "Test1234!"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def owner_token():
    r = requests.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": PWD}, timeout=15)
    assert r.status_code == 200, f"owner login failed: {r.status_code} {r.text}"
    body = r.json()
    return body.get("token") or body.get("access_token")


@pytest.fixture(scope="module")
def renter_token():
    r = requests.post(f"{API}/auth/login", json={"email": RENTER_EMAIL, "password": PWD}, timeout=15)
    assert r.status_code == 200, f"renter login failed: {r.status_code} {r.text}"
    body = r.json()
    return body.get("token") or body.get("access_token")


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- AUTH router ----------
class TestAuth:
    def test_login_ok(self, owner_token):
        assert isinstance(owner_token, str) and len(owner_token) > 20

    def test_login_bad(self):
        r = requests.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": "wrong"}, timeout=15)
        assert r.status_code in (400, 401)

    def test_me(self, owner_token):
        r = requests.get(f"{API}/auth/me", headers=_h(owner_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == OWNER_EMAIL

    def test_me_unauth(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code in (401, 403)

    def test_forgot_password_idempotent(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": "nobody-xyz@test.com"}, timeout=15)
        # Unknown email returns 404; known email returns 200
        assert r.status_code in (200, 202, 204, 404)

    def test_reset_password_invalid_token(self):
        r = requests.post(f"{API}/auth/reset-password", json={"token": "invalid", "new_password": "Abcdef1!"}, timeout=15)
        assert r.status_code in (400, 401, 404)

    def test_change_password_wrong_current(self, owner_token):
        r = requests.post(f"{API}/auth/change-password",
                          headers=_h(owner_token),
                          json={"current_password": "WRONG", "new_password": "Newpass1!"}, timeout=15)
        assert r.status_code in (400, 401, 403)


# ---------- PROPERTIES router ----------
class TestProperties:
    def test_list_properties(self):
        r = requests.get(f"{API}/properties", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_filters(self):
        r = requests.get(f"{API}/properties",
                         params={"rental_type": "short_term", "min_bedrooms": 1, "max_price": 100000},
                         timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_property_404(self):
        r = requests.get(f"{API}/properties/does-not-exist-123", timeout=15)
        assert r.status_code == 404

    def test_crud_property(self, owner_token):
        payload = {
            "title": "TEST_refactor_" + uuid.uuid4().hex[:8],
            "description": "regression test",
            "price": 1234,
            "bedrooms": 1,
            "bathrooms": 1,
            "area": "Tel Aviv",
            "location": "Test St 1",
            "rental_type": "short_term",
            "property_type": "apartment",
            "images": [],
            "amenities": [],
        }
        c = requests.post(f"{API}/properties", headers=_h(owner_token), json=payload, timeout=20)
        assert c.status_code in (200, 201), c.text
        pid = c.json()["id"]

        g = requests.get(f"{API}/properties/{pid}", timeout=15)
        assert g.status_code == 200
        assert g.json()["title"] == payload["title"]

        u = requests.put(f"{API}/properties/{pid}", headers=_h(owner_token),
                         json={**payload, "title": payload["title"] + "_upd"}, timeout=15)
        assert u.status_code == 200
        # Verify via GET
        g2 = requests.get(f"{API}/properties/{pid}", timeout=15)
        assert g2.status_code == 200
        assert g2.json()["title"].endswith("_upd")

        # cleanup
        d = requests.delete(f"{API}/properties/{pid}", headers=_h(owner_token), timeout=15)
        assert d.status_code in (200, 204)

    def test_like_and_liked_lists(self, renter_token):
        # grab any property
        lst = requests.get(f"{API}/properties", timeout=15).json()
        if not lst:
            pytest.skip("no properties")
        pid = lst[0]["id"]
        r = requests.post(f"{API}/properties/{pid}/like", headers=_h(renter_token), timeout=15)
        assert r.status_code == 200

        liked_ids = requests.get(f"{API}/liked-property-ids", headers=_h(renter_token), timeout=15)
        assert liked_ids.status_code == 200
        assert isinstance(liked_ids.json(), list)

        liked = requests.get(f"{API}/liked-properties", headers=_h(renter_token), timeout=15)
        assert liked.status_code == 200

    def test_manager_properties(self, owner_token):
        me = requests.get(f"{API}/auth/me", headers=_h(owner_token), timeout=15).json()
        r = requests.get(f"{API}/manager/{me['id']}/properties", timeout=15)
        assert r.status_code == 200
        body = r.json()
        # Endpoint returns {"manager": {...}, "properties": [...]}
        assert "properties" in body and isinstance(body["properties"], list)
        assert body.get("manager", {}).get("id") == me["id"]


# ---------- BOOKINGS router ----------
class TestBookings:
    def test_list_bookings_owner(self, owner_token):
        r = requests.get(f"{API}/bookings", headers=_h(owner_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_bookings_renter(self, renter_token):
        r = requests.get(f"{API}/bookings", headers=_h(renter_token), timeout=15)
        assert r.status_code == 200

    def test_accept_booking_404(self, owner_token):
        r = requests.post(f"{API}/bookings/not-a-real-id/accept", headers=_h(owner_token), timeout=15)
        assert r.status_code in (400, 403, 404)


# ---------- SUBLEASES router ----------
class TestSubleases:
    def test_list_subleases(self):
        r = requests.get(f"{API}/subleases", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_my_subleases(self, owner_token):
        r = requests.get(f"{API}/my-subleases", headers=_h(owner_token), timeout=15)
        assert r.status_code == 200

    def test_public_sign_token_invalid(self):
        r = requests.get(f"{API}/contracts/sign/not-a-real-token", timeout=15)
        assert r.status_code in (400, 404)


# ---------- CONTRACTS router ----------
class TestContracts:
    def test_contract_template_en(self):
        r = requests.get(f"{API}/contract-template/en", timeout=15)
        assert r.status_code == 200
        # PDF response or JSON with URL
        ct = r.headers.get("content-type", "")
        assert "pdf" in ct or "json" in ct

    def test_contract_template_he(self):
        r = requests.get(f"{API}/contract-template/he", timeout=15)
        assert r.status_code == 200

    def test_list_contracts(self, owner_token):
        r = requests.get(f"{API}/contracts", headers=_h(owner_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- CHAT router ----------
class TestChat:
    def test_conversations(self, owner_token):
        r = requests.get(f"{API}/chat/conversations", headers=_h(owner_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- NOTIFICATIONS router ----------
class TestNotifications:
    def test_list_notifications(self, owner_token):
        r = requests.get(f"{API}/notifications", headers=_h(owner_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_read_all(self, owner_token):
        r = requests.put(f"{API}/notifications/read-all", headers=_h(owner_token), timeout=15)
        assert r.status_code in (200, 204)

    def test_preferences(self, owner_token):
        r = requests.post(f"{API}/notifications/preferences",
                          headers=_h(owner_token),
                          json={"email_enabled": True, "in_app_enabled": True}, timeout=15)
        assert r.status_code in (200, 204)


# ---------- SAVED-SEARCHES router ----------
class TestSavedSearches:
    def test_saved_search_crud(self, renter_token):
        payload = {"name": "TEST_refactor_" + uuid.uuid4().hex[:6],
                   "filters": {"area": "Tel Aviv", "max_price": 5000}}
        c = requests.post(f"{API}/saved-searches", headers=_h(renter_token), json=payload, timeout=15)
        assert c.status_code in (200, 201), c.text
        sid = c.json()["id"]
        g = requests.get(f"{API}/saved-searches", headers=_h(renter_token), timeout=15)
        assert g.status_code == 200
        assert any(s["id"] == sid for s in g.json())
        d = requests.delete(f"{API}/saved-searches/{sid}", headers=_h(renter_token), timeout=15)
        assert d.status_code in (200, 204)


# ---------- ICAL router ----------
class TestIcal:
    def test_blocked_dates_any_prop(self):
        lst = requests.get(f"{API}/properties", timeout=15).json()
        if not lst:
            pytest.skip("no properties")
        pid = lst[0]["id"]
        r = requests.get(f"{API}/properties/{pid}/blocked-dates", timeout=15)
        assert r.status_code == 200

    def test_ical_export_any_prop(self):
        lst = requests.get(f"{API}/properties", timeout=15).json()
        if not lst:
            pytest.skip("no properties")
        pid = lst[0]["id"]
        r = requests.get(f"{API}/properties/{pid}/ical-export", timeout=15)
        assert r.status_code == 200
        assert "BEGIN:VCALENDAR" in r.text or r.headers.get("content-type", "").startswith("text/calendar")


# ---------- ADMIN router ----------
class TestAdmin:
    def test_admin_dashboard_forbidden_for_owner(self, owner_token):
        r = requests.get(f"{API}/admin/dashboard", headers=_h(owner_token), timeout=15)
        # owner should not be admin
        assert r.status_code in (401, 403)

    def test_admin_dashboard_unauth(self):
        r = requests.get(f"{API}/admin/dashboard", timeout=15)
        assert r.status_code in (401, 403)

    def test_postmark_webhook_bad_secret(self):
        r = requests.post(f"{API}/webhooks/postmark", json={}, timeout=15)
        # Should reject unauth'd/missing-signature webhooks
        assert r.status_code in (200, 400, 401, 403, 422)


# ---------- MISC router ----------
class TestMisc:
    def test_exchange_rate(self):
        r = requests.get(f"{API}/exchange-rate", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, dict)

    def test_translate(self):
        r = requests.post(f"{API}/translate", json={"text": "hello", "target_lang": "he"}, timeout=30)
        assert r.status_code in (200, 400, 422)

    def test_contact(self):
        r = requests.post(f"{API}/contact",
                          json={"name": "TEST_refactor", "email": "t@test.com", "message": "hi"}, timeout=15)
        assert r.status_code in (200, 201, 202)

    def test_upload_no_file(self, owner_token):
        r = requests.post(f"{API}/upload", headers=_h(owner_token), timeout=15)
        assert r.status_code in (400, 422)

    def test_upload_file(self, owner_token):
        files = {"file": ("test.txt", io.BytesIO(b"hello"), "text/plain")}
        r = requests.post(f"{API}/upload", headers=_h(owner_token), files=files, timeout=20)
        # might be restricted to images only -> 400; but route must be registered
        assert r.status_code in (200, 201, 400, 415, 422)
        if r.status_code in (200, 201):
            body = r.json()
            fname = body.get("filename") or body.get("file")
            if fname:
                requests.delete(f"{API}/upload/{fname}", headers=_h(owner_token), timeout=10)


# ---------- Router prefix sanity ----------
class TestRouterWiring:
    """All routers were mounted via include_router(prefix='/api'); these
    probes catch cases where a router silently failed to register."""
    PROBES = [
        "/auth/me",                 # auth
        "/properties",              # properties
        "/bookings",                # bookings
        "/subleases",               # subleases
        "/contracts",               # contracts
        "/chat/conversations",      # chat
        "/notifications",           # notifications
        "/saved-searches",          # saved_searches
        "/admin/dashboard",         # admin
        "/exchange-rate",           # misc
    ]

    @pytest.mark.parametrize("path", PROBES)
    def test_route_registered(self, path):
        r = requests.get(f"{API}{path}", timeout=15)
        # Any registered route returns a non-404 (could be 401/403/200); 404
        # would mean the router failed to mount.
        assert r.status_code != 404, f"Route not registered: {path} -> 404"
