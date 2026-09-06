"""A signed booking contract is private, and the parties can actually get it.

Two bugs, both from `_stamp_contract_if_present` deciding for itself where
contract files live.

  1. IT READ FROM THE WRONG PLACE. Property contracts moved to
     CONTRACT_DIR when the public-uploads leak was closed; this was left
     pointing at `uploads/`. For every contract uploaded since, the renter
     pressing Sign got "Contract file not found" - on the step that
     confirms their booking.

  2. IT WROTE TO A PUBLIC ONE. The signed copy went into `uploads/`, which
     IS mounted as StaticFiles. A signed rental agreement carrying two
     people's names, ID numbers and signatures was fetchable by anyone with
     the URL. And because `GET /bookings/{id}/signed-contract` looked in
     CONTRACT_DIR all along, the parties themselves got a 404 while a
     stranger with the URL got the file.

The second is why this file exists rather than a comment. A leak that also
breaks the feature is easy to notice; a leak that leaves the feature
working is not, and the next version of this mistake might.

Runs against the live local API (see backend/tests/.env.test).
"""
import io
import os
from datetime import UTC, datetime, timedelta

import pytest
import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")


def _real_pdf(pages: int = 1) -> bytes:
    from io import BytesIO
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    for i in range(pages):
        c.setFont("Helvetica", 12)
        c.drawString(72, 720, f"Owner's rental contract, page {i + 1}")
        c.showPage()
    c.save()
    return buf.getvalue()


PDF = _real_pdf()
import base64 as _b64

SIGNATURE = "data:image/png;base64," + _b64.b64encode(_b64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAE0lEQVR4nGM8cekOAwwwwVl4"
    "OQB7/AJ+fD4b6gAAAABJRU5ErkJggg=="
)).decode()


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _account(tag):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    role = "renter" if tag == "renter" else "owner"
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"bc-{tag}-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": f"Booking {tag}", "role": role,
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()


@pytest.fixture(scope="module")
def owner():
    return _account("owner")


@pytest.fixture(scope="module")
def renter():
    return _account("renter")


@pytest.fixture(scope="module")
def signed_booking(owner, renter):
    """A booking the renter has signed, on a property with a contract."""
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/properties", json={
        "title": f"TEST_bc_{stamp}", "rental_type": "long-term",
        "property_type": "apartment", "area": "Jerusalem", "bedrooms": 2,
        "monthly_price": 5200, "currency": "ILS",
    }, headers=_auth(owner["token"]), timeout=30)
    assert r.status_code in (200, 201), r.text
    property_id = r.json()["id"]

    # The owner's contract. This lands in CONTRACT_DIR; the whole point of
    # bug 1 is that the signing path was looking somewhere else.
    r = requests.post(
        f"{BASE}/properties/{property_id}/contract",
        files={"file": ("owner-contract.pdf", io.BytesIO(PDF), "application/pdf")},
        headers=_auth(owner["token"]), timeout=60,
    )
    assert r.status_code in (200, 201), r.text

    # `start_date`/`end_date`, not check_in/check_out - the first draft of
    # this fixture used the latter, every test SKIPPED, and a suite that
    # skips is a suite that proves nothing. Asserted rather than skipped
    # now, so a broken fixture fails loudly instead of going quiet.
    start = (datetime.now(UTC) + timedelta(days=30)).date()
    r = requests.post(f"{BASE}/bookings", json={
        "property_id": property_id,
        "start_date": start.isoformat(),
        "end_date": (start + timedelta(days=60)).isoformat(),
        "message": "Booking for the contract-privacy check.",
    }, headers=_auth(renter["token"]), timeout=30)
    assert r.status_code in (200, 201), r.text
    booking_id = r.json()["id"]

    r = requests.post(f"{BASE}/bookings/{booking_id}/accept", json={},
                      headers=_auth(owner["token"]), timeout=60)
    assert r.status_code in (200, 201), r.text

    r = requests.post(f"{BASE}/bookings/{booking_id}/sign-contract", json={
        "signature_data": SIGNATURE, "legal_name": "Rivka Adler",
        "signature_x": 60, "signature_y": 600, "signature_width": 200,
        "signature_height": 80, "display_width": 595, "display_height": 842,
    }, headers=_auth(renter["token"]), timeout=90)
    assert r.status_code == 200, r.text
    return {"booking_id": booking_id, "property_id": property_id, "body": r.json()}


def test_signing_succeeds_now_that_it_looks_where_contracts_live(signed_booking):
    """Bug 1. This used to be a 404 on the step that confirms a booking."""
    assert signed_booking["body"].get("signed_contract_url"), signed_booking["body"]
    assert signed_booking["body"].get("booking_status") == "confirmed"


def test_the_parties_can_download_the_signed_contract(signed_booking, owner, renter):
    """The other half of bug 1: the reader looked in CONTRACT_DIR all along,
    so it could never find what the writer put in `uploads/`."""
    for who in (owner, renter):
        r = requests.get(f"{BASE}/bookings/{signed_booking['booking_id']}/signed-contract",
                         headers=_auth(who["token"]), timeout=30)
        assert r.status_code == 200, r.text
        assert r.content[:4] == b"%PDF"


def test_the_signed_contract_is_not_on_the_public_mount(signed_booking, owner):
    """Bug 2, and the one that matters most.

    `uploads/` is mounted as StaticFiles. Anything written there is
    downloadable by anyone holding the URL, with no permission check.
    """
    url = signed_booking["body"]["signed_contract_url"]
    filename = url.rsplit("/", 1)[-1]
    private = requests.get(
        f"{BASE}/bookings/{signed_booking['booking_id']}/signed-contract",
        headers=_auth(owner["token"]), timeout=30,
    ).content
    for path in (url, f"/uploads/{filename}", f"/api/uploads/{filename}"):
        r = requests.get(f"{BASE.replace('/api', '')}{path}", timeout=30)
        assert r.status_code != 200 or r.content != private, f"{path} served the signed contract"


def test_a_stranger_cannot_read_it_through_the_endpoint_either(signed_booking):
    stranger = _account("stranger")
    r = requests.get(f"{BASE}/bookings/{signed_booking['booking_id']}/signed-contract",
                     headers=_auth(stranger["token"]), timeout=30)
    assert r.status_code in (403, 404), r.text


def test_the_owners_own_contract_is_still_private_too(signed_booking, owner):
    """The source document, not just the signed copy."""
    r = requests.get(f"{BASE}/properties/{signed_booking['property_id']}/contract-file",
                     headers=_auth(owner["token"]), timeout=30)
    assert r.status_code == 200, r.text
    assert r.content == PDF
    anon = requests.get(f"{BASE}/properties/{signed_booking['property_id']}/contract-file", timeout=30)
    assert anon.status_code in (401, 403), anon.text
