"""Punch cards (memberships.py, period "card"): free to join and active at
once, each check-in adds a stamp, the visit that fills the card earns the
reward and starts a new card.

Runs against the live local API (see backend/tests/.env.test).
"""
import os
from datetime import UTC, datetime

import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _owner(tag):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"{tag}-{stamp}@example.com", "password": f"Pw-{stamp}-ok1", "name": f"{tag} owner", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


def test_punch_card_earns_reward_every_n_visits():
    owner = _owner("punch")
    biz = requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_punch cafe"}, headers=_auth(owner), timeout=30).json()
    url = f"{BASE}/marketplace/businesses/{biz['id']}"

    bad = requests.post(f"{url}/membership-plans", json={"name": "Card", "period": "card", "price": 0, "visits": 3}, headers=_auth(owner), timeout=30)
    assert bad.status_code == 422                       # no reward named
    plan = requests.post(f"{url}/membership-plans", json={"name": "Coffee card", "period": "card", "price": 0, "visits": 3,
                                                          "reward": "a free coffee"}, headers=_auth(owner), timeout=30).json()
    assert plan["reward"] == "a free coffee"

    j = requests.post(f"{BASE}/marketplace/memberships/plan/{plan['id']}/join",
                      json={"name": "Noa Card", "phone": "0521234567"}, timeout=30).json()
    assert j["status"] == "active"                      # free card: no payment to wait for
    me = requests.get(f"{BASE}/marketplace/memberships/me/{j['manage_token']}", timeout=30).json()
    assert me["stamps"] == 0 and me["visits_left"] is None and me["state"]["ok"]

    member_id = j["member_id"]
    results = [requests.post(f"{url}/members/{member_id}/checkin", headers=_auth(owner), timeout=30).json() for _ in range(4)]
    assert [r["ok"] for r in results] == [True] * 4
    assert [r["reward"] for r in results] == [None, None, "a free coffee", None]
    assert [r["stamps"] for r in results] == [1, 2, 0, 1]
    me = requests.get(f"{BASE}/marketplace/memberships/me/{j['manage_token']}", timeout=30).json()
    assert me["rewards"] == 1 and me["stamps"] == 1 and me["visits"] == 4


def test_paid_card_waits_for_payment():
    owner = _owner("punch-paid")
    biz = requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_punch paid"}, headers=_auth(owner), timeout=30).json()
    url = f"{BASE}/marketplace/businesses/{biz['id']}"
    plan = requests.post(f"{url}/membership-plans", json={"name": "Wash card", "period": "card", "price": 20, "visits": 5,
                                                          "reward": "a free wash"}, headers=_auth(owner), timeout=30).json()
    j = requests.post(f"{BASE}/marketplace/memberships/plan/{plan['id']}/join",
                      json={"name": "Dan Card", "phone": "0527654321"}, timeout=30).json()
    assert j["status"] == "pending"
