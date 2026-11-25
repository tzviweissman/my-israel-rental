# Eight videos on AI-built sites (25 Nov 2026)

Tzvi sent nine links; the sixth was sent twice, so eight videos. All eight were read through the YouTube transcript
panel in Chrome (yt-dlp was refused with HTTP 429 on the first try, so it was not used). Six had frames looked at;
two are talking heads with nothing on screen about design (videos 2 and 6). One file per video:

| # | Video | Read | File |
|---|---|---|---|
| 1 | Kyle Skelly, Claude + Blender + Seedance 2.5 (mvfo3pUiCCA) | transcript, 6 frames | [1-kyle-skelly-blender-blocking.md](1-kyle-skelly-blender-blocking.md) |
| 2 | RoboNuggets, Anthropic's engineers stopped building agents (IMSYKloMFrE) | transcript, comments | [2-robonuggets-skills-not-agents.md](2-robonuggets-skills-not-agents.md) |
| 3 | Tae Online HD, the /design skill (cCwStY4MsrI) | transcript, 5 frames; **already studied 22 Nov** | [3-tae-online-design-skill.md](3-tae-online-design-skill.md) |
| 4 | Nate Herk, "make it better" 100 times (DByAR5Su1Yw) | transcript, 4 frames | [4-nate-herk-make-it-better-100-times.md](4-nate-herk-make-it-better-100-times.md) |
| 5 | Mansel Scheffel, the Cook loop (gaQpXmJt-C8) | transcript, 4 frames; **already studied 22 Nov** | [5-mansel-scheffel-cook-loop.md](5-mansel-scheffel-cook-loop.md) |
| 6 | Ben AI, /dream memory (uYdbxzxRWl8) | transcript | [6-ben-ai-dream-memory.md](6-ben-ai-dream-memory.md) |
| 7 | Chase AI, design genius in 3 steps (7FU98O0JLHs) | transcript, 5 frames | [7-chase-ai-design-genius.md](7-chase-ai-design-genius.md) |
| 8 | Matt Penny, 10 repos for motion graphics (aD9X6Lc3dVk) | transcript, 4 frames | [8-matt-penny-motion-graphics-repos.md](8-matt-penny-motion-graphics-repos.md) |

Checked against `docs/page-generation-rules.md`, the build skill's `rules-digest.md` and every `docs/inspo/videos-*`
folder before calling anything new.

## The one idea from each

1. **Kyle Skelly:** rough the camera move as grey shapes in Blender, let Claude turn that moving rough into a
   second-by-second prompt, then pay for the clip.
2. **RoboNuggets:** test whether a skill now holds a smarter model back ("hobbling"); a "wildcard" slot lets the model
   surprise you.
3. **Tae Online HD:** references with take and skip notes, three versions, one per reference. Already our 3aj.1 and
   3aj.2.
4. **Nate Herk:** "innovate without a vision turns into adding"; the few good finds were a QR that sends the order to
   your phone, a two-axis "find your drink" map, and reviews that show what each person ordered.
5. **Mansel Scheffel:** a separate score per dimension so a weak part cannot hide. Already our 3aj.4 and 3aj.5.
6. **Ben AI:** memory needs a nightly tidy that rereads the chats; a correction repeated across projects becomes a
   global rule.
7. **Chase AI:** five directions, then three, then a tweaks panel of sliders instead of "make it more premium".
8. **Matt Penny:** borrow a finished style (paper cut, exploded view, physics) instead of inventing motion from
   scratch.

## What to ignore across all eight

Every channel sells something: courses, Skool communities, prompt packs, affiliate links (Higgsfield sponsors two).
None shows a real small business with prices, ordering, Hebrew or a phone check. Cost claims ($137, $1,700+) are the
presenters' own runs. "10x" titles are not measured.

## The ideas, by theme

"Option" means a choice for new sites only, never applied to a site already live (Tzvi, 29 Oct and 8 Nov 2026).
"Universal" means every new build does it. Each line says when it applies.

### A. Planning films before paying

| # | Idea | Do we already? | Where it would live | Kind |
|---|---|---|---|---|
| A1 | **A moving rough of the camera** (videos 1, 8). Before any paid clip whose camera moves (a fly-through, an orbit, a window reveal), a grey-shape Blender scene with the keyframed camera, rendered as a short low-quality video. Claude writes the second-by-second prompt from it. Shown on part D of the design board beside the stills. Free (Blender, no Higgsfield bridge). | Partly. We plan with stills (3h.6, 3al.1, 3al.5), a scroll timeline (3ak.2) and numbers (3al.4), never a moving rough. Section 8 names Blender but it was never used. | Section 8 (Blender, a fourth job) and 3aj.8 part D. Whether a video reference can be sent to the clip model is checked with `python scripts/hf.py models` first. | Option, for films whose camera moves |
| A2 | **The subject makes room for the words** (video 1, samurai). A film behind features is planned so the subject stands on one half while a feature's words sit on the other, then crosses for the next. | Partly: 3al.1 names the room the words need in each end frame. | A line in 3al.1 | Option, for films with feature text over them |

### B. New choices for the menu of 3ai.2 (each counts as one of the three, never required)

