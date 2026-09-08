# Site audit — 2026-09-08

Scope: everything added since the last full review (commit `d91d86a`, 2026-09-05) through the current head of `claude/exciting-bell-vxjy7z` (`e6d0467`). That range is almost entirely one feature: **store orders + courier delivery** (new `backend/routes/marketplace/orders.py`, ~1,900 lines, plus ~10 new frontend pages/components), plus five commits touching the **contract-signing flow**, and two new standalone `scroll-craft` business landing pages (not wired into the app).

This was a read-only investigate-and-report pass. Nothing was fixed. No commit, no push, no deploy.

## How this was done

- Full diff read of `backend/` and the new frontend files against `d91d86a..HEAD`.
- Three independent deep-dive passes (separate context windows, so each re-derived findings from the code rather than trusting a summary): (1) orders backend security/data-integrity, (2) contract-signing flow security, (3) orders frontend RTL/design-system/truthfulness.
- Mechanical checks I ran directly: bilingual key-parity script across every `t()` call in the new files (including dynamic keys like `orders.status.${s}`) against both `en.js`/`he.js`; whole-backend `py_compile`; a full frontend production build (`npm run build`); a scan of the two new business landing pages for invented stats and missing assets.
- Could **not** run the backend test suite (five new `test_store_orders*.py` files exist and look well-targeted) — no local MongoDB and no `tests/.env.test` in this sandbox. Noted below as not checked, not as a pass.

---

## Summary

| Severity | Count |
|---|---|
| Critical | 2 |
| High | 4 |
| Medium | 5 |
| Low | 6 |

**Fix these three first:**

1. **Forged contract signatures** — `POST /contracts/{contract_id}/sign` has no check that the caller is a party to the contract. Any logged-in user can sign *any* contract on the site with a fabricated name/signature.
2. **Phishing/tracking payload in real emails** — the new order system splices unescaped, anonymous-visitor-supplied text (name, items, address) straight into HTML emails sent to store owners and customers, under the platform's own sender identity.
3. **Customer phone/address exposed on the no-login staff link, and pushed over WhatsApp** — the counter/staff order board (deliberately built to work without an owner login) shows every customer's phone and address with no gating, and the UI hands out a share link for it over WhatsApp, unlike the courier view, which does gate phone reveal by order status.

---

## Findings

### 1. [Critical] Any signed-in user can sign anyone else's contract
**File:** `backend/routes/contracts.py:413-434` (`POST /contracts/{contract_id}/sign`)
**What it is:** The endpoint only checks `verify_token` (any authenticated user) — no check that the caller is the owner, the renter on the matching booking, or an admin. It accepts a client-supplied `signer_name` and `signature_data` and writes them into the contract's `signatures[]`, setting `signed: true`.
**Impact:** Any account on the site can forge a "signed" status on a contract that isn't theirs — a real signature on someone else's lease agreement, with no relationship check at all. This is the exact class of bug this repo's contract-storage rules exist to prevent, just in a different endpoint than the three prior static-mount incidents.
**Fix direction:** Add the same ownership check `_may_access_contract` already uses elsewhere in this file (owner/renter-with-matching-booking/admin) before accepting a signature.

### 2. [Critical] Unescaped visitor input lands in real emails, sent from the platform's own address
**File:** `backend/routes/marketplace/orders.py:963-968, 1267-1273, 1844-1861`
**What it is:** `place_website_order` is unauthenticated (`viewer=Depends(optional_user)`). `customer_name`, order items, and `address` are validated only for length, then spliced directly into HTML email bodies sent to the store owner ("New order from …") and the customer, with no `html.escape()`. This repo's own `utils/email.py` already escapes exactly this class of input for chat-mention emails, with a comment explaining why — the new order emails don't follow that pattern.
**Impact:** Anyone, with no account, can submit an order where the "customer name" is actually an HTML link, an image tracking pixel, or fake urgent-payment text. It arrives in the store owner's real inbox as a completely normal-looking "New order" notification. The people this feature targets (small local businesses) are a good phishing target.
**Fix direction:** `html.escape()` every user-supplied string before it goes into an email body, matching the existing `utils/email.py` pattern.

