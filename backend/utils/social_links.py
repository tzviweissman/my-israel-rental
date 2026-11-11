"""A business's own accounts: Instagram, Facebook, TikTok and its website (Tzvi, 11 Nov 2026: asked for at sign-up,
used to fill in their details now and kept for their custom site later).

Owners type them every which way: "@noa.leather", "noa.leather", "instagram.com/noa.leather", a full link with
tracking on the end. Each becomes one clean https link, or is dropped. A link that claims to be Instagram must be
on Instagram's own host: these are shown as buttons on pages that carry our name, so a look-alike host would be an
open redirect.
"""
from __future__ import annotations

import re
from urllib.parse import urlparse

KINDS = ("instagram", "facebook", "tiktok", "website")
_HOSTS = {
    "instagram": ("instagram.com",),
    "facebook": ("facebook.com", "fb.com", "fb.me"),
    "tiktok": ("tiktok.com",),
}
_BASE = {"instagram": "https://www.instagram.com/{}/", "facebook": "https://www.facebook.com/{}", "tiktok": "https://www.tiktok.com/@{}"}
_HANDLE = re.compile(r"^@?([A-Za-z0-9._-]{1,60})$")


def normalize(kind: str, value: str) -> str | None:
    v = (value or "").strip()
    if kind not in KINDS or not v or len(v) > 300:
        return None
    m = _HANDLE.match(v)
    # A bare handle: "noa.leather" is a handle on Instagram, "instagram.com/noa" is not.
    if m and kind in _BASE and not re.search(r"\.(com|co|il|net|org|me)$", v, re.I):
        return _BASE[kind].format(m.group(1).lstrip("@"))
    if not re.match(r"^https?://", v, re.I):
        v = "https://" + v.lstrip("/")
    try:
        u = urlparse(v)
    except ValueError:
        return None
    host = (u.hostname or "").lower()
    if not host or "." not in host:
        return None
    if kind in _HOSTS:
        if not any(host == h or host.endswith("." + h) for h in _HOSTS[kind]):
            return None
        path = u.path.rstrip("/")
        if not path:
            return None
        return f"https://{host}{path}"
    return f"https://{host}{u.path.rstrip('/')}" if u.path not in ("", "/") else f"https://{host}"


def clean(links: dict | None) -> dict[str, str]:
    out = {}
    for kind in KINDS:
        url = normalize(kind, str((links or {}).get(kind) or ""))
        if url:
            out[kind] = url
    return out


if __name__ == "__main__":
    assert normalize("instagram", "@noa.leather") == "https://www.instagram.com/noa.leather/"
    assert normalize("instagram", "noa_leather") == "https://www.instagram.com/noa_leather/"
    assert normalize("instagram", "https://instagram.com/noa.leather?igsh=abc") == "https://instagram.com/noa.leather"
    assert normalize("instagram", "https://instagram.com.evil.io/x") is None
    assert normalize("facebook", "NoaLeather") == "https://www.facebook.com/NoaLeather"
    assert normalize("facebook", "facebook.com/noa.leather/") == "https://facebook.com/noa.leather"
    assert normalize("tiktok", "@noa") == "https://www.tiktok.com/@noa"
    assert normalize("website", "noaleather.co.il") == "https://noaleather.co.il"
    assert normalize("website", "https://noaleather.co.il/shop/") == "https://noaleather.co.il/shop"
    assert normalize("website", "not a site") is None
    assert normalize("instagram", "https://www.instagram.com/") is None
    assert clean({"instagram": "@a", "website": "", "x": "y"}) == {"instagram": "https://www.instagram.com/a/"}
    print("ok")
