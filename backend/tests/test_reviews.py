"""Verified reviews (utils/reviews.py, utils/google_reviews.py).

In-process against a scratch database on the LOCAL MongoDB, dropped after
each test; skipped if MONGO_URL is not local. Google is a fake: nothing
here calls a real Google endpoint.

    .venv/Scripts/python -m pytest -q tests/test_reviews.py
"""
from __future__ import annotations

import asyncio
import os
import uuid
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import jwt
import pytest
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from utils import google_reviews as g  # noqa: E402
from utils import reviews as rv  # noqa: E402

LOCAL = any(h in os.environ.get("MONGO_URL", "") for h in ("localhost", "127.0.0.1"))
pytestmark = pytest.mark.skipif(not LOCAL, reason="needs the local MongoDB; never runs against a remote one")

TODAY = date(2026, 9, 23)


def run(test):
    """Run `test(db)` against a fresh scratch database, then drop it."""
    async def go():
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = client[f"reviews_test_{uuid.uuid4().hex[:10]}"]
        try:
            await rv.ensure_indexes(db)
            await test(db)
        finally:
            await client.drop_database(db.name)
            client.close()
    asyncio.run(go())


async def seed_stay(db, *, status="confirmed", end=TODAY - timedelta(days=1), guest_email="guest@gmail.com",
                    owner_email="owner@acme-rentals.co.il"):
    owner, guest = f"o-{uuid.uuid4().hex[:6]}", f"g-{uuid.uuid4().hex[:6]}"
    prop, bid = f"p-{uuid.uuid4().hex[:6]}", f"b-{uuid.uuid4().hex[:6]}"
    await db.users.insert_many([{"id": owner, "email": owner_email, "name": "Olivia Owner"},
                                {"id": guest, "email": guest_email, "name": "sara levi"}])
    await db.properties.insert_one({"id": prop, "owner_id": owner, "title": "Garden flat"})
    await db.bookings.insert_one({"id": bid, "property_id": prop, "renter_id": guest, "owner_id": owner, "status": status,
                                  "start_date": (end - timedelta(days=3)).isoformat(), "end_date": end.isoformat()})
    return {"owner": owner, "guest": guest, "prop": prop, "booking": bid}


async def seed_service(db, *, status="completed", done=TODAY - timedelta(days=2)):
    owner, client = f"o-{uuid.uuid4().hex[:6]}", f"c-{uuid.uuid4().hex[:6]}"
    await db.users.insert_many([{"id": owner, "email": "pro@gmail.com", "name": "Pro"},
                                {"id": client, "email": "client@gmail.com", "name": "Dan Cohen"}])
    await db.businesses.insert_one({"_id": "biz1", "owner_user_id": owner, "name": "Sparkle"})
    await db.marketplace_gigs.insert_one({"_id": "gig1", "provider_user_id": owner, "business_id": "biz1", "title": "Cleaning"})
    await db.marketplace_bookings.insert_one({"_id": "mb1", "gig_id": "gig1", "provider_user_id": owner, "client_user_id": client,
                                              "status": status, "preferred_date": done.isoformat(),
                                              "completed_at": datetime(done.year, done.month, done.day, 10, tzinfo=UTC).isoformat()})
    return {"owner": owner, "client": client, "booking": "mb1"}


TEXT = "Lovely place, exactly as described, host answered fast."


async def verdict(db, booking_id, user_id, today=TODAY):
    return (await rv.check_eligibility(db, await rv.load_booking(db, booking_id), user_id, today=today))["reason"]


# ------------------------------------------------------------ eligibility

