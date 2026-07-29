"""Clean up bookings that point at properties which no longer exist.

An "orphan" booking references a `property_id` with no matching property
document. It can't be opened, accepted, cancelled, or fulfilled by anyone
— it only inflates the admin dashboard's booking count.

SAFETY: this script is DRY-RUN by default. It prints exactly what it
would delete and changes nothing. It only writes when you pass --apply,
and even then it writes a JSON backup of every deleted document first.

Usage (from the `backend/` directory):

    # 1. See what would be deleted (safe, no changes):
    python scripts/cleanup_orphan_bookings.py

    # 2. Actually delete, after reviewing step 1:
    python scripts/cleanup_orphan_bookings.py --apply

Also shows the surviving (non-orphan) bookings in full so you can judge
them individually — those are NEVER touched by this script.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path(__file__).resolve().parent.parent
_env = dotenv_values(ROOT / ".env")

MONGO_URL = os.environ.get("MONGO_URL") or _env.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME") or _env.get("DB_NAME")

if not MONGO_URL or not DB_NAME:
    sys.exit(
        "MONGO_URL and DB_NAME must be set (backend/.env or environment).\n"
        "Point them at the database you want to clean."
    )


async def main(apply: bool) -> None:
    client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=15000)
    db = client[DB_NAME]

    print(f"database: {DB_NAME}")
    print(f"mode:     {'APPLY (will delete)' if apply else 'DRY RUN (no changes)'}\n")

    bookings = await db.bookings.find({}, {"_id": 0}).to_list(20000)
    total = len(bookings)
    print(f"total bookings: {total}")
    if total == 0:
        client.close()
        return

    # Which referenced properties actually still exist?
    prop_ids = {b.get("property_id") for b in bookings if b.get("property_id")}
    live: set[str] = set()
    if prop_ids:
        async for p in db.properties.find(
            {"id": {"$in": list(prop_ids)}}, {"_id": 0, "id": 1}
        ):
            live.add(p["id"])

    orphans = [b for b in bookings if b.get("property_id") not in live]
    keepers = [b for b in bookings if b.get("property_id") in live]

    print(f"  orphaned (property deleted): {len(orphans)}   <- deletion target")
    print(f"  still reference a live listing: {len(keepers)}   <- never touched\n")

    # --- The ones that will SURVIVE, in detail. Review these by hand. ----
    print("=" * 72)
    print("SURVIVING BOOKINGS (not touched by this script) — review these:")
    print("=" * 72)
    if not keepers:
        print("  (none)")
    for b in sorted(keepers, key=lambda x: x.get("created_at") or ""):
        prop = await db.properties.find_one(
            {"id": b.get("property_id")}, {"_id": 0, "title": 1, "area": 1}
        )
        print(
            f"  {b.get('created_at')}  status={b.get('status')}\n"
            f"      property : {(prop or {}).get('title') or '(untitled)'}"
            f" — {(prop or {}).get('area') or '?'}\n"
            f"      dates    : {b.get('start_date')} -> {b.get('end_date')}\n"
            f"      guests   : {b.get('number_of_guests')}"
            f"   renter_id: {b.get('renter_id')}"
        )

    # --- Orphan summary --------------------------------------------------
    print("\n" + "=" * 72)
    print(f"ORPHANS TO DELETE ({len(orphans)}) — grouped by month created:")
    print("=" * 72)
    by_month: dict[str, int] = {}
    for b in orphans:
        key = (b.get("created_at") or "(unknown)")[:7]
        by_month[key] = by_month.get(key, 0) + 1
    for month, n in sorted(by_month.items()):
        print(f"  {month:<12} {n}")

    if not orphans:
        print("\nNothing to delete.")
        client.close()
        return

    if not apply:
        print(
            "\nDRY RUN — nothing was changed.\n"
            "Re-run with --apply to delete the orphans above.\n"
            f"Your dashboard's booking count would go from {total} to {len(keepers)}."
        )
        client.close()
        return

    # --- APPLY: back up, then delete -------------------------------------
    stamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    backup_path = ROOT / "scripts" / f"deleted_orphan_bookings_{stamp}.json"
    backup_path.write_text(json.dumps(orphans, indent=2, default=str), encoding="utf-8")
    print(f"\nbackup written: {backup_path}")
    print(f"  ({len(orphans)} documents — restorable if this was a mistake)")

    orphan_ids = [b["id"] for b in orphans if b.get("id")]
    res = await db.bookings.delete_many({"id": {"$in": orphan_ids}})
    print(f"\ndeleted: {res.deleted_count}")
    remaining = await db.bookings.count_documents({})
    print(f"bookings remaining: {remaining}")
    print("\nThe admin dashboard will show the new count immediately.")
    client.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--apply",
        action="store_true",
        help="actually delete (default is a dry run that changes nothing)",
    )
    args = ap.parse_args()
    asyncio.run(main(args.apply))
