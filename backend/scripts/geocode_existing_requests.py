"""Backfill lat/lng on requests posted before the map existed.

New posts geocode themselves in the background. Everything already on the
board predates that and would be invisible on the map view, which is worse
than having no map — a map that silently shows half the board reads as
"there is no demand here".

    python -m scripts.geocode_existing_requests --dry-run
    python -m scripts.geocode_existing_requests

Nominatim allows one call per second and asks that we cache. `geocode_area`
enforces both — the rate gate and `db.geocode_cache` are inside it — so
this script deliberately does NOT parallelise. A board of a few hundred
requests takes a few minutes; that is the correct speed for someone else's
free service.

Documents already carrying `geocode_miss: True` are skipped: they have been
tried and their area does not resolve. Retrying them every run would spend
the rate limit on the queries known to fail. Pass --retry-misses if an area
has since been corrected.
"""
import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routes.deps import db  # noqa: E402
from utils.geocode import geocode_area_into  # noqa: E402

MONGO_URL = os.environ.get("MONGO_URL", "")


async def main(dry_run: bool, retry_misses: bool) -> None:
    if not MONGO_URL:
        sys.exit("MONGO_URL is not set — refusing to guess which database this is.")

    # Both `lat: null` and no `lat` field at all. Absent and null are
    # different queries in Mongo, most of these documents predate the field
    # entirely, and matching only on null is the exact trap that makes a
    # backfill report success having touched almost nothing.
    query = {"$and": [
        {"$or": [{"lat": None}, {"lat": {"$exists": False}}]},
        {} if retry_misses else {"geocode_miss": {"$ne": True}},
    ]}

    docs = await db.requests.find(query, {"_id": 1, "area": 1, "title": 1}).to_list(2000)
    todo = [d for d in docs if (d.get("area") or "").strip()]
    skipped = len(docs) - len(todo)

    print(f"{len(docs)} request(s) without coordinates; {len(todo)} have an area to work with")
    if skipped:
        print(f"  {skipped} skipped — no area text at all, nothing to geocode")
    if dry_run:
        for d in todo[:20]:
            print(f"  would geocode: {d.get('area','')[:38]:<38} {d.get('title','')[:40]}")
        if len(todo) > 20:
            print(f"  … and {len(todo) - 20} more")
        print("\ndry run — nothing written")
        return

    print(f"working at ~1/sec to respect Nominatim's limit — about {len(todo)}s\n")
    done = 0
    for d in todo:
        await geocode_area_into("requests", d["_id"], d["area"])
        done += 1
        fresh = await db.requests.find_one({"_id": d["_id"]}, {"lat": 1, "lng": 1})
        got = fresh and fresh.get("lat") is not None
        print(f"  [{done}/{len(todo)}] {'ok ' if got else 'miss'} {d.get('area','')[:44]}")

    total = await db.requests.count_documents({})
    mapped = await db.requests.count_documents({"lat": {"$ne": None, "$exists": True}})
    print(f"\n{mapped}/{total} requests now have coordinates")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="list what would be geocoded, write nothing")
    ap.add_argument("--retry-misses", action="store_true", help="also retry areas that previously failed to resolve")
    a = ap.parse_args()
    asyncio.run(main(a.dry_run, a.retry_misses))