def test_eligibility_rejections():
    async def t(db):
        s = await seed_stay(db)
        assert await verdict(db, s["booking"], s["guest"]) is None                     # the happy path
        assert await verdict(db, s["booking"], "someone-else") == "not_yours"
        own = await seed_stay(db)                                                        # the owner booked their own place
        await db.bookings.update_one({"id": own["booking"]}, {"$set": {"renter_id": own["owner"]}})
        assert await verdict(db, own["booking"], own["owner"]) == "own_listing"
        assert await verdict(db, "no-such-booking", s["guest"]) == "not_found"
        p = await seed_stay(db, status="pending")
        assert await verdict(db, p["booking"], p["guest"]) == "not_completed"
        c = await seed_stay(db, status="cancelled")
        assert await verdict(db, c["booking"], c["guest"]) == "cancelled"
        early = await seed_stay(db, end=TODAY)                                          # checks out today
        assert await verdict(db, early["booking"], early["guest"]) == "too_early"
        late = await seed_stay(db, end=TODAY - timedelta(days=31))
        assert await verdict(db, late["booking"], late["guest"]) == "window_closed"
        edge = await seed_stay(db, end=TODAY - timedelta(days=30))
        assert await verdict(db, edge["booking"], edge["guest"]) is None
        staff = await seed_stay(db, guest_email="dina@acme-rentals.co.il")               # works for the owner
        assert await verdict(db, staff["booking"], staff["guest"]) == "own_listing"
        await rv.create_native(db, booking_id=s["booking"], user_id=s["guest"], rating=5, text=TEXT, today=TODAY)
        assert await verdict(db, s["booking"], s["guest"]) == "already_reviewed"
        with pytest.raises(rv.ReviewError) as e:
            await rv.create_native(db, booking_id=s["booking"], user_id=s["guest"], rating=4, text=TEXT, today=TODAY)
        assert e.value.code == "already_reviewed"
        with pytest.raises(rv.ReviewError) as e:
            await rv.create_native(db, booking_id=late["booking"], user_id=late["guest"], rating=4, text=TEXT, today=TODAY)
        assert e.value.code == "window_closed"
    run(t)


def test_service_bookings_need_completion():
    async def t(db):
        s = await seed_service(db)
        assert await verdict(db, "mb1", s["client"]) is None
        await db.marketplace_bookings.update_one({"_id": "mb1"}, {"$set": {"status": "accepted"}})
        assert await verdict(db, "mb1", s["client"]) == "not_completed"
        await db.marketplace_bookings.update_one({"_id": "mb1"}, {"$set": {"status": "completed"}})
        with pytest.raises(rv.ReviewError) as e:                  # detailed scores are for stays
            await rv.create_native(db, booking_id="mb1", user_id=s["client"], rating=5, text=TEXT,
                                   sub_ratings={"cleanliness": 5}, today=TODAY)
        assert e.value.code == "bad_sub_ratings"
        r = await rv.create_native(db, booking_id="mb1", user_id=s["client"], rating=5, text=TEXT, today=TODAY)
        assert (r["business_id"], r["listing_id"], r["author_display_name"]) == ("biz1", "gig1", "Dan C.")
    run(t)


def test_form_rules_and_plain_text():
    async def t(db):
        s = await seed_stay(db)
        for bad in (0, 6, "5", None, True):
            with pytest.raises(rv.ReviewError):
                await rv.create_native(db, booking_id=s["booking"], user_id=s["guest"], rating=bad, text=TEXT, today=TODAY)
        with pytest.raises(rv.ReviewError) as e:
            await rv.create_native(db, booking_id=s["booking"], user_id=s["guest"], rating=5, text="Great!", today=TODAY)
        assert e.value.code == "text_too_short"
        r = await rv.create_native(db, booking_id=s["booking"], user_id=s["guest"], rating=4,
                                   text="<script>alert(1)</script>Clean and quiet, <b>great</b> host.",
                                   sub_ratings={"cleanliness": 5, "value": 3}, today=TODAY)
        assert "<" not in r["text"] and r["text"].startswith("alert(1)Clean")
        assert r["author_display_name"] == "Sara L." and r["verified"] and r["source"] == "native"
    run(t)


# ------------------------------------------------------------ moderation

