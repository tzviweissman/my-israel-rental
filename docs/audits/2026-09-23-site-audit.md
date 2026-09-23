# MyIsraelRental — Nightly Site Audit, 23 Sep 2026

Scope: everything merged since the last full site-audit (14 Sep) — 110 commits — with a deep, evidence-based pass on the five feature branches merged **today**: dashboard-by-role & sign-up, home-lean & the 23 Sep audit-followup fix, the paid page-upgrade & clarity floor, the faster sign-up/gig wizard, and verified reviews + Google import.

Note on tooling: the task asked to use "Obsidian" to find what was recently added. No Obsidian connector is configured in this environment, so `git log` was used instead to identify recent work — same goal, different tool.

---

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 1 |
| Medium | 2 |
| Low/Informational | 6 |

**Do first:**
1. **Fix the sign-up/gig-wizard draft-resume bug (High)** — someone who abandoned the "create a gig" wizard in the last 7 days, before today's step-renumbering shipped, can resume their saved draft and publish a service listing with zero priced tiers/products, skipping the screen where those are entered.
2. **Finish the tap-target/contrast fix that was only half-applied (Medium)** — yesterday's audit fixed the switch style in 2 of 4 places sharing the same broken markup, and fixed tab-strip sizing in 2 of ~4 places using the shared `.wh-tab` class.
3. **Re-establish the nightly audit cadence.** The last full site-audit before tonight's was 8 days ago (14 Sep); in between, 95 commits landed unaudited, including a paid feature and a new reviews/PII surface. Tonight found nothing catastrophic in that backlog, but that's partly luck — the schedule should not have a week-long gap.

Also: the **mandatory live price check could not run** — the outbound proxy in this environment returned `403 Forbidden` reaching `myisraelrental.com`. This is an environment limitation, not a finding about the site; see "Not checked."

---

## Findings

### 1. HIGH — Draft resume after the gig-wizard renumbering can publish a listing with no priced offerings
**File:** `frontend/src/pages/CreateGig.jsx:97` (the `step > totalSteps` clamp added in fc41400), combined with `readDraft('create-gig')` and `useFormDraft.js`'s 7-day draft retention.

Today's "Quicker sign-up and first listing" commit (fc41400) collapsed the gig-creation wizard from 5–6 screens to 3–4 and renumbered the `step` values. The only safeguard for an in-flight saved draft is: `if (step > totalSteps) setStep(totalSteps)`. That only fires when the *old* step number exceeds the *new* screen count — it doesn't remap old step numbers to their new meaning.

Concretely, for a non-appointment gig (new `totalSteps = 3`): a draft saved at the old step 3 ("Description") isn't clamped (3 is not > 3), and now renders as the new step 3 — which fc41400 redefined as **Contact/Publish**. The entire merged "what you offer" screen (description + products/tiers, formerly steps 3–4) is skipped entirely. `canNext()`/`nextBlockReason()` on the Contact screen only validate `area` and `whatsapp`, never tiers/products, and since `step === totalSteps` the button already reads "Publish." The same pattern hits appointment-type gigs (new `totalSteps = 4`).

Server-side, `backend/routes/marketplace/shared.py:615-616` confirms `tiers`/`products` default to empty lists with no minimum enforced for deliverable/appointment gigs (a deliberate legacy-compatibility choice) — so this isn't a 500, it's a silent publish with no pricing. (`store`-type gigs are the exception: the backend does reject an empty product list with a 400.)

Because drafts persist for 7 days, this affects anyone who left the wizard mid-way in the week *before* today's deploy, not just people mid-session at deploy time.

