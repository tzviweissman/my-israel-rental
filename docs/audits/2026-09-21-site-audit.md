# Site audit — 2026-09-21

Scope: everything committed since the last audit (`docs/audits/2026-09-15-ui-audit.md`), i.e. `git log --since="2026-09-15 22:01"` on `main` up to `beccaef` (2026-09-20). That window includes: the sublease sign-token leak fix, the home page becoming `HomePreview.jsx`/`home-v2`, the "one price rule everywhere" refactor and nightly live-price-check script, demand/visitor reporting on the admin overview, sign-link expiry, storage-rental removal from create/search paths, and Hebrew city names on Stays.

**Process note:** the scheduled prompt asked to use Obsidian to find what was recently added. No Obsidian connector or vault is reachable from this session (same as every prior audit that tried) — recency was determined from git history instead, which the skill treats as the documented substitute.

## Summary

No Critical or High severity findings. The one security bug in scope (public sublease reads leaking a contract `sign_token`) was already fixed on 2026-09-20, before this audit ran, and the fix is sound. Three things worth doing first:

1. Give `test_sublease_public_no_sign_token.py` a real HTTP assertion, not just a source-text check (Medium — see Security).
2. Add `test_pricing_audit.py`'s URL pattern to conftest's live-API skip detection, or it reports false failures with no server running (Low, test-infra).
3. Name the hardcoded `#00387B` hero-only blue as a real token if the pattern spreads beyond these two rules (Low, design-system).

## Findings

### Medium

