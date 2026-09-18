# Implementation prompt — Business Network layer (Connections + Automations + Supplier Compare)

Paste everything below this line into Claude Code (or any coding agent) from the repo root.

---

## 0. Read first

Read `CLAUDE.md` in full before touching anything. It is binding. In particular: reuse existing code before adding new modules; never print secrets; the design system is locked (use tokens from `frontend/src/styles/theme-flow.css` / `brand/design-tokens.css`, `fontFamily: 'var(--font-head)'`, black primary buttons, blue accent, green only for status); every page must work LTR **and** RTL with Hebrew copy; verify UI with `scripts/screenshot.mjs`; never make Tzvi sign in — use `?as=owner` / `?as=provider` local auto-login; confirm before anything that writes to production Atlas, pushes, or deploys.

Also read `docs/orders-and-delivery-spec.md`, `docs/business-page-spec.md`, `docs/multi-business-spec.md`, and `docs/marketplace-benchmark-spec.md` — the new work extends those.

Branding stays **MyIsraelRental** for now. Do not rename anything, do not change the home page, nav ordering, or positioning copy. This is a feature addition on the same foundation.

## 1. The goal (what we're building and why)

MyIsraelRental already has: business profiles (`routes/marketplace/businesses.py`, `pages/BusinessPage.jsx`), a services marketplace with gigs/listings that carry prices and reviews (`gigs.py`, `db.marketplace_gigs`, `db.marketplace_reviews`), a demand board (`requests.py`, `db.requests`), store orders with status flow + couriers + weekly standing orders (`orders.py`, `db.store_orders`, `db.store_standing_orders`, `businesses.couriers[]`), chat (`routes/chat.py`, `pages/Chat.js`), in-app notifications (`routes/notifications.py`, `db.notifications`), email/WhatsApp utils, and PayPal payments.

We are turning this into a **business-to-business network** on top of that foundation. Three capabilities:

1. **Connections** — any business can find another business on the site and send a *connect request*. Once accepted, the two are *partners*. Partners appear in each other's dashboard, can chat, and can attach automations to the relationship. (This generalises the existing shop→courier invite, which is today a one-off special case stored as `businesses.couriers[]`.)
2. **Automations** — a business can define rules of the form *trigger → action* that run between partners without a human doing the handoff. Example (the canonical one): a shop marks an order `ready` → an order/task is automatically created for its connected delivery partner → if the partner has pre-approved that shop, it's auto-accepted and just appears in their queue.
3. **Supplier Compare** — a business looking for a supplier/partner can shortlist several and see them side-by-side on price, rating, review count, response time, distance, and languages, then send a connect request or order from that view.

Together this is the "shop ↔ delivery guy" relationship made general: find → compare → connect → automate.

## 2. Product decisions already made (do not re-open)

- **Connections are mutual**: request + accept, LinkedIn-style. A pending request carries an optional note. Either side can disconnect later. Only *accepted* connections can have automations attached.
- **Connections are between businesses**, not users. A user who owns several businesses (see `docs/multi-business-spec.md`) acts on behalf of one business at a time. Solo providers count as businesses (they already get a default business — see `GET /providers/{user_id}/default-business`).
- **Triggers in v1** (all four):
  1. `order.status_changed` — a store order moves to a given status (statuses are `new | preparing | ready | done | cancelled | failed`, transitions in `orders.py:_TRANSITIONS`).
  2. `schedule` — recurring (weekly weekday+time first; daily as a stretch). Extend the existing `store_standing_orders` concept rather than inventing a second scheduler.
  3. `request.posted_matching` — a new request on the board matches my category and area.
  4. `manual.reorder` — a one-tap "Reorder from partner" using a saved template (no inventory tracking; a saved order body + quantities).
