# Code audit, 15 Oct 2026

## In short
- Nothing broken for customers was found in tonight's backend changes (staff accounts, discount codes, classes, referrals, delivery fees, stock, own domains). Order totals, staff permissions and class places are checked on the server.
- A business can claim any web address for its page before proving it owns it. Someone could register a competitor's address first, and the real owner would then be told it is taken. Not exploited anywhere we can see; worth a decision (see below).
- Tonight's database and server checks could not run (the sandbox cannot download MongoDB), so 88 of the new backend tests did not execute. Treat tonight as a read-through plus the frontend checks, not a full pass.
- Fixed tonight: two small text-check items, on branch `claude/exciting-bell-g1kdsn` (the "Showing the first N of M" line in Customers, and a test that flagged four things wrongly).
- Needs your decision: whether a business must prove it owns an address before it is reserved.

## New findings
1. **[Medium] Own domains: an address is reserved before ownership is proved.** `backend/routes/marketplace/custom_domains.py` `set_domain` writes `custom_domain_host` (unique index) as soon as the owner types it, and `resolve_domain` returns the business for any stored host whatever its status. Effect: one business can block another from using `www.theirshop.co.il` (409 "already uses that address"). It cannot take over traffic without control of the address's DNS. Fix: reserve only after `reaches_us()` passes (status live), or allow a verified claim to displace an unverified one. Evidence: code read; not run (no database).
2. **[Low] Own domains: failed change leaves a stale record.** Same function: the old Railway domain is deleted (`_disconnect`) before the new address is saved; if the save then hits the duplicate-key 409, the business still shows the old address as live but it no longer exists in Railway. Fix: disconnect only after the new address is saved. Evidence: code read; not run.
3. **[Low] Test noise.** `scripts/test-i18n-parity.mjs` reported `summary.visits`, `summary.appointments` (value `d.visits.count`) and `editListing.extras` (the word "count," in its English text) as plural problems. Regex tightened (fixed, below). Two remain: `editListing.extras` (still matches the word in its default text) and `restaurants.more` (older).

## Fixed this run
- `scripts/test-i18n-parity.mjs`: counts only a real `count` parameter. Re-ran: flagged keys went 5 to 2, other checks unchanged.
- Customers footer (`customers.more`, en + he + component): `{{count}}` renamed `{{total}}` so i18next does not look for plural forms. Parity test no longer lists it. No PR (no `gh`); branch pushed.

## Still open
- Dead end in the completeness checklist: "category" opens a form with no category control (`scripts/test-completeness-actions.mjs`, 1 dead end). Dead-ends audit's area. Older than tonight.
- `jobsBoard.areaPh`, `jobsBoard.areaFreeText` missing from en.js (used in `JobsBoard.jsx`; present only as inline defaults). Came in with 9f6c307, 14 Oct.
- Open items in `open-issues.md` unchanged.

## Could not confirm
- Discount "once per customer" is checked before, not during, the atomic redeem; two simultaneous orders from one phone might both use a code. Needs a running database to try.
- New-backend-tests against a live database (classes, staff, discounts, referrals, stock, delivery fees, sales summary): not run.

## Verified working (by reading the code)
- Staff: every route goes through `business_access`; staff-only areas (details, staff list, couriers, order settings, door link rotation) stay owner-only; check-in-only staff get names and state, no phone or email; invite accept requires the invited email.
- Orders: totals computed on the server (options, discount off goods only, delivery fee by city, free-over on the discounted amount); stock returned on cancel and when a code is refused.
- Classes: places taken with a conditional update; waiting list promotion conditional.
- Unsubscribe links signed (HMAC), rate limited; messages skip unsubscribed addresses.
- Home page: no invented counts; opening tiles show only listed, photo-bearing items.
- No long dashes in new user-facing text. Production build passes. Scripts: 9 of 11 `scripts/test-*.mjs` pass (failures above). Price parity test (no database): passes.

## Not checked
- `bash scripts/audit-setup.sh` stalled at the browser/frontend step; MongoDB download returned 403 (proxy), so no local database or API, no screenshots, no pytest against data. 58 test files could not even be collected without `MONGO_URL`; 19 ran, 25 skipped.
- Price check against the live site: not run (site blocked from the sandbox); parity test used instead.
- Dependency audit, Lighthouse, RTL screenshots: not run.
