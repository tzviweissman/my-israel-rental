"""Staff accounts (routes/marketplace/staff.py + utils/business_access.py):
an invite is for the email it was sent to; staff open only their areas;
the owner's own settings and the staff list stay the owner's; removing
someone cuts them off at once.

Runs against the live local API (see backend/tests/.env.test).
"""
import os
import sys
from datetime import UTC, datetime

import pytest
import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _account(tag):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    email = f"{tag}-{stamp}@example.com"
    r = requests.post(f"{BASE}/auth/register", json={
        "email": email, "password": f"Pw-{stamp}-ok1", "name": f"{tag} person", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"], email


def _token_for(staff_id):
    """The invite link is emailed; the test reads the token from the database."""
    from pymongo import MongoClient
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    return db.business_staff.find_one({"_id": staff_id})["invite_token"]


@pytest.fixture(scope="module")
def setup():
    owner, _ = _account("staffowner")
    biz = requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_staff gym"}, headers=_auth(owner), timeout=30).json()
    worker, worker_email = _account("staffworker")
    other, _ = _account("staffother")
    return {"owner": owner, "biz": biz["id"], "worker": worker, "worker_email": worker_email, "other": other}


def test_invite_accept_and_access(setup):
    s = setup
    url = f"{BASE}/marketplace/businesses/{s['biz']}"
    # Before: nothing.
    assert requests.get(f"{url}/members", headers=_auth(s["worker"]), timeout=30).status_code == 403
    # Only the owner invites.
    r = requests.post(f"{url}/staff", json={"email": s["worker_email"], "permissions": ["members"]}, headers=_auth(s["other"]), timeout=30)
    assert r.status_code == 403
    r = requests.post(f"{url}/staff", json={"email": s["worker_email"].upper(), "permissions": ["members", "bogus"]},
                      headers=_auth(s["owner"]), timeout=30)
    assert r.status_code == 200, r.text
    staff_id = r.json()["id"]
    assert r.json()["permissions"] == ["members"]
    tok = _token_for(staff_id)
    info = requests.get(f"{BASE}/marketplace/staff/invite/{tok}", timeout=30).json()
    assert info["email"] == s["worker_email"] and info["permissions"] == ["members"]

    # The link alone is not enough: someone else signed in cannot take it.
    r = requests.post(f"{BASE}/marketplace/staff/invite/{tok}/accept", headers=_auth(s["other"]), timeout=30)
    assert r.status_code == 403
    r = requests.post(f"{BASE}/marketplace/staff/invite/{tok}/accept", headers=_auth(s["worker"]), timeout=30)
    assert r.status_code == 200, r.text

    # Their area: yes. Others: no. The owner's own things: no.
    assert requests.get(f"{url}/members", headers=_auth(s["worker"]), timeout=30).status_code == 200
    assert requests.post(f"{url}/membership-plans", json={"name": "Monthly", "price": 100}, headers=_auth(s["worker"]), timeout=30).status_code == 200
    assert requests.get(f"{url}/orders", headers=_auth(s["worker"]), timeout=30).status_code == 403
    assert requests.get(f"{url}/customer-list", headers=_auth(s["worker"]), timeout=30).status_code == 403
    assert requests.get(f"{url}/summary", headers=_auth(s["worker"]), timeout=30).status_code == 403
    assert requests.get(f"{url}/staff", headers=_auth(s["worker"]), timeout=30).status_code == 403
    assert requests.put(f"{url}/orders/settings", json={}, headers=_auth(s["worker"]), timeout=30).status_code in (403, 422)

    places = requests.get(f"{BASE}/marketplace/my-workplaces", params={"perm": "members"}, headers=_auth(s["worker"]), timeout=30).json()
    assert [p["id"] for p in places] == [s["biz"]] and places[0]["role"] == "staff"
    assert requests.get(f"{BASE}/marketplace/my-workplaces", params={"perm": "orders"}, headers=_auth(s["worker"]), timeout=30).json() == []
    summ = requests.get(f"{BASE}/dashboard/summary", headers=_auth(s["worker"]), timeout=30).json()
    assert summ["staff_permissions"] == ["members"]

    # More areas, then removed: cut off at once.
    r = requests.patch(f"{url}/staff/{staff_id}", json={"permissions": ["orders", "messages"]}, headers=_auth(s["owner"]), timeout=30)
    assert r.json()["permissions"] == ["orders", "customers", "messages"]     # messages brings the customer list
    assert requests.get(f"{url}/orders", headers=_auth(s["worker"]), timeout=30).status_code == 200
    assert requests.get(f"{url}/members", headers=_auth(s["worker"]), timeout=30).status_code == 403
    requests.delete(f"{url}/staff/{staff_id}", headers=_auth(s["owner"]), timeout=30)
    assert requests.get(f"{url}/orders", headers=_auth(s["worker"]), timeout=30).status_code == 403
    assert requests.get(f"{BASE}/marketplace/staff/invite/{tok}", timeout=30).status_code == 404


def test_owner_still_has_everything(setup):
    s = setup
    url = f"{BASE}/marketplace/businesses/{s['biz']}"
    for path in ("members", "orders", "customer-list", "summary", "staff", "discount-codes"):
        assert requests.get(f"{url}/{path}", headers=_auth(s["owner"]), timeout=30).status_code == 200, path


def test_checkin_only_role(setup):
    s = setup
    url = f"{BASE}/marketplace/businesses/{s['biz']}"
    plan = requests.post(f"{url}/membership-plans", json={"name": "Monthly", "price": 100}, headers=_auth(s["owner"]), timeout=30).json()
    m = requests.post(f"{url}/members", json={"plan_id": plan["id"], "name": "Door Test", "phone": "0549990000", "email": "door@example.com"},
                      headers=_auth(s["owner"]), timeout=30).json()
    requests.post(f"{url}/members-door-link", headers=_auth(s["owner"]), timeout=30)
    door, door_email = _account("staffdoor")
    r = requests.post(f"{url}/staff", json={"email": door_email, "permissions": ["checkin"]}, headers=_auth(s["owner"]), timeout=30)
    assert r.status_code == 200 and r.json()["permissions"] == ["checkin"]
    requests.post(f"{BASE}/marketplace/staff/invite/{_token_for(r.json()['id'])}/accept", headers=_auth(door), timeout=30)

    lst = requests.get(f"{url}/members", headers=_auth(door), timeout=30)
    assert lst.status_code == 200
    row = next(x for x in lst.json()["members"] if x["id"] == m["id"])
    assert "phone" not in row and "email" not in row and "answers" not in row and row["name"] == "Door Test"
    assert requests.get(f"{url}/members-door-link", headers=_auth(door), timeout=30).json()["token"]
    c = requests.post(f"{url}/members/{m['id']}/checkin", headers=_auth(door), timeout=30).json()
    assert c["ok"] is True
    # Not the rest of Members.
    assert requests.post(f"{url}/membership-plans", json={"name": "X", "price": 1}, headers=_auth(door), timeout=30).status_code == 403
    assert requests.post(f"{url}/members/{m['id']}/action", json={"action": "cancel"}, headers=_auth(door), timeout=30).status_code == 403
    assert requests.post(f"{url}/members-door-link", params={"rotate": True}, headers=_auth(door), timeout=30).status_code == 403
    assert requests.get(f"{url}/membership-plans", headers=_auth(door), timeout=30).status_code == 403
    places = requests.get(f"{BASE}/marketplace/my-workplaces", params={"perm": "checkin"}, headers=_auth(door), timeout=30).json()
    assert [p["id"] for p in places] == [s["biz"]]
    # A manager with Members gets check-in too, and the full list.
    mgr, mgr_email = _account("staffmgr")
    r = requests.post(f"{url}/staff", json={"email": mgr_email, "permissions": ["members", "checkin"]}, headers=_auth(s["owner"]), timeout=30)
    assert r.json()["permissions"] == ["members"]
    requests.post(f"{BASE}/marketplace/staff/invite/{_token_for(r.json()['id'])}/accept", headers=_auth(mgr), timeout=30)
    row = next(x for x in requests.get(f"{url}/members", headers=_auth(mgr), timeout=30).json()["members"] if x["id"] == m["id"])
    assert row["phone"]
    assert requests.post(f"{url}/members/{m['id']}/checkin", headers=_auth(mgr), timeout=30).json()["ok"] is True
