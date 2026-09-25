# The AI page builder

Written 31 Aug 2026. **Draft: the architecture and the rulings are settled, the
research pass is not done.** A research agent and a codebase agent were commissioned
and blocked by a model outage; §8 lists what they still owe. Do not build past
Phase 1 until that lands.

Related and partly superseded: `docs/business-page-customization-spec.md`,
`docs/business-page-spec.md`, `docs/owner-sharing-spec.md`.

---

## The vision, in Tzvi's words

> Businesses fully customise their pages using our Claude. A limited number of
> prompts, then they pay for more. Each page uses our design and psychology
> skills to showcase their brand. A luxury clothing brand needs a different look
> and feel from a cheap brand. A product needs to look different from a full store.

## Rulings (Tzvi, 31 Aug 2026)

1. **AI composes from a vetted block library.** It never emits code.
2. **Free prompt quota, then paid packs.**
3. **The page is fully theirs.** No MyIsraelRental branding on it.
4. **Every business gets it**, with tiered depth.

## Rulings (Tzvi, 23 Sep 2026): proof for everyone, clarity is paid

5. **Every page gets the proof beside the button.** The star rating and the
   owner's true credentials (verified, years in business, kosher on a food
   business) sit right beside the main Message / Book / Order button on every
   business, service and property page, now and for every page made later.
   Built as `components/marketplace/ProofLine.jsx`; the rules in
   `frontend/src/utils/businessProof.js`.
6. **Everything else stays standard by default.** The standard page is not
   otherwise improved toward the upgraded one.
7. **Clarity and psychology are a paid upgrade**, a separate add-on (not part
   of Pro): the four questions answered at the top, at most two strengths, one
   leading action, a phone sticky bar on property pages, deliberate empty
   states. The future AI-built page is part of the same paid upgrade.
   Switched per person by `utils/page_upgrade.has_page_upgrade(owner)`, the
   one check every upgraded behaviour reads; an admin turns it on by hand
   until payment exists.
8. **Never, for anyone:** invented urgency ("booked 11 times today") unless a
   real, current count exists; invented testimonials, credentials or claims;
   hidden low ratings.

### What ruling 3 means, precisely

**Visually theirs. Structurally ours.** Nothing on the page says MyIsraelRental,
and the palette, type and imagery are entirely the business's. But every block
still enforces contrast minimums, RTL correctness, touch-target sizes and a
spacing scale, because those are not branding. They are the difference between a
page that works and a page that embarrasses the owner who sent the link.

### This reverses an earlier decision, deliberately

`business-page-customization-spec.md` chose "choices, not freedom" and four fixed
accent tints, reasoning: *"a page that can be made ugly will be, and an owner will
not send a link to something that embarrasses them."*

**That reasoning is still correct.** It is not overturned, it is relocated: the
guarantee now lives in the block library rather than in a four-item list. Every
block is designed once, by us, to look good in every theme it can be given. The
owner gains expression; they do not gain the ability to produce a bad page.

`utils/businessAccent.js` is built and shipping. It becomes one preset among many,
not the ceiling.

---

## P1 — The architecture: a composition document, not code

**The model's output is a JSON document describing a page. It is schema-validated
before anything renders. Anything not in the schema is rejected, not sanitised.**

```
{
  "theme":  { "palette": …, "type": …, "density": …, "imagery": … },
  "blocks": [ { "type": "hero", "variant": "full-bleed", "props": { … } }, … ]
}
```

Non-negotiable properties:

- **A closed vocabulary.** `type` and `variant` must exist in the library.
  `props` are typed and bounded. No free-form HTML, no style strings, no class
  names, no URLs outside the business's own uploaded assets.
- **Reject, do not repair.** If the model returns something invalid, regenerate.
  Silently fixing malformed output is how an escape hatch appears.
- **The page renders from the document, server-side-safe.** The document is data.
  It can be diffed, versioned, rolled back and reviewed.

### Why not let it write the page

The frontend renders **zero user-authored HTML**. The only two
`dangerouslySetInnerHTML` call sites are a DOMPurify-sanitised i18n string
(`Auth.js:186`) and JSON-LD (`FAQ.js:213`). No markdown renderer, no
`sanitize-html`, only `dompurify` in `package.json`.

**Correction, 31 Aug 2026.** An earlier draft of this paragraph said the app
renders no owner content as markup anywhere. That was wrong. **The backend
assembles HTML from owner-supplied strings** in `short_links.py:384-423`, which
builds the link-preview page from `biz.name`, `biz.description` and image URLs
(`:339-366`). It is escaped correctly (`e = html.escape`, `:397`) and served with
`nosniff`, `SAMEORIGIN` and HSTS on all three response branches
(`frontend/server.js:283-291`), **but there is no test asserting the escaping.**
Add one. It is the third place owner content becomes markup on the production
origin, and it is the one nobody is watching.

A generated page containing model-written markup, hosted on our domain next to
logged-in sessions, is an XSS and session-theft surface. Sanitisers are a
mitigation, not a guarantee, and the attacker here is not hypothetical: anyone can
sign up as a business and prompt. **The block library is not a compromise on
ambition, it is the only version of this that can be hosted on our own origin.**

