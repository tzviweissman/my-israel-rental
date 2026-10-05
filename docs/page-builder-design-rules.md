# MyIsraelRental — AI Page Builder Design Rules (v3)

These are instructions for the AI that builds business and listing pages on MyIsraelRental.

v2 made pages **correct**: real content, one clear action, no duplicates, nothing broken. v3 keeps all of that and adds what v2 was missing: **art direction**. A correct page on a generic template still looks bland. Award-winning pages look like they were designed for one business.

The rules are in priority order. When two rules conflict, the earlier one wins.

---

## Part 1 — Non-negotiables (from v2, unchanged)

1. **Real content only.** Use only the facts, photos, prices and reviews the business gave you. Never invent ratings, review counts, years in business, customer numbers, awards, quotes, menu items or delivery terms. If something is missing, hide that section and add it to the owner's "Improve your page" checklist. No placeholders, no "coming soon".
2. **Never fake the product.** Don't generate or alter an image so it looks like the business's actual food, room, staff, vehicle, work or results. (Allowed AI uses are in Part 4.)
3. **One page, one job.** There is one primary action (Order, Book, Message to order, Check dates). It appears in the hero, after the offer, and in a sticky bar on mobile, and nothing else is styled like it.
4. **Say it once.** A fact or badge appears at most once above the fold and at most twice on the page.
5. **Borrow layouts, never assets.** Reference sites give you structure and pacing. Never copy their text, images, logos or illustrations.
6. **Accessible and bilingual.**
   - Contrast: at least 4.5:1 for body text and 3:1 for large text.
   - Tap targets: at least 44px.
   - Visible focus rings.
   - `prefers-reduced-motion` turns off non-essential motion.
   - CSS logical properties so Hebrew/RTL mirrors correctly.
   - Numbers, prices and phone numbers stay left-to-right inside RTL text.

---

## Part 2 — Why pages come out bland (diagnose before you build)

Check the draft against these. Each one is a common cause of a bland page:

| Bland signal | What to do instead |
|---|---|
| The platform's chrome (header, badges, footer banners) is louder than the business | Shrink MyIsraelRental to a thin top bar and a one-line footer. The business owns the page. |
| Every business page uses the same colors and fonts | Give each page its own identity from the business's logo and photos (Part 3). |
| Hero headline around 40–60px | Wordmark or headline at **96–160px** on desktop and **56–72px** on mobile. Scale it up until it's almost too big, then back off one step. |
| Hero is text on a plain background | The hero always has media: real photos, a brand film or a typographic brand panel (Part 4). |
| Everything is centered | Put the hero copy left or bottom-left over media, and use split layouts. Center only short statements. |
| Every section is a white card in a grid | Alternate a set piece, then a quiet section, then another set piece (Part 5). |
| Equal visual weight everywhere | One showstopper per page. Everything else stays calm. |
| Flat colors, no texture | Add one texture treatment: film grain, paper, stone, linen or soft light falloff. |
| Default fonts (Inter, system, Arial) | Name a specific pairing from the preset library (Part 3). |
| Pale, generic buttons ("Message") | A filled accent button with a verb and object: "Order on WhatsApp", "Check dates". |

---

## Part 3 — Give every business its own identity

### 3.1 Write a design brief first

Before generating any layout, output this brief. Build only from it.

```
business:        L.A. Cholent by Rabbi Samuels
category:        food / catering
feeling_in_50ms: warm, candlelit, Friday night          ← one feeling the hero must produce
preset:          Candlelight                             ← from 3.3
brand_source:    logo ring gold + flyer script           ← where the colors/type came from
palette:         ground #0F0C0A · text #F2EBDF · muted #A99F92 · accent #D9A54A · surface #191411
type:            display Oswald 200 caps · accent Pinyon Script · body Figtree
texture:         film grain + candle bokeh
hero_media:      tier 2 brand film (no food shown)       ← from Part 4
showstopper:     hero film
signature_detail: crock-pot "How it works" with leader-line callouts
primary_action:  Order on WhatsApp · from ₪100
missing_content: food photos, serving sizes, order deadline, delivery terms → owner checklist
```

### 3.2 Palette rules

