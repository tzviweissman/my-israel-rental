# Code review, 16 Nov 2026

## In short
- Top issue (fixed tonight): today's change that shrinks a website photo too big for our photo storage would open any picture a website points at, however many pixels it has. A small file can hold a huge picture: one took 772 MB of the server's memory to shrink, four at once 2.85 GB, and a single "fill in my sign-up from my website" read copies up to 300 photos. One hostile shop page could have run the server out of memory and taken the site down for everyone. Pictures over 40 megapixels are now skipped (Burnt Meatboards' big photo is 16 and still goes through).
- The same website read now copies up to 300 photos into storage per press (it was 120 on 15 Nov, when this was first reported), before the business has picked or saved anything. Still waiting on your decision from last night.
- A shop whose main products have no price but whose drinks do shows "from $5" (the drink) on its card, while the server treats it as having no price. Small, rare, and it is the exact thing today's "from the cheapest main product" change was meant to stop.
- Fixed tonight: the photo memory problem above, on branch `claude/exciting-bell-dpgknv` (commit 4e352a89).
- Needs your decision: the sign-up page's live "Made an ad for a business" line also counts ads our ad page keeps by itself when an owner merely opens it, not only ads the owner chose to save. Is that "made an ad"?

## New findings

1. **Medium (fixed): shrinking a refused photo decoded any picture, of any pixel count.** `backend/utils/cloud_storage.py` `shrink_picture` (new in 9edd5cc0 / f95d3df, used by `mirror_url_to_cloudinary` when Cloudinary refuses a URL) called `Image.open` then `thumbnail`, which decodes the whole picture first. The address comes from someone else's website (`/marketplace/socials/read`, any signed-in user, 20 an hour), and `_product_photos` gathers up to `PHOTO_COPIES = 300` copies through `asyncio.to_thread` (8 workers on 4 CPUs). Proof, scratch scripts, a 0.45 MB PNG of 12000x12000 pixels (under Pillow's own 179 MP refusal):
   ```
   0.45 MB file -> shrink_picture 1.4s, memory 26 MB before, 797 MB peak (+772 MB for one picture)
   4 pictures through asyncio.to_thread at once: peak 2852 MB
   ```
   Fixed in 4e352a89: over `MAX_PIXELS = 40_000_000` the picture is refused before decoding (the caller already logs and skips it). New test `test_a_picture_with_too_many_pixels_is_not_decoded` fails before and passes after.
2. **Low: a store whose main products have no price shows its add-on's price as "from".** `frontend/src/utils/gigPrice.js:71-73` keeps priced rows first and then drops add-ons, so with every main product unpriced it falls back to the add-ons; `backend/routes/marketplace/shared.py` `main_rows` drops add-ons first, so the server finds no price. Proof, the two functions on the same listing (a "Catering platter" with no price, a $5 Coke in "Drinks"):
   ```
   website card price row: {"name":"Coke","price":5,"currency":"USD","group":"Drinks"}
   server sort price: None
   ```
   Fix: in `cheapestRow`, take main rows from all products (`priceRows` filtered after the add-on test), falling back to add-ons only when every product is an add-on, as `main_rows` does; add the case to `scripts/test-gig-price.mjs`. Not fixed: prices are worth Tzvi's eye, and the parity test should take the case first.
3. **Low (decision): the public work stream counts ads nobody saved.** `backend/routes/site_visits.py:317` lists every `saved_ads` row for a business; `kept: true` rows are ads the ad page keeps by itself as soon as it draws the first one (`AdMaker.jsx:3850`, "the owner never saved it"). Each one appears on the sign-up page as "Made an ad for a business" (`WorkForYou.jsx:38`). The code comment says "that the business kept". Fix if wanted: add `"kept": {"$ne": True}` to the query (one line).

3 found, none dropped.

## Fixed this run
- 4e352a89: `shrink_picture` refuses over 40 megapixels. Checked after: the 12000x12000 proof now raises `picture too large to shrink`; `tests/test_site_reader.py` 16 passed, including today's `test_a_picture_too_big_for_cloudinary_is_shrunk_and_sent` (4974x3247 still shrinks).

## Still open
- Website read copies photos before anything is picked or saved, first seen 15 Nov; now worse: `PHOTO_COPIES` went from 120 to 300 today (f95d3df). Needs Tzvi's decision.
- `_fetch_json` checks DNS on the event loop and reads the whole reply, first seen 15 Nov; fix 752775b8 is in the 16 Nov audit PR, not on main. Today's WooCommerce change gathers up to 150 of these reads at once (`WOO_VARIATIONS`), so it matters more until that PR merges.
- Shop catalog in euros or pounds read as shekels, first seen 15 Nov. Note: Shopify now reads `meta.json`'s currency, but `_rows` still turns anything other than USD into ILS.
- Starter shop delivery orders without the delivery area, first seen 13 Nov (Gremier Coffee live).
- Sales summary margin for items with sizes uses the base price, first seen 14 Nov. Needs Tzvi's decision.
- Counter-sale items cannot take a cost, first seen 14 Nov.
- Phone "Send" bar skips the email, first seen 14 Nov.
- Unread business emails never reach the leads board, first seen 11 Nov.
- `mongomock_motor` / `pytest_asyncio` not in requirements, first seen 20 Oct.
- Audit sandbox: no MongoDB or Playwright download, first seen 15 Oct (again tonight).

## Could not confirm
- Admin overview "site visitors" now adds people who opened only listings or designed sites. If a designed site's id (`mir_vid`) ever differs from the app's for the same person, they count twice. The code comments say they are the same id; confirming needs a browser and the database.

## Verified working
- Views with no browser id are no longer recorded; the React pages and the designed-site counter (`page_edits.py:461`) both send one, and the designed-site endpoint already ignored a request without it. Admins' own views are left out on property, service and business pages.
- Admin metrics: every view number now uses one stream (`marketplace_view_events`, people only); "all time" start date cannot 500 on a string date (it returns no date instead).
- Sign-up `area_fees`: only cities the business serves, 0 to 10,000, NaN and infinity dropped (`fees_by_area`).
- `_shrunk_picture` checks every redirect hop for a public host and stops at 60 MB.
- Shop pages read by handle only when the handle is plain letters, digits and dashes (`_shopify_pages`).
- CORS for any localhost port is added only with `DEV_AUTOLOGIN=1`.
- The sign-up work stream's sample messages are labelled "example".
- Contract template stamp: line endings evened before hashing; no route change to contract files.
- Production build passes. 10 of 11 `scripts/test-*.mjs` pass; the other needs the API (below).
- Backend tests for today's areas, no database (price parity, site reader, work stream, view counting, demand reporting, delivery fees): 36 passed, 14 skipped (need the database).

## Not checked
- PRICE CHECK DID NOT RUN: could not read https://myisraelrental.com/api/properties (Tunnel connection failed: 403 Forbidden). Expected in the sandbox; the parity test ran instead.
- `FAILED  playwright + chromium` and `FAILED  mongodb on :27017 (curl: (22) The requested URL returned error: 403)`; `SKIPPED api (no database)`. So the database tests and `scripts/test-business-hosts.mjs` (needs the API on :8001) did not run.
- The full backend suite: the sandbox container restarted after about 20 minutes of it (exit 137), so only the targeted files above ran.
- Today's visual work (sign-up wall, business sites, rule 3ac.1) is the UI audit's area.
