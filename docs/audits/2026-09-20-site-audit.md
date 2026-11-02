# Site audit — 2026-09-20

Scope: everything committed since the last site-audit (2026-09-14, commit `9dd4d68`-era)
through `HEAD` (`beccaef`), i.e. the home-page redesign going live, the "one price rule"
work, demand-by-person reporting, and the sublease sign-token fix. Read-only pass —
nothing was fixed. Run inside a sandboxed session with **no live site access, no
production/local MongoDB, and no running dev server** (see "Not checked").

## Summary

- **3 High**, **2 Medium**, **1 Low**.
- Top three to do first:
  1. **Rotate the leaked sublease `sign_token`s.** The code fix landed today (`54a0217`) but the commit message itself says the previously-public tokens still work and haven't been rotated.
  2. Confirm the nightly live price check actually runs where it's scheduled — it could not run in this sandbox at all (network to `myisraelrental.com` is blocked here), and there's no `*-price-check.md` in `docs/audits/` since the check was added on 18 Sep, so it's not clear it has ever produced a report from wherever it's meant to run.
  3. Nothing else urgent — the rest is small, contained cleanup (an ad-hoc admin-only red, a couple of dead translation keys).

## Findings

### 1. [High] Leaked sublease `sign_token`s are fixed going forward but not rotated — open credential exposure
**File:** `backend/routes/subleases.py` (fixed in `54a0217`); no rotation script found.
**Evidence:** the fix commit's own message: *"Existing tokens have been public and still need rotating."* `git log --all --oneline | grep -i "rotat\|sign_token"` finds no follow-up commit, and there's no script in `backend/scripts/` that reissues sign tokens.
**User-visible impact:** `sign_token` is described in `utils/contract_files.py` as "the ONLY credential on `/contracts/sign/{token}`" — it lets an outsider view, download, and **sign** a sublease contract. Every token exposed before today's fix is still valid and still works; anyone who saved a `/subleases` or `/subleases/{id}` response before the fix has a live key to someone else's contract.
**Suggested fix:** write a one-off backfill that reissues `sign_token` for every sublease with an unsigned contract (skip already-signed ones, which now expire on their own per `SIGN_TOKEN_GRACE_DAYS`), and notify affected subleasors their link changed. This is a production data write — needs Tzvi's go-ahead and should run against Atlas deliberately, not as a drive-by.

### 2. [High] Live price check could not run in this environment — treat tonight as unchecked, not clean
**File:** `backend/scripts/live_price_check.py`
**Evidence:**
```
PRICE CHECK DID NOT RUN: could not read https://myisraelrental.com/api/properties
(<urlopen error Tunnel connection failed: 403 Forbidden>)
```
A direct `WebFetch` to the same URL confirms it's the sandbox's own network policy (`EGRESS_BLOCKED`), not the site being down.
**Impact:** the one check added specifically because it "found that whole family of bugs in minutes" (Sukkot pricing, 18 Sep) did not run tonight. `docs/audits/` has no `*-price-check.md` file at all yet, from any date, so I can't confirm it has run successfully anywhere since it was added two days ago.
**Suggested fix:** not a code bug — flag to Tzvi that this sandbox can't reach the production site, and confirm where/how `live_price_check.py` is actually being run on a schedule (cron on Railway? a different environment?). If it isn't running anywhere yet, that's the real gap.

### 3. [High] Backend test suite can't run end-to-end in this sandbox — same caveat as #2
**Evidence:** `pytest backend/tests/ -q` mostly errors/fails (`FFFFFFFFEEEEEEEE...`) because most files need a live backend at `localhost:8001` and a real MongoDB, neither of which exists here. The tests that don't need those — `test_listing_price_parity.py` (17/17), `test_design_tokens_synced.py`, `test_holiday_tables_agree.py`, `test_payment_link_allowlist.py`, `test_sublease_public_no_sign_token.py`, `test_sign_token_expiry.py`, and the i18n parity script — all pass clean. Listing this so a future audit in a real dev environment re-runs the full suite rather than assuming tonight's partial run was representative.

