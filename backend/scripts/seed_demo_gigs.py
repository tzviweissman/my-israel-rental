"""Seed the preview database with a wide variety of realistic demo gigs.

Covers all three gig types (store / deliverable / appointment), several
categories, and a spread of pricing / photos / weekly hours so the
customer-facing flows can be showcased end-to-end.

Idempotent-ish: every seeded gig has a `demo_marker` field so we can
wipe + re-seed without disturbing real listings. Use ``--wipe`` to clear
the old demo gigs before inserting new ones.

Usage (from /app/backend)::

    python -m scripts.seed_demo_gigs               # add demos
    python -m scripts.seed_demo_gigs --wipe        # clear old demos first
"""

from __future__ import annotations

import argparse
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


DEMO_MARKER = "demo_v1"
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


# Picsum seeds produce deterministic photos so the same demo gig always
# looks the same. Handy for A/B compare between deploys.
def _pic(seed: str, w: int = 800, h: int = 600) -> str:
    return f"https://picsum.photos/seed/{seed}/{w}/{h}"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------- Demo gig definitions ----------------
# Each entry is a dict that matches the shape stored in
# `db.marketplace_gigs`. Fields like `_id`, `provider_user_id`,
# `provider_id`, `created_at`, `updated_at`, `status`, `demo_marker`
# are filled in by the seeder — the definitions below just describe the
# customer-facing content.

STORE_DEMOS = [
    dict(
        title="Modern Furniture — Tel Aviv Showroom",
        category="home-organizers",
        area="Tel Aviv",
        description=(
            "A curated collection of solid-wood and mid-century furniture, "
            "handpicked and delivered anywhere in Israel. Every piece is "
            "photographed in our Florentin showroom. Message us for stock "
            "questions or to schedule a visit."
        ),
        whatsapp="+972501234567",
        products=[
            dict(name="Oak Dining Table", price=2400, currency="ILS",
                 description="Solid oak, seats 6. 180×90cm.",
                 image=_pic("furniture-oak-table"), in_stock=True),
            dict(name="Leather 3-Seater Sofa", price=5500, currency="ILS",
                 description="Full-grain leather, chestnut brown.",
                 image=_pic("furniture-sofa"), in_stock=True),
            dict(name="Walnut Bookshelf", price=1800, currency="ILS",
                 description="5 tiers, 220cm tall.",
                 image=_pic("furniture-bookshelf"), in_stock=True),
            dict(name="Marble Coffee Table", price=1200, currency="ILS",
                 description="Carrara marble on brass legs.",
                 image=_pic("furniture-marble"), in_stock=False),
        ],
    ),
    dict(
        title="Jerusalem Ceramics Studio",
        category="home-organizers",
        area="Jerusalem",
        description=(
            "Handmade tableware and vases from a family studio in the "
            "German Colony. Each piece is one-of-a-kind. Pickup available "
            "or we ship anywhere in Israel."
        ),
        whatsapp="+972521111222",
        products=[
            dict(name="Speckled Dinner Plate", price=95, currency="ILS",
                 description="Set of 4, glossy sand glaze.",
                 image=_pic("ceramics-plate"), in_stock=True),
            dict(name="Wide-Mouth Vase", price=240, currency="ILS",
                 description="Matte terracotta, 30cm.",
                 image=_pic("ceramics-vase"), in_stock=True),
            dict(name="Espresso Cup Set", price=180, currency="ILS",
                 description="6 pieces, saucers included.",
                 image=_pic("ceramics-espresso"), in_stock=True),
        ],
    ),
    dict(
        title="Herzliya Bike Shop",
        category="transportation",
        area="Herzliya",
        description=(
            "Family-run bike store since 2004. New and refurbished bikes, "
            "full service repair, kids' balance bikes and accessories. "
            "Message us to check stock or book a fitting."
        ),
        whatsapp="+972544445556",
        products=[
            dict(name="Trek Marlin 6", price=3800, currency="ILS",
                 description="27.5\" hardtail, hydraulic brakes.",
                 image=_pic("bike-trek"), in_stock=True),
            dict(name="Electric City Cruiser", price=6200, currency="ILS",
                 description="500W motor, 80km range.",
                 image=_pic("bike-electric"), in_stock=True),
            dict(name="Kids' Balance Bike", price=340, currency="ILS",
                 description="Ages 2-5, no pedals.",
                 image=_pic("bike-kids"), in_stock=True),
        ],
    ),
]

