"""Featured items on the storefront: "Feature this" and the headline.

Up to three featured, the first shown large under the owner's own headline
(at most 60 characters), which reaches the public page and is cleared by
null. Nothing featured, nothing large: never picked for them.

Talks to the local API on :8001 (DEV_AUTOLOGIN=1, local MongoDB only) as the
dev owner, on a business created for the test and removed afterwards.
    .venv/Scripts/python -m pytest -q tests/test_featured_headline.py
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
MARKER = "_featured_test"


def _login():
    try:
        r = requests.get(f"{API}/auth/dev-login", params={"role": "owner"}, timeout=5)
        return r.json().get("token") if r.ok else None
    except requests.RequestException:
        return None


TOKEN = _login() if LOCAL else None
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
def biz():
    owner = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {TOKEN}"}, timeout=5).json()
    uid = owner.get("id") or owner.get("user_id")
    bid, slug = f"{MARKER}-{uuid.uuid4().hex[:6]}", f"featured-test-{uuid.uuid4().hex[:6]}"
    gigs = [f"{bid}-g{i}" for i in range(4)]

    async def seed(db):
        await db.businesses.insert_one({"_id": bid, "slug": slug, "name": "Featured Test", "owner_user_id": uid, "active": True,
                                        "marker": MARKER, "created_at": "2026-10-07T00:00:00+00:00"})
        await db.marketplace_gigs.insert_many([{"_id": g, "business_id": bid, "provider_user_id": uid, "status": "published",
                                                "title": f"Item {i}", "gig_type": "deliverable", "marker": MARKER,
                                                "tiers": [{"name": "Basic", "price": 79, "currency": "ILS"}]}
                                               for i, g in enumerate(gigs)])
    _db(seed)
    yield {"id": bid, "slug": slug, "gigs": gigs}

    async def clean(db):
        await db.businesses.delete_many({"marker": MARKER})
        await db.marketplace_gigs.delete_many({"marker": MARKER})
    _db(clean)


def patch(bid, body):
    return requests.patch(f"{API}/marketplace/businesses/{bid}", json=body,
                          headers={"Authorization": f"Bearer {TOKEN}"}, timeout=10)


def public(slug):
    return requests.get(f"{API}/marketplace/business/{slug}", timeout=10).json()


def test_nothing_featured_by_default(biz):
    p = public(biz["slug"])
    assert p["pinned_service_ids"] == [] and p["featured_headline"] is None


def test_feature_up_to_three_with_a_headline(biz):
    g = biz["gigs"]
    assert patch(biz["id"], {"pinned_service_ids": g[:4]}).status_code == 422          # four is refused
    r = patch(biz["id"], {"pinned_service_ids": g[:2], "featured_headline": "  Our   Shabbos favourite,\nready Friday "})
    assert r.status_code == 200, r.text
    assert r.json()["pinned_service_ids"] == g[:2]                                    # the owner sees it back
    p = public(biz["slug"])
    assert p["pinned_service_ids"] == g[:2]
    assert p["featured_headline"] == "Our Shabbos favourite, ready Friday"              # tidied, as one line
    assert p["featured_headline_lang"] == "en"
    assert patch(biz["id"], {"featured_headline": "x" * 61}).status_code == 422          # 60 at most


def test_headline_clears(biz):
    assert patch(biz["id"], {"featured_headline": None}).status_code == 200
    p = public(biz["slug"])
    assert p["featured_headline"] is None and p["featured_headline_translated"] is None
