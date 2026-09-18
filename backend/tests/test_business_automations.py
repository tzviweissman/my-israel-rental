"""Automations between connected businesses (docs/business-network-spec.md, Phase 2).

The shop-and-courier story, end to end through the real endpoints:
the shop marks an order ready and a delivery order appears for its
courier business. Plus every rule that makes it safe to leave running:

  * only between ACCEPTED connections, checked on save and on every fire;
  * auto-accept is the receiver's grant, per sender, and its caps hold;
  * at most once per source order;
  * never back to the business that sent it;
  * a saved reorder sends on demand, and is the only kind that can;
  * the run log records every outcome, and the receiver can see the
    runs that sent it orders;
  * the auto-accept list is not wiped by a save of the other order
    settings.

Needs the live local API and the local Mongo (see backend/tests/.env.test).
"""
from __future__ import annotations

import os
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

from pymongo import MongoClient  # noqa: E402

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")
M = f"{BASE}/marketplace"


@pytest.fixture(scope="module")
def db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _account(tag):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"auto-{tag}-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": f"Auto {tag}", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _business(h, name):
    r = requests.post(f"{M}/businesses", json={"name": f"TEST_auto {name} {uuid.uuid4().hex[:6]}"}, headers=h, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _connect(w, a="shop", b="courier"):
    c = requests.post(f"{M}/businesses/{w[a]}/connections", json={"target_business_id": w[b]}, headers=w["h"][a], timeout=30).json()
    r = requests.post(f"{M}/connections/{c['id']}/accept", headers=w["h"][b], timeout=30)
    assert r.status_code == 200, r.text
    return c["id"]


@pytest.fixture()
def w(db):
    shop_h, courier_h, other_h = _account("shop"), _account("courier"), _account("other")
    ids = {"shop": _business(shop_h, "bakery"), "courier": _business(courier_h, "courier"),
           "other": _business(other_h, "other")}
    yield {"h": {"shop": shop_h, "courier": courier_h, "other": other_h}, **ids}
    all_ids = list(ids.values())
    db.business_connections.delete_many({"$or": [{"a_id": {"$in": all_ids}}, {"b_id": {"$in": all_ids}}]})
    db.business_automations.delete_many({"business_id": {"$in": all_ids}})
    db.automation_runs.delete_many({"business_id": {"$in": all_ids}})
    db.store_orders.delete_many({"business_id": {"$in": all_ids}})


def _order(w, who="shop", **over):
    body = {"customer_name": "Idan Cohen", "customer_phone": "054-1234567", "items": "2 challahs",
            "needed_by": "2030-01-04T12:00", "fulfilment": "delivery", "address": "Hapalmach 14, Jerusalem"}
    body.update(over)
    r = requests.post(f"{M}/businesses/{w[who]}/orders", json=body, headers=w["h"][who], timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _status(w, oid, s, who="shop"):
    r = requests.patch(f"{M}/orders/{oid}/status", json={"status": s, "note": ""}, headers=w["h"][who], timeout=30)
    assert r.status_code == 200, r.text


def _rule(w, who="shop", partner="courier", trigger=None, template=None, name="Send to courier"):
    return requests.post(f"{M}/businesses/{w[who]}/automations", json={
        "partner_business_id": w[partner], "name": name,
        "trigger": trigger or {"type": "order.status_changed", "status": "ready"},
        "template": template or {"copy_from_source": True},
    }, headers=w["h"][who], timeout=30)


def _partner_orders(db, w, partner="courier"):
    # The engine runs a moment after the status write; give it that moment.
    for _ in range(30):
        rows = list(db.store_orders.find({"business_id": w[partner], "source": "automation"}))
        if rows:
            return rows
        time.sleep(0.2)
    return []


def test_ready_sends_a_delivery_to_the_courier(w, db):
    _connect(w)
    assert _rule(w).status_code == 200
    oid = _order(w)
    _status(w, oid, "preparing")
    _status(w, oid, "ready")

    rows = _partner_orders(db, w)
    assert len(rows) == 1, "the courier business should have received one order"
    got = rows[0]
    assert got["status"] == "new", "without auto-accept it waits for the courier"
    assert got["address"] == "Hapalmach 14, Jerusalem" and got["items"] == "2 challahs"
    assert got["automation"]["from_business_id"] == w["shop"]
    assert got["automation"]["source_order_id"] == oid
    assert got["owner_user_id"] == db.businesses.find_one({"_id": w["courier"]})["owner_user_id"]

    run = db.automation_runs.find_one({"created_order_id": got["_id"]})
    assert run and run["result"] == "created"


def test_it_fires_once_per_order(w, db):
    _connect(w)
    _rule(w)
    oid = _order(w)
    _status(w, oid, "preparing"); _status(w, oid, "ready")
    _partner_orders(db, w)
    _status(w, oid, "preparing"); _status(w, oid, "ready")
    time.sleep(1.5)
    assert db.store_orders.count_documents({"business_id": w["courier"], "source": "automation"}) == 1


def test_a_rule_needs_an_accepted_connection(w):
    r = _rule(w)
    assert r.status_code == 400, "no connection yet: the rule must be refused"


def test_disconnecting_stops_the_rule_firing(w, db):
    cid = _connect(w)
    _rule(w)
    requests.post(f"{M}/connections/{cid}/disconnect", headers=w["h"]["courier"], timeout=30)
    oid = _order(w)
    _status(w, oid, "preparing"); _status(w, oid, "ready")
    time.sleep(1.5)
    assert db.store_orders.count_documents({"business_id": w["courier"], "source": "automation"}) == 0


def test_auto_accept_is_the_receivers_grant_and_its_caps_hold(w, db):
    _connect(w)
    _rule(w)
    # The SHOP cannot grant itself auto-accept at the courier.
    r = requests.put(f"{M}/businesses/{w['courier']}/orders/auto-accept",
                     json={"auto_accept_from": [{"business_id": w["shop"]}]}, headers=w["h"]["shop"], timeout=30)
    assert r.status_code == 403
    # The courier grants it, capped at one a day.
    r = requests.put(f"{M}/businesses/{w['courier']}/orders/auto-accept",
                     json={"auto_accept_from": [{"business_id": w["shop"], "max_per_day": 1}]}, headers=w["h"]["courier"], timeout=30)
    assert r.status_code == 200, r.text

    for _ in range(2):
        oid = _order(w)
        _status(w, oid, "preparing"); _status(w, oid, "ready")
    deadline = time.time() + 6
    while time.time() < deadline and db.store_orders.count_documents({"business_id": w["courier"], "source": "automation"}) < 2:
        time.sleep(0.2)
    rows = sorted(db.store_orders.find({"business_id": w["courier"], "source": "automation"}), key=lambda d: d["created_at"])
    assert [d["status"] for d in rows] == ["preparing", "new"], "the first is accepted, the second is over the daily cap"


def test_auto_accept_only_for_connected_businesses(w):
    r = requests.put(f"{M}/businesses/{w['courier']}/orders/auto-accept",
                     json={"auto_accept_from": [{"business_id": w["other"]}]}, headers=w["h"]["courier"], timeout=30)
    assert r.status_code == 400


def test_saving_other_order_settings_does_not_wipe_auto_accept(w, db):
    _connect(w)
    requests.put(f"{M}/businesses/{w['courier']}/orders/auto-accept",
                 json={"auto_accept_from": [{"business_id": w["shop"]}]}, headers=w["h"]["courier"], timeout=30)
    r = requests.put(f"{M}/businesses/{w['courier']}/orders/settings", json={"delivery_fee": 15}, headers=w["h"]["courier"], timeout=30)
    assert r.status_code == 200, r.text
    assert db.businesses.find_one({"_id": w["courier"]})["auto_accept_from"][0]["business_id"] == w["shop"]


def test_an_automated_order_never_bounces_back(w, db):
    """Mirror-image rules on both sides must not ping-pong."""
    _connect(w)
    _rule(w)
    _rule(w, who="courier", partner="shop", name="Back to shop")
    oid = _order(w)
    _status(w, oid, "preparing"); _status(w, oid, "ready")
    got = _partner_orders(db, w)[0]
    _status(w, got["_id"], "preparing", who="courier")
    _status(w, got["_id"], "ready", who="courier")
    time.sleep(1.5)
    assert db.store_orders.count_documents({"business_id": w["shop"], "source": "automation"}) == 0
    assert db.automation_runs.find_one({"business_id": w["courier"], "result": "skipped"})


def test_a_saved_reorder_sends_on_demand(w, db):
    _connect(w, "shop", "courier")
    r = _rule(w, trigger={"type": "manual.reorder"},
              template={"items": "20 kg flour", "fulfilment": "pickup"}, name="Weekly flour")
    assert r.status_code == 200, r.text
    rid = r.json()["id"]
    run = requests.post(f"{M}/automations/{rid}/run", json={}, headers=w["h"]["shop"], timeout=30)
    assert run.status_code == 200, run.text
    got = db.store_orders.find_one({"_id": run.json()["created_order_id"]})
    assert got["business_id"] == w["courier"] and got["items"] == "20 kg flour"
    assert got["customer_name"] == db.businesses.find_one({"_id": w["shop"]})["name"]


def test_only_a_saved_reorder_can_be_run_by_hand(w):
    _connect(w)
    rid = _rule(w).json()["id"]
    assert requests.post(f"{M}/automations/{rid}/run", json={}, headers=w["h"]["shop"], timeout=30).status_code == 400


def test_nobody_else_can_touch_a_rule(w):
    _connect(w)
    rid = _rule(w).json()["id"]
    for method, url in (("patch", f"{M}/automations/{rid}"), ("delete", f"{M}/automations/{rid}"),
                        ("post", f"{M}/automations/{rid}/run")):
        r = getattr(requests, method)(url, json={}, headers=w["h"]["other"], timeout=30)
        assert r.status_code == 404, f"{method}: {r.status_code}"


def test_the_receiver_sees_why_an_order_arrived(w, db):
    _connect(w)
    _rule(w)
    oid = _order(w)
    _status(w, oid, "preparing"); _status(w, oid, "ready")
    _partner_orders(db, w)
    runs = requests.get(f"{M}/businesses/{w['courier']}/automations/runs", headers=w["h"]["courier"], timeout=30).json()["runs"]
    assert runs and runs[0]["direction"] == "received" and runs[0]["created_order_id"]
