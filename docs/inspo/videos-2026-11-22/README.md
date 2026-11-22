# Two videos on better AI-built sites (22 Nov 2026)

How these were read:
- **Tae Online HD, "Claude Code + /Design Skill = Web Design On STEROIDS"** (youtu.be/cCwStY4MsrI, 6:39): the YouTube
  transcript panel in Chrome, plus five frames looked at (the three saved here).
- **Mansel Scheffel, "This NEW Claude Skill Is Blowing People's Minds (Cook)"** (youtu.be/gaQpXmJt-C8, 13:42): the
  auto captions through yt-dlp. No frames were taken; it's a talking-head video over the GitHub repo.
- **The repo itself**, github.com/Leonxlnx/cook: SKILL.md, references/loop-and-critics.md, target-and-bar.md,
  rules.md and templates/ROUNDS.md, read in full. Leon also wrote taste-skill, which we already use.

## Video 1: references with notes, then one direction per reference

The one idea: "if you just take what Claude gives you out of the box, you're letting an AI with zero taste guess how
your site should look."

Three steps (frame-verified):
1. **A board of hero references from Mobbin, each with a sticky note** on what to take *and what to skip*
   (`tae-moodboard-take-and-skip-notes.png`). For Fiasco: "photos float around the edges while the headline sits right in
   the middle... Skip the yellow and their font." For Instrument: "The type is the star... Skip the gray pill nav."
   - Without notes, the same references came back as "a janky Frankenstein site", with every piece taken from a
     different reference.
2. **A prompt with three parts** (`tae-three-variations-prompt.png`):
   - One section only ("Just the hero for now. We'll build the rest one section at a time").
   - What it is, and what a visitor should know at a glance.
   - "Give me three variations, one per reference", under fixed ground rules: one ground colour (#E9EAE4), one heavy
     condensed headline face plus a plain grotesk, a plain nav, grey boxes for images. So only the layout changes
     between the three.
3. **Art-director refinement, never "make it pop".**
   - He trimmed the pick by hand on the canvas.
   - He asked for three more versions "pushing the art direction" (bold editorial type, expressive compositions).
   - Then he named the exact effect: cards on a curved 3D carousel, smaller toward the edges.
   - Motion was written as choreography: "headline animated in with a smooth, staggered mask reveal where each word
     slides up", "carousel spiral into the page... as if the cards are rotating into position from offscreen", "Don't
     change the existing layout" (`tae-final-hero-motion-brief.png`: the build's own reply lists start times of
     0.35 s and 1.9 s and a 150-degree turn).

Discount:
- The video sells a prompt pack and a Mobbin affiliate link.
- A portfolio hero is the easy case: no products, no prices, no ordering, no phone check shown.

## Video 2 and the repo: the Cook loop

The one idea: the agent "stops the moment something works". Cook gives it a target (reference pictures), a bar
(a number per dimension) and time, and judges it with critics who never saw it being built.

Mechanics from the repo (read, not just narrated):
- **The bar has one number per dimension:** composition, light, colour, materials, detail near and far, motion. Each
  is scored on its own, so the weakest can't hide behind the rest. For UI, materials map to type and components, and
  motion to interaction.
- **Side by side every round:** the reference on the left and the render on the right, at the same framing and aspect
  ratio (`scripts/side-by-side.mjs`).
