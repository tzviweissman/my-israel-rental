"""Getting a copy of a contract: who may, who may not, and how.

The bug (dead-ends audit, 5 Sep 2026): both contract Download buttons
called `/contracts/download/{id}` through `window.open`, which cannot
attach an Authorization header. FastAPI's HTTPBearer answers a missing
header with 403, so the button failed for everyone - and on
/sign/:signToken it failed for someone with no account and no login to
route around it. They were being asked to sign a legal document they
could not obtain a copy of.

The fix is two-sided, and only half of it is a client change:

  * the owner's own list now fetches with its token (a client fix);
  * the external signer gets `/contracts/sign/{sign_token}/file`, keyed
    on the credential they actually hold.

So the tests below are mostly about the SECOND one, and about proving it
did not widen anything. The token was already enough to read the
agreement's text and to sign it; what it now also does is hand over the
file. A stranger without the token still gets nothing, and the
authenticated route is still closed to people who are not party to the
contract.

Runs against the live local API (see backend/tests/.env.test).
"""
import io
import os
import uuid
from datetime import UTC, datetime

import pytest
import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")

# A one-page PDF, written by hand so the test needs no fixture file and
# no library. The bytes only have to be a real PDF as far as the upload's
# content-type check and the download's byte comparison are concerned.
#
# DELIBERATELY NOT A RENDERABLE DOCUMENT: there is no content stream, so a
# viewer opens it as a blank sheet. Right for a byte-equality test, wrong
# for demonstrating the feature to anyone - which it has already been
# mistaken for once.
PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n"
    b"trailer<</Root 1 0 R>>\n%%EOF\n"
)


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _account(tag):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"contract-{tag}-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": f"Contract {tag}", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def subleasor():
    return _account("subleasor")


@pytest.fixture(scope="module")
def signed_link(subleasor):
    """A sublease with a contract on it, and the link sent to the signer."""
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/subleases", json={
        "title": f"TEST_sublease_{stamp}",
        "description": "A room for the summer, described at some length.",
        "area": "Jerusalem", "price": 4200, "price_type": "monthly",
        "available_from": "2026-10-01", "available_to": "2027-01-31",
    }, headers=_auth(subleasor), timeout=30)
    assert r.status_code in (200, 201), r.text
    sublease_id = r.json()["id"]

    r = requests.post(
        f"{BASE}/subleases/{sublease_id}/contract",
        files={"file": ("agreement.pdf", io.BytesIO(PDF), "application/pdf")},
        headers=_auth(subleasor), timeout=60,
    )
    assert r.status_code in (200, 201), r.text
    body = r.json()
    yield {"sublease_id": sublease_id, "contract_id": body["id"], "token": body["sign_token"]}
    requests.delete(f"{BASE}/contracts/{body['id']}", headers=_auth(subleasor), timeout=30)


# ---------------------------------------------- the signer, who has no account


def test_the_signer_can_download_what_they_are_being_asked_to_sign(signed_link):
    """No Authorization header at all - that is the whole point.

    This is the request the Download button makes on /sign/:signToken. It
    used to be a 403 with nothing the person could do about it.
    """
    r = requests.get(f"{BASE}/contracts/sign/{signed_link['token']}/file", timeout=30)
    assert r.status_code == 200, r.text
    assert r.content == PDF, "the bytes served are the file that was uploaded"
    assert "pdf" in r.headers.get("content-type", "").lower()
    # A download, not something the browser is invited to render.
    assert "attachment" in r.headers.get("content-disposition", "").lower()


def test_it_is_offered_as_the_name_it_was_uploaded_under(signed_link):
    r = requests.get(f"{BASE}/contracts/sign/{signed_link['token']}/file", timeout=30)
    assert "agreement.pdf" in r.headers.get("content-disposition", "")


def test_the_token_is_the_credential_and_a_wrong_one_gets_nothing(signed_link):
    for bad in (str(uuid.uuid4()), "not-a-token", signed_link["contract_id"]):
        r = requests.get(f"{BASE}/contracts/sign/{bad}/file", timeout=30)
        assert r.status_code == 404, f"{bad!r} was served: {r.status_code}"


def test_the_file_route_grants_nothing_the_token_did_not_already(signed_link):
    """The same token already returns the agreement's full text and already
    accepts a binding signature. Withholding the file protected nothing."""
    r = requests.get(f"{BASE}/contracts/sign/{signed_link['token']}", timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["id"] == signed_link["contract_id"]


# ------------------------------------------------- and nobody else gets in


def test_a_stranger_with_the_contract_id_still_gets_nothing(signed_link):
    """The id is not a credential, and the public sign payload contains it.

    Anyone who can read that payload can already read the contract, so this
    is not the boundary that matters - but the authenticated route must not
    have quietly become a second way in.
    """
    stranger = _account("stranger")
    r = requests.get(
        f"{BASE}/contracts/download/{signed_link['contract_id']}",
        headers=_auth(stranger), timeout=30,
    )
    assert r.status_code == 403, r.text


def test_the_owner_can_still_download_their_own(signed_link, subleasor):
    """The other half of the fix is a client change, so this only proves the
    endpoint the client now calls with its token was right all along."""
    r = requests.get(
        f"{BASE}/contracts/download/{signed_link['contract_id']}",
        headers=_auth(subleasor), timeout=30,
    )
    assert r.status_code == 200, r.text
    assert r.content == PDF


def test_no_header_still_means_no_contract_on_the_authenticated_route(signed_link):
    """And this is exactly the 403 the buttons were walking into."""
    r = requests.get(f"{BASE}/contracts/download/{signed_link['contract_id']}", timeout=30)
    assert r.status_code in (401, 403), r.text


def test_the_file_is_not_reachable_through_the_public_static_mount(signed_link):
    """The rule this whole area exists to keep (CLAUDE.md).

    A contract served from the uploads mount bypasses every check above.
    That bug shipped three separate times, and once cost a real contract
    permanently, so it is asserted rather than assumed.
    """
    for path in (
        f"/uploads/{signed_link['contract_id']}.pdf",
        f"/uploads/private_contracts/{signed_link['contract_id']}.pdf",
        f"/uploads/contracts/{signed_link['contract_id']}.pdf",
    ):
        r = requests.get(f"{BASE}{path}", timeout=30)
        assert r.status_code != 200 or r.content != PDF, f"{path} served the contract"
