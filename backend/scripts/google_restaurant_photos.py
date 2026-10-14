"""Google photos for listed restaurants still without one (Tzvi, 14 Oct 2026).
One Text Search each (id, name, location, photos; Pro SKU), biased to the
place's pin; accepted only if Google's result is within 300 m, then Claude
confirms the names are the same business. The place ID and the photo name go
to the live site; Google's name is used to match only, never stored.

Run it early in a month: Text Search Pro has 5,000 free calls a month and
~3,600 places need one each (Tzvi chose to wait for 1 November 2026 so the
lookup costs nothing). The cache (google_photos_cache.json beside this file)
means a rerun never pays twice for a place.

    cd backend && .venv/Scripts/python -m scripts.google_restaurant_photos [--dry] [--max N]"""
import sys, os, json, re, asyncio
from math import cos, radians, hypot
HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
sys.path.insert(0, BACKEND)
from dotenv import load_dotenv
load_dotenv(os.path.join(BACKEND, '.env'))
import httpx
from anthropic import AsyncAnthropic
from utils.restaurant_places import CITY_HE

API = "https://myisraelrental.com/api"
DRY = '--dry' in sys.argv
MAX = int(sys.argv[sys.argv.index('--max') + 1]) if '--max' in sys.argv else 4500
KEY = os.environ["GOOGLE_PLACES_API_KEY"]
FIELDS = "places.id,places.displayName,places.location,places.photos"
CACHE = os.path.join(HERE, 'google_photos_cache.json')
MAX_METRES = 300


def metres(a, b):
    return hypot((a[1] - b[1]) * 111320 * cos(radians(a[0])), (a[0] - b[0]) * 110540)


async def main():
    rows = []
    async with httpx.AsyncClient(timeout=60) as h:
        for page in range(1, 80):
            it = []
            for attempt in range(4):
                try:
                    d = (await h.get(f"{API}/restaurants", params={"limit": 100, "page": page})).json()
                    it = next(v for v in d.values() if isinstance(v, list))
                    break
                except Exception:
                    await asyncio.sleep(10)
            rows += it
            if len(it) < 100:
                break
    todo = [x for x in rows if not x.get('photo') and x.get('lat')][:MAX]
    print(len(rows), 'listed;', len(todo), 'without a photo and with a pin', flush=True)
    cache = json.load(open(CACHE, encoding='utf8')) if os.path.exists(CACHE) else {}
    calls = 0
    sem = asyncio.Semaphore(6)
    async with httpx.AsyncClient(timeout=30) as g:
        async def look(x):
            nonlocal calls
            if x['id'] in cache:
                return
            name = x.get('name_he') or x.get('name_en')
            body = {"textQuery": f"{name} {CITY_HE.get(x['city'], x['city'])}", "regionCode": "IL", "pageSize": 1,
                    "locationBias": {"circle": {"center": {"latitude": x['lat'], "longitude": x['lng']}, "radius": 200}}}
            async with sem:
                for attempt in range(4):
                    try:
                        r = await g.post("https://places.googleapis.com/v1/places:searchText", json=body,
                                         headers={"X-Goog-Api-Key": KEY, "X-Goog-FieldMask": FIELDS})
                        calls += 1
                        if r.status_code == 200:
                            break
                        if r.status_code not in (429, 500, 503):
                            print('google', r.status_code, r.text[:200], flush=True)
                            return
                    except httpx.HTTPError:
                        pass
                    await asyncio.sleep(2 ** attempt)
                else:
                    return
            p = (r.json().get("places") or [None])[0]
            if not p or not p.get("photos") or not p.get("location"):
                cache[x['id']] = None
                return
            dist = metres((x['lat'], x['lng']), (p['location']['latitude'], p['location']['longitude']))
            ph = p['photos'][0]
            cache[x['id']] = {"gid": p['id'], "gname": (p.get('displayName') or {}).get('text'), "dist": round(dist),
                              "photo": ph['name'], "author": ((ph.get('authorAttributions') or [{}])[0]).get('displayName')}
        for i in range(0, len(todo), 300):
            await asyncio.gather(*(look(x) for x in todo[i:i + 300]))
            json.dump(cache, open(CACHE, 'w', encoding='utf8'), ensure_ascii=False)
            print(f'  {min(i + 300, len(todo))}/{len(todo)} looked up, {calls} Google calls', flush=True)
    cands = [(x, cache[x['id']]) for x in todo if cache.get(x['id']) and cache[x['id']]['dist'] <= MAX_METRES]
    print(len(cands), f'Google results within {MAX_METRES} m', flush=True)
    client = AsyncAnthropic()
    ok_ids = set()
    for i in range(0, len(cands), 150):
        chunk = cands[i:i + 150]
        lines = "\n".join(f"P{i + k}: ours = {x.get('name_en') or ''} / {x.get('name_he') or ''} | google = {c['gname']}" for k, (x, c) in enumerate(chunk))
        prompt = ("For each line, is Google's place the SAME business as ours (same brand/name; language and spelling may differ, "
                  "branch suffixes are fine)? A different business nearby is NO.\nJSON only: {\"P0\": true, \"P1\": false, ...}\n\n" + lines)
        for attempt in range(3):
            try:
                txt = ""
                async with client.messages.stream(model="claude-sonnet-5-5", max_tokens=8000, messages=[{"role": "user", "content": prompt}]) as st:
                    async for t in st.text_stream:
                        txt += t
                for k, v in json.loads(re.search(r'\{.*\}', txt, re.S).group(0)).items():
                    if v is True:
                        ok_ids.add(cands[int(k[1:])][0]['id'])
                break
            except Exception as e:
                print('retry', type(e).__name__, flush=True)
    keep = [(x, c) for x, c in cands if x['id'] in ok_ids]
    print(len(keep), 'confirmed the same business', flush=True)
    if DRY:
        for x, c in keep[:15]:
            print('  ', x.get('name_en'), '/', x.get('name_he'), '=', c['gname'], c['dist'], 'm')
        return
    done = 0
    async with httpx.AsyncClient(timeout=60, headers={"X-Restaurant-Admin-Token": os.environ["RESTAURANT_ADMIN_TOKEN"]}) as c:
        s2 = asyncio.Semaphore(8)

        async def push(x, g):
            nonlocal done
            async with s2:
                for attempt in range(4):
                    try:
                        r = await c.patch(f"{API}/admin/restaurants/{x['id']}", json={
                            "google_place_id": g['gid'], "google_photo_name": g['photo'], "google_photo_author": g['author'] or ""})
                        if r.status_code == 200:
                            done += 1
                            return
                    except httpx.HTTPError:
                        pass
                    await asyncio.sleep(5)
        await asyncio.gather(*(push(x, g) for x, g in keep))
    print('updated', done)

asyncio.run(main())
