# The goods marketplace — item types, specifics and filters

Written 30 Aug 2026, after four parallel agents mapped the code, researched the
market, specced the psychology and QA'd a design preview.

Supersedes `docs/categories-expansion-spec.md` §N4 for anything about goods.
Related: `docs/goods-marketplace-psychology.md`, `docs/marketplace-benchmark-spec.md`
(L6 relaxation, L11 board filters), `goods-marketplace-preview.html`.

---

## Start here: most of this is already built

`request_type: "item"` on the Requests board already has `condition`,
`pickup_area`, up to 8 photos (`MAX_ITEM_PHOTOS`, `requests.py:108`), a
reversible `item_status: available|sold` kept deliberately separate from `status`
(`:706-712`), per-day caps with a tighter tier for accounts under a week old
(`:121-123`, `_enforce_item_daily_limit:430-477`), a report button with auto-hide
at three reports (`:907-932`, `REPORT_HIDE_THRESHOLD:94`), and a working admin
moderation backend (`admin/marketplace.py:274-370`).

**The problem is not that goods are unbuilt. It is that they are unfindable and
unfiltered.** Three specific gaps, all verified:

1. **Item filters are backend-only.** `list_requests` accepts `condition`,
   `min_price`, `max_price`, `include_sold` (`requests.py:531-538`).
   `RequestsBoard.jsx:421-432` sends only `request_type`, `post_kind`, `area`,
   `q`. There is no price or condition control in the UI at all.
2. **The moderation queue is unreachable.** Both admin endpoints work; nothing in
   `frontend/src` calls them, and `AttentionQueue.jsx:43-86` omits
   `posts_awaiting_moderation` even though `GET /admin/attention` returns it.
3. **Items are invisible to the digest.** `_match_recipients` (`:1174-1175`)
   handles service-with-category and rental-with-area, then `continue`s. Items
   match nobody.

---

## G1 — Remove payment links from item listings

**Ruling (Tzvi, 30 Aug 2026): remove.** The reasoning is worth recording because
the allowlist is genuinely good engineering and it would be easy to re-add later
without remembering why it went.

`backend/utils/payment_links.py` is built and correct: closed domain allowlist,
registrable-domain matching, HTTPS only, refused at the model. **The security of
the link was never the problem.** The problem is what a payment link *invites* on
a peer-to-peer goods listing.

The dominant Israeli marketplace scam right now, per ISOC-IL's May 2026 alert and
recent prosecutions, is advance payment to a stranger: forged bank-transfer
screenshots, fake courier invoices, a "GLS shipping fee" payable in Bitcoin, an
Israel Post phishing link. Every one of them requires the victim to pay before
they hold the item. A **Pay now** button on a private seller's listing is a
purpose-built ramp onto that path, and it carries our name.

The BBB's loss-rate-by-rail data is the sharpest version of this: prepaid card
97%, Zelle 97%, bank debit 86%, PayPal 74%, credit card 70%. **A platform that
touches no money has exactly one high-value lever, and it is steering people away
from paying strangers in advance.** A payment button points the other way.

So:

- **No payment link on any item listing, private or business.** Business *pages*
  keep theirs (`docs/business-page-customization-spec.md` P1) — a bakery's page is
  a storefront for a known business, which is a different trust context from a
  stranger's sofa.
- Keep `payment_links.py`. It is used elsewhere and it is good code.
- In its place, one line on every item: **"Pay when you collect. Never transfer
  money before you have the item."** Both languages.
- **Interstitial, not a banner**, when a chat message clusters advance-payment
  language with distance language: deposit, hold it for me, I am abroad, my
  courier will collect, send the fee. The BBB found that where a bank or card
  company intervened, **40% of targets avoided losing money.** Friction at the
  payment moment is the one intervention with a measured effect.

## G2 — Goods need their own category tree

Items currently take `category` from the **services** taxonomy
(`requests.py:195`, optional for items). So a sofa is offered "Cleaning Services"
and "IT & Tech Support". A `buy-sell` slug was added to that taxonomy on 28 Aug
and removed hours later, with the correct note: *"Do not put items in the services
grid."*

**Add a separate `ITEM_CATEGORIES` list.** Do not reuse, extend or alias the
services one. Two taxonomies, two purposes.

The tree, chosen for liquidity in this audience rather than for completeness:

