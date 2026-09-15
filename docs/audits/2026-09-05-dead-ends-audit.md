# Dead ends — 2026-09-05 (scheduled)

Second run of the dead-ends audit (first: `2026-09-03-dead-ends-audit.md`, fully closed by
5 Sep per its own resolution log). Three parallel passes — forward (does every control
resolve?), backward (does every promise have a home?), orphaned capabilities — against
current `main`/`claude/zen-euler-77udap`. ~320 tool calls total, cross-referenced against
`frontend/src/App.js`'s route table and the relevant `backend/routes/*` guards. Read-only;
nothing fixed as part of this run.

Everything from the 3 Sep audit stayed fixed — no regressions found in that list.

---

## Broken: goes nowhere or errors

### 1. Contract "Download" always 403s — hits both an owner and an unauthenticated signer
`frontend/src/components/ContractManager.js:127-129` and `frontend/src/pages/SignContract.js:66-70`
both call `window.open(`${API}/contracts/download/${id}`, '_blank')` directly. The endpoint
(`backend/routes/contracts.py:166-168`) is gated by `verify_token`, which depends on
`HTTPBearer()` with default `auto_error=True` (`backend/utils/auth.py:15`) — FastAPI rejects
with 403 before the handler runs if there's no `Authorization` header, and a plain browser
navigation from `window.open()` can never attach one. The app already has the fix for this
exact problem, with a comment explaining why it exists: `frontend/src/utils/openAuthedFile.js`
("Contracts used to be plain `<a href>` links... a bare `<a href>` can't attach an
Authorization header, so we fetch the bytes with the token and hand the browser a blob URL
instead"). Every other contract-file button in the app (`BookingRow.jsx`, `BookingChip.jsx`,
`PropertyList.jsx`, `useBookingActions.jsx`) uses that helper. These two don't.
- **Owner side:** any property lister with an uploaded contract template, from
  Dashboard → Contracts (`ContractListItem.jsx:241`, `data-testid="download-btn-*"`).
- **Signer side, more severe:** `/sign/:signToken` (`SignContract.js`,
  `data-testid="download-contract-btn"`) is the page an *external, unauthenticated* renter
  reaches from a signing email. There is no token-scoped public download route — only the
  bearer-gated one — so this person can never successfully download the contract text
  through this button, full stop.
- **Fix:** route both call sites through `openAuthedFile.js`, same as every sibling button.
  This is exactly the failure mode CLAUDE.md's "Contract file storage" section warns about
  (a public/inaccessible path around the permission-checked endpoint), just from the client
  side rather than a new public route.

### 2. `/terms` link 404s on both auth screens
`frontend/src/pages/Auth.js:618` and `frontend/src/pages/SignupJoin.jsx:670` both link
`<a href="/terms" target="_blank">`. No `/terms` route exists in `App.js` and no static file
serves it — it falls through to `NotFound`. (`Auth.js`'s version is also missing
`rel="noopener"`.) This is the Terms-of-Service link shown on every login/signup form.
- **Fix:** either build a `/terms` page/route, or point both links at wherever the real
  terms live (if anywhere) — but two different signup surfaces link the same broken URL, so
  fixing one and not the other would leave a mismatch.

### 3. Sublease notification drops the item it was about
`frontend/src/components/Navigation.js:275` navigates to
`/dashboard?tab=subleases&highlight=<id>` — same pattern as the already-fixed booking
`highlight` param. But `Dashboard.js:412` renders `<SubleasesTab API={API} token={token} />`
with no `highlightId` prop, and `SubleasesTab.jsx` never reads `highlight` at all (the
booking sibling case, `Dashboard.js:218/470`, does pass it through). The user lands on the
right tab; which row triggered the notification is silently lost.
- **Fix:** thread `highlight` into `SubleasesTab` the same way `BookingsList` already gets it.

