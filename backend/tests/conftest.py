"""Shared test fixtures and test-credentials loader.

Credentials are loaded from tests/.env.test (which is gitignored). Any test
can `from conftest import TEST_*` instead of hardcoding values.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

_ENV_PATH = Path(__file__).parent / ".env.test"
if _ENV_PATH.exists():
    load_dotenv(_ENV_PATH)

TEST_ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "")
TEST_ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "")
TEST_OWNER_EMAIL = os.environ.get("TEST_OWNER_EMAIL", "")
TEST_OWNER_PASSWORD = os.environ.get("TEST_OWNER_PASSWORD", "")
TEST_RENTER_EMAIL = os.environ.get("TEST_RENTER_EMAIL", "")
TEST_RENTER_PASSWORD = os.environ.get("TEST_RENTER_PASSWORD", "")
TEST_OWNER2_EMAIL = os.environ.get("TEST_OWNER2_EMAIL", "")
TEST_OWNER2_PASSWORD = os.environ.get("TEST_OWNER2_PASSWORD", "")
TEST_RENTER2_EMAIL = os.environ.get("TEST_RENTER2_EMAIL", "")
TEST_RENTER2_PASSWORD = os.environ.get("TEST_RENTER2_PASSWORD", "")
TEST_API_BASE = os.environ.get("TEST_API_BASE", "http://localhost:8001/api")
