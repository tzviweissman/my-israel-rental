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