If free-form pages are ever wanted, they go on a separate origin
(`pages.myisraelrental.example` or the owner's own domain), where the blast radius
is contained. Not before.

## P2 — Brand archetype to design decisions

This is the crux of the request and the hardest part to get right. "A luxury brand
needs a different feel from a cheap brand" is true and it has to become parameters.

The theme is not a colour picker. It is a small set of dials the model sets from
what the business tells it:

| Dial | Range | What it changes |
|---|---|---|
| **Density** | airy → packed | Whitespace, items per row, section padding |
| **Type** | display serif → grotesque → geometric | Heading face, weight, size, letter-spacing |
| **Palette** | monochrome+one → duotone → saturated | Number of hues, saturation, contrast |
| **Imagery** | full-bleed editorial → grid → thumbnail | Photo size, crop, treatment, count |
| **Price prominence** | quiet → loud | Where price sits, how big, whether badged |
| **Motion** | still → subtle | Reveal behaviour, always reduced-motion safe |

Two worked positions, as a starting point for the research pass to verify and
extend:

**Signals expensive:** low density, generous margins, few items visible at once,
large light-weight type, restrained palette (one hue plus neutrals), full-bleed
photography, price stated quietly and never badged, no urgency, no exclamation.

**Signals good value:** higher density, many items visible, bold heavy type,
saturated accent, price large and prominent, badges and comparisons, clear
repeated calls to action.

**Single product versus full catalogue is a different axis and needs different
blocks**, not just different dials. One product wants a long scroll: hero, detail
shots, story, specification, one CTA repeated. A catalogue wants a grid, filters
and browse density from the first screen.

**The model's job is to place the business on these dials from a short
conversation, then pick blocks that suit.** It is not choosing hex values freehand.

## P3 — The prompt loop and the quota

**Ruling: free prompts, then paid packs.** The known failure mode of that model is
people burning free attempts on bad results and leaving angry rather than paying,
so the loop has to be built against it:

- **The first generation must be good without any prompting.** Compose from what
  we already know: category, name, photos, prices, areas, hours. An owner who
  spends a free prompt to reach a decent starting point has been charged for our
  cold start.
- **Refinements are cheap and specific.** "Make it warmer", "show prices bigger",
  "fewer things on screen" should each be one prompt with a visible diff.
- **Do not charge for a failed generation.** If the owner discards without saving,
  it does not count. This is the single most important rule in the section.
- **Show the remaining count before they spend**, never only after.
- **Presets are free and unlimited.** Switching between finished looks costs
  nothing; only generating new ones costs.

## P7 — The prompting experience. Nobody types a prompt.

Tzvi, 31 Aug 2026:

> Regular people don't know how to prompt AI well. I want it to be easy for them
> and get the best results with the least amount of prompts.

**The governing principle: a blank text box is a failure of design, not a feature.**
A baker cannot describe a design. She can recognise one instantly. Every decision
below converts authoring into recognising.

### P7a — Start with a finished page, not a question

**The first composition costs zero prompts and requires zero input.** It is
generated from what we already hold: category, name, photos, prices, areas, hours,
logo. The owner's first experience is *seeing their page*, not being asked what
they want.

This is not a nicety. An owner who spends a prompt to reach a decent starting
point has been charged for our cold start, and that is the documented reason people
abandon these products angry rather than paying.

### P7b — The brief. Six questions, mostly taps, before anyone types anything.

**The form is the prompt engineering.** An owner never writes a prompt; they answer
a short brief, and the brief is what the model receives. This is how a real
designer starts a job, and it is the difference between a vague sentence and an
actual specification.

**Rules for the form itself:**

- **Six questions, target 90 seconds.** Every one must visibly change the output.
  A question that does not change anything is a question that should not be asked.
- **The preview updates live as they answer.** They watch the page assemble. This
  turns a form into something people finish, and it teaches what each choice does
  without a word of explanation.
- **Everything is skippable and every default is good.** Someone who answers
  nothing still gets a page worth sending.
- **Endowed progress.** They have already given us name, category, area, photos and
  prices. Show that as *"4 of 10 answered"* on arrival, not zero. People finish what
  looks nearly finished.
- **Answers are saved.** Regenerating later never re-asks. Editing the brief is
  free and does not consume a prompt.

#### The six

**1. What are you showing people?** (single choice, drives the block set)
A few services · A catalogue of products · One main thing · A place people visit ·
Properties

**2. What should someone do when they land here?** (single choice, drives the CTA
and the layout)
Message me · Book a time · Come to the shop · Order something · Just understand
what I do

**3. Who is it mostly for?** (single choice, drives tone and language emphasis)
Locals nearby · English speakers and olim · Tourists · Other businesses · Everyone

**4. Where do your prices sit?** (single choice, drives price prominence and
density. Phrased without judgement, because nobody ticks "cheap")
Premium, and worth it · Fair, middle of the road · Great value, keenly priced ·
Depends on the job, I quote

**5. What should people know first about you?** (choose up to two, drives which
trust blocks appear and in what order)
The quality of the work · How fast I am · The price · Years of experience ·
Kosher certification · I speak English · Family business · Licensed and insured

**6. Which of these feels closest?** (four thumbnails rendered from **their own
content**, not stock examples. The recognition question, and the most informative
one in the set)

#### Then, optionally

**"Anything else you want people to know?"** One short free-text field, 200
characters, clearly optional. This is where their voice enters, and it is the only
place they type. Placeholder shows a real example rather than instructions:
*"We have been on Emek Refaim since 1998 and everything is baked the same morning."*

**"Show us something you like."** A link, a photo, or skip. Covered in P7c.

#### What the model receives

Not a sentence. A structured brief: the six answers, the free text, any inspiration
parameters, plus everything we already hold about the business. **The model's job
is to place them on P2's dials and pick blocks, from a specification, not to guess
from a vague adjective.**

#### What not to ask

- **Nothing that flatters and decides nothing.** "What is your brand personality?"
  produces an answer people enjoy giving and that changes nothing downstream.
- **No colour question.** Palette comes from their logo, their photos, or their
  answer to 4 and 6. Asking produces a colour picker by the back door, and the
  reason we do not have one is in P1.
- **No adjective lists.** "Modern, playful, bold, minimal" get ticked arbitrarily
  and the output then feels random, which reads as the AI being bad rather than the
  question being bad.
- **Nothing they would have to look up.** If an owner has to go and find something
  to answer, they close the tab and do not come back.

#### Tzvi's verdict on the six questions (walkthrough, 24 Sep 2026)

Tzvi went through the brief as an owner would, on a local copy of a live business
(L.A. Cholent, a caterer with a kosher certificate), answering each question while
the page on the side updated. He rejected four of the six, and all four for the same
reason: **the owner should not be designing their page.** What leads, the look and
the main button are for our design and conversion skills to decide from the
business's own data, not for the owner to choose.

| # | Question | His answer | What it did on the page |
|---|---|---|---|
| 1 | What are you showing people? | "It's clearly a food product to help make cholent easier" (typed, not picked) | Nothing at first: a caterer with a certificate always gets the food recipe, so the answer was ignored. Fixed the same day (see below). His wording also says the system should already know this from their listings. |
| 2 | What should someone do when they land here? | **Rejected.** "Every home page for any business should be showcasing that business, explaining what they offer and convincing them to use their product or service. This isn't a good question." | Skipped. |
| 3 | Who is it mostly for? | Locals nearby | **Nothing.** Only "other businesses" and "tourists" move a dial; the other three answers change nothing, which breaks P7b's own rule that every question must visibly change the output. |
| 4 | Where do your prices sit? | Fair, middle of the road | Nothing visible for this business: "fair" is where the food recipe already sits. |
| 5 | What should people know first? | **Rejected.** "The first thing people should see is something which will statistically make it the highest likelihood they will buy the product or use the service." He pointed at Blazin' Boards, which led with the product in its real sizes, not with any of these choices. | Skipped. |
| 6 | Which of these feels closest? (four looks of their own page) | **Rejected.** "Why are you asking this? Doesn't our design skills deal with this?" | Skipped. |

**What this means for the builder** (his direction; the replacement design is not
written yet):

- **The generator decides, from the data and the evidence.** What leads is whatever
  is most likely to make a visitor buy or book (rulebook §5c), chosen by our design
  and conversion rules, not by the owner ticking a strength.
- **The main button follows from what they sell**: a store listing gets Order, a
  bookable service gets Book, anything else Message. Never asked.
- **The look is ours to set** from their logo, photos and category, not a
  recognition question.
- **Questions 2, 5 and 6 go.** Questions 3 and 4 stay only if they can be made to
  change the page visibly, or go too. Whatever the owner is still asked should be
  facts only they know (what they sell, their prices, how ordering works), never
  design choices.
- `PageBriefForm.jsx` and `briefToTheme()` are live on the standard page editor and
  were not changed; retiring or cutting them down is a separate, explicit step.

**Found in the same walkthrough, and fixed in `utils/page_recipes.py`:**
- `showing` now moves a dial even when another recipe wins (one main thing: airy;
  catalogue: denser; place: full-bleed), as `briefToTheme()` does.
- A description whose sentences end in "!" read as one long sentence, so the hero's
  line under the headline came out empty. "!" now ends a sentence too.

**Found, not fixed:**
- **The three options were weak.** All passed every rule, but the headline could
  only say "Catering in Jerusalem" because their one listing is named "Catering",
  while the real product (a cholent kit in three sizes, with who each size feeds and
  "put it in your crock pot, add water") had no block to show it. That is gaps 4
  and 5 in the category study (steps, a menu or size list), and it is what Tzvi's
  "highest likelihood they will buy" rule would lead with.
- **Their listing photo is a flyer with their phone number and email printed on
  it**, so the chat-only page shows both through an image. Nothing checks images for
  this today.

### P7c — Let them bring what they like

They already know what good looks like, they just cannot say it. So let them point
at it. Three inputs, all optional:

1. **A link to a site they admire.** We fetch it and extract **parameters**:
   density, type classification, palette, imagery treatment, price prominence.
2. **A photo** of their shopfront, their packaging, a picture with the right mood.
   We take palette and feel from it.
3. **Their logo**, which we already have. Free palette, and the most obvious
   untapped signal on the site.

**We extract dials, never designs.** The output is a position on P2's six axes, not
a copy of anyone's layout. Say so plainly in the UI: *"We will match the feel, not
the design."* Cloning a real business's page for a competitor is both a legal
problem and a reputational one, and the temptation is entirely predictable.

### P7d — One generation returns three options, not one

The cheapest way to cut prompt count is to stop spending one per attempt. **Each
generation produces three compositions side by side.** The owner picks. Marginally
more tokens, dramatically fewer prompts, and it converts a gamble into a choice.

### P7e — Refinement is dials, and dials are free

**This is the load-bearing decision in this section.** Separate two operations that
look similar and are not:

| | Costs a prompt | Cost |
|---|---|---|
| **Generate a composition** — new blocks, new structure | Yes | ~3.5 cents |
| **Adjust a dial** — re-render the same composition with different parameters | **No** | Nothing |

Most of what an owner wants after the first draft is a dial, not a regeneration.
Warmer, calmer, bigger prices, fewer photos, more space, darker. **All of it is a
parameter change re-rendered locally, instantly, at zero cost.**

So the refinement UI is **buttons, not a text box**:

`Warmer` `Cooler` · `Calmer` `Busier` · `Bigger prices` `Quieter prices` ·
`More photos` `More words` · `Lighter` `Darker`

Instant, reversible, unlimited. An owner can spend twenty minutes getting it right
and consume nothing. **The quota then only ever bites on genuinely new structure**,
which is both fair and rare.

### P7f — When they do type, translate visibly

Keep a text box, but secondary, with example chips above it so it is never blank:
*"more like a bakery"*, *"less busy"*, *"make the prices stand out"*.

Accept vague language and map it to dials. *"Make it classier"* becomes density
down, type to serif, palette to fewer hues, price quieter. **Then show what
changed**: *"Made it calmer, switched to a serif, quieter prices."*

That last part matters more than it looks. It teaches the vocabulary, so the
second request is sharper than the first, and the owner learns they can reach the
same result with a free button.

### P7g — Nobody is afraid to experiment

- **Every version is kept.** One click back to any of them, forever.
- **The remaining prompt count is shown before they spend, never only after.**
- **Discarding costs nothing.** Restated here because it is the rule the whole
  section depends on.
- **Presets are free and unlimited.** Switching between finished looks is not
  generation.

### What not to do

- **No blank text box as the primary input.** Ever.
- **No adjective pickers** ("modern / playful / bold"). People choose them
  arbitrarily and the results feel random, which reads as the AI being bad.
- **No sliders for things with a right answer.** Contrast, spacing scale and touch
  targets are not opinions.
- **No prompt-writing tips or "how to prompt" help.** If the UI needs that, the UI
  is wrong.
- **Hebrew must work identically.** A Hebrew speaker typing a Hebrew refinement
  gets the same quality, and the example chips are written natively rather than
  translated.

## P4 — The quality floor, which is what makes this safe to ship

Every composition, whatever the theme, is validated before it can be saved:

- **Contrast** computed for every text-on-background pair the theme produces.
  Fails, the theme is adjusted or rejected. Never shipped with a warning.
- **RTL** correct by construction. Blocks use logical properties only; heading
  fonts come from variables, never a literal face, since Playfair has no Hebrew
  glyphs and inline styles beat `[dir="rtl"]`.
- **Touch targets** at 375px.
- **No layout shift**: every image slot has a defined aspect ratio.
- **A page with no photos and no prices still looks deliberate.** This is the
  common case for a new business, and it is where generated pages usually fall
  apart.

## P4a — The clarity floor (Tzvi, 23 Sep 2026)

P4 keeps a page from looking broken. This keeps it from being unclear. It
applies to upgraded pages (ruling 7) and to every page the AI generator will
produce: **each of the three options in P7d must pass it before it is shown.
An option that fails is rejected, not repaired**, the same way P4 treats
contrast. A repaired page is one nobody chose.

In the first screen, in the page's own language, a visitor can answer:

1. **Where am I?** Who they are, what they do in plain words, and where.
2. **What do I get?** What they offer, with at least one thing named.
3. **Why should I care?** A real reason backed by real proof: reviews,
   verified, years in business, kosher on a food business. Owner-chosen
   strengths count only when the data backs the checkable ones (kosher needs
   a certificate, experience a founding year, licensed a licence number,
   English a language listed).
4. **What do I do next?** One clearly leading action, the one in their brief
   (`action`: message, book, visit or order) and possible on this page;
   everything else visibly secondary.

And:

- **At most two strengths** near the top (`PageBrief.strengths`).
- **Deliberate empty states.** No photos, no prices or no reviews still reads
  as intentional ("Ask for a quote"), never a blank.
- **Hero text within its limits** (`HeroProps`: title 80, accent 40, lede 200).
- **Nothing invented** (ruling 8).

The check is deterministic, no AI: `backend/utils/page_clarity.py`. Given a
business, its page and a language, it returns pass or fail per rule, a reason
in plain words, and the one thing to fix first. English and Hebrew are checked
separately. It is not shown to owners and not wired to saving; the upgraded
renderer and the future generator use it.

**How a generated page is built and written** (the playbooks per category, the
writing rules, the claims that need proof, the three-options rule) is its own
document: `docs/page-generation-rules.md`, checked by `backend/utils/page_rules.py`.

## P5 — What we do not do

- **No arbitrary code, ever, on our origin.**
- **No third-party component fetched at render time.** **Ruling (Tzvi, 31 Aug
  2026): Mobbin and 21st are for inspiration only.** We use them at design time,
  by hand, to study what each business category actually looks like when it is
  done well, and that study informs the blocks and theme presets we write
  ourselves. Nothing third-party reaches a visitor's browser, nothing is fetched
  per generation, and no returned asset is served to an end user. This also
  sidesteps the licensing question entirely: looking at references to inform our
  own work is what those products are for.
- **No stock imagery inserted on the owner's behalf** that implies it is their
  premises, their staff, or their product. Refined 23 Sep 2026: owner-approved AI
  "illustrations" of the kind of item they really sell are allowed in atmosphere
  sections, labelled, never on product cards (`docs/page-generation-rules.md` §8).
- **No claims generated about the business** that it did not make. The model
  arranges and styles what the owner supplied; it does not invent testimonials,
  credentials, or "trusted by" lines.
- **No dark patterns**, whatever the theme dial says. Value-brand density is not
  licence for fake urgency or countdowns.

## P6 — Phasing

1. **The block library and the composition schema.** No AI at all. Renders the
   existing business page from a document, with the four current accents as
   presets. If this phase is right, everything after it is cheap.
2. **Theme dials plus presets.** Owners pick a look. Still no AI, still no cost.
   **Ship this and watch it before adding generation** — it may be most of the
   value.
3. **AI composition from a short conversation.** Quota, refinement loop, diffs.
4. **More blocks**, driven by what owners actually ask for and cannot get.

---

## Built — phases 1 and 2, 6 Sep 2026. No AI, no generation, no quota.

Everything below is machinery for something that does not exist yet, which
is the point: the vocabulary is what a generator will later be constrained
to, and it is far cheaper to find out now that it is wrong.

**The schema** — `backend/utils/page_composition.py`. Six dials, eight block
types, `extra="forbid"` at every level, and no URL anywhere: an image prop
is a REFERENCE into the business's own assets (`cover`, `logo`,
`listing:<id>`), so "only their own photos" is a guarantee rather than a
validator that has to be right. Refusal is a 422 naming the field; nothing
is repaired. Reading is the opposite and deliberately so — an unknown block
type, a retired dial position or a deleted service is skipped at render, so
a document cannot rot into a blank page.

