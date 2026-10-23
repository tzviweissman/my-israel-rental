# Code audit, 16 Oct 2026

## In short
- Hebrew visitors to a business page saw English on the order and booking buttons (Book, Message, Add to order, Send order). A new block of text added today silently replaced the old one, in both languages. Fixed tonight.
- Anyone can type another person's email into the gift-card order form, or the "tell me when it's back" form, and the business-branded email goes to that person. Each email has an unsubscribe link (the stock one) but the gift-card order email does not. Low risk; your decision.
- Tonight's database tests could not run (the sandbox cannot start MongoDB), so every new backend test for today's 20 commits skipped. Treat tonight as a read-through plus the build and text checks, not a full pass.
- Fixed tonight: the lost button text, branch `claude/exciting-bell-rtx2pd` (no `gh`, so no pull request).
- Needs your decision: whether gift-card order emails and "tell me when it's back" sign-ups should confirm the address first.

## New findings
1. **[Medium] Basket card buttons lost their Hebrew (and fell back to English defaults).** `frontend/src/locales/en.js:5731` and `he.js:5549` (added in 6101774) declared a second `basket: {...}` next to the existing one at `en.js:933` / `he.js:921`. A repeated key in an object keeps the last, so `en.basket` held only `title/hint/sent` (proof: `node` import printed `undefined` for `basket.less`; `scripts/test-i18n-parity.mjs` listed 12 missing `basket.*` keys). Hebrew users saw the English inline defaults. Fixed, see below.
2. **[Low] Gift-card order sends mail to any address typed.** `backend/routes/marketplace/gift_cards.py:151-192` `buy` emails `buyer_email` straight away with no confirmation, and the email has no unsubscribe link. Limit is 10 per hour per visitor address. Fix if wanted: only send the receipt after the business marks it paid, or add the unsubscribe link.
3. **[Low] "Tell me when it's back" has no address confirmation.** `restock.py:68`: anyone can sign any email up for one product (20 per 10 minutes per visitor). Mail carries the unsubscribe link, so the harm is small.
4. **[Low] Appointment reminder is marked sent before it is emailed.** `appointment_reminders.py:send_reminder` inserts the log row, then sends; if the send fails it is only logged and never retried. Fix: delete the log row on a failed send.

## Fixed this run
- d261160c: renamed the reminder block to `basketReminder` and updated its 3 `t()` calls. Checked: `node` import now returns "One less" / "אחד פחות"; parity test missing keys went 14 to 2 (the 2 left are old); production build passes.

## Still open
- `jobsBoard.areaPh`, `jobsBoard.areaFreeText` missing from en.js (since 14 Oct).
- "category" checklist item opens a form with no category control (`test-completeness-actions.mjs`, dead-ends area).
- Own-domain address reserved before ownership proved (15 Oct report).
- Plural-test noise: `customers.more`, `editListing.extras`, `restaurants.more`.

## Could not confirm
- Seat counts in `sessions.py:reserve`: places are taken before the reservation row is saved; a failed save would leave places taken. Needs a database to try; very unlikely.
- Everything the new tests cover (appointment reminders, team calendars, gift cards, quotes, sessions, feedback, deposits, drafts) is unrun here.

## Verified working
- Read-through of every new public endpoint (gift cards, quotes, sessions, feedback, restock, busy times, waiting lists): the unauthenticated ones are rate limited, use unguessable tokens (16+ chars), or return no personal data. Owner endpoints check business access; deposits are provider-only.
- Gift-card spending is atomic (`_take`) and the code only shows once paid; busy-times returns percentages only.
- All eight new background loops claim each item with a unique-key insert or conditional update, so a second server copy would not double-send (also `numReplicas` is 1).
- Draft preview token compared with `compare_digest`; draft payment links filtered.
- `server.js` change only lets `/page/<slug>` through on business hosts; pattern is strict.
- Production build passes. 8 of 11 `scripts/test-*.mjs` pass.
- Backend: with a dummy database, 929 passed, 900 skipped, 97 failed, 42 errors; every failure is a missing database or missing test package (`mongomock_motor`, `pytest_asyncio`), none points at today's code.

## Not checked
- `audit-setup.sh` did not finish (sandbox cannot start MongoDB or the local site); no screenshots, no database tests, no live API.
- `scripts/test-business-hosts.mjs` needs the API on :8001 (connection refused).
- Price check: not run (live site is blocked in the sandbox); `test_listing_price_parity.py` was not separately run.
- Dependency audit and Lighthouse not run (not in the nightly scope).
