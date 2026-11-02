# Code audit, 28 Oct 2026

## In short
- No customer-facing breakage found in the last day's backend and server changes (Stays totals for chosen dates, "usually replies within" line, owner-added list lines on hand-built pages).
- Fixed tonight: the new reply-time line used a wording setting that the translation check treats as a plural; renamed so the check passes again. Nothing changes on screen. Branch `audit/code-2026-10-28`.
- Not checked: the local test site could not start (no database download, no browser download), so the booking and chat tests did not run.

## New findings
None confirmed.

## Fixed this run
- `stays.repliesWithinHours` used `{{count}}` without plural forms, which failed `scripts/test-i18n-parity.mjs`. Renamed the variable to `hours` in en.js, he.js and BookingSidebar.jsx. Afterwards the test lists only the older `awayReply.body`. The component only shows the key for 2 to 12 hours, so no reader saw "1 hours".

## Still open
- `awayReply.body` (dashboard away-reply card) uses `{{count}}` minutes with no plural forms; fails test-i18n-parity. First seen in code of 25 Oct, found 28 Oct. Low.

## Could not confirm
- `POST /properties/quote-batch` is public, takes up to 200 ids and prices each; it matches the single quote's openness but a rate limit would be worth confirming against a live server.

## Verified working
- Reviewed diffs of page_edits.py (the `add` lines are cleaned like text, capped at 20 lines and counted in the 600-key limit), applyEdits in server.js (key validated by regex before use), quote-batch (same price function as the single quote), reply_time.py (messages store ISO strings, so the date filter works).
- Offline: tests/test_listing_price_parity.py, test_quote_batch.py, test_reply_time.py, test_page_edits.py: 39 passed. Frontend production build passes. All scripts/test-*.mjs pass except the i18n one above.

## Not checked
- audit-setup.sh: Playwright Chromium download FAILED (cdn.playwright.dev blocked, 403); local MongoDB not available, so the full backend suite and `?as=owner` screens were not run.
- PRICE CHECK DID NOT RUN: could not read myisraelrental.com/api/properties (proxy 403), expected in the sandbox.