**Where it lives: on the business record.** Every read that needs it already
holds the business, it is one-to-one, `_owned()` already decides who may
edit it, and deleting a business carries its page with it. **Version
history, when P7g arrives, goes in `business_page_versions`** — that IS
one-to-many and unbounded, and a few KB per composition times N versions on
one record eventually meets Mongo's 16MB ceiling.

**The three read paths.** `page` was added to `_public` and to the page
payload. It was deliberately NOT added to the OG builder
(`short_links.py`), and there is a comment there saying why: the share card
is built from name, description, logo and cover, and a phase-1 composition
changes none of them. It becomes real the moment a block can choose which
photo leads. `page_brief` is owner-only on both.

**The block library.** All eight of §8a's phase-1 set are converted, as
ADAPTERS over the components that already draw them
(`frontend/src/components/pagebuilder/`). Nothing was redesigned on the way
past: `composeDefault()` produces the page a business already had, which is
phase 1's real test.

**One fix taken on the way**: the sticky catalog bar was painted
`rgb(239 233 220 / 0.92)`, the retired limestone, which on the current white
page is a tan band across a business's own catalogue. It is one line inside
code that moved, so it moved fixed.

**The dials** — `frontend/src/styles/page-theme.css`, everything scoped to
`[data-page-theme]`, no colour written in it at all: the accent arrives as
`--pg-accent*` from `utils/businessAccent.js`, which stays the only place
those four hexes live. `palette` is the accent picker rather than a second
control, because two controls for one decision are two controls that can
disagree. The type dial names a VARIABLE and never a face, so Hebrew
headings get Hebrew glyphs; that is asserted, not assumed.

