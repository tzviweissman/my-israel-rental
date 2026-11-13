"""Put Gremier Coffee's catalogue into their shop on MyIsraelRental, so the site's order form saves orders (rules 3k).
Their listing has no products today (the coffee bar is a service tier, which stays as it is), so an order POST with the
site's ids is refused. Products, prices and ids come from assets/catalog.js (their own site, read 10 Nov 2026;
gen/assets.py). Pictures are their own, from gremiercoffee.co.il (the designed site is not published yet).

Run from backend/. Tzvi said yes on 12 Nov 2026 ("Yes, load them"):

    railway run --service "my-israel-rental Backend" <python> <this file>          dry run
    railway run --service "my-israel-rental Backend" <python> <this file> --apply  write
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

BIZ = "48abdcc9-5e80-4626-a9f3-dacb91123c58"
GIG = "bb714c5a-f354-4fda-8f82-441e68b13067"
HERE = os.path.dirname(os.path.abspath(__file__))
SITE = 'https://gremiercoffee.co.il'
PHOTO = {
    'classic': '/products/classic-liter-lifestyle-v2.webp', 'house': '/products/house-blend-lifestyle-v1.webp',
    'colombia': '/products/colombia-liter-lifestyle-v2.webp', 'sweetened': '/products/sweetened-liter-lifestyle-v3.webp',
    'decaf': '/products/decaf-liter-lifestyle-v2.webp', 'six-litres': '/products/classic-liter-lifestyle-v2.webp',
    'vanilla-latte': '/products/vanilla-cream-latte-lifestyle-v1.webp', 'caramel-latte': '/products/caramel-cream-latte-lifestyle-v1.webp',
    'original-latte': '/products/original-cream-latte-lifestyle-v1.webp', 'classic-mini': '/products/classic-mini-lifestyle-v1.webp',
    'jug-classic': '/products/classic-jug-lifestyle-v2.webp', 'jug-house': '/products/house-jug-lifestyle-v2.webp',
    'jug-colombia': '/products/colombia-jug-lifestyle-v2.webp', 'jugs-three': '/products/classic-three-jugs-lifestyle-v2.webp',
    'caramel-syrup': '/products/sweet-caramel-syrup-lifestyle-v1.webp', 'vanilla-syrup': '/products/vanilla-bean-syrup-lifestyle-v1.webp',
    'bar-premium': '/bar/gallery/01-sunlit-closeup-v3.webp', 'sugar-cups': '/bar/studio/sugar-serving-kit-lids-v3.webp',
    'cups': '/bar/studio/cups-straws-lids-pack-v3.webp',
}
CATALOG = open(os.path.join(HERE, '..', 'assets', 'catalog.js'), encoding='utf8').read()
ITEMS = json.loads(re.search(r'window\.GC = (.*);\s*$', CATALOG, re.S).group(1))['items']


async def main(apply: bool) -> None:
    biz = await db.businesses.find_one({"_id": BIZ})
    gig = await db.marketplace_gigs.find_one({"_id": GIG})
    assert biz and gig and gig.get("business_id") == BIZ, "wrong listing"
    assert not (gig.get("products") or []), f"listing has products since 10 Nov, look first: {[p.get('name') for p in gig['products']]}"
    products = [{
        "id": it["id"], "name": it["name"], "price": float(it["price"]), "price_to": None, "currency": "ILS",
        "description": (('From. ' if it['size'] == 'from' else it['size'] + '. ') + it["desc"])[:500],
        "image": SITE + PHOTO[it["id"]], "images": [], "in_stock": True, "group": it["cat"], "serves": None,
        "width_cm": None, "length_cm": None,
    } for it in ITEMS]
    assert len({p["id"] for p in products}) == len(products) == len(PHOTO), "ids and photos must match one to one"
    print(f"{biz.get('name')} ({biz.get('slug')}): {len(products)} products added; the {len(gig.get('tiers') or [])} tier(s) stay")
    for p in products:
        print(f"  {p['group']:<12} {p['id']:<15} {p['name']:<42} {p['price']:g} ILS")
    print("delivery is on:", offers_delivery(biz.get("order_settings") or {}, biz, gig))
    if not apply:
        print("dry run: nothing written (add --apply)")
        return
    json.dump(gig.get("products") or [], open(os.path.join(HERE, 'products-before.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    r = await db.marketplace_gigs.update_one({"_id": GIG, "products": gig.get("products")},
                                             {"$set": {"products": products, "updated_at": datetime.now(UTC).isoformat()}})
    print("products written:", r.modified_count)


asyncio.run(main("--apply" in sys.argv))