- **Actions in v1** (both):
  1. `create_partner_order` — create a `store_orders` document *for the partner business* (the partner is the fulfiller), linked back to the source order/request/template. It shows up in the partner's Orders / StaffOrders dashboard as incoming.
  2. `auto_accept` — a partner-side setting: "auto-accept orders from business X" with an optional cap (max amount, max per day). If set, the created order skips `new` and lands as `preparing` (or whatever the partner configured), with no human click. If not set, it lands as `new` and the partner accepts or declines.
  - Every action also writes a `db.notifications` entry for the receiving business's owner, and reuses the existing email/WhatsApp notification utilities the orders flow already calls. Don't build a new notification channel.
- **Compare** is a UI on top of data that already exists. `GET /marketplace/gigs` already supports `min_rating`, `min_price`, `max_price`, `sort=rating|price_asc|reviews|distance` and returns `rating_avg`, `rating_count`, `cheapest_price`. `businesses.py` has `business_rating()`. Do not add a second ratings system.
- **Safety rails**: an automation can only target a business the source business is connected to; auto-accept can only be granted by the receiving business for a specific source business; every automated action is logged so a business can see *why* an order appeared.

## 3. What to build — backend

All under `backend/routes/marketplace/`, registered in `routes/marketplace/__init__.py`, same `/marketplace` prefix and `["marketplace"]` tag. Keep Pydantic models in `shared.py` unless a module gets long, matching the current split.

### 3.1 Connections — new module `connections.py`

Collection `db.business_connections`. One document per pair, ordered so `(a_id, b_id)` is unique regardless of who asked (store the sorted pair plus `requested_by`).

```
{
  _id, a_id, b_id,                # sorted pair of business ids
  requested_by: business_id,
  status: "pending" | "accepted" | "declined" | "disconnected",
  note: str | None,
  relationship: "supplier" | "customer" | "courier" | "partner" | None,   # optional label, set by requester, editable by both
  created_at, responded_at, updated_at
}
```

Endpoints:

- `GET  /businesses/{business_id}/connections?status=` — my connections + pending in/out, each hydrated with the other business's public card (name, slug, logo, categories, area, rating via `business_rating`).
- `POST /businesses/{business_id}/connections` `{target_business_id, note?, relationship?}` — send request. Idempotent: re-sending to a pending/accepted pair returns the existing doc. Rate-limit with the existing `utils/rate_limit.py`.
- `POST /connections/{id}/accept`, `POST /connections/{id}/decline`, `POST /connections/{id}/disconnect` — only the appropriate side may call each; disconnect also pauses every automation on the pair.
- `GET  /businesses/{business_id}/connections/{other_id}` — status between two businesses (the button state on a BusinessPage).

Migration: write a **dry-run-first** script in `backend/scripts/` that turns every existing `businesses.couriers[]` entry with `status: "active"` into an accepted connection with `relationship: "courier"`. Keep the old array in place; the courier endpoints keep working unchanged in v1. Print counts, do not write without `--apply`, and do not run it against Atlas without confirming.

