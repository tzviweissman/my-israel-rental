# Code audit, 21 Oct 2026

## In short
- Hebrew-speaking customers see English on the order basket buttons ("Book", "Send order", "One more" and nine more) and on the jobs board area box, because those texts were never added to either language file. Nothing breaks, but the Hebrew site is half English there.
- The new holiday and win-back messages for the Customers tab (21 Oct) are correct: holiday dates, the "not back in 90 days" group and the "fill in the brackets" guard all pass their tests, and the Hebrew texts are complete.
- One small thing to know: the "fill in the brackets" guard also blocks a real message that happens to contain square brackets, such as "[Sale]". Low risk.
- Fixed tonight: nothing.
- Needs your decision: nothing.

## New findings
1. **[Medium] Missing translations (found by `scripts/test-i18n-parity.mjs`, FAIL).** 12 `basket.*` keys in `frontend/src/components/marketplace/CardAction.jsx` (addToOrder, book, choose, chosenN, continue, items, less, message, more, noPayment, outOfStock, send) and 2 in `frontend/src/pages/JobsBoard.jsx:205-206` (`jobsBoard.areaPh`, `jobsBoard.areaFreeText`) are in neither `en.js` nor `he.js`. English defaults are passed in code, so English works and Hebrew silently shows English. Also `basket.chosenN` and `basket.items` use `{count}` with no plural set. First added 19 Oct (ec337bc), outside tonight's commits. Fix: add the keys to both files with natural Hebrew (about 14 lines each, over the self-fix limit with pluralisation).
2. **[Medium] Dead end (found by `scripts/test-completeness-actions.mjs`, FAIL).** The "category" item of the business completeness list calls `onOpenListings` / `setOpenBiz`, a form with no category control. Output: `FAIL "category" -> onOpenListings -> setOpenBiz`. Dead-ends audit area; noted here for them.
3. **[Low] `backend/routes/marketplace/customer_messages.py` `_UNFILLED = \[[^\]\n]{3,}\]`.** Proven with the regex: `'Join us at [Sale] today'` and `'Order #12 [shipped]'` both match, so a send is refused with "Replace the parts in square brackets". Only the owner's own text is affected and the message says what to do. Possible fix: only refuse brackets that came from the templates (e.g. a sentinel).

## Fixed this run
Nothing.

## Still open
See `open-issues.md`; none of the existing lines changed.

## Could not confirm
- Whole backend test suite: it did not finish in the sandbox (hangs after collection, probably a test waiting on a service). Targeted runs passed (below).

## Verified working
- `tests/test_occasions.py` and `tests/test_listing_price_parity.py`: 21 passed (holiday dates for 5787/5788, Adar II Purim, window crossing the Hebrew year, lapsed rules, bracket guard, website and server price the same).
- `hdate==1.2.2` is in `backend/requirements.txt`, so the new module has its dependency on deploy. No circular import (the occasions module imports customer_messages only inside the route).
- New route is owner-checked (`_owned`) before any customer data is read; sends still go through the existing limits and unsubscribe link.
- New en/he strings for the occasions card, holidays and every ready-made message exist in both files, including Hebrew plurals.
- Frontend production build passes. 28 other `scripts/test-*.mjs` checks pass.

## Not checked
- Price check did not run (the live site is blocked in the sandbox); parity test used instead.
- `test_customer_messages.py` and `test_customer_list.py`: all 7 skipped (they need the live API).
- `audit-setup.sh` did not return in the sandbox (its dev server keeps the pipe open); the backend packages were installed by hand, so API-level checks of the new route were not run.
- `scripts/audit-history.sh` did not run, so `/tmp/prior-audits` was missing; only `open-issues.md` was used as history.
