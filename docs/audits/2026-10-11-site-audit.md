# Site audit, 11 Oct 2026 (nightly, partial)

Scope: commits of 9 Oct (owner page editor, restaurant map pins, showcase row).

## Findings
- **Medium** `backend/routes/marketplace/page_edits.py` HREF_RE: allows `/` as a prefix, so `//evil.com/x` (protocol-relative, an external site) passes the link check. Only the business owner can save it, but it appears on their public page. Fix: require `/` not followed by `/`.
- **Low** `GET /marketplace/business/{slug}/page-edits` is public and `frontend/server.js` skips its cache with `?fresh`, so anyone can make the server hit the API on every request.
- **Low** `backend/routes/restaurants.py` `_pin_from_address`: no try/except around the Nominatim calls. `/admin/restaurants/pin-missing` would return a 500 on one timeout and lose the whole batch. `asyncio.create_task` result is not kept (can be garbage collected). Admin lat/lng not range-checked.
- **Low** New UI (PageEditor.jsx, ShowcaseCard.jsx, ShowcaseStrip.jsx) hardcodes hexes (#F3F4F6, #ECEDF0, #E9EAEE...) instead of tokens.

## Verified clean
- Edit routes check ownership (`_owned`); script/style tags are stripped; image URLs must be https with no quotes; editor postMessage checks origin both ways.
- All `t()` keys in the changed files exist in en.js and he.js (loose check).
- No inline Playfair in changed files.

## Not checked
- Live price check DID NOT RUN (proxy 403 reaching myisraelrental.com). Treat listing prices as unchecked.
- Backend tests did not run (sandbox python cannot import pymongo/cryptography). Price-parity test unverified.
- No build, screenshots, Lighthouse or dependency audit.
