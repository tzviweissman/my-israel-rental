"""Where a courier's proof-of-delivery photo is allowed to point.

The bug (site audit, 8 Sep 2026): `photo_url` on the courier's status
update was length-checked and nothing else - no scheme check, no host
check. That value is embedded as `<img src="...">` in the "Delivered"
email the platform sends under its own sender identity, and returned
verbatim from the unauthenticated tracking page an anonymous customer
opens after following a "where's my order" link.

The floor is a cross-site tracking pixel firing whenever the shop owner
or the customer opens that mail, from a courier account that only has to
be compromised rather than malicious. `utils/payment_links.py` exists in
this codebase for exactly this shape of problem - an arbitrary URL
rendered on a surface carrying our name - and `photo_url` had none of
that posture.

The allowlist is deliberately narrow: the two places this app's own
uploader actually puts files. `frontend/src/utils/fastUpload.js` posts
direct to Cloudinary and stores the returned secure_url; when Cloudinary
is unconfigured, `_store_upload` writes to local disk and returns the
`/api/uploads/...` path. Nothing else has a reason to appear here.

The host-matching tests are the ones that matter most: the near-miss
spellings are how an allowlist gets bypassed, and payment_links pins the
same three against `evil-paybox.co.il` for the same reason.
"""
from __future__ import annotations

import pytest

from utils.media_url import MAX_MEDIA_URL_LEN, is_allowed_media_url


# ------------------------------------------------- what the app itself makes

@pytest.mark.parametrize("url", [
    "https://res.cloudinary.com/demo/image/upload/v1699/orders/abc.jpg",
    # Cloudinary URLs carry transforms and, for authenticated assets, a
    # signature segment; none of that changes the host.
    "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/abc.jpg",
    "https://api.cloudinary.com/v1_1/demo/image/upload",
    # A trailing dot is a valid FQDN form that plain string comparison misses.
    "https://res.cloudinary.com./demo/image/upload/v1/abc.jpg",
    # The local-disk fallback, which a preview or self-hosted environment
    # genuinely produces. Refusing it would break delivery photos there
    # rather than securing anything.
    "/api/uploads/9f2c-4a11.jpg",
])
def test_the_app_s_own_uploads_are_accepted(url):
    assert is_allowed_media_url(url) is True


# --------------------------------------------------- and nothing else is

@pytest.mark.parametrize("url", [
    # The finding: an attacker-controlled host.
    "https://evil.example/px.gif",
    # The three near-misses an allowlist is normally bypassed with.
    "https://evil-cloudinary.com/px.gif",          # endswith() would pass this
    "https://evil.example/?x=cloudinary.com",      # `in` would pass this
    "https://res.cloudinary.com.evil.example/a.jpg",  # suffix-looking prefix
    # Not https.
    "http://res.cloudinary.com/demo/a.jpg",
    # Dressed-up non-URLs.
    "javascript:alert(1)",
    "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
    # Protocol-relative: a browser reads this as a HOST, not a path.
    "//evil.example/px.gif",
    "/\\evil.example/px.gif",
    # Credentials have no business in a media URL.
    "https://user:pw@res.cloudinary.com/a.jpg",
    # Right prefix, wrong everything else.
    "/uploads/../../etc/passwd",
    "/api/uploads/../../../etc/passwd",
    "",
    None,
])
def test_everywhere_else_is_refused(url):
    assert is_allowed_media_url(url) is False


def test_there_is_a_length_cap():
    assert is_allowed_media_url("https://res.cloudinary.com/" + "a" * MAX_MEDIA_URL_LEN) is False


# ----------------------------------------------- and the endpoint enforces it

def test_the_courier_status_model_refuses_a_foreign_photo():
    """The check has to be on the model, not the happy path: the same
    field is written for a delivered order and for a failed one."""
    from pydantic import ValidationError

    from routes.marketplace.orders import CourierStatusIn

    with pytest.raises(ValidationError):
        CourierStatusIn(status="done", photo_url="https://evil.example/px.gif")
    with pytest.raises(ValidationError):
        CourierStatusIn(status="failed", reason="nobody_home",
                        photo_url="https://evil.example/px.gif")

    ok = CourierStatusIn(
        status="done", photo_url="https://res.cloudinary.com/demo/image/upload/v1/a.jpg")
    assert ok.photo_url.endswith("a.jpg")


def test_no_photo_is_still_fine():
    """A pickup, or a courier with no signal, submits without one."""
    from routes.marketplace.orders import CourierStatusIn

    assert CourierStatusIn(status="done").photo_url is None
    assert CourierStatusIn(status="done", photo_url="   ").photo_url is None
