# Code audit, 18 Oct 2026

## In short
- Nothing broken tonight in what changed (contract storage move, claim links, search pages for Google and AI, driver fields). The checks that could run passed, but the database and browser could not start here, so seven database tests were not run properly.
- Hebrew readers see English on the order basket (add, more, less, continue, out of stock) and on the Jobs board area box: those labels are in the code but missing from both language files. Found by the project's own check; not from tonight's commits.
- Fixed tonight: one wrong code comment about the server keeping contracts on a volume (branch `claude/exciting-bell-y6xfuj`).
- Needs your decision: none.

## New findings
1. [Low] Bilingual: 14 `t()` keys used in `CardAction.jsx` (`basket.*`, 12 keys) and `JobsBoard.jsx` (`jobsBoard.areaPh`, `jobsBoard.areaFreeText`) exist in neither `en.js` nor `he.js`. Hebrew users get the English default string. Proof: `node scripts/test-i18n-parity.mjs` prints FAIL "every t() key in the app exists in en.js (14)"; the keys use the form `t('basket.less', 'One less')` (CardAction.jsx:39). Also fails the plural check for `basket.chosenN`, `basket.items`. Not fixed: more than 20 lines of natural Hebrew copy. First seen 18 Oct; code dates from 15-16 Oct.
2. [Low] Dead end: `scripts/test-completeness-actions.mjs` fails: the business checklist item "category" opens the listings form, which has no control for it. Proof: the script prints `FAIL "category" -> onOpenListings -> setOpenBiz`. Dead-ends audit's area; listed for it. Code from 15 Oct.

## Fixed this run
- 95f81cd `frontend/server.js`: comment said the backend keeps contracts on a volume; it no longer does. `node --check` passes.

## Still open
See `open-issues.md` (no change).

## Could not confirm
- Claim link (`businesses.py`, `claim_business`): the traded check and the move of listings are not one atomic step, so two people opening the same link within milliseconds could both pass. Needs the database to try; very unlikely in practice.
- Product-extract (`product_extract.py`): the image type sent to the model is the browser's claim (`file.content_type`) after the file itself was validated. A wrong claim should only produce the "could not read" message. Needs a live call, which spends API credit.
- IndexNow loop runs in every backend copy; during the short overlap at a deploy two copies could send the same list. Harmless duplicate.

## Verified working
- Reviewed the 26-hour diff of backend, server.js and scripts: contract keep/ensure/forget paths (all reads still go through permission-checked endpoints; no public mount; a failed Cloudinary save refuses the upload; a failed signed-PDF save leaves the original in place), claim links (token stored as hash, admin-only mint, rate limits, same 404 for unknown and used tokens, history guard re-run on claim), search pages (all text HTML-escaped, no phone or email, sitemap values escaped), `llms.txt` slug input is regex-limited.
- Passing: 54 of the 70 tests in the files touched tonight, including `test_listing_price_parity.py`, `test_seo.py`, `test_product_extract.py`, `test_quote_custom_fields.py`.
- Frontend production build passes. 9 of 11 `scripts/test-*.mjs` pass.

## Not checked
- FAILED  playwright + chromium (download blocked: cdn.playwright.dev 403)
- FAILED  mongodb on :27017 (download blocked, 403), SKIPPED api (no database). Seven tests need the database and failed with connection refused: `test_contract_cloud_storage.py` (2), `test_business_claim.py` (5). Not real failures; rerun where a database exists.
- Full backend suite (only the files touched tonight were run, to fit the time), dependency audit, screenshots (UI audit's area).
- PRICE CHECK DID NOT RUN: could not read https://myisraelrental.com/api/properties (proxy 403). The offline parity test passes.
