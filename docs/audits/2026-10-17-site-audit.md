# Code audit, 17 Oct 2026

## In short
- The new "order from the table" feature lets anyone with a restaurant's order link send table orders with no name, phone or sign-in. It is limited to 20 per 10 minutes per address, but a prankster could still fill a restaurant's orders board. Needs your decision (below).
- Table orders also appear as a returning customer called "Table 5" in the name suggestions on the order form. Minor.
- Nothing fixed tonight. Today's other changes (holiday items with dates, "Order again", pairings, privacy and contact pages) checked out in the tests that could run. The full test suite and the local site could not run (no database could be installed here).
- Needs your decision: should table orders need something to stop pranks, such as a secret code printed on each table's QR, or a daily cap per restaurant?

## New findings
1. **[Medium] Table orders need no identity.** `routes/marketplace/orders.py` (WebsiteOrderIn `_shape`, `place_website_order`): with `table` set, name and phone are not required. Proof: `WebsiteOrderIn(lines=[...], date=..., fulfilment="delivery", table=3)` validates with an empty name and phone, and fulfilment is forced to pickup. The only check is that the table number is within the restaurant's table count (`tables.py table_ok`) and the rate limit of 20 per 10 minutes per address (`orders.py:2145`). Fix options: a per-table token in the QR link, or a per-restaurant cap on open table orders. Not fixed: it touches who may place orders.
2. **[Low] "Table N" appears as a returning customer.** `orders.py` customer autocomplete (around line 824) groups by phone, else by name. Table orders have a null phone and the name "Table N". Proof: code read, no database to run it. Fix: skip orders with `table` set in that pipeline's `$match`.

## Fixed this run
None.

## Still open
- [Low] Two script checks fail, both before today's commits (confirmed by running them at the commit before the window, with the identical 14 missing keys): `scripts/test-i18n-parity.mjs` (14 t() keys missing from en.js, e.g. `basket.*` in `CardAction.jsx`; 7 plural sets) and `scripts/test-completeness-actions.mjs` (business "category" has no control). Hebrew users see the key's fallback for those. First seen 17 Oct.
- Everything else on `docs/audits/open-issues.md` unchanged.

## Could not confirm
- Ordering a holiday item outside its dates is refused: the order path uses the same filtered product list (`_products_for_order`, line 2184), so it should be, but I could not place a real order without a database.

## Verified working
- New tests pass: `test_reorder`, `test_seasonal`, `test_tables_and_pairings` (17 passed, 9 skipped because they need the database), and `test_listing_price_parity`.
- Production build passes.
- Every new `t()` key used in today's frontend changes exists in both `en.js` and `he.js` (79 checked).
- No new hardcoded left/right styles or inline Playfair in the diff.
- Public product lists hide out-of-season items in the order form, gig page and business page. Tracking link and reorder link only appear to the holder of the tracking token.
- Page publishing script now checks every page script still parses.

## Not checked
- `bash scripts/audit-setup.sh`: mongodb on :27017 did not install (no `mongod` available), so no local database, API or site. The full backend test run hangs without it, so only the tests that do not need it were run.
- PRICE CHECK DID NOT RUN: could not read https://myisraelrental.com/api/properties (Tunnel connection failed: 403 Forbidden). Expected in this sandbox.
- Screenshots and Lighthouse (no local site); the UI audit covers how pages look.
