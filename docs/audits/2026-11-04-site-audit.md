# Site audit (code review), 4 Nov 2026

## In short
- Top issue: anyone who is not signed in can make a business's tracking record grow without limit, by visiting its short link with made-up ad names. Nothing breaks at once; a very large record would slow that business's link and dashboard. (Medium)
- Fixed tonight: the new "visits this week" lines in the ad maker had no singular and plural forms, which failed the translation check. Fixed on branch `audit/2026-11-04-site-audit` (one commit).
- Needs your decision: whether to cap the number of distinct ad names counted per link (suggested: only count names the ad maker really uses).
- Ran partly blind: no database or browser in tonight's sandbox, so most of the backend test suite could not run.

## New findings
1. **[Medium] Unbounded keys on a public endpoint.** `backend/routes/short_links.py` (`_AD_NAME`, `_counted_lookup`): `GET /short-links/{slug}/follow/{ad}` (no login) accepts any name matching `^[a-z]{2,12}(-[a-z]{2,8})?$` and does `$inc` on `ads.<name>` and `ad_days.<day>.<name>`. Proof: `qwertyuiopas-qwertyui` matches the regex, so about 26^20 distinct keys are accepted. Rate limit is 600 per 10 minutes per client, so a script can add thousands of keys a day to one link document (16 MB document cap, and `_public` returns all of `ads` to the owner). Fix: check `ad` against the closed list of design names the ad maker has, or cap the number of keys.

## Fixed this run
- `ads.weekVisits` and `ads.nudgeVisits` got `_one`/`_other` plural forms in `en.js` and `he.js`. `node scripts/test-i18n-parity.mjs` failed on both before and passes after.

## Still open
- Nothing carried over that these commits changed; see `open-issues.md`.

## Could not confirm
- `utils/cutout.py` fetches the owner's image address after a public-address check, but `urllib` follows redirects, so a public address that redirects inward would pass (the code comment already says so). Needs a live test to show.
- `/ads/backgrounds/keep` downloads from pixabay hosts only and httpx does not follow redirects by default, so it looks safe; not run.
- New ad routes (`/ads/saved`, `/ads/summary`) filter by the caller's user id; read, not exercised.

## Verified working
- `test_ads_week.py`, `test_order_texts.py`, `test_listing_price_parity.py`: pass.
- Frontend production build: passes.
- test-i18n-parity: passes after the fix (all other `scripts/test-*.mjs` passed).

## Not checked
- FAILED  playwright + chromium (browser would not install)
- FAILED  mongodb on :27017 (download returned 403)
- SKIPPED api (no database): the rest of the backend suite errors on collection without a database.
- Live price check: not run (the sandbox blocks the live site); parity test above passed.
- Visual checks: UI audit's area, and no browser.
