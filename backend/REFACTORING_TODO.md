# Backend Refactoring TODO

## Completed ✅
- Created `/app/backend/models.py` - All Pydantic models
- Created `/app/backend/utils/email.py` - Email functions
- Created `/app/backend/utils/auth.py` - JWT functions
- Created `/app/backend/utils/pdf.py` - PDF signature stamping
- Created `/app/backend/utils/helpers.py` - Exchange rate & iCal
- Created `/app/backend/routes/auth.py` - Auth endpoints
- Updated server.py imports to use utils

## Remaining Work ⏳

### 1. Remove Duplicate Code from server.py
Lines to remove (now in utils):
- Lines 50-79: Email functions → in utils/email.py
- Lines 81-97: Exchange rate → in utils/helpers.py
- Lines 100-178: iCal functions → in utils/helpers.py
- Lines 180-195: JWT functions → in utils/auth.py
- Lines 192-310: Pydantic models → in models.py

### 2. Create Route Files

**routes/properties.py** (~500 lines)
Extract endpoints:
- POST /properties
- GET /properties
- GET /properties/{id}
- PUT /properties/{id}
- DELETE /properties/{id}
- POST /properties/{id}/like
- GET /liked-properties
- GET /liked-property-ids
- POST /properties/{id}/contract
- GET /properties/{id}/contract
- DELETE /properties/{id}/contract
- POST /properties/{id}/ical
- DELETE /properties/{id}/ical
- GET /properties/{id}/ical-export
- GET /properties/{id}/blocked-dates
- POST /properties/{id}/ical-sync

**routes/bookings.py** (~400 lines)
Extract endpoints:
- POST /bookings
- GET /bookings
- POST /bookings/{id}/accept
- POST /bookings/{id}/cancel
- POST /bookings/{id}/request-cancel
- POST /bookings/{id}/sign-contract (uses utils/pdf.py)
- POST /bookings/{id}/approve-cancel
- POST /bookings/{id}/deny-cancel

**routes/notifications.py** (~100 lines)
Extract endpoints:
- POST /notifications/preferences
- GET /notifications
- PUT /notifications/{id}/read
- PUT /notifications/read-all
- DELETE /notifications/clear-all

**routes/services.py** (~300 lines)
Extract endpoints:
- POST /subleases
- GET /subleases
- GET /my-subleases
- PUT /subleases/{id}
- POST /subleases/{id}/contract
- DELETE /subleases/{id}
- GET /contracts/sign/{token}
- POST /contracts/sign/{token}
- POST /document-service
- GET /document-service
- POST /service-requests
- GET /service-requests
- POST /contact

**routes/contracts.py** (~200 lines)
Extract endpoints:
- POST /contracts/upload
- GET /contracts
- GET /contracts/download/{id}
- GET /contracts/{id}
- POST /contracts/{id}/translate
- POST /contracts/{id}/sign
- DELETE /contracts/{id}

**routes/admin.py** (~200 lines)
Extract endpoints:
- GET /admin/dashboard
- GET /admin/users
- PUT /admin/users/{id}/status
- DELETE /admin/users/{id}
- GET /admin/properties
- PUT /admin/properties/{id}/status
- GET /admin/chats
- GET /admin/document-services
- PUT /admin/document-services/{id}/status
- GET /admin/settings
- PUT /admin/settings

**routes/uploads.py** (~150 lines)
Extract endpoints:
- POST /upload
- POST /upload/multiple
- DELETE /upload/{filename}
- POST /user/logo
- DELETE /user/logo

**routes/chat.py** (~100 lines)
Extract endpoints:
- POST /chat/messages
- GET /chat/messages/{property_id}
- GET /chat/conversations

**routes/manager.py** (~50 lines)
Extract endpoints:
- GET /manager/{id}/properties

### 3. Update server.py
After extracting routes:
- Import all route modules
- Register with app.include_router()
- Keep only:
  * App initialization
  * Database connection
  * CORS middleware
  * Static file serving
  * Startup/shutdown events
  * Exchange rate endpoint (if standalone)

Expected final server.py (~250 lines):
```python
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
from pathlib import Path
from dotenv import load_dotenv
import asyncio

# Import routes
from routes import auth, properties, bookings, notifications
from routes import services, contracts, admin, uploads, chat, manager
from utils.helpers import sync_all_ical_feeds

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Database
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# App
app = FastAPI()

# CORS
app.add_middleware(CORSMiddleware, ...)

# Register routes
app.include_router(auth.router)
app.include_router(properties.router)
app.include_router(bookings.router)
app.include_router(notifications.router)
app.include_router(services.router)
app.include_router(contracts.router)
app.include_router(admin.router)
app.include_router(uploads.router)
app.include_router(chat.router)
app.include_router(manager.router)

# Static files
app.mount("/api/uploads", StaticFiles(directory=str(ROOT_DIR / "uploads")), name="uploads")

# Lifecycle
@app.on_event("startup")
async def start_ical_sync():
    asyncio.create_task(sync_all_ical_feeds(db))

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
```

### 4. Testing After Refactoring
- Test all endpoints with curl
- Run linter
- Restart services
- Verify no breaking changes

## Benefits
- **Maintainability**: Easy to find and modify code
- **Scalability**: Add new routes without touching main file
- **Testing**: Each route file can be tested independently
- **Collaboration**: Multiple developers can work on different routes
- **Clean**: server.py becomes ~250 lines vs 2469 lines
