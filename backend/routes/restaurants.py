"""Kosher restaurant directory: public list, "Get listed" form, admin tools.

What a restaurant record holds and why is in scripts/import_kosher_restaurants.py
and scripts/check_kosher_websites.py. In short: Google gives us the place ID
and, for 30 days at a time, the map location; the name, phone, WhatsApp and
website come from the restaurant's OWN site (Tzvi, 8 Oct 2026), and the
hechsher is what that site names. `verified` means a person checked the
certificate; until then the page says the hechsher is "from their website".

Only `status: "listed"` places with a name are public. Hidden ones (no named
hechsher found) wait in the admin queue; "removed" is a soft delete.
"""
import re
import uuid
from datetime import UTC, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from routes.deps import db, verify_token
from utils.rate_limit import check_rate
from utils.restaurant_places import CATEGORIES, CITIES, CITY_HE, NEIGHBOURHOODS, REGIONS, SLUG_TO_CITY, city_slug

router = APIRouter(tags=["restaurants"])

KASHRUT = ("meat", "dairy", "pareve")
NAMED = {"$or": [{"contact.name_en": {"$nin": [None, ""]}}, {"contact.name_he": {"$nin": [None, ""]}}]}


def _now():
    return datetime.now(UTC).isoformat()


def _admin_only(payload: dict) -> None:
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


def _card(d, distance_km=None):
    c = d.get("contact") or {}
    loc = (d.get("location") or {}).get("coordinates")
    return {
        "id": d["place_id"],
        "name_en": c.get("name_en"), "name_he": c.get("name_he"),
        "categories": d.get("categories") or [],
        "kashrut": d.get("kashrut"),
        "certification": d.get("kosher_certification"),
        "verified": bool(d.get("verified")),
        "city": d.get("city"), "city_he": CITY_HE.get(d.get("city")), "city_slug": city_slug(d["city"]) if d.get("city") else None,
        "neighborhood": d.get("neighborhood"), "region": d.get("region"),
        "address": c.get("address"),
        "website": c.get("website"), "phone": c.get("phone"), "whatsapp": c.get("whatsapp"),
        "lat": loc[1] if loc else None, "lng": loc[0] if loc else None,
        "google_place": d.get("source") == "google",
        "distance_km": round(distance_km, 2) if distance_km is not None else None,
    }


def _filters(city, neighborhood, region, category, kashrut, certifier, q):
    f = {"status": "listed", **NAMED}
    if city:
        f["city"] = SLUG_TO_CITY.get(city, city)
    if neighborhood:
        f["neighborhood"] = neighborhood
    if region:
        f["region"] = region
    if category:
        f["categories"] = category
    if kashrut:
        f["kashrut"] = kashrut
    if certifier:
        f["kosher_certification"] = certifier
    if q:
        rx = {"$regex": re.escape(q.strip()[:60]), "$options": "i"}
        f = {"$and": [f, {"$or": [{"contact.name_en": rx}, {"contact.name_he": rx}]}]}
    return f


