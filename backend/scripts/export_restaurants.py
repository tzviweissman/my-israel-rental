"""Write the restaurants found locally to a file for the live site's admin
page to load (Admin > Restaurants > Load restaurants file).

    python -m scripts.export_restaurants   # -> Documents/restaurants-export.json, beside the repo

The import on the other side upserts by place ID, keeps anything a person
edited there, and drops map locations older than 30 days (Google's terms),
so exporting again later is safe.
"""
import asyncio
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routes.deps import db  # noqa: E402

FIELDS = ("place_id", "source", "city", "region", "neighborhood", "categories", "kashrut", "kosher_certification",
          "kosher_check", "contact", "status", "first_seen_at", "last_synced_at", "location", "location_fetched_at")


async def main():
    docs = await db.restaurants.find({"status": {"$in": ["listed", "hidden"]}}, {"_id": 0}).to_list(None)
    rows = [{k: d.get(k) for k in FIELDS} for d in docs]
    # Beside the repo, not in it: this is data, and it must not be committed.
    out = Path(__file__).resolve().parents[3] / "restaurants-export.json"
    out.write_text(json.dumps({"restaurants": rows}, ensure_ascii=False), encoding="utf-8")
    listed = sum(1 for r in rows if r["status"] == "listed")
    print(f"{len(rows)} places ({listed} listed) -> {out}  ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    asyncio.run(main())