DELIVERABLE_DEMOS = [
    dict(
        title="Deep Cleaning Service — Tel Aviv & Center",
        category="home-repair",
        area="Tel Aviv",
        description=(
            "Bonded crew for deep cleans, move-in / move-out, and "
            "post-renovation dust removal. Eco-friendly products only. "
            "Same-week booking usually available."
        ),
        whatsapp="+972553225141",
        enable_date_booking=True,
        tiers=[
            dict(name="Studio Deep Clean", price=280, currency="ILS",
                 delivery_days=1, description="Up to 40sqm.",
                 features=["Kitchen degrease", "Bathroom scrub", "Windows inside"],
                 images=[_pic("cleaning-studio-1"), _pic("cleaning-studio-2")]),
            dict(name="2-Bedroom Apartment", price=480, currency="ILS",
                 delivery_days=1, description="40-80sqm.",
                 features=["Everything above", "Balcony", "Interior wardrobes"],
                 images=[_pic("cleaning-2br-1"), _pic("cleaning-2br-2")]),
            dict(name="3-4 Bedroom Villa", price=750, currency="ILS",
                 delivery_days=1, description="80-150sqm.",
                 features=["Everything above", "Multiple bathrooms", "Outside patio wash"],
                 images=[_pic("cleaning-villa-1")]),
        ],
    ),
    dict(
        title="Logo Design & Brand Identity",
        category="graphic-designer",
        area="Tel Aviv",
        description=(
            "Award-winning designer, 12 years experience. Perfect for "
            "cafes, boutiques, and consultants launching a brand. Every "
            "package includes source files."
        ),
        whatsapp="+972501111333",
        tiers=[
            dict(name="Basic Logo", price=350, currency="USD",
                 delivery_days=3, description="3 concepts, 2 rounds of revisions.",
                 features=["PNG + SVG", "Colour + mono variants"],
                 images=[_pic("logo-basic-1"), _pic("logo-basic-2")]),
            dict(name="Standard Package", price=650, currency="USD",
                 delivery_days=5, description="5 concepts, 3 rounds of revisions.",
                 features=["Everything above", "Business card design", "Social media banner"],
                 images=[_pic("logo-standard-1"), _pic("logo-standard-2")]),
            dict(name="Premium Brand Kit", price=1200, currency="USD",
                 delivery_days=10, description="Full brand system.",
                 features=["Full brand book", "Letterhead + invoice", "Instagram templates ×10"],
                 images=[_pic("logo-premium-1"), _pic("logo-premium-2"), _pic("logo-premium-3")]),
        ],
    ),
    dict(
        title="Moving Company — Israel-Wide",
        category="home-repair",
        area="Jerusalem",
        description=(
            "Insured, 15+ years experience. Local moves same-day, "
            "long-distance next-day. Packing service on request. Pick "
            "your target date on the calendar."
        ),
        whatsapp="+972544441111",
        enable_date_booking=True,
        tiers=[
            dict(name="Studio Move", price=900, currency="ILS",
                 delivery_days=1, description="Up to 30sqm, 1 truck.",
                 features=["2 movers", "Basic packing tape included"],
                 images=[_pic("move-studio")]),
            dict(name="Family Move", price=2200, currency="ILS",
                 delivery_days=1, description="2-4 bedrooms.",
                 features=["4 movers", "Wardrobe disassembly", "Furniture blankets"],
                 images=[_pic("move-family")]),
            dict(name="Long-Distance", price=3500, currency="ILS",
                 delivery_days=2, description="Any city to any city.",
                 features=["Everything above", "Overnight secure storage"],
                 images=[_pic("move-long")]),
        ],
    ),
]

