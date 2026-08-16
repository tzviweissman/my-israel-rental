"""OpenStreetMap Nominatim forward geocoder for marketplace gigs.

Nominatim's Terms of Use require:
  • A descriptive `User-Agent` — no anonymous bots.
  • Absolute max 1 request per second.
  • Caching whenever possible to reduce load on the shared servers.

We honour all three: every request goes out with our contact email in
the UA, the module holds an asyncio.Lock+timestamp gate so concurrent
callers can't burst past 1 rps, and every result lands in
`db.geocode_cache` so identical queries never re-hit Nominatim.

Public surface: ``geocode_area(area_text)`` — returns ``(lat, lng)`` or
``None`` if the query didn't resolve. Silent on network / rate errors
so callers can fall back gracefully to city-center coords.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Optional

import httpx

from routes.deps import db

logger = logging.getLogger(__name__)

# Nominatim ToS: max 1 req/sec. We add a tiny margin.
_MIN_REQUEST_INTERVAL_SEC = 1.1
_last_request_ts = 0.0
_rate_lock = asyncio.Lock()

# Descriptive UA per ToS. `support@` is a real inbox monitored by the
# team — Nominatim admins occasionally reach out about high-volume users.
_USER_AGENT = "MyIsraelRental/1.0 (support@myisraelrental.com)"
_NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


async def _cached_lookup(query: str) -> Optional[tuple[float, float]]:
    """Return cached (lat, lng) for a normalized query, if we've asked
    Nominatim about this exact string before. Cache is permanent — city
    boundaries don't move. Callers pass an already-normalized query."""
    doc = await db.geocode_cache.find_one({"_id": query}, {"_id": 0, "lat": 1, "lng": 1, "miss": 1})
    if not doc:
        return None
    # Cached miss — don't re-hit Nominatim for a query that already didn't resolve.
    if doc.get("miss"):
        return None
    lat = doc.get("lat")
    lng = doc.get("lng")
    if isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
        return (float(lat), float(lng))
    return None


async def _cache_hit(query: str, coords: tuple[float, float]) -> None:
    await db.geocode_cache.update_one(
        {"_id": query},
        {"$set": {"lat": coords[0], "lng": coords[1], "miss": False}},
        upsert=True,
    )


async def _cache_miss(query: str) -> None:
    # Store misses too so a repeated bad query (typo, obscure area) doesn't
    # keep hitting the network.
    await db.geocode_cache.update_one(
        {"_id": query},
        {"$set": {"miss": True}},
        upsert=True,
    )


def _normalize(area_text: str) -> str:
    """Collapse whitespace + lowercase so 'Tel Aviv , Florentin' and
    'tel aviv, florentin' hit the same cache row.

    Two input shapes flow through here:
      1. Area labels like "Jerusalem - Rehavia" — split on `-` and
         REVERSE so the neighborhood leads (crucial for Nominatim; see
         the American Colony → Tel Aviv bug in the git history).
      2. Full street addresses like "20 Rothschild Blvd, Tel Aviv" —
         these already have the most-specific token first (the street),
         so keeping the original order works.

    We detect (2) by checking if the first token starts with a digit.
    """
    text = (area_text or "").replace(" - ", ", ").replace(" – ", ", ")
    parts = [p.strip() for p in text.split(",") if p.strip()]
    if not parts:
        return ""
    # Address-shaped input keeps its order.
    if parts[0] and parts[0][0].isdigit():
        return ", ".join(parts).lower()
    # Area-shaped input gets reversed so the neighborhood leads.
    return ", ".join(reversed(parts)).lower()


