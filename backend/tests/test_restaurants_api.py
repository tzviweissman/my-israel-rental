"""The /restaurants API: only named, listed places are public; filters,
near-me order, the Get listed queue and admin edits.

Local MongoDB and the local API on :8001 (DEV_AUTOLOGIN=1); records under "Arad".
    .venv/Scripts/python -m pytest -q tests/test_restaurants_api.py
"""
import asyncio
import os
import uuid
from pathlib import Path

import pytest
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
pytestmark = pytest.mark.skipif(
    not any(h in os.environ.get("MONGO_URL", "") for h in ("localhost", "127.0.0.1")),
    reason="local MongoDB only",
)

import httpx  # noqa: E402

from routes.deps import db  # noqa: E402

API = "http://localhost:8001"


def run(c):
    return asyncio.get_event_loop().run_until_complete(c)


@pytest.fixture
def world():
    tag = "rt-" + uuid.uuid4().hex[:8]

    def place(n, lng, lat, **kw):
        doc = {"place_id": f"{tag}-{n}", "source": "google", "city": "Arad", "region": "South", "neighborhood": None,
               "categories": ["pizza"], "kashrut": "dairy", "kosher_certification": "Rabbanut", "verified": False,
               "status": "listed", "location": {"type": "Point", "coordinates": [lng, lat]},
               "contact": {"name_en": f"Place {n}", "website": f"https://{n}.example", "phone": "08-9971234"}}
        doc.update(kw)
        return doc
    run(db.restaurants.insert_many([
        place("near", 35.212, 31.258),
        place("far", 35.240, 31.270, kashrut="meat", categories=["burgers"]),
        place("hidden", 35.212, 31.258, status="hidden"),
        place("noname", 35.212, 31.258, contact={"website": "https://x.example"}),
    ]))
    run(db.restaurants.create_index([("location", "2dsphere")]))
    try:
        token = httpx.get(f"{API}/api/auth/dev-login", params={"role": "admin"}, timeout=10).json()["token"]
    except Exception:
        pytest.skip("needs the local API on :8001 with DEV_AUTOLOGIN=1")
    yield tag, httpx.Client(base_url=API, headers={"Authorization": f"Bearer {token}"}, timeout=20)
    run(db.restaurants.delete_many({"place_id": {"$regex": f"^{tag}-"}}))
    run(db.restaurants.delete_many({"source": "admin", "contact.name_en": f"Added {tag}"}))
    run(db.restaurant_submissions.delete_many({"name": f"Sub {tag}"}))


def ids(res, tag):
    return [x["id"] for x in res.json()["items"] if x["id"].startswith(tag)]


def test_only_named_listed_places_are_public(world):
    tag, c = world
    got = ids(c.get("/api/restaurants", params={"city": "arad", "limit": 100}), tag)
    assert sorted(got) == sorted([f"{tag}-near", f"{tag}-far"])


def test_filters_and_near_me(world):
    tag, c = world
    assert ids(c.get("/api/restaurants", params={"city": "arad", "kashrut": "meat"}), tag) == [f"{tag}-far"]
    near = c.get("/api/restaurants", params={"city": "arad", "lat": 31.258, "lng": 35.212}).json()["items"]
    mine = [x for x in near if x["id"].startswith(tag)]
    assert mine[0]["id"] == f"{tag}-near" and mine[0]["distance_km"] < 0.1
    f = c.get("/api/restaurants/facets", params={"city": "arad"}).json()
    assert f["city"] == "Arad" and any(x["key"] == "burgers" for x in f["categories"])


def test_get_listed_then_approve(world):
    tag, c = world
    body = {"name": f"Sub {tag}", "city": "arad", "certification": "Badatz Beit Yosef",
            "contact_email": "owner@example.com", "kashrut": "meat"}
    assert c.post("/api/restaurants/submissions", json=body).status_code == 200
    sub = next(s for s in c.get("/api/admin/restaurants/submissions").json() if s["name"] == f"Sub {tag}")
    res = c.post(f"/api/admin/restaurants/submissions/{sub['id']}/approve").json()
    card = res["restaurant"]
    assert card["city"] == "Arad" and card["certification"] == "Badatz Beit Yosef" and card["verified"] is False
    run(db.restaurants.delete_one({"place_id": card["id"]}))


