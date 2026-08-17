# Dashboard UX — reducing confusion

Written against `frontend/src/components/dashboard/DashboardTabs.jsx` as it stands (read 16 Aug 2026), plus a screenshot of the owner view. Palette and type rules unchanged; this is information architecture, naming and empty states.

---

## What's actually wrong

**1. Four tabs with near-identical names.** The component renders, for a user who is both an owner and a provider:

`My Properties` · `Bulk Manager` · `My Gigs` · `Job Requests` · `My Jobs` · `My requests` · `My Bookings` · `Subleases` · `Messages` · `Alerts` · `Liked` · `Settings`

**Job Requests / My Jobs / My requests / My Bookings** are four different things with three words shared between them. No user can predict what's behind any of them. This is the core problem — worse in the code than in the screenshot, because the screenshot shows a user who hasn't unlocked gigs.

**2. `My Jobs` renders unconditionally** (line 85) — a renter who never touches services still sees it. Every other service tab is gated behind `canPublish`.

**3. Twelve tabs in a horizontally-scrolling strip.** On mobile that's a scroll bar with fade masks (lines 35–36) — tabs beyond the fold are effectively invisible.

**4. Only Messages has a count.** Bookings, Job Requests and Requests all have states that need attention and show nothing.

**5. Nothing summarises what needs attention.** The page opens on a list of properties, not on "here's what changed."

**6. The share-link panel dominates the page.** A raw `localhost:3210/manager/<uuid>` sits above the tabs, before any content, and is shown even with zero listings.

**7. Not on brand tokens.** `bg-gray-100`, `text-gray-500`, `bg-red-500` (lines 13, 16, 39, 133). The dashboard is grey while the rest of the site is limestone.

**8. Casing/namespace inconsistency.** `t('requests.myTitle', 'My requests')` — lowercase "requests", and sourced from the `requests.*` namespace while every sibling uses `dashboard.*`.

---

## Fixes

### D1 — Rename to remove the collision (do this first; it's copy-only)

| Now | Becomes | Why |
|---|---|---|
| `My Jobs` | **Jobs I've Posted** | work the user is buying |
| `Job Requests` | **Work Offers** *(or "Incoming Work")* | work the user is being offered |
| `My requests` | **My Requests** | Requests-board posts; fix casing |
| `My Bookings` | unchanged | already unambiguous |

Update both `en.js` and `he.js`; move the Requests label to `dashboard.myRequests` so all tab labels live in one namespace.

### D2 — Group the tabs

Three clusters, in this order, with a thin divider between groups (not separate rows):

- **Listings** — My Properties, Bulk Manager, My Gigs
- **Activity** — My Bookings, My Requests, Jobs I've Posted, Work Offers, Subleases
- **Account** — Messages, Alerts, Liked, Settings

If a group ends up with one visible item after role-gating, drop its divider.

### D3 — Gate `My Jobs` properly

It should appear only for users who have actually posted a job, or alongside the other service tabs. Its current unconditional render is the single biggest source of clutter for renters.

### D4 — Counts on every tab that has a state

Reuse the existing Messages badge markup (lines 131–138) for: Bookings awaiting response, Work Offers unanswered, My Requests with new responses. Use `--brand-primary` for neutral counts; reserve red for genuinely urgent. Replace the hardcoded `bg-red-500`.

### D5 — "Needs your attention" strip

A single row above the tabs, only rendered when non-empty:

> **3 new messages · 1 booking awaiting your reply · 2 requests expiring this week**

Each item links to the relevant tab. When there's nothing, render nothing — no "All caught up!" filler.

### D6 — Demote the share panel

- Move it inside the **My Properties** tab, below the listings.
- Collapse to a "Share your listings" button that reveals the link on click.
- **Hide entirely when the user has zero properties.**
- Show a friendly label rather than a raw UUID (e.g. "Your public listings page") with the URL revealed on demand.

### D7 — Real empty states

Every tab, when empty, gets one sentence explaining what belongs there and exactly one action. Examples:

- My Properties → *"No properties yet. Listing is free — add your first."* + **Add Property**
- My Requests → *"You haven't posted a request. Tell owners what you're looking for."* + **Post a request**
- Messages → *"No conversations yet. Message a listing or a pro to start one."*

### D8 — Brand tokens

Replace `bg-gray-100` (tab strip), `text-gray-500` (inactive), and `bg-red-500` (badge) with brand tokens. The strip should read as part of the limestone site, not a grey admin panel.

### D9 — Mobile

With grouping and gating most users drop to 4–6 tabs. If more than six remain visible at 375px, move the **Account** group into an overflow "More" menu rather than relying on horizontal scroll.

---

## Also spotted

The nav glass pills show rectangular blocks behind and above them in the dashboard screenshot — they look clipped against a hard edge rather than floating. Check whether a scrolled-nav or page-specific rule is fighting the glass style on this route. Not part of this spec; flag if reproducible.

---

## Order

1. **D1** (rename) — copy only, biggest immediate clarity win
2. **D3** (gate My Jobs), **D6** (share panel), **D7** (empty states)
3. **D2** (grouping), **D9** (mobile overflow)
4. **D4** (counts), **D5** (attention strip) — need backend counts
5. **D8** (tokens)

## Verification

Screenshots at 1280/768/375, **both LTR and RTL**, for: owner with listings, owner with none, renter, provider, and owner+provider (the twelve-tab worst case). No console errors; Lighthouse a11y ≥ 90. Per `docs/acceptance-checklist.md`.
