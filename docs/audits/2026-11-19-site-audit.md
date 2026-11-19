# Code review, 19 Nov 2026

## In short
- When an owner taps Ready on WhatsApp, the reply told them "the customer was told". Nothing actually messages the customer when an order is ready, so an owner could wait for a pickup that nobody was asked to come for. The order page does show the order as ready. Fixed tonight: the reply now says it shows on the customer's order page.
- Ads can print the wrong size under a product's price. The new size line picks a sentence out of the product's description, and in Hebrew any sentence with the word for "dishes" counts, so "All our dishes are made fresh every morning" would go on the ad as the size. A price like "4.50" in English gives "50 serves 2".
- Everything else from today's backend work checks out: Confirm, Ready and Delivered from WhatsApp only work from the business's own numbers and only in order, the backup text when Meta fails to deliver an alert goes out once, and the matching dashboard and admin tap counts agree.
- Fixed tonight: the WhatsApp Ready wording, above (branch `claude/exciting-bell-dnlebi`, commit 828ab071).
- Needs your decision: the three items from last night are still open (the limit on "being made" photo messages, and the live-database script failing on Mac and showing customers' contact details).

## New findings
1. **[Medium, fixed] WhatsApp Ready reply claimed the customer was told.** `backend/routes/whatsapp_webhook.py:193-197` replied "Marked ready. {who} was told." Proof: `_transition` (`orders.py:537-558`) only sends a text on `done`, and `customer_told_of_decision` (`order_texts.py:413`) returns early unless the order was `new`; `grep -rn '"ready"' backend/routes backend/utils` finds no message sent on ready. The added test assertion failed before the fix (`1 failed, 12 passed`) and passes after (`13 passed`). Fixed in 828ab071.
2. **[Low] Ad size line picks up unrelated sentences.** `backend/routes/short_links.py` `_SIZE_RE` (added 4a0a5cb), shown on the ad under the price (`AdMaker.jsx`, `item.size`). Proof, run against the regex as committed:
   - `"קוגל ירושלמי ביתי. כל המנות מוכנות טריות כל בוקר"` gives `כל המנות מוכנות טריות כל בוקר` (any mention of מנות matches, with no number).
   - `"Price 4.50 serves 2"` gives `50 serves 2` (the decimal point is read as the end of a sentence).
   Only when the owner left "serves" empty. Fix: require a number next to מנות (`\d+\s*מנות`), and do not split on a dot between digits (`(?<!\d)\.(?!\d)`). Not fixed here: it changes what ads say, so it is Tzvi's call on wording.

No other findings; none dropped.

## Fixed this run
- 828ab071: WhatsApp Ready reply wording (finding 1). Checked after: `test_whatsapp_webhook.py` 13 passed; the new assertion fails on the old code.

## Still open
- [Low] "Being made" photo messages have no limit (`send_making_photo`, first seen 18 Nov): still no time check.
- [Low] `scripts/live-db-read.py` `shell=True` with a list (first seen 18 Nov): still there, line 22.
- [Decision] `scripts/live-db-read.py` prints customers' phones, emails and addresses (first seen 18 Nov): `HIDE` unchanged.
- Audit sandbox: no MongoDB and no Playwright again (since 15 Oct).

## Could not confirm
- That Meta's delivery report for a failed alert carries the same message id `_post_meta` now saves (`whatsapp_sent._id`). The tests feed a matching id; a real failed send would confirm it. If ids differ, the backup text simply never goes out, same as before this change.
- That Meta accepts the new reply buttons (`interactive` button message) inside the 24-hour window; needs a real send.

## Verified working
- **WhatsApp order steps** (6b2cc52, d90caf8, 8075030): each button needs the matching status (`_MOVES`: new to preparing or cancelled, preparing to ready, ready to done), a late or repeated tap is answered "already ..." and changes nothing, the sender must be one of the business's own numbers (`_owner_numbers`), and each message id is handled once (`_first_time`). Reading Meta's sender as `+` plus digits keeps Israeli numbers the same (`972...` stays `972...`) and fixes foreign ones.
- **Backup text on failed delivery** (1cf9a77): only alerts saved in `whatsapp_sent` get one, the record is deleted as it is read so a re-sent report texts once (test passes), and the records expire after two days (TTL index on `at`, stored as a datetime).
- **"Looks great" on the making photo** (a157202): no sign-in, the tracking token is the key, rate limited, 404 without a photo, a second tap changes nothing. The warmer review text gives way to the business's own review wording.
- **Contact taps** (53bec78): the owner's count and the admin People tab count the same kinds (WhatsApp from listings, WhatsApp, call and email from designed sites); `lead_events.created_at` is an ISO string and the cut-off is compared as one, `site_taps.at` as a datetime.
- **Texts page preview** (eac62d6, c6aed88): `logo_url` and one sample product go only to the signed-in owner's settings.
- **Order alert photo**: falls back to the business logo, and Meta only gets `https://` pictures.
- **Tests**: `test_whatsapp_webhook.py`, `test_whatsapp_new_order.py`, `test_order_making_photo.py`, `test_text_extras.py`, `test_item_size.py`, `test_listing_price_parity.py`: 57 passed, 6 skipped (the ones that need the API).
- **Script tests**: all 11 `scripts/test-*.mjs` run pass, including `test-i18n-parity.mjs` (today's new Hebrew keys are all there).
- **Tooling**: `push-onto-main.mjs` and `commit-rules.mjs --push` push without force.
- **Build**: production build passes (`EXIT 0`); its warnings are the existing Tailwind and ESLint ones, none in today's changed files.

## Not checked
- PRICE CHECK not run: the routine forbids fetching myisraelrental.com and the sandbox proxy blocks it. The price parity test ran and passed.
- `FAILED  playwright + chromium`, `FAILED  mongodb on :27017 (curl: (22) The requested URL returned error: 403)`, `SKIPPED api (no database)`. So the endpoint tests skipped and the full backend suite was not run.
- `scripts/test-moving-ad-checks.mjs` skipped: it records for 10 to 15 minutes and needs Chromium. Today's film, still and look checks (`check-look.mjs`, `check-light-pool.py`, `logo_check.py` and others) are visual tooling and were only read.
- The page editor and ad maker changes (`PageEditor.jsx`, `AdMaker.jsx`, `MessagePreview.jsx`) are the UI audit's area.
