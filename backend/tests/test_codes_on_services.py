"""A code works on whatever a business offers: a booked service and an accepted
price, not only products (Tzvi, 6 Nov 2026). The customer follows it on a link.

Runs against the live local API (see backend/tests/.env.test).
"""
import os
from datetime import UTC, datetime

import pytest
import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def svc():
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={"email": f"svc-{stamp}@example.com", "password": f"Pw-{stamp}-ok1", "name": "svc owner", "role": "owner"}, timeout=30)
    assert r.status_code in (200, 201), r.text
    owner = r.json()["token"]
    requests.post(f"{BASE}/marketplace/businesses", json={"name": "TEST_svc cleaner"}, headers=_auth(owner), timeout=30)
    g = requests.post(f"{BASE}/marketplace/gigs", json={
        "title": "TEST_svc cleaning", "description": "for codes on services", "category": "home-services-repair", "area": "Jerusalem",
        "gig_type": "deliverable", "budget_currency": "ILS", "booking_mode": "whatsapp", "whatsapp": "+972501234567", "gallery": ["https://example.com/c.jpg"],
        "tiers": [{"name": "Flat", "price": 200, "currency": "ILS"}],
    }, headers=_auth(owner), timeout=30)
    assert g.status_code in (200, 201), g.text
    gig = g.json()["id"]
    box = requests.get(f"{BASE}/marketplace/gigs/{gig}/code-box", timeout=30)
    assert box.status_code == 200, box.text
    assert box.json()["has_codes"] is False
    return {"owner": owner, "biz": box.json()["business"]["id"], "gig": gig}


def _code(svc, **kw):
    r = requests.post(f"{BASE}/marketplace/businesses/{svc['biz']}/discount-codes", json=kw, headers=_auth(svc["owner"]), timeout=30)
    assert r.status_code in (200, 201), r.text


def _book(svc, code=None, phone="0541234001", **kw):
    return requests.post(f"{BASE}/marketplace/gigs/{svc['gig']}/book", json={
        "tier_name": "Flat", "guest_name": "Rina", "contact_phone": phone, "discount_code": code, **kw}, timeout=30)


def _tracked(r):
    assert r.status_code == 200, r.text
    return requests.get(f"{BASE}/marketplace{r.json()['track_path']}", timeout=30).json()


def test_box_is_offered_for_a_service(svc):
    _code(svc, code="CLEAN10", value=10, once_per_customer=False)
    assert requests.get(f"{BASE}/marketplace/gigs/{svc['gig']}/code-box", timeout=30).json()["has_codes"] is True


def test_code_on_a_booking_is_tracked_and_comes_off_the_price(svc):
    d = _tracked(_book(svc, "clean10", phone="0541234002"))
    assert d["price"] == 200 and d["discount"]["code"] == "CLEAN10" and d["discount"]["amount"] == 20
    rows = requests.get(f"{BASE}/marketplace/bookings", params={"role": "provider"}, headers=_auth(svc["owner"]), timeout=30).json()
    assert any("Discount CLEAN10: -₪20, total ₪180" in (x.get("message") or "") for x in rows)   # the business sees it


def test_refused_and_hebrew(svc):
    assert "not valid" in _book(svc, "NOSUCH", phone="0541234003").text
    assert "לא תקף" in _book(svc, "NOSUCH", phone="0541234003", lang="he").json()["detail"]
    r = requests.post(f"{BASE}/marketplace/gigs/{svc['gig']}/book", json={"tier_name": "Flat", "guest_name": "Rina", "contact_email": "r@example.com", "discount_code": "CLEAN10"}, timeout=30)
    assert r.status_code == 400 and "phone" in r.text
    c = requests.post(f"{BASE}/marketplace/businesses/{svc['biz']}/discount-codes/check", json={"code": "NOSUCH", "amount": 200, "lang": "he"}, timeout=30).json()
    assert "לא תקף" in c["reason"]


def test_once_per_customer_and_first_time_count_bookings(svc):
    _code(svc, code="ONCEONLY", value=10, once_per_customer=True)
    assert _book(svc, "ONCEONLY", phone="0541234004").status_code == 200
    assert "already used" in _book(svc, "ONCEONLY", phone="0541234004").text
    _code(svc, code="NEWONE", value=10, first_order_only=True)
    assert "first-time" in _book(svc, "NEWONE", phone="0541234004").text   # booked before
    assert _book(svc, "NEWONE", phone="0541234005").status_code == 200


def test_declined_booking_gives_the_code_back(svc):
    _code(svc, code="ONEUSE", value=10, max_uses=1)
    r = _book(svc, "ONEUSE", phone="0541234006")
    assert r.status_code == 200
    assert "used up" in _book(svc, "ONEUSE", phone="0541234007").text
    p = requests.patch(f"{BASE}/marketplace/bookings/{r.json()['booking_id']}", json={"status": "declined"}, headers=_auth(svc["owner"]), timeout=30)
    assert p.status_code == 200, p.text
    assert _book(svc, "ONEUSE", phone="0541234006").status_code == 200   # good again, for the same customer too


def test_page_total_and_no_price_yet(svc):
    _code(svc, code="MIN500", kind="amount", value=50, min_order=500, once_per_customer=False)
    assert "at least" in _book(svc, "MIN500", phone="0541234008").text
    d = _tracked(_book(svc, "MIN500", phone="0541234008", amount=600))   # two hours on a designed site
    assert d["price"] == 600 and d["discount"]["amount"] == 50
    d = _tracked(_book(svc, "CLEAN10", phone="0541234009", amount=0))    # priced later: noted, nothing taken yet
    assert d["price"] is None and d["discount"]["amount"] == 0 and d["discount"]["value"] == 10


def test_code_on_an_accepted_price(svc):
    q = requests.post(f"{BASE}/marketplace/businesses/{svc['biz']}/quotes", json={
        "name": "Dana", "phone": "0541234011", "description": "Move out clean", "gig_id": svc["gig"], "price": 1000, "lang": "en"},
        headers=_auth(svc["owner"]), timeout=30)
    assert q.status_code in (200, 201), q.text
    rows = requests.get(f"{BASE}/marketplace/quote-requests", headers=_auth(svc["owner"]), timeout=30).json()["quotes"]
    token = rows[0]["link"].rsplit("/", 1)[1]
    t = f"{BASE}/marketplace/quotes/track/{token}"
    assert requests.get(t, timeout=30).json()["has_codes"] is True
    bad = requests.post(f"{t}/answer", json={"answer": "accept", "discount_code": "NOSUCH"}, timeout=30)
    assert bad.status_code == 400 and requests.get(t, timeout=30).json()["status"] == "quoted"   # still theirs to accept
    ok = requests.post(f"{t}/answer", json={"answer": "accept", "discount_code": "CLEAN10"}, timeout=30)
    assert ok.status_code == 200, ok.text
    d = requests.get(t, timeout=30).json()
    assert d["status"] == "accepted" and d["discount"] == {"code": "CLEAN10", "amount": 100}
    assert requests.post(f"{t}/answer", json={"answer": "accept", "discount_code": "CLEAN10"}, timeout=30).status_code == 409
    rows = requests.get(f"{BASE}/marketplace/quote-requests", headers=_auth(svc["owner"]), timeout=30).json()["quotes"]
    assert rows[0]["discount"]["amount"] == 100   # the business sees it, and asks for the lower price
