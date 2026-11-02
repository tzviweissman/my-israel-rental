# Site audit — 2026-09-22 (nightly, scheduled)

Scope: everything committed since the previous audited range, i.e. the current
`HEAD` (`e41d73a`) back to `480b6ba~1` — the "site-walk / automations /
security-scan / lister-insights / sign-up-order-admin-phone-menu / today's-deals"
run of commits. This was a read-only investigate-and-report pass. Nothing was
fixed, committed, or deployed — this file is the report only.

## How this was done

No Obsidian vault was reachable from this session (no such connector is
configured on this account, and no local Obsidian files exist in this
container) — same situation as the 2026-09-14 audit. "What was added
recently" was scoped from the repo's own commit history instead:

```
git diff --stat 480b6ba~1 e41d73a
```

- Two parallel deep-dive subagents: one on the backend diff (auth, IDOR,
  contract security, PII, opt-out token design, the admin "restore deleted
  account" endpoint), one on the frontend diff (RTL, design-token drift,
  hardcoded numbers, dead code, the `/home-preview` vs `/` theme gating).
- I independently read and verified, myself, in full: `weekly_insights.py`
  (the new Monday email job), the admin restore-deleted-user endpoint,
  `notification_tokens.py` (opt-out token signing/verification), the new
  `/marketplace/looking-for-me` endpoint, `view_tracking.py`'s bot-exclusion
  change and all three of its call sites, `site_visits.py`'s dedup onto the
  shared bot list, and the "Today's deals" home-page change (`HomePreview.jsx`
  + `useHomeShowcase.js`).
- Mechanical checks run directly: `scripts/test-i18n-parity.mjs` (bilingual
  key parity across every `t()` call in the frontend). This is the one real
  finding below.
- `git check-ignore` confirmed `.env`/`.r2.env`/`.env.test` patterns are
  gitignored; `git ls-files` confirmed no real env file is committed.
- Confirmed `backend/server.py` mounts only `/api/uploads` (`UPLOAD_DIR`) as
  public `StaticFiles` — `private_contracts`/`CONTRACT_DIR` is never mounted.

**Could not run:**
- `python3 backend/scripts/live_price_check.py` — this sandbox's outbound
  network to the production site is blocked (`403 Forbidden` at the proxy).
  This is the mandatory first check in the audit skill and it did not run;
  treat tonight's listing prices as **unchecked**, not as clean.
- The backend `pytest` suite, including `test_listing_price_parity.py`
  (required every run) and the four new test files this range added
  (`test_weekly_insights.py`, `test_looking_for_me.py`,
  `test_view_counting_rules.py`, `test_security_scan_fixes.py`,
  `test_store_orders_couriers.py`, 730 lines total). This container has no
  `backend/.env` and no local MongoDB, so `routes/deps.py` can't even import.
  These files were read and reasoned about, not executed.
- Any browser rendering — no screenshots, no RTL computed-style check, no
  Lighthouse. Everything below is static code review.

---

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 1 |
| Low | 3 |

This range is itself mostly a hardening/fix pass (F3–F19 of an earlier
security scan, plus two deliberate design-token fixes in the tour and nav
components) — I found no regressions in it, and no Critical or High issues.

**Worth doing first:**

1. Add plural forms for the 4 new `{{count}}` strings shipped this range
   (Medium — see below); as-is, Hebrew readers see grammatically wrong
   counts (e.g. "1 records", "2 done") in the admin restore toast, the
   admin deleted-accounts list, the setup checklist, and the automations
   "ran N times" line.
2. Get this container a working local Mongo + `backend/.env` (or fix
   whatever env gap is causing `motor`/`dotenv` import failures) so future
   nightly runs can actually execute `test_listing_price_parity.py` and the
   730 lines of new tests instead of skipping them every night.
3. Nothing urgent from security — the two Low items there are pre-existing
   and low-impact.

---

## Findings

### Medium — 4 new pluralized strings shipped without plural forms

`scripts/test-i18n-parity.mjs` failed one check: "no NEW t(key, { count })
without a plural set". Four keys added in this range interpolate `{{count}}`
into a single string with no `_one`/`_two`/`_other` variants, unlike the
project's established convention (e.g. `savedBy_one`/`_two`/`_other` already
in `locales/en.js:50-52`):

