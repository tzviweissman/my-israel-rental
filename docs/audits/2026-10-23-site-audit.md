# Code audit, 23 Oct 2026

## In short
- Nothing new broken in the last 26 hours of backend changes. The table ordering codes, the new-leads-only board, the calendar feed without customer contact details, the gift card email limits and the delivery wording fix all behave as intended in the tests that could run.
- Fixed tonight: nothing needed fixing.
- Needs your decision: nothing.

## New findings
None.

## Fixed this run
None.

## Still open
- Audit setup cannot download Playwright or MongoDB in the sandbox (see open-issues.md, first seen 15 Oct).

## Could not confirm
- Table codes: a business that already had table ordering on but never opened the table sheet has no key, so every table order is refused until the owner opens it (no business had it on, per the commit). Two sheet loads at the same moment could also create two keys and print stale codes. Would need a database to show.

## Verified working
- Tests for the changed code (table codes, leads, delivery wording, tables and pairings, calendar, listing price parity): 30 passed.
- All 11 `scripts/test-*.mjs` pass. Production build passes.
- The table key is not in any public business payload (`_public` is an explicit field list); the order page sends the `k` code as `table_code`.
- The "no delivery" pattern: 7 sample phrases classified as expected, no slowdown on a 30,000-word input.

## Not checked
- FAILED mongodb on :27017 and playwright + chromium (403 from the sandbox proxy). The full backend suite hangs without a database (and 3 async test files need pytest-asyncio), so only the tests listed above ran.
- Live price check: not run (the sandbox blocks the live site).
