# Code review, 10 Nov 2026

## In short
- Business owners who click "Stop these emails" on the new weekly "your ad is ready" email have no way to turn them back on: there is no switch for it in the dashboard's email settings, unlike every other email that offers a stop link.
- Fixed tonight: a business sending a holiday or "it has been a while" message to its customers could send it with our fill-in prompt still in it, for example "[What you offer for the holiday, and how to order or book it.]". The check that stops this missed those prompts since 5 Nov; it now catches every one, in English and Hebrew.
- Fixed tonight: reading products or a listing out of photos (the new "cut the pictures out" feature) froze the whole site for every visitor while it worked, up to about 12 seconds for a 30-item menu. It now works in the background.
- Fixed tonight: after reading a listing from screenshots, one photo said "with 1 photos". It now says "1 photo" in English and reads correctly in Hebrew. All three fixes are on branch `claude/exciting-bell-v86yyg`.
- Needs your decision: the weekly ad email will go to every existing business owner with a product photo and no saved ad on the first Sunday to Thursday morning after this deploys, all at once. If that is not what you want, say so before it ships.

## New findings
1. **Low: ad emails opt-out is a one-way door.** `backend/routes/marketplace/weekly_ads.py:26` stores `ad_emails_off` in `job_notification_preferences`, but `EMAIL_SWITCHES` in `backend/routes/marketplace/notification_prefs.py:123` has no entry for it, and `frontend/src/components/dashboard/EmailSwitches.jsx` shows no ad emails switch. Proof: `grep -rn ad_emails frontend/src backend/routes` finds only `weekly_ads.py`. Same class as the dead ends fixed 4 Oct (emails that promise a stop with no switch). Fix: add `"ad_emails": ("prefs", "ad_emails_off")` to `EMAIL_SWITCHES` and `EmailSwitchesIn`, a row in `EmailSwitches.jsx`, and its English and Hebrew label. Not fixed here: it touches the settings UI and stored preferences.
2. **Medium (fixed): picture cutting blocked the server.** `backend/utils/catalog_crops.py` `crop()` ran PIL and numpy work directly inside the async handlers `products/extract` (up to 30 rows) and `properties/extract-from-pictures` (up to 20 photos). Proof: 0.39 s per crop on a 3000x4000 photo; a loop-latency check over 5 crops showed other requests stalled 1.87 s. Fixed in 879d76dc.
3. **Low (fixed): `dashboard.adPicsDone` had no plural forms.** `frontend/src/components/dashboard/AddPropertyModal.jsx:186` passes `{count}`; `test-i18n-parity` failed on it ("no NEW t(key, { count }) without a plural set"). Fixed in d10948a5.

4. **Medium (fixed): customer messages could go out with template gaps unfilled.** `backend/routes/marketplace/customer_messages.py:187` `_UNFILLED` (narrowed 5 Nov, a87a0c7e) only matched gaps opening with "Your" or "שלכם". The 8 holiday templates' main gap and both "been a while" gaps (`en.js:7451-7483`, `he.js:7273-7305`) open otherwise, so `_check_filled` let them through. Proof: `tests/test_occasions.py::test_unfilled_brackets` failed (`assert None` on "[What is new: a product]"); a scan found 10 English and 10 Hebrew template gaps the regex missed. Not from today's commits; surfaced by tonight's full suite. Fixed in 965610bd.

No other findings; none dropped.

## Fixed this run
- d10948a5: `adPicsDone_one/_other` (English) and `_one/_two/_other` (Hebrew). After: `test-i18n-parity` no longer lists it; the three known counters remain (below).
- 879d76dc: `crop()` now runs through `asyncio.to_thread` in `catalog_crops.keep` and in `extract_from_pictures`. After: loop stall 0.02 s over the same 5 crops; `python utils/catalog_crops.py` self-test prints ok; `test_business_lookup.py` and `test_listing_price_parity.py` 23 passed.