### 3. [High] Customer phone/address shown unconditionally on the no-login staff board, then shared over WhatsApp
**File:** `backend/routes/marketplace/orders.py:197-201` (`_public`, used by both the authenticated owner listing and the token-only `staff_board`); UI: `frontend/src/components/dashboard/OrderCard.jsx:135-144`, share link at `frontend/src/components/dashboard/OrdersTab.jsx:1088`
**What it is:** The staff link is explicitly designed to work with no owner login — "the token in the URL is the whole credential." `_public()` returns full customer phone and address for every order regardless of status, with no equivalent to the gating this same feature applies elsewhere: the courier's own view (`_stop()`) only reveals phone once an order is `ready`, and the code comments say every such reveal is logged. The staff board has no equivalent restraint or audit trail. The UI then offers a one-tap "share this board link over WhatsApp" action.
**Impact:** Whoever ends up holding that link (forwarded, screenshotted, found in old WhatsApp history) has standing, unexpiring (until manually rotated) access to every customer's name, phone, and address for that business — not just today's orders. May be an intentional tradeoff (staff need the phone to call about pickup), but it's inconsistent with how carefully phone-reveal is gated elsewhere in the same feature, and is worth a deliberate product decision rather than an oversight.
**Fix direction:** at minimum, gate phone/address on the staff board the same way `_stop()` does; consider not surfacing the raw board link as a WhatsApp-shareable string.

### 4. [High] Re-signing a sublease contract silently replaces the document everyone downloads
**File:** `backend/routes/subleases.py:268-358` (`POST /contracts/sign/{sign_token}`)
**What it is:** Unlike the parallel booking-contract flow (`backend/routes/bookings/contract.py:91-92`, which explicitly blocks re-signing with `if booking.get('contract_signed'): raise HTTPException(400, ...)`), this endpoint has no re-sign guard. The `sign_token` is a bearer credential with no expiry or single-use enforcement. Since the recent "produces a document you can send someone" change (`f4a96e9`), each call now rebuilds and overwrites `signed_filename` — so calling the endpoint twice doesn't just add a second entry to `signatures[]`, it makes the canonical PDF reflect whichever call happened last, silently, with the earlier signature no longer represented in the document anyone actually receives.
**Impact:** Not reachable by clicking through the normal UI (the sign form disappears once `signed` is true), but reachable by anyone who still holds the token via a direct API call. A held or leaked `sign_token` becomes a way to quietly rewrite an already-signed legal document.
**Fix direction:** Add the same "already signed" guard the booking flow already has.

### 5. [High] `photo_url` accepted from couriers with no validation — embedded raw in email and returned on the public tracking page
**File:** `backend/routes/marketplace/orders.py:893, 1270, 1335, 1883`
**What it is:** No scheme check, no domain allowlist — contrast with `utils/payment_links.py`, which exists specifically because an arbitrary owner-supplied URL rendered on a page the platform hosts is an open redirect/injection risk. `photo_url` gets none of that: it's embedded raw in an `<img src="...">` in the "Delivered" email, and returned verbatim from the unauthenticated tracking endpoint and from `GET /orders/mine`.
**Impact:** A courier account (real, but potentially compromised) can point this at an attacker-controlled URL — minimum impact is a cross-site tracking pixel firing when the owner/customer opens the email or tracking page; a value containing `"` could break out of the `src` attribute.
**Fix direction:** Validate it's an HTTPS URL on the platform's own media host (Cloudinary), same posture as `payment_links`.

### 6. [High] `MyOrdersTab.jsx` shows a false "you have no orders" on any fetch failure
**File:** `frontend/src/components/dashboard/MyOrdersTab.jsx:19-23`
```jsx
axios.get(...).then(({ data }) => setOrders(data || [])).catch(() => setOrders([]));
```
**What it is:** Any error — network blip, expired token, a real 500 — is silently swallowed and rendered identically to "you have genuinely never ordered anything." No toast, no retry.
**Impact:** A customer whose order history fails to load sees "Nothing yet. Order from any store page and it will show up here" — a false claim about their own history, which is exactly the class of bug this repo's audits treat as highest priority.
**Fix direction:** Distinguish a failed fetch from a genuinely empty list; show an error state with retry.

