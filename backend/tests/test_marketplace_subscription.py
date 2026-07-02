"""Backend tests for Services Marketplace Phase 1b: real PayPal
Recurring Subscription (Sandbox, $25/mo).

Covers /subscription/upgrade, /subscription/activate,
/subscription/cancel, and the handle_subscription_webhook_event helper.
"""
from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime

import pytest
import requests

sys.path.insert(0, "/app/backend")


def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
    if url:
        return url
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except FileNotFoundError:
        pass
    return "http://localhost:8001"


BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api/marketplace"


def _login(email: str, password: str) -> str:
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=30,
    )
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"no token in {data}"
    return tok


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def owner_token():
    return _login("owner@test.com", "Test1234!")


@pytest.fixture(scope="module")
def owner_user_id(owner_token):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(owner_token), timeout=15)
    assert r.status_code == 200
    return r.json().get("id") or r.json().get("user_id")


# --- Direct DB access using SYNC pymongo to sidestep motor's event-loop binding ---
@pytest.fixture(scope="module")
def db():
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
    from pymongo import MongoClient
    client = MongoClient(os.environ["MONGO_URL"])
    return client[os.environ["DB_NAME"]]


def _reset_provider_subscription(db, user_id: str):
    db.marketplace_providers.update_one(
        {"user_id": user_id},
        {"$unset": {
            "paypal_subscription_id": "",
            "paypal_subscription_status": "",
            "pending_since": "",
            "cancelled_at": "",
            "subscribed_until": "",
            "activated_at": "",
        }, "$set": {"subscription_status": "trial"}},
    )


# ---------- /upgrade ----------

class TestUpgrade:
    def test_upgrade_unauthenticated_rejected(self):
        r = requests.post(f"{API}/subscription/upgrade", timeout=15)
        assert r.status_code in (401, 403), f"got {r.status_code}: {r.text}"

    def test_upgrade_returns_approval_url_and_sets_pending_row(self, owner_token, owner_user_id, db):
        _reset_provider_subscription(db, owner_user_id)

        r = requests.post(f"{API}/subscription/upgrade", headers=_h(owner_token), timeout=45)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["subscription_id"].startswith("I-")
        assert "sandbox.paypal.com" in body["approval_url"]
        assert body["amount"] == 25.0
        assert body["currency"] == "USD"

        prov = db.marketplace_providers.find_one({"user_id": owner_user_id})
        assert prov["paypal_subscription_id"] == body["subscription_id"]
        assert prov["paypal_subscription_status"] == "APPROVAL_PENDING"
        assert prov.get("pending_since")
        datetime.fromisoformat(prov["pending_since"])

    def test_upgrade_reuses_cached_plan_id(self, owner_token, db):
        before = db.marketplace_settings.find_one({"_id": "paypal_plan"})
        assert before and before.get("plan_id", "").startswith("P-")
        pid_before = before["plan_id"]
        prod_before = before["product_id"]

        r = requests.post(f"{API}/subscription/upgrade", headers=_h(owner_token), timeout=45)
        assert r.status_code == 200, r.text

        after = db.marketplace_settings.find_one({"_id": "paypal_plan"})
        assert after["plan_id"] == pid_before
        assert after["product_id"] == prod_before


# ---------- /activate ----------

