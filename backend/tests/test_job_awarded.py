"""A posted job can be marked awarded.

`JobPatch.status` has allowed `open|awarded|closed` since jobs shipped and
the dashboard even had a badge colour waiting for `awarded`, but nothing
ever set it: a poster who had hired somebody could only "close" the job,
which says it is over without saying it was filled (dead-ends audit
2026-09-03, #11).

Runs against the live local API (see backend/tests/.env.test).
"""
import os
from datetime import UTC, datetime, timedelta

import pytest
import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _account(tag):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"job-{tag}-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": f"Job {tag}", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def poster():
    return _account("poster")


def _job(token):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/marketplace/jobs", json={
        "title": f"TEST_job_awarded_{stamp}",
        "description": "someone to do the thing, described at length",
        "category": "home-services-repair", "area": "Tel Aviv",
        "budget_type": "open",
        "deadline": (datetime.now(UTC) + timedelta(days=20)).date().isoformat(),
    }, headers=_auth(token), timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _on_board(job_id):
    # 120 is the route's own ceiling; asking for more is a 422, not a
    # bigger page.
    r = requests.get(f"{BASE}/marketplace/jobs", params={"limit": 120}, timeout=30)
    assert r.status_code == 200, r.text
    rows = r.json()
    rows = rows.get("jobs", []) if isinstance(rows, dict) else rows
    return job_id in [j["id"] for j in rows]


def test_a_job_can_be_marked_awarded_and_reopened(poster):
    job_id = _job(poster)
    try:
        assert _on_board(job_id), "a new job is on the board"

        r = requests.patch(f"{BASE}/marketplace/jobs/{job_id}", json={"status": "awarded"},
                           headers=_auth(poster), timeout=30)
        assert r.status_code == 200, r.text

        r = requests.get(f"{BASE}/marketplace/my-jobs", headers=_auth(poster), timeout=30)
        assert r.status_code == 200, r.text
        mine = r.json()
        rows = mine.get("jobs", []) if isinstance(mine, dict) else mine
        row = [j for j in rows if j["id"] == job_id]
        assert row and row[0]["status"] == "awarded", row
        # Awarded is finished: it leaves the board like a closed one does.
        assert not _on_board(job_id)

        r = requests.patch(f"{BASE}/marketplace/jobs/{job_id}", json={"status": "open"},
                           headers=_auth(poster), timeout=30)
        assert r.status_code == 200, r.text
        assert _on_board(job_id), "and the poster can put it back"
    finally:
        requests.delete(f"{BASE}/marketplace/jobs/{job_id}", headers=_auth(poster), timeout=30)


def test_only_the_poster_can_award_their_job(poster):
    job_id = _job(poster)
    other = _account("other")
    try:
        r = requests.patch(f"{BASE}/marketplace/jobs/{job_id}", json={"status": "awarded"},
                           headers=_auth(other), timeout=30)
        assert r.status_code in (403, 404), r.text
    finally:
        requests.delete(f"{BASE}/marketplace/jobs/{job_id}", headers=_auth(poster), timeout=30)


def test_a_status_outside_the_three_is_refused(poster):
    job_id = _job(poster)
    try:
        for bad in ("hired", "", "AWARDED"):
            r = requests.patch(f"{BASE}/marketplace/jobs/{job_id}", json={"status": bad},
                               headers=_auth(poster), timeout=30)
            assert r.status_code == 422, f"{bad!r} was accepted: {r.text}"
    finally:
        requests.delete(f"{BASE}/marketplace/jobs/{job_id}", headers=_auth(poster), timeout=30)
