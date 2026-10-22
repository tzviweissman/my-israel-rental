# RETIRED 22 Oct 2026: the owner now enters her own products and photos in her
# dashboard. --apply REPLACES her shop's products and would wipe her work. Do not run.
"""Put The Gift Boutique's WhatsApp catalogue into their shop on MyIsraelRental,
so their designed page's price list follows what they change in the dashboard
(frontend/public/pages/mir-catalog.js).

    railway run --service "my-israel-rental Backend" <python> load_products.py          dry run
    railway run --service "my-israel-rental Backend" <python> load_products.py --apply  write

Replaces the products of their one store listing (a single placeholder,
"The Gift Boutique", 10 ILS, on 14 Oct 2026). Photos are the page's own,
served by the site once the page is deployed. Prices are as their catalogue
shows them, in dollars; out-of-stock items carry no price (0), so the page
says "Ask for the price" if they are switched back on before a price is set.
"""
import asyncio
import json
import os
import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient

SLUG = "the-gift-boutique"
GIG = "9597d9d8-e78c-4efc-8718-e3ececea4f8f"
PHOTO = "https://myisraelrental.com/pages/the-gift-boutique/assets/cat/{}.webp"


async def main(apply: bool) -> None:
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    biz = await db.businesses.find_one({"slug": SLUG})
    gig = await db.marketplace_gigs.find_one({"_id": GIG})
    assert biz and gig and gig.get("business_id") == biz["_id"] and gig.get("gig_type") == "store", "wrong listing"
    rows = json.loads((Path(__file__).parent / "products.json").read_text(encoding="utf8"))
    products = [{
        "id": uuid.uuid4().hex[:12],
        "name": r["name"],
        "price": float(r["price"]),
        "price_to": float(r["price_to"]) if r.get("price_to") else None,
        "currency": "USD",
        "description": "",
        "image": None,
        "images": [PHOTO.format(r["slug"])],
        "in_stock": bool(r["in_stock"]),
        "group": r["group"],
        "serves": None,
        "width_cm": None,
        "length_cm": None,
    } for r in rows]
    print(f"{biz['name']}: replacing {len(gig.get('products') or [])} product(s): {[p.get('name') for p in gig.get('products') or []]}")
    for p in products:
        price = (f"${p['price']:g}" + (f" to ${p['price_to']:g}" if p["price_to"] else "")) if p["price"] else "no price"
        print(f"  {'IN ' if p['in_stock'] else 'OUT'}  {p['group']:<32} {p['name']:<45} {price}")
    if not apply:
        print("dry run: nothing written (add --apply)")
        return
    r = await db.marketplace_gigs.update_one({"_id": GIG}, {"$set": {"products": products, "updated_at": datetime.now(UTC).isoformat()}})
    print("written:", r.modified_count)


asyncio.run(main("--apply" in sys.argv))
