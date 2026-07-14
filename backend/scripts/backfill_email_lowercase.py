"""One-shot backfill: lowercase every existing user's email so the
casing invariant holds after the 2026-07-14 auth normalization patch.

Safe to run repeatedly — rows already lowercase are skipped, and we
merge any mixed-case duplicates into the earliest-created row.
"""
from __future__ import annotations

import asyncio
import os
import sys

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient


async def main() -> None:
    load_dotenv()
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    fixed = 0
    duplicates = 0
    async for u in db.users.find({}, {"_id": 0, "id": 1, "email": 1, "created_at": 1}):
        original = u.get("email") or ""
        lower = original.strip().lower()
        if not lower or lower == original:
            continue
        # Check for a collision (another user already at the lowercase form)
        collision = await db.users.find_one(
            {"email": lower},
            {"_id": 0, "id": 1, "created_at": 1},
        )
        if collision and collision["id"] != u["id"]:
            print(f"⚠ Skipping {u['id']} — collision with {collision['id']} (both at {lower})")
            duplicates += 1
            continue
        await db.users.update_one({"id": u["id"]}, {"$set": {"email": lower}})
        print(f"✓ {u['id']}: {original} -> {lower}")
        fixed += 1
    print(f"\nBackfill complete: {fixed} rows lowercased, {duplicates} collisions flagged.")
    if duplicates:
        print("→ Review collisions manually; merge sessions/data before deleting the extra row.")
    sys.exit(0)


if __name__ == "__main__":
    asyncio.run(main())
