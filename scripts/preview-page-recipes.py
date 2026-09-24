"""Seed the page-recipe samples into the LOCAL database, one business per
(sample, recipe, language), each with its recipe's composition as its page.

Local test data only: refuses to run unless MONGO_URL is localhost, and
writes nothing through the API, so no listing triggers a paid translation.
Every document it writes has an id starting `rp-`, and a re-run replaces
them. Then `node scripts/shot-page-recipes.mjs` screenshots them.

    backend/.venv/Scripts/python scripts/preview-page-recipes.py          seed
    backend/.venv/Scripts/python scripts/preview-page-recipes.py --clean  remove
"""
from __future__ import annotations

import json
import sys
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "backend"), str(ROOT / "backend" / "tests")]

from pymongo import MongoClient  # noqa: E402

from test_page_recipes import FIVE, SAMPLES  # noqa: E402
from utils.page_recipes import RECIPES, fill  # noqa: E402
from utils.page_rules import check_composition  # noqa: E402

env = dict(line.split("=", 1) for line in (ROOT / "backend" / ".env").read_text(encoding="utf-8").splitlines()
           if "=" in line and not line.startswith("#"))
url = env["MONGO_URL"].strip()
if not url.startswith(("mongodb://127.0.0.1", "mongodb://localhost")):
    sys.exit("MONGO_URL is not local; refusing to write.")
db = MongoClient(url)[env["DB_NAME"].strip()]

# Cloudinary's public demo images: placeholders for "their own photos" on
# local test pages only. Never on a real page.
DEMO = "https://res.cloudinary.com/demo/image/upload/"
PHOTOS = {
    "kosher-food": ["samples/food/dessert.jpg", "samples/food/spices.jpg", "samples/breakfast.jpg",
                    "samples/food/fish-vegetables.jpg"],
    "brand-new": ["samples/landscapes/nature-mountains.jpg", "samples/landscapes/girl-urban-view.jpg"],
    "hebrew-only": ["samples/food/dessert.jpg", "samples/breakfast.jpg", "samples/cup-on-a-table.jpg",
                    "samples/coffee.jpg"],
    "twenty-five-services": ["samples/people/kitchen-bar.jpg", "samples/landscapes/architecture-signs.jpg",
                             "sample.jpg", "samples/cup-on-a-table.jpg", "samples/coffee.jpg"],
}


def clean():
    db.businesses.delete_many({"_id": {"$regex": "^rp-"}})
    db.marketplace_gigs.delete_many({"_id": {"$regex": "^rp-"}})


def with_photos(key: str, sample: dict, prefix: str) -> dict:
    """The sample with real ids and loadable images."""
    b = deepcopy(sample)
    pool = [DEMO + p for p in PHOTOS.get(key, ["sample.jpg"])]
    pick = iter((pool[1:] or pool) * 20)   # listing photos differ from the cover
    if b.get("cover_url"):
        b["cover_url"] = pool[0]
    for g in b["listings"]:
        g["id"] = f"{prefix}-{g['id']}"
        g["gallery"] = [next(pick) for _ in g.get("gallery") or []]
        for item in (g.get("tiers") or []) + (g.get("products") or []):
            if item.get("images"):
                item["images"] = [next(pick)]
    return b


def seed():
    clean()
    now = datetime.now(timezone.utc).isoformat()
    manifest = []
    for key in FIVE:
        for recipe in RECIPES:
            for lang in ("en", "he"):
                bid = f"rp-{key}-{recipe}-{lang}"
                b = with_photos(key, SAMPLES[key], bid)
                out = fill(b, lang, name=recipe)
                shown_lang = lang
                if out["composition"] is None:
                    # A Hebrew-only business has no English page to make: an
                    # English reader sees its Hebrew one.
                    out = fill(b, "he", name=recipe)
                    shown_lang = "he"
                comp = out["composition"]
                check = check_composition(b, comp, shown_lang)
                assert check["passed"], (bid, check["fix_first"])
                db.businesses.insert_one({
                    "_id": bid, "slug": bid, "active": True, "owner_user_id": "rp-owner",
                    "name": b["name"], "name_he": b["name_he"], "description": b["description"],
                    "description_he": b.get("description_he"), "areas": b["areas"],
                    "categories": [b["listings"][0]["category"]], "cover_url": b.get("cover_url"),
                    "logo_url": None, "verified": b.get("verified", False), "hours": b.get("hours"),
                    "languages": b.get("languages"), "founded_year": b.get("founded_year"),
                    "license_number": b.get("license_number"), "kosher_certification": b.get("kosher_certification"),
                    "accent": "stone", "page": comp, "page_brief": b["page_brief"],
                    "created_at": b.get("created_at") or "2024-03-01T00:00:00+00:00", "updated_at": now,
                })
                for i, g in enumerate(b["listings"]):
                    db.marketplace_gigs.insert_one({
                        "_id": g["id"], "business_id": bid, "status": "published", "provider_user_id": "rp-owner",
                        "title": g["title"], "title_he": g.get("title_he"), "title_en": g.get("title_en"),
                        "description": b["description"], "description_he": b.get("description_he"),
                        "category": g["category"], "gig_type": g["gig_type"], "area": g["area"],
                        "booking_mode": "in_platform", "gallery": g.get("gallery") or [],
                        "tiers": g.get("tiers") or [], "products": g.get("products") or [],
                        # Newest first on the page: keep the sample's order.
                        "created_at": f"2024-03-01T00:{59 - i:02d}:00+00:00", "updated_at": now,
                    })
                manifest.append({"slug": bid, "sample": key, "recipe": recipe, "lang": lang, "page_lang": shown_lang,
                                 "blocks": [x["type"] for x in comp["blocks"]], "theme": comp["theme"],
                                 "title": comp["blocks"][0]["props"]["title"],
                                 "accent": comp["blocks"][0]["props"]["accent_word"]})
    out = ROOT / "screenshots" / "recipes"
    out.mkdir(parents=True, exist_ok=True)
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(manifest)} pages seeded; manifest at {out / 'manifest.json'}")


if __name__ == "__main__":
    clean() if "--clean" in sys.argv else seed()
