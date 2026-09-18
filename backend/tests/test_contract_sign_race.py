"""Two people signing the same contract link at the same moment: one wins.

The 17 Sep audit pointed out that `sign_contract_public` had the exact
read-check-then-write shape the order-status fix had just closed one file
over: it read `signed`, refused if true, then wrote unconditionally. Two
POSTs racing through the same emailed link could both pass the check, and
the second would push a second signature and rebuild the PDF over the
first person's.

The write now carries `"signed": {"$ne": True}` in its filter, so only one
can land. Tested the same way as the order race: real simultaneous requests
from threads, and an invariant that holds either way - the stored contract
ends with EXACTLY one signature, whoever won.

Needs the live local API and the local Mongo (see backend/tests/.env.test).
"""
from __future__ import annotations

import io
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

from pymongo import MongoClient  # noqa: E402

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")
ROUNDS = 8

PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n"
    b"trailer<</Root 1 0 R>>\n%%EOF\n"
)
SIGNATURE = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def owner():
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"signrace-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": "Sign Race Owner", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _fresh_contract(owner):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/subleases", json={
        "title": f"TEST_signrace_{stamp}",
        "description": "A room for the summer, described at some length.",
        "area": "Jerusalem", "price": 4200, "price_type": "monthly",
        "available_from": "2026-10-01", "available_to": "2027-01-31",
    }, headers=_auth(owner), timeout=30)
    assert r.status_code in (200, 201), r.text
    r = requests.post(
        f"{BASE}/subleases/{r.json()['id']}/contract",
        files={"file": ("agreement.pdf", io.BytesIO(PDF), "application/pdf")},
        headers=_auth(owner), timeout=60,
    )
    assert r.status_code in (200, 201), r.text
    return r.json()["id"], r.json()["sign_token"]


def _sign(token, name):
    return requests.post(f"{BASE}/contracts/sign/{token}", json={
        "signer_name": name, "signature_data": SIGNATURE,
    }, timeout=60)


def test_simultaneous_signatures_leave_exactly_one(owner, db):
    collisions = 0
    for _ in range(ROUNDS):
        contract_id, token = _fresh_contract(owner)
        with ThreadPoolExecutor(max_workers=2) as pool:
            a = pool.submit(_sign, token, "Dana Levi")
            b = pool.submit(_sign, token, "Yossi Katz")
            results = [a.result(), b.result()]

        won = [r for r in results if r.status_code in (200, 201)]
        refused = [r for r in results if r.status_code in (400, 409)]
        assert len(won) == 1, f"exactly one signature must be accepted: {[r.status_code for r in results]}"
        assert len(refused) == 1, [r.text for r in results]
        if refused[0].status_code == 409:
            collisions += 1

        row = db.contracts.find_one({"id": contract_id}, {"signatures": 1, "signed": 1})
        assert row["signed"] is True
        assert len(row["signatures"]) == 1, (
            f"the contract holds {len(row['signatures'])} signatures - the race wrote twice"
        )
        requests.delete(f"{BASE}/contracts/{contract_id}", headers=_auth(owner), timeout=30)

    if collisions == 0:
        pytest.skip(f"{ROUNDS} rounds and the two signatures never overlapped - nothing proven")
