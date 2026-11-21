# Code review, 14 Nov 2026

## In short
- Top issue: the new "what sells" panel in the Sales summary can tell a business owner they lose money on an item that actually earns them a lot. For anything sold in sizes or choices (a small and a large cake, say), it works out the margin from the item's starting price instead of the price customers really paid, so a large cake sold at ₪250 with a ₪120 cost shows "You lose ₪20 on each one. Raise the price, or stop selling it?" while the same row says ₪1,300 profit. An owner who follows the hint could drop a best seller.
- Still waiting: last night's starter shop delivery problem is unchanged, and the two fixes from 12 Nov (sign-up website reader, designed-page menus) are still not on the live site.
- Fixed tonight: nothing. The one new issue changes advice shown about money, which an audit reports and does not change.
- Needs your decision: for items with sizes, should the owner type one cost per size (most accurate), or should the panel just use the average price actually paid (quick fix, about 4 lines)?

## New findings
1. **Medium: margin and the "you lose money" hint use the base price, not the price paid, for items with choices.** `backend/routes/marketplace/insights.py:302` takes `price` from the product's own `price`, and `:335` computes `margin = price - cost` from it. `orders.py:2597-2598` stores the chosen option's price on each line when the option has one, and those lines are summed into `revenue` under the same product (`insights.py:320-322`), so revenue and profit are right but margin, margin %, and the `loss` / `thin` flags are not. The panel repeats the same arithmetic when a cost is typed (`frontend/src/components/dashboard/ItemSales.jsx:22-25`) and shows `items.hintLoss` ("You lose {{m}} on each one. Raise the price, or stop selling it?"). Proof, a scratch call of `item_sales` (pure function, no database): a cake listed at 100 with options Small 100 / Large 250, ten Large sold, cost 120:
   ```
   {'qty': 10, 'revenue': 2500.0, 'price': 100.0, 'cost': 120.0, 'margin': -20.0, 'margin_pct': -20.0, 'profit': 1300.0, 'flags': ['loss']}
   ```
   A product whose base price is empty and whose options carry the prices gets no margin at all. Fix (decision above): either use the average price paid when the item sold (`price = revenue / qty` if `qty` else the listed price) in both `item_sales` and `withCost`, or key costs and rows by `option_id`. Add the option case to `tests/test_item_sales.py`.
2. **Low: an item recorded at the counter without a shop cannot be given a cost.** Counter sales with no shop store `gig_id: None` (`counter_sales.py:123`), which `item_sales` lists under gig `""`; `CostIn.gig_id` needs at least one character (`insights.py:368`) and the gig must exist (`:377`), so typing a cost for that row is refused (422 or 404). Found by reading; not run against a server (no database here). Fix: hide the cost box for rows with no `gig_id`, or accept a business-level key.

None dropped.

## Fixed this run
- None.

## Still open
- Starter shop sends delivery orders without the delivery area, first seen 13 Nov (`scrollcraft/starter/shop.js` unchanged since).
- Sign-up website reader blocking the server, and designed-page menus losing descriptions and ids, first seen 12 Nov: fixes 67b4f998 and 7f6497af still not on main (checked against origin/main tonight).
- Practice orders test discount codes 13 times faster than the code box, first seen 12 Nov.
- Unread business emails never reach the leads board, first seen 11 Nov.
- `mongomock_motor` and `pytest_asyncio` not in requirements, first seen 20 Oct.
- Audit sandbox has no MongoDB or Chromium download, first seen 15 Oct.

## Could not confirm
- `GET /businesses/{id}/items` loads every order the business ever had (`to_list(20000)`, no date filter in the query) on each open of the summary. Fine at today's sizes; would need a database with many orders to measure.

## Verified working
- The new items endpoints check access with `business_access(..., "summary")`, so only the owner, an admin or staff with the summary permission can read sales or save costs; costs live in `item_costs`, not on the products sent to customers. Saving a cost checks the shop belongs to that business.
- Cancelled and failed orders are left out; orders outside the period are left out (`test_item_sales.py` passes).
- The 13 to 14 Nov per-site order form changes (Bake Away, RBS Cleaning, Hadassah Prys, Elisheva Nails, Noa Levi, Chicken Munch, American Crust, Bun Intended, Whipped Cup and others) are page and check-script changes; the server still prices each line from the listing (`orders.py:2585-2604`).
- A Free quote service tier (price 0) now shows "Price on request" on the listing instead of ₪0 (`GigDetail.jsx`); `priceKind.onRequest` exists in both languages (i18n parity test passes).
- `test_item_sales.py`, `test_listing_price_parity.py`, `test_page_price_sync.py`: 18 passed, 1 skipped.
- `scripts/test-*.mjs`: all 11 pass.
- Production build: passed (exit 0).

## Not checked
- PRICE CHECK DID NOT RUN: could not read https://myisraelrental.com/api/properties (Tunnel connection failed: 403 Forbidden). The parity test passed.
- FAILED  playwright + chromium (last lines:     at ChildProcess.<anonymous> (/home/user/my-israel-rental/node_modules/playwright-core/lib/coreBundle.js:32015:32)     at ChildProcess.emit (node:events:519:28)     at ChildProcess._handle.onexit (node:internal/child_)
- FAILED  mongodb on :27017 (last lines:     at ChildProcess.emit (node:events:519:28)     at ChildProcess._handle.onexit (node:internal/child_process:293:12) curl: (22) The requested URL returned error: 403 )
- SKIPPED api (no database)
- Full backend suite: not run (no database). The items endpoints were not called over HTTP.
- Browser checks (`check-order-data.mjs`, `check-site.mjs` changes): need a browser. How the order pages and the new panel look is the UI audit's area.