**The brief** — `PageBriefForm.jsx`. Five questions plus the recognition
question, rendered as four small copies of THEIR OWN page under the four
presets. `briefToTheme()` places the answers on the dials deterministically,
today, with no model: this is P2's crux built rather than promised, and it
is what makes generation later a swap rather than a rebuild. A dial set by
hand is not overruled by a later answer, and which dials were set by hand is
computed from the stored brief rather than guessed.

**Checked**: `scripts/check-page-builder.mjs` (40 assertions, both
languages) and `backend/tests/test_page_composition.py` (20). Between them
they prove the client and API vocabularies agree, that the default
composition is the page we already had, that each dial moves something
measurable in both directions, that no brief question changes nothing, and
that every escape hatch is refused.

**Not built, and not attempted**: any generation, any quota, any block
canvas. An owner can theme and brief their page; they cannot yet add,
remove or reorder blocks from the UI, so a composition's block list is
whatever `composeDefault` produced. That is the next thing to build, and it
is still phase 1 work rather than phase 3.

---

## Category study (Inspo, Sep 2026)

24 Sep 2026. How real sites lay out a business's home page, studied per
answer to the brief's `showing`, and turned into **page recipes**: data the
future generator chooses from, built only from the blocks and dials above.
Design-time research only, under P5: nothing calls Inspo or Mobbin at
runtime, nothing from either is in the repo, and their palettes were ignored.
Only generic descriptions were sent to them, never a real business.

