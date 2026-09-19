# Site audit, 19 Sep 2026

Scope: everything committed since the last audit (2026-09-15), i.e. the whole
16–18 Sep run — the admin demand/visitor reporting feature, the "one price
rule" project (Smart Lists, Stays cards, the map strip, the nightly live
price check itself), and the home-page relaunch (`HomePreview.jsx` promoted
to `/`, the full-bleed hero video, the hero tagline fix). 32 commits, 12
merged feature branches. Read-only pass, per `.claude/skills/site-audit/SKILL.md`.

## Summary

- **Critical: 0. High: 0. Medium: 1. Low: 0.**
- Nothing broke. The three things worth knowing:
  1. The live price check (the highest-priority item in the audit) **could
     not run tonight** — this sandbox's network policy blocks outbound
     requests to `myisraelrental.com` (and to Railway's own subdomain).
     Production itself is unaffected; this is a checker-environment gap, not
     a site problem. See "Not checked."
  2. All 17 `test_listing_price_parity.py` cases pass — the site and the
     Smart Lists still price every listing exactly the same way.
  3. Found one real bug, in the test suite's own safety net: 45 backend test
     files that need a live server are **not** recognized by the skip logic
     that exists specifically to catch that case, so a plain `pytest` run in
     an environment with no server produces false failures instead of clean
     skips. Detail below.

## Findings

### [Medium] The "skip tests that need a live server" fix doesn't cover the pattern it was built for

**What it is:** `backend/tests/conftest.py` (lines 70–92, 215–229) skips any
test file that needs a running backend, detected by checking each file's
source for the substrings `"TEST_API_BASE"` or `"localhost:8001"`. The
docstring above it explains exactly why: without this, a test hitting a dead
server fails instead of skipping, and a real regression becomes
indistinguishable from "nobody started the server." But 49 test files still
resolve the backend URL the *old* way —
`os.environ.get("REACT_APP_BACKEND_URL", "https://...emergentagent.com")` —
and only 33 files contain either marker substring. **45 files use the old
pattern and are invisible to the skip check.**

**Evidence:**
```
$ grep -lE "REACT_APP_BACKEND_URL|emergentagent\.com" backend/tests/*.py | wc -l
49
$ grep -lE "TEST_API_BASE|localhost:8001" backend/tests/*.py | wc -l
33
# 45 files are in the first set and not the second, e.g.:
backend/tests/test_pricing_audit.py
backend/tests/test_payments.py
backend/tests/test_marketplace.py
backend/tests/test_security_audit.py
backend/tests/test_smart_pricing.py
# ...and 40 more
```
Confirmed live: running `test_pricing_audit.py` with no backend up produced
**3 failed + 10 errors** (connection refused to `localhost:8001`) instead of
skips — the exact failure mode the fixture's own comment says it exists to
prevent.

**User-visible impact:** none directly — this is test infrastructure, not
site behaviour. The impact is on whoever reads CI/test output next: with no
server running, ~45 files (including `test_pricing_audit.py`, which guards
the pricing-audit admin tooling and the route-ordering regression it names
by name) report red for a reason that has nothing to do with the code,
which is exactly the "a real regression would be indistinguishable from
noise" problem `conftest.py` was written to solve.

**Suggested fix:** widen `_LIVE_API_MARKERS` in `conftest.py` to also match
`"REACT_APP_BACKEND_URL"` (all 49 files contain that literal string), or —
cleaner — check for the substring `emergentagent.com` specifically, since
every affected file still carries that dead fallback host.

## Verified clean

- **Listing price parity**: `backend/tests/test_listing_price_parity.py`,
  all 17 cases pass — `utils/listing_price.shown_price` (backend),
  `utils/listingPrice.js` (frontend) and the Smart List text builder agree
  on what price a listing shows in every scenario the suite covers
  (nightly, monthly, holiday lump sum, per-night holiday, mixed currency,
  short-term-priced-nightly, no price at all).
- **Bilingual keys**: `node scripts/test-i18n-parity.mjs` — every `t()` key
  used anywhere in the frontend, including all new keys from this run
  (`home.v2.*`, `admin.demand*`, `admin.overview.siteVisitors*`, etc.),
  exists in both `en.js` and `he.js`. No silent English fallback.
- **RTL / Playfair trap**: no inline `fontFamily: 'Playfair Display'` in any
  file touched this run (`HomePreview.jsx`, `LoopHero.jsx`, `BusinessPage.jsx`,
  `Services.jsx`, `WhatYouCanDo.jsx`).
- **Theme scoping**: `node scripts/test-theme-scope.mjs` passes — the home
  page relaunch (`e2a42fb`) correctly splits `home-v2` (ships everywhere)
  from `theme-preview` (stays on `/home-preview` only), matching the 3 Sep
  rule in `CLAUDE.md`.
- **Design tokens / hero exception**: the two hardcoded hex values added in
  the hero commits (`#00387B` in `a2ae6b7`, `5f5919a`) are both inside
  `.hv2-hero` / `.hv2-hero--film` — the one section `CLAUDE.md` explicitly
  exempts from the no-hardcoding rule. The commit message documents measured
  contrast (4.7–7.7:1 across 8 frames, both languages, replacing a
  1.3–2.8:1 failure) rather than an eyeballed guess.
- **Copy ruling**: `BusinessPage.jsx`'s CTA now reads "List your business,
  free" (comma, not em dash) — matches Tzvi's 16 Sep ruling recorded in
  `CLAUDE.md`. Grepped the new `home.v2.*` / `admin.*` copy for invented
  numbers ("500+", star ratings, fake counts) — none found; the new
  visitor/demand figures are compiled entirely from `t()` keys with no
  embedded numbers.
- **New admin endpoints are auth-gated**: `/admin/metrics` (site visitors,
  demand) and `/admin/metrics/by-user` (per-person WhatsApp/visitor/QR
  numbers, which does return name/email) both 403 anything that isn't
  `role == "admin"` before touching the query — `backend/routes/admin/core.py:160`,
  `:265`. The email in the per-user breakdown is admin-only, not public, so
  it doesn't trip the "no email in a public response" rule.
- **Site-visit tracker privacy**: `backend/routes/site_visits.py` /
  `frontend/src/components/SiteVisitTracker.jsx` — stores day + anonymous
  browser id + a counter, nothing else; no page path (deliberately, to avoid
  ever logging a `/sign/<token>` or `/orders/track/<token>` URL); excludes
  bots and admins server-side.
- **Production build**: `npx craco build` (no CI flag) compiles clean and
  produces a working bundle. `CI=true craco build` fails on ESLint
  `exhaustive-deps` warnings, but every flagged line pre-dates this run (git
  blame traces them to 9 Sep or earlier) — not a regression, and not what
  Railway's Railpack build actually runs.
- **Frontend unit tests**: `listingPrice.test.js` and `smartListText.test.js`
  — 57/57 pass.
- **Deploy state**: confirmed via Railway MCP — both the frontend and
  backend production services build from `main` at Railpack, and `main` is
  even with this session's branch (no unmerged gap); last deploy succeeded
  2026-09-18 21:53 UTC, right after the last commit in this run.

## Not checked

- **The live listings' prices** (`backend/scripts/live_price_check.py`) —
  this session's outbound network is proxied and returned `403 Forbidden`
  (Tunnel connection failed) for both `myisraelrental.com` and Railway's own
  `*.up.railway.app` domain. Not a site problem — the deploy itself is
  healthy (see above) — but the actual live-listing data (the check this
  audit exists to prioritize) was not inspected tonight. Worth re-running
  from an environment with normal internet access before relying on its
  silence.
- **The 45 test files identified above**, and everything else that needs a
  running backend (bookings, payments, marketplace, security-audit,
  smart-pricing tests) — no FastAPI process or real MongoDB in this sandbox
  (no `backend/.env` at all; this is a fresh container). Would need
  `uvicorn server:app --port 8001` plus a Mongo instance to actually execute
  rather than skip.
- **Visual/RTL screenshots** (`visual-diff` skill, Lighthouse, keyboard
  focus order) — not run this pass; would need a live dev server and a
  browser session, which wasn't set up for this text-only pass.
- **Double-booking / availability subtraction** and other data-integrity
  items from the skill's section 6 — no changes touched booking/availability
  logic this run, so not re-checked; still the known standing gap noted in
  the skill file.