async def geocode_area(area_text: str) -> Optional[tuple[float, float]]:
    """Forward-geocode a free-text service area to (lat, lng).

    Always appends ", Israel" to the query so a US "Bethesda" doesn't
    swipe pins away from Bet Shemesh. Returns None on any failure —
    callers should just skip storing coords and fall back to the
    city-center lookup that already ships on the frontend.
    """
    query = _normalize(area_text)
    if not query:
        return None

    cached = await _cached_lookup(query)
    if cached:
        return cached
    # Cached miss: `_cached_lookup` returns None whether it's an unseen
    # query or a stored miss. Distinguish by re-checking the raw doc.
    miss_doc = await db.geocode_cache.find_one({"_id": query}, {"_id": 0, "miss": 1})
    if miss_doc and miss_doc.get("miss"):
        return None

    # Rate-limit — Nominatim TOS is strict. Serialize via a lock so
    # even concurrent gig creates can't burst.
    global _last_request_ts
    async with _rate_lock:
        elapsed = time.monotonic() - _last_request_ts
        if elapsed < _MIN_REQUEST_INTERVAL_SEC:
            await asyncio.sleep(_MIN_REQUEST_INTERVAL_SEC - elapsed)
        _last_request_ts = time.monotonic()

    params = {
        # Nominatim's free-form parser handles space-joined queries far
        # better than comma-joined ones for our dataset:
        #   "American Colony Jerusalem Israel"  → correct Jerusalem pin
        #   "American Colony, Jerusalem, Israel" → often hits Tel Aviv
        # The `countrycodes=il` filter is a defence-in-depth; we still
        # occasionally see the parser prefer a US result when an Israeli
        # neighborhood name shadows a more famous foreign one.
        "q": query.replace(",", " ") + " Israel",
        "format": "json",
        "limit": 1,
        "countrycodes": "il",
    }
    headers = {"User-Agent": _USER_AGENT, "Accept-Language": "en"}
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.get(_NOMINATIM_URL, params=params, headers=headers)
            if r.status_code != 200:
                logger.warning("Nominatim %s for %s: %s", r.status_code, query, r.text[:200])
                return None
            data = r.json()
    except Exception as e:  # noqa: BLE001
        logger.warning("Nominatim network error for %s: %s", query, e)
        return None

    if not data:
        await _cache_miss(query)
        return None

    try:
        lat = float(data[0]["lat"])
        lng = float(data[0]["lon"])
    except (KeyError, ValueError, TypeError):
        await _cache_miss(query)
        return None

    await _cache_hit(query, (lat, lng))
    logger.info("Nominatim resolved %r → (%.4f, %.4f)", area_text, lat, lng)
    return (lat, lng)


