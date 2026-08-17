"""Delete marketplace services (gigs) — one-off cleanup of test data.

Written 2026-08-17 to remove the fake services added while testing the
site before launch.

DRY RUN BY DEFAULT. It prints exactly what it would delete and changes
nothing. Deletion requires BOTH `--apply` and `--yes-i-mean-it`, because
this is irreversible and there is no undo on a Mongo delete.

    python -m scripts.delete_test_gigs                      # report only
    python -m scripts.delete_test_gigs --ids a,b,c          # report those
    python -m scripts.delete_test_gigs --all --apply --yes-i-mean-it

Deleting a gig orphans anything that points at it, so this also removes
the rows keyed by `gig_id`:

  * marketplace_reviews  — reviews of that gig
  * marketplace_bookings — bookings placed against it

Messages are NOT touched: a thread is between two people and may cover
more than one subject. Orphaned threads are harmless; a deleted booking
someone still sees in their dashboard is not.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402


def _describe_target(url: str) -> str:
    """Say WHICH database, without ever printing the URL — it carries the
    password (CLAUDE.md: never print a secret into the transcript)."""
    host = urlparse(url).hostname or "?"
    if host in ("localhost", "127.0.0.1"):
        return "LOCAL dev database"
    if "mongodb.net" in host:
        return "PRODUCTION Atlas cluster"
    return f"database on {host}"


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", default="", help="comma-separated gig ids")
    ap.add_argument("--all", action="store_true", help="every gig in the collection")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--yes-i-mean-it", dest="confirmed", action="store_true")
    args = ap.parse_args()

    url = os.environ.get("MONGO_URL")
    if not url:
        print("MONGO_URL is not set.")
        return 2
    db_name = os.environ.get("DB_NAME", "israel_rental")
    db = AsyncIOMotorClient(url)[db_name]

    print(f"Target : {_describe_target(url)}  (db: {db_name})")

    if args.ids:
        ids = [i.strip() for i in args.ids.split(",") if i.strip()]
        query = {"_id": {"$in": ids}}
    elif args.all:
        query = {}
    else:
        print("\nNothing selected — pass --ids or --all. Reporting totals only.\n")
        query = None

    total = await db.marketplace_gigs.count_documents({})
    print(f"Gigs in collection, total: {total}")

    # The public /marketplace/gigs list hides drafts and gigs whose
    # provider's trial lapsed, so the site showing five proves nothing
    # about how many exist. Break it down.
    by_status: dict[str, int] = {}
    async for g in db.marketplace_gigs.find({}, {"status": 1}):
        by_status[g.get("status") or "(no status)"] = by_status.get(g.get("status") or "(no status)", 0) + 1
    for status, n in sorted(by_status.items()):
        print(f"  status={status}: {n}")

    if query is None:
        return 0

    doomed = [g async for g in db.marketplace_gigs.find(query, {"title": 1, "provider_user_id": 1, "status": 1})]
    gig_ids = [g["_id"] for g in doomed]
    reviews = await db.marketplace_reviews.count_documents({"gig_id": {"$in": gig_ids}})
    bookings = await db.marketplace_bookings.count_documents({"gig_id": {"$in": gig_ids}})

    print(f"\nWould delete {len(doomed)} gig(s):")
    for g in doomed:
        print(f"  - {g.get('title')!r}  [{g.get('status')}]  id={g['_id']}")
    print(f"Plus {reviews} review(s) and {bookings} booking(s) attached to them.")

    if not (args.apply and args.confirmed):
        print("\nDRY RUN - nothing was changed. Re-run with --apply --yes-i-mean-it.")
        return 0

    r1 = await db.marketplace_gigs.delete_many({"_id": {"$in": gig_ids}})
    r2 = await db.marketplace_reviews.delete_many({"gig_id": {"$in": gig_ids}})
    r3 = await db.marketplace_bookings.delete_many({"gig_id": {"$in": gig_ids}})
    print(f"\nDELETED gigs={r1.deleted_count} reviews={r2.deleted_count} bookings={r3.deleted_count}")
    print(f"Gigs remaining: {await db.marketplace_gigs.count_documents({})}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
