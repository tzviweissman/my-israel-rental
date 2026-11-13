# Code review, 13 Nov 2026

## In short
- Top issue: the new starter shop, which future business sites are built from (Gremier Coffee already is), sends a delivery order without saying which delivery area it is for. For any business that does not deliver to the whole country, the server turns that order down, yet the customer still sees "Thanks" and WhatsApp opens, so the order never shows up on the business owner's dashboard. The total shown also leaves out the delivery fee. This is the same problem that was fixed today, one site at a time, on The Brown Box, The Gift Boutique, Gifted Israel and LS Fruit Platter; the starter itself still has it.
- Last night's two fixes (the sign-up website reader and the designed-page menus) are waiting in the audit follow-up branch and are not on the live site yet.
- Fixed tonight: nothing. The one new issue is an order flow, which an audit reports and does not change.
- Needs your decision: whether Gremier Coffee delivers everywhere in Israel or only to some areas, before its shop goes live (if only some areas, its order page needs the same fix).

## New findings
1. **Medium: the starter shop's delivery orders are refused by the server and look sent.** `scrollcraft/starter/shop.js:117` posts `lines, fulfilment, address, date, customer_name, customer_phone, notes` with no `city`. `backend/routes/marketplace/orders.py:2617-2619` refuses a delivery without a served `city` unless the business `serves_nationwide`. On a refusal `save()` returns `null` (line 118) and the submit handler (lines 136-141) shows the same "Thanks ... Your order is open in WhatsApp" message, so nothing tells the customer or owner the order was not saved. The total line says "(delivery fee to be confirmed)" (line 129) while the server adds the listing's fee. Gremier Coffee's unpublished `scrollcraft/builds/gremier-coffee/shop.js:108-109` carries the same body. Proof, a scratch script calling `place_website_order` in practice mode (nothing saved) for a store with `areas: ["jerusalem"]`:
   ```
   starter shop body (no city) -> refused 400 This store does not deliver there
   same body with city=jerusalem -> OK {'total': 120.0, 'subtotal': 100.0, ...}
   ```
   Fix: copy into the starter what 0b144119 / df157e93 did for Gifted Israel and The Gift Boutique: read `GET /marketplace/order-form/{gig}` for areas, fee and minimum; send `city` (the single area, or a chosen one; none when nationwide); show the server's fee in the total; and show a "not saved" message when the server answers with an error. Roughly 50 lines, so reported, not fixed. Belongs partly to the UI audit's order-flow area; `scripts/check-order-data.mjs` would catch it once a starter-built site is published.

No other findings; none dropped.

## Fixed this run
- None.

## Still open
- Sign-up website reader blocking the server, and designed-page menus losing descriptions and ids, first seen 12 Nov: fixed in 67b4f998 and 7f6497af on `claude/audit-merge-21qocb`, not on main yet.
- Practice orders test discount codes 13 times faster than the code box, first seen 12 Nov.
- Unread business emails never reach the leads board, first seen 11 Nov.
- `mongomock_motor` and `pytest_asyncio` not in requirements, first seen 20 Oct.
- Audit sandbox has no MongoDB or Chromium download, first seen 15 Oct.

## Could not confirm
- Gremier Coffee is hit only if its listing does not serve the whole country; that is in the production database, which this audit does not read.
- Gifted Israel now sends `option_id` built from the finish and nusach names (`shop.js` `optId`). If the live listing's option ids are not exactly those names joined by a dash (see `LISTING-CHANGES.json`), the server answers "Pick a choice for ..." and the new "did not go through" message shows. Needs the live listing.

## Verified working
- Today's per-site order changes (Brown Box, Gift Boutique, Gifted Israel, LS Fruit Platter, L.A. Cholent) send only product ids, quantities and option ids; the server prices every line itself from the listing (`orders.py:2585-2604`), so a changed page price cannot change what is charged. A refused order now shows "did not go through" on those sites.
- Rule tooling: `check-rules.mjs` now imports `site-has.mjs`, and `publish-page.mjs` runs `check-headings.mjs` and `check-reviews-open.mjs`; all four files exist. `check-rule-homes.mjs` passes. `pre-commit-check.mjs` also re-checks rule homes when the rules JSON changes.
- `test_listing_price_parity.py`, `test_site_reader.py`, `test_page_price_sync.py`, `test_business_lookup.py`: 28 passed, 1 skipped.
- `scripts/test-*.mjs`: all 11 pass, including test-i18n-parity and test-business-hosts.
- Production build: compiled with warnings (16 lines mention them, the Tailwind "ambiguous class" kind seen before).

## Not checked
- PRICE CHECK DID NOT RUN: could not read https://myisraelrental.com/api/properties (Tunnel connection failed: 403 Forbidden). The parity test passed.
- FAILED  playwright + chromium (last lines:     at ChildProcess.<anonymous> (/home/user/my-israel-rental/node_modules/playwright-core/lib/coreBundle.js:32015:32)     at ChildProcess.emit (node:events:519:28)     at ChildProcess._handle.onexit (node:internal/child_)
- FAILED  mongodb on :27017 (last lines:     at ChildProcess.emit (node:events:519:28)     at ChildProcess._handle.onexit (node:internal/child_process:293:12) curl: (22) The requested URL returned error: 403 )
- SKIPPED api (no database)
- Full backend suite: not run (no database; it ran past 25 minutes on 11 Nov and was cut off). The backend commits of the last 26 hours (508a81da, a9ccb917) were reviewed in last night's report.
- Browser checks (`check-order-data.mjs`, `check-form-fields`, `check-button-look`): need a browser.
- Business-site looks, the Gremier Coffee film and the rules documents: visual layer and tooling, left to the UI audit.
