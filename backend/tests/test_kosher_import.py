"""The kosher restaurant import: dedupe, categories, resume, and what is NOT stored.

Google is faked; local MongoDB only.
    .venv/Scripts/python -m pytest -q tests/test_kosher_import.py
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

from routes.deps import db  # noqa: E402
from scripts import import_kosher_restaurants as imp  # noqa: E402


def run(c):
    return asyncio.get_event_loop().run_until_complete(c)


class FakePlaces:
    """Same place under two categories and two neighbourhoods; one per search otherwise."""

    def __init__(self, tag):
        self.tag, self.calls, self.max = tag, 0, 99

    async def city_area(self, city):
        return None

    async def _post(self, url, body, fields, method="POST"):
        # The neighbourhood centre lookup: "North" sits on the shared place.
        return {"places": [{"location": {"latitude": 31.781, "longitude": 35.211}}]}

    async def search(self, text, area=None):
        self.calls += 1
        yield {"id": f"{self.tag}-shared", "displayName": {"text": "Shared Cafe"},
               "location": {"latitude": 31.78, "longitude": 35.21}}
        yield {"id": f"{self.tag}-{self.calls}", "displayName": {"text": f"Place {self.calls}"},
               "location": {"latitude": 31.7, "longitude": 35.2}}


@pytest.fixture
def town(monkeypatch):
    tag = "kt-" + uuid.uuid4().hex[:8]
    city = f"Testville {tag}"
    monkeypatch.setattr(imp, "CITIES", {city: "Jerusalem"})
    monkeypatch.setattr(imp, "NEIGHBOURHOODS", {city: ["North"]})
    monkeypatch.setattr(imp, "CATEGORIES", {"pizza": "pizza", "cafe": "cafe"})
    yield tag, city
    run(db.restaurants.delete_many({"place_id": {"$regex": f"^{tag}-"}}))
    run(db.restaurant_import_progress.delete_many({"_id": {"$regex": f"^{city}"}}))
    run(db.restaurant_city_areas.delete_many({"_id": city}))


def test_dedupes_keeps_first_place_and_collects_categories(town):
    tag, city = town
    client = FakePlaces(tag)
    run(imp.run_import(client, [city], fresh=False, dry_run=False))
    assert client.calls == 4                                  # (city + North) x 2 categories
    near = {d["place_id"]: d["neighborhood"] for d in run(db.restaurants.find({"place_id": {"$regex": f"^{tag}-"}}).to_list(None))}
    assert near[f"{tag}-shared"] == "North"                   # 0.1 km from the centre
    assert near[f"{tag}-1"] is None                           # 10 km away: no neighbourhood
    docs = run(db.restaurants.find({"place_id": {"$regex": f"^{tag}-"}}).to_list(None))
    assert len(docs) == 5                                     # shared once + 4 singles
    shared = next(d for d in docs if d["place_id"].endswith("-shared"))
    assert sorted(shared["categories"]) == ["cafe", "pizza"]
    assert shared["city"] == city and shared["region"] == "Jerusalem"
    assert shared["verified"] is False and shared["kashrut"] is None and shared["kosher_certification"] is None
    assert shared["location"]["coordinates"] == [35.21, 31.78] and shared["location_fetched_at"]
    # Google's names are never kept (terms of use).
    assert all("name" not in d and "displayName" not in d for d in docs)


def test_resume_skips_finished_searches(town):
    tag, city = town
    run(imp.run_import(FakePlaces(tag), [city], fresh=False, dry_run=False))
    again = FakePlaces(tag)
    run(imp.run_import(again, [city], fresh=False, dry_run=False))
    assert again.calls == 0
    run(imp.run_import(again, [city], fresh=True, dry_run=False))
    assert again.calls == 4