**Fix direction:** version the draft (store the wizard's screen-count/schema version alongside the draft) and discard or remap drafts saved under an old version, rather than clamping only by raw step number.

*(Found by the dashboard-by-role/sign-up audit subagent; traced via static code reading, not reproduced live in a browser.)*

---

### 2. MEDIUM — Yesterday's tap-target/contrast fix was applied to 2 of 4 identical toggle switches
**Files:** `frontend/src/components/dashboard/SettingsTab.jsx:378-388` (auto-nudge toggle), `frontend/src/components/dashboard/SavedSearchesTab.jsx:277-288` (flexible-dates toggle).

Today's audit-followup commit (a1a8364) fixed the on/off switch in `EmailSwitches.jsx` and the delivery switch in `OrdersTab.jsx` — bumping them to a 44px tap target and fixing the OFF-state color from low-contrast border-grey (1.28:1) to muted ink (5.7:1). Two other switches sharing the *exact same markup pattern* were not touched:
- `SettingsTab.jsx:378`: `className={\`relative inline-flex h-6 w-11 items-center rounded-full ... ${autoNudgeOptOut ? 'bg-gray-300' : 'bg-[var(--brand-primary)]'}...\`}`
- `SavedSearchesTab.jsx:282`: same `h-6 w-11` sizing, same `bg-gray-300` OFF state.

A user toggling "auto-nudge" in Settings or "flexible dates" in Saved Searches still gets a ~24px tap target and the same low-contrast OFF track the audit was written to fix.

**Fix direction:** grep the codebase for the shared `inline-flex h-6 w-11 items-center rounded-full` + `bg-gray-300` pattern and apply the same fix everywhere it appears, not just the two call sites the previous audit happened to name.

---

### 3. MEDIUM — `.wh-tab` tab-strip class is still under the 44px tap-target bar the same fix established elsewhere
**File:** `frontend/App.css:941-951` — `.wh-tab { padding: 9px 22px; font-size: 14px; ... }`, computing to roughly 35px tall, no `min-height`.

Used by `role="tab"` buttons in `frontend/src/pages/WhyHost.jsx:328-339` and `frontend/src/pages/RequestsBoard.jsx:504,527` (list/map toggle, side filter). Today's fix brought the Growth Guide audience tabs and the Network tab strip to 44px and wired `aria-controls`/tabpanel — but `.wh-tab`, used by two other tab strips, was not part of that pass.

**Fix direction:** same as #2 — this is a "the audit named specific instances, the underlying shared class wasn't fixed" pattern; a shared min-height rule on `.wh-tab` (and confirmation `role="tab"` elements generally meet 44px) would close all instances at once instead of one at a time.

---

### 4. LOW — Plural-form fix (today) covers only the four keys the 22 Sep audit named, not the pattern generally
Today's fix correctly added `_one`/`_two`/`_other` forms (Hebrew's dual `_two` included) to `admin.userRestored`, `admin.recordsCount`, `setup.showDone`, `automations.ranCount`, verified against real call sites that already pass `{ count }`. But `frontend/src/locales/en.js` still has other `{{count}}` interpolations with only an `_other` form and no `_one` (e.g. `usersCount`, `listingsCount`, `reviewsCount`, `bedrooms_other`/`bathrooms_other` with no `_one`), which will still render "1 users" / "1 bedrooms" for a singular count. Not urgent, but it's the same bug class recurring outside the four named keys.

---

### 5. LOW — Google-imported review author names skip the sanitization every other imported field gets
**File:** `backend/utils/google_reviews.py:172` — `"author_display_name": ... reviewer.get("displayName") or "Google user"` is stored raw, while the neighboring `text` and `owner_response` fields are passed through `clean_text()` first.

Not currently exploitable — every consumer (`ReviewsSection.jsx:222`, `ReviewsModerationTab.jsx:77`) renders it as a plain JSX text node, which React escapes automatically, and the one `dangerouslySetInnerHTML` use in that file is native-reviews-only and never sees Google-sourced names. But it's an inconsistency with the code's own stated intent ("output is escaped again wherever it is rendered") and a trap for whoever next adds a consumer of that field (an email template, a CSV export) without re-deriving that it's unescaped.

---

### 6. LOW — Two review/Google routes aren't gated by the feature flags the way every sibling route is
**File:** `backend/routes/reviews.py` — `google_disconnect` (lines 341-354) has no `_need_google()` call, unlike every other Google-import route; the three admin moderation routes (`/admin/reviews/queue`, `/approve`, `/remove`, lines 191-218) check only `_need_admin`, not `_need_native`. Practical exposure is minimal — with the flags off, there's nothing in the review queue and no connection to disconnect — but it contradicts the design doc's claim that "with both flags off nothing on any page changes," and is worth a one-line consistency fix.

---

### 7. LOW — No global kill switch for the new paid "page upgrade" feature
`page_upgrade.py` gates entirely on a per-user Mongo field, set only by an admin via a properly role-checked endpoint (verified — see below). There's no env-level flag to disable the feature for everyone at once, the way `DOCUMENT_SERVICES_ENABLED` gates the discontinued document-services code. Not a bug today (nothing is exploitable), but worth having before this is wired to real payment.

---

### 8. LOW — Frontend build treated as failing under `CI=true`, but that's not how it actually deploys
Running `npm run build` with `CI=true` fails on pre-existing `react-hooks/exhaustive-deps` ESLint warnings being promoted to errors. This is expected and already documented in `docs/railway-deploy.md`: Railway's actual deploy sets a service-level `CI=false` variable specifically because of this. Rebuilt with `CI=false` (matching the real deploy config) and the **build succeeds cleanly** — see Verified Clean. Listing this only so it's not mistaken for a real build break; no action needed.

---

## Verified clean

