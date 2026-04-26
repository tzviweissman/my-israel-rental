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
- [x] **Dashboard.js refactor — PropertyList + AddPropertyModal extraction** (2026-04-23):
  - Extracted the 700-line Add/Edit Property modal into `AddPropertyModal.jsx` (918 lines, self-contained: owns form, upload, location dropdown, date pickers, submit/edit logic). Hydrates from `editingProperty` prop.
  - Extracted the 180-line owner property grid into `PropertyList.jsx` (376 lines, self-contained: owns iCal panel, contract upload/delete, property delete with iframe-safe toast confirms).
  - Replaced `window.confirm` in delete-property with `toast.custom` (iframe-safe).
  - **Dashboard.js: 1944 → 593 lines (−69%)**. Removed ~1350 lines of dead state/handlers.
  - Tested: 9/9 frontend flows pass via testing_agent_v3_fork (iteration_14.json).
- [x] **Manager Bulk Property Upload** (2026-04-23):
  - 4 new backend endpoints in `routes/bulk_upload.py`: template download (CSV+XLSX), parse (CSV/XLSX/paste with live validation), commit (validated rows → DB), images (ZIP → match-by-filename → attach).
  - Added `openpyxl` dep for XLSX parsing.
  - Frontend 5-step wizard `BulkUploadModal.jsx`: Template → Input → Preview (with per-row errors + checkbox selection) → Images (auto-skipped when no image_filenames) → Done.
  - "Bulk Upload" button wired into Dashboard next to "Add Property" for owners/managers.
  - Permissions: renter role gets 403 on all bulk endpoints.
  - Tested: 15/15 pytest pass + full frontend wizard validated (iteration_15.json). ZIP subfolder matching verified.
- [x] **Super-Admin Mark Property as Booked** (2026-04-23):
  - New `admin_blocks` collection; blocks are additive — existing renter bookings untouched.
  - Admin can block a property with a date range OR indefinitely (`end_date=null`).
  - Public `/api/properties` search filters out any property whose admin block overlaps the requested dates; when no dates are passed, the property stays visible (choice 4b).
  - Per-row "Mark as Booked" / "Unmark" action + bulk-select bar in Admin → Listings tab.
  - New endpoints (all admin-only): `POST /api/admin/properties/{id}/mark-booked`, `POST /api/admin/properties/bulk-mark-booked`, `GET /api/admin/properties/{id}/blocks`, `DELETE /api/admin/properties/blocks/{id}`. `GET /api/admin/properties` now enriches with `admin_blocks`, `admin_blocked_now`, `active_admin_block`.
  - Frontend: AdminDashboard.js adds checkbox column, `CalendarX`/`CalendarCheck` icons, amber "Admin blocked" badge, and a Shadcn-styled modal with "Block indefinitely" toggle.
  - Tested: 20/20 pytest + 13/13 frontend Playwright checks pass (iteration_16.json). Test file: `/app/backend/tests/test_admin_mark_booked.py`.
- [x] **AdminDashboard.js refactor + style-jsx sweep** (2026-04-23):
  - Extracted Listings tab and Mark-as-Booked modal into self-contained components under `/app/frontend/src/components/admin/`: `ListingsTab.jsx` (owns its own properties fetch, search, selection, modal state, and all row/bulk actions) and `MarkAsBookedModal.jsx` (pure presentational — resets its form on each open).
  - `AdminDashboard.js`: **910 → 546 lines (−40%)**. Dropped `properties`, `selectedPropIds`, `bookedModalOpen`, `bookedTarget`, `blockStart/End/Indefinite/Saving` state and 8 handlers now owned by ListingsTab.
  - Swept the last `<style jsx>` in `AccessibilityButton.js` → plain `<style>`, eliminating the recurring React DOM warning.
  - Smoke-tested: full mark-booked → badge → unblock round-trip works, no console errors.
- [x] **Backend type-hint coverage — 100%** (2026-04-23):
  - Added mypy (`1.19.1`) + pragmatic `mypy.ini` with `disallow_untyped_defs = True` and `disallow_incomplete_defs = True`. Ignores 3rd-party stubs we don't own (motor, postmarker, reportlab, etc.).
  - Brought the backend from **231 mypy errors → 0** across all 25 source files (`server.py` + `routes/` + `utils/` + `models.py`).
  - Every route handler has typed `payload: dict = Depends(verify_token)` params and a return type. Utility functions fully annotated.
  - Fixed real bugs surfaced by the type checker: unsafe `file.filename.split(".")` on `Optional[str]` in 3 upload handlers (`routes/misc.py`), unreachable `if not origin and req` dead branch in password-reset, `dict[str, list]` vs `dict[str, str|None]` in payloads, `ImageFont` union-type in signature stamping.
  - New pytest gate `tests/test_type_coverage.py` shells out to mypy and fails if anyone later merges untyped code.
  - `motor` handle `db` typed as `Any` (Motor has no upstream stubs) — single source-of-truth annotation in `routes/deps.py`.
  - Regression: all 79 relevant pytest cases pass with the proper env (`test_type_coverage`, `test_admin_mark_booked`, `test_refactor_regression`, `test_cancellation`).
