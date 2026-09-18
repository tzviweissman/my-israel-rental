"""A Sukkot list says what each price actually is, in a sensible order.

A real Sukkot list sent to customers on 17 Sep 2026 read, in part:

    $154/ Sukkot      2 bedrooms   Available July 15
    $400/ Sukkot      1 bedroom    Available July 8
    ₪500/night        2 bedrooms
    ₪550/ Sukkot      2 bedrooms
    ...
    $10,000/ Sukkot   5 bedrooms

Three defects, each reproduced here from the same shape of listing:

  * an owner can mark the holiday price as PER NIGHT
    (`holiday_lump_is_per_night`). The list ignored it and called a
    nightly rate the price of the whole holiday: "$154 / Sukkot";
  * the holiday named was the listing's FIRST tag, not the list's, so a
    flat offered for Pesach and Sukkot read "/ Pesach" in a Sukkot list;
  * the order compared raw numbers across currencies, so $400 (about
    1,500 shekels) came before 500 shekels.

The fourth, "Available July 15" sent in September, is a formatting bug in
the admin screen and is tested beside that code
(frontend/src/components/admin/smartListText.test.js).

Needs the live local API, the local Mongo and the local admin account.
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

from pymongo import MongoClient  # noqa: E402

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")
ADMIN = {"email": "admin@rental.com", "password": "Admin1234!"}


@pytest.fixture(scope="module")
def db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.fixture(scope="module")
def admin():
    r = requests.post(f"{BASE}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture()
def flats(db):
    tag = uuid.uuid4().hex[:8]
    area = f"Jerusalem - TESTSUKKOT{tag}"
    base = {"rental_type": "vacation", "status": "active", "area": area, "bedrooms": 2,
            "owner_id": f"test-{tag}", "images": ["x.jpg"], "holiday_tags": ["sukkot"]}
    rows = {
        "nightly_usd": {**base, "id": f"{tag}-a", "title": "per-night USD", "holiday_lump_price": 154,
                        "holiday_lump_currency": "USD", "holiday_lump_is_per_night": True},
        "lump_usd": {**base, "id": f"{tag}-b", "title": "lump USD", "holiday_lump_price": 400,
                     "holiday_lump_currency": "USD"},
        "lump_ils": {**base, "id": f"{tag}-c", "title": "lump ILS", "holiday_lump_price": 500,
                     "holiday_lump_currency": "ILS"},
        "both_holidays": {**base, "id": f"{tag}-d", "title": "both", "holiday_lump_price": 9000,
                          "holiday_lump_currency": "ILS", "holiday_tags": ["pesach", "sukkot"]},
    }
    db.properties.insert_many([dict(r) for r in rows.values()])
    yield {"area": area, "rows": rows}
    db.properties.delete_many({"id": {"$in": [r["id"] for r in rows.values()]}})


def _list(admin, area):
    r = requests.post(f"{BASE}/admin/smart-lists/generate",
                      json={"rental_category": "sukkot", "location": area}, headers=admin, timeout=60)
    assert r.status_code == 200, r.text
    return r.json()["properties"]


def test_a_per_night_holiday_price_says_per_night(admin, flats):
    got = {p["id"]: p for p in _list(admin, flats["area"])}
    nightly = got[flats["rows"]["nightly_usd"]["id"]]
    assert nightly["price_label"] == "/night (Sukkot)", nightly["price_label"]
    whole = got[flats["rows"]["lump_usd"]["id"]]
    assert whole["price_label"] == "/ Sukkot"


def test_the_list_names_its_own_holiday(admin, flats):
    got = {p["id"]: p for p in _list(admin, flats["area"])}
    both = got[flats["rows"]["both_holidays"]["id"]]
    assert both["price_label"] == "/ Sukkot", f"a Sukkot list said {both['price_label']!r}"


def test_prices_are_ordered_in_one_currency(admin, flats):
    order = [p["title"] for p in _list(admin, flats["area"])]
    # $400 is well over 500 shekels at any plausible rate, so it must come
    # after 500 shekels, not before it as the raw numbers put it. (Nothing
    # is asserted about $154 against 500 shekels: that is about 500 at
    # today's rate, and a test that depends on the exchange rate is a test
    # that fails on a Tuesday.)
    assert order.index("lump ILS") < order.index("lump USD"), order
