"""Backend tests for the PayPal payments router.

Covers:
- /api/payments/orders create flow for document_service & sublease_booking
- Server-side amount computation (single $150, bundle $250, sublease 2.5%)
- Validation errors (empty services, unknown product_type, unsupported currency, negative amount)
- /api/payments/orders/{id} ACL (own / forbidden / not found)
- /api/payments/my filtering by user
- /api/payments/orders/{id}/capture failing gracefully (502) before approval
"""
from __future__ import annotations

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://where-am-i-project.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

RENTER_EMAIL = "renter@test.com"
RENTER_PASSWORD = "Test1234!"
OWNER_EMAIL = "owner@test.com"
OWNER_PASSWORD = "Test1234!"


# ---------- Auth helpers -----------------------------------------------------

def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in login response: {data}"
    return token


@pytest.fixture(scope="module")
def renter_token() -> str:
    return _login(RENTER_EMAIL, RENTER_PASSWORD)


@pytest.fixture(scope="module")
def owner_token() -> str:
    return _login(OWNER_EMAIL, OWNER_PASSWORD)


@pytest.fixture
def renter_headers(renter_token):
    return {"Authorization": f"Bearer {renter_token}", "Content-Type": "application/json"}


@pytest.fixture
def owner_headers(owner_token):
    return {"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"}


# ---------- Document service: amount + persistence --------------------------

