# Code review, 12 Nov 2026

## In short
- Top issue: when a business fills in sign-up from its own website, the site could freeze for every visitor for about 2 seconds whenever that website's address was slow to look up. One big web page could also take a lot of the server's memory. Last night's fix for this never reached the live site, and yesterday's new "read more pages of their website" change runs that slow step up to six times for each sign-up. Fixed again tonight, on the new code.
- Fixed tonight: on designed business pages with a menu (Finest Cuts), product descriptions had stopped showing, and older products could drop off the menu altogether. Yesterday's price-sync change undid that part of the 11 Nov Finest Cuts work without anyone noticing. Put back, with a test so it can't quietly disappear again.
- Worth a look: the new "practice order" check (used by the order-page tester) lets anyone test discount codes 13 times faster than the normal code box allows. A shop's own word codes like "SUMMER10" could be guessed that way. A one-line limit fixes it, but discounts are money, so it is reported and not changed.
- Both fixes are on branch `claude/exciting-bell-jpiuoz`. Last night's version of the website-reader fix, on `claude/audit-merge-4mafu8`, will now clash with main. Keep tonight's version.
- Needs your decision: nothing new.

## New findings
1. **Medium (fixed): the sign-up website reader blocked the server and read whole pages.** The 11 Nov fixes (68ce50f5, d9e5be86) are only on `claude/audit-merge-4mafu8` and `claude/exciting-bell-3wheie`. On 12 Nov, 508a81d moved the fetching into `_fetch` (`backend/routes/marketplace/product_extract.py:553`), still calling `_is_public_ical_url` (a blocking `socket.getaddrinfo`) on the event loop and `r.text` on the full body. It now runs for the home page, up to 4 sub-pages (`SUBPAGES`) and the site a bio names, up to 4 redirect hops each. Proof on main (scratch script, 2 s DNS answer stubbed, 60 MB streamed page): `longest event-loop stall 2.17s; peak memory 180.0 MB`. Fixed in d69087db.
2. **Medium (fixed): designed-page menus lost descriptions and product ids.** 5dee7ca8 (11 Nov) made `GET /business/{slug}/page-edits` return each store product's `id` (falling back to `idx:N`, as `orders._products_for_order` does) and its `description`. 5ebe10b8 (12 Nov, "Page prices follow the listing") removed both lines. Its message does not mention it, and nothing else it touched needed that. `finest-cut/shop.js:13` skips a product with no id; `mir-catalog.js:90` removes the description line when there is none. Proof (mongomock): before `{'id': None, 'name': 'Ultimate Feast', 'description': None}` for a product stored with a description and no id; after `{'id': 'idx:0', ..., 'description': 'XL chicken board'}`. Fixed in 777b4185.
3. **Low: practice orders are a fast way to test discount codes.** `orders.py:2515` gives `dry_run=true` its own bucket at 400 per 10 minutes per address, and the run still goes through `evaluate` (line 2645). That returns the code and amount when it is valid, or a different message for "expired" or "used up". The code box (`discounts.py:338`) allows 30. Proof, the limiter itself: `code checks allowed per 10 min, code box: 30` / `practice order: 400`. Gift-card codes are random 8 characters and safe; owner-chosen word codes are not. Fix: in `place_website_order`, `if dry_run and payload.discount_code: check_rate(request, bucket="discount_check", limit=30, window_seconds=600)`. `scripts/check-order-data.mjs:69` already skips code fields, so the tester is unaffected. Not fixed: it touches discounts.

No other findings; none dropped.

## Fixed this run
- d69087db: `_fetch` runs the host check through `asyncio.to_thread` and streams the page, stopping at `_PAGE_BYTES`. After: `longest event-loop stall 0.01s; page chars 1500000; peak memory 4.8 MB` on the same stub. test_business_lookup, test_site_reader and the other new-code tests: 66 passed, 1 skipped.
- 777b4185: the two lines put back as in 5dee7ca8. New test `test_catalog_products_keep_order_id_and_description` fails before the change and passes after.

