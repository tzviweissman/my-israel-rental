"""Mirror active couriers into business connections (docs/business-network-spec.md).

A shop's courier list (`businesses.couriers[]`) is a list of PEOPLE: each
entry holds a user_id and an email. A connection is between two
BUSINESSES. So a courier can only become a connection if that person runs
a business of their own on the site, and this script says plainly how many
do and how many do not, rather than inventing a business for anyone.

Rules, per active courier entry on a shop:
  * the courier's user owns exactly one active business -> an ACCEPTED
    connection, relationship "courier", unless the pair already has one;
  * owns none -> skipped, counted as "no business" (the courier list
    keeps working for them exactly as today);
  * owns several -> skipped, counted as "ambiguous": which of their
    businesses delivers for this shop is their decision, not ours;
  * the courier IS the shop's own owner -> skipped (a business cannot
    connect to itself, and one person's two businesses do not need a
    connection to know each other).

Nothing is removed. `businesses.couriers[]` stays in place and every
courier endpoint keeps reading it, unchanged.

    python scripts/migrate_couriers_to_connections.py            # report only
    python scripts/migrate_couriers_to_connections.py --apply    # write, LOCAL only

Production needs --production as well as --apply, and must only be run with
Tzvi's explicit go-ahead (CLAUDE.md: confirm before writing to Atlas).
"""
from __future__ import annotations

import argparse
import asyncio
import os
import re
import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402


def _is_local(url: str) -> bool:
    return bool(re.match(r"^mongodb://(localhost|127\.0\.0\.1)", url)) and "mongodb.net" not in url


def _pair(x: str, y: str) -> tuple[str, str]:
    return (x, y) if x < y else (y, x)


async def run(db, *, apply: bool) -> dict[str, int]:
    counts = {"active_couriers": 0, "created": 0, "already_connected": 0,
              "no_business": 0, "ambiguous": 0, "own_business": 0, "no_account": 0}
    now = datetime.now(UTC).isoformat()
    async for shop in db.businesses.find({"couriers.status": "active"}, {"couriers": 1, "owner_user_id": 1}):
        for c in shop.get("couriers") or []:
            if c.get("status") != "active":
                continue
            counts["active_couriers"] += 1
            uid = c.get("user_id")
            if not uid:
                counts["no_account"] += 1
                continue
            if uid == shop.get("owner_user_id"):
                counts["own_business"] += 1
                continue
            theirs = [b["_id"] async for b in db.businesses.find(
                {"owner_user_id": uid, "active": {"$ne": False}}, {"_id": 1},
            )]
            if not theirs:
                counts["no_business"] += 1
                continue
            if len(theirs) > 1:
                counts["ambiguous"] += 1
                continue
            a_id, b_id = _pair(shop["_id"], theirs[0])
            if await db.business_connections.find_one({"a_id": a_id, "b_id": b_id}, {"_id": 1}):
                counts["already_connected"] += 1
                continue
            counts["created"] += 1
            if apply:
                await db.business_connections.insert_one({
                    "_id": str(uuid.uuid4()), "a_id": a_id, "b_id": b_id,
                    # The shop invited the courier, so the shop asked.
                    "requested_by": shop["_id"], "status": "accepted",
                    "note": None, "relationship": "courier",
                    "created_at": c.get("invited_at") or now,
                    "responded_at": c.get("accepted_at") or now,
                    "updated_at": now, "migrated_from": "couriers",
                })
    return counts


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--apply", action="store_true", help="write the connections (default: report only)")
    ap.add_argument("--production", action="store_true", help="allow --apply against a non-local database")
    args = ap.parse_args()

    url = os.environ.get("MONGO_URL", "")
    local = _is_local(url)
    if args.apply and not local and not args.production:
        print("Refusing: MONGO_URL is not local. Pass --production too, and only with explicit approval.")
        return 2
    db = AsyncIOMotorClient(url, serverSelectionTimeoutMS=8000)[os.environ["DB_NAME"]]
    print(f"database: {'local' if local else 'REMOTE'} / {os.environ['DB_NAME']}  mode: {'APPLY' if args.apply else 'report'}")
    counts = await run(db, apply=args.apply)
    for k, v in counts.items():
        print(f"  {k:18} {v}")
    verb = "created" if args.apply else "would be created"
    print(f"connections {verb}: {counts['created']}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
