# Rules for AI-built pages

Written 23 Sep 2026 (Tzvi: "create rules so we can get the best output for users").
The rulebook the page generator follows when it builds a business page, and the
automatic check that throws away any page breaking it.

- Builds on `docs/ai-page-builder-spec.md` (the vocabulary, P2 dials, P4 quality
  floor, P4a clarity floor, P7 brief). Where that document says what the builder
  IS, this one says how a page it makes must be BUILT and WRITTEN.
- The check: `backend/utils/page_rules.py` (`check_composition`, `check_options`).
  Every rule below marked with an id in `code` is enforced there, with the same id.
- The golden set: `backend/tests/test_page_rules.py`. One business per playbook with
  a page that passes in English and Hebrew, and one case per way of failing.
  **When a bad page slips through in real use, it becomes a case there.** That is
  how these rules get better over time.

The AI is not switched on yet. When it is, it receives this document's rules as
its instructions, and nothing it makes reaches an owner without passing the check.

---

## 1. The job, in one line

Arrange what the business told us into the clearest page for someone deciding
whether to use them, in their language, without adding a single fact of our own.

## 2. What the AI gets, and the only facts it may use

- **The brief** (P7b): what they show, what visitors should do, who it's for,
  where their prices sit, up to two strengths, their 200-character note.
- **The business**: name, description, areas, hours, languages, founding year,
  licence number, kosher certificate, verified, review count and average.
- **Their listings**: titles, descriptions, prices, photos.
- **Their photos**: cover, logo, listing photos. Referenced, never copied or linked.

**Anything not in that list does not go on the page.** Not a number, not a
"since 1998", not "fresh every morning", not "trusted by families". If the owner
did not say it and we cannot prove it, it is not true as far as the page knows.

## 3. Hard rules (checked: a page breaking one is thrown away and remade)

Never patched. A patched page is one nobody chose (P1, P4a).

