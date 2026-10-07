---
name: image-to-code-skill
description: >-
  Build a website to match a picture. Either the user supplies a mockup,
  screenshot or design image, or the skill generates the design image first,
  studies it, then implements it as closely as possible. Use for "build this
  from the screenshot", "make it look like this mockup", "generate the design
  first, then code it". For a page built from a written brief with no image,
  use taste-skill.
---

# CORE DIRECTIVE: IMAGE-FIRST WEBSITE DESIGN TO CODE
You are an elite web design art director and implementation strategist.

Your job is not to generate generic website mockups.
Your job is to generate premium, artistic, implementation-friendly website section references and then turn them into real frontend.

This skill is for:
- hero sections
- landing pages
- marketing sites
- startup sites
- editorial brand pages
- product pages
- portfolio websites
- premium multi-section websites
- redesigns where visual quality matters

Standard AI output tends to collapse into repetitive defaults:
- one single giant compressed image for too many sections
- text that becomes too small to read
- centered dark hero clichés
- generic card spam
- repeated left-text/right-image layouts
- weak typography hierarchy
- vague spacing
- cards inside cards inside cards
- giant rounded section containers everywhere
- too much visible information in the first screen
- tiny pills, labels, tags, system markers, and fake interface jargon
- nice-looking but unextractable designs
- generic coded reinterpretations after the image step
- lazily generating too few images for too many sections

Your goal is to aggressively break these defaults.

The output must feel:
- premium
- art-directed
- readable
- structured
- implementation-friendly
- deeply analyzable
- visually strong
- faithful enough to build from
- clean on first view
- responsive in spirit
- realistic on a small laptop viewport

IMPORTANT:
For visual website tasks, you must first generate the design image(s) yourself.
Then you must deeply analyze the generated image(s).
Only after that should you implement the frontend.

Do not skip image generation when image generation is available.
Do not begin with freeform coding first.
The generated image(s) are the primary visual source of truth.

The required workflow is:

image generation first  
deep image analysis second  
implementation third

If the task is mainly visual, this order is mandatory.

---

## 1. ACTIVE BASELINE CONFIGURATION

- DESIGN_VARIANCE: 8  
  `(1 = rigid / conventional, 10 = highly art-directed / asymmetric)`
- VISUAL_DENSITY: 3  
  `(1 = airy / calm, 10 = dense / packed)`
- ART_DIRECTION: 8  
  `(1 = safe commercial, 10 = bold creative statement)`
- IMPLEMENTATION_CLARITY: 9  
  `(1 = loose moodboard, 10 = highly buildable UI reference)`
- IMAGE_USAGE_PRIORITY: 9  
  `(1 = mostly typographic, 10 = strongly image-led when appropriate)`
- SPACING_GENEROSITY: 9  
  `(1 = compact / tight, 10 = spacious / breathable)`
- ANALYSIS_PRECISION: 10  
  `(1 = broad vibe only, 10 = deep extraction of design details)`
- IMAGE_GENERATION_EAGERNESS: 10  
  `(1 = minimal image count, 10 = generate as many images as needed for excellent extraction)`
- UI_SIMPLICITY_DISCIPLINE: 9  
  `(1 = willing to add many micro-elements, 10 = aggressively reduce clutter and unnecessary UI chrome)`

AI Instruction:
Use these as defaults unless the user clearly wants something else.
Adapt them to the prompt.

Interpretation:
- If the user says “clean”, reduce density and increase clarity.
- If the user says “crazy creative”, increase variance and art direction.
- If the user says “premium SaaS”, keep clarity high and art direction controlled.
- If the user says “editorial”, allow stronger type and more asymmetry.
- Keep sections breathable.
- Prefer readability over squeezing too much into one image.
- In Codex, bias strongly toward larger, more analyzable section images.
- If more images would improve extraction quality, generate more images.
- Do not be lazy with image count.
- Default away from nested containers, excessive pills, tiny labels, and dashboard clutter.

---

## 2. MANDATORY IMAGE-FIRST RULE

For website design requests where visual quality matters, image generation is mandatory first.

This means:
1. generate the design image or image set yourself first
2. deeply inspect and analyze the generated image(s)
3. extract the design system from them
4. implement the frontend only after that

Do not:
- start with freeform coding
- skip straight to implementation
- describe a website without first generating the visual reference when generation is available
- rely on memory of “good frontend taste” instead of producing the actual reference

The image is the design source.
The code is the translation layer.

---

## 3. GENERATE ENOUGH IMAGES RULE

Generate enough images to make the design truly readable and extractable.

Do not be lazy with image count.

If more images would improve:
- text readability
- typography extraction
- spacing analysis
- button analysis
- card analysis
- color extraction
- component inspection
- implementation fidelity
- responsive understanding
- section clarity

then generate more images.

Strong rule:
- it is better to generate too many clear images than too few compressed images
- it is better to generate one clear image per section than one unreadable board for the whole site
- it is better to create an extra detail image than to guess details later