- Pull the **accent** from the business's logo or strongest brand color. If the logo is a gradient (like gold), take its mid-tone.
- Build the rest around that accent: a **ground** (background), **text**, **muted text**, one **surface** tint and a **rule** (hairline) color. That's 5–6 colors total.
- Neutrals lean slightly toward the accent's hue; never pure mid-grey.
- The accent fills only the primary button. Elsewhere it's used for small details: a dot, a numeral, one word in the headline.
- Avoid these overused AI looks unless the brand really is one of them:
  - cream background + serif + terracotta
  - purple-to-blue gradient on white
  - near-black with one acid-green pop
  - rounded cards everywhere

### 3.3 Preset library

Presets are starting points. Always swap in the brand's accent, and change at least one other element so no two businesses look identical.

| Preset | Use for | Ground / feel | Display + body fonts (Google Fonts) | Hero treatment |
|---|---|---|---|---|
| **Candlelight** | Shabbos catering, bakeries, evening food, wine | Near-black warm, bone text, metallic accent | Oswald 200 caps (tracking 0.04em) + script accent (Pinyon Script) · Figtree | Full-bleed dark film or photo, copy bottom-left |
| **Bold Pantry** | Daytime food, groceries, cafés, packaged goods | Saturated brand-color blocks, white type | Bricolage Grotesque 800 · DM Sans | Product on a solid color field, giant word over it (Graza/Mooala pacing) |
| **Jerusalem Stone** | Premium stays, villas, boutique hotels | Pale limestone, charcoal ink, brass accent | Cormorant Garamond 300 caps (tracking 0.3em) · Manrope | Edge-to-edge gallery, thin tracked caps, big negative space (Belmond pacing) |
| **Studio** | Beauty, wellness, fitness, classes | White, black and one vivid accent | Archivo at width 125, weight 700 · Archivo | Split hero 55/45 with the person or tool bleeding off the edge |
| **Field** | Tours, experiences, drivers, outdoor | Landscape photography, dark overlay | Anton caps · Work Sans | Full-bleed landscape, one factual line, date picker in view |
| **Workshop** | Trades, movers, cleaners, repair | Off-white, deep navy or green, safety-yellow accent | Barlow Condensed 700 · Barlow | Work-in-progress photo, price-per-job anchor, quote button |

### 3.4 Type rules

- **At most 3 faces:** display, body, and one optional accent (script or italic) used for 1–3 words per page.
- **Scale in px (desktop / mobile):**
  - Hero wordmark or headline: 96–160 / 56–72, line-height 0.85–0.95.
  - Section headings: 40–60 / 30–36.
  - Body: 17–18 / 16, line-height 1.6.
  - Labels: 11–13 uppercase, tracking 0.2–0.32em.
- Mixed-face accent: a heavy or thin caps headline with **one** word in the script or italic accent (for example, "Three steps to *Shabbos*").
- Body text in muted color, not full white or black. Lines 45–65 characters wide.
- Numerals that matter (prices, step numbers) use the display face and tabular figures.

---

## Part 4 — Hero media: the three tiers

Always use the highest tier the business's content allows.

**Tier 1: real photos.**
- The best real photo, full-bleed, with a gradient scrim behind the text.
- Allowed edits: crop, straighten, exposure, white balance, color grade to the page's palette, background cleanup, upscaling.
- Grade every photo on the page the same way so the page reads as one shoot.
- If a photo has baked-in text (flyer, poster, menu board), it is never the hero. Show it whole in a "From the business" slot.

**Tier 2: brand film (when there are no usable photos).**
- A 6–10 second seamless loop made with Blender and/or Higgsfield.
- It may show the **setting and props**: table, candles, stone, light, packaging, equipment, the business's logo and brand motifs (for example, the steam heart from the L.A. Cholent logo).
- It may **not** show the product as if it were theirs: no generated dishes, rooms, haircuts or results.
- Specs:
  - 1920×1080 H.264, 3–4 MB max, muted, `playsinline`, loop, with a poster frame.
  - A pause button is required.
  - The loop seam must be invisible (the difference between the last and first frames is no bigger than a normal frame-to-frame step).
  - Leave empty space for the headline: subject on the right third for left-aligned copy.
- On phones, stack the layout: film on top (about 70% of screen height, cropped to the subject) and the copy below. Don't put text over the subject.

**Tier 3: typographic brand panel.**
- The wordmark at full hero scale on the brand ground, with the preset's texture (grain, paper, stone) and one brand motif drawn in line art.
- It's better than a weak photo and far better than a cropped flyer.

