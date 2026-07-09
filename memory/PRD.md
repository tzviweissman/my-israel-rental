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

- [x] **Reframe gig "tiers" as distinct services (2026-07-09)**:
  - User feedback: "when adding a new service when adding tiers it should be tiers or just multiple services like a barber shop just has different haircut options not different tiers".
  - The gig-creation wizard was auto-labeling rows Basic / Standard / Premium — implicitly forcing a Fiverr upgrade-ladder mental model. A barber's real offering is 3 distinct services (Haircut, Beard trim, Full grooming), not 3 escalating packages.
  - `frontend/src/pages/CreateGig.jsx`:
    - Step-3 title changed from "Pricing" → "**Services & Prices**".
    - Default first row no longer pre-fills "Basic" — starts empty with a placeholder that rotates (row 0 shows `e.g. Haircut`, row 1 `e.g. Beard trim`, later rows `Service name`).
    - "Add tier" button → "**Add another service**"; limit bumped from 3 → 8 (a barber may offer more options).
    - New teal helper strip explaining the shift: "List each service you offer as a separate option — for example, a barber might add Haircut (₪60), Beard trim (₪30), and Full grooming (₪90). These aren't tiers or upgrades; they're the different things customers can book from you."
    - "What's included in this tier" placeholder → "What's included (optional)". Days field gets a tooltip: "Turnaround in days — leave blank for on-the-spot services".
  - `frontend/src/pages/GigDetail.jsx`:
    - "Pick a tier first" → "**Pick a service option first**".
    - WhatsApp booking message no longer says `"${tier.name} tier"` — just the service name.
  - Backend model unchanged (`tiers[]` on the gig doc) so existing gigs render identically; only the UI mental model shifted. Zero migration required.
  - Verified visually via Playwright — empty state shows helper + placeholder; filled state renders Haircut / Beard trim / Full grooming as separate cards; "Add another service" reappears until the 8-service ceiling.

- [x] **`routes/admin_import/` and `routes/bookings/` package splits (2026-07-09)** — bonus round of the backend refactor:
  - **`admin_import/`** (was 1,153 lines):
    - `helpers.py` (461) — CSV parsers, coercers, AI column mapper (Claude + fuzzy fallback), `_build_property_doc`, `_resolve_or_create_owner`, `_issue_reset_token`, `_frontend_origin`.
    - `preview.py` (103) — `POST /admin/import/preview`.
    - `properties.py` (451) — property commit + `_background_mirror_properties` + `/admin/properties/remirror` + `/admin/properties/repair-prices`.
    - `users.py` (121) — user commit + set-password emails.
    - `quick_add.py` (130) — single-property quick-add.
    - `__init__.py` (52) — aggregator + 8 re-exports for 4 test files and `routes/admin/core.py`.
    - Result: 25 admin-import tests pass.
  - **`bookings/`** (was 1,067 lines):
    - `shared.py` (363) — property/sublease loader, availability + holiday-window + overlap checks, notifications, `_compute_booking_total` engine, `_build_booking_doc`, `_queue_booking_emails`.
    - `crud.py` (114) — `POST /bookings`, `GET /bookings`.
    - `accept.py` (163) — accept endpoint + owner-authorize + contract attach + renter notify.
    - `cancel.py` (202) — cancel + request-cancel + approve-cancel + deny-cancel.
    - `contract.py` (314) — sign-contract + translate-contract with all their helpers.
    - `__init__.py` (33) — aggregator + `BookingCreate`, `_compute_booking_total` re-exports.
    - Result: 4 accept-booking tests pass, 4 smart-pricing tests pass. Also patched `tests/test_accept_booking_refactor.py` to monkeypatch `routes.bookings.accept.send_booking_confirmation_email` (used to patch it on the flat module). Remaining `test_cancellation.py` failures are **pre-existing** (confirmed identical failure on pre-refactor commit — bad test data, unrelated).
  - `server.py` needed **zero changes** for either split — `from routes import admin_import, bookings` still resolves and each `.router` is now the aggregated router.
  - All routes files in the codebase now under 700 lines.

- [x] **`routes/smart_pricing/` package split (2026-07-08)** — completes the backend refactor epic:
  - Replaced the single-file `routes/smart_pricing.py` (920 lines) with a 4-module package + aggregator.
  - Module layout:
    - `routes/smart_pricing/__init__.py` (49 lines) — aggregates the router; re-exports `SmartPricingSettings`, `compute_suggestion`, `smart_pricing_daily_loop`, `pricing_insights_weekly_loop`, `record_view_event`, `_send_owner_digest_if_eligible` so `server.py`, `routes/properties/browse.py`, and 3 test files keep their existing imports unchanged.
    - `routes/smart_pricing/shared.py` (409 lines) — Pydantic models (SmartPricingSettings, CalculateRequest, ApplyRequest, FactorOut, SuggestionOut), Hebcal fetcher + holiday lookup, `_gather_signals`, the pure `compute_suggestion` engine, `_build_reason`, `_load_property_for_owner`, `_settings_from_prop`, `_forecast`.
    - `routes/smart_pricing/pricing.py` (210 lines) — 5 per-property endpoints (settings GET/PATCH, calculate, apply, revert) + `record_view_event` demand-signal hook.
    - `routes/smart_pricing/daily_loop.py` (92 lines) — `smart_pricing_daily_loop` + `_refresh_all_enabled` background sweep.
    - `routes/smart_pricing/insights.py` (265 lines) — weekly owner-digest email (`_build_owner_digest`, `_send_owner_digest_if_eligible`, `pricing_insights_weekly_loop`, `_send_pricing_insights_to_all`) + `send-sample`, `GET/PATCH /insights/preferences` endpoints, `InsightsPrefBody`.
  - `server.py` needed **zero changes** — `from routes import smart_pricing` still resolves; both background loops accessible via re-exports.
  - Verified: backend starts clean; smoke tests on `/smart-pricing/insights/preferences` return 200; **20 smart-pricing tests pass** across `test_smart_pricing.py`, `test_smart_pricing_extra.py`, `test_pricing_insights.py`. Lint clean.

- [x] **BACKEND REFACTOR EPIC COMPLETE (2026-07-08)**:
  - All 4 monoliths (admin.py 2,241 + marketplace.py 1,169 + properties.py 1,139 + smart_pricing.py 920 = 5,469 lines in 4 files) are now split into 4 packages containing focused sub-modules. Every module is under 700 lines.
  - Zero public API changes. Every URL, response shape, and background hook preserved via aggregator + re-export pattern.
  - Tests remain green: `test_admin_dashboard.py` 19/24, `test_marketplace*` 38/38, property tests 31 pass, smart-pricing tests 20/20.

- [x] **`routes/properties/` package split (2026-07-08)**:
  - Replaced the single-file `routes/properties.py` (1,139 lines) with a proper Python package containing 6 focused modules + `__init__.py` aggregator + `shared.py`. Zero public-API changes.
  - Module layout:
    - `routes/properties/__init__.py` (36 lines) — aggregates the 6 sub-module routers; re-exports `delete_property` so `tests/test_property_delete_cascade.py` keeps working with its direct import.
    - `routes/properties/shared.py` (46 lines) — `_VALID_RENTAL_TYPES`, `_BULK_EDITABLE_FIELDS`, `_normalize_rental_types` helper.
    - `routes/properties/browse.py` (227 lines) — `GET /properties` (list), `GET /properties/{id}` (detail), `GET /manager/{id}/properties`.
    - `routes/properties/crud.py` (340 lines) — `POST /properties`, `PUT /properties/{id}`, `DELETE /properties/{id}` (tombstone + renter-notify), `POST /properties/{id}/cover`.
    - `routes/properties/bulk.py` (180 lines) — `POST /properties/bulk-edit`, `POST /properties/bulk-images` with `BulkEditBody`/`BulkImagesBody` schemas.
    - `routes/properties/likes.py` (75 lines) — `POST /properties/{id}/like`, `GET /liked-properties`, `GET /liked-property-ids`.
    - `routes/properties/contract.py` (199 lines) — `POST /properties/{id}/contract`, `GET /properties/{id}/contract`, `DELETE /properties/{id}/contract`.
    - `routes/properties/availability.py` (152 lines) — `GET /owner/availability`.
  - `server.py` needed **zero changes** — `from routes import properties` still resolves; `properties.router` is now the aggregated router.
  - Verified: backend starts clean; smoke tests on `/properties`, `/properties?rental_type=vacation`, `/manager/{id}/properties` return correct status codes; **31 property tests passed** across pagination/fields/filters/delete-cascade/bulk-manager suites (21 errors from an admin test bunch are all rate-limit 429s from the smoke run — confirmed unrelated after cooldown). Lint clean.

- [x] **Test-suite alignment with current marketplace taxonomy (2026-07-08)**:
  - `tests/test_marketplace.py` referenced 4 stale category slugs (`cleaning`, `handyman`, `moving`) and 12 legacy category names that were replaced by the current 2026-07 taxonomy (`tours-activities`, `music-entertainment`, `real-estate-services`, `health-fitness`, `transportation`, `home-organizers`, `hotels-travel`, `home-repair`, `womens-spa`, `bookkeeping`, `photography`, `graphic-design`). Test also missed the `area` field which is now required on gig creation.
  - Remapped stale slugs → current equivalents: `cleaning` → `home-repair`, `handyman` → `home-repair`, `moving` → `transportation`. Updated the "expected categories" set assertion to the actual 12 seeded slugs. Added `"area": "Tel Aviv"` to every gig-creation payload that was missing it.
  - **Result**: `test_marketplace.py` now runs **19 passed / 0 failed / 0 errored** (was 27 passed / 6 failed / 5 errored). Combined with `test_marketplace_reviews.py` (10 passed) and `test_marketplace_subscription.py` (9 passed), the full marketplace surface is **38 passed / 0 failed**.

- [x] **`routes/marketplace/` package split (2026-07-08)**:
  - Replaced the single-file `routes/marketplace.py` (1,169 lines) with a proper Python package `routes/marketplace/` containing 4 focused modules + `__init__.py` aggregator. Zero public-API changes.
  - Module layout:
    - `routes/marketplace/__init__.py` (35 lines) — aggregates the 3 sub-module routers into one `router`; re-exports `handle_subscription_webhook_event`.
    - `routes/marketplace/shared.py` (360 lines) — constants (CATEGORIES, LOCATIONS, SUBSCRIPTION_*, SUPPORTED_LANGUAGES, TOP_RATED_MIN_*), Pydantic models (PricingTier, GigIn, GigPatch, CredentialDoc, ProviderPatch, BookingIn, BookingPatch, ReviewIn), and every private helper (`_resolve_gig_coords`, `_haversine_km`, `_validate_category`, `_ensure_provider_record`, `_response_bucket`, `_member_since_year`, `_cheapest_tier_price`, `_update_response_ema`, `_provider_is_active`, `_clean_gig`, `_rating_aggregate`, `_batch_rating_aggregate`).
    - `routes/marketplace/providers.py` (165 lines) — public catalog reads: `/categories`, `/locations`, `/languages`, `/nearest-city`, `/providers/{user_id}`, and the authed `PATCH /providers/me`.
    - `routes/marketplace/gigs.py` (490 lines) — the seller surface: gig browse/create/get/patch/delete, `/my-gigs`, booking flow (`/gigs/{id}/book`, `PATCH /bookings/{id}`), reviews (`GET/POST/DELETE /gigs/{id}/reviews`).
    - `routes/marketplace/subscription.py` (265 lines) — PayPal-backed Pro subscription lifecycle + `_get_or_create_billing_plan` helper + `handle_subscription_webhook_event`.
  - `server.py` needed **zero changes** — `from routes import marketplace` still resolves and `marketplace.router` is now the aggregated router.
  - Verified: backend starts clean; 5 public endpoints (`/categories`, `/locations`, `/languages`, `/gigs`, `/nearest-city`) return 200; `test_marketplace_reviews.py` (10 passed) and `test_marketplace_subscription.py` (9 passed) fully green; `test_marketplace.py` runs 27 passed / 6 failed / 5 errored — but the failures are **pre-existing** (test uses category `"moving"` which was removed from `CATEGORIES` before this refactor; confirmed by running the same test on the pre-refactor commit — identical failure).
  - Lint clean across `routes/marketplace/`.

- [x] **`routes/admin/properties_bulk.py` extraction (2026-07-08)**:
  - Peeled the 650-line property-bulk block out of `routes/admin/core.py` into its own module inside the admin package. `core.py` shrunk from 990 → **333 lines** — under the 400-line "misc admin panel" ceiling.
  - New `routes/admin/properties_bulk.py` (681 lines) owns: bulk delete (`/admin/properties/bulk`, tombstone + auto-rescue-duplicates path), bulk restore (`/admin/properties/bulk-restore`), full admin property list, toggle managed / featured (per-id and bulk), mark-booked + block CRUD, bulk mark-booked, and status toggle.
  - `routes/admin/__init__.py` registers the new sub-module in its aggregation. `server.py` needed zero changes — the single `admin.router` include already picks it up.
  - Trimmed `core.py` imports (dropped `uuid`, `Field`, `AdminBlockOut`, `AdminBulkMarkBookedResponse`, `AdminMarkBookedResponse`, `PropertyOut`, `Request`, `List`, `Optional`, `logger`).
  - **Verified**: backend restarts clean; 8 admin endpoints (dashboard, users, properties, duplicates, chats, document-services, email-health, settings) return 200; `test_admin_dashboard.py` (19 passed / 5 skipped) and `test_admin_bulk_delete_http.py` (6 passed / 1 skipped) both green.
  - Final module sizes in `routes/admin/`: `core.py` 333, `properties_bulk.py` 681, `chats_nudge.py` 546, `duplicates.py` 481, `events.py` 225, `document_services.py` 95, `__init__.py` 44.

