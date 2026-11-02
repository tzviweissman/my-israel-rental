# Site audit, 1 Oct 2026 (automated, partial)

## Summary
No Critical, High or Medium bugs found in the areas that could be checked. Two required checks could not run in the cloud sandbox (see "Not checked"). Nothing was fixed.

## Findings
None new.

## Verified clean
- **Hebrew/English keys:** 2,649 `t('a.b')` keys used in the frontend. English and Hebrew files both define every key (en 3,872, he 3,897; no English-only keys). 27 keys looked missing in both files but are plural forms (`_one`/`_other`), so they are false positives.
- **Inline Playfair Display:** no inline `fontFamily: 'Playfair Display'` in the frontend. Only comments mention it.
- **Invented numbers:** the old "1,200+ / 19 cities / 450+ pros" strings now appear only in comments explaining their removal.
- **CSS variables:** every `var(--x)` with no definition is either set from JS/inline (`--cf-card`, `--nav-h`, `--bottom-nav-h`, `--ish-open`) or has a fallback (`--destructive-solid`).
- **Secrets:** `backend/.env`, `frontend/.env` and `.r2.env` are gitignored. No `sk-ant` or AWS key or Atlas credential string is committed.
- **Authorisation on new routes (automations, orders export/customers, reviews edit/admin, google mappings):** spot-checked, all require a token and an ownership or admin check.

## Not checked
- **Live price check:** `live_price_check.py` printed PRICE CHECK DID NOT RUN. The sandbox proxy returned 403 for myisraelrental.com. Run it locally.
- **Price parity pytest:** could not run in the sandbox (backend dependencies are not fully installed here). Run it locally.
- Production build, full test suite, npm audit, screenshots (LTR/RTL), Lighthouse, performance: not run.
- Obsidian: no access from this environment, so "what was added recently" came from git. Last 25 commits touched 74 backend files (reviews, Google reviews, automations, connections, price watch, page recipes/rules).
