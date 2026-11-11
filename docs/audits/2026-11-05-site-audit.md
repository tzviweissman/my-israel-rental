# Code review, 5 Nov 2026

## In short
- Tonight's six commits (order-text number, ads, ad cut-outs) have no confirmed bugs. The order, ad and price tests pass.
- One small check was failing: the new visit counters in the ads screens were not set up for singular and plural. The wording is unaffected for customers; fixed.
- Fixed tonight: visit-count wording keys (branch claude/exciting-bell-fhelsf, commit 512b5b0).
- Not checked: the full test suite, the production build and Chromium. The audit setup hung for over 40 minutes (the site's dev server step) and was abandoned.

## New findings
- [Low] `test-i18n-parity` failed: `ads.nudgeVisits`, `ads.weekVisits`, `advertising.visits` used `{ count }` with no plural forms. Output: "FAIL no NEW t(key, { count }) without a plural set (3)". Fixed, see below.

## Fixed this run
- 512b5b0: renamed the variable to `n` in en.js, he.js and 3 call sites. `node scripts/test-i18n-parity.mjs`: all i18n checks passed.

## Still open
See open-issues.md. Cut-out URL check (first seen 2 Nov): `cutout_url` still fetches the owner's photo URL; unchanged.

## Could not confirm
- Site-wide ads (`target_type "site"`) are admin-only via `_assert_owns_target`; verified by reading, not by request.

## Verified working
- `tests/test_order_texts.py`, `test_ad_cutout.py`, `test_listing_price_parity.py`: 33 passed, 1 skipped (run with a throwaway JWT secret and MONGO_URL, no database needed).
- Chosen text number: only the owner's settings endpoint returns it; the public order page does not. The number is validated before it is saved.
- en.js and he.js gained the same 30 keys.
- All other `scripts/test-*.mjs` pass.

## Not checked
- audit-setup.sh never finished (stuck at "craco start" after 33 minutes), so no local database, no browser, no `craco build`, and only 3 backend test files ran, not the full suite.
- Live price check: the sandbox blocks the live site (not run).