### 4. "Sign a contract without printing" feature card sends renters to an empty pane
`frontend/src/data/featureLibrary.js:92-98` lists this card for `audiences: ['host',
'traveller']` with `cta: '/dashboard?tab=contracts'`, and its own copy says "Hosts and
renters agreeing a let." `WhatYouCanDo.jsx` and `FeatureDetail.jsx` render this CTA to any
traveller/renter unconditionally. But `Dashboard.js:393-395` only renders `<ContractManager
/>` when `isPropertyLister` (`['owner','manager','admin'].includes(role)`,
`useDashboardNav.js:50`) — a renter is never a property lister. A renter who reads "renters
agreeing a let" and clicks "Open my contracts" gets a dashboard tab with nothing in it.
Renters *can* sign contracts (via `SignContract.js` from the booking flow) — this specific
card's CTA just never reaches that.
- **Fix:** either scope the card to `audiences: ['host']` only, or give the `contracts` tab
  a renter-facing view (their own signed contracts) so the promise for `traveller` is true.

---

## Dead-end promises: destination lacks the affordance

### 5. Pricing-insights email points at Settings; the actual opt-out lives elsewhere
`backend/utils/email.py:746-748` tells the recipient: *"Don't want these weekly digests?
Manage your email preferences in your dashboard settings"* → links `/dashboard?tab=settings`.
The real control is `PATCH /smart-pricing/insights/preferences`
(`backend/routes/smart_pricing/insights.py:244-253`), called only from
`SmartPricingModal.jsx:217-240` — a per-property modal opened from a "Smart Pricing" button
on each vacation listing card, not from Settings. `SettingsTab.jsx`/`NotificationSettings.jsx`
cover language, WhatsApp, role, the 12h nudge toggle, and password — nothing about pricing
digests. Following the email's own link, there is no control that does what it promised.
- **Fix:** either add the digest opt-out to Settings for real, or change the email copy to
  point at (or describe) the per-property Smart Pricing modal.

