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

import time
from collections import defaultdict, deque
from typing import Deque

from fastapi import HTTPException, Request

_hits: dict[str, Deque[float]] = defaultdict(deque)


def _client_key(request: Request, extra: str = "") -> str:
    """Compose the rate-limit key from the caller's IP (falling back to
    the socket address) plus any endpoint-specific token (e.g. email)."""
    # X-Forwarded-For may be set by Cloudflare/Kubernetes ingress.
    fwd = request.headers.get("x-forwarded-for", "")
    ip = fwd.split(",", 1)[0].strip() if fwd else (request.client.host if request.client else "?")
    return f"{ip}|{extra}"


def check_rate(request: Request, *, bucket: str, limit: int, window_seconds: int, key_extra: str = "") -> None:
    """Raise 429 if the caller has exceeded `limit` requests to `bucket`
    within the sliding `window_seconds`. Otherwise, record this hit."""
    key = f"{bucket}:{_client_key(request, key_extra)}"
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
