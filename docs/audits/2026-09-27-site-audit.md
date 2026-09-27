# Site audit — 27 Sep 2026

Scheduled nightly audit. Read-only investigation, no fixes applied. Covers the 253-file diff
since the last full site-audit (commit `504b434`, 14 Sep 2026) — the business network,
price-watch alerts, host automations, weekly lister insights, verified reviews (flagged off),
the AI page-builder, subleases, and the smart-lists rewrite.

**Note on scope:** the task asked to "use Obsidian" to find what was recently added. No
Obsidian vault or MCP tool was available in this environment, so recent work was instead
identified via `git diff --stat 504b434..HEAD` (253 files) and used to target this audit.

## Summary

| Severity | Count |
|---|---|
| Critical | 0 confirmed (1 check unrunnable — see below) |
| High | 3 |
| Medium | 6 |
| Low | 3 |

**Three things worth doing first:**
1. **Fix the two em dashes on the printed business flyers** (`marketing/flyer-business-a4-he.html`, `flyer-business-a4-en.html`) — they put a long dash exactly where the standing "Add your business, free" rule requires a comma, in material that's already being printed/shared.
2. **Finish the Hebrew business-page fix** (commit `4a1bceb`) — the page's own name/title/share-snippet still ship in English even when `name_he`/`description_he` are set.
3. **Add the new marketplace collections to the user-delete cascade** (`business_connections`, `business_automations`, `price_tips`/`price_changes`, and the `reviews`/`google_review_connections` family) — deleting a user today leaves these behind, including live Google OAuth refresh tokens for deleted accounts.

**The live price check — the single highest-priority item in this audit's own checklist — did not run tonight.** The sandbox's outbound network blocked the request (403 from the proxy). This must be treated as unchecked, not as "no pricing problems found." Re-run `python3 backend/scripts/live_price_check.py` from an environment with real outbound access before trusting live listing prices.

---

## Findings

### High

**H1 — Marketing flyers violate the standing-CTA dash rule.**
`marketing/flyer-business-a4-he.html:44` — `הוספת העסק שלכם — <span>חינם</span>` — literally "Add your business [em dash] free," the exact phrase CLAUDE.md says must use a comma (Tzvi, 16 Sep 2026). Also at `:55` and `:78`. The English flyer repeats the pattern at `flyer-business-a4-en.html:57` ("AI assistant — coming soon") and `:80` ("Scan the code &mdash; it takes minutes..."). `brand/voice.md` states the ban applies "anywhere... in Hebrew too."
*Impact:* printed/shareable flyers ship the one thing this rule exists to prevent.
*Fix:* replace all four `—`/`&mdash;` with a comma or period per voice.md.

**H2 — Backend test-suite auto-skip only covers 4 of 49 files that need it, so most local runs are noise.**
`backend/tests/conftest.py:74` (`_LIVE_API_MARKERS = ("TEST_API_BASE", "localhost:8001")`) exists to skip (not fail) tests that resolve their backend URL via `REACT_APP_BACKEND_URL` when no live server is up. 49 test files use that pattern; only 4 also match the skip markers. The other 45 (`test_favorites.py`, `test_marketplace.py`, `test_pricing_audit.py`, etc.) fail with `ConnectionError` instead of skipping — indistinguishable from a real regression in any run without a live API.
*Impact:* a genuinely broken auth/booking/payments test and an environment-only failure look identical in every local or audit run; this has been quietly true since before 14 Sep, not something introduced this window, but it directly explains most of tonight's "248 failed / 279 errors."
*Fix:* broaden `_LIVE_API_MARKERS` to also match `"REACT_APP_BACKEND_URL"`.

**H3 — New marketplace collections are missing from the user-delete cascade.**
`backend/routes/admin/core.py:484-527` (`_USER_OWNED`/`_TWO_PARTY_KEPT`) is the deliberate, tested list of what a user-delete removes or keeps (its own test, `test_admin_delete_user_cascade.py`, is data-driven to catch exactly this). Collections added since 14 Sep are in neither list: `business_connections`, `business_automations`, `price_tips`/`price_changes`, and the reviews family (`reviews`, `review_requests`, `review_reports`, `google_review_connections`). There is no standalone "delete business" endpoint, so this cascade is the only cleanup path.
*Impact:* deleting a user/business leaves automation rules, network connections, and price-tip history pointing at a dead id — and, once `REVIEWS_GOOGLE_IMPORT_ENABLED` is ever turned on, an encrypted Google OAuth refresh token for a deleted account stays live in the database with nothing to revoke it.
*Fix:* add these collections to `_USER_OWNED`, keyed off the user's owned business ids (two-step lookup, same pattern already used for cascading `store_orders` on cancel).

### Medium