class TestDocumentServiceOrders:
    def test_single_service_arnona_returns_150_and_persists(self, renter_headers):
        payload = {
            "product_type": "document_service",
            "metadata": {
                "services": ["arnona_discount"],
                "property_address": "TEST_addr Dizengoff 10",
                "tenant_name": "TEST Tenant",
                "details": {"tenant_id": "TEST_123"},
            },
        }
        r = requests.post(f"{API}/payments/orders", json=payload, headers=renter_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["amount"] == 150.0
        assert data["currency"] == "USD"
        assert data["status"] == "created"
        assert data["paypal_order_id"] and isinstance(data["paypal_order_id"], str)
        # PayPal order ids are typically 17-char uppercase alphanumeric
        assert len(data["paypal_order_id"]) >= 10
        # GET it back to confirm persistence
        gid = data["id"]
        g = requests.get(f"{API}/payments/orders/{gid}", headers=renter_headers, timeout=15)
        assert g.status_code == 200
        gdata = g.json()
        assert gdata["amount"] == 150.0
        assert gdata["product_type"] == "document_service"
        assert gdata["user_id"]

    def test_bundle_returns_250(self, renter_headers):
        payload = {
            "product_type": "document_service",
            "metadata": {
                "services": ["arnona_discount", "property_name_change"],
                "property_address": "TEST_addr 2",
                "tenant_name": "TEST Bundle",
                "details": {"tenant_id": "TEST_456"},
            },
        }
        r = requests.post(f"{API}/payments/orders", json=payload, headers=renter_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["amount"] == 250.0
        assert data["currency"] == "USD"
        assert "Arnona" in data["description"] or "service" in data["description"].lower()

    def test_empty_services_returns_400(self, renter_headers):
        payload = {"product_type": "document_service", "metadata": {"services": []}}
        r = requests.post(f"{API}/payments/orders", json=payload, headers=renter_headers, timeout=15)
        assert r.status_code == 400
        body = r.json()
        msg = (body.get("detail") or body.get("error") or body.get("message") or "").lower()
        assert "service" in msg

    def test_invalid_services_only_returns_400(self, renter_headers):
        payload = {"product_type": "document_service", "metadata": {"services": ["bogus_thing"]}}
        r = requests.post(f"{API}/payments/orders", json=payload, headers=renter_headers, timeout=15)
        assert r.status_code == 400


# ---------- Sublease booking: 2.5% fee --------------------------------------

class TestSubleaseBookingOrders:
    def test_2_5_percent_of_2000_is_50(self, renter_headers):
        payload = {
            "product_type": "sublease_booking",
            "metadata": {
                "sublease_id": "TEST_SUBLEASE_ID_0001",
                "booking_id": "TEST_BOOKING_ID_0001",
                "booking_amount": 2000,
                "currency": "USD",
            },
        }
        r = requests.post(f"{API}/payments/orders", json=payload, headers=renter_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["amount"] == 50.0
        assert data["currency"] == "USD"

    def test_negative_booking_amount_returns_400(self, renter_headers):
        payload = {
            "product_type": "sublease_booking",
            "metadata": {"sublease_id": "x", "booking_amount": -10, "currency": "USD"},
        }
        r = requests.post(f"{API}/payments/orders", json=payload, headers=renter_headers, timeout=15)
        assert r.status_code == 400

    def test_zero_booking_amount_returns_400(self, renter_headers):
        payload = {
            "product_type": "sublease_booking",
            "metadata": {"sublease_id": "x", "booking_amount": 0, "currency": "USD"},
        }
        r = requests.post(f"{API}/payments/orders", json=payload, headers=renter_headers, timeout=15)
        assert r.status_code == 400

    def test_eur_currency_returns_400(self, renter_headers):
        payload = {
            "product_type": "sublease_booking",
            "metadata": {"sublease_id": "x", "booking_amount": 1000, "currency": "EUR"},
        }
        r = requests.post(f"{API}/payments/orders", json=payload, headers=renter_headers, timeout=15)
        assert r.status_code == 400

    def test_unknown_product_type_returns_400(self, renter_headers):
        payload = {"product_type": "magic_beans", "metadata": {}}
        r = requests.post(f"{API}/payments/orders", json=payload, headers=renter_headers, timeout=15)
        assert r.status_code == 400


# ---------- ACL: GET /payments/orders/{id} & /payments/my -------------------

class TestOrderAccessControl:
    def test_get_my_order_ok(self, renter_headers):
        r = requests.post(
            f"{API}/payments/orders",
            json={"product_type": "document_service", "metadata": {"services": ["arnona_discount"]}},
            headers=renter_headers,
            timeout=30,
        )
        assert r.status_code == 200
        oid = r.json()["id"]
        g = requests.get(f"{API}/payments/orders/{oid}", headers=renter_headers, timeout=15)
        assert g.status_code == 200
        assert g.json()["id"] == oid

    def test_other_user_cannot_read_order(self, renter_headers, owner_headers):
        r = requests.post(
            f"{API}/payments/orders",
            json={"product_type": "document_service", "metadata": {"services": ["arnona_discount"]}},
            headers=renter_headers,
            timeout=30,
        )
        assert r.status_code == 200
        oid = r.json()["id"]
        # Owner is a different user, not admin -> should be 403
        g = requests.get(f"{API}/payments/orders/{oid}", headers=owner_headers, timeout=15)
        assert g.status_code in (403, 404), f"Expected 403/404, got {g.status_code} {g.text}"

    def test_unknown_order_id_returns_404(self, renter_headers):
        g = requests.get(f"{API}/payments/orders/does-not-exist-xyz", headers=renter_headers, timeout=15)
        assert g.status_code == 404

    def test_payments_my_returns_only_caller_orders(self, renter_headers, owner_headers):
        # Renter creates one
        r = requests.post(
            f"{API}/payments/orders",
            json={"product_type": "document_service", "metadata": {"services": ["arnona_discount"]}},
            headers=renter_headers,
            timeout=30,
        )
        assert r.status_code == 200
        renter_oid = r.json()["id"]
        # Renter's own list contains it
        mine = requests.get(f"{API}/payments/my", headers=renter_headers, timeout=15)
        assert mine.status_code == 200
        ids = [o["id"] for o in mine.json()]
        assert renter_oid in ids
        # Owner's list does NOT contain it
        owner_mine = requests.get(f"{API}/payments/my", headers=owner_headers, timeout=15)
        assert owner_mine.status_code == 200
        owner_ids = [o["id"] for o in owner_mine.json()]
        assert renter_oid not in owner_ids


# ---------- Capture endpoint (pre-approval -> 502) --------------------------

class TestCaptureBeforeApproval:
    def test_capture_unapproved_order_returns_502(self, renter_headers):
        # Create order
        r = requests.post(
            f"{API}/payments/orders",
            json={"product_type": "document_service", "metadata": {"services": ["arnona_discount"]}},
            headers=renter_headers,
            timeout=30,
        )
        assert r.status_code == 200
        oid = r.json()["id"]
        # Capture without buyer approval -> PayPal returns 4xx -> backend wraps as 502
        c = requests.post(f"{API}/payments/orders/{oid}/capture", headers=renter_headers, timeout=30)
        assert c.status_code == 502, f"Expected 502 from unapproved capture, got {c.status_code} {c.text}"


# ---------- Auth requirement -------------------------------------------------

class TestAuthRequired:
    def test_create_order_without_token_is_401_or_403(self):
        r = requests.post(
            f"{API}/payments/orders",
            json={"product_type": "document_service", "metadata": {"services": ["arnona_discount"]}},
            headers={"Content-Type": "application/json"},
            timeout=15,
        )
        assert r.status_code in (401, 403)

    def test_my_orders_without_token(self):
        r = requests.get(f"{API}/payments/my", timeout=15)
        assert r.status_code in (401, 403)