def test_removal_reasons_are_enforced():
    async def t(db):
        s = await seed_stay(db)
        r = await rv.create_native(db, booking_id=s["booking"], user_id=s["guest"], rating=1, text=TEXT, today=TODAY)
        for bad in ("negative", "Negative", "low rating", "", None, "deleted_at_source"):
            with pytest.raises(rv.ReviewError) as e:
                await rv.remove_review(db, r["_id"], "admin", bad)
            assert e.value.code == "bad_reason"
        assert (await db.reviews.find_one({"_id": r["_id"]}))["status"] == "published"
        await rv.remove_review(db, r["_id"], "admin", "spam")
        after = await db.reviews.find_one({"_id": r["_id"]})
        assert (after["status"], after["removal_reason"]) == ("removed", "spam")
        actions = [a["action"] async for a in db.review_audit_log.find({"review_id": r["_id"]}).sort("timestamp", 1)]
        assert actions == ["create", "remove"]
    run(t)


def test_report_keeps_it_visible_until_an_admin_decides():
    async def t(db):
        s = await seed_stay(db)
        r = await rv.create_native(db, booking_id=s["booking"], user_id=s["guest"], rating=2, text=TEXT, today=TODAY)
        with pytest.raises(rv.ReviewError):
            await rv.report(db, r["_id"], s["owner"], "negative")
        await rv.report(db, r["_id"], s["owner"], "conflict_of_interest", "I think this is a competitor")
        page = await rv.list_reviews(db, {"listing_id": s["prop"]}, source=None, sort="newest", page=1)
        assert [x["status"] for x in page["reviews"]] == ["under_review"]
        await rv.approve_review(db, r["_id"], "admin")
        assert (await db.reviews.find_one({"_id": r["_id"]}))["status"] == "published"
    run(t)


def test_owners_cannot_change_reviews():
    async def t(db):
        s = await seed_stay(db)
        r = await rv.create_native(db, booking_id=s["booking"], user_id=s["guest"], rating=2, text=TEXT, today=TODAY)
        with pytest.raises(rv.ReviewError) as e:
            await rv.edit_native(db, r["_id"], s["owner"], rating=5, text="Actually it was perfect in every way.")
        assert e.value.code == "not_author"
        await rv.respond(db, r["_id"], s["owner"], "Sorry about the noise, we fixed the window.")
        await rv.respond(db, r["_id"], s["owner"], "Sorry about the noise; the window is fixed now.")
        with pytest.raises(rv.ReviewError):
            await rv.respond(db, r["_id"], s["guest"], "I am not the owner")
        stored = await db.reviews.find_one({"_id": r["_id"]})
        assert (stored["rating"], stored["text"]) == (2, TEXT)
        assert stored["owner_response"]["text"].endswith("fixed now.")
        # the author may edit for 48 hours, then it is locked
        await rv.edit_native(db, r["_id"], s["guest"], rating=3)
        old = (datetime.now(UTC) - timedelta(hours=49)).isoformat()
        await db.reviews.update_one({"_id": r["_id"]}, {"$set": {"created_at": old}})
        with pytest.raises(rv.ReviewError) as e:
            await rv.edit_native(db, r["_id"], s["guest"], rating=5)
        assert e.value.code == "locked"
    run(t)


# ------------------------------------------------------------ tokens

def test_links_expire_and_work_once():
    async def t(db):
        s = await seed_stay(db)
        token = await rv.mint_request_token(db, s["booking"])
        claims = await rv.read_request_token(db, token)
        await rv.create_native(db, booking_id=claims["booking_id"], user_id=s["guest"], rating=5, text=TEXT,
                               token_jti=claims["jti"], today=TODAY)
        with pytest.raises(rv.ReviewError) as e:
            await rv.read_request_token(db, token)
        assert e.value.code == "link_used"
        expired = jwt.encode({"kind": "review_request", "booking_id": s["booking"], "jti": "x",
                              "exp": datetime.now(UTC) - timedelta(seconds=1)}, os.environ["JWT_SECRET"], algorithm="HS256")
        with pytest.raises(rv.ReviewError) as e:
            await rv.read_request_token(db, expired)
        assert e.value.code == "link_expired"
        session = jwt.encode({"user_id": s["guest"], "role": "renter"}, os.environ["JWT_SECRET"], algorithm="HS256")
        with pytest.raises(rv.ReviewError) as e:
            await rv.read_request_token(db, session)
        assert e.value.code == "link_invalid"
    run(t)