The page footer says when tier 2 media was used (for example, "Film rendered in 3D").

---

## Part 5 — Page rhythm and the showstopper

- Alternate the sections: **set piece → quiet → set piece → quiet**. Never put three sections with the same structure in a row.
- **One showstopper** per page, usually the hero. Everything else is calm and precise.
  - When the page carries a signature scroll section (page-generation-rules section 9), that section is the showstopper and the hero stays calm: the orchestrated load sequence, never the ambient loop, and a brand film shows its poster still. Two showstoppers cancel each other out. (Decided 5 Oct 2026, Tzvi delegated.)
- **Quiet sections:** big type with lots of space. An occasion list set as large display text separated by accent dots works better than small chips.
- **Palate cleanser:** one full-width image or film still with **no text**, between two copy sections.
- **Signature detail:** one element only this business would have. Tie it to their world. Examples:
  - The crock pot with leader-line callouts ("Into your crock pot · Our raw ingredients, plus water").
  - A kashrut certificate shown as a document.
  - Walking times from a rental to the Kotel.
  - A dial showing Low/High settings.
- **End on the offer**, not a contact form: price, what's included, supervision, service area, then the button and copyable phone and email.
- Section padding: 96–140px on desktop and 64–80px on mobile. Use generous space; tight spacing makes a page look cheap.

### Layout patterns to reach for

- Split hero at 55/45 or 35/65, with the subject bleeding off the edge.
- A sticky left column with steps, while the visual stays on the right.
- A photo with leader lines to small uppercase callouts and a value under each.
- A large numbered step list, used only when the order really matters.
- A spec block with label/value pairs separated by hairlines, instead of cards.

---

## Part 6 — Motion and micro-interactions

Premium comes from small, finished moments.

- **Hero:** one ambient loop (the film) or one orchestrated load sequence: eyebrow, then headline, then button, 80ms apart, rising 12px. Not both.
- **Buttons:** 1px lift and color shift on hover (200ms); a visible press state.
- **Copy buttons:** "Copy" changes to "Copied" for 1.5s.
- **Sticky mobile bar:** it slides up when the hero button scrolls away and hides once the offer section is on screen.
- **Don't:** use scroll-jacking, parallax on phones, autoplaying carousels, or animate text while someone is reading it. (Terms defined 5 Oct 2026, Tzvi delegated.)
  - **Scroll-jacking** is taking the scroll away from the visitor: cancelling wheel or touch events, a smooth-scroll library that replaces the browser's own scrolling, snapping between sections, or changing scroll speed. Pinning a section with `position: sticky` while the page scrolls normally, and stepping a picture or a video along with the scroll position, are not scroll-jacking. The signature scroll sections work that way and are allowed.
  - **On phones** means a touch-only pointer, or a screen 860px wide or less. Layers there sit still in their resting position; the pinned and scrubbed parts keep working. The design-kit scroll engine does this by itself from version 2.2.0.
- Everything must be readable with motion off. Nothing waits at `opacity: 0` for an observer to fire.

---

## Part 7 — Page recipes by business type

Choose the preset in Part 3, then use this section order. Skip any section without real content.

- **Food / catering** (Candlelight or Bold Pantry):
  1. Hero with media, wordmark, one line, the order button and a fact strip (from ₪X · kashrut · area).
  2. Occasions as big type.
  3. How it works with the signature detail.
  4. Menu with photo cards, only if there are real photos. Each shows serving size, price and unit, and lead time.
  5. Palate cleanser.
  6. Offer block and contact.
- **Stays** (Jerusalem Stone): gallery hero; key facts (sleeps, bedrooms, Shabbos features); short story; amenities; map with walking times; booking card; house rules; reviews.
- **Services** (Studio or Workshop): work photo hero; service menu with duration and price; portfolio from real photos; how booking works; credentials; reviews.
- **Experiences** (Field): action hero; highlights; itinerary timeline; included / not included; meeting point; dates; cancellation policy.
- **Restaurants** (Candlelight or Bold Pantry): mood hero with today's hours; menu highlights; location and hours; kashrut; events.

Reviews appear only if they're verified and there are at least 3. Otherwise the section is hidden.

---

## Part 8 — Copy

