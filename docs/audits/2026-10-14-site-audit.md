# Code audit, 14 Oct 2026

## In short
- Stores whose description says "Delivery not available" or "We do not offer delivery" were being switched to delivery automatically by last night's "delivery by their words" change, so customers could place delivery orders the store never offers.
- Anyone can use up the whole month's Google restaurant-photo allowance (4,000 photos, about $28) in a few minutes, after which every restaurant card loses its photo until next month.
- The Sukkot dates the booking calendar falls back on ended on 3 Oct, so if the holiday service is unreachable the Sukkot page offers dates in the past.
- Fixed tonight: the delivery wording problem (branch `claude/exciting-bell-rmip4j`, commit 8df68686).
- Needs your decision: whether the photo endpoint should get a per-visitor limit (suggested), and the 2027 Sukkot dates for the fallback.

Scope: 31 commits in the last 26 hours (memberships, custom questions, restaurants photos and map, business tools, order delivery, invite page, nav).

## New findings

1. **[Medium] Delivery switched on by "no delivery" wording.** `backend/routes/marketplace/orders.py` `says_delivery`: the word "delivery" matched inside negations. Proof: `says_delivery({"description": t})` returned True for "Delivery not available", "We do not offer delivery", "Delivery is currently unavailable", "Delivery is not offered". Fixed, see below.
2. **[Medium] Photo allowance can be drained by anyone.** `backend/routes/restaurants.py` `restaurant_photo` (GET `/restaurants/photo/{place_id}`): no sign-in and no rate limit, and it adds 1 to a global monthly counter on every call, before checking the place has a photo. A loop over real place ids passes 4,000 in minutes, then the endpoint returns 404 for everyone (cards fall back to icons) and the cost cap is spent. Fix: `check_rate(request, ...)` per visitor, count only when Google is actually called, and send a long browser cache (the redirect currently caches 1 hour, private). Read from code; not run, no database in this sandbox.
3. **[Low] Sukkot fallback dates are in the past.** `frontend/src/constants/holidayWindows.js` ends 2026-10-03. `tests/test_holiday_fallback_not_stale.py::test_fallback_window_has_not_passed[sukkot]` fails: "ended 2026-10-03 (11 days ago)". Only bites when Hebcal is unreachable. Needs the 5788 dates from Hebcal (not guessed here).
4. **[Low] Membership sign-up can email any address.** `backend/routes/marketplace/memberships.py` `join` sends a confirmation to the typed email, limited to 20 per 10 minutes per IP. Same pattern as orders; mention only, no change suggested beyond keeping the limit.

## Fixed this run
- Finding 1: negation phrases added to the "does not deliver" pattern. New test `test_saying_it_does_not_deliver_stays_off` fails before, `tests/test_delivery_by_their_words.py` 8 passed after. Commit 8df68686.

## Still open
- [Low] i18n parity: `jobsBoard.areaPh` / `jobsBoard.areaFreeText` missing in `en.js` (`test-i18n-parity.mjs`). A fix exists on `origin/claude/exciting-bell-6x8laq` (51649002), not merged. Since 8 Oct.
- [Low] i18n parity: `restaurants.more` uses a count with no plural. Since 8 Oct.
- [Low] `test-completeness-actions.mjs`: "category" item has no control. Since 8 Oct.
- Earlier items (page editor link filter, EMAIL_REPLY_TO mailbox) unchanged. The non-ASCII admin token 500 is fixed by 6814df4.

## Could not confirm
- Concurrent door scans can take a pass's visits below zero (`_checkin` reads state, then `$inc`s). Needs a real database and two parallel requests.
- Whether the new queries have indexes (`restaurants` `_has_photo` sort is computed per request over the filtered set). Needs data volume.

## Verified working
- Memberships: every owner route checks business ownership; member page and door link use long random tokens, door link can be rotated; QR code and member page token are separate; sign-up is rate limited; emails are escaped.
- Dashboard tools: only known tool names are written. `server.js` product injection escapes `<`.
- Frontend production build passes. All `scripts/test-*.mjs` pass except the two known ones above. New `t()` keys in this day's code exist in both English and Hebrew.
- Backend: 44 passed, 14 skipped across the new test files plus listing price parity.

## Not checked
- FAILED  playwright + chromium (setup, install error). FAILED  mongodb on :27017 (download returned 403). SKIPPED  api (no database). So tests needing a database (about 50) and any request against a running API were not run, and nothing was screenshotted (UI audit's area).
- `test_type_coverage` fails here only because mypy cannot import pydantic in this sandbox.
- PRICE CHECK DID NOT RUN (live site is blocked from the sandbox); price parity test passes.
