# Category expansion — a fuller marketplace

Written 27 Aug 2026, against the taxonomy in `backend/routes/marketplace/shared.py:159-224`
(16 top-level categories, subcategories on four of them).

Goal, in Tzvi's words: *"add more categories like sales or money exchange so it
can be a full marketplace and bring more traffic."*

Related: `docs/marketplace-benchmark-spec.md`, `docs/recommendations-spec.md`
(competition rules), `docs/service-card-visibility-spec.md` (the shared card).

---

## Rulings (Tzvi, 27 Aug 2026)

1. **Both kinds of "sales"** — surface the store capability we already have,
   *and* add person-to-person selling.
2. **New niches become top-level categories**, not subcategories.
3. **Categories open immediately with a "be the first" state**, not held back
   until supply exists.

Ruling 2 overrides the recommendation in this file's first draft and it
overrides the principle written into the code at `shared.py:155-158`:

> *"the alternative is a new slug per trade and a list nobody can scan."*

That concern is real and does not disappear because the ruling went the other
way. **It is answered by N2, not ignored.** A top-level list of 25 is fine if it
is grouped; it is unusable as a flat dropdown. If N2 is not built, do not ship
the new categories.

---

## N1 — The new top-level categories

Chosen for one audience — English-speaking residents, olim and visitors in
Israel — because a category nobody in that group searches for is a page that
stays empty forever.

| Slug | Label | Why this one |
|---|---|---|
| `money-exchange` | Money Exchange & Transfers | Changing USD/GBP to shekels and sending money abroad is a near-universal need for this audience, and the incumbents are word-of-mouth |
| `buy-sell` | Buy & Sell | Person-to-person items — N4 |
| `religious-services` | Religious Services | Sofer, mohel, kashrut supervision, mikveh, Judaica. Specific to this audience, served by nobody well |
| `immigration-documents` | Immigration & Documents | Visas, Misrad HaPnim, notary, apostille, certified translation. Highest-intent category on this list — **read the warning below** |
| `medical-health` | Medical & Health | English-speaking doctors, dentists, therapists. A genuine pain point — **read the warning below** |
| `insurance` | Insurance | Health, car, home, travel. Distinct enough from `business-financial` to warrant its own door |
| `vehicles` | Vehicles | Sale, rental, mechanics, testing, licence conversion |

**Not on this list, deliberately:** anything that duplicates an existing slug.
Legal stays a subcategory of `business-financial` unless it grows past the N2
promotion threshold. Adding a slug that overlaps an existing one splits the
supply we already have across two pages, which is the opposite of the goal.

### Two categories that need care before they ship

**`immigration-documents` — do not resurrect the discontinued feature.**
`CLAUDE.md` discontinues document and government "paid services" (Arnona
discount, name change, document filing, Bituach Leumi) and keeps them behind
`DOCUMENT_SERVICES_ENABLED`, off. **That was us providing those services.** This
category is a directory of *other people's* businesses, which is a different
thing. Keep the flag off, do not extend that code, and do not let this category
become a doorway back into it.

**`medical-health` — it is a directory, not a health service.** No symptom
matching, no advice, no "find the right treatment" framing. Public reviews of
individual clinicians carry a defamation exposure that a review of a plumber
does not; consider limiting this category to the aggregate rating without free
text, or launching it without reviews and adding them deliberately later.

**`money-exchange` — regulated.** Currency service providers in Israel are
licensed and supervised. Listing a licensed business is not the same as
facilitating exchange, but this is worth a lawyer's five minutes before launch,
and the category must never imply we handle, hold or convert money. Consider a
licence-number field, shown when supplied.

*(Not legal advice. Confirm all three with someone qualified.)*

## N2 — Group the picker. This is the condition on ruling 2.

25 flat entries in a dropdown is a list nobody reads to the bottom, and the
items at the bottom die. Group them:

- **Home & Property** — home services & repair, cleaning, moving, real estate
  services
- **Buy & Sell** — buy & sell, shops & products, vehicles
- **Money & Admin** — money exchange, business & financial, insurance,
  immigration & documents
- **Personal & Family** — personal care, health & fitness, medical & health,
  childcare, education, pet services
- **Events & Creative** — events/music/catering, creative & design,
  travel & tourism
- **Community** — religious services
- **Tech & Transport** — IT & tech support, transportation

Groups are **presentation only** — labels in `en.js`/`he.js`, order in one
frontend module. Do not add a `group` field to the stored category or to any gig
record; a business's category is its slug, and grouping must stay re-arrangeable
without a migration.

