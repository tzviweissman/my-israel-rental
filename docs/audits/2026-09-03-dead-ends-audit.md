# MyIsraelRental — Dead-Ends Audit
**Run:** 2026-09-03 (scheduled) · **Note:** `.claude/skills/dead-ends/SKILL.md` does not exist in this repo — this audit followed the methodology spelled out in the scheduled task prompt itself instead.

Three parallel passes: forward (does every control resolve?), backward (does every promise have a home?), orphaned capabilities (backend features nothing calls). ~190 tool calls, cross-referenced against `frontend/src/App.js` routes and the relevant `backend/routes/*` guards.

---

## Top priority — confirmed by two independent passes

### 1. Pricing-quarantine email's "Fix pricing now" button 404s
When the admin pricing-quality sweep auto-hides a listing, the notification email/in-app alert points to `/dashboard/properties/{property_id}/edit#pricing` (`backend/routes/admin_import/properties.py:736,754`, `backend/utils/email.py:834,892`). **No such route exists** — `App.js` only has `/dashboard` and `/dashboard/settings`; property editing is a modal opened from inside the dashboard, not a URL. `frontend/src/components/Navigation.js:259` also trusts this `action_url` verbatim for the in-app notification bell, so both the email and the bell dead-end to `NotFound`. The secondary link (`/dashboard?tab=properties`) does work, but the actual one-click fix promised in the email subject line doesn't exist.
**Fix:** either build the route (`/dashboard/properties/:id/edit` opening the edit modal pre-scrolled to pricing) or change both link generators to the working tab link.

---

## Forward audit — controls that don't go where they say

2. **Store gigs' "Send an inquiry" button 400s every time.** `GigDetail.jsx:553-561` falls through to a generic `BookingForm` for any store-type gig without a valid WhatsApp number, which POSTs to `/marketplace/gigs/{id}/book`. The backend rejects all store gigs there unconditionally (`backend/routes/marketplace/gigs.py:1004-1005`, 400 "Store gigs do not accept bookings"). Same bug class as the already-fixed message-path issue (`GigDetail.jsx:585-604` comment) — that fix missed the booking path.
3. **Marketing CTAs into `/dashboard?tab=...` lose the tab on login.** `FeatureDetail.jsx:99-105` (10 of 15 feature CTAs point at `/dashboard` variants) and `ServicesHeroSearch.jsx:456` (`/dashboard?tab=my-gigs`) are reachable while logged out; the `/dashboard` guard (`App.js:321`) bounces to bare `/auth/login` with no `redirect` param, so after signing in the user lands on generic dashboard, not the tab they clicked for.
4. **Notification `highlight=<id>` param is read but never used.** `Navigation.js:270,275` navigates to `?tab=bookings&highlight=<id>` / `?tab=subleases&highlight=<id>`; `Dashboard.js:185-190` reads it only to re-trigger a generic fetch, never passes it to `<BookingsList>` or the subleases tab. User lands on the right tab, no indication which item the notification was about.
5. **`?edit=<id>` from the availability-extension email is dropped.** `AvailabilityExtended.jsx:63` links to `/dashboard?edit=<id>`; nothing in `Dashboard.js` ever reads an `edit` param. Property never opens in edit mode.
6. **Post-signup redirect can land on the wrong flow.** Guards on `/services/post-job`, `/businesses/post-job`, `/services/create-gig`, `/businesses/add` send unauthenticated users to bare `/signup` (`App.js:398-407`); `SignupJoin.jsx:201-209` hardcodes the post-signup destination by role and ignores the `redirect` param for the `provider` branch, so someone who tried to post a job gets dropped on "Add your business" instead.
7. **Still open (known bug, re-confirmed):** Requests board never sends `condition`/`min_price`/`max_price`/`include_sold`, even though `RequestDetail.jsx:317-318` displays `condition`.

*Everything else — main nav/footer (~15 links), listing cards (~20), chat (8), most dashboard deep links (~12) — resolved cleanly.*

---

## Backward audit — promises with no home

8. **Welcome email pitches a discontinued feature to every new signup.** `backend/utils/email.py:288`: *"Request Arnona discounts, name changes and other government services"* — sent unconditionally from all three signup paths (`routes/auth.py:86,148,311`). Per `CLAUDE.md` this is intentionally discontinued and gated off (`DOCUMENT_SERVICES_ENABLED`); there is no reachable page, nav item, or CTA for it anywhere in the frontend. Every new user is told to do something that doesn't exist in the app.
9. **`faqs` field on gigs has no editor.** Backend accepts and persists it (`routes/marketplace/shared.py:595,618`, `gigs.py:491`), `GigDetail.jsx:911-915` renders the FAQ accordion when present — but `CreateGig.jsx` (the only create/edit surface, routed at `/services/create-gig` and `/businesses/add`) never exposes a UI control to add a question; it only initializes and forwards the array. In practice `faqs` is only ever populated by the demo seed script.

