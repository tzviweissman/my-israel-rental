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


def _client_key(request: Request, extra: str = "") -> str:
    """Compose the rate-limit key from the caller's IP (falling back to
    the socket address) plus any endpoint-specific token (e.g. email)."""
    # X-Forwarded-For may be set by Cloudflare/Kubernetes ingress.
    fwd = request.headers.get("x-forwarded-for", "")
    ip = fwd.split(",", 1)[0].strip() if fwd else (request.client.host if request.client else "?")
    return f"{ip}|{extra}"


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
