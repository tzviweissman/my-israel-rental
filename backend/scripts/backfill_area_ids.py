"""Give every existing request and gig a canonical area_id (spec 2.2).

Costs nothing. This is pure string resolution against the local catalogue
— no API calls, no Anthropic spend — which is why it is separate from the
1.6 translation backfill and safe to run whenever.

    python -m scripts.backfill_area_ids --dry-run
    python -m scripts.backfill_area_ids

Without it, area search silently splits in two: new posts match on the id
and everything posted before today falls back to a text match, so a Hebrew
search finds the new English posts and misses the old ones. The fallback
in the query keeps them findable; this makes them findable the fast way.
"""
import argparse
import asyncio
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routes.deps import db  # noqa: E402
from utils.area_filter import resolve_area_id  # noqa: E402

MONGO_URL = os.environ.get("MONGO_URL", "")


async def run(collection_name: str, dry_run: bool) -> None:
    coll = db[collection_name]
    docs = await coll.find(
        {"$or": [{"area_id": None}, {"area_id": {"$exists": False}}]},
        {"_id": 1, "area": 1},
    ).to_list(5000)

    resolved, unresolved = 0, Counter()
    for d in docs:
        area_id = resolve_area_id(d.get("area"))
        if not area_id:
            unresolved[(d.get("area") or "(blank)")[:40]] += 1
            continue
        resolved += 1
        if not dry_run:
            await coll.update_one({"_id": d["_id"]}, {"$set": {"area_id": area_id}})

    print(f"{collection_name}: {len(docs)} without an id — {resolved} resolved")
    if unresolved:
        # Named rather than counted: an area the catalogue misses is a gap
        # worth seeing, and each one is a post that only text-matches.
        print(f"  {sum(unresolved.values())} could not be resolved:")
        for area, n in unresolved.most_common(10):
            print(f"    {n:>3}x {area}")


async def main(dry_run: bool) -> None:
    if not MONGO_URL:
        sys.exit("MONGO_URL is not set — refusing to guess which database this is.")
    print(f"{'DRY RUN — nothing written' if dry_run else 'writing'}\n")
    for name in ("requests", "marketplace_gigs"):
        await run(name, dry_run)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    asyncio.run(main(ap.parse_args().dry_run))
