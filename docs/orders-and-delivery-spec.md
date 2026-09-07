# Orders and delivery for stores

Written 1 Sep 2026, from a research pass and a codebase pass. Goal in Tzvi's
words: stores currently pass around Google Sheets; give them orders laid out
neatly in the dashboard, and let them hand a delivery to a courier on the site
who gets the details automatically.

Related: `docs/assistant-spec.md` (the assistant can create orders),
`docs/goods-marketplace-spec.md`, `docs/business-page-spec.md`.

---

## O0 — Start from what is true, which is less than assumed

- **No store-order concept exists.** `book_gig` rejects store gigs outright
  (`gigs.py:1063-1064`), and most gigs cannot be booked in-platform anyway since
  `booking_mode` defaults to WhatsApp.
- **Service bookings that do get created are invisible.** There is no endpoint that
  lists `marketplace_bookings` for a provider, and no dashboard tab reads them.
  `PATCH /marketplace/bookings/{id}` exists and nothing in the frontend calls it.
  A booking lands in Mongo, affects availability, and can expire. That is all.
- **No notification fires on booking create, accept or decline.** Only on expiry
  (`gigs.py:1535-1613`), and only as an in-app row nobody polls for.
- **No address is stored anywhere** except on properties. No product quantity, no
  order line, no cart. No courier role: roles are one string per user. No push
  infrastructure. No money field on any marketplace record.
- **`ProductItem` has no id.** Products are an unkeyed array identified by position
  or name (`shared.py:477-499`), and the docstring records a bakery duplicating
  "Custom box of 4" to attach a second photo. An order line has nothing stable to
  point at.

So this is a build, not a wiring job. Which is fine, because it means the design
is not constrained by a half-built thing.

**Live bug found on the way:** the per-product "Ask about this" shortcut
(`GigDetail.jsx:885-901`) falls back to `BookingForm` when no WhatsApp number
exists, which POSTs to `/book`, which 400s for every store. The main CTA was fixed
for this; this second path was missed.

---

## The one finding that decides the design

From the research on why spreadsheets persist:

> **A purpose-built tool only wins if it is at least as fast to enter one order
> into as typing a row in Sheets, on day one, with zero setup.**

If the first thing an owner sees is a product catalogue to build or a menu to
configure, they close it and go back to the sheet. **Order entry is the product.
Everything else is secondary.** And since most orders arrive by WhatsApp or phone,
the primary input is a person typing what a customer just told them, not a
storefront checkout.

The sheet also does a second job nobody names: **it is the shared screen.** Staff
have it open. Whatever replaces it must be viewable by the person at the counter
without the owner's login, or the sheet stays open "just in case" and the
migration never finishes.

---

## O1 — The order

Minimum record, and the minimum is the point:

| Field | Notes |
|---|---|
| `customer_name` | required |
| `customer_phone` | required for delivery, optional for pickup. **See O6 on who may see it** |
| `items` | **free text is fine for v1.** "2 challahs, 1 babka" beats a product picker on day one. Structured lines can come later when `ProductItem` has an id |
| `total` | number, ILS. Optional. Entered by the owner, never computed by us |
| `needed_by` | date and time. Not "now". Food businesses live by this field |
| `fulfilment` | `pickup` or `delivery` |
| `address` | required when delivery. Free text plus optional geocode. The **first customer address the site has ever stored** |
| `notes` | "leave with the neighbour", "no nuts" |
| `status` | O4 |
| `courier_user_id` | O5, nullable |
| `payment` | O6 |
| `source` | `manual`, `chat`, `assistant`, `whatsapp_paste` |

**Money.** `total` and the collected amount in O6 are the first figures of money the
marketplace will store. They are the store's own bookkeeping of a payment that
happens between two people, and we never touch it. Say so in the model docstring,
because the site is already careful about implying it handles funds
(`shared.py:210-216`).

## O2 — Order entry. This is the whole product.

**Target: an order entered in under 20 seconds on a phone, one-handed, while
holding a tray.**

Three ways in, fastest first:

**1. Paste the WhatsApp message.** The customer wrote *"Hi, can I get 2 challahs
and a chocolate babka for Friday, deliver to Rechov Hapalmach 14, Idan
054-1234567"*. The owner pastes it. Claude extracts name, phone, items, time,
address into the form. The owner corrects and saves. **This is the move that beats
the sheet**: it is faster than typing, and the repo already does exactly this kind
of extraction for bulk listings (`bulk_upload.py:642-651`). One Haiku call, under a
cent, background-safe with the form still usable if it fails.

**2. Returning customer.** Type three letters of a name, the phone and usual
address fill in. Most food businesses have forty customers who order every week.

