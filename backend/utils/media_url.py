"""Where a stored media URL is allowed to point.

WHY THIS EXISTS

`utils/payment_links.py` was written because an arbitrary owner-supplied URL
rendered on a page we host is an open redirect with our name on it. A
delivery photo is the same shape of problem wearing different clothes: the
courier's `photo_url` is embedded as `<img src="...">` in the "Delivered"
email we send under our own sender identity, and returned verbatim from the
unauthenticated tracking page an anonymous customer opens. It was accepted
with no scheme check and no host check at all (site audit, 8 Sep 2026).

The floor is a cross-site tracking pixel that fires when the shop owner or
the customer opens the mail, from a courier account that only has to be
compromised, not malicious. Above that sit `javascript:`/`data:` values and
anything a quoting mistake downstream turns into an attribute break.

WHAT IS ON THE LIST, AND WHY ONLY THIS

Exactly the two places this app's own uploader puts files, and nothing else:

  * **Cloudinary.** `frontend/src/utils/fastUpload.js` posts straight to
    `api.cloudinary.com` and stores the returned `secure_url`, which is on
    `res.cloudinary.com`. The entry is the registrable domain so both, and
    any future Cloudinary subdomain, match.
  * **Our own upload fallback.** When Cloudinary is not configured,
    `_store_upload` in `routes/misc.py` writes to local disk and returns
    either `/api/uploads/<file>` (local dev, where the dev server proxies
    same-origin) or that path absolute on `PUBLIC_API_URL`. A preview or
    self-hosted environment genuinely produces these, so refusing them
    would break delivery photos there rather than securing anything.

Matching is on the host, the way payment_links does it, for the same
reason its docstring gives at length:

    "cloudinary.com" in url              -> evil.com/?x=cloudinary.com passes
    url.endswith("cloudinary.com")       -> evil-cloudinary.com passes
    host == d or host.endswith("." + d)  -> correct

Adding a domain here is a security decision: it grants that host the right
to be loaded inside an email we sign and a page we host.
"""
from __future__ import annotations

import os
from urllib.parse import urlsplit

ALLOWED_MEDIA_DOMAINS: tuple[str, ...] = (
    "cloudinary.com",
)

# The app's own upload fallback path. Anything under it is served by the
# `/api/uploads` static mount, which holds what this app itself wrote.
LOCAL_UPLOAD_PREFIX = "/api/uploads/"

# Long enough for a Cloudinary URL carrying transforms and a signature,
# short enough that the field is not a storage channel.
MAX_MEDIA_URL_LEN = 600


def _own_api_host() -> str | None:
    """The host this API is published on, when it knows it."""
    raw = (os.environ.get("PUBLIC_API_URL") or "").strip()
    if not raw:
        return None
    try:
        return (urlsplit(raw).hostname or "").lower().rstrip(".") or None
    except ValueError:
        return None


def is_allowed_media_url(url: str | None) -> bool:
    """True when `url` is somewhere this app itself puts uploaded media."""
    raw = (url or "").strip()
    if not raw or len(raw) > MAX_MEDIA_URL_LEN:
        return False

    # A root-relative path from the local-disk fallback. `//evil.com/x` is
    # protocol-relative and a browser reads it as a HOST, so the second
    # character matters as much as the first; a backslash is the same trap
    # spelled the way some parsers normalise it.
    if raw.startswith("/"):
        if raw.startswith("//") or raw.startswith("/\\") or "\\" in raw:
            return False
        # Starlette's static mount refuses to escape its root anyway, so
        # ".." here is not a live traversal - it is a value that has no
        # legitimate way of being produced, and storing one would make the
        # next reader of this field decide the question again.
        if ".." in raw:
            return False
        return raw.startswith(LOCAL_UPLOAD_PREFIX)

    try:
        parts = urlsplit(raw)
    except ValueError:
        return False

    # HTTPS only: plain http downgrades a page we serve over TLS, and this
    # is also what refuses `javascript:` and `data:` dressed up as a link.
    if parts.scheme.lower() != "https":
        return False
    # Credentials in a media URL are either a mistake or an attack.
    if parts.username or parts.password:
        return False

    host = (parts.hostname or "").lower().rstrip(".")
    if not host:
        return False

    if any(host == d or host.endswith("." + d) for d in ALLOWED_MEDIA_DOMAINS):
        return True
    # The absolute form of the local fallback, when we know our own host.
    own = _own_api_host()
    return bool(own and host == own and parts.path.startswith(LOCAL_UPLOAD_PREFIX))