### 4. [Medium] Three different ad-hoc "error/danger" reds invented in new admin code, none of them a design token
**Files:**
- `frontend/src/components/admin/RequestReportsTab.jsx:126,134,185` — `#FBECEC`/`#B23B3B` (flagged) and `#FDF3E3`/`#8A6A14` (warning), hardcoded twice each
- `frontend/src/components/admin/ServicesTab.jsx:238` — same `#FBECEC`/`#B23B3B` pair, copy-pasted
- `frontend/src/components/dashboard/WebAddressField.jsx:104` — a *third*, different red, `#B42318`, for the same "this is an error" meaning
**Evidence:** `brand/design-tokens.css` / `theme-flow.css` define `--success`/`--success-bg` for the one functional-green case but have no danger/warning token at all — so there was nothing to reach for, and three call sites each invented their own.
**Impact:** admin-only, so low blast radius, but it's exactly the kind of drift the design-tokens rule exists to prevent, and now there are two different "error red"s in the app that will read as inconsistent if anyone sees both screens close together.
**Suggested fix:** add `--danger`/`--danger-bg` and `--warning`/`--warning-bg` to `theme-flow.css` (pick one of the two reds already in use) and point all three files at them.

### 5. [Low] Two dead translation keys from the "one join button" decision
**Files:** `frontend/src/locales/en.js` / `he.js`, keys `home.v2.supply.ctaBiz` and `home.v2.supply.ctaStay`.
**Evidence:** `frontend/src/pages/HomePreview.jsx:679` has a comment explaining Tzvi's 3 Sep call to collapse two CTA buttons into one "Join free" button; `supply.ctaBiz`/`ctaStay` are the leftover strings for the button that no longer exists. (`supply.free/leads/tools` are still live — they're read in a loop a few lines up.)
**Suggested fix:** delete the two keys next time either locale file is touched. Not worth a dedicated commit.

## Verified clean

- **Price parity** (website vs. Smart List pricing logic): 17/17 `test_listing_price_parity.py` cases pass.
- **i18n key parity** (`scripts/test-i18n-parity.mjs`): all checks pass, including the pluralization and default-status traps from precedent bugs.
- **RTL**: no inline `fontFamily: 'Playfair Display'` and no new physical-direction CSS (`left`/`right`/`margin-left`/etc.) in any file changed since 14 Sep.
- **CSS variables**: every `var(--…)` in the new `home-v2.css` resolves to a real token; the two that looked undefined (`--nav-h`, `--copy-h`) either carry a fallback or are set earlier in the same cascade.
- **Sublease/contract security**: the sign-token leak fix (`54a0217`) is correctly wired on both public read routes, and the new sign-token expiry (`utils.contract_files.load_contract_by_sign_token`) is used by all three routes keyed on `sign_token`. Both have dedicated, passing tests.
- **Payment link allowlist**: still matches on registrable domain (`host == d or host.endswith("." + d)`), not a raw suffix — the `evil-paybox.co.il` trap is closed.
- **Site-visit tracker** (new, replacing the leftover Emergent PostHog snippet): stores no page path, no IP, no user-agent — specifically because several paths carry credentials in the URL (`/sign/<token>`, `/orders/track/<token>`).
- **Discontinued features**: `storage` was removed from `_VALID_RENTAL_TYPES` (creation-time) on 16 Sep; legacy display code for old `storage` listings still exists as CLAUDE.md says it should, pending separate cleanup. Nothing new extends it.
- **Positioning/copy**: the live home page's "Grow. Build. Any revenue stream" headline is correctly gated to `home-v2` (not `theme-preview`) and stays within its documented exemption; a stray em-dash CTA on `/what-you-can-do` was already fixed to a comma in this window (`f246070`'s sibling change).
- **Home page hero's off-palette blue** (`#00387B` in `home-v2.css`, not the documented `--accent-deep`): has an on-the-record contrast measurement in a code comment justifying the literal value, matching the CLAUDE.md exception for hero literal colors. Not flagging as a bug.

## Not checked

- **Live listings' prices** (`live_price_check.py`) — network to the production site is blocked from this sandbox; see Finding #2.
- **Full backend test suite** — most tests need a running backend + real MongoDB, neither available here; see Finding #3.
- **Visual/screenshot diff, Lighthouse, keyboard nav** — no dev server, no DB seed data, and Chromium has nothing to point at without a backend. Nothing in this pass was visually verified against the mockups; treat the home-page redesign's actual on-screen appearance as unverified since the 14 Sep audit.
- **Data integrity in Atlas** (orphaned records, bilingual field gaps on real documents, expiry jobs actually firing) — no database access from this session.
- **Double-booking** — the skill's own known gap ("availability generated from opening hours, nothing subtracts a taken slot"); not re-verified, no new code touches this area this window.
- **Obsidian** — asked for as the source of "what was added recently"; no Obsidian connector/vault is available in this session, so recency was determined from `git log` against the last site-audit's commit instead.
