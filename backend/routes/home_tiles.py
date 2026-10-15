"""Tiles for the home page's opening (frontend components/home/HomeOpening.jsx).

The opening's wall shows real stays and businesses, picked by eye so no
flyer, logo or collage appears (Tzvi, 15 Oct 2026). The picks are ids; this
route answers with only the ones still listed, each with its photo as it is
now. A deleted, hidden or unpublished listing, or one whose photos are gone,
simply drops out, and the wall repeats what is left (Tzvi: "fix the tiles
issue so if one is deleted it wont ruin it").
"""
import time

from fastapi import APIRouter, Response

from routes.deps import db

router = APIRouter()

# Picked by eye from the live lists on 15 Oct 2026. To change the wall,
# change these lists; order is the order they appear, middle outward.
STAY_IDS = [
    '1e6e5556-2b9e-4e9d-8e80-ded392120341', 'b688847b-522a-4315-b5b0-783de8cd8d78', '78e59268-ce46-400b-bf2d-ed61013e5427',
    '77150134-c17f-4e8c-8b08-8294b1d067d9', 'dcc51cf5-4833-42e9-a9f3-1d530ae51718', 'd62c74e5-dd54-46ef-a9e5-5880d81facd5',
    'c62eb1e3-8845-4479-b086-887f48cd96d2', 'ce2afb0f-5f4f-4554-b185-8afaeb739d02', '4e1abd31-5021-463a-9ec5-f28fcf8b1b96',
    '8c7b8250-7e2e-44c5-8867-4fc7a78198a1', 'ebac5064-b2c2-4659-ba9b-37062a2f054f', '6ec62d21-43c3-482b-be15-cfe77fb6acbe',
    '69ab85dd-c8e8-4604-997b-2738326889e5', 'b99b85d8-7904-4603-bf69-8c0d6eea9f4e', '4bcd9562-e374-42f1-88d2-7dea4c45b800',
    'd63cafe9-12ad-4cd2-8d92-a069fac85abf', '0ddb87d0-6c98-4eba-aca8-7927421097c1', '0db8f9c9-da43-4735-848e-8224192bd0a9',
    'c0fee175-7c68-487b-b5d7-b3ff13e3719f', '3e3ae7db-047d-4111-9a39-a1763dde4b0a', '1d35ad5d-61a0-4a0a-bbe9-87bd7a2fab8b',
]
GIG_IDS = [
    'd574d800-2e8a-41ce-ae28-f6f03fd6329a', '4db9f8d5-038f-4b83-b0a4-f1adf988aa26', '134c5414-87d5-4d11-b15c-6167b6442648',
    '0b43754c-bde0-4478-8b08-14fa247db8c9', 'e1dfd0c5-4fe9-4106-8ad7-a05d8adea75e', 'a6e275b1-b11f-4825-a69e-a693b0edd216',
    'bc8dbf82-b2f9-46cc-b529-cecf83f8f5a4', '5885df8d-7bd6-43d9-af01-273ec2108a0b', '75512153-f18d-47b4-9daf-ffbed495089a',
    'd2bb8764-1a8c-45be-8d3b-70e5298f7f2a', '637d78ae-abc0-432d-9506-2a739e320f5e', 'f9a07e26-1da3-44e7-b351-004cfc116219',
]

_VIDEO = ('.mp4', '.mov', '.webm', '.m4v')
_CACHE: dict = {"at": 0.0, "data": None}
_TTL = 300


def _is_photo(u) -> bool:
    return isinstance(u, str) and u.startswith('http') and not u.lower().split('?')[0].endswith(_VIDEO)


def stay_photo(p: dict):
    return next((u for u in p.get('images') or [] if _is_photo(u)), None)


def gig_photo(g: dict):
    """Same order as the frontend's getGigCover: gallery, products, tiers."""
    for u in g.get('gallery') or []:
        if _is_photo(u):
            return u
    for pr in g.get('products') or []:
        for u in (pr.get('images') or []) + [pr.get('image')]:
            if _is_photo(u):
                return u
    for t in g.get('tiers') or []:
        for u in t.get('images') or []:
            if _is_photo(u):
                return u
    return None


def build(props: list[dict], gigs: list[dict]) -> dict:
    """Keep the picked order; drop anything missing or without a photo."""
    by_p = {p['id']: p for p in props}
    # gigs are keyed by _id in the database; the public API calls it id
    by_g = {g.get('id') or g.get('_id'): g for g in gigs}
    stays = []
    for i in STAY_IDS:
        p = by_p.get(i)
        src = p and stay_photo(p)
        if src:
            area = (p.get('area') or '').split(' - ')[-1].strip()
            stays.append({'kind': 'img', 'src': src, 'label': area, 'href': f'/property/{i}'})
    businesses = []
    for i in GIG_IDS:
        g = by_g.get(i)
        src = g and gig_photo(g)
        if src:
            businesses.append({'kind': 'img', 'src': src, 'label': g.get('title') or '',
                               'label_he': g.get('title_he') or None, 'href': f'/businesses/{i}'})
    return {'stays': stays, 'businesses': businesses}


@router.get("/home/opening-tiles")
async def opening_tiles(response: Response) -> dict:
    now = time.time()
    if _CACHE["data"] is None or now - _CACHE["at"] > _TTL:
        props = await db.properties.find(
            {'id': {'$in': STAY_IDS}, 'is_hidden': {'$ne': True}},
            {'_id': 0, 'id': 1, 'images': 1, 'area': 1}).to_list(len(STAY_IDS))
        gigs = await db.marketplace_gigs.find(
            {'_id': {'$in': GIG_IDS}, 'status': 'published'},
            {'_id': 1, 'title': 1, 'title_he': 1, 'gallery': 1, 'products': 1, 'tiers': 1}).to_list(len(GIG_IDS))
        _CACHE["data"] = build(props, gigs)
        _CACHE["at"] = now
    response.headers["Cache-Control"] = "public, max-age=60"
    return _CACHE["data"]