@router.get("/restaurants")
async def list_restaurants(
    city: Optional[str] = None, neighborhood: Optional[str] = None, region: Optional[str] = None,
    category: Optional[str] = None, kashrut: Optional[str] = None, certifier: Optional[str] = None,
    q: Optional[str] = None,
    lat: Optional[float] = Query(None, ge=-90, le=90), lng: Optional[float] = Query(None, ge=-180, le=180),
    page: int = Query(1, ge=1, le=500), limit: int = Query(24, ge=1, le=100),
):
    f = _filters(city, neighborhood, region, category, kashrut, certifier, q)
    total = await db.restaurants.count_documents(f)
    skip = (page - 1) * limit
    if lat is not None and lng is not None:
        # Nearest first. $geoNear must open the pipeline; places whose map
        # location has lapsed (30-day rule) simply drop out of this view.
        pipe = [{"$geoNear": {"near": {"type": "Point", "coordinates": [lng, lat]}, "distanceField": "_dist",
                              "query": f, "spherical": True}},
                {"$skip": skip}, {"$limit": limit}]
        docs = await db.restaurants.aggregate(pipe).to_list(limit)
        items = [_card(d, d["_dist"] / 1000) for d in docs]
    else:
        docs = await db.restaurants.find(f).sort([("verified", -1), ("contact.name_en", 1)]).skip(skip).limit(limit).to_list(limit)
        items = [_card(d) for d in docs]
    return {"items": items, "total": total, "page": page, "pages": (total + limit - 1) // limit}


@router.get("/restaurants/facets")
async def restaurant_facets(city: Optional[str] = None):
    """Counts for the filters: regions -> cities, the chosen city's
    neighbourhoods, categories, certifiers."""
    base = {"status": "listed", **NAMED}
    by_city = {r["_id"]: r["n"] async for r in db.restaurants.aggregate(
        [{"$match": base}, {"$group": {"_id": "$city", "n": {"$sum": 1}}}])}
    cities = [{"name": c, "name_he": CITY_HE.get(c), "slug": city_slug(c), "region": reg, "count": by_city.get(c, 0)}
              for c, reg in CITIES.items()]
    scope = dict(base)
    chosen = SLUG_TO_CITY.get(city, city) if city else None
    if chosen:
        scope["city"] = chosen

    async def count(field, unwind=False):
        pipe = [{"$match": scope}] + ([{"$unwind": f"${field}"}] if unwind else []) + [
            {"$group": {"_id": f"${field}", "n": {"$sum": 1}}}, {"$sort": {"n": -1}}]
        return [{"name": r["_id"], "count": r["n"]} async for r in db.restaurants.aggregate(pipe) if r["_id"]]

    hoods = await count("neighborhood") if chosen else []
    order = NEIGHBOURHOODS.get(chosen, [])
    hoods.sort(key=lambda h: order.index(h["name"]) if h["name"] in order else 99)
    return {
        "regions": REGIONS,
        "cities": cities,
        "city": chosen,
        "city_he": CITY_HE.get(chosen) if chosen else None,
        "neighborhoods": hoods,
        "categories": [{"key": k, "count": n} for k, n in
                       ((x["name"], x["count"]) for x in await count("categories", unwind=True)) if k in CATEGORIES],
        "certifiers": await count("kosher_certification"),
        "kashrut": await count("kashrut"),
        "total": await db.restaurants.count_documents(scope),
    }


# --------------------------------------------------------------- Get listed

class Submission(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    city: str = Field(..., min_length=2, max_length=60)
    address: str = Field("", max_length=200)
    phone: str = Field("", max_length=40)
    whatsapp: str = Field("", max_length=40)
    website: str = Field("", max_length=300)
    certification: str = Field(..., min_length=2, max_length=120)
    kashrut: Optional[str] = None
    contact_email: str = Field(..., min_length=5, max_length=200)
    note: str = Field("", max_length=1000)


@router.post("/restaurants/submissions")
async def submit_restaurant(body: Submission, request: Request):
    check_rate(request, bucket="restaurant-submission", limit=5, window_seconds=3600)
    if body.kashrut and body.kashrut not in KASHRUT:
        raise HTTPException(400, "Kashrut must be meat, dairy or pareve")
    if "@" not in body.contact_email:
        raise HTTPException(400, "Please give an email we can reach you at")
    doc = {"id": str(uuid.uuid4()), **body.model_dump(), "status": "pending", "created_at": _now()}
    await db.restaurant_submissions.insert_one(doc)
    return {"ok": True}


# --------------------------------------------------------------- admin

class AdminEdit(BaseModel):
    name_en: Optional[str] = None
    name_he: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    website: Optional[str] = None
    certification: Optional[str] = None
    kashrut: Optional[str] = None
    verified: Optional[bool] = None
    status: Optional[str] = None           # listed | hidden | removed
    city: Optional[str] = None
    neighborhood: Optional[str] = None
    categories: Optional[list[str]] = None


async def _apply(place_id, e: AdminEdit, payload):
    sets = {}
    for k in ("name_en", "name_he", "address", "phone", "whatsapp", "website"):
        v = getattr(e, k)
        if v is not None:
            sets[f"contact.{k}"] = v.strip() or None
    if any(f"contact.{k}" in sets for k in ("name_en", "name_he", "website")):
        sets["contact.needs_review"] = []          # a person has looked
    if e.certification is not None:
        sets["kosher_certification"] = e.certification.strip() or None
    if e.kashrut is not None:
        if e.kashrut and e.kashrut not in KASHRUT:
            raise HTTPException(400, "Kashrut must be meat, dairy or pareve")
        sets["kashrut"] = e.kashrut or None
    if e.verified is not None:
        sets["verified"] = e.verified
        sets["verified_at"] = _now() if e.verified else None
        sets["verified_by"] = payload.get("user_id") if e.verified else None
    if e.status is not None:
        if e.status not in ("listed", "hidden", "removed"):
            raise HTTPException(400, "Unknown status")
        sets["status"] = e.status
    if e.city is not None:
        if e.city not in CITIES:
            raise HTTPException(400, "Unknown city")
        sets["city"], sets["region"] = e.city, CITIES[e.city]
    if e.neighborhood is not None:
        sets["neighborhood"] = e.neighborhood or None
    if e.categories is not None:
        sets["categories"] = [c for c in e.categories if c in CATEGORIES]
    if not sets:
        raise HTTPException(400, "Nothing to change")
    sets["edited_at"] = _now()
    r = await db.restaurants.update_one({"place_id": place_id}, {"$set": sets})
    if not r.matched_count:
        raise HTTPException(404, "Restaurant not found")


@router.get("/admin/restaurants")
async def admin_list(payload: dict = Depends(verify_token), status: Optional[str] = "listed",
                     city: Optional[str] = None, verified: Optional[bool] = None, q: Optional[str] = None,
                     page: int = Query(1, ge=1), limit: int = Query(50, ge=1, le=200)):
    _admin_only(payload)
    f = {}
    if status:
        f["status"] = status
    if city:
        f["city"] = city
    if verified is not None:
        f["verified"] = verified
    if q:
        rx = {"$regex": re.escape(q[:60]), "$options": "i"}
        f["$or"] = [{"contact.name_en": rx}, {"contact.name_he": rx}, {"contact.website": rx}]
    total = await db.restaurants.count_documents(f)
    docs = await db.restaurants.find(f).sort([("city", 1), ("contact.name_en", 1)]).skip((page - 1) * limit).limit(limit).to_list(limit)
    items = [{**_card(d), "status": d.get("status"), "check": d.get("kosher_check"),
              "needs_review": (d.get("contact") or {}).get("needs_review") or []} for d in docs]
    return {"items": items, "total": total}


@router.get("/admin/restaurants/stats")
async def admin_stats(payload: dict = Depends(verify_token)):
    _admin_only(payload)
    rows = {}
    async for r in db.restaurants.aggregate([{"$group": {
            "_id": "$city",
            "listed": {"$sum": {"$cond": [{"$eq": ["$status", "listed"]}, 1, 0]}},
            "unverified": {"$sum": {"$cond": [{"$and": [{"$eq": ["$status", "listed"]}, {"$ne": ["$verified", True]}]}, 1, 0]}},
            "hidden": {"$sum": {"$cond": [{"$eq": ["$status", "hidden"]}, 1, 0]}}}}]):
        rows[r["_id"]] = r
    cities = [{"city": c, "region": CITIES[c], "listed": rows.get(c, {}).get("listed", 0),
               "unverified": rows.get(c, {}).get("unverified", 0), "hidden": rows.get(c, {}).get("hidden", 0)}
              for c in CITIES]
    return {
        "cities": cities,
        "listed": sum(x["listed"] for x in cities),
        "unverified": sum(x["unverified"] for x in cities),
        "hidden": sum(x["hidden"] for x in cities),
        "pending_submissions": await db.restaurant_submissions.count_documents({"status": "pending"}),
    }


@router.patch("/admin/restaurants/{place_id}")
async def admin_edit(place_id: str, body: AdminEdit, payload: dict = Depends(verify_token)):
    _admin_only(payload)
    await _apply(place_id, body, payload)
    d = await db.restaurants.find_one({"place_id": place_id})
    return _card(d)


class AdminNew(AdminEdit):
    name_en: Optional[str] = None
    city: str


@router.post("/admin/restaurants")
async def admin_add(body: AdminNew, payload: dict = Depends(verify_token)):
    """Add a restaurant by hand (not from Google): it gets our own ID."""
    _admin_only(payload)
    if body.city not in CITIES:
        raise HTTPException(400, "Unknown city")
    if not (body.name_en or body.name_he):
        raise HTTPException(400, "A name is needed")
    pid = f"mir-{uuid.uuid4().hex[:12]}"
    await db.restaurants.insert_one({
        "place_id": pid, "source": "admin", "city": body.city, "region": CITIES[body.city],
        "neighborhood": None, "categories": [], "kashrut": None, "kosher_certification": None,
        "verified": False, "status": "listed", "location": None, "contact": {}, "first_seen_at": _now()})
    await _apply(pid, body, payload)
    return _card(await db.restaurants.find_one({"place_id": pid}))


@router.get("/admin/restaurants/submissions")
async def admin_submissions(payload: dict = Depends(verify_token), status: str = "pending"):
    _admin_only(payload)
    return await db.restaurant_submissions.find({"status": status}, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.post("/admin/restaurants/submissions/{sub_id}/{decision}")
async def admin_decide(sub_id: str, decision: str, payload: dict = Depends(verify_token)):
    """approve: becomes a listed restaurant (unverified until someone checks
    the certificate). reject: kept, marked rejected."""
    _admin_only(payload)
    if decision not in ("approve", "reject"):
        raise HTTPException(400, "approve or reject")
    s = await db.restaurant_submissions.find_one({"id": sub_id, "status": "pending"})
    if not s:
        raise HTTPException(404, "No pending submission with that id")
    card = None
    if decision == "approve":
        city = s["city"] if s["city"] in CITIES else next((c for c in CITIES if c.lower() == s["city"].lower()), None)
        if not city:
            raise HTTPException(400, f"Set a known city first; '{s['city']}' is not on the list")
        heb = bool(re.search(r"[֐-׿]", s["name"]))
        card = await admin_add(AdminNew(
            city=city, name_en=None if heb else s["name"], name_he=s["name"] if heb else None,
            address=s.get("address") or None, phone=s.get("phone") or None, whatsapp=s.get("whatsapp") or None,
            website=s.get("website") or None, certification=s["certification"], kashrut=s.get("kashrut") or ""),
            payload)
    await db.restaurant_submissions.update_one({"id": sub_id}, {"$set": {
        "status": "approved" if decision == "approve" else "rejected", "decided_at": _now(),
        "decided_by": payload.get("user_id"), "restaurant_id": card["id"] if card else None}})
    return {"ok": True, "restaurant": card}