**M1 — Hebrew business-page fix (4a1bceb) is half-done: share/meta description still ships in English.**
`frontend/src/pages/BusinessPage.jsx:257-261` correctly shows `(he && biz.description_he) || biz.description` on the page body, but `shareDescription` (fed into `<meta name="description">` and OG/Twitter tags, used at line 283) still reads `biz.description?.slice(0,155)` only. A Hebrew business page shares and gets indexed with an English snippet.
*Fix:* reuse the same `he && description_he` fallback for `shareDescription`.

**M2 — Same commit, same pattern: the business name never uses `name_he`.**
The backend already sends `name_he` (`backend/routes/marketplace/businesses.py:854`) and it's used correctly for each listed gig (`BusinessPage.jsx:568`), but the page header, `<title>`, share title, and logo alt (lines 261, 282, 302, 331, 372, 376, 381) all use `biz.name` unconditionally. A business with a Hebrew name set still shows its English name at the top of its own Hebrew page.
*Fix:* apply the same `(he && biz.name_he) || biz.name` fallback everywhere `biz.name` is rendered on this page.

**M3 — `accept_booking` has the same read-check-then-write race the codebase already fixed twice elsewhere.**
`backend/routes/bookings/accept.py:31-45`: the status check and the update are two separate operations — the update (line ~44) has no `"status": "pending"` in its filter, unlike the fixes already shipped for `orders.py` (`"status": current`) and `contracts.py`/`properties/contract.py` (`"signed": {"$ne": True}}`) after the same bug was found there before.
*Impact:* two near-simultaneous Accept calls (double-click, two tabs) could both pass the check, each minting a fresh contract-sign token and firing a duplicate "contract sent" notification/automation event.
*Fix:* add `"status": "pending"` to the update filter; treat a no-match as already-handled.

**M4 — The only ownership/IDOR test for payment orders is fully skipped.**
`backend/tests/test_payments.py:186`, `TestOrderAccessControl` (`test_other_user_cannot_read_order`, `test_payments_my_returns_only_caller_orders`) sits under a blanket `@pytest.mark.skip` written for the discontinued document-services product type. The underlying ACL logic applies to every product type, but nothing currently exercises the cross-user-ownership check — an untested permissions path per the audit checklist.
*Fix:* rewrite against a live (non-document) product type, or split the ACL assertions into their own unskipped test.

**M5 — No rate limiting on public sign-token / short-link endpoints.**
`backend/routes/contracts.py` (`/contracts/sign/{token}` GET/POST/file), `backend/routes/subleases.py` (`/contracts/sign/{sign_token}`), and `backend/routes/short_links.py` (`resolve_short_link`/`follow_short_link`) never call `check_rate`, unlike `routes/marketplace/orders.py`'s `orders/track/{token}` and `orders/staff/{token}`. Tokens are high-entropy UUID4s, so brute force isn't realistic, but it's an inconsistency with the pattern used everywhere else in this window.
*Fix:* add `check_rate` to these five endpoints, matching `orders_track`'s limits.

**M6 — `--destructive-solid` is a phantom CSS token.**
`frontend/src/components/ui/dashboard-shell.jsx:90` and the genuinely new `frontend/src/components/dashboard/AutomationsPanel.jsx:684` both write `var(--destructive-solid, #DC2626)`. That variable is not defined anywhere (`brand/design-tokens.css`, `theme-flow.css`, `index.css`) — the fallback always fires today, so nothing is visibly broken, but there's no single place to change the destructive red later.

### Low

**L1 — Marketing flyer names "property owners" as a co-primary audience.**
`flyer-business-a4-en.html:35`: "FOR LOCAL BUSINESSES & PROPERTY OWNERS." Businesses lead (correct order per CLAUDE.md) and it's not framed as the sole audience, so this is borderline rather than a clear violation — worth a second look against "property owners... one option among several, not the primary framing."

**L2 — `pytest` must be run from `backend/`, not the repo root.**
Running `python3 -m pytest backend/tests/ -q` from the repo root fails to collect most of the suite (`ModuleNotFoundError: No module named 'routes'`) because nothing puts `backend/` on `sys.path` from that cwd. Not a bug, but worth a one-line note in CLAUDE.md's "Local dev" section so future sessions (including audit agents) don't misread it as 250+ real failures.

**L3 — This sandbox's `backend/.env` does not point at a local database.**
One audit sub-agent confirmed (without printing the value) that `backend/.env`'s `MONGO_URL` in this environment is not `mongodb://localhost`. No write ever ran against it — every DB-touching test either skipped or failed to connect — but CLAUDE.md's assumption that "local dev typically runs a local MongoDB" doesn't hold in this container. Worth double-checking before any future session in this environment runs something that writes.

---

## Verified clean

