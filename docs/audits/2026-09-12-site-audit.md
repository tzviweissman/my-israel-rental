# Site audit — 2026-09-12

Scope: everything added since the last audit (`fef5475`, 2026-09-06) through `HEAD` (`790ff35`, 2026-09-09) — 27 commits, ~17k lines. This is the new store-orders/courier system (built and revised twice), three new scroll-driven business pages (Lechem Emek, Blazin' Boards, Michal Simkin), and changes to the contract-signing flow. Read-only pass per `.claude/skills/site-audit/SKILL.md` — nothing in this diff was fixed, only investigated. Working tree confirmed clean after the audit (no accidental edits).

Note on process: the scheduled prompt asked to use Obsidian to find what was recently added. No Obsidian connector or vault is available in this environment/session, so recency was determined from git history instead (commits since the last recorded audit) — functionally the same input, just a different source.

## Summary

**13 findings: 4 Critical/High, 5 Medium, 4 Low.** Three things to fix first:

1. **Staff order-board link leaks every customer's phone number and address** to anyone who has it, indefinitely — no login required.
2. **Payment links can bypass the revoked-provider allowlist** in three new order-facing surfaces (customer order page, courier view, confirmation email) — pulling a bad payment link (e.g. after a Zelle-style incident) won't actually remove it from these three places.
3. **A green button that was fixed for accessibility 8 Sep got un-fixed hours later** by a same-day rewrite — a real regression of already-completed work.

## Findings

### Critical/High

**F1 — [High] Counter/staff order-board exposes all customers' phone numbers and addresses, unauthenticated.**
`backend/routes/marketplace/orders.py:495-508` (`GET /marketplace/orders/staff/{token}`) is intentionally link-only, no login — but it returns every order for the business including `customer_phone`, `customer_phone_e164`, `address`, and `notes` for *all* orders, not just the one the staffer is currently working. The courier side of this same feature set is careful (`orders.py:1180-1229` only reveals phone once an order is `ready`, and logs each reveal); the staff board has no equivalent gating. Violates the site's "no phone/email in a public response, contact is chat-only" rule. If this link is ever shared to a group chat, left on a shared tablet, or otherwise leaks, every customer who ever ordered from that business has their phone + address exposed.
*Fix:* scope the staff-board response to what's needed to fulfill the order in front of the staffer (name + item + status), and gate phone/address reveal the same way the courier flow does.

**F2 — [High] Payment-link allowlist bypassed in the new orders code.**
`utils/payment_links.py` exists specifically so a revoked/compromised payment provider link disappears everywhere immediately once pulled from the allowlist — `businesses.py:799` uses it correctly. The new `routes/marketplace/orders.py` never imports it and reads the raw, unfiltered link in three places: the customer-facing order page (`:1733`), the courier delivery view (`:1190`), and the order-confirmation email sent to customers (`:1873`). A pulled payment link would still show up in all three.
*Fix:* route all three reads through `allowed_payment_links()`.

**F3 — [High] A fixed accessibility bug was reintroduced by a same-day rewrite.**
Commit `5d7ac07` (8 Sep) fixed a courier "Delivered" button that was green-filled (4.44:1 contrast, and no screen-reader status) by switching it to the site's black/white action style. Later the *same day*, commit `e6d0467` rewrote that file into `frontend/src/components/dashboard/DeliveriesTab.jsx` as part of the courier-accounts redesign, and the rewrite reintroduced the original green fill (`DeliveriesTab.jsx:243`). This is a literal recurrence of an incident already logged as resolved, just a few hours later. (Two sibling buttons covered by the same original fix — in `OrderCard.jsx` and `OrdersTab.jsx` — were carried forward correctly.)
*Fix:* restore `var(--action)`/`var(--action-ink)` on that one button.

**F4 — [High] Undefined CSS variable silently drops shadows on Blazin' Boards' signature moment.**
`scrollcraft/builds/blazin-boards/index.html:151,181,221` reference `var(--sc-shadow-lg)` / `var(--sc-shadow-md)`, which are never defined anywhere (the shared engine defines `--sc-e1/e2/e3` instead). An unresolvable CSS variable with no fallback drops the whole `box-shadow` declaration — so the page's main CTA button, the product photos, and the "plank that grows to real size" (the page's stated centerpiece animation) all render flat, with no elevation, instead of as designed. Same silent-failure shape as the "invisible finale button" bug logged previously.
*Fix:* rename references to `--sc-e2`/`--sc-e3`, or add local aliases.

### Medium

**F5 — [Medium] Order status updates can lose an update under concurrent edits.** `orders.py:410-431` reads the current status, validates, then writes unconditionally — two simultaneous status changes (e.g. owner dashboard + staff board) can both pass validation and the second write wins, with both history entries still recorded, leaving history and status inconsistent. Doesn't allow double-fulfillment (assignment is separately guarded), just a lost update. *Fix:* conditional update (`find_one_and_update` filtered on the status you read), 409 on mismatch.

**F6 — [Medium] Orders/delivery spec doc no longer matches what shipped.** `docs/orders-and-delivery-spec.md` sections O5/O6 still describe the original phone-trusted-list + SMS + no-accounts design; the 2026-09-08 revision replaced this entirely with account-based couriers and auto-assignment. Only a build-log entry at the bottom says so — the body reads as current and wrong. *Fix:* rewrite O5/O6 in place.