# ------------------------------------------------------------ Google

class FakeResponse:
    def __init__(self, data, status=200):
        self._data, self.status_code = data, status

    def json(self):
        return self._data


class FakeGoogle:
    """Serves `reviews` in pages of `size`, like the v4 reviews endpoint."""

    def __init__(self, reviews, size=2):
        self.reviews, self.size, self.calls = reviews, size, 0

    async def get(self, url, headers=None, params=None):
        self.calls += 1
        start = int((params or {}).get("pageToken") or 0)
        chunk = self.reviews[start:start + self.size]
        nxt = start + self.size
        return FakeResponse({"reviews": chunk, **({"nextPageToken": str(nxt)} if nxt < len(self.reviews) else {})})


def gr(i, stars="FIVE", comment="Great", updated="2026-09-01T10:00:00Z"):
    return {"name": f"accounts/1/locations/9/reviews/r{i}", "starRating": stars, "comment": comment,
            "createTime": "2026-08-01T10:00:00Z", "updateTime": updated, "reviewer": {"displayName": f"Person {i}"}}


MAPPING = {"location": "accounts/1/locations/9", "maps_uri": "https://maps.google.com/?cid=9",
           "listing_id": "gig1", "listing_kind": "gig", "business_id": "biz1"}


def test_google_import_is_idempotent_and_follows_pages():
    async def t(db):
        fake = FakeGoogle([gr(i) for i in range(5)], size=2)
        first = await g.sync_location(db, fake, "tok", MAPPING, "owner1")
        assert (first["fetched"], first["added"], fake.calls) == (5, 5, 3)
        again = await g.sync_location(db, fake, "tok", MAPPING, "owner1")
        assert (again["added"], again["updated"], again["removed"]) == (0, 0, 0)
        assert await db.reviews.count_documents({"source": "google"}) == 5
        stored = await db.reviews.find_one({"external_id": "accounts/1/locations/9/reviews/r0"})
        assert (stored["rating"], stored["verified"], stored["external_url"]) == (5, False, MAPPING["maps_uri"])
    run(t)


def test_google_edits_and_deletions():
    async def t(db):
        await g.sync_location(db, FakeGoogle([gr(0), gr(1), gr(2)]), "tok", MAPPING, "owner1")
        edited = [gr(0, stars="TWO", comment="Went downhill", updated="2026-09-20T10:00:00Z"), gr(2)]
        res = await g.sync_location(db, FakeGoogle(edited), "tok", MAPPING, "owner1")
        assert (res["updated"], res["removed"]) == (1, 1)
        r0 = await db.reviews.find_one({"external_id": "accounts/1/locations/9/reviews/r0"})
        assert (r0["rating"], r0["text"]) == (2, "Went downhill")
        r1 = await db.reviews.find_one({"external_id": "accounts/1/locations/9/reviews/r1"})
        assert (r1["status"], r1["removal_reason"]) == ("removed", "deleted_at_source")

        class Broken(FakeGoogle):
            async def get(self, url, headers=None, params=None):
                if (params or {}).get("pageToken"):
                    return FakeResponse({}, status=500)
                return await super().get(url, headers, params)

        with pytest.raises(g.GoogleError):  # a failed page removes nothing
            await g.sync_location(db, Broken([gr(0), gr(2), gr(3)], size=1), "tok", MAPPING, "owner1")
        assert await db.reviews.count_documents({"source": "google", "status": "published"}) == 2
        # Google answers are read-only here: no owner response on them
        with pytest.raises(rv.ReviewError):
            await rv.respond(db, r0["_id"], "owner1", "Thanks")
        # disconnect hides them all together, reconnect brings them back
        assert await g.set_connected(db, "owner1", False, "owner1") == 3
        assert (await rv.summary(db, {"listing_id": "gig1"})) == {}
        await g.set_connected(db, "owner1", True, "owner1")
        assert (await rv.summary(db, {"listing_id": "gig1"}))["google"]["count"] == 2
    run(t)


