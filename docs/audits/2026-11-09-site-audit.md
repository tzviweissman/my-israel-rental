# Code review, 9 Nov 2026

## In short
- Anyone can type any email address into the new business sign-up and our "finish your page" email will be sent to it two hours later. Small volume (10 a day per visitor), but it is mail to strangers from our name.
- Google opening hours for a business that closes after midnight come out wrong (closing time earlier than opening time), so a nightlife or restaurant page could show impossible hours.
- Fixed tonight: nothing. Neither item is a small safe fix (one touches what is emailed, one needs a decision on how overnight hours are stored).
- Needs your decision: whether the draft reminder should wait until the email is confirmed (for example by the Google sign-in step).

## New findings
1. **Medium: reminder email to unverified addresses.** `backend/routes/marketplace/signup_drafts.py` `save_draft` accepts any well-formed email with no login; `run_once` mails it after 2 hours. Cap: 10 new drafts per day per IP via in-memory `check_rate` (resets on restart, per worker). Proof: code reading only; the email text says "you can ignore it", which limits harm. Fix: send only when the visitor later signed in with that address, or add a confirm link.
2. **Low: overnight hours.** `backend/routes/marketplace/product_extract.py` `_hours` ignores the close day. Proof: `_hours([{'open':{'day':1,'hour':20},'close':{'day':2,'hour':2}}])['mon']` returned `[{'start': '20:00', 'end': '02:00'}]`. Fix: clamp the end to 23:59 or split across days, per how the wizard reads windows.

## Fixed this run
None.

## Still open
See `open-issues.md`. The three-count plural failure in `test-i18n-parity` (`ads.nudgeVisits`, `ads.weekVisits`, `advertising.visits`) still fails on this branch; it is already fixed on another branch (60f3d4aa) and waits for the merge. Not new.

## Could not confirm
- Rate limits are per-process memory, so with more than one replica the draft and lookup caps multiply. Would need the production replica count.

## Verified working
- `test_business_lookup.py` and `test_listing_price_parity.py`: 21 passed.
- All new `en.js` keys from the sign-up commit exist in `he.js` (same 16 keys); i18n parity checks pass except the known plural one.
- Draft ids are validated as v4 UUIDs; place ids are validated before being put in the Google URL; Google lookup has a monthly site cap plus a per-IP limit; Google photos are not stored.
- Google sign-up role: only `owner` or `provider` are accepted, anything else becomes `renter`. A new user could already pick those roles via `/auth/role`, so no new privilege.
- Other test scripts: all `scripts/test-*.mjs` pass except i18n parity (above).

## Not checked
- PRICE CHECK DID NOT RUN: could not read https://myisraelrental.com/api/properties (proxy 403). Rely on the parity test, which passed.
- FAILED playwright + chromium; FAILED mongodb on :27017 (403); SKIPPED api (no database). So the full backend suite (needs a database; it hung) and the front-end build were not run, and no screenshots were taken.
- Three test files fail to collect (pytest_asyncio missing).
- The commits that only touched hand-built business pages and the ad-checker script were not reviewed for logic.
