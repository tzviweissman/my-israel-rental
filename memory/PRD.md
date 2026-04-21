# MyIsraelRental.com - Product Requirements Document

## Original Problem Statement
Build a bilingual (English/Hebrew) rental website named MyIsraelRental.com with admin dashboard, property listing management (long-term, short-term, vacation, storage), real-time chat, iCal/Airbnb calendar sync, paid service portal (Arnona/name change), rental contract translation & signing, renter notifications, and manager bulk upload features. Dark grey and gold color scheme.

## Core Architecture
- **Frontend**: React + TailwindCSS + Lucide-react icons + Shadcn/UI
- **Backend**: FastAPI + Motor (Async MongoDB)
- **Database**: MongoDB
- **Theme**: Ocean Teal and Gold (#1E6A6A, #D4AF37)
- **i18n**: i18next with English and Hebrew (RTL) support

## What's Been Implemented

### Completed Features
- [x] Full auth with confirm password, terms checkbox, password visibility
- [x] Dark grey and gold theme across all components
- [x] Landing page with hero, featured listings, About Us, Footer
- [x] Complex property creation form with progressive disclosure, dual currency
- [x] Super Admin Dashboard
- [x] Image & Video Upload (drag-and-drop, gallery)
- [x] Complete EN/HE i18n translation
- [x] "Message Owner" + "Email Owner"
- [x] Shadcn Calendar date-range picker
- [x] Advanced Property Search Filters (Airbnb-style: price range slider, steppers, toggle, dates)
- [x] Cross-currency price filtering with live exchange rate
- [x] Currency conversion display on property cards and detail page
- [x] Transparent navbar with logo + hamburger menu dropdown
- [x] **iCal Calendar Integration** (2026-03-30):
  - Import iCal feeds from Airbnb/VRBO/any iCal URL
  - Export property bookings as iCal feed
  - Auto-sync every 5 minutes (background task)
  - Manual sync button
  - Blocked dates shown as disabled on property calendar
  - Date filter checks both internal bookings and external iCal bookings
  - Dashboard UI: add/remove iCal URLs, sync status, export URL copy
- [x] **Description & Address Optional** (2026-03-31):
  - PropertyCreate Pydantic model: description and address changed to Optional[str] = None
  - Frontend Dashboard.js: removed `required` attribute from description textarea and address input
- [x] **Ocean Teal Theme + Aerial Coastline Hero** (2026-03-31):
  - Changed theme to ocean teal (#1E6A6A) matching the water in the hero image
  - Hero image: aerial view of Tel Aviv coastline (no visible people)
  - Menu button made transparent (no background) to match logo style
  - Gradient accent: #2A8585

- [x] **Postmark Transactional Emails** (2026-04-21):
  - Replaced AWS SES with Postmark (SDK: `postmarker`) in `/app/backend/utils/email.py`
  - Brand-styled HTML templates with teal/gold theme, inline CSS for client compatibility
  - Flows wired: welcome (on register), password reset (on forgot-password), booking confirmation (to guest on create & accept), booking notification (to owner on create)
  - From: `My Israel Rental <no-reply@myisraelrental.com>`, token stored in `POSTMARK_SERVER_TOKEN` env var
  - Helpers: `send_welcome_email`, `send_password_reset_email`, `send_booking_confirmation_email`, `send_booking_notification_email`
  - Verified end-to-end: all 4 flows returned `MessageID` from Postmark API

### Key API Endpoints
- Auth: POST /api/auth/register, /api/auth/login, GET /api/auth/me
- Properties: GET /api/properties (with 13 filter params), POST/PUT/DELETE /api/properties
- iCal: POST/DELETE /api/properties/{id}/ical, GET /api/properties/{id}/ical-export, GET /api/properties/{id}/blocked-dates, POST /api/properties/{id}/ical-sync
- Exchange Rate: GET /api/exchange-rate
- Upload: POST /api/upload, /api/upload/multiple
- Admin: GET /api/admin/dashboard, /admin/users, /admin/properties
- Chat: POST /api/chat/messages, GET /api/chat/messages/{property_id}

## Prioritized Backlog

### P1 - Medium Priority
- [ ] PayPal integration for paid services (Arnona/name change)
- [x] Rental contract upload, translation (Hebrew<->English), digital signing
- [x] Email/SMTP notifications — migrated to Postmark (welcome, reset, booking confirm/notify)
- [x] Fixed "Failed to add property" on EDIT (2026-04-21) — `handleAddProperty` was sending `minimum_booking_days=""` which Pydantic v2 couldn't parse as int; also now surfaces real validation errors in the toast
- [ ] Manager bulk property upload + profile pages

### P2 - Lower Priority
- [ ] Manager bulk property upload via text
- [ ] Personal manager profile pages
- [ ] LLM Integration (Claude Sonnet) for translation/chat enhancements
- [ ] Dashboard.js refactoring (~900 lines)
- [ ] server.py route extraction into /routes directory

## Test Credentials
See /app/memory/test_credentials.md
