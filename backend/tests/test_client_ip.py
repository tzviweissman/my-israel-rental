"""Which address the rate limiter counts against.

THE BUG THIS EXISTS FOR. `_client_key` read the LEFTMOST X-Forwarded-For
entry, which is the part a caller writes. Measured against production on
2026-09-01: while rate-limited, sending `X-Forwarded-For: 203.0.113.78`
returned 400 instead of 429 - a fresh allowance. Every per-IP limit could
be lifted by rotating one header, including the login brute-force
protection and the signup cap.

THE OTHER HALF IS AS IMPORTANT. Taking the rightmost entry instead would
be safe and useless: the same-origin proxy appends its own container
address to every request, so all visitors would share one bucket and the
sixth signup ANYWHERE on the site would start failing for everybody. Both
failure modes are tested below, because a fix for one that causes the
other is not a fix.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from utils.rate_limit import client_ip  # noqa: E402

CLIENT = "203.0.113.7"
FORGED = "198.51.100.99"
FRONTEND_HOP = "100.64.0.13"      # Railway CGNAT — our own proxy container
SOCKET = "10.0.0.5"


class _Req:
    """Only what `client_ip` reads."""

    def __init__(self, xff=None, socket_host=SOCKET):
        self.headers = {"x-forwarded-for": xff} if xff is not None else {}
        self.client = type("C", (), {"host": socket_host})() if socket_host else None


def test_the_real_client_survives_our_own_proxy_hop():
    """The shape every request takes through the same-origin proxy."""
    assert client_ip(_Req(f"{CLIENT}, {FRONTEND_HOP}")) == CLIENT


def test_visitors_are_not_collapsed_into_one_bucket():
    """The regression a naive rightmost-entry fix would cause: with every
    caller reduced to the proxy's address, the sixth signup site-wide
    starts failing for everyone."""
    a = client_ip(_Req(f"203.0.113.1, {FRONTEND_HOP}"))
    b = client_ip(_Req(f"203.0.113.2, {FRONTEND_HOP}"))
    assert a != b
    assert FRONTEND_HOP not in (a, b)


def test_a_forged_entry_left_of_a_real_hop_is_ignored():
    """A caller prepending their own value cannot displace the address a
    trusted hop recorded to the right of it."""
    assert client_ip(_Req(f"{FORGED}, {CLIENT}")) == CLIENT


def test_several_internal_hops_are_all_discarded():
    assert client_ip(_Req(f"{CLIENT}, {FRONTEND_HOP}, 10.1.2.3, ::1")) == CLIENT


@pytest.mark.parametrize("internal", [
    "10.1.2.3", "127.0.0.1", "192.168.1.1", "172.16.0.1", "172.31.255.255",
    "100.64.0.1", "100.127.255.255", "::1", "fd00::1", "fc00::1",
])
def test_every_internal_range_is_recognised(internal):
    """If one of these were treated as public it would become the key for
    every request that passed through it."""
    assert client_ip(_Req(f"{CLIENT}, {internal}")) == CLIENT


@pytest.mark.parametrize("public", ["8.8.8.8", "172.15.0.1", "172.32.0.1", "100.63.0.1", "100.128.0.1"])
def test_addresses_just_outside_the_internal_ranges_stay_public(public):
    """The boundaries. 172.15/172.32 and 100.63/100.128 sit either side of
    the private and CGNAT blocks and must NOT be discarded."""
    assert client_ip(_Req(f"{CLIENT}, {public}")) == public


def test_no_header_falls_back_to_the_socket():
    assert client_ip(_Req(None)) == SOCKET


def test_an_all_internal_chain_falls_back_to_the_socket():
    assert client_ip(_Req(f"10.0.0.1, {FRONTEND_HOP}")) == SOCKET


def test_a_lone_forged_entry_is_no_worse_than_before():
    """Nothing trustworthy to its right, so it is used — exactly what the
    old code did in every case. The fix removes the easy bypass; it does
    not claim to make a bare header trustworthy."""
    assert client_ip(_Req(FORGED)) == FORGED


def test_junk_does_not_raise():
    for junk in ["", "   ", ",,,", "not-an-ip", "  ,  ,  "]:
        assert isinstance(client_ip(_Req(junk)), str)


def test_no_client_and_no_header_is_still_a_string():
    assert client_ip(_Req(None, socket_host=None)) == "?"
