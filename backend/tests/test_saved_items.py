"""Saved services and products (storefront phase 5).

The heart toggles; {"saved": true} sets (the save completed after signing
in must never undo one); only published items can be saved; the saved list
carries no contact details; and saved items never leak into the saved
PROPERTIES lists that share the collection.

Talks to the local API on :8001 (DEV_AUTOLOGIN=1, local MongoDB only) as the
dev renter, on an item created for the test and removed afterwards.
    .venv/Scripts/python -m pytest -q tests/test_saved_items.py
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
MARKER = "_saved_items_test"


def _login():
    try:
        r = requests.get(f"{API}/auth/dev-login", params={"role": "renter"}, timeout=5)
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
def item():
    tag = uuid.uuid4().hex[:6]
    bid, gid, paused = f"{MARKER}-b-{tag}", f"{MARKER}-g-{tag}", f"{MARKER}-p-{tag}"

    async def seed(db):
        await db.businesses.insert_one({"_id": bid, "slug": f"saved-test-{tag}", "name": "Saved Test", "owner_user_id": "someone",
                                        "active": True, "marker": MARKER})
        base = {"business_id": bid, "provider_user_id": "someone", "gig_type": "deliverable", "marker": MARKER,
                "tiers": [{"name": "Basic", "price": 79, "currency": "ILS"}], "whatsapp": "0501112233", "contact_email": "pro@example.com"}
        await db.marketplace_gigs.insert_many([{**base, "_id": gid, "status": "published", "title": "Saved thing"},
                                               {**base, "_id": paused, "status": "paused", "title": "Paused thing"}])
    _db(seed)
    yield {"gig": gid, "paused": paused}

    async def clean(db):
        await db.businesses.delete_many({"marker": MARKER})
        await db.marketplace_gigs.delete_many({"marker": MARKER})
        await db.liked_properties.delete_many({"gig_id": {"$in": [gid, paused]}})
    _db(clean)


def save(gid, body=None):
    return requests.post(f"{API}/gigs/{gid}/save", json=body if body is not None else {}, headers=H, timeout=10)


def test_needs_sign_in(item):
    assert requests.post(f"{API}/gigs/{item['gig']}/save", json={}, timeout=10).status_code in (401, 403)


def test_toggle_set_and_list(item):
    g = item["gig"]
    assert save(g).json() == {"saved": True}
    assert save(g, {"saved": True}).json() == {"saved": True}          # setting twice keeps it saved
    assert g in requests.get(f"{API}/saved-gig-ids", headers=H, timeout=10).json()
    listed = requests.get(f"{API}/saved-gigs", headers=H, timeout=10)
    row = next(x for x in listed.json() if x["id"] == g)
    assert row["business"]["name"] == "Saved Test"
    assert "0501112233" not in listed.text and "pro@example.com" not in listed.text   # no contact details
    # never in the saved PROPERTIES lists
    assert g not in requests.get(f"{API}/liked-property-ids", headers=H, timeout=10).json()
    assert requests.get(f"{API}/liked-properties", headers=H, timeout=10).status_code == 200
    assert save(g).json() == {"saved": False}                           # the heart again unsaves


def test_only_published_items(item):
    assert save(item["paused"]).status_code == 404
