"""In-memory sliding-window rate limiter.

Simple per-key limiter used to slow brute-force / abuse on public
endpoints (login, register, forgot-password, cloudinary signature).
Works well for a single-worker preview deploy. For a multi-worker
production, back this with Redis — the interface is intentionally
tiny so a Redis swap is a small diff.

Not a full-featured library on purpose: no bursts, no leaky buckets,
just "N events per M seconds" per key. If a caller trips the limit
we raise HTTP 429.
"""
from __future__ import annotations

import logging
import os
import time
from collections import defaultdict, deque
from typing import Deque

from fastapi import HTTPException, Request

logger = logging.getLogger(__name__)

_hits: dict[str, Deque[float]] = defaultdict(deque)


def _rate_limiting_disabled() -> bool:
    """True only for a deliberately-flagged local run.

    The HTTP test suite logs in and registers hundreds of times in a few
    seconds, which is indistinguishable from the abuse this limiter exists to
    stop — so against a local server it locked itself out and ~200 tests
    errored at fixture setup with 429. That made the whole suite unrunnable
    locally, which is worse for security than an opt-in local bypass: nobody
    reviews tests they can't run.

    Two independent conditions, because this switch turns off a brute-force
    control and a mistake is expensive:

    1. ``DISABLE_RATE_LIMIT`` must be exactly "1". Nothing else counts —
       "true", "yes" and "0" all leave the limiter on.
    2. It is ignored outright on Railway. Railway injects
       ``RAILWAY_ENVIRONMENT`` into every deploy, so if that is present we are
       in a real deployment and the flag is refused (loudly) no matter what.

    Never set DISABLE_RATE_LIMIT in Railway. It is for a local test run only.
    """
    if os.environ.get("DISABLE_RATE_LIMIT") != "1":
        return False
    if os.environ.get("RAILWAY_ENVIRONMENT"):
        logger.error(
            "DISABLE_RATE_LIMIT=1 is set on a Railway deployment and is being "
            "IGNORED. Rate limiting stays on. Remove this variable — it is a "
            "local-testing switch and must never be set in a deploy."
        )
        return False
    return True


# Address blocks that can only ever be a hop inside our own
# infrastructure, never a real internet client. Railway's private network
# is IPv6 ULA (fd00::/8) and its ingress speaks from CGNAT space
# (100.64.0.0/10); the rest are the standard private and loopback ranges.
_INTERNAL_PREFIXES = (
    "10.", "127.", "192.168.", "::1", "fd", "fc",
    *[f"172.{n}." for n in range(16, 32)],
    *[f"100.{n}." for n in range(64, 128)],
)


def _is_internal(ip: str) -> bool:
    low = ip.lower()
    return not low or any(low.startswith(p) for p in _INTERNAL_PREFIXES)


def client_ip(request: Request) -> str:
    """The caller's address, as far as it can be trusted.

    X-FORWARDED-FOR IS PARTLY ATTACKER-CONTROLLED, and reading the leftmost
    entry - which this did - takes the part the attacker writes. Measured
    against production: while rate-limited, sending
    `X-Forwarded-For: 203.0.113.78` returned 400 instead of 429, i.e. a
    fresh allowance. Every per-IP limit could be lifted by rotating one
    header: the signup cap, and the login brute-force protection.

    The header is a chain, appended to by each hop:

        <client, forgeable> , <hop> , <hop we added>

    Anything a proxy of ours appended is trustworthy; anything to the left
    of the first trusted hop is not. So walk from the RIGHT, discard hops
    inside our own infrastructure, and take the first public address left.
    That is the closest thing to the real caller that we did not let them
    write.

    It has to work for both shapes we actually run:

      through the same-origin proxy   "<client>, <100.64.x.x frontend>"
                                      -> the frontend hop is discarded and
                                         the client is used. Taking the
                                         RIGHTMOST entry blindly would put
                                         every visitor in one bucket and
                                         the sixth signup site-wide would
                                         start failing.
      direct to the backend           "<forged>, <edge>" or "<client>"
                                      -> a forged leftmost entry is only
                                         used if nothing to its right is
                                         public, and it is then no worse
                                         than the socket address.
    """
    fwd = request.headers.get("x-forwarded-for", "")
    hops = [h.strip() for h in fwd.split(",") if h.strip()]
    for hop in reversed(hops):
        if not _is_internal(hop):
            return hop
    # Everything was internal, or the header was absent: the socket is the
    # only thing left, and it is not forgeable.
    return request.client.host if request.client else "?"


def _client_key(request: Request, extra: str = "") -> str:
    """Compose the rate-limit key from the caller's IP plus any
    endpoint-specific token (e.g. email)."""
    return f"{client_ip(request)}|{extra}"


def check_rate(
    request: Request,
    *,
    bucket: str,
    limit: int,
    window_seconds: int,
    key_extra: str = "",
    ip_agnostic: bool = False,
) -> None:
    """Raise 429 if the caller has exceeded `limit` requests to `bucket`
    within the sliding `window_seconds`. Otherwise, record this hit.

    `ip_agnostic=True` skips the IP in the key — use it for authenticated
    endpoints where the caller identity (user_id) is already stable and
    the ingress may rotate egress IPs (defeating per-IP limits).
    """
    if _rate_limiting_disabled():
        return
    ident = key_extra if ip_agnostic else _client_key(request, key_extra)
    key = f"{bucket}:{ident}"
    now = time.monotonic()
    q = _hits[key]
    cutoff = now - window_seconds
    while q and q[0] < cutoff:
        q.popleft()
    if len(q) >= limit:
        retry_after = max(1, int(q[0] + window_seconds - now))
        raise HTTPException(
            status_code=429,
            detail=f"Too many requests — try again in {retry_after}s",
            headers={"Retry-After": str(retry_after)},
        )
    q.append(now)
