"""Backend tests for Services Marketplace (Phase 1a).

Covers: categories, gigs CRUD, filters, booking modes, subscription upgrade,
provider profile updates, and ownership/auth guards.
"""
import os
import time

import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://where-am-i-project.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api/marketplace"
# Every gig created here that is expected to succeed carries a `gallery`
# entry: since the photo rule in gigs.py (_has_any_photo) a listing with
# no image is refused at creation with "Add at least one photo". These
# tests are about ownership, booking and browsing, not photos - four of
# them had been failing on that rule alone.

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


@pytest.fixture(scope="module")
def owner_token():
    return _login("owner@test.com", "Test1234!")


@pytest.fixture(scope="module")
def renter_token():
    return _login("renter@test.com", "Test1234!")


@pytest.fixture(scope="module")
def admin_token():
    return _login("admin@rental.com", "Admin1234!")


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- Categories ----------

class TestCategories:
    def test_categories_returns_expected_slugs(self):
        r = requests.get(f"{API}/categories", timeout=15)
        assert r.status_code == 200
        cats = r.json()
        assert isinstance(cats, list)
        slugs = {c["slug"] for c in cats}
        # The API must serve exactly what the code declares live - the
        # CATEGORIES list minus anything held for review. A literal set
        # here went stale at the 2026-08 categories expansion and failed
        # for every new category since; the contract is "API == code".
        import sys, pathlib
        sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
        from routes.marketplace.shared import CATEGORIES, CATEGORIES_PENDING_REVIEW
        pending = {c["slug"] if isinstance(c, dict) else c for c in CATEGORIES_PENDING_REVIEW}
        expected = {c["slug"] for c in CATEGORIES} - pending
        assert slugs == expected, f"API serves {sorted(slugs ^ expected)} differently from routes/marketplace/shared.py"
        assert len(cats) == len(expected)


# ---------- Gig create ----------

class TestGigCreate:
    def test_create_gig_unauthenticated_rejected(self):
        r = requests.post(
            f"{API}/gigs",
            json={"title": "x", "category": "home-services-repair", "booking_mode": "whatsapp", "whatsapp": "+972500000000"},
            timeout=15,
        )
        assert r.status_code in (401, 403), f"got {r.status_code}"

    def test_create_gig_bad_category_returns_400(self, owner_token):
        r = requests.post(
            f"{API}/gigs",
            headers=_h(owner_token),
            json={"title": "TEST_bad", "category": "nonsense", "booking_mode": "whatsapp", "whatsapp": "+972500000000"},
            timeout=15,
        )
        assert r.status_code == 400, r.text

    def test_create_gig_whatsapp_mode_without_number_returns_400(self, owner_token):
        r = requests.post(
            f"{API}/gigs",
            headers=_h(owner_token),
            json={"title": "TEST_wa_no_number", "category": "home-services-repair", "booking_mode": "whatsapp", "whatsapp": "   "},
            timeout=15,
        )
        assert r.status_code == 400, r.text

    def test_create_gig_success_and_provider_trial_created(self, owner_token):
        r = requests.post(
            f"{API}/gigs",
            headers=_h(owner_token),
            json={
                "title": "TEST_Deep Cleaning Service",
                "category": "home-services-repair",
                "description": "Sparkling deep clean for apartments",
                "tiers": [{"name": "Basic", "price": 300, "currency": "ILS", "description": "2h clean"}],
                "gallery": ["https://example.com/img.jpg"],
                "booking_mode": "whatsapp",
                "whatsapp": "+972500000001",
                "area": "Tel Aviv",
            },
            timeout=30,
        )
        assert r.status_code == 200, r.text
        gig = r.json()
        assert gig["id"] and gig["title"] == "TEST_Deep Cleaning Service"
        assert gig["category"] == "home-services-repair"
        assert gig["status"] == "published"

        mg = requests.get(f"{API}/my-gigs", headers=_h(owner_token), timeout=15)
        assert mg.status_code == 200
        body = mg.json()
        assert "provider" in body
        assert body["provider"]["subscription_status"] in ("trial", "active")
        assert body["provider"]["active"] is True


# ---------- Public browse ----------

class TestPublicBrowse:
    def test_browse_returns_only_active_providers(self, owner_token):
        # ensure at least one active gig for owner
        requests.post(
            f"{API}/gigs",
            headers=_h(owner_token),
            json={"title": "TEST_Deep browse", "gallery": ["https://example.com/test.jpg"], "category": "home-services-repair", "description": "deep clean",
                  "booking_mode": "whatsapp", "whatsapp": "+972500000002", "area": "Tel Aviv"},
            timeout=15,
        )
        r = requests.get(f"{API}/gigs", timeout=15)
        assert r.status_code == 200
        gigs = r.json()
        assert isinstance(gigs, list) and len(gigs) > 0
        for g in gigs:
            assert g["status"] == "published"
            assert "provider" in g and g["provider"]["user_id"]

    def test_filter_by_category(self):
        r = requests.get(f"{API}/gigs", params={"category": "home-services-repair"}, timeout=15)
        assert r.status_code == 200
        gigs = r.json()
        assert all(g["category"] == "home-services-repair" for g in gigs)

    def test_search_case_insensitive(self):
        r = requests.get(f"{API}/gigs", params={"q": "deep"}, timeout=15)
        assert r.status_code == 200
        gigs = r.json()
        assert len(gigs) >= 1
        for g in gigs:
            hay = (g.get("title", "") + g.get("description", "")).lower()
            assert "deep" in hay


# ---------- Single gig, PATCH, DELETE ownership ----------