**3. Blank form.** Large touch targets, phone-first, needed-by defaulting to the
next sensible slot (Friday, if it is Wednesday and they are a bakery).

**Zero setup required before the first order.** No catalogue, no menu, no
configuration. The first order can be entered ninety seconds after opening the
tab.

## O3 — The board: today, not a table

A baker at 6am is not thinking in rows. She is thinking *"what goes out today, in
what order."*

**Default view: today, sorted by `needed_by`, status as colour.** Tomorrow and this
week one tap away. Each order is a card with the five things that matter at a
glance: time, name, items, pickup or delivery, and who is delivering it.

**A table view exists** for the owner who wants the sheet feel, with the same
columns the sheet had, sortable. The best existing analogue is
`components/admin/BookingsTab.jsx`: status pills that double as filters and
counters. Copy that pattern.

**Shared staff view.** A read-and-update link for the counter, scoped to one
business, no owner login. This is the sheet's real job, and without it the sheet
stays open.

**Print.** A day's orders as one clean page. Kitchens still print.

## O4 — Statuses. Four, plus two exits.

`new` → `preparing` → `ready` → `done`

Exits: `cancelled` (from anywhere), `failed` (from ready, delivery only, see O5).

**Not more.** The research is unambiguous that more than four or five states get
abandoned. `ready` covers both "on the counter for pickup" and "out with the
courier"; the courier assignment tells you which.

**Unlike `marketplace_bookings`, enforce transitions.** That model accepts any
status from any status with no guard (`gigs.py:1116-1143`). Do not copy that.

## O5 — Couriers

### Who is a courier

**Any user the store adds to its own trusted list.** Not a marketplace-wide pool,
not a role, not a badge.

The store adds a courier by phone number or site username, the way you add a
contact. That is the friend with the scooter, formalised, and it is how these
businesses already operate. It needs no reputation system, no verification, and no
new role on the user model. **A courier is a relationship, not a status.**

An open pool, where any store can hand a ₪600 catering order to a stranger, is a
trust problem that ratings do not solve at this scale, because a first-time bad
actor has no history. If it is ever wanted: value caps for unrated couriers, and
only as an opt-in. Not v1.

### Assignment

On the order: **Assign to** → pick from the trusted list → done. The courier
receives:

