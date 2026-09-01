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
