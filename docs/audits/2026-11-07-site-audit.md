# Code review, 7 Nov 2026

## In short
- Nothing broken found in last night's work (8 commits: the three price types, customer texts with delivery reports and replies, automatic order acceptance, readable short-link names). The tests written for them pass.
- One small leftover from 4 Nov: three counters in the Advertising screens ("visits") have no singular/plural wording, so Hebrew and English may read "1 visits". The test suite flags it.
- Fixed tonight: nothing (the one finding is below the "small safe fix" bar because the right wording is yours to pick).
- Needs your decision: none.
- Limits of tonight's run: the sandbox could not start a database or a browser, so only tests that need no database ran, and the live price check could not reach the site.

## New findings
- [Low] `ads.nudgeVisits`, `ads.weekVisits`, `advertising.visits` are used with a count but have no plural set. Proof: `node scripts/test-i18n-parity.mjs` prints `FAIL no NEW t(key, { count }) without a plural set (3)`. Introduced in a27f0168 (4 Nov), used in `AdMaker.jsx`, `AdvertisingTab.jsx`, `MyBusinessesTab.jsx`. Fix: add `_one` / `_other` (and Hebrew `_two`) forms in `en.js` and `he.js`.

## Fixed this run
Nothing.

## Still open
See `open-issues.md` (audit setup without a database or Chromium, first seen 15 Oct; ad cut-out URL check, 2 Nov).

## Could not confirm
- Price type "on request" (`quote`): order form, counter sale, quote form, search-engine data and ads were all updated and read correctly in the diff; other order paths (membership, payment requests) were not exercised end to end without a database.
- Automatic acceptance for orders that start from a "from" price: it accepts them at the starting price and the business sets the final one afterwards. Intended per the code comment; worth a look that this is what you want.

## Verified working
- `test_listing_price_parity`, `test_price_kinds`, `test_short_link_names`, `test_text_extras`, `test_order_texts`: 57 passed, 5 skipped.
- Every key in `en.js` exists in `he.js`; every `t()` key used exists in `en.js`.
- Delivery-report and reply endpoints need a secret key derived from the SMS key, and compare it in constant time; reply text is HTML-escaped in the email.
- Readable short-link names: a random code always wins over a name, `mine` is excluded, a unique index on names exists (`server.py:597`), names point only at public pages.
- No long dashes added in user-facing text.
- Other `scripts/test-*.mjs`: all pass except the plural check above.

## Not checked
- FAILED  playwright + chromium (download failed)
- FAILED  mongodb on :27017 (403)
- SKIPPED api (no database)
- PRICE CHECK DID NOT RUN: could not read myisraelrental.com (proxy 403); the parity test above stands in.
- Full backend suite and frontend build: the suite hangs without a database (`pytest_asyncio` and `mongomock_motor` also missing); the build was not run.
