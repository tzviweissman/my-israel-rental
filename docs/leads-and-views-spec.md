# Leads and views dashboard

What a business owner or lister can see about how their listing is doing.

Spec first, per the pattern used for `docs/booking-slots-spec.md`: decisions
and awkward bits up front, before any code.

**This is already promised.** `/why-list` advertises a "Leads and views
dashboard" under *"Coming soon — Being built now."*
(`frontend/src/locales/en.js`, `whyList.roadmapLabel`). Every day it says
that and isn't there is a small credibility cost, so the first release
should be the smallest thing that is honestly a leads-and-views dashboard,
not the complete one.

---

## What already exists

Three findings shape everything below.

**1. WhatsApp taps are already recorded, and nothing reads them.**
`lead_events` is written by `routes/marketplace/gigs.py:967` (services) and
`routes/marketplace/requests.py:774` (requests board), and indexed by
`(gig_id, created_at)` and `(provider_id, created_at)` in
`server.py:408-411`. The index comment says "the analytics dashboard reads
these". No reader exists — a repo-wide grep finds only the two inserts.
`docs/lead-tracking.md` states it outright: *"No read endpoint."*

So the single highest-value number in this whole feature — **how many people
tapped through to message you** — needs no new tracking at all. Only an
endpoint and a place to show it.

**2. Service and business-page views are not recorded anywhere.**
Only properties are: `properties.views` (lifetime counter) plus a
`property_view_events` log, both written from
`routes/properties/browse.py:509-515`. Gigs, businesses and requests have
nothing — no counter, no event.

This is the blocking gap. The site's supply-side pitch was just widened to
every kind of business, and a views dashboard that can only answer the
question for property listings contradicts that on day one.

**3. The two property view sources disagree.**
`properties.views` and `property_view_events` have different histories —
documented in `routes/admin/core.py:121-130`, where real data showed
all-time 14 against 30-day 93. The admin console fixed this by reading one
source for every range. The owner dashboard must do the same, and must say
when counting began.

### Also recorded, also unread by owners

| Data | Where | Status |
|---|---|---|
| QR / short-link scans, with daily buckets | `short_links.scan_count`, `.daily` | **Shown** for properties and the manager link — this is the pattern to copy |
| Chat opens on a request | `requests.contact_count` | Shown on the Requests tab, counter only, no history |
| Booking requests per service | `marketplace_bookings` | Exists, never rolled up per listing |
| Response time | `marketplace_providers.avg_response_hours` | Computed, used only to filter public search — never shown to the person it describes |

`ScanChart` (`components/common/ScanChart.jsx`) already renders a zero-filled
daily series and returns `null` when the period is empty. Reuse it; do not
write a second chart.

---

## Decisions needed

**D1 — What counts as a lead?** Proposed: *someone taking an action that
puts them in contact with you.* That is a WhatsApp tap, an on-site message,
or a booking request. Not a view, not a favourite. Three sources, one
number, with the breakdown visible underneath.

**D2 — Do we count unique people or raw actions?** Currently everything is
raw — deliberately, in both `property_view_events`
(`smart_pricing/pricing.py:197-198`) and `lead_events`
(`docs/lead-tracking.md:86-87`). Raw counts flatter, and an owner who
refreshes their own page inflates their own number. Proposed: keep raw for
leads (a tap is a tap) and dedupe views per visitor per day, which needs a
visitor identifier that does not exist yet.

**D3 — Does the owner's own traffic count?** It should not, and today it
does. An owner checking their listing five times adds five views.

**D4 — What period?** Proposed: last 30 days by default, matching
`ScanChart`'s existing window, with the all-time total beside it and a line
saying when counting started. No range picker in the first release.

**D5 — Say nothing rather than guess.** A listing with no data shows "No
views yet", never a zero standing in for "we weren't counting". Anything
predating the tracking must be honestly absent — the same rule the admin
console follows.

---

## What makes this awkward

| Problem | Consequence |
|---|---|
| **No view tracking for gigs or businesses** | The largest single piece of work, and it gates the whole "views" half |
| **No visitor identifier anywhere** | Cannot dedupe, cannot exclude the owner, cannot join a view to a lead |
| **Nothing links view → lead → booking** | No conversion rate is computable. `?src=qr` is appended to short-link redirects (`short_links.py:244`) and never read, so even "did the QR work?" cannot be answered |
| **`lead_events.created_at` is an ISO string; `property_view_events.at` is a datetime** | Every query must use the form its own collection stores. This exact mismatch already returned a confident, wrong `0` in the admin metrics |
| **Property WhatsApp links go straight to `wa.me`** | Services have lead tracking, properties do not. A shared dashboard would silently under-report property leads |
| **`contact_count` is a bare counter** | No history, so requests cannot appear in a time series alongside everything else |
| **Multi-business** | A person may run several businesses. Numbers must roll up per business, not per person |

---

## Proposed build order

Each step is independently shippable and useful on its own.

1. **L1 — Leads, read-only.** An owner-scoped endpoint over `lead_events`,
   plus a total and a 30-day `ScanChart` on the services tab. No new
   tracking. This is the promised feature's headline number and the data is
   already sitting there.
2. **L2 — View tracking for gigs and business pages.** Mirror the property
   pattern, with the two lessons already learned: one source of truth, and a
   record of when counting began.
3. **L3 — The dashboard itself.** Views and leads together, per listing and
   per business, one honest period.
4. **L4 — Exclude the owner, and dedupe views per visitor per day.** Needs
   D2/D3 settled and a visitor identifier.
5. **L5 — Property leads.** Route property WhatsApp taps through the same
   tracked redirect services use, so the two halves of the site report the
   same way.
6. **L6 — Conversion.** Only once L4 exists; without a visitor identifier
   there is nothing to join on.

Stop after L3 if the numbers are not being looked at.

---

## Related

- `docs/lead-tracking.md` — the shape of `lead_events` and its explicit "not done yet" list
- `docs/qr-and-short-links-spec.md` — Q2, "a real number or nothing", which applies here too
- `docs/admin-dashboard-spec.md` — A6, where the flow-vs-stock distinction was worked out
- `docs/dashboard-ux-spec.md` — where a new tab has to fit among the existing thirteen
