# Code audit, 27 Oct 2026

## In short
- Nothing broken for customers or business owners was found in the last day's backend changes (Stays totals, reply-time line, duplicate-listing hiding, email-case fix). The new tests pass (53 of 53) and the site builds.
- One small thing was off: the new "Usually replies within N hours" text was missing its plural forms, which made the translation check fail. Fixed tonight (branch `audit/code-2026-10-27`).
- Still failing from before: the same translation check also fails on the "away reply" setting text (added 25 Oct), the same kind of gap.
- Needs your decision: when a new import shares half or more of its photos with a visible listing of the same type and bedroom count, it is hidden automatically as a duplicate. That is reversible by an admin, but a real second flat in the same building with the same photos would vanish from search until someone notices. Keep as is?

## New findings
1. **[Low] Plural forms missing for `stays.repliesWithinHours`** (`frontend/src/locales/en.js`, `he.js`). Proof: `node scripts/test-i18n-parity.mjs` listed it under "no NEW t(key, { count }) without a plural set". Fixed, see below.
2. **[Low] Reply time ignores the newest messages for very busy listers** (`backend/utils/reply_time.py`, `owner_reply_hours`): messages are read oldest first and cut at 5000, so an owner with more than 5000 messages in 180 days is measured on the oldest 5000 only. Fix: sort newest first, then reverse. Not fixed: not obviously safe to change without the live data shape; no owner is near that today as far as the code shows.
3. **[Low] `awayReply.body` has `{{count}}` with no plural set** (`en.js:913`, added 25 Oct, commit 60db83b). Same check fails. Not part of today's commits, noted as still open.

## Fixed this run
- 43bc464: `repliesWithinHours_other` (English) and `_two`/`_other` (Hebrew). After: `test-i18n-parity.mjs` shows only the `awayReply.body` failure left; build passes.

## Still open
- Translation check fails on `awayReply.body` (since 25 Oct).

## Could not confirm
- `POST /properties/quote-batch` is open to anyone and prices up to 200 ids per call, including hidden listings. No rate-limit setting was visible in the route. Confirming needs the running API (no database in this sandbox).
- `users.email_ci_unique` index will be skipped (logged as a warning) while mixed-case duplicates exist in production, and `invite_courier` now looks up lower-case, so a courier whose stored email has capitals will not match until `backend/scripts/fix_email_case_accounts.py --apply` is run. Confirm against production after the script runs.

## Verified working
- `tests/test_quote_batch.py`, `test_reply_time.py`, `test_import_photo_duplicate.py`, `test_area_filter.py`, `test_listing_price_parity.py`: 53 passed.
- Production build passes. All `scripts/test-*.mjs` pass except the translation check above.
- New English keys all have Hebrew counterparts.
- `fix_email_case_accounts.py` is a dry run unless `--apply` and writes its backup outside the repo.

## Not checked
- FAILED  mongodb on :27017 (download returned 403), so the API did not start and the full backend suite, which needs a database, was not run. Only the tests that need no database ran.
- FAILED  playwright + chromium (download blocked), so no screenshots (visual layer is the UI audit's area anyway).
- Live price check: needs myisraelrental.com, blocked in this sandbox. The offline price parity test passed.
- Earlier reports (`audit-history.sh`) were not gathered, so "new" is judged against `docs/audits/open-issues.md` only.
