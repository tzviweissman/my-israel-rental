"""Backend integration test for the job-scoped chat feature (iter 62).

Flow:
 1. Login as poster (renter) and applicant (owner).
 2. Poster creates a job via /api/marketplace/jobs.
 3. Applicant applies to job.
 4. Poster fetches applications → gets applicant.user_id.
 5. Poster sends a chat message with property_id=<job_id>, receiver=applicant.
 6. Applicant GET /chat/conversations → sees thread with property_title='Job: ...'
    and is_job_thread=True.
 7. Applicant sends a reply. Poster GET /chat/conversations sees same title.
 8. Poster GET /chat/messages/<job_id>?with_user=<applicant> returns 2 messages.
 9. Edge case: GET /api/marketplace/jobs/<fake_uuid> returns 404 → confirms fallback logic guard.
10. Cleanup: DELETE the job.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://where-am-i-project.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} → {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def poster_token():
    return _login("renter@test.com", "Test1234!")


@pytest.fixture(scope="module")
def applicant_token():
    return _login("owner@test.com", "Test1234!")


@pytest.fixture(scope="module")
def me_ids(poster_token, applicant_token):
    poster = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {poster_token}"}, timeout=30).json()
    applicant = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {applicant_token}"}, timeout=30).json()
    return {"poster_id": poster["id"], "applicant_id": applicant["id"]}


@pytest.fixture(scope="module")
def job(poster_token):
    payload = {
        "title": "TEST_ChatIntegration_Job_iter62",
        "description": "Backend integration test — should be deleted at end.",
        "category": "home-repair",
        "area": "Tel Aviv",
        "budget_type": "open",
    }
    r = requests.post(
        f"{API}/marketplace/jobs",
        json=payload,
        headers={"Authorization": f"Bearer {poster_token}"},
        timeout=30,
    )
    assert r.status_code in (200, 201), f"create job → {r.status_code} {r.text}"
    j = r.json()
    yield j
    # cleanup
    requests.delete(
        f"{API}/marketplace/jobs/{j['id']}",
        headers={"Authorization": f"Bearer {poster_token}"},
        timeout=30,
    )


class TestJobChatIntegration:
    def test_apply_to_job(self, job, applicant_token, me_ids):
        r = requests.post(
            f"{API}/marketplace/jobs/{job['id']}/apply",
            json={"message": "I can help with this move. TEST", "quoted_price": 500, "quoted_currency": "ILS"},
            headers={"Authorization": f"Bearer {applicant_token}"},
            timeout=30,
        )
        assert r.status_code in (200, 201), f"apply → {r.status_code} {r.text}"

    def test_poster_sees_application(self, job, poster_token, me_ids):
        r = requests.get(
            f"{API}/marketplace/jobs/{job['id']}/applications",
            headers={"Authorization": f"Bearer {poster_token}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        apps = r.json()
        assert len(apps) >= 1
        # Applicant user_id in enriched provider block
        app0 = apps[0]
        provider = app0.get("provider") or {}
        assert provider.get("user_id") == me_ids["applicant_id"], f"applicant user_id mismatch: {provider}"

    def test_job_fetch_endpoint(self, job):
        # This is what Chat.js falls back to when /properties/{id} returns 404.
        r = requests.get(f"{API}/marketplace/jobs/{job['id']}", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["id"] == job["id"]
        assert data["title"] == "TEST_ChatIntegration_Job_iter62"
        assert data["area"] == "Tel Aviv"
        assert data["budget_type"] == "open"
        assert "poster_user_id" in data

    def test_property_endpoint_returns_404_for_job_id(self, job):
        # Confirms the fallback trigger works — /properties/{job_id} must 404.
        r = requests.get(f"{API}/properties/{job['id']}", timeout=30)
        assert r.status_code == 404, f"expected 404, got {r.status_code}"

    def test_poster_sends_message(self, job, poster_token, me_ids):
        r = requests.post(
            f"{API}/chat/messages",
            json={
                "property_id": job["id"],
                "receiver_id": me_ids["applicant_id"],
                "message": "TEST poster-to-applicant iter62",
            },
            headers={"Authorization": f"Bearer {poster_token}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert "id" in r.json()

    def test_applicant_conversations_has_job_thread(self, job, applicant_token):
        r = requests.get(
            f"{API}/chat/conversations",
            headers={"Authorization": f"Bearer {applicant_token}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        convs = r.json()
        match = [c for c in convs if c.get("property_id") == job["id"]]
        assert len(match) == 1, f"expected exactly 1 conv for job {job['id']}, got {len(match)}: {[c.get('property_id') for c in convs]}"
        c = match[0]
        assert c["property_title"] == f"Job: TEST_ChatIntegration_Job_iter62", c
        assert c.get("is_job_thread") is True, c
        assert c.get("property_missing") is False, c
        assert c["last_message"] == "TEST poster-to-applicant iter62"

    def test_applicant_sends_reply(self, job, applicant_token, me_ids):
        r = requests.post(
            f"{API}/chat/messages",
            json={
                "property_id": job["id"],
                "receiver_id": me_ids["poster_id"],
                "message": "TEST applicant reply iter62",
            },
            headers={"Authorization": f"Bearer {applicant_token}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text

    def test_poster_sees_two_messages(self, job, poster_token, me_ids):
        r = requests.get(
            f"{API}/chat/messages/{job['id']}?with_user={me_ids['applicant_id']}",
            headers={"Authorization": f"Bearer {poster_token}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        msgs = r.json()
        bodies = [m["message"] for m in msgs]
        assert "TEST poster-to-applicant iter62" in bodies
        assert "TEST applicant reply iter62" in bodies

    def test_poster_conversations_has_job_thread(self, job, poster_token):
        r = requests.get(
            f"{API}/chat/conversations",
            headers={"Authorization": f"Bearer {poster_token}"},
            timeout=30,
        )
        assert r.status_code == 200
        convs = r.json()
        match = [c for c in convs if c.get("property_id") == job["id"]]
        assert len(match) == 1
        c = match[0]
        assert c["property_title"].startswith("Job: ")
        assert c.get("is_job_thread") is True

    def test_orphan_uuid_conversations_graceful(self, poster_token, applicant_token, me_ids):
        # Send a message on a totally fake UUID; conversations endpoint must still work.
        fake_id = str(uuid.uuid4())
        r = requests.post(
            f"{API}/chat/messages",
            json={
                "property_id": fake_id,
                "receiver_id": me_ids["applicant_id"],
                "message": "TEST orphan uuid iter62",
            },
            headers={"Authorization": f"Bearer {poster_token}"},
            timeout=30,
        )
        assert r.status_code == 200
        # Confirm conversations returns 'Unknown' + property_missing:true, is_job_thread:false
        r2 = requests.get(
            f"{API}/chat/conversations",
            headers={"Authorization": f"Bearer {applicant_token}"},
            timeout=30,
        )
        assert r2.status_code == 200
        orphan = [c for c in r2.json() if c.get("property_id") == fake_id]
        assert len(orphan) == 1
        assert orphan[0].get("property_missing") is True
        assert orphan[0].get("is_job_thread") is False
        assert orphan[0]["property_title"] == "Unknown"
