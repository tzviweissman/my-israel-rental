"""The public businesses list never cuts listings off (1 Nov 2026).

/services showed "All businesses (60)" with 62 published: the endpoint's
default limit of 60 dropped the two oldest, and because it cut the newest N
BEFORE sorting, "best match" only ever ranked the newest listings. Now
`limit=0` returns every match, and any limit is applied after the sort.
Local MongoDB only; the route runs in-process (no API server needed)."""
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pymongo import MongoClient  # noqa: E402

LOCAL = any(h in os.environ.get("MONGO_URL", "") for h in ("localhost", "127.0.0.1"))
pytestmark = pytest.mark.skipif(not LOCAL, reason="needs the local MongoDB")
M = "_gigs_list_all_test"


@pytest.fixture(scope="module")
def seeded():
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    word = "zq" + uuid.uuid4().hex[:8]   # a search word no real listing has
    user = f"{M}-user"
    now = datetime.now(timezone.utc)
    db.marketplace_providers.insert_one({"_id": f"{M}-prov", "marker": M, "user_id": user, "subscription_status": "active"})
    # three listings, oldest first
    gigs = [{"_id": f"{M}-{i}", "marker": M, "provider_user_id": user, "status": "published", "gig_type": "appointment",
             "title": f"{word} listing {i}", "created_at": (now - timedelta(days=30 - i)).isoformat()} for i in range(3)]
    db.marketplace_gigs.insert_many(gigs)
    yield word
    for col in ("marketplace_gigs", "marketplace_providers"):
        db[col].delete_many({"marker": M})


@pytest.fixture
def client():
    """A new client per test, and one request per test: without `with`, each TestClient request
    runs on its own short-lived loop and the shared Motor client stays bound to the first
    (conftest re-binds it between tests only); a second request failed on a closed loop."""
    tc = pytest.importorskip("fastapi.testclient", reason="fastapi.testclient (httpx) not installed")
    import server  # noqa: E402
    return tc.TestClient(server.app)


def test_limit_zero_returns_every_match(seeded, client):
    res = client.get(f"/api/marketplace/gigs?q={seeded}&limit=0")
    assert res.status_code == 200, res.text
    assert len(res.json()) == 3


def test_a_limit_keeps_the_newest_when_sorted_by_newest(seeded, client):
    newest = client.get(f"/api/marketplace/gigs?q={seeded}&limit=1&sort=newest").json()
    assert [g["id"] for g in newest] == [f"{M}-2"]


def test_a_limit_is_applied_after_the_sort(seeded, client, monkeypatch):
    """With limit=1, "rating" gives the oldest listing, the only rated one: the cut happens
    on the sorted list, not on the newest few (before, this returned the newest)."""
    from routes.marketplace import gigs as route

    async def stars(ids):   # only the oldest listing has reviews
        return {i: {"rating_avg": 5.0, "rating_count": 5} for i in ids if i == f"{M}-0"}
    monkeypatch.setattr(route, "_batch_rating_aggregate", stars)
    rated = client.get(f"/api/marketplace/gigs?q={seeded}&limit=1&sort=rating").json()
    assert [g["id"] for g in rated] == [f"{M}-0"]
