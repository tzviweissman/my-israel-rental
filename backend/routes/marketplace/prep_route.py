"""The kitchen's prep list and the day's delivery route (Tzvi, 19 Oct 2026;
from Toast and bakery software, and from Shopify Local Delivery / Onfleet).

PREP LIST: everything to make for one day, added up across that day's
orders: "Friday: 42 challah, 12 honey cakes". Optionally split by pickup or
delivery time, so the 9:00 orders are ready before the 11:00 ones. Orders
typed in as free text have no product lines to add up, so they are listed
under the totals with their own words. Cancelled and failed orders do not
count.

ROUTE: the day's open deliveries in a sensible driving order. Earlier
delivery times first; within a time, the shortest drive (straight-line
distance, starting from the business's city, or from where the driver is
when the page sends it). Each stop has a Waze button, and the whole route
opens in Google Maps in parts of ten (Google's limit). Addresses are found
with the site's free street-map lookup (utils/geocode, cached) and kept on
the order, so a route is looked up once. A stop whose address cannot be
found is kept, at the end of its time, with Waze searching the address.

Who: the owner, or staff with the "orders" area.
"""
from __future__ import annotations

import math
import re
from typing import Any, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException

from routes.deps import db, verify_token

from .orders import _owned_business

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MAX_LOOKUPS = 30   # new addresses looked up per request (the lookup is ~1 a second)


def _day(date: str) -> str:
    if not DATE_RE.match(date or ""):
        raise HTTPException(status_code=400, detail="Pick a date")
    return date


def _time_of(o: dict[str, Any]) -> str:
    nb = str(o.get("needed_by") or "")
    return (o.get("window") or {}).get("start") or (nb[11:16] if "T" in nb else "")


async def _orders_for(business_id: str, date: str, extra: Optional[dict] = None) -> list[dict[str, Any]]:
    q = {"business_id": business_id, "needed_by": {"$gte": date, "$lte": date + "T23:59"},
         "status": {"$nin": ["cancelled", "failed"]}, **(extra or {})}
    return [o async for o in db.store_orders.find(q).sort("needed_by", 1)]


# ---------------------------------------------------------------- prep list

def _add(totals: dict[str, int], lines: list[dict[str, Any]]) -> None:
    for ln in lines:
        name = str(ln.get("name") or "").strip()
        if name:
            totals[name] = totals.get(name, 0) + int(ln.get("qty") or 0)


def _rows(totals: dict[str, int]) -> list[dict[str, Any]]:
    return [{"name": k, "qty": v} for k, v in sorted(totals.items(), key=lambda kv: (-kv[1], kv[0].lower()))]


@router.get("/businesses/{business_id}/prep")
async def prep_list(business_id: str, date: str, user=Depends(verify_token)):
    await _owned_business(business_id, user)
    orders = await _orders_for(business_id, _day(date))
    totals: dict[str, int] = {}
    by_time: dict[str, dict[str, int]] = {}
    typed = []
    for o in orders:
        if o.get("source") == "counter":
            continue   # sold over the counter: already made and gone
        if o.get("lines"):
            _add(totals, o["lines"])
            _add(by_time.setdefault(_time_of(o), {}), o["lines"])
        elif str(o.get("items") or "").strip():
            typed.append({"customer_name": o.get("customer_name") or "", "items": o.get("items"), "time": _time_of(o)})
    return {
        "date": date,
        "orders": sum(1 for o in orders if o.get("source") != "counter"),
        "totals": _rows(totals),
        "by_time": [{"time": k, "totals": _rows(v)} for k, v in sorted(by_time.items(), key=lambda kv: (kv[0] == "", kv[0]))],
        "typed": typed,
    }


# ---------------------------------------------------------------- route

def _km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lng1, lat2, lng2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def _pt(s: dict[str, Any]) -> tuple[float, float]:
    return (s["geo"]["lat"], s["geo"]["lng"])


def _length(start: tuple[float, float], path: list[dict[str, Any]]) -> float:
    total, here = 0.0, start
    for s in path:
        total += _km(here, _pt(s))
        here = _pt(s)
    return total


