# Business offers (discounts)

A business can put a percentage off one of its own listings, take it down
again, and have it appear on the listing, on the services board, and on the
home page's deals shelf. Shipped 3 September 2026.

## The one rule everything else follows

**No price on this site is ever recomputed from an offer.** The listing shows
the prices the business typed; the offer is shown beside them; the badge tells
the customer what to ask for and the business applies it when the job is
agreed.

That is not caution for its own sake. Booking here is a conversation — a
message or a WhatsApp thread — and where money changes hands it changes hands
between the two people. A tier the site had quietly rewritten to 0.8× would be
a promise the business never made and no checkout would keep, and the person
who gets charged the original price blames the site, not the business. A test
asserts the tier price is untouched with an offer running, so this cannot be
"simplified" later by accident.

## Shape

`discount` on a gig, or absent:

| Field | Rule |
|---|---|
| `percent` | 5–90, required. Percent only — a listing can carry several tiers at different prices, or none at all, so "₪50 off" is ambiguous on most of them and "15% off" never is. |
| `label` / `label_he` | ≤60 chars, optional. What it is for: "New customers", "Before Pesach". |
| `ends_at` | `YYYY-MM-DD`, optional. Absent means it runs until the business removes it. |

**Expiry is read-time, not a job.** `active_discount()` in
`routes/marketplace/gigs.py` returns the offer or `None`, and every public read
goes through it — the card list, the listing, and the shelf. An offer that
ended overnight is gone from the next request, with nothing to fall behind and
no back-fill to write. An offer dated *today* runs all of today, which is what
"until the 9th" means to the person who typed it.

## Removing one is the part that breaks

`patch_gig` builds its update with `exclude_none=True`, so a `null` is
indistinguishable from an omitted field — and `discount: null` is exactly how
an offer comes down. The handler therefore reads `discount` off
`model_fields_set` instead. Without that branch a business could put an offer
up and never take it down, which is worse than not having the feature, and
every API test would still pass because they would all be testing the setting
of one.

The owner's sheet has the matching half: the toggle is state of its own, so
switching it off and saving sends `null` rather than omitting the field.

## Where it appears

| Surface | What shows |
|---|---|
| Service card (board, business page, home rail) | The gold chip, "-20% off". It takes the corner the top-rated pill uses, and the pill stands down when both apply — two badges in one corner is how neither gets read. |
| Listing page | The full line under the business name: percentage, what it is for, when it ends, and "Mention this offer when you get in touch." |
| `GET /marketplace/deals` | The shelf. Published listings with a live offer, biggest saving first. |
| Home page carousel | Becomes **Today's deals** once four offers are running, and falls back to **Today's picks** otherwise. |

Gold with ink text everywhere, via `components/marketplace/OfferBadge.jsx` —
one component, because a card and a listing page that disagree about the same
offer is a bug nobody reports. Never green: green is functional on this site,
reserved for status and verification.

## The threshold is one number

`MIN_CARDS` in `useHomeShowcase.js`. It decides both whether the carousel has
enough cards to render and whether there are enough live offers to call the
section "deals". They were briefly two different numbers, and the heading
flipped to "Today's deals" while the section refused to draw itself.

## Checks

- `backend/tests/test_gig_discounts.py` — set at create, added and removed by
  patch, an ended offer served nowhere, one ending today still running, the
  shelf's ordering, the 5–90 bound, another owner refused, prices untouched.
- `scripts/check-offers.mjs` — the real screens: the badge on the listing and
  on the board, its colours, the price still reading as written, the shelf,
  removal actually removing, and the home carousel switching to deals with the
  saving on the centred card.

## Not built

- **Offers on rentals.** This is on business listings only. A property has no
  `discount` field and the request was about businesses.
- **Codes.** No coupon code, nothing to redeem, nothing to track. The offer is
  a statement the business honours in conversation.
- **Any reporting.** A business cannot see how many people opened a listing
  because of its offer. View tracking exists (`utils/view_tracking`) and is not
  wired to this.
