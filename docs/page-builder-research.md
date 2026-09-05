# AI Page Builder — Research Brief

Written 6 Sep 2026, in response to §8 of `docs/ai-page-builder-spec.md`. Covers the
five research questions the spec left open. Read the spec first; this brief does
not repeat the settled rulings, only supplies the evidence for and against them.

**A note on method.** Search access was open web only: product docs, pricing
pages, reviews, engineering write-ups, Reddit/forum threads, and one direct fetch
of Anthropic's own pricing docs. I did not have interactive access to Mobbin,
21st.dev, Awwwards, Land-book or SiteInspire's curated boards in this pass (they
require logged-in browsing of a visual library, not a text search), so Part 3's
category parameters are built from published UX research (primarily Baymard
Institute, where their free-tier pages disclose findings), practitioner
consensus visible across many independent design write-ups, and general
e-commerce/hospitality UX convention, not from a specific set of screenshots I
personally reviewed. Where a specific number could not be traced to a primary
source, it is flagged below rather than stated as fact. Two circulated statistics
in this space turned out to be fabricated on inspection; both are called out by
name so nobody repeats them later.

---

## Part 1 — How real AI site builders work

The question the spec asks: composition from templates/sections, or genuine
code generation, and what does each look like six months in.

### Wix

Wix's original AI tool, **Wix ADI** (Artificial Design Intelligence), was
section-based composition: it asked a handful of business-model questions, then
assembled a layout from predefined sections that the owner could reorder, restyle,
and extend. **It has since been retired** — Wix officially stopped supporting ADI
sites on 10 November 2024, replacing it with a new **Wix AI Website Builder**
built around conversational, code-adjacent generation ("vibe coding") plus an
agent called Aria that can make pixel-level edits. This is a direct precedent for
"composition vs. generation" as a *strategic choice a vendor can reverse*, worth
noting since it cuts against assuming composition-only is a permanent local
optimum for every product. Sources:
[Wix ADI support notice](https://support.wix.com/en/article/adi-sites-no-longer-supported),
[Wix AI website builder](https://www.wix.com/ai-website-builder).

### Squarespace Blueprint AI

Composition, explicitly. The user answers a few questions, picks one of seven
named "brand personalities" (Professional, Playful, Sophisticated, Friendly,
Bold, Quirky, Innovative) which sets color/font/copy-tone together as a bundle,
then the tool assembles page sections from Squarespace's own section library and
drops the result into the ordinary Fluid Engine editor for manual cleanup. No
code is generated; the output is always native Squarespace blocks. Source:
[Squarespace AI help center](https://support.squarespace.com/hc/en-us/articles/16282290976013-Using-Squarespace-AI),
[Blueprint walkthrough](https://www.squarespace.com/blog/starting-a-website-with-squarespace-blueprint).

### Framer AI

Composition from Framer's own section/component library, not free-form code
emission to the end user (though Framer's underlying editor is code-like
internally). Reviewers who used it repeatedly are consistent on three complaints,
each relevant to this project's design:

- **Structural sameness.** "Every generated site looks like it came from the same
  architect" — reviewers who wanted a layout that broke convention (vertical
  scroll narratives, editorial long-form, interactive product tours) ended up
  fighting the generated structure. [Source](https://flowstep.ai/blog/framer-review/).
- **Generic, single-register copy.** The model defaults to "confident, brisk,
  slightly corporate" tone regardless of business type — good for B2B SaaS,
  wrong for almost everything else. [Source](https://skillscouter.com/framer-review/).
- **No brand memory.** Framer AI does not know the business's existing brand and
  invents a new palette and type pairing every single generation, so anyone with
  an existing identity ends up replacing the AI's tokens by hand.
  [Source](https://framerwebsites.com/blog/framer-ai-review).

A reviewer who built ten sites with it over time scored it 7/10, useful for a
first draft in minutes that still needs editorial pass in the Framer editor
before publishing — i.e., composition alone did not produce a finished product.
[Source](https://framerwebsites.com/blog/framer-ai-review).

Security-relevant aside, since this project also worries about hosting user
content on its own origin: Zscaler ThreatLabz identified over 400,000 AI-generated
sites built with tools including Framer, of which roughly 9% were flagged
malicious/phishing, illustrating that a low-friction generator becomes an abuse
vector regardless of how well-designed the output looks.
[Source](https://posts.inthecyber.com/prompt-publish-phish-in-the-wild-abuse-of-the-framer-ai-website-builder-2c40e4291ed6).

### Durable

Composition from a fixed layout/section set, optimized for speed (sites generate
in under a minute). Consistent complaints across reviews: **generic, boilerplate
copy** that doesn't capture brand voice, **limited design flexibility** ("a
dealbreaker for those wanting a unique, brand-focused site"), and at least one
documented case of a domain-transfer/billing dispute that left a small business
unable to leave cleanly. Sources:
[Cybernews review](https://website-builders.cybernews.com/durable-ai-website-builder-review/),
[max-productive review](https://max-productive.ai/ai-tools/durable/).

### Hostinger AI

Composition, from a three-question intake (brand name, purpose, description),
with optional PDF/screenshot/URL input to seed the generation. Reviews describe
the result as "acceptable but lacking uniqueness," needing manual customization
to differentiate — the honest self-assessment from reviewers is that the AI pass
is a starting point, not a finished product. [Source](https://freakingnomads.com/hostinger-ai-website-builder-review/).

### Lovable

**Genuine code generation**, not block composition — this is the one tool on the
list that is architecturally the opposite of what this project has ruled for.
Lovable generates a full application (frontend, backend, database, auth,
deployment) from a natural-language description, making all stack decisions
itself. Contrast with component-based tools (v0): those treat UI as composable,
reviewable units where a developer stays in control of architecture; Lovable
inverts this, generating architecture and implementation together in one
opinionated pass. This is precisely the "escape hatch" risk the spec's P1 warns
against: real markup, on Lovable's own preview infrastructure, written per-user
prompt. [Source](https://blog.devgenius.io/lovables-architecture-decoded-how-ai-transforms-intent-into-production-ready-code-ceead05003e4).

### v0 (Vercel)

Generative, but constrained to a fixed, known stack: React + Tailwind +
shadcn/ui. The model is tuned specifically for that combination, and shadcn/ui's
own design (components are copied into the target project, not installed as an
opaque dependency) means v0's output is source code the developer owns and edits,
not a black box. This is a middle position between "block composition" and
"free-form code": the vocabulary of *possible* output is bounded by the design
system even though the mechanism is code generation. [Source](https://vercel.com/i/what-is-shadcn).

### Bolt.new (StackBlitz)

Full code generation, run live in-browser via WebContainers (no server). Bolt
gives the model complete control of the filesystem, package manager, and
terminal — the widest-open architecture on this list. It is powered by Anthropic
Sonnet per the public writeups. [Source](https://medium.com/@rajivmeno22/bolt-new-aka-bolt-ai-r-the-ai-powered-browser-based-full-stack-app-builder-7785788b49d5).

### Which chose composition, and why — the pattern

Every **consumer small-business website builder** in this list (Wix's original
ADI, Squarespace Blueprint, Framer AI, Durable, Hostinger) chose **composition
from a fixed section/block library**, specifically because their end users are
non-technical business owners who need a working, safe, brand-agnostic result
they cannot break. Every **developer-facing tool** (Lovable, v0, Bolt) chose
**code generation**, because their users are developers who want to own and
extend the output, and the audience already knows how to fix or discard bad
code. This maps directly onto the spec's own reasoning in P1: the deciding
factor is not what looks best, it's **who is going to be the one debugging or
hosting a bad result** and **whose account it embarrasses**. MyIsraelRental's
buyer (a business owner sending a link to customers, not a developer) sits
squarely in the composition camp, and the market's revealed preference agrees
with the spec's own ruling.

### What users say about the output six months on

No source found gives a rigorous longitudinal ("came back six months later and
found...") study; the closest evidence is (a) reviewers who built many sites over
time and reported convergent complaints (Framer: "every site looks like the same
architect," ten-sites review), and (b) the "Sea of Sameness" framing that has
become a named, recognized phenomenon across several independent
writeups — not one blogger's opinion but a repeated, convergent observation:
[Shuffle](https://shuffle.dev/blog/2026/01/why-do-most-ai-generated-websites-look-the-same/),
[AXE-WEB](https://axe-web.com/insights/ai-website-design-sameness/),
[managed-code.com](https://www.managed-code.com/blog-post/why-ai-websites-look-the-same),
[dev.to](https://dev.to/gdg/why-ai-websites-all-look-the-same-and-how-to-build-something-different-1gan).
The mechanism given consistently: an AI **predicts the statistically most likely
layout**, not an original one, so under-specified prompts converge on the same
hero-plus-three-cards-plus-testimonials shape, "Tailwind Blue," Inter/Roboto
type, and rounded-corner cards, because that is the highest-probability output
across the model's training distribution. This is the single strongest piece of
evidence for the spec's own approach (a designed block library the owner
navigates rather than free-form generation from a blank canvas): the failure
mode is not "AI produces bad taste," it's "AI produces the *average* of taste
when not given real constraints," and a vetted block library **is** the
constraint.

---

## Part 2 — Block libraries as an architecture: how many blocks before it stops looking same-y

No rigorous, controlled study answers "N blocks × M variants = looks distinct"
directly; I did not find one, and I want to say that plainly rather than
inventing a number to fill the gap. What is available is proportional evidence
and one clear mechanism-level explanation.

**Reference scale from a real component library.** Relume, a Webflow-focused
"largest component library" product, ships **over 1,000 components** in its main
Figma/Webflow library, organized into categories (hero, feature, CTA, footer,
etc.) with **mobile variants included for every one**. This is offered as the
scale a professional library reaches when its explicit goal is "enough variety
that a built site doesn't look templated." [Source](https://www.relume.io/resources/docs/how-to-use-the-relume-webflow-library).
Shuffle.dev, a competing component/theme marketplace, separately advertises
**13,400+ UI components** across 80+ front-end libraries. [Source](https://shuffle.dev/).
Neither company publishes the research behind why that number, so treat these as
**"what a market-tested competitor considers enough," not a proven threshold.**

**The actual driver is combination and constraint, not raw block count.** The
practitioner literature converges on a different claim than "more blocks fixes
it": sameness comes from **under-specified inputs converging on the modal
choice**, not from too few blocks to choose from. Design-token practitioner
writing on avoiding a "same-y" system independently arrives at the same idea:
the risk isn't too few options, it's a **combinatorial explosion of options with
no way to pick among them**, producing either paralysis (too many similar
tokens) or defaulting to whatever is first/most common (same-y output). The
practical answer the design-tokens literature gives is a **tiered system**: a
small number of primitive values, and a *separate* semantic layer that encodes
*when* to use which — i.e., the fix is not block count, it's **rules for
selecting among blocks that are sensitive to context** (density, price
prominence, imagery treatment — exactly the "dials" the spec already proposes).
[Source](https://www.designsystemscollective.com/design-system-concepts-and-establishing-basic-design-tokens-en-b1a974da0c16).

**What this means for the spec's P2 dials.** The dials-first approach (density,
type, palette, imagery, price prominence, motion) is better evidence-aligned than
a "just add more blocks" approach would be, because the sameness failure mode is
about *selection logic*, not inventory size. A library of, say, 40-60 block
*types* (hero, gallery, testimonial, pricing table, service list, booking widget,
map, contact form, FAQ, story/about, etc. — the kind of inventory a business
page realistically needs) each with **4-6 visually distinct variants driven by
the theme dials** (not 4-6 unrelated variants a human has to browse) should
comfortably clear "looks templated," because the variety a visitor perceives
comes from the *combination* of dial settings across an entire page, not from any
one block having many options. This is an extrapolation from the evidence above,
flagged as such — it is my synthesis, not a number I found published anywhere.

---

## Part 3 — What each business category should look like (main deliverable)

Caveat repeated from the top: these tables are practitioner-convention synthesis,
grounded in the sources cited inline, not a transcription of a specific Mobbin
or 21st collection I browsed. Two numbers that circulate widely in this space did
not survive a source check and are flagged rather than used:

> **Debunked stat #1**: "Whitespace increases reading comprehension by 20%,"
> commonly attributed to "Lin (2004)." The cited author has publicly stated the
> attributed paper says no such thing — it is a secondary-referencing error that
> has propagated for two decades. [Source](https://www.linkedin.com/pulse/lin-2004-did-discover-margins-white-space-increase-20-carl-myhill).
> Do not use "20%" anywhere in product copy or internal reasoning.
>
> **Unverifiable stat #2**: "Luxury brands use 2-3x more whitespace than
> mass-market sites." This appears in SEO/marketing blog posts with no primary
> study cited and could not be traced to Baymard or any other named research
> body despite being attributed to "research." Treat as an unsupported claim, not
> a design parameter to build against, even though the underlying *direction*
> (luxury pages are less dense) is well supported qualitatively below.

Baymard Institute has a dedicated, large-scale research program on **Luxury
Goods ecommerce UX** specifically (Louis Vuitton, Gucci, Chanel, TAG Heuer,
Jimmy Choo, Bang & Olufsen, Cartier, Tiffany, Van Cleef & Arpels, benchmarked
across 400+ guidelines, 25 rounds of usability testing, 4,400+ participant
sessions). The detailed guideline text sits behind their paid product; what's
public confirms the research exists and is rigorous, but I could not pull the
specific numeric guideline values without a subscription — flagged here as "real
research exists, verify against it before shipping specific pixel/ratio values,"
rather than asserting numbers I could not read.
[Source](https://baymard.com/research/luxury-goods).

Density, type, and price-prominence framing below is corroborated qualitatively
by independent design-practice sources on "what makes a site look
expensive vs. cheap" (whitespace as the fastest premium signal, one dominant
typeface family, restrained palette, avoiding a different color per section) —
[Medium/George Lui](https://medium.com/@georgelui/web-design-secrets-that-make-your-site-look-expensive-f0616107a453),
[madebyevoke](https://madebyevoke.com/blog/what-makes-a-website-look-expensive),
[sophisticatedcloud](https://www.sophisticatedcloud.com/all-blogs/8-web-design-practices-that-make-brands-look-premium).
None of these give measurable pixel/ratio numbers either; where a table below
states a number (items per row, hue count) it is a design-system-implementable
convention synthesized from this qualitative consensus, presented as a
**starting default to test, not a proven optimum**.

### 1. Luxury / premium retail (boutique clothing, jewellery, high-end furniture)

| Parameter | Value |
|---|---|
| Density | 1-2 items per row on desktop above the fold; generous section padding (96-160px vertical); whitespace dominates, content is a minority of the viewport |
| Type | Display serif headings (large, light-to-regular weight, never bold); wide-ish letter-spacing on labels/eyebrows; sans body at generous line-height |
| Palette | Monochrome-plus-one: near-black/near-white/one neutral, plus a single restrained accent used sparingly (never more than 2 hues total) |
| Imagery | Full-bleed, editorial crop, consistent color grade across all photos; few images shown at once, each large; people appear rarely and only if styled/art-directed, never candid |
| Price prominence | Quiet: small type, no badge, no strikethrough/sale framing, sits below the product name, never competes with the photo |
| First screen | One image, one product/collection name, no navigation clutter, no countdown or urgency copy |
| Primary action | "View," "Enquire," or "Book a consultation" — soft, not "Buy now" |
| Credibility signal | Photography quality and consistency, not badges or star counts; absence of comparison/discount language reads as confidence |

### 2. Value / discount retail (general store, bargain goods)

| Parameter | Value |
|---|---|
| Density | 3-5+ items per row; tight section padding (24-48px); grid fills the viewport |
| Type | Bold grotesque/sans, larger weight range used for emphasis (regular body, black headlines), tighter letter-spacing |
| Palette | Saturated, 2-4 hues active at once (brand color + red/orange for sale tags + neutral background) |
| Imagery | Contained product shots on plain background, many per screen, consistent thumbnail crop; people appear only in lifestyle/how-to-use contexts |
| Price prominence | Loud: large type, red or brand-accent badge, strikethrough original price, "% off" or "save $X" framing |
| First screen | Grid of products/deals visible immediately, search/filter bar, promotional banner |
| Primary action | "Add to cart" / "Shop now" repeated per item |
| Credibility signal | Review counts and star ratings prominent, "X sold" or stock-scarcity counters, visible guarantee/return policy badges |

### 3. Food producer (bakery, caterer, specialty food)

| Parameter | Value |
|---|---|
| Density | 2-3 items per row; moderate padding; warm, tactile feel rather than sparse-luxury feel |
| Type | Serif or friendly slab for headings (warmth, craft), simple sans body; letter-spacing normal, not stretched |
| Palette | Warm neutrals (cream, wood-tone brown) plus one appetite-color accent (red, mustard, terracotta); low saturation ground, higher saturation only on the accent |
| Imagery | Close, textural, natural-light food photography; process/hands-at-work shots build craft credibility; people (the maker) appear more than in luxury retail |
| Price prominence | Moderate: visible per item/menu line, not badged, no discount framing unless it's a genuine seasonal offer |
| First screen | One strong hero food photo, business name, and either "order" or "see menu" |
| Primary action | Order/message for custom orders, or browse menu; for caterers, "request a quote" |
| Credibility signal | Ingredient/sourcing story, maker's face and name, real customer photos of the product (not stock), delivery/pickup logistics stated plainly |

### 4. Restaurant / cafe

| Parameter | Value |
|---|---|
| Density | Menu as list, not grid; 1 column on mobile, images optional per item, not required for every line |
| Type | Serif or characterful display for the brand name/logotype, clean sans for the menu itself, which must be scannable |
| Palette | Ground can be light or dark depending on positioning (cafe = light/airy, fine dining = dark/moody); one accent max |
| Imagery | A handful of full-bleed atmosphere/dish shots up top, then the menu itself is mostly typographic; avoid photographing every dish (reads as cheap/fast-food) |
| Price prominence | Quiet-to-moderate: aligned right of the dish name, no currency-heavy styling, no discounting language |
| First screen | Hero photo of space or signature dish, name, and immediately visible hours/location/reserve or order action |
| Primary action | Reserve a table, order for pickup/delivery, or view menu |
| Credibility signal | Real interior/plating photography (not stock), hours and location precision, a named chef/owner, genuine review excerpts |

### 5. Home services trade (plumber, electrician, handyman, mover)

| Parameter | Value |
|---|---|
| Density | Dense-but-organized: service list, service-area list, and pricing/estimate info all visible without much scrolling — trust here comes from thoroughness, not restraint |
| Type | Plain, sturdy sans, bold weight for headlines, no display serif (reads as inconsistent with a trade business) |
| Palette | 2 hues: one strong brand color (often blue/red/yellow — trade-truck colors) plus neutral; saturation moderate-high, this category is not restrained-luxury |
| Imagery | Real photos of the actual person/van/work, not stock trade photography (stock is instantly recognizable and undermines trust in this category specifically); before/after pairs where available |
| Price prominence | Moderate: "free estimate," starting-from pricing, or transparent flat-rate menu; never hidden entirely, since price opacity reads as risk in this category |
| First screen | Phone number and service area visible immediately, above the fold, on every screen size — this category's visitors are often on mobile mid-emergency |
| Primary action | Call now, or request a quote/booking form — phone number is often the dominant CTA, more than a form |
| Credibility signal | License/insurance numbers stated plainly, years in business, service-area specificity (not "we serve everywhere"), real reviews with dates |

### 6. Beauty and wellness (salon, spa, therapist)

| Parameter | Value |
|---|---|
| Density | Airy, 2-3 items per row for services; more whitespace than home-services, less than luxury retail |
| Type | Soft serif or rounded sans for headings, calm and legible body; letter-spacing slightly open on labels |
| Palette | Muted, low-saturation (blush, sage, soft neutral) plus one calming accent; avoid saturated primary colors, which read clinical or cheap here |
| Imagery | Real interior and treatment-room photography, real practitioner photos (builds personal trust for a body-contact service); avoid generic spa-stock (candles/stones cliché reads as templated) |
| Price prominence | Moderate, listed per service/duration, not badged or discounted-looking |
| First screen | What the space/practitioner looks like, plus the single most important action (book) |
| Primary action | Book an appointment — should be the single dominant CTA, ideally one click from the hero |
| Credibility signal | Practitioner qualifications/certifications, real before/after where applicable and consented, specific service menu (not vague "wellness" language) |

### 7. Professional services (accountant, lawyer, consultant)

| Parameter | Value |
|---|---|
| Density | Low-to-moderate; text-forward, not image-forward; generous line-length control and paragraph spacing matter more than grid density |
| Type | Conservative serif or grotesque, no display flourish; consistent, restrained sizing scale signals seriousness |
| Palette | Near-monochrome (navy/charcoal/white), one accent used only for links/CTAs; this is the most restrained palette of any category here, restraint signals trustworthiness rather than luxury |
| Imagery | Real headshots of the practitioner(s), office photography if any; imagery is secondary to text and credentials, never full-bleed lifestyle photography |
| Price prominence | Often absent or "contact for consultation" — pricing opacity is normal and not a red flag in this category, unlike home services |
| First screen | Practitioner name/firm name, area of practice, and a single clear "get in touch" or "book a consultation" action |
| Primary action | Contact/message/schedule a consultation, rarely a direct purchase |
| Credibility signal | Named credentials (bar number, CPA license, years qualified), specific practice areas (not generic "legal services"), real client testimonials with attribution where permitted |

### 8. Tourism and experiences (tour guide, activity operator)

| Parameter | Value |
|---|---|
| Density | Image-forward, 1-2 large photos per screen, moderate padding; itinerary/what's-included content can be denser (a list, not a grid) |
| Type | Friendly serif or sans for headings, clear sans body for logistics (times, meeting points, what to bring) |
| Palette | Can be more saturated and varied than professional services (2-3 hues), reflecting the location/experience itself rather than a corporate brand |
| Imagery | Full-bleed location/experience photography is the primary sales tool here; people should appear, genuinely enjoying the experience (this is one of the few categories where stock-feeling "happy tourist" photography actively hurts credibility versus real guest photos) |
| Price prominence | Moderate-to-loud: per-person price, duration, and group size are functional information the buyer needs to decide, not decoration |
| First screen | Hero photo of the experience itself, price/duration snapshot, and a booking/availability action |
| Primary action | Check availability / book a date |
| Credibility signal | Specific itinerary detail, real guest photos and reviews, guide's own face/story, clear cancellation/weather policy |

### 9. Childcare and education (tutor, nursery, teacher)

| Parameter | Value |
|---|---|
| Density | Low-to-moderate; calm, uncluttered, nothing that reads as high-pressure sales |
| Type | Warm, legible sans or soft serif; avoid anything trendy/edgy — this category needs to read as safe and stable above all |
| Palette | Soft, warm, low-saturation; avoid children's-primary-color cliché (reads as generic daycare clip-art) as much as avoiding corporate cold-blue |
| Imagery | Real photos of the actual space and (with consent) real students/children, never stock "diverse smiling kids" photography, which is one of the most recognizable stock-photo tells and actively undermines trust for a category built on parental trust |
| Price prominence | Quiet-to-moderate, often per-session or per-term, paired with clear explanation of what's included |
| First screen | What the program/space looks like, who runs it, and a low-pressure "learn more" or "schedule a visit" action, never a hard sell |
| Primary action | Contact to enroll, schedule a visit/trial session, or message with questions |
| Credibility signal | Real qualifications/certifications, safety/background-check statements, specific curriculum or approach detail, genuine parent testimonials |

### 10. Single product vs. full catalogue (a separate axis, not a category)

This is architecture, not tone, and applies across every category above.

| Parameter | Single product | Full catalogue |
|---|---|---|
| Page shape | Long vertical scroll: hero, detail shots, story, specification, one CTA repeated at intervals | Grid/browse from the first screen, with filters/sort |
| Blocks needed | Hero, gallery/detail-shot sequence, story/craft section, specification table, single repeated CTA block | Category grid, filter/facet bar, search, pagination or infinite scroll, quick-view |
| Density | Can be sparse (one product deserves room) regardless of price tier | Density follows the price-tier rules above (luxury catalogue is still lower density than discount catalogue) |
| Primary action | The same one action, repeated, never varied | Add to cart / view item, repeated per grid cell |
| Failure mode if architecture is wrong | A catalogue block library applied to one product looks like an empty, broken store (near-empty grid, "0 other products") | A single-product long-scroll block library applied to many products forces one endless page per item, unbrowsable |

---

## Part 4 — Quota pricing and cost

### Real quota examples

| Product | Free tier | Paid entry tier | What happens at exhaustion |
|---|---|---|---|
| **Lovable** | 5 credits/day, capped 30/month, no card required | $25/mo (Pro, 100 credits), $21/mo billed annually | Blocked until daily/monthly reset or upgrade; credits also **expire two months after issue** even if unused. [Source](https://www.eesel.ai/blog/lovable-pricing) |
| **v0 (Vercel)** | $5 of credits/month, 7 messages/day cap, no card required | $20/mo (Premium) | Hard stop; **no à la carte top-up on Free** — must wait for monthly reset or upgrade. [Source](https://uibakery.io/blog/vercel-v0-pricing-explained-what-you-get-and-how-it-compares) |
| **Framer AI** | 500 credits/day, capped 1,000/month, roughly "2 landing pages a day" per Framer's own estimate | Paid plans add credits; overage bought separately | Users report an inconsistent, hard-to-predict burn rate; one documented complaint of over £300 spent on credits used against admittedly poor-quality output, with a request for a refund review. [Source](https://www.framer.com/help/articles/how-ai-credits-and-agents-pricing-work/) |
| **Canva** | 50 Magic Studio credits/month; Magic Write capped at 25 lifetime uses | Pro $18/mo, 500 credits/month | No à la carte top-up on the base plan (separate "AI Pass" add-on exists); power users report burning a Pro month's allowance "in a weekend of experimenting." [Source](https://www.eesel.ai/blog/canva-ai-pricing) |
| **Notion AI** | **20 lifetime responses**, not monthly — a genuinely different model from the others | Bundled into Business plan, $20/user/month, unlimited | Nothing resets; once spent, no further free access ever, only upgrade. [Source](https://www.eesel.ai/blog/notion-ai-complimentary-responses) |
| **Wix** | AI features are **not metered at all** on the free tier (no credits, no cap) | Paid plans remove Wix branding/ads, add storage | N/A — Wix's AI website builder is not the thing gated; hosting/branding is |

### The documented failure mode of "free prompts, then pay"

Two concrete, sourced cases show the exact failure mode the spec's P3 is written
against:

1. **Lovable**: "Credit depletion is the number one user complaint... users
   report burning 60-150 credits on layout issues and AI-created bugs," with one
   developer reporting **over 80% of credits spent asking the AI to repeatedly
   fix the same problem**, and another burning an entire month's Pro allowance
   in a single afternoon debugging one integration. The free tier's 5 daily
   credits are reportedly exhausted in about 3 interactions, which is not enough
   to form a fair impression of the product before being asked to pay.
   [Source](https://medium.com/@rentierdigital/the-ultimate-guide-how-to-stop-burning-through-lovable-ai-credits-like-a-noob-5600d8942c87).
2. **Framer**: a user in Framer's own community forum reported spending **over
   £300 on additional AI credits**, explicitly stating they felt they were
   "paying twice for Claude and carrying the full cost of Framer's poor-quality
   outputs," and formally requested credit restoration for failed generations.
   [Source](https://www.framer.com/community/posts/Na6zSjrFg2khUY7mmge3d3/).

The pattern in both cases is identical and is exactly what the spec's P3 already
identifies: **the credit meter does not distinguish a good generation from a
bad one**, so the user pays for the tool's own failure to produce something
usable, and the anger is directed at unfairness, not at the existence of a
paywall per se. Generic freemium research (not page-builder specific) supports
the mechanism: free-tier friction that is too high causes churn before the user
ever reaches value, while a trigger that fires only near quota exhaustion (not
mid-failure) is the standard mitigation.
[Source](https://www.userintuition.ai/reference-guides/freemium-and-churn-when-free-users-predict-paid-risk/).
This directly validates the spec's own rule ("do not charge for a failed
generation... this is the single most important rule in the section") — it is
not a hypothetical concern, it is the literal, named top complaint of at least
two comparable products.

### Cost per generation (Anthropic API, confirmed against Anthropic's own pricing docs, 3 Sep 2026)

Verified directly from [platform.claude.com/docs/en/about-claude/pricing](https://platform.claude.com/docs/en/about-claude/pricing)
(primary source, fetched directly rather than taken from a secondary summary):

| Model | Input $/MTok | Output $/MTok | Cache hit $/MTok |
|---|---|---|---|
| Claude Haiku 4.5 | $1 | $5 | $0.10 |
| Claude Sonnet 5 | $2 | $10 | $0.20 |
| Claude Opus 5 | $5 | $25 | $0.50 |

(Sonnet 5's $2/$10 introductory rate was scheduled to rise to $3/$15 on 1
September 2026; Anthropic's pricing page states that increase **did not occur**
and $2/$10 is now the standard rate as of this writing.)

**Sizing a single page-composition generation.** A realistic prompt for "pick
blocks, choose theme dials, write section copy" needs: the full block-library
schema/catalog as context (so the model knows the closed vocabulary — likely
3,000-8,000 tokens for a library of the size discussed in Part 2), the business's
own inputs (name, category, existing copy, photos-as-references, prices — call
it 500-1,500 tokens), and a system prompt with the design rulings from this spec
(500-1,000 tokens). Output is a JSON composition document plus section copy —
likely 1,500-3,500 tokens for a full page. Call it **~6,000 input / ~2,500
output tokens** per generation as a working estimate (this is my sizing, not a
published benchmark — flagged as such).

This is a **design/reasoning task, not simple retrieval**, so per the spec's own
instruction it should not run on the cheapest tier. Sonnet 5 is the right
starting point (strong enough for structured-output composition tasks, much
cheaper than Opus); Opus 5 is worth reserving for a fallback path if Sonnet's
output fails schema validation repeatedly on a given business (the spec's
"reject, do not repair, regenerate" rule means failed generations should retry
on a stronger model before burning the user's quota a second time on the same
mistake).

Estimated cost **per generation**, Sonnet 5, no caching:
- Input: 6,000 × $2/1,000,000 = $0.012
- Output: 2,500 × $10/1,000,000 = $0.025
- **Total ≈ $0.037 per generation**

With prompt caching on the block-library schema and system prompt (the largest,
most-repeated part of the input, cached across all businesses and all
generations): cached-read tokens (roughly 4,000 of the 6,000 input tokens once
warm) cost $0.20/MTok instead of $2/MTok, cutting input cost to roughly
$0.0048 + the 2,000 uncached tokens at $0.004 = **≈$0.0088 input, ≈$0.034 total
per generation with caching active.**

| Volume | Cost/month, no caching (~$0.037/gen) | Cost/month, cached (~$0.034/gen) |
|---|---|---|
| 100 generations | ~$3.70 | ~$3.40 |
| 1,000 generations | ~$37 | ~$34 |
| 10,000 generations | ~$370 | ~$340 |

Caching saves relatively little here because output tokens (the expensive side,
$10/MTok) dominate the bill and are never cacheable — this is a copy-writing and
JSON-emission task, not a long-document-retrieval task, so the usual "cache the
big context" saving matters less than it would elsewhere. If Opus 5 is used
instead throughout (worth costing since it's the "stronger model" the spec
anticipates needing): input 6,000 × $5/M = $0.03, output 2,500 × $25/M =
$0.0625, **≈$0.0925/generation**, i.e. roughly 2.5x Sonnet 5's cost — at 10,000
generations/month that is ~$925 vs. ~$370. A hybrid (Sonnet first pass, Opus only
on retry-after-validation-failure) keeps typical cost near the Sonnet numbers
while reserving Opus's quality for the cases that actually need it.

---

## Part 5 — What goes wrong

### What people hate, and what looks obviously AI-generated

- **The "Sea of Sameness."** Named and independently observed across multiple
  writeups (see Part 1): oversized hero headline, purple-to-blue or "Tailwind
  Blue" gradient, rounded cards, floating dashboard mockup, three-feature-card
  section, in that order, regardless of business type. The tell is not any one
  element, it's the **combination always appearing together**.
  [Source](https://axe-web.com/insights/ai-website-design-sameness/).
- **Stock-photo tells.** AI-built small-business sites show a recognizable
  pattern: generic stock photography, testimonial sections with **stock-avatar
  headshots** rather than real customers, and vague copy structure repeated
  across unrelated businesses. [Source](https://freshlybrewed.co/insights-news/ai-generated-websites/).
  Designers separately report that AI-generated stock imagery itself has visible
  "uncanny" artifacts (hands, faces, text-in-image) that remain a reliable tell
  even as models improve. [Source](https://petapixel.com/2025/01/23/designers-complain-ai-is-making-stock-photo-websites-unusable/).
  This directly supports the spec's P5 rule against inserting stock imagery that
  implies it's the owner's real premises/staff/product — the research confirms
  this is not just an ethics position, it is also a **visible quality tell** that
  actively damages the finished page.
- **Fraud adjacency.** ABC News documented resellers using AI-generated images
  and copy to fabricate a "family-owned artisan" backstory for what were, on
  inspection, newly-registered dropshipping operations — by the time a buyer
  notices something is off, the storefront often disappears.
  [Source](https://abcnews.com/US/visual-investigation-scores-online-resellers-ai-fool-customers/story). This is squarely
  what the spec's P5 rule against "no claims generated about the business that
  it did not make" and "no invented testimonials/credentials" is defending
  against — it is a documented real-world pattern, not a hypothetical.
- **Charged for the tool's own failures.** Covered in Part 4: both Lovable and
  Framer have named, sourced complaints where the credit meter charged users for
  outputs that were unusable through no fault of the user's prompt. This is the
  single most concrete, evidenced failure mode found in this whole research
  pass, and it maps to one specific spec rule almost line for line ("do not
  charge for a failed generation").
- **Abandonment for opacity/lock-in, not just quality.** Durable's review
  coverage includes a case of domain lock-in causing a small business real
  operational harm on cancellation (domain tied to the service, months of
  required active subscription before transfer, confusing billing).
  [Source](https://website-builders.cybernews.com/durable-ai-website-builder-review/).
  Relevant to this project only if pages ever gain their own hosting/domain
  features later — not applicable to the current phase, but worth flagging for
  whoever eventually designs that.

### RTL and non-Latin script failure modes specifically

This matters directly: half this marketplace's audience reads Hebrew.

- **Structural mirroring failures, not just text direction.** The most common,
  well-documented RTL bug class is not text alignment (that's usually handled),
  it's everything **around** the text: sidebars, image galleries, product grids,
  and multi-column layouts that were built assuming LTR and don't mirror,
  leaving genuinely unbalanced, confusing layouts. Sliders and navigation
  ("Next/Back" arrows) frequently stay pointing the LTR direction even when the
  language flips, which inverts the user's spatial expectation exactly backwards.
  [Source](https://www.linguise.com/blog/guide/how-to-make-your-website-rtl-ready-a-complete-guide-to-arabic-hebrew-farsi-support/).
- **This is precisely the failure mode the spec's own codebase already had.**
  `docs/ai-page-builder-spec.md` P4 notes the real, already-discovered bug class
  in this exact codebase: ~69 headings across ~45 files set `fontFamily:
  'Playfair Display'` inline, which beats the `[dir="rtl"]` CSS rule and Playfair
  has no Hebrew glyphs, so those headings silently fall back to a system serif in
  Hebrew. The external research corroborates that this class of bug (a
  Western-first default that "wins" over an RTL rule through specificity or
  literal-value hardcoding, rather than a stated design choice) is the dominant
  real-world RTL failure mode, not an edge case specific to this codebase.
- **For a generation system specifically**: some newer AI builders are starting
  to address this by generating **logical CSS properties** (`margin-inline-start`
  rather than `margin-left`) when RTL is specified, and mirroring the entire
  layout including navigation and sidebars, not just text.
  [Source](https://www.linguise.com/blog/guide/how-to-make-your-website-rtl-ready-a-complete-guide-to-arabic-hebrew-farsi-support/).
  This validates the spec's P4 rule ("blocks use logical properties only; heading
  fonts come from variables, never a literal face") as the correct fix at the
  block-library level — it has to be enforced structurally in every block once,
  not left to the model to remember per generation, exactly because the research
  shows the failure is almost always a **hardcoded LTR-first default**, not a
  missing translation.
- No source found gives a specific, named case of an AI page-builder failing on
  **Hebrew** specifically (most RTL coverage in this space discusses Arabic,
  which has broadly similar bidi/mirroring needs but different font-shaping
  behavior). Flagging this as a genuine gap: verify Hebrew glyph coverage and
  bidi behavior in the actual chosen fonts and blocks directly, rather than
  assuming Arabic-tested advice transfers exactly.

---

## What I would do for this product

1. **Composition, not generation — the spec's ruling is well supported.** Every
   consumer-facing small-business builder studied here (Wix's original tool,
   Squarespace, Framer, Durable, Hostinger) converged on composition
   independently, for the same reason this project has: the audience is a
   non-technical business owner who needs a safe result on the vendor's own
   origin, not a developer who can review generated code. Nothing in Part 1
   argues for revisiting this.

2. **Block count: start around 40-60 block types**, each with 4-6 dial-driven
   visual variants (roughly 200-350 total renderable variants), rather than
   chasing Relume-scale (1,000+) inventory. The evidence in Part 2 says sameness
   is a *selection-logic* problem, not an *inventory* problem — a smaller library
   with real dial-driven variety, correctly gated per business category (Part 3),
   should outperform a much larger library with generic, un-gated variants. Grow
   the count later based on what Phase 4 ("more blocks, driven by what owners
   actually ask for") actually surfaces, not preemptively.

3. **Model choice: Claude Sonnet 5 as the default generation model, Opus 5 as a
   validation-failure fallback, never Haiku for the composition step itself**
   (Haiku is fine for cheaper auxiliary tasks like re-summarizing existing copy,
   but the design-decision task needs the stronger reasoning). Estimated cost
   per generation ≈ $0.034-0.037 with Sonnet 5, meaning even 10,000
   generations/month costs roughly $340-370 in raw API spend — a genuinely
   affordable base cost that supports a generous free quota without much
   financial risk, provided the "don't charge for failed generations" rule holds
   so retries on Opus don't multiply spend unpredictably.

4. **Quota size and price: match the shape of the two products (Squarespace,
   Wix) that don't meter AI at all for the core experience, not the shape of the
   two products (Lovable, Framer) with the worst-documented complaints about
   quota fairness.** Concretely: give every business a free **first generation**
   that is good without any prompting (the spec already rules this), then
   **3-5 free refinement prompts** before quota applies (Lovable's 3-interaction
   free tier is explicitly called out by reviewers as too little to fairly
   evaluate the product — don't repeat that number). Price the first paid pack
   modestly: at ~$0.035/generation in raw cost, a pack of 20 refinement prompts
   priced at $5-9 (Lovable-adjacent, well below Framer's per-credit economics)
   comfortably covers API cost plus margin while staying far below what
   generated the "paying twice for Claude" complaint on Framer. **Never let the
   meter decrement on a generation that fails schema validation** — this is not
   a nice-to-have, it is the literal top documented complaint against the two
   closest comparable products.

5. **Treat the RTL enforcement as a block-library contract, not a per-generation
   check.** Every block ships once with logical properties and variable-based
   fonts; the model never has the option to hardcode a literal face or a
   physical (left/right) property, because the schema doesn't expose that
   surface. This is cheaper to get right once in the library than to catch per
   generation, and it is the exact bug class (inline style beats CSS rule,
   Western font has no Hebrew glyphs) already found once in this codebase.

6. **Before building generation at all, ship Phase 2 (dials plus presets, no AI)
   and watch real owners use it**, exactly as the spec already plans. Nothing in
   this research contradicts that sequencing; if anything, the Framer/Durable/
   Hostinger reviews (all of which describe the AI pass as "a starting point
   that still needs manual cleanup") suggest that a well-designed preset system
   may cover a large share of what owners actually want before any model call is
   needed at all.