**Promotion rule**, so this argument is settled once and not re-litigated per
category: a subcategory with **15+ published listings** may be promoted to
top-level. Below that it stays a subcategory.

## N3 — "Be the first" empty state

An empty category is a recruitment surface, not an error. When a category has no
published listings:

> **No money changers listed yet.**
> Be the first — free to list, free to be found, no commission.
> **[ Add your business — free ]**

- Uses the standing supply CTA from `CLAUDE.md`.
- **Never the words "no results", "empty", or "coming soon."**
- Below it, show what *is* nearby: *"Meanwhile, 6 businesses in Money & Admin"* —
  a visitor who came for one thing should not leave with nothing.
- The same state on a **category + area** page with the area relaxed:
  *"None in Beit Shemesh yet — 3 in Jerusalem."*

Honest note on the traffic goal: **an empty page indexed is worth less than no
page.** Google demotes thin content, and a visitor landing on nothing concludes
the site is dead. So: `noindex` a category page until it has **at least three
published listings**, then let it index. The category is live and visible in
navigation from day one — only the *search-engine* promise waits for content.
That is the version of ruling 3 that actually produces traffic rather than
looking like it should.

## N4 — Person-to-person selling, without building a third product

One person selling one sofa is not a service. It has no provider, no repeat
supply, no meaningful review, and it needs a **sold** state that nothing in the
gig model has.

**But we do not need a new product.** The Requests board already has both sides:
`post_kind` is `want | have` (`requests.py:101-172`), and the full lifecycle —
open → expiring → renew → expired, `REQUEST_TTL_DAYS = 30`, the sweep at
`requests.py:808`, the loop at `:820` — is already built and running. A
classified ad that dies after 30 days unless renewed is *exactly* the right
behaviour, and it is the behaviour that already exists.

**Add `request_type: "item"`** alongside `rental` and `service`:

- `post_kind: "have"` → *"For sale: IKEA sofa, Katamon, ₪400"*
- `post_kind: "want"` → *"Looking for a double stroller"* — which is the
  wanted-ads half that classifieds sites never do well, and we get it free.

Fields on top of what the model has: `condition` (new / like new / good / used),
`price` (reuse `budget_amount`/`budget_currency` rather than adding a field),
photos, `pickup_area`. Plus **`status: available | sold`**, owner-settable in one
tap, because a board full of sold items is how classifieds sites die.

Filters on the board: type, condition, price range, area. **The board already
has a `category` filter in the API that the UI never sets** — see L11 in the
benchmark spec; fix that in the same pass.

**Do not put items in the services grid.** Different card, different page,
different ranking. A sofa competing with a plumber for a slot helps nobody.

## N5 — Surface the store capability we already have

`shops-products` was added 19 Aug because *"a clothing business had nowhere to
list,"* and `gig_type: "store"` with `ProductItem` (`shared.py:350-371`) —
name, price, images, `in_stock` — has always worked. Almost nobody knows.

- A **Shops** entry in navigation that lands on `shops-products` and reads like
  shopping, not like hiring.
- Store listings show **a product photo and a price**, not a service card.
- In the owner's create flow, "Are you selling products or offering a service?"
  should be an early, visible question — not a `gig_type` buried in a form.

This is the cheapest item in this document. The capability exists; only the door
is missing.

## N6 — Classifieds bring scams. Build for that from day one.

Yad2 and the Facebook groups are full of them, and the day we open person-to-person
selling we inherit the problem.

- **We never handle money and never say we do.** No escrow, no payment, no
  "buyer protection" language — we cannot honour it.
- **Chat only.** No phone or email exposed, matching the standing rule.
- A one-line safety note on every item: *"Meet in a public place. Never transfer
  money before you have the item."* In both languages.
- **A report button on every item**, and a moderation queue in the admin
  (`docs/admin-dashboard-spec.md` already asks for the surfaces).
- **Posting rate limits** — items per user per day, and a lower limit for
  accounts under a week old. This is where spam enters.
- Categories that attract fraud disproportionately — money exchange above all —
  get the report button prominently and a manual-review flag on new listings.

## N7 — What actually brings traffic

The request was traffic. Categories alone do not produce it; **indexed pages with
real content** do.

1. **`/services/{category}/{area}` pages** — "Cleaning services in Ramat Beit
   Shemesh" is what people actually type. That is one indexable page per
   category × area, each with real listings, and it is a far larger surface than
   seven new categories.
