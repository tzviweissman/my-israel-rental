# Code review, 13 Oct 2026

## In short
- Nothing broken for customers turned up in the last day's backend changes (drop-shipping, restaurants, services, subscriptions). The 71 tests written for them pass and the site builds.
- Hebrew readers of the Jobs board saw the area filter in English because two strings were missing. Fixed tonight.
- Needs your decision: one small sign-in item (the new restaurant admin token) returns an error page instead of a clean "not allowed" when someone sends odd characters. Not a way in; touches sign-in, so it is reported, not fixed.

## New findings
1. [Low] Auth: `backend/routes/restaurants.py:49` compares the `X-Restaurant-Admin-Token` header with `hmac.compare_digest(str, str)`. A header with a non-ASCII character raises `TypeError: comparing strings with non-ASCII characters is not supported` (reproduced with `hmac.compare_digest('ééé','a'*32)`), so an unauthenticated caller gets a 500 instead of 401 once the token is set. Not a bypass. Fix: compare `given.encode()` with `secret.encode()`. Not fixed: it is sign-in code.
2. [Low] i18n: `scripts/test-i18n-parity.mjs` fails on `restaurants.more` (`frontend/src/pages/Restaurants.jsx:317` passes `count` with no plural set). First seen 8 Oct, not from today's commits. Harmless in English.
3. [Low] Business checklist: `scripts/test-completeness-actions.mjs` fails: the "category" item opens a form with no category control. Pre-existing, not from the last day's commits.

## Fixed this run
- 51649002: added `jobsBoard.areaPh` and `jobsBoard.areaFreeText` to `en.js` and `he.js` (were missing; seen in `JobsBoard.jsx:205-206`). Checked: the i18n parity script's missing-key check now passes; `craco build` passes.

## Still open
- See `open-issues.md` (page editor link filter; support@ mailbox check).

## Could not confirm
- `routes/marketplace/dropship.py` `_on_supplier_status` rewrites the whole `supplied_parts` list; two suppliers moving their parts at the same instant could overwrite each other's status on the store's order. Needs a concurrent test against a real database.

## Verified working
- 71 new and related backend tests pass (dropship, bulk alerts, reply-to email, gig and request edits, restaurant emails and jobs, subscription summary, listing price parity).
- Dropship routes: every store and wholesale route checks listing ownership; partner links are checked as accepted connections on set and on order; the public tracking view hides the supplier's name.
- Restaurant admin token is off unless 32+ characters and covers listing routes only (claims and submissions still need an admin session).
- Production build passes. 9 of 11 `scripts/test-*.mjs` pass.

## Not checked
- FAILED  playwright + chromium (setup could not install the browser)
- FAILED  mongodb on :27017 (download returned 403); API not started
- Full backend suite: needs a real database; only the mock-database tests above were run.
- PRICE CHECK DID NOT RUN: the sandbox proxy blocks myisraelrental.com.
- Dependency audit, screenshots (UI audit's area).
