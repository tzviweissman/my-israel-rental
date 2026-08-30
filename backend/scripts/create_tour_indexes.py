"""Indexes for the `property_tours` collection.

THIS IS THE MONGO EQUIVALENT OF THE MIGRATION THE BRIEF ASKED FOR. There
is no `CREATE TABLE` to write — a document appears the moment the first
tour is created — so the only schema decision that has to be made up front
is which lookups get an index. The document's shape is documented at the
top of `routes/tours_3d.py`, which is where it is actually enforced.

Three indexes, one per query the code actually makes:

  property_id (unique)  Every read is "the tour for this listing", and
                        the uniqueness is the real point: it is what
                        makes "one tour per listing" a rule the database
                        keeps rather than a convention the route
                        remembers. Without it a race between two upload
                        clicks leaves two tours and the listing page
                        picks one arbitrarily.

  external_id           The webhook and the poller both find a tour by
                        the vendor's id, never by ours. Unindexed, every
                        callback is a collection scan.

  status + provider     The poller's query. Compound and in that order
                        because status is the selective half — almost
                        nothing is `processing` at any moment.

Safe to run repeatedly: createIndex is idempotent when the spec matches.

Usage:
    python -m scripts.create_tour_indexes           # dry run
    python -m scripts.create_tour_indexes --apply
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from pymongo import ASCENDING  # noqa: E402
from pymongo.errors import DuplicateKeyError  # noqa: E402

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

INDEXES = [
    ("property_id_unique", [("property_id", ASCENDING)], True),
    ("external_id", [("external_id", ASCENDING)], False),
    ("status_provider", [("status", ASCENDING), ("provider", ASCENDING)], False),
]


async def main(apply: bool) -> int:
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]

    # Say which database, every time. The standing rule in CLAUDE.md is to
    # check MONGO_URL before any script touches data; printing the target
    # is how the person running it can check without opening .env. Host
    # only — a full URL carries credentials.
    host = mongo_url.split("@")[-1].split("/")[0]
    print(f"database: {db_name} on {host}")
    print(f"mode: {'APPLY' if apply else 'dry run'}\n")

    client = AsyncIOMotorClient(mongo_url)
    coll = client[db_name].property_tours

    existing = set()
    try:
        existing = set(await coll.index_information())
    except Exception as e:  # noqa: BLE001
        print(f"could not read existing indexes: {e}")

    for name, keys, unique in INDEXES:
        spec = ", ".join(f"{k}:{d}" for k, d in keys)
        if name in existing:
            print(f"  = {name:22} already present ({spec})")
            continue
        if not apply:
            print(f"  + {name:22} would create ({spec}){' UNIQUE' if unique else ''}")
            continue
        try:
            await coll.create_index(keys, name=name, unique=unique)
            print(f"  + {name:22} created ({spec}){' UNIQUE' if unique else ''}")
        except DuplicateKeyError:
            # Only possible on the unique index, and only if duplicate
            # tours already exist. Worth stopping for: silently dropping
            # one of them is not this script's decision to make.
            print(
                f"  ! {name} FAILED — two tours already share a property_id.\n"
                f"    Resolve by hand, then re-run:\n"
                f"    db.property_tours.aggregate([{{$group:{{_id:'$property_id',n:{{$sum:1}}}}}},"
                f"{{$match:{{n:{{$gt:1}}}}}}])"
            )
            return 1

    count = await coll.count_documents({})
    print(f"\n{count} tour document(s) in the collection")
    if not apply:
        print("dry run — nothing was written. Re-run with --apply")
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="actually create the indexes")
    args = ap.parse_args()
    raise SystemExit(asyncio.run(main(args.apply)))
