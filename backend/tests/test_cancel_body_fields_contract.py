"""The body field each cancellation endpoint expects, vs. what the UI sends.

`/cancel` and `/request-cancel` take ``reason``. `/deny-cancel` takes
``denial_reason``. The dashboard posted ``reason`` to all three, so every
attempt to deny a cancellation request came back 422.

That alone would have been a visible, fixable error. What made it a support
ticket is what happened next: FastAPI's 422 body is

    {"detail": [{"type": "missing", "loc": ["body", "denial_reason"], ...}]}

— an ARRAY OF OBJECTS. The UI does
``toast.error(error.response?.data?.detail || 'fallback')``; the array is
truthy, so the fallback never runs, and the array reaches sonner, which
renders it as a React child. React throws "Objects are not valid as a React
child". Because <Toaster/> is mounted at the root, outside App's route-level
ErrorBoundary, that unmounted the whole application: a blank white page with
no message and nothing to click.

Two bugs, and the second one hid the first. This test covers the first;
``utils/apiError.js`` and the boundary around <Toaster/> cover the second.

See ``docs/failure-patterns.md`` §1 — this is the same two-sided boundary
shape, with a request body as the contract instead of a response payload.
"""
from __future__ import annotations

import pathlib
import re

REPO = pathlib.Path(__file__).resolve().parent.parent.parent
CANCEL_PY = REPO / "backend" / "routes" / "bookings" / "cancel.py"
HOOK = REPO / "frontend" / "src" / "components" / "dashboard" / "useBookingActions.jsx"

# Endpoint path suffix -> the key the hook uses for it in its maps.
ROUTE_TO_HOOK_KEY = {
    "cancel": "cancel",
    "request-cancel": "request",
    "deny-cancel": "deny",
}


def _backend_body_fields() -> dict[str, str]:
    """Map endpoint suffix -> the single Body(...) field it requires."""
    src = CANCEL_PY.read_text(encoding="utf-8")
    found: dict[str, str] = {}
    # Each route decorator is followed by its async def on the next line.
    for match in re.finditer(
        r'@api_router\.post\("/bookings/\{booking_id\}/([a-z-]+)".*?\)\s*\n'
        r"async def \w+\((.*?)\)\s*->",
        src,
        re.S,
    ):
        suffix, params = match.group(1), match.group(2)
        body_fields = re.findall(r"(\w+):\s*str\s*=\s*Body\(", params)
        if body_fields:
            assert len(body_fields) == 1, f"{suffix} has >1 Body field: {body_fields}"
            found[suffix] = body_fields[0]
    return found


def _frontend_body_fields() -> dict[str, str]:
    """Map hook key -> the body field name the hook posts for it."""
    src = HOOK.read_text(encoding="utf-8")
    start = src.index("const BODY_FIELD = {")
    block = src[start : src.index("};", start)]
    return dict(re.findall(r"(\w+):\s*'([\w_]+)'", block))


def test_collectors_are_not_empty() -> None:
    """Fail loudly if the parsing stops matching, rather than passing empty."""
    backend = _backend_body_fields()
    frontend = _frontend_body_fields()
    assert backend, f"Parsed no Body() fields from {CANCEL_PY.name} — fix the regex."
    assert frontend, f"Parsed no BODY_FIELD map from {HOOK.name} — fix the regex."
    # deny-cancel is the whole point of this test; make sure it was seen.
    assert "deny-cancel" in backend, f"deny-cancel not parsed; got {sorted(backend)}"


def test_frontend_posts_the_field_each_endpoint_requires() -> None:
    backend = _backend_body_fields()
    frontend = _frontend_body_fields()

    mismatches = []
    for route, hook_key in ROUTE_TO_HOOK_KEY.items():
        expected = backend.get(route)
        if expected is None:
            continue  # endpoint takes no body field (e.g. approve-cancel)
        actual = frontend.get(hook_key)
        if actual != expected:
            mismatches.append(
                f"/{route} requires body field '{expected}' but the hook posts "
                f"'{actual}' for type '{hook_key}'"
            )

    assert not mismatches, (
        "Request body field mismatch — these produce a 422:\n  "
        + "\n  ".join(mismatches)
    )


def test_deny_cancel_specifically_uses_denial_reason() -> None:
    """The exact regression: deny must not post 'reason'."""
    assert _backend_body_fields()["deny-cancel"] == "denial_reason"
    assert _frontend_body_fields()["deny"] == "denial_reason"
