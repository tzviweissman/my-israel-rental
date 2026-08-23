"""Shared dependencies for route modules.

Every router file imports `db`, `logger`, and auth helpers from here.
Keeping these singletons out of the route files prevents circular imports
and makes the routers independently importable.
"""
import logging
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Re-export auth helpers so routers can do `from routes.deps import verify_token`
from utils.auth import create_token, optional_user, security, verify_token  # noqa: F401

ROOT_DIR = Path(__file__).parent.parent  # /app/backend
load_dotenv(ROOT_DIR / ".env")

_mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(_mongo_url)
db: Any = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
# LLM key for the direct Anthropic API (replaces the old EMERGENT_LLM_KEY /
# emergentintegrations proxy). EMERGENT_LLM_KEY is kept only as a fallback so
# existing deployments that still set it keep working during the transition.
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
# Google OAuth 2.0 Web-application client id (public, not a secret). Used to
# verify that an inbound Google access token was actually minted for THIS app
# before we trust the profile behind it. Blank disables Google sign-in.
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
POSTMARK_WEBHOOK_SECRET = os.environ.get("POSTMARK_WEBHOOK_SECRET", "")

logger = logging.getLogger("server")

# Shared upload directories & file-type allowlists
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
# Contracts are signed legal documents (personal data + signatures). They must
# NOT live under UPLOAD_DIR: server.py serves that entire tree as public
# StaticFiles at /api/uploads, which bypasses the ownership checks in
# routes/contracts.py — anyone with the URL could download a signed contract.
# Keep them in a sibling directory that is never mounted, and reachable only
# through the permission-checked download endpoints.
CONTRACT_DIR = ROOT_DIR / "private_contracts"
CONTRACT_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/webm", "video/mpeg"}
ALLOWED_CONTRACT_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
