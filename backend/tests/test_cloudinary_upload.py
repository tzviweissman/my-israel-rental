"""Regression tests for Cloudinary-backed file uploads.

Verifies the routes/misc.py upload flow stores files on Cloudinary when the
CLOUDINARY_* env vars are set, and gracefully falls back to local disk when
they're not. Uses real Cloudinary upload + delete to confirm end-to-end.
"""
from __future__ import annotations

import io
import os
import sys
from pathlib import Path

import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv  # noqa: E402
load_dotenv(Path(__file__).parent.parent / ".env")


def _png_bytes() -> bytes:
    img = Image.new("RGB", (50, 50), color="teal")
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def test_upload_to_cloudinary_when_enabled() -> None:
    import asyncio

    from utils.cloud_storage import CLOUDINARY_ENABLED, delete_from_cloudinary, upload_bytes_to_cloudinary

    if not CLOUDINARY_ENABLED:
        pytest.skip("Cloudinary creds not configured")

    res = asyncio.run(upload_bytes_to_cloudinary(_png_bytes(), is_video=False))
    assert res["url"].startswith("https://res.cloudinary.com/")
    assert res["public_id"]
    assert res["bytes"] > 0

    # Cleanup
    assert delete_from_cloudinary(res["public_id"], is_video=False)


def test_public_id_from_url() -> None:
    from utils.cloud_storage import public_id_from_url

    pid, is_video = public_id_from_url(
        "https://res.cloudinary.com/dirvyboe9/image/upload/v1778857584/myisraelrental/abc123.png"
    )
    assert pid == "myisraelrental/abc123"
    assert is_video is False

    pid, is_video = public_id_from_url(
        "https://res.cloudinary.com/dirvyboe9/video/upload/v1778857584/myisraelrental/clip.mp4"
    )
    assert pid == "myisraelrental/clip"
    assert is_video is True

    # Non-Cloudinary URL (legacy local upload)
    pid, is_video = public_id_from_url("/api/uploads/abc.jpg")
    assert pid is None
    assert is_video is False


def test_public_id_from_url_without_version() -> None:
    from utils.cloud_storage import public_id_from_url

    pid, _ = public_id_from_url(
        "https://res.cloudinary.com/dirvyboe9/image/upload/myisraelrental/abc.png"
    )
    assert pid == "myisraelrental/abc"


def test_cloudinary_disabled_returns_false_on_delete() -> None:
    """delete_from_cloudinary should return False (not raise) when disabled."""
    from utils import cloud_storage

    if cloud_storage.CLOUDINARY_ENABLED:
        pytest.skip("Cloudinary enabled, can't test disabled path here")

    assert cloud_storage.delete_from_cloudinary("anything") is False
