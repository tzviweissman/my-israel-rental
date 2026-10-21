---
name: build-business-page
description: Tzvi's complete method for building a website or landing page for a business (any site, any stack), including scroll cinematic pages. Use when building, redesigning or reviewing a business's home page, landing page, scroll page or AI-generated page, before showing it to the owner. Points to the same tools (design-kit skills incl. scroll-craft, Inspo, Mobbin, Higgsfield) and covers facts and honesty, copy voice, the category checklist, motion and video build rules, a worked cinematic example, and the review loop with four scripts (readability, cut-off, overlay alignment, preview video).
---

# Building a page for a business

Distilled from the MyIsraelRental page rules (`docs/page-generation-rules.md`
in that repo, where the full history and examples live) and the corrections
Tzvi made on real builds. Every rule here is a defect that once reached him.

The job in one line: **arrange what the business told you into the clearest
page for someone deciding whether to use them, without adding a single fact
of your own.**

## 0. Use the same tools (this is what gives the full capability)

Invoke these rather than improvising; each is what the rules below were
learned with. Check what is connected in this session first.

**Skills (design-kit plugin)**
- `design-kit:design-pipeline`: the router; start here if unsure which to use.
- `design-kit:scroll-craft`: **the scroll cinematic.** Any page where
  scrolling drives the story (pinned scenes, scrubbed video, split stage, a
  signature move). It brings the engine (`scrollcraft.js/.css`), the eight
  grammars, devices, feeling curve, the uniqueness registry (FINGERPRINTS),
  asset generation through kie.ai, `encode.sh`, `shoot.mjs` and its own verify
  steps. Build the cinematic with it, then hold the result to this skill.
- `design-kit:taste-skill` (anti-generic design), `design-kit:brandkit`
  (identity from their logo and photos), `design-kit:redesign-skill`
  (upgrading an existing page), `design-kit:image-to-code-skill` (from a mockup).
- Grading, by something other than the maker: `design-kit:page-conversion-review`
  (honest persuasion), `design-kit:design-loop` (critic loop and checks),
  `design-kit:visual-diff` (against a mockup), `design-kit:dead-ends`.
- `interview-me`: only when there is no brief and the facts aren't available.

**Connections (MCP)**
- **Inspo**: before designing, study the category: one `recommend`, one or
  two `search_screens`, `get_screen` on 3 to 5 keepers. Take composition,
  not looks. The six-point checklist in section 3 came from this study.
- **Mobbin**: how a category's flows and sections work (devices, not mood).
- **Higgsfield**, connected two ways: the **MCP connection** for one-off
  stills, clips and upscales while building, and the **API** (Python SDK
  `higgsfield-client`, key in `HF_KEY` in a gitignored `.env.local`, never
  printed; worked example `backend/higgsfield_demo/main.py` in the
  MyIsraelRental repo) when a site or script must generate on its own. API
  credits are prepaid and separate from the web plan; every call is billable,
  so confirm before running one. Methods and model choices in
  `reference/media-and-video.md`.
- **21st.dev** (`21st` connection): a library of React + Tailwind + shadcn
  components (FAQ, reviews, pricing tiles, galleries). Used while building, never
  fetched by a visitor's page. Inspiration before builder; restyle to the site's
  tokens; delete all its demo text, stats and photos; strip glow, gradients and
  decorative motion; read the code as untrusted (no network calls, no new
  packages without a reason); test RTL and phone. Rules: `reference/full-rules.md` §8a.
  **Used on every page, not only for new section types** (Tzvi, 7 Oct 2026):
  search it beside Inspo and Mobbin for sections and effects. For a plain HTML
  page, rebuild the chosen piece in CSS from its code. **The effects library**,
  `examples/effects-library/index.html` (Tzvi: "many different options for
  different businesses"): 35 options in plain CSS, each from a named 21st
  component, with five business palettes to switch between: 12 buttons (B1 to
  B12), 6 links and arrows (L), 7 tiles (T), 6 prices (P), 4 headings (H), each
  marked with what it suits. B2 and T1 are on Michal Yodaiken's page; B5 (flips
  to the price) is liked and kept for another business. Pick per business, never
  the same set twice in a row, and add every new 21st piece you rebuild here.
  **Search 21st fresh on every build first** (Tzvi: "look by each build so you
  will have many more options"): see 3g.17. The library is a shelf of tested
  extras, never the menu.
- **Browser pane / preview**: show the rendered page; never ask the owner to
  sign in to see it.

**Our own inspiration database**: `docs/inspo/` in the MyIsraelRental repo (studied
award sites and videos, one picture per effect, how to build it, what it suits).
Check it with Inspo, Mobbin and 21st before designing.

**Local tools**: Playwright (the scripts here), ffmpeg (encoding, previews),
Python with OpenCV (finding spots in frames, steadying clips, motion masks).

**Files in this skill**
- `reference/full-rules.md`: the complete MyIsraelRental rulebook (hard rules
  table, category study, playbooks with recipes, three-option rule, AI media
  policy, Blender, scroll sections, open decisions). This page is the
  distilled version; read the full one for anything not covered here.
- `reference/design-rules.md`: the page builder's design rules (v3,
  `docs/page-builder-design-rules.md` in the repo): non-negotiables, why
  pages come out bland, the brief, palette and type rules, the six presets,
  the three hero tiers, page rhythm and the showstopper, motion, **the
  effects catalog** (one bold moment, "not too similar" to live pages,
  owners choosing between versions), recipes by business type, copy, the
  quality gate and a worked L.A. Cholent example. Section 3d below is the
  short version; read the file for the rest.
- `reference/playbooks.md`: per kind of business.
- `reference/media-and-video.md`: generating, steadying, masking, encoding,
  placing overlays, recording previews.
- `examples/la-cholent/`: a finished cinematic page (index.html) and its
  brief: the split-stage grammar, knob signature move, kosher band, phone
  order bar, every rule applied. `examples/FINGERPRINTS-myisraelrental.md`:
  the looks already used, which a new page must differ from.
- `scripts/`: `brightness.py`, `readable.mjs`, `cutoff.mjs`, `clipped.mjs`, `scroll-finish.mjs`, `cutout.py`, `overlay-truth.mjs`, `record.mjs`.

## 0b. Build order (learned from the last builds, Tzvi 15 Oct 2026)

1. Real slug from the live record before publishing.
   Start with `scrollcraft/starter/fetch_business.py` and the starter
   skeleton (rules 3p); choose the look and pass `check-fingerprints.mjs`
   before building sections.
2. Look at every photo; flag duplicates, screenshots, small sizes; ask the
   owner for more in the first message.
2a. Start building the moment the questions go out (Tzvi, 17 Oct 2026), so
   the owner's wait after answering is short. Build from what is there and
   leave out what only their answers can fill; no placeholders on the page.
   Ask only for what is needed, or what would make the page significantly
   better (more photos, a menu detail). When answers come, slot them in.
3. List every live-site write the build needs; ask for all at once. Check the
   listing's prices and currency against their menu first and flag mismatches;
   load the real menu with fixed product ids so the page's order form saves
   orders (tracking link) before WhatsApp.
