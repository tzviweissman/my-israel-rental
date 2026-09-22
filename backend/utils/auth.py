"""Authentication utility functions"""
import os
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# Load JWT_SECRET from environment
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

security = HTTPBearer()
# SEC hardening: fail-closed if the JWT signing secret isn't set. A weak
# default (like "your-secret-key-change-in-production-…") means any
# attacker who reads this file's history can forge any user's JWT — so
# we refuse to start rather than silently accept it.
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET or JWT_SECRET.startswith('your-secret-key'):
    raise RuntimeError(
        "JWT_SECRET env var must be set to a strong random value "
        "(never use the placeholder). Refusing to start."
    )


def create_token(user_id: str, role: str) -> str:
    """Create a JWT token for a user.

    `iat` (issued-at) is what lets a password reset, a password change or
    a block end every session issued before it (security scan F6, F9):
    the account's `tokens_valid_after` is compared with it on every
    request. Tokens minted before 23 Sep 2026 have no `iat` and are
    treated as issued at 0, so they end too the first time it is set.
    """
    now = datetime.now(UTC)
    payload = {
        'user_id': user_id,
        'role': role,
        'iat': int(now.timestamp()),
        'exp': now + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


# The account state a session depends on, cached briefly per process so
# every request is not a database read. 20 seconds is how long a block or
# a password reset can take to reach a replica that has the old state.
_STATE_TTL = 20.0
_state_cache: dict[str, tuple[float, dict[str, Any]]] = {}


def forget_user(user_id: str) -> None:
    """Drop the cached state so a block or reset applies here at once."""
    _state_cache.pop(user_id, None)


async def _account_state(user_id: str) -> dict[str, Any] | None:
    hit = _state_cache.get(user_id)
    if hit and hit[0] > time.monotonic():
        return hit[1]
    from routes.deps import db   # lazy: routes.deps imports this module
    doc = await db.users.find_one({"id": user_id}, {"_id": 0, "status": 1, "tokens_valid_after": 1})
    if doc is not None:
        _state_cache[user_id] = (time.monotonic() + _STATE_TTL, doc)
    return doc


def is_session(payload: dict[str, Any]) -> bool:
    """A login session, as opposed to one of the email-link tokens signed
    with the same secret (opt-out, snooze, deep link, availability) - those
    carry `purpose` or `kind` and no `role`. Until 23 Sep 2026 any of them
    worked as a full login for 7 to 90 days (security scan F4)."""
    return bool(payload.get('user_id')) and bool(payload.get('role')) \
        and 'purpose' not in payload and 'kind' not in payload


async def check_session(payload: dict[str, Any]) -> dict[str, Any]:
    """Refuse a token that is not a session, belongs to a blocked or
    deleted account, or was issued before the account's last password
    reset, password change or block."""
    if not is_session(payload):
        raise HTTPException(status_code=401, detail="Invalid token")
    state = await _account_state(payload['user_id'])
    if state is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    if (state.get('status') or 'active') != 'active':
        raise HTTPException(status_code=403, detail="This account has been blocked")
    after = state.get('tokens_valid_after')
    if after and int(payload.get('iat') or 0) < int(after):
        raise HTTPException(status_code=401, detail="Please sign in again")
    return payload


async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Verify JWT token and return payload"""
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    return await check_session(payload)


# Same bearer scheme, but a missing or bad token yields None instead of a
# 401. For endpoints that are genuinely public and only want to know WHO is
# looking if anyone is — view tracking, which must not count an owner
# visiting their own listing. Never use this to gate access: `None` here
# means "not signed in OR sent us rubbish", which is not an authorisation
# decision.
_optional_security = HTTPBearer(auto_error=False)


def optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(_optional_security),
) -> dict | None:
    """The caller's JWT payload if they sent a valid one, else None."""
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=['HS256'])
    except jwt.InvalidTokenError:   # covers ExpiredSignatureError
        return None
    return payload if is_session(payload) else None


STREAM_TICKET_PURPOSE = "admin_stream"
STREAM_TICKET_SECONDS = 60


def create_stream_ticket(user_id: str, role: str) -> str:
    """A one-minute pass for the admin event stream.

    EventSource cannot send an Authorization header, so the stream's
    credential has to travel in the URL - and URLs are written to access
    logs, proxy logs and browser history. It used to be the admin's full
    30-day session (security scan F16). This is good for one minute and for
    the stream only: it carries a `purpose`, which verify_token refuses.
    """
    now = datetime.now(UTC)
    return jwt.encode({
        'purpose': STREAM_TICKET_PURPOSE, 'user_id': user_id, 'role': role,
        'iat': int(now.timestamp()), 'exp': now + timedelta(seconds=STREAM_TICKET_SECONDS),
    }, JWT_SECRET, algorithm='HS256')


def decode_query_token(token: str) -> dict:
    """Decode a stream ticket passed as a query parameter (see above).
    A session token is refused here, so it is never worth putting in a URL."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get('purpose') != STREAM_TICKET_PURPOSE:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload
