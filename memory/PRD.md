# MyIsraelRental.com - Product Requirements Document

## Original Problem Statement
Build a bilingual (English/Hebrew) rental website named MyIsraelRental.com with admin dashboard, property listing management (long-term, short-term, vacation, storage), real-time chat, iCal/Airbnb calendar sync, paid service portal (Arnona/name change), rental contract translation & signing, renter notifications, and manager bulk upload features. Black and gold color scheme.

## Core Architecture
- **Frontend**: React + TailwindCSS + Lucide-react icons
- **Backend**: FastAPI + Motor (Async MongoDB)
- **Database**: MongoDB
- **File Storage**: Local /app/backend/uploads/ served via FastAPI StaticFiles at /api/uploads/
- **Theme**: Black and Gold (strict)

## What's Been Implemented

### Completed Features
- [x] React + FastAPI + MongoDB boilerplate with JWT auth (loading state for route guards)
- [x] Black and gold UI theme across all components
- [x] Custom MyIsraelRental logo, Floating WhatsApp button, Accessibility controls
- [x] Landing page with hero, featured listings, About Us, Footer
- [x] Complex property creation form with progressive disclosure, dual currency, 13 amenities
- [x] Storage rental type hides irrelevant fields
- [x] Property Condition dropdown (Renovated / Partially Renovated / Good Condition)
- [x] **Super Admin Dashboard** (6 tabs: Overview, Listings, Users, Chats, Document Services, Site Settings)
- [x] **Image & Video Upload**:
  - Drag-and-drop upload zone in property form
  - Progress indicator during upload
  - Preview thumbnails with remove button
  - Image gallery on property detail (prev/next arrows, thumbnails, counter)
  - Video player on property detail
  - Multi-file upload support
  - 50MB max per file, supports JPEG/PNG/WebP/GIF/MP4/MOV/WebM

### Key API Endpoints
- Auth: POST /api/auth/register, /api/auth/login, GET /api/auth/me
- Properties: CRUD at /api/properties
- Upload: POST /api/upload, /api/upload/multiple, DELETE /api/upload/{filename}
- Static files: GET /api/uploads/{filename}
- Admin: /api/admin/dashboard, users, properties, chats, document-services, settings
- Chat, Bookings, Notifications, Contracts, Document Service, Contact, Translate

## Prioritized Backlog

### P0 - High Priority
- [ ] Real-time chat between owners and renters
- [ ] Booking calendar with iCal/Airbnb sync

### P1 - Medium Priority
- [ ] PayPal integration for paid services (Arnona/name change)
- [ ] Rental contract upload, translation (Hebrew->English), digital signing
- [ ] Email/SMTP notifications for renter alerts

### P2 - Lower Priority
- [ ] Manager bulk property upload via text
- [ ] Personal manager profile pages
- [ ] English/Hebrew bilingual translation for all strings
- [ ] Dashboard.js refactoring (~770 lines)

## 3rd Party Integrations (Not Yet Integrated)
- Claude Sonnet (via Emergent LLM Key) - for translation
- PayPal - for paid services
- Simple SMTP - for email notifications

## Test Credentials
See /app/memory/test_credentials.md
