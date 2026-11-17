# Why our sites look alike after the hero (17 Nov 2026)

Tzvi: "they all look very similar and they don't have any uniqueness to them other than the hero."

## What I looked at
- 8 live builds captured screen by screen at 1280x800 (`our-sites-1.jpg`: Clean Plus, Krysp, Whipped Cup, Elisheva; `our-sites-2.jpg`: Chicken Munch, Noa Levi, Gremier, RBS). The hero screen is skipped, so each row starts on screen 2.
- The section order of all 24 home pages, plus the shared CSS in `scrollcraft/starter/site.css` and `sitekit.py`.
- Our inspo anatomy study (`../awwwards-anatomy-2026-10-22/`).
- Four videos (transcripts read in full; no frames sampled):
  1. Sharbel A., "Ultimate Claude Motion Graphics Skill" (9UmUhSPJe0I)
  2. Create a Pro Website, "Cinematic 3D Websites with GPT-6 Astra" (r68MhqAUvR8)
  3. Jason Lee, "Fable 5.2 vs Opus 5.5" (GdMnqbGPlyY)
  4. Kyle Skelly, "Build Cinematic Websites with Claude Code FAST" (F7ygmxQxwWM)

## The finding
All four parts below are the same on every site. Only the font, the colours and the hero change.
- **Nav.** Logo on the left, pill tabs (Home / Shop / Contact) in the middle, a pill button on the right. All 8 sites.
- **Body.** The starter's `.sec`: an h2, a 36rem `.lede`, then an auto-fit card grid inside a 74rem `.wrap` (18 of 22 sites). Section padding is the same `clamp(4.5rem,10vw,7.5rem)` throughout, so every section is about the same height.
- **Steps.** A "three steps" numbered list. It is on Clean Plus, Krysp, RBS, Whipped Cup and others.
- **End.** A dark close band with one line and a button, then the giant wordmark, then the same 4-column footer (22 of 24 sites).

The rules cause this:
- `page-generation-rules.md:136` and `:1879` require the parts of a real website: features, CTA, FAQ, menu bar and full footer. That part is right.
- But only the hero has to be special. `check-fingerprints` compares hero, signature, nav, close and ground. It does not compare the body sections, and the close only differs in colour.
- The starter README says it holds "how a site works, never how it looks". Its CSS is a look, and 18 sites ship it.

The pages are also short and flat. Clean Plus is 3 screens after the hero, Elisheva 6. No body section changes scale (every h2 is about 3 to 4rem). Few change ground, and none is built from the business's own data shape.

## What real sites do instead (inspo anatomy)
- **The ground changes per section,** often a new flat colour per band. Theobroma uses purple, then brown, then green. Delice gives each section its own colour. Sports and services sites alternate dark and light by section type.
- **The product or service gets the form only it could have.** Agrumea's jars float as the whole page. Delta Cafés has a coffee-personality quiz. Aventura Dental gives each service its own dark panel with a portrait. Real estate uses floor plans, site plans and distance lines. Events show a dated list of past events.
- **Type jumps in scale mid-page.** Truck'N Roll's headlines are about 200px and Aventura's about 100px. Giant single sentences fill a screen.
- **Collage and mosaic, not a uniform card grid.** La Joya mixes tins and plates. Vero uses a 3-image collage with a named quote.
- **Services show the real team or machines within two screens,** with concrete proof: names, numbers, addresses.

## What the four videos add
- **Video 3 (Fable vs Opus).** Fable's car-parts redesign won because its centrepiece was the business's core function: a car whose parts expand and label on hover, plus a working part finder. The prompt said "understand the business model" first. The presenter called the losing version's sections "pretty standard". Discount: sponsored by Hostinger.
- **Video 4 (Kyle Skelly).** He rejected the first build as "very visual heavy, but there's no real structure". The fixes:
  - The business's main flow got its own section, a "find an expedition" form.
  - The signature section was shaped by the business's data: expeditions ordered by height, then a scroll video that climbs to Everest.
  - He iterated a V2 rather than polishing V1.
  - Discount: OpenArt sponsor and a course funnel.
- **Video 2 (Astra tutorial).** He asked "what sections will I need for this business?" before prompting. The sections were named after the business's own things (destinations, fleet, dining, crew, book a ticket), not generic slots. A reference screenshot was used per section, and the clickable items opened lightboxes. Discount: affiliate-heavy (Hostinger, Higgsfield).
- **Video 1 (Motion Director skill).** "The prompt is maybe 10% … the other 90% is the setup." It pitches three ideas, one of them bold, shows a board of rendered styles to pick from, and runs a critic that scores out of 10 and loops below 8. Its library grew by saving things the presenter liked, copying the style but never the content. It is a video tool, but the same idea fits page sections.

## Fixes (Tzvi, 17 Nov 2026: "All four"; now page rules 3ad)
1. **A signature body, not just a signature hero.** At least two sections after the hero take a form drawn from this business's data or main flow. Examples:
   - Clean Plus: tap the rooms of a home to build the plan.
   - Noa Levi: a wall of before/after sliders.
   - Gremier: build your office coffee bar.
   - Chicken Munch: fill your box.

   Where: a new blueprint stage question, plus `check-fingerprints` extended to compare body sections.
2. **The starter gives behaviour, not looks.** Nav, steps, close band and cards come in several distinct variants, or are written per site. `check-fingerprints` fails when a site's nav, steps or close markup matches another site's. Where: `scrollcraft/starter/README.md`, `site.css`, `check-fingerprints.mjs`.
3. **Rhythm rule.** Every home page needs:
   - at least two ground changes;
   - one scale jump (a section whose headline is at least 2x the others; set at 1.6x in 3ad.3 after Graza, a real shop with a plain jump, measured 1.67x);
   - one full-bleed or collage section;
   - section heights that are not all the same.

   Where: page rules plus a small measuring check.
4. **Sections named from the business.** The blueprint asks "what sections does this business need?" and names them from the category anatomy before any layout. Names like "how / gallery / faq" are slot names, not section names. Where: `scripts/blueprint.mjs` stage 2.
