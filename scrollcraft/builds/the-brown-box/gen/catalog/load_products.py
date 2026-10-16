"""Put The Brown Box's catalogue into their shop on MyIsraelRental and give
their business the address the-brown-box (Tzvi, 15 Oct 2026: "Load their menu
into the shop", "Address the-brown-box").

    railway run --service "my-israel-rental Backend" <python> load_products.py          dry run
    railway run --service "my-israel-rental Backend" <python> load_products.py --apply  write

Run from backend/ so the address rules are the site's own. Replaces the one
placeholder product of their store listing ("Menu", 1 ILS, their two menu
flyers as photos). Photos are the page's own, served once it is deployed.
"""
import asyncio
import json
import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, '.')
from routes.deps import db  # noqa: E402
from routes.marketplace.businesses import _address_status, slug_change  # noqa: E402

BIZ = "7d78976f-6dad-4656-8fd1-efb617463c6f"
GIG = "5dab5731-bb0b-4830-ba02-0db28178f031"
SLUG = "the-brown-box"
PHOTO = "https://myisraelrental.com/pages/the-brown-box/assets/menu/{}.webp"


async def main(apply: bool) -> None:
    biz = await db.businesses.find_one({"_id": BIZ})
    gig = await db.marketplace_gigs.find_one({"_id": GIG})
    assert biz and gig and gig.get("business_id") == BIZ and gig.get("gig_type") == "store", "wrong listing"
    rows = json.loads((Path(__file__).parent / "products.json").read_text(encoding="utf8"))
    products = [{
        "id": uuid.uuid4().hex[:12], "name": r["name"], "price": float(r["price"]), "price_to": None,
        "currency": "ILS", "description": r["description"], "image": None, "images": [PHOTO.format(r["slug"])],
        "in_stock": True, "group": r["group"], "serves": None, "width_cm": None, "length_cm": None,
    } for r in rows]
    print(f"{biz.get('name')} ({biz.get('slug')}): replacing {[p.get('name') for p in gig.get('products') or []]}")
    for p in products:
        print(f"  {p['group']:<12} {p['name']:<32} {p['price']:g} ILS")
    status = await _address_status(SLUG, BIZ, biz)
    print("address", SLUG, status)
    if not apply:
        print("dry run: nothing written (add --apply)")
        return
    now = datetime.now(UTC).isoformat()
    r = await db.marketplace_gigs.update_one({"_id": GIG}, {"$set": {"products": products, "updated_at": now}})
    print("products written:", r.modified_count)
    if status["reason"] != "current" and status["available"]:
        update = slug_change(biz, status["address"])
        update["slug_chosen_at"] = now
        update["updated_at"] = now
        r = await db.businesses.update_one({"_id": BIZ}, {"$set": update})
        print("address written:", r.modified_count, update)


asyncio.run(main("--apply" in sys.argv))
