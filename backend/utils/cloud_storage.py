"""Cloudinary-backed media storage with graceful local-disk fallback.

Production deploys run on ephemeral Kubernetes containers — local files get
wiped on restart, so property images need durable off-host storage. When the
three CLOUDINARY_* env vars are set, uploads stream to Cloudinary and the
returned URL is the Cloudinary CDN URL. When they're missing (e.g. fresh
preview envs), we fall back to the legacy local-disk path so dev still works.
"""
from __future__ import annotations

import asyncio
import logging
import io
import os
import urllib.request
import uuid
from typing import Any

import cloudinary
import cloudinary.uploader
import cloudinary.utils

_CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME", "").strip()
_API_KEY = os.environ.get("CLOUDINARY_API_KEY", "").strip()
_API_SECRET = os.environ.get("CLOUDINARY_API_SECRET", "").strip()

CLOUDINARY_ENABLED = bool(_CLOUD_NAME and _API_KEY and _API_SECRET)
logger = logging.getLogger(__name__)

if CLOUDINARY_ENABLED:
    cloudinary.config(
        cloud_name=_CLOUD_NAME,
        api_key=_API_KEY,
        api_secret=_API_SECRET,
        secure=True,
    )


def _resource_type(is_video: bool) -> str:
    return "video" if is_video else "image"


def _with_auto_transforms(secure_url: str, is_video: bool) -> str:
    """Inject Cloudinary auto-format/auto-quality transformations into the URL.

    Cuts image bandwidth 30-60% by serving WebP/AVIF to modern browsers and
    auto-tuning quality. For videos `f_auto` is unsafe (codec/container
    compatibility), so only `q_auto` is applied.

    Idempotent: refuses to double-inject if the URL already has the transform.
    """
    if not secure_url or "/upload/" not in secure_url:
        return secure_url
    transform = "q_auto" if is_video else "f_auto,q_auto"
    head, tail = secure_url.split("/upload/", 1)
    # Don't double-inject if our marker is already there
    first_seg = tail.split("/", 1)[0]
    if "q_auto" in first_seg or "f_auto" in first_seg:
        return secure_url
    return f"{head}/upload/{transform}/{tail}"


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
    secure_url = res.get("secure_url", "")
    return {
        "url": _with_auto_transforms(secure_url, is_video),
        "public_id": res.get("public_id"),
        "bytes": res.get("bytes", len(content)),
        # md5 of the file: the same photo uploaded twice has the same etag.
        "etag": res.get("etag"),
        "format": res.get("format"),
        "resource_type": res.get("resource_type"),
        # Cloudinary's own reading of a video, for callers that check it.
        "duration": res.get("duration"),
        "width": res.get("width"),
        "height": res.get("height"),
        "codec": (res.get("video") or {}).get("codec"),
    }


def file_md5(url: str) -> str | None:
    """md5 of a stored file, the same value as Cloudinary's ``etag``. Used as
    a photo fingerprint: a copied listing re-uploads the same bytes under a
    new URL. Fetches the original, so no transformation changes the bytes."""
    import hashlib
    import urllib.request
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            return hashlib.md5(r.read()).hexdigest()
    except Exception:  # noqa: BLE001
        return None


async def mirror_url_to_cloudinary(url: str, *, is_video: bool = False, folder: str = "myisraelrental/imported") -> dict[str, Any] | None:
    """Pull an external image/video URL into Cloudinary so the asset
    survives even if the source host goes away. Returns the same shape
    as `upload_bytes_to_cloudinary` on success, or None on failure.

    Cloudinary's `upload()` accepts a URL directly as the first argument
    — it fetches the asset server-side, which is far faster than us
    downloading + re-uploading bytes.

    The Cloudinary SDK call is synchronous and blocks until the remote
    fetch + upload completes. We run it in a worker thread via
    ``asyncio.to_thread`` so callers using ``asyncio.gather`` over many
    URLs actually get concurrency — without this, a 700-image bulk
    import takes 10+ minutes and trips edge-proxy 60s timeouts.
    """
    if not CLOUDINARY_ENABLED or not url:
        return None

    def _send(src: str | bytes) -> dict[str, Any]:
        res = cloudinary.uploader.upload(
            src,
            resource_type=_resource_type(is_video),
            folder=folder,
            public_id=uuid.uuid4().hex,
            overwrite=False,
            use_filename=False,
            unique_filename=False,
        )
        secure_url = res.get("secure_url", "")
        return {
            "url": _with_auto_transforms(secure_url, is_video),
            "public_id": res.get("public_id"),
            "bytes": res.get("bytes", 0),
            "etag": res.get("etag") or file_md5(secure_url),
            "format": res.get("format"),
            "resource_type": res.get("resource_type"),
        }

    def _do_upload() -> dict[str, Any] | None:
        # Errors are logged and None returned, so one broken image URL
        # never kills a whole bulk import. They used to be swallowed
        # silently, which hid every photo Cloudinary refused.
        try:
            return _send(url)
        except Exception as exc:  # noqa: BLE001
            logger.warning("[mirror] %s refused: %s", url[:160], str(exc)[:200])
        if is_video:
            return None
        # Usually too big for Cloudinary to take (a 17 MB 4974x3247 PNG,
        # Burnt Meatboards, 16 Nov 2026): shrink it here and send the bytes.
        try:
            small = _shrunk_picture(url)
            return _send(small) if small else None
        except Exception as exc:  # noqa: BLE001
            logger.warning("[mirror] %s not copied after shrinking: %s", url[:160], str(exc)[:200])
            return None
    return await asyncio.to_thread(_do_upload)


