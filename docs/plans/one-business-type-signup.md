# One kind of business, features switched on: the sign-up plan

23 Nov 2026. Asked by Tzvi after Bawk Bawk Chicken (a fried chicken takeout) signed up as a "service" and could not list its whole menu: "can we make the different business categories more simple ... or maybe even better only have 1 business category and they choose what features they need".

## What is wrong today

The first question of the sign-up form (`/businesses/add`, `frontend/src/pages/CreateGig.jsx`) is a choice of three listing types, in words owners don't use:

| Type in code | What the owner sees | What it decides |
|---|---|---|
| `store` | "Store: showcase products for sale" | a product list, a cart and orders |
| `deliverable` | "Deliverable service: priced work with a turnaround time" | a price list, quote requests, optional date picker |
| `appointment` | "Appointment service: book a specific day + time" | a price list with durations, a calendar, opening hours, team |

What the live data shows (82 published listings, read 23 Nov 2026):

- 30 store, 27 deliverable, 25 appointment.
- **At least 9 of the 27 "deliverable" listings sell food or goods**: Bawk Bawk Chicken, cured salmon and dips (19 rows), cakes and cookies (11), baked goods and gift boxes (8), dips, cookies, cold brew, catering, Shabbos food. None of them has a cart, so a customer cannot order several items together.
- `deliverable` is the form's **default** type, so anyone who doesn't read the cards closely lands there.
- Only 2 of 72 businesses have listings of two types, though the code already allows it.

So the types are not three kinds of business. They are three **things a customer can do**: order items, book a time, or ask for a job to be done. One business can need more than one.

## What the best platforms do

Research summary (Shopify, Square, Wix, Google Business Profile, Fresha, Uber Eats/Wolt, Etsy, Yelp):

1. **No "type" question.** Shopify asks "what do you want to do?" (several answers allowed), and Square asks the category and then *suggests* the features. Wix adds Menus, Orders, Reservations and Bookings as separate add-ons.
2. **Few things to go live.** Google needs a name, category and contact details; hours, photos and services come after. Etsy and Square let you publish a basic version and fill in the rest.
3. **Import before typing.** Square reads a menu photo, PDF or link. Uber and Wolt load the menu for the restaurant.
4. **A "finish your profile" checklist** built from the answers, instead of a long form.
5. **The category asks the extra questions**: a food business is asked about kosher, a tutor about subjects. That collects more information without lengthening the form for everyone.
6. **Pitfalls:** a wall of switches on the first screen, and a wrong default that the owner has to notice to fix.

## The recommendation

**One business, with up to three "ways customers buy" switched on**, chosen for them from what we read and confirmed with one tap. Build it in two phases: the owner-facing change first (small, safe), then the data model (larger, done once phase 1 proves the flow).

### The new sign-up, four short screens

1. **Find your business.** One box: website, Instagram, Google listing, or "upload your menu or price list". The readers we already have (`/socials/read`, the place lookup, `/products/extract`) fill in everything they can. Skippable.
2. **About you.** Name, category and area, filled in where we could, plus one question with chips that allow several answers:
   **"What can customers do with you?"**
   - 🛒 **Order items**: menu, products, trays, boxes
   - 📅 **Book a time**: a haircut, lesson, class or visit
   - 💬 **Ask for a quote or a job**: a move, a clean, an event, a design

   The chips are pre-ticked from the category and from what the reader found (a menu with prices means Order; opening hours plus personal care means Book). The owner un-ticks or adds. Nothing is ticked by default without a reason, which ends the `deliverable` trap.
3. **What you offer.** **One list** (name, price, photo) whatever was ticked. Extra columns appear only for the ticked features: duration for Book, options and sizes for Order. Paste a list, photograph a menu, or add rows; the limit is the same 30 everywhere, with a message at the limit.
4. **How customers reach you.** WhatsApp or email, plus opening hours if Book is ticked. Then **Publish**.

Required to publish: name, category, area, one way to reach them, one item with a price (or "price on request"), one photo. That is what the form already requires, in fewer screens.

### Collecting more without asking more

After publishing, the existing "Your page is N% ready" bar becomes a checklist driven by the category and the ticked features. For example:

- **Food:** kosher certificate, delivery areas and minimum, order lead time, pickup address. These fields already exist on the business: `kosher_certification`, `delivery_note`, `lead_time`.
- **Book:** team members, deposit, rebooking reminder.
- **Quote or job:** areas served, licence number, what's included.
- **Everyone:** logo, hours, languages, year founded, socials, FAQs.

Each item is one tap to open and saves on its own. The dashboard's tool suggestions (`backend/utils/business_tools.py`) switch from reading `gig_type` to reading the ticked features.

### Phase 1: the form only (about 2 to 3 days; no data change)

The chips map onto what exists today, so the backend, the order and booking code and the 82 live listings are untouched:

- Order ticked: a `store` listing.
- Book ticked: an `appointment` listing.
- Quote ticked: a `deliverable` listing.
- Two or three ticked: one listing per feature, under the same business. One business with several listings already works; 2 live businesses do it today.

Phase 1 work:

1. Replace the type picker with the chips question, pre-ticked from the reader and the category, with no silent default.
2. Merge the product and service rows into one list component with optional columns.
3. Put "Find your business" first.
4. Turn the ready bar into the category checklist.
5. Update `scripts/shot-business-form.mjs` and `scripts/test-tier-limit.mjs` for the new screens, in English and Hebrew, on a phone and a laptop.

### Phase 2: features on the business (about 1 to 2 weeks; touches live data)

- A `features` field on the business: `orders`, `booking`, `quotes`, plus the smaller switches that exist today (date picker, delivery, team, deposits).
- About ten backend modules and twenty frontend spots that branch on `gig_type == "store"` move to the feature, or to "has products" (`orders.py` already does this in two places).
- `gig_type` stays and is filled in from the features, so old links, drafts and tests keep working.
- A one-off migration derives `features` for the 72 businesses. **It needs Tzvi's OK before it touches the live database.**

### Fixing the 9 food sellers already listed as services

This is separate from both phases and can happen now. A listing's type can already be changed after publishing (`GigPatch` accepts `gig_type`), so each one can become a shop with its rows moved to products. The question is only whether the owners are asked first. Changing their live listings without asking would alter approved pages, so it waits for his choice.

## Decisions for Tzvi

1. Phase 1 now and phase 2 later, or both together?
2. One mixed list of items (recommended), or keep products and services as two lists?
3. The 9 food sellers listed as services: message the owners, or convert them ourselves?

## Shipped today alongside this plan

- Services take 30 rows, the same as products, with a message at the limit. The menu reader used to stop at 20 and the add button vanished at 15.
- A menu of 8 or more priced items read into a service listing offers "Make it a shop" and keeps every row.
- `scripts/test-tier-limit.mjs` checks both. The nightly site audit now searches for hidden count limits (`.claude/skills/site-audit/SKILL.md`, section 7).
