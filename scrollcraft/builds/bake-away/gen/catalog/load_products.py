"""Put Bake away's menu into her shop on MyIsraelRental (Tzvi, 28 Oct 2026: "and add
them as products"). Her listing had price tiers only and no products, so the site's
order form could not save an order before WhatsApp opened (the order-form route 404s
on a listing without products). Prices are her listing's. The flavour, milky or parve
and the cake flavour travel in the order's notes, as the page writes them.

    railway run --service "my-israel-rental Backend" <python> load_products.py          dry run
    railway run --service "my-israel-rental Backend" <python> load_products.py --apply  write

Product ids are fixed: shop.html's PID map points at them.
"""
import asyncio
import sys
from datetime import UTC, datetime

sys.path.insert(0, '.')
from routes.deps import db  # noqa: E402

BIZ = "8e5ad619-878c-4a79-b283-af1a187101be"
GIG = "4bfcede3-77c9-4a4a-8848-99afc8f55970"
ROWS = [
    ("badoughnut01", "Doughnut", 16, "Doughnuts", "Glazed doughnuts, milky or parve. Choose the kind and the flavour."),
    ("bacreamdn001", "Cream doughnut", 18, "Doughnuts", "A very wide variety of doughnuts."),
    ("badiykit0001", "DIY kit", 70, "Doughnuts", "8 mini cake doughnuts, icings and topping."),
    ("batraycake01", "Tray of cake", 120, "Cakes and more", "24 pieces of cake."),
    ("bachallah001", "Challah", 40, "Cakes and more", "Baked at home."),
    ("bacinnabun01", "Cinnamon buns", 50, "Cakes and more", "6 cinnamon buns."),
    ("bacake000001", "Cake", 45, "Cakes and more", "Marble, honey or mocca."),
    ("baminichee01", "Mini cheesecakes", 120, "Cakes and more", "12 no-bake mini cheesecakes."),
    ("bacheesecak1", "Cheesecake", 250, "Cakes and more", "A variety of cheesecakes with chocolate, caramel and more."),
    ("babakba00001", "Babka", 60, "Cakes and more", "Baked at home."),
]


async def main(apply: bool) -> None:
    biz = await db.businesses.find_one({"_id": BIZ})
    gig = await db.marketplace_gigs.find_one({"_id": GIG})
    assert biz and gig and gig.get("business_id") == BIZ, "wrong listing"
    have = gig.get("products") or []
    assert not have, f"listing already has products, not replacing: {[p.get('name') for p in have]}"
    products = [{
        "id": pid, "name": name, "price": float(price), "price_to": None, "currency": "ILS", "description": desc,
        "image": None, "images": [], "in_stock": True, "group": group, "serves": None, "width_cm": None, "length_cm": None,
    } for pid, name, price, group, desc in ROWS]
    print(f"{biz.get('name')} ({biz.get('slug')}), delivery_on {(biz.get('order_settings') or {}).get('delivery_on')}")
    for p in products:
        print(f"  {p['group']:<15} {p['name']:<18} {p['price']:g} ILS")
    if not apply:
        print("dry run: nothing written (add --apply)")
        return
    r = await db.marketplace_gigs.update_one({"_id": GIG}, {"$set": {"products": products, "updated_at": datetime.now(UTC).isoformat()}})
    print("products written:", r.modified_count)


asyncio.run(main("--apply" in sys.argv))
