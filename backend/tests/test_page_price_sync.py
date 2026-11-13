"""A price changed in the page editor is set in that business's own listing (page_edits.set_listing_prices; Tzvi,
11 Nov 2026, after L.A. Cholent's page said ₪330 while the order sent ₪250). Needs the local MongoDB."""
import asyncio
import uuid

import pytest

from routes.marketplace import page_edits


def test_price_goes_to_own_listing_only():
    db = page_edits.db
    mine, other = f"test-biz-{uuid.uuid4()}", f"test-biz-{uuid.uuid4()}"
    gigs = [
        {"_id": f"g-{uuid.uuid4()}", "business_id": mine, "status": "published",
         "tiers": [{"name": "Medium", "price": 100.0}, {"name": "Extra Large / Kiddush", "price": 250.0}]},
        {"_id": f"g-{uuid.uuid4()}", "business_id": other, "status": "published",
         "tiers": [{"name": "Extra Large / Kiddush", "price": 250.0}]},
    ]

    async def run():
        try:
            await db.marketplace_gigs.insert_many(gigs)
        except Exception as e:  # no local database
            pytest.skip(f"local MongoDB not reachable: {e}")
        try:
            done = await page_edits.set_listing_prices(mine, {"Extra Large / Kiddush": 330, "Nope": 5, "Medium": -1})
            assert done == {"Extra Large / Kiddush": 330.0}
            a = await db.marketplace_gigs.find_one({"_id": gigs[0]["_id"]})
            b = await db.marketplace_gigs.find_one({"_id": gigs[1]["_id"]})
            assert [t["price"] for t in a["tiers"]] == [100.0, 330.0]
            assert b["tiers"][0]["price"] == 250.0
        finally:
            await db.marketplace_gigs.delete_many({"_id": {"$in": [g["_id"] for g in gigs]}})

    asyncio.run(run())
