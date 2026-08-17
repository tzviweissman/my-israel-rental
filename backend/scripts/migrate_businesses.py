"""M3 — give every existing provider exactly one business.

Today a provider's business is literally their own name: the public page
falls back to `users.name` (providers.py:122). So the migration names each
business exactly what the site already displays, and **nothing changes
visually for anyone** until they rename it or add a second one.

DRY RUN BY DEFAULT — pass `--apply` to write.

    python -m scripts.migrate_businesses            # counts only
    python -m scripts.migrate_businesses --apply    # dev DB first!

Idempotent: a provider who already has an active business is skipped, and
gigs that already carry a `business_id` are left alone. Safe to re-run,
which matters because the dev run and the eventual Atlas run are the same
script and nobody should have to reason about half-applied state.

Per CLAUDE.md: dev database first, counts reported, approval before Atlas.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import dotenv_values  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from utils.businesses import new_business_doc, slugify  # noqa: E402

# Environment first, backend/.env second — so `railway run` (which injects
# the real variables) targets production and a bare local run does not.
_env = dotenv_values(ROOT / ".env")


def _cfg(key: str, default: str = "") -> str:
    return os.environ.get(key) or _env.get(key) or default


def _describe_target(url: str) -> tuple[str, bool]:
    """(label, is_production). Never prints the URL — it holds the password."""
    host = urlparse(url).hostname or "?"
    if host in ("localhost", "127.0.0.1"):
        return "LOCAL dev database", False
    if "mongodb.net" in host:
        return "PRODUCTION Atlas cluster", True
    return f"database on {host}", True


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument(
        "--i-know-this-is-production",
        dest="prod_ok",
        action="store_true",
        help="required to write to Atlas; dev runs do not need it",
    )
    args = ap.parse_args()

    url = _cfg("MONGO_URL")
    if not url:
        print("MONGO_URL is not set.")
        return 2
    db_name = _cfg("DB_NAME", "israel_rental")
    db = AsyncIOMotorClient(url)[db_name]

    label, is_prod = _describe_target(url)
    print(f"Target : {label}  (db: {db_name})")
    if args.apply and is_prod and not args.prod_ok:
        print("\nRefusing to write to production without --i-know-this-is-production.")
        return 3

    providers = [p async for p in db.marketplace_providers.find({})]
    existing = {b["owner_user_id"] async for b in db.businesses.find({}, {"owner_user_id": 1})}
    gigs_total = await db.marketplace_gigs.count_documents({})
    gigs_unassigned = await db.marketplace_gigs.count_documents(
        {"$or": [{"business_id": {"$exists": False}}, {"business_id": None}]},
    )

    print(f"\nProviders                  : {len(providers)}")
    print(f"  already have a business  : {len(existing & {p['user_id'] for p in providers})}")
    print(f"  need one created         : {len([p for p in providers if p['user_id'] not in existing])}")
    print(f"Businesses already present : {await db.businesses.count_documents({})}")
    print(f"Gigs                       : {gigs_total}")
    print(f"  without a business_id    : {gigs_unassigned}")

    created = 0
    linked = 0
    used_slugs = {b["slug"] async for b in db.businesses.find({}, {"slug": 1}) if b.get("slug")}

    for prov in providers:
        user_id = prov["user_id"]
        if user_id in existing:
            continue

        user = await db.users.find_one({"id": user_id}) or await db.users.find_one({"_id": user_id})
        name = (user or {}).get("name") or "My business"

        # Uniqueness is resolved in-process rather than by querying per
        # candidate, because within one run the earlier inserts may not be
        # visible yet under --apply=False and two providers can easily
        # share a name.
        base = slugify(name)
        slug, n = base, 2
        while slug in used_slugs:
            slug, n = f"{base}-{n}", n + 1
        used_slugs.add(slug)

        doc = new_business_doc(
            user_id,
            name,
            slug=slug,
            description=prov.get("bio") or "",
        )
        n_gigs = await db.marketplace_gigs.count_documents({"provider_user_id": user_id})
        # ASCII only in output: the Windows console is cp1252 and a stray
        # arrow or em-dash aborts the run with UnicodeEncodeError.
        print(f"  + {name!r} (slug={slug}) <- {n_gigs} gig(s)")

        if args.apply:
            await db.businesses.insert_one(doc)
            res = await db.marketplace_gigs.update_many(
                {
                    "provider_user_id": user_id,
                    "$or": [{"business_id": {"$exists": False}}, {"business_id": None}],
                },
                {"$set": {"business_id": doc["_id"]}},
            )
            linked += res.modified_count
        else:
            linked += n_gigs
        created += 1

    verb = "Created" if args.apply else "Would create"
    print(f"\n{verb} {created} business(es); {'linked' if args.apply else 'would link'} {linked} gig(s).")

    if args.apply:
        # Slug is the lookup key for the future /business/{slug} page, and
        # a duplicate would make one of two businesses unreachable.
        await db.businesses.create_index("slug", unique=True)
        await db.businesses.create_index("owner_user_id")
        await db.marketplace_gigs.create_index("business_id")
        print("Indexes ensured: businesses.slug (unique), businesses.owner_user_id, gigs.business_id")
        # A non-zero leftover is not a failure of this script: the loop
        # walks PROVIDERS, so a gig whose provider record (or whole user)
        # has been deleted has no owner to make a business for. Name them
        # rather than leaving a bare count for the next reader to worry
        # about — on dev these are fixtures from removed test accounts.
        leftovers = [
            g
            async for g in db.marketplace_gigs.find(
                {"$or": [{"business_id": {"$exists": False}}, {"business_id": None}]},
                {"title": 1, "provider_user_id": 1},
            )
        ]
        print(f"Gigs still without a business_id: {len(leftovers)}")
        for g in leftovers:
            has_prov = await db.marketplace_providers.find_one({"user_id": g.get("provider_user_id")})
            why = "provider record exists - INVESTIGATE" if has_prov else "owner no longer exists"
            print(f"  ! {g.get('title')!r} ({why})")
    else:
        print("\nDRY RUN - nothing was written. Re-run with --apply.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
