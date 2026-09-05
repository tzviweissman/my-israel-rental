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

Today the app renders **zero user-authored HTML**. The only two
`dangerouslySetInnerHTML` call sites are a DOMPurify-sanitised i18n string
(`Auth.js:186`) and JSON-LD (`FAQ.js:213`). That is a clean posture and it is
worth a great deal.

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
- **No third-party component fetched at render time.** If Mobbin or 21st are used
  at all, they inform the library we write, offline, at design time. Nothing
  third-party reaches a visitor's browser, and nothing is fetched per generation.
  §8 must confirm whether their terms even permit generating output for end users.
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

## §8 — Still owed by the research pass. Do not build past Phase 1 without it.

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
