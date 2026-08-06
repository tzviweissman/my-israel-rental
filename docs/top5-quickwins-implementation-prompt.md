# Implementation Prompt — Quick Wins (6 tasks)

Paste this to a coding agent working in the MyIsraelRental repo. It covers the highest-ROI quick wins from the UX & monetization review. Read `CLAUDE.md` first and follow its guardrails (look for existing code before adding new modules, don't regress contract storage, don't touch secrets, confirm before anything that spends API credit or deploys).

---

## Context

MyIsraelRental is a rental + services marketplace for Israel. FastAPI backend (`backend/`) + React/CRA frontend (`frontend/`), MongoDB Atlas, deployed on Railway. The **apartments section is free for renters**; **service providers pay a subscription**. Audience is heavily English-speaking olim. i18n uses `frontend/src/locales/` (`en.js`, `he.js`) with working RTL — **every user-facing string you add must go through the existing translation system in both `en` and `he`, never hardcoded**.

Work in small, reviewable commits — ideally one per task below. Before editing, grep the referenced files to confirm current structure (line numbers may have drifted). Do not deploy; leave that to me.

---

## Task 1 — Apartments → Services cross-sell banner (Services · high impact)

**Goal:** inject the free apartment traffic (people mid-move) as demand into the paid services section.

- Add a lightweight banner/card that appears at high-intent rental moments: on the property detail page (`frontend/src/pages/PropertyDetail.js`, near the contact/booking sidebar) and on a successful booking request / enquiry confirmation.
- Copy (translated): e.g. *"Moving in? Find verified movers, cleaners & handymen in Israel"* with a button linking to the Services page (`/services`), ideally pre-filtered to relevant categories (movers, cleaners, handyman) and the property's city if available.
- Reuse existing card/button components and styling. Make it dismissible; don't block the rental flow.
- Add the strings to `locales/en.js` and `locales/he.js`.

**Acceptance:** banner renders on property detail + booking confirmation, links into `/services` with a category filter, is translated, and is dismissible.

---

## Task 2 — WhatsApp-click tracking redirect (Services · high impact)

**Goal:** make provider leads countable so we can prove ROI (prerequisite for the provider analytics dashboard).

- Today, service inquiries deep-link straight to WhatsApp (`booking_mode` default `"whatsapp"` in `backend/routes/marketplace/shared.py`). Add a tracked redirect endpoint, e.g. `GET /marketplace/gigs/{gig_id}/contact`:
  - Look up the gig, record a lead event (new `lead_events` collection or equivalent) with `gig_id`, `provider_id`, `type: "whatsapp_click"`, `timestamp`, and coarse referrer/renter info if available (no PII beyond what we already store).
  - Then HTTP-redirect (302) to the provider's `wa.me` link with any existing prefilled message.
- Update the frontend gig contact button (`frontend/src/pages/GigDetail.jsx` and anywhere else the WhatsApp CTA appears) to hit this endpoint instead of linking to `wa.me` directly.
- Keep it resilient: if logging fails, still redirect — never block the lead.

**Acceptance:** clicking "Contact on WhatsApp" logs a lead event and lands the user in WhatsApp with the prefilled message. Events are queryable per gig/provider (this feeds the future dashboard).

---

## Task 3 — Sort controls + "listed N days ago" on rentals (Rentals · high impact)

**Goal:** two missing basics that matter in a fast-moving market where good listings vanish in hours.

**3a. Sort control.**
- Add a sort dropdown to the Stays surface (`frontend/src/pages/Stays.jsx`): Newest, Price ↑, Price ↓, Nearest (only when a proximity/address search is active). Stays already filters listings in memory, so implement client-side sorting on the current result set.
- Sync the chosen sort to the URL like the existing filters, so it's shareable/refreshable.
- If straightforward, apply the same sort to the legacy `frontend/src/pages/Properties.js` surface (server-paginated) via a `sort` query param on the listings endpoint; if it's more than a small change, note it and leave a TODO rather than doing a large refactor.

**3b. "Listed N days ago" freshness stamp.**
- The listings model has `created_at` but it's currently excluded from the list projection. Re-add `created_at` (or a derived `days_since_listed`) to the listings list response in the backend.
- Render a subtle "Listed today / N days ago" stamp on `StaysCard` and `PropertyCard`.
- Add translated strings for the relative-time labels.

**Acceptance:** users can sort results (sort persists in URL); every listing card shows how recently it was listed.

---

## Task 4 — Competitive commitment-based pricing, in USD with a shekel reference (Services · high impact)

**Goal:** undercut the main competitor at every commitment level while keeping the familiar "longer term = cheaper monthly" ladder. **Keep prices in USD** (the audience is largely American), but show an **approximate shekel amount** next to each price, computed live — never hardcoded.

Competitor charges 3mo=$45/mo, 6mo=$40/mo, 12mo=$35/mo. Use this competitive ladder (~$10 under them at each tier):

| Plan | Price | Label |
|---|---|---|
| **12 months** | **$25/mo** | "Best value" (headline / default-selected) |
| **6 months** | **$30/mo** | |
| **3 months** | **$35/mo** | |

