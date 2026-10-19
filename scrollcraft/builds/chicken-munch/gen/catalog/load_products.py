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
          "Crispy Cornflake, Rice Krispie, Pretzel, Buffalo Wings")
ROWS = [
    # his new menu card and notes (18 Oct 2026); boxes in dollars, pans in shekels.
    # 19 Oct 2026, the owner: no platter photo on the pans (he no longer makes it),
    # a 9x13 pan is one kind of chicken, the Roaster mixes kinds.
    ("cmminibox001", "Mini Munch Box", 69, "USD", "Premium chicken boxes", "Feeds 3 to 4. Up to 4 types of chicken and 3 sauces.", [PAGE.format("box-dark.webp")]),
    ("cmgrandbox01", "Grand Munch Box", 140, "USD", "Premium chicken boxes", "Feeds 8 to 10. 5 types of chicken and 4 sauces.", [PAGE.format("box-dark.webp")]),
    ("cmsuprbox001", "Supreme Munch Box", 220, "USD", "Premium chicken boxes", "Feeds 16. Up to 6 types of chicken and 5 sauces.", [PAGE.format("box-dark.webp")]),
    ("cm913tray001", "9x13 pan", 275, "ILS", "By the pan", "Feeds 6 to 8. One kind of chicken, from: " + STYLES + ".", []),
    ("cmgastro0001", "Roaster", 650, "ILS", "By the pan", "Feeds 18 to 20. Up to 3 kinds of chicken, from: " + STYLES + ".", []),
    ("cm913rice001", "9x13 rice", 75, "ILS", "By the pan", "", []),
]


async def main(apply: bool) -> None:
    biz = await db.businesses.find_one({"_id": BIZ})
    gig = await db.marketplace_gigs.find_one({"_id": GIG})
    assert biz and gig and gig.get("business_id") == BIZ and gig.get("gig_type") == "store", "wrong listing"
    products = [{
        "id": pid, "name": name, "price": float(price), "price_to": None, "currency": cur, "description": desc,
        "image": None, "images": imgs, "in_stock": True, "group": group, "serves": None, "width_cm": None, "length_cm": None,
    } for pid, name, price, cur, group, desc, imgs in ROWS]
    print(f"{biz.get('name')} ({biz.get('slug')}): replacing {[(p.get('name'), p.get('price'), p.get('currency')) for p in gig.get('products') or []]}")
    for p in products:
        print(f"  {p['group']:<6} {p['name']:<20} {p['price']:g} {p['currency']}  photos {len(p['images'])}")
    print("  delivery_on now:", (biz.get("order_settings") or {}).get("delivery_on"), "-> True")
    if not apply:
        print("dry run: nothing written (add --apply)")
        return
    r = await db.marketplace_gigs.update_one({"_id": GIG}, {"$set": {"products": products, "updated_at": datetime.now(UTC).isoformat()}})
    print("products written:", r.modified_count)
    # He delivers in central Jerusalem (30 to 50 shekels by where, confirmed on
    # WhatsApp), so delivery orders from his page save to his shop (Tzvi, 19 Oct 2026).
    r = await db.businesses.update_one({"_id": BIZ}, {"$set": {"order_settings.delivery_on": True}})
    print("delivery switched on:", r.modified_count)


asyncio.run(main("--apply" in sys.argv))
