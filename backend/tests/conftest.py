"""Shared test fixtures and test-credentials loader.

Credentials are loaded from tests/.env.test (which is gitignored). Any test
can `from conftest import TEST_*` instead of hardcoding values.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

_ENV_PATH = Path(__file__).parent / ".env.test"
if _ENV_PATH.exists():
    load_dotenv(_ENV_PATH)

TEST_ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "")
TEST_ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "")
TEST_OWNER_EMAIL = os.environ.get("TEST_OWNER_EMAIL", "")
TEST_OWNER_PASSWORD = os.environ.get("TEST_OWNER_PASSWORD", "")
TEST_RENTER_EMAIL = os.environ.get("TEST_RENTER_EMAIL", "")
TEST_RENTER_PASSWORD = os.environ.get("TEST_RENTER_PASSWORD", "")
TEST_OWNER2_EMAIL = os.environ.get("TEST_OWNER2_EMAIL", "")
TEST_OWNER2_PASSWORD = os.environ.get("TEST_OWNER2_PASSWORD", "")
TEST_RENTER2_EMAIL = os.environ.get("TEST_RENTER2_EMAIL", "")
TEST_RENTER2_PASSWORD = os.environ.get("TEST_RENTER2_PASSWORD", "")
TEST_API_BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")


# ---------------------------------------------------------------------------
# Tests that need a RUNNING backend skip instead of failing
# ---------------------------------------------------------------------------
#
# Part of this suite drives a live server at TEST_API_BASE: booking quotes,
# response-model regressions, bulk upload. With no server up they raised
# ConnectionRefusedError and were counted as FAILURES, so an ordinary run
# reported red tests that said nothing at all about the code. A real
# regression would have been indistinguishable from that noise, and the
# practical result is that the money paths - what a booking costs, what the
# API returns - had tests nobody could read.
#
# A skip is the honest outcome: the test did not run, and the reason says
# what to start. Reachability is probed ONCE per session, not per test.

import socket as _socket  # noqa: E402
from urllib.parse import urlparse as _urlparse  # noqa: E402

import pytest as _pytest  # noqa: E402

# Substrings that mark a module as needing the live API. Detected from the
# module source rather than a marker on every test, because these files
# predate any such convention and per-test markers are edits a new file
# would forget to make.
_LIVE_API_MARKERS = ("TEST_API_BASE", "localhost:8001")

_live_api_up = None


def _api_is_reachable() -> bool:
    """One TCP connect to the configured base. Cached for the session."""
    global _live_api_up
    if _live_api_up is not None:
        return _live_api_up
    parsed = _urlparse(TEST_API_BASE)
    host = parsed.hostname or "localhost"
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        with _socket.create_connection((host, port), timeout=2):
            _live_api_up = True
    except OSError:
        _live_api_up = False
    return _live_api_up


# ---------------------------------------------------------------------------
# One test's asyncio.run() must not take the event loop away from the next
# ---------------------------------------------------------------------------
#
# THE BUG THIS FIXES, and it is not the one it looks like. Whole files
# passed alone and failed in the suite; the visible error was usually
#
#     RuntimeError: Task <starlette...BaseHTTPMiddleware> attached to a
#     different loop
#
# which reads like a loop-identity problem. It is a symptom. The cause is
# in the other failure text, and it is much simpler:
#
#     RuntimeError: There is no current event loop in thread 'MainThread'.
#
# `asyncio.run()` sets a loop, runs, and on the way out calls
# `set_event_loop(None)`. That leaves the policy with `_set_called = True`
# and no current loop. From Python 3.12 on, `get_event_loop()` in that
# state RAISES instead of quietly making one. Around 30 test files drive
# coroutines with `asyncio.get_event_loop().run_until_complete(...)`, so
# the first file in a run that uses `asyncio.run()` breaks every one of
# them that comes after it - in file order, which is why the failures
# looked like they belonged to whichever files happened to sort later.
#
# Restoring a usable current loop per test is the whole fix. Note what
# this does NOT do: it never closes a loop, never replaces one that
# already exists, and never touches an async test. An earlier attempt at
# this problem handed every test its own fresh loop and made things WORSE
# (47 failures to 50) by fighting pytest-asyncio's own loop management.
# The rule that came out of that: only act when there is nothing there.
#
# Motor's cached binding is cleared alongside it. `routes/deps.py` builds
# one AsyncIOMotorClient at import and motor caches `get_event_loop()` on
# it lazily, forever (motor/core.py:152). Once a test runs on a new loop,
# that cache is a pointer to a dead one. The list is explicit and asserted
# non-empty, so a client that stops being found here fails loudly instead
# of silently going unreset (docs/failure-patterns.md #7).

import asyncio as _asyncio  # noqa: E402


def _shared_motor_clients() -> list:
    """Every module-level Motor client that outlives a single test."""
    found = []

    import routes.deps
    found.append(routes.deps.client)

    # Created lazily on first suppression lookup, so it may not exist yet.
    import utils.email
    if getattr(utils.email, "_mongo_db", None) is not None:
        found.append(utils.email._mongo_db.client)

    return found


@_pytest.fixture(autouse=True)
def _leave_a_usable_event_loop_for_the_next_test():
    clients = _shared_motor_clients()
    assert clients, (
        "no shared Motor client found - this fixture has stopped doing "
        "half its job and cross-test 'attached to a different loop' "
        "failures will return. Check routes/deps.py still exposes `client`."
    )
    for c in clients:
        c._io_loop = None

    # Only when there is nothing there. A loop that already exists belongs
    # to whoever put it there - pytest-asyncio, or the test itself.
    try:
        _asyncio.get_event_loop()
    except RuntimeError:
        _asyncio.set_event_loop(_asyncio.new_event_loop())

    yield

    # The teardown half is the one that actually matters: this is where a
    # test that called asyncio.run() has just left the thread with no
    # current loop at all.
    for c in _shared_motor_clients():
        c._io_loop = None
    try:
        _asyncio.get_event_loop()
    except RuntimeError:
        _asyncio.set_event_loop(_asyncio.new_event_loop())

    # And the other half of the same problem, which is not recoverable:
    # `with TestClient(app)` runs the app's lifespan, and its shutdown
    # handler calls `client.close()` on the singleton in routes/deps.py.
    # pymongo 4 will not reopen a closed client, so from that moment every
    # remaining test in the session fails with "Cannot use MongoClient
    # after close" - in files that never touched a TestClient. Fail HERE,
    # naming the test that did it, instead of leaving a trail of unrelated
    # red further down.
    import routes.deps
    if getattr(routes.deps.client.delegate._topology, "_closed", False):
        raise AssertionError(
            "this test closed the shared Motor client (routes/deps.py). "
            "Almost certainly `with TestClient(app)` - its lifespan "
            "shutdown calls client.close(), and pymongo cannot reopen it, "
            "so every later test in this session would fail with "
            "'Cannot use MongoClient after close'. Construct the client "
            "without the context manager, as tests/test_legacy_category_"
            "slugs.py does, or start the app in its own process."
        )


def pytest_collection_modifyitems(config, items):  # noqa: ARG001
    if _api_is_reachable():
        return
    reason = (
        f"needs a running backend at {TEST_API_BASE} - start it with "
        "`python -m uvicorn server:app --app-dir backend --port 8001`"
    )
    skip = _pytest.mark.skip(reason=reason)
    for item in items:
        try:
            source = Path(str(item.fspath)).read_text(encoding="utf-8")
        except OSError:
            continue
        if any(marker in source for marker in _LIVE_API_MARKERS):
            item.add_marker(skip)
