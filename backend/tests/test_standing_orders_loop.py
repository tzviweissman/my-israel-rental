"""generate_all_standing_orders makes next week's copy without the board
being opened, and a second run makes nothing more (dead-ends audit
2026-10-08 #8). Local MongoDB only.
    .venv/Scripts/python -m pytest -q tests/test_standing_orders_loop.py
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
from routes.marketplace import orders  # noqa: E402


def run(c):
    return asyncio.get_event_loop().run_until_complete(c)


def test_generates_once(monkeypatch):
    async def no_assign(doc):
        return None

    monkeypatch.setattr(orders, "auto_assign", no_assign)
    bid = f"so-biz-{uuid.uuid4().hex[:8]}"
    sid = f"so-{bid}"
    run(db.store_standing_orders.insert_one({
        "_id": sid, "business_id": bid, "owner_user_id": "so-owner", "active": True,
        "weekday": 0, "items": [], "total": 0, "customer_name": "Dana",
    }))
    try:
        run(orders.ensure_order_indexes())
        first = run(orders.generate_all_standing_orders())
        assert first >= 1
        assert run(db.store_orders.count_documents({"standing_id": sid})) == 1
        run(orders.generate_all_standing_orders())
        assert run(db.store_orders.count_documents({"standing_id": sid})) == 1
    finally:
        run(db.store_orders.delete_many({"standing_id": sid}))
        run(db.store_standing_orders.delete_one({"_id": sid}))
