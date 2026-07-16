"""MyJobs tab backend regression tests.

Covers:
- GET /api/marketplace/my-jobs (poster view + applications_count)
- GET /api/marketplace/jobs/{id}/applications (poster only, 403 for others)
- PATCH /api/marketplace/jobs/{id} status open/closed
- POST /api/marketplace/jobs/{id}/apply (400 for own job, works for another user)
"""
import os
import time
import requests
import pytest

def _read_frontend_env():
    p = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env")
    with open(p) as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip()
    raise RuntimeError("REACT_APP_BACKEND_URL not found")


BASE = (os.environ.get("REACT_APP_BACKEND_URL") or _read_frontend_env()).rstrip("/") + "/api"

RENTER = ("renter@test.com", "Test1234!")
OWNER = ("owner@test.com", "Test1234!")


def _login(email, password):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def renter_token():
    return _login(*RENTER)


@pytest.fixture(scope="module")
def owner_token():
    return _login(*OWNER)


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def created_job(renter_token):
    payload = {
        "title": "TEST_ MyJobsTab backend job",
        "category": "home-services-repair",
        "description": "Testing MyJobsTab flows end to end",
        "budget_type": "open",
        "budget_currency": "ILS",
        "area": "Tel Aviv",
    }
    r = requests.post(f"{BASE}/marketplace/jobs", json=payload, headers=_headers(renter_token))
    assert r.status_code == 200, r.text
    j = r.json()
    yield j
    # cleanup
    try:
        requests.delete(f"{BASE}/marketplace/jobs/{j['id']}", headers=_headers(renter_token))
    except Exception:
        pass


def test_my_jobs_returns_list_with_new_job(renter_token, created_job):
    r = requests.get(f"{BASE}/marketplace/my-jobs", headers=_headers(renter_token))
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    match = [x for x in rows if x["id"] == created_job["id"]]
    assert match, "just-created job missing from my-jobs"
    row = match[0]
    assert row["status"] == "open"
    assert row["applications_count"] == 0
    assert row["title"] == created_job["title"]


def test_applications_empty_initially(renter_token, created_job):
    r = requests.get(f"{BASE}/marketplace/jobs/{created_job['id']}/applications", headers=_headers(renter_token))
    assert r.status_code == 200
    assert r.json() == []


def test_apply_to_own_job_forbidden(renter_token, created_job):
    r = requests.post(
        f"{BASE}/marketplace/jobs/{created_job['id']}/apply",
        json={"message": "hi own job attempt should fail", "quoted_price": 100, "quoted_currency": "ILS"},
        headers=_headers(renter_token),
    )
    assert r.status_code == 400
    assert "own" in r.json().get("detail", "").lower()


def test_owner_can_apply_and_poster_sees_it(renter_token, owner_token, created_job):
    r = requests.post(
        f"{BASE}/marketplace/jobs/{created_job['id']}/apply",
        json={"message": "TEST_ owner applying with a quote", "quoted_price": 450, "quoted_currency": "ILS"},
        headers=_headers(owner_token),
    )
    assert r.status_code == 200, r.text
    app = r.json()
    assert app["message"].startswith("TEST_")
    assert app["quoted_price"] == 450
    # Poster now sees applications_count=1 in my-jobs
    r2 = requests.get(f"{BASE}/marketplace/my-jobs", headers=_headers(renter_token))
    assert r2.status_code == 200
    row = next(x for x in r2.json() if x["id"] == created_job["id"])
    assert row["applications_count"] == 1
    # applications endpoint returns enriched applicant
    r3 = requests.get(f"{BASE}/marketplace/jobs/{created_job['id']}/applications", headers=_headers(renter_token))
    assert r3.status_code == 200
    apps = r3.json()
    assert len(apps) == 1
    assert apps[0]["id"] == app["id"]
    assert apps[0]["quoted_price"] == 450
    assert "provider" in apps[0]
    assert apps[0]["provider"].get("display_name")


def test_applications_forbidden_for_non_poster(owner_token, created_job):
    r = requests.get(f"{BASE}/marketplace/jobs/{created_job['id']}/applications", headers=_headers(owner_token))
    assert r.status_code == 403


def test_patch_close_and_reopen(renter_token, created_job):
    r = requests.patch(
        f"{BASE}/marketplace/jobs/{created_job['id']}",
        json={"status": "closed"},
        headers=_headers(renter_token),
    )
    assert r.status_code == 200
    assert r.json()["status"] == "closed"

    # can no longer apply
    r2 = requests.post(
        f"{BASE}/marketplace/jobs/{created_job['id']}/apply",
        json={"message": "late applicant test message here", "quoted_currency": "ILS"},
        headers=_headers(_login(*OWNER)),
    )
    assert r2.status_code == 400

    # reopen
    r3 = requests.patch(
        f"{BASE}/marketplace/jobs/{created_job['id']}",
        json={"status": "open"},
        headers=_headers(renter_token),
    )
    assert r3.status_code == 200
    assert r3.json()["status"] == "open"