### Coverage: what the references could and couldn't tell us

Inspo has 24 industries and **none for local services** (no home services,
beauty, trades or real estate). Unfiltered, "family cleaning business in
Jerusalem" returned a fintech tool, Mailchimp and a clothing subscription.
Tzvi approved adding **Mobbin** for the thin groups (same design-time rule).

| Group | Inspo | Mobbin | Honest verdict |
|---|---|---|---|
| services | 0 local services; health = apps and supplements | Fresha, Airtasker, Urban Company, Peerspace | Good via Mobbin, but booking-app profiles, not a tradesperson's own site |
| catalogue | ~12 catalogues, all big online brands | DoorDash and Subway store pages, Blue Apron, Walmart, Faire | Grid-and-price pattern well covered; no neighbourhood shop anywhere |
| one-thing | 5 single-product pages; 0 tours | GetYourGuide, Airbnb Experiences, Viator, Klook, Tripadvisor | Products solid; tours read through marketplace chrome |
| place | ~8 restaurants (fine dining, chains); 0 studios | Google Maps place panels, Airbnb Services, Time2book | Layout came almost entirely from Mobbin |
| properties | 5 hotel or booking sites; 0 rentals | Airbnb listing and host profile, Zillow, Expedia | Strong for host plus a few listings, all marketplace-shaped |
| food + kosher | ~30 food sites; **0 show kosher** | Uber Eats grocery item, Blue Apron, Sweetgreen | Certificate placement inferred from organic and allergen labels |

Skipped because a pop-up covered them: Function Health, Modern Health,
Mirazur, Dinner by Heston, Blue Bottle (mobile), Forest Admin (cookies);
Good Eggs (quiz); Frequency Breathwork (newsletter).

### What the good ones have in common

Across every group, the same six things, which is why the recipes differ
more in order and dials than in blocks:

1. **The first screen answers all four P4a questions in a tight stack**:
   name and what, where, proof, one button. Utility pages (a place, a
   service) stack them densely; product pages give them one photo and room.
