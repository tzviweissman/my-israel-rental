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
  premises, their staff, or their product.
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
