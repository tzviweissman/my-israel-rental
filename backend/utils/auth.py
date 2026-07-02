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