- Write as the owner talking to one customer: short, warm, specific.
- **Reuse the owner's own taglines** from their flyer, logo or description before writing new ones. ("Our secret recipe, your new Shabbos favorite" beats anything you invent.)
- **Specific beats superlative.** Drop "best in town" even if the owner wrote it.
- **Banned phrases:** "look no further", "elevate", "unparalleled", "world-class", "one-stop shop", "we pride ourselves", "game-changer", and more than one exclamation mark per page.
- Buttons say exactly what happens: "Order on WhatsApp", "Check dates", "Get a quote".
- Contact details are shown as selectable text with a copy button, not only as links.

---

## Part 9 — Quality gate (score before returning a page)

**Must pass** (any failure blocks the page):

| # | Check |
|---|---|
| 1 | Real content only; nothing invented; nothing faked |
| 2 | A design brief (3.1) exists and the page follows it |
| 3 | The hero has media from tier 1, 2 or 3; no cropped flyer |
| 4 | The hero headline or wordmark is at least 96px on desktop and 56px on mobile |
| 5 | One primary action style; it's the highest-contrast element in the hero |
| 6 | Nothing is repeated more than twice; no empty sections |
| 7 | Works at 360px with no sideways scroll; the phone hero doesn't cover the subject |
| 8 | Contrast, focus rings, reduced motion and RTL all pass |

**Scored 1–5 each** (aim for 4+ on every row):

| # | Check |
|---|---|
| 9 | **Identity:** could this page belong to any other business? (5 = no) |
| 10 | **Hierarchy:** one clear focal point per section |
| 11 | **Typography:** a named pairing, a real scale, one accent word |
| 12 | **Rhythm:** set piece and quiet sections alternate; one showstopper |
| 13 | **Texture and finish:** grain or material, hover states, a finished sticky bar |
| 14 | **Signature detail** that is specific to this business |
| 15 | **Performance:** LCP under 2.5s; hero video under 4MB with a poster |

**Look through it, fix it, then show it** (Tzvi, 5 Oct 2026). The owner never
sees a first draft. Before returning, render the page as a visitor meets it
(laptop and phone, English and Hebrew, reduced motion; a scroll page at several
positions per section), look at every screen for anything that reads as broken
or unfinished even when no check above names it, fix it, and render again until
a full pass is clean. Then return the finished page with a short note of what was
fixed, and say plainly what could not be (it needs their content or a real
device). Full procedure: `docs/page-generation-rules.md` §3a.

Five build rules come with it (same section, with the defect each one prevents):
anything placed on a spot in a photo or video is placed by measuring the real
frames, never by eye; an overlay that must stay on moving media lives inside the
media's own element; text never re-wraps while its container animates; no
in-between state may look unfinished (an emptied area goes to the page's ground,
never a bare panel); text over imagery is checked at the brightest frame and the
narrowest screen. A script measures every overlay-on-picture at five scroll
positions on a laptop and a phone: more than 4px off fails the page.

Return:
- the page;
- the design brief;
- the score table, with one sentence on anything below 4;
- the owner checklist, for example: "Add 3 food photos → unlocks the menu cards and a photo hero".

---

## Appendix: worked example (L.A. Cholent)

A preview built by following these rules. It shows the target quality for the food category.

- **Brief:** the one in 3.1.
- **Hero:** a dark, candlelit tier 2 film. A closed steel crock pot with "LA CHOLENT" on it; steam rises and curls into the heart from their logo. No food is shown. The copy sits bottom-left:
  - gold script "Rabbi Samuels' Famous";
  - "L.A. CHOLENT" in thin caps at about 150px, with gold dots;
  - script "Israel Branch";
  - their own tagline;
  - one gold "Order on WhatsApp" button;
  - a fact strip: From ₪100 · Kosher · Rabbi Weiner · Jerusalem · All of Israel.
- **Quiet section:** their occasions set as large caps with gold dots (Shabbos meals · Thursday nights · Kiddushim · Shalom zachors · Simchos of any size · Family visiting).
- **Signature detail:** "Three steps to *Shabbos*", with a still of the pot and leader-line callouts.
- **Palate cleanser:** the steam-heart frame, full width, no text.
- **Offer:** "Any size, any occasion", ₪100 in large display numerals, a hairline spec list (supervision, based in, serving, you add), the button, and copyable phone and email.
- **Owner checklist:**
  - food photos;
  - serving sizes and prices per size;
  - Shabbos order deadline;
  - delivery terms;
  - confirm "Jerusalem · All of Israel".
