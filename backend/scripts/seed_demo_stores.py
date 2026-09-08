"""Seed the LOCAL database with the two demo businesses the scroll-craft
pages order from, so the order pages post real orders to a real board.

    python -m scripts.seed_demo_stores            # from backend/, local Mongo only

Both businesses are real (they are on production, with thin records) and
their products, prices, add-ons, hours and payment notes below are
transcribed from their own websites on 8 Sep 2026, in their own currency.
Nothing is guessed: a field a business has not published is left empty,
which is why no product here has `serves`.

The records are owned by the dev sign-in owner (dev-owner@local.test) and
upserted by slug, so re-running refreshes them. Refuses to run against
anything but localhost, the same lock the dev sign-in uses.
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(BACKEND_DIR / ".env")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
OWNER_EMAIL = "dev-owner@local.test"

BLAZIN_BOARDS = [
    # name, price (USD), description, group
    ("Mini Board · 15 × 20 cm", 75, "Entrecote steak, candied pastrami, salami chips, sometimes brisket or London broil, beef jerky.", "Boards"),
    ("Small Blazin' Board · 20 × 30 cm", 149, "Salami chips, sticky beef bites, candied pastrami, brisket, London broil, beef jerky.", "Boards"),
    ("Small Premium Steak Board · 20 × 30 cm", 250, "Oyster steak, entrecote, candied pastrami, brisket, skirt or hanger steak, beef jerky.", "Boards"),
    ("Medium Blazin' Board · 24 × 35 cm", 250, "Sliced entrecote, maple herb baby chicken, salami chips, sticky beef bites, candied pastrami, brisket, London broil, beef jerky.", "Boards"),
    ("Medium Premium Steak Board · 24 × 35 cm", 350, "Oyster steak, entrecote, candied pastrami, brisket, skirt or hanger steak, beef jerky.", "Boards"),
    ("Large Blazin' Board · 33 × 47 cm", 385, "Sliced entrecote, maple herb baby chicken, salami chips, sticky beef bites, candied pastrami, London broil, brisket, beef jerky.", "Boards"),
    ("Large Premium Steak Board · 33 × 47 cm", 485, "Oyster steak, entrecote, candied pastrami, brisket, skirt or hanger steak, beef jerky.", "Boards"),
    ("Extra Large VIP Board · 37 × 57 cm", 700, "Rib steak, oyster steak, sliced entrecote, salami chips, sticky beef bites, candied pastrami, London broil, brisket, beef facon, beef jerky.", "Boards"),
    ("The Party Board", 750, "Two rib steaks, oyster steak, entrecote, candied pastrami, brisket, London broil, skirt or hanger steak, beef jerky.", "Boards"),
    ("The All Jerky Board · 20 × 30 cm", 139, "", "Boards"),
    ("Bartenura Moscato", 35, "", "Add a bottle"),
    ("Psagot Cabernet", 50, "", "Add a bottle"),
    ("Pardes Merlot", 65, "", "Add a bottle"),
    ("Four Roses", 65, "", "Add a bottle"),
    ("Glenlivet 12", 75, "", "Add a bottle"),
    ("Woodford Reserve", 85, "", "Add a bottle"),
]

MICHAL_ITEMS = [
    # name, price (ILS), description, group
    ("Custom wig consultation", 100, "At the salon in Bet Shemesh. Sunday to Thursday, 10 to 2, by appointment.", "At the salon"),
    ("Academy · Styling Mastery", 8000, "Ten in-depth lessons: curls, blow-dry techniques, volume, tool control. Starts 3 November 2026, Sunday and Tuesday mornings at 10:00.", "The Academy"),
    ("Academy · Cutting Mastery", 8000, "Nine advanced lessons: wig construction, weight, balance, natural flow. Starts 3 November 2026, Sunday and Tuesday mornings at 10:00.", "The Academy"),
    ("Academy · both courses", 12000, "Styling Mastery and Cutting Mastery together, ₪16,000 separately. Sign up before chag and the toolkit, worth ₪3,000, is free.", "The Academy"),
]


def _products(rows: list[tuple], currency: str) -> list[dict]:
    return [{
        "id": uuid.uuid5(uuid.NAMESPACE_URL, f"demo-store/{currency}/{name}").hex[:12],
        "name": name, "price": float(price), "currency": currency, "description": desc,
        "image": None, "images": [], "in_stock": True, "group": group, "serves": None,
    } for name, price, desc, group in rows]


async def main() -> None:
    if "localhost" not in MONGO_URL and "127.0.0.1" not in MONGO_URL:
        sys.exit("Refusing: MONGO_URL is not localhost. This seed is for the local database only.")
    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
    owner = await db.users.find_one({"email": OWNER_EMAIL}, {"_id": 0, "id": 1})
    if not owner:
        sys.exit("Open any local page with ?as=owner first, so the dev owner account exists.")
    now = datetime.now(timezone.utc).isoformat()

    async def upsert(slug: str, biz: dict, gig: dict) -> None:
        existing = await db.businesses.find_one({"slug": slug})
        biz_id = existing["_id"] if existing else str(uuid.uuid4())
        biz_doc = {**biz, "_id": biz_id, "slug": slug, "owner_user_id": owner["id"], "active": True, "updated_at": now,
                   "demo_marker": "demo_stores_v1"}
        if not existing:
            biz_doc["created_at"] = now
        await db.businesses.update_one({"_id": biz_id}, {"$set": biz_doc}, upsert=True)
        g = await db.marketplace_gigs.find_one({"business_id": biz_id, "gig_type": "store"})
        gig_id = g["_id"] if g else str(uuid.uuid4())
        gig_doc = {**gig, "_id": gig_id, "business_id": biz_id, "provider_user_id": owner["id"], "provider_id": owner["id"],
                   "gig_type": "store", "status": "published", "updated_at": now, "demo_marker": "demo_stores_v1"}
        if not g:
            gig_doc["created_at"] = now
        await db.marketplace_gigs.update_one({"_id": gig_id}, {"$set": gig_doc}, upsert=True)
        print(f"{slug}: business {biz_id}, store listing {gig_id}, {len(gig['products'])} products")

    await upsert("blazin-boards", {
        "name": "Blazin' Boards", "description": "Experience the Flavours of Blazin' Boards in Israel. Discover a blend of premium meats cooked and grilled to perfection.",
        "areas": ["jerusalem"], "serves_nationwide": True, "accent": "stone",
        "payment_note": "credit card, Zelle, bank transfer", "member_since": "2026", "languages": ["English"],
        "order_settings": {"windows": {"pickup": [], "delivery": []}, "delivery_fee": None, "min_order": None},
        "order_cutoffs": [],
    }, {
        "title": "Meatboards", "category": "shops-products", "area": "Jerusalem", "budget_currency": "USD",
        "description": "Premium meat boards in five sizes. Orders 48 hours ahead. Delivery throughout Israel.",
        "products": _products(BLAZIN_BOARDS, "USD"), "gallery": [], "booking_mode": "message",
    })
    await upsert("michal-simkin", {
        "name": "Michal Simkin", "description": "Custom wigs, transformations, cuts, repairs and styling, customized to your face, lifestyle and personality. A wig that actually feels like you.",
        "areas": ["bet-shemesh"], "serves_nationwide": False, "accent": "stone",
        "hours": "Sun- Thursday  10-2 by apointment", "languages": ["English", "Hebrew"], "member_since": "2026",
        "order_settings": {"windows": {"pickup": [], "delivery": []}, "delivery_fee": None, "min_order": None},
        "order_cutoffs": [],
    }, {
        "title": "Michal Simkin Boutique Wig Salon & Academy", "category": "shops-products", "area": "Bet Shemesh", "budget_currency": "ILS",
        "description": "A boutique wig salon and academy in Bet Shemesh.",
        "products": _products(MICHAL_ITEMS, "ILS"), "gallery": [], "booking_mode": "message",
    })


if __name__ == "__main__":
    asyncio.run(main())
