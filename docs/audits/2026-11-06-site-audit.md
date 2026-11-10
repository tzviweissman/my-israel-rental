# Code audit, 6 Nov 2026

## In short
- A sandbox limit meant most of tonight's checks could not run: the local database could not be downloaded (403), so the API never started and the new tests that talk to it (order pause, visit breakdown, texts) were skipped or errored. I read the day's backend changes (discount codes on services, gift cards in dollars, order pause, order texts, visit tracking) and found nothing broken in the code.
- One check fails: three "visits" lines on the dashboard (ad visits, weekly visits, link visits) have no singular and plural forms, so a Hebrew reader sees the English wording or "1 visits". Low, cosmetic. These came in on 5 Nov.
- Fixed tonight: nothing.
- Needs your decision: none.

## New findings
1. **[Low] Plural-less counts.** `scripts/test-i18n-parity.mjs` prints `FAIL no NEW t(key, { count }) without a plural set (3)`: `ads.nudgeVisits` (`MyBusinessesTab.jsx:480`), `ads.weekVisits` (`AdMaker.jsx:3065`), `advertising.visits` (`AdvertisingTab.jsx:93`, added 5 Nov in 8d464ceb). Fix: add the plural forms in `locales/en.js` and `locales/he.js` like the other count keys. Not fixed here: the key convention needs checking against the other plural sets, more than a one-liner.

## Fixed this run
Nothing.

## Still open
See `open-issues.md`; nothing from earlier lists was re-checked tonight.

## Could not confirm
- **Min-order check on bookings uses a price the browser sends.** `routes/marketplace/gigs.py:1357` takes `payload.amount` (0 to 1,000,000, from the client) as the price that `use_code` checks a code's minimum order against, so a customer could type a large amount to pass a "minimum order" code on a service. No payment depends on it; the business sees the price in the booking. Needs the API running to demonstrate.
- `GET /gigs/{id}/code-box` (`discounts.py:164`) is public with no rate limit; it returns only the business id, a yes/no and the pause state. Probably fine.

## Verified working
- Production build passes (`craco build`).
- `tests/test_listing_price_parity.py`: 17 passed.
- Day's tests that need no server: 27 passed (discount codes, codes on services, gift basket deposit, name search).
- Script checks: all `scripts/test-*.mjs` pass except test-i18n-parity (finding 1).
- Code reading, no problems found: discount currency is decided on the server (orders, bookings, quotes, memberships), so a dollar gift card cannot come off a shekel total by omitting the field; a booking that is declined, cancelled or expires gives its code back once only; the double-booking index now covers only bookings with a day and time; visit taps store no IP and only a page name that matches `[a-z0-9-]`.

## Not checked
- FAILED  playwright + chromium (download failure)
- FAILED  mongodb on :27017 (403 from the proxy)
- SKIPPED api (no database): every test that calls the API on :8001 (`test_order_pause.py`, `test_order_texts.py` live parts, and 20 others) skipped or errored on connection refused; the full backend suite hangs without a database, so it was not run end to end.
- Live price check: not run (the live site is blocked in the sandbox); parity test above stands in.
- Hebrew and visual checks: no browser.