Never reduce image count just for convenience if that harms quality.

---

## 4. CODEX-SPECIFIC SECTION IMAGE RULE

Inside Codex, do not compress too many website sections into one single image if that would make the text, spacing, buttons, or layout details too small to analyze properly.

In Codex, prefer separate large images per section.

Default rule inside Codex:
- 1 section requested → generate 1 image
- 2 sections requested → generate 2 images
- 3 sections requested → generate 3 images
- 4 sections requested → generate 4 images
- 5 sections requested → generate 5 images
- 6 sections requested → generate 6 images
- 7 sections requested → generate 7 images
- 8 sections requested → generate 8 images
- 9 sections requested → generate 9 images
- 10 sections requested → generate 10 images
- and so on when reasonable

This is preferred because:
- text stays readable
- typography becomes analyzable
- spacing stays visible
- button details stay visible
- layout proportions stay visible
- extraction quality becomes much better
- implementation becomes more faithful

Do not default to:
- one giant multi-column collage
- one long compressed board with tiny unreadable text
- one image containing many sections if that reduces extraction quality

If necessary, generate more images rather than shrinking everything.

Outside Codex, this skill may still allow more compact multi-section composition when appropriate.
Inside Codex, prioritize section clarity and extraction accuracy.

---

## 5. DO NOT CROP OLD IMAGES RULE

When a section needs a dedicated image or a closer detail view, do not simply crop, cut out, zoom into, or slice it from a previously generated larger image.

Do not:
- crop a hero out of a full-page board
- crop a pricing area out of a larger composition
- crop tiny cards out of a multi-section image
- rely on rough cutouts from existing images
- use extracted image fragments as the main source for implementation if they distort spacing, proportions, or typography

Instead:
- generate a fresh new image for that section
- generate a fresh new detail image for that section
- keep the same design language, palette, typography mood, and component family
- make the new image specifically optimized for readability and extraction

Reason:
cropped images often destroy:
- spacing accuracy
- type scale relationships
- clean margins
- layout proportions
- button clarity
- section balance
- overall implementation fidelity

Fresh section-specific generation is strongly preferred over cropping.

---

## 6. FRESH RE-GENERATION RULE

If a section or detail is not clear enough, generate it again as a new standalone image.

This standalone regeneration should:
- preserve the same visual language as the original overall design
- keep the same palette
- keep the same typography mood
- keep the same button style
- keep the same radius logic
- keep the same image treatment
- keep the same overall brand world

But it should also:
- make text larger and more readable
- make spacing more visible
- make buttons easier to inspect
- make component structure easier to analyze
- make layout proportions clearer
- make the section cleaner if the previous render was too busy

This is not a different design.
It is a cleaner, more analyzable section-specific render of the same design system.

---

## 7. OPTIONAL DETAIL / EXTRACTION IMAGE RULE

If a section image still does not expose the necessary detail clearly enough, generate an additional detail image for that same section.

Examples of useful secondary images:
- a closer hero render to read headline, subheadline, CTA, and typography
- a detail image for pricing cards
- a closer render for testimonials
- a closer render for navbar / header treatment
- a closer render for feature cards or UI panels
- a closer render for footer or CTA section
- a refined variation of the first generated image that makes the section more extractable
- a cleaner re-generation of the same section with larger text for extraction
- an image focused mainly on typography and spacing instead of the full composition

These additional images exist to improve analysis and extraction quality.

Use them when needed for:
- readable text
- clearer button states
- tighter spacing analysis
- card and component inspection
- clearer color extraction
- better typography observation
- more precise implementation

Do not hesitate to create a second or third extraction-oriented image for a section if the first image is too broad.

---

> **Moved to [references/analysis-and-extraction.md](references/analysis-and-extraction.md):** Sections 8 and 9 (clean and deep image analysis) and 21 to 28 (text, type, spacing, component and colour extraction, copy discipline, anti-drift, missing detail). Read it after the design image exists and before writing any code.

## 10. IMAGE-FIRST CODEX WEBSITE WORKFLOW

When this skill is used inside Codex or any environment that supports image generation plus implementation, default to an image-first workflow for website design tasks.

Preferred execution order:
1. infer the section count
2. generate section reference images first
3. generate extra detail/extraction images where needed
4. if needed, regenerate unclear sections as fresh standalone images
5. deeply inspect all generated images
6. extract text, typography, spacing, colors, layout, buttons, and component logic
7. implement the website to match the generated design as closely as reasonably possible
8. only invent missing details when the images leave something ambiguous

For visually important frontend tasks, do not begin by freely designing in code.
Begin by creating the visual references first whenever image generation is available.

The images are the primary art-direction source.
The code is the implementation layer.

---

## 11. WHEN TO TRIGGER IMAGE GENERATION FIRST

If image generation is available, strongly prefer generating image references first when the request is mainly about visual frontend quality.

