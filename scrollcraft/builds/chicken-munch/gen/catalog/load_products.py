"""Put Chicken Munch's real menu into their shop on MyIsraelRental (Tzvi,
17 Oct 2026: "you can load his real menu as well"). From their WhatsApp
catalogue's menu card: two trays and two sides, in shekels. Replaces the one
product the owner entered ("premium chicken boxes", 140 USD, not on the menu).

    railway run --service "my-israel-rental Backend" <python> load_products.py          dry run
    railway run --service "my-israel-rental Backend" <python> load_products.py --apply  write

Product ids are fixed so the page's order form can save orders against them.
"""
import asyncio
import sys
from datetime import UTC, datetime

sys.path.insert(0, '.')
from routes.deps import db  # noqa: E402

BIZ = "a07a929a-90d8-46a0-9023-d93371c1e464"
GIG = "d574d800-2e8a-41ce-ae28-f6f03fd6329a"
BOX = "https://res.cloudinary.com/dirvyboe9/image/upload/f_auto,q_auto/v1791749926/myisraelrental/udjwaz6yyaazdrktrzmv.jpg"
PAGE = "https://myisraelrental.com/pages/chicken-munch/assets/{}"
STYLES = ("Classic American Crunch, Original Hot Poppers, Shnitzel Bites, Fruity Chicken, "
          "Crispy Corn Flakes, Crunchy Pretzel, Rice Crispy Fingers")
ROWS = [
    ("cm913tray001", "9x13 tray", 260, "Trays", f"Choose your styles and sauces: {STYLES}.", [BOX]),
    ("cmgastro0001", "Gastro tray", 650, "Trays", f"The full-size tray. Choose your styles and sauces: {STYLES}.", [PAGE.format("tray.webp")]),
    ("cm913rice001", "9x13 rice", 70, "Sides", "", []),
    ("cmlomein0001", "Vegetable lo mein", 95, "Sides", "", []),
]


async def main(apply: bool) -> None:
    biz = await db.businesses.find_one({"_id": BIZ})
    gig = await db.marketplace_gigs.find_one({"_id": GIG})
    assert biz and gig and gig.get("business_id") == BIZ and gig.get("gig_type") == "store", "wrong listing"
    products = [{
        "id": pid, "name": name, "price": float(price), "price_to": None, "currency": "ILS", "description": desc,
        "image": None, "images": imgs, "in_stock": True, "group": group, "serves": None, "width_cm": None, "length_cm": None,
    } for pid, name, price, group, desc, imgs in ROWS]
    print(f"{biz.get('name')} ({biz.get('slug')}): replacing {[(p.get('name'), p.get('price'), p.get('currency')) for p in gig.get('products') or []]}")
    for p in products:
        print(f"  {p['group']:<6} {p['name']:<20} {p['price']:g} ILS  photos {len(p['images'])}")
    if not apply:
        print("dry run: nothing written (add --apply)")
        return
    r = await db.marketplace_gigs.update_one({"_id": GIG}, {"$set": {"products": products, "updated_at": datetime.now(UTC).isoformat()}})
    print("products written:", r.modified_count)


asyncio.run(main("--apply" in sys.argv))
