"""Find kosher restaurants across Israel with Google Places (New) Text Search.

    python -m scripts.import_kosher_restaurants --city Jerusalem --dry-run
    python -m scripts.import_kosher_restaurants --city Jerusalem
    python -m scripts.import_kosher_restaurants            # every city
    python -m scripts.import_kosher_restaurants --refresh-stale

WHAT IS STORED, AND WHY SO LITTLE (Tzvi, 8 Oct 2026). Google's terms let us
keep a place ID forever and a place's coordinates for up to 30 days; they do
not let us build our own copy of Google's names, addresses, phones or
websites. So a `restaurants` document holds the place ID, where we found it
(city, neighbourhood, region, categories), the coordinates with the date they
were fetched, and OUR kosher facts (meat/dairy/pareve, certificate, verified).
Names and contact details are fetched from Google when a page shows them.
`--refresh-stale` re-fetches coordinates older than 27 days and drops any it
cannot refresh, which is what keeps us inside the 30.

Nothing here is a kosher claim. A Google result for "kosher pizza" is a
candidate: it starts `verified: False`, with no certificate and no
meat/dairy, and the page says "Needs verification" until an admin or the
owner confirms it.

Cost: the field mask asks for id, location, displayName and primaryType,
which bills as Text Search Pro (5,000 free calls a month, then paid).
`displayName` is fetched for the run report only and never written.
`--max-requests` stops a run before it can surprise anyone; Jerusalem alone
is about 300 searches.

Resume: every finished (city, neighbourhood, category) search is recorded in
`restaurant_import_progress`; a rerun skips those. `--fresh` ignores them.

The key is GOOGLE_PLACES_API_KEY in backend/.env, never printed.
"""
import argparse
import asyncio
import os
import sys
from collections import Counter
from datetime import UTC, datetime, timedelta

import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routes.deps import db  # noqa: E402

SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
DETAILS_URL = "https://places.googleapis.com/v1/places/{}"
FIELDS = "places.id,places.location,places.displayName,places.primaryType,nextPageToken"
MAX_PAGES = 3          # Text Search stops at 60 results (3 pages of 20)
PAUSE = 0.25           # seconds between calls
LOCATION_DAYS = 27     # refresh before Google's 30-day limit

# What people search for, and the words Google is given for it.
CATEGORIES = {
    "pizza": "pizza",
    "burgers": "burgers",
    "meat_grill": "meat grill restaurant",
    "sushi_asian": "sushi asian restaurant",
    "cafe": "cafe",
    "bakery": "bakery",
    "dairy_italian": "dairy italian restaurant",
    "dessert": "dessert ice cream",
    "shawarma_falafel": "shawarma falafel",
    "hummus": "hummus",
    "deli": "deli",
    "breakfast": "israeli breakfast",
    "fish": "fish seafood restaurant",
    "steakhouse": "steakhouse",
}

# Big cities are searched per neighbourhood as well, because one search
# stops at 60 results and Jerusalem has far more than 60 kosher cafes.
NEIGHBOURHOODS = {
    "Jerusalem": ["City Center", "Mahane Yehuda", "German Colony", "Baka", "Talpiot", "Rehavia",
                  "Geula", "Mea Shearim", "Ramot", "Har Nof", "Givat Shaul", "Ramat Eshkol",
                  "Pisgat Zeev", "Kiryat Yovel", "Malha", "Old City", "Katamon", "French Hill",
                  "Gilo", "Mamilla"],
    "Tel Aviv-Yafo": ["Old North", "Florentin", "Neve Tzedek", "Jaffa", "Ramat Aviv", "Sarona",
                      "Dizengoff", "Rothschild", "Kerem HaTeimanim", "Tel Aviv Port", "Bavli",
                      "Yad Eliyahu"],
    "Haifa": ["Carmel Center", "Downtown Haifa", "German Colony", "Hadar", "Neve Shaanan", "Ahuza",
              "Bat Galim", "Kiryat Haim"],
    "Beit Shemesh": ["Ramat Beit Shemesh Aleph", "Ramat Beit Shemesh Bet", "Ramat Beit Shemesh Gimmel",
                     "Old Beit Shemesh", "Nofei Aviv", "Mishkafayim"],
    "Bnei Brak": ["Rabbi Akiva Street", "Kiryat Herzog", "Pardes Katz", "Ramat Elchanan", "Vizhnitz"],
}

