"""Dev fixtures for verified reviews: LOCAL database only.

Creates a rental, a business with one service, finished bookings with
verified reviews, and a few imported Google reviews (through the real
sync code, with Google faked), so the pages can be looked at. Refuses to
run unless MONGO_URL points at localhost.

    python -m scripts.seed_reviews_dev          # create, prints the ids and a review link
    python -m scripts.seed_reviews_dev --clean  # remove everything it made
"""
from __future__ import annotations

import asyncio
import os
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
if not any(h in os.environ.get("MONGO_URL", "") for h in ("localhost", "127.0.0.1")):
    sys.exit("Refusing: MONGO_URL is not a local database.")

from routes.deps import db  # noqa: E402
from utils import google_reviews as g  # noqa: E402
from utils import reviews as rv  # noqa: E402

# Guests on a different mail domain from the owner: a shared company
# domain is read as "works for the business" and refused (utils/reviews.py).
TAG = "seed-reviews"
OWNER, BIZ, GIG, PROP = f"{TAG}-owner", f"{TAG}-biz", f"{TAG}-gig", f"{TAG}-prop"
GUESTS = [("Sara Levi", 5, "Spotless flat, quiet street, and the host answered within minutes every time. We would book it again."),
          ("Daniel Katz", 4, "Good location near the shuk. The shower pressure was weak, but everything else matched the photos."),
          ("Miriam Cohen", 2, "The air conditioning in the bedroom did not work for two nights and it took a day to get a reply.")]
GOOGLE = [("Yossi B.", "FIVE", "Came on time and the kitchen has never been this clean."),
          ("Anna R.", "FOUR", "Very thorough, a little pricey."),
          ("Moshe T.", "ONE", "Cancelled on me the morning of the appointment.")]


class _Resp:
    def __init__(self, data):
        self.status_code, self._data = 200, data

    def json(self):
        return self._data


class _FakeGoogle:
    async def get(self, url, headers=None, params=None):
        return _Resp({"reviews": [{
            "name": f"accounts/1/locations/{TAG}/reviews/{i}", "starRating": stars, "comment": text,
            "createTime": f"2026-0{6 + i}-1{i}T10:00:00Z", "updateTime": f"2026-0{6 + i}-1{i}T10:00:00Z",
            "reviewer": {"displayName": name},
        } for i, (name, stars, text) in enumerate(GOOGLE)]})


async def clean() -> None:
    ids = [r["_id"] async for r in db.reviews.find({"$or": [{"listing_id": {"$in": [GIG, PROP]}}, {"business_id": BIZ}]}, {"_id": 1})]
    await db.reviews.delete_many({"_id": {"$in": ids}})
    await db.review_audit_log.delete_many({"review_id": {"$in": ids}})
    await db.review_reports.delete_many({"review_id": {"$in": ids}})
    await db.review_tokens.delete_many({"booking_id": {"$regex": f"^{TAG}"}})
    await db.review_requests.delete_many({"_id": {"$regex": f"^{TAG}"}})
    await db.bookings.delete_many({"id": {"$regex": f"^{TAG}"}})
    await db.marketplace_bookings.delete_many({"_id": {"$regex": f"^{TAG}"}})
    await db.users.delete_many({"id": {"$regex": f"^{TAG}"}})
    await db.properties.delete_many({"id": PROP})
    await db.marketplace_gigs.delete_many({"_id": GIG})
    await db.businesses.delete_many({"_id": BIZ})


async def seed() -> None:
    await clean()
    await rv.ensure_indexes(db)
    today = rv.today_il()
    now = datetime.now(UTC).isoformat()
    img = "https://res.cloudinary.com/demo/image/upload/sample.jpg"
    await db.users.insert_one({"id": OWNER, "email": f"{OWNER}@local.test", "name": "Seed Owner", "role": "owner", "created_at": now})
    await db.properties.insert_one({
        "id": PROP, "owner_id": OWNER, "title": "Sunny flat by the shuk", "rental_type": "vacation", "property_type": "apartment",
        "area": "Jerusalem", "nightly_price": 450, "images": [img], "status": "active", "bedrooms": 2, "bathrooms": 1,
        "description": "Dev fixture for reviews.", "created_at": now})
    await db.businesses.insert_one({"_id": BIZ, "owner_user_id": OWNER, "name": "Sparkle Cleaning", "slug": TAG,
                                    "status": "active", "areas": ["jerusalem"], "created_at": now})
    await db.marketplace_gigs.insert_one({
        "_id": GIG, "provider_user_id": OWNER, "business_id": BIZ, "title": "Home cleaning", "category": "cleaning-services",
        "area": "Jerusalem", "status": "published", "gig_type": "deliverable", "gallery": [img],
        "tiers": [{"name": "Basic", "price": 150, "currency": "ILS"}], "created_at": now})
    for i, (name, stars, text) in enumerate(GUESTS):
        uid, bid = f"{TAG}-guest{i}", f"{TAG}-stay{i}"
        end = today - timedelta(days=2 + i * 3)
        await db.users.insert_one({"id": uid, "email": f"{uid}@example.org", "name": name, "role": "renter", "created_at": now})
        await db.bookings.insert_one({"id": bid, "property_id": PROP, "renter_id": uid, "owner_id": OWNER, "status": "confirmed",
                                      "start_date": (end - timedelta(days=4)).isoformat(), "end_date": end.isoformat(), "created_at": now})
        r = await rv.create_native(db, booking_id=bid, user_id=uid, rating=stars, text=text,
                                   sub_ratings={"cleanliness": stars, "communication": max(1, stars - 1)})
        if stars <= 2:
            await rv.respond(db, r["_id"], OWNER, "We are sorry. The unit was replaced the same week, and we now answer within the hour.")
    cid, mbid = f"{TAG}-client", f"{TAG}-svc"
    await db.users.insert_one({"id": cid, "email": f"{cid}@example.org", "name": "Rachel Adler", "role": "renter", "created_at": now})
    await db.marketplace_bookings.insert_one({"_id": mbid, "gig_id": GIG, "provider_user_id": OWNER, "client_user_id": cid,
                                              "status": "completed", "preferred_date": (today - timedelta(days=3)).isoformat(),
                                              "completed_at": (datetime.now(UTC) - timedelta(days=3)).isoformat(), "created_at": now})
    await rv.create_native(db, booking_id=mbid, user_id=cid, rating=5, text="Two people, three hours, and the flat was ready for Shabbat.")
    await g.sync_location(db, _FakeGoogle(), "fake", {"location": f"accounts/1/locations/{TAG}", "maps_uri": "https://maps.google.com/",
                                                      **g.listing_target("gig", GIG, BIZ)}, OWNER)
    # One finished stay with NO review yet, for the form.
    wid, wbid = f"{TAG}-writer", f"{TAG}-open"
    await db.users.insert_one({"id": wid, "email": f"{wid}@example.org", "name": "Noa Peretz", "role": "renter", "created_at": now})
    await db.bookings.insert_one({"id": wbid, "property_id": PROP, "renter_id": wid, "owner_id": OWNER, "status": "confirmed",
                                  "start_date": (today - timedelta(days=5)).isoformat(), "end_date": (today - timedelta(days=1)).isoformat(),
                                  "created_at": now})
    token = await rv.mint_request_token(db, wbid)
    print(f"property: /property/{PROP}\nservice:  /services/gig/{GIG}\nbusiness: /business/{TAG}\nform:     /review/{token}")


asyncio.run(clean() if "--clean" in sys.argv else seed())
