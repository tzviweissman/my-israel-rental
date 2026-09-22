"""Give existing businesses the description and service area their owners
already wrote on their listings.

Sign-up asks for both on the SERVICE; the business page checklist then asked
for them again on the BUSINESS (Tzvi, 22 Sep 2026). New sign-ups are filled
at creation (shared.fill_business_from_listing). This does the same for
businesses that signed up before: from their oldest published listing,
only where the business has none, never overwriting what an owner set.

Dry run by default. Prints counts and business names, never contact details.

    python -m scripts.backfill_business_from_listings          # dry run
    python -m scripts.backfill_business_from_listings --apply
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from routes.deps import db  # noqa: E402
from routes.marketplace.shared import areas_from_text, normalize_service_areas  # noqa: E402


async def main(apply: bool) -> None:
    print(f"database: {db.name} | {'APPLYING' if apply else 'dry run'}")
    desc = areas = 0
    async for biz in db.businesses.find({}, {"name": 1, "description": 1, "areas": 1, "serves_nationwide": 1}):
        need_desc = not (biz.get("description") or "").strip()
        need_areas = not biz.get("areas") and not biz.get("serves_nationwide")
        if not (need_desc or need_areas):
            continue
        gigs = await db.marketplace_gigs.find(
            {"business_id": biz["_id"], "status": "published"},
            {"description": 1, "description_he": 1, "area": 1},
        ).sort("created_at", 1).to_list(50)
        if not gigs:
            continue
        patch: dict = {}
        if need_desc:
            first = next((g for g in gigs if (g.get("description") or "").strip()), None)
            if first:
                patch["description"] = first["description"]
                if first.get("description_he"):
                    patch["description_he"] = first["description_he"]
        if need_areas:
            texts = [g.get("area") or "" for g in gigs]
            found = normalize_service_areas(texts) or areas_from_text(texts)
            if found:
                patch["areas"] = found
        if not patch:
            continue
        desc += "description" in patch
        areas += "areas" in patch
        print(f"  {(biz.get('name') or '')[:40]:42} " + ", ".join(
            f"areas={patch['areas']}" if k == "areas" else k for k in patch if k != "description_he"))
        if apply:
            await db.businesses.update_one({"_id": biz["_id"]}, {"$set": patch})
    print(f"descriptions filled: {desc} | service areas filled: {areas} | {'written' if apply else 'nothing written'}")


asyncio.run(main("--apply" in sys.argv))
