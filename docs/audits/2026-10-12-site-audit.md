# Site audit, 12 Oct 2026 (read-only, partial)

Scope: the 10 commits of the last 3 days (Blazin' Boards shop, KasherMyBnb site, kosher certificate checks and renewal, Restaurants nav and tile, owner-edit link filter).

## Summary
No Critical or High findings. 2 Medium, 2 Low. 3 checks could not run in this environment.

## Findings
1. **Medium: certificate renewal runs on every replica.** `restaurant_locations_daily_loop` (`backend/routes/restaurants.py`) now also calls `refresh_certificates()` (`backend/scripts/check_kosher_websites.py`). With more than one replica, each runs it at 02:00 UTC. Each one reads websites and calls the Anthropic API, so the cost doubles. The `rechecked_at` weekly guard only helps after the first write. Fix: a Mongo lock or a "last run" document.
2. **Medium: a failed renewal postpones the next try by a week.** When no newer certificate is found, `rechecked_at` is still written. A site that was briefly down, or whose certificate image failed to read, is not retried for 7 days. The card keeps saying "expired" for that time. Fix: only stamp `rechecked_at` when the site and the image were read successfully.
3. **Low: `refresh_certificates` reads `c` after the loop.** It works today because `c` is the matching certificate when `new` is set. Fragile if the loop is edited. Store the matched certificate in a variable of its own.
4. **Low: the link filter lets `/%2F/evil.com` through.** `//evil.com` and `/\evil.com` are now blocked (tested here). The percent-encoded form is only a path on this site, so it is probably harmless. Noting it.

## Verified clean
- `HREF_RE` fix: `//evil.com`, `/\evil.com` and `javascript:` are rejected; `/ok`, `https://` and `tel:` are accepted.
- New `t()` keys (`nav.restaurants`, `restaurants.tileTitle`, `restaurants.tileText`, `restaurants.certificateExpired`) exist in both `en.js` and `he.js`.
- No inline `fontFamily: 'Playfair…'` in the changed frontend files.
- The restaurants tile uses `rtl:rotate-180` on its arrow and logical `pe-5` padding, so it works in RTL.
- `?fresh` on the page-edits cache is now limited to once a second per page.

## Not checked
- **Live price check: DID NOT RUN.** The proxy returned 403 for myisraelrental.com. So no price findings, and that does not mean there are none.
- **Backend tests did not run.** The sandbox Python is missing `_cffi_backend`, so the suite cannot be collected. The price-parity test gave 17 errors. Those are environment errors and say nothing about the code. The `test_page_edits.py` change is untested here.
- Production build, dependency audit, screenshots (LTR/RTL) and Lighthouse were not run.
- Blazin' Boards and KasherMyBnb static pages: only checked that the files changed. The commit says `clipped.mjs` passes.
