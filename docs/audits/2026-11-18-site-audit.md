# Code review, 18 Nov 2026

## In short
- Nothing broken found in today's backend work. The new order photos (the business's "being made" photo on the customer's order page, the courier's delivery photo and the product photo on the WhatsApp order alert) check who is sending, accept only pictures uploaded through the site, and fall back to today's messages until Meta approves the new templates.
- Worth knowing before the "being made" template is switched on: a business can press "Send another photo" as often as it likes, and every press would be one more paid WhatsApp message to the customer. A limit (say one a few minutes) would stop a nervous tap becoming five messages.
- The new script that reads the live database hides passwords but shows customers' phone numbers, emails and addresses in full in the session. You already said reading is fine; say if you also want those hidden.
- Fixed tonight: nothing. Today's changes were about orders and customer messages, which audits report and never fix.
- Needs your decision: the photo limit and the script's privacy, above.

## New findings
1. **[Low] No limit on "being made" photo messages.** `backend/routes/marketplace/orders.py` `send_making_photo` (about line 1383 to 1402) spawns `send_order_making_to_customer` on every call with no check of `making_photo.at`. Proof: the code path has no rate limit or time check; the button in `OrderCard.jsx:303-311` stays enabled after a send ("Send another photo"). Today it sends nothing because `WHATSAPP_TEMPLATE_ORDER_MAKING` is blank. Fix: skip the WhatsApp send (keep the page update) when the last `making_photo.at` is under, say, 10 minutes old.
2. **[Low] `scripts/live-db-read.py` fails on Mac and Linux.** `subprocess.run([...], shell=True)` with a list runs only the first item through `sh`. Proof: `subprocess.run(['echo','variables','--kv'], shell=True)` prints an empty line here. On Windows (Tzvi's machine) it works. Fix: drop `shell=True` (Windows may then need `railway.cmd`, or `shutil.which("railway")`).
3. **[Decision] `scripts/live-db-read.py` prints customer contact details.** `HIDE` matches `password|token|secret|otp|hash|api_key` only, so `customer_phone`, `customer_email`, `email`, `phone`, `address` print in full into the session transcript. Not a bug against the stated rule; a choice for Tzvi.

No other findings; none dropped.

## Fixed this run
None. Every finding touches customer messaging or production data access, which the README says to report.

## Still open
- Audit sandbox cannot start MongoDB or download Playwright (since 15 Oct): the five making-photo endpoint tests skipped again.
- Everything else in `open-issues.md` was outside today's changes and not re-checked.

## Could not confirm
- That Meta accepts the new photo alert with the Confirm and Decline buttons in the header template: needs the approved template. If the send fails it is refused at once and the existing text fallback in `alert_business_on_whatsapp` takes over, so an order alert is not lost.

## Verified working
- **Permissions on the new endpoint:** `POST /marketplace/orders/{id}/making-photo` uses `_owned_order` (owner, admin, or staff with the orders permission), refuses closed orders, and only takes photos from this app's own upload hosts (`is_allowed_media_url`).
- **WhatsApp sends:** the photo header is only sent for `https://` pictures; without the template set, the order alert, the delivery email and the tracking page behave exactly as before. The webhook logs failed delivery reasons only after the signature check, and logs no phone number.
- **The product photo pick** in `place_website_order` can't fail on a missing product (every line comes from the store's own product list) and runs after the dry-run return.
- **Hebrew:** all six new keys (`orders.makingNote`, `makingPhoto`, `makingPhotoAgain`, `makingPhotoSent`, `track.makingTitle`, `track.makingAlt`) exist in both `en.js` and `he.js`; `test-i18n-parity.mjs` passes.
- **`.env.example`:** the three new template variables are blank placeholders, no values.
- **Tests:** `test_order_making_photo.py`, `test_whatsapp_new_order.py`, `test_whatsapp_webhook.py`, `test_listing_price_parity.py`: 37 passed, 5 skipped (the endpoint tests, which need the API).
- **Build:** production build passes (`EXIT 0`); its warnings are the existing Tailwind and ESLint ones, none in today's changed files.
- **Script tests:** all 11 `scripts/test-*.mjs` pass, apart from `test-moving-ad-checks.mjs` (see Not checked).
- **`live-db-read.py`** calls only `find()` and `list_collection_names()`; it never writes.

## Not checked
- PRICE CHECK not run: the routine forbids fetching myisraelrental.com, and the sandbox proxy blocks it. The price parity test ran instead and passed.
- `FAILED  playwright + chromium`, `FAILED  mongodb on :27017 (curl: (22) The requested URL returned error: 403)`, `SKIPPED api (no database)`. So the endpoint tests skipped and the full backend suite was not run, because without a database it hangs past the time limit.
- `scripts/test-moving-ad-checks.mjs` skipped: it records frames for about 10 to 15 minutes and needs Chromium, which did not install. Today's ad tooling scripts (recorder, logo check, seams check) are visual tooling, not site logic, and were only read.
