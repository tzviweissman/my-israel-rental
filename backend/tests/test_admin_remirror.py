"""Regression test for POST /admin/properties/remirror — one-click
recovery for listings whose images are still on source URLs after an
interrupted import.

Seeds three listings directly in Mongo with different photo states
(source URLs, all-Cloudinary, no images) and asserts the endpoint
classifies each correctly.
"""
import asyncio
import os
import uuid

import pytest
import requests
from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "admin@rental.com")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "Admin1234!")


def _env():
    return dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env"))


def _login_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture
def seeded_properties():
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL not set")
    env = _env()
    src_id = str(uuid.uuid4())
    cdn_id = str(uuid.uuid4())
    empty_id = str(uuid.uuid4())
    base = {
        "owner_id": "remirror-test-owner",
        "title": "rt", "description": "x",
        "area": "Jerusalem - American Colony",
        "rental_type": "vacation", "property_type": "apartment",
        "bedrooms": 2, "bathrooms": 1, "nightly_price": 100,
        "currency": "ILS", "status": "active", "videos": [],
    }

    async def seed():
        c = AsyncIOMotorClient(env["MONGO_URL"])
        db = c[env["DB_NAME"]]
        await db.properties.insert_one({**base, "id": src_id, "title": "src-urls",
            "address": f"src {uuid.uuid4().hex[:6]}",
            "images": ["https://supabase.example.com/img1.jpg",
                       "https://supabase.example.com/img2.jpg"],
        })
        await db.properties.insert_one({**base, "id": cdn_id, "title": "all-cdn",
            "address": f"cdn {uuid.uuid4().hex[:6]}",
            "images": ["https://res.cloudinary.com/xx/image/upload/a.jpg",
                       "https://res.cloudinary.com/xx/image/upload/b.jpg"],
        })
        await db.properties.insert_one({**base, "id": empty_id, "title": "empty",
            "address": f"empty {uuid.uuid4().hex[:6]}",
            "images": [],
        })
        c.close()

    asyncio.run(seed())
    yield {"src_id": src_id, "cdn_id": cdn_id, "empty_id": empty_id}

    async def cleanup():
        c = AsyncIOMotorClient(env["MONGO_URL"])
        db = c[env["DB_NAME"]]
        await db.properties.delete_many({"id": {"$in": [src_id, cdn_id, empty_id]}})
        c.close()

    asyncio.run(cleanup())


def test_remirror_classifies_listings_correctly(seeded_properties):
    """The endpoint must distinguish all-CDN (skip), source-URLs (queue),
    and empty (report). Cloudinary must be configured in the env — if
    not, the endpoint returns 503 which we accept as a graceful skip."""
    token = _login_token()
    r = requests.post(f"{BASE_URL}/api/admin/properties/remirror",
        headers={"Authorization": f"Bearer {token}"})
    if r.status_code == 503:
        pytest.skip("Cloudinary not configured in this env")
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    body = r.json()
    assert body["scanned"] >= 3
    # Our three seeded rows: 1 queued (src), 1 already_cdn, 1 no_images.
    # Other rows in the DB may bump these numbers — we only assert that
    # OUR rows landed in the right buckets.
    queued_ids = {x["id"] for x in body.get("queued_sample", [])}
    no_image_ids = {x["id"] for x in body.get("no_images_sample", [])}
    assert seeded_properties["src_id"] in queued_ids
    assert seeded_properties["empty_id"] in no_image_ids
    # The fully-CDN listing must NOT have been queued.
    assert seeded_properties["cdn_id"] not in queued_ids


def test_remirror_requires_admin():
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL not set")
    # No auth header → 401/403
    r = requests.post(f"{BASE_URL}/api/admin/properties/remirror")
    assert r.status_code in (401, 403)
