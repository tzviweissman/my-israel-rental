# MyIsraelRental.com - Product Requirements Document

## Original Problem Statement
Build a bilingual (English/Hebrew) rental website named MyIsraelRental.com with admin dashboard, property listing management (long-term, short-term, vacation, storage), real-time chat, iCal/Airbnb calendar sync, paid service portal (Arnona/name change), rental contract translation & signing, renter notifications, and manager bulk upload features. Black and gold color scheme.

## Core Architecture
- **Frontend**: React + TailwindCSS + Lucide-react icons
- **Backend**: FastAPI + Motor (Async MongoDB)
- **Database**: MongoDB
- **Theme**: Black and Gold (strict)

## What's Been Implemented

### Completed Features
- [x] React + FastAPI + MongoDB boilerplate with JWT auth
- [x] Black and gold UI theme across all components
- [x] Custom MyIsraelRental logo with CSS blend mode in Navigation
- [x] Floating WhatsApp button and Accessibility controls
- [x] Landing page with hero, featured listings, About Us, Footer
- [x] Complex property creation form with progressive disclosure fields
- [x] Property Condition dropdown (Renovated / Partially Renovated / Good Condition)
- [x] Storage rental type hides irrelevant fields (amenities, bedrooms, bathrooms, condition, porches, property type)
- [x] Backend Pydantic schemas fully synced with frontend form fields
- [x] Empty string to null conversion for optional numeric fields
- [x] **Super Admin Dashboard** with 6 tabs:
  - Overview: Stats (active listings, views, inquiries, users, pending services) + recent listings
  - Listings: All properties with owner info, search, toggle active/inactive, delete
  - Users: All users with role badges, search, block/unblock, delete (admin protected)
  - Chats: Conversations grouped by property with expandable message threads
  - Document Services: Requests with status dropdown (pending/in_progress/completed/rejected)
  - Site Settings: WhatsApp number, contact email, contact phone, featured property IDs
- [x] Auth loading state fix for direct URL navigation (prevents /admin redirect on refresh)

### Backend API Endpoints
- Auth: POST /api/auth/register, /api/auth/login, GET /api/auth/me
- Properties: GET/POST /api/properties, GET/PUT/DELETE /api/properties/{id}
- Bookings: GET/POST /api/bookings
- Chat: POST /api/chat/messages, GET /api/chat/messages/{property_id}, GET /api/chat/conversations
- Notifications: GET /api/notifications, POST /api/notifications/preferences, PUT /api/notifications/{id}/read
- Translation: POST /api/translate
- Contracts: POST /api/contracts/upload, POST /api/contracts/sign, GET /api/contracts/{property_id}
- Documents: GET/POST /api/document-service
- Contact: POST /api/contact
- Admin: GET /api/admin/dashboard, /api/admin/users, /api/admin/properties, /api/admin/chats, /api/admin/document-services, /api/admin/settings
- Admin Actions: PUT /api/admin/users/{id}/status, DELETE /api/admin/users/{id}, PUT /api/admin/properties/{id}/status, PUT /api/admin/document-services/{id}/status, PUT /api/admin/settings

## Prioritized Backlog

### P0 - High Priority
- [ ] Image/Video upload for property listings
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
- [ ] Dashboard.js refactoring (~640 lines)

## 3rd Party Integrations (Not Yet Integrated)
- Claude Sonnet (via Emergent LLM Key) - for translation
- PayPal - for paid services
- Simple SMTP - for email notifications

## Test Credentials
See /app/memory/test_credentials.md