- **Listing price parity**: `backend/tests/test_listing_price_parity.py` — 17/17 pass (pure, no DB needed); frontend and backend price every listing identically.
- **Verified reviews / Google reviews import**: confirmed OFF by default (`REVIEWS_NATIVE_ENABLED`, `REVIEWS_GOOGLE_IMPORT_ENABLED` blank in `.env.example`; every route gates on `_need_native()`/`_need_google()`). "Verified" badges trace to a real confirmed/completed booking, never a fake badge.
- **No hardcoded/invented stats** in the new dashboard and growth-guide UI (`PerformancePanel`, `LookingForYou`, `ProofLine`, `GoogleReviewsCard`, `GrowthGuide`, `WhatYouCanDo`) — all pull from real endpoints, several explicitly suppress a stat when the sample is too small ("not counting yet", "stars only with ≥1 review").
- **Order-status and contract-sign races** are genuinely fixed and covered by real concurrent-thread tests (`test_store_orders_status_race.py`, `test_contract_sign_race.py`) — the fixes are in place in `orders.py` and `contracts.py`/`properties/contract.py`.
- **Contract file security**: every read/sign path still goes through `_may_access_contract` or a token-expiry check; `CONTRACT_DIR` is confirmed not mounted publicly in `server.py`; file resolution is basename-only (no `../` traversal). No regression of the three-times-fixed contract-leak bug.
- **Marketplace IDOR**: `connections.py`, `orders.py`, `price_watch.py`, `automations.py`, `notification_prefs.py`, `weekly_insights.py`, `admin_smart_lists.py`, `site_visits.py` all use a consistent ownership-check helper per handler; several deliberately 404 (not 403) on someone else's object to avoid confirming a private relationship exists.
- **Short links**: allowlist is exactly `{site, manager, property, business}` — no contract/dashboard/sign-token/chat target is ever mintable or resolvable.
- **Payment links**: correct registrable-domain match (not `endswith`), HTTPS-only, credentials-in-URL rejected.
- **PII**: no phone/email of another party is exposed anywhere in the new UI; contact stays chat-only, order phone/email is the customer's own submitted data.
- **Secrets**: `backend/.env`/`frontend/.env` both git-ignored; `.env.example` files contain placeholders only. No secret values were printed during this audit.
- **Bilingual key parity**: `node scripts/test-i18n-parity.mjs` — all checks pass, 3872 English / 3897 Hebrew keys, no missing/stray keys, no unresolved `t()` call sites.
- **No inline `fontFamily: 'Playfair Display'` regressions** anywhere in `frontend/src` (one hit is a code comment describing the historical bug, not an instance of it).
- **RTL logical properties**: no genuine physical-property drift found in the new page-builder/network/insights components; two near-misses inspected and found benign (a measured popover position, a symmetric margin).
- **No undefined CSS vars or shadcn-token collisions** in the 107 frontend files changed since 14 Sep, aside from M6 above.
- **Frontend build succeeds** (`npm install --legacy-peer-deps && npm run build`); only warnings are pre-existing-style `react-hooks/exhaustive-deps` lint warnings, no new ones.
- **Docs**: all 7 new docs (`ai-page-builder-spec.md`, `business-network-spec.md`, `business-network-implementation-prompt.md`, `business-subdomains-setup.md`, `page-generation-rules.md`, `uptime-monitoring.md`, `verified-reviews.md`) exist and match the code they describe.
- **Positioning**: `GrowthGuide.jsx`, `WhatYouCanDo.jsx`, `SignupJoin.jsx` default to "business" (not "owner"), use "Add your business, free" with a comma consistently, and contain no storage-rental or document/gov-services copy.
- **Dead code**: `BlockList.jsx`, `SizeLadderBlock.jsx`, `FaqEditor.jsx`, `SizeFields.jsx`, `GoodToKnow.jsx` are all wired in and reachable — none orphaned.

## Not checked

- **The live price check did not run** — sandbox network blocked the request (403). This is the audit's own top-priority item; treat pricing as unverified tonight, not clean, until re-run with real network access.
- **Most of the backend test suite** (`test_pricing_audit.py`, `test_smart_list_holiday_prices.py`, the race tests, `test_admin_delete_user_cascade.py`, and ~40 others) needs a live local API server plus a reachable local MongoDB, neither of which exists in this sandbox. Their logic was reviewed by reading the code (see "verified clean" above), but the actual behavior was not executed here.
- **Full RTL verification via rendered/computed styles** — this pass was static/grep-based only; no browser check of computed `fontFamily`/logical-property values.
- **Visual/accessibility pass** (section 10) — no screenshots taken, no Lighthouse run, no console-error check across pages this window.
- **Performance** (section 11) — not covered this window.
- **npm audit / dependency vulnerability scan** — not run.
- **Full line-by-line hex/token diff** of all 107 changed frontend files — a representative sample was spot-checked instead of every file.
- **Obsidian** — no vault or tool was available in this environment; git history was used instead to scope what's "recent."
