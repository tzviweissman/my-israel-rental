"""The rate-limit bypass must stay off unless deliberately turned on locally.

``DISABLE_RATE_LIMIT`` exists because the HTTP test suite logs in and
registers hundreds of times in seconds, which is indistinguishable from the
abuse the limiter exists to stop: against a local server it locked itself out
and ~200 tests errored at fixture setup with 429.

It also turns off a brute-force control, so it is worth more test coverage
than the feature it guards. These tests pin the two independent conditions:

1. the value must be exactly "1" — no truthy-string guessing
2. it is refused outright on a Railway deployment, whatever the flag says

If someone later "simplifies" this to ``if os.environ.get(...)``, the
truthy-string cases below go red.
"""
from __future__ import annotations

import importlib

import pytest
from fastapi import HTTPException

import utils.rate_limit as rl


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    """Neither variable set, and a clean hit store, before each case."""
    monkeypatch.delenv("DISABLE_RATE_LIMIT", raising=False)
    monkeypatch.delenv("RAILWAY_ENVIRONMENT", raising=False)
    importlib.reload(rl)
    yield
    importlib.reload(rl)


class _Req:
    """Minimal stand-in for starlette's Request."""

    def __init__(self, ip: str = "10.0.0.1"):
        self.headers: dict[str, str] = {}
        self.client = type("C", (), {"host": ip})()


def _hammer(times: int = 10, limit: int = 3):
    """Call check_rate `times` times; return how many were allowed."""
    allowed = 0
    for _ in range(times):
        try:
            rl.check_rate(_Req(), bucket="test", limit=limit, window_seconds=600)
            allowed += 1
        except HTTPException as e:
            assert e.status_code == 429
    return allowed


def test_limiter_is_on_by_default() -> None:
    assert _hammer(times=10, limit=3) == 3


def test_flag_set_to_one_disables_it(monkeypatch) -> None:
    monkeypatch.setenv("DISABLE_RATE_LIMIT", "1")
    assert _hammer(times=10, limit=3) == 10


@pytest.mark.parametrize("value", ["true", "True", "yes", "on", "0", "", "2", " 1"])
def test_only_the_exact_string_one_counts(monkeypatch, value: str) -> None:
    """Anything else leaves the limiter on — no truthy-string guessing."""
    monkeypatch.setenv("DISABLE_RATE_LIMIT", value)
    assert _hammer(times=10, limit=3) == 3, (
        f"DISABLE_RATE_LIMIT={value!r} disabled the limiter. Only '1' may."
    )


def test_railway_deployment_refuses_the_flag(monkeypatch) -> None:
    """The case that actually matters: the flag leaking into a deploy."""
    monkeypatch.setenv("DISABLE_RATE_LIMIT", "1")
    monkeypatch.setenv("RAILWAY_ENVIRONMENT", "production")
    assert _hammer(times=10, limit=3) == 3, (
        "Rate limiting was disabled on a Railway deployment. The flag is a "
        "local-testing switch and must never take effect in a deploy."
    )


def test_railway_refusal_is_logged(monkeypatch, caplog) -> None:
    """A silently-ignored security flag is its own kind of trap."""
    monkeypatch.setenv("DISABLE_RATE_LIMIT", "1")
    monkeypatch.setenv("RAILWAY_ENVIRONMENT", "production")
    with caplog.at_level("ERROR"):
        rl.check_rate(_Req(), bucket="test", limit=3, window_seconds=600)
    assert any("IGNORED" in r.message for r in caplog.records), (
        "Refusing the flag must be logged, or an operator who sets it never "
        "learns it did nothing."
    )
