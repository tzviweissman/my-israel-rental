"""Shared dependencies for route modules.

Every router file imports `db`, `logger`, and auth helpers from here.
Keeping these singletons out of the route files prevents circular imports
and makes the routers independently importable.
"""
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Re-export auth helpers so routers can do `from routes.deps import verify_token`
from utils.auth import create_token, verify_token, security  # noqa: F401

ROOT_DIR = Path(__file__).parent.parent  # /app/backend
load_dotenv(ROOT_DIR / ".env")

_mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(_mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ.get("JWT_SECRET", "your-secret-key-change-in-production-12345")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
POSTMARK_WEBHOOK_SECRET = os.environ.get("POSTMARK_WEBHOOK_SECRET", "")

logger = logging.getLogger("server")

# Shared upload directories & file-type allowlists
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
CONTRACT_DIR = ROOT_DIR / "uploads" / "contracts"
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
