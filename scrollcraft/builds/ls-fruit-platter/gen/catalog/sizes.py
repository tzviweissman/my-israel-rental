"""LS Fruit Platter's board sizes in centimetres on its four shop products (the owner,
via Tzvi, 28 Oct 2026: Small 30x30, M 40x28, L 58x28, XL 115x25). Only width_cm and
length_cm change.

    railway run --service "my-israel-rental Backend" <python> sizes.py          dry run
    railway run --service "my-israel-rental Backend" <python> sizes.py --apply  write
"""
import asyncio
import sys
from datetime import UTC, datetime

sys.path.insert(0, '.')
from routes.deps import db  # noqa: E402

SIZES = {"55113012e889": (30, 30), "c94a66979f24": (40, 28), "a549851e62aa": (58, 28), "7d53c8ac348a": (115, 25)}  # id: (length, width)


async def main(apply: bool) -> None:
    gig = await db.marketplace_gigs.find_one({"products.id": {"$all": list(SIZES)}})
    assert gig, "listing with the four platter products not found"
    products = gig["products"]
    for p in products:
        if p.get("id") in SIZES:
            p["length_cm"], p["width_cm"] = SIZES[p["id"]]
            print(f"  {p['name']:<12} {p['length_cm']} x {p['width_cm']} cm")
    if not apply:
        print(f"dry run on {gig['_id']}: nothing written (add --apply)")
        return
    r = await db.marketplace_gigs.update_one({"_id": gig["_id"]}, {"$set": {"products": products, "updated_at": datetime.now(UTC).isoformat()}})
    print("written:", r.modified_count)


asyncio.run(main("--apply" in sys.argv))