2. **Proof sits touching the main button**, never in its own section:
   rating and count, or a credential when there are no reviews ("in
   business since", a certificate). Our ProofLine already does this.
3. **One solid button per screen.** Secondary actions are outline, links,
   tabs or small tiles, never a second solid fill.
4. **With few or no photos, structured facts carry the page** (Airtasker's
   sparsest handyman profile: services as a list, quick facts, "in business
   since"). One strong photo beats a thin gallery; nobody pads.
5. **Hours and where come before the description** on every place page.
6. **On a phone the action becomes a bar pinned to the bottom**, with the
   proof or the price beside it. Our page already has this bar.

Per group:

- **services**: profile, not pitch. Name, rating, button, then hours and
  area, then the jobs as a compact list with price and duration. Dense,
  plain type, small imagery.
- **catalogue**: one photo, one line, one button, then the products straight
  away (3 to 8 in the first screen after the hero), titled plainly. Category
  chips sit just above the grid when the list is long.
- **one-thing**: the one offer gets the whole page: one strong photo, the
  proof above or beside the title, the facts as an icon row (duration,
  language), and for tours what is included and the steps.
- **place**: a dense lookup stack: name, rating, hours, where, actions, then
  what they sell, photos lower down.
- **properties**: the place first (photo, price with its period, rating),
  the host after, as context. Host proof sits directly above "Message host".
- **food**: the headline names the food, not a mission. A certificate is
  either on the product in the photo or a small labelled band after the
  hero, never crowding the button.

### The recipes

`backend/utils/page_recipes.py` (`RECIPES`, `fill`, `options`). Checked by
`backend/tests/test_page_recipes.py`: every recipe, filled from nine sample
businesses and also forced onto the five hard cases, passes
`check_composition` in English and Hebrew, and the three options pass
`check_options`. The recipe is fixed at the recipe when it fails; the
checker was not touched.

| Recipe | Chosen when | Content order after the hero | Dials (type · density · imagery · price · motion) |
|---|---|---|---|
| services | `showing: services`, or no store listings | facts, services (list), gallery, contact | grotesque · balanced · thumbnail · normal · still |
| catalogue | `showing: catalogue`, or they sell from a store | services (grid), sizes, facts, gallery, contact | serif · balanced · grid · normal · subtle |
| one-thing | `showing: one-thing` | services (list, 1), gallery, facts, contact | serif · airy · full-bleed · normal · still |
| place | `showing: place` | facts, gallery, services (grid, 6), contact | serif · balanced · full-bleed · normal · still |
| properties | `showing: properties` | gallery, services (grid, 6), facts, contact | serif · airy · full-bleed · normal · still |
| food | a caterer, or a food shop with a kosher certificate, whatever `showing` says | gallery, facts, services (grid), contact | serif · balanced · full-bleed · normal · subtle |

How the rest of the brief moves a recipe:

- **What may lead is the playbook's call** (`page_rules.PLAYBOOKS`); the
  recipe's order is a preference within it. A café in "shops and products"
  cannot lead with facts, so its gallery or menu leads and the facts come
  second.
- **A block only appears with its material**: a gallery needs three
  distinct photos that will actually draw, never the hero's photo again;
  the size ladder needs three measured products; facts need something to
  say, or a `visit` action.
- **`action`** guarantees the block it happens in (book or order: services;
  message: contact; visit: facts, placed right after the lead). The main
  button itself is the page frame's, not the composition's.
- **`pricing` and `audience`** move the dials the way `briefToTheme()` does:
  premium is airy, serif, quiet prices; value is packed, grotesque, loud
  prices; quote is quiet prices; businesses get geometric; tourists get
  full-bleed. Then held to what the business supports: no full-bleed without
  a cover, no loud prices without prices.
- **`strengths`**: a backed kosher, licensed, experience or English moves
  the facts band (which shows the proof) to second place.

**Hero copy, only their words.** The headline is a listing title plus their
area: "{listing} in {area}" / "{listing} ב{area}". With three or more
listings, "{listing}, {listing} and more in {area}" / "… ועוד ב…", because
one title would stand for all of them. The accent word is only used for
the second listing in the photo-led option. The lede is one sentence of
their own description or brief note, in the page's language, at most 20
words, never the headline said twice. The hero photo is a photo of what
they sell, not the cover, which the page header already draws. Hebrew
place names come only from `locations_catalog.HEBREW_AREA_NAMES`. If no
listing is named in a language, `fill` returns no page for it and says so;
a Hebrew-only business has no English page to make.

**The three options** (rulebook §7): the brief straight; photo-led (gallery
first when the playbook allows it, else a different order); words-led (the
next type pairing, a step denser, services as a list). Each has its own
headline shape.

### Previews

`scripts/preview-page-recipes.py` seeds the five hard cases (one service and
no photos; 25 services; a caterer with a kosher certificate; a brand-new
business with no reviews; a Hebrew-only business) under all six recipes,
in both languages, into the LOCAL database only (ids start `rp-`,
`--clean` removes them; nothing goes through the API, so no paid
translation runs). `scripts/shot-page-recipes.mjs` shoots each at 1280 and
375, fold and full page, into `screenshots/recipes/` with an `index.html`
contact sheet: 240 screenshots, no sideways scroll, every Hebrew page RTL
with Hebrew headings in Frank Ruhl Libre.

What the previews caught, and the recipe was changed for:
- The hero used the cover, which the page header already draws directly
  above it: the same photo twice, stacked. The hero now uses a photo of
  what they sell.
- A headline taken from the first line of their description repeated the
  header, which prints that description under their name.

### Gaps: what the references do that our blocks can't

Proposals only; nothing here is built. Ordered by how much they matter.

1. **A hero with no photo draws nothing** (`HeroBlock` returns null without
   an image). The common case, a new business with no photos, loses its
   headline entirely while `check_composition` still passes the page.
   Proposal: a `hero` variant `plain`, the headline and lede on the page
   ground with the accent rule, no photo. All groups. **The one most worth
   closing.** The `hero` rule should then also fail a band hero with no
   photo to draw.
2. **The header and the hero say the same thing.** The page header prints
   their description; the hero's lede can only come from the same
   description. Proposal: on a composed page with a hero lede, the header
   shows name, proof and areas and leaves the description to the hero.
   Needs a change to `BusinessPage.jsx`, so it waits for a ruling.
3. **Property block** (rulebook open decision 2). Every rentals reference
   centres the units. Fields: photo, title, price with its period (night or
   month), rooms and size in Israeli terms, stay type (long, short,
   vacation), one action (Message about this one). Until it exists the
   properties recipe works only when a host's stays are business listings.
4. **Steps / what's included** ("what happens next as steps", rulebook §5c.3;
   a tour's route; how ordering works). Owner-written items only, 3 to 6.
   one-thing, services, food.
5. **Menu / price list** (open decision 3). A dense text list of name and
   price. Needs no photos, so it is also a no-photo answer for food and
   place pages.
6. **Reviews as a placeable block** (open decision 3). `ReviewsSection`
   already renders below the composed body; a `reviews` block wrapping it,
   self-hiding with no reviews, would let a recipe put quotes near the top.
   All groups.
7. **A button on each row** of the services list (Book, Order) rather than
   only a click-through card. services, catalogue, place.
8. **Open now and directions** for places. Open-now needs hours as data,
   not free text. Directions need an address, which the chat-only business
   page deliberately never sends (B1): a decision, not a block.
9. **Hebrew twin for the hero text** (open decision 1). Confirmed:
   `fill` writes a separate composition per language today.

Already covered, not gaps: the phone bar pinned to the bottom (page frame),
category chips and search past 16 services (`ServicesBlock`, visible in the
25-service preview), proof beside the button (`ProofLine`).

### Found on the way, not changed

- **The Hebrew stemmer in `page_rules._stem`** treats a leading ש, מ, כ, ב,
  ל, ה or ו as a prefix even when it is part of the word (שמחות becomes
  מחות), and does not fold final letters (ן/נ, ם/מ, ך/כ, ף/פ, ץ/צ). So a
  Hebrew headline can fail `congruency` while naming exactly what they sell.
  The recipes fall back to the listing's own name, which always matches.
  Worth fixing in the checker, with its golden set.
- **The standard page in Hebrew** shows the English description in the
  header (the public payload carries no `description_he`) and an English
  category heading above the services ("Home Services Repair"). Pre-existing,
  outside this work.

### Reference sites studied (research sources only)

Inspo: Mooala, Grass Roots Farmers' Co-op, Parachute, Ritual, Fellow, Graza,
Swim Club (product page), Ferm Living (product page), Potion, Tempo, Fitbod,
Headspace, Dia & Co, Dawn, Chick-fil-A, Chipotle, Wagamama, Atomix, Death &
Co, Onyx Coffee Lab, Belmond, The Standard, Lyfe Hotels, Explora Journeys,
Hopper. Mobbin: Fresha, Airtasker, Urban Company, Square, Peerspace,
DoorDash, Subway, Blue Apron, Walmart, Faire, Etsy, GetYourGuide, Airbnb
(Experiences, Services, listings, host profile), Klook, Viator, Tripadvisor,
Zillow, Expedia, Google Maps, Time2book, Open, Sweatpals, Uber Eats,
Sweetgreen.

---

## §8a — Answers. Research and codebase passes, 31 Aug 2026.

Full briefs: `docs/page-builder-research.md` and the codebase report in the
session log. The findings that change the build:

**Composition is what the consumer builders chose, and code generation is what the
developer tools chose.** Wix ADI (retired Nov 2024), Squarespace Blueprint, Framer,
Durable and Hostinger all compose from sections. Lovable, v0 and Bolt generate code.
The split is clean and it independently validates P1: **we are building a consumer
small-business tool, not a developer tool.**

**Sameness is a selection-logic problem, not an inventory-size problem.** No
published study ties a block count to "stops looking templated". Relume ships
1,000+ components and its output is still recognisable. This supports the dial
approach in P2 over simply adding blocks. Working target: **40 to 60 block types,
4 to 6 variants each**, but treat that as a starting point rather than a finding.

**Cost: about $0.034 to $0.037 per generation on Sonnet 5** ($2/$10 per MTok,
confirmed from Anthropic's own docs). Recommendation: Sonnet 5 as default, Opus 5
only as a fallback when validation fails twice. Note this is roughly **40x the
assistant's per-conversation cost**, so the quota is doing real work here.

**Two statistics were flagged as fabricated and must not be repeated:**
"whitespace increases comprehension by 20%" (the cited author has publicly denied
his paper says this) and "luxury brands use 2 to 3 times more whitespace"
(untraceable to any primary source). My P2 conventions stand as reasoning, not as
cited fact.

**The free-then-pay failure mode is documented, not theoretical.** Sourced
complaints on both Lovable and Framer from users charged real money for failed
generations, including a £300+ case on Framer's own forum. **P3's "do not charge
for a failed generation" is the load-bearing rule in this spec.**

### Phase-1 block set, ordered by least work

From the component inventory, these are already prop-driven, already variant-shaped,
or already themeable:

1. **`common/HeroBand.jsx`** — 63 lines, zero hex, already has three thin wrappers
   supplying only photo and copy. That wrapper shape *is* `{type, variant, props}`.
   Least work in the repo.
2. **`common/SkylineRule.jsx`** — takes its colour from the caller, hardcodes
   nothing. A themeable divider with zero work beyond registering it.
3. **`marketplace/GoodToKnow.jsx`** — already all-optional and self-hiding. This is
   P4's "a page with no photos and no prices still looks deliberate", already built.
4. **`marketplace/ServiceCard.jsx`** — already has a documented `variant` prop.
5. **`marketplace/FeaturedProviders.jsx`** — zero hardcoded colour, self-hiding.
6. **`marketplace/BusinessCoverBand.jsx`** — already accent-driven.
7. **`property/ImageGallery.jsx`** — zero colour, CDN-aware, RTL-correct, controlled.
8. **`marketplace/ContactChannels.jsx`** — small, server-driven, one caller.

**`hooks/useCoverScrim.js` is a reusable contrast primitive**: samples the cover's
lower 45% into a 32x8 canvas, clamps alpha 0.22 to 0.62, defaults 0.42, and
**deliberately never flips to dark text** so only strength is computed and direction
is fixed. Reuse it for P4's contrast floor rather than writing another.

### Four things that are greenfield, contrary to assumption

1. **No composition field exists.** Every read path is an explicit key-by-key
   projection (`_public` at `businesses.py:189-246`, the page payload at `:683-741`,
   the OG builder at `short_links.py:339-340`). Mongo needs no migration, but the
   field is invisible until added to all three. **Any new patchable field must use
   `payload.model_fields_set`, not `is not None`** — with the latter an owner can
   set a value but never clear it (`businesses.py:469-474`).
2. **No quota system of any kind.** Nothing counts consumption anywhere. The only
   reusable shapes are the `MAX_*_PER_USER` count-then-refuse pattern and the PayPal
   integration, which is built for recurring subscriptions rather than one-off packs.
3. **No SSR and no prerender.** Generated pages are client-rendered only. **Nothing
   a block emits reaches a crawler**, and the share card is built from a fixed field
   projection, so a generated design does not change the link preview unless that
   projection is extended. P1's "renders server-side-safe" has no server-side
   renderer to run in today.
4. **The Anthropic shim is text-only, single-shot, non-streaming, no tools, no
   vision** (`utils/llm.py`). Page generation is the first case needing a *response*
   to a waiting user rather than a fire-and-forget write, so neither existing pattern
   fits. `max_tokens` is a flat 16000 everywhere and **nothing meters tokens or cost**.

### Two live bugs found on the way

- **`BusinessPage.jsx:631`** hardcodes `rgb(239 233 220 / 0.92)` on the sticky
  catalog bar. That is the **retired** limestone on a now-white page: a visible tan
  band. Fix independently of this project.
- **Business covers and logos skip the CDN transform layer entirely.** They render
  through `SafeImage` with no `srcSet` and no width transform, so a 2400px upload is
  served into a 112 to 160px band. Every other image surface in the app is
  width-transformed.

### The decision this surfaced, which is yours

Ruling 3 says no MyIsraelRental branding on the page. **Four things on the page
carry it today:** the "Are you a business? Add yours free" band (`:809-826`), the
attribution band (`:855-886`), `SiteFooter` (`:888`), and the "New on
MyIsraelRental" string (`:457`).

The first of those is B7 in `business-page-spec.md`, placed deliberately because
that page is seen by exactly the audience we want to recruit, which makes it the
highest-intent acquisition placement on the site. **Removing it to honour ruling 3
costs us real supply-side growth.** See §9.

---

## §8b — Still open

- Verify P2's brand conventions against real category references, since two of the
  commonly cited numbers turned out to be invented.
- RTL and non-Latin failure modes in generated design specifically.
- `scripts/test-theme-scope.mjs` exists and enforces that non-approved themes stay
  under `body.theme-preview`, **but it is wired into no npm script and no CI.** If
  the block library introduces theme files, wire it.

## §9 — Branding on the page. Settled.

**Ruling (Tzvi, 31 Aug 2026): keep the bottom recruitment band, and add a
"Powered by MyIsraelRental" line.**

This softens ruling 3 and that is deliberate. The page is visually the business's
from the top through to the end of their content. Below that:

- The **"Are you a business? Add yours — free"** band stays. Anyone reading a
  business page is by definition a candidate to list their own, which makes this
  the highest-intent recruitment placement on the site, and it costs the owner
  nothing because it sits after everything their customer came for.
- A quiet **"Powered by MyIsraelRental"** line, linked.

Drop the "New on MyIsraelRental" string at `BusinessPage.jsx:457` — a business's
own page is the wrong place to advertise how new they are to us. Replace with
"New here" or nothing.

*Overruled 23 Sep 2026:* Tzvi's proof-beside-the-button brief keeps "New on
MyIsraelRental" for a business that joined this year, and it now also appears
in the proof line (ruling 5).

**Confirmed 25 Sep 2026 (Tzvi): do not remove either.** The small "List your
business, free" band at the foot of a business page and "New on MyIsraelRental"
both stay, on the standard page and on every AI-built page. A design-rules prompt
written in another conversation proposed removing both as clutter; that part of it
is overruled.

### The opportunity this creates, worth deciding separately

**"Powered by" is the standard free-tier convention, and removing it is the
standard first paid tier.** Squarespace, Shopify, Linktree and most website
builders monetise exactly this way, and owners understand it instantly without
being taught.

It is a far gentler paywall than prompt quotas: nothing is rationed, nothing runs
out mid-task, nobody is charged for a failed attempt, and the thing being sold is
a want rather than a need. It also aligns incentives correctly, since the owners
willing to pay to remove it are the ones treating the page as their real
storefront.

**Not a ruling, a suggestion.** But if a paid tier is wanted, this is a better
first one than metered generations, and the two are not mutually exclusive.

---

## §8 — Original open list, superseded by §8a above.

1. **How the existing AI site builders really work** (Wix ADI, Squarespace
   Blueprint, Framer, Durable, Lovable, v0): composition or generation, and what
   users say the output looks like six months on.
2. **How many blocks and variants** before output stops looking same-y. Any real
   numbers.
3. **Brand-archetype research** to verify and extend P2 with measurable
   conventions rather than my assertions.
4. **Whether Mobbin and 21st MCPs exist, what they expose, and critically whether
   their terms permit producing output for our end users** rather than for our own
   development. If not, they inform the library at design time only, or not at all.
5. **Quota pricing benchmarks** and the documented failure modes of free-then-paid.
6. **Cost per generation.** A design task likely needs a stronger model than
   retrieval does, so this is not the assistant's 0.8 cents. Model it at 100,
   1,000 and 10,000 generations before pricing anything.
7. **RTL and non-Latin failure modes** in AI-generated design specifically.

Codebase questions still open: the full section-component inventory that becomes
the block library, whether any field can hold a composition document, the existing
Anthropic call pattern to follow, and whether any quota or credit system exists
anywhere today.
