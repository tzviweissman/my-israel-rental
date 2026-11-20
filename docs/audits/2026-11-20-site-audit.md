# Code review, 20 Nov 2026

## In short
- One business owner could slow the whole site for everyone. The new line on ads that says how big a product is ("Feeds 8 to 10") is read out of the product's description, and on a very long description that took 18 seconds, during which the site answered nobody. Fixed tonight: only the start of the description is read now, which takes a tenth of a second.
- On a designed shop, a size the owner priced at 0 shows the product's full price, but the order is charged 0 for it. Only happens if an owner types 0 for a size; worth deciding which one is meant.
- Customers can miss later "being made" photos on WhatsApp: if the owner sends one every few minutes, only the first one is messaged, however long it goes on. The order page always shows the newest photo.
- Fixed tonight: the ad size slowdown; the English words for the new Businesses page rows and subcategories (they were only in Hebrew, and English said "1 businesses"); two live-database scripts that could not read their settings on a Mac. Branch `claude/exciting-bell-v2pnea`.
- Needs your decision: what a size priced at 0 should mean (free, or "same as the product").
- Last night's three open items (photo message limit, live-database script on Mac, customers' contact details in that script) were all fixed today.

## New findings

1. **[Medium, fixed] Ad size line could stall the API.** `backend/routes/short_links.py` `_SIZE_RE` (rewritten in b9c1dd7) is quadratic on a long stretch without a full stop, and `_item_size` runs synchronously on the event loop for every product of every ad (`_ad_facts`, also `weekly_ads.py`). `ProductItem.description` (`routes/marketplace/shared.py:633`) has no length limit. Proof, timing `_SIZE_RE.search`:
   - 20,000 letters: 17.9 s; 24,000 characters of `1.2.3.4.`: 35.2 s.
   - 5,000 letters: new pattern 1.08 s, the 18 Nov pattern 0.19 s (the old one was quadratic too, the rewrite made it about 6 times slower).
   Fixed in a26d1bf7: only the first 1,500 characters are searched. After: 0.09 s and 0.13 s; `test_item_size.py` passes.
2. **[Low] Designed shop shows a 0-priced size at the product's price, the order charges 0.** `scrollcraft/starter/catalog.js:40` and `frontend/public/pages/mir-catalog.js:51` (544be9d) use `Number(o.price) > 0 ? o.price : p.price`; the server (`backend/routes/marketplace/orders.py:2687`, `if opt.get("price") is not None`) and the main site (`frontend/src/components/marketplace/CardAction.jsx:61`, `o.price ?? p.price`) use the option's price whenever it is set. `ProductOption.price` allows 0 (`shared.py:604`, `ge=0`), and the dashboard saves a typed 0 as 0 (`ProductExtras.jsx:20`). So a size saved at 0 reads as, say, ₪120 on the designed shop and its basket, and is ordered at ₪0. Fix, once you decide: either treat 0 as "no price of its own" in the server and `CardAction` too, or use `o.price != null` in the two shop files. Not fixed: it is about prices.
3. **[Low] "Being made" photo limit counts from the last photo, not the last message.** `orders.py` `send_making_photo` (b9c1dd7) compares now with `making_photo.at`, which every new photo overwrites, messaged or not. Proof: a run of the real function with a fake database and clock, photos at 0, 8, 16, 24 and 32 minutes, sent WhatsApp at `[0]` only (meant: 0, 16, 32). Fix: keep a separate `messaged_at` on the photo and compare with that. Not fixed: changes what is stored on the order.
4. **[Low, fixed] English strings missing for today's Businesses page and subcategories.** `BrowseRows.jsx`, `CategoryPicker.jsx` and 22 new `subcategoryLabels` were added to `he.js` only. `scripts/test-i18n-parity.mjs` failed 3 checks (67 stray Hebrew keys, 9 keys missing from en.js, `browse.count` and `browse.seeAll` used with a count and no plural set), and the English heading read "1 businesses". Fixed in 35248a6e.
5. **[Low, fixed] Two more scripts with the `shell=True` bug.** `backend/scripts/assign_subcategories.py --live` (new today) and `scripts/live-overview.py` ran `railway` with a list and `shell=True`, which drops every argument on Mac and Linux (shown: `subprocess.run(['echo','variables','--kv'], shell=True)` prints an empty line). Fixed in dd1d2590 and 59e0d9b8.