- 965610bd: `_UNFILLED` also matches the template openings "What you offer", "What is new", "An offer for coming back", "מה חדש", "מה אתם מציעים", "הטבה לחוזרים". After: `test_occasions.py` 4 passed; 0 template gaps in en.js or he.js missed; "[VIP]", "[sale]", "Size [M]" still allowed.

## Still open
- `ads.nudgeVisits`, `ads.weekVisits`, `advertising.visits` without plural forms, first seen 6 Nov. Fixed on the audit branch (d5450913), not yet on main.
- Sign-up draft reminder emails any typed address, first seen 9 Nov.
- Overnight Google opening hours read wrong (`_hours`), first seen 9 Nov.
- Three test files do not collect (`pytest_asyncio` missing), first seen 20 Oct.
- Audit sandbox has no MongoDB or Chromium, first seen 15 Oct.

## Could not confirm
- The weekly email loop re-scans every business (several queries each) every hour from 07:00 to 10:00 UTC, including those with nothing to send, because only a business that is emailed gets `ad_email_at`. Fine at today's size; would need the production business count to judge.
- The first AI product photo for a new business is made automatically (paid, about $0.11) with no site-wide daily cap, only per business (5) and per user (10). Someone making many accounts could spend credit; would need the account creation limits checked against the live API.
- A failed send in `run_once` still sets `ad_email_at`, so that owner waits a week. By design or not, needs Postmark logs.

## Verified working
- Weekly ad email: the opt-out token carries its own purpose and is checked by `verify_notification_token`; the endpoint is rate-limited; business name and item are HTML-escaped (test passes); each business is claimed with `find_one_and_update` before sending, so two server copies cannot both send.
- `first-ad-shot` and `ads/shots`: ownership checked with `_assert_owns_target`; the product photo comes from the business's own listing, never from the request; per-business and per-user daily caps.
- `extract-from-pictures`: owner/manager role, 1 to 6 pictures, each validated as an image, 30 an hour per user, prompt tells the model to transcribe and not follow instructions, rows capped at 50, nothing saved but the cut-out photos.
- `products/extract` with no file part: 400 "Paste a list…" (the new `File(default_factory=list)` works); with 7 pages: 400 "Up to 6 pages". Checked on a stub app.
- Onboarding goals: unknown goals dropped, at most 4; `order_by_goals` tested.
- `HF_KEY` is in `backend/.env.example`; `higgsfield-client`, `onnxruntime`, `numpy`, `pillow` are in `requirements.txt`.
- Production build passes; its eslint warnings are all in older lines (none in today's changes). New `en.js` keys all exist in `he.js`.
- `scripts/test-*.mjs`: all pass except `test-i18n-parity` (known counters above) and `test-store-basket` (cannot load `react` from the repo root in this sandbox; not new).

## Not checked
- PRICE CHECK DID NOT RUN: the routine forbids fetching myisraelrental.com and the sandbox proxy blocks it. The parity test passed.
- FAILED  playwright + chromium (last lines: at ChildProcess.<anonymous> (/home/user/my-israel-rental/node_modules/playwright-core/lib/coreBundle.js:32015:32) at ChildProcess.emit (node:events:519:28) at ChildProcess._handle.onexit (node:internal/child_)
- FAILED  mongodb on :27017 (last lines: at ChildProcess.emit (node:events:519:28) at ChildProcess._handle.onexit (node:internal/child_process:293:12) curl: (22) The requested URL returned error: 403 )
- SKIPPED api (no database)
- Full backend suite (three uncollectable files left out), no database: 1127 passed, 949 skipped, 105 failed, 44 errors in 6 min. All failures and errors but two are database connection errors (pymongo). Of the two: `test_occasions` is finding 4 above (fixed); `test_type_coverage::test_mypy_clean` fails because the sandbox's mypy cannot import pydantic (environment, not code).
- The weekly email loop and the first-ad-shot flow were not run end to end.
- The commits that only touched business sites, ad blueprints and ad-checker scripts were not reviewed for logic (visual layer and tooling).
