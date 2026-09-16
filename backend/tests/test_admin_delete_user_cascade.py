"""Deleting an account takes their own things and leaves the other party's.

THE BUG. `DELETE /admin/users/{id}` deleted exactly two things: the user row
and their properties. Everything else keyed to that person stayed behind -
their business pages, their service listings, their posts on the Requests
board, their subleases, their saved searches and alerts. A deleted
landlord's gigs went on being browsable and messageable by people who could
never get a reply.

THE LINE, and it is a decision rather than a technical limit (Tzvi, 16 Sep
2026): things that were only ever theirs go; things with a SECOND person in
them stay, because that person did not ask to be forgotten. A booking, a
signed contract, an order, a review they wrote about someone else and the
other half of a conversation all survive. The /terms page says this out
loud ("a signed contract belongs to both parties"), so the two have to move
together.

The test below is deliberately written from BOTH sides. Asserting only that
the right things vanished would pass just as happily for a cascade that
deleted the whole database.

Needs the live local API, the local Mongo, and the local test accounts
(see backend/tests/.env.test).
"""
from __future__ import annotations

import os
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
ADMIN = {"email": "admin@rental.com", "password": "Admin1234!"}


@pytest.fixture(scope="module")
def db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.fixture(scope="module")
def admin():
    r = requests.post(f"{BASE}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, f"local admin login failed: {r.text}"
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture()
def victim(db):
    """An account with one of everything, plus a booking from someone else.

    Seeded straight into Mongo rather than through the API: the point is the
    delete, and half of these have no create endpoint an owner can reach.
    """
    uid = f"del-{uuid.uuid4()}"
    other_id = f"other-{uuid.uuid4()}"
    stamp = datetime.now(UTC).isoformat()
    tag = uid[:12]

    db.users.insert_one({
        "id": uid, "email": f"{tag}@example.com", "name": "Delete Me",
        "role": "owner", "password": "not-a-real-hash", "created_at": stamp,
    })
    db.users.insert_one({
        "id": other_id, "email": f"{tag}-other@example.com", "name": "The Other Party",
        "role": "renter", "password": "not-a-real-hash", "created_at": stamp,
    })

    prop_id = f"{tag}-prop"
    owned = {
        "properties": {"id": prop_id, "owner_id": uid, "title": f"TEST_{tag}",
                       "area": "Jerusalem", "status": "active"},
        # `slug` is a UNIQUE index and a business without one collides with
        # every other slugless row, including the next run of this test.
        "businesses": {"id": f"{tag}-biz", "owner_user_id": uid, "name": f"TEST_{tag}",
                       "slug": f"test-{tag}", "active": True},
        "marketplace_gigs": {"id": f"{tag}-gig", "provider_user_id": uid,
                             "title": f"TEST_{tag}", "status": "published"},
        "requests": {"id": f"{tag}-req", "poster_user_id": uid, "status": "open",
                     "title": f"TEST_{tag}"},
        "subleases": {"id": f"{tag}-sub", "subleasor_id": uid, "title": f"TEST_{tag}"},
        "saved_searches": {"id": f"{tag}-ss", "user_id": uid, "name": f"TEST_{tag}"},
        "liked_properties": {"id": f"{tag}-like", "user_id": uid, "property_id": prop_id},
        "notification_preferences": {"id": f"{tag}-np", "user_id": uid, "mode": "instant"},
    }
    for collection, doc in owned.items():
        db[collection].insert_one(dict(doc))

    # The other party's records. These must survive.
    kept = {
        "bookings": {"id": f"{tag}-bk", "owner_id": uid, "renter_id": other_id,
                     "property_id": prop_id, "status": "confirmed"},
        "contracts": {"id": f"{tag}-ct", "owner_id": uid, "signed": True,
                      "original_filename": "agreement.pdf"},
        "messages": {"id": f"{tag}-msg", "sender_id": uid, "property_id": prop_id,
                     "text": "hello"},
    }
    for collection, doc in kept.items():
        db[collection].insert_one(dict(doc))

    yield {"uid": uid, "other_id": other_id, "tag": tag,
           "owned": owned, "kept": kept}

    # Clean up whatever the test did not delete.
    for collection in list(owned) + list(kept):
        db[collection].delete_many({"id": {"$regex": f"^{tag}-"}})
    db.users.delete_many({"id": {"$in": [uid, other_id]}})
    db.user_tombstones.delete_many({"user_id": uid})


def _delete(admin, uid):
    return requests.delete(f"{BASE}/admin/users/{uid}", headers=admin, timeout=60)


def test_their_own_things_are_deleted(admin, db, victim):
    r = _delete(admin, victim["uid"])
    assert r.status_code == 200, r.text

    assert db.users.find_one({"id": victim["uid"]}) is None, "the account itself must go"

    still_here = {
        collection: doc["id"]
        for collection, doc in victim["owned"].items()
        if db[collection].find_one({"id": doc["id"]}) is not None
    }
    assert not still_here, (
        "these were only ever this person's and should have gone with the "
        f"account: {still_here}"
    )


def test_the_other_party_keeps_theirs(admin, db, victim):
    """The half that makes this a cascade rather than a purge."""
    assert _delete(admin, victim["uid"]).status_code == 200

    for collection, doc in victim["kept"].items():
        assert db[collection].find_one({"id": doc["id"]}) is not None, (
            f"{collection} has a second person in it and must survive the "
            "deletion of one of them"
        )
    assert db.users.find_one({"id": victim["other_id"]}) is not None


def test_a_snapshot_is_written_before_anything_is_deleted(admin, db, victim):
    """Without this the operation is an irreversible mistake waiting to happen."""
    assert _delete(admin, victim["uid"]).status_code == 200

    snap = db.user_tombstones.find_one({"user_id": victim["uid"]})
    assert snap is not None, "no snapshot was taken"
    assert snap["user"]["email"].startswith(victim["tag"])
    assert "password" not in snap["user"], (
        "the snapshot must not carry the password hash"
    )

    saved = snap["collections"]
    for collection, doc in victim["owned"].items():
        rows = saved.get(collection) or []
        assert any(r.get("id") == doc["id"] for r in rows), (
            f"{collection} was deleted but not snapshotted - it cannot be undone"
        )


def test_an_admin_cannot_delete_themselves(admin, db):
    me = requests.get(f"{BASE}/admin/users", headers=admin, timeout=30)
    assert me.status_code == 200, me.text
    admin_row = next(u for u in me.json() if u["email"] == ADMIN["email"])

    r = _delete(admin, admin_row["id"])
    assert r.status_code == 400, r.text
    assert db.users.find_one({"id": admin_row["id"]}) is not None


def test_deleting_an_unknown_account_is_a_404_not_an_empty_success(admin):
    r = _delete(admin, f"no-such-user-{uuid.uuid4()}")
    assert r.status_code == 404, r.text


def test_a_non_admin_cannot_delete_anyone(db, victim):
    r = requests.delete(f"{BASE}/admin/users/{victim['uid']}", timeout=30)
    assert r.status_code in (401, 403), r.text
    assert db.users.find_one({"id": victim["uid"]}) is not None