# Every city, with its region. Order is the run order.
CITIES = {
    "Jerusalem": "Jerusalem", "Tel Aviv-Yafo": "Tel Aviv", "Haifa": "Haifa",
    "Beit Shemesh": "Jerusalem", "Ramat Gan": "Tel Aviv", "Bnei Brak": "Tel Aviv",
    "Petah Tikva": "Center", "Netanya": "Center", "Ashdod": "South", "Ashkelon": "South",
    "Rishon LeZion": "Center", "Holon": "Tel Aviv", "Bat Yam": "Tel Aviv", "Rehovot": "Center",
    "Modiin": "Center", "Modiin Illit": "Judea & Samaria", "Beitar Illit": "Judea & Samaria",
    "Efrat": "Judea & Samaria", "Ma'ale Adumim": "Judea & Samaria", "Kfar Saba": "Center",
    "Ra'anana": "Center", "Herzliya": "Tel Aviv", "Hod HaSharon": "Center", "Givatayim": "Tel Aviv",
    "Kiryat Ono": "Tel Aviv", "Lod": "Center", "Ramla": "Center", "Be'er Sheva": "South",
    "Eilat": "South", "Tiberias": "North", "Tzfat": "North", "Kiryat Gat": "South",
    "Kiryat Shmona": "North", "Afula": "North", "Nof HaGalil": "North", "Karmiel": "North",
    "Akko": "North", "Nahariya": "North", "Hadera": "Haifa", "Zichron Yaakov": "Haifa",
    "Caesarea": "Haifa", "Arad": "South", "Dimona": "South", "Yeruham": "South",
    "Mitzpe Ramon": "South", "Elad": "Center", "Ariel": "Judea & Samaria",
    "Kiryat Arba": "Judea & Samaria", "Hebron": "Judea & Samaria", "Katzrin": "North",
    "Dead Sea": "South",
}


def searches(cities):
    """Every (city, neighbourhood or None, category) search, in run order."""
    for city in cities:
        for hood in [None] + NEIGHBOURHOODS.get(city, []):
            for cat in CATEGORIES:
                yield city, hood, cat


def progress_key(city, hood, cat):
    return f"{city}|{hood or ''}|{cat}"


def query_text(city, hood, cat):
    where = f"{hood}, {city}" if hood else city
    return f"kosher {CATEGORIES[cat]} in {where}, Israel"


class Budget(Exception):
    pass


class Places:
    """Thin client; counts calls and refuses to pass the budget."""

    def __init__(self, key, max_requests):
        self.key, self.max, self.calls = key, max_requests, 0
        self.http = httpx.AsyncClient(timeout=30)

    async def _post(self, url, body, fields, method="POST"):
        if self.calls >= self.max:
            raise Budget()
        headers = {"X-Goog-Api-Key": self.key, "X-Goog-FieldMask": fields}
        for attempt in range(5):
            self.calls += 1
            r = await (self.http.post(url, json=body, headers=headers) if method == "POST"
                       else self.http.get(url, headers=headers))
            await asyncio.sleep(PAUSE)
            if r.status_code == 429 or r.status_code >= 500:
                await asyncio.sleep(2 ** attempt)
                continue
            if r.status_code != 200:
                # The body names the problem (key not enabled, billing off);
                # it never contains the key itself.
                raise RuntimeError(f"Google said {r.status_code}: {r.text[:300]}")
            return r.json()
        raise RuntimeError("Google kept refusing (rate limit); try again later")

    async def search(self, text):
        body, token = {"textQuery": text, "regionCode": "IL", "languageCode": "en", "pageSize": 20}, None
        for _ in range(MAX_PAGES):
            if token:
                body["pageToken"] = token
            data = await self._post(SEARCH_URL, body, FIELDS)
            for p in data.get("places", []):
                yield p
            token = data.get("nextPageToken")
            if not token:
                return

    async def location(self, place_id):
        data = await self._post(DETAILS_URL.format(place_id), None, "location", method="GET")
        return data.get("location")


async def ensure_indexes():
    await db.restaurants.create_index("place_id", unique=True)
    await db.restaurants.create_index([("location", "2dsphere")])
    await db.restaurants.create_index([("city", 1), ("neighborhood", 1)])
    await db.restaurants.create_index("verified")


async def save(place, city, hood, cat, now):
    """Insert or update one place. Returns True when it is new."""
    loc = place.get("location") or {}
    point = ({"type": "Point", "coordinates": [loc["longitude"], loc["latitude"]]}
             if "latitude" in loc and "longitude" in loc else None)
    res = await db.restaurants.update_one(
        {"place_id": place["id"]},
        {
            "$setOnInsert": {
                "place_id": place["id"], "source": "google",
                # Where it was first found. A later neighbourhood search
                # finding it again does not move it.
                "city": city, "neighborhood": hood, "region": CITIES[city],
                "kashrut": None,                # meat | dairy | pareve, set by a person
                "kosher_certification": None,   # set by a person
                "verified": False,
                "status": "listed",
                "first_seen_at": now,
            },
            "$addToSet": {"categories": cat},
            "$set": {"location": point, "location_fetched_at": now if point else None, "last_synced_at": now},
        },
        upsert=True,
    )
    return res.upserted_id is not None


