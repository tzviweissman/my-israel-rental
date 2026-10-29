# Code audit, 25 Oct 2026

## In short
- Nothing broken found in last day's backend, server or script changes. The listing Publish fix (blank time or number boxes) passes its test and the price-parity test passes (18 passed).
- Low: a time window with only one time filled in (say opens 9:00, end left blank) is now dropped silently instead of refused, so an owner can save a day as closed without being told.
- Not checked: the full backend test suite and the live price check could not run here (no database, and the live site is blocked in this sandbox).
- Fixed tonight: nothing (nothing small and safe to fix).
- Needs your decision: whether a half-filled time window should be dropped quietly or shown as a message.

## New findings
1. **Low, data/UX.** `backend/routes/marketplace/shared.py` `clean_weekly`: `{"mon":[{"start":"","end":"17:00"}]}` becomes `mon: []` (closed). Proof: `backend/tests/test_gig_input_cleanup.py` asserts exactly this and passes. Impact: an owner who forgets one time box saves that day as closed with no warning. Fix idea: keep refusing a half-filled window, or have the form warn. Product choice, not fixed.

## Fixed this run
None.

## Still open
- i18n parity: `awayReply.body` plural-check failure in `scripts/test-i18n-parity.mjs`. Fix exists as 3361830 on `origin/claude/exciting-bell-n2kxz0` (24 Oct), not yet on main.
- Everything else in `open-issues.md` unchanged.

## Could not confirm
- Nothing.

## Verified working
- Reviewed the 26h diff of backend/, frontend/src/pages, scripts/publish-page.mjs: `apiErrorMessage` exists in `utils/apiError.js`; `useShowcase` is exported; the 422 handler logs field names and types only, not values.
- `test_listing_price_parity.py` and `test_gig_input_cleanup.py`: 18 passed.
- Production build (`craco build`) completes.
- 10 of 11 `scripts/test-*.mjs` pass (the failure is the awayReply item above).
- No secrets in the diff. `he_line.py` reads its key from env and never prints it.
- Note: `scripts/publish-page.mjs` fetches myisraelrental.com's public API when publishing a new site (offline fallback exists). It is a local author tool, not run by audits.

## Not checked
- FAILED  playwright + chromium (setup)
- FAILED  mongodb on :27017 (setup); SKIPPED api (no database). The full backend suite errors at collection (`KeyError: 'MONGO_URL'`), 741 errors / 875 skipped, so it is not a pass.
- PRICE CHECK DID NOT RUN: live site blocked by the sandbox proxy (403).
- Visual and accessibility checks (UI audit's area).