- **Critics:** at least two fresh subagents that get only the side-by-side images and the rubric (no code, brief or
  builder's score). It takes the median per dimension, and adds a critic when two differ by more than 10 points. The
  builder's own score is "logged, never decisive".
- **Calibration:** "The user's estimate is the truth." If the critics said 90 and the user says 60 to 70, every later
  score gets about minus 25 until the user rates again. A blind pair test also helps: a critic is asked which picture
  was made in code, and its reason names the next fix.
- **Measured apart from eyeballed:** a colour check splits both pictures into a 4x4 grid and compares saturation and
  brightness cell by cell. It catches "too grey" before the user has to say it, which they call the most common
  complaint.
- **Ledger:** ROUNDS.md, one entry per round: focus, changes, scores, what was measured, "Not checked this round",
  the user's exact words and the next focus.
- **Gate:** the final render waits for the user's yes on the stills.
- **Slop list:** eyebrow labels, monospace uppercase, random serifs, purple gradients, beige, 01/02/03 counters,
  glowing orbs, decorative particles and long dashes.

Discount:
- Runs are 10 to 40 hours. The showcase world was about $1,700 to $2,200 in API terms.
- The presenter's own one-hour runs were "not overly impressive", and he called it overkill for most websites.
- The channel sells a paid community.

## What it means here

We already have most of the shape:
- REFERENCES.md and IDEAS.md, with the source pictures.
- inspo-beside.py and the `shot_seen` line.
- A judge that didn't build the site (§3ah.7).
- The film-gate and the new rule that the whole film is seen as stills first (§3aa.35).

What is new to us:
1. **Skip notes.** Our reference lines say what to take, never what to leave out. The Burnt iron copied too much of
   its inspo until Tzvi said "use similar ideas".
2. **More than one judge, scored per dimension, with a calibration.** We use one Sonnet judge with one 1-to-5 number.
   Tzvi's own verdicts ("very basic", "theirs still looks way better") never correct the judge.
3. **A measured colour grid beside the inspo.** check-light-pool measures brightness on the product only.
4. **First-screen variations, one per reference, under fixed ground rules.** We plan three opening *ideas* in
   CONCEPT.md, but they aren't built side by side as real layouts.

Conflict to flag: Cook's slop list bans eyebrow labels, but our 3ag.5 asks for a small label above every section
headline. That is Tzvi's call; nothing was changed.

## Video 3: one prompt, six design skills, then all of them stacked

**Create With AI, "This Claude Skill Changed UI Design Forever!"** (youtu.be/_ZSrFN_ayZs, 10:57). Read through the
auto captions from yt-dlp, plus two frames. The before/after frame is saved as
`create-with-ai-baseline-vs-five-skills.png`.

He built one habit-tracker prompt with no design words, then again with each skill, then with five stacked. Same model,
same prompt.

The one idea: Claude "isn't actually bad at design. It just plays it safe." He says Anthropic itself found that telling
it to avoid a generic AI look "mostly swaps one default for another". What works is a design *process*.

The skills, in his stacking order:
1. **UI UX Pro Max.** A design library: 79 styles, 192 palettes, 74 font pairings, 119 UX guidelines.
   - It searches the library for the kind of product and writes a design-system master file, which every page then
     follows.
   - That file includes a list of **anti-patterns for this kind of product**.
   - It works only with a specific brief ("habit tracker, busy adults, calm, warm, motivating"); "make it nice" gets
     a generic pick.
2. **frontend-design (Anthropic).** It writes a small plan first: 4 to 6 colours, the typefaces and what each is for,
   and a layout idea.
   - Then it **checks the plan against "the default it would make for any similar app" and changes whatever matches**.
   - Weakness seen: it set a display face on small dashboard numbers, which were hard to read.
3. **Impeccable.** 24 commands (bolder, quieter, typeset, layout, polish...) plus a checker for AI-design mistakes.
   - It **scores each page like a reviewer before fixing anything**: the dashboard got 22 of 40.
4. **Baseline UI.** Strict small rules: digits all one width so numbers line up, no tight letter spacing on headings,
   a real dialog for delete, and a 200 ms check-off pop.
5. **Web Interface Guidelines (Vercel).** An audit of over 100 rules that found 35 issues, two serious:
   - Tabbing by keyboard, **the sticky bars covered the focused button**.
   - Toggles were plain buttons instead of real checkboxes and switches, so a screen reader couldn't announce them.
   - A second pass found none left.
6. **webapp-testing (Anthropic).** It opens every page at phone and desktop size and screenshots them. It found six
   faults, including a page scrolling sideways on a phone and a label spilling out of its box.

What I see in the frame: the "after" is calmer and more readable than the dark orange baseline. But it is still white
cards in three columns, so the stack fixes faults more than it makes a site memorable.

Discount:
- A like-and-subscribe channel.
- One example app, judged by the presenter.
- No timing or cost given for the stacked run.

What it means here: most of this we already have.
- **Category and brand:** the category table (3t) and BRAND.md's design bans (3x).
- **Looks already used:** fingerprints.json with check-fingerprints, which catches a look already used.
- **Motion and broken content:** check-motion-feel and check-break-ui (Emil Kowalski's rules).
- **Phones:** check-iphone and the six-size renders.
- **Web basics:** check-web-basics, which covers SKIP, HEADS, FOCUS, LABEL, LIVE, IMAGES and SCALE.

Two things are new:
1. **Focus hidden under a sticky bar.** check-web-basics tests that a focus ring exists, not that it can be seen. Our
   sites all have a sticky menu bar and a phone order bar.
2. **Anti-patterns by kind of business.** BRAND.md bans are written per site. A short list per category (bakery,
   butcher, jeweller) of the moves every AI-made site of that kind makes would stop them before the build, as UI UX Pro
   Max does.

## The Create With AI channel (Tzvi: "I like this channel, go through a bunch of their videos")

The channel has eight videos. Video 3 above is one of them. Three more are about building sites, read here. The other
four are about general Claude use, a model comparison and command lists, so they were skipped.
- **"This Claude Skill Changed Web Design Forever!"** (youtu.be/85Avki4ihNE, 10:33): yt-dlp captions and four frames.
- **"How To Make 3D Animated Website Using Claude In 11 Minutes"** (youtu.be/i_Fua_tPZZ8, 11:39): captions and two
  frames.
- **"9 Claude Skills to 10x Your Claude Code"** (youtu.be/Dy70TSGnQz8, 12:01): captions only. It's a round-up.

**Driftwave (85Avki4ihNE).** He gave one brief, then layered three skills on it, then folded everything into a brand
skill.
- **taste-skill.** It picks the palette, fonts and hero for the kind of business, then checks the result in a
  browser.
- **algorithmic-art (Anthropic).** A p5.js flow field of thousands of thin lines behind the hero that bend round the
  pointer "like water around a finger" (`cwai-flow-field-hero.png`).
  - It is **seeded**: the same number always draws the same art, so a pattern you love can be kept (seed 1407).
  - It stuttered on a phone, and the fix was fewer lines on small screens.
  - Under reduced motion it calms down.
- **A 3D section (three.js and GSAP).** A liquid-silver shape that breathes and **morphs into a new shape per
  section**, with the text timed to the scroll (`cwai-liquid-shape-morphs.png`).
- **His fix list:** "keep pricing calm". A pricing section that spins in 3D "would be fun once, but pretty annoying
  when you're just trying to read the prices."
- **Brand skill.** Skill Creator turned the finished design into a brand skill. An About page built with it passed 12
  of 12 brand checks, against 8 without it.
- **The before/after frame** (`cwai-driftwave-before-after.png`): the dark, centred, three-card baseline next to a
  light page with a big 3D object and a soundscape list.

**Halo Orbital (i_Fua_tPZZ8).** A spec before any build.
- spec.md names the tools (three.js, GSAP ScrollTrigger, Lenis) and a **scroll timeline**: for every scene a start
  and end point, what the camera does and what the text does, "so the 3D and the text can never fall out of sync"
  (`cwai-scroll-timeline.png`).
- Three criteria he took from Awwwards winners:
  - It tells a story as you scroll.
  - One thing to look at per scene, and the whole idea in three words ("scroll to launch").
  - It is the kind of site people screen-record and share.
- The first build had a generic purple, a headline over the Earth on a laptop, a stutter in the asteroid field and two
  cards going blank on scroll-up. UI UX Pro Max's design system fixed the look; the bugs were fixed by name.
- Extras: a 0 to 100 loader, film grain, word-by-word headline, warp streaks on fast scroll, particles morphing into
  the rocket and then the logo, tilting price cards, a magnetic cursor.

**The round-up (Dy70TSGnQz8).** Most of it is not for us. Two points are:
- Playwright self-QA found the page **scrolling behind an open dialog**, tap targets too small and failed contrast.
  Our starter already locks the page behind the product sheet (shop.js), and check-site has TAP.
- Claude **made up testimonial names** and flagged them. Our rule 1 already bans that.

Discount: the channel ends every video with like-and-subscribe. Results are the presenter's own judgement on made-up
brands with no owner, no products and no ordering. Driftwave's "agency level" is a claim, not a measurement.

What is new to us:
1. **Live art drawn in code, behind the words.** Seeded, it bends round the pointer, uses fewer lines on phones and
   holds still under reduced motion. Free to make, and no two businesses get the same pattern. It isn't in our rules;
   "something alive" (touch 34) names only leaf shadows and a jellyfish.
2. **A scroll timeline in the film plan.** For each scene: where in the scroll it starts and ends, what moves, and
   when its words come and go. Our chain.json plans each clip but not the scroll positions.
3. **The site's brand carried into its ads.** The ad checklist never reads the site's BRAND.md, so a business's ad
   and its site can look like two brands.
4. **Prices stay calm.** No tilt, 3D or scroll effect on prices or the order controls.

All four approved by Tzvi, 22 Nov 2026: page rules 3ak.1 to 3ak.4 and ad step A27.1.
