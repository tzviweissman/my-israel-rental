# Site audit, 2 Oct 2026

Read-only pass. Nothing was edited, pushed or deployed. The only file written is this report.

## Summary

**No Critical or High findings. Two Low findings, and one check that could not run.**

What I looked at: everything merged since 23 Sep (verified reviews, page rules and recipes, size ladder, page upgrade panel, Hebrew business pages). The newest commit on the branch is dated 25 Sep, so nothing new has landed in the last week.

Worth doing first:
1. **Run the live price check from somewhere with internet.** It could not run in this audit (see "Not checked"). Prices are the thing that has bitten before.
2. **Set up a real test run for the backend.** Most backend tests need a local MongoDB and I had none, so they could not be exercised (see "Not checked").
3. **Fix or delete the doc citations that point at files that don't exist** (F1).

## Findings

**F1, Low: docs cited by other docs do not exist.** Same issue flagged on 12 Sep (F7) and still open.
- `docs/orders-and-delivery-spec.md:8` cites `docs/assistant-spec.md` and `docs/goods-marketplace-spec.md`. Neither is in the repo.
- `docs/business-network-implementation-prompt.md:222` cites `docs/dashboard-pulse-spec.md`, which does not exist (it says "or a new" file, so this one may be intentional).
- `docs/goods-marketplace-psychology.md` is cited by older audit reports and does not exist.
- Impact: a reader or a future session follows a link to nothing. Fix: remove the citations or write the docs.

**F2, Low: audit tooling can't run on a fresh checkout without setup.** Backend tests fail at collection with `KeyError: JWT_SECRET` / `MONGO_URL` unless env vars are set, and `pip install -r backend/requirements.txt` fails on Debian's PyYAML unless `--ignore-installed PyYAML` is used. I worked around both with throwaway values. Worth a line in `docs/` so the nightly audit can run the full suite.

## Verified clean

- **Price parity test:** `test_listing_price_parity.py`, 17 passed. The website and server price listings the same way.
- **Other new-work tests that ran:** `test_page_recipes` 6 passed, `test_page_rules` 13 passed.
- **Bilingual:** `scripts/test-i18n-parity.mjs` reports "all i18n checks passed". Every `t()` key exists in both `en.js` and `he.js`. It does list some dynamic key families (for example `wizard.day_*`) for manual review, which is normal.
- **RTL fonts:** no inline `fontFamily: 'Playfair Display'` in any frontend file changed in the last 12 days.
- **CSS variables:** the five variables my scan flagged as undefined are fine. `--destructive-solid` and `--nav-h` are always used with a fallback value or set at runtime; `--status-open-bg` and `--success-bg` are defined in `design-tokens.css` (my scan missed them).
- **Hardcoded hex:** none in the new reviews, clarity, size-ladder or Google-reviews components.
- **Invented numbers:** none in changed files. The only hits were the "9+" badge cap, example placeholder text, and a code comment.
- **Reviews security** (`backend/routes/reviews.py`, `backend/utils/reviews.py`):
  - Admin routes all call `_need_admin`.
  - Edit is limited to the review's author, and owner replies to the listing's owners.
  - Submission is rate-limited per IP and per user.
  - Public review output has no author id, email or phone.
  - The Google OAuth state is a signed token that expires in 10 minutes, with a kind check.
  - Google owners can only map locations to their own listings.
  - Both reviews features are off by default (`REVIEWS_NATIVE_ENABLED`, `REVIEWS_GOOGLE_IMPORT_ENABLED` are blank in `.env.example`).
- **Secrets:** `backend/.env`, `frontend/.env` and `.r2.env` are all gitignored and none are tracked.

## Not checked

- **Live listing prices: PRICE CHECK DID NOT RUN.** `live_price_check.py` could not reach myisraelrental.com from this environment (proxy returned 403). No price report was produced. Please don't read this as "prices are fine".
- **Backend tests needing MongoDB:** `test_reviews.py` hung and was killed (it appears to need a database), and `test_page_composition.py` skipped all 20 tests. I did not run the full backend suite, so reviews logic is verified by reading, not by test.
- **Frontend production build, dependency audit, Lighthouse, screenshots at 1280/768/375 in LTR and RTL:** not run. `frontend/node_modules` is not installed in this environment. Nothing in the newest pages (reviews, size ladder, upgrade panel, Hebrew business pages) has been looked at visually.
- **Double-booking, orphaned records, expiry jobs, indexes and N+1 queries:** no database to inspect, and no related code changed recently, so skipped.
- **Dead-ends and UI audits** are separate skills and were not part of this run.
