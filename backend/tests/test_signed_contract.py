"""After someone signs, there is a document that shows it.

Before this, the signature lived beside the contract rather than on it: a
PNG in `contracts.signatures[]`, and a Download button that handed back the
original, unsigned file. Both parties could see a signature existed;
neither had anything to send a lawyer, a bank or a Beit Din.

What is asserted here, and why each one:

  * the signed copy exists and is one page longer than the original - the
    agreement is intact and the signature page is after it, never over it;
  * BOTH parties get the SAME document. Two routes choosing separately is
    how an owner and a signer end up holding different papers;
  * before signing, the same URL still serves the original, so nobody has
    to know about a second endpoint;
  * a lost signed file falls back to the original rather than 404ing - a
    derived file must not take the document with it;
  * it is not reachable through the public uploads mount, which is the
    rule this whole area exists to keep (CLAUDE.md).

Runs against the live local API (see backend/tests/.env.test).
"""
import io
import os
from datetime import UTC, datetime

import pytest
import requests

BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")

def _real_pdf(pages: int = 2) -> bytes:
    """A PDF a PDF library can actually open.

    Written properly rather than hand-typed, and the difference mattered:
    the first version of this fixture was a five-line skeleton with no xref
    table. PyPDF2 could not read it, so the signed copy was never built, the
    endpoint fell back to the original - and `both_parties_get_the_same_
    document` PASSED, because both sides returned the same unsigned file. A
    fixture that cannot be parsed turns an assertion about signing into an
    assertion about nothing.
    """
    from io import BytesIO as _B
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas as _canvas

    buf = _B()
    c = _canvas.Canvas(buf, pagesize=A4)
    for i in range(pages):
        c.setFont("Helvetica", 12)
        c.drawString(72, 720, f"Rental agreement, page {i + 1}")
        c.showPage()
    c.save()
    return buf.getvalue()


PDF = _real_pdf(2)

# A real 4x4 PNG, used both as an uploaded "photographed contract" and as
# the signature. Small, valid, and decodable by Pillow - which matters,
# because a fixture that is not really an image would exercise the failure
# path and quietly pass for the wrong reason.
import base64 as _b64

