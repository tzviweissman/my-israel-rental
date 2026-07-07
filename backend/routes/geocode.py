"""Public geocoding endpoint used by the Stays map "search by address"
input.

We deliberately don't proxy Nominatim byte-for-byte — the endpoint sits
behind our own rate limit + cache in `utils/geocode.py`, so a burst of
renter typing can't get us throttled or IP-banned by OSM.
"""
from fastapi import APIRouter, Query

from utils.geocode import geocode_area

router = APIRouter()
api_router = router


@api_router.get("/geocode/search")
async def geocode_search(q: str = Query(..., min_length=2, max_length=140)):
    """Forward-geocode a free-text address (or neighborhood) to a
    lat/lng pair the Stays map view can center on.

    Query is trimmed + capped to keep the Nominatim payload small.
    Returns ``{"lat": None, "lng": None}`` on a miss so the client
    can render a friendly "we couldn't find that address" state
    without special-casing 404 responses.
    """
    coords = await geocode_area(q.strip())
    if not coords:
        return {"lat": None, "lng": None, "query": q}
    return {"lat": coords[0], "lng": coords[1], "query": q}
