"""Backend tests for Services Marketplace subcategory filtering & validation.

Covers:
- Existing category-only filter behavior preserved
- Subcategory filter narrows results
- Backend rejects invalid (script-tag) subcategory on create
- Backend accepts slug-shaped long-tail subcategory on create
- Jobs subcategory list endpoint doesn't crash
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"



@pytest.fixture(scope="module")
def owner_token():
    r = requests.post(f"{API}/auth/login", json={
        "email": "owner@test.com", "password": "Test1234!"
    }, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"login failed: {r.status_code} {r.text[:200]}")
    return r.json().get("token")


# ---- LIST: category-only preserved ----
def test_gigs_category_home_services_repair_count():
    r = requests.get(f"{API}/marketplace/gigs",
                     params={"category": "home-services-repair", "limit": 200}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    # Not a literal count. "31" was the size of one seeded database on one
    # day; this asserts the FILTER - everything returned is in the category,
    # and the category is not empty - which is what the test is for.
    assert data, "no home-services-repair gigs at all - the category filter or the seed is broken"
    off = [g["id"] for g in data if g.get("category") != "home-services-repair"]
    assert not off, f"category filter leaked {len(off)} gig(s) from other categories"


# ---- LIST: subcategory=plumbing narrows to tagged gig ----
def test_gigs_subcategory_plumbing_returns_tagged(owner_token):
    """The gig this asserted on (TAGGED_GIG_ID) existed in one seeded
    database. Create the tagged gig here instead, then check the filter
    narrows to gigs tagged plumbing and includes it."""
    created = requests.post(f"{API}/marketplace/gigs", json={
        "title": "TEST_subcat_plumbing_probe",
        "category": "home-services-repair",
        "subcategory": "plumbing",
        "description": "probe",
        "gig_type": "deliverable",
        "tiers": [{"name": "Basic", "price": 100, "currency": "ILS"}],
        "booking_mode": "whatsapp",
        "whatsapp": "+972501234567",
        "area": "Tel Aviv",
        "gallery": ["https://example.com/test-plumbing.jpg"],
    }, headers={"Authorization": f"Bearer {owner_token}"}, timeout=60)
    assert created.status_code == 200, created.text[:300]
    gid = created.json()["id"]
    try:
        r = requests.get(f"{API}/marketplace/gigs",
                         params={"category": "home-services-repair", "subcategory": "plumbing"},
                         timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert any(g["id"] == gid for g in data), "the plumbing-tagged gig is missing from ?subcategory=plumbing"
        assert all(g.get("subcategory") == "plumbing" for g in data), "subcategory filter leaked untagged gigs"
    finally:
        requests.delete(f"{API}/marketplace/gigs/{gid}", headers={"Authorization": f"Bearer {owner_token}"}, timeout=30)


# ---- LIST: subcategory=electrical returns 0 ----
def test_gigs_subcategory_electrical_empty():
    r = requests.get(f"{API}/marketplace/gigs",
                     params={"category": "home-services-repair", "subcategory": "electrical"},
                     timeout=30)
    assert r.status_code == 200, r.text
    # Nothing untagged leaks in; whether any electrical gig exists depends
    # on the data, so that is not asserted.
    assert all(g.get("subcategory") == "electrical" for g in r.json())


# ---- LIST jobs subcategory filter path works, no crash ----
def test_jobs_subcategory_plumbing_no_crash():
    r = requests.get(f"{API}/marketplace/jobs",
                     params={"category": "home-services-repair", "subcategory": "plumbing"},
                     timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    # Could be list or dict shape — just ensure it doesn't crash.
    assert body is not None


# ---- CREATE: rejects script-tag subcategory ----
def test_create_gig_rejects_script_subcategory(owner_token):
    payload = {
        "title": "TEST_subcat_bad_gig",
        "category": "home-services-repair",
        "subcategory": "<script>alert(1)</script>",
        "description": "test",
        "gig_type": "deliverable",
        "tiers": [{"name": "Basic", "price": 100, "currency": "ILS"}],
        "booking_mode": "whatsapp",
        "whatsapp": "+972501234567",
        "area": "Tel Aviv",
    }
    r = requests.post(f"{API}/marketplace/gigs", json=payload,
                      headers={"Authorization": f"Bearer {owner_token}"}, timeout=30)
    assert r.status_code == 400, f"expected 400 rejection, got {r.status_code} {r.text[:300]}"


# ---- CREATE: rejects script-tag subcategory on jobs ----
def test_create_job_rejects_script_subcategory(owner_token):
    payload = {
        "title": "TEST_subcat_bad_job",
        "category": "home-services-repair",
        "subcategory": "<script>x</script>",
        "description": "test",
        "budget_min": 100,
        "budget_max": 200,
        "area": "Tel Aviv",
    }
    r = requests.post(f"{API}/marketplace/jobs", json=payload,
                      headers={"Authorization": f"Bearer {owner_token}"}, timeout=30)
    # Should be validation error 400 (could also be 422 depending on model).
    assert r.status_code in (400, 422), f"expected reject, got {r.status_code} {r.text[:300]}"


# ---- CREATE: accepts long-tail slug subcategory ----
def test_create_gig_accepts_longtail_slug(owner_token):
    payload = {
        "title": "TEST_subcat_longtail_gig",
        "category": "home-services-repair",
        "subcategory": "solar-panel-installation",
        "description": "test long-tail",
        "gig_type": "deliverable",
        "tiers": [{"name": "Basic", "price": 100, "currency": "ILS"}],
        "booking_mode": "whatsapp",
        "whatsapp": "+972501234567",
        "area": "Tel Aviv",
        # A listing needs at least one photo to be created (gigs.py
        # _has_any_photo reads `gallery`, product images or tier images);
        # this test is about the subcategory, not photos.
        "gallery": ["https://example.com/test-subcat.jpg"],
    }
    r = requests.post(f"{API}/marketplace/gigs", json=payload,
                      headers={"Authorization": f"Bearer {owner_token}"}, timeout=60)
    assert r.status_code == 200, f"expected 200, got {r.status_code} {r.text[:300]}"
    created = r.json()
    assert created.get("subcategory") == "solar-panel-installation"
    gig_id = created.get("id")
    # cleanup
    if gig_id:
        requests.delete(f"{API}/marketplace/gigs/{gig_id}",
                        headers={"Authorization": f"Bearer {owner_token}"}, timeout=30)
