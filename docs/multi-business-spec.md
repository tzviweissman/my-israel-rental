# Multiple businesses per user

Written against the code as it stands (read 16 Aug 2026): `backend/routes/marketplace/providers.py`, `gigs.py`, `shared.py`, and `frontend/src/components/dashboard/DashboardTabs.jsx`.

## The decision

**One account, one dashboard. A switcher for *businesses*, not for *roles*.**

Roles are not mutually exclusive and people don't think in them — a manager with a side AC-repair business logs in to check messages, not to "become a provider." Messages, bookings and requests are shared, so a role switch would hide unread items behind a toggle. Businesses, by contrast, are genuinely separate entities: own name, logo, categories, service area, reviews and verification.

Deferred deliberately: an Airbnb-style mode switch. Revisit only if someone has heavy volume on both sides, and then make it *filter* the single dashboard rather than become a second app.

---

## The constraint in the current code

- `db.marketplace_providers` is keyed **one record per `user_id`** (`providers.py:102`, `:156`; `_ensure_provider_record(user_id)` at `:140`). One person = one provider, structurally.
- The public provider page is **`/providers/{user_id}`** (`providers.py:100`) — the URL identifies the person, not the business.
- The provider's display name falls back to **`users.name`** (`providers.py:122`). Today a business is literally a person's name.
- Gigs carry both `provider_user_id` and `provider_id` (`gigs.py:305–306`) and every ownership check is `gig["provider_user_id"] != user["user_id"]` (`:419`, `:514`, `:590`).
- Ratings already aggregate **per gig** (`_batch_rating_aggregate` over gig ids, `providers.py:108–117`) — helpful: reviews are not currently attached to the person, so separating them per business is less invasive than expected.
- Subscription/trial fields live on the provider record (`subscription_status`, `trial_ends_at`, `providers.py:49`).

---

## Target model

```
User (one login, one identity)
├── Properties            → unchanged
├── Businesses (0..n)     → NEW: the multiplicity lives here
│     ├── name / name_he, logo, description
│     ├── categories, service areas
│     ├── gigs
│     ├── reviews + rating aggregate
│     └── verification status
└── Shared                → Messages, Bookings, Requests, Liked, Settings
```

### M1 — `businesses` collection

Fields: `_id`, `owner_user_id`, `name`, `name_he`, `slug`, `logo_url`, `description`, `description_he`, `categories[]`, `areas[]`, `verified` (bool + `verified_at`), `active`, `created_at`, `updated_at`.

Keep `marketplace_providers` as the **per-user** record for anything that is genuinely about the person: subscription/trial state, provider-level settings. Do not duplicate subscription per business — see M6.

### M2 — `business_id` on gigs

Add `business_id` to `marketplace_gigs`, keeping `provider_user_id` as the ownership key so every existing authorisation check keeps working unchanged. `business_id` is for grouping and display only, at first.

### M3 — Migration

For every existing `marketplace_providers` record, create one business:

- `name` ← the provider's current display name, i.e. `users.name` (the current fallback at `providers.py:122`)
- copy categories / areas / description if present
- backfill `business_id` onto that user's gigs

Every current provider ends up with exactly one business, named as they appear today. **Nothing changes for them visually** until they rename it or add a second. Run on the dev database first, report counts, and get approval before Atlas (per CLAUDE.md).

### M4 — Public URLs

- New canonical page: **`/business/{slug}`** (or `/business/{id}`).
- Keep `/providers/{user_id}` working with a **301 to the user's default business** — it is linked from existing gigs and possibly indexed. Do not break it.
- A person with two businesses gets two public pages. There is no public "person" page; that's the point.

### M5 — Reviews and verification are per business

This is the item that matters most and the reason not to defer this work indefinitely:

- Ratings aggregate per business (from its gigs), never per user. A bad review on the moving business must not touch the same person's apartment listings, and a five-star landlord must not read as a five-star plumber.
- **Verification is per business.** Verifying someone owns an apartment says nothing about their trade licence. Store `verified` on the business; the existing user-level verification stays for identity.

### M6 — Subscription stays per user

Providers pay nothing today, so this is mostly vestigial — but do not multiply it per business or someone with three businesses looks like three subscribers. One person, one provider record, one subscription state; businesses inherit it.

### M7 — Dashboard integration

Builds on `docs/dashboard-ux-spec.md` (D2 grouping):

- A **business selector appears only inside the Listings→service tabs and the service Activity tabs** (My Gigs, Work Offers). Never global — an owner with no business must never see it.
- Zero businesses → no selector, and the service tabs stay hidden as they are now (`canPublish`).
- One business → selector collapses to a static label showing the name (no dropdown).
- Two or more → `All businesses ▾ | Cohen Movers | Jerusalem AC Repair`, with "All" as the default so nothing is hidden by accident.
- Selection persists per session; it filters, it never navigates away.
- **Messages threads show which business they concern** — a badge on the thread. Without it, a two-business owner cannot tell which hat a message is about.

### M8 — Managing businesses

A `Businesses` section under Settings (or its own tab once `count > 1`): list, add, edit, deactivate. Deactivating hides its gigs without deleting reviews. Cap at a small number (5?) to prevent someone spamming categories with near-identical shells.

---

## Order of work

1. **M1 + M2 + M3** — collection, `business_id`, migration. Nothing user-visible; everyone keeps exactly one business named as today.
2. **M8** — create/edit/list businesses, so a second one can exist.
3. **M7** — the selector and the Messages badge.
4. **M4** — public `/business/{slug}` pages with the 301.
5. **M5** — move rating aggregation and verification to the business.

Ship 1–3 before 4–5: the internal model can change while the public surface stays still.

## Constraints

- Ownership checks stay on `provider_user_id` throughout step 1–3; do not rewrite authorisation and data model in the same commit.
- i18n for all new strings in **both** `en.js` and `he.js`; business `name_he` uses the bilingual pipeline in `docs/bilingual-and-contact-spec.md`.
- Migration scripts: dev DB first, counts reported, approval before Atlas.
- Verification per `docs/acceptance-checklist.md`, including RTL, for: no business, one business, three businesses, and owner-with-properties-plus-two-businesses.
