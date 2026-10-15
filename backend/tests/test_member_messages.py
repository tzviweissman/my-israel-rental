"""Automatic messages to members (routes/marketplace/member_messages.py):
welcome on activation, renewal reminders, class reminders and "we haven't
seen you", each once only, respecting the business's switches and
unsubscribes. The loop's pass is run directly here (no 15-minute wait);
no email leaves a test machine, the once-only log is what is checked.

Runs against the live local API and its database (see backend/tests/.env.test).
"""
import asyncio
import os
import sys
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")
IL = ZoneInfo("Asia/Jerusalem")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _owner(tag):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"{tag}-{stamp}@example.com", "password": f"Pw-{stamp}-ok1", "name": f"{tag} owner", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


def _db():
    from dotenv import load_dotenv
    from pymongo import MongoClient
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _run_pass():
    from routes.marketplace.member_messages import run_once
    # One loop for the whole run: the database client stays on the loop it
    # first ran on (conftest.py uses the same one).
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(run_once())


def _log(member_id, trigger):
    return list(_db().member_message_log.find({"member_id": member_id, "trigger": trigger}))


@pytest.fixture(scope="module")
def gym():
    owner = _owner("automsg")
    biz = requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_automsg gym"}, headers=_auth(owner), timeout=30).json()
    url = f"{BASE}/marketplace/businesses/{biz['id']}"
    plan = requests.post(f"{url}/membership-plans", json={"name": "Monthly", "price": 200}, headers=_auth(owner), timeout=30).json()
    stamp = datetime.now(UTC).strftime("%H%M%S%f")

    def member(name, active=True):
        r = requests.post(f"{url}/members", json={"plan_id": plan["id"], "name": name, "phone": f"05{abs(hash(name + stamp)) % 10**8:08d}",
                                                  "email": f"{name.lower()}-{stamp}@example.com", "active": active},
                          headers=_auth(owner), timeout=30)
        assert r.status_code == 200, r.text
        return r.json()["id"]
    return {"owner": owner, "biz": biz["id"], "url": url, "member": member}


def test_welcome_on_activation_and_switch_off(gym):
    a = gym["member"]("Alma")
    assert len(_log(a, "welcome")) == 1
    r = requests.put(f"{gym['url']}/member-messages", json={"welcome": {"on": False}}, headers=_auth(gym["owner"]), timeout=30)
    assert r.status_code == 200 and r.json()["welcome"]["on"] is False
    b = gym["member"]("Boaz")
    assert _log(b, "welcome") == []
    requests.put(f"{gym['url']}/member-messages", json={"welcome": {"on": True}}, headers=_auth(gym["owner"]), timeout=30)


def test_renewal_reminder_once(gym):
    c = gym["member"]("Chen")
    soon = (datetime.now(IL).date() + timedelta(days=2)).isoformat()
    _db().business_members.update_one({"_id": c}, {"$set": {"renews_on": soon}})
    _run_pass()
    _run_pass()
    assert len(_log(c, "renewal")) == 1


def test_winback_only_when_on_and_not_unsubscribed(gym):
    d = gym["member"]("Dina")
    e = gym["member"]("Eli")
    old = (datetime.now(IL) - timedelta(days=40)).isoformat()
    db = _db()
    db.business_members.update_many({"_id": {"$in": [d, e]}}, {"$set": {"last_visit_at": old}})
    _run_pass()
    assert _log(d, "winback") == []                 # off by default
    requests.put(f"{gym['url']}/member-messages", json={"winback": {"on": True, "days": 21}}, headers=_auth(gym["owner"]), timeout=30)
    eli = db.business_members.find_one({"_id": e})
    db.message_unsubscribes.insert_one({"_id": f"t-{e}", "business_id": gym["biz"], "email": eli["email"].lower(), "at": old})
    _run_pass()
    _run_pass()
    assert len(_log(d, "winback")) == 1
    assert _log(e, "winback") == []


def test_class_reminder(gym):
    f = gym["member"]("Fanny")
    now = datetime.now(IL)
    if now.hour >= 22:
        pytest.skip("too close to midnight for a class later today")
    start = (now + timedelta(hours=1)).strftime("%H:%M")
    requests.post(f"{gym['url']}/classes", json={"title": "Box", "weekday": (now.weekday() + 1) % 7, "start": start, "capacity": 5},
                  headers=_auth(gym["owner"]), timeout=30)
    link = requests.get(f"{gym['url']}/members/{f}/link", headers=_auth(gym["owner"]), timeout=30).json()["url"]
    tok = link.rsplit("/", 1)[1]
    sid = next(c["id"] for c in requests.get(f"{BASE}/marketplace/memberships/me/{tok}/classes", timeout=30).json()["classes"] if c["title"] == "Box")
    assert requests.post(f"{BASE}/marketplace/memberships/me/{tok}/classes/{sid}", timeout=30).json()["status"] == "booked"
    _run_pass()
    _run_pass()
    assert len(_log(f, "class")) == 1


def test_settings_are_members_area_only(gym):
    stranger = _owner("automsg-stranger")
    assert requests.get(f"{gym['url']}/member-messages", headers=_auth(stranger), timeout=30).status_code == 403
    r = requests.get(f"{gym['url']}/member-messages", params={"lang": "he"}, headers=_auth(gym["owner"]), timeout=30).json()
    assert "{name}" in r["welcome"]["default_text"] and r["renewal"]["days"] == 3