class TestActivate:
    def test_activate_before_paypal_approval_returns_pending(self, owner_token):
        r_up = requests.post(f"{API}/subscription/upgrade", headers=_h(owner_token), timeout=45)
        assert r_up.status_code == 200

        r = requests.post(f"{API}/subscription/activate", headers=_h(owner_token), timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is False
        assert body["status"] == "APPROVAL_PENDING"
        assert "APPROVAL_PENDING" in body["message"]

    def test_activate_without_pending_subscription_returns_400(self, owner_token, owner_user_id, db):
        _reset_provider_subscription(db, owner_user_id)
        r = requests.post(f"{API}/subscription/activate", headers=_h(owner_token), timeout=15)
        assert r.status_code == 400, r.text
        assert "No pending subscription" in r.text


# ---------- /cancel ----------

class TestCancel:
    def test_cancel_with_no_active_subscription_returns_400(self, owner_token, owner_user_id, db):
        _reset_provider_subscription(db, owner_user_id)
        r = requests.post(f"{API}/subscription/cancel", headers=_h(owner_token), timeout=15)
        assert r.status_code == 400, r.text
        assert "No active subscription" in r.text

    def test_cancel_pending_subscription_is_idempotent(self, owner_token, owner_user_id, db):
        r_up = requests.post(f"{API}/subscription/upgrade", headers=_h(owner_token), timeout=45)
        assert r_up.status_code == 200

        r = requests.post(f"{API}/subscription/cancel", headers=_h(owner_token), timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True

        prov = db.marketplace_providers.find_one({"user_id": owner_user_id})
        assert prov["paypal_subscription_status"] == "CANCELLED"
        assert prov.get("cancelled_at")


# ---------- Webhook side-effect helper (direct async invocation) ----------

_WEBHOOK_LOOP = None


def _run_async(coro):
    """Reuse a single module-level event loop so motor's client (which
    binds to the first loop) stays valid across multiple webhook tests."""
    global _WEBHOOK_LOOP
    if _WEBHOOK_LOOP is None or _WEBHOOK_LOOP.is_closed():
        _WEBHOOK_LOOP = asyncio.new_event_loop()
    return _WEBHOOK_LOOP.run_until_complete(coro)


class TestWebhookHandler:
    def test_billing_subscription_activated_flips_provider_active(self, owner_user_id, db):
        fake_sub_id = "I-FAKETESTSUB123"
        db.marketplace_providers.update_one(
            {"user_id": owner_user_id},
            {"$set": {
                "paypal_subscription_id": fake_sub_id,
                "paypal_subscription_status": "APPROVAL_PENDING",
                "subscription_status": "trial",
            }},
        )

        async def go():
            from routes.marketplace import handle_subscription_webhook_event
            await handle_subscription_webhook_event({
                "event_type": "BILLING.SUBSCRIPTION.ACTIVATED",
                "resource": {"id": fake_sub_id},
            })
        _run_async(go())

        prov = db.marketplace_providers.find_one({"user_id": owner_user_id})
        assert prov["subscription_status"] == "active"
        assert prov["paypal_subscription_status"] == "ACTIVE"
        assert prov.get("activated_at")

    def test_billing_subscription_cancelled_marks_cancelled(self, owner_user_id, db):
        fake_sub_id = "I-FAKETESTSUB456"
        db.marketplace_providers.update_one(
            {"user_id": owner_user_id},
            {"$set": {
                "paypal_subscription_id": fake_sub_id,
                "paypal_subscription_status": "ACTIVE",
                "subscription_status": "active",
            }},
        )

        async def go():
            from routes.marketplace import handle_subscription_webhook_event
            await handle_subscription_webhook_event({
                "event_type": "BILLING.SUBSCRIPTION.CANCELLED",
                "resource": {"id": fake_sub_id},
            })
        _run_async(go())

        prov = db.marketplace_providers.find_one({"user_id": owner_user_id})
        assert prov["paypal_subscription_status"] == "CANCELLED"
        assert prov.get("cancelled_at")

    def test_payment_sale_completed_routes_via_billing_agreement_id(self, owner_user_id, db):
        fake_sub_id = "I-FAKETESTSUB789"
        db.marketplace_providers.update_one(
            {"user_id": owner_user_id},
            {"$set": {
                "paypal_subscription_id": fake_sub_id,
                "paypal_subscription_status": "ACTIVE",
                "subscription_status": "active",
            }, "$unset": {"last_renewal_at": ""}},
        )

        async def go():
            from routes.marketplace import handle_subscription_webhook_event
            await handle_subscription_webhook_event({
                "event_type": "PAYMENT.SALE.COMPLETED",
                "resource": {"id": "SALE-XYZ", "billing_agreement_id": fake_sub_id},
            })
        _run_async(go())

        prov = db.marketplace_providers.find_one({"user_id": owner_user_id})
        assert prov.get("last_renewal_at"), "webhook did not record last_renewal_at"

    def test_webhook_no_matching_provider_is_noop(self):
        async def go():
            from routes.marketplace import handle_subscription_webhook_event
            await handle_subscription_webhook_event({
                "event_type": "BILLING.SUBSCRIPTION.ACTIVATED",
                "resource": {"id": "I-NOSUCHSUB000000"},
            })
        _run_async(go())


# ---------- Final teardown ----------

@pytest.fixture(scope="module", autouse=True)
def _restore_owner_active(db, owner_user_id):
    yield
    db.marketplace_providers.update_one(
        {"user_id": owner_user_id},
        {"$set": {
            "subscription_status": "active",
            "subscribed_until": "2026-12-31T00:00:00+00:00",
        }},
    )