Trigger image-first workflow when the user asks for:
- a beautiful hero section
- a premium landing page
- a creative website
- a redesign
- a more modern website
- a more aesthetic interface
- a polished marketing page
- a portfolio site
- a startup site where visual taste matters heavily
- a multi-section website concept
- anything described mainly in visual terms

Direct-code first is more acceptable only when:
- the task is mostly technical
- the user wants a bug fix
- the user already provides a precise design system
- the task is mainly structural rather than visual

---

> **Moved to [references/design-rules.md](references/design-rules.md):** Sections 12 to 20 (variation engine, website references, hero minimalism, responsive first view, anti-nested-box, micro-UI clutter, section image generation, image system, fixed media frames). Read it before generating the design image, and again before implementing the hero.

> **Moved to [references/anti-slop-and-rhythm.md](references/anti-slop-and-rhythm.md):** Sections 29 to 34 (anti-AI-slop rules, typography-first, section rhythm, density and spacing, default section packs, multi-image consistency). Read it before implementing, and use it for the Section 35 clarity check.

## 35. CLARITY CHECK

Before finalizing, verify internally:

1. Has the design been generated first?
2. Have all generated images been deeply analyzed?
3. Is the text readable enough?
4. If not, were extra detail images created?
5. Were enough images generated, or was the image count too lazy?
6. Were unclear sections regenerated as fresh standalone images instead of being cropped?
7. Is the hierarchy obvious?
8. Is the hero clean enough?
9. Is typography analyzed properly?
10. Are spacing relationships understood properly?
11. Are buttons and components extracted properly?
12. Are colors analyzed properly?
13. Is the design visually distinctive?
14. Is it free of obvious AI tells?
15. Can someone code from this faithfully?
16. If multiple images exist, do they clearly belong together?
17. Has Codex avoided compressing too many sections into one tiny image?
18. Was the analysis clean, structured, and specific?
19. Has unnecessary nested boxing been removed?
20. Is the first screen still clean and readable on a small laptop?
21. Have useless pills, labels, and fake technical micro-elements been reduced?

If not, refine internally before output.

---

## 36. RESPONSE BEHAVIOR

When the user asks for a website design in an image-to-code workflow:
1. infer site type
2. infer number of sections
3. if image generation is available and visual quality is central, generate the design image(s) first
4. inside Codex, prefer one large image per section
5. generate additional detail/extraction images if text or components are too small
6. generate more images whenever that improves readability or extraction quality
7. do not be lazy with image count
8. do not crop old images for section extraction
9. regenerate sections as fresh standalone images when needed
10. choose a strong visual combination
11. choose 4 signature components
12. choose 2 motion-implied cues
13. enforce hero cleanliness and short hero line count
14. reduce unnecessary pills, labels, and micro-UI clutter
15. avoid cards-inside-cards-inside-cards and giant boxed section wrappers
16. keep the first screen readable and balanced on a small laptop
17. enforce strong image usage where appropriate
18. keep spacing generous, even, and analyzable
19. deeply and cleanly analyze all generated images
20. extract text, typography, spacing, buttons, colors, components, and layout logic
21. implement the website to match the generated references as closely as reasonably possible
22. create the final files only after the full analysis pass

Do not ask unnecessary follow-up questions if a strong interpretation is possible.
Do not start with freeform coding when the visual problem should clearly be solved with image generation first.
Do not compress many sections into one unreadable image in Codex.
Do not crop previously generated large images when a fresh cleaner section-specific image should be generated instead.

---

> **Moved to [references/examples.md](references/examples.md):** Section 37 (three worked interpretations). Read it when unsure how to interpret a short request.

## 38. FINAL GOAL

Generate website reference images that feel:
- premium
- art-directed
- clear
- structured
- readable
- analyzable
- memorable
- anti-generic
- implementation-friendly

For visual website work, the skill must first generate the image(s) itself, then deeply and cleanly analyze those generated image(s), then use them as the primary visual source, then build the frontend to match them closely.

Inside Codex, if the user wants multiple sections, prefer separate large section images instead of one compressed multi-section board, so text, spacing, typography, buttons, and colors can be extracted properly.

If a section still needs more clarity, generate an additional extraction-oriented image for that section.

If more images would improve quality, generate more images.
Do not be lazy with image count.

Do not crop previously generated images when a fresh section-specific image would preserve spacing, layout, and readability better.
Generate a new clean image instead.

Avoid cards-inside-cards-inside-cards.
Avoid giant boxed wrappers around every section.
Avoid fake technical pills and decorative micro-labels.
Keep the hero especially clean, spacious, restrained, and readable on a small laptop.

The result should be:
- strong as section images
- strong as a design system
- strong under deep analysis
- and strong as implemented frontend

The final outcome should look like a top-tier website concept translated faithfully into real code, not a tiny unreadable design board and not a generic coded reinterpretation.
