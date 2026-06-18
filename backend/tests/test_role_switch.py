"""Regression test for PUT /auth/role — self-service renter→owner
upgrade for users who picked the wrong role at signup. Other role
flips must be rejected to avoid orphaning listings or escalating
privileges.
"""
import os
import asyncio
import requests
from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
RENTER_EMAIL = os.environ.get("TEST_RENTER_EMAIL", "renter@test.com")
RENTER_PASSWORD = os.environ.get("TEST_RENTER_PASSWORD", "Test1234!")
ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "admin@rental.com")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "Admin1234!")


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password})
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text}"
    return r.json()["token"], r.json()["user"]


def _reset_to_renter(email):
    """Always leave the renter test account at role=renter so subsequent
    tests can run."""
    env = dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env"))
    async def go():
        c = AsyncIOMotorClient(env["MONGO_URL"])
        db = c[env["DB_NAME"]]
        await db.users.update_one({"email": email}, {"$set": {"role": "renter"}})
        c.close()
    asyncio.run(go())


def test_renter_can_switch_to_owner():
    if not BASE_URL:
        return
    token, user = _login(RENTER_EMAIL, RENTER_PASSWORD)
    assert user["role"] == "renter"
    try:
        r = requests.put(f"{BASE_URL}/api/auth/role",
            json={"role": "owner"},
            headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        body = r.json()
        assert body["user"]["role"] == "owner"
        # New token reflects the new role
        assert body["token"] != token
        r2 = requests.get(f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {body['token']}"})
        assert r2.status_code == 200
        assert r2.json()["role"] == "owner"
    finally:
        _reset_to_renter(RENTER_EMAIL)


def test_owner_can_switch_back_to_renter():
    """Owners must be able to demote themselves to renter (their listings
    stay in the DB; they just won't see the listing-management dashboard
    until they switch back)."""
    if not BASE_URL:
        return
    token, _ = _login(RENTER_EMAIL, RENTER_PASSWORD)
    try:
        # First become owner
        r = requests.put(f"{BASE_URL}/api/auth/role",
            json={"role": "owner"},
            headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        owner_token = r.json()["token"]
        # Now switch back to renter
        r = requests.put(f"{BASE_URL}/api/auth/role",
            json={"role": "renter"},
            headers={"Authorization": f"Bearer {owner_token}"})
        assert r.status_code == 200, f"owner→renter: {r.status_code} {r.text}"
        body = r.json()
        assert body["user"]["role"] == "renter"
        r2 = requests.get(f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {body['token']}"})
        assert r2.json()["role"] == "renter"
    finally:
        _reset_to_renter(RENTER_EMAIL)


def test_manager_can_step_down_to_renter():
    """Managers can switch themselves to renter via the same endpoint."""
    if not BASE_URL:
        return
    # Promote our test renter to manager directly via DB, then switch.
    env = dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env"))
    async def set_manager():
        c = AsyncIOMotorClient(env["MONGO_URL"])
        db = c[env["DB_NAME"]]
        await db.users.update_one({"email": RENTER_EMAIL}, {"$set": {"role": "manager"}})
        c.close()
    asyncio.run(set_manager())
    try:
        token, user = _login(RENTER_EMAIL, RENTER_PASSWORD)
        assert user["role"] == "manager"
        r = requests.put(f"{BASE_URL}/api/auth/role",
            json={"role": "renter"},
            headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200, f"manager→renter: {r.status_code} {r.text}"
        assert r.json()["user"]["role"] == "renter"
    finally:
        _reset_to_renter(RENTER_EMAIL)


def test_manager_cannot_self_promote_to_owner():
    """Manager → owner is NOT in the allowed transition set — only
    manager → renter is permitted to avoid sideways privilege changes."""
    if not BASE_URL:
        return
    env = dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env"))
    async def set_manager():
        c = AsyncIOMotorClient(env["MONGO_URL"])
        db = c[env["DB_NAME"]]
        await db.users.update_one({"email": RENTER_EMAIL}, {"$set": {"role": "manager"}})
        c.close()
    asyncio.run(set_manager())
    try:
        token, _ = _login(RENTER_EMAIL, RENTER_PASSWORD)
        r = requests.put(f"{BASE_URL}/api/auth/role",
            json={"role": "owner"},
            headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 400
        assert "not allowed" in r.json()["detail"].lower()
    finally:
        _reset_to_renter(RENTER_EMAIL)


def test_double_upgrade_rejected():
    if not BASE_URL:
        return
    # First upgrade to owner
    token, _ = _login(RENTER_EMAIL, RENTER_PASSWORD)
    try:
        r = requests.put(f"{BASE_URL}/api/auth/role",
            json={"role": "owner"},
            headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        new_token = r.json()["token"]
        # Second attempt with the fresh owner token → 400
        r = requests.put(f"{BASE_URL}/api/auth/role",
            json={"role": "owner"},
            headers={"Authorization": f"Bearer {new_token}"})
        assert r.status_code == 400
        assert "already" in r.json()["detail"].lower()
    finally:
        _reset_to_renter(RENTER_EMAIL)


def test_only_renter_or_owner_target_allowed():
    """Target must be 'renter' or 'owner' — no self-promotion to manager
    or admin."""
    if not BASE_URL:
        return
    token, _ = _login(RENTER_EMAIL, RENTER_PASSWORD)
    try:
        # Renter → admin must be rejected (privilege boundary)
        r = requests.put(f"{BASE_URL}/api/auth/role",
            json={"role": "admin"},
            headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 400
        # Renter → manager must be rejected
        r = requests.put(f"{BASE_URL}/api/auth/role",
            json={"role": "manager"},
            headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 400
    finally:
        _reset_to_renter(RENTER_EMAIL)


def test_admin_cannot_self_flip_role():
    """Privilege boundary — admins and managers must not be able to
    change their role via this endpoint."""
    if not BASE_URL:
        return
    token, user = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    assert user["role"] == "admin"
    r = requests.put(f"{BASE_URL}/api/auth/role",
        json={"role": "owner"},
        headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403
    assert "admin" in r.json()["detail"].lower()


def test_auth_required():
    if not BASE_URL:
        return
    r = requests.put(f"{BASE_URL}/api/auth/role", json={"role": "owner"})
    assert r.status_code in (401, 403)