PNG = _b64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAE0lEQVR4nGM8cekOAwwwwVl4"
    "OQB7/AJ+fD4b6gAAAABJRU5ErkJggg=="
)
SIGNATURE = "data:image/png;base64," + _b64.b64encode(PNG).decode()


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def owner():
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": f"signed-{stamp}@example.com", "password": f"Pw-{stamp}-ok1",
        "name": "Signed Owner", "role": "owner",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def sublease(owner):
    stamp = datetime.now(UTC).strftime("%H%M%S%f")
    r = requests.post(f"{BASE}/subleases", json={
        "title": f"TEST_signed_{stamp}",
        "description": "A room for the summer, described at some length.",
        "area": "Jerusalem", "price": 4200, "price_type": "monthly",
        "available_from": "2026-10-01", "available_to": "2027-01-31",
    }, headers=_auth(owner), timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _upload(owner, sublease_id, name, blob, mime):
    r = requests.post(
        f"{BASE}/subleases/{sublease_id}/contract",
        files={"file": (name, io.BytesIO(blob), mime)},
        headers=_auth(owner), timeout=60,
    )
    assert r.status_code in (200, 201), r.text
    return r.json()


def _sign(token, name="Rivka Adler"):
    r = requests.post(f"{BASE}/contracts/sign/{token}",
                      json={"signer_name": name, "signature_data": SIGNATURE}, timeout=60)
    assert r.status_code == 200, r.text


def _download(token):
    r = requests.get(f"{BASE}/contracts/sign/{token}/file", timeout=30)
    assert r.status_code == 200, r.text
    return r


def _pages(content):
    from PyPDF2 import PdfReader
    return PdfReader(io.BytesIO(content)).pages


def _last_page_text(content):
    return _pages(content)[-1].extract_text() or ""


def test_a_signed_pdf_appears_and_the_agreement_is_intact(owner, sublease):
    up = _upload(owner, sublease, "agreement.pdf", PDF, "application/pdf")
    try:
        before = _download(up["sign_token"])
        assert before.content == PDF, "before signing, the original is what is served"

        _sign(up["sign_token"])
        after = _download(up["sign_token"])
        assert after.content != PDF
        assert len(_pages(after.content)) == len(_pages(PDF)) + 1, \
            "every original page, then one signature page"
        text = _last_page_text(after.content)
        assert "Rivka Adler" in text
        assert "agreement.pdf" in text, "named as the owner named it, not as it is stored"
        assert "SHA-256" in text
        # RFC 5987: a filename with brackets and a space arrives
        # percent-encoded, so `(signed)` never appears literally.
        disposition = after.headers.get("content-disposition", "")
        assert "%28signed%29" in disposition or "(signed)" in disposition, disposition
    finally:
        requests.delete(f"{BASE}/contracts/{up['id']}", headers=_auth(owner), timeout=30)


def test_both_parties_get_the_same_document(owner, sublease):
    up = _upload(owner, sublease, "agreement.pdf", PDF, "application/pdf")
    try:
        _sign(up["sign_token"])
        signer = _download(up["sign_token"]).content
        ownerside = requests.get(f"{BASE}/contracts/download/{up['id']}",
                                 headers=_auth(owner), timeout=30)
        assert ownerside.status_code == 200, ownerside.text
        assert ownerside.content == signer, \
            "the owner and the signer must not hold different papers"
    finally:
        requests.delete(f"{BASE}/contracts/{up['id']}", headers=_auth(owner), timeout=30)


def test_a_photographed_contract_becomes_a_two_page_pdf(owner, sublease):
    """An upload does not have to be a PDF, so neither can this."""
    up = _upload(owner, sublease, "agreement.png", PNG, "image/png")
    try:
        _sign(up["sign_token"])
        got = _download(up["sign_token"])
        assert "pdf" in got.headers.get("content-type", "").lower()
        assert len(_pages(got.content)) == 2, "the photo, then the signature page"
        assert "Rivka Adler" in _last_page_text(got.content)
    finally:
        requests.delete(f"{BASE}/contracts/{up['id']}", headers=_auth(owner), timeout=30)


def test_a_word_document_still_produces_a_signature_page(owner, sublease):
    """DOCX cannot be rendered without a converter this project does not
    have. The signature page is produced anyway, says so, and carries the
    fingerprint that ties it to the file - which is better than a signing
    flow that silently produces nothing for one upload type."""
    docx = b"PK\x03\x04" + b"\x00" * 64          # enough to be accepted and stored
    up = _upload(
        owner, sublease, "agreement.docx", docx,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    try:
        _sign(up["sign_token"])
        got = _download(up["sign_token"])
        pages = _pages(got.content)
        assert len(pages) == 1
        text = pages[0].extract_text() or ""
        assert "Rivka Adler" in text
        assert "Word file" in text, "says plainly why the document itself is not attached"
    finally:
        requests.delete(f"{BASE}/contracts/{up['id']}", headers=_auth(owner), timeout=30)


def test_signing_still_succeeds_if_the_pdf_cannot_be_built(owner, sublease):
    """The signature is the part that cannot be recreated.

    A rendering failure must never cost it: the signer has closed the tab.
    Simulated with a file that is stored but is not a readable PDF.
    """
    up = _upload(owner, sublease, "broken.pdf", b"%PDF-1.4\nnot really a pdf\n", "application/pdf")
    try:
        _sign(up["sign_token"], name="Yosef Mizrahi")
        state = requests.get(f"{BASE}/contracts/sign/{up['sign_token']}", timeout=30).json()
        assert state["signed"] is True
        assert state["signatures"][0]["signer_name"] == "Yosef Mizrahi"
        # And the original is still downloadable rather than 404.
        assert _download(up["sign_token"]).status_code == 200
    finally:
        requests.delete(f"{BASE}/contracts/{up['id']}", headers=_auth(owner), timeout=30)


def test_the_signed_copy_is_not_on_the_public_mount(owner, sublease):
    up = _upload(owner, sublease, "agreement.pdf", PDF, "application/pdf")
    try:
        _sign(up["sign_token"])
        signed = _download(up["sign_token"]).content
        for path in (
            f"/uploads/signed_{up['id']}.pdf",
            f"/uploads/private_contracts/signed_{up['id']}.pdf",
        ):
            r = requests.get(f"{BASE}{path}", timeout=30)
            assert r.status_code != 200 or r.content != signed, f"{path} served it"
    finally:
        requests.delete(f"{BASE}/contracts/{up['id']}", headers=_auth(owner), timeout=30)


def test_a_stranger_still_cannot_read_the_signed_copy(owner, sublease):
    up = _upload(owner, sublease, "agreement.pdf", PDF, "application/pdf")
    try:
        _sign(up["sign_token"])
        assert requests.get(f"{BASE}/contracts/download/{up['id']}", timeout=30).status_code in (401, 403)
        assert requests.get(f"{BASE}/contracts/sign/not-the-token/file", timeout=30).status_code == 404
    finally:
        requests.delete(f"{BASE}/contracts/{up['id']}", headers=_auth(owner), timeout=30)