**F7 — [Medium] Two docs cited by the spec were never committed.** `docs/orders-and-delivery-spec.md`'s "Related" line cites `docs/assistant-spec.md` and `docs/goods-marketplace-spec.md` — neither exists in git history. Same pattern flagged before (specs cited by name that vanished). *Fix:* remove the citations or write the docs.

**F8 — [Medium] Fabricated-sounding kashrut/founding-year claim on the Lechem Emek demo page.** `scrollcraft/builds/lechem-emek/index.html` states "since 1998" and "Kosher, Rabbanut Yerushalayim" with a specific address/hours. This page's own brief record never supplied a founding year, hechsher, or address — those specifics aren't traceable to anything the actual person said, and the page's own photos are AI-generated, suggesting this is demo/placeholder content, not a real client. A specific religious-certification claim invented for a demo is the same shape as the "1,200+ active rentals" incident. Low risk while this stays local-only; becomes serious if ever shown as sample content to a real audience. *Fix:* either label it visibly as a demo, or strip the unsourced specifics.

**F9 — [Medium] Unsourced competitor statistic in live marketing copy.** `frontend/src/locales/en.js:359` / `he.js:349` (sourced from a code comment claiming "Wolt's published average is 22%") states delivery apps take "22% and more" as a factual comparative claim on a live feature page, with no citation anywhere in the codebase. *Fix:* add a source/date next to the claim, or soften it to remove the specific number.

### Low

**F10 — [Low]** `DeliveriesTab.jsx:234` has a bare `aria-label="WhatsApp"` not routed through `t()`, unlike every sibling label in the same file. Cosmetic inconsistency, no functional impact (brand name, same in both languages).

**F11 — [Low]** Michal Simkin's page markets "English and Hebrew" service but ships no RTL/Hebrew variant, unlike Lechem Emek which correctly implements the RTL font-variable swap. Worth a one-line confirmation on whether Hebrew was deliberately deferred here (Blazin' Boards has an explicit written waiver for this; Michal Simkin's brief doesn't).

**F12 — [Low]** Dead leftover Mongo index (`couriers.token`, `orders.py:240`) from the pre-revision SMS/capability-link courier design that no longer reads or writes that field. Harmless, just unmaintained.

**F13 — [Low]** `orders.py`'s own module docstring still describes the deleted run-sheet/SMS courier model it was rewritten away from.

## Verified clean

- **IDOR on orders/couriers**: every owner route checks `owner_user_id`/admin; courier routes filter by `courier.user_id` in the query itself (404, not 403, on mismatch) — confirmed against tests.
- **Contract-file storage regression** (the pattern that broke 3 times before and cost a contract permanently): fully fixed and regression-tested in this diff. All new/changed contract routes resolve through the private helper, never the public static mount; three dedicated tests explicitly probe the old bug shape and fail on it.
- **Dev autologin** (`?as=owner`): double-gated on `DEV_AUTOLOGIN=1` *and* a localhost `MONGO_URL`; matches CLAUDE.md exactly, cannot fire in production config.
- **Rate limiting**: present on every new unauthenticated endpoint.
- **Bilingual completeness on the new order/courier UI**: every `t()` key across all 8 new frontend files and touched existing ones resolves in both `en.js` and `he.js` — checked systematically (265+ keys), zero missing.
- **RTL font trap, design-token drift, physical-vs-logical CSS**: none found in any new order/courier frontend code.
- **Invented numbers on the order/courier dashboard**: the two new "attention" stats trace to a real backend query, not placeholders.
- **Blazin' Boards / Michal Simkin scroll mechanics**: no video-scrubbing, no `overflow-x:hidden`-vs-`sticky` conflict (engine deliberately uses `overflow-x: clip` on `body`, not `html`), no zero-height absolutely-positioned sections, no `HeroSlideshow` misuse.
- **The self-review in commit `99aefcd`** ("twelve findings, ten taken, two argued"): both rejected findings were reasonable — one had a real structural alternative fix, the other correctly refused to invent a response-time SLA that isn't on record.
- **Discontinued features** (`DOCUMENT_SERVICES_ENABLED`, `storage` rental type): untouched by this diff.
- **Old SMS/token-based courier code**: cleanly deleted in the revision, zero dangling references.

## Not checked

- Full backend test suite was not run against a live database (no local MongoDB available in the audit environment, and this repo has no CI). `--collect-only` succeeded clean (1302 tests, 0 import errors); the 71 tests covering this diff correctly skip without a live API rather than erroring.
- Frontend production build was not run (no `node_modules` installed; a cold install was judged too slow for this pass) — new build warnings unknown.
- No live screenshots/visual-diff or Lighthouse pass on any new page — all three findings involving rendering (F3, F4) are from static code reading, not pixels.
- Whether Blazin' Boards' and Michal Simkin's quoted prices/testimonials genuinely match the real businesses they're sourced from — no outbound verification performed.
- Frontend consumption/display of the staff-board API response (F1) — only the backend contract was checked; the UI might already do partial masking, but the API itself over-shares regardless.