### 6. Onboarding checklist's calendar tip references a field name the app never writes
`backend/routes/onboarding.py:190,219` marks "Set your availability" done via
`p.get("available_from") or p.get("ical_url")` — **singular**. The tip copy
(`frontend/src/locales/en.js:447`) sells this specifically as calendar sync ("An
out-of-date calendar costs you the enquiry"). But the iCal feature
(`backend/routes/ical.py:34-53`, `PropertyList.jsx`) writes `ical_urls` — **plural array**.
An owner who does exactly what the tip implies (connects their calendar via the iCal panel)
never satisfies this checklist item unless they separately also set `available_from`. Not a
hard dead end — the `available_from` path still works — but the specific action the copy
encourages silently fails to register.
- **Fix:** `onboarding.py`'s `done` check should also read `ical_urls` (non-empty list).

---

## Orphaned capabilities

### 7. The Requests-board admin moderation queue is fully built and fully unreachable
`GET /admin/request-reports` and `POST /admin/request-reports/{id}` (both
`backend/routes/admin/marketplace.py:274,346`, `ModerationIn.action` = `hide`/`allow`) have
**zero** references anywhere in `frontend/src`. The backend's own comment admits it outright:
*"Reports have been collected into `request_reports` since the board shipped and NOTHING has
ever read them: a report button that files into a drawer nobody opens is worse than no
button."* The public-facing report button (`POST /requests/{id}/report`) works fine — it's
specifically the admin side that has no UI. The count this would drive
(`posts_awaiting_moderation`) is computed in `GET /admin/attention` but has no row in
`AttentionQueue.jsx` (its four sibling counts each have a `go:` target; this one has none).
- **Fix:** build the moderation list/action UI in the admin console (or remove the endpoints
  and the reporting feature's implied promise if moderation isn't happening yet).

### 8. `PATCH /businesses/{id}/verified` has no caller anywhere — but the badge it drives is public and an admin queue counts it
`backend/routes/marketplace/businesses.py:764` is the only way to ever flip a business's
`verified` flag, and nothing in `frontend/src` calls it — the admin console's services tab
(`ServicesTab.jsx`) lists gigs, not businesses, and its only actions are publish/unpublish.
`verified` is rendered publicly as a badge (`BusinessPage.jsx:411-415`), and
`AttentionQueue.jsx:67` surfaces `businesses_unverified`. Worth noting: that row's copy was
already deliberately softened in a prior pass — a comment right above it explains "Nothing in
the product lets a business ask to be verified... the row was describing a queue of
applicants that has never had a member. It now says what it counts" — so the UI no longer
*promises* action on this count, it just reports a fact. That's the right call for the copy,
but the endpoint is still fully orphaned: there is still no way for anyone, ever, to set the
flag that produces a badge users see.
- **Fix:** either add a verify toggle to the admin console (lowest-effort: a checkbox on a
  businesses list, which doesn't currently exist as an admin surface at all), or decide
  verification isn't launching yet and say so rather than shipping the badge.

### 9. In-platform gig bookings have no provider side, and no listing endpoint at all
`POST /gigs/{gig_id}/book` (`backend/routes/marketplace/gigs.py:1049`) is reachable — a buyer
picks `booking_mode: 'in_platform'` (settable by providers in `CreateGig.jsx:689`) and
`GigDetail.jsx` posts to it. But `PATCH /bookings/{id}` for gig bookings
(`gigs.py:1116`, accept/decline/complete/cancel) has no caller in any dashboard component —
grepping every `PATCH .../bookings/{id}` call site finds only the unrelated
property-booking flow (`useBookingActions.jsx`). Worse, there is **no GET endpoint at all**
that lists `marketplace_bookings` for either party — only insert/patch/internal-sweep code
touches that collection. A buyer can create one of these bookings and it becomes permanently
invisible and unmanageable: the provider is never even shown that it exists.
- **Fix:** this is the deepest gap in the audit — either build the provider-side list +
  accept/decline UI, or (cheaper, if in-platform booking isn't ready) stop offering
  `in_platform` as a `booking_mode` choice in `CreateGig.jsx` until the other half exists.

### 10. `RequestIn/Patch.furnished` and `.amenities` — fields nobody can fill
`backend/routes/marketplace/requests.py:205-206,237-238` accept both for rental-variant
Requests-board posts. `PostRequest.jsx`'s rental-fields block only wires `rental_kind`,
`bedrooms_min`, a date, and `lease_months` — no furnished toggle, no amenities picker.
Confirmed zero hits in `RequestDetail.jsx` either (the only `furnished`/`amenities` hits in
the frontend are the unrelated Stays/property filter). Same bug class as the already-fixed
gig `faqs` field.
- **Fix:** add the two controls to the rental branch of the post wizard, or drop the fields
  if rental requests don't need them.

### 11. Requests board never sends `category`/`rental_kind` despite displaying both
`GET /requests` accepts `category` and `rental_kind` (`requests.py:527-528`) — the exact
fields `RequestsBoard.jsx:158` reads to show on each card. There is no filter UI for either;
the board's params-building block never sets them. A user can see a request's category on
its card but can never filter the board by it. Same shape as the already-fixed
`condition`/`min_price`/`max_price`/`include_sold` gap from the 3 Sep audit — this is the
half that fix missed.
- **Fix:** add category/rental-kind chips to the board's filter row, same pattern as the
  item-tab filters already built.

### 12. Jobs board's own header comment promises a filter it never sends
`JobsBoard.jsx:6` states outright: *"Filters: category + area (server-side)."*
`GET /marketplace/jobs` does accept `area` and `subcategory` (`jobs.py:355-356`). But the
fetch-building code only ever sets `category` — `activeArea` (read from the URL at line 50)
is used solely for saved-search matching, never appended to the actual jobs-list request.
There is no UI control that sets an area filter for browsing at all; `subcategory` (settable
by a poster in `PostJob.jsx`) is likewise never sent.
- **Fix:** append `area`/`subcategory` to the query the board actually fetches with, and (if
  the comment's claim is the intended UX) add an area filter control.

### 13. `GET /admin/marketplace/summary` is dead code, fully duplicated by `/admin/metrics`
`backend/routes/admin/marketplace.py:124` has zero frontend references. It computes the same
three counts (`active_services`, `businesses`, `open_requests`) that
`GET /admin/metrics` (`admin/core.py:143-145`) already returns and `OverviewTab.jsx` actually
calls.
- **Fix:** delete it — lowest-effort item in this report, no UX behind it to build.

---

## Verified working

- **Main nav** (desktop, mobile, hamburger drawer, notification bell, messages shortcut) —
  every target resolves; `?tour=1` is read by `TourProvider.jsx`.
- **Dashboard `?tab=` values app-wide** — all match the `ALL_TAB_IDS` whitelist from the 3 Sep
  fix. Companion params `?edit=`, `?details=`/`?services=` (incl. the `'1'` sentinel),
  `?business=`/`?welcome=`, `?highlight=` (bookings only — see #3), `?section=notifications`
  all read correctly by their destination.
- **Saved-search and Services filter passthrough** — every param `SavedSearchesTab.jsx` and
  `MovingServicesCrossSell.jsx` build is consumed by `Properties.js`/`Services.jsx`.
- **Onboarding checklist hrefs** (all items other than #6's field-name mismatch) — all valid.
- **Auth/signup/verify flows**, `AuthDeeplink.jsx`, post-signup role routing — consistent.
- **Contract file access everywhere except #1** — `BookingRow.jsx`, `BookingChip.jsx`,
  `PropertyList.jsx`, `useBookingActions.jsx` correctly use `openAuthedFile.js` against the
  permission-checked endpoints CLAUDE.md documents; no regression of that guardrail outside
  the two sites in #1.
- **Admin panel** (BookingsTab, ChatsTab, DuplicatesModal, ListingsTable, ServicesTab,
  SmartListsTab, SiteQrPanel, UsersTab) — internal links, `mailto:`/`tel:`/`wa.me` all
  well-formed and correctly `rel`-attributed.
- **`/chat/:propertyId` and `/payment/success` bare unauth guards** (no `redirect=` preserved,
  unlike `ToAuth`) — checked every caller; each either checks `token` and redirects through
  `/auth/login?redirect=` itself first, or is only reachable from an already-authenticated
  dashboard context. Not a live bug, just a latent inconsistency if a new caller is ever added
  without the same check.
- **Gigs board filters** — every one of ~16 query params is sent by `Services.jsx`.
- **Admin `/admin/metrics?range=`, `/admin/bookings?status=&limit=`** — sent correctly.
- **Components/pages** — ran the orphan-detection script against every `.jsx` in
  `components/**` and `pages/*`; zero orphans found (all deletions from 3 Sep stayed deleted).
- **All 9 scheduled loops** (`availability_reminders`, `pricing_insights_weekly`,
  `smart_pricing`, `booking_hold_sweep`, `jobs_digest`, `requests_lifecycle`,
  `requests_digest`, `auto_owner_nudge`, `duplicate_auto_cleanup`) — all registered via
  `asyncio.create_task` in `backend/server.py:228-301`. No new orphaned scheduler.
- **Business-completeness checklist, `founded_year`/`delivery_note`/`lead_time`/
  `payment_note`/`kosher_certification`/`hours`, gig `faqs`, `collections`/
  `pinned_service_ids`, `GigPatch.status` paused/unpublished, `JobPatch.status` awarded** —
  all re-confirmed still fixed and working from the 3 Sep audit.

---

## Not checked

- Whether `work_offers_open > 0` (an `AttentionStrip` count) can be true for a user whose
  gig tabs are hidden — plausible it can't, but the backend condition wasn't traced.
- Anything gated behind `DOCUMENT_SERVICES_ENABLED` or the `storage` rental type — both
  discontinued per CLAUDE.md, out of scope by design.
- Visual/click verification (Part 5 of the skill) — this run was static-analysis only; the
  four "Broken" items and #7–9 are high-confidence enough from reading both sides (UI trigger
  condition + backend guard/absence) that they don't need a browser to confirm, but a
  `scripts/check-*.mjs` pass would still be worth running before fixing, especially for #1
  (confirm the 403 in a real browser network tab) and #4 (confirm the empty pane, not a
  fallback UI this report missed).

---

## Suggested priority order

1. **#1 contract download 403** — legal documents, hits an external signer with no login to
   route around it; matches a CLAUDE.md-flagged risk class exactly.
2. **#9 in-platform gig bookings** — money-adjacent, a buyer's booking vanishes from the
   provider's view entirely.
3. **#7 admin moderation queue** — trust/safety, already self-flagged in the backend's own
   comments as the exact "drawer nobody opens" bug this skill exists to catch.
4. **#2 `/terms` 404** — trivial fix, on every single auth screen.
5. **#11/#12 board filter params** — same low-effort shape as the 3 Sep fixes.
6. Everything else, roughly in the order listed above.