| Id | Rule |
|---|---|
| `schema` | Only our blocks, variants and dials. No links, no code, no styles. |
| `language` | Everything written is in the page's language. A Hebrew page has Hebrew in every line (their business name may stay as it is). |
| `hero` | A headline at the top that says **what they do and where**, in at most 10 words. Never just their name again, since the page already shows it. One hero only. |
| `numbers` | Every number on the page comes from their own words or our facts (their prices, founding year, review count). |
| `claims` | A claim needs its proof or the owner's own words. **Kosher** needs a certificate, and is said only on a food business. **Licensed** needs a licence number. **Verified** needs verification. **Reviews, stars, "customers love"** need reviews. **Years, "since", "established"** need a founding year. **English** needs English among their languages. Only the owner's own words can back **best, #1, leading, award, the only, cheapest, guarantee, insured, 24/7, emergency, fresh daily, delivery, trusted by, thousands of**, or anything medical (**cure, heal, weight loss, treatment for**). |
| `urgency` | Never: "only 3 left", "hurry", "today only", "booked 11 times", "limited time", "don't miss". Nothing we hold is a real, current count. "Open only on Fridays" is a fact, not urgency. |
| `generic` | No sentence that could describe any business: "welcome to", "look no further", "one-stop shop", "passionate about", "quality you can trust", "your satisfaction", "world-class", "top-notch" (and the Hebrew equivalents). |
| `punctuation` | No exclamation marks. No long dashes (the site's copy rule). No words in capitals unless it's their name. |
| `structure` | At most 10 blocks. No doubled contact, facts or gallery. No two dividers in a row, and don't end on one. |
| `action` | What the brief asks visitors to do has a place to do it: book or order needs the services block, message needs contact, visit needs the facts (hours, address). |
| `images` | Only their own photos, and only ones that exist. A photo gallery needs at least 3 photos. Full-bleed imagery needs a cover photo. |
| `prices` | Loud prices only when there are prices, and never on a premium or quote-based brief. A premium brief is never packed. |
| `playbook` | The category's lead block comes first and its must-have blocks are there (section 6). |

Three options (P7d, `check_options`): each passes on its own, and **they really
differ**. Every pair differs in at least two dials or in the order of blocks, and
no two share a headline. Three near-copies is one option shown three times.

## 4. What is reported to the owner instead (content gaps)

Some things are missing because of the business's data, not the page: no reviews
yet, no founding year, a service with no Hebrew name, no action chosen in the
brief. All three options would share them, so **they never reject a page**. They
come back as `content_gaps` and are what the owner is asked to add, most useful
first. The page itself must still look deliberate without them: "Ask for a
quote" instead of a missing price, no reviews section instead of an empty one.

## 5. How to write

1. **Their words first.** Reuse the owner's own phrasing from their description
   and note wherever it works. We tidy; we don't replace their voice.
2. **Specific over generic.** "Sourdough and challah in Beit Shemesh" beats "Quality
   baked goods". A sentence has to be about this business.
3. **Headline formula: what + where**, or what + for whom. At most 10 words.
   The name is already on the page.
4. **The lede says the one thing a visitor needs to act.** How to order, by when,
   what a first visit costs, which areas they cover. One or two short sentences.
5. **One accent word at most**, and it's a word that matters (the thing they sell),
   not decoration.
6. **Plain words.** Say it the way the owner would say it to a customer. No
   marketing voice, no exclamation marks, no long dashes.
7. **Hebrew is written, not translated.** Natural Hebrew word order and phrasing,
   plural and gender forms right, the same facts as the English. A Hebrew page is
   judged in Hebrew.
8. **Address the visitor as "you"**, never the business's customers in the third
   person. On the page the business speaks as "we" or in its own name.
9. **Strengths only if backed.** At most two, and a checkable one (kosher,
   experience, licensed, English) appears only with its proof.

## 6. Playbooks for the most common businesses

The categories with the most businesses on the live site on 23 Sep 2026 (public
pages: 48 services from 41 businesses; 165 rentals). The number in each heading is how many businesses offer that category. Each playbook says what a
visitor is deciding, what leads the page, the proof that matters, the action, and
the mistakes to avoid. The lead block and must-have blocks are checked
(`playbook`); the rest guides the AI.

Examples are illustrations for an imaginary business, never text to reuse.

### Shops and products (16 businesses: bakeries, dips, boards, gifts)
- **Deciding:** what it looks like, what it costs, whether it's kosher, how to get it.
- **Lead:** the catalogue with photos and prices (`services`), or a photo gallery
  when there are at least 3 photos. **Must have:** services.
- **Proof:** kosher certificate (food only), reviews.
- **Action:** order when there is a store listing, else message.
- **Dials:** grid imagery, normal or loud prices unless premium.
- **Avoid:** "fresh daily", "delivery" or "free delivery" unless they said so;
  kosher without a certificate; hiding prices they gave us.
- *Example headline:* "Sourdough and challah in Beit Shemesh".

### Personal care (5: hair, beauty, spa, therapy)
- **Deciding:** results, trust with their body, who does it, how easy it is to book.
- **Lead:** services with durations and prices, or their own photos. **Must have:** services.
- **Proof:** reviews, years in business, verified.
- **Action:** book.
- **Dials:** calm: airy or balanced, quiet or normal prices.
- **Avoid:** medical or result promises ("cures", "heals", "anti-aging results");
  before/after images that aren't theirs.

### Home services and repair (5: handymen, electricians, plumbers)
- **Deciding:** can they fix my problem, how soon, do they cover my area, are they licensed.
- **Lead:** the jobs they do (`services`, list) or the facts (areas, hours, licence).
  **Must have:** services and facts.
- **Proof:** licence number, years, reviews.
- **Action:** message for a quote, or book.
- **Dials:** balanced or packed, grotesque type, quiet prices on a quote brief.
- **Avoid:** "24/7", "emergency", "same day" unless they said so; "licensed"
  without a licence number; "insured".

### Events and catering (4)
- **Deciding:** the food, the kosher level, whether they do my size of event, the date.
- **Lead:** their food photos (`gallery`, 3 or more) or the menus. **Must have:**
  services and facts.
- **Proof:** kosher certificate, reviews.
- **Action:** message with the date, or book.
- **Dials:** full-bleed imagery with a cover photo, normal prices.
- **Avoid:** "any size event", guest counts, kosher level beyond the certificate.

### Cleaning services (3)
- **Deciding:** what's included, the price, reliability, the area.
- **Lead:** services with prices, or facts. **Must have:** services and facts.
- **Proof:** reviews, verified, years.
- **Action:** book.
- **Avoid:** "insured", "background-checked", "eco products" unless they said so.

### Health and fitness (2: trainers, classes)
- **Deciding:** who the trainer is, the kind of sessions, where, when, the price.
- **Lead:** services, or their own photos. **Must have:** services.
- **Proof:** reviews, years, licence where relevant.
- **Action:** book.
- **Avoid:** weight-loss or health promises, medical words, body-image pressure.

### Travel and tourism (2: guides, tours)
- **Deciding:** the route, the language, how long, the price per person, a licensed guide.
- **Lead:** photos (`gallery`, 3 or more) or the tours. **Must have:** services and facts.
- **Proof:** licence number for "licensed guide", English among their languages, reviews.
- **Action:** book or message.
- **Avoid:** "licensed guide" without a licence; famous-landmark photos that
  aren't theirs; group-size or "best views" claims.

### Rentals (165 listings: 104 long-term, 56 vacation)
Not buildable yet: the block library has no property block (open decision 2).
When it does:
- **Deciding:** photos, price per night or month, location, availability, rules.
- **Lead:** photos, then price and dates.
- **Proof:** verified stays (the new reviews), verified owner.
- **Action:** book or message.
- **Avoid:** distances ("2 minutes from the Kotel") and "luxury" unless the owner
  wrote them.

### Any other category
- **Lead:** services, facts or gallery. **Must have:** services.
- The hard rules and the writing rules apply unchanged.

## 7. Choosing the three options

Give the owner a real choice between three directions, each true to the brief:

1. **The brief taken straight:** the dials briefToTheme() would set, the playbook lead.
2. **Photo-led:** when there are enough photos, a gallery or full-bleed lead;
   otherwise a different lead from the playbook.
3. **Words-led:** facts or services first, denser or quieter, a different type pairing.

Each has its own headline. None breaks a hard rule.

## 8. Open decisions (need Tzvi)

1. **Hebrew and English on one page.** The page design holds hero text in one
   language only, so today a bilingual page means two designs. Recommended: give
   the headline, accent and lede a Hebrew twin in the design, so the AI writes both
   and each is checked in its own language.
2. **Rentals.** There's no property block, so the rentals playbook waits. Adding
   one is the next block to build if rental owners are meant to use the builder.
3. **Blocks the playbooks want and don't have:** a reviews block (the verified
   reviews), a price list or menu block, a short FAQ. Add them as owners ask (P6,
   phase 4).
4. **Advice rules.** Everything above rejects. If some rules turn out too strict
   in practice (say, the 10-word headline), they can become advice fed back to the
   AI instead of a rejection. Decide once there are real pages to look at.
