"""Smart Lists filters, run against real rows in the LOCAL database.

WHY. test_smart_lists_recency.py pins the helpers and the policy; this pins
_apply_filters itself, where the policy has to actually hold: a listing with
no ``created_at`` must never reach a "last 7 days" list, whatever shape the
dated rows' timestamps are in, and the rent and bedroom filters are ranges,
not floors.

The FX lookup is patched so a rent bound needs no network.
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import patch

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from routes import admin_smart_lists as sl  # noqa: E402
from routes.admin_smart_lists import SmartListFilters  # noqa: E402


def _local_db():
    url = os.environ["MONGO_URL"]
    assert "localhost" in url or "127.0.0.1" in url, "refusing to run against a non-local database"
    return AsyncIOMotorClient(url)[os.environ["DB_NAME"]]


async def _fake_convert(amount, _from, _to):
    return amount * 3.7


def _iso(days_ago: float, style: str = "z") -> str:
    d = datetime.now(UTC) - timedelta(days=days_ago)
    if style == "z":
        return d.strftime("%Y-%m-%dT%H:%M:%SZ")
    if style == "offset":
        return d.isoformat()
    return d.replace(tzinfo=None).isoformat()  # naive


def _run_with_rows(rows: list[dict], filters_for):
    """Insert rows under a unique area, run _apply_filters, clean up."""
    area = f"SmartListTest {uuid.uuid4().hex[:10]}"

    async def go():
        db = _local_db()
        docs = []
        for r in rows:
            doc = {
                "id": f"slt-{uuid.uuid4()}",
                "status": "active",
                "rental_type": "long-term",
                "area": area,
                "monthly_price": 6000,
                "currency": "ILS",
                "bedrooms": 3,
                **r,
            }
            doc = {k: v for k, v in doc.items() if v is not ...}
            docs.append(doc)
        await db.properties.insert_many([dict(d) for d in docs])
        try:
            with patch.object(sl, "db", db), patch.object(sl, "convert_amount", _fake_convert):
                matches, _ = await sl._apply_filters(filters_for(area))
        finally:
            await db.properties.delete_many({"area": area})
        return {m["tag"] for m in matches if m.get("area") == area}

    return asyncio.run(go())


def test_recency_excludes_undated_and_old_rows_in_every_timestamp_shape():
    got = _run_with_rows(
        [
            {"tag": "fresh_z", "created_at": _iso(2, "z")},
            {"tag": "fresh_offset", "created_at": _iso(3, "offset")},
            {"tag": "fresh_naive", "created_at": _iso(1, "naive")},
            {"tag": "old", "created_at": _iso(20, "z")},
            {"tag": "no_field", "created_at": ...},  # field absent entirely
            {"tag": "null", "created_at": None},
            {"tag": "garbage", "created_at": "not-a-date"},
        ],
        lambda area: SmartListFilters(location=area, rental_category="long-term", listed_within_days=7),
    )
    assert got == {"fresh_z", "fresh_offset", "fresh_naive"}


def test_without_recency_every_row_is_eligible_including_undated():
    got = _run_with_rows(
        [
            {"tag": "dated", "created_at": _iso(200, "z")},
            {"tag": "undated", "created_at": ...},
        ],
        lambda area: SmartListFilters(location=area, rental_category="long-term"),
    )
    assert got == {"dated", "undated"}


def test_rent_is_a_two_sided_range_after_usd_conversion():
    got = _run_with_rows(
        [
            {"tag": "too_cheap", "monthly_price": 3000},
            {"tag": "in_range", "monthly_price": 6000},
            {"tag": "too_dear", "monthly_price": 12000},
            # 2000 USD at the patched 3.7 is 7400 ILS: inside the range.
            {"tag": "usd_in_range", "monthly_price": 2000, "currency": "USD"},
            # 1000 USD is 3700 ILS: below it.
            {"tag": "usd_too_cheap", "monthly_price": 1000, "currency": "USD"},
        ],
        lambda area: SmartListFilters(
            location=area, rental_category="long-term",
            min_monthly_rent_ils=5000, max_monthly_rent_ils=9000,
        ),
    )
    assert got == {"in_range", "usd_in_range"}


def test_a_minimum_rent_alone_primes_the_fx_rate():
    """The rate used to be fetched only when a MAX was set."""
    got = _run_with_rows(
        [
            {"tag": "usd_high", "monthly_price": 3000, "currency": "USD"},  # 11100 ILS
            {"tag": "ils_low", "monthly_price": 4000},
        ],
        lambda area: SmartListFilters(location=area, rental_category="long-term", min_monthly_rent_ils=8000),
    )
    assert got == {"usd_high"}


def test_bedrooms_is_a_range_not_a_floor():
    got = _run_with_rows(
        [
            {"tag": "one", "bedrooms": 1},
            {"tag": "three", "bedrooms": 3},
            {"tag": "four", "bedrooms": 4},
            {"tag": "penthouse", "bedrooms": 6},
        ],
        lambda area: SmartListFilters(
            location=area, rental_category="long-term", min_bedrooms=3, max_bedrooms=4,
        ),
    )
    assert got == {"three", "four"}


def test_shaped_output_carries_created_at():
    prop = {
        "id": "x", "area": "Somewhere", "rental_type": "long-term",
        "monthly_price": 5000, "currency": "ILS", "created_at": "2026-09-01T10:00:00Z",
    }
    assert sl._shape_for_output(prop).created_at == "2026-09-01T10:00:00Z"
    prop.pop("created_at")
    assert sl._shape_for_output(prop).created_at is None
