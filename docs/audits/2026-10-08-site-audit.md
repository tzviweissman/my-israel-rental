# Site audit, 8 Oct 2026 (nightly, read-only)

Scope: the 25 commits from 5-7 Oct (check-in times, business-page FAQ/reviews/testimonials, hand-built Blazin' Boards page and server.js route, sign-up/login card rework). Obsidian was not reachable from this run, so "what's new" came from git history.

## Summary
No Critical or High findings. 1 Low finding. Several checks could not run (see Not checked).

## Findings
- **Low: check-in/check-out validator accepts trailing junk.** `backend/models.py` (`_clock`, commit d31048f) tests only `v[:5]`, so `"15:00xyz"` passes and is saved as `15:00`. Harmless (stored value is clean), but the error message is skipped. Fix: run the regex on the whole string.
- **Low: `tips.tip.share` is flagged as a missing translation key.** `OnboardingProvider.jsx:55` explains the code deliberately avoids it (the dot is a key separator), so it looks like a false alarm.

## Verified clean
- Every `t('...')` key used in the frontend (2,778) exists in both en.js and he.js, except the key above. No English key lacks a Hebrew one.
- No new inline `fontFamily: 'Playfair Display'`, no new undefined colour variables, no "500+"-style invented counts in the diff since 5 Oct.
- Testimonials: the public business endpoint passes them through `public_testimonials` (named plus permission only). The owner's own view gets all of them.
- The `server.js` hand-built route matches slugs against a strict regex and a closed list (`pages.json`), so no path traversal.
- `.env` files are git-ignored.

## Not checked
- **Live price check DID NOT RUN:** the proxy returned 403 for myisraelrental.com. Nothing is known about live listing prices tonight.
- Price-parity pytest: pytest could not be installed in this environment, so it did not run.
- Production build, full test suite, dependency audit, screenshots (LTR/RTL, 1280/768/375), Lighthouse: not run (no browser or server in this run).
