"""The "People looking for you" card (/marketplace/looking-for-me).

It shows open "want" posts that the caller's services or rentals could
answer, at most three, and nothing when none match. Requests are inserted
straight into the local database: posting through the API would spend
translation credit. Needs the local API and Mongo (backend/tests/.env.test).
"""
from __future__ import annotations

import os
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

from pymongo import MongoClient  # noqa: E402

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")
CATEGORY = "home-services-repair"


@pytest.fixture(scope="module")
def db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _account(tag):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"lfy-{tag}-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": f"Lfy {tag}", "role": "owner"}, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"], r.json()["user"]["id"]


def _get(tok):
    r = requests.get(f"{BASE}/marketplace/looking-for-me", headers={"Authorization": f"Bearer {tok}"}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def test_looking_for_me(db):
    tok, me = _account("lister")
    empty_tok, _ = _account("empty")
    tag = uuid.uuid4().hex[:8]
    gig_id, prop_id = f"TEST_lfy_gig_{tag}", f"TEST_lfy_prop_{tag}"
    db.marketplace_gigs.insert_one({"_id": gig_id, "provider_user_id": me, "category": CATEGORY,
                                    "status": "published", "title": "TEST_lfy gig"})
    db.properties.insert_one({"id": prop_id, "owner_id": me, "area": f"Jerusalem, Lfy{tag}",
                              "status": "active", "title": "TEST_lfy flat"})
    now = datetime.now(UTC)

    def post(title, minutes_ago, **kw):
        doc = {"_id": f"TEST_lfy_{uuid.uuid4().hex[:10]}", "title": title, "status": "open",
               "poster_user_id": "someone-else", "post_kind": "want", "hidden_by_admin": False,
               "created_at": (now - timedelta(minutes=minutes_ago)).isoformat(), **kw}
        db.requests.insert_one(doc)
        return doc["_id"]

    svc = post("fix my sink", 1, request_type="service", category=CATEGORY)
    flat = post("flat wanted", 2, request_type="rental", area=f"Lfy{tag}")
    older = post("older sink", 3, request_type="service", category=CATEGORY)
    oldest = post("oldest sink", 4, request_type="service", category=CATEGORY)
    post("my own post", 0, request_type="service", category=CATEGORY, poster_user_id=me)
    post("spare slot", 0, request_type="service", category=CATEGORY, post_kind="have")
    post("hidden", 0, request_type="service", category=CATEGORY, hidden_by_admin=True)
    post("closed", 0, request_type="service", category=CATEGORY, status="found")
    post("other area", 0, request_type="rental", area="Eilat")
    try:
        got = [r["id"] for r in _get(tok)]
        assert got == [svc, flat, older], "newest three matches, nothing else"
        assert oldest not in got
        assert _get(empty_tok) == [], "no listings, no card"
        row = _get(tok)[0]
        assert "poster_user_id" not in row and "whatsapp" not in row
    finally:
        db.requests.delete_many({"_id": {"$regex": "^TEST_lfy_"}})
        db.marketplace_gigs.delete_one({"_id": gig_id})
        db.properties.delete_one({"id": prop_id})
