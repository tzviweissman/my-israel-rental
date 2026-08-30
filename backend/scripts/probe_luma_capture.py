"""Is Luma's capture API still there, and is our adapter shaped right?

WHY THIS EXISTS. The capture (video-to-3D) API is undocumented — it is
absent from `docs.lumalabs.ai/llms.txt`, and Luma's own client repo says
they no longer actively support it. That makes "is it still up?" a
question worth being able to re-ask cheaply rather than re-research, and
one that will eventually change answer.

WHAT IT CAN PROVE WITHOUT AN API KEY, which is more than it sounds:

  1. THE ROUTES EXIST. The host answers junk paths with 404 "Resource not
     found" and the capture paths with an auth error. That difference is
     the whole test — without the junk-path control an auth error proves
     nothing, because a host that rejects *everything* unauthenticated
     would look identical.

  2. THE AUTH HEADER FORMAT IS RIGHT. `Authorization: luma-api-key=<key>`
     with a bogus key gets 401 "API key does not exist" — the server
     parsed the header and looked the key up. Bearer, x-api-key and a
     malformed scheme all get a generic error instead, meaning they were
     not understood. This confirms the one line of `LumaTourProvider`
     that no amount of reading could confirm.

WHAT IT CANNOT PROVE. The response body shape — `capture.slug`,
`signedUrls.source`, `latestRun.artifacts[].type` — needs a real key.
Those field names are still guesses taken from the old client, and they
are what `_to_job` reads. Run with LUMA_API_KEY set to check them for
real; without one, the script says so rather than implying more coverage
than it has.

NO REAL KEY IS EVER SENT unless you set LUMA_API_KEY yourself, and the
value is never printed.

Usage:
    python -m scripts.probe_luma_capture
    LUMA_API_KEY=... python -m scripts.probe_luma_capture   # deeper
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx  # noqa: E402

BASE = os.environ.get("LUMA_API_BASE", "https://webapp.engineeringlumalabs.com/api/v2").rstrip("/")
HOST_ROOT = "/".join(BASE.split("/")[:3])

# Paths that must NOT exist. If one of these stops returning 404 the whole
# probe is meaningless and the script says so instead of reporting success.
CONTROLS = [
    "/api/v2/this-endpoint-cannot-exist",
    "/api/v9/capture",
    "/totally/made/up/path",
]

BOGUS = "probe-not-a-real-key-0000"


def _get(url: str, headers: dict[str, str] | None = None) -> tuple[int, str]:
    try:
        r = httpx.get(url, headers=headers or {}, timeout=20.0)
        return r.status_code, (r.text or "")[:120].replace("\n", " ")
    except Exception as e:  # noqa: BLE001
        return -1, f"{type(e).__name__}: {e}"


def main() -> int:
    problems: list[str] = []
    print(f"host: {HOST_ROOT}\n")

    # 1. Controls first. Without these the rest means nothing.
    print("controls (these MUST 404):")
    controls_ok = True
    for path in CONTROLS:
        code, body = _get(HOST_ROOT + path)
        ok = code == 404
        controls_ok &= ok
        print(f"  {'ok ' if ok else 'BAD'} {code:>4}  {path}")
        if not ok:
            problems.append(
                f"control path {path} returned {code}, not 404 — this host no longer "
                "distinguishes missing routes, so nothing below can be trusted"
            )
    print()

    # 2. The capture routes.
    print("capture routes (should NOT 404 if the API is alive):")
    alive = True
    for path in ("/capture", "/capture/probe-slug-does-not-exist"):
        code, body = _get(BASE + path)
        gone = code == 404
        alive &= not gone
        print(f"  {'GONE' if gone else 'live'} {code:>4}  {path}  {body!r}")
    print()

    # 3. Auth header format.
    print("auth header format (bogus key — which shape does the server parse?):")
    variants = {
        "luma-api-key= (our adapter)": {"Authorization": f"luma-api-key={BOGUS}"},
        "Bearer": {"Authorization": f"Bearer {BOGUS}"},
        "x-api-key": {"x-api-key": BOGUS},
        "none": {},
    }
    ours_code, ours_body = 0, ""
    for label, headers in variants.items():
        code, body = _get(BASE + "/capture", headers)
        if label.startswith("luma-api-key"):
            ours_code, ours_body = code, body
        print(f"  {code:>4}  {label:28} {body!r}")

    # 401 + a message naming the key = the header was understood.
    understood = ours_code == 401 and "key" in ours_body.lower()
    print()
    if understood:
        print("  -> our header format IS recognised (the key was looked up and rejected)")
    else:
        problems.append(
            "the `luma-api-key=` header no longer produces a key-specific 401 — "
            "LumaTourProvider._headers may need updating"
        )

    # 4. With a real key, if one is configured.
    key = os.environ.get("LUMA_API_KEY", "").strip()
    print()
    if not key:
        print("LUMA_API_KEY not set — response BODY SHAPE is still unverified.")
        print("  `capture.slug`, `signedUrls.source` and `latestRun.artifacts[].type`")
        print("  remain guesses from the old client. Set a key and re-run to check them.")
    else:
        code, body = _get(BASE + "/capture", {"Authorization": f"luma-api-key={key}"})
        print(f"with the configured key: {code}  {body!r}")
        if code == 200:
            print("  -> listing captures works; compare the field names above with _to_job")
        else:
            problems.append(f"a configured key still returned {code}")

    print()
    if problems:
        print("PROBLEMS:")
        for p in problems:
            print("  -", p)
        return 1
    verdict = "ALIVE" if alive else "GONE"
    print(f"verdict: capture API {verdict}, controls behaved, auth format recognised")
    return 0 if alive else 1


if __name__ == "__main__":
    raise SystemExit(main())