async def suggest_areas(query_text: str, limit: int = 5) -> list[dict]:
    """Return up to ``limit`` typeahead suggestions for a partial
    free-text query.

    Strategy:
      1. **Curated fuzzy match** against ~150 well-known Israeli
         cities / neighborhoods / landmarks — instant, no network,
         typo-tolerant ("rehavya" → Rehavia). Ships with the app so
         works even when Nominatim is throttled or offline.
      2. **Nominatim fallback** if the curated set doesn't hit ≥3
         results — catches street-level queries the curated list can't
         cover ("20 Rothschild Blvd", "Emek Refaim").

    Each suggestion is a light dict:
        {"label": "Rehavia", "sublabel": "Jerusalem",
         "lat": 31.775, "lng": 35.212, "type": "curated"|"osm"}
    """
    q = (query_text or "").strip()
    if not q or len(q) < 2:
        return []

    # Step 1: local curated suggestions (typo-tolerant).
    from utils.israeli_locations import fuzzy_suggest
    curated = fuzzy_suggest(q, limit=limit)
    if len(curated) >= 3:
        return curated

    # Step 2: Nominatim fallback for the rare miss. We cache the full
    # suggestion set so repeat typing patterns don't re-hit the wire.
    query = _normalize(q)
    if not query:
        return curated
    cache_id = f"suggest::{query}::{limit}"
    doc = await db.geocode_cache.find_one({"_id": cache_id}, {"_id": 0, "results": 1})
    if doc and isinstance(doc.get("results"), list):
        # Merge curated + cached OSM, deduping on (lat, lng) rounded to
        # 4 decimals so we don't show the same neighborhood twice.
        return _merge_suggestions(curated, doc["results"], limit)

    global _last_request_ts
    async with _rate_lock:
        elapsed = time.monotonic() - _last_request_ts
        if elapsed < _MIN_REQUEST_INTERVAL_SEC:
            await asyncio.sleep(_MIN_REQUEST_INTERVAL_SEC - elapsed)
        _last_request_ts = time.monotonic()

    params = {
        "q": query.replace(",", " ") + " Israel",
        "format": "json",
        # Fetch a few extras so the POI-boost pass below has room to
        # reorder — the client still only sees `limit` in the end.
        "limit": max(3, min(limit * 2, 12)),
        "countrycodes": "il",
        "addressdetails": 1,
    }
    headers = {"User-Agent": _USER_AGENT, "Accept-Language": "en"}
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.get(_NOMINATIM_URL, params=params, headers=headers)
            if r.status_code != 200:
                return curated
            data = r.json() or []
    except Exception as e:  # noqa: BLE001
        logger.warning("Nominatim suggest network error for %r: %s", query, e)
        return curated

    osm_results: list[dict] = []
    for row in data:
        try:
            lat = float(row["lat"])
            lng = float(row["lon"])
        except (KeyError, ValueError, TypeError):
            continue
        addr = row.get("address") or {}
        cls = (row.get("class") or "").lower()
        typ = (row.get("type") or "").lower()

        # POI vs. area: Nominatim tags concrete places (hotels, malls,
        # museums, restaurants, universities, hospitals, parks) with a
        # non-`place`/`boundary` class. For those the interesting label
        # is the POI's own name — NOT the neighbourhood it sits in.
        # That's the fix for "Waldorf Astoria → Nahalat Shiva" — the
        # earlier extractor threw away the hotel name because it
        # preferred the geographic parent.
        is_poi = cls in {
            "tourism", "amenity", "shop", "historic", "leisure",
            "building", "office", "man_made", "railway", "aeroway", "sport",
        }

        # First `display_name` segment is almost always the human-friendly
        # POI or place label (in English when `Accept-Language: en` is set).
        display_first = (row.get("display_name") or "").split(",")[0].strip()

        if is_poi:
            primary = row.get("name") or display_first
            # Parent line for POIs: neighborhood + city, deduped.
            parent_bits = [
                addr.get("neighbourhood") or addr.get("suburb") or addr.get("quarter") or "",
                addr.get("city") or addr.get("town") or addr.get("village") or "",
            ]
        else:
            primary = (
                addr.get("neighbourhood")
                or addr.get("suburb")
                or addr.get("quarter")
                or addr.get("city")
                or addr.get("town")
                or addr.get("village")
                or addr.get("road")
                or row.get("name")
                or display_first
            )
            parent_bits = [
                addr.get("city") or addr.get("town") or addr.get("village") or "",
                addr.get("county") or addr.get("state") or "",
            ]

        # Dedup parent: drop bits that equal the primary label or are
        # empty. Prevents "Rehavia · Rehavia · Jerusalem District".
        parent = ", ".join(
            b for b in parent_bits if b and b.strip() and b != primary
        )
        osm_results.append({
            "label": primary,
            "sublabel": parent or (row.get("display_name") or "").split(",", 1)[-1].strip(),
            "lat": lat,
            "lng": lng,
            "type": typ or cls,
            # Internal ranking hint — POIs (hotels, malls, museums,
            # markets) get pushed above generic neighborhoods, since a
            # user typing "waldorf" or "mahane yehuda" is almost always
            # looking for the specific place, not the surrounding area.
            "_boost": 2 if is_poi else 0,
        })

    # Re-rank so real places (hotels/POIs) surface above vague
    # neighborhood/area matches — Nominatim's default `importance`
    # score doesn't do this consistently for Israeli data. Stable
    # sort preserves the original order among ties.
    osm_results.sort(key=lambda r: -r.pop("_boost", 0))

    await db.geocode_cache.update_one(
        {"_id": cache_id},
        {"$set": {"results": osm_results}},
        upsert=True,
    )
    return _merge_suggestions(curated, osm_results, limit)


def _merge_suggestions(curated: list[dict], osm: list[dict], limit: int) -> list[dict]:
    """Interleave curated + OSM rows, deduplicating on both rounded
    coords AND normalized label so we don't show the same place twice
    under a slightly different spelling. Curated rows always keep
    their position — Nominatim rows only fill the remaining slots."""
    out = list(curated)
    seen_coords = {(round(r["lat"], 3), round(r["lng"], 3)) for r in out}
    seen_labels = {r["label"].strip().lower() for r in out}
    for r in osm:
        key_coords = (round(r["lat"], 3), round(r["lng"], 3))
        key_label = r["label"].strip().lower()
        if key_coords in seen_coords or key_label in seen_labels:
            continue
        seen_coords.add(key_coords)
        seen_labels.add(key_label)
        out.append(r)
        if len(out) >= limit:
            break
    return out[:limit]


