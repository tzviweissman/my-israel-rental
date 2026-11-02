# Site audit — 2026-09-18 (nightly)

Scope: everything merged today (2026-09-18) — the home page redesign going live at `/`, the hero video/tagline fixes, the site-wide + per-person demand KPIs on the admin overview, the contract-signing race fix, and the PostHog removal. Obsidian was not connected in this environment, so git history stood in for it to identify what's new since the last audit (2026-09-15).

## Summary

**No Critical or High findings.** Two Medium/Low items, both pre-existing (not introduced today). The live price check — the audit's top-priority, highest-value test per the skill — **could not run**: this sandbox's network policy blocks `myisraelrental.com`. That's a gap in tonight's coverage, not a clean bill on pricing; see "Not checked."

Three things worth doing first:
1. Run `python3 backend/scripts/live_price_check.py --out docs/audits/2026-09-19-price-check.md` from an environment that can reach the live site — it hasn't run since it was written on 18 Sep, and it's the check that has actually caught customer-facing bugs before.
2. Nothing else is blocking. The 17 price-parity tests pass, i18n is complete, and the production build is clean.
3. Consider whether `npm audit`'s 21 "high" advisories (all pre-existing, dev-dependency chain) are worth a `npm audit fix` pass at some point — not urgent, not new.

## Findings

None at Medium or above from today's changes.

