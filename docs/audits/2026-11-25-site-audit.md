# Code review, 25 Nov 2026

## In short
- One real gap in today's code: a business can now change its payment links in two places (Design your page, and the new "How customers pay you" on Texts and emails). If the owner has a page draft saved and publishes it later, the draft's older payment links silently replace the ones they changed in Texts and emails, so customers get the old link. Reported, not changed.
- Everything else today holds up: the payment link now sent with the order-confirmed text is only a checked, allowed link and stops once the order is paid; reviews that say what was ordered show item names only, no customer details; the texts page shows each business only the messages it can send.
- Fixed tonight: the Hebrew payment line on that text read "לתשלום בBit" with the letter stuck to the name; it now reads "לתשלום ב-Bit", like the rest of the site. Branch `claude/exciting-bell-u0xv17`.
- Needs your decision: how to handle the draft clash above (simplest: when payment links are saved from Texts and emails, drop them from any saved page draft, or warn on Publish). Still waiting from earlier: whether staff may send test texts (24 Nov), and the audit fixes waiting on the merge branches.

## New findings

1. **[Medium] A saved page draft puts old payment links back over ones changed on Texts and emails.** Since 7df5740 the payment links are edited in two places. Texts and emails saves them straight to the live business (`TextNotificationsPanel.jsx:118`, `PATCH /businesses/{id}`). Design your page keeps a draft that always includes them: `payment_links` is one of the draft keys (`backend/routes/marketplace/businesses.py:652`), the draft body is stored as sent (`:694`), the editor opens a saved draft in place of the live page and loads its links (`BusinessPageEditor.jsx:235`, `:365`), and Publish sends `buildPayload()`, which always carries `payment_links` (`:341`, `:531`). Sequence: owner saves a draft with Bit link A; later on Texts and emails changes it to link B (live, B shows to customers and goes in the order text); then opens Design your page and presses Publish to put the draft live; link A replaces B with no message. Nothing on either screen mentions the other. Proof is the code path above; no browser or database in this sandbox to run it end to end. Fix options: drop `payment_links` from the page draft when the Texts and emails save changes them (one `$unset` of `page_draft.payload.payment_links` in that save), or have Publish leave links out when the draft's copy equals what the editor loaded from the draft but differs from live. Not fixed: it changes stored data.

No other findings; none dropped.

## Fixed this run
- `ff35cb4e`: the order-confirmed text's pay line (new today, `order_texts._pay_line`) and its phone preview (`MessagePreview.jsx:47`) wrote "לתשלום בBit". Now "לתשלום ב-Bit", the way he.js writes the prefix before a Latin word or number (ב-{{n}}, ב-{{date}}); an owner's Hebrew label ("ביט") still reads "לתשלום בביט". Wording only: which link is sent, and when, is unchanged. Checked: `test_order_texts` 25 passed (the test now pins both cases); the preview's expression run in node prints `לתשלום ב-Bit: u` and `לתשלום בביט: u`; the file parses.

## Still open
- 24 Nov [Low]: staff with the Orders area can send test texts and use translations on Texts and emails (`orders.py:2178`, `:2214`); not touched today.
- `test-i18n-parity` fails the same 3 checks (browse.*, wizard.pickCategory/pickSubcategory, browse plurals): the fix is on the audit merge branches, not on main.
- 22 and 23 Nov discount-code findings: waiting on a decision; no commit today touched them.
- Everything else in `open-issues.md` was outside today's changes and not re-checked.

## Could not confirm
- The draft clash above end to end in a browser (no Chromium, no database here). A Playwright run with `?as=owner`: save a draft, change links on Texts and emails, Publish, read `/businesses/{slug}` would confirm it.
- Whether `scripts/check-msg-groups.mjs` passes: it needs the API with a database and a phone-sized browser.

## Verified working
- **Pay line on the order-confirmed text** (`order_texts.py:287`): goes through `allowed_payment_links`, so a link outside the allowlist is never texted (the new test pins `evil.example.com`); left out once `payment.method` is set, the same "paid" test the tracking page uses (`orders.py:1780`); only the first link, labels always filled on save (`payment_links.py` fills the provider's name); only on confirmations, never declines.
- **Payment links on Texts and emails**: saved with the existing owner-only `PATCH /businesses/{id}`, which validates every link (`businesses.py:824`, 400 on a refused one) and can clear the note (fields read by `model_fields_set`); only sent when they changed; the add button follows the server's limit (`/payment-providers` returns `max` 4). The settings read (`orders.py:2020`) serves links through `allowed_payment_links`.
- **Which messages a business sees** (`orders.py:2006`): orders from a selling listing, bookings from any published non-store listing, reminders only with appointments; a business with nothing published sees all. Display only: every message still sends as before.
- **What was ordered on reviews** (`reviews.py:253`): only native reviews of a real store order; item names only, at most 4, and the reorder link; no quantities, prices, phone or address (the test checks the phone is absent). `test_reviews_business` 10 passed (run on an in-memory database, see Not checked).
- **Scripts**: `commit-rules.mjs --only` and the worktree fix, the by-look check in `pre-commit-check.mjs`, and the ad and inspo scripts touch no data or secrets.
- **Tests**: price parity 17, order texts 25, payment link allowlist 45, reviews 10: all passed. Script tests: 10 pass; `test-i18n-parity` as above.
- **Build**: production build passes (exit 0; only the old Tailwind `ease-[...]` ambiguity warning).

## Not checked
- PRICE CHECK DID NOT RUN: `could not read https://myisraelrental.com/api/properties (Tunnel connection failed: 403 Forbidden)`. The price parity test ran and passed.
- `FAILED  playwright + chromium`, `FAILED  mongodb on :27017 (... curl: (22) The requested URL returned error: 403 )`, `SKIPPED api (no database)`. So `test-order-picks.mjs`, `test-signup-flow.mjs`, `test-tier-limit.mjs` and `check-msg-groups.mjs` did not run; `test_reviews_business` was run with mongomock in place of the local MongoDB.
- Full backend suite: not run without a database.
- `scripts/test-moving-ad-checks.mjs`: needs Chromium, 10 to 15 minutes.
- How the new "How customers pay you" section, the ad maker's holiday props and the review "Order this" button look: the UI audit's area.
