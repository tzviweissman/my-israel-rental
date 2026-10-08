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
