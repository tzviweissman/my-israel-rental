"""Backend tests for Services Marketplace Phase 2a — Reviews & Ratings.

Endpoints under test:
  - GET    /api/marketplace/gigs/{id}/reviews         (public)
  - POST   /api/marketplace/gigs/{id}/reviews         (auth; upsert)
  - DELETE /api/marketplace/gigs/{id}/reviews/mine    (auth)

Also verifies that rating_avg + rating_count are embedded inline in:
  - GET /api/marketplace/gigs (list, batched)
  - GET /api/marketplace/gigs/{id} (detail)
  - GET /api/marketplace/providers/{user_id} (provider public profile)
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://where-am-i-project.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api/marketplace"


# ---------- Auth helpers ----------

def _login(email: str, password: str) -> str:
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=30,
    )
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"no token in {data}"
    return tok


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def owner_token():
    return _login("owner@test.com", "Test1234!")


@pytest.fixture(scope="module")
def renter_token():
    return _login("renter@test.com", "Test1234!")


@pytest.fixture(scope="module")
def target_gig(owner_token):
    """Pick or create an owner-published gig to be used as the review target."""
    # Try to find an existing owner gig via /my-gigs
    r = requests.get(f"{API}/my-gigs", headers=_h(owner_token), timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    mine = data.get("gigs", []) if isinstance(data, dict) else data
    published = [g for g in mine if g.get("status") == "published"]
    if published:
        return published[0]

    # Otherwise, create one
    payload = {
        "category": "cleaning",
        "title": f"TEST_reviews_gig_{uuid.uuid4().hex[:6]}",
        "description": "Test gig for reviews suite",
        "tiers": [{"name": "Basic", "price": 50.0, "unit": "hour", "description": "std"}],
        "gallery": [],
        "booking_mode": "in_platform",
        "area": "Testville",
    }
    r = requests.post(f"{API}/gigs", json=payload, headers=_h(owner_token), timeout=15)
    assert r.status_code in (200, 201), r.text
    return r.json()


@pytest.fixture(autouse=True)
def _cleanup_renter_review(target_gig, renter_token):
    """After each test, best-effort remove renter's review so tests are isolated."""
    yield
    try:
        requests.delete(
            f"{API}/gigs/{target_gig['id']}/reviews/mine",
            headers=_h(renter_token),
            timeout=10,
        )
    except Exception:
        pass


# ---------- Validation & guards ----------

class TestReviewGuards:
    def test_rating_6_returns_422(self, target_gig, renter_token):
        r = requests.post(
            f"{API}/gigs/{target_gig['id']}/reviews",
            json={"rating": 6, "comment": "too high"},
            headers=_h(renter_token),
            timeout=15,
        )
        assert r.status_code == 422, r.text

    def test_rating_0_returns_422(self, target_gig, renter_token):
        r = requests.post(
            f"{API}/gigs/{target_gig['id']}/reviews",
            json={"rating": 0, "comment": "too low"},
            headers=_h(renter_token),
            timeout=15,
        )
        assert r.status_code == 422, r.text

    def test_owner_cannot_review_own_gig(self, target_gig, owner_token):
        r = requests.post(
            f"{API}/gigs/{target_gig['id']}/reviews",
            json={"rating": 5, "comment": "self"},
            headers=_h(owner_token),
            timeout=15,
        )
        assert r.status_code == 400, r.text
        assert "cannot review your own gig" in r.text.lower()

    def test_post_review_no_auth_rejected(self, target_gig):
        r = requests.post(
            f"{API}/gigs/{target_gig['id']}/reviews",
            json={"rating": 5, "comment": "no auth"},
            timeout=15,
        )
        assert r.status_code in (401, 403), r.status_code

    def test_post_review_nonexistent_gig_returns_404(self, renter_token):
        bogus = f"nonexistent-{uuid.uuid4().hex[:8]}"
        r = requests.post(
            f"{API}/gigs/{bogus}/reviews",
            json={"rating": 5, "comment": "ghost"},
            headers=_h(renter_token),
            timeout=15,
        )
        assert r.status_code == 404, r.text


# ---------- Happy path: create → upsert → list → delete ----------