| # | Idea | Do we already? | Where it would live | Kind |
|---|---|---|---|---|
| B1 | **Labelled exploded view** (videos 1, 8). The product comes apart on the scroll and each part is named with a real fact: the layers of a cake or sandwich, the parts a repair shop replaces, the stones of a ring. | Partly: explode clips exist as a cause (3h, "explode, then fly back"); labels with facts do not. | 3al.7 menu | Option, only for a product with real layers or parts |
| B2 | **A card grows into the next film** (video 1). A small clip in a section expands to fill the screen and becomes the next scene. | Partly: 3ae (one part leads into the next) asks for hand-offs but does not name this one. | 3al.7 menu | Option, for sites with two or more films |
| B3 | **"Find your …" chooser on two axes** (video 4). Drag a marker onto a map (for example strong to gentle, sweet to savoury) and the nearest real item shows with its prices and Add buttons. Built only from the owner's real menu. | Partly: Delta's coffee quiz is named in 3ad as a signature body. | 3ad, beside the quiz | Option, for menus of 8 or more items |
| B4 | **A paper-cut scene drawn in code** (video 8). Layered cut-paper shapes with soft light, for a business with a story. | Partly: 3ak.1 live art in code (lines and dots only). | 3al.7 menu | Option |

### C. Ordering and proof (honest only with real data)

| # | Idea | Do we already? | Where it would live | Kind |
|---|---|---|---|---|
| C1 | **Reviews show what they ordered** (video 4). A review from our own order flow shows the item it was for and an "Order this" button. Only for reviews tied to a real order; a Google review never gets an item guessed for it. | No. Our reviews follow a real order, so the item is known. | Rule 3 (cont.) item 5 (real reviews) and the order page | Option for new sites; needs a small change to what the review endpoint returns |
| C2 | **Send the order to your phone** (video 4). On a laptop, the order summary also shows a QR code that opens the same WhatsApp message with the order written out on the phone. | No. Today the laptop opens WhatsApp Web, which many people are not signed in to. | The order page in the starter kit; on a laptop only (`hover: hover`) | Option for new sites |

### D. How we design and decide

| # | Idea | Do we already? | Where it would live | Kind |
|---|---|---|---|---|
| D1 | **A tweaks panel on the build preview** (video 7, also video 3's hand edits). After Tzvi picks a first screen, the preview gets a panel: heading font, sizes, weight, letter spacing, accent colour, motion weight, reveal distance, and "Copy values". He moves sliders instead of describing; the values come back to the build. Never published. | No (no rule or script mentions one). | `scrollcraft/starter/kit` and 3aj.8 part B | Universal for new builds (a tool for Tzvi, not a site feature) |
| D2 | **A wildcard first screen** (video 2). Of the three first screens in 3aj.2, one may be the model's own idea from no reference, named "wildcard" on the board. | No: all three follow a reference today. | 3aj.2 | Option per build |
| D3 | **A no-rules test once** (video 2, "hobbling"). Build one first screen with only the business record and the inspo, beside one built with the full rules; Tzvi says which is better. A test, never a deletion of rules. | No. | One trial, notes in this folder | One-off test |
| D4 | **Inspo sorted by look, with words** (video 7). A page that groups our saved site references by look family, each with the words that name it, for REFERENCES.md and the board. | Partly: `docs/inspo/` is sorted by date; the Pinterest ads have a filter page. | `docs/inspo/` index and the build skill's first step | Universal (a tool) |
| D5 | **Repeated corrections become proposed rules** (video 6). A script reads every build's FEEDBACK.md and lists any correction Tzvi gave on two or more sites, for him to approve as a rule. | Partly: FEEDBACK.md per build (3aj.6) and "How we can do better" at the end of tasks. | A new `scripts/` check, run weekly or at each build's end | Universal (a tool) |

### Already covered, nothing to add

- One version per reference, with take and skip notes (videos 3, 7): 3aj.1, 3aj.2.
- Judges scored per dimension, calibrated by Tzvi; colour measured against the inspo (video 5): 3aj.4, 3aj.5.
- Restraint, the cure for "make it better" piling up (video 4): 3ai, 3al.8.
- Forced references, since models never searched the web on their own (video 4): REFERENCES.md, 3aj.1.
- Guardrails against AI-look defaults (video 7): BRAND.md design bans and `docs/category-mistakes.md`.
- A window opening onto the product (video 1): `scrollcraft/motions.json` "window".
- A section index that follows the scroll (video 7): close to Bramble's chapter labels.
- Turning a corrected session into a skill (video 2): the "How we can do better" step.

## What was added (Tzvi, 25 Nov 2026: "add all ideas that would help our build be better, quicker or more consistent with less mistakes")

- A1 and A2: page rules 3am.1 (the camera rough) and 3am.2 (the subject makes room); section 8 Blender gets job 4.
- B1, B2, B3 and B4: page rules 3am.4, and on the menu of 3ai.2.
- D1: page rules 3am.3 and `scrollcraft/starter/tweaks.js` (tested headless: 31 controls from the starter's
  site.css; colour, size and font change and are kept after a reload).
- D2: page rules 3aj.2 (one of the three first screens may be a wildcard).
- D5: page rules 3aj.6 and `scripts/feedback-repeats.mjs` (with `--self-test`). No build has a FEEDBACK.md yet, so
  its first real run found nothing.
- The video-notes skill: search for the video's ID in `docs/inspo/` first; open the description before Show
  transcript.

Added later the same day (Tzvi: "do all 3"):
- C1: page rules 3am.5, `scrollcraft/starter/reviews.js`, and the reviews API now adds `ordered` (item names only) and
  `order_again` for a review written after a real site order (`backend/routes/reviews.py`, tested in
  `backend/tests/test_reviews_business.py`).
- C2: page rules 3am.6 and `scrollcraft/starter/qr.js` (Project Nayuki's MIT encoder, copied from the installed
  qrcode.react); tested: the code decodes back to the exact WhatsApp link.
- D3: the no-rules test, `norules-test/README.md` and `compare.png`.
- D4: `docs/inspo/by-look.md`, done in its own session.

No live site changes: rule-dates.mjs holds every site published before today to the rules of its own day
(check-rules on Bake Away lists R3am.1 to R3am.4 as "not required").
