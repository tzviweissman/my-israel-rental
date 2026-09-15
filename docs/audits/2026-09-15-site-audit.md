# Site audit — 2026-09-15 (evening)

Scope: everything committed since the last full site-audit
(`docs/audits/2026-09-14-site-audit.md`, which covered up to `2fd90f9`) that had
**not already been through a security-focused pass** — the 2026-09-15 UI audit
covered the same range visually/bilingually but not for auth, IDOR, or
production-data safety. Commits reviewed:

- `7f999fb` / `a4c2e7d` — Smart Lists access tests + selection-logic unit tests;
  the business page's duplicate "add yours" CTA removed (fixes for
  `2026-09-14-site-audit.md` finding 6 and `2026-09-15-ui-audit.md` finding 10).
- `dde2dfa` / `a3bb375` — business subdomains (`<slug>.myisraelrental.com`):
  `frontend/server.js`, `frontend/businessHost.js`, `backend/utils/businesses.py`,
  the owner-only web-address endpoints in `backend/routes/marketplace/businesses.py`.
- `42e6b26` / `de910b9` — `backend/scripts/restore_drill.py`, a new script that
  restores a production backup into a throwaway local database to prove backups
  actually work.
- Spot-checked in passing: `1dbbca5` (admin console wired to the moderation
  queue) — older (8 Sep) and already self-reviewed same day, checked here only
  for the admin gate on the two new routes.

**How this was done.** No Obsidian vault is reachable from this session (no
such connector is configured on this account — checked via `ListConnectors`,
empty result), so "what was added recently" was scoped from `git log` and the
existing `docs/audits/` history instead, same as every prior audit in this
repo. This container has no `backend/.env`, no local MongoDB, and the frontend
has no `node_modules` — so, like the 09-14 evening and 09-15 audits, this is
**static code review only**: no test run, no build, no browser, no
`scripts/check-*.mjs`, no `scripts/test-i18n-parity.mjs` binary run (parity
was checked by hand instead, see below).

---

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |

Nothing wrong found. The three things worth knowing anyway:

1. The business-subdomains feature (`server.js` Host-header handling, the
   owner-only web-address endpoints, the reserved-word list) is the most
   security-sensitive code shipped this week, and it holds up under a
   specifically adversarial read — see "Verified clean" below.
2. It still **ships dark**: `REACT_APP_BUSINESS_SUBDOMAINS` and the wildcard
   DNS/certificate are the switches, and per the commit message neither is
   flipped on yet. Nothing here is reachable on the live site today.
3. `restore_drill.py` has never actually been run against production (per its
   own commit message) — the drill that proves backups restore is itself
   unproven against the real backup. Worth doing once Atlas network access
   allows it; not a code defect.

---

## Findings

None. Everything reviewed below passed.

---

## Verified clean

**Smart Lists / business-page fix (`7f999fb`)**

