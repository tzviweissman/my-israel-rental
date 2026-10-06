# Site audit, 6 Oct 2026 (scheduled, read-only)

## Summary
No Critical, High or Medium findings. Last 10 days of changes were mostly skills/docs, the weekly insights email, contrast fixes, and payments/contract hardening.

Worth doing first:
1. Re-run the live price check from a machine that can reach myisraelrental.com (it could not run here).
2. Decide whether the Monday weekly-insights email needs an opt-in/consent check (see Low 1).
3. Run the full backend suite (and frontend build) against a local MongoDB; only a subset could run here.

## Findings
- Low 1: `backend/routes/weekly_insights.py` emails every user with a published gig or non-archived property each Monday 09:00 Israel time, with an opt-out link. There is no opt-in. Check this against Israel's anti-spam rules (Communications Law s.30A) before the first real send. Safe on multiple replicas (unique index claim on user_id+week).
- Low 2: `weekly_insights_loop` calls `ensure_indexes()` once outside the try/except; if it throws at startup the loop dies silently. Also if the process dies between claiming the week and sending, that person is skipped that week.

## Verified clean
- i18n: 2,660 `t('a.b')` keys used; every one exists in en.js and he.js (27 "missing" were plural forms `_one/_other` and one commented-out key). No en-only keys.
- No inline `fontFamily: 'Playfair Display'` left (only in comments).
- No undefined CSS variables except ones set at runtime in JS (--nav-h, --bottom-nav-h, --lx, --ly, --cf-card).
- No invented "1,200+ / 450+" figures live; remaining mentions are comments explaining the removal. No fake scarcity/countdown copy.
- Secrets: `.env`, `frontend/.env`, `.r2.env` gitignored; no key patterns in tracked files; `.env.example` has placeholders only.
- Payment and media domain checks use `host == d or endswith("." + d)`.
- Uploads static mount exists, but contract tests and code comments confirm contracts are stored outside it.
- Short-link resolve and PayPal webhook are rate-limited / signature-verified (fail closed).
- `test_listing_price_parity`, `test_weekly_insights`, `test_payment_order_access`, `test_booking_contract_privacy`: 17 passed, 10 skipped (need DB).

## Not checked
- **PRICE CHECK DID NOT RUN**: proxy returned 403 reaching https://myisraelrental.com/api/properties. No live-listing price findings this run; do not read that as clean.
- Rest of backend suite: no MongoDB in this environment (tests that need it fail at connection). `tests/test_jobs_end_to_end.py` fails to collect (not investigated).
- Frontend build, Lighthouse, screenshots LTR/RTL, dependency audit: no node_modules / browser run this pass.
- Double-booking and orphan-record checks (need data).