- In `backend/routes/marketplace/shared.py`, the current price is `SUBSCRIPTION_PRICE = 25.00` (USD). Refactor to support these three duration-based plans (keep USD). The $25/mo 12-month plan is the new default/headline.
- Wire the plans into the PayPal setup in `backend/routes/marketplace/subscription.py`. **Confirm with me before creating/altering live PayPal plans or products** — this touches real billing. Prefer creating new plan IDs over mutating existing ones; keep existing subscribers on their current plan.
- **Shekel reference:** beside each USD price, render a lighter-weight "≈ ₪X/mo" using the app's existing live USD/ILS FX conversion (the rentals side already does ILS/USD FX — reuse that source; do not hardcode a rate). Add a small "approx." qualifier so it's clearly indicative, not a billed amount.
- Update all displayed prices in the frontend: `frontend/src/components/ServicesUpsellModal.jsx`, the provider dashboard (`frontend/src/components/dashboard/MyGigsTab.jsx`), and any pricing page — show the three plans, USD primary with ≈₪ secondary, 12-month preselected and badged "Best value."
- Add/adjust translated strings (labels, "Best value", "approx.").

> Note: a free/starter tier and the Verified badge are a larger, separate effort — this task only sets the competitive USD ladder + shekel reference. Leave a TODO pointing at that future work.

**Acceptance:** new sign-ups see three USD plans (12mo $25 / 6mo $30 / 3mo $35) with an approximate live-FX shekel figure beside each, 12-month preselected; existing subscribers are unaffected; no live PayPal plan is created without my go-ahead.

---

## Task 5 — "Free for renters" trust/positioning banner (Rentals · high impact)

**Goal:** a trust/positioning wedge against Yad2 and Facebook groups — **without claiming "no agent fees."** The platform not charging a fee does not mean the property manager/owner won't, so we must not imply fee-free renting.

- Add a prominent but tasteful trust banner/strip on the Home page (`frontend/src/pages/Home.js`) and the Stays results header (`frontend/src/pages/Stays.jsx`) using **accurate** messaging. Pick from (or A/B):
  - *"Free to search and contact — built for English-speaking olim."*
  - *"Browse in English. Contact owners directly. No cost to renters to use the platform."*
  - *"Search Israel's rentals in English — free to use."*
- Keep the claim strictly about **our platform being free to use for renters** and the English-first / direct-contact experience. Do **not** add any "no agent fee" / "no key money" / "no broker fee" copy or chips.
- If a listing already exposes fee fields (agent/cleaning fees), display them **transparently and factually** where they exist (so renters see real costs upfront) — but do not editorialize them as "none" when absent; simply omit.
- Add translated strings (`en` + `he`).

**Acceptance:** an accurate "free to use for renters / English-first" message appears on Home and Stays; no copy anywhere claims the absence of agent, broker, or key-money fees; any existing fee fields are shown factually.

---

## Task 6 — "What you get with MyIsraelRental" value page (Services · high impact)

**Goal:** a dedicated benefits/value page so prospective service providers feel the subscription is a worthy investment before they hit the pricing choice. This is the "why pay" landing page that sits in front of (or links tightly to) the plan selection.

- Create a new page/route, e.g. `frontend/src/pages/WhyList.jsx` (route `/why-list` or `/for-providers`), reachable from the services area, the homepage "list your service" CTA, and the top of the plan-selection screen.
- Structure it as a benefits-led sales page (all copy translated `en` + `he`):
  - **Hero:** a clear value line — e.g. *"Get found by English-speaking renters and olim across Israel"* — with a primary CTA to start listing.
  - **Benefit blocks** (reuse existing card components), leading with the things that most drive willingness-to-pay (from the research):
    1. **Reach high-intent customers** — people actively renting/moving in Israel who need movers, cleaners, handymen, etc., at the exact moment of need.
    2. **Qualified leads** — inbound inquiries + the jobs board where renters post what they need and you bid.
    3. **A professional bilingual profile** — your services shown in English *and* Hebrew automatically, SEO-indexed.
    4. **Reputation you own** — verified, transaction-tied reviews and Top-Rated / fast-response badges.
    5. **Booking & availability tools** — appointment slots, WhatsApp contact, a simple lead flow.
    6. *(Roadmap, label as "coming soon" only if not yet built)* — a leads/views dashboard and a Verified badge.
  - **Social proof:** placeholder slots for provider count, testimonials, and lead-count stats (wire real numbers where available; otherwise leave clearly-marked placeholders, don't invent figures).
  - **Comparison/positioning:** briefly why this beats relying on scattered WhatsApp groups / Facebook (targeted, trusted, English-friendly). Do **not** disparage or name the specific competitor.
  - **Pricing summary + CTA:** show the three USD plans (with ≈₪ from Task 4) and a prominent "Start listing" button; note the existing free trial.
  - **Short FAQ:** how billing works, can you cancel, how leads reach you, English/Hebrew support.
- Keep it consistent with existing branding/components and mobile-friendly (RTL verified for Hebrew).
- Only claim features that actually exist today; mark anything on the roadmap as such. No invented metrics or guarantees.

**Acceptance:** a translated, mobile-friendly value page exists at its own route, linked from the provider CTAs and the plan-selection screen, leading with real benefits and ending in a clear "start listing" CTA with the Task 4 pricing; no fabricated stats or unbuilt features presented as live.

---

## General requirements for all tasks

- Reuse existing components, styling, and the i18n system; match current code conventions.
- No hardcoded user-facing strings — add to `locales/en.js` and `locales/he.js`, verify RTL still looks right.
- Don't regress contract file storage or touch anything under the "hard rules" in `CLAUDE.md`.
- For anything that spends real API credit, writes to production Atlas, or alters live PayPal plans (Task 4), pause and confirm with me first; a dry run is preferred.
- Add a short note to `docs/` (or code comments) for any non-obvious decision or platform quirk you hit.
- Provide a brief summary of what changed per task and how to test it locally.
