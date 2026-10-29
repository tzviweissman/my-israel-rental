# Site audit, 28 Sep 2026 (nightly, read-only)

## Summary
No Critical or High findings in what was checked. Two checks could not run (see Not checked). Two Low findings.

Worth doing first:
1. Run the live price check from a machine with normal internet (the cloud sandbox is blocked from myisraelrental.com).
2. Restore the missing docs still cited by other docs (Low).
3. Add a rate limit to `GET /reviews/request/{token}` (Low).

## Findings
- **Low: cited docs do not exist.** `docs/assistant-spec.md`, `docs/goods-marketplace-spec.md`, `docs/goods-marketplace-psychology.md`, `docs/dashboard-pulse-spec.md` are referenced (e.g. `docs/orders-and-delivery-spec.md`, `docs/business-network-implementation-prompt.md`) but are not in the repo. `docs/audits/2026-09-19-price-check.md` is also cited and absent.
- **Low: no rate limit on the review-request link lookup.** `backend/routes/reviews.py:81`. The token is signed, so guessing is not realistic; this is hardening only.

## Verified clean
- i18n: every `t('key')` in the frontend exists in en.js and he.js (checked by script; plural `_one/_other/_two` forms handled). `tips.tip.share` is built dynamically in OnboardingProvider and is intended.
- No inline `fontFamily: 'Playfair Display'` in code (two hits are comments).
- No invented "1,200+ / 450+" style figures in code (only a comment recording the old bug in FinaleStats.jsx).
- CSS variables: every `var(--x)` used resolves to a definition (the few unmatched ones are component-local or have fallbacks).
- Auth on new endpoints: automations, connections, price-tips, auto-accept all check business ownership; admin review endpoints check admin; Google reviews OAuth state is a signed, 10-minute JWT.
- Automation scheduler uses compare-and-swap, safe with more than one replica.
- Site visit tracking stores no path, IP or account id; bots and admins excluded; rate limited.
- `.env` files are gitignored; no real secrets in `.env.example` files.

## Not checked
- **Live price check DID NOT RUN**: sandbox proxy returned 403 for myisraelrental.com. No statement can be made about live listing prices tonight.
- **Price parity test did not run**: the sandbox's Python `cryptography` package crashes on import (environment problem, not the repo). Unknown result.
- Production build, backend test suite, dependency audit, screenshots (LTR/RTL), Lighthouse, RTL computed styles, performance/indexes: not run in this session.