APPOINTMENT_DEMOS = [
    dict(
        title="Downtown Barbershop — Rothschild",
        category="womens-spa",
        area="Tel Aviv",
        description=(
            "Old-school straight-razor shaves and modern fades. Walk-ins "
            "welcome but appointments beat the wait. Espresso on the house."
        ),
        whatsapp="+972501234500",
        weekly_availability={
            "sun": [{"start": "10:00", "end": "18:00"}],
            "mon": [{"start": "09:00", "end": "18:00"}],
            "tue": [{"start": "09:00", "end": "18:00"}],
            "wed": [{"start": "09:00", "end": "18:00"}],
            "thu": [{"start": "09:00", "end": "20:00"}],
            "fri": [{"start": "09:00", "end": "14:00"}],
            "sat": [],
        },
        slot_duration_minutes=30,
        tiers=[
            dict(name="Haircut", price=80, currency="ILS", duration_minutes=30,
                 description="Wash, cut, style.",
                 images=[_pic("barber-cut-1"), _pic("barber-cut-2")]),
            dict(name="Beard Trim", price=40, currency="ILS", duration_minutes=15,
                 description="Shape + hot towel.",
                 images=[_pic("barber-beard")]),
            dict(name="Full Grooming", price=120, currency="ILS", duration_minutes=45,
                 description="Haircut + beard + hot towel + facial cleanse.",
                 images=[_pic("barber-full-1"), _pic("barber-full-2")]),
            dict(name="Straight-Razor Shave", price=90, currency="ILS", duration_minutes=30,
                 description="Traditional wet shave.",
                 images=[_pic("barber-shave")]),
        ],
    ),
    dict(
        title="Yoga & Massage Studio — Florentin",
        category="health-fitness",
        area="Tel Aviv",
        description=(
            "Certified therapists, calming Florentin studio. Deep tissue, "
            "Swedish, prenatal, or private yoga. Book any open slot below."
        ),
        whatsapp="+972554443332",
        weekly_availability={
            "sun": [{"start": "08:00", "end": "20:00"}],
            "mon": [{"start": "08:00", "end": "20:00"}],
            "tue": [{"start": "08:00", "end": "20:00"}],
            "wed": [{"start": "08:00", "end": "20:00"}],
            "thu": [{"start": "08:00", "end": "20:00"}],
            "fri": [{"start": "08:00", "end": "14:00"}],
            "sat": [{"start": "18:00", "end": "22:00"}],
        },
        slot_duration_minutes=30,
        tiers=[
            dict(name="Swedish Massage", price=280, currency="ILS", duration_minutes=60,
                 description="Full-body relaxation.",
                 images=[_pic("massage-swedish-1"), _pic("massage-swedish-2")]),
            dict(name="Deep Tissue Massage", price=340, currency="ILS", duration_minutes=60,
                 description="Focused pressure for tight shoulders / neck.",
                 images=[_pic("massage-deep")]),
            dict(name="Prenatal Massage", price=320, currency="ILS", duration_minutes=60,
                 description="Certified prenatal therapist.",
                 images=[_pic("massage-prenatal")]),
            dict(name="Private Yoga", price=250, currency="ILS", duration_minutes=45,
                 description="One-on-one instruction, any level.",
                 images=[_pic("yoga-private")]),
        ],
    ),
    dict(
        title="Guided Tours of Israel",
        category="tours-activities",
        area="Jerusalem",
        description=(
            "Licensed guide, 20+ years experience. From half-day city "
            "walks to multi-day desert trips. Every tour is designed "
            "around what you want to see."
        ),
        whatsapp="+972508881111",
        weekly_availability={
            "sun": [{"start": "08:00", "end": "17:00"}],
            "mon": [{"start": "08:00", "end": "17:00"}],
            "tue": [{"start": "08:00", "end": "17:00"}],
            "wed": [{"start": "08:00", "end": "17:00"}],
            "thu": [{"start": "08:00", "end": "17:00"}],
            "fri": [{"start": "08:00", "end": "12:00"}],
            "sat": [],
        },
        slot_duration_minutes=60,
        tiers=[
            dict(name="Old City Walking Tour", price=180, currency="USD", duration_minutes=180,
                 description="Christian, Muslim, Jewish and Armenian quarters.",
                 images=[_pic("tour-old-city-1"), _pic("tour-old-city-2"), _pic("tour-old-city-3")]),
            dict(name="Tel Aviv Bauhaus Tour", price=140, currency="USD", duration_minutes=120,
                 description="White City modernist architecture.",
                 images=[_pic("tour-bauhaus-1"), _pic("tour-bauhaus-2")]),
            dict(name="Masada + Dead Sea", price=280, currency="USD", duration_minutes=480,
                 description="Full-day tour with transport.",
                 images=[_pic("tour-masada-1"), _pic("tour-masada-2"), _pic("tour-masada-3")]),
            dict(name="Bethlehem Half-Day", price=160, currency="USD", duration_minutes=240,
                 description="Nativity Church + market walk.",
                 images=[_pic("tour-bethlehem")]),
        ],
    ),
    dict(
        title="Personal Trainer — Beach + Studio",
        category="health-fitness",
        area="Herzliya",
        description=(
            "Certified strength coach. Beach workouts in the mornings, "
            "studio sessions in Herzliya afternoons. First session is on "
            "the house."
        ),
        whatsapp="+972506667777",
        weekly_availability={
            "sun": [{"start": "06:00", "end": "10:00"}, {"start": "17:00", "end": "21:00"}],
            "mon": [{"start": "06:00", "end": "10:00"}, {"start": "17:00", "end": "21:00"}],
            "tue": [{"start": "06:00", "end": "10:00"}, {"start": "17:00", "end": "21:00"}],
            "wed": [{"start": "06:00", "end": "10:00"}, {"start": "17:00", "end": "21:00"}],
            "thu": [{"start": "06:00", "end": "10:00"}, {"start": "17:00", "end": "21:00"}],
            "fri": [{"start": "06:00", "end": "12:00"}],
            "sat": [],
        },
        slot_duration_minutes=60,
        tiers=[
            dict(name="1:1 Session", price=250, currency="ILS", duration_minutes=60,
                 description="Custom program, weekly progress checks.",
                 images=[_pic("pt-1-1")]),
            dict(name="Couples Training", price=380, currency="ILS", duration_minutes=60,
                 description="Two people, same slot.",
                 images=[_pic("pt-couples")]),
            dict(name="Beach Bootcamp", price=180, currency="ILS", duration_minutes=45,
                 description="Group of up to 6.",
                 images=[_pic("pt-beach-1"), _pic("pt-beach-2")]),
        ],
    ),
]


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--wipe", action="store_true", help="Delete existing demo gigs first")
    parser.add_argument("--provider-email", default="admin@rental.com",
                        help="Existing user whose provider record will own the demo gigs")
    args = parser.parse_args()

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    if args.wipe:
        wiped = await db.marketplace_gigs.delete_many({"demo_marker": DEMO_MARKER})
        print(f"Wiped {wiped.deleted_count} previous demo gig(s).")

    # Pick a real user + their provider record so the gigs surface via
    # provider-scoped queries (reviews, admin dashboards, etc.).
    user = await db.users.find_one({"email": args.provider_email})
    if not user:
        raise SystemExit(f"No user found with email {args.provider_email!r}. "
                         "Pass --provider-email to point at an existing account.")
    # Legacy users had a Mongo ObjectId `_id` while newer users have a
    # string UUID. The gig endpoint's response serializer chokes on
    # ObjectIds — coerce to str up-front so demo gigs remain viewable
    # regardless of which era their owner is from.
    user_id = str(user["_id"])
    prov = await db.marketplace_providers.find_one({"user_id": user_id}) \
        or await db.marketplace_providers.find_one({"user_id": user["_id"]})
    if not prov:
        # Auto-create a minimal provider record — mirrors what the API
        # does on the first POST /gigs by that user.
        prov_id = str(uuid.uuid4())
        prov = {
            "_id": prov_id,
            "user_id": user_id,
            "display_name": user.get("full_name") or user.get("email", "Provider"),
            "response_bucket": "1h",
            "created_at": _now(),
        }
        await db.marketplace_providers.insert_one(prov)
        print(f"Created provider record {prov_id} for {args.provider_email}.")
    elif not isinstance(prov.get("user_id"), str):
        # Existing provider record has an ObjectId user_id — repoint it
        # so the API can serialize the response cleanly.
        await db.marketplace_providers.update_one({"_id": prov["_id"]}, {"$set": {"user_id": user_id}})
        prov["user_id"] = user_id

    all_defs = (
        [("store", d) for d in STORE_DEMOS]
        + [("deliverable", d) for d in DELIVERABLE_DEMOS]
        + [("appointment", d) for d in APPOINTMENT_DEMOS]
    )
    inserts: list[dict] = []
    for gig_type, defn in all_defs:
        gig_id = str(uuid.uuid4())
        doc = {
            "_id": gig_id,
            "provider_user_id": user_id,
            "provider_id": prov["_id"],
            "gig_type": gig_type,
            "title": defn["title"],
            "title_he": None,
            "category": defn["category"],
            "description": defn["description"],
            "description_he": None,
            "tiers": defn.get("tiers", []),
            "products": defn.get("products", []),
            "weekly_availability": defn.get("weekly_availability"),
            "slot_duration_minutes": defn.get("slot_duration_minutes"),
            "enable_date_booking": defn.get("enable_date_booking", False),
            "gallery": [],
            "booking_mode": defn.get("booking_mode", "whatsapp"),
            "whatsapp": defn.get("whatsapp", "+972500000000"),
            "area": defn["area"],
            "faqs": defn.get("faqs", []),
            "status": "published",
            "created_at": _now(),
            "updated_at": _now(),
            "demo_marker": DEMO_MARKER,
        }
        inserts.append(doc)

    if inserts:
        await db.marketplace_gigs.insert_many(inserts)
    print(f"Seeded {len(inserts)} demo gig(s):")
    counts: dict[str, int] = {}
    for doc in inserts:
        counts[doc["gig_type"]] = counts.get(doc["gig_type"], 0) + 1
    for k, v in counts.items():
        print(f"  {k:>12} · {v}")


if __name__ == "__main__":
    asyncio.run(main())