| Slug | Label | Why |
|---|---|---|
| `furniture` | Furniture | Highest listing volume in every local marketplace. Unshippable, so local is the only channel |
| `appliances` | Appliances | The olim-arrival category. Voltage matters, see G3 |
| `baby-kids` | Baby & kids | Best liquidity of any category: a short use window puts both sides on a predictable clock |
| `electronics` | Electronics & computers | High demand, highest fraud. Requires the serial field in G3 |
| `home-kitchen` | Home & kitchen | Everything a new apartment needs that is not furniture |
| `books-judaica` | Books & Judaica | Sefarim, English books. Small volume, zero competition |
| `olim-essentials` | Olim essentials | Transformers, US-spec appliances, plug adapters. **Structurally ours** |
| `bikes-scooters` | Bikes & scooters | Good demand, and the frame-number control is established |
| `garden-outdoor` | Garden & outdoor | Seasonal, bulky, local-only |
| `sports-hobby` | Sports & hobby | Broad catch-all, honest about being one |
| `other` | Something else | Always. A taxonomy with no escape hatch loses listings |

**Not included, deliberately:** clothing (needs shipping and structured
brand/size to work at all; local pickup for a ₪40 dress does not clear the
friction bar), vehicles (21% of Facebook Marketplace fraud cases, highest-cash
meetups, and Yad2 owns it), tickets, gift cards and pets (25.2% of BBB online
purchase scams, median loss $660). **Ban tickets, gift cards and pets outright**
at the model, with a message naming what is accepted.

## G3 — Item specifics: this is what "eBay-style filters" actually means

Filters are not a UI feature. **A filter can only exist where a structured field
exists**, which is why eBay built item specifics before it built faceted search.
Today an item carries `condition` and nothing else, so `condition` is the only
facet possible.

**Add `attributes: dict[str, str]` on the item, with a per-category schema.**

The schema lives in ONE place, is versioned, and each field declares: key, label
(en/he), type (enum | number+unit | text | bool), whether it is a facet, and
whether it is required.

### Shared by every category

`brand` · `colour` · `condition` (exists) · `pickup_area` (exists) ·
`delivery` (collection only / seller can deliver / either)

### Per category, the fields that earn their place

**Furniture** — `dimensions` (W x D x H cm) · `material` · `assembly_required` ·
`fits_through_door` (bool, and it is the question everyone asks second)

**Appliances** — **`voltage` (220V / 110V / dual)** · `plug_type` (IL / EU / US /
UK) · `capacity` · `age_years` · `shabbat_mode` (bool, ovens and hotplates only)

**Electronics** — `brand` · `model` · `voltage` · **`serial_or_imei`** ·
`interface_language` (Hebrew / English / both) · `battery_health`

**Baby & kids** — `age_range` · `brand` · `safety_standard` ·
`expiry_date` (car seats only, and it is a genuine safety field)

**Books & Judaica** — `language` · `volumes` · `nusach` · `binding`

**Olim essentials** — `voltage_in` · `voltage_out` · `wattage` · `plug_type`

**Bikes & scooters** — `frame_size` · `wheel_size` · **`frame_number`** ·
`electric` (bool)

### Two of these are safety controls, not conveniences

**`serial_or_imei` on electronics and `frame_number` on bikes.** A fence cannot
publish a serial number, and it costs an honest seller nothing. Optional, but
show a visible "Serial provided" marker when present and let buyers filter on it.

### Voltage is the single most valuable field on this site

An oleh arriving with a 110V American appliance, or trying to avoid buying one,
has no way to filter for this anywhere in Israel. Yad2 does not have the field.
Facebook groups cannot have it. **This is the clearest example of an attribute
that is worth more to our audience than to anyone else's**, and it costs one enum.

### The friction rule

**None of this may slow listing down.** The research is unambiguous that listing
is the scarce act, and eBay measured 50% fewer steps purely by moving photos to
position one.

So: **the photo produces the attributes; the seller confirms them.** Vision reads
the image, drafts brand, colour, material, rough dimensions and category, and the
seller's job is *review*, not authorship. Only ever one required field beyond
photo and category. Everything else is pre-filled and correctable.

Whatnot's finding is the one to hold onto: **speed for the seller, structure for
the buyer, paid for once.** Adding `brand` to one category lifted new-buyer
conversion over 12%. And templates beat fields for repeat sellers, three to six
per seller.