No other findings; none dropped.

## Fixed this run
- 35248a6e: English `browse` block, wizard placeholders and 22 subcategory labels; Hebrew `_one`/`_two`/`_other` for the two count keys. Checked: `test-i18n-parity.mjs` passes every check; i18next renders Hebrew 1, 2, 7 as "עסק אחד", "שני עסקים", "7 עסקים" and English as "1 business", "2 businesses" (without `_two` Hebrew 2 fell back to the English default, caught and fixed). The commit is about 55 lines, all strings, no logic.
- dd1d2590: `assign_subcategories.py --live` reads Railway's variables. Checked with a fake `railway` on PATH (pointing at a dead local port): before, "could not read MONGO_URL"; after, it reads the URL and goes on to the dry run. Nothing was written anywhere.
- 59e0d9b8: same for `live-overview.py`. Checked: `_railway_var('DB_NAME')` returned `''` before and `'fake'` after.
- a26d1bf7: ad size line capped at 1,500 characters (finding 1).

## Still open
- Audit sandbox: no MongoDB and no Playwright (since 15 Oct).
- Everything else on `open-issues.md` was outside today's changes and not re-checked.

## Could not confirm
- Whether any live product has a size priced 0 (finding 2) or a description long enough to matter (finding 1): needs the live database, which this audit does not read.

## Verified working
- **Last night's open items**, fixed today: the photo message limit exists (b9c1dd7, with the gap in finding 3), `live-db-read.py` runs `railway` without a shell (b9c1dd7), and it prints phones, emails and addresses as `[hidden]` (8994855); the size pattern now needs a number beside מנות and keeps "4.50" whole ("Price 4.50 serves 2" gives the whole sentence).
- **Subcategories** (488e308, 0eb880c): the new backend and frontend lists match slug for slug; `_validate_subcategory` accepts them; every subcategory and browse key has its Hebrew; the dropdown shows translated names (`subcategoryLabel`).
- **`assign_subcategories.py`**: dry run by default, `--apply` never overwrites an existing subcategory (the update filters on empty), prints the database host before anything.
- **Sizes on designed shops** (544be9d): `page-edits` sends only id, name, price and stock of each option; option names are escaped before they go into the page; the order API still prices every line from the database and refuses a missing or sold-out size.
- **Ads-only logo** (00e8517): `ad_logo_url` is owner-only to change (`_owned`), "" clears it, same handling as `logo_url`; the wordmark tool works in the browser and uploads nothing itself.
- **WhatsApp Ready reply** (dea9605): now says it shows on the order page; `test_whatsapp_webhook.py` passes.
- **Tests**: `test_item_size.py`, `test_whatsapp_webhook.py`, `test_listing_price_parity.py`, `test_order_making_photo.py`: 32 passed, 6 skipped (need the API). Script tests: 10 of 12 pass, `test-i18n-parity` passes after the fix.
- **Build**: production build passes; no warnings in today's new files (the `Services.jsx` hook warnings are at lines 228 to 284, older code).
- `frontend/server.js`: unchanged today.

## Not checked
- PRICE CHECK not run: the routine forbids fetching myisraelrental.com and the sandbox proxy blocks it. The price parity test ran and passed.
- `FAILED  playwright + chromium`, `FAILED  mongodb on :27017 (... curl: (22) The requested URL returned error: 403 )`, `SKIPPED api (no database)`.
- Full backend suite: first run had no JWT_SECRET or MONGO_URL (93 collection errors); with throwaway values it timed out after 15 minutes waiting for a database. Only the targeted tests above ran.
- `scripts/test-business-hosts.mjs` needs the API on :8001 (connection refused). `scripts/test-moving-ad-checks.mjs` skipped: needs Chromium and takes 10 to 15 minutes.
- Today's new site checks (`check-five`, `check-motion-feel`, `check-break-ui`, `check-listing-prices` and others) are visual tooling and were only read. The Businesses page layout and the ad maker are the UI audit's area.
