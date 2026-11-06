"""Pausing orders for a holiday, and what a visit records (Tzvi, 6 Nov 2026)."""
from datetime import date, timedelta

import requests

from tests.test_discount_codes import BASE, _auth, shop  # noqa: F401


def _order(s, phone, day=None):
    return requests.post(f"{BASE}/marketplace/order-form/{s['gig']}/orders", json={
        "lines": [{"product_id": s["prod"], "qty": 1}], "fulfilment": "pickup",
        "date": (day or date.today() + timedelta(days=2)).isoformat(), "customer_name": "Pause Test", "customer_phone": phone,
    }, timeout=30)


def test_pause_stops_orders_and_ends_by_itself(shop):  # noqa: F811
    h = _auth(shop["owner"])
    url = f"{BASE}/marketplace/businesses/{shop['biz']}/orders/pause"
    form = lambda: requests.get(f"{BASE}/marketplace/order-form/{shop['gig']}", timeout=30).json()["paused"]
    try:
        until = date.today() + timedelta(days=3)
        r = requests.put(url, headers=h, json={"on": True, "until": until.isoformat(), "note": "Closed for Sukkot"}, timeout=30)
        assert r.status_code == 200, r.text
        assert form()["active"] is True and form()["back_on"] == (until + timedelta(days=1)).isoformat()
        assert _order(shop, "0541119001").status_code == 409
        # Saving the other settings leaves the pause alone.
        st = requests.get(f"{BASE}/marketplace/businesses/{shop['biz']}/orders/settings", headers=h, timeout=30).json()
        assert st["pause"]["active"] is True
        # Starts later: orders now are fine, a day inside it is not.
        start = date.today() + timedelta(days=5)
        assert requests.put(url, headers=h, json={"on": True, "from": start.isoformat(), "until": (start + timedelta(days=2)).isoformat()}, timeout=30).status_code == 200
        assert form()["active"] is False
        assert _order(shop, "0541119002", start + timedelta(days=1)).status_code == 409
        assert _order(shop, "0541119003", start + timedelta(days=5)).status_code == 200
        # Last day gone: back by itself.
        assert requests.put(url, headers=h, json={"on": True, "until": (date.today() - timedelta(days=1)).isoformat()}, timeout=30).status_code == 200
        assert form() is None
        assert _order(shop, "0541119004").status_code == 200
        bad = {"on": True, "from": start.isoformat(), "until": (start - timedelta(days=1)).isoformat()}
        assert requests.put(url, headers=h, json=bad, timeout=30).status_code == 422
    finally:
        requests.put(url, headers=h, json={"on": False}, timeout=30)


def test_a_visit_and_a_tap_show_in_the_breakdown(shop):  # noqa: F811
    h = _auth(shop["owner"])
    site = f"{BASE}/marketplace/business/{shop['biz']}"
    assert requests.post(f"{site}/visit", headers={
        "X-Visitor-Id": f"t-{date.today()}", "X-Visit-Source": "l.instagram.com", "X-Visit-Lang": "he", "X-Visit-Page": "shop",
        "user-agent": "Mozilla/5.0 (iPhone) Mobile",
    }, timeout=30).status_code == 204
    assert requests.post(f"{site}/tap", headers={"user-agent": "Mozilla/5.0 Chrome"}, json={"kind": "phone", "page": "shop"}, timeout=30).status_code == 204
    assert requests.post(f"{site}/tap", json={"kind": "nonsense"}, timeout=30).status_code == 422
    d = requests.get(f"{BASE}/marketplace/visits/breakdown", headers=h, timeout=30).json()
    keys = lambda rows: {r["key"] for r in rows}
    assert "instagram" in keys(d["sources"]) and "phone" in keys(d["devices"]) and "he" in keys(d["langs"])
    assert "phone" in keys(d["taps"]) and "shop" in keys(d["pages"])