*Checked and confirmed fine: the business-completeness checklist, `founded_year`/`delivery_note`/`lead_time`/`payment_note`/`kosher_certification`/`hours` (all editable in `BusinessDetailsForm.jsx`), email verification, password reset, and all three digest/sweep schedulers.*

---

## Orphaned capabilities

10. **Two more model fields with no editor:** `BusinessIn/Patch.collections` (`businesses.py:119,171`, rendered on `BusinessPage.jsx:250`) and `pinned_service_ids` (cap-of-3, rendered at `BusinessPage.jsx:246`) — both readable, neither writable from any frontend component.
11. **Two more unreachable enum values**, same pattern as the known `GigPatch.status: 'paused'` bug (still true — nothing pauses/unpublishes a gig once created):
    - `JobPatch.status: 'awarded'` — has a badge CSS class (`MyJobsTab.jsx:33`) and zero i18n key (only `status_open`/`status_closed` exist), and nothing anywhere ever sets it.
12. **Endpoints with no caller:**
    - `POST /translate`, `POST /contact`, `GET/POST /service-requests` (`backend/routes/misc.py`) — fully dead, no frontend page targets any of them. `/translate` in particular would burn Anthropic credit if ever hit.
    - `POST /services/waitlist` — its own docstring says it was for when Services was "a stub"; Services is now a full marketplace page. Dead pre-launch leftover.
    - `POST /marketplace/subscription/{select-plan,upgrade,cancel}` — confirmed intentionally dormant in comments (`MyGigsTab.jsx:403-405`, `CreateGig.jsx:492-493`: listing is free now, endpoints "kept... dormant").
    - `POST /marketplace/job-searches/send-digest` — admin manual-trigger escape hatch, no admin UI button calls it (only reachable via raw authenticated curl).
13. **A second unused query param, same family as the requests-board gap:** `GET /properties` accepts `sort` (`price_asc|price_desc|newest`, `properties/browse.py:354-385`); neither `Properties.js` nor `Stays.jsx` ever sends it — `Stays.jsx` instead fetches everything and sorts client-side.
14. **Six components imported by nothing:** `PlanPicker.jsx`, `ServicesUpsellModal.jsx` (both leftover from the removed pay-to-list flow), `ServicesHeroTitle.jsx` (flagged dead in its own file's comment), `HeroSlideshow.jsx` (superseded by the cinematic home hero), `PayPalCheckout.jsx`, `motion-scroll-word-reveal.jsx`.
15. **Scheduled work is sound** — all digest/sweep loops (`requests_lifecycle`, `requests_digest`, `jobs_digest`, `booking_hold_sweep`, `availability_reminders`, `smart_pricing`, `pricing_insights_weekly`, duplicate-cleanup, auto-owner-nudge) are registered via `asyncio.create_task` in `backend/server.py:230-303`. No orphaned scheduler found this pass — the jobs-digest issue from prior audits appears fixed.

---

## Suggested first fixes (highest user-visible impact per effort)
1. Pricing-quarantine email/notification link (#1) — one-line link fix, affects every quarantined listing owner.
2. Store-gig booking 400 (#2) — same root cause class as an already-patched bug; likely a small guard/branch fix in `GigDetail.jsx`.
3. Welcome-email copy (#8) — delete the discontinued-feature line; zero risk, affects 100% of signups.
4. `faqs` editor (#9) — either build the add-question UI in `CreateGig.jsx` or stop rendering the accordion/remove the field until it's editable.

---

## Resolution (4 Sep 2026)

Fixed in the commit that added this file:

- **#1** the quarantine email's "Fix pricing now" and the in-app alert now
  link to `/dashboard?tab=properties&edit=<id>`, and the dashboard opens
  that listing's edit form on arrival (the URL is cleaned after).
- **#2** a store with no WhatsApp number sends "Send an inquiry" to site
  chat instead of the booking form the backend refuses.
- **#3 / #6** every gated route sends a signed-out visitor to sign in or
  sign up WITH the page they wanted in `redirect`; the provider branch of
  sign-up honours it.
- **#4** `highlight=<booking id>` reaches the row: it scrolls into view
  with a ring.
- **#5** the availability nudge's `?edit=<id>` now does what it says (same
  mechanism as #1).
- **#8** the welcome email no longer pitches government document services.

Still open: **#7** (requests board filters), **#9** (`faqs` has no editor),
**#10–#14** (orphaned fields, enum values, endpoints and components).
