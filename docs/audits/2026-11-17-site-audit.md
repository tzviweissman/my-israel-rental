# Code review, 17 Nov 2026

## In short
- Top issue (fixed tonight): yesterday's change to the ready-made shop template, the one new shop websites are built from, broke its search, its "hide out of stock" switch and its "Most ordered" row. A piece of the page asked for a helper that had been moved where it could not see it, so the page stopped with an error. No live shop was affected (each keeps its own copy), but the next shop built from the template would have shipped broken. Fixed on branch `claude/exciting-bell-i41zid`.
- On those new template shops, a product the owner adds in their dashboard now appears for sale, but if it has sizes or choices the customer can put it in the basket and is then refused at the last step ("Pick a choice"), because the shop has no way to pick one. A "from" price also shows as a fixed price there. Not fixed: it needs either the choices drawn on the page or such products left off.
- The new "orders through the website" numbers on the admin overview, the pickup-only switch (the server now refuses a delivery with a pickup-only item) and the change that stops our own programs counting as visitors all check out.
- Needs your decision: for products added in the dashboard with sizes, should template shops show the sizes, or leave those products off the site until they are added by hand?

## New findings

1. **Medium (fixed): starter shop catalogue block calls a function it cannot see.** `scrollcraft/starter/shop.js`: 51ac35b turned `byName` into a function inside the order block's IIFE (line 11) and deleted the catalogue block's own `byName` map, but the catalogue block (a separate IIFE starting line 195) still calls `byName(...)` in `itemOf` (line 207) and `popular` (line 381). Proof, `eslint` with `no-undef` on the file:
   ```
   after 51ac35b:   207:34 'byName' is not defined, 381:29 'byName' is not defined  (plus SHOP, a page global)
   before 51ac35b:  only SHOP
   ```
   `itemOf` falls back to `byName` whenever a card's id is not in `CAT.by`, and `isOut` (search, the out-of-stock filter, Most ordered) calls `itemOf` for every card, so one such card throws and stops the whole block. Live shops (Finest Cut, Gifted Israel, Gremier Coffee) have their own `shop.js` and are not affected. Fixed in 26f8fe71.
2. **Medium: dashboard-added products with sizes cannot be ordered on a starter shop.** New in 51ac35b, `scrollcraft/starter/catalog.js:23` adds any product from `#mir-live-products` that the build did not know, as a plain item with no options. `page_edits.py:343-357` does not send `options`, and the basket sends only `{product_id, qty}` (`shop.js:126`). The server then refuses the order: `orders.py:2600-2603`, `if prod.get("options"): ... if not opt: raise HTTPException(400, "Pick a choice for ...")`. A product with `price_kind: "from"` is also drawn as a fixed price (`size: ''`), while the server marks the order "price to confirm". Fix: skip products with options or a "from" price in that block (`&& !(p.options || []).length && p.price_kind !== 'from'`, with `page_edits.py` sending `has_options`), or draw a choice picker and send `option_id`. Not fixed: it changes what a business sells on its site, so it is Tzvi's call (see In short).

2 found, none dropped.

## Fixed this run
- 26f8fe71: `byName` defined in the catalogue block too. Checked after: `eslint no-undef` shows only the `SHOP` page global again; `node --check` passes.

## Still open
- Starter shop delivery orders sent without the delivery area, first seen 13 Nov (`shop.js:128` unchanged).
- Website read copies photos before anything is picked or saved, first seen 15 Nov. Needs Tzvi's decision.
- `_fetch_json` DNS on the event loop, first seen 15 Nov (fix in an audit PR, not on main).
- Shop catalog in euros or pounds read as shekels, first seen 15 Nov.
- Store card "from" price from an add-on when main products have no price, first seen 16 Nov.
- Public work stream counts ads nobody saved, first seen 16 Nov. Needs Tzvi's decision.
- Sales summary margin for sized items, first seen 14 Nov. Counter-sale items cannot take a cost, 14 Nov. Phone "Send" bar skips the email, 14 Nov. Unread business emails never reach the leads board, 11 Nov.
- Audit sandbox: no MongoDB or Playwright download, first seen 15 Oct (again tonight).

## Could not confirm
- `BOT_MARKERS` now drops any user agent containing "node", "python", "java/" and similar. No mainstream browser's user agent contains these, but an unusual in-app browser could; confirming needs a sample of real user agents from the live view log.

## Verified working
- Pickup only: `ProductItem.pickup_only` is kept, sent to the order form and the designed pages, and `place_website_order` refuses a delivery with a pickup-only item (table orders exempt); the order page and starter shop switch to pickup. `tests/test_pickup_only.py` passes.
- `add_site_products.py`: plan settings are now carried and checked against `ProductItem` before writing; `--plan` reads another file; importing it no longer runs it.
- Admin overview "website orders": counts only `source: "website"` orders, with the same string date cutoff the order's `created_at` uses (`stamp = _now_iso()`), so the range filter matches; admin only, like the rest of `get_admin_metrics`. `scripts/live-overview.py` only reads.
- `conftest.py`: an all-skipped run now fails; `TEST_API_WAIT` only waits when set.
- American Crust gift cards use the existing `/marketplace/gift-cards/{slug}/buy` endpoint; no new money path.
- Production build passes (`EXIT 0`). All 11 `scripts/test-*.mjs` pass.
- Backend tests for today's areas (pickup only, view counting, demand reporting, price parity): 19 passed, 13 skipped (need the database).

## Not checked
- PRICE CHECK not run: the routine forbids fetching myisraelrental.com, and the sandbox proxy blocks it; the price parity test ran instead and passed.
- `FAILED  playwright + chromium`, `FAILED  mongodb on :27017 (curl: (22) The requested URL returned error: 403)`, `SKIPPED api (no database)`. So the database tests and the order endpoints did not run against a live API.
- The full backend suite (`pytest tests`) was stopped at its 25 minute limit with no result: without MongoDB the database tests wait on connections. Same as the earlier "full suite exceeds 8 minutes" line in open issues.
