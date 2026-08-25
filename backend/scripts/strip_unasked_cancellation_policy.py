"""One-shot cleanup: remove the cancellation policy from listings whose
owners were never asked for one.

``PropertyCreate`` defaults ``cancellation_policy`` to ``'flexible'`` for
every listing, but the forms only show that field for vacation and
short-term rentals (``AddPropertyModal.jsx`` and ``BulkUploadModal.jsx``
both gate it). So every long-term and sublease listing in the database
carries "Flexible — full refund 7+ days before check-in" as a value nobody
chose, attributed to an owner who was never given the option.

That was harmless while nothing rendered it. The booking sidebar now shows
the policy under the reserve button, so it stopped being harmless: the page
would have printed a refund promise in the owner's name. The sidebar and
``routes/properties/crud.py`` were both fixed; this clears what is already
stored.

Safe to run repeatedly — listings with no policy field are not matched.

Dry run (default, writes nothing):
    python -m scripts.strip_unasked_cancellation_policy

Apply:
    python -m scripts.strip_unasked_cancellation_policy --apply

Run it from ``backend/`` with that directory's ``.env`` in place. Check
which database ``MONGO_URL`` points at before using ``--apply``.
"""
from __future__ import annotations

import asyncio
import os
import sys

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# The only rental types whose owner is shown the cancellation field.
# Mirrors ``_CANCELLATION_ASKED_TYPES`` in routes/properties/shared.py.
ASKED_TYPES = ("vacation", "short-term")

FIELDS = ("cancellation_policy", "custom_cancellation_policy")


async def main() -> None:
    apply = "--apply" in sys.argv
    load_dotenv()
    mongo_url = os.environ["MONGO_URL"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ["DB_NAME"]]

    # Never print the URL — it carries credentials on Atlas.
    host = "local" if mongo_url.startswith(("mongodb://localhost", "mongodb://127.0.0.1")) else "REMOTE"
    print(f"database: {os.environ['DB_NAME']} ({host})")
    print(f"mode: {'APPLY' if apply else 'dry run — nothing will be written'}\n")

    query = {
        "rental_type": {"$nin": list(ASKED_TYPES)},
        "$or": [{field: {"$exists": True}} for field in FIELDS],
    }

    total = await db.properties.count_documents(query)
    print(f"{total} listing(s) hold a policy their owner was never asked for")

    if not total:
        client.close()
        return

    # A short sample, so whoever runs the dry run can see what is about to
    # change rather than trusting a count.
    async for p in db.properties.find(
        query, {"_id": 0, "id": 1, "rental_type": 1, "cancellation_policy": 1},
    ).limit(5):
        print(f"  {p.get('rental_type'):<12} {p.get('id')}  "
              f"policy={p.get('cancellation_policy')!r}")
    if total > 5:
        print(f"  … and {total - 5} more")

    if not apply:
        print("\nDry run. Re-run with --apply to write.")
        client.close()
        return

    result = await db.properties.update_many(
        query, {"$unset": {field: "" for field in FIELDS}},
    )
    print(f"\ncleared on {result.modified_count} listing(s)")

    remaining = await db.properties.count_documents(query)
    print(f"remaining: {remaining}")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