async def run_import(client, cities, fresh, dry_run):
    todo = list(searches(cities))
    done = set() if fresh else {d["_id"] async for d in db.restaurant_import_progress.find({}, {"_id": 1})}
    left = [s for s in todo if progress_key(*s) not in done]
    print(f"{len(todo)} searches for {', '.join(cities)}; {len(todo) - len(left)} already done, {len(left)} to run")
    if dry_run:
        for s in left[:8]:
            print("  would search:", query_text(*s))
        print(f"  at most {len(left) * MAX_PAGES} calls, usually about {len(left) * 1.4:.0f}")
        print("\ndry run: nothing searched, nothing written")
        return
    await ensure_indexes()
    now = lambda: datetime.now(UTC).isoformat()
    new_total, seen_total, by_cat, names = 0, 0, Counter(), {}
    last_city = None
    try:
        for city, hood, cat in left:
            if city != last_city:
                print(f"\n== {city} ({CITIES[city]})")
                last_city = city
            found = new = 0
            async for p in client.search(query_text(city, hood, cat)):
                found += 1
                if await save(p, city, hood, cat, now()):
                    new += 1
                    by_cat[cat] += 1
                    names[p["id"]] = ((p.get("displayName") or {}).get("text", "?"), hood or city, cat)
            seen_total += found
            new_total += new
            await db.restaurant_import_progress.update_one(
                {"_id": progress_key(city, hood, cat)}, {"$set": {"done_at": now(), "found": found, "new": new}}, upsert=True)
            print(f"  {(hood or 'whole city')[:26]:<26} {cat:<17} {found:>3} found, {new:>3} new   (calls {client.calls})")
    except Budget:
        print(f"\nStopped at the budget of {client.max} calls; rerun to continue where it stopped.")
    print(f"\n{new_total} new places from {seen_total} results, {client.calls} calls to Google")
    for cat, n in by_cat.most_common():
        print(f"  {cat:<17} {n}")
    # Names are shown here so the run can be checked by eye, and not stored.
    print("\nA sample of what was found (names from Google, not saved):")
    for pid, (name, where, cat) in list(names.items())[:40]:
        print(f"  {name[:40]:<40} {where[:22]:<22} {cat}")


async def refresh_stale(client):
    cutoff = (datetime.now(UTC) - timedelta(days=LOCATION_DAYS)).isoformat()
    stale = await db.restaurants.find(
        {"location_fetched_at": {"$lt": cutoff}}, {"place_id": 1}).to_list(None)
    print(f"{len(stale)} place(s) with coordinates older than {LOCATION_DAYS} days")
    fixed = dropped = 0
    for d in stale:
        try:
            loc = await client.location(d["place_id"])
        except Budget:
            break
        except RuntimeError:
            loc = None
        now = datetime.now(UTC).isoformat()
        if loc:
            await db.restaurants.update_one({"_id": d["_id"]}, {"$set": {
                "location": {"type": "Point", "coordinates": [loc["longitude"], loc["latitude"]]},
                "location_fetched_at": now, "last_synced_at": now}})
            fixed += 1
        else:
            # Past 30 days we may not keep it; no map pin is better than a breach.
            await db.restaurants.update_one({"_id": d["_id"]}, {"$set": {"location": None, "location_fetched_at": None}})
            dropped += 1
    print(f"refreshed {fixed}, dropped {dropped}, {client.calls} calls")


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", action="append", help="run only this city (repeatable)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--fresh", action="store_true", help="ignore the record of finished searches")
    ap.add_argument("--max-requests", type=int, default=1000)
    ap.add_argument("--refresh-stale", action="store_true")
    a = ap.parse_args()

    cities = a.city or list(CITIES)
    unknown = [c for c in cities if c not in CITIES]
    if unknown:
        sys.exit(f"Unknown city: {', '.join(unknown)}. Known: {', '.join(CITIES)}")
    mongo = os.environ.get("MONGO_URL", "")
    if not mongo:
        sys.exit("MONGO_URL is not set; refusing to guess which database this is.")
    print("database:", "LOCAL" if ("localhost" in mongo or "127.0.0.1" in mongo) else "REMOTE (production?)",
          "|", os.environ.get("DB_NAME", "?"))
    if a.dry_run and not a.refresh_stale:
        await run_import(None, cities, a.fresh, True)
        return
    key = os.environ.get("GOOGLE_PLACES_API_KEY", "")
    if not key:
        sys.exit("GOOGLE_PLACES_API_KEY is not set in backend/.env.")
    client = Places(key, a.max_requests)
    try:
        if a.refresh_stale:
            await refresh_stale(client)
        else:
            await run_import(client, cities, a.fresh, False)
    finally:
        await client.http.aclose()


if __name__ == "__main__":
    asyncio.run(main())