- `frontend/src/components/admin/UsersTab.jsx:37` — `admin.userRestored`,
  `'The account is back, with {{count}} of their records...'`
- `frontend/src/components/admin/UsersTab.jsx:225` — `admin.recordsCount`,
  `'{{count}} records'`
- `frontend/src/components/onboarding/SetupChecklist.jsx:144` —
  `setup.showDone`, `'{{count}} done'`
- `frontend/src/components/dashboard/AutomationsPanel.jsx:343` —
  `automations.ranCount`, `'Ran {{count}} times'`

**Impact:** with `count` values other than the string's implicit singular,
the grammar reads wrong — "1 records" in English, and Hebrew is worse
because it distinguishes one/two/many/other, not just singular/plural (see
the working `savedBy_two` example). Low visual severity, but this is a
brand-new admin-facing string set with a known-wrong pattern, and it's a
five-minute fix (add `_one`/`_two`/`_other` to both `en.js` and `he.js` for
each key, matching `savedBy`'s pattern) — flagged Medium because it's exactly
the kind of "renders wrong silently, no error" bug this check exists to catch.

### Low — no rate limit on the two public opt-out endpoints

`backend/routes/weekly_insights.py` (`POST /marketplace/insights/emails/opt-out`)
and the pre-existing sibling `backend/routes/marketplace/requests.py`
(`POST /requests/emails/opt-out`) have no `check_rate` call, and no global
rate-limit middleware covers them (`server.py` registers only CORS + GZip).
Impact is small — the token is an HS256 JWT scoped by `purpose`/`user_id`/`exp`
(`utils/notification_tokens.py`), so it isn't guessable or enumerable — but
it's still an unauthenticated POST with no throttle, which is a cheap
DoS/log-noise surface. (Backend subagent finding.)

### Low — pre-existing unauthenticated contract-metadata endpoint (not introduced this range)

`backend/routes/properties/contract.py:156-171` (`GET
/properties/{property_id}/contract`) takes no `verify_token` dependency and
returns `has_contract`/`contract_url`/`uploaded_at` for any property id to
any caller. It does **not** leak file bytes — confirmed the returned
`contract_url` is a legacy identifier, not a servable path, and
`private_contracts` is never mounted — so this does not violate the
"no contract bytes from a public mount" rule that has bitten this repo three
times before. It does disclose contract-existence/upload-timestamp metadata
to anyone. This route only changed 5 lines in the audited range (HTML-escaping
a name in an email); the missing auth predates this range. Flagging for
awareness, not as a regression. (Backend subagent finding.)

### Low — pre-existing physical `text-left` next to this range's own logical-property code

`frontend/src/components/admin/UsersTab.jsx:151-156` — six `<th>` use
physical `text-left` where this same file's own new code (and
`OrdersTab.jsx`/`PerformancePanel.jsx` elsewhere in this range) correctly
uses logical `text-start`/`text-end`. These exact lines weren't touched by
this diff (only the wrapping `<div>`'s overflow behavior and a border color
changed) — pre-existing tech debt in a file this range otherwise improved.
Admin-only surface. (Frontend subagent finding.)

### Informational — `translate.py`'s prompt-injection guard is best-effort

The `<contract>...</contract>` wrapping added under security-scan item F18
only neutralizes a literal, case-sensitive `</contract>` closing tag. A
differently-cased or re-nested string could still confuse the wrapping. Low
real risk — a successful injection here can only corrupt *translation output
text*, not trigger a privileged action — and the code already treats this as
a mitigation, not a solved problem. No action needed, just noting it's not
airtight. (Backend subagent finding.)

---

## Verified clean

- **Contract file security** (the class of bug that has shipped 3 times
  before): only `/api/uploads` is publicly mounted; `CONTRACT_DIR` never is.
  `resolve_private_contract_file` resolves by basename only and verifies the
  result stays under `CONTRACT_DIR` (traversal-safe). This range's changes to
  `contracts.py` actually **fix** a real prior IDOR (any booking, even
  pending/cancelled, could read any contract on a property) — now scoped to
  uploader/admin/already-signed, sublease contracts closed to non-token
  holders, `sign_contract` is a conditional update guarding double-signing,
  and `sign_token` is stripped from responses so it can't be harvested.
