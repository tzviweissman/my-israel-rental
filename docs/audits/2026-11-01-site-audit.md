# Code review, 1 Nov 2026

## In short
- Nothing broken found in the last day's changes (the businesses list showing all businesses, the new ad designs and reviews on ads).
- This run could not test the database-backed parts: the sandbox could not download MongoDB (403) or a browser, so the new "show every business" tests could not run. The same gap was reported on 25 and 29 Oct.
- Fixed tonight: nothing. Needs your decision: nothing.

## New findings
None confirmed.

## Fixed this run
None.

## Still open
- Audit sandbox has no MongoDB or browser (since 15 Oct), plus `pytest_asyncio` missing from the venv (3 test files fail to collect). See open-issues.md.

## Could not confirm
- `limit=0` on the public gigs list reads all published listings per request (gigs.py ~line 258, author's own `ponytail` note). Fine at 62 listings; would need a load test at thousands to confirm a problem.

## Verified working
- `tests/test_listing_price_parity.py`: 17 passed. All `scripts/test-*.mjs` pass.
- New i18n keys (ads.*, services.showMore) exist in both en.js and he.js; no long dashes or exclamation marks in the new strings.
- `make_ad` additions (items, faqs, reviews) only use data the public page already shows; reviews are filtered through `visible_query` and the switched-on sources; endpoint still requires login.
- Services page: `limit=0` accepted by the route (`ge=0, le=200`), result sliced after sort.

## Not checked
- FAILED mongodb on :27017 (download returned 403), so SKIPPED api; DB tests (test_gigs_list_all.py, full suite) errored, not passed.
- FAILED playwright + chromium (download failure): no screenshots, no Hebrew render.
- Production build not run (time spent waiting on setup).
- PRICE CHECK DID NOT RUN: the sandbox proxy blocks myisraelrental.com.
