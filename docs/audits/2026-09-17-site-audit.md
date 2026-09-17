# Site audit — 2026-09-17

Scope: everything committed since the last full site-audit
(`docs/audits/2026-09-14-site-audit.md`, range `504b434..4486e3b`, 80 files,
~7,100 lines). That range is dominated by five pieces of work merged 15–16
Sep: **business subdomains** (`<slug>.myisraelrental.com`), a **restore
drill** proving backups are actually restorable, an **account-deletion
cascade** + **uptime monitoring**, **signing-link expiry** + an **order-status
race fix** + a new **Terms page**, and a **Jerusalem Hebrew name fix** +
**storage rental-type removal from new UI** — plus the fixes that closed out
the 14/15 Sep audit findings.

This was a read-only investigate-and-report pass. Nothing was fixed,
committed, or deployed.

## How this was done

No Obsidian vault was reachable from this session (no such connector is
configured on this account — confirmed via `ListConnectors`), so "what was
added recently" was scoped from the repo's own commit history since the last
site-audit doc instead, same as the 14 Sep evening audit.

- Five parallel deep-dive reviews (separate context windows), each given the
  full diff plus enough surrounding code to reason about behavior, not just
  diff hunks: (1) business subdomains, (2) account-deletion cascade + uptime
  monitoring, (3) contracts/signing-links/order-race/Terms, (4) verification
  that the 14 Sep audit's three fixes actually landed + Jerusalem/storage
  cleanup, (5) restore drill + remaining grab-bag changes.
- Mechanical checks run directly by the orchestrating session:
  `scripts/test-i18n-parity.mjs` (passed clean — every `t()` key used in the
  frontend exists in both `en.js`/`he.js`), a grep for new inline
  `fontFamily: 'Playfair Display'` in the diff (none found outside a code
  comment), a grep for new hardcoded hex colors in changed frontend files,
  and a grep for `storage` references in the diff.
- Two of the five sub-reviews independently ran real commands:
  `node scripts/test-business-hosts.mjs` (passed — 33 assertions) and
  `test_business_web_address.py`/`test_smart_lists_access.py` were read in
  detail to confirm they exercise real HTTP routes, not just internal
  functions.
- **Could not run the backend test suite or start the app.** No
  `backend/.env`, no local MongoDB, no `pytest` in this session's container.
  All backend test files were read and reasoned about, not executed (except
  the two exceptions above where a sub-review had enough to run a script
  directly). No live rendering, no Playwright, no RTL computed-style checks.

---

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 6 |
| Low | 5 |
| Info | 2 |

Nothing here is user-facing-broken or an active security hole today — the
riskier new surfaces (business subdomains, account deletion) hold up well on
direct inspection: real server-side authorization, no IDOR, no public static
mount serving contracts, the order-status race fix is a genuine atomic-write
fix with a test that actually races two threads. The three bugs the 14 Sep
audit flagged are all confirmed properly fixed.

**Worth doing first, in order:**

1. **A user's uploaded contract files are never deleted from disk when their
   account is deleted** — the DB record goes away but the PDF/image stays on
   the volume forever, unreachable but never purged. Personal/legal
   documents are exactly the category this repo's CLAUDE.md treats as
   sensitive.
2. **The backend bulk-upload endpoint still accepts `"storage"` as a valid
   rental type**, even though every frontend picker has removed it — a
   direct API/CSV call can still create the discontinued listing type the
   14 Sep-era cleanup was supposed to close off.
3. **`businesses.slug` has no unique index re-asserted at app startup** —
   unlike `short_links.slug`, which explicitly recreates its unique index on
   every boot specifically to close a race. If that index is ever missing
   (fresh DB, dropped index), two users can win a race for the same
   subdomain with no 409, just an unhandled 500 and an unpredictable winner.

---

## Findings

### 1. [Medium] Account deletion never removes the deleted user's uploaded contract files from disk
**File:** `backend/routes/admin/core.py:306-330,400-404` (cascade), `backend/routes/properties/contract.py:69-92` (`contract_url` write path), `backend/routes/admin/properties_bulk.py` (older bulk-delete path — also doesn't touch this)

The account-deletion cascade removes a deleted owner's `properties` documents, but a property's uploaded contract lives as a physical file under `CONTRACT_DIR` (`backend/private_contracts/` locally, `/app/private_contracts` on Railway), pointed to by the now-deleted document's `contract_url`. Nothing unlinks that file. New contract uploads only write to this volume-backed local path (not yet Cloudinary, per CLAUDE.md's documented gap), so this is the only copy.

