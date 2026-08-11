"""Populate the Railway PREVIEW database with listing content only.

Why this exists
---------------
The preview environment needs to look like the real site — the redesign is
mostly about how listings are presented, and empty states demo nothing. But
it must contain no personal data: no user accounts, no bookings, no
messages, no contracts, no payment records.

How it gets the data
--------------------
From production's PUBLIC API, not from the production database. That is a
deliberate safety property, not a convenience: `/api/properties` and
`/api/marketplace/gigs` are the same unauthenticated endpoints any visitor
hits, so this script *cannot* reach anything private even if it tried. It
never holds an Atlas credential.

What it does to the data
------------------------
Properties ship as-is. Their public payload carries no owner, no contact
details and no user reference — only the listing itself.

Gigs need surgery. Their public payload embeds a real `provider_user_id`,
the provider's real name and avatar, and possibly a WhatsApp number. Those
identify actual people running actual businesses, so:

  * every provider identity is replaced with a synthetic one
    ("Preview Provider 1", …), and
  * `whatsapp` is dropped.

The gig's own content — title, description, prices, category, gallery — is
kept, because that is the marketplace content the redesign is presenting.

Synthetic providers are written with `subscription_status: "active"`
because `_provider_is_active()` filters the browse endpoint; without a
matching active provider record, every gig would be invisible and /services
would look broken.

Usage (from inside the preview container, where the private Mongo is
reachable):

    python scripts/seed_preview.py

Refuses to run anywhere that doesn't look like a preview database.
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

import httpx
from motor.motor_asyncio import AsyncIOMotorClient

UTC = timezone.utc

PROD_API = os.environ.get(
    "PREVIEW_SEED_SOURCE",
    "https://my-israel-rental-production.up.railway.app/api",
).rstrip("/")

MONGO_URL = os.environ.get("MONGO_URL", "")
DB_NAME = os.environ.get("DB_NAME", "")


def guard() -> None:
    """Refuse to touch anything that isn't obviously the preview database.

    Two independent checks, because this script DELETES before it inserts
    and the cost of being wrong is production listings.
    """
    if "preview" not in DB_NAME.lower():
        sys.exit(
            f"refusing to run: DB_NAME={DB_NAME!r} does not contain 'preview'"
        )
    # Production lives on Atlas (mongodb+srv://). The preview Mongo is a
    # plain mongodb:// host on Railway's private network.
    if MONGO_URL.startswith("mongodb+srv://"):
        sys.exit(
            "refusing to run: MONGO_URL points at an Atlas cluster "
            "(mongodb+srv://), which is where production lives"
        )
    if not MONGO_URL:
        sys.exit("refusing to run: MONGO_URL is not set")


async def fetch(client: httpx.AsyncClient, path: str, **params):
    r = await client.get(f"{PROD_API}{path}", params=params, timeout=60.0)
    r.raise_for_status()
    return r.json()


def synthesize_provider(index: int) -> dict:
    """A neutral stand-in for a real provider.

    Named unmistakably so nobody looking at the preview mistakes it for a
    real business, and trialing far into the future so the gig stays
    visible without needing a subscription record.
    """
    uid = f"preview-provider-{index}"
    return {
        "_id": uid,
        "user_id": uid,
        "name": f"Preview Provider {index}",
        "tagline": "Demo listing — not a real business",
        "avatar": None,
        "languages": ["English", "Hebrew"],
        "subscription_status": "active",
        "trial_ends_at": (datetime.now(UTC) + timedelta(days=3650)).isoformat(),
        "created_at": datetime.now(UTC).isoformat(),
    }


async def main() -> None:
    guard()
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    async with httpx.AsyncClient() as http:
        properties = await fetch(http, "/properties", limit=500)
        gigs = await fetch(http, "/marketplace/gigs", limit=200)

    print(f"fetched {len(properties)} properties, {len(gigs)} gigs from {PROD_API}")

    # Wipe only the two content collections. Anything else in the preview
    # DB (an account someone made while clicking around) is left alone.
    await db.properties.delete_many({})
    await db.marketplace_gigs.delete_many({})
    await db.marketplace_providers.delete_many({})

    if properties:
        for p in properties:
            p["_id"] = p.pop("id")
        await db.properties.insert_many(properties)

    # One synthetic provider per distinct real provider, so the spread of
    # gigs across providers still looks natural.
    provider_map: dict[str, dict] = {}
    for g in gigs:
        real_id = g.get("provider_user_id") or (g.get("provider") or {}).get("user_id")
        if real_id not in provider_map:
            provider_map[real_id] = synthesize_provider(len(provider_map) + 1)
        fake = provider_map[real_id]

        g["_id"] = g.pop("id")
        g["provider_user_id"] = fake["user_id"]
        g["provider_id"] = fake["_id"]
        g["provider"] = {
            "user_id": fake["user_id"],
            "name": fake["name"],
            "tagline": fake["tagline"],
            "avatar": None,
            "languages": fake["languages"],
            "member_since_year": datetime.now(UTC).year,
            "response_bucket": g.get("provider", {}).get("response_bucket"),
        }
        # Personal contact detail — never copied.
        g.pop("whatsapp", None)
        # WhatsApp-mode gigs would render a contact button with no number
        # behind it; in-platform keeps the preview's buttons honest.
        g["booking_mode"] = "in_platform"

    if gigs:
        await db.marketplace_gigs.insert_many(gigs)
    if provider_map:
        await db.marketplace_providers.insert_many(list(provider_map.values()))

    print(
        f"seeded: {len(properties)} properties, {len(gigs)} gigs, "
        f"{len(provider_map)} synthetic providers into {DB_NAME}"
    )
    # Prove the personal fields really are gone rather than assuming it.
    leaked = await db.marketplace_gigs.count_documents({"whatsapp": {"$exists": True}})
    real_ids = await db.marketplace_gigs.count_documents(
        {"provider_user_id": {"$not": {"$regex": "^preview-provider-"}}}
    )
    print(f"verify: gigs still carrying whatsapp = {leaked} (want 0)")
    print(f"verify: gigs with a non-synthetic provider id = {real_ids} (want 0)")
    if leaked or real_ids:
        sys.exit("SEED FAILED VERIFICATION — personal data present")


if __name__ == "__main__":
    asyncio.run(main())