class TestReviewLifecycle:
    def test_full_lifecycle(self, target_gig, renter_token):
        gig_id = target_gig["id"]

        # 1) baseline detail
        r0 = requests.get(f"{API}/gigs/{gig_id}", timeout=15)
        assert r0.status_code == 200
        base = r0.json()
        assert "rating_avg" in base and "rating_count" in base

        # 2) POST 5-star as renter
        r1 = requests.post(
            f"{API}/gigs/{gig_id}/reviews",
            json={"rating": 5, "comment": "Excellent!"},
            headers=_h(renter_token),
            timeout=15,
        )
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1.get("ok") is True
        review_id = d1["review_id"]
        assert isinstance(review_id, str) and review_id

        # 3) GET reviews shows this review + avg=5
        r2 = requests.get(f"{API}/gigs/{gig_id}/reviews", timeout=15)
        assert r2.status_code == 200, r2.text
        listing = r2.json()
        assert listing["rating_count"] >= 1
        assert listing["rating_avg"] == 5.0
        my = [x for x in listing["reviews"] if x["id"] == review_id]
        assert len(my) == 1
        row = my[0]
        assert row["rating"] == 5
        assert row["comment"] == "Excellent!"
        assert "client_name" in row
        assert "created_at" in row

        # 4) UPSERT to 4 stars — same review_id, avg becomes 4
        r3 = requests.post(
            f"{API}/gigs/{gig_id}/reviews",
            json={"rating": 4, "comment": "Actually a 4."},
            headers=_h(renter_token),
            timeout=15,
        )
        assert r3.status_code == 200, r3.text
        d3 = r3.json()
        assert d3["review_id"] == review_id  # UPSERT, not new

        r4 = requests.get(f"{API}/gigs/{gig_id}/reviews", timeout=15)
        listing2 = r4.json()
        assert listing2["rating_avg"] == 4.0
        assert listing2["rating_count"] == listing["rating_count"]  # count unchanged

        # 5) gig detail also reflects new avg/count
        r5 = requests.get(f"{API}/gigs/{gig_id}", timeout=15)
        detail = r5.json()
        assert detail["rating_avg"] == 4.0
        assert detail["rating_count"] >= 1

        # 6) DELETE mine — count drops
        r6 = requests.delete(
            f"{API}/gigs/{gig_id}/reviews/mine",
            headers=_h(renter_token),
            timeout=15,
        )
        assert r6.status_code == 200, r6.text

        r7 = requests.get(f"{API}/gigs/{gig_id}/reviews", timeout=15)
        listing3 = r7.json()
        assert not any(x["id"] == review_id for x in listing3["reviews"])

        # 7) DELETE again — 404
        r8 = requests.delete(
            f"{API}/gigs/{gig_id}/reviews/mine",
            headers=_h(renter_token),
            timeout=15,
        )
        assert r8.status_code == 404


# ---------- Inline rating fields on list/detail/provider ----------

class TestRatingsEmbedded:
    def test_list_gigs_embeds_rating_fields(self, target_gig, renter_token):
        # Post a review so at least one gig has rating_count > 0
        gig_id = target_gig["id"]
        requests.post(
            f"{API}/gigs/{gig_id}/reviews",
            json={"rating": 3, "comment": "meh"},
            headers=_h(renter_token),
            timeout=15,
        )
        r = requests.get(f"{API}/gigs", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        gigs = data.get("gigs", data) if isinstance(data, dict) else data
        assert isinstance(gigs, list) and len(gigs) > 0
        for g in gigs:
            assert "rating_avg" in g
            assert "rating_count" in g
        mine = [g for g in gigs if g["id"] == gig_id]
        assert mine, "target gig not present in public list"
        assert mine[0]["rating_count"] >= 1
        assert mine[0]["rating_avg"] == 3.0

    def test_provider_public_embeds_rating_fields(self, target_gig, renter_token):
        # Ensure a review exists
        gig_id = target_gig["id"]
        requests.post(
            f"{API}/gigs/{gig_id}/reviews",
            json={"rating": 2, "comment": "eh"},
            headers=_h(renter_token),
            timeout=15,
        )
        provider_user_id = target_gig["provider_user_id"]
        r = requests.get(f"{API}/providers/{provider_user_id}", timeout=15)
        assert r.status_code == 200, r.text
        prof = r.json()
        gigs = prof.get("gigs", [])
        assert isinstance(gigs, list) and len(gigs) > 0
        for g in gigs:
            assert "rating_avg" in g
            assert "rating_count" in g
        mine = [g for g in gigs if g["id"] == gig_id]
        assert mine
        assert mine[0]["rating_count"] >= 1
        assert mine[0]["rating_avg"] == 2.0
