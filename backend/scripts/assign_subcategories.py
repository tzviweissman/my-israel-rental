"""Give the live shops, caterers and beauty listings a subcategory, so /businesses can sort them into rows and
chips (Tzvi, 20 Nov 2026). Reads every listing in the three categories, guesses its subcategory from its title,
business name and description, and prints the list.

    backend/.venv/Scripts/python backend/scripts/assign_subcategories.py            # dry run: prints only
    backend/.venv/Scripts/python backend/scripts/assign_subcategories.py --apply    # writes the printed list

Never overwrites a subcategory a listing already has. --apply writes to whatever MONGO_URL points at, so check
that first; on production it needs Tzvi's yes on the dry-run list.
"""
import os
import re
import sys

from dotenv import load_dotenv
from pymongo import MongoClient

if "--live" in sys.argv:  # the production database, read from Railway like scripts/live-overview.py (run where the CLI is linked)
    import shutil
    import subprocess
    # shutil.which finds railway.cmd on Windows; shell=True with a list runs only "railway" on Mac and Linux (code review 20 Nov 2026).
    _kv = subprocess.run([shutil.which("railway") or "railway", "variables", "--service", "my-israel-rental Backend", "--kv"], capture_output=True, text=True).stdout
    for _k in ("MONGO_URL", "DB_NAME"):
        os.environ[_k] = next((ln.split("=", 1)[1] for ln in _kv.splitlines() if ln.startswith(_k + "=")), "")
        if not os.environ[_k]:
            sys.exit(f"could not read {_k} from Railway (is the railway CLI linked here?)")
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

RULES = {  # first match wins, on title + business name + start of description, lower case
    "shops-products": [
        (r"sourdough|babka|bun intended|cinnamon|cake|cookie|doughnut|bake", "bakery"),
        (r"bagel|pizza dough|\bdips?\b|spread", "pantry"),
        (r"coffee|whipped", "coffee-drinks"),
        (r"meatboard|meat board|chicken board|krysp|platter|boards", "boards-platters"),
        (r"acai|brown box|meal|shabbos|cholent", "meals"),
        (r"mezuz|simanim|judaica", "judaica"),
        (r"engrav|laser|גלויה|personali", "personalised"),
        (r"\btoys?\b", "toys"),
        (r"gift", "gift-boxes"),
        (r"jewel", "jewelry"),
        (r"activewear|clothing|dress", "clothing"),
        (r"wig|hair", "hair-wigs"),
        (r"bandana|accessor", "accessories"),
    ],
    "events-catering": [
        (r"balloon|בלונ", "balloons-decor"),
        (r"kumzits|music|guitar|band|dj", "music-entertainment"),
        (r"cake|cookie|dessert|doughnut|bake|treat", "cakes-desserts"),
        (r"cater|cholent|chicken|platter|seudos|aioli|meal", "catering"),
    ],
    "home-services-repair": [
        (r"kasher", "kashering"),
        (r"paint|spackle", "painting"),
        (r"plumb", "plumbing"),
        (r"handyman|helpers", "handyman"),
    ],
    "personal-care": [
        (r"makeup|make up", "makeup"),
        (r"nail", "nails"),
        (r"wig|hair|barber|wash and set|consultation", "hair"),
    ],
}


def main():
    apply = "--apply" in sys.argv
    url = os.environ["MONGO_URL"]
    host = re.sub(r"^.*@", "", url).split("/")[0].split("?")[0]
    db = MongoClient(url)[os.environ.get("DB_NAME", "test_database")]
    print(f"database: {host} / {db.name}{'  (WRITING)' if apply else '  (dry run)'}")
    plan, unsure = [], []
    for cat, rules in RULES.items():
        for g in db.marketplace_gigs.find({"category": cat, "status": "published"}, {"title": 1, "description": 1, "subcategory": 1, "provider_user_id": 1}):
            if g.get("subcategory"):
                continue
            prov = db.marketplace_providers.find_one({"user_id": g.get("provider_user_id")}, {"business_name": 1, "name": 1}) or {}
            text = " ".join([g.get("title") or "", prov.get("business_name") or prov.get("name") or "", (g.get("description") or "")[:120]]).lower()
            hit = next((s for rx, s in rules if re.search(rx, text)), None)
            (plan if hit else unsure).append((cat, hit or "", g["_id"], (g.get("title") or "")[:60]))
    for cat, s, _, title in sorted(plan):
        print(f"  {cat:16} -> {s:20} {title}")
    for cat, _, _, title in unsure:
        print(f"  {cat:16} -> ?{'':19} {title}  (left as it is)")
    print(f"{len(plan)} to set, {len(unsure)} left without one")
    if "--json" in sys.argv:  # {listing id: subcategory}, to preview the page with the list before it is written
        import json
        with open(sys.argv[sys.argv.index("--json") + 1], "w", encoding="utf-8") as f:
            json.dump({gid: s for _, s, gid, _ in plan}, f)
    if apply:
        for _, s, gid, _ in plan:
            db.marketplace_gigs.update_one({"_id": gid, "$or": [{"subcategory": None}, {"subcategory": ""}, {"subcategory": {"$exists": False}}]}, {"$set": {"subcategory": s}})
        print("written")


if __name__ == "__main__":
    main()
