"""Load a restaurants file into the live site, or edit one place, with the
RESTAURANT_ADMIN_TOKEN from backend/.env (never printed).

    python -m scripts.push_restaurants import <file.json>
    python -m scripts.push_restaurants edit <place_id> '{"certification": "..."}'

The file is what export_restaurants.py writes ({"restaurants": [...]}); it is
sent in batches of 200 to /api/admin/restaurants/import.
"""
import json
import os
import sys

import httpx
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))
API = os.environ.get("LIVE_API_URL", "https://myisraelrental.com/api")


def main():
    token = os.environ.get("RESTAURANT_ADMIN_TOKEN", "")
    if len(token) < 32:
        sys.exit("RESTAURANT_ADMIN_TOKEN is not set in backend/.env")
    h = {"X-Restaurant-Admin-Token": token}
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    with httpx.Client(timeout=300, headers=h) as c:
        if cmd == "import":
            rows = json.load(open(sys.argv[2], encoding="utf8"))["restaurants"]
            total = {"new": 0, "updated": 0, "kept_edits": 0}
            for i in range(0, len(rows), 200):
                r = c.post(f"{API}/admin/restaurants/import", json={"restaurants": rows[i:i + 200]})
                r.raise_for_status()
                for k, v in r.json().items():
                    total[k] = total.get(k, 0) + v
            print(total)
        elif cmd == "edit":
            r = c.patch(f"{API}/admin/restaurants/{sys.argv[2]}", json=json.loads(sys.argv[3]))
            print(r.status_code, r.json().get("name_en") or r.json().get("name_he") or r.text[:200])
        else:
            sys.exit(__doc__)


if __name__ == "__main__":
    main()
