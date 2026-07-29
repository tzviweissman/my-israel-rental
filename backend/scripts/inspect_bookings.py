"""READ-ONLY audit of the `bookings` collection.

Answers "why does the admin dashboard say N total bookings?" by breaking
the collection down by status, age, and data quality. Performs **no
writes** — safe to run against production.

Usage (from the `backend/` directory):

    python scripts/inspect_bookings.py

Reads MONGO_URL / DB_NAME from backend/.env, or from the environment:

    MONGO_URL="mongodb+srv://..." DB_NAME=myisraelrental \
        python scripts/inspect_bookings.py

Nothing here prints a connection string or any credential.
"""
from __future__ import annotations

import asyncio
import os
import sys
from collections import Counter
from pathlib import Path

from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path(__file__).resolve().parent.parent
_env = dotenv_values(ROOT / ".env")

MONGO_URL = os.environ.get("MONGO_URL") or _env.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME") or _env.get("DB_NAME")

if not MONGO_URL or not DB_NAME:
    sys.exit(
        "MONGO_URL and DB_NAME must be set (backend/.env or environment).\n"
        "Point them at the database you want to audit."
    )


def _bucket_date(iso: str | None) -> str:
    """`2026-07-14T…` -> `2026-07`. Groups bookings by creation month."""
    if not iso or not isinstance(iso, str) or len(iso) < 7:
        return "(no created_at)"
    return iso[:7]


async def main() -> None:
    client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=15000)
    db = client[DB_NAME]

    # Show which DB we're reading, without leaking the connection string.
    print(f"database: {DB_NAME}\n")

    total = await db.bookings.count_documents({})
    print(f"TOTAL bookings documents: {total}")
    if total == 0:
        print("\nCollection is empty — the dashboard should already read 0.")
        client.close()
        return

    rows = await db.bookings.find(
        {},
        {
            "_id": 0, "id": 1, "property_id": 1, "status": 1, "created_at": 1,
            "start_date": 1, "end_date": 1, "guest_email": 1, "guest_name": 1,
            "renter_id": 1,
        },
    ).to_list(20000)

    # --- Status breakdown -------------------------------------------------
    print("\nBY STATUS")
    for status, n in Counter(r.get("status") or "(none)" for r in rows).most_common():
        print(f"  {status:<24} {n}")

    # --- Age breakdown ----------------------------------------------------
    print("\nBY MONTH CREATED")
    for month, n in sorted(Counter(_bucket_date(r.get("created_at")) for r in rows).items()):
        print(f"  {month:<24} {n}")

    # --- Orphans: bookings pointing at properties that no longer exist ----
    prop_ids = {r.get("property_id") for r in rows if r.get("property_id")}
    existing = set()
    if prop_ids:
        async for p in db.properties.find(
            {"id": {"$in": list(prop_ids)}}, {"_id": 0, "id": 1}
        ):
            existing.add(p["id"])
    orphaned = [r for r in rows if r.get("property_id") not in existing]
    missing_prop_field = [r for r in rows if not r.get("property_id")]

    print("\nDATA QUALITY")
    print(f"  reference a property that no longer exists   {len(orphaned)}")
    print(f"  have no property_id at all                   {len(missing_prop_field)}")
    print(f"  have no guest_email                          {sum(1 for r in rows if not r.get('guest_email'))}")
    print(f"  have no renter_id                            {sum(1 for r in rows if not r.get('renter_id'))}")

    # --- Likely test data -------------------------------------------------
    # Heuristic only: obviously-fake emails. Reported for review, never acted on.
    test_markers = ("test", "example.com", "@test", "demo", "seed", "foo", "bar", "mailinator")
    suspected = [
        r for r in rows
        if any(m in (r.get("guest_email") or "").lower() for m in test_markers)
        or any(m in (r.get("guest_name") or "").lower() for m in test_markers)
    ]
    print(f"  look like test/demo data (email or name)     {len(suspected)}")

    # --- Distinct guests --------------------------------------------------
    emails = [(r.get("guest_email") or "").lower() for r in rows if r.get("guest_email")]
    print(f"\n  distinct guest emails                        {len(set(emails))}")
    print("\n  most frequent guest emails:")
    for email, n in Counter(emails).most_common(10):
        # Mask the local part — enough to spot a pattern, not a contact dump.
        local, _, domain = email.partition("@")
        masked = f"{local[:2]}***@{domain}" if domain else "***"
        print(f"    {masked:<40} {n}")

    # --- Sample -----------------------------------------------------------
    print("\nOLDEST 5 (by created_at):")
    for r in sorted(rows, key=lambda x: x.get("created_at") or "")[:5]:
        print(f"  {r.get('created_at')}  status={r.get('status')}  prop={r.get('property_id')}")
    print("\nNEWEST 5 (by created_at):")
    for r in sorted(rows, key=lambda x: x.get("created_at") or "", reverse=True)[:5]:
        print(f"  {r.get('created_at')}  status={r.get('status')}  prop={r.get('property_id')}")

    print("\nNo changes were made — this script only reads.")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