def test_admin_verify_and_hide(world):
    tag, c = world
    out = c.patch(f"/api/admin/restaurants/{tag}-near", json={"verified": True, "certification": "Rabbanut, Mehadrin"}).json()
    assert out["verified"] is True and out["certification"] == "Rabbanut, Mehadrin"
    c.patch(f"/api/admin/restaurants/{tag}-near", json={"status": "removed"})
    assert f"{tag}-near" not in ids(c.get("/api/restaurants", params={"city": "arad"}), tag)
    stats = c.get("/api/admin/restaurants/stats").json()
    assert next(x for x in stats["cities"] if x["city"] == "Arad")["listed"] >= 1


def test_nearby_limit_report_and_claim(world):
    tag, c = world
    # 'far' is about 3 km from 'near'; a 1 km limit keeps only 'near'.
    res = c.get("/api/restaurants", params={"lat": 31.258, "lng": 35.212, "max_km": 1, "city": "arad"}).json()
    assert ids_of(res, tag) == [f"{tag}-near"] and res["total"] >= 1
    assert c.post(f"/api/restaurants/{tag}-near/reports", json={"kind": "closed", "note": "shut last week"}).status_code == 200
    assert c.post(f"/api/restaurants/{tag}-near/reports", json={"kind": "nonsense"}).status_code == 400
    rep = next(x for x in c.get("/api/admin/restaurants/reports").json() if x["place_id"] == f"{tag}-near")
    assert rep["restaurant"]["name"] == "Place near"
    assert c.post(f"/api/admin/restaurants/reports/{rep['id']}/resolve").status_code == 200
    assert c.post(f"/api/restaurants/{tag}-near/claims", json={"name": "Owner", "email": "o@example.com"}).status_code == 200
    cl = next(x for x in c.get("/api/admin/restaurants/claims").json() if x["place_id"] == f"{tag}-near")
    assert c.post(f"/api/admin/restaurants/claims/{cl['id']}/reject").status_code == 200
    run(db.restaurant_reports.delete_many({"place_id": f"{tag}-near"}))
    run(db.restaurant_claims.delete_many({"place_id": f"{tag}-near"}))


def ids_of(body, tag):
    return [x["id"] for x in body["items"] if x["id"].startswith(tag)]


def test_upload_file_keeps_edits_and_drops_stale_locations(world):
    tag, c = world
    from datetime import UTC, datetime, timedelta
    now = datetime.now(UTC).isoformat()
    old = (datetime.now(UTC) - timedelta(days=40)).isoformat()
    pt = {"type": "Point", "coordinates": [35.2, 31.25]}
    rows = [
        {"place_id": f"{tag}-up1", "source": "google", "city": "Arad", "status": "listed", "categories": ["pizza"],
         "contact": {"name_en": "Up One"}, "location": pt, "location_fetched_at": now, "verified": True},
        {"place_id": f"{tag}-up2", "source": "google", "city": "Arad", "status": "hidden", "categories": [],
         "contact": {}, "location": pt, "location_fetched_at": old},
        {"place_id": f"{tag}-up3", "city": "Atlantis"},
    ]
    assert c.post("/api/admin/restaurants/import", json={"restaurants": rows}).json() == {"new": 2, "updated": 0, "kept_edits": 0}
    up1 = run(db.restaurants.find_one({"place_id": f"{tag}-up1"}))
    up2 = run(db.restaurants.find_one({"place_id": f"{tag}-up2"}))
    assert up1["verified"] is False                     # never imported
    assert up2["location"] is None                       # older than 30 days
    c.patch(f"/api/admin/restaurants/{tag}-up1", json={"name_en": "Edited here"})
    assert c.post("/api/admin/restaurants/import", json={"restaurants": rows[:1]}).json()["kept_edits"] == 1
    assert run(db.restaurants.find_one({"place_id": f"{tag}-up1"}))["contact"]["name_en"] == "Edited here"
