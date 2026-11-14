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


def test_catalog_products_keep_order_id_and_description(monkeypatch):
    """A designed page's menu (Finest Cuts shop.js, mir-catalog.js) needs each product's order id, idx:N for one
    saved before ids existed, and its description. 5dee7ca8 added both; 5ebe10b8 dropped them unnoticed."""
    mm = pytest.importorskip("mongomock_motor")
    mdb = mm.AsyncMongoMockClient()["t"]
    from routes.marketplace import businesses
    monkeypatch.setattr(page_edits, "db", mdb)
    monkeypatch.setattr(businesses, "db", mdb)

    async def run():
        await mdb.businesses.insert_one({"_id": "b1", "slug": "menu-test", "name": "Menu", "owner_user_id": "u1"})
        await mdb.marketplace_gigs.insert_one({"_id": "g1", "business_id": "b1", "status": "published", "gig_type": "store",
                                               "products": [{"name": "Feast", "price": 215, "description": " XL board "},
                                                            {"id": "p2", "name": "Wings", "price": 60}]})
        out = await page_edits.get_page_edits("menu-test")
        return [(p["id"], p.get("description")) for p in out["products"]]

    assert asyncio.run(run()) == [("idx:0", "XL board"), ("p2", None)]
