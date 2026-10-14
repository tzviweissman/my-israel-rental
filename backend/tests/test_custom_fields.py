"""A business's own questions on its forms (routes/marketplace/custom_fields.py):
the owner sets them, the sign-up and order forms enforce them, and the
answers are kept with a copy of the question.

Runs against the live local API (see backend/tests/.env.test).
"""
import os
from datetime import UTC, date, datetime, timedelta

import pytest
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


@pytest.fixture(scope="module")
def owner():
    return _owner("fields")


@pytest.fixture(scope="module")
def gym(owner):
    r = requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_fields gym"}, headers=_auth(owner), timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()


WAIVER = {"label": "I agree to the gym rules", "type": "checkbox", "required": True}
LEVEL = {"label": "Your level", "type": "choice", "options": ["Beginner", "Advanced"]}
CONTACT = {"label": "Emergency contact", "type": "text", "required": True}


def _set(owner, gym, form, fields):
    return requests.put(f"{BASE}/marketplace/businesses/{gym['id']}/custom-fields/{form}", json={"fields": fields},
                        headers=_auth(owner), timeout=30)


def test_owner_only_and_choice_needs_options(owner, gym):
    stranger = _owner("fieldsstranger")
    assert _set(stranger, gym, "membership", [WAIVER]).status_code == 403
    assert _set(owner, gym, "membership", [{"label": "Pick", "type": "choice", "options": ["only one"]}]).status_code == 422
    assert _set(owner, gym, "nonsense", [WAIVER]).status_code == 422


def test_membership_signup_enforces_and_keeps_answers(owner, gym):
    r = _set(owner, gym, "membership", [WAIVER, LEVEL, CONTACT])
    assert r.status_code == 200, r.text
    ids = {f["label"]: f["id"] for f in r.json()["fields"]}
    plan = requests.post(f"{BASE}/marketplace/businesses/{gym['id']}/membership-plans", json={"name": "Monthly", "price": 200},
                         headers=_auth(owner), timeout=30).json()
    pub = requests.get(f"{BASE}/marketplace/memberships/{gym['slug']}", timeout=30).json()
    assert [f["label"] for f in pub["fields"]] == ["I agree to the gym rules", "Your level", "Emergency contact"]

    join = f"{BASE}/marketplace/memberships/plan/{plan['id']}/join"
    base = {"name": "Noa", "phone": "054-1112222"}
    r = requests.post(join, json={**base, "answers": {ids["Emergency contact"]: "Dad 050-1"}}, timeout=30)
    assert r.status_code == 400 and "gym rules" in r.text
    r = requests.post(join, json={**base, "answers": {ids["I agree to the gym rules"]: True, ids["Emergency contact"]: "Dad",
                                                      ids["Your level"]: "Expert"}}, timeout=30)
    assert r.status_code == 400 and "Your level" in r.text
    r = requests.post(join, json={**base, "answers": {ids["I agree to the gym rules"]: True, ids["Emergency contact"]: "Dad 050-1",
                                                      ids["Your level"]: "Beginner"}}, timeout=30)
    assert r.status_code == 200, r.text
    members = requests.get(f"{BASE}/marketplace/businesses/{gym['id']}/members", headers=_auth(owner), timeout=30).json()["members"]
    m = next(x for x in members if x["name"] == "Noa")
    assert {a["label"]: a["value"] for a in m["answers"]} == {
        "I agree to the gym rules": True, "Your level": "Beginner", "Emergency contact": "Dad 050-1"}

    # Renaming the question later does not change what was answered.
    fields = [{**f, "label": "New wording"} if f["id"] == ids["Emergency contact"] else f for f in pub["fields"]]
    _set(owner, gym, "membership", fields)
    members = requests.get(f"{BASE}/marketplace/businesses/{gym['id']}/members", headers=_auth(owner), timeout=30).json()["members"]
    m = next(x for x in members if x["name"] == "Noa")
    assert "Emergency contact" in [a["label"] for a in m["answers"]]


def test_order_form_shows_and_records_answers():
    owner = _owner("fieldsbakery")
    requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_fields bakery"}, headers=_auth(owner), timeout=30)
    g = requests.post(f"{BASE}/marketplace/gigs", json={
        "title": "TEST_fields cakes", "description": "for the order form", "category": "shops-products", "area": "Jerusalem",
        "gig_type": "store", "budget_currency": "ILS", "booking_mode": "whatsapp", "whatsapp": "+972501234567", "gallery": [],
        "products": [{"name": "Cake", "price": 120, "currency": "ILS", "images": ["https://example.com/c.jpg"]}],
    }, headers=_auth(owner), timeout=30)
    assert g.status_code in (200, 201), g.text
    gid = g.json()["id"]
    biz_id = requests.get(f"{BASE}/marketplace/order-form/{gid}", timeout=30).json()["business"]["id"]
    r = _set(owner, {"id": biz_id}, "order", [{"label": "Allergies", "type": "text", "required": True}])
    assert r.status_code == 200, r.text
    fid = r.json()["fields"][0]["id"]
    form = requests.get(f"{BASE}/marketplace/order-form/{gid}", timeout=30).json()
    assert form["custom_fields"][0]["label"] == "Allergies"
    prod = form["products"][0]["id"]
    day = (date.today() + timedelta(days=3)).isoformat()
    body = {"lines": [{"product_id": prod, "qty": 1}], "fulfilment": "pickup", "date": day,
            "customer_name": "Avi", "customer_phone": "0541234567"}
    r = requests.post(f"{BASE}/marketplace/order-form/{gid}/orders", json=body, timeout=30)
    assert r.status_code == 400 and "Allergies" in r.text
    r = requests.post(f"{BASE}/marketplace/order-form/{gid}/orders", json={**body, "answers": {fid: "Nuts"}}, timeout=30)
    assert r.status_code == 200, r.text
    orders = requests.get(f"{BASE}/marketplace/businesses/{biz_id}/orders", params={"status": "new"}, headers=_auth(owner), timeout=30).json()
    rows = orders.get("orders", []) if isinstance(orders, dict) else orders
    o = next(x for x in rows if x["customer_name"] == "Avi")
    assert "Allergies: Nuts" in (o.get("notes") or "")
