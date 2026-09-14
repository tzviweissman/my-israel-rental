"""Find, and optionally fix, business slugs that cannot be subdomains.

WHY. A slug is now also a web address: <slug>.myisraelrental.com. Two kinds
of existing slug are fine as a path and wrong as a host:

  * a reserved word (api, admin, www, mail...), which as a subdomain would
    collide with infrastructure;
  * anything that is not a DNS label (missing, uppercase, too long, a
    leading or trailing hyphen), which a browser cannot reach at all.

Each one gets a fresh slug from `unique_slug` (which now refuses reserved
words), and the old slug retires into `previous_slugs` exactly as a rename
does, so every link and QR code already out there keeps resolving.

Retired slugs that are reserved words are REPORTED, not changed: they only
ever resolve as a path, and the frontend server never treats a reserved
host as a business.

    python scripts/fix_reserved_slugs.py            # report only
    python scripts/fix_reserved_slugs.py --apply    # fix, LOCAL only

Production needs --production as well as --apply, and must only be run with
Tzvi's explicit go-ahead (CLAUDE.md: confirm before writing to Atlas).
"""
from __future__ import annotations

import argparse
import asyncio
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from utils import businesses as bz  # noqa: E402


def _is_local(url: str) -> bool:
    return bool(re.match(r"^mongodb://(localhost|127\.0\.0\.1)", url)) and "mongodb.net" not in url


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--apply", action="store_true", help="rewrite the bad slugs (default: report only)")
    ap.add_argument("--production", action="store_true", help="allow --apply against a non-local database")
    args = ap.parse_args()

    url = os.environ.get("MONGO_URL", "")
    local = _is_local(url)
    if args.apply and not local and not args.production:
        print("Refusing: MONGO_URL is not local. Pass --production too, and only with explicit approval.")
        return 2
    db = AsyncIOMotorClient(url, serverSelectionTimeoutMS=8000)[os.environ["DB_NAME"]]
    # unique_slug checks uniqueness through the module's own handle.
    bz.db = db
    print(f"database: {'local' if local else 'REMOTE'} / {os.environ['DB_NAME']}  mode: {'APPLY' if args.apply else 'report'}")

    total = await db.businesses.count_documents({})
    fixed = 0
    retired_reserved = 0
    async for doc in db.businesses.find({}, {"slug": 1, "previous_slugs": 1, "name": 1}):
        slug = doc.get("slug")
        problem = "missing" if not slug else bz.address_problem(slug)
        retired_reserved += sum(1 for s in (doc.get("previous_slugs") or []) if s in bz.RESERVED_SLUGS)
        if not problem:
            continue
        fresh = await bz.unique_slug(doc.get("name") or "business", exclude_id=doc["_id"])
        # Slugs are public URLs, so printing them is fine; names are not.
        print(f"  {doc['_id']}  {problem:8}  {slug!r} -> {fresh!r}")
        fixed += 1
        if args.apply:
            await db.businesses.update_one({"_id": doc["_id"]}, {"$set": bz.slug_change(doc, fresh)})

    print(f"businesses: {total}; slugs that cannot be subdomains: {fixed}{' (fixed)' if args.apply and fixed else ''}")
    print(f"retired slugs that are reserved words (left as they are): {retired_reserved}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