- the address, with **one tap to Waze** (Israel's default; do not build a map)
- the items and notes
- the `needed_by` time
- the amount due if paying at the door (O6)
- the customer's phone, under the rule in O6

### The run sheet

A courier with five deliveries gets **one ordered list**, not five notifications.
Each stop: navigate, call, mark delivered. This is what a delivery person actually
wants, and it is the difference between a tool and a nuisance.

### Delivered, and failed

**Delivered** requires one tap and, for delivery orders, a photo. Timestamped.

**Failed is a first-class outcome**, not a cancellation. Reason from a short list
(nobody home, wrong address, refused, could not find it) plus a photo of where they
were. It protects the courier from blame and gives the store a record.

### Reaching the courier

The binding constraint: **there is no push infrastructure.** What exists is email
(Postmark), and Twilio WhatsApp with exactly two Meta-approved templates. A third
template is a Meta approval with lead time, not a code change.

**v1: SMS via Twilio.** No approval, works today, reaches a phone on a scooter, and
the cost at this volume is negligible. The message is short and contains a link to
the run sheet.

**In parallel, start the Meta approval for a "new delivery assigned" WhatsApp
template now**, because it is a calendar item. When it lands, prefer it.

**Do not build web push for this.** It needs a service worker, a manifest, and a
courier who granted permission on the right device. Wrong tool for occasional
couriers.

## O6 — Money at the door, and the customer's phone

### Money

The site processes no payment. At the door there are two honest paths, and they
are not the same thing:

**Preferred: the customer pays the store directly, on their own phone.** The
courier's screen shows the store's Bit number or a QR of it. The customer pays the
store; the courier hands over the goods; **the courier never holds money.** This
removes reconciliation entirely and removes the largest trust risk in the design.

**Fallback: cash to the courier.** The courier taps **Collected** with the amount,
timestamped, at the door. That record, not a verbal report later, is the store's
reconciliation. End of day, the board shows *collected vs expected* automatically.

Show the preferred path first and make the fallback one tap further. Never
suggest a courier collect Bit into their own account on the store's behalf; that
is the ambiguous case that produces disputes.

### The customer's phone

Today there is **no mechanism by which any user learns another user's number as
data.** Every exposure is a redirect or a seller's own contact. A courier reaching a
customer is genuinely new surface, and it gets a rule:

- Visible **only** on the assigned courier's active-order view.
- **Only while the order is `ready`** or later. Not before, not after `done`.
- **Logged**, every reveal.
- The customer is told at order time: *"The delivery person will see your number
  to reach you."*

One tap to call. The number is never in a list, an export, or a notification body.

## O7 — The customer's status link

The order gets a link, no login, showing `Preparing → Ready → Out for delivery →
Delivered`. The store sends it once, in the chat or WhatsApp thread.

This cuts the *"where's my order?"* messages that are most of a food business's
inbound on a Friday, and it makes a one-person bakery look like it has a system.
It is also, quietly, the same status link pattern that makes this feature worth
sending to a customer at all.

## O8 — Israel-specific, and worth more than it looks

**Friday is the day.** For food businesses here, Shabbat orders are the week's
peak and the week's deadline. So:

- **Cutoff times**, set by the store: *"Friday orders close Thursday 2pm."* Shown
  on the business page, enforced by the assistant, respected by the board.
- **A Shabbat view**: everything due Friday, in delivery order, one screen.
- **Standing orders.** Challah every Friday, a box every Sunday. One record that
  regenerates weekly. This is a genuine differentiator: nothing the research found
  does it for this market, and it is exactly how these customers buy.

**Zero commission is a real argument here, not a slogan.** Wolt's average published
rate is 22%, reported real rates run to 27 to 30%, and the Knesset Economic
Committee has convened over it. A store that runs orders and delivery through us
keeps all of that. Say it plainly on the page that sells this feature.

## O9 — Do not replace the sheet. Absorb it.

- **Export any day or range to CSV, always, one tap.** The research is clear that
  owners keep the sheet open out of fear. Let them export and the fear goes.
- **Import from their sheet** for returning customers, so day one has forty names
  in autocomplete rather than zero.
- Never nag about the sheet, never hide the export, never make the site the only
  copy.

## O10 — What not to build

- **No catalogue or menu builder** before the first order. It is the setup step
  that kills adoption.
- **No open courier marketplace** in v1.
- **No in-app map or routing.** Waze handoff.
- **No payment processing, escrow, or "we hold the money".** Ever.
- **No WhatsApp Business API integration** for v1. Per-message cost, template
  approval friction, and not better than SMS plus a link at this scale.
- **No more than four statuses.**
- **No web push.**

---

## Order

1. **O1 + O2** the order record and entry, including WhatsApp paste. Ship this
   alone and it already beats the sheet for a one-person shop.
2. **O3** the today board, the shared staff link, print.
3. **O9** export and import, so switching is safe.
4. **O5** trusted couriers, assignment, SMS, the run sheet. Start the Meta template
   approval on day one of this phase.
5. **O6** money at the door and the phone rule. Ships with O5, not after.
6. **O7** the customer status link.
7. **O8** cutoffs, the Shabbat view, standing orders.

## Constraints

- **Order entry under 20 seconds on a phone.** Measure it. If it is slower than
  the sheet, nothing else here matters.
- Enforce status transitions. Four states, two exits.
- Customer phone visible only to the assigned courier, only while active, always
  logged.
- We record money; we never move it.
- Every string in `en.js` and `he.js`. **The courier's run sheet in Hebrew at 375px
  on a scooter is the real test.** Design for that screen first.
- Real numbers or nothing on the reconciliation view.

---

## Build log

- **2026-09-07 — phase 1 (O1 + O2).** `store_orders`, the entry form with WhatsApp paste and returning-customer autocomplete, the Orders tab. Transitions enforced server-side. `backend/routes/marketplace/orders.py`, `frontend/src/components/dashboard/OrdersTab.jsx`, tests in `backend/tests/test_store_orders.py`.
- **2026-09-08 — phase 2 (O3 + O9).** Staff link (`/orders/staff/:token`, read + move only), table view, print view, CSV export, customer import. `test_store_orders_staff.py`.
- **2026-09-08 — phase 3 (O5 + O6).** Trusted courier list per business, assignment, the run sheet (`/orders/courier/:token`) with Waze, phone-only-while-ready with every reveal logged, delivered-with-photo, failed-with-reason, cash-at-the-door record, today's collected-vs-expected strip. SMS via `utils/sms.py` when `TWILIO_SMS_FROM` is set; the owner's "Send run sheet" WhatsApp button needs nothing. `test_store_orders_couriers.py`.
- **2026-09-08 — phase 4 (O7).** Per-order status link (`/orders/track/:token`, minted at creation, backfilled on list) with the step, items, time and, for a delivery, the "delivery person will see your number" line. "Send status link" on the card opens WhatsApp to the customer. `test_store_orders_track.py`.
- **Not built:** O8 (cutoffs, Shabbat view, standing orders) and the Meta WhatsApp template for "new delivery assigned".
