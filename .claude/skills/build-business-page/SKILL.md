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
  will have many more options"): the library is a shelf of tested extras, never
  the menu. Each page's options come from a new search for that business, with
  library pieces added only where they fit better.
- **Browser pane / preview**: show the rendered page; never ask the owner to
  sign in to see it.

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
- `scripts/`: `readable.mjs`, `cutoff.mjs`, `overlay-truth.mjs`, `record.mjs`.

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
- Generated images and video: allowed for atmosphere (hero, backgrounds,
  scroll scenes) and to enhance their own photos. Never on product cards
  where people choose what they get, never a generated person shown as their
  staff or customer, never their premises made up, no text baked in. Respect
  the business (a kosher business: nothing non-kosher, no meat with dairy).
  Movement copied from a reference video is built in code, not generated.

## 2. How to write

1. **Their words first.** Reuse the owner's phrasing; tidy, never replace their voice.
2. **Specific over generic.** "Sourdough and challah in Beit Shemesh", not
   "quality baked goods". Banned: welcome to, look no further, one-stop shop,
   passionate about, quality you can trust, world-class, top-notch.
3. **Headline: what + where** (or what + for whom), at most 10 words. The name
   is already on the page.
4. **The line under it says what you get**, plainly (food: the food and how it
   arrives, not a slogan). At most 20 words.
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
   it, what to do next.
2. **Proof touches the main button:** price, credential or rating right beside it.
3. **One solid button per screen.** Everything else is outline, link or tile.
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
   display scale, strong contrast; never a small card on a quiet picture.
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
   **Search fresh for every piece on every build**: the button, the arrow, each
   effect and section get their own Mobbin, 21st and Inspo search for that kind
   of business before the library is opened; say for each pick whether it came
   from a new search (name it) or the library.
2. **No AI default look**: no cream + serif + one italic word unless that is
   their brand. At least one section on a contrasting ground.
3. **Proof where the worry is**: each worry the owner names is answered beside
   the button or price it belongs to. No wall of one-line reviews.
4. **Show it in use**: their photo of it used, served or delivered leads; a
   generated image only sets the scene around their own picture.
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
    reorder, order updates). Never fake urgency, endless feeds, random
    rewards or guilt streaks.
11. **Video: draw it, then check it.** `scripts/record.mjs` renders each
    frame for its exact time (no stutter, same result every run) and writes a
    contact sheet beside the video: look at it before sending. Paid
    generation waits for the owner's yes on two or three style frames.
12. **Everything fits on one screen** (from woodwrights.co.nz): wherever a
    visitor stops, each photo is seen whole with its words and price. No
    block taller than the screen at 1280x650, 1440x900 or a phone; cap
    photos and big type by `svh`; a main tile puts its photo beside its words.

## 3d. The page builder's design rules (v3, the other half of this skill)

Full text: `reference/design-rules.md`. The rules both builders share are
the same rules: section 3c is its Part 10, and its Part 1 is section 1 here.

- **Diagnose bland first**: platform chrome louder than the business, the
  same colours and fonts on every page, a hero headline of 40 to 60px, text
  on a plain ground, everything centred, every section a white card, equal
  weight everywhere. Each has its fix in Part 2.
- **Identity from the business**: the accent from their logo; ground, text,
  muted, surface and rule built around it (5 to 6 colours, neutrals leaning
  to the accent); the accent fills only the primary button. At most three
  faces; hero headline 96 to 160px on a laptop, 56 to 72px on a phone.
- **Six presets as starting points** (Candlelight, Bold Pantry, Jerusalem
  Stone, Studio, Field, Workshop), always with their accent swapped in and
  one more element changed.
- **Hero tiers, highest the content allows**: 1 their real photo (graded,
  never a flyer); 2 a brand film of the setting and props, never the product
  as theirs, with a pause button and an invisible loop; 3 a typographic brand
  panel. The footer says when tier 2 was used.
- **Rhythm**: set piece, quiet, set piece; one showstopper (a signature scroll
  section takes the role from the hero); a palate cleanser with no text; one
  signature detail only they would have; end on the offer.
- **Effects catalog**: one bold moment, up to three accents and four quiet
  touches; an effect only when the business has the material for it; held
  sections fit or are not held; the order section is never pinned; a page
  differs from each of the ten newest live pages of its category on at least
  2 of 7 axes; owners choose from up to three versions, and only a version
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
- **The product performs, not the camera.** Motion shows what they sell; no zooming for its own sake.
- **One signature idea per page**, describable in one sentence, never reused
  for the next business. **One peak**; the ending resolves on the action.
- No blank screens, no scroll cues, no "01/06" counters, no label above every section.
- Top of the page: at most 4 pieces of text, headline at most 2 lines.
- Text never sits straight on a photo: a band or shaded edge behind it.
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
| **Nothing moves without a reason.** A clip behind text holds still except the subject (steam, a pour); no drift, breathing zoom or shifting in and out. Freeze the frame and mask the motion to where it belongs. | The pot screen "shifted in and out" while only numbers changed. |
| **Text never re-wraps while its container animates.** Fixed width for the narrowest state, or fade between states. | Words jumped lines as a panel widened. |
| **No in-between state looks unfinished.** Check every transition at its middle; an emptied area goes to the page ground, never a bare panel. | An empty grey strip mid-scroll. |
| **Text over imagery is checked at the brightest frame** and narrowest screen. | A line sat on bright steel. |
| **A pinned section must fit at 650px tall**, or it is not pinned. The order section is never pinned. | The order controls were cut off on a 1536x753 laptop. |
| **A line of items separated by dots never wraps.** Stack them if it might. | A stray dot started the second line. |
| **A fixed bar never covers content.** Give content room for it. | The phone order bar hid two lines. |
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
