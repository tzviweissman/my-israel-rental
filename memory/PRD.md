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
- [x] Fixed "Failed to add property" on EDIT (2026-04-21)
- [x] Code-review critical fixes (2026-04-21): test creds → `.env.test` + `conftest.py`, array-index keys → stable IDs (6 files), debug console.logs removed, intentional-hook ESLint markers
- [x] **Postmark webhooks** (2026-04-21): `/api/webhooks/postmark` receives Delivery/Bounce/SpamComplaint events, stores in `email_events` collection, flags `users.email_suppressed=True` on hard bounce or complaint. Admin endpoint `/api/admin/email-health` returns 30-day stats. AdminDashboard overview tab now has an "Email Deliverability" card. `send_email()` auto-skips suppressed recipients.
  - **User setup required:** In Postmark → Servers → outbound stream → Webhooks, add `{BACKEND_URL}/api/webhooks/postmark?token=BSuezo9yKFgz66RSR3TMoAqQpYCjxpCINmBW7HAt3FM` and enable Delivery + Bounce + SpamComplaint events.
- [x] **Saved Search / Availability Alerts** (2026-04-22):
  - Renter can save search criteria (area, rental_type, min bedrooms, max price, dates) from an empty-results "Notify Me" card on `/properties/*`.
  - Alerts auto-expire after 60 days; dedupe on identical filters.
  - Triggers fire on property create, price drop, and booking cancel (freed dates); match uses ±30-day fuzziness.
  - In-app notification (bell icon) + Postmark email; owner never notified of own listing; 7-day throttle per (search × property) pair.
  - New Dashboard tab "Alerts" lets renters view & delete their saved searches.
  - Endpoints: `POST/GET/DELETE /api/saved-searches`. Collections: `saved_searches`, `saved_search_alerts`.
  - Files: `backend/utils/saved_search.py`, `frontend/src/components/NotifyMeCard.jsx`, `frontend/src/components/dashboard/SavedSearchesTab.jsx`. Backend pytest: 12/12 green (`/app/backend/tests/test_saved_searches.py`).
- [x] **Dashboard.js refactor** (2026-04-23):
  - Extracted 3 large inline tabs into self-contained components: `LikedTab.jsx`, `SubleasesTab.jsx`, `GovernmentServicesTab.jsx` (each owns its own state + fetches).
  - Replaced blocked `window.confirm` with a shadcn/sonner `toast.custom` confirm pattern for "Remove sublease".
  - Fixed latent bug: SubleasesTab shared a single `fileRef` inside `.map()` (would misfire when >1 sublease awaited upload). Moved hidden input out of the loop with `uploadTargetId` state.
  - Dashboard.js: **2624 → 1944 lines (−26%)**. Deleted stale unused `ServicesTab.jsx`.
  - Tested: full frontend regression pass (iteration_12.json) — all extracted tabs work, pause/activate/remove/upload/copy-link all verified.
- [x] **server.py refactor — routers split** (2026-04-23):
  - Split 2897-line `server.py` into 11 domain routers under `/app/backend/routes/`:
    - `auth.py`, `properties.py`, `bookings.py`, `subleases.py`, `contracts.py`, `chat.py`, `notifications.py`, `admin.py`, `saved_searches.py`, `ical.py`, `misc.py`.
  - New `routes/deps.py` owns singletons: `db`, `client`, `logger`, `verify_token`, `create_token`, `security`, `UPLOAD_DIR`, `CONTRACT_DIR`, `MAX_FILE_SIZE`, allowlists, env constants.
  - Moved helpers out of server.py: `extract_text_from_pdf/docx/image` → `utils/files.py`; `_translate_text` → `utils/translate.py`; authoritative `sync_all_ical_feeds` rewrite → `utils/helpers.py` (now uses shared `db` from deps, no arg).
  - `server.py` is now **82 lines** (−97%): FastAPI app + CORS + static mount + startup/shutdown + `include_router` of every domain.
  - Tested: 47/47 new regression tests + 12/12 saved-search tests = **59/59 pass** (iteration_13.json). Every one of the 84 endpoints across 11 routers verified reachable.
- [ ] Manager bulk property upload + profile pages

### P2 - Lower Priority
- [ ] Manager bulk property upload via text
- [ ] Personal manager profile pages
- [ ] LLM Integration (Claude Sonnet) for translation/chat enhancements
- [ ] Dashboard.js refactoring (~900 lines)
- [ ] server.py route extraction into /routes directory

## Test Credentials
See /app/memory/test_credentials.md
