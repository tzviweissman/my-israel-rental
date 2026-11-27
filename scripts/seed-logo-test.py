"""Give the local test owner (dev-owner@local.test, `?as=owner`) what the
logo-on-card features need: a logo on its first business, and one listing
with no photos, so the card's logo fallback and the editor's "Use my logo as
the card picture" switch can be tested in a minute (27 Nov 2026: a third of
that test went on setting this up by hand).

Local test data only: refuses to run unless MONGO_URL is localhost. Safe to
re-run; the test listing has the fixed id `logo-test-listing`.

    backend/.venv/Scripts/python scripts/seed-logo-test.py          seed
    backend/.venv/Scripts/python scripts/seed-logo-test.py --clean  remove

Open http://localhost:<port>/services?as=owner (the card) and
/dashboard?tab=my-businesses&as=owner (the editor's switch).
"""
import sys
from datetime import datetime, timezone
from pathlib import Path

from pymongo import MongoClient

ROOT = Path(__file__).resolve().parents[1]
env = dict(line.split("=", 1) for line in (ROOT / "backend" / ".env").read_text(encoding="utf-8").splitlines()
           if "=" in line and not line.startswith("#"))
url = env["MONGO_URL"].strip()
if not url.startswith(("mongodb://127.0.0.1", "mongodb://localhost")):
    sys.exit("MONGO_URL is not local; refusing to write.")
db = MongoClient(url)[env["DB_NAME"].strip().strip('"')]

LOGO = "https://myisraelrental.com/brand-logo.png"  # our own logo, never a client's
GIG_ID = "logo-test-listing"

user = db.users.find_one({"email": "dev-owner@local.test"})
if not user:
    sys.exit("No local test owner yet: open any local page with ?as=owner once, then run this again.")
# The business of one of the owner's OWN published listings: a local business
# can hold listings of other test accounts, which the owner's editor never shows.
base = db.marketplace_gigs.find_one({"provider_user_id": user["id"], "status": "published",
                                     "business_id": {"$ne": None}, "_id": {"$ne": GIG_ID}}, sort=[("created_at", 1)])
if not base:
    sys.exit("The local test owner has no published listing to copy; add one with ?as=owner first.")
biz = db.businesses.find_one({"_id": base["business_id"]})
if not biz:
    sys.exit("That listing's business is missing.")

if "--clean" in sys.argv:
    db.marketplace_gigs.delete_one({"_id": GIG_ID})
    if biz.get("logo_url") == LOGO:
        db.businesses.update_one({"_id": biz["_id"]}, {"$set": {"logo_url": None}})
    print("removed")
    sys.exit()

if not biz.get("logo_url"):
    db.businesses.update_one({"_id": biz["_id"]}, {"$set": {"logo_url": LOGO}})

# A copy of that listing, so every field the board and editor read is there,
# with every photo taken out.
now = datetime.now(timezone.utc).isoformat()
gig = {**base, "_id": GIG_ID, "id": GIG_ID, "title": "Logo test listing (no photos)", "title_he": "שירות לבדיקת לוגו (בלי תמונות)",
       "title_en": None, "gallery": [], "logo_cover": False, "created_at": now, "updated_at": now,
       "products": [{**p, "image": None, "images": []} for p in base.get("products") or []],
       "tiers": [{**t, "images": []} for t in base.get("tiers") or []]}
db.marketplace_gigs.replace_one({"_id": GIG_ID}, gig, upsert=True)
print(f"{biz['name']}: logo {'kept' if biz.get('logo_url') else 'set'}, listing '{GIG_ID}' has no photos")
