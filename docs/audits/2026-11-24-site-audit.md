# Code review, 24 Nov 2026

## In short
- Nothing serious in today's code. The new "choose up to 3 flavours" orders, the "switch a message off" settings, the business's own email look and the WhatsApp catalog reader all hold up against the server's own checks.
- One small permissions gap: a staff member who can see orders can also send the paid test texts and use the translation allowance on the new Texts and emails page, though only the owner can change those messages. At most 10 test texts a day, all to the business's own number. Reported, not changed.
- Fixed tonight: a Hebrew customer whose chosen flavour sold out while ordering got the refusal in English. It now comes in Hebrew. Branch `claude/exciting-bell-k2txx0`.
- Needs your decision: the 23 Nov audit fixes (branch `claude/audit-merge-8kdnag`) are still not on main, so last week's fixes (the missing English words on the Businesses page among them) are not live yet. Also: should staff be able to send test texts, or the owner only?

## New findings

1. **[Low] Staff can send test texts and use translations on a page only the owner can change.** The three routes added on 23 Nov for the Texts and emails page check access with the default "orders" area (`backend/routes/marketplace/orders.py:2158` counts, `:2178` send test, `:2214` translate), so staff with the Orders area pass. Saving the messages beside them is owner only (`:2136` and `:2262` pass `None`, "the owner only, for the settings", `orders.py:194`). Proof, from the code:
   ```
   2136:    biz = await _owned_business(business_id, user, None)   # PUT texts (owner only)
   2178:    biz = await _owned_business(business_id, user)         # POST texts/test (staff with Orders)
   2214:    biz = await _owned_business(business_id, user)         # POST texts/translate (staff with Orders)
   2262:    biz = await _owned_business(business_id, user, None)   # PUT emails (owner only)
   ```
   What it costs: up to 10 paid texts a day per business (`MAX_TESTS_PER_DAY`), all sent to the business's own number, and calls against the shared 300-a-day translation allowance that page translations also use. Fix: pass `None` on `:2178` and `:2214` (the counts on `:2158` are harmless to leave). Not fixed: it is a permissions change.

No other findings; none dropped.

## Fixed this run
- `c12ecde9`: "Pick up to N for X" (new today with the choose-up-to-N products) and the older "Pick a choice for X" now answer in Hebrew on a Hebrew order page, like the refusals next to them. Checked with the real `place_website_order` on an in-memory database (dry run), before and after:
  ```
  before: he 400 Pick up to 3 for Platter      after: he 400 בחרו עד 3 עבור Platter
          he 400 Pick a choice for Soda               he 400 בחרו אפשרות עבור Soda
  ```
  English unchanged. `test_pickup_only`, `test_listing_price_parity`, `test_order_texts`: 43 passed.

## Still open
- The 23 Nov audit merge (`claude/audit-merge-8kdnag`, carrying PR #29 and the 22 and 23 Nov fixes) is not on main. So `test-i18n-parity` fails the same 3 checks tonight: `browse.*` and `wizard.pickCategory`/`pickSubcategory` missing from en.js (all present on that branch).
- 22 Nov: a free-delivery code "applied" on a booking or quote, then refused; a free-delivery code used up on a delivery already free. 23 Nov: a code stays applied after the basket drops under its minimum. All waiting on a decision; no commit today touched them.
- Everything else in `open-issues.md` was outside today's changes and not re-checked.

## Could not confirm
- Whether the WhatsApp catalog reader (`list_tiles` and the name read-back, `utils/catalog_crops.py`) gives the right photo on a real catalog: it needs real screenshots and a paid reader call. The built-in self-test passes on a drawn page.
- Whether `scripts/test-order-picks.mjs`, `test-signup-flow.mjs` and `test-tier-limit.mjs` pass: they need the API with a database and a browser (see Not checked).

## Verified working
- **Choose up to N** (25027a3, `orders.py:2790`): the line is priced at the product's own price, as the order page shows it (option prices are not added on either side); a flavour named twice counts once; a sold-out flavour, none or too many chosen are refused; stock is taken per product, as before; `picks` is limited to 2 to 10 in the model (`shared.py:665`).
- **Messages switched off** (`order_texts.py:109`): only the four optional messages can be switched off (`clean_off`); confirmations and declines always go; each of the four senders checks it. The page says plainly that switching off the order text still leaves the email receipt, which matches the code.
- **Message counts** (`message_counts`): the logged kinds match what the senders write (`booking_accepted`, `order_review`, `booking_reminder` and the rest), and the date field is the same ISO text the logs store.
- **Business email look** (`order_emails.py:54`): colour accepted only as `#RRGGBB`, logo size from a fixed list, name and logo address escaped; white or ink chosen by the 4.5:1 contrast rule; off by default, so approved businesses' emails are unchanged; customers' emails only.
- **Test messages**: owner's own number or email only, 10 a day, words cut to 300 and escaped in the email.
- **Translate**: a sign-in, the daily cap, the words treated as data, and refused if a `{piece}` is lost.
- **Reader limits**: 60 rows in the reader (`product_extract.py:450`) and 60 in the sign-up form (`CreateGig.jsx:393`, one shared limit with a message when reached); the backend model has no smaller cap. Up to 15 screenshots, behind the existing 30-an-hour per-person limit.
- **scripts/hf.py**: the key is never printed; the spending log (`docs/higgsfield-log.jsonl`, 36 lines) holds no key or token; a model with no price stops before anything is sent.
- `frontend/package.json`: only the `packageManager` checksum removed (08ccd16), as the deploy fix says. `frontend/server.js` and `.env.example` files unchanged today.
- **Tests**: price parity, order emails, order texts, site reader, product extract, page products, pickup only: 78 passed. Script tests: 10 pass; `test-i18n-parity` fails as above.
- **Build**: production build passes.

## Not checked
- PRICE CHECK not run: the routine forbids fetching myisraelrental.com and the sandbox proxy blocks it. The price parity test ran and passed.
- `FAILED  playwright + chromium`, `FAILED  mongodb on :27017 (... curl: (22) The requested URL returned error: 403 )`, `SKIPPED api (no database)`. So `test-order-picks.mjs` (needs `GIG=`), `test-signup-flow.mjs` and `test-tier-limit.mjs` (browser) did not run; the fix above was shown with mongomock instead.
- Full backend suite: not run without a database.
- `scripts/test-moving-ad-checks.mjs`: needs Chromium, 10 to 15 minutes.
- How the new Texts and emails page, sign-up checklist and order sections look: the UI audit's area. Today's ad, rules and site-build scripts were only read.