_PICTURE_BYTES = 60_000_000
LONG_SIDE = 2500
# Decoding takes about 5 bytes a pixel whatever the file's size: a 0.45 MB
# PNG of 12000x12000 held 772 MB while it shrank (audit, 16 Nov 2026), and a
# website read copies many photos at once. Over this a picture is not copied.
MAX_PIXELS = 40_000_000


def _shrunk_picture(url: str) -> bytes | None:
    """The picture at `url`, downloaded and saved as a JPEG whose long side
    is at most LONG_SIDE pixels. Every hop is checked to be a public host:
    the address can come from someone else's website. None when it cannot
    be fetched."""
    import httpx

    from utils.helpers import _is_public_ical_url
    with httpx.Client(timeout=30, follow_redirects=False) as http:
        for _ in range(4):
            if not _is_public_ical_url(url):
                return None
            with http.stream("GET", url) as r:
                if r.is_redirect and r.headers.get("location"):
                    url = str(r.url.join(r.headers["location"]))
                    continue
                if r.status_code != 200:
                    return None
                body = bytearray()
                for chunk in r.iter_bytes():
                    body += chunk
                    if len(body) > _PICTURE_BYTES:
                        return None
                return shrink_picture(bytes(body))
    return None


def shrink_picture(content: bytes) -> bytes:
    """Picture bytes as a JPEG no longer than LONG_SIDE on its long side,
    transparency on white (a cut-out product would otherwise go black)."""
    from PIL import Image
    img = Image.open(io.BytesIO(content))
    if img.width * img.height > MAX_PIXELS:
        raise ValueError(f"picture too large to shrink: {img.width}x{img.height}")
    img.thumbnail((LONG_SIDE, LONG_SIDE))
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        ground = Image.new("RGB", img.size, "white")
        ground.paste(img, mask=img.getchannel("A"))
        img = ground
    out = io.BytesIO()
    img.convert("RGB").save(out, "JPEG", quality=85)
    return out.getvalue()


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


# ── Contracts: PRIVATE storage ───────────────────────────────────────────────
# Contracts are signed legal documents (personal data + signatures), so unlike
# property media they must never be publicly fetchable. They're stored as
# `raw` assets with `type="authenticated"`, which Cloudinary refuses to serve
# without a signature (verified: unsigned GET returns 401). Delivery always
# goes through our own permission-checked endpoints, which fetch the bytes
# server-side with a short-lived signed URL — the signed URL is never handed
# to the browser.
CONTRACT_FOLDER = "myisraelrental/contracts"


async def upload_contract_to_cloudinary(
    content: bytes, *, public_id_hint: str
) -> dict[str, Any] | None:
    """Store a contract as a private (authenticated) raw asset."""
    if not CLOUDINARY_ENABLED:
        return None

    def _do() -> dict[str, Any] | None:
        try:
            res = cloudinary.uploader.upload(
                io.BytesIO(content),
                resource_type="raw",
                type="authenticated",
                folder=CONTRACT_FOLDER,
                public_id=public_id_hint,
                overwrite=False,
                use_filename=False,
                unique_filename=False,
            )
            return {"public_id": res.get("public_id"), "bytes": res.get("bytes", len(content))}
        except Exception:  # noqa: BLE001
            return None

    return await asyncio.to_thread(_do)


async def fetch_contract_from_cloudinary(public_id: str) -> bytes | None:
    """Fetch a private contract's bytes via a short-lived signed URL."""
    if not CLOUDINARY_ENABLED or not public_id:
        return None

    def _do() -> bytes | None:
        # The API-signed private download link. A signed DELIVERY url
        # (cloudinary_url with sign_url=True) is refused with 401 for an
        # authenticated raw asset on this account, so this function returned
        # None for every contract and readers silently fell back to the disk
        # (found 18 Oct 2026, moving contracts off the volume). Format "" keeps
        # the public id as stored, extension included.
        try:
            url = cloudinary.utils.private_download_url(
                public_id, "", resource_type="raw", type="authenticated",
            )
            with urllib.request.urlopen(url, timeout=30) as r:
                return r.read()
        except Exception:  # noqa: BLE001
            return None

    return await asyncio.to_thread(_do)


def delete_contract_from_cloudinary(public_id: str) -> bool:
    """Delete a private contract asset."""
    if not CLOUDINARY_ENABLED or not public_id:
        return False
    try:
        res = cloudinary.uploader.destroy(
            public_id, resource_type="raw", type="authenticated", invalidate=True
        )
        return res.get("result") in ("ok", "not found")
    except Exception:  # noqa: BLE001
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
        segments = tail.split("/")
        # Strip leading transformation segments (e.g. "f_auto,q_auto", "w_400,c_fill")
        # Heuristic: transform segments contain "_" and no "." and aren't a version tag
        while segments and "_" in segments[0] and "." not in segments[0]:
            if segments[0].startswith("v") and segments[0][1:].isdigit():
                break
            segments = segments[1:]
        # Strip the version segment (v1234567890/) if present
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