## Still open
- Unread business emails stay "pending" and never reach the leads board, first seen 11 Nov (`email_cards` still filters on `CUSTOMER_CATEGORIES`).
- `mongomock_motor` and `pytest_asyncio` not in requirements, first seen 20 Oct (audit-setup installs them).
- Audit sandbox has no MongoDB or Chromium download, first seen 15 Oct.
- Closed by decision on 12 Nov, not re-reported: the sign-up draft reminder emails any typed address.
- Fixed on main since last night: the ad emails switch (`ad_emails` in `EMAIL_SWITCHES`), Google hours past midnight (`_hours` ends at 23:59), the i18n plural counters (test-i18n-parity passes).

## Could not confirm
- `/site/work` (the join page's live line) counts every text and email in `sms_log` / `email_log`, including any sent for test or demo businesses. The line names no one, but it could overstate real work if test stores send a lot. This needs production counts to judge.
- A practice order skips the stock count (`take`), so the order tester can pass an item that a real order would refuse as sold out. This matters only for that tester, and confirming it needs a store with counted stock.

## Verified working
- New tracking (`/site/visit` sections, `/site/press`, `/site/step`, `/site/restaurant-tap`, business-page `label`): section and flow names come from closed lists, so no path or token is stored. Button words with `@` or 5+ digits are dropped (`clean_label`). Every endpoint is rate-limited and skips admins and bots. The admin readers check `role == "admin"`.
- Leads: the new AI writer goes through `business_access(..., "customers")`, is capped at 80 a day per business, and sends nothing. Requests-board leads use `requests._public` (no phone or email) and leave out the owner's own posts.
- Keep exploring after an order: needs the order's track token (16+ characters), is rate-limited, and returns only public listing names, photos and links; the email links are escaped.
- Page price sync: only the owner or an admin (`_owned`); only that business's published listings; amounts from 0 to 1,000,000 (NaN refused). `test_page_price_sync` passed.
- `/socials/pictures`: each address is checked to be a public host, and Cloudinary fetches it, not our server. Owner-only, 10 an hour.
- Admin people list, holdings and daily graphs: all admin only.
- server.js: `MIR_PRICES` is JSON with `<` escaped; the `&#8362;` price swap is limited to the listing's own amounts.
- `test_listing_price_parity.py`: passed.
- Production build: compiled (with warnings, 9 lines mention them; not compared with last night).
- `scripts/test-*.mjs`: 10 of 11 pass, including test-i18n-parity and test-store-basket.

## Not checked
- PRICE CHECK DID NOT RUN: the routine forbids fetching myisraelrental.com and the sandbox proxy blocks it. The parity test passed.
- FAILED  playwright + chromium (last lines:     at ChildProcess.<anonymous> (/home/user/my-israel-rental/node_modules/playwright-core/lib/coreBundle.js:32015:32)     at ChildProcess.emit (node:events:519:28)     at ChildProcess._handle.onexit (node:internal/child_)
- FAILED  mongodb on :27017 (last lines:     at ChildProcess.emit (node:events:519:28)     at ChildProcess._handle.onexit (node:internal/child_process:293:12) curl: (22) The requested URL returned error: 403 )
- SKIPPED api (no database)
- scripts/test-business-hosts.mjs: needs the API on :8001 (ECONNREFUSED).
- Full backend suite: not run (without a database it ran past 25 minutes last night and was cut off). The test files for today's code were run on their own: 67 passed, 1 skipped.
- `scripts/check-order-data.mjs`, `check-form-fields`, `check-button-look`, `check-headings`, `check-reviews-open`: need a browser.
- Commits that only touched business sites (L.A. Cholent), ad designs and ad pictures (`utils/ad_shots.py` prompts and layouts) were not reviewed for logic (visual layer and tooling).
