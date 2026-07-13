"""Standalone seeder: creates 2 quarantined rows for UI testing.

Usage:
  python /app/backend/tests/seed_quarantined_demo.py         # seed
  python /app/backend/tests/seed_quarantined_demo.py clean   # remove
"""
import os
import sys
import uuid
from datetime import datetime, timezone

from pymongo import MongoClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
TITLE_PREFIX = "[QUARANTINE-DEMO]"


def main():
    db = MongoClient(MONGO_URL)[DB_NAME]
    db.properties.delete_many({"title": {"$regex": r"^\[QUARANTINE-DEMO\]"}})
    if len(sys.argv) > 1 and sys.argv[1] == "clean":
        print("cleaned")
        return

    owner = db.users.find_one({"email": "owner@test.com"})
    owner_id = owner["id"] if owner else "test-owner"
    now = datetime.now(timezone.utc).isoformat()
    base = {
        "property_type": "apartment",
        "area": "Jerusalem - Test",
        "address": "1 Test St",
        "currency": "ILS",
        "owner_id": owner_id,
        "created_at": now,
        "status": "active",
        "rental_type": "long-term",
        "is_hidden": True,
        "pricing_review_at": now,
    }
    low = {**base, "id": str(uuid.uuid4()),
           "title": f"{TITLE_PREFIX} low-rent flat",
           "monthly_price": 300, "nightly_price": 0, "holiday_lump_price": 0,
           "pricing_review_reason": "low_monthly"}
    zero = {**base, "id": str(uuid.uuid4()),
            "title": f"{TITLE_PREFIX} no-price flat",
            "monthly_price": 0, "nightly_price": 0, "holiday_lump_price": 0,
            "pricing_review_reason": "zero_price"}
    db.properties.insert_many([low, zero])
    print(f"seeded low={low['id']} zero={zero['id']}")


if __name__ == "__main__":
    main()
