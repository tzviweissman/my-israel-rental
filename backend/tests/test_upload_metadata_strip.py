"""HEIC uploads are re-encoded, so their GPS never reaches the account.

The browser strips EXIF from JPEG and PNG before upload. It cannot do
that for HEIC - ISOBMFF, and Chrome and Firefox cannot decode it - which
matters more than it sounds, because HEIC is the iPhone default and
therefore the format most likely to arrive carrying GPS.

So the server signs an INCOMING transformation for those, which makes
Cloudinary re-encode before it stores anything. What is asserted here:

  * the transformation is part of the SIGNED params, not a hint. If it
    were unsigned, Cloudinary would ignore it and store the original with
    the coordinates in it, with nothing failing anywhere;
  * asking for it changes the signature, which is the only observable
    proof it was signed;
  * it is off by default, because it forces JPEG and would silently
    flatten a PNG's transparency on every ordinary upload;
  * it never applies to video, where the string is meaningless.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

pytest.importorskip("cloudinary")
import cloudinary  # noqa: E402
import cloudinary.utils  # noqa: E402


@pytest.fixture(autouse=True)
def _fake_cloudinary(monkeypatch):
    """Config with a known secret. No network, no real account."""
    monkeypatch.setenv("CLOUDINARY_CLOUD_NAME", "test-cloud")
    cloudinary.config(
        cloud_name="test-cloud", api_key="123456789", api_secret="test-secret-not-real",
    )
    yield


def _sign(params):
    return cloudinary.utils.api_sign_request(params, cloudinary.config().api_secret)


def test_the_transformation_is_inside_the_signature():
    """The load-bearing assertion.

    An unsigned `transformation` on the upload form is silently dropped by
    Cloudinary - the upload still succeeds and still stores the original,
    GPS included. Signing it is what makes it binding.
    """
    ts = 1_700_000_000
    plain = {"timestamp": ts, "folder": "myisraelrental"}
    stripping = {"timestamp": ts, "folder": "myisraelrental", "transformation": "f_jpg,q_auto:good"}

    assert _sign(plain) != _sign(stripping), (
        "adding the transformation did not change the signature, so it is not "
        "being signed - Cloudinary would ignore it and keep the original file"
    )


def test_signing_is_deterministic_for_the_same_params():
    """The client echoes the server's exact string back on the form. If
    signing were not stable, HEIC uploads would fail intermittently."""
    ts = 1_700_000_000
    p = {"timestamp": ts, "folder": "myisraelrental", "transformation": "f_jpg,q_auto:good"}
    assert _sign(p) == _sign(dict(p))


def test_a_drifted_transformation_string_does_not_verify():
    """Why the string is returned to the client rather than agreed by
    convention: one character of drift breaks every HEIC upload."""
    ts = 1_700_000_000
    signed = _sign({"timestamp": ts, "folder": "myisraelrental", "transformation": "f_jpg,q_auto:good"})
    drifted = _sign({"timestamp": ts, "folder": "myisraelrental", "transformation": "f_jpg,q_auto:best"})
    assert signed != drifted


# --------------------------------------------------------------------------
# The endpoint's own behaviour, read from source: it is auth-gated and
# rate-limited, so exercising it over HTTP would need a token fixture the
# rest of this file deliberately avoids.
# --------------------------------------------------------------------------

def _signature_source() -> str:
    import inspect
    import re

    from routes import misc

    src = inspect.getsource(misc.get_cloudinary_signature)
    return "\n".join(re.sub(r"#.*$", "", ln) for ln in src.splitlines())


def test_stripping_is_off_by_default():
    src = _signature_source()
    assert "strip_metadata: bool = False" in src, (
        "metadata stripping is no longer opt-in - if it runs on every image it "
        "converts PNGs to JPEG and destroys their transparency"
    )


def test_the_transformation_is_added_to_the_signed_params():
    src = _signature_source()
    assert 'params["transformation"] = transformation' in src, (
        "the transformation is no longer written into the params that get "
        "signed, so Cloudinary will ignore it and store the original"
    )


def test_it_never_applies_to_video():
    src = _signature_source()
    assert 'resource_type == "image"' in src, (
        "the image guard is gone; a transformation string like f_jpg is "
        "meaningless on a video upload"
    )


def test_the_signed_string_is_returned_to_the_caller():
    src = _signature_source()
    assert '"transformation": transformation' in src, (
        "the exact signed string is no longer returned, so the client has to "
        "reconstruct it and any drift becomes an Invalid Signature error"
    )
