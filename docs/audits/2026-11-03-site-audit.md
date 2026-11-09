# Code audit, 3 Nov 2026

## In short
- Nothing broken found in the last day's two commits (the new Ads area in Super Admin).
- Fixed tonight: nothing needed.
- Needs your decision: none.

## New findings
None.

## Verified working
- `backend/routes/admin/ads.py`: all three routes (list, save, delete) check for an admin role; unknown designs refused; saved size capped.
- Every `adStudio.*` text key used in `AdStudio.jsx` (28) exists in both `en.js` and `he.js`; `adsTab` exists in both.
- Production build passes. `test_listing_price_parity.py`: 17 passed. `scripts/test-*.mjs`: all ok.

## Could not confirm
- Sample ad texts in `en.js` contain exclamation marks ("order by Thursday!"); these are example ad copy, not site copy, so left alone.

## Not checked
- FAILED  playwright + chromium (install error in setup)
- FAILED  mongodb on :27017 (download returned 403); API skipped. The full backend suite hung without a database, so it was not run.
- PRICE CHECK DID NOT RUN: myisraelrental.com blocked by the proxy.