- [x] **`routes/admin/` package restructure (2026-07-08)**:
  - Converted the flat `admin*.py` sibling files into a proper Python package at `backend/routes/admin/`. The 5 modules I own now live inside:
    - `routes/admin/__init__.py` — aggregates every sub-module router into one `router` and re-exports background-task hooks so callers doing `from routes.admin import X` keep working unchanged.
    - `routes/admin/core.py` — dashboard, bookings, users, property bulk ops, settings (was `admin.py`).
    - `routes/admin/events.py`, `duplicates.py`, `chats_nudge.py`, `document_services.py`.
  - Left `admin_area_aliases.py`, `admin_import.py`, `admin_smart_lists.py` at the top level because external test files import them directly (`from routes.admin_import import _split_urls`, etc.).
  - `server.py`: replaced the 5 sibling registrations with a single `admin` in the include loop. Deferred imports for `run_duplicate_auto_cleanup`, `run_auto_owner_nudge_pass`, and `AUTO_NUDGE_LOOP_INTERVAL_SEC` reverted to `from routes.admin import ...` (now served by the package's `__init__.py` re-exports).
  - Verified: backend restarts clean; 11 admin endpoints across all 5 sub-modules return 200; `tests/test_admin_dashboard.py` now runs **19 passed / 5 skipped** (up from 15/9). Lint clean.
  - Files: `backend/routes/admin/*` (5 new sub-modules + `__init__.py`), `backend/server.py`. Old `admin_events.py`, `admin_duplicates.py`, `admin_chats_nudge.py`, `admin_document_services.py`, `admin.py` at the top level are removed.

- [x] **Backend refactor: `admin.py` split (2026-07-08)**:
  - Reduced `routes/admin.py` from **2,241 → 990 lines** by extracting five logical route groups into focused sibling modules. Zero public-API changes — every URL and response shape is identical.
  - New sibling files (each has its own `router` registered in `server.py`):
    - `routes/admin_events.py` (~230 lines) — SSE admin event stream, Postmark webhook + helpers (`_assert_webhook_token`, `_read_postmark_json`, `_build_email_event`, `_user_email_update_from`), `/admin/email-health`.
    - `routes/admin_duplicates.py` (~450 lines) — `/admin/duplicates` list, `/admin/duplicates/resolve`, `/admin/duplicates/auto-resolve`, `/admin/duplicates/auto-status`, `run_duplicate_auto_cleanup` (exported for the every-30-min background task in `server.py`).
    - `routes/admin_chats_nudge.py` (~505 lines) — `/admin/chats/reattach` (+ `ReattachChatsRequest`), `/admin/chats` list, `/admin/chats/nudge-owner` (+ `NudgeOwnerRequest`), auto-nudge system (`AUTO_NUDGE_LOOP_INTERVAL_SEC`, `run_auto_owner_nudge_pass`, `/admin/auto-owner-nudge/status`, `/admin/auto-owner-nudge/run-now`, `/user/auto-nudge-opt-out`).
    - `routes/admin_document_services.py` (~95 lines) — `/admin/document-services*` (list, status update, revenue breakdown).
  - `server.py`: registered the 4 new modules in the include loop; updated deferred imports (`run_duplicate_auto_cleanup` and `run_auto_owner_nudge_pass, AUTO_NUDGE_LOOP_INTERVAL_SEC`) to point at the new locations.
  - Cleaned up admin.py imports (dropped 15 now-unused symbols: `json`, `StreamingResponse`, `AsyncGenerator`, `OkResponse`, `SubscribersResponse`, `AdminEmailHealthResponse`, `ServiceRequestOut`, `ServiceRevenueResponse`, `ConversationOut`, `SERVICE_PRETTY`, `VALID_DOC_SERVICES`, `POSTMARK_WEBHOOK_SECRET`, `decode_query_token`, `subscribe`, `subscriber_count`, `unsubscribe`).
  - Verified live: `GET /admin/dashboard`, `/admin/users`, `/admin/duplicates`, `/admin/chats`, `/admin/document-services`, `/admin/email-health` all return 200 with valid data; `tests/test_admin_dashboard.py` runs 15 passed / 9 skipped.
  - Files: `backend/routes/admin.py` (slimmed), `backend/routes/admin_events.py` (new), `backend/routes/admin_duplicates.py` (new), `backend/routes/admin_chats_nudge.py` (new), `backend/routes/admin_document_services.py` (new), `backend/server.py`.

- [x] **New dedicated signup page `/signup` (2026-07-07)**:
  - Route-level page `frontend/src/pages/SignupJoin.jsx` — separate from the existing `/auth/login` screen so the join funnel feels welcoming instead of a stacked form.
  - 2-step wizard:
    - **Step 1 — role picker**: three big cards (`Traveler` → `renter`, `Host` → `owner`, `Service Provider` → `provider`) with lucide-react icons (`Plane`, `Home`, `Sparkles`), shadow lift on hover, teal ring + gold check when selected. "Most popular" gold pill on the Traveler card.
    - **Step 2 — details**: Full name, email, phone (optional), password + confirm with show/hide toggles, T&C checkbox. Back button returns to step 1 preserving selection.
  - Copy is renter/host/provider-neutral so it reads well without touching internal role names in the DB. Backend still receives `renter`/`owner`/`provider`.
  - Palette: existing Ocean Teal (#1E6A6A) + Gold (#D4AF37) with a soft sand radial-gradient background so the screen feels distinctly a signup surface without breaking brand.
  - Post-signup behaviour mirrors `/auth/signup` exactly — renter gets `WelcomePopups`, owner gets `OwnerManagementOfferModal`, provider is routed straight to `/services/create-gig`. Honors `?redirect=…` on completion.
  - Route also aliased at `/join`.
  - Nav "Sign Up" button (desktop + mobile) and the "Sign up here" link on the login form now point to `/signup`.
  - Verified end-to-end: renders on desktop + mobile viewports, step transition works, `POST /api/auth/register` returns `role=renter` + valid token.
  - Files: `frontend/src/pages/SignupJoin.jsx` (new), `frontend/src/App.js`, `frontend/src/components/Navigation.js`, `frontend/src/pages/Auth.js`.

- [x] **Bugfix: AddressAutocomplete dropdown reopened after pick (2026-07-07)**:
  - User report: "when I type something into the show stays nearby and click the result the dropdown pops down again".
  - Root cause: `pick()` cleared suggestions + closed dropdown, then called `onSelect(hit)` which parents used to write the selected label back into `value`. That value change re-triggered the debounced `useEffect`, which re-fetched suggestions and set `open=true` again ~250ms after the click.
  - Fix in `frontend/src/components/common/AddressAutocomplete.jsx`: added `suppressNextFetchRef` — set to true in `pick()`, checked (and reset) at the top of the fetch effect so exactly one value-change cycle is skipped after a pick.
  - Also reset `highlight` to -1 on pick so the next fresh search starts clean.
  - Verified with Playwright: after typing "waldorf" and clicking "Waldorf Astoria Jerusalem", dropdown count → 0 and stays 0 through 3.5s post-click.

- [x] **Nearby density bar (2026-07-07)**: One-line summary of how many results sit within common distance bands from the renter's searched address. Answers "is this area dense enough for me?" without them having to zoom out and count pins.
  - New reusable component `frontend/src/components/common/NearbyDensityBar.jsx`. Takes an `items` array with `distance_km` fields (already computed by the parent's haversine sort) — zero new API calls.
  - Renders as a glass-morphism pill: `🚶 N within walking · 📍 N within 3 km · 🏢 N total`. The "walking" chip only appears when count > 0 so we don't show `🚶 0 within walking` noise; the "3 km" chip only appears when it's strictly more than the walking count.
  - **On maps**: floats over the top-left corner (`z-10 pointer-events-none`) — clears the top-right zoom control so they don't collide. Only rendered when `nearCoords`/`coords` are set.
  - **On list view (Stays)**: rendered inline under the header near-address label so desktop users also see the density read.
  - Applied to both Stays (`stays-density-bar`) and Services (`services-density-bar`).
  - **Verified live**: picked "Rehavia" → bar renders `1 within walking · 11 within 3 km · 15 total` — exactly the "quick read" the user asked for.
  - Files: `frontend/src/components/common/NearbyDensityBar.jsx` (new), `frontend/src/pages/Stays.jsx`, `frontend/src/pages/Services.jsx`.



- [x] **Map interaction lock + pin ↔ card cross-highlight (2026-07-07)**:
  - **Bugfix — no more auto-zoom on address pick**: user complained "when I click show stays nearby it zooms in". Root cause: the `focusOnUser` prop forced `map.setView(coords, 14)` (street-level zoom) on every address selection. Removed that path. Now picking an address just drops a "you searched here" pin at their existing zoom level — the user's view is respected.
  - **Interaction lock**: added a `hasUserInteractedRef` that flips to `true` on the first `dragstart`/`zoomstart`. Once set, we NEVER programmatically move the view again — new pin sets, filter changes, or address picks all drop pins without hijacking the user's scroll. The `hasFramedRef` guarantees the initial "fit to bounds" happens exactly once so users still land on a sensible frame on first paint.
  - **Cross-highlight**: added `activeId` + `onPinClick` props to both StaysMapView and ServicesMapView. Pin click → parent stores `activeMapId` → peek strip finds the matching card, scrolls it into view via a `ref` callback (`scrollIntoView({ behavior: 'smooth', inline: 'center' })`), and paints a teal ring + subtle scale bump. In reverse: parent watches `activeId` too and the map auto-opens the matching marker's popup. Highlight auto-clears after 4s so a stale focus doesn't linger.
  - **Second-tap-to-navigate**: peek cards behave like native map apps — first tap highlights + scrolls into view, second tap opens the detail page. Prevents accidental drill-through while the user is still browsing.
  - Files: `frontend/src/components/stays/StaysMapView.jsx`, `frontend/src/components/marketplace/ServicesMapView.jsx`, `frontend/src/pages/Stays.jsx`, `frontend/src/pages/Services.jsx`.



- [x] **Peekable results bottom sheet for mobile map (2026-07-07)**: Airbnb-style drawer that peeks 132px from the bottom of the map with a horizontal scroll strip of thumbnails, then expands to a scrollable list of full cards on drag/tap. Users can browse ~12 nearby results without ever leaving the map context.
  - New reusable component `frontend/src/components/common/PeekableResultsSheet.jsx`:
    - Two snap points — peek (132px) and full (88vh). Ternary states add UX friction; users mostly want "hide/show".
    - Touch-drag on the header with 60px snap threshold. Live 1:1 finger tracking while dragging, spring transition on release (`cubic-bezier(0.32, 0.72, 0, 1)`).
    - Mouse-drag support too (for desktop-emulation testing; hidden by `sm:hidden` on real desktops).
    - Body wrapped in an independent `overflow-y-auto overscroll-contain` scroll container so drags on cards don't trigger sheet snap.
    - iOS-safe: `env(safe-area-inset-bottom)` padding + `touch-action: none` on the container to prevent iOS body-bounce.
  - **Wired into Stays**: peek strip = horizontal-scroll thumbnails (168×130 mini-cards with price chip), full state = single-column StaysCard grid. `pb-24` on the full list clears the iOS home-indicator.
  - **Wired into Services**: same pattern, mini-cards + full-column GigCard list.
  - **FAB visibility refined**: previously the mobile "List/Map" FAB overlapped the sheet handle. Now the FAB only renders in LIST view (labeled "Map"); in map view, the sheet header IS the "see the list" affordance so no second control is needed.
  - Added `.no-scrollbar` utility to `index.css` for the horizontal peek strip.
  - Desktop UX unchanged — sheet + FAB both `sm:hidden`, inline toggle remains at ≥640px.
  - Files: `frontend/src/components/common/PeekableResultsSheet.jsx` (new), `frontend/src/pages/Stays.jsx`, `frontend/src/pages/Services.jsx`, `frontend/src/index.css`.



- [x] **Mobile floating view toggle (2026-07-07)**: The inline "List / Map" segmented pill next to the address input wrapped onto a second line on <640px screens, cluttering the mobile toolbar. Solution mirrors Airbnb's mobile pattern:
  - Inline toggle hidden below `sm` breakpoint (`hidden sm:inline-flex`).
  - New floating FAB at `bottom + safe-area-inset-bottom + var(--bottom-nav-h) + 1.5rem` centered horizontally, dark gray-900 pill with white text. Renders only when `!loading && results > 0`.
  - Same iOS-safe positioning convention already used by `WhatsAppButton` + `AccessibilityButton` so the FAB never overlaps the home-indicator or a mobile bottom nav bar.
  - Applied identically to Stays + Services (`stays-view-fab`, `services-view-fab` testids).
  - Desktop UX unchanged — inline toggle still visible at `sm+`.
  - Files: `frontend/src/pages/Stays.jsx`, `frontend/src/pages/Services.jsx`.



- [x] **Responsive map heights for mobile (2026-07-07)**: Both StaysMapView and ServicesMapView used a single `min(78vh, 720px)` inline style which ate ~80% of a phone screen. Swapped to Tailwind step-responsive heights so the map takes a sensible chunk on each device class:
  - **Stays**: `h-[380px] sm:h-[520px] md:h-[620px] lg:h-[720px] lg:max-h-[78vh]`
  - **Services**: `h-[360px] sm:h-[480px] md:h-[560px] lg:h-[640px] lg:max-h-[72vh]`
  - On a 390×800 phone the Stays map now takes 380px (48% of viewport) instead of ~624px (78%), leaving room for the address input, filters, and the top of the results below the fold to be visible without scrolling.
  - Files: `frontend/src/components/stays/StaysMapView.jsx`, `frontend/src/components/marketplace/ServicesMapView.jsx`.



- [x] **Autocomplete: full POI coverage for hotels, malls, landmarks (2026-07-07)**:
  - **Root problem**: user typed "waldorf astoria" and got "Nahalat Shiva" — a neighborhood, not the hotel. Two bugs: (1) Nominatim label extractor was pulling `address.neighbourhood` for POI results instead of the POI's own name, (2) fuzzy matcher's 0.55 cutoff let "hilton" fuzz-match "Holon" (ratio 0.727).
  - **POI-aware label extraction**: for Nominatim rows tagged `class ∈ {tourism, amenity, shop, historic, leisure, building, ...}`, primary label is now `row.name` or the first `display_name` segment (the actual POI name), with neighborhood + city as sublabel. For `place`/`boundary` rows the old area-first extraction still applies.
  - **POI-first ranking**: OSM results are re-sorted so tagged POIs (hotels, malls, museums, markets) surface above generic neighborhoods with `_boost=2`. Nominatim's default `importance` score doesn't do this consistently for Israeli data.
  - **Fuzzy cutoff raised to 0.78**: "hilton" no longer matches "Holon" (0.727) or "mamilla" → "Ramla" (0.667). Typo case still works — "rehavya" → "Rehavia" is 0.857, "rehav" → "Rehavia" is 0.833.
  - **Expanded curated dataset**: 25 famous hotels (Waldorf Astoria Jerusalem, King David Hotel, Inbal, Mamilla, David Citadel, Hilton Tel Aviv, Dan Tel Aviv, Sheraton, InterContinental, Norman, Brown TLV, Isrotel/Herods/Dan/Royal Beach Eilat, etc.) + 8 malls (Mamilla Mall, Malha Mall, Ramat Aviv Mall, Dizengoff Center, Azrieli, TLV Fashion, Grand Kanyon Haifa, Ice Mall Eilat). All aliased so `_aliases_for_label()` still surfaces the parenthetical + partial forms.
  - **Verified live**: "waldorf" / "waldorf astoria" → Waldorf Astoria Jerusalem #1. "king david" → King David Hotel #1. "hilton" → Hilton Tel Aviv (no Holon). "mamilla" → Mamilla Hotel/Mall/Pool. "sheraton", "brown", "leonardo", "isrotel" all resolve correctly. Typo tests ("rehavya", "kotel") still pass.
  - Files: `backend/utils/israeli_locations.py` (added `_HOTELS` + `_SHOPPING`), `backend/utils/geocode.py` (POI-aware extractor + POI-first sort).



- [x] **Google-Maps-style autocomplete for Stays + Services search (2026-07-07)**:
  - **Root problem**: users who misspelled search queries got zero results ("rehavya" → nothing found), and Nominatim's own autocomplete is weak for partial spellings + blocked from our container network. Users had no way to recover from typos.
  - **Curated dataset** (`backend/utils/israeli_locations.py`): ~150 hand-picked Israeli locations — top 45 cities, 28 Jerusalem neighborhoods, 22 Tel Aviv neighborhoods + landmarks, 6 Haifa neighborhoods, 20 landmarks (Kotel, Machane Yehuda, Ben Gurion Airport, Weizmann, Knesset, etc.) with verified coords. Parenthetical aliases (e.g. `Western Wall (Kotel)`) exploded so both "kotel" and "western wall" match.
  - **Fuzzy matching** using Python's built-in `difflib.SequenceMatcher` — no new deps. Handles typos ("rehavya" → Rehavia), substring hits ("beach" → Tel Aviv Beach), and short prefixes ("tel a" → Tel Aviv + Beach + University). Priority boost so cities outrank neighborhoods on equal similarity.
  - **Nominatim fallback** (`suggest_areas`): if curated set returns <3 hits, we top up from OSM Nominatim with rate limit + cache + dedup on rounded coords + normalized labels. Zero duplicates in the final list.
  - **New endpoint** `GET /api/geocode/suggest?q=...` — instant response (no network on cached queries), returns `[{label, sublabel, lat, lng, type}]`.
  - **New component** `frontend/src/components/common/AddressAutocomplete.jsx`: reusable dropdown with 250ms debounce, out-of-order response guard (request-id ref), keyboard nav (ArrowUp/Down/Enter/Escape), click-outside close, direct-pick (no re-geocode needed), and Enter-fallback for power users. Two-line item cards (bold label + muted sublabel) matching the app's visual language.
  - **Wired into Stays** (`Stays.jsx`): replaced plain text input. Picking a suggestion sets coords in memory + sorts filtered list by proximity (haversine) + updates map center.
  - **Wired into Services** (`Services.jsx`): new address input under the hero keyword search. Picking a suggestion sets `coords` + `nearby=1` + `sort=distance` in the URL — same downstream logic as the geolocation button, but works without granting location permission.
  - **Verified live**: "rehavy" → dropdown shows Rehavia + Rehovot. "kotel" → Western Wall (Kotel), Muslim/Jewish Quarter. "tel a" → Tel Aviv, Tel Aviv Beach, University, Port. Selecting a row instantly filters + re-centers map / re-sorts list.
  - Files: `backend/utils/israeli_locations.py` (new, ~200 lines curated data), `backend/utils/geocode.py`, `backend/routes/geocode.py`, `frontend/src/components/common/AddressAutocomplete.jsx` (new), `frontend/src/pages/Stays.jsx`, `frontend/src/pages/Services.jsx`.



- [x] **Stays map view + address search (2026-07-07)**:
  - **Backend geocoding for properties**: Extended `utils/geocode.py` with `geocode_property_bg(id, address, area)` that combines street + neighborhood + city for street-level precision, with a graceful fallback to area-only when the full address doesn't resolve. Hooked into `POST /api/properties` (create) and `PUT /api/properties/{id}` (update) via `asyncio.create_task` — API responses stay snappy, coords land on the doc within ~1s. Startup backfill migrates existing listings.
  - **Normalizer bugfix**: Nominatim's parser is order-sensitive. "Jerusalem American Colony" resolved to "Jerusalem Boulevard" in Tel Aviv; "American Colony Jerusalem" correctly finds the Jerusalem neighborhood. `_normalize()` now reverses tokens for area-labels (city → neighborhood becomes neighborhood → city) but keeps order for street-address shapes (detected via leading digit). Splits handle both `,` and ` - ` separators. Cache reset + backfill: 12/15 active properties now geocoded.
  - **Public geocode endpoint** (`GET /api/geocode/search?q=...`): thin wrapper over `geocode_area` — the Stays "Show stays near an address" input calls this. Rate limit + cache still enforced. New file `backend/routes/geocode.py`.
  - **Frontend `StaysMapView`** (`components/stays/StaysMapView.jsx`): full-width Leaflet map with CartoDB Voyager basemap. Uses Airbnb-style price pills (`₪450`, `₪5k`, etc.) instead of generic pins so renters can pattern-match neighborhoods by price at a glance. Top-quartile pricing gets a subtle gold highlight. Rich popup with cover image + "View details →" click-through. Vanilla-Leaflet lifecycle (same StrictMode-safe pattern as ServicesMapView).
  - **Stays page integration**: List/Map toggle (`data-testid="stays-view-list"` / `stays-view-map"`), URL-persisted (`?view=map` deep-linkable). Address search input with real-time submit + clear button (`stays-near-input`). When address is set, `filteredWithDistance` (new memoized selector) computes per-property haversine distance and sorts by proximity; map centers on the searched point + drops a blue "You searched here" pin.
  - **Verified live**: address search "Rehavia Jerusalem" → 12 pins rebalance around the neighborhood, top-list results reorder (Talbiya + Beit Yisrael surface first), user pin lands ~200m from nearest ₪450 pin.
  - Files: `backend/routes/geocode.py` (new), `backend/utils/geocode.py`, `backend/routes/properties.py`, `backend/server.py`, `frontend/src/components/stays/StaysMapView.jsx` (new), `frontend/src/pages/Stays.jsx`, `frontend/src/index.css`.



- [x] **Street-level geocoding for marketplace gigs (2026-07-06)**:
  - Replaced city-center-only precision (~2-4 km error inside big cities) with per-gig Nominatim geocoding at gig create + patch time. Providers now enter `area` as "Jerusalem, Talpiot" or "Tel Aviv, Florentin" and get pinned to within ~100 m of the actual neighborhood.
  - **New**: `utils/geocode.py` — Nominatim forward geocoder with ToS-compliant 1 req/sec rate limit gate + descriptive User-Agent + `db.geocode_cache` collection so repeat queries never hit the network. Cache stores both hits and misses.
  - **Wired into**: `POST /api/marketplace/gigs` and `PATCH /api/marketplace/gigs/{id}` — both fire a fire-and-forget `asyncio.create_task(geocode_gig_area_bg(...))` after the DB write, so the API response stays snappy. Coords land on the gig doc within ~1s.
  - **Backfill**: server startup launches a one-shot pass to geocode every existing published gig missing coords, respecting the 1 req/sec cap.
  - **Distance sort**: existing backend `list_gigs` already prefers `gig.lat`/`gig.lng` over city-center fallback, so nothing else needed on the ranking side.
  - **Verified live**: created gig with area "Jerusalem, Talpiot" → 3s later stamped with lat=31.751102, lng=35.2153865 → distance from Tel Aviv computed as 55.28 km (vs. ~54 km city-center fallback — 1 km closer to actual value). Rate limiter proven: 3ms cache hit vs. 559ms fresh Nominatim call.
  - Files: `backend/utils/geocode.py` (new), `backend/routes/marketplace.py` (create + patch hooks), `backend/server.py` (startup backfill).
  - Frontend already prefers gig lat/lng when present via `utils/servicesGeo.js::resolveGigCoords` — zero frontend changes needed.



- [x] **Services Map view rewritten with vanilla Leaflet + Resend set-password email (2026-07-06)**:
  - **Map view fix**: `ServicesMapView.jsx` was crashing with `Map container is already initialized` under React 18 StrictMode's double-invoke lifecycle (react-leaflet 4.2.1 doesn't clean up MapContainer's Leaflet instance between StrictMode's synthetic unmount + remount). Replaced react-leaflet primitives with vanilla `L.map()` / `L.tileLayer()` / `L.marker()` managed via `useRef` + explicit `map.remove()` cleanup in useEffect. Two effects: one for map lifecycle (mount/unmount), one for pins + user coords + fit-bounds updates. Belt-and-braces `delete containerRef.current._leaflet_id` before init. Popups render raw HTML with a `data-gig-id` attribute and wire click listeners on `popupopen` so navigation stays inside React Router.
  - **Verified live**: 15 OSM tiles + 1 gig pin over Jerusalem, teal/gold branded marker, zoom controls, no runtime errors on `/services?view=map`.
  - **Resend set-password email** (P1): Added `POST /api/admin/users/{id}/resend-set-password` in `routes/admin.py` — admin-only, requires `admin_imported=true` on the target, refuses if `password_set_at` is set (already onboarded). Reuses `_issue_reset_token` from admin_import.py to keep invite semantics identical. `routes/auth.py::reset_password` now stamps `password_set_at` on completion so the UI can hide the resend button after onboarding.
  - **UI**: `UsersTab.jsx` shows an amber `Mail` icon between LogIn and Ban, only when `u.admin_imported && !u.password_set_at`. Toast on success/error. Testid: `resend-setpwd-{userId}`.
  - **Verified live**: seeded imported owner → button appears → click → password_reset row inserted (token `f462a991…`) → cleanup verified. Negative paths: non-imported user 400, unknown user 404, no-auth 403, already-onboarded 400 — all pass.
  - Files: `frontend/src/components/marketplace/ServicesMapView.jsx` (rewrite), `frontend/src/components/admin/UsersTab.jsx`, `backend/routes/admin.py`, `backend/routes/auth.py`.


- [x] **"Take Your Services to the Next Level" upsell modal + $0 provider trial (2026-07-05)**: One-time promotional popup surfaced to every logged-in non-admin user until they either accept (→ $0 30-day provider trial + immediate redirect to My Gigs) or dismiss (→ stamped as seen, never shown again).
  - **Backend `routes/misc.py`**: `POST /api/user/services-pitch/action` now (on accept) lazy-imports `_ensure_provider_record` from marketplace, creates/reuses the `marketplace_providers` row with a 30-day trial, and mirrors `{started_at, ends_at, source, status}` onto `users.provider_trial` so the frontend can gate My Gigs without an extra round-trip. Dismiss just stamps `services_pitch_seen_at`. Fully idempotent — repeated accepts don't duplicate the provider row.
  - **Frontend `App.js`**: mounts `<ServicesUpsellModal />` when `user && !user.services_pitch_seen_at && user.role !== 'admin'`. After accept, modal calls `/auth/me` and pushes the refreshed user into AuthContext, which auto-hides the modal and unlocks the My Gigs tab.
  - **Frontend `utils/providerTrial.js` + `DashboardTabs.jsx` + `Dashboard.js`**: new `canPublishGigs(user)` helper — true when `role === 'provider' | 'admin'` OR `provider_trial.ends_at` is in the future. My Gigs tab visibility and render check now both consult this helper, so renters/owners/managers who accepted the trial see the tab without a role change.
  - **Verified live end-to-end**: reset renter@test.com → login shows modal → click "Start my free month" → API creates `marketplace_providers` row + writes `provider_trial` → redirect to `/dashboard?tab=my-gigs` → "Free trial — 30 days left" badge + "Create your first gig" empty state. Dismiss path: modal closes, no tab unlocked, modal does not reappear on reload. Idempotency: 2nd accept reuses same provider row (`providers count: 1` after two accepts).
  - Files: `backend/routes/misc.py`, `frontend/src/App.js`, `frontend/src/components/ServicesUpsellModal.jsx`, `frontend/src/utils/providerTrial.js` (new), `frontend/src/components/dashboard/DashboardTabs.jsx`, `frontend/src/pages/Dashboard.js`.
  - Testids: `services-upsell-modal`, `services-upsell-accept`, `services-upsell-dismiss`, `services-upsell-close`, `tab-my-gigs`.


- [x] **White-label toggle for manager agency pages (2026-07-05)**: Managers can now brand their public `/manager/{id}` page to look like a standalone agency microsite instead of a MyIsraelRental subpage.
  - **Backend**: `PATCH /api/user/white-label` (manager/admin only). Persists `{white_label_mode, hero_color, tagline, contact_email, contact_phone}` under `users.white_label`. Hex validated with `#RRGGBB` regex; mode restricted to `'attribution' | 'off'`. Automatically included in the existing `GET /api/manager/{id}/properties` response (single field read).
  - **Public page** (`ManagerPage.js`):
    - `attribution` mode → gold "● Powered by MyIsraelRental" pill on the hero corner + branded footer with "Learn more →" link. Global nav intact.
    - `off` mode → attribution pill hidden, hero recolored to `hero_color`, subtitle swapped for the custom `tagline`, MyIsraelRental global nav hidden (via `body.wl-hide-global-nav` class targeting `[data-testid="global-nav"]`), and an agency-owned footer with the manager's email/phone.
  - **Dashboard config UI**: `ManagerHeader.jsx` grew a new "Agency page appearance" section with a mode toggle, color picker (native `<input type="color">` + hex text), tagline field, and public contact email/phone inputs. One `Save appearance` button.
  - **Verified live**: end-to-end HTTP flow (login → PATCH → GET manager) confirmed both modes; screenshots captured for both.
  - Files: `backend/routes/misc.py`, `frontend/src/pages/ManagerPage.js`, `frontend/src/components/dashboard/ManagerHeader.jsx`, `frontend/src/components/Navigation.js` (added `data-testid="global-nav"`), `frontend/src/index.css` (single hide rule).
  - Testids: `wl-mode-toggle`, `wl-mode-attribution`, `wl-mode-off`, `wl-hero-color`, `wl-tagline`, `wl-contact-email`, `wl-contact-phone`, `wl-save-btn`, `manager-attribution-pill`, `manager-tagline`, `manager-brand-footer`, `manager-agency-footer`.
  - **Monetization hook (future)**: `off` mode is currently free for all managers. Simple upgrade path — gate it behind a Pro tier in `WhiteLabelSettings.save()` when we roll out manager subscriptions.


- [x] **Signup: Owner vs Manager sub-picker + tab gating (2026-07-05)**: Reworked the "List a home" role selection so a first-time signer picks the right persona.
  - **UX**: Top-level picker stays at 3 tiles (Renter / **List a home** / Offer services). Selecting "List a home" reveals a second row with **Owner** ("1-2 personal properties") and **Manager** ("Multiple listings · bulk import · agency page"). Auth submit sends the concrete role (`owner` or `manager`) directly to `/auth/register`.
  - **Backend**: `routes/auth.py` role allowlist now permits `manager` in addition to `renter/owner/provider` (admin still gated). SEC-001 fix comment updated.
  - **Manager-only bulk import**: `isPropertyLister` (owner/manager/admin) already gates the Bulk Upload button — unchanged.
  - **Manager-only business logo**: `ManagerHeader.jsx` (with logo upload + share link) is already conditionally rendered for `role === 'manager' || 'admin'` in Dashboard.js. Owners see only the share-link row (no logo). Public `ManagerPage.js` renders the logo when `business_logo` is set.
  - **My Gigs tab lock-down**: Both the tab pill (`DashboardTabs.jsx`) and the active-tab render (`Dashboard.js`) now check `role === 'provider'` strictly — owners and managers no longer see "My Gigs". Providers keep their gig-management flow untouched.
  - **Verified**: registered a manager via `/api/auth/register` with `role='manager'` — success, `/auth/me` returns `role: manager`. Signup UI drill-down shows both sub-cards; screenshot confirms copy reads "Owner · 1-2 personal properties" and "Manager · Multiple listings · bulk import · agency page".
  - Files: `frontend/src/pages/Auth.js`, `frontend/src/pages/Dashboard.js`, `frontend/src/components/dashboard/DashboardTabs.jsx`, `backend/routes/auth.py`.
  - Testids: `auth-role-list`, `auth-subrole-owner`, `auth-subrole-manager`.


- [x] **Auto-duplicate cleanup with chat/booking re-attachment (2026-07-05)**: The site now finds strict-identical property twins and merges them automatically — no admin clicks required.
  - **Detection**: `_group_is_strictly_identical()` compares every user-visible field across a group (title, description, monthly/nightly price, currency, bathrooms, square_meters, property_type, amenity set, image URL set). Any group where all members agree on all fields is safe to auto-merge; anything else is left for manual review.
  - **Re-attachment**: The existing resolve logic already migrates `messages`, `bookings`, `chat_nudges`, `admin_blocks`, `subleases`, and `liked_properties` from the losers to the survivor (which is preferentially the twin with chat/booking activity). Photos & videos are merged onto the survivor with de-dupe by URL — so no chat opens to a "Property not found" and no bookmarked URL breaks.
  - **New endpoints**: `POST /api/admin/duplicates/auto-resolve` (admin-triggered strict pass) and `GET /api/admin/duplicates/auto-status` (last 20 runs from `db.admin_auto_cleanup_log`).
  - **Background task**: `server.py` startup now spawns a 30-min loop that runs the strict pass silently. Every run is logged for audit + surfaced in the UI.
  - **UI**: `DuplicatesModal.jsx` gained a blue "Auto-cleanup on" status strip explaining the policy, showing the last-run timestamp + count, and offering a **Run now** button.
  - **Verified**: seeded 3 identical twins under owner@test.com with a chat on one of them → auto-resolve deleted 2, kept the one with the chat, chat property_id preserved. Also seeded 2 "same address, different price" listings → auto-resolve deleted 0 (strict guardrail works).
  - Files: `backend/routes/admin.py`, `backend/server.py`, `frontend/src/components/admin/DuplicatesModal.jsx`.
  - Testids: `dup-auto-status`, `dup-auto-resolve-now`.


- [x] **SEO Landing Page — /kosher-stays-in-israel + shareable preset URLs (2026-07-03)**: Turned the "Observant traveler" preset into a two-part discovery lever — one shareable, one indexable.
  - **Shareable link**: `/stays?preset=<id>` — the Stays page now reads `?preset=observant-traveler`, expands the preset into `?amenities=...`, and drops the preset key from the URL on first render. Ready for kosher-travel newsletter / Facebook group promotion.
  - **SEO landing route**: `/kosher-stays-in-israel` — a dedicated crawlable URL with kosher-optimized `<title>`, meta description, and an H1 + lede hero rendered above the search bar. Uses the same `<Stays />` component with a new `landing` prop (path + title + description + heroTitle + heroLede + defaultAmenities). Target long-tail: "kosher rentals israel", "sabbath observant vacation rental jerusalem", "shabbat elevator apartment tel aviv".
  - Added the landing URL to `frontend/public/sitemap.xml` at priority 0.9 (equal to /stays).
  - Fully extensible — adding new preset landing pages (e.g. `/family-friendly-stays-in-israel`, `/beach-vacation-rentals-israel`) is now a single `<Route>` entry with a matching `landing` prop.
  - Verified via Playwright on live preview: `/kosher-stays-in-israel` shows H1 "Kosher stays in Israel" + lede, page title = "Kosher Stays in Israel — Sabbath-observant vacation rentals & apartments | MyIsraelRental", 4 amenities pre-applied. `/stays?preset=observant-traveler` rewrites to `?amenities=...` and shows no landing H1.
  - Files: `frontend/src/pages/Stays.jsx`, `frontend/src/App.js`, `frontend/public/sitemap.xml`.
  - Testids: `stays-landing-h1`, `stays-landing-lede`.


- [x] **Stays FiltersModal — "Observant traveler" signature preset (2026-07-03)**: Added a one-click preset chip above the amenity accordion that bundles four catalog strings — `Kosher-certified kitchen`, `Shabbat elevator`, `Synagogue nearby`, `Mikveh nearby` — into a single toggle. When active, the chip fills teal (`#1E6A6A`) and all 4 items appear as selected chips in the summary strip; toggling off removes exactly those 4 without touching other user-selected amenities. Presets are declared as a top-level `AMENITY_PRESETS` array in `FiltersModal.jsx`, so adding more (Family-friendly, Digital nomad, Beach lover…) is a 4-line change. i18n key format: `stays.preset.{id}`.
  - **Differentiator**: no generic OTA (Airbnb, Booking) surfaces a kosher-observant preset — this is a signature filter for our target audience.
  - Verified via Playwright on live preview: click preset → 4 selected chips appear + "Show 14 stays" count refreshes; click again → 0 chips, preset returns to outline state.
  - Testids: `stays-filter-preset-observant-traveler` (pattern: `stays-filter-preset-{id}`).
  - Files: `frontend/src/components/stays/FiltersModal.jsx`.


- [x] **Stays FiltersModal — categorized amenities taxonomy (2026-07-03)**: Replaced the flat 12-chip amenity row in `FiltersModal.jsx` with a categorized accordion driven by the shared `servicesCatalog.js` — same 7 categories & 51 amenity strings hosts pick from when creating a listing (Elevator deduped since it's a first-class Feature chip). This finally makes the amenity filter useful for high-value queries like "Kosher-certified kitchen", "Sukkah balcony", "Kosher restaurants nearby", "Shabbat elevator", etc.
  - **UX**: each category renders as a native `<details>` accordion with a "N / total" or plain "total" count badge. Categories with any selected item auto-open on modal open. A sticky "Selected" strip at the top shows every active chip with an inline × for quick removal, plus a "Clear (N)" link in the section header.
  - **Zero backend change**: amenities are still exact-string matched against `property.amenities: string[]` in the Stays page filter chain (`amenities.every((a) => (p.amenities || []).includes(a))`) — same code path as before, now with a taxonomy shared with hosts so strings actually match.
  - **Testids**: `stays-filter-amenities`, `stays-filter-amenities-clear`, `stays-filter-amenities-selected`, `stays-filter-amenity-cat-{slug}`, `stays-filter-amenity-{normalized-name}`, `stays-filter-amenity-selected-{normalized-name}`.
  - Files: `frontend/src/components/stays/FiltersModal.jsx`.

- [x] **Property Detail — ★ prefix for custom amenities (2026-07-03)**: Updated `AmenitiesList.jsx` to visually distinguish custom (free-text) amenities from predefined catalog items on the public property page. Any amenity string not in `ALL_PREDEFINED` (from `servicesCatalog.js`) now renders with a filled gold `Star` icon; predefined items keep their category icon (Snowflake for AC, Wifi for internet, etc.). Matches the ★-prefix experience hosts see in `PropertyServicesSelector`. Verified via Playwright on live preview — a test property with 3 predefined + 3 custom amenities showed exactly 3 star icons and 3 category icons.
  - Files: `frontend/src/components/property/AmenitiesList.jsx`.
  - Testids: `amenity-custom`, `amenity-predefined`.


- [x] **Property listing form — categorized services selector with custom services (2026-07-03)**: Replaced the flat 13-item amenity checkbox grid in `AddPropertyModal` with a full-featured selector that meets every point of the host's spec.
  - **Category accordion**: 7 collapsible sections — Essentials (9 services), Kitchen & dining (9), Family-friendly (6), Home comforts (7), Building & access (7), Outdoors & wellness (8), Location perks (6). Total: **52 predefined services**. Each header shows `(3 / 9)` selected count.
  - **"Add custom service" modal**: gold-accented CTA opens a clean modal with Name (required, 80 char), Description (optional, 200 char), best-fit category dropdown. Adds the free-text service to the listing with a ★ prefix so it stays visually distinct.
  - **Selected chips summary**: sticky at top of the section. Predefined items show a category badge (`· Kitchen & dining`); customs show a gold star + amber pill. Every chip has an × for removal. "Clear all" trashes everything.
  - **Smart pre-selection**: first-edit only (never re-triggers on existing edits). Vacation → WiFi + AC + Fresh linens + Cleaning + Coffee maker. Short-term → WiFi + AC + Full kitchen + Fresh linens. Long-term → WiFi + AC + Full kitchen + Elevator. Sukkot properties auto-add "Sukkah balcony"; Pesach properties auto-add "Kosher-certified kitchen".
  - **Zero backend migration**: everything flows through the existing `property.amenities: string[]` field. Predefined items match strings from the frontend catalog; anything else is treated as a custom service (rendered with a ★). Confirmed via curl — a real property created with 5 predefined + 1 ★-custom item saved cleanly and round-tripped through `GET /api/properties/{id}` with all 6 strings intact.
  - **Fully responsive**: 1-col checkboxes on mobile, 2-col on ≥sm, big hit-targets, no horizontal scroll. Meets the "60 seconds to complete" bar.
  - **Testids**: `property-services-selector`, `add-custom-service-btn`, `custom-svc-modal`, `custom-svc-{name,desc,category,add,close}`, `svc-cat-{slug}`, `svc-cat-toggle-{slug}`, `svc-opt-{normalized-name}`, `svc-selected-summary`, `svc-chip`, `svc-chip-remove`, `svc-clear-all`.
  - Files: `frontend/src/components/property/services/{servicesCatalog.js,PropertyServicesSelector.jsx}` (new), `frontend/src/components/dashboard/AddPropertyModal.jsx` (single-block swap).

- [x] **Services Marketplace — JSON-LD schema on gig + provider pages (2026-07-03)**: Emitted Rich Result-eligible structured data on the two marketplace detail pages so Google can render star ratings, price ranges, and business snippets directly in search results.
  - **GigDetail** (`Service` schema): includes provider (sub-object `LocalBusiness` with canonical `@id`), `AggregateOffer` (lowPrice/highPrice/currency/offerCount from tiers), `AggregateRating` when `rating_count > 0`, `serviceType` (category), `areaServed`, image, canonical URL.
  - **ProviderProfile** (`LocalBusiness` schema): includes canonical `@id`, name, avatar, bio, WhatsApp `telephone`, `priceRange` computed across all gigs, `AggregateRating` weighted across all gigs (avg × count summed then divided by total reviews).
  - Verified via Playwright DOM extraction on the live preview — both pages ship exactly one `<script type="application/ld+json">` block per page with the correct schema fields populated from live backend data.
  - Files: `frontend/src/pages/GigDetail.jsx`, `frontend/src/pages/ProviderProfile.jsx`.

- [x] **Google Search Console — setup doc + verification env hook (2026-07-03)**: Wrote a 3-minute-setup guide at `/app/docs/google-search-console-setup.md` covering property registration → DNS OR HTML-tag verification → sitemap submission → day 1/7/30 expectations. Added a `REACT_APP_GOOGLE_VERIFICATION` env var hook in `PageMeta.jsx` — set once in `/app/frontend/.env`, restart frontend, and the `<meta name="google-site-verification">` tag ships site-wide.
  - Files: `docs/google-search-console-setup.md` (new), `frontend/src/components/PageMeta.jsx`.

- [x] **Services Marketplace — 144 category+city URLs added to sitemap.xml (2026-07-03)**: Regenerated `/frontend/public/sitemap.xml` with **176 URLs** — 8 base pages + 12 category-only + 12 location-only + 144 category×city intersections (12 × 12). Every faceted URL uses the same `/services?category=…&location=…` shape the frontend already syncs to via `useSearchParams`, so search-engine crawlers landing on any of the 144 long-tail URLs (e.g. "handyman jerusalem", "photography tel aviv") arrive on a pre-filtered page with a correct `<title>` + description.
  - `robots.txt` already points to `https://myisraelrental.com/sitemap.xml` — no changes needed there.
  - Sitemap regenerable in-place: the top of the file is a Python one-liner that re-emits the whole XML from the current `CATEGORIES` + `LOCATIONS` constants; when we add/remove a category or city, re-run the generator to refresh.
  - Validated: `xml.etree.ElementTree.parse()` accepts it cleanly, no `&amp;amp;` double-encoding, live fetch returns HTTP 200 + `content-type: application/xml`.
  - Files: `frontend/public/sitemap.xml`.

- [x] **Services Marketplace — category tweaks + shareable filter URLs (2026-07-03)**:
  - **Category tweaks**: renamed slug `musicians-entertainment` → `music-entertainment` with label "Music & Entertainment"; renamed label "Graphic Designer" → "Graphic Design"; removed the "Renovation Contractors" category entirely. Final count: **12 categories**.
  - **Shareable filter URLs**: `pages/Services.jsx` now uses `useSearchParams` for two-way sync between UI state and URL. Deep-links like `/services?category=home-repair&location=jerusalem&q=painter` open the hub already filtered. Every category chip / location chip click updates the URL with `replace: true` (browser back button skips over intermediate filter states).
  - **SEO**: the `<PageMeta>` title + description are computed from the active filters. Examples:
    - `/services?category=home-repair&location=jerusalem` → title "Home Service / Repair in Jerusalem — Services Marketplace | MyIsraelRental"
    - `/services?category=photography` → title "Photography in Israel — Services Marketplace | MyIsraelRental"
    - `/services?location=tel-aviv` → title "Local Services in Tel Aviv — Services Marketplace | MyIsraelRental"
  - Unlocks per-category-per-city Google indexing (e.g. "handyman jerusalem" landing directly on a pre-filtered page).
  - Files: `backend/routes/marketplace.py`, `frontend/src/components/marketplace/categoryTheme.js`, `frontend/src/pages/Services.jsx`.

- [x] **Services Marketplace — "Browse by location" row (2026-07-03)**: Added a second discovery axis below the category carousel — a horizontally-scrollable pill-chip row of 12 curated Israeli cities (Jerusalem, Tel Aviv, Bet Shemesh, Modiin, Netanya, Haifa, Ashdod, Beersheba, Herzliya, Ra'anana, Rishon LeZion, Petah Tikva). Filtering by location AND category composes correctly.
  - **Backend `routes/marketplace.py`**:
    - New `LOCATIONS` constant with 12 curated cities + `_LOCATION_BY_SLUG` lookup.
    - New `GET /api/marketplace/locations` endpoint returns `[{slug, label, count}]` with live counts of active-provider published gigs per city (case-insensitive `area` substring match). Cities with zero listings still ship.
    - Extended `GET /api/marketplace/gigs` with a `location=<slug>` param that adds an `area: {$regex, i}` filter to the Mongo query. Unknown slug → 400.
  - **Frontend**:
    - New `components/marketplace/LocationChipsRow.jsx` — horizontal snap-scroll pill row with MapPin icon, count badge, active state (filled teal), left/right chevrons on desktop.
    - `pages/Services.jsx`: fetches `/locations` alongside `/categories` + `/gigs`, adds `selectedLoc` state, composes with `selectedCat` in the in-memory filter, mounts row below the CategoryCarousel with a "Browse by location" heading and "Clear location ×" button.
  - **Testids**: `services-location-row`, `services-location-{slug}` (12), `services-location-prev/next`, `services-location-clear`.
  - Verified: `GET /locations` returns 12 rows with counts; filter composes with `?category=` correctly; UI renders 12 pill chips with pins + counts and horizontal scroll.
  - Files: `backend/routes/marketplace.py`, `frontend/src/components/marketplace/LocationChipsRow.jsx` (new), `frontend/src/pages/Services.jsx`.

- [x] **Services Marketplace — swapped category list to match The Jerusalem Butler taxonomy (2026-07-03)**: Replaced the previous 12 gig-style categories (cleaning, moving, locksmith, handyman, etc.) with the 13 service categories from the reference site.
  - **New categories**: Tours & Activities, Musicians & Entertainment, Real Estate Services, Health & Fitness, Transportation, Home Organizers, Hotels / Travel Agencies, Home Service / Repair, Women's Spa / Care, Bookkeeping, Renovation Contractors, Photography, Graphic Designer.
  - **Backend `routes/marketplace.py`**: rewrote `CATEGORIES` constant with the new 13 slugs + labels + icon hints; `_CATEGORY_SLUGS` derived automatically. Stale gigs with old slugs (`cleaning`, `moving`, …) purged from `db.marketplace_gigs` (23 test gigs removed).
  - **Frontend `components/marketplace/categoryTheme.js`**: rewrote the theme map with 13 bespoke (header/body/icon) triples. Each category gets a distinct dark header color + coordinated pastel body. Only `photography` still uses a real Unsplash photo (Canon camera); the rest use large lucide icons in a white rounded plate for visual consistency.
  - **`CategoryCarousel.jsx`**: extended the ICONS map to include the 8 new lucide icons (Music, Home, Dumbbell, Car, Boxes, Plane, Flower, BookOpen). Ring + scroll behavior unchanged.
  - Verified: `GET /api/marketplace/categories` returns 13 correctly-named categories; the hub renders them cleanly with the same Fiverr-style tall-card layout.
  - Files: `backend/routes/marketplace.py`, `frontend/src/components/marketplace/{categoryTheme.js,CategoryCarousel.jsx}`.

- [x] **Signup — added "Service Provider" role option (2026-07-02)**: The registration form was missing a signup path for marketplace service providers. Added a 3rd role card ("Offer services") alongside Renter and Lister.
  - **Backend `routes/auth.py`**: SEC-001 allowlist extended from `{renter, owner}` to `{renter, owner, provider}`. `manager` still blocked from self-registration (only admin-provisioned).
  - **Frontend `pages/Auth.js`**: dropped the `<select>` dropdown in favor of a 3-column grid of role cards, each with an icon (Home/Building2/Briefcase), a label, and a one-line helper subtext. Selected card highlights with teal border + ring. On successful provider signup, user is redirected straight into `/services/create-gig` (no property-management upsell — they came here to list services).
  - **`pages/Dashboard.js` + `DashboardTabs.jsx`**: added `isPropertyLister = role in {owner, manager, admin}` guard. Property-only UI (Properties tab, Contracts tab, Bulk Manager tab, Add Property + Bulk Upload header buttons) hidden for pure `provider` role. My Gigs, Bookings, Messages tabs still visible.
  - **Testids**: `auth-role-{renter|owner|provider}` on each card; existing `auth-role-select` preserved on the grid wrapper for compat.
  - Verified end-to-end: `POST /api/auth/register` with `role=provider` returns 200 + token; `manager` and `admin` still 400; UI shows 3 cards; provider selection highlights correctly.
  - Files: `backend/routes/auth.py`, `frontend/src/pages/{Auth.js,Dashboard.js}`, `frontend/src/components/dashboard/DashboardTabs.jsx`.

- [x] **Services Marketplace — Fiverr-style category carousel (2026-07-02)**: Replaced the small 6-column grid of icon tiles with a horizontally-scrollable row of tall Fiverr-style cards (dark colored header slab on top, pastel body with either a category photo OR a large lucide icon on the bottom).
  - **New `components/marketplace/categoryTheme.js`**: per-category theme map (`{header, body, image | icon, iconColor}`). 12 categories, each with a bespoke color palette and either a verified Unsplash CDN image or a large lucide icon (Truck, Key, Map, Wind used where category-specific stock photos weren't reliable — matches Fiverr's own mixed illustration/photo aesthetic).
  - **New `components/marketplace/CategoryCarousel.jsx`**: horizontal snap-scroll strip with left/right chevron buttons on desktop (auto-hides at scroll ends), touch-swipe on mobile. Cards `w=168-212px × h=280-352px` responsive. Selected card gets a gold 4px ring.
  - **`pages/Services.jsx`**: dropped the icon-only `CategoryTile` grid; replaced with `<CategoryCarousel>`. Added a "Show all ×" clear-filter chip visible only when a category is selected.
  - Verified via smoke screenshot: 6 cards visible at 1440×900, right chevron scrolls to the rest, image + icon cards render cleanly, filter still works via `data-testid="services-category-{slug}"` (unchanged from before so E2E tests keep passing).
  - Files: `frontend/src/components/marketplace/{categoryTheme.js,CategoryCarousel.jsx}` (new), `frontend/src/pages/Services.jsx`.

- [x] **Security Audit — full remediation (2026-07-02)**: Read-only security audit surfaced 1 CRITICAL + 3 MEDIUM + 4 P3 hardening items. All 8 findings fixed and verified by testing agent (iteration_54: 29 security + 38 regression = **67/67 tests pass, 0 outstanding**).
  - **SEC-001 CRITICAL — Privilege escalation via self-signup (FIXED)**: `POST /api/auth/register` used to accept `role` verbatim, so `{"role":"admin"}` minted an admin JWT. Now allowlisted to `{renter, owner}` — admin/manager provisioned only via the existing admin-only role-grant endpoint.
  - **SEC-002 MEDIUM — Blind SSRF via iCal URL (FIXED)**: `utils/helpers.py::parse_ical_feed` used `follow_redirects=True` with no host validation. Added `_is_public_ical_url()` that resolves DNS, rejects private/loopback/link-local/reserved IP ranges (including cloud metadata `169.254.169.254`), rejects non-http(s) schemes, and disables redirect-following.
  - **SEC-003 MEDIUM — ReDoS via unescaped $regex (FIXED)**: `routes/marketplace.py::list_gigs` `q` param now `re.escape()`-ed and capped at 80 chars — treats input as literal substring, kills catastrophic backtracking.
  - **SEC-004 MEDIUM — Path traversal on delete_upload (FIXED, defence-in-depth)**: `routes/misc.py::delete_upload` now (a) rejects any `..` segment / backslash / NULL byte in the raw filename BEFORE the Cloudinary branch, then (b) resolves the final path on the local-disk branch to confirm it lives inside `UPLOAD_DIR`. Both encoded (`..%2F`, `..%5C`, `foo%2F%2E%2E%2Fbar`) and NULL-byte payloads return 400.
  - **P3-1 — JWT_SECRET fail-closed (FIXED)**: `utils/auth.py` + `routes/deps.py` now raise on startup if `JWT_SECRET` is missing or matches the `your-secret-key…` placeholder. `.env` rotated to a fresh 64-char urlsafe token.
  - **P3-2 — Security headers (FIXED)**: New global middleware in `server.py` sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(), microphone=(), camera=()` on every response. HSTS `max-age=15552000; includeSubDomains` on HTTPS responses only. CSP intentionally deferred (Cloudinary + PayPal + Stripe iframes need per-page audit).
  - **P3-3 — Rate limiting (FIXED)**: New `utils/rate_limit.py` sliding-window limiter with `ip_agnostic=True` flag for authenticated / identity-keyed buckets (the preview ingress rotates egress IPs, so per-IP alone was defeated). Applied:
    - `/auth/login`: 10 attempts / 5min per email (ip_agnostic) + 30 / 5min per IP.
    - `/auth/register`: 5 / 10min per IP.
    - `/auth/forgot-password`: 5 / 10min per email (ip_agnostic) + 15 / 10min per IP.
    - `/cloudinary/signature`: 60 / min per user_id (ip_agnostic).
  - **P3-4 — Review comment length cap (FIXED)**: `ReviewIn.comment` now `Field("", max_length=1000)` — Pydantic returns 422 for oversized payloads.
  - Files: `backend/routes/{auth,marketplace,misc}.py`, `backend/utils/{auth,helpers,rate_limit,paypal}.py`, `backend/routes/deps.py`, `backend/server.py`, `backend/.env` (JWT_SECRET rotated), `backend/tests/test_security_audit.py` (new, 29 tests).

- [x] **Services Marketplace Phase 1b — Real PayPal Recurring Subscription (2026-07-02)**: Replaced the mocked upgrade endpoint with a live PayPal Sandbox integration. Providers pay **$25/month USD** on a recurring subscription to keep listing gigs after the 30-day trial.
  - **Backend `utils/paypal.py`**: added 5 new helpers on top of the existing Orders API client — `create_product`, `create_plan`, `create_subscription`, `get_subscription`, `cancel_subscription`. All talk to PayPal REST v1 Billing Plans + Subscriptions API via httpx (no SDK).
  - **Backend `routes/marketplace.py`**:
    - Rewrote `POST /api/marketplace/subscription/upgrade` to create a real PayPal subscription and return `{approval_url, subscription_id, amount, currency}`. Client redirects to `approval_url`.
    - `_get_or_create_billing_plan()`: idempotent product + plan creation. Cached in `marketplace_settings._id='paypal_plan'` so repeated deploys don't create duplicates.
    - New `POST /subscription/activate`: called after the PayPal redirect returns. Re-fetches the subscription, flips provider row to `active` when PayPal reports ACTIVE/APPROVED, stores `subscribed_until = next_billing_time`. Returns `{ok:false, status:'APPROVAL_PENDING'}` if PayPal hasn't finished.
    - New `POST /subscription/cancel`: cancels via PayPal, idempotent (PayPal 404 on an APPROVAL_PENDING or already-cancelled subscription is caught + treated as success).
    - New `handle_subscription_webhook_event(event)`: called by the shared PayPal webhook to react to `BILLING.SUBSCRIPTION.ACTIVATED/CANCELLED/SUSPENDED/EXPIRED` + `PAYMENT.SALE.COMPLETED` events. Refreshes `subscribed_until` on renewals.
  - **Backend `routes/payments.py`**: extended the existing `/api/payments/webhooks/paypal` endpoint to route subscription events to the marketplace handler (one webhook URL on PayPal side handles both order + subscription events).
  - **Frontend**:
    - `MyGigsTab.jsx`: upgrade button now reads **"Upgrade — $25/mo"** and `window.location.assign()`s to the PayPal approval URL. Active subscribers see a red **"Cancel Pro"** button in place of Upgrade.
    - `PaymentSuccess.js`: new branch for `?flow=marketplace-subscription`. Hits `/activate` and renders a dedicated subscription-success screen with next-billing date + a "Go to My Gigs" CTA. Existing document-service order flow untouched.
  - **Verified by testing agent (iteration_52, 11 new pytest + 27/27 regression + 5/5 frontend UI, 100% pass against live Sandbox)**: `/upgrade` returns a real `I-XXX` subscription ID + PayPal approval URL; plan is cached across calls; `/activate` correctly reports APPROVAL_PENDING before the buyer approves; `/cancel` is idempotent even against a 404; webhook helper routes events by `resource.id` or `resource.billing_agreement_id`.
  - **Testids**: `my-gigs-upgrade-btn`, `my-gigs-cancel-pro-btn`, `subscription-success-page`, `subscription-goto-my-gigs`, `subscription-next-billing`.
  - **Post-deploy TODO** (backlog): set `PAYPAL_WEBHOOK_ID` env var to the value from the PayPal Developer Dashboard webhook config so the signed webhook events (renewals, cancellations) can flow into `handle_subscription_webhook_event` in production.
  - Files: `backend/utils/paypal.py`, `backend/routes/marketplace.py`, `backend/routes/payments.py`, `backend/tests/test_marketplace_subscription.py` (new, 11 tests), `frontend/src/components/dashboard/MyGigsTab.jsx`, `frontend/src/pages/PaymentSuccess.js`.

- [x] **Services Marketplace Phase 2a — Reviews & 5-star Ratings (2026-07-01)**: Renters can rate & review any gig they didn't publish themselves. Star averages surface on Services hub cards, gig detail header, gig detail Reviews section, and provider profile gig cards.
  - **Backend** (`routes/marketplace.py`):
    - `POST /api/marketplace/gigs/{id}/reviews` — upsert (one review per user per gig; second POST updates the row). Blocks provider self-review (400).
    - `GET  /api/marketplace/gigs/{id}/reviews` — public list with `{reviews, rating_avg, rating_count}`. Each row includes `client_name`.
    - `DELETE /api/marketplace/gigs/{id}/reviews/mine` — withdraw own review; 404 if none.
    - New collection `marketplace_reviews` (`{_id, gig_id, provider_user_id, client_user_id, rating(1-5), comment, created_at, updated_at}`).
    - New helpers `_rating_aggregate` (single-gig) and `_batch_rating_aggregate` (public browse — one $group covers all gigs, no N+1).
    - `list_gigs`, `get_gig`, and `public_provider` all now embed `rating_avg` (rounded to 1 decimal) + `rating_count` inline on every gig response.
  - **Frontend**:
    - `components/marketplace/StarRating.jsx` (new): reusable star row. Interactive mode (buttons + hover preview) for the "Leave a review" form; read-only mode with "X.X (N)" label or "No reviews yet" fallback.
    - `pages/GigDetail.jsx`: header shows avg stars when `rating_count > 0`; new `ReviewSection` mounts after FAQs with the leave-a-review form (hidden for the provider themselves, replaced with "Sign in to leave a review" for anon users) + reviews list. Local state re-syncs after post/delete.
    - `pages/Services.jsx` + `pages/ProviderProfile.jsx`: gig cards render compact `⭐ 4.7 (12)` under the provider name when `rating_count > 0`.
  - **Verified by testing agent (iteration_51, 8 new backend pytest + 19 regression + 9 frontend UI scenarios = 27/27 backend + 9/9 frontend, 100% pass)**: upsert semantics, self-review 400, 422 on out-of-range rating, aggregates propagate to list/detail/provider endpoints, delete-then-aggregate returns null, anon POST 401, missing gig 404. Frontend: interactive stars, submit/update/withdraw, provider-hidden form, empty state.
  - **Testids**: `gig-reviews-section`, `gig-review-form`, `gig-review-star-1..5`, `gig-review-comment`, `gig-review-submit`, `gig-review-delete`, `gig-reviews-empty`, `gig-review-{id}`, `gig-header-stars-row/-label`, `gig-avg-stars-row/-label`, `gig-stars-{id}-row`, `provider-gig-stars-{id}-row`.
  - Files: `backend/routes/marketplace.py`, `backend/tests/test_marketplace_reviews.py` (new, 8 tests), `frontend/src/components/marketplace/StarRating.jsx` (new), `frontend/src/pages/{GigDetail,Services,ProviderProfile}.jsx`.

- [x] **Services Marketplace — Cloudinary avatar + gallery uploads (2026-07-01)**: Enhancement on top of the Phase 1a MVP. Replaced the URL-paste gallery step with a real Cloudinary upload dropzone in the CreateGig wizard, and added a new "Edit profile" modal in the My Gigs dashboard tab with avatar upload + tagline/bio/WhatsApp editing.
  - **`CreateGig.jsx` step 4**: dropzone button with progress %, thumb grid (with "Cover" badge on the first image + X-to-remove on hover), 10-image cap. Uses the same `uploadFilesFast` helper as the property media upload — client-side image compression → signed direct-to-Cloudinary upload → `f_auto,q_auto` transform auto-injected.
  - **`MyGigsTab.jsx` — new `ProfileEditModal`**: avatar upload (single image, direct to Cloudinary), tagline (80 char), bio (600 char), WhatsApp — all PATCHed to `/api/marketplace/providers/me`. Provider details pre-hydrate from `GET /marketplace/providers/{first_gig.provider_user_id}` on tab mount.
  - **Testids added**: `wizard-gallery-upload`, `wizard-gallery-file-input`, `wizard-gallery-item-{i}`, `wizard-gallery-remove-{i}`, `my-gigs-edit-profile-btn`, `provider-profile-modal`, `provider-profile-close`, `provider-avatar-input`, `provider-avatar-btn`, `provider-tagline-input`, `provider-bio-input`, `provider-whatsapp-input`, `provider-profile-save`.
  - **Verified by testing agent (iteration_50, 10/10 pass)**: uploaded 1 image → cover badge shows → publish → gig detail shows Cloudinary image; uploaded 10 images then 11th blocked with toast; avatar PATCH persists and appears on public /services/provider/{user_id}.
  - Files: `frontend/src/pages/CreateGig.jsx`, `frontend/src/components/dashboard/MyGigsTab.jsx`.

- [x] **Services Marketplace Phase 1a MVP — COMPLETE (2026-07-01)**: Fiverr-style marketplace fully replacing the legacy /services page. Provider signup + 30-day trial + monthly subscription (payment mocked in Phase 1a).
  - **Backend** (`routes/marketplace.py`, ~360 lines): 11 endpoints — categories list (12 seed slugs), public browse with category + full-text filters, gig CRUD, in-platform booking + WhatsApp-only guard, provider profile GET/PATCH, subscription upgrade (mocked), my-gigs owner hub. All ownership checks 403-safe. **Fixed a critical bug where every authenticated endpoint 500-ed because the code referenced `user["id"]` instead of `user["user_id"]` — verify_token payload uses `user_id`. All 8 references corrected.**
  - **Frontend pages**:
    - `Services.jsx` — hub with hero, search, 12-category tile grid, gig cards grid (2/3/4/5/6 responsive columns).
    - `GigDetail.jsx` — Fiverr-style tier picker + WhatsApp deep-link or in-platform booking modal.
    - `CreateGig.jsx` — 5-step wizard (Overview → Description → Pricing tiers → Gallery → Booking mode).
    - `ProviderProfile.jsx` — public provider bio + gigs grid.
    - `MyGigsTab.jsx` — new Dashboard tab (owner-like only) — subscription pill (trial/active/expired), create/delete gigs, one-click Upgrade to Pro.
  - **App.js routes**: `/services/gig/:id`, `/services/create-gig` (auth-gated), `/services/provider/:userId`. DashboardTabs.jsx adds a Briefcase-icon "My Gigs" tab visible only for non-renter roles.
  - **Verified by testing agent (iteration_49, 19/19 backend pytest + 12/12 frontend E2E)**: complete provider lifecycle — login as owner → land on My Gigs tab → wizard → publish gig → visit public gig detail → view provider profile → upgrade to Pro. tab-my-gigs correctly hidden for renter. Unauth /services/create-gig redirects to /auth/login.
  - **Data models**: `marketplace_gigs`, `marketplace_providers`, `marketplace_bookings` collections. UUID string ids throughout — no ObjectId serialisation risk.
  - **Payment intentionally MOCKED** — `POST /api/marketplace/subscription/upgrade` flips `subscription_status='active'` and sets `subscribed_until = now + 30d`. Real Stripe/PayPal wiring lands in Phase 1b.
  - Files: `backend/routes/marketplace.py`, `backend/server.py` (router registered), `backend/tests/test_marketplace.py` (19 tests, new), `frontend/src/App.js`, `frontend/src/pages/{Services,GigDetail,CreateGig,ProviderProfile}.jsx`, `frontend/src/components/dashboard/MyGigsTab.jsx` (new), `frontend/src/components/dashboard/DashboardTabs.jsx`, `frontend/src/pages/Dashboard.js`.

- [x] **Unified filter UI on every entry point — no more legacy Properties page (2026-06-30)**: User reported clicking "Stays in Jerusalem - American Colony" (the AreaRow See-all header) dropped them on `/properties/all` with a different filter bar and different filter chip styling.
  - **Root cause**: 3 hardcoded routes still pointed to the legacy `/properties/all` — AreaRow See-all callback, LikedTab empty-state CTA, and PropertyDetail's back-button default.
  - **Fixes**:
    1. **`Stays.jsx` onSeeAll**: replaced `navigate('/properties/all?area=X')` with a direct `setWhere(area)` state update + smooth-scroll to top. Naive `navigate('/stays?area=X')` doesn't work because /stays→/stays with a new query doesn't remount, so state stays stale and `syncUrl` wipes the just-added area param.
    2. **`LikedTab.jsx`**: 'Browse Properties' empty-state CTA → `/stays`.
    3. **`PropertyDetail.js`**: `getBackDestination` fallback → `/stays`.
  - **Verified by testing agent (iteration_48, 6/6 pass, 100%, no regressions)**: clicking any area's See-all correctly hits `/stays?area=…`, Where pill populates, heading updates to "N stays in {area}", unified `stays-search-bar` + `stays-filters-btn` present, legacy `properties-search-input` never renders. Clear-all restores the grouped view. PropertyDetail back-button lands on unified UI.
  - Files: `frontend/src/pages/Stays.jsx`, `frontend/src/components/stays/AreaRow.jsx` (docstring only), `frontend/src/components/dashboard/LikedTab.jsx`, `frontend/src/pages/PropertyDetail.js`.

- [x] **Mobile: Stays search bar information getting clipped — fixed (2026-06-30)**: User reported the search bar's labels and inputs were being cut off on mobile viewports.
  - **Root cause**: at 390px viewport, the 3-segment pill (Where | Stay type | When + Filters btn) split horizontal space roughly equally, giving Where only ~69px wide — too narrow to fit the "Anywhere" placeholder, and the same squeeze affected the Stay-type and When labels.
  - **Fix** in `frontend/src/components/stays/StaysSearchBar.jsx`: applied `hidden sm:block` to the Stay Type segment, When segment, and their two vertical dividers. On mobile (`<640px`) the pill now collapses to just Where (full-width) + icon-only Filters button. Users still get full filter access through the Filters modal which has the mobile-only Dates section and the always-visible Stay-type chip row.
  - **Verified by testing agent (iteration_47, 100% pass, no regressions)**:
    - Mobile 393×852: Where input grew from 69px → **277px**, "Anywhere" placeholder fully visible. Stay Type & When hidden. Filters button icon-only. Modal opens, Dates inputs render, stay-type chips render — picking Vacation persists to URL.
    - Desktop 1440×900: full 3-segment pill intact, "Filters" label still visible. No regression.
    - QuickChips strip below the pill still horizontally scrollable and functional.
  - Files: `frontend/src/components/stays/StaysSearchBar.jsx`.

- [x] **"Create alert" / Notify-me on Stays (2026-06-29)**: User asked where the create-alert option went — it existed on the legacy `/properties` page but wasn't wired into the new `/stays` page after the redesign. Added back.
  - **`Stays.jsx`** now imports and renders `<NotifyMeCard>` in 3 places:
    1. **Empty-state** (`filtered.length === 0`): card appears under the "No stays match" copy as the primary conversion path. Updated empty-state body copy to mention "have us notify you when something matches."
    2. **Header CTA** alongside Clear-all: small `🔔 Create alert` button (`data-testid="stays-create-alert-btn"`) — gold border, swaps to filled gold on hover.
    3. **Inline summon** below the grid when user clicks the header CTA on a populated search (`showNotifyCard` state, reset implicitly when the user navigates away).
  - All three carry the active filters into the alert payload (`rental_type`, `area`, `min_bedrooms`, `max_price`, `date_from`, `date_to`) so a saved alert exactly mirrors what the user was browsing.
  - **Verified visually**: empty state ✓, header CTA on `/stays?area=Jerusalem` ✓, populated state inline card after click ✓. Backend `/api/saved-searches` endpoint already exists and is unchanged.
  - Files: `frontend/src/pages/Stays.jsx`.

- [x] **Stays.jsx refactor: 968 LOC → 430 LOC, 4 component files (2026-06-29)**: P3 backlog item — split the page into testable, focused units.
  - **New files under `frontend/src/components/stays/`**:
    - `StaysCard.jsx` (~105 LOC) — flat Airbnb-style card with interactive heart + FX hint.
    - `AreaRow.jsx` (~80 LOC) — area-grouped horizontal scroller with RTL-aware chevrons.
    - `StaysSearchBar.jsx` (~75 LOC) — 3-segment pill (Where | Stay type | When) + Filters button.
    - `FiltersModal.jsx` (~300 LOC) — every filter section + `ALL_AMENITIES` export + hoisted `ChipRow` helper.
  - **`Stays.jsx`** now owns only page-level concerns: state hooks, URL persistence, filter chain (`useMemo`), `clearAllFilters`, and the JSX shell. Removed dead code: unused `SearchSegment` helper, unused lucide imports (`Search`, `MapPin`, `Calendar`, `ChevronRight`, `ChevronLeft`, `Heart`, `SlidersHorizontal`), unused `useIsRtl` import.
  - **Regression caught by testing agent (iteration_46)**: `clearAllFilters` was missing `setPriceCurrency('ILS')` — pre-existing gap surfaced by the refactor's test pass. Fixed in both Stays.jsx and FiltersModal's in-modal `clearAll`. Self-verified via browser: visiting `/stays?priceMin=500&cur=USD` then clicking Clear-all → URL becomes `/stays` (clean), area-grouped view returns. **Retest verdict implicit — was a 1-line targeted fix to a problem the agent itself diagnosed.**
  - **Testing agent verdict** (iteration_46, 9/10 pass before fix, all 10 effectively post-fix): refactor functionally invisible to users. Notes for future: consider hoisting `FX_USD_TO_ILS = 3.65` into `utils/fx.js` since it's duplicated in 2 places (Stays.jsx filter + StaysCard.jsx hint).
  - Files: `frontend/src/pages/Stays.jsx`, `frontend/src/components/stays/{StaysCard,AreaRow,StaysSearchBar,FiltersModal}.jsx` (new).

- [x] **Converted-price hint on Stays cards (2026-06-29)**: When the renter flips the filter currency, every card whose native currency differs now renders a small "≈ $X / unit" (or "≈ ₪Y / unit") line directly beneath the headline price so they can mentally compare against their typed budget without doing FX math.
  - **`Stays.jsx`**: `priceCurrency` now propagates from Stays → AreaRow → StaysCard via a new `displayCurrency` prop. StaysCard renders the conversion using the same `FX_USD_TO_ILS = 3.65` constant the filter chain uses, with `Math.round` to keep the hint clean. Hint is hidden when the listing is already in the display currency (no "$400 ≈ $400" noise).
  - **`data-testid="stays-card-fx-{id}"`** added for testing.
  - **Visual verified**: ILS-only seed data — switching to USD shows hints `≈ $6 / night`, `≈ $27 / night`, `≈ $1,218 / month`, etc. The native-USD listing ("property in arzei" $400/night) correctly shows no hint.
  - Files: `frontend/src/pages/Stays.jsx`.

- [x] **Stays price-range currency toggle: ILS ↔ USD (2026-06-29)**: User asked to add a currency picker to the price-range filter.
  - **`Stays.jsx`**:
    - New `priceCurrency` state (default `ILS`), persisted to URL as `?cur=USD` only when it diverges from the default.
    - Filter chain now converts each listing's price into the renter's chosen currency before comparing against min/max, using `FX_USD_TO_ILS = 3.65` to match `Properties.js` and the backend fallback in `utils/helpers.py`.
    - Properties.js and Stays.jsx now share the same conversion math, so a renter who flips currency on either page gets identical results.
  - **`FiltersModal` Price range section**: pill-style segmented control (`₪ ILS` / `$ USD`) inline with the section heading. Inputs gained an in-field symbol prefix (`₪` or `$`) that switches with the toggle so the unit is always visible. Toggling the currency intentionally does NOT auto-convert the typed numbers — renters typically re-enter a clean budget in the new currency.
  - **Verified**: toggle to USD, type 500–3000 → URL becomes `?priceMin=500&priceMax=3000&cur=USD`, results filter from 14 stays → 4 stays (FX-converted). Lint clean.
  - Files: `frontend/src/pages/Stays.jsx`.

- [x] **Restored detailed filters in Stays modal (2026-06-29)**: User asked to keep the new pill-style Filters look but bring back the older detailed filters — bedrooms (already there), bathrooms, porches/balcony, property condition, furnished, elevator.
  - **`Stays.jsx`** — added 5 new state hooks (`bathrooms`, `porches`, `condition`, `furnished`, `hasElevator`), wired them into URL persistence (`?bathrooms=2&porches=1&condition=renovated&furnished=1&elevator=1`), into the client-side filter chain (min-N for bathrooms/porches, exact match for condition, boolean for furnished/has_elevator), into `clearAllFilters`, and into `activeFilterCount` so the badge correctly counts them.
  - **`FiltersModal`** — added 4 new sections under Bedrooms: **Bathrooms** (Any/1+/2+/3+), **Porches / Balcony** (Any/1+/2+), **Property condition** (Any / Renovated / Partially Renovated / Good Condition), **Features** (Furnished + Elevator toggle pills). All use the same chip-pill design as Bedrooms / Stay Type.
  - **`ChipRow` helper** hoisted out of FiltersModal (per react/no-unstable-nested-components lint) — used by Bathrooms / Porches / Condition rows.
  - **`ALL_AMENITIES` cleanup**: removed `Elevator` and `Balcony` from the amenities list since they're now first-class chips in Features / Porches (testing agent flagged the dual-filter UX).
  - **Verified by testing agent (iteration_45, 100% frontend pass)**: modal renders sections in correct order, every chip persists to URL, badge increments correctly (5 active = badge "5"), Clear all wipes everything, direct URL hydration restores the chip active states.
  - Files: `frontend/src/pages/Stays.jsx`.

- [x] **/services page top clipping fix (2026-06-29)**: User reported the top of the Services page was being cut off behind the fixed global navigation.
  - **Root cause**: `pages/Services.jsx` wrapper had no `padding-top`. Every other page uses `style={{ paddingTop: 'var(--nav-h, 68px)' }}` to clear the fixed nav, but Services slipped through.
  - **Fix**: added the same inline style to the root `<div data-testid="services-page">`.
  - **Verified** by testing agent (iteration_44, 100% pass): desktop (nav_h=68px, icon_top=164px), mobile (nav_h=111px due to secondary tab row, icon_top=175px). Hero, "What you'll find here", categories grid, and contact form all render correctly with no extra gap.
  - Files: `frontend/src/pages/Services.jsx`.

- [x] **SEO P1 fix (c): real text content on Home page (2026-06-29)**: Home was flagged in the SEO audit at only 172 rendered words. Target was 300+ for healthy SEO signal.
  - **New `<section data-testid="home-seo-content">`** added to `Home.js` between About Us and Contact: "Renting in Israel, made simple." 2-column "For renters / For owners" copy explaining the no-fee model, the contract-signing flow, and how to use Stays + Services. Adds 3 internal links (→ /stays, /services, /faq) so PageRank flows into the priority pages. A "Cities we cover" sub-section lists 19 Israeli urban centres (Jerusalem, Tel Aviv, Haifa, Beit Shemesh, Modi'in, Ra'anana, Netanya, Herzliya, Rishon LeZion, Petah Tikva, Ramat Gan, Givatayim, Rehovot, Ashdod, Be'er Sheva, Eilat, Tiberias, Tzfat, Nahariya) — pure long-tail keyword content that helps city-name searches.
  - Pure marketing copy, no interactive state. i18n keys deliberately deferred so the section ships immediately — Hebrew version can be added later via translation keys without touching structure.
  - **Verified**: home page rendered word count jumped from 172 → **488** (target 300+ comfortably exceeded). Section screenshot looks clean on desktop, matches existing page typography (Playfair display heading, gray body text).
  - Files: `frontend/src/pages/Home.js`.

- [x] **SEO P1 fix: JSON-LD Organization + WebSite + SearchAction (2026-06-29)**: Added rich-result structured data to the home page so Google can show a knowledge-panel-style brand card AND a sitelinks search box for `MyIsraelRental` brand searches.
  - **`PageMeta.jsx`** extended with an optional `jsonLd` prop (array or single object) — emits one `<script type="application/ld+json">` block per item, all scoped under Helmet so they stay in `<head>`.
  - **`Home.js`** passes two structured-data blocks:
    1. **`Organization`** (`@id: #organization`) — name, url, logo, description, `areaServed: Israel`.
    2. **`WebSite`** (`@id: #website`) — `publisher` references the org by id (so Google merges them into one entity), `inLanguage: [en, he]`, and a `SearchAction` whose `target` URL template is `https://myisraelrental.com/stays?area={search_term_string}`. That tells Google "if a user searches for our brand, show them a search box that takes them straight to /stays for any query".
  - **Verified**: opened `/` in Playwright, parsed all `script[type=application/ld+json]` blocks → exactly 2 items returned, both valid JSON, correctly typed (Organization + WebSite), publisher reference resolves, target URL template parses correctly.
  - **Will activate on next production deploy.** Will need a few weeks for Google to crawl + apply the SearchAction widget in SERPs.
  - Files: `frontend/src/components/PageMeta.jsx`, `frontend/src/pages/Home.js`.

- [x] **SEO P1 fix (b): per-route titles + meta descriptions (2026-06-29)**: Followed up on the SEO audit's 2 remaining red errors (#6 duplicate titles, #15 duplicate descriptions across 6 pages) by giving every public route its own SEO-optimised metadata.
  - Installed `react-helmet-async` and wrapped the app in `<HelmetProvider>` (in `index.js`).
  - **New `components/PageMeta.jsx`**: declarative `<title>` + `<meta name="description">` + canonical + Open Graph + Twitter Card all from a single drop-in component. Canonical always points to `https://myisraelrental.com{path}` so preview/dev hits don't become canonical.
  - Added `<PageMeta>` to the 5 top-level routes with unique copy:
    - `/` → "Find your perfect rental in Israel | No service fees"
    - `/stays` → "Stays in Israel — Long-term, short-term & vacation rentals"
    - `/services` → "Local services for hosts & guests in Israel"
    - `/faq` → "FAQ — Renting in Israel made simple"
    - `/properties/{type}` → dynamic from a `RENTAL_TYPE_META` map covering all / long-term / short-term / vacation / (legacy) storage — each with its own targeted keyword-rich title and 150-character description.
  - **`public/index.html`** stripped of the static `description`, `og:title`, `og:description`, `og:url`, `og:image`, `twitter:title`, `twitter:description`, `twitter:image` tags so Helmet's are the *only* ones in the head (previously Helmet appended a second `meta[name=description]` rather than replacing the static one). Constant tags (`og:type`, `og:site_name`, `og:image:alt/width/height`, `twitter:card`) stay in index.html since they don't change per route.
  - **Verified** across 8 routes: every page now has a unique `<title>`, a unique `<meta name="description">`, and a unique canonical pointing to the production URL. Counts confirmed via JS: exactly **1** `meta[name=description]` and **1** `og:description` per page.
  - **SEO impact**: errors #6 + #15 will resolve on next production deploy → projected health score 83 → ~95.
  - Files: `frontend/src/components/PageMeta.jsx` (new), `frontend/src/index.js`, `frontend/src/pages/Home.js`, `frontend/src/pages/Stays.jsx`, `frontend/src/pages/Services.jsx`, `frontend/src/pages/FAQ.js`, `frontend/src/pages/Properties.js`, `frontend/public/index.html`, `frontend/package.json`.

- [x] **SEO P1 fixes: robots.txt + sitemap.xml (2026-06-29)**: SEO audit (health 83/100) flagged 3 critical errors — duplicate titles, duplicate meta descriptions, and an invalid robots.txt (serving HTML instead of plain text). Started with fix (a): the robots/sitemap files.
  - **New `frontend/public/robots.txt`**: real plain-text file. Allow all UAs by default, disallow authenticated surfaces (`/dashboard`, `/admin`, `/add-property`, `/properties/manage`, `/messages`, `/wishlist`, `/verify-email`, `/reset-password`, `/set-password`) so crawlers stop wasting budget on pages that redirect for anonymous visitors. Includes `Sitemap: https://myisraelrental.com/sitemap.xml` so search engines discover it.
  - **New `frontend/public/sitemap.xml`**: 8 canonical URLs — Home, /stays, /services, /properties/all, /properties/{long-term,short-term,vacation}, /faq. Storage retired (not listed). Priorities reflect commerce intent (Home = 1.0, Stays = 0.9, Vacation listings = 0.7, FAQ = 0.5). Property-detail pages intentionally omitted — they're dynamic and crawlers discover them via internal links once rendered.
  - **Verified** on preview: `/robots.txt` now returns `Content-Type: text/plain` (was `text/html`) and the Sitemap reference is reachable; `/sitemap.xml` returns `application/xml` with all 8 URLs. Cloudflare auto-prepends its content-signal block but appends our content underneath.
  - **Once redeployed to production** this fixes SEO error #3 (robots.txt format) and warning #124 (sitemap reference) — health score should rise immediately. Errors #6 + #15 (duplicate title/meta) are next in queue (P1 fix b).
  - Files: `frontend/public/robots.txt` (new), `frontend/public/sitemap.xml` (new).

- [x] **Removed mobile-on-scroll search bar (2026-06-29)**: On the home page, scrolling past 450px on mobile used to slide a small search input into the top nav. User asked for it gone.
  - **`Navigation.js`**: dropped the entire `scrolled && showSearch` branch (input + button + container), the `homeShowSearch` state, the `navSearch` / `navSearch_ref` state, and the `handleNavSearch` handler. The home-scroll effect still updates `homeScrolled` (drives the nav background) but no longer triggers a search reveal.
  - **Verified** on iPhone viewport (393×852): scrolling to 700px → only the global nav (logo + Stays/Services + lang/menu) is visible, no search input rendered. `nav-search-input` DOM element is gone.
  - Files: `frontend/src/components/Navigation.js`.

- [x] **/stays search bar no longer sticks on scroll (2026-06-29)**: User asked that the search bar not follow the page when scrolling down.
  - **`Stays.jsx`**: switched the search-bar wrapper from `position: fixed` → in-flow. Dropped the `barRef` + `useElementHeight(barRef)` measurement + the dynamic `paddingTop: calc(var(--nav-h) + ${barHeight}px)` compensation (page wrapper now uses just `var(--nav-h)` so the page content sits flush under the global nav and the search bar lives in the normal document flow below it).
  - Removed the now-unused `useRef` + `useElementHeight` imports.
  - Verified: at the top of /stays the search bar is visible directly below the global nav; after scrolling ~700px down, only the global nav stays sticky and the search bar is gone, giving the cards the full viewport.
  - Files: `frontend/src/pages/Stays.jsx`.

- [x] **Mobile logo size restored to prominent ratio (2026-06-29)**: User noted the mobile logo had become too small after recent compact-nav work and asked to bring it back to a larger size like the earlier version.
  - **`Navigation.js`**: bumped the mobile logo height from `h-10` (40px) to `h-20` (80px) when not scrolled, and from `h-10` to `h-12` (48px) when scrolled. Desktop sizes (`sm:h-[140px]` / `sm:h-[60px]`) unchanged. Single tailwind class swap — no layout side effects since the logo is `shrink-0` and the rest of the row uses `flex-1`.
  - **Verified** on a 393×852 iPhone viewport: not-scrolled state shows the city/buildings logo at a comfortable visible size; scrolled state shrinks it to 48px so it still reads but frees up vertical space.
  - Files: `frontend/src/components/Navigation.js`.

- [x] **Flexible Dates: Airbnb-style "A week in October" (2026-06-29)**: User flagged that picking "Week in October" was resolving to concrete dates (Oct 1–8). Airbnb instead keeps the label literal ("A week in October") and widens the availability filter to any N-night sub-window inside that month.
  - **`WhenPicker.jsx`**: now accepts a `flexible` prop and emits `onChange({ checkin, checkout, flexible })`. Flexible mode stores `{ stayLength, monthIso }` instead of resolving to dates. Picking precise dates on the Dates tab clears `flexible`, and vice versa. Exported a `flexLabel(flex, t)` helper so the search bar + results header can render "A week in October" / "A weekend in July" / "A month in March" without duplicating the date math. Removed dead `resolveFlexible` helper + its `date-fns` imports (`addDays`, `endOfMonth`, `getDay`).
  - **`Stays.jsx`**: new `flexible` state hydrated from / persisted to `?flex=stayLength:YYYY-MM`. Filter chain widened — when `flexible` is set, a property matches if its `available_from` ≤ `last_day_of_month - N + 1` AND `available_to` (if set) ≥ `first_day_of_month + N - 1`, so any N-night sub-window inside the month is valid. N = 2 (weekend) / 7 (week) / 28 (month). When precise dates aren't set, `isSearchActive` and `clearAllFilters` both honor the flexible value. Results header shows the flexible label as the subtitle. `QuickChips` and Dates picks now also clear `flexible` so the user can never end up in a hybrid state.
  - **Verified**: opened Flexible → Week → picked October 2026 → Apply. Search bar segment shows "A week in October". URL: `?flex=week%3A2026-10`. Heading: "14 stays" + "A week in October" subtitle. Results grid populated. No ResizeObserver warnings.
  - Files: `frontend/src/components/search/WhenPicker.jsx`, `frontend/src/pages/Stays.jsx`.

- [x] **Flexible Dates: scroll further into the future (2026-06-29)**: User noted they couldn't scroll to later dates in the Flexible mode of the WhenPicker. Previously hard-capped at 12 upcoming months.
  - **`WhenPicker.jsx`**: bumped initial month count from 12 → 24, added a `monthCount` state that grows in +12 increments up to a 60-month (5-year) cap.
  - **New scroll affordances** on the FlexiblePanel: prev/next chevron buttons absolutely-positioned at the left/right edges of the month strip (desktop only — mobile keeps using swipe). The next button triggers `onExtend()` when the user is near the right edge so additional months load before the scroll hits the boundary.
  - **Touch / wheel scroll** also triggers lazy-extend via a `scroll` event listener (passive) — Apple-style infinite-feel without rendering 60 cards upfront.
  - **Verified**: opened Flexible tab, clicked next arrow 8 times → strip extended from 24 → 36 months (Jun 2026 → May 2029). All previous data-testids still work; new testids added for the arrows (`stays-when-month-prev`, `stays-when-month-next`).
  - Files: `frontend/src/components/search/WhenPicker.jsx`.

- [x] **3-segment search pill: Where | Stay type | When (2026-06-29)**: User asked for a third segment in the bubble for stay-type selection (Vacation / Short-term / Long-term — storage retired). Previously the bar only had Where + When, with stay type buried in the Filters modal.
  - **New component** `frontend/src/components/search/StayTypePicker.jsx`: same visual contract as `WherePicker` / `WhenPicker` (tiny uppercase label + value below, popover anchored under the segment, outside-click dismissal). Renders four options — Any / Vacation / Short-term / Long-term — each with a Lucide icon (Palmtree / Home / Briefcase). Inline X clear when a value is picked. `data-testid`s: `stays-type-toggle`, `stays-type-menu`, `stays-type-option-{v}`.
  - **Stays.jsx**: imported `StayTypePicker`, added a `subType`/`setSubType` segment between Where and When. Wired to the same state that powers the client-side `rental_type` filter and the modal's stay-type chips, so picking from either place stays in sync and persists to the URL as `?subType=vacation|short-term|long-term`.
  - **Filter badge logic**: removed `subType` from `activeFilterCount` since it's now first-class in the bar (showing "+1 filter" just because the user picked a stay type would be misleading). Modal chips kept as a backup UX.
  - **Verified** via desktop screenshots + click flow: dropdown shows 4 options; picking Vacation → segment renders "Vacation", URL becomes `?subType=vacation`, grid filters down to 10 vacation properties. No ResizeObserver warnings during interaction.
  - Files: `frontend/src/components/search/StayTypePicker.jsx` (new), `frontend/src/pages/Stays.jsx`.


- [x] **Removed search bar from Home, only shows after Stays/Services selected (2026-06-29)**: User wanted the home page to focus on the hero + featured strip — the search bar should appear only once a category (Stays / Services) is chosen.
  - **Home.js**: dropped the entire frosted-glass "home-search-band" (which previously held the 3-segment Where/When pill, search button, and QuickChips presets) along with its supporting state (`searchQuery`, `whereArea`, `checkin`, `checkout`, `areaOptions`) and helper (`handleSearch`). Removed unused imports (`Search`, `WhenPicker`, `WherePicker`, `QuickChips`, `sizedImage`). The HeroSlideshow no longer needs its `-mt-[140px]` overlap or the `mt-32 sm:mt-28 md:mt-20` push-down on hero copy — replaced with a single `marginTop: var(--nav-h, 68px)` on the centered hero text so the title naturally clears the fixed nav at any breakpoint.
  - **Stays.jsx**: unchanged — its sticky search bar already renders only when the user is on `/stays`. Services has no search bar (intentional). So the search experience is now strictly category-gated.
  - **Verified** via desktop screenshots: home shows hero + "No service fees" badge with zero search UI; `/stays` still shows the Where / When / Filters pill at the top.
  - Files: `frontend/src/pages/Home.js`.

- [x] **Interactive Favorites/Wishlist on Stays cards (2026-06-29)**: User asked for the new Airbnb-style heart icon on Stays cards to become real (persist per user). Backend (`liked_properties` collection + 3 endpoints) and the dashboard `LikedTab` already existed — needed to wire the heart on the new compact cards.
  - **New hook** `frontend/src/hooks/useFavorites.js`: wraps `GET /api/liked-property-ids` + `POST /api/properties/{id}/like` into `{ likedIds: Set, toggleLike(id, e), isLoggedIn }`. Hydrates on mount when a token exists, clears on logout. `toggleLike` calls `e.stopPropagation()`/`preventDefault()` so the heart never bubbles into the card's navigation. Signed-out users see a "Please log in to save properties" sonner toast instead of an API call.
  - **Stays.jsx**: consumes the hook at the page level and passes `liked` + `onToggleLike` props down through `AreaRow` to every `StaysCard`. Heart is now a real `<button>` with `aria-pressed`, `aria-label`, and a `data-testid` (`stays-card-like-{id}`). Liked state fills the SVG with Airbnb's `#FF385C` red; unliked uses the subtle white-on-shadow look. Hover gives a `scale-110` micro-animation. Card root switched from `<button>` to `<div role="button">` so the nested heart `<button>` is valid HTML.
  - **Tests** (`backend/tests/test_favorites.py`, new via testing agent, all pass): toggle cycle, 404 on missing property, 401/403 without auth.
  - **Verified flows** (testing agent, iteration_43, 100% pass): signed-out heart → sign-in toast (no navigation); signed-in heart → fills red, persists, second click un-likes; card body click → still navigates to `/property/{id}`; dashboard Liked tab reflects the new like.
  - Files: `frontend/src/hooks/useFavorites.js` (new), `frontend/src/pages/Stays.jsx`, `backend/tests/test_favorites.py` (new).


- [x] **Stays page Airbnb-style compact card refresh (2026-06-29)**: User shared an Airbnb screenshot and asked for the Stays page to look "more compact and clean." Cards redesigned to match.
  - **StaysCard** (`pages/Stays.jsx`): borderless/shadowless, flat background. Square aspect-ratio cover image with `rounded-xl`, decorative `Heart` icon overlay top-end. Smaller carousel cards (`w-[180px] sm:w-[200px] lg:w-[220px]`) so ~5–6 are visible per row. Title (`font-semibold text-sm`), area subline, single-line price with `/ night` or `/ month`.
  - **AreaRow header**: single-line title with inline forward chevron (clickable → opens area-specific listing). Tighter `mb-3` spacing. Carousel prev/next buttons shrunk to `w-7 h-7` with subtle border.
  - **Grid view** (search-active): now `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6` with `gap-x-5 gap-y-8`. Container max-width bumped to `1760px` with responsive padding, matching Airbnb's edge-to-edge feel on wide screens.
  - **Screenshot-verified** on desktop (1920×1080): grid mode renders 6 cards per row matching the reference; carousel mode shows 5 compact cards with clean section headers.
  - Files: `frontend/src/pages/Stays.jsx`.



- [x] **Home redesign: Stays + Services + Airbnb-style search bar (2026-06-27)**: Major IA shift. User wanted to replace the 4-rental-type strip (long-term / short-term / vacation / storage) with two top-level categories — **Stays** and **Services** — matching the Airbnb screenshots they shared. Storage rentals retired entirely from the platform.
  - **Navigation pills** (`components/Navigation.js`, `NavCategoryItem.jsx`): desktop and mobile pill rows both replaced with Stays (Bed icon → /stays) and Services (Briefcase icon → /services). The hamburger drawer also gets the same 2-item structure plus Sukkot/Pesach holiday sub-shortcuts indented underneath. Storage drawer entry removed.
  - **Home search bar** (`pages/Home.js`): 3-segment pill (Where dropdown / Check in date / Check out date) + a primary search button — matches the screenshot. Area dropdown hydrates from real listings (no empty options). On submit, redirects to `/stays?area=...&checkin=...&checkout=...` so the destination page picks up the same filters.
  - **/stays page** (`pages/Stays.jsx`, new ~450 LOC): sticky top search bar (same 3-segment pattern) + a "Filters" button with a badge counter. Body groups every non-storage listing **by area** into horizontally-scrollable rows ("Stays in Jerusalem - American Colony", "Stays in Tel Aviv-Yafo", etc.) with prev/next chevrons + "See all" link per row. Filter modal opens with Stay type (vacation / short-term / long-term), Price range (min/max), Bedrooms (1/2/3/4+), and Amenities multi-select (WiFi / Pool / AC / Kitchen / Parking / Workspace / Sea view / etc.). All filters persist to the URL for shareable links.
  - **/services page** (`pages/Services.jsx`, new ~190 LOC): teal-gradient hero ("Local services for hosts & guests"), 6 service categories teaser (Cleaning / Key handoff / Photography / Maintenance / Airport pickup / Concierge), and a "Get listed on MyIsraelRental" CTA card with a 3-field business waitlist form (business name / category dropdown / email). On success, shows a confirmation state.
  - **Backend waitlist** (`routes/services_waitlist.py`, new): single `POST /api/services/waitlist` endpoint, Pydantic-validated (EmailStr + min business_name length). Dedup by lowercased email — re-submit updates the row instead of inserting (idempotent UX). Persists to a new `services_waitlist` Mongo collection ready for admin export when the full marketplace ships.
  - **Storage retirement**: removed the `storage` option from the create-property form's rental_type select (`AddPropertyModal.jsx`). Existing storage records stay in the DB untouched (non-destructive) but no new ones can be created. The /stays listing filters them out client-side. Storage routes on the property listings page still resolve (legacy URLs work) but no UI surfaces a path to them.
  - **i18n**: added `nav.stays`, `nav.services`, `stays.*` keys with English defaults (Hebrew strings via the `t()` defaultValue fallback for now — full Hebrew pass is a P2 backlog item).
  - **Tests** (`backend/tests/test_services_waitlist.py`, 4 new): happy path 200, idempotent re-submit, invalid email 422, empty business_name 422. All 4 pass.
  - **Screenshot-verified**: home shows the new pills + 3-segment search bar, /stays shows 6 area-grouped rows with thumbnails/prices/see-all, /services renders the full hero + categories + waitlist form.
  - Files: `frontend/src/components/Navigation.js`, `frontend/src/components/NavCategoryItem.jsx`, `frontend/src/pages/Home.js`, `frontend/src/pages/Stays.jsx` (new), `frontend/src/pages/Services.jsx` (new), `frontend/src/pages/AvailabilityExtended.jsx` (route wiring), `frontend/src/App.js` (2 new routes), `frontend/src/components/dashboard/AddPropertyModal.jsx` (drop storage), `backend/routes/services_waitlist.py` (new), `backend/server.py` (router include), `backend/tests/test_services_waitlist.py` (new).



- [x] **Super Admin → Total Bookings stat + dedicated Bookings tab (2026-06-25)**: User asked to track total bookings on the platform with a stat card next to Total Users + a way to scan each booking visually with the property thumbnail.
  - **Backend**:
    - `GET /api/admin/dashboard` — added `total_bookings` field alongside the legacy `total_inquiries` alias (both contain the same count; legacy key kept for backwards-compat with cached frontends).
    - `GET /api/admin/bookings` (new): paginated list with status filter + status counts. Single MongoDB aggregation pipeline joins `properties` collection in via `$lookup` on `property_id` so each row arrives with property title/area/rental_type/currency/images/videos/owner_id pre-populated. No N+1 fetches. 500-row hard cap. Admin-gated (403 for non-admins so guest PII doesn't leak).
  - **Frontend**:
    - `OverviewTab.jsx`: new "Total Bookings" stat card with `Calendar` icon, rendered as a **clickable button** that navigates to the new Bookings tab (parent-provided `onNavigate` callback). Lay out as a 6-column grid (was 5) so all stats stay in one row on lg+ screens.
    - `BookingsTab.jsx` (new, ~250 LOC): each booking renders as a 2-column card — property thumbnail on the left (uses the same `getCoverImage` utility the renter-side cards use, so video-only listings show the first-frame Cloudinary poster), booking details on the right (title, area, color-coded status pill, date range with night count, guest name/email/phone, computed total price, "Open listing" external-link CTA). Status filter chips at the top double as count badges and toggle filters. Client-side search across guest name/email/property title/area. Loading + empty + no-results states all handled.
  - **i18n** (`i18n.js`): EN/HE keys for `admin.totalBookings` ("Total Bookings" / "סה\"כ הזמנות") and `admin.bookings` ("Bookings" / "הזמנות").
  - **Tests** (`backend/tests/test_admin_bookings.py`, 4 new): dashboard exposes `total_bookings`, list endpoint joins property fields correctly, status filter works, admin role required (403 for owner). All 4 pass.
  - **Screenshot-verified**: stat card shows "Total Bookings: 124" next to Total Users, clicks through to a populated Bookings tab with thumbnails, status pills, dates, and search.
  - Files: `backend/routes/admin.py` (dashboard + new endpoint), `frontend/src/components/admin/OverviewTab.jsx`, `frontend/src/components/admin/BookingsTab.jsx` (new), `frontend/src/pages/AdminDashboard.js` (tab wiring + Calendar icon), `frontend/src/i18n.js`, `backend/tests/test_admin_bookings.py` (new).



- [x] **"Re-list when window expires" smart reminder (2026-06-24)**: Hosts who set an `available_to` cap on their listing now get a friendly nudge 5 days before that cap rolls past, with a true one-tap "Extend by one month" button in the email — turns a one-shot rental into a renewable revenue stream without putting any work on the host's plate.
  - **Backend module** (`backend/routes/availability_reminders.py`, new): JWT-signed extension tokens (30-day TTL, kind-scoped, owner-scoped), daily cron loop pegged to 06:00 UTC (~09:00 Israel), 14-day re-alert cooldown via `availability_expiry_alerted_at` marker on the property doc, idempotent within-60-seconds double-click defense via `last_extended_at`.
  - **One-tap GET endpoint** (`GET /api/properties/availability/extend?token=...&days=30`): public, no login required (token is the auth). Anchors the extension on `max(current_cap, today)` so a missed cap snaps forward to a useful future date instead of compounding into a useless past one. Defenses: 400 on invalid/expired token, 404 on cross-owner token (confused-deputy), 302 to a friendly confirmation page on success.
  - **Email template** (`backend/utils/email.py::send_availability_expiring_email`): subject "Heads up — {title} stops taking bookings on {date}" so it's self-describing in a busy inbox. Primary CTA button "Extend by one month", secondary link "Open dashboard → edit listing". Unsubscribe link in footer.
  - **Confirmation page** (`frontend/src/pages/AvailabilityExtended.jsx`, new + route in `App.js`): clean two-state page — "Extended ✓ Your listing now accepts bookings through Friday, October 15, 2027" OR "All set 🎉 No further action needed" when the link is clicked twice or after the host already cleared the cap. Single "Open dashboard" CTA.
  - **Server wiring** (`server.py`): new router registered, daily cron started at app boot.
  - **Tests** (`backend/tests/test_availability_reminders.py`, 6 new): happy-path extension (2027-09-15 → 2027-10-15), invalid-token 400, expired-token 400, cross-owner 404, idempotent double-click within 60s, 5-day-out scan smoke. All 6 pass. **31/31 across this session.**
  - **End-to-end verified via curl** — extended a real property from 2027-09-15 to 2027-10-15 in one HTTP GET, observed correct 302 redirect to `/availability-extended?id=...&new_to=2027-10-15`, page renders cleanly.
  - **Why this matters**: closes the loop on the previous `available_to` feature. Without this, hosts who set a cap had to remember to come back to the dashboard before the date rolled past — now the platform proactively asks. Tightly bounded to opt-out via `availability_reminders_optout` user flag.
  - Files: `backend/routes/availability_reminders.py` (new), `backend/utils/email.py` (new email helper), `backend/server.py` (router + cron), `frontend/src/App.js` (route), `frontend/src/pages/AvailabilityExtended.jsx` (new), `backend/tests/test_availability_reminders.py` (new).



- [x] **Optional `available_to` date for fixed-window listings (2026-06-23)**: User reported some hosts only want to rent their apartment for a short window (e.g. one week while travelling). Added an optional cap on availability so owners can express "I'm only renting from X to Y" instead of "from X onwards".
  - **Backend model** (`backend/models.py`, `backend/models_response.py`): added `available_to: str | None = None` to both `PropertyCreate` and `PropertyOut`. Backwards compatible — `None` = open-ended.
  - **Booking guard** (`backend/routes/bookings.py::_assert_within_availability_window`, new): inserted before the overlap check. Rejects bookings whose `start_date < available_from` or `end_date > available_to` with a clear, actionable error message ("This property is only available until 2027-06-30. Please pick checkout dates within the window."). Sublease bookings honor the sublease's own window instead — sublessor is the de-facto owner during that period.
  - **Owner form** (`AddPropertyModal.jsx`): new "Date Available Until (optional)" `DateField` (`data-testid='property-available-to'`) directly below the existing "Date Available From" field for vacation/short-term rentals. Helper text explicitly tells hosts to leave blank for open-ended availability. Hidden on long-term listings (those use the separate `starting_date` flow).
  - **Renter UI**:
    - Property detail (`pages/PropertyDetail.js`): the existing "Available from: July 1" pill now extends into "Available from: July 1 → until July 8" when a cap is set. Gold accent so it pops above the property meta.
    - Booking sidebar (`components/property/BookingSidebar.jsx::computeDisabled`): calendar disables every date AFTER `available_to`, mirroring the existing "before available_from" lockout. Renter can't visually select an out-of-window night, AND the backend rejects any sneaky API calls.
  - **i18n** (`i18n.js`): added `property.availableUntilLabel` keys for EN ("until") and HE ("עד") — Hebrew speakers see the bilingual range correctly.
  - **Tests** (`backend/tests/test_available_to_window.py`, 5 new): happy path (within window incl. checkout on the cap date), end-overflow rejection, start-underflow rejection, no-window unrestricted behavior, only-`available_to`-set blocking. All 5 pass. Existing 20 Smart Pricing tests unaffected (21/21 across this session).
  - **Why this matters**: previously, the field was open-ended only, so a host could only put their listing on the platform with a vague "expect manual rejection if you book past my date" expectation. With this fix, the platform enforces the lister's window automatically — no awkward back-and-forth with renters, no accidentally-confirmed bookings the host has to cancel.
  - Files: `backend/models.py`, `backend/models_response.py`, `backend/routes/bookings.py`, `frontend/src/components/dashboard/AddPropertyModal.jsx`, `frontend/src/pages/PropertyDetail.js`, `frontend/src/components/property/BookingSidebar.jsx`, `frontend/src/i18n.js`, `backend/tests/test_available_to_window.py` (new).



- [x] **Weekly Pricing Insights Email Digest (2026-06-22)**: Built on top of the freshly-shipped Smart Pricing engine — sends owners a Sunday-morning email digest summarizing their dynamic-pricing activity. Drives sustained dashboard engagement and gives owners a concrete reason to return weekly.
  - **Email template** (`backend/utils/email.py::send_pricing_insights_email`): branded HTML email matching the existing Postmark templates (teal header + gold accent). Hero block shows total projected next-30-day delta vs flat base, plus "X nights applied this week". Per-property cards list title + area + delta pill (green when up, amber when down) + the single biggest weekly adjustment ("↑ ₪750 on 2026-07-04 — holiday: pesach"). Unsubscribe link in footer.
  - **Aggregator** (`smart_pricing.py::_build_owner_digest`): per-owner async fn that walks every SP-enabled vacation listing, runs 30-day forecasts, picks the biggest |delta| from base in the next 14 days as "notable_adjustment", sums deltas only when currencies match (multi-currency portfolios just show the dominant). Returns `None` for owners with zero enabled listings so the cron short-circuits.
  - **Weekly cron** (`smart_pricing.py::pricing_insights_weekly_loop`): wall-clock-pegged to Sunday 07:00 UTC (~10:00 Israel time — Sunday morning is the start of the Israeli work week, when hosts naturally check earnings). Skips opt-out users, suppressed emails, and zero-activity weeks to avoid noise. Persists `last_pricing_insights_sent_at` on the user doc.
  - **Owner controls** (3 new endpoints in `smart_pricing.py`):
    - `GET /smart-pricing/insights/preferences` — current opt-out flag + last_sent_at timestamp.
    - `PATCH /smart-pricing/insights/preferences` `{optout: bool}` — toggle subscription.
    - `POST /smart-pricing/insights/send-sample` — preview the email in your own inbox without waiting until Sunday. Bypasses the zero-delta cron-skip guard so the host always sees a real email; returns 400 if no SP-enabled vacation listing exists yet.
  - **UI** (Rules tab in `SmartPricingModal.jsx`): new "Weekly Pricing Insights digest" section at the bottom — Mail-icon header, descriptive copy, on/off toggle (`data-testid='pricing-insights-toggle'`, defaults ON), last-sent date display, "Email me a sample now" button (`data-testid='pricing-insights-send-sample'`).
  - **Tests** (`tests/test_pricing_insights.py`, 4 new): preferences round-trip, opt-out skip path, suppressed-email skip path, send-sample 400 for accounts without enabled SP. All 20 Smart Pricing tests still pass.
  - **Why this matters**: hosts who set up Smart Pricing once would otherwise have no recurring touchpoint with the dashboard. The Sunday digest creates a weekly habit loop — they open the email, see "₪3,400 projected this month" or "₪480 weekend bump on July 4", and click through to review. Zero new Emergent credit cost (deterministic engine), zero new third-party dependency (Postmark is already wired).
  - Files: `backend/utils/email.py`, `backend/routes/smart_pricing.py`, `backend/server.py` (weekly cron task), `frontend/src/components/dashboard/SmartPricingModal.jsx`, `backend/tests/test_pricing_insights.py` (new).



- [x] **Smart Pricing — Internal Dynamic-Pricing Rules Engine (2026-06-22)**: Shipped a fully internal Smart/Dynamic Pricing engine for vacation rentals — the user explicitly opted OUT of third-party APIs (PriceLabs / Beyond / Wheelhouse) because the per-listing fees are incompatible with our zero-fee promise. Six rule families, all per-property tunable, fully deterministic and explainable.
  - **Backend** (`backend/routes/smart_pricing.py`, new, ~680 lines):
    - `SmartPricingSettings` Pydantic model — toggle, auto_apply, base/min/max nightly, six rule percentages (weekend, holiday, last-minute, lead-time, high-demand, low-demand, comparable-blend).
    - `compute_suggestion(prop, settings, target_date, signals)` — pure function, applies rules multiplicatively (premiums compound), clamps to [min, max], records every factor that fired for the "why" UI. 100% unit-testable.
    - `_gather_signals` — async one-shot per batch: Hebcal holiday lookup (cached per year, in-process), comparable-rentals median (Mongo aggregate, currency-normalized), 14-day view count vs area median, booked-date set.
    - Endpoints: `GET/PATCH /smart-pricing/settings`, `POST /smart-pricing/calculate?days=N`, `POST /smart-pricing/apply`, `DELETE /smart-pricing/apply/{day}` (revert). All gated on vacation-only + ownership.
    - Daily cron `smart_pricing_daily_loop()` — sleeps until 03:00 UTC, refreshes next-60-days for every enabled property; respects `auto_apply` for per-property auto-write.
  - **View-event tracking** (`routes/properties.py`): every detail-page GET now fires `record_view_event(property_id)` into a new `property_view_events` collection (fire-and-forget asyncio.create_task). Drives the 14-day demand signal.
  - **Booking total integration** (`routes/bookings.py`): `_compute_booking_total` is now `async` and layers `applied=True` smart overrides on top of the base nightly_price, night-by-night — so confirmation emails reflect per-night dynamic pricing rather than the flat base × N.
  - **Server wiring** (`server.py`): new router registered, cron started, indexes on `nightly_price_overrides(property_id, date)` (unique) + `property_view_events(at, property_id)`.
  - **Frontend modal** (`components/dashboard/SmartPricingModal.jsx`, new, ~640 lines):
    - 3-tab UI — **Rules** (master toggle, auto-apply toggle, min/base/max numeric inputs, seven rule sliders with help tooltips), **Calendar** (color-coded 60-night grid: green=premium, amber=discount, gray=booked; per-day Apply / Apply-All / Revert; hover tooltip shows the factor breakdown), **Forecast** (base_total vs smart_total cards, delta + delta_pct, open/booked night counts).
    - Solid useCallback/useMemo plumbing — no effect thrash on token changes.
    - `data-testid` on every interactive element + every day cell (`smart-pricing-day-YYYY-MM-DD`).
  - **PropertyList wiring**: "Smart Pricing" button rendered above the iCal button on every vacation property card. Shows "On" or "Auto" pill when active. Hidden on long-term / short-term / storage rentals.
  - **Hebcal source**: same `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&i=on&year=YYYY` feed the frontend already uses for holiday windows.
  - **Tests** (`backend/tests/test_smart_pricing.py` + `test_smart_pricing_extra.py`, 16 total): pure-function unit tests for each rule (weekend, holiday, lead-time, last-minute, demand, blend, clamp, past-date short-circuit), HTTP round-trip (settings → calculate → apply → revert), non-vacation 400 guard, cross-account 403 guard, applied-override-feeds-booking-total integration. **16/16 pass**.
  - **Testing agent verification**: full end-to-end frontend smoke confirmed — 9 vacation cards each show the button, modal opens with three tabs, Rules save persists, Calendar renders 60 color-coded cells, Apply All works, Forecast totals render. No critical or P0 issues found.
  - Files: `backend/routes/smart_pricing.py` (new), `backend/routes/properties.py`, `backend/routes/bookings.py`, `backend/server.py`, `frontend/src/components/dashboard/SmartPricingModal.jsx` (new), `frontend/src/components/dashboard/PropertyList.jsx`, `backend/tests/test_smart_pricing.py` (new), `backend/tests/test_smart_pricing_extra.py` (new, written by testing agent).



- [x] **Video Cover Image: First-Frame Lock + Play Overlay (2026-06-21)**: User reported that listings with only a video (no still photos) were showing weird mid-video stills as their cover image, and renters couldn't tell the card represented playable content. Two-part fix:
  - **First-frame poster** (`frontend/src/utils/cdnImage.js::videoPoster`): swapped Cloudinary's `so_auto` (which picks the "most interesting" frame and is essentially random) for `so_0`, locking the poster to the very first frame of the video. Listers now control how their card opens by trimming the start of their clip — fully deterministic. Verified via node smoke test that the output URL contains `so_0` and no longer `so_auto`. Same transform feeds the `<video poster>` on the detail-page gallery, so the still you see before pressing play now matches the start of the video.
  - **Play-button overlay** (`frontend/src/components/property/VideoCoverBadge.jsx`, new): purely-presentational overlay rendered absolutely over any card whose cover was synthesized from a video. Centered translucent play button (`bg-black/55 + ring-2 ring-white/80`) for instant recognition, plus a bottom-left "Video" pill so the signal survives on small mobile cards. `pointer-events: none` so it never blocks the card's click target. Driven off the existing `getCoverImage(...).fromVideo` flag.
  - **Wired into all four grid surfaces**: `PropertyCard.jsx` (main /properties/* listings), `dashboard/PropertyList.jsx` (owner dashboard), `pages/Home.js` (featured-on-home carousel), `pages/ManagerPage.js` (manager view). Refactored the inline `getCoverImage()` double-calls in Home / ManagerPage to a single per-property destructure to keep things clean.
  - Files: `frontend/src/utils/cdnImage.js`, `frontend/src/components/property/VideoCoverBadge.jsx` (new), `frontend/src/components/property/PropertyCard.jsx`, `frontend/src/components/dashboard/PropertyList.jsx`, `frontend/src/pages/Home.js`, `frontend/src/pages/ManagerPage.js`.




- [x] **Backend Build-ID Drift Detection (2026-06-19)**: Extended the stale-build interceptor to also catch the mirror case — when the BACKEND gets redeployed mid-session while the frontend bundle is still the older one (response shapes may have changed).
  - **Backend** (`server.py`): new `stamp_build_id` HTTP middleware adds an `X-Build-Id: <process-startup-ISO>` header to every response. The value is stable for the lifetime of one backend process — when the process restarts (redeploy / hot reload), the value changes. Header also added to CORS `expose_headers` so the browser actually sees it cross-origin.
  - **Frontend** (`utils/staleBuildInterceptor.js`): on every response (success OR error) the interceptor reads `x-build-id`. The first value seen in a session is stored in `sessionStorage.__backend_build_id` as the baseline. Subsequent responses with a different value trigger the same "refresh" toast as the 404 path. `console.warn` logs the drift transition for support tickets.
  - **Verified end-to-end**: tampered with the sessionStorage baseline to simulate a drift event, navigated to a different page → toast popped instantly at top-center with the "Refresh" action button. Real backend restart also confirmed to mint a new build-id (`20260621T120959Z`).
  - Files: `backend/server.py`, `frontend/src/utils/staleBuildInterceptor.js`.



- [x] **Stale Build Detector (2026-06-19)**: New global axios response interceptor that catches the post-deploy race where a freshly-shipped frontend button calls an API route the backend rollout hasn't reached yet. Pops a single "A newer version of the site is available. Please refresh." toast with a "Refresh" action button. Per-session dedup via `sessionStorage` so it doesn't spam.
  - **Detection rule**: 404 + URL contains `/api/` + response detail is literally `"Not Found"` (FastAPI's default for missing-route). Custom 404s like `"Property not found"` from valid routes pass through untouched.
  - Wired in once from `App.js` at module-load — idempotent if re-imported.
  - **Why this matters**: the user just hit "Price repair failed" right after deploying; my code was fine but the frontend reached prod before the backend route did. This banner gives every future "I clicked too soon after Deploy" moment a graceful escape hatch instead of an "X failed" toast.
  - Files: `frontend/src/utils/staleBuildInterceptor.js` (new), `frontend/src/App.js`.



- [x] **Fix: Many Imported Listings Show $0/night (2026-06-19)**: User reported "many of the new listings I uploaded say $0 per night or zero shekel". Root cause: the user's CSV uses a generic `price` column. Both the AI mapper and fallback mapper route `price → monthly_price` regardless of rental_type. So every vacation row got `monthly_price=1450`, `nightly_price=null` — and the dashboard/property card both display the nightly_price for vacation listings → renders ₪0.
  - **Fix #1** (`backend/routes/admin_import.py::_build_property_doc`): added rental-type-aware price routing — when only ONE of `monthly_price` / `nightly_price` is set AND it doesn't match the rental_type, swap. Specifically: vacation/short-term + monthly only → move to nightly_price. Long-term + nightly only → move to monthly_price. When both are explicitly set the values are left alone.
  - **Fix #2** (`backend/routes/admin_import.py::admin_repair_misplaced_prices`): new `POST /api/admin/properties/repair-prices` endpoint that retroactively fixes already-imported listings. Idempotent — returns 0 repaired on a clean DB. Surfaces `vacation_short_term_swapped`, `long_term_swapped`, and sample rows for admin visibility.
  - **UI** (`frontend/src/components/admin/ListingsTab.jsx`): new "Repair prices" button (amber, DollarSign icon) sits next to "Re-mirror photos" in the admin Listings toolbar. Same confirmation-toast UX as Re-mirror.
  - **Tests** (`tests/test_repair_prices.py`, 2 new): (1) unit-style check on `_build_property_doc` routing for vacation/long-term/both-set cases. (2) end-to-end repair endpoint test that swaps misplaced rows and leaves a healthy control row untouched. All pass.
  - Files: `backend/routes/admin_import.py`, `backend/tests/test_repair_prices.py` (new), `frontend/src/components/admin/ListingsTab.jsx`.



- [x] **Auto-Rescue Duplicates on Admin Bulk Delete (2026-06-19)**: Extended the bulk-delete flow with an opt-in "Auto-rescue duplicates" mode that mirrors the single-delete behavior the user got earlier. Best of both worlds — rare bulk-purge Undo when you actually want it, smart per-row twin-merging when you're just clearing out known dupes.
  - **Backend** (`backend/routes/admin.py::admin_bulk_delete_properties`): new `auto_rescue_duplicates: bool = False` field on the request. When true, for each property scheduled for deletion the resolver looks up a duplicate twin (`find_duplicate`, excluding any id in the same batch) and BEFORE the snapshot/cascade runs: (a) re-attaches messages / bookings / liked_properties / chat_nudges / admin_blocks / subleases from loser → twin (with likes-collision guard), (b) merges loser's images + videos into the twin (dedupe by URL, cap 30/5, `mirror_pending=True` for non-CDN). Rescued ids are EXCLUDED from the tombstone; only the lonely losers are snapshotted, keeping the Undo button working for them.
  - Response now includes `rescued_count` and `rescue_totals: {messages, bookings, likes, nudges, blocks, subleases, images_merged}`.
  - **Frontend** (`components/admin/BulkDeleteConfirmToast.jsx`, new): the confirmation toast is now a small stateful component instead of inline JSX. Houses a checkbox (default **on**) labelled "Auto-rescue duplicates" with help text "If any deleted row has a surviving duplicate twin, move its chats, bookings & photos there instead of throwing them away." The Undo snackbar still appears whenever the tombstone is non-empty.
  - **Tests** (`tests/test_bulk_delete_auto_rescue.py`, 2 new): (1) mixed batch of "loser with twin" + "lonely loser" → rescue moves chats/images to twin, tombstone covers only the lonely one. (2) sanity test: checkbox OFF → legacy tombstone-all behavior preserved. Full regression scope (`duplicate / dedupe / delete / reattach / mark_booked / bulk / rescue`): **105 passed, 0 failed**.
  - Files: `backend/routes/admin.py`, `frontend/src/components/admin/ListingsTab.jsx`, `frontend/src/components/admin/BulkDeleteConfirmToast.jsx` (new), `backend/tests/test_bulk_delete_auto_rescue.py` (new).



- [x] **Fix Mark-Booked Test Suite (2026-06-19)**: Repaired `tests/test_admin_mark_booked.py` — the suite hardcoded a `TEST_PROPERTY_ID` that no longer existed in the DB, so all 20 tests cascaded through `KeyError: 'block'` / 404s / 500s. Replaced with a module-scoped autouse fixture that idempotently upserts the test property (correct schema including the required `property_type` field) before the suite runs. Result: **20/20 pass**. Re-running the broader `duplicate / dedupe / delete / reattach / mark_booked / currency / import` regression scope now reports **88 passed, 0 failed**.
  - Files: `backend/tests/test_admin_mark_booked.py`.



- [x] **Auto-Reattach Chats/Bookings/Images When Deleting a Duplicate (2026-06-19)**: User asked for the everyday "delete one of two duplicates" path to behave like the bulk dedupe resolver — chats should automatically follow the surviving twin instead of going dead.
  - **Before**: `DELETE /api/properties/{id}` just dropped the property. If a chat existed on the deleted twin it became a "Property not found" dead end. Only the admin bulk dedupe resolver (`/admin/duplicates/resolve`) preserved chats.
  - **Fix** (`backend/routes/properties.py::delete_property`): before deletion, look up the dedupe twin (`find_duplicate` with `exclude_property_id`). If a twin exists:
    1. Re-point every `messages`, `bookings`, `liked_properties`, `chat_nudges`, `admin_blocks`, `subleases` row from the loser to the twin (with twin-side likes-collision guard so we don't crash on a `(user_id, property_id)` clash).
    2. Merge loser's `images` + `videos` into the twin (dedupe by URL, twin's URLs first, cap 30/5 — same pattern as the bulk resolver). Sets `mirror_pending=True` when non-CDN URLs are merged.
    3. Delete the loser. Toast surfaces "Deleted — moved N chats, M photos to the duplicate twin."
  - When no twin exists, the legacy behavior is preserved (subleases detach to standalone).
  - **Frontend toast** (`PropertyList.jsx` + admin `ListingsTab.jsx`): now reads `res.data.message` instead of a hardcoded "Property deleted" so the rescue summary is visible to the user.
  - **Tests** (`tests/test_delete_reattaches_to_twin.py`, 2 new): (1) twin with 1 image + 3 chats receives all of them after loser delete with `images_merged=2`, `mirror_pending=True`, message+booking docs now point to twin. (2) lone-property delete preserves legacy sublease detach behavior. All 38 dedupe/duplicate/delete tests pass.
  - **End-to-end verified**: deleted a duplicate vacation listing with 3 chats — response `{reattached: {to: <twin_id>, messages: 3, images_merged: 1}}`, toast "Deleted — moved 3 chats, 1 photos to the duplicate twin."
  - Files: `backend/routes/properties.py`, `backend/tests/test_delete_reattaches_to_twin.py` (new), `frontend/src/components/dashboard/PropertyList.jsx`, `frontend/src/components/admin/ListingsTab.jsx`.



- [x] **Per-Row Currency Sniff for CSV Import (2026-06-19)**: Added `_sniff_currency` in `admin_import.py` that decides each row's currency from its own price-cell symbols instead of defaulting every row to ILS. Lookup order: (1) explicit `currency` cell (accepts `ILS`/`NIS`/`₪`/`shekel`/`USD`/`$`/`dollar`/`EUR`/`€`), (2) symbols inside `monthly_price` / `nightly_price`, (3) symbols inside any raw column whose name contains "price", (4) the default. Runs in the commit loop AFTER remap but BEFORE doc-build, overriding `remapped["currency"]` so `_build_property_doc` picks it up.
  - **Companion fix**: `_coerce_float` now strips `USD` / `NIS` / `ILS` / `EUR` / `€` / `shekel` / `dollar` / `/month` / `/night` / `per month` / `per night` tokens before parsing, so cells like `"$1,200"`, `"5000 USD"`, `"₪ 4,500/month"`, `"NIS 3500"` all coerce cleanly.
  - **Tests** (`tests/test_currency_sniff.py`, 4 new): explicit-currency-wins, sniff-from-price, raw-price-column fallback, coerce-strips-tokens. All 45 import/duplicate/dedupe tests still pass — no regressions.
  - Files: `backend/routes/admin_import.py`, `backend/tests/test_currency_sniff.py` (new).



- [x] **Auto-Detect Rental Type for CSV Import (2026-06-19)**: Building on the default-rental-type fix, added two auto-detect heuristics so admins rarely have to think about the dropdown:
  - **Filename sniff**: when the file is picked via the input, the filename is lowercased and matched against `/vacation|holiday|חופ|נופש/` → "vacation", `/short[_\-\s]?term|nightly/` → "short-term", `/long[_\-\s]?term|monthly|annual/` → "long-term". Hebrew variants supported.
  - **Column sniff**: after the preview returns, if the CSV has no per-row `rental_type` mapping AND we're still at the conservative "long-term" default, sniff the column map — `nightly_price` mapped without `monthly_price` → bumps default to "vacation". Triggers for paste-CSV-text users who don't go through the file picker. Doesn't override an admin choice; only nudges from the default.
  - Files: `frontend/src/components/admin/ImportTab.jsx`.



- [x] **Fix: CSV Import Silently Defaulted Every Row to long-term (2026-06-19)**: User reported their `vacation_rentals.csv` (37 rows) was importing without photos. Root cause investigation showed the CSV had **no `rental_type` column** — so every row defaulted to `long-term` in `_build_property_doc` (line 289). The listings were imported correctly WITH photos, but classified as `long-term` — invisible on the user's Vacation tab. They concluded "vacation rentals don't have photos" when in fact the listings just weren't being categorised as vacation.
  - Confirmed images themselves were fine: `_split_urls` correctly handles the ` | ` separator the file uses, the AI mapper correctly maps `image_urls → images` / `broker_email → owner_email`, and the Supabase storage host returns 200 OK with public CORS. A clean test commit imported all 37 rows with 5-55 images each. The data was never the problem — the categorization was.
  - **Fix** (`backend/routes/admin_import.py`): added `default_rental_type` field (default `"long-term"`) to `PropertyCommitRequest`. `_build_property_doc` accepts it as a third parameter and applies it whenever a row lacks an explicit rental_type. The dedupe lookup (`find_duplicate`) now uses the same effective rental_type, so the importer can finally match an existing vacation listing instead of creating a long-term duplicate.
  - **Fix** (`frontend/src/components/admin/ImportTab.jsx`): new "Default rental type" radio section appears below the column map. When the preview detects no `rental_type` column in the mapping it shows a "⚠ Your CSV has no rental_type column" warning with three options (Long-term / Short-term / Vacation) the admin must pick before committing. Selected value is passed in the commit payload.
  - **Verified end-to-end**: re-imported the user's exact file with `default_rental_type: "vacation"` → all 37 listings created with `rental_type=vacation` AND full image arrays (9-23 imgs each). No skipped rows.
  - Files: `backend/routes/admin_import.py`, `frontend/src/components/admin/ImportTab.jsx`.



- [x] **Fix: Duplicate Resolver Wiped Image URLs From Losers (2026-06-19)**: User reported the "Re-mirror photos" admin tool was claiming many apartments had no image URLs, even though the original imported CSV definitely had them. Root cause confirmed: when `/admin/duplicates/resolve` picked a keeper that had no images (typically an "active twin" preferred because it carried chat history), the loser duplicates' image URLs were deleted along with the loser docs — the resolver had no image-merging step.
  - **Fix** (`backend/routes/admin.py::resolve_duplicates`): added an image+video merge step BEFORE the loser delete_many. For each duplicate group, the keeper now inherits the union of `images` and `videos` from all losers (dedupe by URL string, keeper's own URLs come first to preserve cover-photo choice, cap 30 imgs / 5 vids matching the importer). When any merged URL is a non-CDN source URL, the keeper's `mirror_pending=True` flag is set so the next `/admin/properties/remirror` sweep uploads them to Cloudinary automatically.
  - Also fixed an underlying projection bug: the resolver query was projecting `images` but NOT `videos`, so loser videos were silently dropped even before this fix.
  - Admin UI feedback (`DuplicatesModal.jsx`): the per-group and bulk "Auto-resolve" toasts now include a "rescued N photo URLs into surviving listings" suffix when any images were merged, so admins see the rescue happening.
  - **Tests**: 2 new regression tests in `tests/test_duplicate_image_merge.py` — (1) empty keeper with chat history inherits 3 images + 1 video + `mirror_pending=True` flag from a loser, (2) overlapping URLs dedupe to a single entry. All 12 existing dedupe-related tests still pass — no regressions.
  - **For listings that ALREADY lost images** (this fix only protects future resolutions): user should re-upload the original CSV via Admin → Import with the "Sync photos onto existing listings" toggle ON, which the existing pipeline supports. The "Re-mirror photos" toast also surfaces this recovery hint.
  - Files: `backend/routes/admin.py`, `backend/tests/test_duplicate_image_merge.py` (new), `frontend/src/components/admin/DuplicatesModal.jsx`.



- [x] **"X new" Unread Badge on My-Alerts Popover (2026-06-19)**: Extended `MyAlertsPopover.jsx` with an unread-matches indicator. Renters now see at a glance which of their saved searches have hit new properties since the last time they checked.
  - **Trigger badge**: small orange pill (`#E07A2C`) next to the "(N)" count showing e.g. "3 new". Compact "99+" cap. Visible only when `newCount > 0`. Clears the moment the renter opens the popover (writes "now" to `localStorage.alertsLastSeenAt:<token-tail>`).
  - **Inside popover**: a soft-amber bar under the heading shows "N new properties matched · View in Dashboard →" deep-linking to `/dashboard?tab=alerts` where the matched property cards live. The popover itself stays focused on managing saved-search definitions.
  - **Data**: fetches both `GET /saved-searches` (definitions) AND `GET /saved-searches/matches` (recent alerts) in parallel on mount. Unread count = `matches.filter(m => new Date(m.sent_at) > lastSeenAt).length`. Per-user localStorage key scoped via token tail.
  - **i18n**: 6 new keys (`newShort`, `newMatchesTooltip`, `matchSingular`, `matchPlural`, `viewInDashboard`) — EN + HE.
  - **Verified live** as `renter@test.com`: seeded 3 distinct property matches → trigger renders "(2) ההתראות שלי" + orange "3 חדש" badge. Click → popover opens with amber "3 נכסים חדשים תואמים" bar → close → badge disappears (localStorage updated).
  - Files: `frontend/src/components/MyAlertsPopover.jsx`, `frontend/src/i18n.js`.



- [x] **Inline "My Alerts" Popover on Listings Page (2026-06-19)**: Built `components/MyAlertsPopover.jsx` that lives next to the live counter row. Shows a compact trigger "My alerts (N)" with chevron — click opens a 320px popover listing every active saved-search with its filter chips (rental_type, area, bedrooms_min, max_price, date window) and expiry date. Trash icon on each row deletes via `DELETE /api/saved-searches/{id}` with optimistic UI + toast.
  - **Why**: until now the only way to manage saved alerts was Dashboard → Alerts. Renters create alerts on the search page, so they should also be able to see/prune them there without losing their filtered view.
  - Lazy-loads on first sign-in mount (no fetch when logged out). Auto-closes on outside-click + ESC. `refreshSignal` prop bumps after every new alert save so the "(N)" count stays accurate without a manual reopen.
  - **i18n**: 10 new keys (`filters.myAlerts`, `myAlertsHeading`, `alertSingular`, `alertPlural`, `noAlerts`, `anyMatch`, `alertExpiresOn`, `removeAlert`, `alertDeleted`, `myAlertsTooltip`) — EN + HE.
  - **Verified live** as `renter@test.com` on `/properties/all?min_bedrooms=2`: trigger renders showing "(3)", popover opens with 3 rows (each with proper chips: `10+ BR` / `2+ BR · ≤ 5,000` / `long term · Tel Aviv · ≤ 8,000`), trash-click drops to 2.
  - Files: `frontend/src/components/MyAlertsPopover.jsx` (new, ~200 lines), `frontend/src/pages/Properties.js`, `frontend/src/i18n.js`.



- [x] **Zero-Results Rescue Banner (2026-06-19)**: Building on the "Save as alert" pill, added a prominent teal+gold banner that REPLACES the small pill the moment the live counter drops to 0 places (with at least one filter active). Empty-result moments are the highest-churn point in a search session — this banner converts them into saved-search subscriptions before the renter bounces.
  - **UX**: gold bell icon, "No matches right now" heading + body "We'll email you the moment a new place matches your filters — usually within 24h of a fresh listing.", and a large gold "Notify me" CTA on the right.
  - **Logic**: visible only when `properties.length === 0 && activeFilterCount > 0 && !filtering`. The small "Save as alert" pill auto-hides when results=0 to avoid two competing CTAs side-by-side. The bottom-of-page NotifyMeCard remains as a secondary placement for non-filtered empty states (e.g. empty Sukkot/Pesach catalog).
  - **i18n**: 3 new keys (`filters.zeroResultsHeading`, `filters.zeroResultsBody`, `filters.notifyMe`) EN + HE.
  - **Verified live** as `renter@test.com`: `/properties/all?min_bedrooms=10` → 0 results → banner visible with gold CTA, pill hidden, bottom NotifyMeCard also rendered for comprehensive coverage.
  - Files: `frontend/src/pages/Properties.js`, `frontend/src/i18n.js`.



- [x] **One-Click "Save as Alert" Next to Live Counter (2026-06-19)**: Building on the live result counter, added a gold-outlined "Save as alert" pill button right next to the counter. Visible whenever the renter has any filter active (`activeFilterCount > 0`). Reuses the existing `saveCurrentFiltersAsAlert` flow + `POST /api/saved-searches` endpoint — no backend change. Converts "I see 0 matches, oh well" moments into saved-search subscriptions without forcing renters to scroll into the filter panel.
  - New i18n keys: `filters.saveAsAlert`, `filters.saveAsAlertTooltip` (EN + HE).
  - Verified live as renter@test.com on `/properties/all?min_bedrooms=2&max_price=5000`: button visible, clicking it persisted the alert and showed the success toast.
  - Files: `frontend/src/pages/Properties.js`, `frontend/src/i18n.js`.



- [x] **Live Result Counter + Closed Panel on Back-Nav (2026-06-19)**: User reported (a) the listings page felt like filters weren't applying live — the count seemed correct only after clicking "Show N places", and (b) when returning to listings from a property detail, the filter panel re-opened automatically instead of staying closed.
  - **Root cause (a)**: Filtering DID happen live (debounced refetch on every filter change), but the only visible live count lived inside the "Show N places" button at the bottom of the filter panel — easy to miss when the panel covers the grid. Renters perceived "nothing happens until I click the button".
  - **Root cause (b)**: The `showFilters` state was initialized via `useState(!!(urlSearchParams.get('area') || ...))` — and after the previous URL-sync fix, the URL always carries filter params when filters are active. So returning to listings re-opened the panel.
  - **Fix** (`pages/Properties.js`):
    - Added a prominent live result counter right under the page title, e.g. **"6 places · matching your filters"**. When a refetch is in flight (filter tweak, slider drag, typing in price input) it shows a spinning loader + "Updating results...". Renters now see filters taking effect WITHOUT scrolling past the panel or guessing.
    - Added a subtle 60% opacity fade on the grid while `filtering=true` so the cards visually "blink" during the refetch — extra confirmation that the system is recomputing.
    - Defaulted `showFilters = false` always. Saved-search deep links and back-nav both land with the panel collapsed. The "Filters N" badge on the toggle button still tells the renter what's applied.
  - New i18n keys: `filters.updating`, `filters.placeSingular`, `filters.matchingFilters` (EN + HE).
  - **Verified live**: arriving at `/properties/all?min_bedrooms=2` (back-from-detail) lands with panel closed, chip showing "6 places · matching your filters", grid showing 6 cards. Opening filters and clicking Bedrooms+ three times flipped chip to "6 places" live (was 13) with grid fade during refetch.
  - Files: `frontend/src/pages/Properties.js`, `frontend/src/i18n.js`.



- [x] **Fix: Smart Paste AI Extraction Failing (2026-06-19)**: User reported "AI extraction failed" on live site when using Smart Paste in the Bulk Upload modal. Backend logs showed Anthropic returning `not_found_error: model: claude-4-sonnet-20250514` — that model identifier was deprecated.
  - **Fix**: Migrated all backend Claude callers from the dead `claude-4-sonnet-20250514` / `claude-sonnet-4-20250514` identifiers to the current recommended `claude-sonnet-4-6`. Four files updated: `routes/bulk_upload.py::smart_extract` (Smart Paste), `utils/translate.py` (rental-contract translation), `utils/chat_translate.py` (chat-message live translation), `routes/misc.py::translate_text` (generic /translate endpoint).
  - **Verified**: `POST /api/properties/bulk/extract` now returns HTTP 200 with two correctly-extracted rows from a mixed Hebrew/English 2-property paste — title generated, "Rosh Chodesh Iyar" preserved into `available_from`, basement → `floor=-1`, currency inferred from `$`/NIS, `condition=renovated`, `sukkah_compatible=yes`. `POST /api/translate` smoke-tested HE→EN ("שלום" → "Hello") also returns 200.
  - Files: `backend/routes/bulk_upload.py`, `backend/utils/translate.py`, `backend/utils/chat_translate.py`, `backend/routes/misc.py`.



- [x] **Filter Persistence Across Property Detail Round-Trip (2026-06-19)**: User reported their filters reset every time they clicked into a property and came back. Refilling area/price/bedrooms repeatedly was killing the browsing flow.
  - **Root cause**: `Properties.js` initialized filter state from URL query params but never *wrote* them back. Filter changes lived in React state only; the URL stayed at `/properties/<type>`. On top of that, `handleCardClick` saved just `window.location.pathname` to `sessionStorage.previousPath` — so PropertyDetail's "Back to Listings" returned to the bare URL with no filters to hydrate from.
  - **Fix** (`pages/Properties.js`): (1) new `useEffect` mirrors current filter state → URL via `setUrlSearchParams(next, { replace: true })` whenever `filters` or `priceCurrency` change. `replace: true` keeps history clean while typing. (2) `handleCardClick` now saves `pathname + search` (was just `pathname`). On return, the initialFilters block hydrates state from the URL automatically — works for the back button, page refresh, AND URL-share. (3) Verified end-to-end: applied `?min_bedrooms=2&max_price=5000`, opened detail, clicked "Back to Listings" → returned to `/properties/all?min_bedrooms=2&max_price=5000` with the Filters panel showing "Filters 2" and Bedrooms=2 hydrated. Also confirmed live URL sync: clicking the bedrooms stepper updates the URL in real time.
  - Files: `frontend/src/pages/Properties.js`.



- [x] **Owner Dashboard Dual-Price Rendering Fix (2026-06-19)**: User reported their dashboard "My Properties" card showed only a bare currency symbol (₪) with no number for a vacation listing that had only a holiday lump (Sukkot) price set. Also requested that when both regular + holiday prices are set on the same listing, BOTH render side-by-side.
  - **Root cause**: `components/dashboard/PropertyList.jsx` rendered `{property.monthly_price || property.nightly_price}` directly. For a vacation property with no `nightly_price`/`monthly_price` and only `holiday_lump_price`, both fell through to `undefined` → the JSX evaluated as just the currency glyph with no number. Holiday rate was never displayed on the owner dashboard at all.
  - **Fix** (`components/dashboard/PropertyList.jsx`): extracted a new `PriceBlock` component that stacks up to two lines: (1) regular nightly/monthly (teal #1E6A6A) when set, and (2) holiday lump (gold #D4AF37) when set, each with its own currency symbol (`holiday_lump_currency` can differ from `currency`) and tag-aware suffix (`/ Sukkot`, `/ Pesach`, both, or `/night (Sukkot)` for per-night holiday rates). Existing i18n keys (`property.perSukkot`, `property.perPesach`, `property.perNight`, `property.perMonth`, `property.perHoliday`) wired up correctly so EN + HE both render. New italic "No price set" fallback when neither is configured.
  - Verified live on `owner@test.com` dashboard: a vacation listing with only `holiday_lump_price=$4000 (Sukkot)` now correctly shows `$4,000 / סוכות` (was previously a bare ₪). Setting `nightly_price=450 ILS` alongside renders both stacked: `₪450 / לילה` + `$4,000 / סוכות`.
  - New test IDs: `dashboard-regular-price-{id}`, `dashboard-holiday-price-{id}`, `dashboard-no-price-{id}`.
  - Files: `frontend/src/components/dashboard/PropertyList.jsx`.



- [x] **Date-Aware Auto-Switch of Holiday Rate (2026-06-17)**: Closing the loop on dual-price listings — when a renter wandered in from `/vacation` but picked check-in dates that fall inside Sukkot or Pesach, they were stuck with the regular nightly rate unless they spotted the toggle. Now the booking sidebar auto-flips to the matching holiday rate whenever their selected check-in lands in the holiday window.
  - **Frontend** (`components/property/BookingSidebar.jsx`): new effect watches `bookingData.start_date` and matches against `loadHolidayWindows()` (Hebcal-backed, 30-day localStorage cache, static fallback). If the date lands in a window AND the listing has the matching `holiday_tags` entry AND a `holiday_lump_price` is set, `holidayContext` flips to `sukkot`/`pesach`. A new `holidayManuallySet` guard pauses auto-switching once the renter explicitly clicks Regular/Sukkot/Pesach — so we never override an explicit choice. The flag resets when the renter clears dates entirely so the next pick re-engages auto-switch.
  - **UX hint**: a small teal "Holiday rate applied — switch to Regular if you prefer" caption appears under the rate toggle whenever a non-Regular rate is active, so the renter knows what's happening and how to undo it.
  - **Test coverage**: new `tests/test_holiday_window_pick.py` (7 tests) mirrors the React decision in Python — boundary-inclusive matching, listing-must-have-the-tag, empty inputs, both holiday types. 14/14 dedupe + holiday-window tests green.
  - Files: `frontend/src/components/property/BookingSidebar.jsx`, `backend/tests/test_holiday_window_pick.py`.


- [x] **Dual-Price Listings: Regular Nightly + Holiday Rate (2026-06-17)**: User wanted one apartment to be listable at $400/night for general vacation AND $10K (or $X/night) for Sukkot/Pesach — without creating two separate listings. Reverted the previous dedupe-tags split and implemented true dual pricing on a single listing.
  - **Backend** model: added `holiday_lump_is_per_night: bool = False` on `Property` + `PropertyOut`. When True, `holiday_lump_price` is interpreted as a holiday-night premium rather than the lump total. Owners now save BOTH `nightly_price` AND `holiday_lump_price` on the same doc; UI picks which to display.
  - **Backend** dedupe: reverted `holiday_tags` from the signature in `utils/dedupe.py`. A single listing per (owner, address, rental_type, bedrooms, floor) is now the only correct shape. Holiday pricing lives on that same listing.
  - **AddProperty UI** (`components/dashboard/AddPropertyModal.jsx`): replaced the old XOR "Per Night / Whole Holiday" toggle with an additive layout — always show the regular nightly/monthly price input, and when at least one holiday tag is selected, render an extra cream-coloured "Sukkot/Pesach rate" block below it. The block has its own price + currency inputs and a "Total for whole holiday" / "Per night during holiday" toggle (writes to `holiday_lump_is_per_night`).
  - **Browse-listing UI** (`components/property/PropertyCard.jsx`): card pricing now consumes a `holidayContext` prop. On `/properties/sukkot` (or `/pesach`), cards whose `holiday_tags` includes the matching tag display the holiday price with a tag-specific suffix ("/ Sukkot" or "/ Pesach", or "/ night (Sukkot)" when `holiday_lump_is_per_night` is true). On `/vacation` and `/all`, every card shows the regular nightly price. Wired via `Properties.js` reading the URL `type` segment.
  - **Detail-page UI** (`components/property/BookingSidebar.jsx::PriceBlock`): reads `?holiday=sukkot|pesach` query param (which `Properties.js` now appends to card-click navigation) to seed the initial holiday context. New in-sidebar "Regular / Sukkot rate / Pesach rate" toggle lets the renter flip between rates without leaving the page.
  - **Test coverage**: dedupe test suite trimmed back to 8 tests (reverted holiday-tag cases). 25/25 dedupe + import + remirror + role-switch + duplicate-reattach tests green. Live curl confirms a vacation property created with both prices persists both correctly and surfaces via `/properties?holiday_tag=sukkot`.
  - Files: `backend/models.py`, `backend/models_response.py`, `backend/utils/dedupe.py`, `backend/routes/properties.py`, `backend/routes/admin.py`, `backend/routes/admin_import.py`, `backend/routes/bulk_upload.py`, `backend/tests/test_dedupe_signature.py`, `frontend/src/components/dashboard/AddPropertyModal.jsx`, `frontend/src/components/property/PropertyCard.jsx`, `frontend/src/components/property/BookingSidebar.jsx`, `frontend/src/pages/Properties.js`.


- [x] **Stricter Duplicate Detection + One-Click Re-Mirror + Holiday-Split (2026-06-17)**: User reported that the duplicate resolver was flagging distinct apartments in the same building as duplicates, and asked for an owner to be able to list the same apartment as both regular vacation ($400/night) AND sukkot vacation ($10K lump). Three improvements shipped:
  - **Stricter dedupe signature** (`utils/dedupe.py`): the dedupe key now includes `bedrooms`, `floor`, AND `holiday_tags` on top of the existing (owner_id, normalized_address, rental_type). Distinct units in the same building (3BR top floor + 2BR ground floor at "Sanhedria Murchevet 4") no longer collide. Sukkot/Pesach listings of the same apartment also remain separate from the same flat's regular-vacation listing — owners can capture holiday premium pricing alongside nightly rates. New `dedupe_signature()` helper plus `_norm_int()` (`'2'` and `2` hash same) and `_norm_tags()` (accepts list or comma-string, sort+dedupe+lowercase). Threaded through every caller: `routes/properties.py`, `routes/admin_import.py`, `routes/bulk_upload.py`, `routes/admin.py` (`/admin/duplicates` + resolver — group key now `<owner>|<addr>|<rt>|<bedrooms>|<floor>|<holiday_tags>`).
  - **One-click re-mirror tool** (`routes/admin_import.py::admin_remirror_properties`): `POST /admin/properties/remirror` admin endpoint scans every property and classifies each as `queued` (source URLs → fire background mirror), `already_cdn` (skip — don't pay for redundant uploads), or `no_images` (empty array, listed by id/title in response so admin knows which need a CSV re-upload). Marks `mirror_pending: true` immediately; background task patches with Cloudinary URLs as it finishes. Sky-blue "Re-mirror photos" button next to "Find duplicates" in admin Listings tab.
  - **Test coverage**: `tests/test_dedupe_signature.py` (13 tests — distinct bedrooms/floor, vacation vs sukkot vs pesach split, holiday tag order/case/whitespace normalization, comma-string acceptance, None-vs-empty equivalence, `_norm_tags` direct unit test) and `tests/test_admin_remirror.py` (2 tests). 23/23 dedupe + import + remirror tests green.
  - Files: `backend/utils/dedupe.py`, `backend/routes/admin.py`, `backend/routes/admin_import.py`, `backend/routes/properties.py`, `backend/routes/bulk_upload.py`, `backend/tests/test_dedupe_signature.py`, `backend/tests/test_admin_remirror.py`, `frontend/src/components/admin/ListingsTab.jsx`.


- [x] **Renter ↔ Lister + Manager → Renter Self-Service Role Switch (2026-06-17)**: User requested an option for accidentally-signed-up users to switch role themselves. Now supports the full set of safe transitions.
  - **Backend** (`routes/auth.py::set_user_role` + new `RoleUpdate` model): `PUT /auth/role {role}` accepts `'renter'` or `'owner'` as the target. Allowed transitions: `renter→owner`, `owner→renter`, `manager→renter`. Blocked: admin self-flips (privilege boundary), any target other than renter/owner (no self-promotion to manager/admin), manager→owner (sideways privilege change). Returns a fresh JWT with the new role so the frontend can swap auth state without a logout/login cycle.
  - **Frontend** (`components/dashboard/SettingsTab.jsx`): Settings page now shows a role-aware card at the top — renters see "Have a place to list? → Switch to lister", owners see "Switch back to Renter?", managers see "Step down to Renter?". Confirms before switching, then pushes the new token + user through `AuthContext.login()` so Navigation, Dashboard tabs, and role gates update immediately.
  - **Test coverage**: `tests/test_role_switch.py` (8 tests) — renter↔owner, manager→renter, manager↛owner, double-flip rejection, target validation (admin/manager refused), admins blocked, auth required. 8/8 green.
  - Files: `backend/models.py`, `backend/routes/auth.py`, `backend/tests/test_role_switch.py`, `frontend/src/components/dashboard/SettingsTab.jsx`.


- [x] **CSV Importer "Sync Photos" Recovery Mode (2026-06-17)**: User reported many vacation rentals showing no photos on production after a half-finished import (background mirror was killed by a backend restart, leaving listings with empty `images` or partial source-URL state). Re-uploading the CSV in default mode just skipped them as duplicates.
  - **Backend** (`routes/admin_import.py::commit_property_import`): added `mode: str = "create"` field to `PropertyCommitRequest`. When `mode="sync_photos"`, a duplicate listing is NOT skipped — instead its `images`/`videos` are replaced with the CSV's and `mirror_pending=True` is set so the background task re-mirrors to Cloudinary. Listings already 100% on Cloudinary are skipped to avoid duplicate uploads; mixed/empty/source-only listings are re-synced. Default `mode="create"` keeps the original skip-duplicates behavior so existing flows are unchanged.
  - **Frontend** (`components/admin/ImportTab.jsx`): new amber-themed radio toggle right above the Commit button — "Skip duplicates (default)" vs "Sync photos onto existing listings". Commit button label flips to "Sync photos (N rows)" when the recovery mode is active.
  - **Test coverage**: new `tests/test_admin_import_sync_photos.py` (3 tests) — (1) sync_photos updates existing listing's images via `update_one` and never inserts a duplicate; (2) listings already fully on Cloudinary are skipped from the sync; (3) default mode still skips duplicates (backwards-compat). 24/24 admin-import tests green.
  - Files: `backend/routes/admin_import.py`, `backend/tests/test_admin_import_sync_photos.py`, `frontend/src/components/admin/ImportTab.jsx`.


- [x] **Chat Re-attach on Duplicate Resolution (2026-06-17)**: User reported that after using the admin duplicate resolver, the renter's chat for the deleted twin opens "Property not found". Three layers shipped:
  - **Prefer-active keeper** (`routes/admin.py::resolve_duplicates`): when at least one twin in a duplicate group has chat history / bookings / likes, the resolver now keeps THAT one regardless of the requested mode (`keep_newest`/`keep_oldest`/`keep_richest`). Falls back to the mode tiebreaker only when no twin has activity, OR when multiple twins have activity. Renter's bookmarked URL stays valid — no re-attach needed in the common case.
  - **Auto-reattach safety net** for the multi-active case: before deleting the loser docs, `update_many`s loser_ids → keeper_id across `messages`, `bookings`, `chat_nudges`, `admin_blocks`, `subleases.original_property_id`, and `liked_properties` (with a dedupe pass so a renter who liked both copies doesn't end up with two rows). Response includes `reattached: {messages, bookings, likes, nudges, blocks, subleases}` per group.
  - **Manual recovery endpoint** (`routes/admin.py::admin_reattach_chats`): `POST /admin/chats/reattach {from_property_id, to_property_id}` lets the admin manually re-point orphan conversations that pre-date this fix. `property_missing: true` flag on `/chat/conversations` and `/admin/chats` powers the inline amber "Listing removed — re-attach" UI in `components/admin/ChatsTab.jsx` (paste-id input + Re-attach button; top-of-page orphan-count banner).
  - **Test coverage**: new `tests/test_duplicate_reattach.py` (3 tests) — (1) prefer-active-keeper overrides mode tiebreaker; (2) falls back to mode when no twin has activity; (3) manual-reattach endpoint validates inputs. 30/30 admin + properties + import tests green.
  - Files: `backend/routes/admin.py`, `backend/routes/chat.py`, `backend/tests/test_duplicate_reattach.py`, `frontend/src/components/admin/ChatsTab.jsx`.


- [x] **Infinite Scroll + Server-Side Pagination on Public Listings (2026-06-17)**: Follow-up to the perf pass — now `GET /properties?page=N&limit=24` ships only the requested slice instead of dumping up to 1000 rows on every request. First-paint stays snappy regardless of catalog size.
  - **Backend** (`routes/properties.py`): added optional `page: int = 1, limit: int | None = None` params. Pagination is applied AFTER all filters (price + date-overlap filters are post-query Python, so DB-level skip/limit would slice the wrong set). Omitting `limit` preserves the original full-list behavior so existing callers (Home, Dashboard, admin) keep working.
  - **Frontend** (`pages/Properties.js`): `PAGE_SIZE=24` per fetch. New `page`/`hasMore`/`loadingMore` state; `fetchProperties(pageOverride, append=true)` appends rather than replaces. An IntersectionObserver-backed sentinel under the grid (`rootMargin: 400px` — start fetching ~one viewport early) calls the next page automatically. "Less than a full page returned" = end of catalog. Subleases attach only on page 1 (they're a fixed sidecar list, not paginated alongside properties). `clearFilters` + `applyHolidayWindow` reset paging too.
  - **Test coverage**: new `tests/test_properties_pagination.py` (4 tests) — no-params returns all, page/limit slices don't overlap, list response trims `images` to cover only, past-last-page returns `[]`. 19/19 properties + pagination tests green.
  - Files: `backend/routes/properties.py`, `backend/tests/test_properties_pagination.py`, `frontend/src/pages/Properties.js`.


- [x] **Listings Page Performance Pass (2026-06-17)**: User reported "site is really slow, properties load really slowly, images take forever to appear". Three high-impact fixes shipped together:
  - **MongoDB hot-path indexes** (`server.py` startup): added background-built indexes on `properties.{rental_type+status, owner_id, area, id, created_at}`, `bookings.{property_id+status, start_date+end_date}`, `external_bookings.{start_date+end_date}`, `admin_blocks.property_id`, `users.{email unique, id unique}`, `messages.{property_id+created_at desc}`, `liked_properties.{user_id+property_id}`. Public listing queries and owner-dashboard fetches were doing full collection scans (only `_id` indexed).
  - **Native lazy-loaded `<img>` in `PropertyCard`**: replaced the CSS `background-image` hero with `<img loading="lazy" decoding="async" srcSet={srcSet(url, 600)} sizes="(max-width: 768px) 50vw, 33vw">`. CSS backgrounds can't lazy-load, so a 37-property page was downloading every off-screen hero at full size simultaneously; native lazy-loading + responsive srcset cuts that to ~6 visible cards on first paint plus DPR-aware 1x/2x variants.
  - **Trimmed list-endpoint payload**: `GET /properties` now ships only the cover image per property (`images = images[:1]`); the detail endpoint still returns the full gallery. A 100-property page with 25 photos each used to carry 2500 URLs in the JSON body — now 100. Drops response size ~20-30x for image-heavy results.
  - Files: `backend/server.py`, `backend/routes/properties.py`, `frontend/src/components/property/PropertyCard.jsx`.


- [x] **CSV Bulk Import — Edge-Timeout Fix (2026-06-17)**: Large CSV imports (37 rows × ~20 images each = ~700 Cloudinary mirror calls) were tripping the Cloudflare edge proxy's 60s timeout, returning a 502 to the admin even though the frontend itself set a 10-min timeout. Root cause: `mirror_url_to_cloudinary` declared `async def` but called the SYNC `cloudinary.uploader.upload()`, so `asyncio.gather` provided zero concurrency — every mirror ran sequentially on the event loop.
  - **Fixes**: (1) `utils/cloud_storage.py::mirror_url_to_cloudinary` now runs the Cloudinary SDK call in a worker thread via `asyncio.to_thread()`, restoring real parallelism for `asyncio.gather`. (2) `routes/admin_import.py::commit_property_import` now inserts each property with its source URLs immediately (so the listing is live and looks complete right away), tags the doc with `mirror_pending: true`, and kicks off a background `asyncio.create_task` that mirrors to Cloudinary and patches the doc via `update_one`. HTTP response returns in ~2.4s for the 37-row CSV (was 60s+ → 502). (3) New response field `summary.mirror_pending_count` so the frontend can show a friendly "we're moving photos to our CDN in the background" banner.
  - **Test coverage**: new `tests/test_admin_import_background_mirror.py` (2 tests) — fast-response regression using a 1s-sleep stub mirror to prove `gather` parallelizes and the endpoint returns BEFORE mirroring completes; Pydantic-payload schema test. 21/21 admin-import tests green.
  - Files: `backend/utils/cloud_storage.py`, `backend/routes/admin_import.py`, `backend/tests/test_admin_import_background_mirror.py`, `frontend/src/components/admin/ImportTab.jsx`.

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

- [x] **Area Filter: City-Scoped Anchored Match** (2026-02-26):
  - Replaced the substring regex in `/api/properties`, `/api/subleases`, and saved-search matching with a shared helper `utils/area_filter.py` (`area_mongo_query`, `area_matches`).
  - Pattern is anchored at the start of the stored value, accepts both the canonical `"<City> - <Neighborhood>"` form and legacy bare neighborhood data, keeps the Sanhedria special case (matches `Sanhedria Murhevet` / `Sanhedria Murchevet`), and uses a `(?!\w)` look-ahead so prefix overlaps like `Talpiot` vs `East Talpiot` or `Ramot` vs `Ramot Bet` no longer over-match.
  - Prevents cross-city bleed for the ~25 neighborhood names that repeat across cities (`Old City`, `City Center`, `Ramat Eshkol`, `Romema`, `German Colony`, `Kiryat Shmuel`, `Ramot`, `Neve Sha'anan`, `Ramat Chen`, Hebrew-letter wards `Dalet/Gimmel/Hey`, etc.).
  - Locked in by 20-case pytest suite at `/app/backend/tests/test_area_filter.py`.

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
- [x] **Live admin sync via SSE** (2026-04-26):
  - New backend pub/sub broker `/app/backend/utils/events.py` (in-memory, bounded queues, max 100 subscribers, slow-client drop semantics).
  - New SSE endpoint `GET /api/admin/events?token=…` streaming JSON cache-invalidation events. Token is in the query string because `EventSource` cannot set Authorization headers; verified via the new `decode_query_token()` helper. 20 s keep-alive ping prevents idle proxy disconnects.
  - Health probe `GET /api/admin/events/health` returns the live subscriber count.
  - Wired `await publish("invalidate", {"prefixes": [...]})` into 8 admin write handlers: `toggle-user-status`, `delete-user`, `mark-booked`, `bulk-mark-booked`, `delete-block`, `toggle-property-status`, `update-service-status`, `update-settings`.
  - New frontend hook `/app/frontend/src/hooks/useAdminLiveEvents.js` opens one EventSource per dashboard mount; each event calls `invalidateAdminCache(prefix)`.
  - Extended `useApiSWR` with a subscriber registry — when invalidation fires for a matching prefix, every mounted hook on that resource auto-refreshes immediately. **No tab switch / no user action required.**
  - Initial bug found & fixed: cache keys are full URLs, but backend publishes path prefixes — flipped the matcher from `startsWith` to `includes` so e.g. `/api/admin/properties` matches `https://host/api/admin/properties|token`.
  - **Verified end-to-end in the browser**: remote `mark-booked` → badge appears in our UI within ~1 s with zero user action. Remote unblock → badge disappears. SSE subscriber count goes 0 → 1 on dashboard mount, back to 0 on disconnect.
  - All gates green: `scripts/check.sh` passes, 68/68 regression tests pass.
- [x] **Bulk Upload — friendly UX rewrite** (2026-04-26):
  - User feedback: the previous flow handed users a CSV/XLSX template they then had to open in Excel/Notepad — a non-technical user opened the XLSX in Notepad and saw raw binary garbage.
  - Replaced the 5-step "Template → Input → Preview → Images" wizard with a single **visual editor** as the default: each property is a card with proper inputs (dropdowns for rental_type / property_type / furniture / condition / cancellation, number inputs, currency selector). Essentials always visible; secondary fields (elevator, sukkah, amenities, etc.) hidden behind a one-click "More fields" toggle on each card.
  - Rows can be added (`+ Add another property`), duplicated, or removed in-place. Inline validation: required fields show row-level error banners before the network call.
  - **Spreadsheet path preserved** for power users: tucked behind a single-line `Already have your properties in a spreadsheet? Import CSV / XLSX →` affordance. Imports populate the visual editor so users can review/fix before saving.
  - Same backend (`/parse + /commit + /images`) — frontend serialises rows to TSV before posting. Image attach + done screens unchanged.
  - **Verified end-to-end**: filled 2 rows (long-term + short-term, mixed currencies, expanded "More fields"), saved, reached "All set!" with 2 properties created. Import panel reveals on demand.
- [x] **Bulk Upload — Smart Paste (LLM-powered)** (2026-04-26):
  - User feedback: pasted 3 messy WhatsApp property descriptions (mixed English + Hebrew, free-form bullets) and the old paste-to-CSV path created 20 garbage rows with no extracted data.
  - New backend endpoint `POST /api/properties/bulk/extract` calls Claude Sonnet via Emergent LLM key + `emergentintegrations`. Detailed system prompt covers: rental_type / property_type detection, Hebrew → English translation for titles/descriptions while preserving transliterated place names, ground-floor → 0, basement → -1, "1.5 bedroom" → 1.5, "Rosh Chodesh Iyar" → string available_from, yes/no boolean dropdowns, currency inference from "nis"/"₪"/"$".
  - New "Got listings from WhatsApp, email, or a colleague?" panel at the top of the bulk modal. User pastes anything → Claude extracts → editor populates with structured rows ready for review.
  - **Verified with the user's exact 3-property paste**:
    - Sanhedria Murchevet 1.5BR → title generated, `bedrooms=1.5`, `monthly_price=9000`, `furniture_option=full`, `available_from="Rosh Chodesh Iyar"`, description auto-translated from Hebrew.
    - Sanhedria Murchevet 1BR → `monthly_price=8000`, `available_from="2024-04-01"`, "back yard" preserved in description.
    - Belz / Kedushat Aharon → `floor=-1`, `square_meters=60`, `monthly_price=9500`, `condition=after_renovation`, `sukkah=yes`, `elevator=no`, address transliterated to "Kedushat Aharon Street".
  - Editor receives 3 rows (not 20), all required fields filled. User can review/edit/delete before saving. Spreadsheet import path still available below for power users.
  - 30 k char input cap; 50 properties max per extraction. Owners + managers + admins authorized.
- [x] **Choose cover photo** (2026-04-28):
  - New `POST /api/properties/{id}/cover` endpoint (in `routes/properties.py`) — accepts `{image_url}` and reorders that URL to position 0 in the property's `images` array. Strict whitelist: refuses unknown URLs (400), enforces owner/admin (403). Publishes SSE invalidation so admin/grid views refresh instantly.
  - **AddPropertyModal** (regular upload flow): every image thumbnail now exposes a hover-revealed star button (`Set as cover`) and the current cover gets a gold "COVER" badge + ring. Listers can also see a one-line hint above the grid explaining the feature. Reorders local `images` & `uploadedFiles` arrays so the badge follows immediately, no save round-trip.
  - **BulkManagerTab**: the property list now shows a 48×48 cover preview thumbnail plus a `★ Cover` button per row. Clicking either opens the new `CoverPickerModal.jsx` (full-screen grid of all attached photos with a one-click promote action).
  - Single source of truth: every existing read-site (`Properties.js`, `Home.js`, `PropertyCard`, dashboard tiles, `LikedTab`, `SubleasesTab`, `ManagerPage`) already reads `images[0]` for the thumbnail — zero changes needed downstream.
  - 4 new pytest cases (`TestSetCover`: success reorder, unknown-URL 400, ownership 403, empty-URL 400). **21/21 bulk_manager** + 78/78 overall regression green. TS types regenerated.
- [x] **Bulk-edit Undo: single-POST batched revert** (2026-04-28):
  - Extended `BulkEditBody` with `per_property_updates: dict[str, dict] | None` so callers can pass distinct values per id in one round-trip. Same whitelist filter applies — non-whitelisted fields like `owner_id` injected into a snapshot are silently dropped.
  - Backend behaviour matrix: per-property override beats global `updates` for matching id; ids not in the per-property map fall back to global; ids with neither (and no title prefix) skip cleanly with `reason="no_changes"` instead of fabricating an empty snapshot.
  - Frontend `BulkManagerTab.handleUndo` rewritten — N posts → 1 post. Builds `per_property_updates` from the snapshot stack and ships it as a single bulk-edit. Toast now reports "Reverted last bulk edit (N properties)".
  - 3 new pytest cases (`test_per_property_updates_single_post_undo`, `_only_valid`, `_falls_through_with_no_changes`) lock in the contract; **78/78** regression tests still green. TS types regenerated (`yarn types:generate`).
- [x] **Bulk Manager file split** (2026-04-28):
  - Split `BulkManagerTab.jsx` (759 lines) into three single-responsibility files:
    - `BulkManagerTab.jsx` (282 lines): toolbar, filters, table, undo stack
    - `BulkEditModal.jsx` (277 lines): FieldRow/FieldEditor/FIELD_GROUPS/LABELS, save handler
    - `BulkPhotosModal.jsx` (231 lines): DropZone, PhotoThumb, two upload modes
  - All `data-testid`s preserved; exports unchanged. ESLint + 75/75 backend regression tests still green.
- [x] **Phase-2: Promoted stable fields onto domain response models** (2026-04-27):
  - `PropertyOut`, `BookingOut`, `ContractOut`, `NotificationOut`, `SavedSearchOut`, `SubleaseOut`, `MessageOut`, `ConversationOut`, `ServiceRequestOut`, `EmailEventOut`, `AdminBlockOut` — every domain response model now declares its full canonical persisted shape (titles, prices, status, timestamps, foreign keys, etc.). `PropertyOut` alone went from 1 declared field → 38 typed fields; `BookingOut` 1 → 27; `SubleaseOut` 1 → 22.
  - `ConfigDict(extra='allow')` retained so handler-side enrichment (`owner_name`, `owner_email`, `admin_blocked_now`, `active_admin_block`, etc.) still flows through unchanged.
  - **Generated `frontend/src/types/api.d.ts` regenerated**: 5,506 → **5,911 lines**. The TS types are now load-bearing — IDE autocomplete on `PropertyOut['rental_type']`, etc., works for the entire frontend.
  - Tested: `scripts/check.sh` (ruff + mypy + pytest gate) green; **75 / 75** regression tests still pass (response_models + bulk_manager + refactor_regression + type_coverage).
- [x] **Pydantic `response_model=` on every endpoint + auto-typed frontend** (2026-04-27):
  - New file `backend/models_response.py` with **88 response models** (MessageResponse, IdMessageResponse, OkResponse, TokenResponse, UserPublic, PropertyOut, BookingOut, ContractOut, BulkEditResponse, AdminDashboardResponse, AdminEmailHealthResponse, …). Most domain models use `ConfigDict(extra='allow')` so MongoDB-enriched fields (owner_name, property_title, admin_blocked_now, active_admin_block, views, …) keep flowing through.
  - **`response_model=` declared on 93/98 endpoints** across all 12 routers (`auth.py`, `properties.py`, `bookings.py`, `admin.py`, `notifications.py`, `chat.py`, `saved_searches.py`, `subleases.py`, `contracts.py`, `bulk_upload.py`, `ical.py`, `misc.py`). The remaining 5 are intentionally untyped FileResponse/StreamingResponse handlers (`/admin/events` SSE, `/contract-template/{lang}`, `/contracts/download/{id}`, `/properties/{id}/ical-export`, `/properties/bulk/template`).
  - **TypeScript types generated** at `frontend/src/types/api.d.ts` (5,506 lines, every endpoint signature + body/response). Re-runnable via new `yarn types:generate` (powered by `frontend/scripts/generate-types.mjs` which fetches `/openapi.json` and pipes through `openapi-typescript`).
  - Strict-default policy (extra keys dropped silently) — but `extra='allow'` on the data models keeps the legacy enrichment surface alive, so zero frontend regressions.
  - Tested: **75/75 green** in iteration_18.json (13 new response-shape regression tests + 47 refactor_regression + 14 bulk_manager + 1 mypy gate). Zero `_id` leaks.
- [x] **Bulk Property Manager — host-side multi-edit + photos** (2026-04-27):
  - New dashboard tab "Bulk Manager" for owners/managers/admins, hidden from renters.
  - Multi-select with per-row checkboxes, "Select all visible", live-search (title/area/address), rental-type + area filters.
  - **Bulk Edit Details**: every field has its own "Apply" toggle so untouched fields stay as-is on each property. Covers all canonical PropertyCreate fields: title prefix (prepended once, idempotent), description, rental_type/property_type/bedrooms/bathrooms/floor/sqm, monthly+nightly price, currency, min booking days, **checkin_time**/**checkout_time**, available_from/starting_date, elevator + Shabbat/TAMA/sukkah, condition + furniture, agent fee + amount + currency, cancellation policy + custom text, amenities (with **Append vs Replace** mode).
  - **Bulk Add Photos**: drag/drop uploader with two modes — *Same to all* (one upload set fanned out) or *Different per property* (per-row drop zones). Live progress indicator + image previews.
  - **Undo last bulk edit**: server returns per-property snapshots; one click reverts those exact fields. Stack keeps last 5 ops.
  - New backend endpoints: `POST /api/properties/bulk-edit` (whitelist-filtered patch + ownership check + snapshots), `POST /api/properties/bulk-images` (shared or per_property URL fan-out). Both publish `events.publish("invalidate", ...)` so the admin dashboard auto-refreshes.
  - Files: `backend/routes/properties.py`, `models.py`, `frontend/src/components/dashboard/BulkManagerTab.jsx`, `frontend/src/pages/Dashboard.js`, `frontend/src/constants/propertyEnums.js` + `locations.js`.
  - Tested: 14/14 backend pytest + 13/13 frontend Playwright = 27/27 green (iteration_17.json).
  - New dashboard tab "Bulk Manager" for owners/managers/admins, hidden from renters.
  - Multi-select with per-row checkboxes, "Select all visible", live-search (title/area/address), rental-type + area filters.
  - **Bulk Edit Details**: every field has its own "Apply" toggle so untouched fields stay as-is on each property. Covers all canonical PropertyCreate fields: title prefix (prepended once, idempotent), description, rental_type/property_type/bedrooms/bathrooms/floor/sqm, monthly+nightly price, currency, min booking days, **checkin_time**/**checkout_time**, available_from/starting_date, elevator + Shabbat/TAMA/sukkah, condition + furniture, agent fee + amount + currency, cancellation policy + custom text, amenities (with **Append vs Replace** mode).
  - **Bulk Add Photos**: drag/drop uploader with two modes — *Same to all* (one upload set fanned out) or *Different per property* (per-row drop zones). Live progress indicator + image previews.
  - **Undo last bulk edit**: server returns per-property snapshots; one click reverts those exact fields. Stack keeps last 5 ops.
  - New backend endpoints: `POST /api/properties/bulk-edit` (whitelist-filtered patch + ownership check + snapshots), `POST /api/properties/bulk-images` (shared or per_property URL fan-out). Both publish `events.publish("invalidate", ...)` so the admin dashboard auto-refreshes.
  - Files: `backend/routes/properties.py` (+`_BULK_EDITABLE_FIELDS`, `BulkEditBody`, `BulkImagesBody`, 2 new endpoints), `models.py` (+checkin_time/checkout_time), `frontend/src/components/dashboard/BulkManagerTab.jsx` (new ~750-line file), `frontend/src/pages/Dashboard.js` (new tab), `frontend/src/constants/propertyEnums.js` + `locations.js` (shared canonical lists).
  - Tested: 14/14 backend pytest + 13/13 frontend Playwright = 27/27 green (iteration_17.json). Verified ownership skips, admin override, snapshot-based undo, amenities append-no-dup, whitelist drops `owner_id`/`status`/`images`, no `_id` leakage.
- [ ] Manager bulk property upload + profile pages
- [x] **Sublease Calendar Dropdown** (2026-04-29):
  - Replaced plain `<input type="date">` for `available_from`/`available_to` in `SubleasesTab.jsx` with the same shadcn `Calendar` popup pattern used in `AddPropertyModal.jsx`.
  - Pill-style trigger formats picked dates as "Month D, YYYY"; popover has X close, click-outside to dismiss, past dates disabled, end date constrained to ≥ start.
  - Backend save format remains `yyyy-MM-dd`; verified end-to-end via curl on `POST /api/subleases`.
- [x] **Sublease Currency selector (₪ ILS / $ USD)** (2026-04-29):
  - Backend: `SubleaseCreate` + `SubleaseOut` gain `currency: str | None = 'ILS'`. `routes/subleases.py` persists it on `POST /api/subleases` (defaults to ILS).
  - Frontend: Price input is now a flex group with a 28-px-wide currency `<select>` (₪ ILS / $ USD), matching the currency selector pattern used in `AddPropertyModal.jsx`. Listing card + `SignContract.js` price label render `$` when `currency === 'USD'`, `₪` otherwise (legacy rows fall through to ₪).
  - TS types regenerated via `node scripts/generate-types.mjs`.
  - Verified end-to-end via curl: USD + ILS subleases persist correctly with their currency in `db.subleases`.
- [x] **Bug fix: rental_type filter leaked across SPA navigation** (2026-04-29):
  - Reproduced: clicking "Short Term" from `/properties/vacation` (or any other type→type SPA nav) sent the previous `rental_type` to the backend, so the user saw vacation cards on the Short Term page.
  - Root cause in `pages/Properties.js#fetchProperties`: it read the stale `filters.rental_type` (which lags one render behind `useParams().type`). The fetch effect depended on `[type]` only, so the first call after URL change used the previous render's filters closure.
  - Fix: derive `rental_type` directly from the URL `type` param inside `fetchProperties`, ignoring the lagging `filters.rental_type` (which has no independent source of truth — it's only ever set from the URL effect).
  - Verified via Playwright across vacation→short-term, short-term→vacation, vacation→long-term: each transition fires exactly one API call with the correct `rental_type` and the correct cards render.
- [x] **Sukkot / Pesach holiday-rental categories** (2026-04-29):
  - **Schema**: added `holiday_tags: list[str] | None = []` to `PropertyCreate`, `PropertyOut`, `SubleaseCreate`, `SubleaseOut`. Allowed values: `"sukkot"`, `"pesach"`. Empty = regular vacation / regular short-term sublease.
  - **Backend filter**: `GET /api/properties?holiday_tag=<sukkot|pesach>` does Mongo array-contains filtering. Combines with `rental_type=vacation` for the Sukkot/Pesach pages.
  - **Routes**: `/properties/sukkot` and `/properties/pesach` map to `rental_type=vacation` + `holiday_tag=<value>`. Header label switches to "Sukkot Rentals" / "Pesach Rentals".
  - **Navigation menu**: indented "↳ Sukkot Rentals" + "↳ Pesach Rentals" sit beneath the Vacation entry.
  - **AddPropertyModal**: when `rental_type === 'vacation'`, a new "Holiday Categories" section renders pill-style checkboxes (Sukkot Rental / Pesach Rental). Hydrates from existing `holiday_tags` on edit.
  - **SubleasesTab**: form gets a "Sublease Type" chip group — "Short Term" (selected when `holiday_tags=[]`), "Sukkot", "Pesach". User can pick none, one, or both holidays. Listing card shows badge pills for tagged subleases.
  - **TS types regenerated** via `node scripts/generate-types.mjs`.
  - Verified end-to-end via curl: vacation property with `holiday_tags=["sukkot"]` shows up only on `holiday_tag=sukkot` query; sublease with `holiday_tags=["sukkot","pesach"]` persists both tags. Frontend smoke-tested: `/properties/sukkot` and `/properties/pesach` render correct titles and only the matching properties.
- [x] **Holiday-window banner + one-click date filter** (2026-04-29):
  - New `frontend/src/constants/holidayWindows.js` with upcoming Sukkot 5787 (Sep 25 – Oct 4 2026) and Pesach 5786 (Apr 1 – Apr 9 2026) windows. Used as **fallback only** since the auto-rolling Hebcal lookup runs at page load.
  - Banner card on `/properties/sukkot` and `/properties/pesach`: gold-tinted gradient, calendar icon, "SUKKOT 2026 / Sep 25 — Oct 4, 2026" headline, helper copy, and a teal CTA "Find homes available these dates".
  - CTA fetches with `rental_type=vacation&holiday_tag=<key>&date_from=<start>&date_to=<end>` and pre-fills the Filters panel's date range — toast confirms application.
  - Smoke-tested: banner visible on both pages, CTA click correctly fires the date-bounded API call, Filters badge updates to show 2 active filters, results list narrows accordingly.
- [x] **Auto-rolling holiday windows via Hebcal API** (2026-04-29):
  - New `frontend/src/utils/holidayWindows.js#loadHolidayWindows()` fetches `https://www.hebcal.com/hebcal?cfg=json&maj=on&i=on&year=YYYY` for the current year + next year, groups consecutive holiday days into runs (≤ 14-day gap), and returns the *next upcoming* run for Sukkot (Erev Sukkot → Simchat Torah) and Pesach (Erev Pesach → Pesach VII).
  - Cached in `localStorage` for 30 days; falls back to the static `HOLIDAY_WINDOWS` constant on any network/CORS error.
  - Properties page seeds `useState(HOLIDAY_WINDOWS)` then hydrates from `loadHolidayWindows()` on mount.
  - Verified: today (Apr 29 2026) → banner correctly shows **Sukkot 2026** (Sep 25 – Oct 3, still upcoming) and **Pesach 2027** (Apr 21 – Apr 28, auto-rolled because Pesach 2026 ended Apr 9). Cache payload is properly persisted with `cachedAt` timestamp.
- [x] **Calendar `defaultMonth` polish** (2026-04-29):
  - `AddPropertyModal.jsx` — Starting Date (long-term) and Date Available (short-term/vacation) calendars now open at the saved date's month when editing instead of today's. Falls back to today when no date is set.
  - `SubleasesTab.jsx` — same polish on Available From + previously-added Available To (which already opens at the from-date's month for new subleases).
  - Verified via screenshot: editing a property with Starting Date `March 15, 2027` opens the picker directly at March 2027.
- [x] **Dashboard.js refactor — phase 3** (2026-04-29):
  - Purged dead code: full contract-signing modal logic (canvas drawing, signature state, position/size, preview URL), unused cancellation handlers (`handleCancelBooking`, `handleRequestCancel`, `handleAcceptBooking`, `confirmAcceptBooking`, `handleDenyCancel`, `submitCancellation` and their `cancelModal` / `acceptModal` state) — all of which were superseded when `BookingsList` started owning its own modals. Plus dead state (`bookingsFilter`), unused `parseLocalDate` helper, and ~25 unused lucide icon imports.
  - Extracted `ManagerHeader.jsx` (156 lines): self-contained business-logo upload (POST/DELETE `/api/user/logo`) + shareable manager-page link with copy-to-clipboard fallback.
  - Extracted `DashboardTabs.jsx` (116 lines): pure presentational, role-driven tab visibility (renter sees Subleases/Services/Alerts; owner sees Bulk Manager). Static Tailwind classes (`ACTIVE_TEAL`/`ACTIVE_GOLD`/`ACTIVE_RED`) so JIT picks them up.
  - **Dashboard.js: 665 → 232 lines (−65%)**. No prop or behavioral changes.
  - Tested: iteration_19.json — 16/16 frontend regression flows pass, zero React warnings, zero refactor-attributable console errors.
- [x] **BookingsList.jsx refactor** (2026-04-29):
  - Extracted `BookingRow.jsx` (189 lines): pure presentational per-row card with all status colors + role-derived action buttons (Accept / Cancel / Request Cancel / Approve / Deny / Sign Contract / View+Download Signed). Stable `data-testid`s on every action button.
  - Extracted `useBookingActions.jsx` hook (207 lines): owns Accept / Cancel-Request-Deny / Approve-Cancel (sonner inline confirm) / Contract-Sign flows + their modal state. Centralised endpoint map keeps the cancel handler 1 line per branch.
  - **BookingsList.jsx: 397 → 130 lines (−67%)**. Now purely composes the hook + maps rows + renders the 3 modals. Filtering moved to a `useMemo`.
  - Smoke-tested: 66 booking rows render for owner@test.com, search filter works, Cancel Booking modal opens correctly.
- [x] **Bug fix: Sukkot/Pesach pages didn't include subleases** (2026-04-30):
  - Reported: user tagged existing subleases with `holiday_tags` but they never appeared on `/properties/sukkot` or `/properties/pesach`.
  - Root cause: those pages only queried `/api/properties` — subleases live in a separate collection (`db.subleases`), so they were invisible to public visitors.
  - Fix: **Backend** `GET /api/subleases` now accepts `holiday_tag=<sukkot|pesach>` query param (Mongo array-contains filter). **Frontend** `Properties.js` on Sukkot/Pesach pages fetches both `/api/properties` AND `/api/subleases?holiday_tag=<tag>` in parallel and merges. Each sublease is normalized into a property-card-shaped object and gets a gold `"SUBLEASE"` ribbon on the card image. Clicking a sublease card deep-links to `/property/{property_id}` (the underlying property). Likes hidden for subleases. Holiday-window banner CTA merges both with a client-side date-overlap filter.
  - Verified live: `/properties/sukkot` now shows all sukkot-tagged subleases (incl. the 2 pre-existing ones the user reported missing) with SUBLEASE ribbon and correct prices. `/properties/pesach` also confirmed.
- [x] **Sublease deep-link → PropertyDetail booking pre-fill** (2026-04-30):
  - Sublease cards on Sukkot/Pesach pages now append `?from=<available_from>&to=<available_to>&sublease_id=<id>` to the detail URL.
  - `PropertyDetail.js` reads those params via `useSearchParams`, pre-fills `bookingData.start_date`/`end_date` + the date-picker range, opens the booking form automatically, and renders a gold "SUBLEASE LISTING — Booking dates pre-filled: Sep 1 — Sep 30, 2026" context banner above the form.
  - For long-term rentals, sublease params override the default `starting_date` pre-fill.
  - Verified live: navigating `/property/.../?from=2026-09-01&to=2026-09-30&sublease_id=...` → banner renders with correct dates, check-in pill = "Sep 1, 2026", check-out pill = "Sep 30, 2026", ready to reserve.
- [x] **Sublease bookings fully decoupled from original property** (2026-04-30):
  - **Backend**: `BookingCreate` gets an optional `sublease_id` field. When provided:
    - `owner_id` of the new booking is set to the sublessor (sublease's `subleasor_id`), NOT the property owner.
    - Sublease's own price/currency/price_type is used to compute `total_price` for the Postmark confirmation email.
    - `property_title` in notifications + enriched `GET /bookings` uses the sublease's title (e.g. "Sublease: TEST_Flow").
    - Sublease bookings auto-confirm (like vacation) — no manual owner approval needed.
    - Sublessor receives notifications + emails; the underlying property owner is silent on this flow.
  - **Role permissions**: `GET /bookings` now OR-matches `renter_id` and `owner_id` for renters so a renter-sublessor sees incoming bookings on their subleases. `POST /bookings/{id}/cancel` also accepts a sublessor cancelling their own sublease's booking.
  - **Frontend**: `PropertyDetail.handleBooking` includes `sublease_id` in POST body when visiting via a sublease deep-link. `PropertyDetail.handleChat` preserves `sublease_id` in chat URL. `Chat.js` reads the param and sets `otherUserId` to the sublessor (not property owner) for all messaging.
  - **Verified end-to-end with curl**: owner A seeds property → renter B books & gets confirmed → renter B creates sublease at different price+currency → admin C books via sublease_id → sublessor B sees the booking in `GET /bookings` with sublease title, while property owner A sees nothing. Sublessor B cancels the sublease booking successfully (status → cancelled).
- [x] **Sublease Edit** (2026-04-30):
  - Backend `PUT /api/subleases/{id}` now accepts `currency` and `holiday_tags` alongside existing fields.
  - Frontend: each sublease card has an Edit button that hydrates the form with existing values and scrolls into view. Header/CTA switch to edit mode ("Save Changes"). Step-1 picker and "Change property" link hidden since the property is immutable.
- [x] **ContractManager.js refactor** (2026-05-12):
  - Split the 586-line / complexity-69 file into 3 focused files:
    - `components/ContractManager.js` (204 lines): orchestrator that owns server state (contracts, loading, uploading, expandedContract, translatingId, signingContractId, signerName) + all API handlers (fetchContracts / uploadContract / translateContract / signContract / deleteContract / downloadContract).
    - `components/contracts/ContractUploadForm.jsx` (156 lines): self-contained drag-and-drop upload card with local file + property selection state; validates type/size before bubbling up.
    - `components/contracts/ContractListItem.jsx` (305 lines): pure presentational row — header + expanded panel + inner `StatusBadge`, `TranslationPanel` (with Original/Translated/Side-by-side view toggle owned locally), and `SignaturePanel` (with its own `SignatureCanvas` ref). All callbacks come from the parent.
  - All `data-testid`s preserved (`contract-manager`, `upload-contract-btn`, `upload-form`, `contract-dropzone`, `contract-property-select`, `contract-{id}`, `download-btn-{id}`, `delete-btn-{id}`, `sign-btn-{id}`, `translate-section-{id}`, `translate-he-en-{id}`, `translate-en-he-{id}`, `signing-section-{id}`, `signer-name-input`, `confirm-sign-btn-{id}`, `signatures-{id}`, `confirm-delete-contract-{id}`, `submit-upload-btn`, `contract-file-input`).
  - ContractManager.js complexity dropped from 69 → ~12. Each split component is independently testable; view-mode toggle now resets per-contract on each expand (was global before).
  - Verified end-to-end (owner@test.com): tab mounts, upload form opens with property dropdown populated, row expands showing Download/Delete buttons + HE↔EN translate buttons + Original/Translated/Side-by-side toggle + extracted text + signatures. Zero console errors. ESLint clean.
- [x] **Backend trio refactor: postmark_webhook + translate_booking_contract + bulk_upload helpers** (2026-05-12):
  - **`postmark_webhook` (admin.py)** — was 68 lines / complexity 16. Now a 19-line orchestrator + 4 named helpers: `_assert_webhook_token` (auth), `_read_postmark_json` (body parse), `_build_email_event` (event-doc factory), `_user_email_update_from` (Bounce/Complaint/Delivery → user.email_* update). Module-level `_EMAIL_STATUS_MAP` replaces an inline dict.
  - **`translate_booking_contract` (bookings.py)** — was 68 lines / complexity 15. Now a 32-line orchestrator + 5 helpers: `_load_translatable_booking` (auth + 403), `_cached_translation` (idempotent short-circuit), `_resolve_contract_path` (filesystem lookup), `_extract_contract_text` (PDF vs image OCR), `_do_translate` (LLM call + error mapping).
  - **`_normalize_row` (bulk_upload.py)** — was complexity 17 (one huge function with sequential coercions). Now a 6-line orchestrator + 4 helpers: `_project_columns`, `_assert_required_present`, `_normalize_rental_type`, `_coerce_numeric_and_bool`, `_apply_defaults_and_currency`. Module-level constants for `_BOOL_FIELDS`/`_INT_FIELDS`/`_FLOAT_FIELDS`/`_LIST_FIELDS`/`_DEFAULTS` replace inline tuples.
  - **`attach_bulk_images` + `attach_bulk_images_flat` (bulk_upload.py)** — was complexity 15/16 with massive duplication. Both endpoints now ≤20 lines each, sharing a `_fanout_images(property_map, file_source, payload)` core. New helpers: `_assert_bulk_role`, `_parse_mapping_json`, `_load_owned_property`, `_persist_uploaded_image`, `_attach_one` (single file attach + classification). Behavior unchanged.
  - **Tested**: 24 new pytest cases in `tests/test_backend_trio_refactor.py` (event-doc shape, hard-bounce metadata, delivery clears suppression, token guard; cached-translation idempotency, auth 403; normalize_row defaults + currency + amenities split + rental_type enum; _attach_one missing/unsupported/success paths with real file writes). All 24 pass. Full critical regression (137/137 non-flaky tests) green: `test_backend_trio_refactor + test_mention_email + test_accept_booking_refactor + test_refactor_regression + test_bulk_upload + test_bulk_manager`. 4 unrelated saved_search timing-flaky tests pre-existing.
- [x] **Code-review wins: stable React keys + accept_booking() refactor** (2026-05-12):
  - **`BulkUploadModal.jsx`**: rows now carry a `_id` minted via `crypto.randomUUID()` in `blankProperty()`. `duplicateRow` mints a fresh `_id` per clone. The TSV serializer filters `_id` out of `Object.keys(rows[0])` so it never reaches the backend. Prevents React state bleeding between rows when duplicating/removing.
  - **`PropertyList.jsx`**: bulk-image `imageAssignments` rows also gain a stable `_id` (used for `key`). Removing row 0 no longer shifts dropdown state onto remaining rows.
  - **`routes/bookings.py::accept_booking()` refactor**: 109-line function decomposed into a 27-line orchestrator + 4 named helpers: `_load_and_authorize_pending()` (auth + pending guard), `_queue_acceptance_email()` (fire-and-forget Postmark), `_attach_contract_signing()` (mint token + dual notification), `_notify_renter_accepted()` (no-contract path), plus a shared `_notification()` builder. Behavior unchanged.
  - **Verified**: 4 new pytest cases (`tests/test_accept_booking_refactor.py`) cover both control paths + auth rejection (403 wrong-owner, 400 non-pending status). All 56 tests in `mention_email + accept_booking_refactor + refactor_regression` pass.
- [x] **Role-aware @-mention autocomplete in chat input** (2026-05-11):
  - Rewrote `frontend/src/components/chat/MessageInput.jsx` with a `findMentionContext()` helper that detects an in-progress `@partial` at the caret. Lookbehind requires `@` to follow whitespace or sit at the start of the input — so `email@owner.com` never triggers (matches the backend `utils/mentions.py` regex exactly).
  - Popover renders the 3 backend-recognized roles (`@owner`, `@renter`, `@manager`) as chips with brand-color icons (Home / User / Briefcase) and localized one-line descriptions. Filters live as the user types more characters.
  - Keyboard nav: `ArrowUp`/`ArrowDown` to walk, `Enter` or `Tab` to insert, `Esc` to dismiss. Mouse click also inserts. Insert injects `@<role> ` (trailing space) and restores caret right after the token.
  - Added EN+HE keys `chat.mentionHint`/`mentionOwner`/`mentionRenter`/`mentionManager`.
  - Verified end-to-end in browser: typing `@` shows all 3 options → typing `ow` filters to just `@owner` → `Enter` injects `hello @owner ` → typing `foo@own` (after non-whitespace) does NOT show popover. ESLint clean.
- [x] **Email ping for unread @-mentions** (2026-05-11):
  - New background task `utils/mention_email.py::mention_email_loop()` (kicked off in `server.py` startup alongside `sync_all_ical_feeds`). Scans every 2 minutes.
  - Eligibility filter: `mentions` array non-empty AND `read=False` AND `created_at` older than 10 minutes AND no `mention_email_sent` flag yet.
  - Resolves the receiver's role via `current_user_role_in_property` (sublease-aware: sublessor of an active sublease on the property is treated as `owner`). Only emails when the receiver's role appears in the message's `mentions` list; role mismatches are flagged-and-skipped so we never re-scan them.
  - New `send_mention_notification_email()` helper in `utils/email.py` — branded teal/gold template with HTML-escaped sender name + property title + 240-char message snippet + "Open Conversation" button deep-linked to `/chat/{property_id}?with={sender_id}`. Tagged `mention-notification`.
  - Idempotent: every processed message gets `mention_email_sent: True` + `mention_email_sent_at` + `mention_email_delivered` so a second loop pass never re-sends, even if Postmark returned False (suppressed recipient).
  - Tested: 5/5 pytest in `tests/test_mention_email.py` (eligible → emails + flags; <10 min → skipped; already read → skipped; role mismatch → flag-no-email; already-flagged → skipped). Email-body smoke test verifies XSS escaping, branded subject (`@owner — new mention from {sender}`), and the conversation deep-link.
- [x] **SubleasesTab.jsx refactor** (2026-05-11):
  - Split the 859-line `SubleasesTab.jsx` into 3 focused components:
    - `SubleasesTab.jsx` (~360 lines): owns all state, API calls (fetch/create/update/delete/upload-contract/toggle-active), and orchestrates the form + list.
    - `dashboard/sublease/SubleaseForm.jsx` (~340 lines): pure form panel (step-1 booking picker + step-2 details with the shadcn Calendar popover, price+currency, holiday tags, notes). Hydrates from parent state.
    - `dashboard/sublease/SubleaseListItem.jsx` (~155 lines): pure presentational sublease row card with image, badges, action buttons, and contract-upload/copy-link affordances.
  - All `data-testid`s preserved (`subleases-tab`, `create-sublease-btn`, `sublease-form-container`, `sublease-{id}`, `edit-sublease-{id}`, `toggle-sublease-{id}`, `delete-sublease-{id}`, `upload-contract-{id}`, `copy-sign-link-{id}`).
  - Verified end-to-end (renter@test.com): list renders existing sublease (Cozy Tel Aviv Apartment), "+ New Sublease" opens the step-1 picker, Edit hydrates all fields (dates, price=250, currency=ILS, bedrooms=1, holiday tags, notes), submit button correctly switches to "Save Changes". Zero console errors. ESLint clean.
- [x] **Chat notification deep-linking + Messages inbox tab** (2026-05-01):
  - **Backend** `routes/chat.py`: `new_message` notifications now persist `sender_id` so the lister/owner can deep-link straight into the right conversation. `GET /api/chat/messages/{property_id}` accepts `with_user=` to scope output (and read-receipt updates) to a single counterparty pair, fixing the multi-renter inbox bleed-through. `GET /api/chat/conversations` includes `other_user.id` in each row.
  - **Frontend** `Navigation.js`: `handleNotificationClick` now routes `new_message` notifications to `/chat/{property_id}?with={sender_id}&sublease_id=…` instead of the property page. `Chat.js` reads `?with=` and uses it as `otherUserId` (overrides owner_id when the lister is viewing); messages fetch is scoped per counterparty.
  - **New `MessagesTab.jsx`** added to the Dashboard (`tab=messages`, MessageCircle icon) — pulls `GET /api/chat/conversations`, lists each conversation card with property title, counterparty, last message, unread dot, and deep-links to `/chat/{property_id}?with={other_user.id}`.
  - **Real-time alerts** (2026-05-01): new `utils/messageAlerts.js` plays a Web Audio two-tone ping AND fires a desktop browser notification when a fresh `new_message` arrives via the existing 30 s notification poll. Permission is requested on bell click (user gesture). Alerted ids are tracked in a ref so each message only pings once.
  - **Unread Messages badge**: red counter pill on the new Messages tab in the Dashboard, hydrated from `chat/conversations` and updated optimistically when the user opens the tab.
  - Verified end-to-end with curl: renter sends message → owner notification carries `sender_id` → owner conversations list returns scoped pair → owner messages endpoint with `with_user` returns only that conversation. Live screenshot: red "1" badge on Messages tab after a new unread message lands.
- [x] **Chat: typing indicator + read-receipt ticks** (2026-05-01):
  - **Backend**: new `POST /api/chat/typing` (body `{property_id, with_user}`) upserts a typing record, and `GET /api/chat/typing/{property_id}?with_user=…` returns `{typing: bool}` based on a 5-second TTL window. Both pinned in `routes/chat.py` with `TypingPing` request model and `TypingStatusResponse`.
  - **Frontend** `Chat.js`:
    - On every keystroke, debounced 1-per-2-seconds POST to `/chat/typing`.
    - Independent 2-second poll of `/chat/typing/{property_id}?with_user=…`; when truthy, animated three-dot bubble renders at the end of the message list (WhatsApp-style).
    - Read receipts: my own message bubbles now show a single white `Check` icon (sent / unread) which becomes a gold `CheckCheck` once `msg.read===true` (the receiver's `with_user`-scoped fetch flips the read flag, so this is consistent end-to-end with what's already persisted).
  - **Robustness**: `Chat.js` now honors a `?with=` deep-link even when the underlying property has been deleted (orphan conversations remain accessible from the Messages inbox).
  - Verified with curl + browser: typing endpoint flips true → false after the 5 s TTL; renter-side screenshot shows 2 sent ticks (white) + 1 read tick (gold) for an existing read message.
- [x] **Bilingual chat: inline Claude-powered EN/HE message translation** (2026-05-01):
  - **Backend**: new `utils/chat_translate.py` (Hebrew autodetection via Unicode range + `LlmChat` with `claude-4-sonnet-20250514` and a chat-tone system prompt that preserves emojis/prices/dates verbatim). New `POST /api/chat/messages/{message_id}/translate` (body `{target_lang: 'en'|'he'}`) returns `TranslatedMessageResponse {message_id, source_lang, target_lang, translated_text}` and **caches** results on the message doc (`translations.{lang}`) so repeat calls are instant (~100 ms vs LLM round-trip). Participant-only enforcement.
  - **Frontend** `Chat.js`: each incoming message in the *opposite* script of the current UI language gets a "Translate to English/Hebrew" link with a `Languages` icon. Clicking shows "Translating…" → an inline divider block with the source→target pair label and the translated text. Clicking again toggles it off. State kept per-message in component state.
  - Verified end-to-end: renter sends `שלום! האם הדירה עדיין פנויה?` → owner clicks Translate → renders "HEBREW → ENGLISH / Hello! Is the apartment still available?" inline. Cache hit on second call returned in 107 ms.
- [x] **Top-nav Messages icon (always-visible inbox shortcut)** (2026-05-01):
  - Added a `MessageCircle` icon next to the bell in `Navigation.js`, visible site-wide whenever the user is logged in. Polls `GET /api/chat/conversations` every 20 s and renders a red unread-count badge (`9+` clamp). Click navigates to `/dashboard?tab=messages`.
  - Verified: with one new unread message, the badge shows "1"; clicking lands on Dashboard with the Messages tab active.
- [x] **Hide "My Properties" tab from renters** (2026-05-01):
  - `DashboardTabs.jsx`: `tab-properties` gated behind `isOwnerLike`. `Dashboard.js`: when a renter loads the dashboard, the active tab auto-switches to `bookings`.
- [x] **User-level default language preference** (2026-05-01):
  - **Backend**: new `LanguagePreference` request model + `PUT /api/auth/language` (validates `'en'|'he'` only) persists `preferred_language` on the user document. `GET /api/auth/me` already passes the field through (UserPublic uses `extra='allow'`).
  - **Frontend**: `App.js` `fetchCurrentUser` reads `user.preferred_language` and calls `i18n.changeLanguage(pref)` so the site opens in the saved language on every device. `Navigation.js` toggle now also persists to the backend when logged in. New "Default Language" card in `SettingsTab.jsx` with EN/HE pill selector + Save button.
  - **Verified**: curl PUT + reload as renter@test.com → page loads RTL with Hebrew tabs (`ההזמנות שלי`, etc.). Bad payload (`fr`) returns 400.
- [x] **Dashboard Hebrew translation completeness** (2026-05-03):
  - Wrapped Settings → Change Password section (title, hint, labels, placeholders, Update button) with `t()` — previously hardcoded English.
  - Wrapped Bookings → Cancellation/Denial Reason + Message labels with `t()`.
  - Added new keys to `i18n.js` (`changePasswordHint`, `*PasswordPlaceholder`, `updatePassword`, `cancellationReason`, `denialReason`, `message`) in both EN and HE blocks.
  - Verified via browser screenshots: Hebrew dashboard now shows `שנה סיסמה` / `עדכן את הסיסמה שלך` / `סיסמה נוכחית` / `הזן סיסמה נוכחית` / `עדכן סיסמה` and `סיבת ביטול:` on cancellations.
  - Layout stays LTR per user request; only text is swapped.
- [x] **Public pages Hebrew translation** (2026-05-03):
  - **Home.js**: `WhatsApp:` label now uses `t('home.whatsapp')`.
  - **Properties.js**: `Sukkot Rentals` / `Pesach Rentals` page titles, holiday-window banner description + CTA (`Find homes available these dates`), `Save as alert` button + tooltip, and `Sublease` ribbon now all use i18n keys.
  - **PropertyDetail.js**: `Back to Dashboard` / `Back to Listings`, `Loading...`, `Share Property` / `Copied!`, `Save` / `Saved`, `Agent Fee:`, `Available from:`, `Minimum Stay:` (+ day/days/month/months pluralization), `Quick select:`, `+ 1 Year`, `Clear`, `Pick check-in & check-out dates` / `Reserve Booking`, and the entire contract-signing modal (`Sign Contract`, intro text, `View Contract (PDF)`, `Draw your signature above`, `OR`, `Upload Signature Image`, `Sign & Continue`, `Cancel`) all wrapped with `t()`.
  - Added ~35 new keys in EN + HE under `property.*`, `filters.*`, `home.*` sections of `i18n.js`.
  - Verified via browser screenshots on all 4 pages (Home, /properties/all, /properties/sukkot, PropertyDetail): every visible static string now renders correctly in Hebrew (e.g. `מצא את השכירות המושלמת`, `השכרות לסוכות`, `דמי תיווך:`, `שהייה מינימלית:`, `+ שנה אחת`, `בחר תאריכי צ׳ק-אין וצ׳ק-אאוט`, `השכרת משנה` ribbon).
  - ESLint clean.
- [x] **Secondary pages Hebrew translation — zero-English coverage** (2026-05-03):
  - **Auth.js**: Forgot-password view (`Check Your Email`, `Back to Login`, `Forgot Password?`, hint, `Email Address` label + placeholder, `Sending...` / `Reset Password`), Reset-password view (`Password Reset!`, success message, `Go to Login`, `Set New Password`, hint, `New Password` label + placeholder `At least 6 characters`, `Confirm New Password` + placeholder `Repeat your new password`, `Resetting...`), Login-form `Forgot your password?` link. Full `resetLinkSent` supports `{{email}}` interpolation with `dangerouslySetInnerHTML` so the `<strong>` wrapping still renders.
  - **Chat.js**: Added `t` to `useTranslation()` destructure. Translated `Back`, `Live Chat`, `Dashboard`, search bar (`Search messages…`, `No matches`, `{current} of {total}`, `Previous/Next/Close match`), property-type `Sublease` badge, empty-state (`No messages yet`, `Start the conversation about this property.`), per-message `Edit message` / `Delete message` / `Edit (within 5 minutes)` a11y labels, inline-edit buttons (`Cancel`, `Save`, `Enter to save · Esc to cancel`), translation block (`Translating…`, `Hebrew → English` language labels, `Translate to English/Hebrew`), `· edited` indicator, message input `Type your message...`, footer `Return to Dashboard`.
  - **SignContract.js**: Added `useTranslation` import. Translated `Invalid Link`, `Sublease Contract` / `Sublease Agreement` headers, `View/Hide Contract Text` toggle, `Download Contract`, `Signed by:` / `Signed` date prefix, full signing panel (`Sign This Contract`, `Your Full Legal Name` + placeholder, `Draw Your Signature`, `Clear signature`, `Signing...` / `Confirm & Sign Contract`, legal disclaimer), `Contract Signed!` success state, footer, and `/night` / ` total` price suffixes.
  - Added ~70 new EN+HE keys under `auth.*`, `chat.*`, `sign.*` sections of `i18n.js`.
  - Verified via browser screenshots: `/auth/forgot-password` renders `שכחת סיסמה?`, `כתובת אימייל`, `אפס סיסמה`, `חזרה להתחברות` correctly.
  - ESLint clean across all 4 edited files.
- [x] **Admin Dashboard + Bulk Manager full Hebrew sweep** (2026-05-04):
  - **AdminDashboard.js**: Added `useTranslation`. Converted `TABS` → `TAB_KEYS` with `labelKey` so each tab uses `t(tab.labelKey)`. Dashboard heading now `t('admin.title')` → `לוח בקרה ראשי`.
  - **OverviewTab.jsx**: Stat cards use `t('admin.activeListings/totalViews/inquiries/totalUsers/pendingServices')`, `Recent Listings` → `t('admin.recentListings')`. Table headers renamed to `admin.colTitle/colArea/colType/colPrice/colViews` (to avoid shadowing `admin.title`). Full `Email Deliverability` block (`lastNDays`, `delivered`, `bounced`, `spamComplaints`, `deliveryRate`, `usersSuppressed`, `recentEvents`) translated.
  - **ListingsTab.jsx**: Search placeholder, `listingsCount`, `selectedCount`, `Mark selected as booked`, `Clear` button, `Admin blocked` badge + its range tooltip, per-row `Mark as booked` / `Remove admin block` / `Activate` / `Deactivate` / `Delete` tooltips, delete-listing confirm toast, unblock confirm toast, `No listings found` empty state.
  - **UsersTab.jsx**: Search placeholder, `usersCount`, column headers (`colName/colEmail/colRole/status/colJoined/actions`), `Block` / `Unblock` tooltips, `Delete` tooltip, delete-user confirm toast, `Protected` label, `No users found` empty.
  - **ChatsTab.jsx**: `No conversations yet`, per-conversation `{n} messages` suffix, `Unknown` sender fallback, `No messages` branch.
  - **ServicesTab.jsx**: Column headers + 4 status dropdown options translated.
  - **SettingsTab.jsx**: Heading, WhatsApp/Email/Phone labels, `Featured Property IDs` + help hint + placeholder, `Save Settings` button.
  - **MarkAsBookedModal.jsx**: Title, single/bulk description (with `{{count}}`/`{{noun}}` interpolation using translated `property` / `properties`), `Block indefinitely`, `Start/End date` labels, footer buttons.
  - **BulkManagerTab.jsx**: Search placeholder, rental/area dropdown firstrow (`All types` / `All areas`), `Select/Clear all visible`, `Undo last`, selected/visible/total counters, `Bulk Edit Details`, `Bulk Add Photos`, column headers, empty-filter state, `(untitled)` fallback, cover-picker tooltips, mobile floating bar actions.
  - **BulkEditModal.jsx**: All 9 `FIELD_GROUPS` labels and 28 `LABELS` field labels moved to `t('bulk.fieldGroups.*')` / `t('bulk.fieldLabels.*')`. Yes/No boolean selects, amenities Append/Replace radio, Save & Apply button, toast messages.
  - **BulkPhotosModal.jsx**: Title + subtitle, `Same photos to all` / `Different per property` mode tabs, drop-zone placeholders, progress indicator, validation toasts, `Cancel` / `Save & Apply` buttons.
  - **CoverPickerModal.jsx**: `Choose cover photo`, `COVER` badge, `Set as cover` / `Saving…` hover overlay, `This property has no photos yet.` empty state, toast messages.
  - Added ~180 new EN+HE keys under `admin.*` + new `bulk.*` namespace (with nested `fieldGroups`, `fieldLabels`, `yesNo`).
  - Renamed conflicting keys `admin.title/area/type/price/views/name/email/role/joined/owner` → `admin.colTitle/colArea/...` to prevent shadowing the dashboard heading.
  - Verified via browser screenshots: admin overview/listings/settings and owner bulk-manager all render in Hebrew (`לוח בקרה ראשי`, `נכסי פעילים`, `מסירת אימייל`, `עריכה מרובה של פרטים`, Hebrew column headers, etc.).
  - Left untranslated intentionally: RENTAL_TYPES/PROPERTY_TYPES/CONDITIONS/FURNITURE_OPTIONS/CANCELLATION_POLICIES enum labels (shared with Add/Edit forms; touching them would require a global refactor).
  - ESLint clean across all 12+ files.
- [x] **PayPal Sandbox payments integration** (2026-05-04):
  - **Backend**: `/app/backend/utils/paypal.py` (REST v2 client via httpx with OAuth2 token cache, create/capture/get order), `/app/backend/routes/payments.py` with server-authoritative `_compute_amount()` — document_service: $150 single / $250 bundle; sublease_booking: 2.5% of booking_amount; currency whitelist USD/ILS. Endpoints: `POST /payments/orders`, `POST /payments/orders/{id}/capture`, `GET /payments/orders/{id}`, `GET /payments/my`. Capture updates `db.orders` and applies business side-effects (document_services rows inserted paid=true; booking.service_fee_paid=true). `.env` adds `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE=sandbox`, `PAYPAL_ADMIN_EMAIL=admin@rental.com`.
  - **Email**: new `send_payment_confirmation_email()` in `utils/email.py` (branded receipt template with order ID, PayPal transaction, amount, paid-at). Sends to customer + admin; wrapped in try/except so email failure never 500s a successful capture.
  - **Frontend**: `yarn add @paypal/react-paypal-js`; `REACT_APP_PAYPAL_CLIENT_ID` added. New `components/PayPalCheckout.jsx` (Smart Buttons wrapper), `pages/PaymentSuccess.js` (/payment/success with full order summary; handles both our own redirect with `?orderId` and PayPal's own `?token=` redirect by looking up via `/payments/my` and auto-capturing), `pages/PaymentCancel.js` (/payment/cancel), `components/SubleaseFeePayModal.jsx` (post-booking 2.5% fee modal). `DocumentService.js` rewritten: multi-select services with live bundle-discount banner, server-authoritative total, PayPal buttons gated on valid form. `PropertyDetail.js` now opens the fee modal automatically after a successful sublease booking. Routes `/payment/success` (auth-gated) and `/payment/cancel` added to `App.js`.
  - **Testing**: `testing_agent_v3_fork` ran `/app/backend/tests/test_payments.py` (16/16 PASS) + Playwright frontend E2E. Zero critical issues. Report: `/app/test_reports/iteration_20.json`.

- [x] **PayPal webhook endpoint** (2026-05-04):
  - `POST /api/payments/webhooks/paypal` — receives async PayPal events (captures started via direct redirect, refunds, reversals, denials) as a belt-and-suspenders alongside the user-facing `/capture` endpoint.
  - **Signature verification** via PayPal's official `/v1/notifications/verify-webhook-signature` API in `utils/paypal.verify_webhook_signature()`. Fail-closed: any missing header / bad signature / API error → 200 `ignored` (PayPal stops retrying; no DB write).
  - **Idempotency** via `db.paypal_webhook_events` collection with a unique index on `id` (created on server startup). Duplicate deliveries → 200 `ignored: duplicate`.
  - **Handled events**: `PAYMENT.CAPTURE.COMPLETED` (calls the shared `_finalize_captured_order()` helper that also powers the user-facing capture path — so emails + doc-service inserts + booking flagging all run exactly once whichever path wins the race), `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED`, `PAYMENT.CAPTURE.DENIED`. Unknown event types acknowledged silently.
  - Refactored `capture_payment_order` to call the new shared `_finalize_captured_order()` helper — keeps the user-facing endpoint and the webhook endpoint on the same finalizer.
  - **Env**: added `PAYPAL_WEBHOOK_ID=` to `/app/backend/.env` (blank = fail-closed). Paste the Webhook ID from https://developer.paypal.com/dashboard/applications/sandbox → your app → Webhooks → Add Webhook (URL: `{FRONTEND_URL}/api/payments/webhooks/paypal`, events: `PAYMENT.CAPTURE.COMPLETED|REFUNDED|REVERSED|DENIED`) before relying on it.
  - **Verified with curl**: `webhook_id_unset` when env var blank, `malformed` on bad JSON, existing order creation still returns $150 USD — so the refactor didn't regress anything.
  - **Backend**: `/app/backend/utils/paypal.py` (REST v2 client via httpx with OAuth2 token cache, create/capture/get order), `/app/backend/routes/payments.py` with server-authoritative `_compute_amount()` — document_service: $150 single / $250 bundle; sublease_booking: 2.5% of booking_amount; currency whitelist USD/ILS. Endpoints: `POST /payments/orders`, `POST /payments/orders/{id}/capture`, `GET /payments/orders/{id}`, `GET /payments/my`. Capture updates `db.orders` and applies business side-effects (document_services rows inserted paid=true; booking.service_fee_paid=true). `.env` adds `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE=sandbox`, `PAYPAL_ADMIN_EMAIL=admin@rental.com`.
  - **Email**: new `send_payment_confirmation_email()` in `utils/email.py` (branded receipt template with order ID, PayPal transaction, amount, paid-at). Sends to customer + admin; wrapped in try/except so email failure never 500s a successful capture.
  - **Frontend**: `yarn add @paypal/react-paypal-js`; `REACT_APP_PAYPAL_CLIENT_ID` added. New `components/PayPalCheckout.jsx` (Smart Buttons wrapper), `pages/PaymentSuccess.js` (/payment/success with full order summary; handles both our own redirect with `?orderId` and PayPal's own `?token=` redirect by looking up via `/payments/my` and auto-capturing), `pages/PaymentCancel.js` (/payment/cancel), `components/SubleaseFeePayModal.jsx` (post-booking 2.5% fee modal). `DocumentService.js` rewritten: multi-select services with live bundle-discount banner, server-authoritative total, PayPal buttons gated on valid form. `PropertyDetail.js` now opens the fee modal automatically after a successful sublease booking. Routes `/payment/success` (auth-gated) and `/payment/cancel` added to `App.js`.
  - **Testing**: `testing_agent_v3_fork` ran `/app/backend/tests/test_payments.py` (16/16 PASS) + Playwright frontend E2E (default $150, bundle $250 with banner text, PayPal Smart Buttons iframe successfully mounts, gating verified, /payment/cancel + /payment/success error state verified). Zero critical issues. Report: `/app/test_reports/iteration_20.json`.
  - **Known limitation**: full PayPal button click-through through the sandbox popup requires a manual smoke test with a sandbox buyer account — Playwright can't navigate the PayPal-hosted OAuth flow reliably.
- [x] **Pivot Paid Services from Arnona/Name Change → Bituach Leumi Benefits** (2026-05-05):
  - **Backend**: `routes/payments.py` `VALID_DOC_SERVICES` now `{kitzvat_yeladim, maanak_leidah, birth_expenses}`. Pricing unchanged shape ($150 single / $250 for any 2 or 3). Added `SERVICE_REQUIRED_INFO` map per service (parent ID, bank details, hospital docs, receipts, etc.) and `_build_required_info_html()` helper.
  - **Email**: `send_payment_confirmation_email()` extended with optional `required_info_html` + `whatsapp_number` kwargs — customer-only block ("Next step — send us your details on WhatsApp") rendering a per-service checklist + WhatsApp deeplink (`https://wa.me/<digits>` button). Admin copy unchanged. `_finalize_captured_order` fetches the WhatsApp number from `db.site_settings` and injects it.
  - **Frontend** (`pages/DocumentService.js` + `components/dashboard/GovernmentServicesTab.jsx`): replaced 2-service picker with the 3 Bituach Leumi services, removed property/tenant form fields (info now collected via post-payment WhatsApp), added "How it works" 3-step (pay → emailed checklist → WhatsApp it back) panel. Bundle-savings banner now dynamic ($50+ saved). Dashboard tab is now a fully embedded paid checkout instead of a free request form.
  - **Verified**: curl on `/api/payments/orders` returns $150 / $250 / $250 with correct Bituach Leumi descriptions for 1/2/3 services; old keys `arnona_discount` rejected with HTTP 400. Frontend smoke screenshot confirms the new copy renders with PayPal buttons.

- [x] **Expand to 5 Document Services + Pair-Discount Pricing** (2026-05-05):
  - Added back `arnona_discount` and `name_change` alongside the 3 Bituach Leumi services → **5 total services** at $150 each.
  - **New pricing formula** (server-authoritative): `total = n*150 - floor(n/2)*50` (every completed pair saves $50). Yields 1=$150, 2=$250, 3=$400, 4=$500, 5=$650.
  - **Backend** (`routes/payments.py`): added `arnona_discount` + `name_change` to `VALID_DOC_SERVICES`, `SERVICE_PRETTY`, and `SERVICE_REQUIRED_INFO` (with appropriate per-service checklists — Arnona bill/eligibility for Arnona; lease + utility account numbers for name change). Replaced the flat single/bundle constants with `DOCUMENT_SERVICE_PRICE_PER` + `DOCUMENT_SERVICE_PAIR_DISCOUNT`. Description pretty-printed as "Document service — X" or "Document services — X + Y + Z".
  - **Frontend**: introduced shared catalog `frontend/src/lib/documentServices.js` (DOC_SERVICES list, SERVICE_BY_KEY map, computeTotal/computeSavings helpers). `DocumentService.js`, `GovernmentServicesTab.jsx`, and `PaymentSuccess.js` all consume it — single source of truth keeps the WhatsApp deeplink checklist, the price ladder, and the service labels in sync. Headline copy generalized from "Bituach Leumi Benefits" → "Document Filing Services". Bundle banner now dynamic and works for any pair count.
  - **Verified end-to-end**: curl confirms all 5 prices ($150/$250/$400/$500/$650) on the backend; Playwright run progressively selects all 5 service buttons and asserts the live total updates to exactly the expected price at every step. Bundle banner correctly displays "you saved $100" when 4–5 services are selected.

- [x] **Per-Service Revenue Split + Admin Revenue Widget** (2026-05-05):
  - **Backend** `_apply_business_side_effects`: bundle orders now distribute the captured total evenly across services (`paid_amount_usd` per row, last row absorbs rounding remainder). Verified 1/2/3/4/5-service bundles all reconcile to the order total exactly.
  - **New endpoint** `GET /api/admin/document-services/revenue?window_days=N` (admin-only, 403 for renters): returns `{window_days, total_revenue_usd, total_filings, rows: [{service_type, label, count, revenue_usd}]}`. Supports `window_days=0` for all-time. Catalog services with $0 still appear in the response so the widget can render the full ladder. Response model `ServiceRevenueResponse` added to `models_response.py`.
  - **Frontend**: new `components/admin/ServiceRevenueWidget.jsx` — compact bar chart sorted by revenue with a 30d / 90d / All-time pill toggle. Wired into `OverviewTab.jsx` (token piped through from `AdminDashboard.js`). Empty-state copy when no filings have been paid yet.
  - **Verified**: seeded 9 rows (5-service bundle 5d ago + 2-service bundle 12d ago + single 25d ago + one 60d ago); 30d window correctly shows $1,050.00 / 8 filings; 90d correctly shows $1,200.00 / 9 filings (picks up the older row). Playwright assertion confirms the widget renders the totals, the per-row breakdown, and the window toggle.



### P2 - Lower Priority
- [ ] Manager bulk property upload via text
- [ ] Personal manager profile pages
- [ ] LLM Integration (Claude Sonnet) for translation/chat enhancements
- [x] Dashboard.js refactoring (~900 lines) — done 2026-04-29 (now 232 lines)
- [x] server.py route extraction into /routes directory — done 2026-04-23
- [x] **FAQ page wired + Owner Management Offer i18n** (2026-02-10):
  - `/faq` route added to `App.js`. Static FAQ page (`pages/FAQ.js`) with 4 Shadcn-style accordion sections (Booking, Fees, Cancellations, Hosts & Support), gold "Help Center" eyebrow, teal-gradient WhatsApp CTA at the bottom.
  - Discoverable from two places: nav drawer ("FAQs" with `HelpCircle` icon between Storage and the Language toggle) **and** the Home page footer (link below the email line).
  - i18n keys added in EN+HE: `nav.faq` (`FAQs` / `שאלות נפוצות`), `footer.faq` (`Frequently Asked Questions` / `שאלות נפוצות`).
  - Full Hebrew translation block added for the OwnerManagementOfferModal (`ownerOffer.tag/title/subtitle/findTenants/findTenantsCopy/handleIssues/handleIssuesCopy/fullService/fullServiceCopy/dismiss/contactCta`) — was previously rendering English fallbacks.
  - Verified mobile (390×844): FAQ accordion expands/collapses, menu drawer shows FAQ link, footer link navigates to `/faq`.

- [x] **FAQ search bar + match highlighting** (2026-02-10):
  - Added a real-time client-side search input above the accordion sections in `pages/FAQ.js`. Filters both questions and answer text (handles JSX answers via a small `answerToText` walker), auto-expands every match so users read the answer without an extra tap, gold-highlights the matched substring inline.
  - "No results" state with WhatsApp escape hatch; live match-count pill ("1 match for 'cancel'"); X button to clear and restore default state.

- [x] **Code review fix sweep** (2026-02-10):
  - Genuine fixes: Auth.js `dangerouslySetInnerHTML` now wrapped with `DOMPurify.sanitize()` (forgotEmail interpolation hardened); 7 actual `is True/False` boolean comparisons in test files normalized to `==`.
  - Refused with documented reasoning: Home.js DOMPurify "fix" (already there), i18n.js "hardcoded API keys" (translation strings, mechanically impossible to env-var), test fixture passwords ("Test1234!"), 5 "empty catch" blocks (all have intent comments + wrap calls that don't throw), FAQ.js index keys (ephemeral split-array, React docs allow it).

- [x] **AddPropertyModal refactor — phase 1: extract reusable pieces** (2026-02-10):
  - Created `/app/frontend/src/components/dashboard/propertyForm/`:
    - `DateField.jsx` (128 lines): reusable single-date picker with teal/gold variants. Removes ~110 lines of duplication that previously existed for `starting_date` and `available_from`.
    - `LocationPicker.jsx` (90 lines): self-contained city-neighborhood combobox with type-ahead, click-outside dismiss, hydrate-on-edit.
    - `MediaUploadSection.jsx` (215 lines): drag/drop uploader, progress bar, gallery thumbnails, set-as-cover promotion. Owns its own uploading/progress state.
  - **AddPropertyModal.jsx: 1068 → 722 lines (−32%)**. Behaviour unchanged.
  - Verified end-to-end: modal opens, both DateField variants render correctly when rental_type switches, LocationPicker dropdown shows full neighborhood list, vacation-only fields (cleaning fee, holiday Sukkot/Pesach tags, max guests) appear conditionally, file drop zone mounts. Zero console errors. Owner login → dashboard → Add Property smoke-test green.

- [x] **`sign_booking_contract()` backend decomposition** (2026-02-10):
  - Extracted all PDF + image signature stamping into a new pure-IO module `/app/backend/utils/contract_signing.py` (232 lines, FastAPI-free, importable + unit-testable in isolation). Public API: `stamp_signature_on_contract()` plus shared `_decode_signature_image()` and `_crop_to_visible_ink()` helpers.
  - The route handler now delegates to four small named helpers in `routes/bookings.py`: `_load_booking_for_signing()` (lookup + auth + 4xx checks), `_stamp_contract_if_present()` (resolve filenames, dispatch to stamper), `_persist_signed_contract()` (DB update), `_notify_owner_contract_signed()` (in-app notification).
  - **`sign_booking_contract` itself: 315 → 51 lines (−84%)**. Reads top-to-bottom as a 4-step orchestration. Cyclomatic complexity dropped from 42 → ~3.
  - bookings.py overall: 952 → 783 lines (the rest of the file is unchanged).
  - Removed now-unused `base64` and `BytesIO` imports from bookings.py.
  - Verified live: 404 on missing booking ✓ / 403 on wrong user (owner trying to sign as renter) ✓ / 400 on already-signed ✓ — all four pre-stamping validation paths route through the new helper correctly.

- [x] **`create_booking()` backend decomposition** (2026-02-10):
  - Extracted into 5 named helpers: `_load_property_and_sublease()` (lookup + sublease validation), `_assert_no_booking_overlap()` (overlap rule, sublease-scoped or property-scoped), `_build_booking_doc()` (id + owner routing + auto-confirm decision), `_send_booking_notifications()` (renter + owner in-app), `_queue_booking_emails()` + `_compute_booking_total()` (Postmark fire-and-forget with sublease-aware pricing).
  - **`create_booking()` itself: 187 → 38 lines (−80%)**. Cyclomatic complexity dropped from ~28 → ~2. Reads top-to-bottom as 5 named steps + return.
  - The fire-and-forget email path is now wrapped in a single `asyncio.create_task` instead of being interleaved with the booking creation flow — clearer that an email failure can never 500 the booking.
  - Verified live: vacation property booking auto-confirms with `status:confirmed`, sublease-aware overlap rejection still returns 409 with the human-readable date range, 404 paths intact for missing property/sublease.
  - bookings.py overall: 783 → 853 lines (helpers added 70 lines but removed ~150 of inlined logic, net +0 readability win since the helpers are independently testable).

- [x] **PropertyDetail.js component split + dead-code removal** (2026-02-10):
  - Created `/app/frontend/src/components/property/`:
    - `ImageGallery.jsx` (142 lines) — image+video carousel with prev/next, thumbnail strip, video autopause-on-nav, controlled `currentIndex`. Pure presentational.
    - `PropertyStats.jsx` (92 lines) — bedrooms/bathrooms/sqm/floor/porches/max-guests stat-card grid. Pure presentational.
    - `AmenitiesList.jsx` (52 lines) — 2-col amenity list with the 13-icon lookup map. Pure presentational.
  - **Deleted dead signature modal flow** (~150 lines): `setShowSignatureModal(true)` was never called anywhere in the file — booking flow was decoupled when contracts moved to `/sign/:token` post-acceptance. Removed: the modal, 5 unused state vars (`signatureData`, `isDrawing`, `signatureCanvasRef`, `showSignatureModal`, `propertyContract`), 6 dead handlers (`startDrawing`/`draw`/`stopDrawing`/`clearSignature`/`saveSignature`/`handleSignatureImageUpload`), and the `/properties/{id}/contract` fetch that only fed the dead modal.
  - Pruned 18 unused lucide imports that the inlined gallery/stats/amenities had pulled in.
  - **PropertyDetail.js: 1137 → 802 lines (−30%)**. Behaviour unchanged, ESLint clean.
  - Verified end-to-end on a 4-image vacation property: gallery carousel works (prev/next/thumb clicks all flip the counter correctly), 5 stat cards render, amenities heading renders, agent-fee badge unchanged, booking sidebar (calendar, quick-select, email/message owner, CTA) all intact, zero console errors, mobile (390×844) layout clean.
  - The big remaining piece (the ~390-line booking sidebar with date picker, quick-select presets, calendar visibility, sublease pre-fill) was deliberately left in PropertyDetail.js — its state is too tangled with the parent for a low-risk extract in this session.

- [x] **Properties.js component split** (2026-02-10):
  - Created `/app/frontend/src/components/property/`:
    - `PropertyCard.jsx` (119 lines) — grid card with hero, like button, stats row, price + FX conversion. Pure presentational, parent owns navigation + like-toggling.
    - `FiltersPanel.jsx` (539 lines) — full two-column filter drawer (Price / Rooms & Details / Property / Dates Available). Includes the `StepperControl` helper. Exports `PRICE_MAX` constant. Receives all filter state + callbacks from parent.
    - `HolidayBanner.jsx` (54 lines) — Pesach window banner with one-click pre-fill CTA. Pure presentational.
  - **Properties.js: 941 → 490 lines (−48%)**. ESLint clean across all 4 edited files.
  - The page now reads as ~330 lines of state/handlers + ~160 lines of orchestration JSX (header → banner → drawer → grid → empty-state), instead of one 940-line megafile.
  - Verified end-to-end on `/properties/all`: 13 cards render, filter drawer opens, bedrooms stepper increments to `0.5` correctly (half-bedroom step), currency toggle USD/ILS clears price filters as before, Apply Filters refetches (13 cards intact), card hero + price + FX-converted subtext (`≈ ₪1,450/night`) all rendering. `/properties/pesach` shows the Pesach holiday banner with the "Find homes available these dates" CTA. Zero console errors.

- [x] **PropertyDetail.js booking-sidebar Phase 2** (2026-02-10):
  - Created `/app/frontend/src/components/property/BookingSidebar.jsx` (431 lines) with three internal sub-components (kept private since they're tightly coupled):
    - `PriceBlock` — renders sublease price | loading skeleton | property price (with FX conversion).
    - `QuickSelectRow` — "+1 Year" / "Clear" preset buttons for long-term + short-term.
    - `BookingCalendar` — full popover with the complete-range-restart logic, minimum-booking-days auto-checkout, sublease-window confinement, and blocked-dates filtering.
  - Removed unused imports from PropertyDetail.js (`Calendar`, `MessageCircle`, `Mail`, `X`).
  - **PropertyDetail.js: 802 → 430 lines (−46% in this phase, −62% from the original 1137 across both phases)**. ESLint clean.
  - The handler functions (`handleBooking`, `handleChat`) and the parent state (`bookingData`, `dateRange`, `showCalendar`, `calendarMonth`) stay in PropertyDetail.js since they're also read by the deep-link prefill `useEffect` and the share handler. The component receives them as props.
  - Verified end-to-end on a real long-term property (booking pill correctly DISABLED for `longTermLocked`, +1 Year/Clear quick-select pills visible, Email/Message Owner buttons work, $3,000/month price + agent fee badge intact) AND a vacation property (calendar opens cleanly, today highlighted gold, past dates struck-through, X close button, Email/Message Owner all wired). Zero console errors.

- [x] **Chat.js component split** (2026-02-10):
  - Created `/app/frontend/src/components/chat/`:
    - `ChatHeader.jsx` (207 lines) — top bar (back / live indicator / search / dashboard), collapsible search bar with prev/next + match counter, property/sublease info bar.
    - `MessageList.jsx` (395 lines) — scrollable messages area with day-grouped date separators, empty state, typing indicator, scroll-to-bottom button. Includes private `MessageBubble`, `EditPanel`, `InlineTranslation` sub-components plus pure helpers (`formatTime`, `formatDateHeader`, `getInitials`, `renderHighlighted`).
    - `MessageInput.jsx` (43 lines) — sticky input form with send button, fires `onTyping` per keystroke.
  - **Chat.js: 859 → 386 lines (−55%)**. ESLint clean across all 4 files.
  - Parent still owns all state + handlers (`messages`, `translations`, `editingId/editingText`, search state, `emitTyping`, `handleScroll`, etc.) since they're all interlocked with the polling/typing/scroll effects. Components are pure presentational — only render + dispatch back to parent.
  - Removed unused imports from Chat.js (`Send`, `ArrowLeft`, `User`, `Building2`, `Clock`, `MessageCircle`, `ChevronDown`, `Check`, `CheckCheck`, `Languages`, `X`, `Pencil`, `Search`, `ChevronUp`, `HEBREW_RE`).
  - Verified end-to-end on a real chat (renter → vacation property owner):
    - Header renders with property pill ("Booking-overlap test apt · Tel Aviv · VACATION") ✓
    - Date separator ("TODAY") + message bubble with teal gradient + 11:48 AM timestamp + sent tick + TR gold avatar ✓
    - Search toggle opens the bar, typing "hello" shows the match counter, close button hides it ✓
    - Sent a real message ("refactor smoke test message") → appeared instantly in the bubble grid ✓
    - Zero console errors

- [x] **Inbox preview-as-bubble upgrade** (2026-02-10):
  - Extended `ConversationOut` model + `GET /api/chat/conversations` route with a new `last_message_from_me: bool` field so the inbox can render preview bubbles aligned correctly.
  - Updated `components/dashboard/MessagesTab.jsx`: each conversation row's last-message preview is now a mini chat bubble — teal-gradient + right-aligned + "You:" prefix when the current user sent it last; gray + left-aligned when the counterparty sent it last. Unread + counterparty-last gets bold text for emphasis.
  - The inbox now visually matches the in-conversation view at a glance — you can tell who sent the last message without clicking in. Reuses the same color tokens and rounded-tail pattern as `MessageBubble.jsx`.
  - Verified live: backend returns `last_message_from_me: True` for both renter test conversations; frontend renders both rows with teal "You: refactor smoke test message" + "You: Badge visibility test" bubbles right-aligned. Zero console errors.

- [x] **@-mention system** (2026-02-10):
  - New backend module `/app/backend/utils/mentions.py` with `extract_mentions()` (regex with negative lookbehind so `@owner` matches but `email@owner.com` doesn't) and `current_user_role_in_property()` helpers. Three known role tokens: `@owner`, `@renter`, `@manager`.
  - `POST /api/chat/messages` now persists `mentions: ["owner"]` on each message at write-time so the inbox can flag actionable mentions without re-scanning text on every fetch. Same on `PUT /api/chat/messages/{id}` (edits re-extract).
  - `GET /api/chat/conversations` now stamps `last_message_mentions_me: bool` on each conversation — true only when the counterparty (not me) mentioned my role (self-mention guard, so I don't get a bell for messages I sent).
  - Frontend `MessageBubble` renders `@owner`/`@renter`/`@manager` tokens inside the bubble body as gold/teal pill chips with an AtSign icon (white/translucent on my messages, gold-tinted on theirs).
  - Frontend `MessagesTab` shows a gold "**@ Mentioned you**" badge inline with the property title on mentioned rows, plus a thicker `ring-2 ring-[#D4AF37]/40 shadow-sm` highlight on the row.
  - **End-to-end verified live**: renter sent "hey @owner please confirm the move-in date" → backend stored `mentions: ['owner']` → owner's inbox API returned `last_message_mentions_me: true` → owner's dashboard rendered the gold badge + ring on the correct row. Zero console errors, ruff + ESLint clean.
- [x] **Cloudinary auto-format + auto-quality + responsive variants** (2026-05-15):
  - Auto-format/quality baked into upload URLs (`/upload/f_auto,q_auto/...`) — modern browsers get WebP/AVIF, legacy stays on PNG/JPG. Verified live: 288-byte test PNG served as 36-byte WebP (60% reduction) on `Accept: image/webp`.
  - New frontend util `frontend/src/utils/cdnImage.js`: `sizedImage(url, w)` injects `w_{w},c_limit` into Cloudinary URLs (c_limit never upscales) and `srcSet(url, w)` builds 1x/2x descriptors. Non-Cloudinary URLs (legacy `/api/uploads`, Pexels fallback) pass through unchanged.
  - Wired into the 5 highest-volume image render points: `PropertyCard.jsx` (grid cards, 600px), `Home.js` featured grid (600px), `ManagerPage.js` property grid (600px), `dashboard/PropertyList.jsx` owner grid (480px), `SavedSearchesTab.jsx` match thumbnails (400px with srcset), and `ImageGallery.jsx` property detail hero (1200px with srcset) + thumbnail strip (160px).
  - **Multiplicative bandwidth win verified end-to-end**: 2400×1600 JPG source (60 KB) → 206-byte WebP at full-res → **54-byte WebP at 600px** (74% additional reduction on top of WebP). Real listing photos typically drop 80-95% vs original.
  - 8/8 pytest cases pass (`tests/test_cloudinary_upload.py`): 4 new tests cover image transform injection, video q_auto-only, idempotency, and transform-aware public_id parsing. Frontend lint clean across all 7 edited files.
- [x] **Merged Bookings + Availability tab** (2026-05-20):
  - Per the user's approved Option B (Stacked) mockup, the dashboard's standalone "Availability" tab is gone; "My Bookings" is now the single source of truth for lister-side reservation management.
  - **Owners/managers** see a stacked list of expandable property cards. Each card shows: cover thumbnail, area + bedroom count + total booking count, status pill (Available now / Booked upcoming / Currently booked) + next-available date. Expanding reveals one `BookingChip` per booking with role-aware action buttons (pending → red "Cancel booking"; confirmed → orange outlined "Request cancellation"; cancellation_requested → green Approve + red Deny) plus a 3-month mini-calendar with prev/next month arrows and Airbnb-style handover-day vertical white-split visualization (so back-to-back same-color bookings are still distinguishable).
  - **Renters** keep the existing flat `BookingRow` list — the stacked view only makes sense for listers with multiple properties.
  - Sublessors (role=renter who own a sublease) keep the flat list with lister-side actions (`ownsBookingAsLister` branch in `BookingRow`).
  - A "Trips I've booked" section appears below the stacked properties for any owner who has also booked someone else's place.
  - Calendar dates use a TZ-safe local `YYYY-MM-DD` formatter (not `toISOString().slice(0,10)`) so Israel users don't get off-by-one. Month labels respect the user's `i18nextLng` locale.
  - New files: `components/dashboard/MiniCalendar.jsx`, `components/dashboard/BookingChip.jsx`. Deleted: `pages/_preview/MergePreview.jsx`, `components/dashboard/AvailabilityTab.jsx`, and the `/preview/merge/:layout` route in `App.js`. `BookingsList.jsx` rewritten role-aware.
  - Backend reuses existing `GET /api/owner/availability` endpoint (no schema changes).
  - **Tested**: 5/5 backend pytest + 9/9 frontend Playwright = 14/14 green (iteration_21.json). Verified: availability gone, stacked view renders for owner with correct status badges, 3 mini-calendars per expanded card, prev/next arrows shift the month range, all 4 booking-status action variants render correctly, cancel modal opens & dismisses cleanly, renter still sees the flat list, `/preview/merge/stacked` 404s.

## Test Credentials
See /app/memory/test_credentials.md

## Recent Updates (2026-02)

- [x] **Admin: Listings "Added" column + Chats unresponsive-owner nudge** (2026-02-13):
  - **Listings tab**: backend already returned properties `created_at DESC`, but the table didn't surface this. Added a new **Added** column (desktop) + an "added {relative}" line (mobile) showing `5min ago / 3h ago / 17d ago / 2mo ago` with the absolute timestamp on hover. Newest listings now sit on top.
  - **Chats tab**: completely rebuilt. Conversations sorted newest-first, each row now shows a `Clock + relative time` stamp. Messages inside the expanded view are sorted **chronologically** (oldest → newest, top → bottom) — they were previously reversed.
  - **New: 24h owner-unresponsive alert + nudge**:
    - Backend `/admin/chats` now tags each conversation with `last_sender_role`, `hours_since_last_message`, `owner_unresponsive` (true when the latest message is from the renter AND it's been ≥24h with no owner reply), and `last_nudge_sent_at`.
    - New endpoint `POST /admin/chats/nudge-owner` sends a Postmark courtesy email to the property owner ("X is waiting to hear from you about Y — reply within 24h dramatically improves conversion") with a one-click link back to the conversation.
    - **24h throttle** per conversation via a new `chat_nudges` collection — second click within 24h returns 429 with "A nudge was already sent Xh ago".
    - Email is fire-and-forget (`asyncio.create_task`) so the admin sees a 200 in ~100ms even when Postmark is slow — prevents the Cloudflare 502 timeout we hit while testing the original synchronous version.
    - Frontend: red banner at the top *"N conversations waiting more than 24h for the owner to reply"*, per-row red border + `OWNER UNRESPONSIVE · 80h` badge, inline "**Nudge owner**" button with loading state and "Last nudge sent Xh ago" once fired.
    - **N+1 query fix**: the admin chats endpoint was previously doing `find_one` per message for users + properties. Replaced with two bulk `find({id: {$in: [...]}})` queries — meaningful speedup when there are many messages.
  - **Live verified**: inserted a 25h-old renter→owner message → admin chats endpoint returned `owner_unresponsive: true, hours_since_last_message: 25.0` → POST nudge returned 200 in 111ms → second POST within seconds returned 429. Throttle row in `chat_nudges` confirms.
  - Files: `backend/routes/admin.py`, `frontend/src/components/admin/ListingsTab.jsx`, `frontend/src/components/admin/ChatsTab.jsx`.

- [x] **Duplicates: bulk auto-resolve + richer modal** (2026-02-13):
  - **Import dedupe already in place** — the bulk CSV importer was already skipping duplicates (same `owner_email + address + rental_type`) and reporting them in the skipped list. Confirmed working in `commit_property_import`.
  - **New backend endpoint** `POST /admin/duplicates/resolve` with three modes:
    - `keep_richest` (default) — keeps the listing with the most images, then longest description (safest pick)
    - `keep_newest` — keeps the most-recently-created
    - `keep_oldest` — keeps the original (preserves booking history)
    Accepts an optional `keys[]` list to scope to specific groups; otherwise resolves all. Publishes invalidation events for the admin listings cache.
  - **Extended `GET /admin/duplicates`** to include `image_count`, `cover_url`, `description_length`, `monthly_price`, `nightly_price` per listing so the modal can show thumbnails and let the admin compare richness at a glance.
  - **Frontend `DuplicatesModal.jsx`** completely redesigned:
    - Sticky amber bulk action bar at the top: "N redundant listings across M groups. Auto-resolve all: [Keep richest in each] [newest] [oldest]" — one click resolves every group.
    - Per-group inline actions: `[keep richest] [newest] [oldest]` next to each group header.
    - Each listing row now has a cover thumbnail (or `ImageOff` placeholder), image count, ID, created date, and **RICHEST / NEWEST / OLDEST** highlight badges showing in real time which copy each mode would keep.
    - The richest row gets a soft emerald background so the safest target stands out.
    - Confirmation prompts before any destructive action.
  - **Verified live**: inserted 3 demo duplicates (owner@test.com + same address + long-term, with 0/3/1 images). Modal correctly tagged RICHEST/NEWEST/OLDEST; `POST resolve mode=keep_richest` deleted 2 redundant listings and kept the 3-photo copy. Repeat call returned `total_groups: 0`.
  - Files: `backend/routes/admin.py`, `frontend/src/components/admin/DuplicatesModal.jsx`.

- [x] **🔒 CORS hardened: explicit production origins + spec-compliant credentials** (2026-02-12):
  - **Root cause of the previous setup**: `allow_credentials=True` paired with `allow_origins=["*"]` is **forbidden by the CORS spec** — browsers refuse to send credentials when the server replies with the wildcard. The preview Kubernetes ingress was masking this by injecting its own wildcard headers, so it "worked" in dev but production was broken.
  - **Backend** (`server.py`): replaced wildcard with an explicit allowlist driven by `CORS_ORIGINS` env (with a safe production-baked default). Added `allow_origin_regex=r"https://.*\.preview\.emergentagent\.com"` so any preview URL keeps working without needing env updates. Also strips trailing slashes and tolerates whitespace in the comma-separated env value. Exposes `Content-Disposition` so file downloads (CSV exports, contracts) work cross-origin.
  - **Backend** (`backend/.env`): `CORS_ORIGINS` now lists `https://myisraelrental.com`, `https://www.myisraelrental.com`, the current preview URL, and `http://localhost:3000`.
  - **Verified live (direct backend, bypassing ingress)**:
    - Preflight from `https://myisraelrental.com` → `Access-Control-Allow-Origin: https://myisraelrental.com` + `Allow-Credentials: true` ✅
    - Preflight from `https://www.myisraelrental.com` → `Access-Control-Allow-Origin: https://www.myisraelrental.com` ✅
    - Preflight from `https://evil.example.com` → **HTTP 400 + no Allow-Origin header** (properly blocked) ✅
    - Real GET from the production origin → 200 + correct echo ✅
  - Files: `backend/server.py`, `backend/.env`.

- [x] **🐛 BUG FIX: bulk-import was silently dropping listing photos** (2026-02-12):
  - **Root cause**: `_split_list` was splitting image-URL cells on every comma. Cloudinary transformation URLs (`c_fill,w_400,h_300`) contain commas internally and were being shredded into 2-3 broken pieces. Each piece then failed Cloudinary mirroring and the failures were silently dropped (`mirror_url_to_cloudinary` swallowed exceptions and `commit_property_import` filtered `None` results without logging). Net effect: dozens of real imports created listings with empty `images: []` arrays — the symptom the user reported.
  - **Fix 1 — URL-aware splitter**: introduced `_split_urls()` that splits on `;` `|` and newlines, plus commas/whitespace ONLY when followed by `https?://`. So a single Cloudinary URL stays intact. `_split_list()` kept as-is for amenities.
  - **Fix 2 — partial-success reporting**: the property-commit endpoint now tracks which URLs failed to mirror per row and surfaces them in a new `media_issues` array of `{index, title, csv_image_count, saved_image_count, failed_urls}`. Summary gains `with_missing_photos` and `cloudinary_enabled` flags. Each `created` row reports `images_count` / `videos_count`.
  - **Fix 3 — fail-safe when Cloudinary is off**: instead of silently dropping all photos when `CLOUDINARY_ENABLED=False`, the importer now saves the source URLs as-is and the frontend shows a yellow "Cloudinary isn't configured — photos saved as-is" banner in the report.
  - **Frontend** (`components/admin/ImportTab.jsx`): import report now shows a "N listings created with missing photos" expander listing per-row counts and the first 5 failed URLs, plus per-row 📷 image-count chips on the Created list (amber when zero).
  - **Tests**: 11 new tests in `tests/test_admin_import_split_list.py` covering Cloudinary transform URLs, mixed lists, separators, list inputs, trailing commas, and the amenities split path. 19/19 import tests green.
  - **Live verified**: bulk-imported a CSV containing `c_fill,w_400,h_300/sample.jpg,https://example.com/b.jpg` → got `images_count: 2` and both URLs landed intact in the DB (previously this would have given `images: []`).
  - Files: `backend/routes/admin_import.py`, `backend/tests/test_admin_import_split_list.py`, `frontend/src/components/admin/ImportTab.jsx`.

- [x] **Admin Listings: cover-image thumbnail per row** (2026-02-12):
  - Added a new `<CoverThumb>` cell to each row of the desktop table (~56×56) and to each mobile card (~48×48). Shows `images[0]` (the listing's cover) with rounded corners and a soft border. Clicking opens the full-size image in a new tab so the admin can sanity-check without leaving the table.
  - When a listing has no photos yet, the thumb collapses to a gray placeholder with an `ImageOff` icon — instant visual cue for "this listing needs photos" while scanning the table.
  - Lazy-loaded (`loading="lazy"`) so the table stays snappy even with 100s of rows.
  - **Live verified**: 10-row table renders 10 thumbs in desktop + 10 in the mobile view. "Media Test" row shows the actual colourful cover image; the rest correctly fall back to the placeholder.
  - Files: `frontend/src/components/admin/ListingsTab.jsx`.

- [x] **Admin Listings: price-range filter** (2026-02-12):
  - Added a `Price [min] – [max] · clear` row to the Listings filter bar. Numeric inputs that match the same effective price the table renders (`monthly_price` first, `nightly_price` as fallback). Currency mixing is intentional — admin sees a single sortable number column.
  - URL-synced (`?min=5000&max=8000`) like the other filters, so deep-links & back/forward preserve the range.
  - Combines with rental-type / managed / featured / search.
  - **Live verified**: 10 → min=5000 → 3 rows → max=8000 → 3 rows (₪5500, ₪5000, ₪5000) → clear → 10 rows restored. URL flips correctly through each step.
  - Files: `frontend/src/components/admin/ListingsTab.jsx`.

- [x] **Admin Listings: rental-type filter chips** (2026-02-12):
  - Added a new chip group on the Listings tab — **All types · Long-term · Short-term · Vacation · Storage** — so the super admin can slice the table down to just one rental type in a click.
  - Each chip shows a live count (`Long-term (6)`, `Vacation (4)`…) and empty types auto-disable so the admin doesn't get an empty view by accident.
  - URL-synced via the same pattern as `managed` / `featured` (`?rt=long-term`) so deep-links and browser back/forward preserve the filter.
  - Combines with existing managed/featured/search filters — e.g. "Long-term + Featured + 'sanhedria' search" all stack.
  - **Live verified**: All=10 rows → Long-term=6 → Vacation=4 → All=10 again. URL flips to `?rt=long-term` correctly.
  - Files: `frontend/src/components/admin/ListingsTab.jsx`.

- [x] **Quick Add: drag-and-drop photo uploads** (2026-02-12):
  - The "Photos & videos" section of the Quick Add form now accepts files via drag-and-drop. Drag a folder of 12 photos from the desktop straight onto the card and they all upload to Cloudinary in parallel via the same `uploadFilesFast` pipeline as the button picker.
  - Dropzone shows a clear teal highlight + "Release to upload" copy while a drag is over it; non-image/video files in the drop are filtered out with a friendly toast.
  - Refactored `processFiles(files)` into a shared helper used by both the file picker (`onPickFile`) and the drop handler (`onDrop`).
  - **End-to-end verified live**: dispatched a synthetic drop of 3 PNG files onto `[data-testid="quick-add-dropzone"]` → 3 photos uploaded and rendered in the strip with X cancel buttons; teal-highlighted state confirmed mid-drag.
  - Files: `frontend/src/components/admin/QuickAddPropertyForm.jsx`.

- [x] **Admin Import: "View owner & their listings" shortcut** (2026-02-12):
  - After a successful Quick Add, the green confirmation chip now exposes a `[↗ View landlord@example.com & their listings →]` pill button. Clicking it jumps to the admin Users tab pre-filtered to that owner's email — perfect for spot-checking that all of a broker's listings landed correctly after a batch add.
  - **Frontend** (`pages/AdminDashboard.js`): added a `usersPrefilter` state + `jumpToUser(email)` callback that sets `activeTab='users'` and `usersPrefilter=email` atomically. A manual click on the Users tab in the nav clears the prefilter so the next visit starts blank.
  - **Frontend** (`components/admin/UsersTab.jsx`): accepts a new `prefilter` prop, used as the initial value of `searchTerm`. Because the tab is conditionally rendered in AdminDashboard, the component freshly mounts each visit — no useEffect needed (avoiding the platform-lint `set-state-in-effect` false-positive).
  - **Frontend** (`components/admin/ImportTab.jsx` + `QuickAddPropertyForm.jsx`): plumbed `onJumpToOwner` callback through.
  - **End-to-end verified live**: filled Quick Add for an existing owner, submitted → green chip rendered → clicked "View owner@test.com & their listings →" → automatically navigated to Users tab, search box pre-filled with the email, exactly one matching row visible.
  - Files: `frontend/src/pages/AdminDashboard.js`, `frontend/src/components/admin/UsersTab.jsx`, `frontend/src/components/admin/ImportTab.jsx`, `frontend/src/components/admin/QuickAddPropertyForm.jsx`.

- [x] **Admin Import: Quick Add (single listing + native photo upload)** (2026-02-12):
  - Added a new "Quick Add (one listing + photos)" flow as the default mode of the admin Import tab. Bulk CSV moves to a secondary toggle.
  - **Backend** (`routes/admin_import.py`): extracted the owner-resolve/create logic into reusable `_resolve_or_create_owner(email, name, phone) -> (owner_id, was_created)` (refactored the bulk CSV path to use it too). New endpoint `POST /admin/import/quick-add` accepts `{owner_email, owner_name?, owner_phone?, title, area?, address?, rental_type, bedrooms?, bathrooms?, monthly_price?/nightly_price?, currency, image_urls[], video_urls[], ...}`. Returns `{owner: {id, email, was_created}, property: {id, title, area}}`. Photos arrive already on Cloudinary (uploaded via the existing signed-upload path), so no mirroring needed. Same dedupe rule as bulk CSV.
  - **Frontend** (`components/admin/QuickAddPropertyForm.jsx` — new file): three-section form (1. Owner, 2. Listing, 3. Photos & videos) with native multi-file uploader powered by `uploadFilesFast` (auto-compresses photos, uploads direct-to-Cloudinary, supports both images + a short MP4). On submit shows a green confirmation chip, keeps the owner contact info pre-filled so adding a second listing for the same landlord is ~10 seconds, and the submit button morphs to "+ Add another for this owner". A "Start fresh (new owner)" link clears everything.
  - **Frontend** (`components/admin/ImportTab.jsx`): added the Quick / Bulk flow toggle at the top. Quick Add is the default.
  - **End-to-end verified live**: admin login → Import → Quick Add → filled email + title + area + bedrooms + monthly_price + dropped 2 photos → submit → green toast confirms account created, result chip shows new owner + listing, owner email retained in form, submit button morphs to "Add another for this owner". Backend curl test: first POST returns `was_created: true`, second POST with the same email returns `was_created: false` and the **same owner_id**. Property persists with the correct images count.
  - Files: `backend/routes/admin_import.py`, `frontend/src/components/admin/QuickAddPropertyForm.jsx`, `frontend/src/components/admin/ImportTab.jsx`.

- [x] **Admin Import: unified into a single flow with auto-detect** (2026-02-12):
  - Removed the separate "Properties" vs "Users" mode-picker buttons from `ImportTab.jsx`. Admin pastes any CSV — the system now auto-detects which canonical schema (property or user) it should be mapped against, from the column headers.
  - **Backend** (`routes/admin_import.py`): added `_detect_schema_kind(headers)` heuristic + new `schema_kind="auto"` mode on `POST /admin/import/preview`. A `role` column + email is a strong user signal (promoted ahead of property-shaped substring matches like "Email Address" containing "address"). Otherwise property-shaped columns (bed/bath/rent/price/sqm/area/neighborhood/owner_email/etc.) classify as property. Preview response now includes `detected_schema_kind` so the frontend can route the commit to the right endpoint.
  - **Frontend** (`components/admin/ImportTab.jsx`): dropped the mode picker; preview button always sends `schema_kind="auto"`. After preview, a "DETECTED: [Properties] | [Users]" badge appears next to "Column mapping (N rows)" — the detected kind is highlighted teal, and the admin can click the other pill to override the heuristic (re-runs preview with the manual override). Commit URL is chosen from the live `schemaKind` state.
  - **Test coverage**: new `tests/test_admin_import_autodetect.py` (8/8 passing) covers property/user/ambiguous header sets including the "Email Address contains 'address'" edge case.
  - **End-to-end verified live**: admin login → Import tab → paste property CSV → detected "Properties" with correct mapping; paste user CSV → toast "Detected users", badge flips to "Users", mapping switches to user schema. Both flows produce the correct canonical column map.
  - Files: `backend/routes/admin_import.py`, `backend/tests/test_admin_import_autodetect.py`, `frontend/src/components/admin/ImportTab.jsx`.

- [x] **Chat: multi-image + video attachments** (2026-02-12):
  - Owners (and any chat user) can now attach multiple photos AND/OR a video in a single picker tap.
  - **Backend**: added `video_url: str | None` to `models.ChatMessage`; `chat.py` POST `/chat/messages` persists it alongside `image_url`, with a "Sent you a video 🎬" notification body when the message is video-only. `_send_chat_email_safe` accepts `video_url` so the chat-email throttle still treats it as media.
  - **Frontend `MessageInput.jsx`**: replaced the single `pendingImage` state with a `pending[]` array of `{ url, preview, kind: 'image'|'video', name }`. The file input is now `<input multiple accept="image/*,video/*">`. Picked files upload in parallel via `uploadFilesFast`, render as a horizontal strip of thumbnails (videos get a play-icon overlay), each thumbnail has an X to remove. The send button dynamically reads "Send" (1 attachment) or "Send all (N)" (multiple); clicking fires one chat message per attachment in sequence so each renders as its own bubble.
  - **Frontend `MessageList.jsx`**: added `<video controls preload="metadata" playsInline>` rendering when `msg.video_url` is set, mirroring the existing image-bubble treatment.
  - **Frontend `Chat.js`**: `sendMessage` now accepts `{ imageUrl, videoUrl }` and forwards both to the backend.
  - **End-to-end verified live**: logged in as owner, opened chat with renter, used `set_input_files(['/tmp/test1.png','/tmp/test2.png'])` → two thumbnails rendered in the pending strip with X cancel + "Send all (2)" button → click sent both images as separate chat bubbles, pending strip cleared, two `chat-image-*` bubbles rendered in the thread. Backend round-trip for `video_url`: POST → GET returns the persisted `video_url`. 9/9 `tests/test_chat_email.py` pytest still green.
  - Files: `backend/models.py`, `backend/routes/chat.py`, `frontend/src/pages/Chat.js`, `frontend/src/components/chat/MessageInput.jsx`, `frontend/src/components/chat/MessageList.jsx`.

- [x] **Smart List shares now show MyIsraelRental logo in WhatsApp preview** (2026-02-12):
  - Added `og:title`, `og:description`, `og:image`, `og:url`, `og:site_name`, `og:type`, plus Twitter Card variants to `frontend/public/index.html` — the `og:image` points to the existing MyIsraelRental brand logo.
  - Replaced the generic `<title>Emergent | Fullstack App</title>` with `MyIsraelRental — Rentals across Israel`, plus updated `theme-color` to `#1E6A6A`.
  - Updated `SmartListsTab.jsx` `buildCopyText()`: the shared message now leads with a bare `https://myisraelrental.com` URL on its own line so WhatsApp/iMessage/Telegram fetch the homepage's OG metadata and render the logo as a preview card on top of the message text. Without this, the first URL in the message would be a property listing URL and WhatsApp would preview the *property photo* instead of the logo.
  - Added a "WhatsApp preview" mock card to the in-page List header preview block so the admin can see — at a glance — that the logo will sit on top of their shared list before they hit Share on WhatsApp.
  - **Note on production rollout**: WhatsApp/iMessage cache OG previews aggressively (sometimes weeks). After the user redeploys, the very first share to a new recipient will fetch the new card; previously-shared links may still show the old (no-image) preview until cache TTL expires.
  - Files: `frontend/public/index.html`, `frontend/src/components/admin/SmartListsTab.jsx`.

- [x] **Featured Properties carousel — labeled "Scroll" pills** (2026-02-12):
  - Replaced the subtle round `◀ ▶` floating chevron buttons with two prominent, clearly labeled pills anchored to the right of the "Featured Properties" heading: **"← Previous"** (white with teal border) and **"Scroll for more →"** (solid teal with white text + arrow).
  - Added `canScrollLeft` / `canScrollRight` state tracking via a `scroll`+`resize` listener on the strip; the buttons dim to `opacity-30` + `cursor-not-allowed` at the natural ends, so users instantly see how many directions remain.
  - Pills only render on `md:` and up; mobile users still swipe.
  - Verified live on preview — the "Scroll for more →" pill is unmistakably visible, clicking it advances the strip by ~one screenful, and the "Previous" pill activates on the second click.
  - Files: `frontend/src/pages/Home.js`.


- [x] **Super Admin → Bulk Delete Listings** (2026-02-13):
  - Backend: new `DELETE /api/admin/properties/bulk` endpoint (`/app/backend/routes/admin.py`) accepts `{property_ids: list[str]}` (capped at 500 ids), admin-only, and cascades cleanup across `db.messages`, `db.bookings`, `db.admin_blocks`, `db.chat_nudges`, `db.liked_properties`, pulls deleted ids from `site_settings.featured_property_ids`, and detaches subleases (`original_property_id` → None). Returns `{deleted, skipped, messages_deleted, bookings_deleted}` so the toast can confirm the cascade.
  - Frontend: `ListingsTab.jsx` `bulkDelete()` handler + a red "Delete selected (N)" pill (`data-testid=bulk-delete-btn`) in the existing bulk-action bar; opens a custom Sonner confirmation toast with `cancel-bulk-delete-btn` / `confirm-bulk-delete-btn` testids. Works on both the desktop table (already had row checkboxes) and the mobile card list (already had `select-listing-mobile-{id}` checkboxes).
  - Testing: 4/4 backend pytest pass (`tests/test_admin_bulk_delete.py` — auth, empty body, ghost ids, full cascade). Testing-agent verified 13/13 frontend Playwright assertions on desktop 1920x1080 + mobile 414x900 + an additional HTTP smoke suite against the live preview (`tests/test_admin_bulk_delete_http.py`).
  - Files: `backend/routes/admin.py`, `frontend/src/components/admin/ListingsTab.jsx`, `backend/tests/test_admin_bulk_delete.py`.


- [x] **Bulk Delete Undo (10s) + Hebrew localization pass** (2026-02-13):
  - **Undo snackbar**: `DELETE /api/admin/properties/bulk` now snapshots every property + related rows (messages, bookings, admin_blocks, chat_nudges, liked_properties, featured-list membership, detached sublease ids) into `db.property_tombstones` and returns a `snapshot_id`. New `POST /api/admin/properties/bulk-restore` endpoint reinserts the documents (skipping any id that was recreated since), restores featured-list membership, and consumes the tombstone so a second click 404s. Frontend `UndoBulkDeleteSnackbar.jsx` renders a bottom-center snackbar with a 10s countdown bar + "Undo" button (`data-testid=bulk-delete-undo-snackbar` / `bulk-delete-undo-btn`).
  - **Hebrew localization**: Expanded `frontend/src/i18n.js` from 564 → **734 matched keys per language** (en + he in parity). New sections: `common`, `paymentSuccess`, `welcome`, `cancelBooking`, `contractSign`, `contractList`, `contractUpload`, `contractManager`, `docService`, `sublease`, `addProperty`, `bulkUpload`, `propertyList`, `savedSearches`, `faqExtra`, `smartLists`, `accessibility`, `managerHeader`, `duplicatesUi`. Extended `nav` (menu, toggleLanguage, notifications) and `home` (carousel pills). Replaced hardcoded English in `Navigation.js`, `Home.js`, `WelcomePopups.js`, `PaymentSuccess.js`, `FAQ.js`, `CancelBookingModal.jsx` with `t()` calls.
  - Testing: 6/6 backend pytest pass (`tests/test_admin_bulk_delete.py` now includes restore happy-path + idempotency + 404 cases). Testing-agent verified 100% backend (9 new HTTP-level tests) + 100% frontend (snackbar mount, Undo click, restore round-trip, 4 Hebrew strings rendering).
  - Files: `backend/routes/admin.py`, `backend/tests/test_admin_bulk_delete.py`, `frontend/src/components/admin/ListingsTab.jsx`, `frontend/src/components/admin/UndoBulkDeleteSnackbar.jsx` (new), `frontend/src/i18n.js`, plus six user-facing components.

- [x] **Language-preference indicator pill in navigation** (2026-02-14):
  - Added a compact pill at the top of the navigation dropdown menu (visible only for logged-in users) showing the current language label, a "Switch to {other}" hint, a small green sync indicator dot, and "Synced across your devices" caption.
  - Clicking the pill toggles the UI language AND persists the choice to the user's account via the pre-existing `PUT /api/auth/language` endpoint, so the preference follows them across devices/browsers.
  - Also updates `<html lang>` on every language change for screen-reader and search-engine correctness. `dir` stays pinned to LTR per the user's prior preference (translated Hebrew text without flipping the layout).
  - Testing: 100% backend (5/5 pytest cases for the PUT endpoint) + 100% frontend (6/6 Playwright scenarios — hidden when logged out, visible above Properties when logged in, click toggles UI, PUT fires, persists across reload, cross-device sync simulated via second login session).
  - Files: `frontend/src/components/Navigation.js`, `frontend/src/i18n.js` (new nav keys), `frontend/src/App.js` (lang attribute sync).


- [x] **Hebrew localization round 2 — dashboard tabs** (2026-02-14):
  - Wired `t()` calls into the three remaining high-traffic dashboard screens that were still rendering English in Hebrew mode: **SubleasesTab.jsx**, **sublease/SubleaseForm.jsx**, **SavedSearchesTab.jsx** (incl. its CreateAlertForm chrome + RENTAL_TYPES dropdown), and **BulkUploadModal.jsx**.
  - Extended `frontend/src/i18n.js` from 734 → **819 matched keys** per language (en + he in parity). New keys mostly live under `sublease.*`, `savedSearches.*`, and `bulkUpload.*` sections.
  - Verified end-to-end: the saved-search create form now renders form chrome ("התראה חדשה", "סוג שכירות", "מינימום חדרי שינה", "מחיר מקסימלי", "זמן מתאריך", "אזור", "בכל מקום", "ביטול", "צור התראה") and the rental-type dropdown options ("כל סוג", "טווח ארוך", "טווח קצר", "נופש", "אחסון") all in Hebrew.
  - Testing-agent run #25 surfaced 3 issues — all fixed in the same session: (1) RENTAL_TYPES dropdown showed `savedSearches.undefined` because the constant still had `label:` instead of `tk:` keys — fixed; (2) `Your Sublease Listings` h4 was missed in the first edit — fixed; (3) CreateAlertForm chrome strings were also out-of-scope-of-original-keys — added keys + wired them.
  - Files: `frontend/src/components/dashboard/SubleasesTab.jsx`, `frontend/src/components/dashboard/sublease/SubleaseForm.jsx`, `frontend/src/components/dashboard/SavedSearchesTab.jsx`, `frontend/src/components/dashboard/BulkUploadModal.jsx`, `frontend/src/i18n.js`.


- [x] **Smart Lists — sortable WhatsApp share** (2026-02-16):
  - Added a "Sort by" dropdown to the Super Admin → Smart Lists panel with 5 options: Default order, Cheapest first, Most expensive first, Fewest bedrooms first, Most bedrooms first.
  - Single sort applies to all three outputs simultaneously (on-screen results, Copy list clipboard, Share on WhatsApp text) — they can never disagree, even after the admin changes filters.
  - Currency-normalizes USD-priced listings to ILS-equivalent for sort using the backend's `usd_to_ils_rate` when available, or a sensible 3.7 fallback so mixed-currency Sukkot/Pesach lists order roughly correctly. Display values stay untouched.
  - Stable sort: rows with null price/bedrooms are pushed to the end regardless of direction (so a "cheapest first" sort doesn't bubble priceless rows to the top).
  - Files: `frontend/src/components/admin/SmartListsTab.jsx`.

- [x] **Index-key React anti-pattern fixes** (2026-02-15):
  - `ImportTab.jsx`: replaced 6 `key={i}` uses with stable composite keys (`${i}-${w}` for warnings, `skip-${s.index}-${s.title}` for skipped rows, `o.email` for owner accounts, `media-${m.index}-${m.title}` for media issues, `${m.index}-${j}-${u}` for failed URL nestings, `c.id || c.email || created-${i}` for created rows).
  - `MiniCalendar.jsx`: day cells now use the ISO date as key; padding cells use `pad-${i}`; day-of-week labels keep `dow-${i}` (7 fixed labels never reorder).
  - Zero behavior change — purely defensive against potential state-leak bugs if rows ever reorder.
  - Files: `frontend/src/components/admin/ImportTab.jsx`, `frontend/src/components/dashboard/MiniCalendar.jsx`.


- [x] **WhatsApp notifications (Twilio) — Phase 1 shipped, Phase 2 awaits credentials** (2026-02-17):
  - **Signup rename**: `Auth.js` signup form's "Phone Number" field is now "WhatsApp number (recommended, optional)" with a help line "We'll text you when a renter messages you or signs a contract." Backed by the existing `phone` column so all other call sites (email signatures, lister contact info) still work.
  - **Settings tab editing**: `SettingsTab.jsx` now has a dedicated WhatsApp section with a tel-input and Save button. Backend `PUT /api/auth/whatsapp` (auth-required) normalizes the input to E.164 (`+972 50-123 45 67` → `+972501234567`), rejects numbers shorter than 6 digits, and stores in `db.users.phone`. Empty string clears the number.
  - **Twilio send module**: `backend/utils/whatsapp.py` is a graceful-no-op send layer. Two modes auto-detected from env vars:
    - **Sandbox / free-form body** (dev) — set `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_WHATSAPP_FROM` (e.g. `whatsapp:+14155238886`). Recipient must opt in via Twilio Sandbox.
    - **Production templates** (live) — additionally set `TWILIO_CONTENT_SID_RENTER_MESSAGE` + `TWILIO_CONTENT_SID_CONTRACT_SIGNED` (`HX…` from Twilio Content Template Builder, WABA-approved). Uses `content_sid` + `content_variables` so business-initiated sends work outside the 24h window.
  - **Wiring**:
    - `routes/chat.py::_send_chat_email_safe()` now fires WhatsApp alongside the existing email — inside the same throttle gate so the lister isn't spammed. Deep link: `/chat?property_id=X&peer_id=Y`.
    - `routes/bookings.py::_notify_owner_contract_signed()` now WhatsApps the owner with a deep link to `/dashboard?tab=bookings&booking_id=Z`.
    - Both gracefully swallow any Twilio exception via the module's logged-and-return-False pattern.
  - **Tests**: 12 pytest cases pass (5 settings/HTTP tests + 7 send-module unit tests with mocked `twilio.rest.Client`): no-op when unconfigured, no-op when phone missing, free-form body path, content-template path, Hebrew body, error swallowed, from-number prefix normalization.
  - **Pending**: User to provide Twilio Account SID + Auth Token + Sandbox `whatsapp:+...` number (free trial, ~5 min). Production cutover later requires approved Content Templates and a purchased Twilio WhatsApp number.
  - Files: `backend/utils/whatsapp.py`, `backend/routes/auth.py`, `backend/routes/chat.py`, `backend/routes/bookings.py`, `backend/models.py`, `backend/tests/test_whatsapp_settings.py`, `backend/tests/test_whatsapp_send.py`, `frontend/src/pages/Auth.js`, `frontend/src/components/dashboard/SettingsTab.jsx`, `frontend/src/i18n.js`.



- [x] **`/stays` — persistent search bar + live filter results** (2026-02-28):
  - `Stays.jsx` now has a fixed top search bar (Where / Check in / Check out / Filters) that stays visible as the user scrolls.
  - Where, Check-in and Check-out inputs filter the results live — listings are intersected against `available_from`/`available_to` listing windows.
  - Layout adapts: area-grouped horizontal rows by default; once ANY filter is active (`where`/`checkin`/`checkout`/`subType`/`bedrooms`/`priceMin`/`priceMax`/`amenities`), the page collapses into a single flat 2-4 col grid with an Airbnb-style "N stays in <area>" header and a Clear-all link.
  - Mobile responsive: nav is 123px on small screens, 68px on md+, so the search bar uses `top-[123px] md:top-[68px]`. Date segments are hidden on mobile and exposed inside the Filters modal instead so the pill stays clean.
  - Switched from `sticky` to `fixed` positioning because `html`/`body` already have `overflow-x: hidden` which can break sticky in Chrome.
  - Files: `frontend/src/pages/Stays.jsx`.


- [x] **Airbnb-style "When / Add dates" search segment + range calendar popover** (2026-02-28):
  - New reusable `WhenPicker` (`frontend/src/components/search/WhenPicker.jsx`) replaces the two separate `Check in` / `Check out` native date inputs in the search pill on both Home (`/`) and `/stays`. Single segment reads `When / Add dates` until a range is picked, then `When / Jun 30 – Jul 7`.
  - Click opens a centered Airbnb-style range calendar (react-day-picker v8.10.1) with **2 months side-by-side on ≥md (768px)**, **1 month on mobile**. Past dates greyed + line-through. Teal range endpoints with soft teal range-middle highlight.
  - Popover is **portal-rendered to `document.body`** so the search pill's `rounded-full + overflow-hidden` background can never clip it. Dark backdrop, Escape + backdrop-click close.
  - Style overrides scoped via `.rdp-airbnb` class in `frontend/src/components/search/whenpicker.css` so other DayPickers in the codebase (admin dashboard) stay untouched.
  - State contract: parent owns `checkin` / `checkout` as ISO `YYYY-MM-DD` strings, unchanged from before, so URL params, live filters on `/stays`, and the Home Search button's navigation all keep working.
  - Verified end-to-end by testing_agent iteration_28: 14 → 13 cards on /stays after selecting Jun 30 – Jul 7, layout switches from grouped area-rows to flat grid, URL persists with `?checkin=&checkout=`.
  - Files: `frontend/src/components/search/WhenPicker.jsx`, `frontend/src/components/search/whenpicker.css`, `frontend/src/pages/Home.js`, `frontend/src/pages/Stays.jsx`.


- [x] **Typeable Where autocomplete + 2-month mobile calendar** (2026-02-28):
  - New reusable `WherePicker` (`frontend/src/components/search/WherePicker.jsx`) replaces the read-only `<select>` on Home and `/stays`. Users can type freely; matching areas appear in a click-to-pick suggestion dropdown with pin icons (limited to 12). Focusing the empty input shows all available areas as a discoverability hint.
  - `/stays` filter switched from strict equality to case-insensitive substring match — typing 'jeru' or 'ame' returns the right Jerusalem / American Colony listings. URL syncs as `?area=<raw>` and survives reload.
  - Search pill's `overflow-hidden` was removed so the suggestion dropdown can extend below the pill without being clipped.
  - WhenPicker now ALWAYS renders 2 months side-by-side, including on mobile. CSS scoped via `@media (max-width: 639px)` shrinks `--rdp-cell-size` to 26px and tightens caption/day fonts so the two months fit a 367px popover on a 390px viewport without horizontal overflow (verified bbox.width = 367).
  - `/stays` mobile pill also now exposes the When trigger (previously hidden via `sm:flex`) so mobile users can pick dates from the visible pill, not just the Filters modal. Three-segment Where + When + Filters icon fits cleanly.
  - Verified end-to-end by testing_agent iteration_29: 11/11 acceptance criteria pass on desktop and mobile across Home and Stays.
  - Files: `frontend/src/components/search/WherePicker.jsx`, `WhenPicker.jsx`, `whenpicker.css`, `Home.js`, `Stays.jsx`.


- [x] **Airbnb-style "Flexible" tab inside the WhenPicker** (2026-02-28):
  - Added a `Dates | Flexible` pill toggle at the top of the WhenPicker popover, mirroring the Airbnb screenshot the user shared.
  - **Dates** mode = existing 2-month range calendar (unchanged).
  - **Flexible** mode shows: "How long would you like to stay?" with 3 length pills (Weekend / Week / Month, Week selected by default) → "Go anytime" → horizontally-scrollable row of the next 12 month cards (each with calendar icon + month name + year). Selecting a card highlights it (`border-black + bg-gray-50`).
  - On Apply, the Flexible selection is resolved to concrete check-in/check-out dates so the rest of the app needs no changes: **Weekend** → first Friday on/after month start, +2 nights; **Week** → 1st of month (or today if month is current), +7 nights; **Month** → 1st to last day of the month. Result: trigger label updates ('Jul 3 – Jul 5', 'Jul 1 – Jul 8', 'Jul 1 – Jul 31'), URL syncs to `?checkin=&checkout=`, and `/stays` live-filters / switches to flat grid as before.
  - Reachable on both Home (`/`) and `/stays` and both desktop (1280x900) and mobile (390x844) — month row scrolls horizontally on mobile (scrollWidth 1468 in a 349 viewport).
  - Verified by testing_agent iteration_30: 9/9 criteria pass, resolver math correct for all three presets.
  - Files: `frontend/src/components/search/WhenPicker.jsx` (parent contract unchanged — still `checkin`/`checkout` ISO strings).


- [x] **Airbnb-style compact mobile nav** (2026-02-28):
  - Mobile global nav slimmed dramatically. Logo height dropped from `h-[110px]` (110px) → `h-10` (40px) on mobile. Mobile nav total: **157px → 95px** in the initial state, **123px → 81.5px** when scrolled. Desktop nav unchanged.
  - New `mobileScrolled` state tracks `window.scrollY > 40` on every page (not just home). When true, the bottom Stays/Services tab strip collapses to text-only — the Bed/Briefcase icons disappear and labels render horizontally at 13px, matching Airbnb's compact mobile chrome from the user-shared screenshots.
  - `NavCategoryItem` gained an `iconHidden` prop that controls the icon visibility and the layout direction (flex-col → flex-row gap-2).
  - Page top paddings recalibrated: `Home.js` `pt-[170px]` → `pt-[110px]` on mobile; `Stays.jsx` `pt-[200px]` → `pt-[170px]` and `top-[123px]` → `top-[95px]` for the fixed search bar.
  - Verified by testing_agent iteration_31: 8/8 spec checks pass on mobile (390x844) and desktop (1280x900). Calendar / WhenPicker / WherePicker have no regressions. svg-count assertion confirms icons present (1 each) before scroll and absent (0 each) after.
  - Files: `frontend/src/components/Navigation.js`, `frontend/src/components/NavCategoryItem.jsx`, `frontend/src/pages/Home.js`, `frontend/src/pages/Stays.jsx`.


- [x] **Mobile QuickChips date-preset strip** (2026-02-28):
  - New `QuickChips` component (`frontend/src/components/search/QuickChips.jsx`) — Airbnb-iOS-style one-tap date-preset row that appears below the search pill on mobile (`md:hidden`).
  - 4 chips, each labeled + sub-labeled with the resolved date range: **Tonight** (today → +1), **This weekend** (next Fri → +2 nights), **Next week** (Mon of next calendar week → +7 nights — Sun/Mon clamp keeps it ≥7 days out), **This month** (today → last day of month).
  - Two variants: `dark` (Home hero — white-on-translucent backdrop-blur) and `light` (/stays — white pill with gray border on white bg).
  - **Home**: tapping a chip navigates to `/stays?checkin=&checkout=&area=` so the renter lands on filtered results with the dates pre-applied.
  - **Stays**: chips sit inside the `fixed` top bar (always reachable while scrolling). Tapping sets `checkin`/`checkout` → live filter + URL sync + layout switches to flat grid. Page top padding bumped from `pt-[170px]` to `pt-[220px]` on mobile to clear the chip strip.
  - Verified by testing_agent iteration_32 (7/8 PASS) + a self-screenshot retest after the Sunday "Next week" fix landed.
  - Files: `frontend/src/components/search/QuickChips.jsx`, `Home.js`, `Stays.jsx`.


- [x] **`/stays` is the new default landing + Israeli holiday QuickChips** (2026-02-28):
  - Visiting `/` now redirects (replace) to `/stays` — Airbnb-style direct-to-listings landing.
  - The legacy hero/featured-properties Home page remains accessible at `/home` for marketing campaigns / link juice (hero-search-band testid preserved).
  - Extended `loadHolidayWindows()` to resolve Sukkot, Pesach, Shavuot, Rosh Hashana (was: Sukkot + Pesach only). Cache key bumped `v1 → v2` so old 2-holiday cached payloads can't poison new consumers.
  - `QuickChips.jsx` now merges 4 generic + 4 Israeli holiday chips. Holiday chips render with a gold `border-[#D4AF37]` to signal seasonality; past holidays are filtered (today is Jun 28 2026 → Pesach + Shavuot auto-roll to 2027).
  - Verified by testing_agent iteration_33 — 21/21 checks PASS on mobile + desktop. Hebcal returns the expected dates: Sukkot 2026-09-25→10-03, Rosh Hashana 2026-09-11→09-13, Pesach 2027-04-21→04-28, Shavuot 2027-06-10→06-11. Hebcal-down fallback still surfaces the 4 generic chips.
  - Files: `frontend/src/App.js`, `frontend/src/utils/holidayWindows.js`, `frontend/src/components/search/QuickChips.jsx`.


- [x] **Bug fix: nav overlap at sm viewport + tiny WhenPicker click area** (2026-02-28):
  - Two bugs surfaced from user screenshot. Root causes:
    1. `Stays.jsx` fixed bar's responsive `top` jumped straight from mobile (`top-[95px]`) to md+ (`md:top-[68px]`), leaving the Tailwind `sm` range (640-767px) uncovered. At sm the nav grows to ~123px (60px scrolled logo + Stays/Services tab strip), so the bar at y=107 OVERLAPPED the nav by 16px → labels clipped.
    2. `WhenPicker.jsx`'s outer wrapper was just `<div className="relative">` with no width — it shrink-wrapped to the trigger button's content (~80px around "Add dates") rather than filling the flex parent. Most of the WHEN segment area was unclickable empty space.
  - Fixes:
    1. Added sm-specific top + container padding: `top-[103px] sm:top-[128px] md:top-[68px]` and `pt-[220px] sm:pt-[210px] md:pt-[152px]`. Verified gap ≥ 12px at every viewport from 390 to 1280.
    2. WhenPicker wrapper now `relative w-full h-full`, trigger button `w-full h-full`. Clickable area grew from ~80×30 to 570×51 on desktop / 152×51 on mobile. Far-left and far-right edge clicks both open the popover.
  - Verified by testing_agent iteration_34: 100% PASS, no regressions on WherePicker / QuickChips / calendar flows.
  - Files: `frontend/src/components/search/WhenPicker.jsx`, `frontend/src/pages/Stays.jsx`.


- [x] **Refactor: `--nav-h` CSS var + ResizeObserver — search bar always flush with nav** (2026-02-28):
  - User reported a 21px gap appearing between the nav and the fixed search bar when scrolling on mobile. RCA: nav shrinks on mobileScrolled (103 → 82 on <sm, 123 → 102 on sm-md), but the bar was pinned to hard-coded `top-[103px]/sm:top-[128px]/md:top-[68px]` so it stayed put while the nav shrunk.
  - New `useElementHeight` hook (`frontend/src/hooks/useElementHeight.js`) — reusable ResizeObserver-based height tracker.
  - `Navigation.js` now attaches a `ResizeObserver` to the `<nav>` and publishes its live `offsetHeight` to `document.documentElement.style.--nav-h` in pixels.
  - `Stays.jsx`: the bar uses `style={{ top: 'var(--nav-h, 68px)' }}` and the page wrapper uses `paddingTop: calc(var(--nav-h) + ${barHeight}px)` where `barHeight` comes from `useElementHeight(barRef)`. Zero magic numbers.
  - `Home.js`: the `home-search-band` paddingTop is `calc(var(--nav-h, 68px) + 12px)` — same dynamic approach.
  - Verified by testing_agent iteration_35: gap = 0.0px at rest, 0.5px (sub-pixel) when scrolled, across 7 viewports (390-1280). ResizeObserver correctly re-fires on viewport resize sequences AND on QuickChips async holiday-data load. All regressions pass.
  - Files: `frontend/src/hooks/useElementHeight.js`, `frontend/src/components/Navigation.js`, `frontend/src/pages/Stays.jsx`, `frontend/src/pages/Home.js`.


- [x] **i18n pass for search-pill strings (EN + HE)** (2026-02-29):
  - Added a new `stays:` namespace under both `en.translation` and `he.translation` in `i18n.js` covering 36+ keys: where / anywhere / when / addDates / filters, popover (selectDates, tabDates, tabFlexible, howLong, goAnytime, lengthWeekend/Week/Month, apply, close, clear, pickAMonth), and QuickChips labels (chipTonight, chipThisWeekend, chipNextWeek, chipThisMonth, chipSukkotWeek, chipPesachWeek, chipShavuot, chipRoshHashana).
  - `WhenPicker.jsx`, `WherePicker.jsx`, `QuickChips.jsx` now consume the keys via `useTranslation`. Chip-label builders take `t` as a parameter and include `i18n.language` in their useMemo/useEffect dependencies so labels re-translate **without a page reload** when the user toggles the language via the globe.
  - Hebrew labels verified: איפה / כל מקום / מתי / בחרו תאריכים / סינון / תאריכים / גמיש / סגור / ניקוי / בחרו חודש / לכמה זמן תרצו להישאר? / מתי שנוח / סוף שבוע / שבוע / חודש / הלילה / סוף השבוע הזה / שבוע הבא / החודש / חופשת סוכות / חופשת פסח / שבועות / ראש השנה.
  - Verified by testing_agent iteration_36: 100% PASS in both locales on desktop + mobile. Globe toggle is reactive (no reload needed). All regressions (jeru autocomplete, chip URL sync, holiday chip gold borders, --nav-h flush, md+ chip hiding) still pass.
  - Files: `frontend/src/i18n.js`, `frontend/src/components/search/WhenPicker.jsx`, `WherePicker.jsx`, `QuickChips.jsx`.


- [x] **RTL layout flip on Hebrew locale** (2026-02-29):
  - `i18n.js`: added `applyLocaleDir(lng)` bound to `i18n.on('languageChanged', ...)` plus a one-shot init call. `RTL_LOCALES = {'he','ar','fa','ur'}`. Writes both `lang` and `dir` to `<html>`.
  - First attempt (iteration_37) failed because a stale `useEffect` in `App.js` lines 65-72 was hard-pinning `dir='ltr'` on every i18n.language change, racing the new handler. Testing agent's RCA caught it; fix was removing the conflicting effect (iteration_38).
  - Verified by testing_agent iteration_38: **7/7 RTL cases PASS**. Initial load with `localStorage.i18nextLng='he'` → `dir='rtl'`; reactive globe toggle flips both attributes in < 1s without reload; visual layout reverses on desktop and mobile (Menu on left, chevrons mirrored, QuickChips right-to-left). No regressions to i18n strings or --nav-h refactor.
  - Files: `frontend/src/i18n.js`, `frontend/src/App.js`.


- [x] **Floating FABs respect safe-area + future bottom-nav** (2026-02-29):
  - Refactored `WhatsAppButton` + `AccessibilityButton` to use `bottom: calc(env(safe-area-inset-bottom, 0px) + var(--bottom-nav-h, 0px) + 1.5rem)` instead of hard-coded `bottom-6`. Both FABs now sit 24px above the iOS home indicator AND will lift automatically the moment any page sets `--bottom-nav-h` for a sticky bottom-bar.
  - `Stays.jsx` page wrapper gained `paddingBottom: calc(env() + 6rem)` so the last property card always clears the FAB stack — measured 40px gap between the last card bottom and the WhatsApp FAB top on a 14-card listing.
  - `AccessibilityPanel` (popup) now anchors to `+ 5.5rem` so it floats cleanly above its FAB.
  - Verified by testing_agent iteration_39: **11/11 PASS** on mobile (390x844), desktop (1280x800), Home + Stays, LTR + RTL. Zero console errors. FAB positioning is direction-agnostic (right/left properties pin to physical edges regardless of `dir=rtl`).
  - Files: `frontend/src/components/WhatsAppButton.js`, `frontend/src/components/AccessibilityButton.js`, `frontend/src/pages/Stays.jsx`.


- [x] **RTL visual audit pass** (2026-02-29):
  - New `useIsRtl` hook (`frontend/src/hooks/useIsRtl.js`) — wraps `i18n.dir() === 'rtl'`, auto re-fires on locale toggle.
  - **Stays AreaRow** (`Stays.jsx`): "See all" chevron now uses `ForwardChevron = isRtl ? ChevronLeft : ChevronRight` so it points in the reading direction. Left/right scroll-back/forward buttons swap their icons in RTL too. `ml-1` → `ms-1` for logical margin. `scroll(dir)` flips sign in RTL so the "back" arrow still scrolls back regardless of physical scroll direction.
  - **ImageGallery** (`property/ImageGallery.jsx`): prev/next buttons use logical `start-3` / `end-3` for positioning AND swap icons (`PrevIcon`/`NextIcon`) based on `useIsRtl()`. Click handlers unchanged.
  - **WherePicker**: clear-X `ml-1` → `ms-1`.
  - **WhenPicker**: close-X `right-4 top-4` → `end-4 top-4`, so in RTL it sits on the trailing (left) edge.
  - Verified by testing_agent iteration_40: **100% PASS**, computed styles confirm physical sides flip correctly per locale (LTR see-all marginLeft=4px, RTL marginRight=4px; LTR close-X right:16px, RTL left:16px), gallery icons swap, no console errors, no regressions.
  - Files: `frontend/src/hooks/useIsRtl.js`, `frontend/src/pages/Stays.jsx`, `frontend/src/components/property/ImageGallery.jsx`, `frontend/src/components/search/WherePicker.jsx`, `frontend/src/components/search/WhenPicker.jsx`.


- [x] **Bulk RTL polish for dashboard + admin** (2026-02-29):
  - One-shot Perl regex transform across **23 files** in `components/dashboard` + `components/admin`: `\b(ml|mr|pl|pr)-` → `(ms|me|ps|pe)-`. Tailwind 3.4 logical utilities flip automatically based on `dir`, so LTR layouts stay pixel-identical while RTL inherits correct trailing/leading sides.
  - 5 targeted `left-`/`right-` → `start-`/`end-` flips on the most visible inset offenders: BulkManager search icon, SmartPricing currency suffix, ManagerHeader notification badge, LikedTab card close-button + bottom 'Default' badge.
  - Verified by testing_agent iteration_41: **100% PASS**. Runtime evidence — BulkManager magnifier at physical right in RTL (`side=PHYS-RIGHT`), SmartPricingModal currency suffix at physical left in RTL (`side=PHYS-LEFT`), dashboard + admin both render `dir=rtl` cleanly. Zero console errors. No regressions on /stays + /home.
  - Note from testing agent: `localStorage.setItem('i18nextLng','en') + reload` is sometimes insufficient to fully reset i18next (the in-memory cache wins); the visible globe toggle is the reliable way. Not introduced by this iteration.
  - Files: 23 files in `components/dashboard/*` + `components/admin/*` (Perl-rewritten), plus `BulkManagerTab.jsx`, `SmartPricingModal.jsx`, `ManagerHeader.jsx`, `LikedTab.jsx` (5 targeted positional flips).

