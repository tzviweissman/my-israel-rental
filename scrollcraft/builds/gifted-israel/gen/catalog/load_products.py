"""Put Gifted Israel's catalogue into their shop on MyIsraelRental, so the site's order form saves orders (rules 3k).
Their listing holds one placeholder product at ₪1 (the flyer), so an order POST with real ids is refused today.
Products, prices and ids come from assets/catalog.js (their website, read 4 Nov 2026; gen/assets.py). Choices
(finish, nusach, engraving) travel in the order's notes, as the page writes them. Images are the site's own.

Run from backend/. Tzvi said yes on 5 Nov 2026, at the website's prices, before the owner's answers:

    railway run --service "my-israel-rental Backend" <python> <this file>          dry run
    railway run --service "my-israel-rental Backend" <python> <this file> --apply  write

Delivery also needs a write (their business has no areas and serves_nationwide is false, so a delivery order is
refused): set it in the same round, from their answer to question 3. Not done here.
"""
import asyncio
import json
import os
import re
import sys
from datetime import UTC, datetime

sys.path.insert(0, '.')
from routes.deps import db  # noqa: E402
from routes.marketplace.orders import offers_delivery  # noqa: E402

BIZ = "201af5a4-0049-4866-9d02-ac65d4d613a1"
GIG = "75512153-f18d-47b4-9daf-ffbed495089a"
HERE = os.path.dirname(os.path.abspath(__file__))
# the pictures on their own public site: the designed site is not published yet, so its own copies would be broken links
PHOTO = {"gi" + p["id"][-10:]: p["image_url"] for p in json.load(open(os.path.join(HERE, '..', '..', 'src', 'site', 'Product.json'), encoding='utf8'))}
CATALOG = open(os.path.join(HERE, '..', '..', 'assets', 'catalog.js'), encoding='utf8').read()
ITEMS = json.loads(re.search(r'window\.GI = (.*);\s*$', CATALOG, re.S).group(1))['items']


async def main(apply: bool) -> None:
    biz = await db.businesses.find_one({"_id": BIZ})
    gig = await db.marketplace_gigs.find_one({"_id": GIG})
    assert biz and gig and gig.get("business_id") == BIZ, "wrong listing"
    have = [p.get("name") for p in gig.get("products") or []]
    assert have == ["Gifted Israel"], f"listing changed since 4 Nov, look first: {have}"
    products = [{
        "id": it["id"], "name": it["name"], "price": float(it["price"]), "price_to": None, "currency": "ILS", "description": it["desc"][:500],
        "image": PHOTO[it["id"]], "images": [], "in_stock": True, "group": it["cat"], "serves": None, "width_cm": None, "length_cm": None,
    } for it in ITEMS]
    print(f"{biz.get('name')} ({biz.get('slug')}): {len(products)} products replace the ₪1 placeholder")
    for p in products[:5]:
        print(f"  {p['group']:<15} {p['name']:<45} {p['price']:g} ILS")
    print("delivery is on:", offers_delivery(biz.get("order_settings") or {}, biz, gig))
    if not apply:
        print("dry run: nothing written (add --apply)")
        return
    json.dump(gig.get("products") or [], open(os.path.join(HERE, 'products-before.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    r = await db.marketplace_gigs.update_one({"_id": GIG}, {"$set": {"products": products, "updated_at": datetime.now(UTC).isoformat()}})
    print("products written:", r.modified_count)


asyncio.run(main("--apply" in sys.argv))
