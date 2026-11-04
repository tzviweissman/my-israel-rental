# Code audit, 2 Nov 2026

## In short
- The new text-message order flow (business gets a text with a Confirm or Decline link) looks sound: the link's key is hidden from the staff board, double taps cannot confirm twice, and order numbers are now unique per shop.
- One small slowness found and fixed: the Confirm page looked up orders with no index, so every tap would have searched every order in the database. Added the index (branch `claude/exciting-bell-ribe0g`, commit 26b56084).
- Could not run the full test suite or any browser check: this sandbox cannot download MongoDB or Chromium. Only the 30 tests that need no database ran, and all passed.
- Needs your decision: nothing.

## New findings
1. [Low] `backend/routes/marketplace/order_texts.py:157` queries `store_orders` by `owner_token`, an unauthenticated route, but `ensure_order_indexes` (orders.py) only indexed `track_token`. Proof: `grep owner_token backend/routes/marketplace/orders.py` showed no create_index. Fixed below.

## Fixed this run
- 26b56084: sparse index on `owner_token`. `py_compile` passes; index creation only runs against a real database, which was not available.

## Still open
- Audit setup cannot get MongoDB/Chromium (since 15 Oct).

## Could not confirm
- `utils/cutout.py` `cutout_url` fetches a stored photo URL with urllib. The URL comes from the owner's own listing data, not the request; whether that data is restricted to allowed hosts was not checked.

## Verified working
- `tests/test_order_texts.py`, `test_ad_cutout.py`, `test_store_orders_website.py`, `test_listing_price_parity.py`: 30 passed, 10 skipped.
- `owner_token` is stripped from `_public` order output and not present in the track page response.
- Owner link cannot move an order past "new" (compare-and-set in `_transition`), rate limited.

## Not checked
- FAILED  playwright + chromium (setup)
- FAILED  mongodb on :27017 (setup, 403); SKIPPED api
- Full backend suite (79 files need a database), frontend build, scripts/test-*.mjs sweep, live price check (PRICE CHECK DID NOT RUN: proxy 403).