2. **Gate on content** — three listings minimum before indexing (N3), so the
   crawler never meets a thin page.
3. **Bilingual pages, properly** — Hebrew and English versions with correct
   `hreflang`. We already store `title_he`/`description_he`; almost nobody in
   this niche does the bilingual SEO properly.
4. **The empty ones still recruit** — a category with no listings is `noindex`
   for Google and a "be the first" pitch for the human who arrives from a link.

## N8 — Product search: see everything, compare prices

Tzvi, 27 Aug 2026:

> *"If a person can search for dessert, the website pulls all the dessert
> business pictures so they can easily see what looks best and compare prices of
> products."*

This is a **different result type from anything the site has**, and it is the
strongest argument yet for having a search box at all.

### Why it doesn't work today

Search matches gig `title`, `description` and their `_he`/`_en` variants
(`shared.py:786-825`). **Product names are never searched.** A bakery whose
listing is called "Miriam's Kitchen" and whose products include "chocolate babka"
and "date cookies" is invisible to a search for *dessert* — the word appears
nowhere in the indexed fields.

And results are **one card per listing**. Someone comparing desserts does not
want seven bakery cards; they want the actual cakes, side by side.

### What to build

**Index products.** `ProductItem` already carries `name`, `price`, `currency`,
`images`, `in_stock` (`shared.py:350-371`). Add product names and descriptions to
the search corpus, in both languages.

**A product results mode.** When a query matches products across more than one
business, offer a **Products** view beside the usual listings view:

- **Photo-led grid, one uniform aspect ratio.** Comparison requires alignment —
  ragged card heights destroy the ability to compare, which is the entire point.
- Each tile: product photo · product name · **price** · business name · area ·
  in-stock state.
- Tapping the tile goes to that product on that business's page. Never a
  checkout — we do not process money.

**Make the prices honestly comparable:**

- Same currency, converted only if we can state the rate and date. Otherwise show
  the original currency and do not convert.
- **Show what the price is for.** ₪40 for six cookies against ₪40 for one cake is
  a false comparison presented as a true one. If a quantity or unit exists, show
  it; if it doesn't, show the price plainly and **never invent a unit price.**
- `in_stock: false` items render greyed and sort last. They are never hidden — a
  sold-out product still tells a visitor what a business makes.

### The trap: this must not become a race to the bottom

A price-comparison grid pressures every business toward being cheapest, and the
perks spec already rejected that framing explicitly — discount-led positioning
"frames the business as cutting price rather than making an introduction."

So:

- **Default sort is relevance, never price.** Price sort is available and clearly
  labelled; it is not what someone sees first.
- Every tile carries a quality signal beside the price — rating where there is
  one, verified, top-rated. **Price is never the only differentiator on screen.**
- **No "cheapest" badge. No strike-through comparisons. No "N others cheaper."**
  We are a place to be found, not a price war.

### Businesses with no product photos

`docs/service-card-visibility-spec.md` S5 ruled that photoless businesses stay
fully listed. In a photo grid that ruling needs help, because no photo means
invisible rather than merely plain:

- A designed placeholder derived from the business name — reuse `CoverPlaceholder`'s
  deterministic tint, **not** the `#EDE7DA`/`#EFE9DC` near-match that made cards
  disappear into the page background.
- Placeholder tiles rank normally but **never fill the first row alone** — a grid
  opening on six placeholders reads as a broken page.
- The owner sees a prompt: *"Add a photo — this is what people compare."*

### The competition rule, and where it stops

`docs/recommendations-spec.md` forbids showing competitors to a **referred**
visitor — someone who arrived by a business's own QR or link. That rule governs
**recommendation rails**, which we choose to show.

**It does not govern a search the visitor typed.** Someone who searches *dessert*
has asked to see every dessert; withholding results would be answering a
different question than the one they asked. State this boundary explicitly in the
code, because the two features will sit next to each other on the same page and
the rule will otherwise get copied across by accident.

### This changes the search-box decision

`ad95644` removed the search box, reasoning that *"a category cannot go below
itself"* is outweighed at ~200 listings, where browsing seven cleaners is no
hardship.

That reasoning holds for **listings** and fails for **products**. Product search
goes below the listing, to a level browsing cannot reach at any catalogue size —
no amount of category navigation surfaces "the chocolate babka at Miriam's."
A business with 40 products is 40 things a visitor can find, and today the
category dropdown surfaces exactly one of them: the shop.