4. Mobbin and 21st per section before building (3g.17).
5. Plan the phone frame before generating (subject centred, margin).
   Confirm the motion as numbered steps ("1 floats, 2 snaps, 3 blasts apart,
   4 flies back, 5 drops in") and generate only once they are confirmed; ask
   whenever not 100% sure what is wanted.
6. Generate in the background while writing the page; scripts keep the job
   number and retry slow status checks.
7. Text over imagery gets its edge shade (or small solid card) from the start
   (section 4, 5b.3).
8. Header and main buttons go to the quickest order path from draft one.
9. One idea per page, used once (section 4).
10. Wow test, clipped.mjs, readable.mjs BEFORE any link or video is sent.
11. Owner video last, from the live page.
12. A page on the business pages list: `publish-page.mjs` re-records its preview
    clip automatically; `node scripts/check-showcase-previews.mjs` fails if any
    tile shows an older version of its page (The Gift Boutique, 18 Oct 2026).

## 1. Facts: only theirs

- **Never re-ask what they already told us.** Read the record, every
  listing, hours, photos and flyer text first; anything answered there is
  never asked, not even to confirm.
- **Ask the owner only about their business**: facts the record leaves
  open or contradicts (where they work, booking lead time, who books them,
  languages). Never about how we build: no tools, credits, image sources,
  plans, vendors or design. A tooling problem is ours to solve silently.

- Use only what the business gave you: name, description, areas, hours,
  languages, founding year, licence or certificate, reviews, prices, products,
  photos. **Anything not in that list does not go on the page.** No "since
  1998", "fresh every morning", "trusted by families", no round marketing
  numbers.
- A claim needs its proof. Kosher needs a certificate (and only on food).
  Licensed needs a licence number. Years or "since" need a founding year.
  Ratings and "customers love" need real reviews. Only the owner's own words
  can back best, #1, award, guarantee, insured, 24/7, emergency, fresh daily,
  delivery, or anything medical.
- No fake urgency, ever: "only 3 left", "hurry", "today only", countdowns,
  invented counts. "Open only on Fridays" is a fact, not urgency.
- Generated images and video: allowed anywhere they make the page look
  better, product cards and choice tiles included, no label (Tzvi, 8 Oct
  2026). Generate as little as possible: edit their own photo of a sibling
  item to show a missing flavour or size, so it stays their product. Only
  items they really sell. Never a generated person shown as their staff or
  customer, never their real premises made up (a generated setting is never
  presented as their premises), no text baked in. Respect
  the business (a kosher business: nothing non-kosher, no meat with dairy).
  Movement copied from a reference video is built in code, not generated.
- **If it would look better as a generated clip, generate it** (Tzvi, 8 Oct
  2026): any moving piece a filmed clip would do better than code (a pour,
  drizzle, cream, sauce, steam, melt, food cut or served, a product opened or
  used) is a generated clip, never SVG/CSS. Code keeps text, interface, layout,
  scroll-tied motion and exact choreography copied from a reference.
  Start frame = their item before, end frame = their item after (edited from
  their photo), both on the page's background colour; a start/end-frame model
  (MiniMax H3 Max) fills only the pour. Code decides when it plays and swaps to
  the still at the end. Preflight cost, generate one, check it, then the rest.
  **Always in Higgsfield** (Tzvi, 13 Oct 2026): a ribbon untying, a drizzle, a
  pour, fabric or steam is generated there (MCP while building, API if it
  refuses), never drawn in code first and never another generator. CSS
  ribbon bars and a drawn bow read as fake on The Gift Boutique.
  **Any generated motion shows the real physical process and flows**
  (a ribbon, lid, pour, spread, unfold, steam): every step from cause to
  effect on screen, nothing appears or vanishes by magic; it moves like its
  material; the change itself gets at least half the clip, seen close (the
  knot opening, creases, drips), the exit is short; it travels in one soft
  curve and touches the products, never a straight slide or a fade, and
  never showy loops or spirals; it is
  generated in the real direction of time, start frame to end frame, never a
  reversed clip. **One clip per physical step**: list the steps first; any
  hard or key step (the knot unwinding) gets its own clip between a before
  frame and an after frame, joined end to start, or the model skips it.
  Full text: `reference/full-rules.md` section 8.
  **Product lists read the shop**: wrap a priced list in `[data-mir-catalog]`
  (+ `data-mir-list`, `data-mir-skip`, item and group templates; example The
  Gift Boutique) so out-of-stock, new and removed items follow the dashboard.
  **Main buttons go to the quickest way to order**: the order page if there
  is one, else the price list, only then WhatsApp; one label everywhere;
  WhatsApp is the secondary link. Adding an order page changes them all.

## 2. How to write

1. **Their words first.** Reuse the owner's phrasing; tidy, never replace their voice.
2. **Specific over generic.** "Sourdough and challah in Beit Shemesh", not
   "quality baked goods". Banned: welcome to, look no further, one-stop shop,
   passionate about, quality you can trust, world-class, top-notch.
3. **Headline: what + where** (or what + for whom), at most 10 words (a ceiling:
   the first screen follows 3g.13, with where in the one short line or under
   the button). The name is already on the page.
4. **The line under it says what you get**, plainly (food: the food and how it
   arrives, not a slogan). At most 20 words (a ceiling; 3g.13 allows one short line on the
   first screen).
5. **A professional voice, always.** Write the way a respected business would
   in print. Describe the customer's problem in neutral terms; never tease,
   scold or talk down ("You are nowhere near done" became "Thursday night,
   with hours of preparation still ahead"). No slang or jokey asides. Test:
   would the owner print this line on their menu?
6. **Short labels are still full phrases.** A proof line or badge spells out
   the relationship with the word people actually use: "Kosher, hechsher from
   Rabbi Weiner", not "Kosher, Rabbi Weiner"; "Made in Jerusalem, delivered
   across Israel", not "Jerusalem, all over Israel".
7. **Plain punctuation.** No exclamation marks, no long dashes, no capitals
   unless it is their name. (A quote of the owner may keep theirs.)
8. **Address the visitor as "you"**; the business speaks as "we" or its name,
   **never "they", "them" or "their" about itself** ("We confirm your board",
   not "They confirm the board"), in labels, errors, captions and alt text too.
   Search the visible text for they/them/their before showing a page, and read
   every line aloud as the owner would say it: it must make sense in English.
9. **One wording per purpose.** If the button says "Order", it says "Order" everywhere.
   - **End on what the customer gains**: a closing moment names their result
     in the owner's words ("A stronger, healthier you"), never "done" or "complete".
   - **Every line makes sense where it sits**: it must not read as the next item
     of the list above it.
   - **"Or" and "prefer" only when the other choice is visible.** The only
     contact is stated plainly: "WhatsApp Michal: 07563 299474".
10. **Other languages are written, not translated** (Hebrew: natural word
    order, right gender and plural forms, RTL layout checked).

## 3. The category checklist (what the best real sites share)

Every page passes all six before anyone sees it:

1. **The first screen answers four questions:** what it is, where, why trust
   it, what to do next. Within 3g.13: where and trust go in the one short line
   or right under the button.
2. **Proof touches the main button:** price, credential or rating right beside it.
3. **One solid ACTION per screen.** The header button and the phone bar repeat
   the same action; over a hero that already shows a solid button the header
   button is outline. Everything else is outline, link or tile.
4. **With few photos, facts carry the page** (what they offer, key facts), never a padded gallery.
5. **For a place, hours and where come before the description.**
6. **On a phone the action is pinned to the bottom** with the price or proof,
   from after the first screen until the order section.
   A bar that also carries a counter or clock is there from the first screen;
   only its button waits. Anything that runs with the scroll is seen from its
   start to its finish, never late and never gone early.

Food: a certificate is a small labelled band just after the opening, never
crowding the button, said at most twice on the page.

Per-category guidance (what a visitor decides, what leads, proof, action,
what to avoid): `reference/playbooks.md`.

## 3b. The sections every page has (Tzvi, 6 Oct 2026)

1. **A dramatic hero**: their product or setting full-bleed, the headline at
   display scale, strong contrast; never a small card on a quiet picture. The first screen follows 3g.13; a film
   opening is 3h.
2. **A features section**: one scannable item per service or product, price
   and what is included, in their words.
3. **A CTA section** of its own near the end: the one action, proof beside it.
4. **An FAQ in their words**: ask the owner to send their customers' questions
   with their answers (suggest the questions that matter in their category).
   No FAQ section until they do; never invented, never empty. **The request
   shows 5 to 8 example questions written for this business**, each drawn
   from something real in their listing (a fee, an exclusion, their areas,
   their busy season, who books them) or what their category must know
   before booking. The owner answers the ones customers really ask, in their
   own words; skipped questions stay off the page.
5. **Social proof only if real**: platform reviews, or testimonials the owner
   sends with name and permission. None means no section, and ask them.

Ask with the FAQ, only if the page does not already answer it: **what do
customers worry about before ordering, what happens in the first days after
they get it, and do you have a photo of it being used, served or delivered?**

## 3c. From the design and persuasion study (Tzvi, 7 Oct 2026)

Full text and reasons: `reference/full-rules.md` §3c.

1. **References first, from every source**: Inspo, Mobbin and 21st on every
   build, starting with how businesses of the same kind built their sites;
   keep 3 to 5 real screens, named in the brief. Copy structure, never looks; colours and type are theirs.
   **Plus 21st on every page**, for sections and for effects (button hover and
   press, a moving arrow, a lifting tile, how a price is set). **Choose it
   yourself** from that research and say in one line what you picked and why;
   an options page only when Tzvi asks for one.
   **Search fresh for every piece on every build**: see 3g.17.
2. **No AI default look**: no cream + serif + one italic word unless that is
   their brand. At least one section on a contrasting ground.
3. **Proof where the worry is**: each worry the owner names is answered beside
   the button or price it belongs to. No wall of one-line reviews.
4. **Show it in use**: their photo of it used, served or delivered leads;
   generated images fill the gaps, best made by editing their own photo.
5. **Choices are tiles**, never a dropdown. "Most popular" only if the owner
   marks it or orders show it. Bundles show the real saving.
6. **The button says what happens next** ("Order, delivered Friday"); under
   it up to three icons of their real guarantees.
7. **Offers are contained**: an end date or first order only; free delivery
   over an amount or a bundle before a percentage off; no permanent sale.
8. **Name the first days**: if the owner tells you what happens after the
   order, the page and the tracking page say it first.
9. **One quiet system**: one radius, one icon set, one soft shadow, no
   two-colour gradients, no decorative arrows or outlines; every button
   reacts when pressed and shows when it is working.
10. **Come-back features only if they help the customer** (saved items,
    reorder, order updates). Never fake urgency (section 1), endless feeds, random
    rewards or guilt streaks.
11. **Video: draw it, then check it.** `scripts/record.mjs` renders each
    frame for its exact time (no stutter, same result every run) and writes a
    contact sheet beside the video: look at it before sending. After a small change,
    rerun the same command with `--redo "<selector>"`: only the frames showing
    that part are drawn again and the rest are reused (Tzvi, 18 Oct 2026; a full
    take 4 min, a redo of one section 30 s). It records everything if the page's
    length or the stops changed. Paid
    generation waits for the owner's yes on two or three style frames.
12. **Everything fits on one screen** (from woodwrights.co.nz): wherever a
    visitor stops, each photo is seen whole with its words and price. No
    block taller than the screen at 1280x650, 1440x900 or a phone; cap
    photos and big type by `svh`; a main tile puts its photo beside its words.

## 3e. From the twelve UI videos (Tzvi, 8 Oct 2026)

Full text, sources and the rejected list: `reference/full-rules.md` §3e.

1. **Order by the visitor's questions**: what is it, can I trust it, what does
   it cost, what do I do; prices before any enquiry form. A small label above
   the headline says who and where (a ceiling: on the first screen it is the
   one short line of 3g.13). The headline is the customer's outcome.
2. **One action, one label**: every section ends on the same action as the
   header button; the page's words match what sent the visitor.
3. **Buttons say what happens, with real numbers** ("Order 4 buns, ₪55");
   price, unit and action together; packages as tiles.
4. **Measured contrast**: button text 4.5:1 on its fill. Every button has
   rest, hover, pressed, disabled; fields have focus and error; every action
   confirms. Hover-only things get a phone version.
5. **Cards**: one reading order (name largest, one accent fact used nowhere else on the card, rest lighter),
   big photos, worst-case content handled (truncate; icons on a solid circle).
   Text under owner photos on a plain strip; text on a photo follows section 4
   (5b.3).
6. **System**: 4 px spacing grid, related close and unrelated apart; one body
   family, up to three weights, six sizes; headings tightened about -2% with 110-120% line height (test
   Hebrew first); one radius for images and buttons.
7. **Motion**: never linear, grows from the tap, under 0.5 s. Carousels show
   the next card's edge and have buttons or dots (mirrored in Hebrew); sheets
   close by swipe AND a button. Ambient background video only (a film opening follows 3h): locked camera,
   ~6 s loop, poster, reduced-motion still.
8. **Flows end**: a "Done" screen, lists that end, "save and finish later".
   Progress and loyalty only with true numbers; a reminder only for a real
   unfinished thing, once, with an off switch. The owner stays a person.
9. **Process**: keep each reference's link; after building, rank the top five
   fixes section by section; polish states on any 21st or generated component.
10. Pinned sections stay, but never take over the scroll's speed or direction.

## 3f. Effects are seen whole, and there are enough of them (Tzvi, 13 Oct 2026)

Full text: `reference/full-rules.md` §3f. From The Gift Boutique: the
ribbon untied before the photos arrived, and the page had one effect.

1. **A scroll effect plays while its subject is wholly on screen**: hold it
   on a stage that fits, or start once it is all in view. Never key it to the
   subject entering. Capture 0/25/50/75/100% on laptop, short laptop, phone.
2. **Fill the effect budget**: one held signature moment in steps (a 3h film opening is that signature); at least
   three accents (an arriving opening, a scroll-tied detail mid-page, a
   closing payoff that answers the signature); quiet touches (eased reveals,
   hover and press, tile lift). Listed in the brief, ticked on the frames.
3. **A held stage** is the screen minus the header and the phone bar;
   anything that travels out of it sits outside clipping frames.
4. **A logo motif is never doubled** on the logo that already has it.
5. **Text widths in em/rem, never ch** (Chrome keeps the fallback font's ch).
6. **A text shimmer is an overlay**, never background-clip on the letters.
7. **A bottom bar fits at 360 px**: the label gives way, the button never.
8. **A scroll-tied effect finishes while its subject is mid-screen**, never as
   it leaves (Rendrly: "the coloring only finishes when im past it"). Progress
   from its top at ~85% down to its centre at the middle. Run
   `scripts/scroll-finish.mjs`: at six sizes its top is on screen and its centre
   no higher than 40% when it completes.
9. **A list that stacks on a phone runs item by item**: each item lights at
   ~80% down the screen; one whole-list progress lights the last items late.
10. **A play-once effect starts when its subject is wholly in view** (or its
    top at the middle if taller than half the screen), or is tied to the
    scroll. Started as the edge entered, Rendrly's steps were over before
    anyone saw them. Section reveals keep an early start (no blank bands).

## 3g. From the six design videos (Tzvi, 14 Oct 2026)

Full text, timestamps and frames: `reference/full-rules.md` §3g, `docs/ui-videos/notes/`.

1. **Style sheet first**: accent, ink, ground, two faces (headline and text; at most a third for one
   label style), one radius, motion limits, in BRIEF.md; every section follows it.
2. **AI-look tells banned**: default font, purple/two-colour gradient,
   exactly three identical cards, frosted glass everywhere, a headline a
   competitor could use.
3. **One accent per screen: one word or one object, plus the primary button's
   fill** (the single home of the accent rule; a word that matters, not
   decoration); cream + serif + italic word together stays banned unless it is
   their brand.
4. **Every motion has one job** (guide, confirm, reveal); loops join
   invisibly; text settles soft to sharp, no bounce; list rows ~100 ms apart.
5. **Chapters**: a scroll film or held section carries short labelled steps
   of their real process, ending on the finished thing and the button.
6. **Index list** option for menus and price lists: big names on thin rules,
   price on the line, hovered row fills.
7. **One closing signature** (the single home of the closing wordmark): the
   name huge and cropped at the bottom, or one playful moment in the footer or
   404. Never more than one.
8. **Text over video or a busy photo** follows section 4 (5b.3): edge shade or
   small solid card, never frosted glass; contrast measured on the brightest
   frame.
9. **A small working piece** (mini order card with the real price, date
   checker) only if it really works.
10. **Problem first** in the owner's words; rewrite any line a competitor
    could say.
11. **Fonts from the approved Latin + Hebrew list**, licence checked.
12. **Build order**: bones, then polish, motion, phone passes; stills checked
    before motion; fixes batched; a real test through every form (to a test
    business) before the owner sees it.

13. **Opening screen: four things at most**: the picture, a two-to-five
    word headline, one short line, one button. **This is the single rule for the first
    screen, and it wins**: the 10 words and 20 words under it (2.3, 2.4), the
    small label (3e.1), the 4 pieces of text (section 4) are ceilings, not
    targets. Where and trust go in the one short line or right under the button.
14. **One colour grade** across every image and clip on a page; the page's
    colours come from it.
15. **A made-for-them cinematic opening** (their product in a lit, generated
    setting that fits it, never presented as their real premises, or their
    photo brought to life, made in Higgsfield; generation rules in section 1);
    never a flyer crop or low-resolution photo as the hero. The film itself is 3h. Cost told to Tzvi
    first; one made and checked before more.

16. **The opening has a wow: something happens** (a box opens and light
    pours out, honey pours, dough rises), tied to what they do, ending on
    their real product and the button. Test before showing: say in one
    sentence what HAPPENS in the first five seconds and first scroll; "nothing",
    "the camera moves" or "it fades in" means redo. Beside the best reference,
    if ours is quieter it is not finished. The film that delivers it is 3h.

17. **Unique effects from fresh Mobbin, 21st and Inspo searches** (the single
    home of the fresh-search rule): one of each for every piece (the button,
    the arrow, each card or list effect, each section), for this business,
    before the effects library is opened; say for each pick where it came from
    (a new search, named, or the library) in BRIEF.md and the reply. An effect
    needs its reason: one that says what a control does passes, one that only
    decorates does not. Nothing reused from the last two pages (check
    FINGERPRINTS).

## 3h. The cinematic film opening (Tzvi, 16 Oct 2026, after the PULP video)

Full text: `reference/full-rules.md` §3h. The Brown Box's first opening (locked camera, small
bowl, flat wall, soft) lost to a site whose film fills the screen and travels.

1. **One unbroken full-screen shot that travels**, following the product's
   journey (amends "the product performs, not the camera": a move is fine
   when it is the story, never for its own sake). **A 3h film opening IS the
   page's one signature scroll section**; everything else is an accent (3f.2).
   The film is a held stage and must pass the fit and cut-off checks (section 6).
2. **Where it comes from to their product**, ending on their real product
   and the button; only their facts or what is plainly true.
3. **Advert-grade frames**: macro, shallow focus, warm light, a ground lit enough to pass 3h.11,
   detail in the air. Flat studio backdrops fail.
4. **Crisp**: highest resolution; frames drawn on a canvas sized to the
   screen; never shrunk, masked or put in a column.
5. **Chapter lines**: 2 to 6 words per scene over the film (small, at an edge, see 9), their words,
   per section 4 (5b.3), measured at the brightest frame (amends "Nothing moves
   without a reason" for the film opening only).
6. **Three concept stills before any clip**, the chosen one challenged once.
7. **Seams checked** after rendering; a jumping join is regenerated.
8. **After a lit film, a bold colour block** right after it.
9. **Bright, and words off the action**: brightness is settled in 3h.11; lines
   small, at an edge, at most a third of the screen's height, on a soft edge
   shade only (section 4, 5b.3); no big dark patches over the film; check each
   scene for what the words cover.
10. **A choice changes what you see**: picking an option swaps its photo
   (one shoot, one photo per option, sharp at its size), words and button.
11. **Light it bright from the start, then measure**: prompts ask for bright,
   warm, soft light, subject fully lit, mid or light ground (never "dark" or
   "moody" by default); run `scripts/brightness.py` on every film and still
   set (middle 33+, whole 22+, average 30+ of 100) and grade up or regenerate
   before building; view it on a phone in daylight. A dark ground only when the
   business's own look is dark, and then the subject is still lit; a product
   dark by nature (acai, chocolate) is lit and set on a lighter ground rather
   than pushed until it turns milky. Even the dark sites in the videos keep the
   subject brighter than everything around it. **Single home for brightness**
   (3h.3, 3h.9, 3i.1 point here).
12. **One look per product, everywhere on the page** (Chicken Munch, 17 Oct
   2026: the glazed bites in the film's box were popcorn in red sauce in the
   picker). Every picture of the same item (film, close-up, picker, tile,
   card) is the same object. One master per item: their own photo, otherwise
   the film's final frame. Every other picture of it is cut or zoomed from
   the master, or edited with it as the reference; never generate the same
   item twice from words. Film first, item pictures from its last frame.
   Names whose look is unknown get no picture until the owner sends one or
   says which piece is which. Before showing, put every appearance of each
   item side by side; two that could pass for different foods fail.
13. **One cause, one motion** (Chicken Munch, 18 Oct 2026: crumbs fell as
   blocks into a pile, then a second clip exploded them outward). The cause and
   its result happen together in one clip; never let one clip finish an event
   and the next start it again. End the lead-in clip on the last frame before
   its event and generate the event as one clip (peak pinned by an end frame).
   Code pieces start on the exact frame of the cause and match the film's own
   material and light (no halos, cut from the film's frames), or are left out. Watch every effect at 4+
   frames a second before showing: fall-then-fly, a pause mid-action, debris
   that is not the real material, a heap from nowhere, the same played back.
14. **The product stays recognisable through the whole effect**; a moving
   camera never loses it, and on a phone the frame widens if pieces travel past
   the crop.
15. **Pin the peak of a big motion with an end frame** (a still of the
   exploded or poured moment): generated clips play motion down.
16. **A clip played backwards is a free second scene** (explode, then fly back
   together); consider it on every film.
17. **Words and film take turns**: a giant name on the plain ground with the
   film appearing as the letters part; at the end the film moves aside first,
   then the headline arrives.

## 3i. From the professional sites in five videos (Tzvi, 16 Oct 2026)

Full text: `reference/full-rules.md` 3i; notes docs/ui-videos/notes/sites-2026-10-16.md.

1. **The product is the brightest thing on screen**; shadows take the
   background's colour, never black. Brightness itself: 3h.11.
2. **A choice changes the hero itself**: picture and section colour change
   with the option (one shoot, 300 to 500 ms cross-fade).
3. **A live readout tied to the scroll**, only for a true process fact,
   small mono at a corner; never invented, never a section counter.
4. **Words and object overlap**; a product may carry through sections. Only if
   `readable.mjs` still passes on the covered letters; never over the action
   (3i.8).
5. **One colour family per section**, one or two hard breaks.
6. **Floating cut-out tiles** of their ingredients or products, tilted,
   drifting with the scroll, one shoot.
7. **Pressable buttons** (darker bottom edge that sinks); optional floating
   pill menu at the bottom centre.
8. **One word or short line per scene**, beside the subject, never on it.
9. **Tap-able dots on the product** with short captions, placed by measurement.
10. **A glowing floor line under a lit product** (the closing wordmark is 3g.7).

## 3j. Buying psychology, only the honest kind (Tzvi, 19 Oct 2026)

From "20 most powerful psychological tricks brands use to get you to buy"
(attentioncurve.com), checked against these rules. Already covered elsewhere:
social proof (real reviews only, 3b.5), colour (from their logo, 3d), the senses
(big real photos, 3h), their story in their words, and bundles with the real
saving (3c.5). Added:

1. **A guarantee beside the button.** If the owner offers one (money back, "we
   redo it free", free cancellation), it sits under or beside the main button,
   in their words. People hesitate less when they know they cannot lose. Ask
   every owner: "Do you offer any guarantee or promise?" None means none.
2. **One add-on before ordering.** On the order page, one real, relevant
   suggestion from their own menu ("Add a 9x13 rice? ₪75, goes well with a
   pan"), with an Add button and a "No thanks". It shows only when it fits the
   order, goes away once added or turned down, and is never pre-ticked.
3. **Give first.** A free taster, sample, first consultation, quote or
   inspection that the owner really offers becomes the headline offer, beside
   the main button.
4. **Discounts for a group** (students, soldiers, first order, olim) only when
   the owner offers one, said once near the price.
5. **Come back.** A real stamp card ("every 10th box free") or a "Reorder"
   button, only when the owner runs it. Never streaks, points with no
   value, or a reminder for something the customer did not start.
6. **The middle option.** With three sizes or packages, the one most customers
   should pick is shown as the natural pick ("Feeds 8 to 10" is the family
   size). Never invent an option to make another look good, and "Most
   popular" only when the owner says so (3c.5).

Never: invented scarcity or countdowns ("only 3 left", "ends tonight"), a
"was" price that was never charged, changing their prices to .90 or .99
endings, or an endorsement they do not have. These break trust and the hard
rules (section 3).

**Show the deal, when it is real** (Tzvi, 20 Oct 2026: "a strong psychology
technique is when people feel like they are getting a deal ... it should show
what they save when purchasing a 4 pack rather than a single ... a board
double the size should technically be double the price, if it's not they are
getting a deal"). Work it out from the owner's own prices, never invent it:
- a pack or bundle shows what it saves against the same items bought one by
  one ("Save up to ₪44 · ₪37 a jar, single jars are ₪40 to ₪48"), "up to"
  only for the true top of the range;
- **any saving, for anything** (a bigger size, a pack, a bundle, a package,
  a monthly plan, a longer session, more of the same; Tzvi, 21 Oct 2026: "it
  should work for any comparisons") is shown only when it is true like for
  like:
  1. compare only the same thing in a different amount: the same contents,
     the same service, the same product line (a Large Premium board against
     the Small and Medium Premium, never the regular Medium; a 6-jar bundle
     against six single jars of those flavours; a 2-hour session against two
     1-hour sessions of the same service);
  2. work it out per unit first, in a table of every option (per jar, per
     square centimetre, per person, per hour, per kilo, whatever the owner
     sells by);
  3. the bigger option shows a saving only if its unit price is lower than
     EVERY smaller option of the same thing, and the saving is measured
     against the cheapest of them, never against one dearer outlier
     (Blazin' Boards' "Save $77" was measured against the one overpriced
     Medium, while the Large cost the same per square centimetre as the Mini
     and the Small: it saved nothing);
  4. where options differ in more than amount (different contents, extras,
     quality), there is no saving to show;
- **say only the saving, in money** ("You save $77", "Save up to ₪44"), never
  how much more the bigger one costs or a percentage (Tzvi, 20 Oct 2026:
  "don't say how much more it costs, only mention how much they will save in
  dollar terms, make it a rule");
- a combined service against its parts booked apart (Elisheva: gel with
  removal ₪110 against removal ₪40 and gel ₪90);
- in the basket, single items a package would make cheaper get one line with
  the saving and a Switch button;
- an owner's own savings claim the prices contradict is not printed: ask
  them (The Whipped Cup's "save 30+" is ₪20 for six Classic jars).

## 3k. A website, not a page (Tzvi, 19 Oct 2026)

Tzvi: "I want our pages to be used instead of websites so they need to look
like websites and behave like websites with multiple pages." A paid build is a
small website. A single page stays fine for a business with little to say
(one service, one price, few photos).

1. **Pages by kind of business**, from what the owner gave us (no page without
   real content):
   - food: Home, Shop, Contact (About when they send their story)
   - service: Home, Book, Our work, Contact (About when they send it)
   - rental: Home, The apartment, Photos, Availability, Contact
   - shop or gifts: Home, Shop, About, Contact
   **The menu and the order are ONE page, the Shop** (Book for a service;
   Tzvi, 20 Oct 2026: "merge them and make it the standard"). A separate
   Menu page made the visitor read the items, then find them again on the
   Order page. The Shop is built as a product page (docs/inspo/
   product-pages-2026-10-20): one item at a time on a stage, its real photo
   big, name, price and "+" facts beside it, the stage taking the item's
   colour, quantity and the total in the button; switching items crossfades;
   packages below with their choices under them (3l); the basket, delivery
   and details at the end of the same page; the phone bar shows the basket.
   Old Menu and Order addresses forward to the Shop. The Whipped Cup's
   shop.html and Nails by Elisheva's book.html are the worked examples.
   **The order itself is in steps** (Tzvi, 20 Oct 2026: "make steps the rule
   for order pages", from Blazin Boards' order): choosing stays on the Shop
   (or the first screen of Book); the order after it is one question per
   screen: Step 1 Your basket (or Your nails, Your board), Step 2 When and
   where (delivery or pickup, the day, the time), Step 3 Your details, then
   the message. A bar of three lines above says "Step N: name"; the order and
   its total stay beside every step (under it on a phone); the main button
   names the next step ("Continue to delivery") and on the last step what
   happens with the total ("Send order on WhatsApp, ₪163"); a Back button;
   the browser's back button goes back one step (#order-2); each step checks
   only its own fields before moving on. **Every line in the basket has a
   remove button** (a bin, 40 px, "Remove X from the basket"), packages
   included, beside its stepper (Tzvi, 20 Oct 2026). scripts/check-site.mjs
   FLOW walks the steps; The Whipped Cup's shop.html is the worked example.
   Each page is `<page>.html` in the build folder; publish-page.mjs serves it
   at /business/<slug>/<page> and on the business's own host at /<page>.
2. **One menu bar on every page**, identical markup: their name (to Home), the
   pages, the one Order or Book button with a count of what is in the basket.
   The current page is marked (`aria-current="page"`). On a phone the pages
   fold into a Menu button that opens a panel with a Close button and closes
   on Escape or a tap on a link.
3. **One footer on every page**: how to reach them, the page links, the
   MyIsraelRental line.
4. **Shared files**: `site.css` (all styles) and `site.js` (menu bar, phone
   bar, reveals, basket) used by every page; page-only code stays in that
   page. A class name used by a page section (`.open`, `.in`) is never reused
   for a state of a shared part: the phone menu once took the opening's
   centring because both used `.open` (Chicken Munch, 19 Oct 2026).
5. **Each page has its own title, description and link preview image**
   (`og:title`, `og:description`, `og:image`), so a link to the Menu shows the
   menu.
6. **The basket lives between pages**: an Add button anywhere puts the item in
   (localStorage, with `?add=<item>` on the link as a fallback) and opens the
   order page with it already there. The browser back button works the normal
   way: no page hijacks it.
7. **Check every page**, not only the home page: clipped.mjs and readable.mjs
   on each, the phone menu opened, and an Add on one page reaching the order
   page.

## 3l. Similar products: every difference is said on the item (Tzvi, 19 Oct 2026)

Chicken Munch's order page let a customer choose kinds of chicken for every
box and pan alike, while the owner allows several kinds only in the boxes and
the large Roaster, and one kind in a 9x13 pan. Tzvi: "make a rule for similar
products, we need to make sure everything is clear."

1. **Ask before building the order form.** For every family of similar items
   (sizes, boxes, pans, packages, sessions), ask the owner: what can the
   customer choose in each one, and how many? (kinds, flavours, sauces,
   colours, extras, what is included and what is not). Never assume one item's
   rules apply to its siblings.
2. **Say it on the item, before it is added.** Each item carries its own
   short line of what it allows ("Up to 4 kinds of chicken · 3 sauces",
   "1 kind of chicken", "Mix as many kinds as you like"), in the same words on
   the menu tile, the order line and the order message. A one-choice item is
   marked differently from the many-choice ones.
3. **Choices belong to the item, not the form.** Options appear under the item
   once it is added, only for items that allow them. One choice is a radio
   set; a limit greys out the rest when it is reached; an item that needs a
   choice cannot be sent without it, with the reason beside it. Never one
   shared set of options for items with different rules.
4. **Three or more alike: compare at a glance.** Show what differs side by
   side (feeds, kinds, sauces, price), and nothing that is the same for all.
5. **The order reaches the owner itemised**: each item with its own choices
   under it, so nothing is left to guess.
6. **A picture is of that item as it is sold now.** If the owner no longer
   makes it that way, no picture is better than a misleading one (Chicken
   Munch's platter photo, 19 Oct 2026).
7. **Check**: read each item alone. Could a customer tell what they get and
   what they can choose, without reading any other item?

## 3m. Places the owner fills, so the page grows without breaking (Tzvi, 19 Oct 2026)

Tzvi: "if Chicken Munch wants to add more pictures, how would he do that
without it ruining the page look or layout?", and then: "I don't want to keep
personally building pages, I want it to be automated." An owner never adds by
dragging things around; every designed page has fixed places that grow by
themselves, in the page's own style. The same places are what an automated
update will fill.

1. **A gallery on every designed page**: a section with `data-mir-gallery`
   (and `data-max`), a `[data-mir-photos]` list and a
   `<template data-mir-photo>` holding one `<img data-f="img">` in a frame of
   one shape, `hidden` until filled. The owner adds, orders, removes and sets
   the focus of photos in the dashboard (Edit your page, Photos);
   `frontend/public/pages/mir-gallery.js` lays them out, crops each around its
   focus, leaves out photos under 640px wide, and sets `data-count` so the page
   can lay out one, two or four photos well. Chicken Munch's "From our
   kitchen" is the worked example.
2. **Items they sell come from their shop** wherever the page lists products:
   `data-mir-catalog` (`mir-catalog.js`), so a new item, a price change or out
   of stock shows in the page's own tile design. Where an order form has
   per-item rules (3l), those rules are part of the item's data.
3. **Fixed places for details, never free text boxes**: hours, delivery areas
   and fees, a guarantee, FAQ, reviews, each with its spot and a length limit.
4. **Bigger changes** (a new section, a new look) are a design job, not an
   owner edit.

## 3n. The wow gate, scored before anyone sees the page (Tzvi, 19 Oct 2026)

The Whipped Cup and Nails by Elisheva were shown with openings that moved (a
cloud puffing, a photo swapping) and Tzvi found both bland: "I thought we have
rules to prevent this, why was it bland?" The rules said "open on an event"
and "one signature moment", and a small animation passed them on paper. The
gap: nothing measured whether it was strong, so the builder graded its own
work by the letter. From now on a page is not shown until it scores all five,
written into the build notes with one line of proof each:

1. **Their strongest real photo, big.** The best photo the owner has fills at
   least half of the first screen on a laptop and on a phone. Not a small
   card, not a shape cut out of it.
2. **One signature moment that only this business could have**, built from
   their own thing (their steps, their range, their product), that the
   visitor drives: a scroll scene or a choice. Chicken Munch: his bowl dropped
   across CHICKEN. The Whipped Cup: her three steps filling a glass as you
   scroll. Elisheva: tap a shade and the whole opening takes that colour.
3. **The visitor's choice changes the page**, not just one picture (the
   colour, the hero, the order).
4. **Side by side with a reference.** A screenshot of the first screen next to
   the closest Awwwards reference in docs/inspo for that kind of business; if
   ours is plainly weaker, it is not shown.
5. **The one-sentence test, told to someone else**: "you land and ___
   happens". If the sentence is about a decoration ("a cloud puffs"), it
   fails; it must be about them ("you pick a shade and her real work fills the
   screen in it").

A page that fails any of the five goes back to the build, not to Tzvi.

## 3o. Lessons from the Chicken Munch, Whipped Cup and Elisheva builds (Tzvi, 19 Oct 2026)

1. **Food stays the owner's real photo.** Generated food motion (a split
   piece, crumbs flying, a sauce splash, a toss, a drop into a bowl) looked
   fake every time: the model invents the food between the frames and makes
   it smooth, shiny and watery. The wow comes from their real photo moved as
   one solid piece (Chicken Munch's bowl dropped across CHICKEN), big type, and
   the visitor's own choices. Generate only scenery, light or steam, or a
   drawing that is plainly a drawing (The Whipped Cup's glass).
2. **If a liquid must be generated**, prompt the material, not the advert:
   opaque, satin, specks and bubbles, a gentle pour that folds and piles up.
   "High-speed advert splash, glossy, rim light" gives glass or neon. Check the
   still for see-through or glowing edges before showing.
3. **Check product colours look true.** A coloured cloth can cast onto the
   product (Chicken Munch's kraft bowl came out blue-grey). Fix only that
   object's cast (gen/kraft.py is the worked example), never the food.
4. **Label every contact by what it does**: "WhatsApp or call", "Call only,
   no WhatsApp", "Text". Ask the owner which number takes what; never assume a
   number has WhatsApp.
5. **Check the currency sign renders in the heading font.** Some display faces
   have no ₪ and fall back to a broken glyph: set the sign in the body face
   (`<span class="sym">`, Elisheva's page).
6. **One photo per kind, from everything the owner sent.** Look at all of
   them on one numbered sheet, skip duplicates (the same photo sent three
   times), and ask about any photo whose kind is not clear before naming it.
7. **Screenshots as photos**: crop at the screenshot's real resolution (scale
   the boxes by its width), take only the photo area, and ask the owner for
   the originals in the first message.

## 3p. No two businesses look alike, and builds start from the starter (Tzvi, 19 Oct 2026)

Tzvi: "make sure that businesses don't come out too similar." Nails by
Elisheva first came out with nearly Aidy Yaniv's fonts (Cormorant Garamond, a
script, Jost), and Chicken Munch shares Anton with Michal Yodaiken.

1. **Start from `scrollcraft/starter`** (README there): `fetch_business.py`
   pulls the record and every photo onto one numbered sheet in one command;
   `sitekit.py`, `site.css` and `site.js` give the menu bar, phone menu,
   footer, phone bar, contacts labelled by what they do, owner-filled gallery
   and questions. The starter is how the site works, never how it looks.
2. **The look is chosen fresh for each business** from its own logo, photos
   and menu, and written into `scrollcraft/fingerprints.json` (hero,
   signature, nav, close, layout, ground, own_colours) before any section is
   built.
3. **`node scripts/check-fingerprints.mjs <build>` must pass** before the
   page is shown and again before it is published: no heading face shared
   with another site, no shared body face plus script, no two brand colours
   alike (unless they are the business's own), and the design different on at
   least 4 of 6. On a clash the new site changes; an existing site is never
   changed to make room.
4. **Effects are checked too** (Tzvi, 20 Oct 2026: "we already have rules to
   make effects different, like buttons and arrow effects, so why do you keep
   making everything so similar"). Rule 3c said to search fresh for every
   effect, but nothing checked it, and all nine live pages faded their
   sections in the same way, most with the same hover lift and arrows; The
   Whipped Cup's steps then lit up one by one as you scroll, as on other
   pages. Each site lists its effects in `fingerprints.json` under `effects`,
   one id per kind (button, link, tile, reveal, steps, price, heading, plus
   any `other`), ids from `_effects` (the effects library's B, L, T, P, H codes
   and ours). Two sites may share effects worth 2 points (Tzvi: "it's ok if 2
   effects match"); an obvious effect, one a visitor sees without hunting for
   it (marked `loud`: how sections appear, how steps are shown, heading
   animations, scenes), counts 2, a quiet one (a hover, an arrow, how a price
   is set) counts 1. So two quiet effects may match, or one loud one, never
   more. A new effect gets a new id in `_effects`. CONCEPT.md's `## Effects`
   says where each one came from (3q).
5. **One small touch only this business would have** (Tzvi, 20 Oct 2026, on
   The Whipped Cup's cloud for a mouse pointer and Elisheva's sweep in the
   chosen polish shade: "we need to do more unique things like that"). Taken
   from their product, tagline or craft, never a stock effect: CONCEPT.md's
   `## Effects` has a `- touch:` line, and check-concept refuses it missing.
6. **Fits on one screen is measured** (Tzvi, 20 Oct 2026: "not everything is
   fitting on one screen, wasn't that already a rule"). Rule 3c.12 had no
   check, and The Whipped Cup's sections came out up to twice a laptop
   screen's height. `node scripts/check-fits.mjs <urls>` must pass for every
   page: each section fits below the menu bar at 1280x650, 1440x900 and
   1536x753, and no photo is taller than the screen there or on a phone.
   A photo from a phone is never blown up past its own size to fill a wide
   screen (her 1170px photo filled 1920px and looked zoomed in).
7. **Similar items look the same way** (Tzvi: "part of a great website is
   consistency"): if one flavour's thumbnail is one jar, every flavour's is
   one jar; a list where pointing at an item changes a big photo changes it
   for every item.

## 3q. The concept sheet, checked at publish (Tzvi, 19 Oct 2026)

Tzvi: "we need originality like this in our pages, you need to use our inspo
sources better, why are you making bland websites and not following our
rules." The originality that worked came from the business's own words (The
Whipped Cup's "your cup, your cloud" became a walk on the clouds), and the
bland versions were built without opening the saved inspiration at all.

Before any section is built, the build folder gets `CONCEPT.md`: three or
more opening ideas, each citing a saved effect from `docs/inspo` by its
picture; one idea marked "Own:" from the business's own words or world (its
tagline, its process, its place); which was chosen and why; the five wow-gate
answers (3n); a `## Effects` line per kind with its id and where it came from
(a named 21st, Mobbin or Inspo search, or a `docs/inspo` picture); and the
passing line from check-fingerprints (3p).
`node scripts/check-concept.mjs <build>` checks it, and `publish-page.mjs`
refuses to put a NEW page live without it. Read the saved effects for the
kind of business (the part files' "For ..." sections and pictures) every
time; never design from defaults.

## 3r. Checked by the scripts, then by someone else, before anyone sees it (Tzvi, 20 Oct 2026)

Tzvi: "make sure the rules will prevent this in the future, why didn't the
existing rules prevent this." On The Whipped Cup he found a photo blown up
until it looked zoomed in, sections twice a laptop screen's height, one
flavour shown as one jar and the others as four, a big photo that did not
change with the flavour, and package choices he could not find. Fits on one
screen (3c.12), one photo per kind (3o.6) and choices under their item (3l)
were already rules. They did not prevent it because rules held in the
builder's head drift, and the builder then graded its own work (the same
cause as 3n and 3q). So every rule that can be measured is a script, and
the rest is looked at by someone who did not build it:

1. **Scripts, all of them, on every page of the site**: `clipped.mjs`,
   `readable.mjs`, `scripts/check-fits.mjs` (fits the screen at four laptop
   sizes and on phones; no photo shown past 1.35 times its size),
   `scripts/check-fingerprints.mjs`, `scripts/check-concept.mjs`.
   `publish-page.mjs` refuses a new page that fails check-fits,
   check-fingerprints or check-concept.
2. **An independent review**: a Sonnet subagent that did not build the page
   uses it at laptop and phone size against `docs/page-review-checklist.md`
   (consistency, things respond the way they look, every choice under its
   item, photos, the screen, their facts, the one touch). The builder fixes
   every FAIL and the reviewer looks again.
3. **Only then** is it shown to Tzvi. A rule Tzvi has to point out twice gets
   a script or a checklist line the same day.


## 3s. Feels like a real, high-end website, and checked for glitches (Tzvi, 20 Oct 2026)

From nine design videos Tzvi sent ("learn and tell me how we can apply them to our pages to make them
feel like real websites that are professional, modern, high end and beautiful"; notes in
docs/ui-videos/notes/2026-10-20-nine-videos.md). He approved all of them ("yes add them all").

**It feels finished (the craft)
1. Everything you can press answers within 100 ms: a pressed state (slightly
   smaller or darker) and a hover state, cancelled if you scroll away.
2. Nothing jumps: late photos and content fade in over 200 to 400 ms into
   space already kept for them; choosing something never moves the layout.
3. One shadow, the soft kind: light, about 3 px down, about 30 px blur, no
   spread, tinted with the brand colour, never a dark default.
4. One left edge: headings, text and buttons line up on the same margin.
5. A name is at least 1.25 times the size of the line under it, and heavier.
6. Controls that do the same job look the same (height, corner, style).
7. Buttons in sentence case; dividers pale; no "Price:" style labels; body
   lines 1.5 to 1.6 apart; contrast never lowered to look soft.
8. Buttons over a photo sit in a soft container, checked on a light and a
   dark photo.
9. One colour per meaning, everywhere (the kosher tag looks the same on
   every item).
10. The picture appears the moment a thing is named.

**It sells like a premium brand (honestly)
11. One true sentence beside the price says why it costs that (handmade,
    the ingredient, the time it takes), not hidden on an About page.
12. The maker and their real work right after the opening; at least one
    real photo of the product in use or a real setting.
13. Proof sorted by worry: it works, people like me buy it, they will
    deliver; each beside the worry it answers. A guarantee states its limit
    (the limit makes it believable).
14. Real numbers big (three times the body size) with a one-line label, only
    numbers the owner gives.
15. A choice changes the big photo to that choice, with one line about it
    ("light, not too sweet") that also works on a tap.
16. Fewer choices first: a plain question ("How many coffees?", "How many
    people?") before a long list; the first or middle option is the sensible
    one, chosen on purpose.
17. Every option shows its consequence (price, time, slot) and the button
    names it ("Book Sat 11:30", "Add 2 jars, ₪96").
18. Not available shows the nearest real alternative; every choice list has
    a way out ("None", "Other", "I'm not sure").
19. The same promise line and photos on the link preview, the home page and
    the shop.

**Never (the videos' sales tricks)
Invented reviews or counts ("4.9 from 221", "500+ sold this week"), fake
scarcity or countdowns, percentage savings, logo walls, slogans that promise
a journey. Already banned (3j); these videos are full of them.

**Prices, the way shops show them** (Tzvi, the same day: "instead of writing 20% off discount it should
just say 20% off, and it shows the original price with a slash through it next to the current price;
on The Whipped Cup by the prices there's too many words"): a real saving is the old price struck
through beside the price and a two-word badge ("Save ₪12"), never a sentence; the button carries the
offer and its price, so no line explains it again; badges two or three words.

**Checked, not remembered.** `node scripts/check-site.mjs <every page>` fails: BROKEN (script or
console error, a 404, a dead link between pages), SHIFT (layout moves after loading or when a choice is
tapped), GLYPH (a character the fonts lack, like ₪ or →: load a face that has it, or draw it), STATE
(a button with no hover or pressed state), TAP (under 40 px on a phone, or overlapping), ALIGN (text
2 to 12 px off its section's edge, same-kind buttons of different sizes, a card name under 1.25x its
line), PHONE (sideways scroll, the bottom bar over a button at the end), MEDIA (a photo over 600 KB,
an image without its size, a video without a poster, words left hidden with motion off) and FLOW (an
empty form that sends or says nothing, a filled one that sends no message or not the shown total).
`node scripts/check-motion.mjs <pages>` fails a choice that jumps, flashes a blank or old frame
(also on two quick taps), or does not take its colour. Both run with the other checks (3r) before
anything is shown, and publish-page refuses a new page that fails them.

**Studying a video** (Tzvi: "how can you go through videos better to catch everything"): see
docs/ui-videos/HOW-TO-WATCH.md. Every change a video shows becomes a line in a before-and-after
table, and every line is then checked against every page we are building, fixed or marked not
relevant, the same day.

## 3d. The page builder's design rules (v3, the other half of this skill)

Full text: `reference/design-rules.md`. The rules both builders share are
the same rules: section 3c is its Part 10, and its Part 1 is section 1 here.

- **Diagnose bland first**: platform chrome louder than the business, the
  same colours and fonts on every page, a hero headline of 40 to 60px, text
  on a plain ground, everything centred, every section a white card, equal
  weight everywhere. Each has its fix in Part 2.
- **Identity from the business**: the accent from their logo; ground, text,
  muted, surface and rule built around it (5 to 6 colours, neutrals leaning
  to the accent); one accent per screen: one word or one object, plus the primary
  button's fill (3g.3). Two faces (headline and text), at most a third for one
  label style; hero headline 96 to 160px on a laptop, 56 to 72px on a phone.
- **Six presets as starting points** (Candlelight, Bold Pantry, Jerusalem
  Stone, Studio, Field, Workshop), always with their accent swapped in and
  one more element changed.
- **Hero tiers, highest the content allows**: 1 their real photo (graded,
  never a flyer); 2 a film: a brand film of the setting and props, or a generated film of
  their product or ingredients (3g.15, 3h, section 1), with a pause button and
  an invisible loop, never a generated setting presented as their real premises; 3 a typographic brand
  panel. The footer says when tier 2 was used.
- **Rhythm**: set piece, quiet, set piece; one showstopper (a signature scroll
  section takes the role from the hero); a palate cleanser with no text; one
  signature detail only they would have; end on the offer.
- **Effects catalog**: one bold moment, up to three accents and four quiet
  touches; an effect only when the business has the material for it; held
  sections fit or are not held; the order section is never pinned; a page
  differs from each of the last ten live pages on at least 4 of the 6
  FINGERPRINTS dimensions; owners choose from up to three versions, and only a version
  that passes the visual check goes live.
- **Quality gate** (Part 9): score the page before returning it, list what
  is below the bar and give the owner a checklist of what would unlock more.

## 4. Design and story

- **A set of images reads as one shoot** (Tzvi, 8 Oct 2026): tiles and rows
  share one angle, one light, one plain background, one subject size. Their
  own matching photos first; otherwise generate the whole set in one pass
  from one style preamble (category and atmosphere tiles only, never a
  product being chosen); stock only from one photographer's series, never
  cut-outs mixed from many. Check the contact sheet; food stays
  kosher-appropriate. Full text: `reference/full-rules.md` §8.
- Find what the business actually has before choosing a look; the page is
  built around the one thing that is really theirs.
- **The product performs, not the camera.** Motion shows what they sell; no zooming for its own sake (a camera that follows the product's journey is fine, 3h).
- **One signature idea per page**, describable in one sentence, never reused
  for the next business. **One peak**; the ending resolves on the action. This is the single home of
  the one-idea, one-peak, one-signature rule. A 3h film opening IS the page's one
  signature scroll section; everything else is an accent (3f.2).
- No blank screens, no scroll cues, no "01/06" counters, no label above every section.
- Top of the page: a ceiling of 4 pieces of text, headline at most 2 lines; the
  first screen itself follows 3g.13.
- **Text over imagery** (5b.3 in the full rules, the single home of this rule).
  On a photo or film: a soft shade along the edge the words sit on, contrast
  measured on the brightest frame (`readable.mjs`); a small solid card is
  allowed; big dark pools, full-frame darkening and frosted glass are not.
- No default "premium" palette (cream with brass) and no AI purple; the
  palette comes from their logo and photos.
- Honest persuasion only: repeat the promise that brought them, reassurance
  beside the button, next steps as steps, one job per page, real specific numbers.

## 5. Build rules (each one shipped as a defect once)

| Rule | The defect it prevents |
|---|---|
| Anything placed on a spot in a photo or video is placed **by measurement** (a detector on the real frames), never by eye. | A knob landed beside the pot's dial. |
| An overlay that must stay on moving media **lives inside the media's element**, in its own percentages. Never chase it with script on scroll. | The knob trailed the dial as the page scrolled. |
| **If the camera moves, steady the clip** on the spot first; never key an overlay to video playback time. | The knob was right on one screen, off on another. |
| **Nothing moves without a reason** (ambient background clips and ordinary sections; a 3h film opening follows 3h instead). A clip behind text holds still except the subject (steam, a pour); no drift, breathing zoom or shifting in and out. Freeze the frame and mask the motion to where it belongs. | The pot screen "shifted in and out" while only numbers changed. |
| **Text never re-wraps while its container animates.** Fixed width for the narrowest state, or fade between states. | Words jumped lines as a panel widened. |
| **No in-between state looks unfinished.** Check every transition at its middle; an emptied area goes to the page ground, never a bare panel. | An empty grey strip mid-scroll. |
| **Text over imagery follows section 4 (5b.3)**, and is checked at the brightest frame and the narrowest screen. | A line sat on bright steel. |
| **A pinned section must fit at 650px tall**, or it is not pinned. The order section is never pinned. | The order controls were cut off on a 1536x753 laptop. |
| **A line of items separated by dots never wraps.** Stack them if it might. | A stray dot started the second line. |
| **A fixed bar never covers content.** Give content room for it. | The phone order bar hid two lines. |
| **Nothing is cut off by the box it sits in.** Every label, number, ruler and photo sits wholly inside the section that holds it, at every screen size, laptop, short laptop and phone. Something that flies in from off-screen (mark it `data-clip-ok`) may be cut while it travels, never once it has landed. Run `scripts/clipped.mjs`. | "10 cm" under Blazin' Boards' growing board was sliced in half, and the landed board ran 42px off a short laptop (12 Oct 2026). |
| **A cut-out is one subject, cleanly.** No stray pieces (a garnish sliced off at the photo's edge, specks), no pale fringe from the old background. Clean it with `scripts/cutout.py`, then `cutout.py --check`, and look at it on a dark and a light ground. | Blazin' Boards' board kept a cut-off olive and white specks (12 Oct 2026). |
| **A label never covers the thing it labels.** Compute where the spot lands once the camera settles; if the card would sit on it, the card takes the other side for that spot. | The oven card sat on the oven on a phone. |
| **No block is taller than the screen**: a hero's copy and button, a tile, a list, the offer, each seen whole at 1280x650, 1440x900 and a phone. Measure the heights. | A 1-to-1 tile was 940px tall: you saw the dumbbells, not the price. |
| **A caption stays up until the next one replaces it**, including while the camera travels. | Bare kitchen between stations. |
| **A payoff is seen where it happens, on every device**: a counter, clock or progress line is checked at its finish on a phone and a laptop; hiding a bar or button never hides it. | Michal's 30:00 clock slid away on phones just before reaching it. |
| **Check every state as the device that shows it**: hover-only and touch-only looks, short screens, the phone bar on and off; phones with touch emulation, never a narrow desktop window. | The preview video showed outline buttons no phone draws. |
| **Two rules on one element are checked together**: when one rule hides or changes an element, keep what else lives in it. | "No second button" took the session clock with it. |

## 6. Look through it, fix it, then show it

The owner never sees a first draft. Before showing anything:

1. **Render it** as a visitor meets it: laptop and phone, each language, normal
   and reduced motion. Walk a scroll page top to bottom at several positions
   per section, never one screenshot. Include a short laptop (1536x753 or
   1280x650); the default 900px-tall test hides the worst bugs.
   Phones as phones (touch emulation, a short one like 360x640 too), and
   every moment the page builds to (a counter's finish, the bar turning, the
   last section) looked at on each device, not only the start.
2. **Look at every screen** for anything broken or unfinished, even if no rule names it.
3. **Run the checks** (scripts below; run from the project folder so they find its Playwright):
   - `node ~/.claude/skills/build-business-page/scripts/readable.mjs <url>`:
     every visible word at six sizes and many scroll points; fails under 12px,
     a sentence under 14px on a phone, or contrast under 4.5:1 (3:1 large)
     against the real pixels behind it, photos and video included.
   - `node ~/.claude/skills/build-business-page/scripts/scroll-finish.mjs <url> <selector> "<done>"`:
     for every scroll-tied effect; scrolls past at six sizes and fails if it
     completes after its subject has passed the middle of the screen.
   - `node ~/.claude/skills/build-business-page/scripts/clipped.mjs <url>`:
     every word and picture cut by the box it sits in, scrolling the whole page
     at seven sizes; fails on any. Run it on every page of a site.
   - `python ~/.claude/skills/build-business-page/scripts/cutout.py --check <img>`:
     a cut-out has one piece and no pale fringe (and `cutout.py in out` cleans it).
   - `node ~/.claude/skills/build-business-page/scripts/cutoff.mjs <url>`:
     anything cut off by a pinned or full-screen section at nine sizes.
   - `scripts/overlay-truth.mjs <url> <overlay> <section>`: for anything
     placed on a spot in a picture; hides it, finds the real spot with
     OpenCV, measures the miss at six sizes; over 4px fails.
   - The cinematic's own checks from scroll-craft (`shoot.mjs` at 1440x900,
     390x844 and reduced motion).
4. **Fix every finding, render again**, repeat until a full pass is clean.
5. **Then show the owner** the finished page with a short plain note of what
   was fixed and what could not be (needs their content, a decision, or a real
   device). For a shareable preview:
   `node <skill>/scripts/record.mjs <url> 390 844 preview-phone.mp4`.

## 3t. Sections change worlds (Tzvi, 21 Oct 2026, after moto-card.com)

Tzvi: "go through this website and you'll see that there are different sections and it changes to pictures, not everything is just one colour ... this looks like a real website, ours do not." Study: docs/inspo/moto-card-2026-10-21/.

1. **The home page is a sequence of worlds, not one colour.** After the opening, the ground changes from section to section: a full-bleed photo or film, then a calm section on a contrasting plain ground (white or the brand's dark), then a picture again. Never three sections in a row on the same plain ground.
2. **Pictures carry the page.** At least a third of the home page's sections are mostly picture or film edge to edge (the owner's real photos first; generated scenes of their real products only under rule 1's limits), with the words on the picture, not in a box beside it. Words over a picture follow 5b.3 (a soft edge shade, never a scrim).
3. **One big line per section,** short, with at most one short line under it; small calm body text; lots of space.
4. **One action, identical everywhere:** the same button, same words, in the bar, in the sections that sell, and in the footer.
5. **Their own details as texture:** a true detail of the business (their prices, sizes, hours, street, fruit, cuts of meat) used as the moving or background detail, instead of decoration.
6. **Plain sections are rests:** numbered lists, prices, FAQ and contact sit on a calm plain ground with hairlines, between the pictures.
7. **A real footer:** a last big line, the button, link columns, contact.
scripts/check-site.mjs WORLDS checks 1 and 2 on every home page (and OPENING checks 3h.1); publish-page refuses a page that fails.
