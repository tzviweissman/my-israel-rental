# Code review, 22 Nov 2026

## In short
- Today's new free-delivery codes mostly work as intended: the goods cost the same, the fee goes, and the code is refused on a pickup. Two rough edges are left.
- A customer who types a free-delivery code on a service booking or a quote sees "Code applied", then the booking is refused when they send it. They have to remove the code and send again.
- A free-delivery code gets used up on a delivery that was already free (the order was over the shop's free-delivery amount). If the code is one per customer, that customer has lost it and saved nothing.
- Fixed tonight: in a dollar shop, the code buttons at checkout said "over ₪50" while the bar above said "$50". Branch `claude/exciting-bell-ds4iyv`.
- Needs your decision: pull request #29 (Audit fixes 21 Nov) is still waiting. It has the fix for the ad size line that could freeze the site for everyone, plus the English words for the Businesses page. Until it is merged, none of that is live.

## New findings

1. **[Low] A free-delivery code is "applied" on a booking or quote, then the send is refused.** The live check `POST /businesses/{id}/discount-codes/check` (`backend/routes/marketplace/discounts.py:377`) is called with `form="orders"` by the order page, the service booking (`frontend/src/pages/GigDetail.jsx:323`) and the quote page (`QuoteTrackPage.jsx:87`), and it accepts a `free_delivery` code. On send, bookings (`gigs.py:1390`) and quotes (`quotes.py:237`) go through `use_code`, which now raises for that kind (`discounts.py:282`). Proof, with the real functions on an in-memory database:
   ```
   1. live check on a service booking / quote form: {'ok': True, 'code': 'FREESHIP', 'kind': 'free_delivery', 'value': 0, 'discount': 0.0}
      then booking / quote submit (use_code) refuses: This code is for free delivery on an order
   ```
   The booking form shows "Code FREESHIP applied" and "After the code: ₪300", then the request fails. Fix: either let `DiscountCodeInput` take a prop (say `delivery`) that the two non-order forms leave off, refusing `kind === 'free_delivery'` there with the same sentence, or add a `delivery: bool` to `CheckIn` that the order page sends. Not fixed: it is in the discount flow.

2. **[Low] A free-delivery code is used up when delivery was already free.** In `place_website_order` the code is redeemed (`orders.py:2741`, which counts a use and adds the phone to `used_by`) before the fee is worked out (`orders.py:2763`, `delivery_fee_for`, which is 0 once the goods reach `free_over`, or when the area fee is 0). The order page also still sends the code in that case (`OrderPage.jsx:305`). Proof, same in-memory run (store fee 25, free over 200, max one use):
   ```
   2. order of 250, store free over 200: redeemed = True | fee the code saves = 0.0
      code after: {'uses': 1, 'discount_given': 0.0, 'used_by': ['972547770001']}
      same customer's next order of 120 (fee 25): This code has been used up
   ```
   Fix: work out the fee first and skip the redeem (and leave the code off the order) when a free-delivery code would save 0; or have the order page drop the code when `feeFor(city)` is 0. Not fixed: it changes what is stored on the code.

3. **[Low, fixed] Code chips showed the minimum in shekels in a dollar shop.** `DiscountCodeInput.jsx` (2c03fb4) printed each chip's "over N" with the code's own currency. `_check_in` saves every free-delivery code as ILS (`discounts.py:81`), and the server checks the minimum against the order's currency (`discounts.py:212`), as the bar above does (`FreeDeliveryBar.jsx`, the shop's currency). So a $ shop showed "Free delivery with code FREESHIP on orders over $50" above a chip reading "over ₪50". Fixed: the chip uses the form's currency.

No other findings; none dropped.

## Fixed this run
- DiscountCodeInput: the chip minimum uses the order's currency (finding 3). One line. Checked: production build passes; the change only affects the label of a chip's minimum, nothing sent to the server.

## Still open
- PR #29 (open since 21 Nov) carries the 20 Nov fixes: ad size line stall (Medium, 66123b93), English /businesses words (b7932cc8), two Railway scripts, and the in-memory database for audits (0e10ddc2). Because it is not on main, `test-i18n-parity` fails the same 3 checks tonight (browse.* missing from en.js). Nine older "Audit fixes" PRs (#7 to #18) are also still open.
- 20 Nov: a size priced at 0 on designed shops (decision), and the "being made" photo limit. Not re-checked; no commits touched them today.
- Everything else in `open-issues.md` was outside today's changes and not re-checked.

## Could not confirm
- Whether any live business already has a free-delivery code in a dollar shop, or a free-delivery code that has been used up on an already free delivery. That needs the live database, which this audit does not read.

## Verified working
- **Free-delivery codes** (8d380af): the goods total is unchanged and the fee is 0; a pickup with the code is refused before the code is counted, and the reserved stock is put back; a dry run counts nothing; the saved fee is added to the code's "given" figure; the code is forced to orders only, so the membership sign-up refuses it (`applies_to` check); `use_code` refuses it on bookings and quotes rather than recording a 0 discount.
- **Shown codes** (`GET /gigs/{id}/promo`, 4077236 and 2c03fb4): public on purpose, returns only codes the owner ticked "show", live today, not used up, not membership-only, capped at 20 read and 5 returned; the free-delivery one only when the store delivers (`offers_delivery`). It returns code, kind, value, minimum, end date and first-order flag only, no counts or phone lists.
- **"Add N more for free delivery"** (bb6402f): the store's free-from amount is compared with the goods after any discount, and a code's minimum with the subtotal, the same two figures the server uses (`delivery_fee_for`, `evaluate`), so the line does not promise free delivery the server would not give.
- **Hebrew** for the new strings: `discounts.py` `_HE` has both new refusal sentences; the parity test shows every en.js key in he.js.
- **Tests**: `test_listing_price_parity.py` and `test_discount_codes.py`: 17 passed, 7 skipped (need the API). Script tests: 10 of 11 pass (moving-ad skipped); `test-i18n-parity` fails as above, fixed in PR #29.
- **Build**: production build passes. No new warnings in today's files (the GigDetail warnings are at lines 101 and 1605, older code).
- `frontend/server.js` and `backend/.env.example`: unchanged today. Today's other commits are rules, ads and build tooling for designed sites (no data or security code).

## Not checked
- PRICE CHECK not run: the routine forbids fetching myisraelrental.com and the sandbox proxy blocks it. The price parity test ran and passed.
- `FAILED  playwright + chromium`, `FAILED  mongodb on :27017 (... curl: (22) The requested URL returned error: 403 )`, `SKIPPED api (no database)`. So `test_free_delivery_code` and the other API tests skipped; findings 1 and 2 were shown with the real functions on mongomock instead.
- Full backend suite: not run without a database (it timed out on 20 Nov).
- `scripts/test-moving-ad-checks.mjs`: needs Chromium, 10 to 15 minutes.
- The new free-delivery bar and chips as they look: the UI audit's area. `scripts/dev-worktree.mjs`, `check-free-delivery.mjs` and today's site-rule scripts were only read.