**Failure scenario:** an owner uploads a signed contract, then has their account deleted (self-request or admin action). The DB pointer is gone so no authorized endpoint can serve it anymore, but the actual file — a signed legal document with the tenant's name, ID, and terms — sits on the persistent volume indefinitely, consuming disk and outliving the account it belongs to with no code path that will ever clean it up.

**Fix direction:** before `delete_many` on `properties` in the cascade, collect each property's `contract_url`, resolve it to a path under `CONTRACT_DIR`, and unlink it (guard against path traversal the same way existing contract-serving code does).

### 2. [Medium] The backend bulk-upload validator still accepts `storage` as a rental type
**File:** `backend/routes/bulk_upload.py:100` (`_VALID_RENTAL_TYPES = {"long-term", "short-term", "vacation", "storage"}`)

Every frontend picker (`AddPropertyModal.jsx`, `SavedSearchesTab.jsx`, `ManagerPage.js`, `QuickAddPropertyForm.jsx`, `constants/propertyEnums.js`) has had `storage` removed from its selectable options, each with a comment citing CLAUDE.md's discontinuation of storage rentals. The backend CSV/bulk-upload validator was not tightened to match.

**Failure scenario:** a direct API call or CSV bulk-upload (bypassing `BulkUploadModal.jsx`'s now-cleaned dropdown) can still create a brand-new `storage`-type listing today, reintroducing the discontinued offering through the one path the frontend cleanup didn't reach.

**Fix direction:** drop `"storage"` from `_VALID_RENTAL_TYPES` (existing rows with that type are read fine everywhere else and aren't affected by tightening a *write*-side validator).

### 3. [Medium] `businesses.slug` has no unique index re-asserted at app startup — a missing index turns subdomain claiming into an unguarded race
**File:** `backend/utils/businesses.py:135-165` (`unique_slug`, check-then-write), `backend/routes/marketplace/businesses.py:643-660` (`set_web_address`), `backend/scripts/migrate_businesses.py:150` (the only place the index is created, one-off `--apply` script), compare `backend/server.py:482` (short_links.slug's index IS recreated on every boot, with a comment stating that's specifically to close this exact race)

Slug availability is checked, then written, non-transactionally, with no `except DuplicateKeyError` anywhere in the businesses router. That's safe only as long as the unique index from the one-off migration script is actually present in the live database. Unlike `short_links.slug`, nothing re-creates it at boot.

**Failure scenario:** on a fresh database (new environment, restored backup, or an index that was ever dropped), two businesses submitting the same slug within the same race window can both pass the availability check and both write successfully — Mongo's `_resolve` then returns whichever document it hands back first, silently handing one business's subdomain to whichever request URL-resolution happens to prefer. Even with the index present today, the failure mode on a genuine collision is an unhandled 500, not a clean 409.

**Fix direction:** add `db.businesses.create_index("slug", unique=True, background=True)` to server startup alongside the short_links index, and catch `DuplicateKeyError` in the write path to return 409.

### 4. [Medium] The account-deletion cascade's test coverage exercises 8 of 22 owned collections and 3 of 8 two-party collections
**File:** `backend/tests/test_admin_delete_user_cascade.py`

The test genuinely seeds real documents and asserts both "own stuff gone" and "other party's stuff kept" — not a trivial pass — but only for a third of the collections the cascade actually touches. The one real bug found in this audit (finding #6, below) is in exactly one of the untested collections; the existing test suite would not have caught it.

**Fix direction:** extend the test to loop over the full `_USER_OWNED`/`_TWO_PARTY_KEPT` collection lists rather than a hand-picked subset, so a future field-name typo anywhere in that mapping fails CI instead of shipping silently.

### 5. [Medium] `sign_contract_public` has the same unguarded read-then-write race that this same commit fixed in order status, just not applied there
**File:** `backend/routes/subleases.py:268-284` (unchanged by the 16 Sep fix)

The order-status fix (finding: verified clean, see Verified clean below) replaced a read-check-then-unconditional-write with an atomic `find_one_and_update` filtered on the expected current status. `sign_contract_public` still reads the `signed` flag, then does an unconditional `update_one` — the same shape of bug, in a different file, that the sibling fix in `orders.py` just closed.

**Failure scenario:** two near-simultaneous requests to sign the same single-use contract link could both pass the "not yet signed" check and both push a signature write. Real-world likelihood is low (single-use link, requires two racing POSTs to the same signing URL), but it's the identical bug class this exact commit set out to eliminate, just missed one sibling route.

**Fix direction:** apply the same `find_one_and_update({"_id": ..., "signed": False}, ...)` pattern used in `orders.py`.

### 6. [Medium] Hardcoded hex status colors duplicate existing, unused design tokens in two new/changed admin files
**File:** `frontend/src/components/admin/RequestReportsTab.jsx:119,126,134,142,185`, `frontend/src/components/admin/ServicesTab.jsx:228,238,253`

Both files hardcode `#F3F0E9`/`#FBECEC`/`#B23B3B`/`#FDF3E3`/`#8A6A14` inline for status pills (neutral/rejected/pending), rather than referencing CSS variables. `design-tokens.css` already defines matching tokens for the colors that exist there (`--success`/`--success-bg`, `--status-open`/`--status-open-bg`, `--gold-text`), but no token exists yet for the rejected/pending/neutral pills these two files invented, so they hardcoded hex instead of adding one.

**Failure scenario:** none today (values are consistent across both files) — but per CLAUDE.md's "no hardcoded hex in new/changed UI" rule, this is exactly the drift the rule exists to prevent, and a future palette change (this repo has changed its palette twice this month) won't reach these five pill variants.

**Fix direction:** add `--status-neutral`/`--status-neutral-bg`, `--status-rejected`/`--status-rejected-bg`, `--status-pending`/`--status-pending-bg` to `design-tokens.css` and reference them from both files.

---

## Low / nits

- **`chat_email_throttle` is only cleaned up by `sender_id` in the deletion cascade, but the collection is also keyed by `receiver_id`** (`backend/routes/admin/core.py:327` vs `backend/routes/chat.py:213-243`). Deleting a user who only ever *received* a throttled email leaves an orphaned row referencing their dead id. Low impact (no name/email in the row), but it's the exact orphan class this commit exists to close.
- **No admin-facing restore/undo for a deleted account.** A full pre-delete snapshot is written to `user_tombstones`, but — unlike the existing property-delete flow, which has a `/admin/properties/bulk/restore` endpoint — nothing reads `user_tombstones` back. It's a forensic record an engineer could manually replay from Mongo, not a one-click undo; today's commit message framing ("safe to hand an admin") overstates what exists.
- **A deleted user's contact PII (name/email/phone) survives indefinitely as denormalized snapshot fields on every booking, contract, and message they were ever party to** (by design — "the other party didn't ask to be forgotten" — but undocumented as a limitation anywhere). Worth a one-line note in `docs/` for the day this needs a precise answer to a deletion request.
- **No CSP header on the business-subdomain server responses** (`frontend/server.js:339-344` sets nosniff/X-Frame-Options/HSTS but not CSP), even though the page reflects business-supplied name/description server-side. Output is correctly HTML-escaped so there's no live XSS today; CSP would be defense-in-depth.
- **`terms.contactLink` is defined in both `en.js` and `he.js` but never read by `Terms.jsx`** (the component hardcodes its mailto display text instead). Cosmetic dead key.

---

## Verified clean

- **Business subdomains — IDOR, slug validation, reserved-word/case/unicode handling, and host-header handling** on the new `<slug>.myisraelrental.com` feature. Ownership check (`_owned()`) is server-JWT-based and gates both web-address routes; `SLUG_PATTERN` is ASCII-only so no homoglyph bypass; the three copies of the reserved-slug list (backend, and two frontend files) are byte-identical, confirmed by actually running `scripts/test-business-hosts.mjs` (33 assertions passed). `server.js`'s Host-header parsing rejects the `myisraelrental.com.evil.com` lookalike case and guards path traversal on static-file lookups before touching the filesystem.
- **`fix_reserved_slugs.py` migration script** is gated by the repo's production-write guard (local-only unless `--production` is explicitly passed alongside `--apply`) and is idempotent — re-running after a fix reports zero further changes.
- **Contract-file permission checks were re-verified and still hold** (this bug class has recurred three times per CLAUDE.md): every route that serves a contract — `download_contract`, `sign_contract`, `download_signed_contract`, `download_property_contract` — still checks the caller is a party to that specific contract, and `CONTRACT_DIR` is confirmed distinct from the mounted `UPLOAD_DIR`, never itself mounted as static files.
- **Signing-link expiry is enforced server-side on every read/use**, not just at creation, with a clean distinction between "token never existed" (404) and "token was real, now expired" (410, with a helpful message) — neither leaks anything else. 30-day window, deliberately doesn't affect unsigned links (an owner has no way to reissue one otherwise).
- **The order-status race is a genuine, correct fix**: an atomic `find_one_and_update` filtered on the expected current status closes the write window rather than narrowing it, returns a proper 409 naming the real current status on the losing request, and `test_store_orders_status_race.py` actually races two threads with real concurrent HTTP calls (not two sequential calls) and self-skips if a round never truly collided.
- **Short links still only ever point at already-public content** (`site`/`manager`/`property`/`business` — no contract/dashboard/chat target possible); unrelated to this commit range but re-checked per the audit's standing checklist.
- **Terms page**: reachable at `/terms`, both `Auth.js` and `SignupJoin.jsx` link to it correctly, all 32 `terms.*` keys present with real Hebrew (not English fallback) in `he.js`, and every factual claim in the copy (30-day signing-link expiry, no money held on-platform, phone-reveal logging) matches what the code actually does — including correctly saying nothing about either discontinued offering (document services, storage rentals).
- **The three bugs the 14 Sep site-audit flagged are all confirmed properly fixed**: the WhatsApp share-length guard now measures the actual `encodeURIComponent`-encoded length; a vacation-category Smart List's rent bounds are now gated to `null` at the single save/generate source of truth, so a stale bound can't resurface; the translation-safety refusal detector now recognizes Hebrew refusals too, with a new test case, plus a language-agnostic backstop.
- **`test_smart_lists_access.py`** genuinely hits real HTTP routes (via `requests` against a live local API, not just internal function calls) and confirms both non-admin 403s and cross-admin ownership isolation on saved lists.
- **Jerusalem's Hebrew name is correct (ירושלים), and all 16 other Israeli city names were individually checked** in both `en.js`/`he.js` — no garbling, no leftover English found among any of them.
- **Storage rental-type removal from current frontend UI is thorough**: every creation/filter picker across `AddPropertyModal.jsx`, `SavedSearchesTab.jsx`, `ManagerPage.js`, `QuickAddPropertyForm.jsx`, `constants/propertyEnums.js` has it removed with a CLAUDE.md-citing comment; existing `storageType` reads (`PropertyCard.jsx`, `StaysCard.jsx`, etc.) are untouched and still work; the admin's own read-only listings filter intentionally still offers it to find existing rows, per the commit message.
- **Restore drill** never targets production for the restore (source-only), never prints a raw secret (connection string goes through a temp file, deleted immediately after use; all error output is scrubbed), cleans up its throwaway database and temp files on every path, and its "restore succeeded" check decodes the actual dump files rather than trusting mongodump's log text (the docstring notes an earlier version had exactly that false-positive bug).
- **Admin console → moderation wiring, business-page duplicate CTA removal, and the `thumbnail-carousel.jsx` refactor** are all confirmed non-regressions: the new Requests tab is reachable end-to-end from the admin nav (not orphaned), the removed business-page CTA was two static banners with zero remaining references to its locale keys, and the carousel refactor deleted only a genuinely-unused component while leaving the production `ThumbnailStrip` (RTL arrow-flip, keyboard nav, reduced-motion) untouched.
- **Bilingual key parity**: `scripts/test-i18n-parity.mjs` passes clean across the entire frontend, including every new key family from this range (`terms.*`, Smart Lists' new sort options, etc.).
- **No new inline `fontFamily: 'Playfair Display'`** introduced in this range.
- **`docs/uptime-monitoring.md` and `docs/business-subdomains-setup.md`** were spot-checked against the actual code they describe (health-check JSON shape, Railway restart policy, API proxy path) — no drift found; both correctly self-document their own gaps (e.g., "nothing watches the scheduled jobs" for the restore drill) rather than overclaiming.

---

## Not checked (and why)

- **The backend test suite was not run** — no `backend/.env`, no local MongoDB, no `pytest` in this session's container. All test files not directly executed by a sub-review were read and reasoned about statically.
- **No live rendering, no Playwright, no screenshots, no RTL computed-style checks.** No dev server or headless browser available this session — everything here is static code review plus the two scripts that could run standalone (`test-i18n-parity.mjs`, `test-business-hosts.mjs`). Whether `RequestReportsTab.jsx`'s new status pills (finding #6) or the Terms page actually render correctly, especially in Hebrew/RTL, was not checked visually.
- **`scripts/test-business-hosts.mjs`'s integration section** (real Host-header spoofing against a running `server.js`, redirect-to-main-site, `/api` proxy precedence, response headers) needs a built `frontend/build` and a local API on :8001, neither present in this environment — only its 33 standalone parsing/reserved-list assertions were confirmed passing.
- **Production data was not queried** — no read-only production access in this session. Whether any real business has already hit the slug-race window in finding #3, or whether any already-deleted account left an orphaned contract file per finding #1, is unverified.
- **The restore drill's real-world monthly cadence could not be confirmed** — the repo has no scheduled-task registration script; whether the Windows Task Scheduler entry it describes actually exists on the one laptop it targets is outside what a code audit can see.