async def geocode_gig_area_bg(gig_id: str, area_text: str) -> None:
    """Fire-and-forget helper: forward-geocode `area_text` and stamp
    `lat`/`lng` (or `lat=None, lng=None, geocode_miss=True`) on the gig
    doc when done. Intended to be launched via `asyncio.create_task`
    from the create/patch handlers so the API response stays snappy —
    Nominatim's 1s rate limit shouldn't gate the user's UX.
    """
    try:
        coords = await geocode_area(area_text)
        patch: dict = {"geocoded_at": time.time()}
        if coords:
            patch["lat"] = coords[0]
            patch["lng"] = coords[1]
            patch["geocode_miss"] = False
        else:
            patch["geocode_miss"] = True
            patch["lat"] = None
            patch["lng"] = None
        await db.marketplace_gigs.update_one({"_id": gig_id}, {"$set": patch})
    except Exception as e:  # noqa: BLE001
        logger.error("geocode_gig_area_bg(%s) failed: %s", gig_id, e)


async def geocode_area_into(collection_name: str, doc_id: str, area_text: str) -> None:
    """Generic version of the above: geocode `area_text` and stamp the
    result onto any collection's document.

    Added for the Requests board, which needed exactly what gigs already
    had. Rather than a third near-identical copy, this takes the collection
    by name; `geocode_gig_area_bg` stays as it is because it is called from
    two places and its name is what those call sites read like.

    Fire-and-forget, same as the gig helper: Nominatim's 1-per-second limit
    must never sit between a user and their POST response.
    """
    try:
        coords = await geocode_area(area_text)
        patch: dict = {"geocoded_at": time.time()}
        if coords:
            patch["lat"], patch["lng"] = coords[0], coords[1]
            patch["geocode_miss"] = False
        else:
            # An explicit miss, not a silent absence. Without this flag a
            # never-geocoded document and an ungeocodable one look
            # identical, and a backfill would retry the impossible ones
            # every time it ran.
            patch["geocode_miss"] = True
            patch["lat"] = None
            patch["lng"] = None
        await db[collection_name].update_one({"_id": doc_id}, {"$set": patch})
    except Exception as e:  # noqa: BLE001
        logger.error("geocode_area_into(%s, %s) failed: %s", collection_name, doc_id, e)


async def geocode_property_bg(
    property_id: str,
    address: Optional[str],
    area: Optional[str],
) -> None:
    """Fire-and-forget helper: forward-geocode a property's address +
    area combo and stamp `lat`/`lng` on the doc. Street address gives
    us building-level precision on the Stays map (~10-20 m), a huge
    step up from area-centroid pins.

    Query string is built defensively so a property with only `area`
    still resolves to city-center — better than skipping the geocode
    entirely and leaving the pin off the map.
    """
    parts = [p.strip() for p in [address, area] if p and p.strip()]
    query = ", ".join(parts) if parts else ""
    if not query:
        return
    try:
        coords = await geocode_area(query)
        patch: dict = {"geocoded_at": time.time()}
        if coords:
            patch["lat"] = coords[0]
            patch["lng"] = coords[1]
            patch["geocode_miss"] = False
        else:
            # If the full address didn't resolve (bad street name,
            # typos, etc.) fall back to area-only so we at least
            # pin the property on the correct city on the map.
            fallback_coords = None
            if area and area.strip():
                fallback_coords = await geocode_area(area)
            if fallback_coords:
                patch["lat"] = fallback_coords[0]
                patch["lng"] = fallback_coords[1]
                patch["geocode_miss"] = False
                patch["geocode_fallback"] = "area_only"
            else:
                patch["geocode_miss"] = True
                patch["lat"] = None
                patch["lng"] = None
        await db.properties.update_one({"id": property_id}, {"$set": patch})
    except Exception as e:  # noqa: BLE001
        logger.error("geocode_property_bg(%s) failed: %s", property_id, e)
