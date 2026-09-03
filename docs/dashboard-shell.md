# Dashboard shell and Overview

Shipped 3 September 2026. The dashboard has a collapsible sidebar on wide
screens, keeps its tab strip on phones, and opens on an **Overview** that
rolls up the numbers the account already produces.

## What is on the Overview

Four cards, then recent activity beside "needs your attention". Every
figure is read from an endpoint that already existed, except the scan
rollup, which is new. Nothing is estimated.

| Card | Source | What the number is |
|---|---|---|
| Waiting on you | `GET /dashboard/summary` | pending bookings on your listings + open work offers you have not answered |
| Leads, last 30 days | `GET /marketplace/leads/summary` + `GET /properties/performance/summary` | WhatsApp taps on your services and listings. Raw actions, not people (spec L4) |
| Visitors, last 30 days | the `views` halves of the same two calls | one visitor per listing per day, never you (spec L2/L4) |
| QR & link scans | `GET /short-links/mine` **(new)** | every link you minted, summed; "Not scanned yet" at zero |

The activity list is leads with no reply yet (`/marketplace/leads/awaiting-answer`)
and pending booking requests. The attention list is the same items the
attention strip shows, so the two cannot disagree.

**There is no "+12% from last month" anywhere.** The layout this came from
prints one on every card. A period-over-period change needs the previous
window, and none of these endpoints serve it; printing a delta would mean
inventing the denominator. "Counting since" is shown instead, because a
small number on a young counter is not a verdict.

## The shell

`components/ui/dashboard-shell.jsx` is the ported sidebar, stripped to a
shell: it renders whatever groups it is given and knows nothing about
sales. `components/dashboard/useDashboardNav.js` is the ONE list of groups,
read by the sidebar on wide screens and by the existing tab strip on
narrow ones - the role gating, badge sources and order used to live inside
the strip, and a second copy for the sidebar is how a tab and its panel
drift apart. `useIsWide(1024)` decides which renderer runs.

Three things the source did that this does not:

- **No dark-mode toggle.** The site has no dark theme; a toggle that darkens
  one page is a promise the rest of the site does not keep.
- **No hardcoded menu or figures.** See above.
- **It works in Hebrew.** The sidebar sits on the reading-start edge, the
  selected item's accent bar sits on that same edge, and the fold chevron
  points the way the panel will move. Logical properties throughout.

The folded state is remembered per browser (`localStorage`, guarded), so
someone who folds it for room does not fold it on every visit.

## Each business's link and QR code (4 Sep 2026)

Every business card has a **Share & QR code** button - the same popover as
the listings header (`ShareListingsPanel`, now taking a `target`), minting
a `business` short link the backend has supported since the short-link
table was built. The tab's subtitle had promised "their own page and QR
code" and the card offered neither (Tzvi: "theres no link to share or qr
code"). The card is no longer `overflow-hidden` - that clipped the popover
at the card's edge - and on a phone the popover pins to the screen, since
a 360px panel off a button in a 390px card fits on no side. The Copy
button's label was the same blue as its fill after the theme swap; it is
the black action with a white label now, in both share panels.

## The scan rollup

`GET /short-links/mine` - every link the caller owns with `scan_count`,
`daily` and target, plus `total_scans` and one summed, zero-filled daily
series. Declared **before** `/short-links/{slug}` or "mine" is read as a
slug. Scoped to the caller; an admin gets their own, not everyone's.

## Checks

- `scripts/check-dashboard-shell.mjs` - makes an owner, publishes a
  listing, mints and scans a link, signs in through the real screen, and
  asserts the cards say what the API says, the sidebar shows the right
  groups for the role and none of the renter-only ones, it folds and stays
  folded, an item opens its tab, Hebrew puts it on the right, and a phone
  gets the tab strip, the business card's share popover mints a working link and a visible QR on desktop and phone, and the Copy label is readable. 52 assertions.
- `backend/tests/test_short_links_mine.py` - scoping, summing, ordering,
  the route-order trap.

## Not built

- **Per-listing drilldown.** The cards are account-wide. Per business or
  per property lives on each listing's own panel (PerformancePanel, the
  share row), not here yet.
- **Page visits for requests and businesses over time.** Businesses have
  views now; requests still carry a bare `contact_count` with no history.
- **Conversion.** A view and a tap cannot be tied to one person, so no
  rate is computable - the same limit the performance panel states.
- **Renter's overview is thin on purpose.** Bookings, replies, messages;
  the lead and visitor cards read "add a listing to start counting".