- [x] **Unified lint surface + Pydantic plugin** (2026-04-23):
  - Enabled the Pydantic mypy plugin (`plugins = pydantic.mypy` in `mypy.ini`) — now `PropertyCreate(...)` / `BookingCreate(...)` callers get field-level errors: wrong type, wrong name, required-field omission.
  - Created `/app/backend/pyproject.toml` with ruff config that enables `ANN` rules — missing annotations are now caught at **lint time**, not just pytest time.
  - Cleaned up **603 ruff auto-fixable issues** (400 unused imports, 65 `datetime.timezone.utc` → `datetime.UTC`, 88 `Optional[X]` → `X | None`, 21 unsorted imports) introduced by the earlier server.py auto-extract refactor.
  - Killed the 11 `from models import *` star-imports across `routes/` — each file now explicitly lists the Pydantic models it actually uses.
  - Added single-entry-point `/app/backend/scripts/check.sh` that runs ruff + mypy + pytest-gate in sequence — **one green check**. All three gates currently pass.
- [x] **Full AdminDashboard tab extraction** (2026-04-26):
  - Extracted Overview, Users, Chats, Services, and Settings tabs into self-contained components under `/app/frontend/src/components/admin/`. Each tab owns its own data fetching, state, and actions.
  - `AdminDashboard.js`: **546 → 103 lines (–81%)**. The page is now a pure tab router that owns only `dashboard` (for the loading gate) + `emailHealth` + `activeTab`.
  - Smoke-tested every tab end-to-end: all 6 sections render, zero console errors.
- [x] **Tightened return annotations + body-level type checking** (2026-04-26):
  - Wrote a 2-pass AST analyzer that walks each function, inspects every `return` (literal dicts/lists, awaited `to_list()`/`find_one()`, `FileResponse`/`Response` constructors, single-var traces), and tightens `-> Any` to `-> dict` / `-> list[dict]` / `-> list[str]` / `-> FileResponse` / `-> Response`.
  - Tightened **93 of 95** route returns (97.9%). The 2 remaining are legitimate: `_parse_number` (generic caster) and `_get_db` (Motor DB handle, no upstream stubs).
  - Hoisted lazy `from starlette.responses import …` imports in `routes/contracts.py` and `routes/ical.py` to module level so annotations resolve.
  - Flipped `check_untyped_defs = True` in `mypy.ini` — mypy now type-checks function bodies, not just signatures. Currently **0 errors**.
  - **Real bug caught immediately**: my over-tightening of `liked-property-ids` to `list[dict]` was rejected at runtime by FastAPI's response-validation (the endpoint actually returns `list[str]`). Fixed → `-> list[str]`. **This is a free integration check tightened types now buy us.**
  - Verified across 17 real endpoints (admin + renter + owner) — all 200. 110/110 pytest cases pass. `scripts/check.sh` all-green.
- [x] **Stale-while-revalidate cache for admin tab fetches** (2026-04-26):
  - Built `/app/frontend/src/hooks/useApiSWR.js` (~110 lines, no dependencies): module-level cache, in-flight dedup, per-key freshness check, optimistic `mutate`, force-`refresh()` after mutations.
  - 30-second `dedupeMs` window: when an admin clicks back to a tab they viewed within the last 30 s, **zero** API calls happen — the cached data renders instantly.
  - Wired into all 6 admin tabs (Dashboard summary, Email Health, Listings, Users, Chats, Services, Settings). All mutations (mark-booked, unblock, toggle-user, delete-user, save-settings, service-status-change) call `refresh()` to force-revalidate.
  - **Verified in browser**: cold cache → 7 calls (one per resource). Warm cache, second pass through all tabs within dedupe window → **0 calls**. Mutation → exactly 1 force-refresh.
  - `AdminDashboard.js` shrunk further: **103 → 84 lines** thanks to dropped manual `useState` + `useEffect` boilerplate.
- [ ] Manager bulk property upload + profile pages

### P2 - Lower Priority
- [ ] Manager bulk property upload via text
- [ ] Personal manager profile pages
- [ ] LLM Integration (Claude Sonnet) for translation/chat enhancements
- [ ] Dashboard.js refactoring (~900 lines)
- [ ] server.py route extraction into /routes directory

## Test Credentials
See /app/memory/test_credentials.md
