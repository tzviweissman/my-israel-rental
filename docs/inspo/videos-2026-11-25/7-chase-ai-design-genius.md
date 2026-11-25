# Chase AI, "Turn Claude Into A Design GENIUS In 3 Simple Steps"

youtu.be/7FU98O0JLHs, 22:59, 610K views, posted 23 Jul 2026.

How it was read: the transcript panel in Chrome, plus 5 frames (4 saved here).

## The one idea

Taste has to come from you, then you iterate visually: "cast a very wide net off the bat" (five directions), narrow
to three, then tune with a panel of sliders instead of asking for "more premium".

## Step 1: a taste library (frame-verified)

He had Claude build a small web app of every screenshot he saved from Dribbble, Pinterest and X, **grouped by look
family** (Print-Tech Paper, Dither Mono, Vast Quiet, Classical Remix...), each card tagged with the words for its
style ("warm paper ground", "giant cropped footer wordmark", "stark studio dark") and two buttons: copy image prompt
and copy brief (`7FU98O0JLHs-inspo-library-by-family.png`).

## Step 2: tools

Impeccable (one skill, 23 commands, a checker for 46 slop patterns, a live mode for editing on the page), the taste
skill (we use it), the Higgsfield MCP, and 21st.dev for components. "Beware going down the rabbit hole... you're
just one skill away."

## Step 3: the build

- **A four-part prompt** (frame-verified, `7FU98O0JLHs-five-directions-prompt.png`): aesthetic, reference image,
  intent ("Conversion goal: book a demo... A founder should think 'these people actually understand data' within 3
  seconds"), and guardrails (always one monumental image, a single warm accent; never purple gradients, glossy 3D
  blobs, Inter). Then "Create 5 versions of this page, each in its own folder, one per direction... Do NOT blend
  directions." Images are reserved as grey boxes: "do NOT generate or source any imagery".
- **Five, then three, then one.** He picked "Vast Quiet", then the "Ledger" variant of it: a section index on the left
  that follows you down the page (`7FU98O0JLHs-ledger-index-follows-scroll.png`).
- **The hero picture next:** four generated options, then three colour versions of the one he liked ("a splash of
  colour"; he picked alpenglow). Then he asked for a soft hand-off between the hero and the body and a "heavy" load
  feel.
- **A tweaks panel** (frame-verified, `7FU98O0JLHs-tweaks-panel.png`): a panel on the dev server with heading font,
  italic on/off, H1 size, weight and tracking, H2 size and weight, body font and size, accent colour, hero picture,
  motion weight and reveal distance, plus "Copy CSS" and "Reset". "I don't want to sit here and ask Claude code to
  then create 10 different versions of the web page with different fonts."

## What to ignore

- Chase AI Plus, his Skool and the Higgsfield affiliate link.
- A made-up AI startup: no prices, ordering, Hebrew or phone check shown.
- Five full directions is more than we need; our three first screens (3aj.2) already do this step.

## What it means here

- Covered: one version per reference (3aj.2), guardrails (BRAND.md design bans, `docs/category-mistakes.md`), grey
  boxes before paid pictures (3aj.8), 21st and the taste skill.
- **New: the tweaks panel.** Tzvi's corrections today come as words ("too zoomed", "very basic") that a session turns
  into CSS. A panel on the build preview lets him move the sliders himself and send back the values.
- **New: a library sorted by look, with words.** Our `docs/inspo/` is sorted by date and source. A page that groups
  our saved site references by look family, with the words that name each look, would make REFERENCES.md quicker and
  give builds a shared vocabulary.
- The section index that follows the scroll is close to Bramble's chapter labels, which Tzvi liked on 8 Nov.
