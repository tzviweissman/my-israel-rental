# Code review, 15 Nov 2026

## In short
- Top issue: the new "fill in my sign-up from my website" step copies up to 120 photos from a shop's website into our photo storage every time someone presses it, before they have chosen or saved anything, and while it does that the whole server is slowed for everyone (in a test, other requests waited about 19 seconds). Pressing it 20 times in an hour, which is allowed, means up to 2,400 stored photos for one person, and nothing ever deletes the ones that are not used.
- Still waiting: Gremier Coffee went live today on the starter shop, which still sends a delivery order without its delivery area (first found 13 Nov). If Gremier does not deliver everywhere in Israel, those orders reach the owner by WhatsApp but never appear on the dashboard.
- Fixed tonight (branch `claude/exciting-bell-ip6okg`): the same website step could freeze the whole server on a slow website and fill its memory with a huge reply, the problem fixed on 12 Nov in a neighbouring function, now fixed in the new one too; and a shop product with a blank name made every product after it show the photos of the product before it.
- Needs your decision: should the website step copy photos only when the business saves the listing (cheapest, about 20 lines, and the photos it shows first would be the website's own addresses), or keep copying at once but fewer at a time (a cap of, say, 30 photos and 4 copies at once)?

## New findings
1. **Medium: one sign-up website read copies up to 120 photos into Cloudinary and blocks the shared worker pool while it does.** `backend/routes/marketplace/product_extract.py` `_product_photos` (from 9e042d86) gathers `mirror_url_to_cloudinary` for every photo of every item, `PHOTO_COPIES = 120`, on every `POST /marketplace/socials/read` (20 per hour per user, `read_socials`), before the owner has picked or saved anything; unused copies are never removed. Each copy runs in `asyncio.to_thread`, the server's shared default pool (8 workers on 4 CPUs), which 30 other places also use, including `utils/contract_files.py`, `utils/email.py` and `utils/whatsapp.py`. The older `/socials/pictures` copies only what the owner picked, at most 13, 10 times an hour. Proof, a scratch script with Cloudinary's upload stubbed at 1 s and a Shopify-style list of 30 products with 5 photos each:
   ```
   copies made: 120 for one read; read took 19.8s with 4 CPUs; another request's to_thread waited 18.8s
   ```
   Fix (decision above): copy at save time, or lower `PHOTO_COPIES` and copy through an `asyncio.Semaphore(4)`. Not fixed: it changes what is stored and when.
2. **Medium (fixed): the shop catalog lookup checked DNS on the event loop and read the whole reply.** `_fetch_json` (new in 9e042d86) called `_is_public_ical_url` (a blocking `getaddrinfo`) directly and `r.json()` on the full body, for `/products.json`, `/cart.js` and the WooCommerce list of every website read. Same class as the 12 Nov finding; that fix (5388129b / f5dc3cba, still on `claude/audit-merge-gj6xb6`) covers `_fetch` only. Proof, scratch script, 2 s DNS answer stubbed, 60 MB streamed reply: before `longest event-loop stall 2.18s; peak memory 126.0 MB`, after `0.00s; 5.6 MB`. Fixed in 7fc6a1ba.
3. **Low (fixed): a product with a blank name shifted every later product's photos.** `_clean_catalog` kept a row named `&nbsp;` (raw text not empty), `_rows` then dropped it (unescaped and stripped), and the `zip` that gives each row its photos slid by one. Proof: `[&nbsp;, Cheese Board, Fruit Board]` gave `Cheese Board []` and `Fruit Board ['https://c.com/x1.jpg']` (Cheese Board's photo). Fixed in fe5cb087 with a test that fails before.
4. **Low: a shop's catalog in euros or pounds is listed as shekels.** `_shop_catalog` passes the shop's own currency (`cart.js` or `currency_code`), but `_rows` turns anything other than USD into ILS (`product_extract.py:121`), so a €12 product becomes ₪12 in the sign-up form. The owner sees the form before saving. Fix: drop the row's price when the currency is neither ILS nor USD, so the owner types it.

None dropped.

## Fixed this run
- 7fc6a1ba: `_fetch_json` checks the host off the event loop and stops at 5 MB. Checked after: the stall and memory proof above; a normal Shopify reply still becomes rows with their photos; `test_site_reader`, `test_business_lookup`, `test_listing_price_parity`, `test_page_edits`, `test_item_sales`, `test_delivery_fees`: 53 passed, 2 skipped.
- fe5cb087: `_clean_catalog` drops rows by the same test as `_rows`. New test `test_shop_list_photos_stay_on_their_product` fails before and passes after; reader tests 13 passed.

## Still open
- Starter shop sends delivery orders without the delivery area, first seen 13 Nov. Now live on Gremier Coffee (`frontend/public/pages/gremier-coffee/shop.js:109`, no `city`, and the same "Thanks" whether or not the order saved). Whether the server refuses them depends on Gremier's delivery areas, which are production data and were not read.
- Sales summary margin and "you lose money" hint use the base price for items with sizes, first seen 14 Nov (`insights.py:302` unchanged). Needs Tzvi's decision.
- Counter-sale items with no shop cannot be given a cost, first seen 14 Nov.
- Phone "Send" bar skips the email on order pages with texts on, first seen 14 Nov (`mir-order.js:27` unchanged).
- The 12 Nov fixes (website reader `_fetch`, designed-page menus) and the 14 and 15 Nov audit fixes are on `claude/audit-merge-gj6xb6`, not on this branch or main.
- Practice orders test discount codes faster than the code box, first seen 12 Nov.
- Unread business emails never reach the leads board, first seen 11 Nov.
- `mongomock_motor` and `pytest_asyncio` not in requirements, first seen 20 Oct.
- Audit sandbox has no MongoDB or Chromium download, first seen 15 Oct.

## Could not confirm
- "Most ordered" (8b90a946): `GET /business/{slug}/page-edits`, which every view of a designed page calls, now also reads up to 3,000 orders' lines for that business (index on `business_id`, then `created_at` filtered without an index). Fine at today's sizes; would need a database with many orders to measure.

## Verified working
- "Most ordered" counts each order once per product, only in-stock products, last 183 days, leaves out cancelled and failed orders, shows nothing below 3 products with 3 orders each; it sends product names only, escaped (`<` as `<`) in `server.js`. Practice orders are never stored, so they cannot inflate it.
- Free-delivery bar: `data-free-over` is written through `Number()` in `server.js`, so nothing from the database reaches the page unescaped; the server still decides the fee itself (`orders.py:1865`, `test_delivery_fees.py` passes).
- Seasonal catalogs (b6ab3e5): the dates go into `available_from` / `available_until`, which the product model checks as `YYYY-MM-DD` (`shared.py:635`) and `seasonal.py` already hides outside their dates.
- Website reader photo matching: the model can only name photo numbers from our own list (`_assign_photos`), never an address; a photo two products claim goes to neither (`test_site_reader.py`). Cloudinary, not our server, fetches the photo addresses, so they cannot reach our own network.
- Ad photo prompt change (`ad_shots.py`) is text only.
- Production build: passed. `scripts/test-*.mjs`: 10 of 11 pass; see Not checked for the eleventh.

## Not checked
- PRICE CHECK DID NOT RUN: could not read https://myisraelrental.com/api/properties (Tunnel connection failed: 403 Forbidden). The parity test passed.
- FAILED  playwright + chromium (last lines:     at ChildProcess.<anonymous> (/home/user/my-israel-rental/node_modules/playwright-core/lib/coreBundle.js:32015:32)     at ChildProcess.emit (node:events:519:28)     at ChildProcess._handle.onexit (node:internal/child_)
- FAILED  mongodb on :27017 (last lines:     at ChildProcess.emit (node:events:519:28)     at ChildProcess._handle.onexit (node:internal/child_process:293:12) curl: (22) The requested URL returned error: 403 )
- SKIPPED api (no database)
- `scripts/test-business-hosts.mjs` fails with `ECONNREFUSED 127.0.0.1:8001`: it needs the API, which did not start (no database).
- Full backend suite: without `JWT_SECRET` set, 91 files fail to collect; with a throwaway value it hung past 10 minutes on tests waiting for a database, so it was stopped. The tests for the day's backend changes were run on their own (above).
- Browser checks of the order pages and the sign-up form: no browser. How they look is the UI audit's area.
