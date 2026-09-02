"""Regression: /api/cloudinary/signature returns a usable signed upload.

WHY THESE TESTS DID NOT RUN. The route grew a `req: Request` first
parameter when it was put behind `check_rate`, and these three called it
positionally without one. Every run raised

    TypeError: get_cloudinary_signature() missing 1 required positional
    argument: 'req'

before reaching a single assertion, so the signing path — the thing that
lets a browser upload straight to Cloudinary with our credentials — had
three tests that could only ever fail. Same family as the 13 imports that
were repointed after `routes/admin` and `routes/bookings` became packages:
a signature moved and the tests calling it did not.

The request is a REAL `starlette.requests.Request` over a minimal ASGI
scope rather than a stub, so `check_rate` runs exactly as it does in
production. A stub with the two attributes it happens to read today would
pass while telling us nothing about tomorrow.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))
load_dotenv(Path(__file__).parent.parent / ".env")


def _request(client_host: str = "203.0.113.7") -> "object":
    """A real Request the signing route can be called with directly."""
    from starlette.requests import Request

    return Request({
        "type": "http",
        "http_version": "1.1",
        "method": "GET",
        "scheme": "https",
        "path": "/api/cloudinary/signature",
        "raw_path": b"/api/cloudinary/signature",
        "query_string": b"",
        "root_path": "",
        "headers": [],
        "client": (client_host, 54321),
        "server": ("testserver", 443),
    })


def _sign(**kwargs):
    """Call the route the way FastAPI would, with `verify_token` already
    resolved. `payload` carries a per-test user id because the limiter
    keys on it (`ip_agnostic=True`) — sharing one id across tests would
    make them count against each other's 60/minute allowance."""
    from routes.misc import get_cloudinary_signature

    return asyncio.run(get_cloudinary_signature(_request(), **kwargs))


def test_signature_payload_shape_when_cloudinary_enabled() -> None:
    """When Cloudinary creds are set, the endpoint returns a valid signed payload."""
    from utils.cloud_storage import CLOUDINARY_ENABLED

    if not CLOUDINARY_ENABLED:
        pytest.skip("Cloudinary not configured")

    res = _sign(
        resource_type="image",
        folder="myisraelrental",
        payload={"user_id": "test-shape", "role": "owner"},
    )
    assert set(res.keys()) >= {
        "signature", "timestamp", "cloud_name", "api_key", "folder", "resource_type"
    }
    assert res["resource_type"] == "image"
    assert res["folder"] == "myisraelrental"
    assert isinstance(res["timestamp"], int)
    assert len(res["signature"]) == 40  # SHA1 hex


def test_signature_rejects_invalid_resource_type() -> None:
    from fastapi import HTTPException

    from utils.cloud_storage import CLOUDINARY_ENABLED

    if not CLOUDINARY_ENABLED:
        pytest.skip("Cloudinary not configured")

    with pytest.raises(HTTPException) as exc_info:
        _sign(
            resource_type="audio",
            folder="myisraelrental",
            payload={"user_id": "test-restype", "role": "owner"},
        )
    assert exc_info.value.status_code == 400


def test_signature_rejects_invalid_folder() -> None:
    from fastapi import HTTPException

    from utils.cloud_storage import CLOUDINARY_ENABLED

    if not CLOUDINARY_ENABLED:
        pytest.skip("Cloudinary not configured")

    with pytest.raises(HTTPException) as exc_info:
        _sign(
            resource_type="image",
            folder="some-other-folder",
            payload={"user_id": "test-folder", "role": "owner"},
        )
    assert exc_info.value.status_code == 400


def test_the_limiter_is_actually_wired_to_this_route() -> None:
    """The reason the signature above changed in the first place.

    Signing is credentialed: each call hands the browser permission to
    write into our Cloudinary account. 61 calls from one user id must be
    refused, or the `req` parameter these tests were failing on is
    decoration.
    """
    from fastapi import HTTPException

    from utils.cloud_storage import CLOUDINARY_ENABLED

    if not CLOUDINARY_ENABLED:
        pytest.skip("Cloudinary not configured")

    import utils.rate_limit as rl
    if rl._rate_limiting_disabled():
        pytest.skip("DISABLE_RATE_LIMIT=1 — the limiter is off for this run")

    args = dict(
        resource_type="image",
        folder="myisraelrental",
        payload={"user_id": "test-limit", "role": "owner"},
    )
    for _ in range(60):
        _sign(**args)
    with pytest.raises(HTTPException) as exc_info:
        _sign(**args)
    assert exc_info.value.status_code == 429
    assert exc_info.value.headers.get("Retry-After")
