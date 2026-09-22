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

DATA-DRIVEN, on purpose. The first version of this file hand-listed eight
of the twenty-two owned collections and three of the eight kept ones, and
the 17 Sep audit rightly called that partial. The fixture below seeds ONE
row in EVERY collection the cascade names, read from the cascade's own
tables, so adding a collection to `_USER_OWNED` without a row here is
impossible - the test seeds it automatically - and dropping one from the
cascade fails the test that expects it gone.

The test is written from BOTH sides. Asserting only that the right things
vanished would pass just as happily for a cascade that deleted the whole
database.

Needs the live local API, the local Mongo, and the local test accounts
(see backend/tests/.env.test).
"""
from __future__ import annotations

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

from routes.admin.core import _TWO_PARTY_KEPT, _USER_OWNED  # noqa: E402
from routes.deps import CONTRACT_DIR  # noqa: E402

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")
ADMIN = {"email": "admin@rental.com", "password": "Admin1234!"}

# The field that names the DELETED person in each kept collection. These
# were read off real documents, same as the cascade's own table.
_KEPT_FIELD = {
    "bookings": "owner_id",
    "marketplace_bookings": "provider_user_id",
    "contracts": "owner_id",
    "messages": "sender_id",
    "marketplace_reviews": "reviewer_user_id",
    "store_orders": "owner_user_id",
    "store_standing_orders": "owner_user_id",
    "marketplace_job_applications": "applicant_user_id",
    "request_reports": "reporter_user_id",
}

# Fields a collection's unique index insists on. Without a slug, two
# slugless businesses collide on `slug: null`.
_EXTRA = {
    "businesses": lambda tag: {"slug": f"test-{tag}", "name": f"TEST_{tag}", "active": True},
    "properties": lambda tag: {"title": f"TEST_{tag}", "area": "Jerusalem", "status": "active"},
    "marketplace_gigs": lambda tag: {"title": f"TEST_{tag}", "status": "published"},
    "requests": lambda tag: {"title": f"TEST_{tag}", "status": "open"},
    "short_links": lambda tag: {"slug": f"t{tag[:8]}", "target_type": "business", "target_id": f"{tag}-biz"},
}


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
    """An account with one row in EVERY collection the cascade names, a
    contract file on disk, and a second person to leave records behind for.

    Seeded straight into Mongo: the point is the delete, and half of these
    have no create endpoint an owner can reach.
    """
    uid = f"del-{uuid.uuid4()}"
    other_id = f"other-{uuid.uuid4()}"
    stamp = datetime.now(UTC).isoformat()
    tag = uid[4:16]

    db.users.insert_one({
        "id": uid, "email": f"{tag}@example.com", "name": "Delete Me",
        "role": "owner", "password": "not-a-real-hash", "created_at": stamp,
    })
    db.users.insert_one({
        "id": other_id, "email": f"{tag}-other@example.com", "name": "The Other Party",
        "role": "renter", "password": "not-a-real-hash", "created_at": stamp,
    })

    # A real file under CONTRACT_DIR, referenced the way the upload path
    # stores it, so the cascade has something physical to remove.
    contract_file = CONTRACT_DIR / f"test-cascade-{tag}.pdf"
    contract_file.write_bytes(b"%PDF-1.4\n%%EOF\n")

    owned = {}
    for collection, field in _USER_OWNED:
        doc = {"id": f"{tag}-{collection}", field: uid, "created_at": stamp}
        doc.update(_EXTRA.get(collection, lambda _t: {})(tag))
        if collection == "properties":
            doc["contract_url"] = f"/api/uploads/{contract_file.name}"
        db[collection].insert_one(doc)
        owned[collection] = doc["id"]

    kept = {}
    for collection in _TWO_PARTY_KEPT:
        field = _KEPT_FIELD[collection]
        doc = {"id": f"{tag}-{collection}", field: uid, "other_party": other_id, "created_at": stamp}
        db[collection].insert_one(doc)
        kept[collection] = doc["id"]

    yield {"uid": uid, "other_id": other_id, "tag": tag,
           "owned": owned, "kept": kept, "contract_file": contract_file}

    for collection in list(owned) + list(kept):
        db[collection].delete_many({"id": {"$regex": f"^{tag}-"}})
    db.users.delete_many({"id": {"$in": [uid, other_id]}})
    db.user_tombstones.delete_many({"user_id": uid})
    contract_file.unlink(missing_ok=True)


def _delete(admin, uid):
    return requests.delete(f"{BASE}/admin/users/{uid}", headers=admin, timeout=60)


def test_every_owned_collection_is_cleared(admin, db, victim):
    r = _delete(admin, victim["uid"])
    assert r.status_code == 200, r.text
    assert db.users.find_one({"id": victim["uid"]}) is None, "the account itself must go"

    still_here = {
        c: doc_id for c, doc_id in victim["owned"].items()
        if db[c].find_one({"id": doc_id}) is not None
    }
    assert not still_here, (
        "these were only ever this person's and should have gone with the "
        f"account: {sorted(still_here)}"
    )


def test_every_two_party_collection_survives(admin, db, victim):
    """The half that makes this a cascade rather than a purge."""
    assert _delete(admin, victim["uid"]).status_code == 200

    gone = [c for c, doc_id in victim["kept"].items() if db[c].find_one({"id": doc_id}) is None]
    assert not gone, (
        f"{gone} have a second person in them and must survive the deletion of one of them"
    )
    assert db.users.find_one({"id": victim["other_id"]}) is not None


def test_the_contract_file_on_disk_is_removed_with_the_property(admin, victim):
    """The DB pointer used to go and the file stayed: a legal document with
    a tenant's name in it, on the persistent volume, unreachable forever
    (17 Sep audit)."""
    assert victim["contract_file"].exists(), "fixture did not write the file"
    assert _delete(admin, victim["uid"]).status_code == 200
    assert not victim["contract_file"].exists(), (
        "the property's contract file must be unlinked when its owner is deleted"
    )


def test_a_snapshot_is_written_before_anything_is_deleted(admin, db, victim):
    """Without this the operation is an irreversible mistake waiting to happen."""
    assert _delete(admin, victim["uid"]).status_code == 200

    snap = db.user_tombstones.find_one({"user_id": victim["uid"]})
    assert snap is not None, "no snapshot was taken"
    assert snap["user"]["email"].startswith(victim["tag"])
    assert "password" not in snap["user"], "the snapshot must not carry the password hash"

    saved = snap["collections"]
    missing = [
        c for c, doc_id in victim["owned"].items()
        if not any(r.get("id") == doc_id for r in (saved.get(c) or []))
    ]
    assert not missing, f"deleted but not snapshotted, so it cannot be undone: {missing}"


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


# ---------------------------------------------------------------------------
# Restore (22 Sep 2026). delete_user's docstring promised "an admin who
# deletes the wrong row has the rows back", and nothing could put them back
# (dead-ends audit, 21 Sep). Worse, the snapshot dropped `_id`, which for
# businesses, gigs and requests IS the record's identity.
# ---------------------------------------------------------------------------

def _restore(admin, snap_id):
    return requests.post(f"{BASE}/admin/users/deleted/{snap_id}/restore", headers=admin, timeout=60)


def test_restore_brings_everything_back_with_the_same_ids(admin, db, victim):
    # A business keyed the way real ones are: the string _id is the identity,
    # and an order elsewhere points at it.
    biz_id = f"{victim['tag']}-realbiz"
    db.businesses.insert_one({"_id": biz_id, "owner_user_id": victim["uid"], "name": "TEST_restore",
                              "slug": f"test-restore-{victim['tag']}", "active": True})
    try:
        r = _delete(admin, victim["uid"])
        assert r.status_code == 200, r.text
        snap_id = r.json()["snapshot_id"]
        assert db.businesses.find_one({"_id": biz_id}) is None

        listed = requests.get(f"{BASE}/admin/users/deleted", headers=admin, timeout=30).json()["deleted"]
        assert any(d["id"] == snap_id for d in listed), "a deleted account is listed for restore"

        r = _restore(admin, snap_id)
        assert r.status_code == 200, r.text
        user = db.users.find_one({"id": victim["uid"]})
        assert user and user["email"].startswith(victim["tag"])
        assert "password" not in user, "the password never comes back; they reset it"
        assert db.businesses.find_one({"_id": biz_id}), "restored under the SAME id, so orders still point at it"
        from routes.admin.core import _NOT_RESTORED
        missing = [c for c, doc_id in victim["owned"].items()
                   if c not in _NOT_RESTORED and not db[c].find_one({"id": doc_id})]
        assert not missing, f"not restored: {missing}"
        assert db.password_resets.find_one({"id": victim["owned"]["password_resets"]}) is None, \
            "a password reset token must never be brought back to life"
        assert r.json()["unrestorable"] == {}

        again = _restore(admin, snap_id)
        assert again.status_code == 404, "a snapshot cannot be applied twice"
        assert not any(d["id"] == snap_id for d in
                       requests.get(f"{BASE}/admin/users/deleted", headers=admin, timeout=30).json()["deleted"])
    finally:
        db.businesses.delete_one({"_id": biz_id})


def test_restore_refuses_when_the_email_is_taken_again(admin, db, victim):
    r = _delete(admin, victim["uid"])
    snap_id = r.json()["snapshot_id"]
    email = db.user_tombstones.find_one({"id": snap_id})["user"]["email"]
    db.users.insert_one({"id": f"new-{uuid.uuid4()}", "email": email, "name": "Someone new"})
    try:
        r = _restore(admin, snap_id)
        assert r.status_code == 409, "two accounts with one email is worse than a deletion"
        assert db.users.count_documents({"email": email}) == 1
    finally:
        db.users.delete_many({"email": email})


def test_an_old_snapshot_without_ids_reports_rather_than_invents(admin, db, victim):
    """Snapshots taken before 22 Sep have no `_id`. A business whose only
    identity was its `_id` must be reported, not reborn as a stranger."""
    snap_id = f"old-{uuid.uuid4()}"
    db.user_tombstones.insert_one({
        "id": snap_id, "user_id": f"gone-{victim['tag']}", "restored_at": None,
        "user": {"id": f"gone-{victim['tag']}", "email": f"gone-{victim['tag']}@example.com", "name": "Old"},
        "collections": {"businesses": [{"owner_user_id": f"gone-{victim['tag']}", "name": "no id"}]},
        "deleted_at": datetime.now(UTC).isoformat(),
    })
    try:
        r = _restore(admin, snap_id)
        assert r.status_code == 200, r.text
        assert r.json()["unrestorable"] == {"businesses": 1}
        assert db.businesses.find_one({"name": "no id", "owner_user_id": f"gone-{victim['tag']}"}) is None
    finally:
        db.users.delete_many({"id": f"gone-{victim['tag']}"})
        db.user_tombstones.delete_one({"id": snap_id})


def test_a_non_admin_cannot_list_or_restore(db, victim):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"nonadmin-{stamp}@example.com", "password": f"Pw-{stamp}-ok1", "name": "N", "role": "owner",
    }, timeout=30)
    h = {"Authorization": f"Bearer {r.json()['token']}"}
    assert requests.get(f"{BASE}/admin/users/deleted", headers=h, timeout=30).status_code == 403
    assert requests.post(f"{BASE}/admin/users/deleted/anything/restore", headers=h, timeout=30).status_code == 403
