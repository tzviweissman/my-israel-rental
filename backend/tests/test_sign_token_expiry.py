"""A signing link stops working a month after the contract is signed.

The bug (UI audit, 10 Sep 2026, finding 7): `sign_token` is an unguessable
UUID4, so this was never an IDOR - but it had no deadline of any kind and
was not invalidated once the contract was signed. `GET /contracts/sign/
{token}` and its `/file` sibling accepted it indefinitely, so a forwarded
link, a screenshot, or browser history on a shared device kept serving a
finished legal agreement to whoever held it, forever.

WHAT THIS FIXES AND WHAT IT DELIBERATELY DOES NOT. The deadline starts at
the SIGNATURE, not at the upload. An unsigned link still has no expiry, and
that is a decision with a reason: it is held by an external person with no
account here, the owner's only control over it is a "copy link" button with
no way to mint a fresh one, and expiring it would strand a live signature
request with nothing either party could click. The rationale is written out
at `utils/contract_files.SIGN_TOKEN_GRACE_DAYS`; the test at the bottom
holds that half in place so it cannot be "tidied up" into a dead end.

The window has to be generous because this link is the signer's ONLY route
to their own executed copy - `/contracts/sign/{token}/file` serves the
signed PDF once one exists, and that person cannot authenticate to fetch it
any other way.

Needs the live local API and the local Mongo (see backend/tests/.env.test).
"""
from __future__ import annotations

import io
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

from pymongo import MongoClient  # noqa: E402

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")

# Same hand-written blank PDF the sibling contract tests use: enough to pass
# the upload's content-type check, not a renderable document.
PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n"
    b"trailer<</Root 1 0 R>>\n%%EOF\n"
)

# A 1x1 transparent PNG, as the signature pad's toDataURL would produce.
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
        "email": f"signexp-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": "Sign Expiry Owner", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


@pytest.fixture()
def contract(owner):
    """A sublease with a contract on it, and the link sent to the signer."""
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/subleases", json={
        "title": f"TEST_signexp_{stamp}",
        "description": "A room for the summer, described at some length.",
        "area": "Jerusalem", "price": 4200, "price_type": "monthly",
        "available_from": "2026-10-01", "available_to": "2027-01-31",
    }, headers=_auth(owner), timeout=30)
    assert r.status_code in (200, 201), r.text
    sublease_id = r.json()["id"]

    r = requests.post(
        f"{BASE}/subleases/{sublease_id}/contract",
        files={"file": ("agreement.pdf", io.BytesIO(PDF), "application/pdf")},
        headers=_auth(owner), timeout=60,
    )
    assert r.status_code in (200, 201), r.text
    body = r.json()
    yield {"id": body["id"], "token": body["sign_token"]}
    requests.delete(f"{BASE}/contracts/{body['id']}", headers=_auth(owner), timeout=30)


@pytest.fixture()
def db():
    """The SYNCHRONOUS driver on purpose.

    motor binds its client to the event loop alive when it is created, and
    a test that makes its own loop per call hands the second call a future
    from the first one's loop. These tests only need to read a field and
    back-date another, so they take the driver that has no loop at all.
    """
    client = MongoClient(os.environ["MONGO_URL"])
    return client[os.environ["DB_NAME"]]


def _sign(token):
    return requests.post(f"{BASE}/contracts/sign/{token}", json={
        "signer_name": "Dana Levi", "signature_data": SIGNATURE,
    }, timeout=60)


def _backdate(db, contract_id, when):
    """Move a contract's deadline into the past without waiting a month."""
    db.contracts.update_one(
        {"id": contract_id},
        {"$set": {"sign_token_expires_at": when.isoformat()}},
    )


def test_unsigned_link_has_no_deadline(contract):
    """An unsigned link keeps working. This is the half we did NOT expire.

    If someone later adds an upload-dated expiry without also building the
    owner a "send a new link" action, this fails - which is the point.
    """
    r = requests.get(f"{BASE}/contracts/sign/{contract['token']}", timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["signed"] is False


def test_signing_sets_a_deadline_about_a_month_out(contract, db):
    assert _sign(contract["token"]).status_code in (200, 201)

    row = db.contracts.find_one(
        {"id": contract["id"]}, {"_id": 0, "sign_token_expires_at": 1}
    )
    assert row and row.get("sign_token_expires_at"), "signing must stamp a deadline"

    deadline = datetime.fromisoformat(row["sign_token_expires_at"])
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=UTC)
    days = (deadline - datetime.now(UTC)).days
    assert 28 <= days <= 31, f"expected roughly a month, got {days} days"


def test_the_signer_can_still_fetch_their_copy_right_after_signing(contract):
    """The grace window is the whole reason the deadline is not immediate."""
    assert _sign(contract["token"]).status_code in (200, 201)

    r = requests.get(f"{BASE}/contracts/sign/{contract['token']}", timeout=30)
    assert r.status_code == 200, r.text

    r = requests.get(f"{BASE}/contracts/sign/{contract['token']}/file", timeout=60)
    assert r.status_code == 200, r.text
    assert r.content, "the executed copy must still be downloadable"


def test_an_expired_link_is_refused_on_every_route_that_accepts_one(contract, db):
    """All three routes, because they do not live in the same file.

    Two are in routes/subleases.py and the one serving BYTES is in
    routes/contracts.py. A rule written at the call sites is a rule that
    reaches two of them, which is why they share one resolver.
    """
    assert _sign(contract["token"]).status_code in (200, 201)
    _backdate(db, contract["id"], datetime.now(UTC) - timedelta(days=1))

    token = contract["token"]
    read = requests.get(f"{BASE}/contracts/sign/{token}", timeout=30)
    assert read.status_code == 410, f"read: {read.status_code} {read.text}"
    assert "expired" in read.json()["detail"].lower()

    file = requests.get(f"{BASE}/contracts/sign/{token}/file", timeout=30)
    assert file.status_code == 410, f"file: {file.status_code} {file.text}"

    # Already signed, so this would be refused anyway - but it must be
    # refused by the deadline too, not only by the "signed once" guard.
    sign = _sign(token)
    assert sign.status_code == 410, f"sign: {sign.status_code} {sign.text}"


def test_an_unknown_link_still_says_not_found_not_expired():
    """404 and 410 mean different things and the difference is the point:
    'this was never real' vs 'this was real and is now closed'."""
    r = requests.get(f"{BASE}/contracts/sign/not-a-real-token", timeout=30)
    assert r.status_code == 404, r.text
