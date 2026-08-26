# Perks, and "What you can do here"

**Recreated 26 Aug 2026** after the original was written but never committed and lost in a branch switch — commit this file.

Two connected features. One tells each kind of person what the site does for *them*; the other gives newcomers a reason to try a local business.

---

# Part 1 — "What you can do here" (role-filtered feature list)

The site does a lot — bilingual chat, contract signing, iCal sync, the Requests board, saved-search alerts, QR codes, bulk tools — and almost nobody discovers any of it. A plumber does not care about iCal sync; a traveller does not care about bulk upload.

## F1 — Three audiences, matching `/join`

**Traveller / renter · Host (property) · Business owner.**

- Signed out: tabs, defaulting to **Business owner** (lead offering per CLAUDE.md positioning).
- Signed in: the user's own role(s), primary first.

## F2 — Card, then detail

Each feature is a card: lucide icon, short title, one line of benefit language. Clicking opens a real page at `/features/{slug}` — not a modal — so each is linkable, shareable and indexable. Detail page: what it is, who it's for, a screenshot or short animation, one CTA straight into using it.

## F3 — Benefit language, never feature names

| Not this | This |
|---|---|
| "Auto-translation" | "Write in English, they read Hebrew" |
| "iCal sync" | "Your calendar stays right, everywhere" |
| "Requests board" | "Tell owners what you're looking for" |
| "Short links & QR" | "Put your business on a flyer" |

## F4 — Where it appears

Public page `/what-you-can-do`, linked from the footer and `/join`. A dismissible dashboard card for accounts under ~30 days old. **Never a modal on first login.**

## F5 — Honesty

Only list what exists today. Half-built features do not appear.

---

# Part 2 — Perks

## The name

**"Perks"** — in Hebrew, **"הטבות"**.

Rejected: *Coupons* (cheap, wrong customer), *Deals* / *Discounts* (a race to the bottom; frames the business as cutting price rather than making an introduction), *Vouchers* (bureaucratic). הטבות is the ordinary, natural Hebrew word and needs no explanation to an Israeli reader.

New users receive a **Welcome Perks** list.

## The pitch to businesses — not "give a discount"

> *A perk is how someone tries you for the first time. It only shows to people who have never bought from you — your regulars never see it, so you are not discounting business you already have. You set what it is, how many you'll honour, and when it ends. It costs nothing, we take no commission, and you'll see how many people viewed it, claimed it and used it.*

Four things make an owner comfortable saying yes. All four are non-negotiable:

1. **New customers only.** One perk per person per business, ever.
2. **A cap they choose.** "First 20 people."
3. **An end date.**
4. **Instant stop.** One button.

## P1 — Guide them to the right perk

Most owners' instinct is a percentage off, which costs margin and reads as generic. Coach it in the form:

> **A free extra usually works better than a percentage.** "A free challah with any order" costs you less than "10% off" and feels like more.

Offer types, in this order: **free item with purchase** (recommended), **fixed amount off** (₪20 — clearer than a percentage on small baskets), **percentage off**, **free upgrade / add-on**. Prefill a category example (bakery → "a free loaf with any order over ₪100"; cleaner → "first clean, 20% off"; mover → "free packing materials").

## P2 — Where a user sees perks

- **`/perks`** — browsable, filtered by area and category.
- **On the business page** — one gold band above the catalog, below the Message CTA.
- **Welcome Perks on signup** — the flywheel: businesses join to reach users, users join because something is waiting.
- **Never in a recommendation rail on a referred visit** — `docs/recommendations-spec.md` rules apply to perks too.

## P3 — Claiming and redeeming, with no payment rail

1. User taps **Claim** → unique code (`PERK-4F7K2`) tied to that user and business, expiry shown.
2. User shows the code on their phone.
3. The business marks it used — entering the code, or tapping the claim in their list.

**If the business never marks it, nothing breaks.** Build a record, not an enforcement system.

Anti-abuse, proportionate: one claim per user per business ever; claim expires (default 30 days, owner-settable); **the cap decrements on claim, not on redemption**, so a business is never over-committed.

## P4 — What the business sees

On the perk: **viewed · claimed · used**, and remaining against the cap. Real numbers only, or nothing.

## P5 — Design

- Perk band: one gold-accented band, ink on limestone, above the catalog and below the Message CTA.
- Perk card: business photo, name, the perk in one line, area, expiry. Shared card component.
- Claimed state shows the code **legible at arm's length** — someone is holding a phone up to a shopkeeper.
- **Never a countdown timer, never "3 left!" pressure styling.** It is a welcome, not a flash sale.

## P6 — Admin

Perks appear in the admin (per `docs/admin-dashboard-spec.md`): list, moderate, deactivate. Public-facing third-party copy needs the same oversight as a listing.

---

## Order

1. **F1–F4** the feature list — self-contained
2. **P1 + P4** create form with coaching, caps, dates, counters
3. **P2** business-page band and `/perks`
4. **P3** claim codes and redemption marking
5. **Welcome Perks** on signup
6. **P6** admin moderation

## Constraints

- Perks are free to offer; no commission, no fee, no paid placement.
- New customers only, capped, dated, stoppable — all four, always.
- Real counts only.
- Strings in both `en.js` and `he.js`; "Perks" = "הטבות". Verify LTR and RTL at 1280/768/375, including the claimed-code screen on a phone.