- **Live price parity** (`backend/tests/test_listing_price_parity.py`) — all 17 cases pass; the site and the server compute every listing's shown price the same way.
- **i18n key parity** — `scripts/test-i18n-parity.mjs`: 3,862 English keys / 3,884 Hebrew keys, every static `t()` call resolves in both languages, no new unpluralised keys introduced. New keys from today's five feature branches (reviews, page-upgrade, dashboard-by-role, gig wizard) all present in both `en.js` and `he.js`, confirmed both by the script and by direct diffing of the wizard's 83-key namespace.
- **Verified reviews & Google import** (bbbf59f–7f29a90): every mutating route traces ownership back to server-loaded booking/business records, never trusts a client-supplied id; one-review-per-booking enforced by both a pre-check and a unique Mongo index; moderation routes require `role == "admin"` server-side; no PII (email/phone/user id) in any public review response; both feature flags default off in `.env.example` and gate all read/write routes (bar the two Low findings above); reason codes for removal/report are hard-allowlisted server-side; Google credentials read from env only, refresh tokens encrypted at rest; imported review/reply text sanitized; bilingual and RTL conventions followed throughout.
- **Paid page-upgrade & clarity floor** (ecd7521–fddd495): the entitlement flag is set only via an admin-role-checked endpoint (confirmed 403 for a non-admin owner trying to flip it on themselves, and confirmed via test); `ProofLine.jsx`'s rating/credential display traces every value to a real DB-backed field, explicitly does not render on zero real signals (Playwright test asserts this), and never shows an invented number — the exact bug class this repo has shipped before; clarity-floor logic matches its own test suite, and the tests are substantive (bilingual, category-gated, empty-state-aware), not tautological; no hardcoded colors or `Playfair Display` inline styles in any new file.
- **Contract-status access fix** (b1822ea, today): confirmed this closes a real bug — before, `GET /properties/{id}/contract` had no auth and returned contract status to anyone; after, it requires a token and checks admin / owner / renter-with-a-matching-booking, matching the rule CLAUDE.md documents for the other contract endpoints. New test covers all four access cases correctly.
- **Home-lean perf change** (9a64c55, today): no catalogue-size stat is shown anywhere on the new home page, so there was no "invented number" risk to begin with; featured/newest listing fetches are pre-existing, real, server-computed endpoints.
- **Rate limiting on the two public unsubscribe endpoints** (today's fix): real per-IP sliding-window limiter (`utils/rate_limit.py`), not a frontend debounce; correctly hard-disabled-only-locally, refused outright if `RAILWAY_ENVIRONMENT` is present.
- **Sign-up/dashboard ownership** (dashboard-by-role, today): a client-supplied `business_id` cannot attach a new gig to someone else's business (server checks `owner_user_id` and falls back to the caller's own default business); "sign-up fills the business page" only copies real description/area text the user entered, never a rating or count.
- **Discontinued features stay off**: no new UI surfaces the `storage` rental type (one file change actively *removes* it from a public tab, with a comment citing CLAUDE.md); `DOCUMENT_SERVICES_ENABLED` untouched by recent work.
- **Payment-link allowlist** (pre-existing infra, spot-checked): matches on registrable domain (`host == d or host.endswith("." + d)`), not vulnerable to the `evil-paybox.com` bypass CLAUDE.md warns about.
- **Secrets hygiene**: `backend/.env`, `frontend/.env`, `backend/.r2.env` all covered by `.gitignore`; `.env.example` contains only placeholder values, no real secrets.
- **Documentation**: every doc/file CLAUDE.md cites (design tokens, mockups, specs, scripts) actually exists on disk.
- **Theme scoping**: `scripts/test-theme-scope.mjs` confirms the experimental theme CSS stays scoped to `/home-preview` only, as CLAUDE.md requires.
- **Production build**: `CI=false npm run build` (matching Railway's real deploy config) compiles successfully; the only ESLint warnings present pre-date today's work (spot-checked two via `git blame`, both from 7 Sep).

---

## Not checked

- **The mandatory live price check did not run.** `python3 backend/scripts/live_price_check.py` failed with `PRICE CHECK DID NOT RUN: could not read https://myisraelrental.com/api/properties (403 Forbidden)` — this environment's outbound network proxy blocked the request at the tunnel level. This is a network-policy limitation of tonight's sandbox, not a statement about the live site. **Should be re-run from an environment that can reach the production domain before trusting that no live-listing price bug (the Sukkot-price class of bug) is currently on the site.**
- **~90 commits merged between 15 Sep and 22 Sep** were not individually re-audited tonight (business subdomains, restore-drill backup tooling, brand-green fix, business flyers, and others) — tonight's deep-dive budget went entirely to what merged *today*. The business-subdomains feature is explicitly flag-gated off in code, which lowers but doesn't eliminate the risk of leaving it unreviewed this long.
- Visual/RTL screenshot comparison (`visual-diff` skill) was not run this pass — this was a code-and-logic audit, not a pixel-diff pass.
- Lighthouse accessibility scoring, keyboard-focus order, and modal `role="dialog"` checks were not performed.
- `backend/scripts/migrate_reviews.py`, `seed_reviews_dev.py`, `clarity_report.py`, and the page-builder's pre-existing (not-today) editor components (`BusinessPageEditor.jsx`, `PageBriefForm.jsx`, `PageThemeDials.jsx`) were not read.
- npm audit flagged 39-42 vulnerabilities, all in transitive CRA/webpack build tooling (react-scripts, webpack-dev-server, workbox, jsonpath), none in runtime application code shipped to users — not investigated further as this is pre-existing and would require a react-scripts major-version change to clear.