def _shortest(start: tuple[float, float], stops: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The shortest order through `stops` from `start` (an open path: no
    return). Nearest-next to begin, then 2-opt: reverse any stretch that
    makes the whole drive shorter, until nothing does. Exact for the handful
    of stops a courier has in one time window; close for more."""
    left, path, here = list(stops), [], start
    while left:
        nxt = min(left, key=lambda s: _km(here, _pt(s)))
        left.remove(nxt)
        path.append(nxt)
        here = _pt(nxt)
    improved = True
    while improved and len(path) > 2:
        improved = False
        best = _length(start, path)
        for i in range(len(path) - 1):
            for j in range(i + 1, len(path)):
                cand = path[:i] + path[i:j + 1][::-1] + path[j + 1:]
                if _length(start, cand) < best - 1e-9:
                    path, best, improved = cand, _length(start, cand), True
    return path


def order_stops(stops: list[dict[str, Any]], start: tuple[float, float]) -> list[dict[str, Any]]:
    """Earlier times first; within a time, the shortest drive (_shortest),
    continuing from where the previous time's last stop ended. Stops whose
    address was not found keep their time and go last in it. Pure, for tests."""
    groups: dict[str, list[dict[str, Any]]] = {}
    for s in stops:
        groups.setdefault(s.get("time") or "", []).append(s)
    out: list[dict[str, Any]] = []
    here = start
    for key in sorted(groups, key=lambda k: (k == "", k)):
        path = _shortest(here, [s for s in groups[key] if s.get("geo")])
        out.extend(path)
        if path:
            here = _pt(path[-1])
        out.extend(s for s in groups[key] if not s.get("geo"))
    return out


def waze_link(stop: dict[str, Any]) -> str:
    g = stop.get("geo")
    if g:
        return f"https://waze.com/ul?ll={g['lat']},{g['lng']}&navigate=yes"
    return f"https://waze.com/ul?q={quote(stop.get('address') or '')}&navigate=yes"


def google_routes(stops: list[dict[str, Any]], size: int = 10) -> list[str]:
    """Google Maps directions from where the phone is, in parts of `size`."""
    out = []
    for i in range(0, len(stops), size):
        part = stops[i:i + size]
        where = [f"{s['geo']['lat']},{s['geo']['lng']}" if s.get("geo") else (s.get("address") or "") for s in part]
        url = f"https://www.google.com/maps/dir/?api=1&travelmode=driving&destination={quote(where[-1])}"
        if len(where) > 1:
            url += "&waypoints=" + quote("|".join(where[:-1]))
        out.append(url)
    return out


async def _geo(order: dict[str, Any], budget: list[int]) -> Optional[dict[str, float]]:
    if order.get("geo") is not None:
        return order["geo"] or None
    if budget[0] <= 0 or not (order.get("address") or "").strip():
        return None
    budget[0] -= 1
    from utils.geocode import geocode_address
    found = await geocode_address(order["address"])
    geo = {"lat": found[0], "lng": found[1]} if found else {}
    await db.store_orders.update_one({"_id": order["_id"]}, {"$set": {"geo": geo}})
    return geo or None


@router.get("/businesses/{business_id}/route")
async def delivery_route(business_id: str, date: str, from_lat: Optional[float] = None, from_lng: Optional[float] = None,
                         user=Depends(verify_token)):
    biz = await _owned_business(business_id, user)
    orders = await _orders_for(business_id, _day(date), {"fulfilment": "delivery", "status": {"$nin": ["cancelled", "failed", "done"]}})
    budget = [MAX_LOOKUPS]
    stops = []
    for o in orders:
        stops.append({"id": o["_id"], "customer_name": o.get("customer_name") or "", "address": o.get("address") or "",
                      "time": _time_of(o), "window": o.get("window"), "status": o.get("status"),
                      "items": o.get("items") or "", "geo": await _geo(o, budget)})
    if from_lat is not None and from_lng is not None:
        start = (from_lat, from_lng)
    else:
        from .shabbat import _city
        _slug, lat, lng = _city(biz)
        start = (lat, lng)
    ordered = order_stops(stops, start)
    for s in ordered:
        s["waze"] = waze_link(s)
    return {"date": date, "stops": ordered, "google": google_routes(ordered),
            "not_found": sum(1 for s in ordered if not s.get("geo"))}
