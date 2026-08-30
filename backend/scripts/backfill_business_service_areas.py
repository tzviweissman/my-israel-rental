"""Give existing businesses a service area that search can actually match.

TWO PROBLEMS, both silent.

1. `businesses.areas` was never validated, so it holds whatever a client
   sent — display labels ("Tel Aviv"), slugs ("tel-aviv"), and free text
   from before there was a picker. Search compares against SLUGS, so
   every non-slug entry is a service area the owner can see on their own
   page and no customer can ever match.

2. Most businesses have no `areas` at all, because until now nothing in
   the UI ever set it. Left alone they would keep matching only through
   their gigs' own `area` field — which is the old behaviour, so nothing
   breaks, but the new city filter would look broken to them.

For (2) this infers areas FROM THE BUSINESS'S OWN GIGS: whatever cities
their published listings already name. That is the same information the
old search used, so nothing a customer could find before becomes
unfindable — it just moves somewhere the new filter reads too.

WHAT IT WILL NOT DO: set `serves_nationwide`. Nothing in the existing
data distinguishes "ships countrywide" from "has listings in four
cities", and guessing would put a claim on someone's public page that
they never made. That one stays False until an owner ticks it.

Idempotent — normalising an already-normalised list is a no-op.

Usage:
    python -m scripts.backfill_business_service_areas          # dry run
    python -m scripts.backfill_business_service_areas --apply
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

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from routes.marketplace.shared import (  # noqa: E402
    LOCATIONS,
    normalize_service_areas,
)


def _areas_from_gig_text(areas: list[str]) -> list[str]:
    """Match free-text gig areas ("Tel Aviv, Florentin") to catalogue slugs.

    Substring, case-insensitive, same rule the old location filter used —
    deliberately, so this reproduces exactly what search already matched
    rather than inventing a second interpretation of the same data.
    """
    found: list[str] = []
    for raw in areas:
        text = (raw or "").lower()
        for loc in LOCATIONS:
            if loc["label"].lower() in text and loc["slug"] not in found:
                found.append(loc["slug"])
    return found


async def main(apply: bool) -> int:
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    host = mongo_url.split("@")[-1].split("/")[0]
    print(f"database: {db_name} on {host}")
    print(f"mode: {'APPLY' if apply else 'dry run'}\n")

    db = AsyncIOMotorClient(mongo_url)[db_name]

    normalised = inferred = unchanged = stuck = 0

    async for biz in db.businesses.find({}, {"_id": 1, "name": 1, "areas": 1}):
        current = biz.get("areas") or []
        target = normalize_service_areas(current)
        source = "normalised"

        if not target:
            # Nothing usable stored — infer from this business's listings.
            gig_areas = [
                (g.get("area") or "")
                async for g in db.marketplace_gigs.find(
                    {"business_id": biz["_id"], "status": "published"},
                    {"area": 1},
                )
            ]
            target = _areas_from_gig_text(gig_areas)
            source = "inferred from listings"

        if target == current:
            unchanged += 1
            continue
        if not target:
            # No stored areas and no listings naming a catalogue city.
            # Left alone: an empty list is honest, and the owner can set
            # it themselves now that a picker exists.
            stuck += 1
            continue

        name = (biz.get("name") or "")[:34]
        print(f"  {name:36} {current!r} -> {target!r}  ({source})")
        if source == "inferred from listings":
            inferred += 1
        else:
            normalised += 1
        if apply:
            await db.businesses.update_one(
                {"_id": biz["_id"]}, {"$set": {"areas": target}}
            )

    total = normalised + inferred + unchanged + stuck
    print(
        f"\n{total} businesses: {normalised} normalised, {inferred} inferred, "
        f"{unchanged} already correct, {stuck} left empty (no listings in a catalogue city)"
    )
    if not apply:
        print("dry run — nothing was written. Re-run with --apply")
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    raise SystemExit(asyncio.run(main(ap.parse_args().apply)))
