"""Regression: /api/cloudinary/signature returns a usable signed upload."""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

import pytest
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))
load_dotenv(Path(__file__).parent.parent / ".env")


def test_signature_payload_shape_when_cloudinary_enabled() -> None:
    """When Cloudinary creds are set, the endpoint returns a valid signed payload."""
    from routes.misc import get_cloudinary_signature
    from utils.cloud_storage import CLOUDINARY_ENABLED

    if not CLOUDINARY_ENABLED:
        pytest.skip("Cloudinary not configured")

    res = asyncio.run(
        get_cloudinary_signature(
            resource_type="image",
            folder="myisraelrental",
            payload={"user_id": "test-user", "role": "owner"},
        )
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
    from routes.misc import get_cloudinary_signature
    from utils.cloud_storage import CLOUDINARY_ENABLED

    if not CLOUDINARY_ENABLED:
        pytest.skip("Cloudinary not configured")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            get_cloudinary_signature(
                resource_type="audio",
                folder="myisraelrental",
                payload={"user_id": "u", "role": "owner"},
            )
        )
    assert exc_info.value.status_code == 400


def test_signature_rejects_invalid_folder() -> None:
    from fastapi import HTTPException
    from routes.misc import get_cloudinary_signature
    from utils.cloud_storage import CLOUDINARY_ENABLED

    if not CLOUDINARY_ENABLED:
        pytest.skip("Cloudinary not configured")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            get_cloudinary_signature(
                resource_type="image",
                folder="some-other-folder",
                payload={"user_id": "u", "role": "owner"},
            )
        )
    assert exc_info.value.status_code == 400