## G4 — Filters, as facets over the attributes

Once G3 exists, filters are a rendering problem.

**Always visible, above the grid:** category · price range · condition · area ·
`delivery` · seller type (private / business)

**Category-dependent, appearing only where they apply:** voltage on appliances
and electronics, age range on baby, frame size on bikes. A voltage filter on a
bookshelf is noise.

**Sort:** newest (default) · price low to high · price high to low · closest.
**Never engagement-weighted** — it buries new listings, which is fatal at our size.

Mechanics, all of which matter more than any individual filter:

- **Live counts on every option.** "220V (14)", "Jerusalem (38)". Guides the
  choice and stops people filtering into an empty page.
- **Never dead-end. Relax and name what was dropped.** *"No 110V appliances in
  Efrat. Showing 6 in Jerusalem."*
- **Everything in the URL**, so a filtered view is shareable and survives back.
- **Sold items excluded by default**, with an explicit "include sold" toggle.
  `include_sold` already exists in the API and is unused.
- **Save this search**, which turns a failed search into a returning visitor.

**Watch the architecture.** Gig filtering already applies rating, price band,
response bucket, languages and date availability **in Python after a Mongo fetch
of `limit * 3`** (`gigs.py:176-274`). Stacking attribute facets on that pattern
will produce wrong counts and short pages. Attributes must be queried and
counted in the database. If exact counts are not achievable, **say so and show
none** — a count that lies is worse than no count.

## G5 — What to fix in what exists

1. **`poster_verified` means "signed in with Google"** (`requests.py:315-322`)
   and is labelled **Verified**. On a board where strangers meet to exchange cash
   this is an active overclaim. Relabel it "Signed in with Google", or drop the
   badge. This week, regardless of everything else here.
2. **Wire the item filters that already exist** — `condition`, `min_price`,
   `max_price`, `include_sold` (L11).
3. **Surface the moderation queue.** Add `posts_awaiting_moderation` to
   `AttentionQueue.jsx` and build the admin view for the two endpoints that
   already work.
4. **Make items match in the digest.** Wire the `else: continue` at `:1174-1175`
   to match saved item searches by category and area.
5. **Add product names to the search corpus.** `_search_clauses`
   (`shared.py:987-994`) covers six title/description fields and nothing else.
6. **Chat has no rate limit** at all (`chat.py`, no `check_rate` import). A goods
   board with strangers messaging strangers needs one.
7. **EXIF is stripped only incidentally.** `fastUpload.js` redraws through canvas,
   which drops EXIF as a side effect, but every skip path uploads the original
   with EXIF intact, **including HEIC, which is the iPhone default and the most
   likely to carry GPS**. Strip GPS deliberately. Someone photographing a sofa in
   their living room should not publish their address.

## G6 — Fix the preview before building from it

QA rendered `goods-marketplace-preview.html` and found three blockers: the
composer textareas hide up to 46% of the drafted text at 1280; the English half
of the bilingual composer inherits `direction: rtl` when the page flips; and the
browse grid contradicts its own results bar. Full list in the QA report, with
line numbers and exact fixes.

Also corrected there, and worth propagating: **`--gold-lg` on limestone measures
2.92:1**, below even the 3:1 large-text floor, and `home-conversion-preview.html`
hovers its gold button to 3.53:1.

---

## Order

1. **G5.1** the verified overclaim, then **G5.7** GPS stripping. Both small, both
   are about someone getting hurt.
2. **G6** fix the preview blockers.
3. **G2** the goods taxonomy. Nothing else can be right until items stop
   borrowing the services tree.
4. **G3** item specifics, schema first, then the vision-assisted listing flow.
5. **G4** filters as facets, with live counts.
6. **G1** remove payment links from items; add the pay-on-collection line and the
   advance-payment interstitial.
7. **G5.2 to G5.6** the wiring gaps.

## Constraints

- **No payments on items. No escrow. Never the words "buyer protection".**
- Category slugs are permanent once live. `CATEGORY_MIGRATION`, never rename.
- Every label, attribute name and enum value in `en.js` and `he.js`.
- **Show the denominator, never a star average.** At our volume a five-star
  average reads 5.0 for everyone, including the scammer.
- Real counts or none.
- `brand/design-tokens.css` is law; green stays functional-only.
- Verify at 1280 / 768 / 375 in both directions. Attribute tables in RTL are the
  hard case.