- **PII in the two new "who's interested in you" surfaces.**
  `GET /marketplace/looking-for-me` returns only
  `title/title_he/title_en/area/request_type/category/created_at/id` — no
  poster id, phone, email or WhatsApp (and `test_looking_for_me.py` asserts
  exactly that). The weekly insights email template contains only the
  recipient's own aggregate numbers, no one else's identity.
- **IDOR / ownership checks** across the changed routes: notification prefs,
  performance summaries, and leads summaries are all scoped to the caller's
  own id from the verified token, never a client-supplied id. The admin
  "restore deleted account" endpoint requires `role == admin`, is keyed off a
  tombstone snapshot id rather than a client-chosen user id, refuses to
  restore into an id/email that's back in use, skips (never overwrites) any
  record whose key already exists, and marks itself `restored_at` so it
  can't replay. No non-admin path found.
- **Opt-out token design**: both new/changed opt-out flows use signed,
  purpose- and expiry-scoped JWTs — never a raw user id/email in the query
  string — so the "someone unsubscribes another user" risk doesn't apply.
- **Session invalidation**: password reset/change and admin-block all
  correctly revoke or rotate sessions (`tokens_valid_after` + cache-bust).
- **View-count bot exclusion**: the new shared `is_bot()` check is wired
  into all three `record_view()` call sites (gigs, businesses, properties)
  and `site_visits.py` now defers to the same list instead of keeping its
  own — the two counters can no longer disagree about what a bot is.
- **"Today's deals" home section**: no invented numbers, no dead code left
  behind after removing the old "Today's picks" fallback rotation, honest
  empty state, correct "Add your business, free" CTA copy (comma, not an
  em-dash, per the standing copy rule).
- **`/home-preview` vs `/` theme gating**: `HomePreview.jsx` still adds
  `theme-preview` only when the path starts with `/home-preview`, and
  `home-v2` unconditionally — matches the CLAUDE.md rule, and this range's
  content change to the same file doesn't touch that gating logic.
- **RTL / design tokens across all new frontend files** (`EmailSwitches`,
  `LookingForYou`, `InsightsEmailsOff`, `PerformancePanel`, the tour
  components): no inline `Playfair Display`, no `var(--primary/--border/--muted)`
  shadcn collisions, no undefined CSS variables, no physical left/right in
  new code, green used for status only. Two things in this range actively
  *fix* prior drift: the tour's "Next" button was blue-solid (a measured
  3.62:1 contrast fail against the black-solid-button rule) and is now
  black-solid; `NavCategoryItem.jsx`'s hardcoded old-gold rgba is now the
  `--gold-rgb` token (which resolves to the current accent blue), and its
  hover handling moved to pointer-type-gated events, fixing the reported
  "tap nav item, hover state sticks" bug.
- **Bilingual key coverage otherwise**: every other `t()` key added in this
  range exists in both `en.js` and `he.js` (the i18n parity script's only
  failure is the pluralization item above).
- **New components aren't dead code**: `EmailSwitches`, `LookingForYou`, and
  `InsightsEmailsOff` are all imported and reachable (`SettingsTab.jsx`,
  `OverviewTab.jsx`/`MyBusinessesTab.jsx`, and the `/insights-emails-off`
  route respectively).
- **Secrets hygiene**: no `.env` files committed; `.gitignore` covers them.

## Not checked

- **Live listing prices** — the mandatory `live_price_check.py` pass did not
  run (network blocked in this sandbox). This is the single highest-value
  check per the audit's own history (it's the one that found the Sukkot
  pricing bug that months of code review missed) and it did not happen
  tonight. Treat prices as unverified, not as clean.
- **`test_listing_price_parity.py` and all 730 lines of this range's new
  backend tests** — could not execute (no local MongoDB / `backend/.env` in
  this container).
- **Any visual/rendered check** — no screenshots, no RTL computed-style
  verification, no Lighthouse accessibility pass. Everything above is static
  reading of the diff and surrounding code.
- **Live Cloudinary `authenticated`-asset behavior** (401 on unsigned
  fetch) — not re-verified live; took the existing code/docs at their word,
  per the audit's read-only, no-network-call rule.
- **CLAUDE.md accuracy against this range** — skimmed, not line-audited;
  nothing in this range appeared to touch positioning, discontinued
  offerings, or the standing guardrails, so no drift was looked for beyond
  a read-through.
