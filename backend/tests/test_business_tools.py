"""Dashboard tools by type of business (utils/business_tools.py): a gym
gets Members, a shop gets Orders, a person's own switch wins, and a tool
in use is never hidden by a guess.

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


def _business(token, name, categories):
    r = requests.post(f"{BASE}/marketplace/businesses", json={"name": name}, headers=_auth(token), timeout=30)
    assert r.status_code in (200, 201), r.text
    b = r.json()
    r = requests.patch(f"{BASE}/marketplace/businesses/{b['id']}", json={"categories": categories}, headers=_auth(token), timeout=30)
    assert r.status_code == 200, r.text
    return b


def _tools(token):
    r = requests.get(f"{BASE}/dashboard/tools", headers=_auth(token), timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def test_gym_gets_members_and_not_orders():
    tok = _owner("toolsgym")
    _business(tok, "TEST_tools gym", ["health-fitness"])
    t = _tools(tok)["tools"]
    assert t["members"] is True and t["appointments"] is True
    assert t["orders"] is False and t["network"] is False


def test_shop_gets_orders_and_not_members():
    tok = _owner("toolsshop")
    _business(tok, "TEST_tools shop", ["shops-products"])
    t = _tools(tok)["tools"]
    assert t["orders"] is True and t["members"] is False


def test_own_switch_wins_and_summary_follows():
    tok = _owner("toolsswitch")
    _business(tok, "TEST_tools switch", ["shops-products"])
    r = requests.put(f"{BASE}/dashboard/tools", json={"tools": {"members": True, "orders": False, "bogus": True}},
                     headers=_auth(tok), timeout=30)
    assert r.status_code == 200, r.text
    t = r.json()
    assert t["tools"]["members"] is True and t["tools"]["orders"] is False
    assert "bogus" not in t["tools"] and "bogus" not in t["chosen"]
    s = requests.get(f"{BASE}/dashboard/summary", headers=_auth(tok), timeout=30).json()
    assert s["business_tools"]["members"] is True and s["business_tools"]["orders"] is False


def test_tool_in_use_shows_even_if_it_does_not_suit():
    tok = _owner("toolsuse")
    b = _business(tok, "TEST_tools use", ["shops-products"])
    requests.post(f"{BASE}/marketplace/businesses/{b['id']}/membership-plans",
                  json={"name": "Monthly", "price": 100}, headers=_auth(tok), timeout=30)
    t = _tools(tok)
    assert "members" in t["in_use"] and t["tools"]["members"] is True
