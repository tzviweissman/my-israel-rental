# Rules for AI-built pages

Written 23 Sep 2026 (Tzvi: "create rules so we can get the best output for users").
The rulebook the page generator follows when it builds a business page, and the
automatic check that throws away any page breaking it.

- Builds on `docs/ai-page-builder-spec.md` (the vocabulary, P2 dials, P4 quality
  floor, P4a clarity floor, P7 brief). Where that document says what the builder
  IS, this one says how a page it makes must be BUILT and WRITTEN.
- Draws on what we already learned: the three practice pages (`scrollcraft/builds/`:
  Blazin' Boards, Lechem Emek, Michal Simkin, and `scrollcraft/FINGERPRINTS.md`),
  the design-kit skills (scroll-craft, taste-skill, page-conversion-review,
  design-loop, visual-diff), the project's frontend skill, and the session
  lessons on generated video. Sections 5a to 5c, 8 and 9 are where those live.
- The check: `backend/utils/page_rules.py` (`check_composition`, `check_options`, `check_unique`).
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
| `hero` | A headline at the top that says **what they do and where**, in at most 10 words, with at most 20 words under it. Never just their name again, since the page already shows it. One hero only. |
| `congruency` | The headline or the line under it names something they actually sell, in the words of their own listings. A place name alone doesn't count. |
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

**Every page is its own** (`check_unique`; Tzvi, 23 Sep 2026: "not every page
should have a rolling jar, each should be unique"). A new page must differ from
each recent page of the same kind of business on at least 3 of 6 things: what
leads, the order of sections, the hero's shape, imagery, type, and density. The
hand-built pages already hold themselves to 4 of 6 (`scrollcraft/FINGERPRINTS.md`).

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

## 5a. Lessons from the practice pages

What Blazin' Boards, Lechem Emek and Michal Simkin taught, in the order they matter:

1. **Find what the business actually has before choosing a look.** Their photos,
   their numbers, the one fact that is really theirs. Blazin' Boards sells boards in
   sizes; that became the page.
2. **The product performs, not the camera.** Movement shows the thing they sell.
   Zooming for its own sake "isn't doing anything" (Tzvi on Blazin' Boards rev 2);
   the jar rolling as the page scrolled was the part that worked.
3. **Only their photographs of their work, people and place.** "A generated face
   here would be a lie about a client" (Michal Simkin). Rev 3 of Blazin' Boards
   dropped generated media and used the owner's own photos.
4. **Only their numbers**, never round marketing ones.
5. **No blank screens.** Every screen shows something of theirs.
6. **One signature idea, and it is theirs.** The test: could a visitor describe it
   to a friend in one sentence? (Boards growing through real sizes with a ruler and
   their prices; real clients' own before and after; one scroll taking a bakery from
   night to dawn.) Never carried over to the next business.
7. **One peak per page.** One moment gets the most room and quiet before it; a page
   with three peaks has none. The ending resolves on the action, never fades out.
8. **Check what renders, not what was written.** An independent pass on Blazin'
   Boards found a bar that measured 102px where 84 was assumed, hiding content, and a
   button that went to the top of the page and looked broken.

## 5b. Design craft (taste-skill, scroll-craft, the frontend skill)

1. **The top of the page holds at most 4 pieces of text**, the headline takes at
   most 2 lines, and the line under it at most 20 words.
2. **One wording per purpose.** If the button says "Order", it says "Order"
   everywhere, not "Buy" in one place and "Get yours" in another.
3. **Text never sits straight on a photo.** A band or a shaded edge behind it,
   never a full-frame darkening.
4. **No default "premium" palette** (warm cream with brass or oxblood) and no
   AI purple. The palette comes from their logo and photos (P7c).
5. **No fake screenshots, no generic names or faces, no too-perfect numbers.**
6. **No scroll cues, no "01/06" counters, no label above every section.**
7. **The maker doesn't grade its own work** (design-loop). The checker grades the
   rules; a separate critic, not the generator, judges the rest.

## 5c. Persuasion, and only the honest kind (page-conversion-review)

Each is backed by several independent sources; the count is in brackets.

1. **Repeat the promise that brought them** (4). If a flyer, a QR code or a listing
   said "challah for Shabbat", the headline says "challah for Shabbat". Checked as
   `congruency`.
2. **Reassurance right beside the button** (5). The proof line (rating, verified,
   years, kosher) already sits beside the main button on every page.
3. **What happens next as steps, not a paragraph** (4): "Order by Thursday, collect
   Friday morning".
4. **One job per page** (4). One leading action; the rest visibly secondary.
5. **Specific real numbers beat round ones and beat adjectives**, and never a range
   where one number exists. A total on a button only when it is real.
6. **Friction that filters or invests helps; friction that taxes hurts.** Asking the
   event date helps a caterer; asking for an account before a question hurts.
7. **Never the dark patterns**: fake scarcity or urgency, countdowns, invented
   counts, hidden low ratings (section 3, `urgency` and `claims`).

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

**Nothing the AI makes goes live on its own** (Tzvi, 23 Sep 2026). The pattern
Shopify and Wix use: what the AI makes is a draft. The owner picks one of the
three, previews it as a customer sees it on a phone and a laptop, and only a
**Publish** button puts it on their page. The live page stays untouched until
then. Every published version is kept, and one tap puts an earlier one back (P7g).
Publish is offered only for a page that passes the check.

## 8. Photos, video and the tools

**Generated images and video** (Higgsfield, kie.ai). Tzvi, 23 Sep 2026: mood only.
- Allowed only for atmosphere: light, texture, background, a sense of place.
- **Never shows their product, premises, staff or customers as if real.**
- The owner approves every generated piece before it can be used.
- No text baked into an image.
- Prompts respect the business. On a kosher business nothing non-kosher is in the
  frame; the Blazin' Boards prompts excluded dairy, pork and shellfish because the
  flyer carries a hechsher.
- Today the builder can't place one at all: images are references to their own
  photos only (open decision 5).

**Movement that copies a reference is built in code, not generated.** Generated
video reinterprets the reference on every render, so rerolling can't converge on
"exactly like this". Offer the code-built version instead.

**Blender** (Tzvi, 23 Sep 2026), for three jobs:
1. **Product motion from real items:** their own product turning or rolling as the
   page scrolls, made from their photos or a quick scan.
2. **Polishing generated video:** stabilising, timing to the scroll, clean edges.
3. **Reusable 3D scenes** for the scroll sections in section 9, each made once to
   our standard.

No page reuses another business's scene as it is. Blender hasn't been used in the
project yet, so the first jobs write their lessons here.

**Mobbin and other references** are for studying how a category's pages work (the
devices), not for copying a look (the mood). They are used at design time by hand,
and nothing is fetched for visitors (spec P5). On Michal Simkin the category default
(a search bar over a grid) was studied and deliberately not used.

**Checking a moving page**: screenshots at fixed points through the scroll, not one
tall screenshot (the pinned parts smear), with video requests blocked during
capture. Check at 375, 768, about 1000, and 1280 wide, in both languages, and at a
real laptop height.

## 9. The scroll sections: what the practice pages become

The AI composes from our sections, so the practice pages' best moves become new
sections, each a distinct device built once to our standard and checked like every
other block:

- **The product performs**: their product turning or rolling as you scroll
  (Blender, from their real item).
- **The size ladder**: their products growing through real sizes with a ruler and
  their prices (from Blazin' Boards).
- **Before and after**: pairs from real clients, with their names and consent (from
  Michal Simkin).
- **The time of day**: one scroll regrading their own photos from night to morning
  (from Lechem Emek).

Rules for using them:
- **At most one signature section per page**, and only when their own photos or
  items support it.
- **Not every page gets one.** A page without the right material stays still.
- **Uniqueness applies** (`check_unique`): the same device with the same settings
  doesn't go on two businesses of the same kind.
- **One peak per page.**
- **Reduced motion shows a still.**
- **No scroll cues.**

## 10. Open decisions (need Tzvi)

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
5. **Approved mood images.** To use generated mood images, the page design needs a
   new kind of image reference that points only at assets the owner has approved.
   Until then generated media can't appear on a built page at all.
6. **Before and after consent.** The before-and-after section needs a record that
   each pictured client agreed. Decide how consent is collected before building it.
7. **Which scroll section first.** Decided (Tzvi delegated, 23 Sep 2026): **the size
   ladder**. It runs on what a shop already enters (its options, prices and photos),
   needs no 3D production, and shops are the most common business on the site. It
   needs one new optional field, the real size of each option, because the ladder
   draws to scale and a scale nobody measured would be invented. Product motion
   comes second, once the first Blender jobs have set the method.