Authorization: reuse `verify_token` and the existing "does this user own this business" helper in `businesses.py` (find it; don't write a new one). Admin can see all.

### 3.2 Automations — new module `automations.py`

Collection `db.business_automations`:

```
{
  _id, business_id,                       # owner of the rule (the source side)
  partner_business_id,                    # must be an accepted connection
  name: str,
  enabled: bool,
  trigger: {
    type: "order.status_changed" | "schedule" | "request.posted_matching" | "manual.reorder",
    # per type:
    status: "ready",                      # order.status_changed
    weekday: 0-6, time: "08:00", tz: "Asia/Jerusalem",   # schedule
    categories: [..], areas: [..],        # request.posted_matching
  },
  action: {
    type: "create_partner_order",
    template: { items: [...], notes: str, fulfilment: "delivery"|"pickup", copy_from_source: bool }
  },
  last_run_at, run_count, created_at, updated_at
}
```

Collection `db.automation_runs` (the audit log): `{ _id, automation_id, business_id, partner_business_id, trigger_event: {...}, result: "created"|"auto_accepted"|"skipped"|"failed", created_order_id?, error?, created_at }`.

Partner-side setting, stored on the receiving business document (not a new collection): `businesses.auto_accept_from: [{ business_id, max_amount?, max_per_day?, land_in_status: "preparing" }]`, edited via `PUT /businesses/{id}/orders/settings` (extend the existing settings endpoint rather than adding one).

Endpoints:

- `GET/POST /businesses/{business_id}/automations`, `PATCH/DELETE /automations/{id}`, `POST /automations/{id}/run` (manual trigger — this *is* the `manual.reorder` button), `GET /businesses/{business_id}/automations/runs?limit=`.

Engine — one internal function, not an endpoint: `async def fire(trigger_type, event: dict)` in `automations.py` that:
1. loads enabled rules matching the trigger,
2. checks the connection is still `accepted`,
3. builds the partner order from the template (and the source order when `copy_from_source`),
4. inserts into `db.store_orders` with `source: {kind: "automation", automation_id, source_order_id?}` and `business_id = partner_business_id`, `placed_by_business_id = business_id`,
5. applies auto-accept if the partner's `auto_accept_from` matches and caps pass,
6. writes `automation_runs`, `notifications`, and calls the same notify helpers the orders module uses,
7. never raises into the caller — log and record `failed`.

Hook points (minimal, surgical):
- In `orders.py` status transition (the `PATCH /orders/{id}/status` path and the courier/staff status paths — find the single place they converge or the small set of them) → `await fire("order.status_changed", {...})` *after* the write succeeds. Guard against loops: an order whose `source.kind == "automation"` does not re-fire `create_partner_order` toward the business that created it.
- In `requests.py` `POST /requests` → `fire("request.posted_matching", ...)` after insert.
- Scheduler: add one asyncio loop registered in `server.py` startup next to the existing loops (`requests_lifecycle_daily_loop` etc.), running every minute, that fires `schedule` rules whose next-run is due. Compute next-run in `Asia/Jerusalem`. Look at how `store_standing_orders` are currently executed and either reuse that loop or fold standing orders into this one — do not leave two schedulers doing the same thing.

Guard costs: none of this calls the Anthropic API. Email/WhatsApp sends go through the existing helpers, which already rate-limit.

### 3.3 Compare — small additions, mostly reuse

- `GET /marketplace/gigs` already returns what we need. Add a `GET /marketplace/compare?ids=a,b,c` that returns up to 6 gigs *or* businesses (detect by collection) hydrated with: `cheapest_price`, `rating_avg`, `rating_count`, `response_time_bucket` (reuse whatever the browse endpoint computes), `distance_km` when the caller passes `lat,lng`, `languages`, `areas`, `connection_status` relative to the caller's business, and `verified`.
- Nothing else server-side.

## 4. What to build — frontend

Follow `myisraelrental-frontend` skill rules and the dashboard shell in `docs/dashboard-shell.md`. Every string bilingual (EN/HE), every page checked in RTL.

1. **Network tab in the dashboard** (`pages/Dashboard.js` — add a tab, don't add a new top-level nav item): three sub-views — *Partners* (accepted, with relationship label, chat button, "automations" count), *Requests* (incoming/outgoing pending with accept/decline), *Find partners* (search businesses/gigs with the existing filters + a "Compare" checkbox per card).
2. **Connect button on `BusinessPage.jsx`**: states = Connect / Requested / Connected (with Message + Disconnect) / Accept request. Uses the `connections/{other_id}` status endpoint. Hidden when viewing your own business.
3. **Compare view** `pages/CompareSuppliers.jsx` at `/compare?ids=`: a side-by-side table (columns = suppliers, rows = price, rating, reviews, response time, distance, languages, verified, connection status), sticky first column, horizontal scroll on mobile, each column has "Connect" and "Order" / "Message" CTAs. Reads from `GET /marketplace/compare`. Shortlist state lives in `sessionStorage` under one key so the "Compare (3)" pill in the browse views can drive it.
4. **Automations page** `pages/Automations.jsx` (dashboard sub-route): list + a single-screen builder: pick partner → pick trigger (4 cards) → configure trigger → configure order template → enable. Plus a "Runs" log table. Plus, on the partner's side, an **Auto-accept** section inside the existing Orders settings UI: toggle per connected business with the two caps.
5. **Orders dashboard**: incoming automated orders show a small "via automation · from {business}" chip and a link to the run log entry. Reuse the existing order card.
6. **Reorder button**: on any past order placed *to* a partner, "Repeat this order" → creates/reuses a `manual.reorder` automation with that order as the template and runs it once.

## 5. The smartest way to implement it (order of work)

Work in phases; each phase ships independently, has its own screenshot proof, and is a separate PR/commit. Do not start phase N+1 until phase N passes its checks.

**Phase 0 — spec + migration plan (½ day).** Write `docs/business-network-spec.md` from this prompt, adapted to what you find in the code (correct helper names, real status hooks, real settings endpoint shape). Write the courier→connection migration script with `--dry-run` default. Run it dry against local Mongo and paste the counts into the spec.

**Phase 1 — Connections (backend + Network tab + Connect button).** This is the foundation; automations reference it. Tests in `backend/tests/` for: request/accept/decline/disconnect, idempotent resend, cannot connect to self, cannot act on someone else's connection, courier migration produces accepted connections.

**Phase 2 — Automations engine + `order.status_changed` + `manual.reorder` + auto-accept.** Do these two triggers first because they need no scheduler and they *are* the shop→courier story. Tests: rule fires on status transition, does not fire when connection is not accepted, does not loop, auto-accept caps enforced, run log written on success and failure.

**Phase 3 — `schedule` + `request.posted_matching`.** Fold in with standing orders; one scheduler loop. Tests around next-run computation in Asia/Jerusalem and DST.

**Phase 4 — Compare.** Endpoint + page + "Compare" pills in browse views.

**Phase 5 — polish.** Bilingual QA in RTL, screenshot diffs, `docs/acceptance-checklist.md` entries, update `CLAUDE.md` "What this is" paragraph to mention Connections/Automations in one sentence (ask before editing `CLAUDE.md`).

Principles while doing it:
- **Reuse over rebuild.** Chat, notifications, orders, standing orders, ratings, business ownership checks, rate limiting, email/WhatsApp — all exist. If you think you need a new one, grep first and say why the existing one won't do.
- **Extend documents, don't add collections, when the data belongs to an existing entity** (auto-accept lives on `businesses`; automated orders are normal `store_orders` with a `source` field).
- **One engine function, thin hooks.** All automation logic in `automations.fire()`; the hooks in `orders.py`/`requests.py` are one line each.
- **Make every automated effect explainable**: the run log is not optional, and every created order carries `source`.
- **No new external integrations in v1.** Webhooks/POS/inventory are explicitly out of scope; leave a `trigger.type` enum that can grow.
- **Dry-run anything that touches existing data.**

## 6. Definition of done (per phase, report against this)

- Endpoints documented in the spec with request/response examples; `pytest` green.
- Screenshots (LTR + RTL, desktop + 390px mobile) of every new/changed screen, taken with `scripts/screenshot.mjs`, attached to the report.
- No hardcoded hex/spacing in new components; headings use `var(--font-head)`.
- No secrets printed. No writes to Atlas. No push/deploy without asking.
- A short written summary: what was built, what was reused, what was deliberately left out, and anything you learned that belongs in `CLAUDE.md` or `docs/failure-patterns.md`.

## 7. Shopify-inspired improvements (build after Phase 5, in this order)

These borrow the Shopify admin philosophy — *tell the owner what to do next, then let them do it in one tap* — and the Shop-app customer experience. Every item below reuses data or utilities that already exist; none needs a new external integration. Same rules apply: reuse first, bilingual/RTL, tokens only, screenshot proof, tests.

### 7.1 Dashboard (business-owner side)

**A. "Today" home screen (Pulse).** Replace the dashboard's landing view with a prioritised list of 3–6 concrete next actions, each a one-tap deep link. Compute server-side in a new `GET /businesses/{business_id}/pulse` (put it in `businesses.py` or a small `pulse.py` — don't scatter the queries). Sources, all existing collections:
- open `requests` matching the business's categories/areas with no reply from this business (reuse the matching logic from `requests.py` / the digest loop),
- `store_orders` stuck in `new` or `preparing` longer than a threshold (default 2h, configurable in orders settings),
- listings (`marketplace_gigs`, `properties`) with no photo, no price, or stale availability,
- `marketplace_reviews` on my gigs with no business reply (needs 7.1-F below),
- pending connection requests and failed automation runs (from Phases 1–2),
- onboarding checklist incomplete (7.1-B).
Return `{items: [{kind, title_en, title_he, count, href, severity}]}`, sorted by severity then count. Frontend: a card list at the top of `Dashboard.js`; empty state "You're all caught up". Cache per business for 5 minutes.

**B. Setup guide with progress.** Turn `docs/onboarding-tutorial-spec.md` into a persistent checklist card (add business details, add first listing, add photos, set areas, connect payments, set hours/languages, invite staff/courier, create first automation). Store completion as derived state — compute from data, don't store booleans that drift. Show a % bar; hide the card at 100% (with a "show again" link in settings).

**C. Order timeline + private notes.** Add `timeline: [{at, kind, actor, text}]` entries to `store_orders` written on every status change, courier assignment, automation creation, and customer notification sent. Add `POST /orders/{id}/notes` for private staff/owner notes (never shown on the customer track page). Render a vertical timeline on `OrderPage.jsx` and `StaffOrdersPage.jsx`. This is also the human-readable view of the automation run log — link the two.

**D. Customer profiles & segments.** Extend `db.store_customers` with `tags: [str]`, `order_count`, `last_order_at`, `total_spent` (maintained on order create/status `done`; write a dry-run backfill script). Add filters to `GET /businesses/{id}/customers` (`tag=`, `ordered_since=`, `min_orders=`) and a "Message this segment" action that opens the existing chat/WhatsApp helper for the selected set, rate-limited.

**E. Analytics annotations + targets.** On the existing views/leads analytics (`docs/leads-and-views-spec.md`, `utils/view_tracking.py`, `db.lead_events`): add a weekly "what changed" sentence computed by rule, not LLM (e.g. "Leads down 30% vs last week; your top listing had no availability for 4 days"), and one optional target per business (`leads_per_week_target`) drawn as a line on the chart. Keep to the `dataviz` skill and the locked palette.

**F. Business replies to reviews + verified badge.** Add `reply: {text, at}` on `marketplace_reviews`, `POST /gigs/{gig_id}/reviews/{review_id}/reply` (business owner only, one reply, editable). Add `verified: bool` set at review creation when the reviewer has a completed `marketplace_bookings` or `store_orders` document with that business. Show the badge and the reply on `GigDetail.jsx` and `BusinessPage.jsx`.

**G. Staff roles.** Formalise the existing staff-link token into named staff on the business document: `staff: [{user_id|email, role: "orders" | "manager", invited_at, status}]`. `orders` = orders/StaffOrders only; `manager` = everything except payments/settings/delete. Reuse the courier invite/accept pattern from `orders.py` (and the Connections pattern from Phase 1) — do not write a third invite flow.

**H. Automation recipes.** For the automations builder (Phase 2–3), ship a template library the business enables with one tap instead of starting from an empty form: "When order is ready → send to my courier", "Every Sunday 08:00 → reorder from supplier", "New request in my category → notify me instantly", "Order not accepted in 30 min → remind me", "Customer's 3rd order → tag as repeat", "Automated order failed → notify owner". Store as static JSON in the backend (`automations_recipes.py`), render as cards; enabling a recipe creates a normal automation document pre-filled.

**I. Assistant in the admin (Sidekick-style) — last, and gated.** A chat box on dashboard screens that can perform a small, fixed set of actions using the existing Anthropic client in `utils/llm.py`: draft a reply to a request, translate a listing (reuse `utils/translate.py`), create a standing order / automation from plain language, summarise this week's orders. Implement as tool-use with explicit confirmation before any write. Hard caps: per-business daily call limit, token ceiling, feature flag `ADMIN_ASSISTANT_ENABLED` default off. Confirm with Tzvi before enabling anywhere — this spends real API credit.

### 7.2 Customer-facing side

**J. Proactive order status notifications.** On every `store_orders` status transition (the same hook point automations use), send the customer a WhatsApp/email update using the existing utilities (`utils/whatsapp.py`, `utils/email.py`), with a per-business toggle in orders settings and per-status templates the business can edit (EN/HE) with placeholders `{customer_name}`, `{order_id}`, `{track_link}`, `{business_name}`. Default templates provided. Log each send to the order timeline (7.1-C).

**K. Saved details + "Order again".** For signed-in customers, remember address/phone/preferred fulfilment on their user document (explicit opt-in checkbox at order time) and prefill the order form. On `/orders/mine` and `OrderTrackPage.jsx`, add "Order again" which re-creates the order with the same items (this is the customer-side twin of the `manual.reorder` automation — share the template code).

**L. Follow a business.** Consumer-side counterpart of Connections: `db.business_followers {business_id, user_id, created_at}`; a Follow button on `BusinessPage.jsx`; a notification when a followed business posts a new offer (`docs/business-offers.md`) or new listing. Business sees follower count on the dashboard. Keep it separate from `business_connections` — followers are users, connections are businesses.

**M. Automatic discounts.** Extend `business-offers.md` offers with `auto_apply: true` and conditions (`first_order`, `min_amount`, `returning_customer`). Apply at order creation without a code; show the applied discount on the order and the track page. Codes remain optional.

**N. Abandoned-inquiry recovery.** When a user starts a request/booking/order form and abandons it (draft saved client-side + a `POST .../draft` endpoint that stores it with `status: "draft"`), send one reminder 24h later via the existing email helper with a resume link; never more than one per draft; respect the existing email opt-outs (`requests/emails/opt-out`, `JobsEmailsOff`). Add to the existing daily loops in `server.py` — no new scheduler.

**O. AI first-reply in chat — gated, later.** In `routes/chat.py`, when a business has opted in, answer a customer's first message from the business page's own data (hours, areas, languages, pricing, FAQ) and hand off to the owner when confidence is low or the customer asks for a human. Same caps and feature flag discipline as 7.1-I; the owner always sees the auto-reply in the thread, marked as automated.

### 7.3 Order of work for section 7

Phase 6: **A (Pulse), J (status notifications), F (verified reviews + replies)** — highest impact, pure reuse.
Phase 7: **B, C, K, H**.
Phase 8: **D, E, G, L, M, N**.
Phase 9 (only after explicit go-ahead): **I, O** — the two LLM features.

Each phase: spec section added to `docs/business-network-spec.md` (or a new `docs/dashboard-pulse-spec.md` for A), tests, LTR+RTL screenshots, and the same definition of done as section 6.

## 8. Open questions — ask before assuming

- Where do the existing standing orders actually execute today (is there a loop, or are they only displayed)? Decide reuse vs. fold-in after reading it, and say which you chose.
- The exact "user owns business" helper name and the exact place status transitions converge in `orders.py` — find and name them in the Phase 0 spec.
- Whether `response_time_bucket` is computed anywhere today or only displayed; if only displayed, compute it once in `shared.py` and reuse.
