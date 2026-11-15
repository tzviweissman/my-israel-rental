# Audit-only: run the API on an in-memory database (mongomock-motor) when
# the sandbox cannot download MongoDB (403 on fastdl.mongodb.org, every
# audit since mid-October). Signs in the four dev accounts and seeds the
# demo listings at startup, so ?as=owner|renter|provider|admin work.
# Everything is lost when the process stops. Never point it at Atlas.
#
#   cd backend && cp ../scripts/audit-memdb-api.py _audit_memapi.py && \
#   MONGO_URL=mongodb://127.0.0.1:27017 DB_NAME=israel_rental_audit \
#   JWT_SECRET=$(head -c 32 /dev/urandom | base64) DEV_AUTOLOGIN=1 \
#   DISABLE_RATE_LIMIT=1 CORS_ORIGINS=http://localhost:3210 \
#   FRONTEND_URL=http://localhost:3210 \
#   .venv/bin/python -m uvicorn _audit_memapi:app --port 8001
#
# (Delete _audit_memapi.py afterwards; it must not be committed. The API's
# startup also rewrites backend/uploads/templates/*.pdf: git checkout them.)
# Known gap: seed_demo_gigs makes listings with no business, so their
# order page says "not taking orders"; order flows need a business.
# First used by the dead-ends audit of 15 Nov 2026.
import os, sys
sys.path.insert(0, os.getcwd())
import motor.motor_asyncio as ma
from mongomock_motor import AsyncMongoMockClient
_one = {}
def _client(*a, **k):
    if "c" not in _one:
        _one["c"] = AsyncMongoMockClient()
    return _one["c"]
ma.AsyncIOMotorClient = _client
import server  # noqa: E402
app = server.app

@app.on_event("startup")
async def _seed():
    from routes.auth import dev_login
    for r in ("owner", "renter", "provider", "admin"):
        await dev_login(r)
    import scripts.seed_demo_gigs as sd
    sd.AsyncIOMotorClient = _client
    sys.argv = ["x", "--provider-email", "dev-owner@local.test"]
    try:
        await sd.main()
    except BaseException as e:
        print("seed failed", repr(e))
