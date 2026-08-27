"""Strip payment links whose provider is no longer on the allowlist.

WHY THIS EXISTS

`_public` re-checks every stored payment link against the allowlist before
serving it, so a withdrawn provider stops appearing on the next page load
without waiting on the owner. That is the part that matters, and it is
already done.

This is the tidy-up behind it. The rows themselves are still in the
database, and a row nothing renders is a row that will surprise somebody
later: an export, an admin screen, a future feature that reads
`payment_links` directly and has no reason to suspect it holds entries the
site refuses to show. Zelle was on the allowlist for part of one day on
27 Aug 2026, so in practice this finds very little — but the same script
is what runs the day a provider domain has to be pulled in earnest.

WHAT IT WILL NOT DO

It will not touch a remote database without being told to, twice. The
standing rule on this project is local mongod only, and a maintenance
script that quietly accepts whatever MONGO_URL happens to be exported is
how that rule gets broken by accident rather than by decision. Pointed at
anything that is not localhost it stops and says so; `--allow-remote` is
the second, deliberate word.

It is also a DRY RUN by default. Nothing is written without `--apply`.

USAGE

    # See what would change (writes nothing):
    backend/.venv/Scripts/python.exe backend/scripts/clean_withdrawn_payment_links.py

    # Actually write:
    backend/.venv/Scripts/python.exe backend/scripts/clean_withdrawn_payment_links.py --apply

    # Against a non-local database, once you have decided that is what you want:
    ... --apply --allow-remote
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path
from urllib.parse import urlsplit

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(BACKEND / ".env")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from utils.payment_links import allowed_payment_links  # noqa: E402

LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}


def _describe(url: str) -> tuple[str, bool]:
    """The host of `url`, and whether it is local. Never returns credentials."""
    host = (urlsplit(url).hostname or "").lower()
    return host or "(unknown)", host in LOCAL_HOSTS


async def main(apply_changes: bool, allow_remote: bool) -> int:
    mongo_url = os.environ.get("MONGO_URL") or ""
    if not mongo_url:
        print("MONGO_URL is not set. Nothing to connect to.")
        return 2

    host, is_local = _describe(mongo_url)
    db_name = os.environ.get("DB_NAME", "test_database")
    print(f"database: {db_name} on {host}{'' if is_local else '  (REMOTE)'}")

    if not is_local and not allow_remote:
        print(
            "\nRefusing to run against a non-local database.\n"
            "This project's rule is local mongod only. If you have decided this\n"
            "is the right target, re-run with --allow-remote as well as --apply.",
        )
        return 3

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    scanned = 0
    affected: list[tuple[str, str, list[str], list[str]]] = []

    cursor = db.businesses.find(
        {"payment_links": {"$exists": True, "$ne": []}},
        {"name": 1, "slug": 1, "payment_links": 1},
    )
    async for biz in cursor:
        scanned += 1
        stored = biz.get("payment_links") or []
        kept = allowed_payment_links(stored)
        if len(kept) == len(stored):
            # Same count means nothing was refused. Labels are left exactly
            # as the owner wrote them — this script removes rows, it does
            # not relabel them, and rewriting a label an owner chose is not
            # cleanup.
            continue
        dropped = [
            str(p.get("url") or "")
            for p in stored
            if isinstance(p, dict) and p.get("url") not in {k["url"] for k in kept}
        ]
        affected.append((biz["_id"], biz.get("name") or "", dropped, [k["url"] for k in kept]))

    print(f"scanned : {scanned} business(es) holding payment links")
    print(f"affected: {len(affected)}")

    for _id, name, dropped, kept in affected:
        print(f"\n  {name or _id}")
        for u in dropped:
            print(f"    - drop : {u}")
        for u in kept:
            print(f"      keep : {u}")

    if not affected:
        print("\nNothing to clean.")
        return 0

    if not apply_changes:
        print("\nDRY RUN — nothing was written. Re-run with --apply to write.")
        return 0

    written = 0
    for _id, _name, _dropped, _kept in affected:
        biz = await db.businesses.find_one({"_id": _id}, {"payment_links": 1})
        # Re-read and re-filter at write time rather than reusing the list
        # built during the scan: an owner may have saved in between, and
        # writing a list computed minutes ago would silently roll that back.
        fresh = allowed_payment_links((biz or {}).get("payment_links"))
        res = await db.businesses.update_one(
            {"_id": _id}, {"$set": {"payment_links": fresh}},
        )
        written += res.modified_count

    print(f"\nwritten : {written} business(es) updated")
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true", help="write the changes (default is a dry run)")
    ap.add_argument("--allow-remote", action="store_true", help="permit a non-localhost MONGO_URL")
    args = ap.parse_args()
    raise SystemExit(asyncio.run(main(args.apply, args.allow_remote)))
