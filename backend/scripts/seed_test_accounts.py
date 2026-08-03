"""Create the fixed accounts the HTTP test suite logs in as.

Why this exists
---------------
About a hundred tests across the suite authenticate as one of three fixed
accounts and then exercise real endpoints. Those accounts were never created
by anything in this repo — they existed in whatever environment the tests were
originally written against. Against a fresh local database every one of them
errors at fixture setup with::

    AssertionError: login failed: 401 {"detail":"Invalid credentials"}

which looks like a hundred broken features and is actually one missing seed.

Run this once after starting a local MongoDB and the whole HTTP half of the
suite becomes runnable:

    python scripts/seed_test_accounts.py

Safety
------
Refuses to touch anything that isn't a local database. These are accounts with
known, published passwords — creating them anywhere reachable would be handing
out three logins, one of them an admin. The check is deliberately strict: the
MONGO_URL host must be localhost, and `mongodb+srv://` (Atlas) is rejected
outright. Pass --force only if you genuinely know better; there is no reason
to on a normal machine.

The admin password differs between test files — 17 use ``Admin1234!`` and 4
use ``Admin123!``. Both are seeded (the second as a separate account) rather
than silently picking a winner, so neither group fails. Worth reconciling in
the tests one day; that's a test change, not a seeding change.
"""
from __future__ import annotations

import argparse
import os
import pathlib
import sys
import uuid
from datetime import UTC, datetime
from urllib.parse import urlparse

import bcrypt
from dotenv import dotenv_values
from pymongo import MongoClient

_env = dotenv_values(pathlib.Path(__file__).resolve().parent.parent / ".env")
MONGO_URL = os.environ.get("MONGO_URL") or _env.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME") or _env.get("DB_NAME")

if not MONGO_URL or not DB_NAME:
    raise SystemExit("MONGO_URL and DB_NAME must be set (backend/.env or environment).")

LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "0.0.0.0"}

ACCOUNTS = [
    {"email": "owner@test.com",    "password": "Test1234!",  "name": "Test Owner",  "role": "owner"},
    {"email": "renter@test.com",   "password": "Test1234!",  "name": "Test Renter", "role": "renter"},
    {"email": "admin@rental.com",  "password": "Admin1234!", "name": "Test Admin",  "role": "admin"},
    # Four test files still use the older admin password. Seeded under a
    # distinct address so both spellings work without one clobbering the other.
    {"email": "admin@test.com",    "password": "Admin123!",  "name": "Test Admin 2", "role": "admin"},
]


def _assert_local(force: bool) -> None:
    if force:
        print("!! --force given: skipping the local-database check.\n")
        return
    if MONGO_URL.startswith("mongodb+srv://"):
        raise SystemExit(
            "Refusing to run: MONGO_URL uses mongodb+srv://, which means Atlas.\n"
            "These are accounts with published passwords, including an admin. "
            "They belong on a local database only."
        )
    host = (urlparse(MONGO_URL).hostname or "").lower()
    if host not in LOCAL_HOSTS:
        raise SystemExit(
            f"Refusing to run: MONGO_URL points at {host!r}, not a local host.\n"
            "These are accounts with published passwords, including an admin.\n"
            "If this really is a throwaway local database, re-run with --force."
        )


def main(force: bool) -> None:
    _assert_local(force)
    db = MongoClient(MONGO_URL, serverSelectionTimeoutMS=10000)[DB_NAME]
    print(f"database: {DB_NAME}\n")

    created = updated = 0
    for acct in ACCOUNTS:
        hashed = bcrypt.hashpw(acct["password"].encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        existing = db.users.find_one({"email": acct["email"]})
        doc = {
            "email": acct["email"],
            "password": hashed,
            "name": acct["name"],
            "role": acct["role"],
            # Tests log in immediately, so don't leave them behind a
            # verification wall.
            "email_verified": True,
            "is_verified": True,
        }
        if existing:
            # Reset the password too — a half-seeded account with the wrong
            # password fails exactly like a missing one.
            db.users.update_one({"email": acct["email"]}, {"$set": doc})
            updated += 1
            print(f"  updated  {acct['email']:<22} ({acct['role']})")
        else:
            doc.update({"id": str(uuid.uuid4()), "created_at": datetime.now(UTC).isoformat()})
            db.users.insert_one(doc)
            created += 1
            print(f"  created  {acct['email']:<22} ({acct['role']})")

    print(f"\ncreated: {created}   updated: {updated}")
    print("The HTTP tests can now authenticate. Run them with:")
    print('  REACT_APP_BACKEND_URL="http://127.0.0.1:8001" python -m pytest tests/ -q')


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--force", action="store_true",
                    help="skip the local-database guard (you should not need this)")
    main(ap.parse_args().force)
