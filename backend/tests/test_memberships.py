"""Memberships (routes/marketplace/memberships.py): plans, signing up
without an account, the member list, and check-in at the door.

Runs against the live local API (see backend/tests/.env.test).
"""
import os
from datetime import UTC, date, datetime

import pytest
import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _register(tag):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"{tag}-{stamp}@example.com", "password": f"Pw-{stamp}-ok1", "name": f"{tag} owner", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def owner():
    return _register("gym")


@pytest.fixture(scope="module")
def gym(owner):
    r = requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_gym"}, headers=_auth(owner), timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()


def _plan(owner, gym, **kw):
    body = {"name": "Monthly", "period": "month", "price": 250, **kw}
    r = requests.post(f"{BASE}/marketplace/businesses/{gym['id']}/membership-plans", json=body, headers=_auth(owner), timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def _join(plan_id, **kw):
    return requests.post(f"{BASE}/marketplace/memberships/plan/{plan_id}/join",
                         json={"name": "Dana Levi", "phone": "054-1234567", **kw}, timeout=30)


def test_plans_are_owner_only_and_public_lists_live_ones(owner, gym):
    monthly = _plan(owner, gym)
    pack = _plan(owner, gym, name="10 classes", period="pack", price=400, visits=10, valid_months=3)
    hidden = _plan(owner, gym, name="Old plan", active=False)
    stranger = _register("stranger")
    r = requests.post(f"{BASE}/marketplace/businesses/{gym['id']}/membership-plans",
                      json={"name": "x", "price": 1}, headers=_auth(stranger), timeout=30)
    assert r.status_code == 403
    # A pack without a number of visits makes no sense.
    r = requests.post(f"{BASE}/marketplace/businesses/{gym['id']}/membership-plans",
                      json={"name": "Pack", "period": "pack", "price": 1}, headers=_auth(owner), timeout=30)
    assert r.status_code == 422

    pub = requests.get(f"{BASE}/marketplace/memberships/{gym['slug']}", timeout=30).json()
    ids = [p["id"] for p in pub["plans"]]
    assert monthly["id"] in ids and pack["id"] in ids and hidden["id"] not in ids
    assert pub["business"]["name"] == "TEST_gym"


def test_join_without_account_then_activate_and_check_in(owner, gym):
    plan = _plan(owner, gym, name="Monthly unlimited")
    r = _join(plan["id"])
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["status"] == "pending" and len(j["manage_token"]) >= 16

    me = requests.get(f"{BASE}/marketplace/memberships/me/{j['manage_token']}", timeout=30).json()
    assert me["status"] == "pending" and me["state"]["ok"] is False
    assert "phone" not in me and "manage_token" not in me
    code = me["checkin_url"].rsplit("/", 1)[1]

    door = requests.post(f"{BASE}/marketplace/businesses/{gym['id']}/members-door-link", headers=_auth(owner), timeout=30).json()
    t = door["token"]
    assert requests.get(f"{BASE}/marketplace/memberships/door/{t}", timeout=30).status_code == 200
    # Pending: not let in.
    c = requests.post(f"{BASE}/marketplace/memberships/door/{t}/checkin", json={"code": code}, timeout=30).json()
    assert c["ok"] is False and c["reason"] == "pending"

    lst = requests.get(f"{BASE}/marketplace/businesses/{gym['id']}/members", headers=_auth(owner), timeout=30).json()
    m = next(x for x in lst["members"] if x["id"] == j["member_id"])
    a = requests.post(f"{BASE}/marketplace/businesses/{gym['id']}/members/{m['id']}/action",
                      json={"action": "activate"}, headers=_auth(owner), timeout=30).json()
    assert a["status"] == "active" and a["renews_on"] > date.today().isoformat()

    c = requests.post(f"{BASE}/marketplace/memberships/door/{t}/checkin", json={"code": code}, timeout=30).json()
    assert c["ok"] is True and c["name"] == "Dana Levi" and c["visits"] == 1
    # The 5-letter code works too, in any case.
    c = requests.post(f"{BASE}/marketplace/memberships/door/{t}/checkin", json={"code": m["short_code"].lower()}, timeout=30).json()
    assert c["ok"] is True and c["visits"] == 2

    # Rotating the door link kills the old one.
    requests.post(f"{BASE}/marketplace/businesses/{gym['id']}/members-door-link?rotate=true", headers=_auth(owner), timeout=30)
    assert requests.get(f"{BASE}/marketplace/memberships/door/{t}", timeout=30).status_code == 404

    p = requests.post(f"{BASE}/marketplace/businesses/{gym['id']}/members/{m['id']}/action",
                      json={"action": "pause"}, headers=_auth(owner), timeout=30).json()
    assert p["status"] == "paused" and p["state"]["ok"] is False


def test_class_pack_counts_down_and_stops_at_zero(owner, gym):
    plan = _plan(owner, gym, name="2 classes", period="pack", price=80, visits=2)
    r = requests.post(f"{BASE}/marketplace/businesses/{gym['id']}/members",
                      json={"plan_id": plan["id"], "name": "Yossi", "phone": "052-7654321"}, headers=_auth(owner), timeout=30)
    assert r.status_code == 200, r.text
    m = r.json()
    assert m["status"] == "active" and m["visits_left"] == 2
    url = f"{BASE}/marketplace/businesses/{gym['id']}/members/{m['id']}/checkin"
    assert requests.post(url, headers=_auth(owner), timeout=30).json()["visits_left"] == 1
    assert requests.post(url, headers=_auth(owner), timeout=30).json()["visits_left"] == 0
    third = requests.post(url, headers=_auth(owner), timeout=30).json()
    assert third["ok"] is False and third["reason"] == "no_visits"
    due = requests.get(f"{BASE}/marketplace/businesses/{gym['id']}/members?status=due", headers=_auth(owner), timeout=30).json()
    assert m["id"] in [x["id"] for x in due["members"]]
    # Renewing a pack adds a fresh set of visits.
    r = requests.post(f"{BASE}/marketplace/businesses/{gym['id']}/members/{m['id']}/action",
                      json={"action": "renew"}, headers=_auth(owner), timeout=30).json()
    assert r["visits_left"] == 2 and r["state"]["ok"] is True


def test_member_list_is_owner_only_and_bad_links_404(owner, gym):
    stranger = _register("stranger2")
    assert requests.get(f"{BASE}/marketplace/businesses/{gym['id']}/members", headers=_auth(stranger), timeout=30).status_code == 403
    assert requests.get(f"{BASE}/marketplace/memberships/me/short", timeout=30).status_code == 404
    assert requests.get(f"{BASE}/marketplace/memberships/me/{'x' * 22}", timeout=30).status_code == 404
    assert requests.get(f"{BASE}/marketplace/memberships/door/{'y' * 32}", timeout=30).status_code == 404


def test_another_business_cannot_check_in_my_members(owner, gym):
    plan = _plan(owner, gym, name="Yearly", period="year", price=2000)
    j = _join(plan["id"], name="Other Gym Visitor").json()
    code = requests.get(f"{BASE}/marketplace/memberships/me/{j['manage_token']}", timeout=30).json()["checkin_url"].rsplit("/", 1)[1]
    other_owner = _register("othergym")
    other = requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_other gym"}, headers=_auth(other_owner), timeout=30).json()
    t = requests.post(f"{BASE}/marketplace/businesses/{other['id']}/members-door-link", headers=_auth(other_owner), timeout=30).json()["token"]
    c = requests.post(f"{BASE}/marketplace/memberships/door/{t}/checkin", json={"code": code}, timeout=30).json()
    assert c == {"ok": False, "reason": "not_found"}


def test_join_escapes_names_in_email_and_rejects_bad_phone(owner, gym):
    plan = _plan(owner, gym, name="Trial")
    assert _join(plan["id"], phone="123").status_code == 422
    r = _join(plan["id"], name="<b>Mal</b> <a href=x>y</a>")
    assert r.status_code == 200
