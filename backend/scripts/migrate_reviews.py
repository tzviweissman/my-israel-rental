"""Set up verified reviews: indexes, then carry over the old service reviews
that can be proven (Tzvi, 23 Sep 2026).

An old review (marketplace_reviews) becomes a verified review when its
writer has a COMPLETED booking of that same service. The rest stay where
they are, untouched, and are simply not shown once REVIEWS_NATIVE_ENABLED
is on; switching the flag off shows them again. Nothing is deleted.

Dry run by default. Prints counts only, never names or emails.

    python -m scripts.migrate_reviews            # dry run
    python -m scripts.migrate_reviews --apply

Run it against dev first. For production, run it through `railway run`
from backend/ (see docs/verified-reviews.md) BEFORE turning the flag on.
"""
from __future__ import annotations

import asyncio
import sys
import uuid
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from routes.deps import db  # noqa: E402
from utils import reviews as rv  # noqa: E402


async def main(apply: bool) -> None:
    print(f"database: {db.name} | {'APPLYING' if apply else 'dry run'}")
    if apply:
        await rv.ensure_indexes(db)
        print("indexes: created (or already there)")
    proven = unproven = already = 0
    async for old in db.marketplace_reviews.find({}):
        if await db.reviews.find_one({"migrated_from": old["_id"]}, {"_id": 1}):
            already += 1
            continue
        booking = await db.marketplace_bookings.find_one(
            {"gig_id": old.get("gig_id"), "client_user_id": old.get("client_user_id"), "status": "completed"},
            sort=[("created_at", 1)])
        if not booking or await db.reviews.find_one({"booking_id": booking["_id"]}, {"_id": 1}):
            unproven += 1
            continue
        proven += 1
        if not apply:
            continue
        b = await rv.load_booking(db, booking["_id"])
        author = await db.users.find_one({"id": old.get("client_user_id")}, {"name": 1}) or {}
        created = old.get("created_at") or rv.now_iso()
        doc = {
            "_id": uuid.uuid4().hex, "listing_id": b["listing_id"], "listing_kind": "gig",
            "business_id": b["business_id"], "owner_user_ids": sorted(b["owner_ids"]),
            "source": "native", "verified": True, "booking_id": b["id"], "booking_kind": "service",
            "author_user_id": old.get("client_user_id"), "author_display_name": rv.display_name(author.get("name")),
            "rating": int(old.get("rating") or 0), "sub_ratings": None, "text": rv.clean_text(old.get("comment") or ""),
            "stay_start": b["start"], "stay_end": b["end"], "external_id": None, "external_url": None,
            "source_created_at": created, "source_updated_at": old.get("updated_at") or created,
            "status": "published", "removal_reason": None, "owner_response": None, "incentivized": False,
            "source_connected": True, "created_at": created, "updated_at": rv.now_iso(), "migrated_from": old["_id"],
        }
        await db.reviews.insert_one(doc)
        await rv.audit(db, doc["_id"], "migrate", None, None, doc)
    print(f"old reviews: {proven} proven by a completed booking"
          f"{' (carried over)' if apply else ' (would carry over)'} | {unproven} unproven (left as they are, not shown)"
          f" | {already} carried over before")


asyncio.run(main("--apply" in sys.argv))