**Restore the box together with product search.** The component is intact in
`1ed67e2` with its debounce, `dir="auto"` handling and bilingual strings; Code
left the check pinned so restoring it will not fail confusingly.

## N9 — Let people create categories that don't exist yet

Tzvi, 27 Aug 2026: *"I want people to be able to create categories that don't
exist and people can add to it, like on Facebook Marketplace."*

**The mechanism already exists and is ungoverned.** `subcategory` accepts a known
slug **or up to 40 characters of free text** (`shared.py:518-536`) — so an owner
can already invent one. What's missing is a way to see them, a way for a second
person to reuse one, and anything stopping the list rotting.

### The failure this must avoid

Open taxonomies collapse, reliably and fast. Left alone we get *Cleaning*,
*cleaners*, *House Cleaning*, *home cleaning*, *ניקיון* and *Nikayon* — six
entries, one listing each, and **search gets worse, not better**, because supply
that should have pooled is scattered across six near-identical labels.

Bilingual doubles it. Without a bridge, Hebrew and English speakers build two
parallel taxonomies over the same businesses and neither sees the other's.

So the rule is: **anyone may create one; matching an existing one is always
easier than creating a new one.**

### How it works

**1. Suggest before creating — this is the whole anti-fragmentation mechanic.**
As the owner types, match live against every existing category, subcategory and
emerging tag, **in both languages**, fuzzily (case, punctuation, plurals,
whitespace). Show matches first:

> Typing *"house cleaning"* →
> **Cleaning Services** — 23 businesses · **[ Use this ]**
> *…or create "house cleaning"* (quieter, secondary)

Creating stays available and easy. It is simply never the *first* thing offered,
and the count beside the match does the persuading — 23 businesses is obviously
a better place to be found than a category of one.

**2. New entries are tags, not categories.** A created label attaches to the
listing, is searchable, is displayed as a chip, and **others can add to it** —
which is the part Tzvi asked for. What it does *not* get until it earns it: a
navigation entry, an indexed page of its own, or a slot in the picker's groups.

**3. Graduation, by the rule already in N2.** At **15 published listings** a tag
is proposed to an admin for promotion to a real subcategory or category. Growth
promotes it; nobody argues each case.

**4. An admin queue.** Emerging tags with counts and first-seen dates, and four
actions: **merge into** an existing one (the common case, and it must rewrite the
listings), **rename**, **promote**, **reject**. Merging is what keeps this alive
at year three.

**5. Moderation.** Free text on a public page is an abuse surface. New tags are
visible on their own listing immediately, but **do not appear in the suggestion
list to other users until an admin has cleared them** — otherwise the first
spammer's keyword gets recommended to every subsequent poster. Report path on
every tag chip.

**6. Bilingual from the start.** A tag carries both an English and a Hebrew label
where known; matching checks both. When an owner creates one in Hebrew, offer a
machine translation for the other side and let an admin confirm it at promotion.
Two languages, one tag — never two tags.

## N10 — Filters

Tzvi asked for filters "like Facebook Marketplace." The honest finding first.

### We do not have a filter shortage. We have a placement problem.

Already built and working: minimum rating, price min/max, response time,
languages, max distance, booking method (`ServicesFiltersModal.jsx:139-261`),
plus category, budget ceiling, date, location chips, "available now", "show
nearby", and six sort orders.

**Almost all of it lives behind a "More filters" button.** Facebook's advantage
is not that it has more filters — it is that its filters are *visible without a
click and stay applied while you browse*. Adding filters into a modal nobody
opens makes the situation worse, not better.

**So restructure before adding anything.**

### N10a — Three tiers, by how often they are used

**Tier 1 — always visible, one tap, in the results header as toggle chips.** No
modal, no menu:

`English spoken` · `Open now` · `Kosher` (food categories only) · `Delivers` ·
`Verified` · `Has photos`

These are binary, high-frequency, and each one meaningfully cuts the list.

**Tier 2 — the hero bar.** Category · Where · Price · **Search** (restored, N8).

**Tier 3 — the modal, for the rest.** Rating, response time, distance radius,
booking method, languages beyond English, condition, date listed.

**On mobile**, Tier 1 becomes a horizontally scrolling chip row pinned under the
header — the pattern people already know from every app they use.

### N10b — The filters that are actually ours

These are the ones no Israeli competitor offers, and they are the reason someone
uses this site instead of Yad2:

**1. Language spoken — promote it to Tier 1.** It exists
(`ServicesFiltersModal.jsx:240-244`) and is buried. *"An English-speaking
plumber"* is the entire reason this site exists for its audience. It should also
be a **remembered account preference**, not re-selected every visit.

**2. Kosher certification — build it.** `kosher_certification` already exists on
the business (`KosherCert`, `businesses.py:66-75`) and is **not filterable**.
This is the most valuable kind of filter there is: for someone who keeps kosher,
an uncertified bakery is not a worse option, it is **not an option**. A
disqualifying filter saves more time than any preference filter.

Show the certifying authority, never just a badge — *Rabbanut Jerusalem*,
*Badatz Eda Charedit* and *Rabbanut* mean different things to different people
and we must not flatten them. Food categories only; invisible elsewhere.

**3. Shabbat and chag.** Derivable from `weekly_availability` and worth a Tier 3
control: *"open Friday afternoon"*, *"open motzei Shabbat"*, *"closed Shabbat"* —
the last being a positive signal to a large part of this audience, not a
limitation. **State the fact, never editorialise about observance.**

**4. Serves my area vs located in my area.** Businesses have `areas[]`; gigs
filter on the `area` **string** by regex (`gigs.py:143-149`). A Tel Aviv mover
who serves Jerusalem is invisible to a Jerusalem search today. *"Serves"* is the
question a customer is actually asking.

**5. Delivers / pickup / comes to you.** `delivery_note` exists as free text and
cannot be filtered. Make it structured for store and product listings.

### N10c — Standard ones we are missing

- **Date listed / "new this week."** No freshness concept exists at all (L12 in
  the benchmark spec). Needed for items especially.
- **Condition** — new / like new / good / used. For N4 items.
- **In stock** — `ProductItem.in_stock` exists and is unfilterable.
- **Distance as a visible radius**, not a modal field gated behind a separate
  "show nearby" toggle. Israel is small; *"within 10km of me"* is more natural
  than picking one of twelve cities.

### N10d — The mechanics that make filters work

More important than any individual filter:

**1. Live counts on every option.** *"English (23)"*, *"Kosher (7)"*. This does
two jobs at once — it guides the choice, and it stops someone selecting their way
into an empty page. Cheap to compute over a result set we already fetch.

**2. Never dead-end. Relax and say so.** L6 in the benchmark spec: drop the
narrowest filter, name what was dropped, show results. *"No English-speaking
electricians in Beit Shemesh. Showing 4 in Jerusalem."* Never an empty grid.

**3. Filters survive navigation.** Open a listing, press back, filters are still
applied. Everything stays in the URL, so a filtered view is shareable — that is
free distribution and we already do this for the existing controls.

**4. One-tap clear, always visible when anything is applied.** The chip strip
(`Services.jsx:623-692`) already does this well. Extend it, don't replace it.

**5. Save this search.** Services have no saved search or alert at all — only the
jobs board does. *"Tell me when an English-speaking piano teacher lists in
Jerusalem"* converts a failed search into a returning visitor, and a failed
search is currently a permanent loss.

### N10e — What not to copy from Facebook

- **No "hidden" or "seen" state.** It exists there to churn an infinite feed. Our
  supply is small; hiding a listing from someone who might need it in March is a
  loss with no upside.
- **No engagement-weighted default sort.** It buries new listings, which is fatal
  at our size.
- **No filter that returns nothing without saying why.** See N10d.2.

---

## Order

1. **N2** grouped picker — the condition on everything else
2. **N1** the new categories, minus the three needing review
3. **N3** be-the-first empty state, with the `noindex` gate
4. **N5** surface the shops capability — cheapest win here
5. **N8** product search + restoring the search box — the biggest visitor-facing
   change in this document
6. **N9** owner-created tags, with the suggest-before-create matcher
7. **N4** items on the Requests board, with the category filter fix (L11)
8. **N6** reporting, rate limits, safety copy — **ships with N4, not after**
9. **N7** category × area pages
10. `money-exchange`, `immigration-documents`, `medical-health` once reviewed

## Constraints

- Category slugs are permanent once live — a printed QR or a shared link encodes
  them. Add to `CATEGORY_MIGRATION` rather than renaming, ever.
- Groups are presentation only. No `group` field on stored records.
- Every label and empty state in `en.js` and `he.js`; verify RTL at 1280/768/375.
- `brand/design-tokens.css` is law; green stays functional-only.
- Items never appear in the services grid or in service ranking.
- Never imply we hold money, process payment, or protect a buyer.