class TestGigOwnership:
    @pytest.fixture(scope="class")
    def owned_gig_id(self, owner_token):
        r = requests.post(
            f"{API}/gigs",
            headers=_h(owner_token),
            json={"title": "TEST_owned_gig", "gallery": ["https://example.com/test.jpg"], "category": "home-services-repair",
                  "booking_mode": "whatsapp", "whatsapp": "+972500000003", "area": "Tel Aviv"},
            timeout=15,
        )
        assert r.status_code == 200
        return r.json()["id"]

    def test_get_single_gig_has_provider_block(self, owned_gig_id):
        r = requests.get(f"{API}/gigs/{owned_gig_id}", timeout=15)
        assert r.status_code == 200
        gig = r.json()
        assert gig["id"] == owned_gig_id
        assert "provider" in gig
        assert "active" in gig["provider"]

    def test_patch_owned_gig_succeeds(self, owner_token, owned_gig_id):
        r = requests.patch(
            f"{API}/gigs/{owned_gig_id}",
            headers=_h(owner_token),
            json={"title": "TEST_owned_gig_v2"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json()["title"] == "TEST_owned_gig_v2"

    def test_patch_by_other_user_returns_403(self, renter_token, owned_gig_id):
        r = requests.patch(
            f"{API}/gigs/{owned_gig_id}",
            headers=_h(renter_token),
            json={"title": "hacked"},
            timeout=15,
        )
        assert r.status_code == 403, r.text

    def test_patch_missing_gig_returns_404(self, owner_token):
        r = requests.patch(
            f"{API}/gigs/does-not-exist-xyz",
            headers=_h(owner_token),
            json={"title": "nope"},
            timeout=15,
        )
        assert r.status_code == 404, r.text

    def test_delete_by_other_user_returns_403(self, renter_token, owned_gig_id):
        r = requests.delete(f"{API}/gigs/{owned_gig_id}", headers=_h(renter_token), timeout=15)
        assert r.status_code == 403

    def test_delete_owned_gig_succeeds(self, owner_token, owned_gig_id):
        r = requests.delete(f"{API}/gigs/{owned_gig_id}", headers=_h(owner_token), timeout=15)
        assert r.status_code == 200
        g = requests.get(f"{API}/gigs/{owned_gig_id}", timeout=15)
        assert g.status_code == 404


# ---------- Booking ----------

class TestBooking:
    def test_book_whatsapp_gig_returns_400(self, owner_token, renter_token):
        cr = requests.post(
            f"{API}/gigs",
            headers=_h(owner_token),
            json={"title": "TEST_wa_only", "gallery": ["https://example.com/test.jpg"], "category": "home-services-repair",
                  "booking_mode": "whatsapp", "whatsapp": "+972500000004", "area": "Tel Aviv"},
            timeout=15,
        )
        gid = cr.json()["id"]
        r = requests.post(
            f"{API}/gigs/{gid}/book",
            headers=_h(renter_token),
            json={"tier_name": "Basic", "message": "hi", "contact_email": "renter@test.com"},
            timeout=15,
        )
        assert r.status_code == 400, r.text

    def test_book_in_platform_gig_succeeds(self, owner_token, renter_token):
        cr = requests.post(
            f"{API}/gigs",
            headers=_h(owner_token),
            json={"title": "TEST_in_platform", "gallery": ["https://example.com/test.jpg"], "category": "transportation", "booking_mode": "in_platform",
                  "tiers": [{"name": "Basic", "price": 500, "currency": "ILS"}], "area": "Tel Aviv"},
            timeout=15,
        )
        assert cr.status_code == 200, cr.text
        gid = cr.json()["id"]
        r = requests.post(
            f"{API}/gigs/{gid}/book",
            headers=_h(renter_token),
            json={"tier_name": "Basic", "message": "please help", "contact_email": "renter@test.com",
                  "preferred_date": "2026-02-01"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True and body.get("booking_id")


# ---------- Provider profile & subscription upgrade ----------

class TestProviderAndSubscription:
    def test_patch_provider_me(self, owner_token):
        r = requests.patch(
            f"{API}/providers/me",
            headers=_h(owner_token),
            json={"bio": "TEST bio update", "tagline": "TEST tagline", "whatsapp": "+972500000099", "avatar": None},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        prov = r.json()
        assert prov["bio"] == "TEST bio update"
        assert prov["tagline"] == "TEST tagline"
        assert prov["whatsapp"] == "+972500000099"

    def test_public_provider_returns_gigs(self, owner_token):
        # Need owner user_id - fetch from /api/auth/me
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(owner_token), timeout=15)
        assert me.status_code == 200, me.text
        user_id = me.json().get("id") or me.json().get("user_id")
        assert user_id
        r = requests.get(f"{API}/providers/{user_id}", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user_id"] == user_id
        assert "gigs" in body and isinstance(body["gigs"], list)

    @pytest.mark.skipif(not os.environ.get("PAYPAL_CLIENT_ID"), reason="needs PayPal sandbox credentials (PAYPAL_CLIENT_ID)")
    def test_subscription_upgrade_returns_paypal_approval_url(self, owner_token):
        """Phase 1b: /upgrade now returns a real PayPal approval URL. The
        provider row is NOT flipped to active until /activate is called
        AFTER the provider approves the sub on paypal.com."""
        r = requests.post(f"{API}/subscription/upgrade", headers=_h(owner_token), timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("subscription_id", "").startswith("I-")
        assert "sandbox.paypal.com" in body.get("approval_url", "")
        assert body.get("amount") == 25.0
        assert body.get("currency") == "USD"
