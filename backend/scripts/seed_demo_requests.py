"""Seed demo requests into the LOCAL dev database.

There was no way to look at the Requests board with anything on it: the
dev database has no requests, and the board's card work (C1's response
count, C6's card anatomy) cannot be judged against an empty state. The
existing `seed_demo_gigs.py` solves the same problem for Services; this is
its counterpart, and follows its shape deliberately.

    python -m scripts.seed_demo_requests --wipe

Safety: refuses to run against anything that is not a local MongoDB. These
documents are obvious fixtures and must never reach production — the
board is public, so a stray demo request is a stray public post.

The seeded set is chosen to exercise the states the board has to render,
not to look impressive: zero responses (a brand-new post, which must NOT
show a response count), exactly one (the singular string), several, a
rental and a service variant, a long title that has to clamp to two
lines, and one expiring within a day.
"""
import argparse
import asyncio
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routes.deps import db  # noqa: E402

MONGO_URL = os.environ.get("MONGO_URL", "")

SEED_MARKER = "seed_demo_requests"

NOW = datetime.now(timezone.utc)


def _doc(**kw):
    """One request, with the fields _public() and the board actually read."""
    created = NOW - timedelta(days=kw.pop("age_days", 1))
    expires = NOW + timedelta(days=kw.pop("expires_days", 25))
    base = {
        "_id": str(uuid.uuid4()),
        "poster_user_id": kw.pop("poster", "demo-seeker-1"),
        "title_he": None,
        "description_he": None,
        "area": "Jerusalem",
        "budget_min": None,
        "budget_max": None,
        "budget_currency": "ILS",
        "category": None,
        "subcategory": None,
        "preferred_date": None,
        "rental_kind": None,
        "bedrooms_min": None,
        "move_in_date": None,
        "lease_months": None,
        "furnished": None,
        "amenities": [],
        "status": "open",
        "created_at": created.isoformat(),
        "updated_at": created.isoformat(),
        "expires_at": expires.isoformat(),
        "renewed_count": 0,
        "reminder_sent_at": None,
        "found_at": None,
        "contact_count": 0,
        "date_mode": "on",
        "hidden_by_admin": False,
        "report_count": 0,
        "reported_by": [],
        SEED_MARKER: True,
    }
    base.update(kw)
    return base


REQUESTS = [
    # contact_count 0 — the case that must render NO response clause.
    _doc(
        request_type="rental",
        title="2-bedroom near the Old City, from September",
        description="Family of four, long-term, quiet building preferred. Happy with an older apartment if the kitchen is workable.",
        area="Jerusalem - Old City",
        rental_kind="long-term",
        bedrooms_min=2,
        budget_max=7000,
        date_mode="flexible",
        move_in_date=None,
        contact_count=0,
        age_days=0,
    ),
    # Exactly 1 — the singular string.
    _doc(
        request_type="service",
        title="Mover for a 3rd-floor walk-up, no lift",
        description="One-bedroom's worth of furniture, Geula to Ramat Eshkol. Weekday morning is fine.",
        area="Jerusalem - Geula",
        category="moving-relocation",
        date_mode="on",
        preferred_date="2026-08-27",
        contact_count=1,
        age_days=3,
    ),
    _doc(
        request_type="service",
        title="Weekly cleaner, Thursday mornings",
        description="Regular slot, four hours, starting as soon as someone is free.",
        area="Jerusalem - Rehavia",
        category="cleaning-services",
        budget_max=200,
        date_mode="before",
        preferred_date="2026-09-30",
        contact_count=6,
        age_days=6,
    ),
    # Long title — has to clamp to two lines rather than push the card.
    _doc(
        request_type="rental",
        title="Furnished short-term apartment for a visiting family over Sukkot, ideally walking distance to a shul and with a sukkah balcony",
        description="Two weeks over the chag. Four adults, two children.",
        area="Jerusalem - Ramat Eshkol",
        rental_kind="short-term",
        bedrooms_min=3,
        furnished=True,
        date_mode="flexible",
        contact_count=12,
        age_days=9,
    ),
    # Expiring within a day — the urgent end of the status row.
    _doc(
        request_type="service",
        title="Hebrew-English translator for a lease",
        description="One document, need it read back to me in plain English before I sign anything.",
        area="Jerusalem",
        category="business-financial-services",
        contact_count=2,
        age_days=29,
        expires_days=1,
    ),
]


async def main(wipe: bool) -> None:
    if not MONGO_URL:
        sys.exit("MONGO_URL is not set — refusing to guess which database this is.")
    if not ("localhost" in MONGO_URL or "127.0.0.1" in MONGO_URL):
        sys.exit(
            "MONGO_URL does not look local. These are obvious fixtures and the "
            "Requests board is public — refusing to seed a non-local database."
        )

    if wipe:
        res = await db.requests.delete_many({SEED_MARKER: True})
        print(f"removed {res.deleted_count} previously seeded request(s)")

    await db.requests.insert_many([dict(d) for d in REQUESTS])
    print(f"inserted {len(REQUESTS)} demo request(s)")
    for r in REQUESTS:
        print(f"  {r['contact_count']:>2} responses · {r['request_type']:<7} · {r['title'][:52]}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--wipe", action="store_true", help="remove previously seeded demo requests first")
    asyncio.run(main(ap.parse_args().wipe))
