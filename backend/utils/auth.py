"""Authentication utility functions"""
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path

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
    """Create a JWT token for a user"""
    payload = {
        'user_id': user_id,
        'role': role,
        'exp': datetime.now(UTC) + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Verify JWT token and return payload"""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


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
        return jwt.decode(credentials.credentials, JWT_SECRET, algorithms=['HS256'])
    except jwt.InvalidTokenError:   # covers ExpiredSignatureError
        return None


def decode_query_token(token: str) -> dict:
    """Decode a JWT passed as a query parameter.

    Used by SSE endpoints because EventSource cannot set Authorization
    headers. Same validation as verify_token, just without the FastAPI
    Depends() plumbing.
    """
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
