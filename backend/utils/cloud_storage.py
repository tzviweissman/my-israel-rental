"""Cloudinary-backed media storage with graceful local-disk fallback.

Production deploys run on ephemeral Kubernetes containers — local files get
wiped on restart, so property images need durable off-host storage. When the
three CLOUDINARY_* env vars are set, uploads stream to Cloudinary and the
returned URL is the Cloudinary CDN URL. When they're missing (e.g. fresh
preview envs), we fall back to the legacy local-disk path so dev still works.
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Any

import cloudinary
import cloudinary.uploader

_CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME", "").strip()
_API_KEY = os.environ.get("CLOUDINARY_API_KEY", "").strip()
_API_SECRET = os.environ.get("CLOUDINARY_API_SECRET", "").strip()

CLOUDINARY_ENABLED = bool(_CLOUD_NAME and _API_KEY and _API_SECRET)

if CLOUDINARY_ENABLED:
    cloudinary.config(
        cloud_name=_CLOUD_NAME,
        api_key=_API_KEY,
        api_secret=_API_SECRET,
        secure=True,
    )


def _resource_type(is_video: bool) -> str:
    return "video" if is_video else "image"


async def upload_bytes_to_cloudinary(
    content: bytes,
    *,
    is_video: bool,
    folder: str = "myisraelrental",
    public_id_hint: str | None = None,
) -> dict[str, Any]:
    """Upload raw bytes to Cloudinary. Returns dict with url/public_id/bytes."""
    public_id = public_id_hint or uuid.uuid4().hex
    res = cloudinary.uploader.upload(
        content,
        resource_type=_resource_type(is_video),
        folder=folder,
        public_id=public_id,
        overwrite=False,
        use_filename=False,
        unique_filename=False,
    )
    return {
        "url": res.get("secure_url"),
        "public_id": res.get("public_id"),
        "bytes": res.get("bytes", len(content)),
        "format": res.get("format"),
        "resource_type": res.get("resource_type"),
    }


def delete_from_cloudinary(public_id: str, *, is_video: bool = False) -> bool:
    """Delete an asset from Cloudinary. Returns True on success."""
    if not CLOUDINARY_ENABLED:
        return False
    try:
        res = cloudinary.uploader.destroy(
            public_id,
            resource_type=_resource_type(is_video),
            invalidate=True,
        )
        return res.get("result") in ("ok", "not found")
    except Exception:
        return False


def public_id_from_url(url: str) -> tuple[str | None, bool]:
    """Extract Cloudinary public_id + is_video flag from a secure_url.

    Returns (None, False) for non-Cloudinary URLs.
    Example:
      https://res.cloudinary.com/dirvyboe9/image/upload/v1234/myisraelrental/abc.jpg
      -> ("myisraelrental/abc", False)
    """
    if not url or "res.cloudinary.com" not in url:
        return None, False
    try:
        parts = url.split("/upload/", 1)
        if len(parts) != 2:
            return None, False
        is_video = "/video/upload/" in url
        tail = parts[1]
        # Strip the version segment (v1234567890/) if present
        segments = tail.split("/")
        if segments and segments[0].startswith("v") and segments[0][1:].isdigit():
            segments = segments[1:]
        # Drop file extension from the last segment
        if segments:
            last = segments[-1]
            if "." in last:
                segments[-1] = last.rsplit(".", 1)[0]
        public_id = "/".join(segments)
        return (public_id or None), is_video
    except Exception:
        return None, False
