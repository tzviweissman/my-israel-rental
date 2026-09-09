"""Who is allowed to put a signature on a contract.

The bug (site audit, 8 Sep 2026): `POST /contracts/{contract_id}/sign`
depended on `verify_token` and nothing else. `verify_token` only proves
that SOMEBODY is logged in - it says nothing about whether that somebody
has any relationship to the contract in the URL. The body carries the
signer's name and the signature image, both client-supplied, and the
handler wrote them straight into `signatures[]` and set `signed: true`.

So any account on the site could sign any lease agreement on the site,
under any name, and the document would afterwards report itself as
signed. Contract ids are not secret - the public signing payload contains
one - so this was not even gated by having to guess an id.

The fix reuses `_may_access_contract`, the same owner / renter-with-a-
matching-booking / admin test that already gates reading the file. Signing
is the stronger act of the two, so it should never have had the weaker
gate.

Note what is deliberately NOT changed: the external sublessee who has no
account still signs through `POST /contracts/sign/{sign_token}`, keyed on
the token they were sent. That flow never went through this route.

Runs against the live local API (see backend/tests/.env.test).
"""
import io
import os
from datetime import UTC, datetime

import pytest
import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")

PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n"
    b"trailer<</Root 1 0 R>>\n%%EOF\n"
)

# A believable forgery, not a marker string: the point of the finding is
# that the endpoint accepted a real-looking signature from a stranger.
FORGED_NAME = "Yosef Ben-David"
FORGED_INK = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _account(tag):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"signauth-{tag}-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": f"Sign {tag}", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def owner():
    return _account("owner")


@pytest.fixture(scope="module")
def stranger():
    return _account("stranger")


@pytest.fixture(scope="module")
def contract(owner):
    """A sublease with a contract uploaded against it."""
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/subleases", json={
        "title": f"TEST_signauth_{stamp}",
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
    yield {"id": body["id"], "sign_token": body["sign_token"]}
    requests.delete(f"{BASE}/contracts/{body['id']}", headers=_auth(owner), timeout=30)


# --------------------------------------------------------- the actual finding


def test_a_stranger_cannot_sign_someone_elses_contract(contract, stranger):
    r = requests.post(
        f"{BASE}/contracts/{contract['id']}/sign",
        json={"contract_id": contract["id"], "signer_name": FORGED_NAME,
              "signature_data": FORGED_INK},
        headers=_auth(stranger), timeout=30,
    )
    assert r.status_code == 403, r.text


def test_the_refused_signature_did_not_land_anyway(contract, stranger, owner):
    """A 403 that still wrote the row would be the same bug with a nicer
    status code, so read the contract back as someone entitled to see it."""
    requests.post(
        f"{BASE}/contracts/{contract['id']}/sign",
        json={"contract_id": contract["id"], "signer_name": FORGED_NAME,
              "signature_data": FORGED_INK},
        headers=_auth(stranger), timeout=30,
    )
    r = requests.get(f"{BASE}/contracts/sign/{contract['sign_token']}", timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert not body.get("signed"), "the contract reports itself signed after a refused signature"
    names = [s.get("signer_name") for s in (body.get("signatures") or [])]
    assert FORGED_NAME not in names, f"the forged signature was stored anyway: {names}"


def test_signing_with_no_account_at_all_is_refused(contract):
    r = requests.post(
        f"{BASE}/contracts/{contract['id']}/sign",
        json={"contract_id": contract["id"], "signer_name": FORGED_NAME,
              "signature_data": FORGED_INK},
        timeout=30,
    )
    assert r.status_code in (401, 403), r.text


# ------------------------------------------ and the people who should, still can


def test_the_owner_can_still_sign_their_own_contract(contract, owner):
    """The gate has to close on strangers without closing on the parties."""
    r = requests.post(
        f"{BASE}/contracts/{contract['id']}/sign",
        json={"contract_id": contract["id"], "signer_name": "Contract Owner",
              "signature_data": FORGED_INK},
        headers=_auth(owner), timeout=30,
    )
    assert r.status_code == 200, r.text
    assert r.json().get("signed_at")


def test_the_token_holder_route_is_untouched(contract):
    """The sublessee has no account; their signature goes through the
    sign_token route, which this fix must not have caught in its net."""
    r = requests.get(f"{BASE}/contracts/sign/{contract['sign_token']}", timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["id"] == contract["id"]