def test_star_mapping():
    assert [g.map_review(gr(0, stars=s))["rating"] for s in ("ONE", "TWO", "THREE", "FOUR", "FIVE")] == [1, 2, 3, 4, 5]
    anon = {**gr(0), "reviewer": {"isAnonymous": True, "displayName": "x"}, "reviewReply": {"comment": "Thanks!", "updateTime": "t"}}
    m = g.map_review(anon)
    assert m["author_display_name"] == "Google user" and m["owner_response"]["text"] == "Thanks!"


# ------------------------------------------------------------ averages

def test_averages_are_kept_apart_by_source():
    async def t(db):
        s = await seed_service(db)
        await rv.create_native(db, booking_id="mb1", user_id=s["client"], rating=4, text=TEXT, today=TODAY)
        await g.sync_location(db, FakeGoogle([gr(0, stars="FIVE"), gr(1, stars="TWO"), gr(2, stars="TWO")]), "tok", MAPPING, s["owner"])
        summ = await rv.summary(db, {"listing_id": "gig1"})
        assert summ == {"native": {"avg": 4.0, "count": 1}, "google": {"avg": 3.0, "count": 3}}
        assert (await rv.summary(db, {"business_id": "biz1"}))["google"]["count"] == 3
        # a removed review drops out of the average; an under-review one stays
        low = await db.reviews.find_one({"source": "google", "rating": 2})
        await rv.remove_review(db, low["_id"], "admin", "spam")
        assert (await rv.summary(db, {"listing_id": "gig1"}))["google"] == {"avg": 3.5, "count": 2}
        page = await rv.list_reviews(db, {"listing_id": "gig1"}, source=None, sort="lowest", page=1)
        assert [x["rating"] for x in page["reviews"]] == [2, 4, 5]
    run(t)


def test_old_reviews_untouched_while_off(monkeypatch):
    from routes.marketplace.shared import _review_source
    monkeypatch.delenv("REVIEWS_NATIVE_ENABLED", raising=False)
    coll, match = _review_source({"gig_id": "gig1"})
    assert (coll.name, match) == ("marketplace_reviews", {"gig_id": "gig1"})
    monkeypatch.setenv("REVIEWS_NATIVE_ENABLED", "1")
    coll, match = _review_source({"gig_id": "gig1"})
    assert coll.name == "reviews" and match["source"] == "native" and match["listing_id"] == "gig1"


# ------------------------------------------------------------ request emails

def test_request_emails_one_plus_one_reminder(monkeypatch):
    import routes.reviews as routes_reviews
    import utils.email as email

    sent: list[dict] = []

    async def fake_send(to, name, title, url, *, kind, reminder):
        sent.append({"to": to, "reminder": reminder, "url": url, "kind": kind})
        return True

    monkeypatch.setattr(email, "send_review_request_email", fake_send)

    async def t(db):
        monkeypatch.setattr(routes_reviews, "db", db)
        s = await seed_stay(db, end=TODAY - timedelta(days=1))
        await seed_stay(db, status="cancelled")                        # never asked
        for day in range(0, 20):                                        # twenty daily runs
            await routes_reviews.send_review_requests(today=TODAY + timedelta(days=day))
        assert [x["reminder"] for x in sent] == [False, True]
        assert all(x["to"] == "guest@gmail.com" and x["kind"] == "stay" for x in sent)
        # once reviewed, no more mail, and the link in the mail works once
        token = sent[0]["url"].rsplit("/", 1)[-1]
        claims = await rv.read_request_token(db, token)
        assert claims["booking_id"] == s["booking"]
    run(t)
