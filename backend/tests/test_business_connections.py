"""Business-to-business connections (docs/business-network-spec.md, Phase 1).

What each test holds:
  * the life cycle - request, accept, decline, disconnect - and that each
    step is only open to the side it belongs to;
  * resending is idempotent, and a request crossing one already sent the
    other way is an accept, not a second pending row;
  * a business cannot connect to itself, and nobody can act on a
    connection neither of their businesses is part of - and cannot even
    learn that it exists (404, not 403);
  * disconnecting pauses automations on the pair;
  * the courier migration makes accepted connections only where the
    courier runs exactly one business of their own, and never invents one.

Needs the live local API and the local Mongo (see backend/tests/.env.test).
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
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
        "email": f"net-{tag}-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": f"Net {tag}", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _business(h, name):
    r = requests.post(f"{M}/businesses", json={"name": f"TEST_net {name} {uuid.uuid4().hex[:6]}"}, headers=h, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


@pytest.fixture()
def world(db):
    """A bakery, a courier business and a stranger, each owned by a different person."""
    shop_h, courier_h, stranger_h = _account("shop"), _account("courier"), _account("stranger")
    ids = {
        "shop": _business(shop_h, "bakery"),
        "courier": _business(courier_h, "courier"),
        "stranger": _business(stranger_h, "stranger"),
    }
    yield {"h": {"shop": shop_h, "courier": courier_h, "stranger": stranger_h}, **ids}
    all_ids = list(ids.values())
    db.business_connections.delete_many({"$or": [{"a_id": {"$in": all_ids}}, {"b_id": {"$in": all_ids}}]})
    db.business_automations.delete_many({"business_id": {"$in": all_ids}})


def _ask(w, frm, to, **extra):
    return requests.post(f"{M}/businesses/{w[frm]}/connections",
                         json={"target_business_id": w[to], **extra}, headers=w["h"][frm], timeout=30)


def _status(w, me, other):
    r = requests.get(f"{M}/businesses/{w[me]}/connections/{w[other]}", headers=w["h"][me], timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def test_request_then_accept(world):
    r = _ask(world, "shop", "courier", note="Can you do Friday runs?", relationship="courier")
    assert r.status_code == 200, r.text
    conn = r.json()
    assert conn["status"] == "pending" and conn["direction"] == "outgoing"
    assert conn["other"]["id"] == world["courier"]

    assert _status(world, "courier", "shop")["direction"] == "incoming"

    listed = requests.get(f"{M}/businesses/{world['courier']}/connections", headers=world["h"]["courier"], timeout=30).json()
    assert listed["counts"]["incoming"] == 1

    r = requests.post(f"{M}/connections/{conn['id']}/accept", headers=world["h"]["courier"], timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "accepted"
    assert _status(world, "shop", "courier")["status"] == "accepted"


def test_the_asker_cannot_accept_their_own_request(world):
    conn = _ask(world, "shop", "courier").json()
    r = requests.post(f"{M}/connections/{conn['id']}/accept", headers=world["h"]["shop"], timeout=30)
    assert r.status_code == 403


def test_resending_is_idempotent(world):
    first = _ask(world, "shop", "courier").json()
    again = _ask(world, "shop", "courier").json()
    assert again["id"] == first["id"] and again["status"] == "pending"


def test_a_crossing_request_is_an_accept(world):
    """Both pressed Connect: that is agreement, not two pending rows."""
    first = _ask(world, "shop", "courier").json()
    back = _ask(world, "courier", "shop").json()
    assert back["id"] == first["id"]
    assert back["status"] == "accepted"


def test_decline_then_ask_again(world):
    conn = _ask(world, "shop", "courier").json()
    r = requests.post(f"{M}/connections/{conn['id']}/decline", headers=world["h"]["courier"], timeout=30)
    assert r.status_code == 200 and r.json()["status"] == "declined"
    again = _ask(world, "shop", "courier").json()
    assert again["id"] == conn["id"] and again["status"] == "pending"


def test_cannot_connect_to_itself(world):
    r = requests.post(f"{M}/businesses/{world['shop']}/connections",
                      json={"target_business_id": world["shop"]}, headers=world["h"]["shop"], timeout=30)
    assert r.status_code == 400


def test_cannot_ask_on_behalf_of_someone_elses_business(world):
    r = requests.post(f"{M}/businesses/{world['shop']}/connections",
                      json={"target_business_id": world["courier"]}, headers=world["h"]["stranger"], timeout=30)
    assert r.status_code == 403


def test_a_stranger_cannot_act_on_or_even_see_a_connection(world):
    conn = _ask(world, "shop", "courier").json()
    for action in ("accept", "decline", "disconnect"):
        r = requests.post(f"{M}/connections/{conn['id']}/{action}", headers=world["h"]["stranger"], timeout=30)
        assert r.status_code == 404, f"{action}: {r.status_code} - a stranger must not learn it exists"


def test_disconnect_pauses_automations_on_the_pair(world, db):
    conn = _ask(world, "shop", "courier").json()
    requests.post(f"{M}/connections/{conn['id']}/accept", headers=world["h"]["courier"], timeout=30)
    db.business_automations.insert_one({"_id": f"test-{uuid.uuid4()}", "business_id": world["shop"],
                                        "partner_business_id": world["courier"], "enabled": True})
    r = requests.post(f"{M}/connections/{conn['id']}/disconnect", headers=world["h"]["courier"], timeout=30)
    assert r.status_code == 200 and r.json()["status"] == "disconnected"
    rule = db.business_automations.find_one({"business_id": world["shop"]})
    assert rule["enabled"] is False and rule["paused_reason"] == "disconnected"


def test_only_the_asker_can_withdraw_a_pending_request(world):
    conn = _ask(world, "shop", "courier").json()
    r = requests.post(f"{M}/connections/{conn['id']}/disconnect", headers=world["h"]["courier"], timeout=30)
    assert r.status_code == 403, "the other side should decline, not withdraw"
    r = requests.post(f"{M}/connections/{conn['id']}/disconnect", headers=world["h"]["shop"], timeout=30)
    assert r.status_code == 200


def test_the_accept_and_the_notification(world, db):
    """The asked side hears about the request; the asker hears about the accept."""
    conn = _ask(world, "shop", "courier").json()
    courier_owner = db.businesses.find_one({"_id": world["courier"]})["owner_user_id"]
    shop_owner = db.businesses.find_one({"_id": world["shop"]})["owner_user_id"]
    assert db.notifications.find_one({"user_id": courier_owner, "connection_id": conn["id"]})
    requests.post(f"{M}/connections/{conn['id']}/accept", headers=world["h"]["courier"], timeout=30)
    assert db.notifications.find_one({"user_id": shop_owner, "connection_id": conn["id"]})


def test_the_dashboard_badge_counts_incoming_requests(world):
    _ask(world, "shop", "courier")
    s = requests.get(f"{BASE}/dashboard/summary", headers=world["h"]["courier"], timeout=30)
    assert s.status_code == 200, s.text
    assert s.json()["network_requests_in"] == 1
    s = requests.get(f"{BASE}/dashboard/summary", headers=world["h"]["shop"], timeout=30).json()
    assert s["network_requests_in"] == 0, "your own outgoing request is not waiting on you"


def test_courier_migration_converts_only_couriers_who_run_one_business(db):
    """Run the migration's own function against seeded rows."""
    from motor.motor_asyncio import AsyncIOMotorClient
    from scripts.migrate_couriers_to_connections import run

    tag = uuid.uuid4().hex[:8]
    shop, one_biz_user, no_biz_user = f"mig-shop-{tag}", f"mig-u1-{tag}", f"mig-u2-{tag}"
    courier_biz = f"mig-cbiz-{tag}"
    db.businesses.insert_many([
        {"_id": shop, "owner_user_id": f"mig-owner-{tag}", "slug": f"mig-shop-{tag}", "active": True,
         "couriers": [
             {"user_id": one_biz_user, "email": f"a{tag}@x.test", "status": "active"},
             {"user_id": no_biz_user, "email": f"b{tag}@x.test", "status": "active"},
             {"user_id": None, "email": f"c{tag}@x.test", "status": "invited"},
         ]},
        {"_id": courier_biz, "owner_user_id": one_biz_user, "slug": f"mig-c-{tag}", "active": True},
    ])
    try:
        async def go(apply):
            mdb = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
            return await run(mdb, apply=apply)

        dry = asyncio.run(go(False))
        a, b = sorted([shop, courier_biz])
        assert db.business_connections.find_one({"a_id": a, "b_id": b}) is None, "a dry run must not write"
        assert dry["created"] >= 1 and dry["no_business"] >= 1

        asyncio.run(go(True))
        conn = db.business_connections.find_one({"a_id": a, "b_id": b})
        assert conn and conn["status"] == "accepted" and conn["relationship"] == "courier"
        assert conn["requested_by"] == shop
        assert db.businesses.count_documents({"owner_user_id": no_biz_user}) == 0, "no business may be invented"

        again = asyncio.run(go(True))
        assert db.business_connections.count_documents({"a_id": a, "b_id": b}) == 1, "must be idempotent"
        assert again["created"] == 0 or again["already_connected"] >= 1
    finally:
        db.businesses.delete_many({"_id": {"$in": [shop, courier_biz]}})
        db.business_connections.delete_many({"$or": [{"a_id": {"$in": [shop, courier_biz]}}, {"b_id": {"$in": [shop, courier_biz]}}]})
