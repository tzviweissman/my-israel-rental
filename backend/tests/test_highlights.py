"""'What you get' highlights (utils/highlights.py, storefront phase 3).

Up to four per item, from the fixed list for its kind, never free text;
food-only ones (kosher, vegan, gluten-free) only for a food business; and a
highlight that stops fitting (the business changed category) stays saved
but is not shown.

Talks to the local API on :8001 (DEV_AUTOLOGIN=1, local MongoDB only) as the
dev owner, on items created for the test and removed afterwards.
    .venv/Scripts/python -m pytest -q tests/test_highlights.py
"""
import asyncio
import os
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

API = os.environ.get("TEST_API", "http://localhost:8001/api")
LOCAL = any(h in os.environ.get("MONGO_URL", "") for h in ("localhost", "127.0.0.1"))
MARKER = "_highlights_test"


def _login():
    try:
        r = requests.get(f"{API}/auth/dev-login", params={"role": "owner"}, timeout=5)
        return r.json().get("token") if r.ok else None
    except requests.RequestException:
        return None


TOKEN = _login() if LOCAL else None
H = {"Authorization": f"Bearer {TOKEN}"}
pytestmark = pytest.mark.skipif(not TOKEN, reason="needs the local API with DEV_AUTOLOGIN=1 and the local MongoDB")


def _db(fn):
    async def go():
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        try:
            return await fn(client[os.environ["DB_NAME"]])
        finally:
            client.close()
    return asyncio.run(go())


@pytest.fixture(scope="module")
def world():
    uid = requests.get(f"{API}/auth/me", headers=H, timeout=5).json()["id"]
    tag = uuid.uuid4().hex[:6]
    plumber, bakery = f"{MARKER}-plumb-{tag}", f"{MARKER}-bake-{tag}"

    async def seed(db):
        await db.businesses.insert_many([
            {"_id": plumber, "slug": f"hl-plumb-{tag}", "name": "HL Plumbing", "owner_user_id": uid, "active": True, "categories": ["home-services-repair"], "marker": MARKER},
            {"_id": bakery, "slug": f"hl-bake-{tag}", "name": "HL Bakery", "owner_user_id": uid, "active": True, "categories": ["shops-products"], "marker": MARKER},
        ])
        await db.marketplace_gigs.insert_many([
            {"_id": f"{plumber}-svc", "business_id": plumber, "provider_user_id": uid, "status": "published", "title": "Leak fix",
             "gig_type": "deliverable", "category": "home-services-repair", "tiers": [{"name": "Visit", "price": 250, "currency": "ILS"}], "marker": MARKER},
            {"_id": f"{bakery}-shop", "business_id": bakery, "provider_user_id": uid, "status": "published", "title": "Challah",
             "gig_type": "store", "category": "shops-products", "products": [{"id": "p1", "name": "Challah", "price": 25, "currency": "ILS"}], "marker": MARKER},
        ])
    _db(seed)
    yield {"svc": f"{plumber}-svc", "shop": f"{bakery}-shop", "plumber": plumber, "bake_slug": f"hl-bake-{tag}"}

    async def clean(db):
        await db.businesses.delete_many({"marker": MARKER})
        await db.marketplace_gigs.delete_many({"marker": MARKER})
    _db(clean)


def put(gig, ids):
    return requests.patch(f"{API}/marketplace/gigs/{gig}", json={"highlights": ids}, headers=H, timeout=10)


def test_options_follow_kind_and_food(world):
    svc = requests.get(f"{API}/marketplace/gigs/{world['svc']}/highlight-options", headers=H, timeout=10).json()
    shop = requests.get(f"{API}/marketplace/gigs/{world['shop']}/highlight-options", headers=H, timeout=10).json()
    s_ids, p_ids = {o["id"] for o in svc["options"]}, {o["id"] for o in shop["options"]}
    assert "same_day" in s_ids and "kosher" not in s_ids and "handmade" not in s_ids
    assert {"kosher", "handmade", "delivery"} <= p_ids and "same_day" not in p_ids
    assert svc["max"] == 4


def test_only_the_list_and_at_most_four(world):
    assert put(world["svc"], ["Best in town"]).status_code == 400          # no free text
    assert put(world["svc"], ["kosher"]).status_code == 400                # food-only, not a food business
    assert put(world["svc"], ["same_day", "free_quote", "weekends", "evenings", "online"]).status_code == 400
    assert put(world["svc"], ["same_day", "free_quote"]).status_code == 200
    g = requests.get(f"{API}/marketplace/gigs/{world['svc']}", timeout=10).json()
    assert [h["id"] for h in g["highlights"]] == ["same_day", "free_quote"] and g["highlights"][0]["icon"] == "Zap"


def test_food_highlights_on_the_storefront_and_hidden_when_no_longer_food(world):
    assert put(world["shop"], ["kosher", "handmade"]).status_code == 200
    page = requests.get(f"{API}/marketplace/business/{world['bake_slug']}", timeout=10).json()
    assert [h["id"] for h in page["listings"][0]["highlights"]] == ["kosher", "handmade"]
    # the business stops being food: kosher stays saved but is not shown
    async def recat(db):
        await db.businesses.update_one({"slug": world["bake_slug"]}, {"$set": {"categories": ["creative-design"]}})
        await db.marketplace_gigs.update_one({"_id": world["shop"]}, {"$set": {"category": "creative-design"}})
    _db(recat)
    page = requests.get(f"{API}/marketplace/business/{world['bake_slug']}", timeout=10).json()
    assert [h["id"] for h in page["listings"][0]["highlights"]] == ["handmade"]


def test_clearing(world):
    assert put(world["svc"], []).status_code == 200
    assert requests.get(f"{API}/marketplace/gigs/{world['svc']}", timeout=10).json()["highlights"] == []
