"""A business emails its customers (routes/marketplace/customer_messages.py):
who receives it, unsubscribe links, the limits, owner-only, and that the
business's text is escaped. No email actually leaves a test machine
without a Postmark token; the send itself is recorded either way.

Runs against the live local API (see backend/tests/.env.test).
"""
import os
import sys
from datetime import UTC, date, datetime, timedelta

import pytest
import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
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


@pytest.fixture(scope="module")
def gym():
    owner = _owner("msggym")
    biz = requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_msg gym"}, headers=_auth(owner), timeout=30).json()
    plan = requests.post(f"{BASE}/marketplace/businesses/{biz['id']}/membership-plans", json={"name": "Monthly", "price": 150},
                         headers=_auth(owner), timeout=30).json()
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    people = [("Ana", "0541000001", f"ana-{stamp}@example.com"), ("Ben", "0541000002", f"ben-{stamp}@example.com"),
              ("Cal", "0541000003", None)]
    ids = {}
    for name, phone, email in people:
        r = requests.post(f"{BASE}/marketplace/memberships/plan/{plan['id']}/join",
                          json={"name": name, "phone": phone, "email": email}, timeout=30)
        assert r.status_code == 200, r.text
        ids[name] = r.json()["member_id"]
    requests.post(f"{BASE}/marketplace/businesses/{biz['id']}/members/{ids['Ana']}/action", json={"action": "activate"},
                  headers=_auth(owner), timeout=30)
    return {"owner": owner, "biz": biz["id"], "stamp": stamp}


def _preview(gym, **aud):
    r = requests.post(f"{BASE}/marketplace/businesses/{gym['biz']}/messages/preview", json=aud, headers=_auth(gym["owner"]), timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def test_preview_counts_only_people_with_email(gym):
    p = _preview(gym, kind="members")
    assert p["will_receive"] == 2 and p["no_email"] == 1 and p["in_group"] == 3
    assert _preview(gym, kind="active_members")["will_receive"] == 1


def test_unsubscribe_link_removes_them_for_this_business_only(gym):
    from routes.marketplace.customer_messages import unsubscribe_url
    email = f"ben-{gym['stamp']}@example.com"
    url = unsubscribe_url(gym["biz"], email)
    path = url.split("/unsubscribe/", 1)[1]
    api = f"{BASE}/marketplace/messages/unsubscribe/{path}"
    info = requests.get(api, timeout=30)
    assert info.status_code == 200 and info.json()["unsubscribed"] is False
    # A tampered signature is refused.
    assert requests.get(api[:-4] + "0000", timeout=30).status_code == 404
    assert requests.post(api, timeout=30).json()["unsubscribed"] is True
    p = _preview(gym, kind="members")
    assert p["will_receive"] == 1 and p["unsubscribed"] == 1
    # Changed their mind.
    assert requests.post(api, params={"resubscribe": True}, timeout=30).json()["unsubscribed"] is False
    assert _preview(gym, kind="members")["will_receive"] == 2


def test_send_is_owner_only_recorded_and_limited(gym):
    msg = {"subject": "New timetable", "body": "Classes start at 7.", "promo": True, "lang": "en", "audience": {"kind": "members"}}
    stranger = _owner("msgstranger")
    assert requests.post(f"{BASE}/marketplace/businesses/{gym['biz']}/messages", json=msg, headers=_auth(stranger), timeout=30).status_code == 403
    r = requests.post(f"{BASE}/marketplace/businesses/{gym['biz']}/messages", json=msg, headers=_auth(gym["owner"]), timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["recipients"] == 2
    hist = requests.get(f"{BASE}/marketplace/businesses/{gym['biz']}/messages", headers=_auth(gym["owner"]), timeout=30).json()
    assert hist[0]["subject"] == "New timetable" and hist[0]["recipients"] == 2
    for _ in range(2):
        requests.post(f"{BASE}/marketplace/businesses/{gym['biz']}/messages", json=msg, headers=_auth(gym["owner"]), timeout=30)
    r = requests.post(f"{BASE}/marketplace/businesses/{gym['biz']}/messages", json=msg, headers=_auth(gym["owner"]), timeout=30)
    assert r.status_code == 429


def test_subject_marks_promotions_and_body_is_escaped():
    from routes.marketplace.customer_messages import MessageIn, _html, _subject_line
    m = MessageIn(subject="Sale\nnow", body='<a href="https://evil.example">click</a>\nline two', promo=True, lang="he")
    assert _subject_line(m) == "פרסומת: Sale now"
    out = _html({"_id": "b1", "name": "<b>Gym</b>", "slug": "gym"}, m, "https://myisraelrental.com/unsubscribe/x")
    assert '<a href="https://evil.example">' not in out and "&lt;a href=" in out
    assert "<b>Gym</b>" not in out and "line two" in out and "<br>" in out
    assert "להסרה מרשימת התפוצה" in out
