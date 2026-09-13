# MyIsraelRental — Dead-Ends Audit
**Run:** 2026-09-08 (scheduled) · **Note:** `.claude/skills/dead-ends/SKILL.md` does not exist in this repo — this audit followed the methodology spelled out in the scheduled task prompt itself instead, same as the 2026-09-03 run.

Three parallel passes: forward (does every control resolve, including query-param handoff?), backward (does every promise have a home?), orphaned capabilities (backend features nothing calls). ~300 tool calls across the three passes, cross-referenced against `frontend/src/App.js` routes, locale files, and `backend/routes/*` guards. Items already confirmed fixed by the 2026-09-03 audit and its resolution notes were re-spot-checked (not re-reported) unless noted otherwise.

---

## Top priority — confirmed, user-facing today

### 1. Owners/providers who save a search see a "view matches" link to a tab that shows them nothing
`MyAlertsPopover.jsx:194` links `/dashboard?tab=alerts` from a "N new properties matched" banner. The popover itself is rendered "always visible when signed in" (`Properties.js:622`) and the saved-search backend (`backend/routes/saved_searches.py`) has no role check. But `Dashboard.js:404` renders the alerts tab body only `{activeTab === 'alerts' && isRenter}`. Any owner, provider, or admin account that saves a property search and later gets matched sees a link into a tab that renders empty for their role — no error, just a blank page.
**Fix:** either gate the "save as alert" / popover to renters only, or stop gating the alerts tab body by role (saved searches aren't inherently renter-only).

### 2. "Back to businesses" silently drops filters/scroll position for anyone using the real nav
The primary nav's Services link is `/businesses` (`Navigation.js:431,808,945` all point there), but `GigDetail.jsx:37` only recognizes `GIG_RETURN_PREFIXES = ['/services']` for its saved-return mechanism. `saveReturnPath()` stores wherever the board actually was (almost always `/businesses?...`), then `useReturnDestination(GIG_RETURN_PREFIXES, '/services')` (`GigDetail.jsx:259`) fails to match that prefix and falls back to a bare `/services`, dropping the visitor's filters and scroll position. The code's own comment (`GigDetail.jsx:256-258`) already says it's meant to also honor "an adjacent /businesses/provider/... or /businesses/jobs page" — this is acknowledged unfinished scope, not new behavior.
**Fix:** add `/businesses` to `GIG_RETURN_PREFIXES` (mirrors the `/services`/`/businesses` dual-URL pattern already used everywhere else in the router).

### 3. Sublease notification deep-link loses its own highlight
`Navigation.js:275` sends a sublease notification click to `/dashboard?tab=subleases&highlight=<id>`. `Dashboard.js` reads `highlight` and forwards it to `<BookingsList highlightId=...>`, but `SubleasesTab.jsx` (what actually renders for `tab=subleases`) never reads `highlight` or `useSearchParams` at all. User lands on the right tab; the one sublease the notification was about is never highlighted/scrolled to. Same bug shape as the already-fixed booking-highlight case from 2026-09-03 (#4) — that fix covered bookings but not subleases.

### 4. Providers have no way to act on marketplace appointment/booking requests
`POST /marketplace/gigs/{gig_id}/book` (creating a request) is wired end-to-end from `GigDetail.jsx`. But `PATCH /marketplace/bookings/{booking_id}` — accept/decline/complete/cancel, the only way a provider responds — has zero frontend callers. The dashboard's booking UI (`BookingsList.jsx`, `useBookingActions.jsx`) only ever calls `/bookings/*` (property rentals), never `/marketplace/bookings/*`. A buyer can request an appointment/service booking through a gig; the provider who receives it has no screen that shows it or lets them respond. This is a full capability with a create path and no read/respond path — the promise made by "book this service" has no place for the provider side to be kept.

### 5. Gig `subcategory` is a working buyer-side filter that no provider can ever populate
`Services.jsx` has a live subcategory filter row (`selectedSubcategory`, `patchUrl({subcategory:...})`) and the backend model comment says setting it gives "tighter match precision." But neither `CreateGig.jsx` nor the edit path in `MyGigsTab.jsx` ever sets `GigIn.subcategory`/`GigPatch.subcategory` when a provider creates or edits a gig. The buyer-facing filter is fully built and can never match anything, because the only way to populate the field it filters on doesn't exist. (For contrast: the equivalent `JobIn.subcategory` on Jobs *is* wired in `PostJob.jsx`/`EditJobModal.jsx` — this is a gig-specific gap, not a pattern-wide one.)

---

## Forward audit — everything else checked

*Checked and confirmed fine, not re-listed in detail: all `/dashboard?tab=…&edit=/&highlight=/&welcome=/&details=/&services=/&business=/&tour=1` deep links elsewhere on the site; both `/chat/:id` and `/payment/success`'s bare-`Navigate` (no return-to) guards remain isolated to those two routes and every caller checks auth first before linking there; `OrderPage`, `OrdersPrintPage`, `SavedSearchesTab`, `CreateGig`, `JobDetail`/`PostJob`, `ProviderRedirect`, and the request-board contact/WhatsApp flows all match frontend conditions to backend guards.*

**Worth a second look, not confirmed as live-broken:**
- **Pricing-quarantine notification overclaims precision.** `admin_import/properties.py:736`'s `action_url` (`/dashboard?tab=properties&edit={id}`) opens the general edit modal, not scrolled to the price field specifically, despite "tap to fix and republish" copy. Smaller win than promised, not a dead end.
- **`business-share` tour anchor is orphaned.** `MyBusinessesTab.jsx:390` sets a `tour="business-share"` prop that has no matching step in `tourSteps.js`. Currently inert (nothing looks for it), but reads like a half-wired tour step — worth a five-minute check that a planned business-role tour step wasn't dropped.

---

## Backward audit — promises checked against their destinations

This pass came back mostly clean — the repo has been through six UI audits and a prior dead-ends audit in the last week, and several of the exact failure modes this audit hunts for now have regression tests (`backend/tests/test_jobs_digest_wiring.py`) or defensive comments at the point of the original bug. Checked end-to-end and confirmed working: the business- and property-completeness checklists (logo/category/description/areas/photo, listed/photos/availability/contact/share), the newest feature in the repo (courier accounts/deliveries, shipped today in `e6d0467` — invite email → tab → accept → auto-assignment → delivered-photo proof → customer tracking, all field names matching client-to-server), the contract "download a copy after signing" button, and all nine scheduled digest/sweep loops in `server.py`.

Two things worth flagging, neither a live dead end:
- **Landmine locale key: `services.heroSubtitle`** (`en.js:3679`) still reads *"See verified work history, reviews, certifications"* — the exact false promise its sibling key `services.heroLede` was deliberately stripped of (there is no verification feature). `heroSubtitle` isn't rendered anywhere currently, so it's harmless today, but it's a landmine for whoever next touches the Jobs board hero and copies from the wrong key. Worth fixing alongside `heroLede` rather than waiting for it to resurface.
- **Process gap, not a UI bug:** commit `5d7ac07` ("Audit follow-up, 8 Sep: the courier's Delivered button was green...") references `docs/audits/2026-09-08-ui-audit.md` in its message, but that file does not exist anywhere in git history and the working tree was clean before this run. An audit report was apparently written and acted on without ever being committed — the same "existed only on one machine" failure the 2026-09-06 audit flagged and fixed twice already. If that file still exists on whatever machine ran it, it should be committed so its findings are traceable.

---

## Orphaned capabilities

**Model fields with no editor:**
- `RequestIn.furnished` and `RequestIn.subcategory` (`backend/routes/marketplace/requests.py:197,205`) — the Requests board model accepts both; `PostRequest.jsx` never sets either.
- `PropertyCreate.ical_url` (singular, `backend/models.py:117`) — dead leftover; the real iCal integration uses the `ical_urls` array via `routes/ical.py`, which is correctly wired.
- `checkin_time`/`checkout_time` on `PropertyCreate` can only be set through bulk-edit (`BulkEditModal.jsx`) — there's no per-listing input in `AddPropertyModal.jsx`, so a single-property host can only reach these via bulk-edit on a one-property selection.

**Enum values:** nothing new found. The previously-known `GigPatch.status: "paused"` gap is now fixed (setter exists in `MyGigsTab.jsx:407`).

**Endpoints with no caller** (excluding legitimate webhook/cron/admin-curl-only endpoints, which are fine as-is):
- `PATCH /marketplace/bookings/{booking_id}` — see finding #4 above, the highest-severity item in this whole audit.
- `GET /marketplace/businesses/{business_id}/listings` — built as a "what deactivating this business would hide" confirmation; the frontend's deactivate dialog uses a `gig_count` field instead and never calls it.
- `GET /admin/marketplace/summary` — admin overview counts nothing renders; `AttentionQueue.jsx` calls a sibling endpoint instead.
- `GET /admin/request-reports` and `POST /admin/request-reports/{request_id}` — full moderation queue for reported requests, zero frontend callers. Users can report a request; nothing in the admin UI lists or resolves reports.
- `GET /properties/featured` — built to replace a client-side featured strip, but the cinematic home redesign removed the featured rail entirely; the optimization has no UI left to serve.
- `POST /subscription/cancel`, `POST /subscription/upgrade`, `POST /subscription/select-plan`, `GET /subscription/plans` — confirmed-dead remnants of the removed pay-to-list flow (comments in `MyGigsTab.jsx`/`CreateGig.jsx` say so explicitly). Only `activate` and the admin plans-bootstrap pair are still live.

**Query parameters nothing sends:**
- `GET /marketplace/requests` — `category` and `rental_kind` accepted, never sent by `RequestsBoard.jsx` (the item-level `condition`/`min_price`/`max_price`/`include_sold` params from the 2026-09-03 finding are now correctly sent — that part is fixed).
- `GET /properties/check-duplicate` — `area`/`title` fallback params exist specifically for address-less duplicate detection, but `AddPropertyModal.jsx`'s polling effect early-returns whenever address is blank, so the path these params exist for is unreachable.
- `GET /admin/gigs` — `status` filter accepted server-side; `ServicesTab.jsx` has no status-filter control, only a search box.

**Components:** none found imported by nothing, out of 209 files checked. A handful of single-consumer files (`WhyListDemos.jsx`, four `HomePreview.jsx`-only experiments) are legitimate, not orphaned.

**Scheduled work:** all nine loops (smart pricing daily/weekly, availability reminders, booking-hold sweep, requests lifecycle/digest, jobs digest, duplicate cleanup, auto-owner-nudge, mention emails) are registered in `server.py`. Nothing unregistered found.

---

## Suggested first fixes (highest impact per effort)
1. **#1 (alerts tab role mismatch)** — one-line gate change, affects every non-renter with a saved search.
2. **#4 (marketplace bookings have no provider-side UI)** — the biggest gap found: a whole request/response loop with only the request half built. Needs a real dashboard tab, not a one-liner, but it's the one item here that's a missing feature rather than a wiring bug.
3. **#2 (`/businesses` return-path)** — one-line fix, add `/businesses` to `GIG_RETURN_PREFIXES`.
4. **#3 (sublease highlight)** — same mechanism as the already-fixed booking-highlight case; port it to `SubleasesTab.jsx`.
5. **#5 (gig subcategory)** — add the subcategory select to `CreateGig.jsx`/edit path so the existing buyer-side filter has something to match.