- **Low — `npm audit`: 42 vulnerabilities (21 high, 10 moderate, 11 low).** Pre-existing; `frontend/package.json` was not touched in any commit reviewed tonight. Almost certainly the usual CRA/webpack-dev-server dev-dependency chain (these don't ship in the production bundle), but not individually triaged tonight. *Evidence: `npm audit` output, frontend/.*
- **Low — production build carries ~20 pre-existing `react-hooks/exhaustive-deps` warnings.** All in files untouched by today's commits (`App.js`, `Navigation.js`, `ManagerPage.js`, `Services.jsx`, etc.). Railway's build sets `CI=false` (confirmed in `docs/railway-deploy.md`), so these don't fail the real deploy — only a local `CI=true` build fails on them, which is expected behavior, not a bug. *Evidence: `CI=false npm run build` → exit 0, clean deploy-equivalent build.*

## Verified clean

- **Pricing logic**: all 17 `backend/tests/test_listing_price_parity.py` cases pass — the website and the Smart Lists compute every listing's shown price identically (nightly, monthly, holiday-only, mixed currency, no-price-is-none-never-zero, etc.). This is the suite written after the 18 Sep Sukkot pricing bug.
- **Bilingual completeness**: `scripts/test-i18n-parity.mjs` — every `t()` key used in the frontend exists in both `en.js` and `he.js`. No missing Hebrew keys.
- **Theme scope**: `scripts/test-theme-scope.mjs` — `theme-neon.css` stays fully scoped under `body.theme-preview`; only `theme-flow.css` (the approved site palette) is global.
- **Design tokens**: `backend/tests/test_design_tokens_synced.py` passes.
- **Production build**: `CI=false npm run build` (Railway's actual settings) compiles cleanly, no new errors or warnings from anything merged today.
- **Home page going live** (`e2a42fb`, `pages/HomePreview.jsx` now serving `/`): no hardcoded stats, ratings, or counts in the new page or the components it pulls in (`CommunitySection`, `AlsoStrip`, `useHomeShowcase`, `LoopHero`) — everything user-facing traces to real content, not placeholder numbers. `theme-preview` is correctly scoped to only apply at `/home-preview`, never at `/`. No inline `fontFamily: 'Playfair Display'` (the RTL font trap) in the new code.
- **Hero video changes** (`5f5919a`, `a2ae6b7`): the removed `GradientText` component has zero remaining references anywhere in the frontend — clean removal, no dead import. The new hero-only accent color (`#00387B`) and its contrast rationale (1.3–2.8:1 → 4.7–7.7:1, measured across 8 loop frames, both languages) is documented in the CSS comment; no undefined CSS variables introduced.
- **New admin demand endpoints** (`/admin/metrics`, `/admin/metrics/by-user`): both explicitly check `payload.get("role") != "admin"` before returning anything. `DemandByPerson.jsx` shows real fetched numbers only, with proper failed/empty states — no invented placeholder data.
- **New `/site/visit` tracking endpoint**: rate-limited (120/min), filters bots, excludes admins from their own count, stores no IP/user-agent/page-path — matches the file's own stated privacy contract.
- **Contract file cleanup on account deletion**: resolves stored paths through `resolve_private_contract_file`, which reduces to a basename and confines the result inside `CONTRACT_DIR` — a stored value containing `../` cannot escape it.
- **Two race conditions closed today**: contract double-signing (`subleases.py`, atomic `find_one_and_update` with a `signed: {"$ne": True}` filter, second signer gets a 409) and duplicate business slugs (`businesses.py`, retry-on-`DuplicateKeyError` with a 409 on the second collision). Both read correctly on inspection; the tests written for them (`test_contract_sign_race.py`, part of `test_admin_delete_user_cascade.py`) need a live local server + MongoDB to execute, which this sandbox doesn't have (see Not checked).
- **Storage rental-type removal** (`2c6240e`, a few days old): matches `CLAUDE.md`'s discontinued-offerings guidance — can no longer be created or searched for, existing listings still load. No reintroduction found in today's diffs.
- **Documentation**: every doc `CLAUDE.md` cites (`emergent-exit-checklist.md`, `redesign-and-wanted-board-prompt.md`, `acceptance-checklist.md`, `hero-cinematic-spec.md`, `railway-deploy.md`, `brand/voice.md`, `brand/design-tokens.css`, both `*-preview.html` mockups) exists on disk.
- **PostHog removal** (`d78bc9d`): well-documented, verified by the author in a real browser per the commit message; the site's own `SiteVisitTracker` now covers what it was presumably there for, with no third-party destination.

## Not checked

- **Live price check did not run.** `python3 backend/scripts/live_price_check.py` → `PRICE CHECK DID NOT RUN: could not read https://myisraelrental.com/api/properties (Tunnel connection failed: 403 Forbidden)`. This sandbox's network policy blocks the live host outright (confirmed via the proxy status endpoint — `connect_rejected`, "policy denial or upstream failure"). This is the single highest-value check in the whole skill and it did not run tonight — flag this gap explicitly rather than reading last night's silence as clean.
- **Obsidian.** No Obsidian MCP connector is installed on this account and no local vault was found, so "what was added recently" was determined from `git log` instead. If there's an Obsidian vault this was meant to read from, it isn't reachable from this session — worth checking the connector is set up if that's expected to work.
- **Every DB-backed / live-server-backed test.** `backend/tests/test_site_visits.py`, `test_demand_reporting.py`, `test_admin_delete_user_cascade.py`, `test_contract_sign_race.py`, `test_rental_type_gate.py`, `test_pricing_audit.py`, and the HTTP-driven cases in `test_smart_pricing.py`/`test_smart_pricing_extra.py` all skip or fail with "needs a running backend at http://localhost:8001" or a Mongo connection refusal — this sandbox has neither a local MongoDB nor a running app server. The logic behind today's two race-condition fixes was read and looks correct, but wasn't exercised by its own tests tonight.
- **mypy / `test_mypy_clean`**: fails in this sandbox on `No module named 'pydantic'` for the mypy plugin — a broken local install (pydantic itself imports fine elsewhere; likely a mypy-plugin-specific resolution issue in this container), not a code problem, but genuinely unverified.
- **Visual/screenshot verification** of the hero full-bleed video and "no white box" changes. No dev server was stood up for a real screenshot pass this run; the CSS-comment contrast numbers from the commit look credible on reading but weren't independently re-measured.
- Sections 6 (data integrity beyond what's above), 10 (Lighthouse/accessibility/keyboard), and 11 (performance/N+1/indexes) of the skill were not run this pass — time was spent on the day's actual diff instead of a full sweep.
