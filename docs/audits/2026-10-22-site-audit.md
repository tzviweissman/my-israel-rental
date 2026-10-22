# Code audit, 22 Oct 2026

## In short
- Sukkot's backup dates ended on 3 Oct. If the holiday-date service is ever unreachable, a guest who taps "Book Sukkot" gets a calendar with every date greyed out, and no error. The test built to catch this is now red.
- The new "payment request" page was sending the business's private phone number to anyone holding the link, although the page never shows it. Fixed tonight.
- Hebrew visitors saw English on the Jobs board area box. Fixed tonight.
- Fixed tonight: those two, on branch `claude/exciting-bell-q0r4ie` (2 commits, no pull request: no GitHub CLI here).
- Needs your decision: the new leads board shows each chatting customer's profile phone number to the business. Is that intended? And what are next year's Sukkot dates for the backup list?

Scope: 61 commits in the last 26 hours, mostly site rebuilds (visual, for the UI audit). Logic reviewed: payment requests, leads board, rating badge, reorder from suppliers, quote sending, website orders for any listing with products, WhatsApp alerts for new orders and bookings.

## New findings
1. **[Medium] Sukkot fallback window is in the past.** `frontend/src/constants/holidayWindows.js` ends 2026-10-03. Proof: `pytest tests/test_holiday_fallback_not_stale.py` fails: "The sukkot fallback window ended 2026-10-03 (19 days ago)". Only bites when Hebcal is unreachable. Fix: set the 2027 dates (not done: it is a date that drives holiday prices, so the owner confirms).
2. **[Medium] Leads board shows customers' profile phone numbers to the business.** `backend/routes/marketplace/leads.py` (`leads_board`) reads `users.phone` for every customer who messaged a listing and returns it on the card. Elsewhere contact is chat-only. Seen by code reading only; decision for Tzvi (may be wanted for follow-up calls).
3. **[Low] 14 `basket.*` keys missing** is already on the list (UI audit, 22 Oct); `test-i18n-parity.mjs` also reports `t(key,{count})` without a plural set for `basket.chosenN` and `basket.items`, still open.
4. **[Low] `test-completeness-actions.mjs` fails:** the "category" checklist item points at `onOpenListings`, whose form has no category control (a dead end; for the dead-ends audit).

## Fixed this run
- `da0754f6` Jobs board area placeholder and hint added to en.js and he.js. Checked: `test-i18n-parity.mjs` no longer lists `jobsBoard.areaPh` or `areaFreeText`.
- `d718eeed` `/marketplace/pay/{token}` no longer returns the business `phone`. Checked: `tests/test_payment_requests.py` passes; the page uses no phone field (grep).

## Still open
- [Medium] 14 `basket.*` strings missing in en.js and he.js. 22 Oct.
- [Low] Hardcoded hex (#B45309) in new dashboard panels. 22 Oct.
- [Low] Page editor link filter accepts "/%2F/evil.com" (stays on this site). 12 Oct.
- [To check] Mailbox support@myisraelrental.com exists and is read.

## Could not confirm
- Reorder `send_waiting` (`reorder.py`): the run is set to "sending" before `_send`; if `_send` raises (email or order creation error), the row stays "sending" and neither Send nor Skip works again. Needs a database to show.
- Supplier emails go to any address an owner types, from the business's name, with no daily cap seen (`order_supplier`). Low risk, only fires on the owner's own rules.
- `arrived` adds stock for a reorder run even if it was never sent (only checks the run has a refill).

## Verified working
- Backend tests that need no database: 1014 passed. New tests (leads, reorder, payment requests, quote send, rating badge, website orders, WhatsApp alert) and the listing price parity test: 40 passed.
- Production build passes.
- Script checks pass except the two above.
- Payment request, leads, quotes and automations routes check business access before reading or writing; the public pay page needs the unguessable token and is rate limited.
- The rating badge escapes its text and shows no average under 3 reviews.

## Not checked
- FAILED setup: MongoDB download (no `mongod`), so no API or seeded data. 104 tests failed and 42 errored on "no database" only; none of them is in tonight's changes. Also the live price check (blocked by the proxy), Lighthouse and screenshots.
- Dependency audit not run.
