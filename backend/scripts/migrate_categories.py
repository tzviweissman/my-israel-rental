"""One-shot migration to remap legacy marketplace category slugs to the
2026-07-15 restructured taxonomy.

Runs safely multiple times — every write is idempotent (uses the
migration map as a lookup, so a slug already at its new value is left
alone). Prints a per-collection summary at the end.

Usage:
    python -m scripts.migrate_categories        # dry run
    python -m scripts.migrate_categories --apply
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

# Allow `python -m scripts.migrate_categories` from anywhere.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from routes.marketplace.shared import CATEGORY_MIGRATION  # noqa: E402


COLLECTIONS = [
    # (collection_name, mongo_field_path). Nested paths are only
    # supported one level deep — everything on this list is either a
    # scalar or a single-level nested array.
    ("marketplace_gigs",           "category"),
    ("marketplace_jobs",           "category"),
    ("marketplace_job_searches",   "category"),
]

PROVIDER_TAG_FIELD = "categories"  # marketplace_providers stores an array


async def migrate(db, apply: bool) -> dict[str, int]:
    stats: dict[str, int] = {}

    # Scalar-field collections
    for coll, field in COLLECTIONS:
        touched = 0
        for legacy, modern in CATEGORY_MIGRATION.items():
            cursor = db[coll].find({field: legacy}, {"_id": 1})
            ids = [d["_id"] async for d in cursor]
            if not ids:
                continue
            touched += len(ids)
            if apply:
                await db[coll].update_many(
                    {"_id": {"$in": ids}}, {"$set": {field: modern}},
                )
        stats[coll] = touched

    # marketplace_providers.categories is an array — migrate element-wise
    prov_touched = 0
    async for prov in db.marketplace_providers.find(
        {PROVIDER_TAG_FIELD: {"$exists": True, "$ne": []}},
        {"_id": 1, PROVIDER_TAG_FIELD: 1},
    ):
        cats = prov.get(PROVIDER_TAG_FIELD) or []
        new_cats = list({CATEGORY_MIGRATION.get(c, c) for c in cats})
        if sorted(new_cats) != sorted(cats):
            prov_touched += 1
            if apply:
                await db.marketplace_providers.update_one(
                    {"_id": prov["_id"]},
                    {"$set": {PROVIDER_TAG_FIELD: new_cats}},
                )
    stats["marketplace_providers.categories[]"] = prov_touched

    # job_notification_preferences.snoozed_categories[].category
    snooze_touched = 0
    async for pref in db.job_notification_preferences.find(
        {"snoozed_categories.0": {"$exists": True}},
        {"_id": 1, "snoozed_categories": 1},
    ):
        rows = pref.get("snoozed_categories") or []
        new_rows = [
            {**r, "category": CATEGORY_MIGRATION.get(r.get("category"), r.get("category"))}
            for r in rows
        ]
        if any(a != b for a, b in zip(rows, new_rows, strict=True)):
            snooze_touched += 1
            if apply:
                await db.job_notification_preferences.update_one(
                    {"_id": pref["_id"]},
                    {"$set": {"snoozed_categories": new_rows}},
                )
    stats["job_notification_preferences.snoozed_categories[].category"] = snooze_touched

    return stats


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true",
                        help="Actually write changes. Without this flag the "
                             "script only prints what it would change.")
    args = parser.parse_args()

    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    mode = "APPLY" if args.apply else "DRY RUN"
    print(f"=== Category migration — {mode} ===")
    print(f"Mapping: {len(CATEGORY_MIGRATION)} legacy slugs → new taxonomy")
    for old, new in CATEGORY_MIGRATION.items():
        print(f"  {old:22s} → {new}")
    print()

    stats = await migrate(db, apply=args.apply)
    print("=== Result ===")
    for k, v in stats.items():
        verb = "would touch" if not args.apply else "touched"
        print(f"  {k:60s} {verb} {v} rows")
    if not args.apply:
        print("\n(dry run — re-run with --apply to persist)")


if __name__ == "__main__":
    asyncio.run(main())
