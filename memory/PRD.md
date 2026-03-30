# MyIsraelRental.com - Product Requirements Document

## Original Problem Statement
Build a bilingual (English/Hebrew) rental website named MyIsraelRental.com with admin dashboard, property listing management (long-term, short-term, vacation, storage), real-time chat, iCal/Airbnb calendar sync, paid service portal (Arnona/name change), rental contract translation & signing, renter notifications, and manager bulk upload features. Black and gold color scheme.

## Core Architecture
- **Frontend**: React + TailwindCSS + Lucide-react icons + Shadcn/UI
- **Backend**: FastAPI + Motor (Async MongoDB)
- **Database**: MongoDB
- **File Storage**: Local /app/backend/uploads/ served via FastAPI StaticFiles at /api/uploads/
- **Theme**: Black and Gold (#1a1a1a, #D4AF37)
- **i18n**: i18next with English and Hebrew (RTL) support

## What's Been Implemented

### Completed Features
- [x] React + FastAPI + MongoDB boilerplate with JWT auth (loading state for route guards)
- [x] Black and gold UI theme across all components
- [x] Custom MyIsraelRental logo, Floating WhatsApp button, Accessibility controls
- [x] Landing page with hero, featured listings, About Us, Footer
- [x] Complex property creation form with progressive disclosure, dual currency, 13 amenities
- [x] Storage rental type hides irrelevant fields
- [x] Property Condition dropdown (Renovated / Partially Renovated / Good Condition)
- [x] Super Admin Dashboard (6 tabs: Overview, Listings, Users, Chats, Document Services, Site Settings)
- [x] Image & Video Upload (drag-and-drop, progress indicator, previews, gallery, video player)
- [x] Complete English/Hebrew i18n translation mapping for all pages
- [x] "Message Owner" (in-app chat) and "Email Owner" (mailto) logic
- [x] Shadcn Calendar date-range picker for bookings
- [x] Auth form with Confirm Password and password visibility toggles
- [x] **Advanced Property Search Filters** (2026-03-30):
  - Location dropdown (Jerusalem/Tel Aviv/Haifa/Other neighborhoods)
  - Max Price, Min Bedrooms, Min Bathrooms
  - Max Floor, Min Porches, Elevator, Property Condition
  - Dates Available (checks bookings collection for overlap)
  - Apply/Clear filters with proper timing
  - Full EN/HE translations for all filter labels
- [x] Admin dashboard route decorator fix (GET /api/admin/dashboard)

### Key API Endpoints
- Auth: POST /api/auth/register, /api/auth/login, GET /api/auth/me
- Properties: GET /api/properties (with 12 filter params), POST/PUT/DELETE /api/properties
- Upload: POST /api/upload, /api/upload/multiple, DELETE /api/upload/{filename}
- Static files: GET /api/uploads/{filename}
- Admin: GET /api/admin/dashboard, /admin/users, /admin/properties, /admin/chats, /admin/document-services, /admin/settings
- Chat: POST /api/chat/messages, GET /api/chat/messages/{property_id}, GET /api/chat/conversations
- Bookings, Notifications, Contracts, Document Service, Contact, Translate

## Prioritized Backlog

### P0 - High Priority
- [ ] Booking calendar with iCal/Airbnb sync to prevent double booking

### P1 - Medium Priority
- [ ] PayPal integration for paid services (Arnona/name change)
- [ ] Rental contract upload, translation (Hebrew->English), digital signing
- [ ] Email/SMTP notifications for renter alerts

### P2 - Lower Priority
- [ ] Manager bulk property upload via text
- [ ] Personal manager profile pages
- [ ] LLM Integration (Claude Sonnet) for translation/chat enhancements
- [ ] Dashboard.js refactoring (~900 lines)
- [ ] server.py route extraction into /routes directory

## 3rd Party Integrations (Not Yet Integrated)
- Claude Sonnet (via Emergent LLM Key) - for translation
- PayPal - for paid services
- Simple SMTP - for email notifications

## Test Credentials
See /app/memory/test_credentials.md
