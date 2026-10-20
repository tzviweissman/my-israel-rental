# Code audit, 20 Oct 2026

## In short
- No new serious problems in the last day's changes. The one real bug found: on the new Services map, businesses whose area is written "Tel-Aviv", "Modi'in", "Ra'anana" or "Be'er Sheva" would still have been left off the map, because of a typing slip in the matching code. They would have shown up in the "no pin" note instead of on the map.
- Fixed tonight: that slip (one line), on branch `claude/exciting-bell-ko313d`. Checked: all four spellings now land on the right city, and "herbs" is still not mistaken for "RBS".
- Needs your decision: nothing new. Two earlier items are still waiting (see Still open).

## New findings
1. [Low] `frontend/src/utils/servicesGeo.js:52` (commit 84aef6f): the pattern escape was written as a template string `\${c}`, which produces the literal text `${c}`, so any alias containing `-` or `'` (tel-aviv, modi'in, ra'anana, be'er sheva) could never match. Proof: a node check printed `tel${c}aviv` as the pattern and `false` for "tel-aviv area". Fixed, see below.

## Fixed this run
- 0492ea0: escape changed to `\\${c}`. Node check afterwards: "Tel-Aviv area" gives Tel Aviv, "Modi'in and around" gives Modiin, "Be'er Sheva" gives Beersheba, "Ra'anana" gives Ra'anana, "herbs" gives nothing, "RBS, jerusalem" gives Bet Shemesh. The production build passes.

## Still open
- [Medium] Hebrew: 14 `basket.*` and `jobsBoard.*` texts in neither language file (first seen 19 Oct). `scripts/test-i18n-parity.mjs` still fails on them.
- [Low] Dashboard checklist "category" opens a form with no category control (19 Oct). `scripts/test-completeness-actions.mjs` still fails on it.
- Others unchanged in `open-issues.md`.

## Could not confirm
- Nothing.

## Verified working
- Last 26 hours: 16 commits; the logic changes outside the visual layer are the Services map (servicesGeo, Services.jsx, ServicesMapView), a moved ProofLine on the listing page, and new check scripts. New map strings (`services.mapCount`, `services.mapUnplaced`) exist in both en.js and he.js; the i18n parity check shows no new missing keys.
- `backend/tests/test_listing_price_parity.py`: 17 passed.
- Production build passes.
- Node checks: all pass except the two known failures above.
- No backend files changed in the window.

## Not checked
- Live price check: not run (the sandbox blocks myisraelrental.com).
- The full backend suite: a manual run timed out at 480 s, and three test files cannot be collected because `pytest_asyncio` is not installed in the sandbox (test_dropship, test_jobs_end_to_end, test_page_products). No backend code changed in the window.
- `audit-setup.sh` left the dev server running and did not finish on its own.
- Browser screenshots: not taken (UI audit's area).