- `backend/tests/test_smart_lists_access.py` (new) exercises all 6 admin
  routes through real HTTP calls: every one refuses a non-admin (403) and a
  missing token (401/403); an admin can save/open/delete their own list;
  another admin's list is invisible on list, 404s on open, 404s on delete
  (not 403 — existence isn't confirmed), and is actually still in the DB
  afterward (the delete didn't silently succeed on the wrong document); an
  inverted bedroom range 422s through the route, not just the pure function.
  The `local_db` fixture refuses to run against anything but a
  `mongodb://localhost` / `127.0.0.1` URL before touching it.
- The selection-logic extraction (`topIds`/`toggleSelection`/`trimToCap` in
  `smartListText.js`) is behaviorally identical to the inline code it
  replaced — traced by hand, e.g. `topIds` with `cap <= 0` calls
  `slice(0, undefined)`, which returns the full array, matching the old
  `cap > 0 ? cap : rows.length` branch.
- The removed `businessPage.addYours` / `addYoursCta` locale keys and the
  `data-testid="business-add-yours"` element have zero remaining references
  anywhere in `frontend/src` (grepped) — no dangling test IDs, no orphaned
  i18n keys. The surviving CTA (`data-testid="business-attribution-cta"`,
  line 624) correctly points at `/join`.

**Business subdomains (`dde2dfa`)**

- **Host-header parsing can't be tricked into matching the wrong apex.**
  `businessHost.js` / `frontend/src/utils/businessHost.js` /
  `backend/utils/businesses.py` all require `host.endsWith('.' + apex)` with
  a literal dot, so `myisraelrental.com.evil.com` (ends in `.evil.com`) and
  `evil-myisraelrental.com` (no dot before the apex) both correctly return
  no match. The extracted label is then checked against a DNS-label regex
  that forbids dots, so `a.b.myisraelrental.com` can't slip through as a
  business labelled `a.b`. All three copies of the reserved-word list are
  identical (`www admin api app mail ... business businesses properties
  ... chat`), so no path can mint a subdomain that shadows a real route or
  a mail record.
- **No open redirect in the business-host bounce.** `server.js:363-370`
  redirects any non-root, non-build-file path on a business host to
  `https://${PUBLIC_SITE_HOST}${req.url}`. `PUBLIC_SITE_HOST` is
  server-configured, not client-supplied, and `req.url` on a normal HTTP
  request is a path+query, not an absolute URI — even a request line engineered
  to start with `//`, would land inside the path of the already-fixed
  `https://myisraelrental.com` origin, not redirect off-site.
- **`isBuildFile` cannot escape the build directory.** It resolves the
  decoded path with `path.normalize` and rejects anything whose resolved
  path doesn't start with `BUILD + path.sep` — blocks `../../etc/passwd`-style
  traversal via a business host's file-serving branch.
- **The crawler/preview branch fails open, never open to injection.** slug
  passed to `/api/og/business/{slug}` is either the Host-derived label
  (already regex-validated) or the path-derived slug (validated against
  `^[A-Za-z0-9._-]{1,120}$` in `businessSlug()`), and any fetch error,
  timeout, or non-200 falls through to the normal static response — a broken
  backend can degrade the preview card, never break the page.
- **Ownership is enforced on both new endpoints.** `check_web_address` and
  `set_web_address` both call `_owned(business_id, user)`
  (`backend/routes/marketplace/businesses.py:286-292`), which 404s if the
  business doesn't exist and 403s if the caller is neither the owner nor an
  admin, before any address logic runs.
- **A retired address can't be hijacked, and an owner can reclaim their own.**
  `_address_status` checks the candidate against `slug` OR `previous_slugs`
  on every OTHER business (`business_id: {"$ne": ...}`) — so a stranger can
  never claim an address this business used to have, but the same business
  can move back onto one of its own past addresses freely.
  `unique_slug`/`slug_change` apply the identical retire-into-history rule on
  the mint/rename path, so there's one rule, not two that could drift.
- **Bilingual parity holds for the new copy.** Diffed the added lines in
  `en.js` and `he.js` from `dde2dfa` directly: 15 keys added to each file,
  identical key names, no orphans either direction.
- **No inline `fontFamily: 'Playfair Display'` and no RTL physical-property
  regressions** (`marginLeft/Right`, `paddingLeft/Right`,
  `text-align: left`) in `WebAddressField.jsx`, `BusinessPage.jsx`,
  `SmartListsTab.jsx`, `RequestReportsTab.jsx`, or `App.js` — grepped, zero
  hits across all five.
- **No invented numbers** in the new business-page or web-address code —
  grepped for the "500+ / 1,200+ / verified pros" pattern this repo has
  shipped by accident before; nothing there.

**Restore drill (`42e6b26`)**

- Refuses to start if `PROD_MONGO_URL` points at `localhost`/`127.0.0.1`, or
  if the source database name is in `NEVER_SOURCE` (`sample_mflix`, `admin`,
  `local`, `config`).
- Restore target is always a freshly-generated `restore_test_<UTC
  timestamp>` database on `mongodb://127.0.0.1`, asserted twice
  (`assert LOCAL_URI.startswith(...)`, `assert target_db != LOCAL_DEV_DB`),
  and the script stops if that name already exists rather than reusing it.
- The connection string is read from a gitignored file, written to a
  temporary YAML config for `mongodump` (never a CLI argument, so it's not
  in the process list), and the config file is deleted immediately after
  `mongodump` runs — before the rest of the script executes, so a crash
  later can't leave it lying around either.
- `scrub()` redacts anything containing `://...@` before it reaches stdout
  or a `sys.exit` message, applied to every error path that could echo a
  connection string.
- Verification counts come from decoding the actual `.bson.gz` dump files,
  not from parsing tool log output — which is exactly the bug the commit
  message says the first version had (a log-parsing miss reported "0
  collections, 0 documents, PASS" against a real 48-collection source). The
  current version fails if the backup is empty, empty while the source
  isn't, or missing any non-empty source collection.
- Cleanup (`drop_database` + `rmtree`) runs in a `finally`, so it fires on
  both the pass and the fail path, and confirms afterward that the database
  and temp directory are actually gone rather than assuming the drop
  succeeded.

**Admin moderation routes (`1dbbca5`, spot-check only)**

- Both new routes (`GET/POST /admin/request-reports[...]`) call
  `_admin_only(payload)` as their first line, same pattern as every other
  admin route in the file.

---

## Not checked (and why)

- **Nothing was run.** No `backend/.env`, no local MongoDB, no `pytest`, no
  frontend `node_modules` in this container — so the 15 new Smart Lists
  access tests, the 32 Smart Lists unit tests, the 38 business-web-address
  backend tests, the 22 frontend unit tests, and
  `scripts/test-business-hosts.mjs` were all read and reasoned about, not
  executed. All of them are claimed passing in their commit messages; none
  of that is independently confirmed here.
- **No live rendering.** No dev server, no browser — the business-subdomain
  page, the Hebrew/RTL web-address field, and the business-page CTA change
  were not seen on screen, only read as code. The 2026-09-15 UI audit did
  look at the business page and web-address field in a browser at the time
  it shipped; this pass adds the security angle on top, not a second visual
  check.
- **`restore_drill.py` was not run**, against production or otherwise. It
  needs `backend/.env.restore` (a real, presumably read-only, Atlas
  connection string) and this session has no such file and no Atlas network
  access — and per the guardrails for this audit, production Atlas is never
  to be touched from here regardless. Its own commit message says the same:
  it has been rehearsed against a local database, never against the real
  backup.
- **`1dbbca5` beyond the admin gate.** It's eight days old, already reviewed
  the day it shipped (`c21ea61`), and out of this pass's actual scope (its
  fix predates the last full site-audit by a week); only the two new routes'
  auth check was spot-checked here because the admin-moderation area is
  adjacent to what this pass was already reading.
- **Whether the wildcard DNS/certificate/`REACT_APP_BUSINESS_SUBDOMAINS`
  flag have actually been turned on anywhere** — that's a Railway/DNS
  question, out of reach from a read-only code pass, and per the commit
  message the feature was built specifically to still be off.
- **Everything outside the three commits above** — this was a targeted
  follow-up pass on the parts of the last 24h of work that hadn't had a
  security-focused read yet, not a from-scratch full-surface audit. The
  broader categories in the site-audit skill (performance, accessibility,
  dependency vulnerabilities, data-integrity jobs) were not re-checked here;
  see the 09-08 through 09-14 reports in this directory for their last
  coverage.
