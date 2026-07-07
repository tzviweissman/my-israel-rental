"""Public geocoding endpoint used by the Stays map "search by address"
input.

We deliberately don't proxy Nominatim byte-for-byte — the endpoint sits
behind our own rate limit + cache in `utils/geocode.py`, so a burst of
renter typing can't get us throttled or IP-banned by OSM.
"""
from fastapi import APIRouter, Query

from utils.geocode import geocode_area, suggest_areas

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


@api_router.get("/geocode/suggest")
async def geocode_suggest(
    q: str = Query(..., min_length=2, max_length=140),
    limit: int = Query(5, ge=1, le=8),
):
    """Google-Maps-style autocomplete suggestions for the Stays +
    Services address inputs. Returns a list — never a 404 — so the
    client can just render an empty state when no matches turn up
    without a special error path.

    Response shape (each row):
        {"label": str, "sublabel": str, "lat": float, "lng": float, "type": str}
    """
    return {"query": q, "results": await suggest_areas(q.strip(), limit=limit)}