**Sublease sign-token regression test only checks source text, not the live response** — `backend/tests/test_sublease_public_no_sign_token.py`
The fix itself (`backend/routes/subleases.py:101`, `_PUBLIC_FIELDS = {"_id": 0, "sign_token": 0}`, applied via Mongo projection at both `list_subleases` (line 115) and `get_sublease_by_id` (line 122)) is correct and verified directly — confirmed by reading the file. But its regression test never calls the API: it reads `subleases.py` as a string and asserts `"_PUBLIC_FIELDS" in body` for each function. That catches someone deleting the projection from these two functions, but not a future third public read that forgets to use it, or a refactor that keeps the variable name while reintroducing the field elsewhere. Impact: the test suite reads as stronger coverage of this exact bug class (which has recurred before per `CLAUDE.md`'s contract-storage section) than it actually is.
*Suggested fix:* add one `TestClient` call per public route asserting `"sign_token" not in response.json()` on the live response, alongside the existing check.

### Low

**Hardcoded hex outside the documented exception** — `frontend/src/styles/home-v2.css:95` and `:449`
`.hv2-gradient-word { color: #00387B; }` and `.hv2-hero--film h1 .a { color: #00387B; }`, both touched in the 18 Sep tagline commits. `#00387B` isn't defined as a token anywhere in `theme-flow.css` or `brand/design-tokens.css`. It's justified by a code comment citing measured contrast (the standard `--gold-lg` reads 1.3–2.8:1 over this video, a darker hero-only blue keeps it readable), so it's deliberate and documented, not an oversight — but `docs/hero-cinematic-spec.md`, the one documented hex exception, covers the older CinematicHero, not this LoopHero/BlocksHero hero. Not urgent; if more hero-only colors accumulate this way, give them a real token name (e.g. `--hero-accent-on-video`) instead of a bare hex justified only by a comment.

**`test_pricing_audit.py` isn't caught by the live-API skip heuristic** — `backend/tests/conftest.py:74`, `backend/tests/test_pricing_audit.py:14-15`
`conftest.py`'s `_LIVE_API_MARKERS = ("TEST_API_BASE", "localhost:8001")` skips any test module containing those literal substrings when no backend is running — exactly the mechanism the file's own comments say exists because unreachable-server failures "reported red tests that said nothing at all about the code." `test_pricing_audit.py` instead computes its base URL as `os.environ.get("REACT_APP_BACKEND_URL", ...)`, which conftest itself defaults to `http://localhost:8001` — so the resulting requests do hit `localhost:8001`, but the literal string never appears in the file's source, so the skip logic misses it. Confirmed by running it standalone with no server up: 3 tests fail and 10 error with `ConnectionError`/`Max retries exceeded`, instead of skipping. Not a product bug — this file predates this audit window and only had a two-line touch on 18 Sep — but it undermines exactly the signal the skip logic exists to protect, and it happened to be one of the files touched by this week's pricing work.
*Suggested fix:* add `"REACT_APP_BACKEND_URL"` to `_LIVE_API_MARKERS`.

**Owner-facing demand table shows only the English title** — `backend/routes/marketplace/gigs.py`, `leads_summary`'s `by_gig` rows
Both before and after the 18 Sep demand-reporting change, these rows project `title` only, never `title_he`. Not a regression (same on both sides of the diff), but worth a look if this table is ever meant to show a Hebrew-UI owner their listing's Hebrew title — currently it can't.

### Info / doc drift

**CLAUDE.md's description of `/home-preview`'s body classes is imprecise.** It reads as if `home-v2` and `theme-preview` are either/or by route. Actual code (`HomePreview.jsx:65-87`) adds `home-v2` unconditionally on every mount and adds `theme-preview` only when the path starts with `/home-preview` — so `/home-preview` itself carries *both* classes at once, not just `theme-preview`. Doesn't weaken the safety rule (`theme-preview` still never reaches `/`, confirmed below), just worth tightening the wording next time that section is touched.

## Verified clean

- **The sublease sign-token leak (commit 54a0217) is genuinely fixed.** Read `subleases.py` directly: the Mongo projection is applied at both public read sites, nothing else in the file or in `contracts.py`/`marketplace/orders.py` reintroduces the token to an unauthenticated response.
- **Sign-token expiry (commit 848a6ba) is real server-side enforcement**, not cosmetic: `load_contract_by_sign_token` in `utils/contract_files.py` is the single choke point for all three sign-token routes and raises 410 past the deadline; no route bypasses it. Concurrent-signature protection is an atomic `find_one_and_update` with `{"signed": {"$ne": True}}` in the filter.
- **The booking-flow `contract_sign_token` is a distinct, unaffected mechanism** — never used as a public lookup key, only reachable authenticated with an ownership check.
- **New admin/demand endpoints are correctly gated.** `admin/core.py`'s metrics endpoints check `role == "admin"`; `properties/browse.py`'s performance summary scopes every query to `owner_id = user["user_id"]` from the verified token; `site_visits.py` is write-only, stores no IP/UA/account id, and exempts admins from being counted.
- **Order-tracking bearer token** (`/orders/track/{token}`) correctly withholds courier PII, same class of link as the sublease sign-token, functioning as designed.
- **Home page theme scoping is correct and matches the hard rule in CLAUDE.md.** `home-v2` is added on every mount; `theme-preview` is added only when the path starts with `/home-preview`. `theme-preview` never reaches `/`. `node scripts/test-theme-scope.mjs` runs clean (exit 0): "all experimental themes are preview-only."
- **No undefined CSS variables, no RTL Playfair-inline violations, no `HeroSlideshow` style-prop bug** in `home-v2.css` or the touched home components — `LoopHero.jsx` has no display text and no `<HeroSlideshow>` usage (replaced by the loop video).
- **Bilingual coverage is 100% project-wide.** `scripts/test-i18n-parity.mjs`: 3312 `en.js` keys, 3320 in `he.js` (the extra 8 are legitimate Hebrew dual-plural forms), every `t()` call resolves, no key used in the app is missing from either file — including in the newest files (`Terms.jsx`, the home-redesign components). No hardcoded English strings found in `Terms.jsx`, `WhatYouCanDo.jsx`, `LoopHero.jsx`, `BusinessPage.jsx`, `Services.jsx`.
- **Storage-rental removal (commit 2c6240e) matches CLAUDE.md's "clean up separately" guidance**: create/search paths now refuse it; existing storage listings still load and are still findable in the admin filter, as intended. `DOCUMENT_SERVICES_ENABLED` is untouched and still off.
- **All docs cited in CLAUDE.md exist** on disk (`emergent-exit-checklist.md`, `hero-cinematic-spec.md`, `redesign-and-wanted-board-prompt.md`, `acceptance-checklist.md`, `uptime-monitoring.md`, `business-subdomains-setup.md`, `railway-deploy.md`, `brand/voice.md`).
- **Frontend production build succeeds.** Only warnings present are pre-existing (a `react-hooks/exhaustive-deps` warning in `App.js` that predates this window, and pre-existing Tailwind ambiguous-class warnings) — nothing new from this week's diff.
- **Frontend test suite: 119/119 pass**, across all 5 suites including the two newest (`listingPrice.test.js`, `smartListText.test.js`).
- **Backend price-parity suite: 17/17 pass** (`test_listing_price_parity.py`) — the website and server compute every listing's price the same way, per the skill's required check.
- **The other 9 backend test files touched by this week's work** (sign-token expiry, order-status race, admin delete cascade, contract-sign race, rental-type gate, demand reporting, site visits, smart-list holiday prices, and the sublease token fix's own test) collect cleanly and correctly self-skip without a live backend running, except the sublease test, which runs standalone and passes.

## Not checked

- **Live listing prices** (`backend/scripts/live_price_check.py`) — this session's outbound network policy returned `403 Forbidden` reaching `myisraelrental.com` through the proxy. This is a restriction of this sandboxed session, not a finding about the site. **Genuinely not checked tonight** — treat as unknown, not clean.
- **Full backend pytest suite** (`backend/tests/` as a whole) — hung past a 280-second timeout with zero output in this session (no local MongoDB, no `backend/.env`). Ran targeted subsets instead (see Verified clean); did not get suite-wide coverage.
- **Visual/RTL screenshots** — no dev server was started this session; did not render any page or compare against the design mockups.
- **Contrast measurements** cited in `home-v2.css`'s code comments — taken as documented, not independently re-measured against actual video frames.
- **`gigs.py`'s demand-table code path end-to-end** — read structurally (matches the ownership-scoping pattern used elsewhere), not traced line-by-line the way the equivalent `browse.py` endpoint was.