### 7. [Medium] Sublease contract read access leaks across unrelated tenants
**File:** `backend/routes/contracts.py:145` (`_may_access_contract`), `backend/routes/subleases.py:198`
**What it is:** For a linked sublease, `contract["property_id"]` is set to the *original* property's id. `_may_access_contract` grants access to anyone with any booking against that property id — so any past renter of the original apartment, not just the actual sublessee, can download a sublease contract, including another tenant's name and signature image, via `GET /contracts/download/{contract_id}`.
**Impact:** Cross-tenant exposure of a signed legal document. Pre-existing (not introduced by this week's commits), but sits directly in code these commits touched.
**Fix direction:** Match on the specific sublease's own renter, not any booking against the shared property id.

### 8. [Medium] `payment_links` read raw in two new call sites, bypassing the platform's own re-validation-on-read rule
**File:** `backend/routes/marketplace/orders.py:1189, 1726`
**What it is:** `businesses.py`'s own public endpoint calls `allowed_payment_links(...)` on every read specifically so that pulling a compromised payment domain from the allowlist takes effect immediately, everywhere, without the owner re-saving (a real past incident is the reason this rule exists). The two new order-flow call sites read `biz.get("payment_links")` directly, skipping that re-check.
**Impact:** Not attacker-reachable today (writes are still validated), but reintroduces the exact staleness gap already paid for once, in two new places, if a domain is ever pulled from the allowlist.
**Fix direction:** Route both through `allowed_payment_links()`.

### 9. [Medium] Order status/courier-assignment updates are read-then-write, not compare-and-set
**File:** `backend/routes/marketplace/orders.py:409-430, 949-969`
**What it is:** Status transitions are validated against a status value read earlier in the request, then written with an update filtered only on `_id` — no `status: current` guard, unlike the standing-order occurrence index a few lines away, which does use a DB-level unique constraint for the same class of race. Courier assignment has the same shape.
**Impact:** The shared staff board is explicitly meant to be used by multiple people at once — two concurrent status changes (or a rapid re-assign to two different couriers) can each pass validation against a now-stale snapshot, landing the DB in a state that doesn't match what one of the actors was told happened (e.g., a courier notified "you have this delivery" when the DB ends up assigning it to someone else).
**Fix direction:** Use `find_one_and_update` filtered on the expected prior status/courier value; treat a filter-miss as a 409.

### 10. [Medium] Three of six new pages show an indefinite spinner on a persistent (non-404) fetch failure
**Files:** `frontend/src/components/dashboard/DeliveriesTab.jsx:36-49` (courier's own delivery list), `frontend/src/pages/OrderTrackPage.jsx:34-41` (public, no-login customer tracking page), `frontend/src/pages/OrdersPrintPage.jsx:37-48`
**What it is:** Each treats "still loading" and "failed to load" as the same state (`null`), with only a transient toast (where present) to explain a failure, and only a 30-second poll to possibly self-heal.
**Impact:** Worst case is `OrderTrackPage.jsx` — an anonymous customer who followed a tracking link with a genuine "where's my order" worry sees a permanent spinner with no explanation on any error other than a 404.
**Fix direction:** A distinct "couldn't load — retry" state, separate from both the spinner and the true-empty state.

### 11. [Low] No rate limit on the public `GET /order-form/{gig_id}`
**File:** `backend/routes/marketplace/orders.py:1717`. Every other unauthenticated endpoint in this file (`staff_board`, `staff_set_status`, `track_order`, the order-placement POST) calls `check_rate(...)`; this GET doesn't. No sensitive data is returned, but it's an unthrottled DB-hitting endpoint and an inconsistency with the rest of the file.

### 12. [Low] `track_token` index isn't marked `unique`
**File:** `backend/routes/marketplace/orders.py:241`. Tokens are 128-bit random, so collision isn't practically reachable, but the same file marks the standing-order occurrence index `unique=True` specifically for defense-in-depth against a concurrent-request race — this index doesn't get the same treatment.

### 13. [Low] `GET /properties/{property_id}/contract` is unauthenticated and returns the raw contract identifier string
**File:** `backend/routes/properties/contract.py:155-170`. Not independently exploitable (the identifier only resolves through the permission-checked resolver, never a public path), but it's an unauthenticated endpoint handing back exactly the kind of value `contract_files.py`'s own docstring warns not to build a link from. Pre-existing, not from this week's commits.

### 14. [Low] `CI=true npm run build` fails (pre-existing, not from this week's changes)
Running the frontend production build with `CI=true` (some CI systems set this automatically) turns ~20 pre-existing `react-hooks/exhaustive-deps` warnings into hard errors, none in files touched this week. A plain `npm run build` (no `CI=true`) succeeds cleanly and produces a working bundle — so this is not currently blocking real deploys unless Railway's build environment happens to set `CI=true`, which I did not find evidence of in `railway.json`/the documented Railpack behavior. Worth a quick confirmation, not an emergency.

### 15. [Low] Minor items not worth their own fix cycle
- Order confirmation/notification email subjects splice in `customer_name` without stripping embedded newlines — untested whether the mail provider's API would reject/mangle this; flagging for awareness only.
- Courier-invite endpoint has no per-owner throttle beyond the hard 20-courier cap; requires an authenticated account, low risk.
- A code comment in `orders.py` anticipates a future "business ownership transfer" feature that doesn't exist yet; when it's built, `_owned_order`'s frozen per-order `owner_user_id` vs. `_owned_business`'s live one will disagree — noting so it isn't a surprise later.

---

## Verified clean

- **Bilingual completeness (mechanical, not spot-checked):** every `t()` call in the 8 new orders-feature files — including dynamic keys like `` t(`orders.status.${s}`) `` — resolves to a real key in **both** `en.js` and `he.js`; all such dynamic calls also carry a safe string fallback as the second argument. The only cross-file key gap found anywhere in the two locale files is 8 Hebrew-only `_two` plural-form keys (a legitimate Hebrew grammar category English doesn't need) — not a bug.
- **RTL:** no inline `fontFamily: 'Playfair Display'` anywhere in the new files (all use `var(--font-head)`); no physical CSS properties in new inline styles or CSS; free text gets `dir="auto"`, phone numbers get `dir="ltr"`, consistently.
- **Design-system drift:** every `var(--…)` used in the new files resolves to a real definition; no use of the reserved shadcn names (`--primary`/`--border`/`--muted`); green used only for functional status, never as a generic accent; no hardcoded hex in new/changed code.
- **Invented numbers:** none found — every count/total in the new UI traces to a real query or a real order field; a "money strip" component explicitly renders nothing rather than a fabricated figure when no order carries a total.
- **IDOR on the core orders/business/courier endpoints:** every owner-facing route checks `_owned_business`/`_owned_order`; the staff-link token is scoped to its own business at the query level (confirmed against `test_stranger_cannot_read_or_make_the_link`); courier actions are scoped to the courier's own assignment at the query level (confirmed against `test_other_account_sees_nothing`).
- **Client-side price is display-only:** `OrderPage.jsx` computes a total for display, but never sends it — the backend recomputes price authoritatively from its own product catalog on every order.
- **Contract public-mount regression (the repeat-three-times bug class):** confirmed fully fixed. The only static mount in the backend is `/api/uploads` → `UPLOAD_DIR`, a sibling of (never nested under) `private_contracts`; every contract-serving route resolves through the same basename-only, traversal-safe helper rooted at `private_contracts`.
- **Signature capture:** current code draws in a real resolved ink color (not a raw unresolved CSS variable string), the resize-observer fix is present with cleanup, and contract terms shown to a signer come from the actual uploaded document's extracted text, not a hardcoded template.
- **Whole-backend `py_compile`** and a plain **`npm run build`** (frontend production build) both succeed cleanly.
- **Standing-order double-generation:** protected by a genuine DB-level unique index on `(standing_id, occurrence_date)` — this one is done correctly, unlike the status-transition race noted above.
- **Two new standalone `scroll-craft` business pages** (`michal-simkin`, `blazin-boards`): no invented statistics (the only large numbers found are genuine customer-quote testimonials), no referenced-but-missing image assets, and — confirmed by grep — neither is linked from anywhere in the live app (`App.js`, `backend/`), so they carry none of this app's bilingual/RTL/design-token obligations; they're standalone marketing pages, not a live surface.

## Not checked

- **The five new `test_store_orders*.py` files were not executed.** They require a running local backend against a local MongoDB plus `tests/.env.test` (gitignored) — neither exists in this sandbox. Read in full instead; they look well-targeted at the ownership/isolation properties above, but "the tests exist and read well" isn't the same as "the tests pass." Worth an explicit CI/local run before this ships further.
- **No screenshots taken** — this pass was a code read, not a rendered-page visual/accessibility pass (no running backend to point a browser at in this sandbox). The RTL/design-token checks above are static-analysis confirmations (source resolves to real values/logical properties), not a rendered comparison against the mockups.
- **Performance** (N+1 queries, image sizing, indexes beyond the two called out above) not reviewed this pass — the priority given the size of the diff was security and truthfulness first.
- **Everything outside the `d91d86a..HEAD` diff** — this was a targeted audit of what's new, not a re-audit of the whole app (which the existing dated UI-audit files in this same folder already cover through 2026-09-06).
