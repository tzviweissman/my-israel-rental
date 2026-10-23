# Code audit, 19 Oct 2026

## In short
- Last day's new backend work (calendar sync, counter sales, "Ask for a change", Shabbat closing, order limits, courier route) read clean for permissions: every owner action checks the business belongs to the caller, and the calendar address an owner pastes is checked so it cannot point at our own servers. No money, sign-in or contract problem found.
- Hebrew readers still see English on the shop "add to order" buttons (one more, one less, send, out of stock) and on two Jobs board labels: 14 texts exist in neither language file. Older than a day, but never listed before.
- One dashboard check fails: the "category" item in the business setup checklist sends the owner to a form that has no category control.
- Fixed tonight: nothing (no small, safe fix qualified).
- Needs your decision: the private calendar address for a business lists customers' phone numbers and delivery addresses. Anyone holding the link sees them; "Reset links" cancels it. Keep as is, or drop phone and address from the feed?

## New findings
1. [Medium] Hebrew: `basket.*` (12 keys, `components/marketplace/CardAction.jsx`) and `jobsBoard.areaFreeText`, `jobsBoard.areaPh` (`pages/JobsBoard.jsx`) are in neither `en.js` nor `he.js`. The code passes an English default, so English users are fine and Hebrew users get English. Proof: `node scripts/test-i18n-parity.mjs` prints "FAIL every t() key in the app exists in en.js (14)" and lists them. Fix: add the 14 keys to both files with natural Hebrew (about 28 lines, over the small-fix limit).
2. [Low] Dashboard: setup checklist item "category" opens the listings form, which has no category control. Proof: `node scripts/test-completeness-actions.mjs` prints `FAIL "category" → onOpenListings → setOpenBiz — that form has no control for this item`.
3. [Low] Calendar import (`routes/marketplace/calendar_sync.py`, `_fetch`): the whole answer is downloaded before the size limit is checked (`r.content` after `http.get`), so a huge file is held in memory first. Needs an owner to paste such an address; stream and stop at the limit.

## Fixed this run
Nothing.

## Still open
- Page editor link filter accepts "/%2F/evil.com" (Low, 12 Oct).
- Mailbox support@myisraelrental.com to confirm (12 Oct).

## Could not confirm
- Calendar sync loop runs in every server copy; two copies could write the same busy times at once (delete then insert), leaving duplicates. Confirm by running two copies against one database.
- Calendar address check resolves the host name, then fetches it again; a hostile DNS answer could change in between. Hard to exploit; confirm with a rebinding test host.
- "Apply" in Ask for a change checks the status then updates it in separate steps; two quick presses could add the same gallery photos twice. Confirm with two simultaneous requests.
- Order limits (max per day or time) are counted then the order is saved, so two orders at the same moment could both pass the last place.

## Verified working
- Frontend production build passes.
- New tests for calendar and counter sales, page edits and requests, Shabbat and route: 40 passed, 14 skipped (need a database). Listing price parity test passes.
- Frontend checks pass except the two listed above (`test-i18n-parity`, `test-completeness-actions`); both failures predate the last 26 hours (files last changed 17 Oct).
- Counter sales and cancel-sale check the business owner; stock goes back only once. Calendar feed has a rate limit, an unguessable token, and "Reset links" deletes all tokens. Page-request photos must be on the same Cloudinary allowlist as elsewhere; the new faq and gallery embed in `server.js` escapes `<`, and the page scripts write text as text.
- New dependencies in `requirements.txt` (hdate, recurring-ical-events, x-wr-timezone) are pinned.

## Not checked
- FAILED  playwright + chromium (browser download failed)
- FAILED  mongodb on :27017 (download returned 403); API not started
- SKIPPED api (no database): tests needing a database were skipped, and the full backend suite hung without one, so it was not completed.
- PRICE CHECK DID NOT RUN: could not read https://myisraelrental.com/api/properties (proxy blocks the live site). Relying on the parity test.
- No screenshots (no browser); visual layer belongs to the UI audit.
