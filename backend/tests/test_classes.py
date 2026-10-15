"""Class timetable and booking (routes/marketplace/classes.py).

Runs against the live local API (see backend/tests/.env.test).
"""
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
import requests

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


@pytest.fixture(scope="module")
def gym():
    owner = _owner("classes")
    biz = requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_classes studio"}, headers=_auth(owner), timeout=30).json()
    url = f"{BASE}/marketplace/businesses/{biz['id']}"
    monthly = requests.post(f"{url}/membership-plans", json={"name": "Monthly", "price": 200}, headers=_auth(owner), timeout=30).json()
    pilates = requests.post(f"{url}/membership-plans", json={"name": "Pilates only", "price": 150}, headers=_auth(owner), timeout=30).json()
    members = {}
    for i, (name, plan) in enumerate((("A", monthly), ("B", monthly), ("C", monthly), ("D", monthly), ("P", pilates))):
        m = requests.post(f"{url}/members", json={"plan_id": plan["id"], "name": f"{name} Member", "phone": f"05411100{i:02d}"},
                          headers=_auth(owner), timeout=30).json()
        link = requests.get(f"{url}/members/{m['id']}/link", headers=_auth(owner), timeout=30).json()["url"]
        members[name] = {"id": m["id"], "token": link.rsplit("/", 1)[1]}
    return {"owner": owner, "biz": biz, "url": url, "monthly": monthly, "pilates": pilates, "m": members}


def _tomorrow_weekday():
    d = datetime.now(IL) + timedelta(days=1)
    return (d.weekday() + 1) % 7, d.date().isoformat()


def _classes(token):
    r = requests.get(f"{BASE}/marketplace/memberships/me/{token}/classes", timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["classes"]


def _book(token, sid):
    return requests.post(f"{BASE}/marketplace/memberships/me/{token}/classes/{sid}", timeout=30)


def test_timetable_booking_waitlist_and_promotion(gym):
    wd, day = _tomorrow_weekday()
    r = requests.post(f"{gym['url']}/classes", json={"title": "Spin", "weekday": wd, "start": "10:00", "capacity": 2,
                                                    "plan_ids": [gym["monthly"]["id"]]}, headers=_auth(gym["owner"]), timeout=30)
    assert r.status_code == 200, r.text
    m = gym["m"]
    spin = next(c for c in _classes(m["A"]["token"]) if c["title"] == "Spin" and c["date"] == day)
    assert spin["spots_left"] == 2
    # The plan restriction: the pilates-only member does not see it, and cannot book it.
    assert not [c for c in _classes(m["P"]["token"]) if c["title"] == "Spin"]
    assert _book(m["P"]["token"], spin["id"]).status_code == 400

    assert _book(m["A"]["token"], spin["id"]).json()["status"] == "booked"
    assert _book(m["A"]["token"], spin["id"]).status_code == 409
    assert _book(m["B"]["token"], spin["id"]).json()["status"] == "booked"
    assert _book(m["C"]["token"], spin["id"]).json()["status"] == "waitlist"
    assert _book(m["D"]["token"], spin["id"]).json()["status"] == "waitlist"
    c = next(x for x in _classes(m["D"]["token"]) if x["id"] == spin["id"])
    assert c["my_status"] == "waitlist" and c["waitlist_position"] == 2

    # A leaves: C (first waiting) gets the place, D moves up.
    assert requests.delete(f"{BASE}/marketplace/memberships/me/{m['A']['token']}/classes/{spin['id']}", timeout=30).status_code == 200
    assert next(x for x in _classes(m["C"]["token"]) if x["id"] == spin["id"])["my_status"] == "booked"
    assert next(x for x in _classes(m["D"]["token"]) if x["id"] == spin["id"])["waitlist_position"] == 1

    week = requests.get(f"{gym['url']}/class-sessions", params={"days": 7}, headers=_auth(gym["owner"]), timeout=30).json()
    s = next(x for x in week if x["id"] == spin["id"])
    assert s["booked"] == 2 and s["waitlist"] == 1
    assert [r["name"] for r in s["roster"] if r["status"] == "booked"] == ["B Member", "C Member"]

    # Cancelling the class: everyone's booking goes.
    r = requests.post(f"{gym['url']}/class-sessions/{spin['id']}/cancel", json={"reason": "Instructor ill"}, headers=_auth(gym["owner"]), timeout=30)
    assert r.status_code == 200
    assert next(x for x in _classes(m["B"]["token"]) if x["id"] == spin["id"]).get("my_status") is None
    assert _book(m["A"]["token"], spin["id"]).status_code == 400


def test_last_place_goes_to_one_person(gym):
    wd, day = _tomorrow_weekday()
    requests.post(f"{gym['url']}/classes", json={"title": "Solo", "weekday": wd, "start": "12:00", "capacity": 1},
                  headers=_auth(gym["owner"]), timeout=30)
    m = gym["m"]
    sid = next(c["id"] for c in _classes(m["A"]["token"]) if c["title"] == "Solo")
    with ThreadPoolExecutor(4) as ex:
        res = list(ex.map(lambda n: _book(m[n]["token"], sid).json().get("status"), ["A", "B", "C", "D"]))
    assert res.count("booked") == 1 and res.count("waitlist") == 3


def test_checkin_marks_the_class_attended(gym):
    now = datetime.now(IL)
    if now.hour >= 23:
        pytest.skip("too close to midnight for a class later today")
    start = (now + timedelta(minutes=30)).strftime("%H:%M")
    requests.post(f"{gym['url']}/classes", json={"title": "Soon", "weekday": (now.weekday() + 1) % 7, "start": start, "capacity": 5},
                  headers=_auth(gym["owner"]), timeout=30)
    m = gym["m"]
    sid = next(c["id"] for c in _classes(m["B"]["token"]) if c["title"] == "Soon")
    assert _book(m["B"]["token"], sid).json()["status"] == "booked"
    r = requests.post(f"{gym['url']}/members/{m['B']['id']}/checkin", headers=_auth(gym["owner"]), timeout=30).json()
    assert r["ok"] is True and r["class"].startswith("Soon")
    week = requests.get(f"{gym['url']}/class-sessions", params={"days": 1}, headers=_auth(gym["owner"]), timeout=30).json()
    assert next(x for x in week if x["id"] == sid)["roster"][0]["status"] == "attended"


def test_public_timetable_and_owner_only_editing(gym):
    pub = requests.get(f"{BASE}/marketplace/memberships/{gym['biz']['slug']}/timetable", timeout=30)
    assert pub.status_code == 200
    assert all("roster" not in c and "booked" not in c for c in pub.json())
    stranger = _owner("classes-stranger")
    assert requests.post(f"{gym['url']}/classes", json={"title": "X", "weekday": 1, "start": "09:00", "capacity": 3},
                         headers=_auth(stranger), timeout=30).status_code == 403
    assert requests.get(f"{gym['url']}/class-sessions", headers=_auth(stranger), timeout=30).status_code == 403
