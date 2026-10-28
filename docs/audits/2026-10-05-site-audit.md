# Site audit, 5 Oct 2026 (automated, read-only, partial)

**Summary:** no Critical or High findings. 1 Medium-ish gap (price check could not run), 2 Low.

## Findings
- **Low: em dashes still in user-facing copy.** The 5 Oct sweep (e961be4) left about 20 in `en.js` (e.g. `features.*`, `jobsEmailsOff.doneTitle`) and 21 in `he.js`, plus `JobsBoard.jsx:158` (`{' — '}`). CLAUDE.md / brand/voice.md ban them.
- **Low: `.env.example` for HF_KEY** lives in the new Higgsfield demo commit (064a172); file only reads from gitignored `backend/.env.local`, no secret committed. Demo is billable per run; fine, but `higgsfield-client` was added to production `requirements.txt` for a demo script.
- **Info: accent colour change (e81a15d)** touches `theme-flow.css`, `index.css`, App.css. The new vars (`--action-ink`, `--gold-text`, `--destructive-solid`) are all defined. Not re-measured for contrast or screenshotted here.

## Verified clean
- i18n: 3,889 EN keys vs 3,914 HE keys; every `t('...')` key resolves. The 27 "missing" are plural forms (`_one/_other/_two`), a script artefact. Nothing English-only.
- No inline `fontFamily: 'Playfair Display'` in code (3 hits are comments).
- `test_listing_price_parity.py`: 17 passed.
- `.env` files gitignored, none tracked. No real key in the new Higgsfield code.

## Not checked
- **Live price check DID NOT RUN**: sandbox proxy returned 403 for myisraelrental.com/api/properties. No price findings should be read as "none".
- Full backend suite (needs MongoDB; hung without it), frontend build, npm audit, screenshots/RTL/Lighthouse, authorisation/IDOR review.
