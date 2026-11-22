# Rules audit after the reorder (22 Nov 2026)

Read in full, on `origin/main` at 476f6d10: `docs/page-generation-rules.md` ("rules"), `docs/rules-checklist.md`
("checklist", 331 rule lines), `.claude/skills/build-business-page/SKILL.md` ("SKILL"), its
`reference/rules-digest.md` ("digest"), `docs/category-mistakes.md`, and section 27 of `docs/static-ad-rules.md`.
Scripts were opened only to confirm what a gate really demands (blueprint, check-concept, check-compared,
check-build, check-fingerprints, check-web-basics, film-gate). Every file path the rules name was tested with ls.

Nothing was changed. Each fix below is a proposal. Where the fix is a choice between two rules, it says
"Tzvi's call" and gives the default I would take.

Types as first filed: CONTRADICTION (21), ORDER (11), REPETITION (5), STALE (7). 44 findings, most harmful first.
After the re-check below, the 21 are: 5 true conflicts, 14 that need one "when", 2 withdrawn.

---

## Re-checked after Tzvi's note

Tzvi: "on each page generally we want to see the whole picture but sometimes to help with the flow it can run
into the next slide if it won't ruin visibility of the item." Rules are written for different situations and are
combined with judgement. So each of the 21 contradictions, and each of the 9 "Tzvi's call" items, was put to one
test: can one real situation satisfy both rules at once?

- **TRUE CONFLICT**: no. One line has to change.
- **NEEDS A WHEN**: yes, once a builder knows which situation or which part of the picture each rule is for. The
  fix is one short phrase; no rule is deleted or weakened.
- **NOT A CONFLICT**: withdrawn.

**Each rule was traced to its source before judging** (Tzvi: "try to find the sources for the rules to see if
they actually contradict"): his quoted words in the rule, the picture or notes it cites, or the commit that
added the line (`git log -S`). Each line below ends with "Source:". Opened: the Burnt iron picture, the 17 Nov
notes and Nate Herk's salon frame, POUR / PLAY's key frames, Bramble's frame sheet, the flow-field hero, the
Baked Fresh shop, the product-page notes of 20 Oct, the Ruben Stom notes, the 16 Oct site notes.

Two cited sources are not on origin/main and were read in the main checkout
(`C:\Users\tzviw\Documents\my-israel-rental\docs\inspo`): `pinterest-burnt-2026-11-18/` and
`videos-2026-11-17/` (finding 35 lists the others).

What the sources changed: two of the first seven "true" conflicts fell away. The owner-approval line (8) was
written on 23 Sep for the automatic builder, where the owner publishes. The colour-per-section line (23) was
written for The Brown Box's chooser ("the chosen bowl colours its section").

**Where this section and a finding below disagree, this section wins.** The fixes written under findings 3, 4,
5, 9, 18, 19, 20, 22, 24, 25, 27 and 28 are replaced by the smaller wording here. Findings 42 and 43 are
withdrawn. The order, repetition and stale findings stand as written.

### New counts

| | Count | Findings |
|---|---|---|
| TRUE CONFLICT | 5 | 6, 7 (one line of it), 21, 26 (one line of it), 39 |
| NEEDS A WHEN | 14 | 3, 4, 5, 8, 9, 18, 19, 20, 22, 23, 24, 25, 27, 28 |
| NOT A CONFLICT | 2 | 42, 43 |

Of the 9 "Tzvi's call" items, none is a true conflict. Seven only need a when (3, 4, 8, 19, 20, 24, 27), 43 is
not a conflict, and 17 is a numbering fault, not a clash of rules; its fix stands.

All five true conflicts are an older line that a newer decision of Tzvi's replaced and nobody went back to
change. None is two live rules pulling against each other.

### The 5 true conflicts

- **6. Higgsfield by MCP or by API.** TRUE CONFLICT. Same moment, opposite instruction, and a hook blocks the
  older one. Rules section 8 (twice) and digest section 1: "the MCP connection while building, the API when it
  refuses" becomes "through the API only (2 Nov 2026)". Source: the MCP line is commit 33087c16, 14 Oct; the API rule is
  Tzvi, 2 Nov, with its hook.
- **7. Cost told before each generation.** TRUE CONFLICT, in one line only. Rules 3g.15 "The cost is told to
  Tzvi before each generation" cannot stand beside the standing OK ("without asking ... the spend goes in the
  report"). New: "The price is read with get_cost first and the spend goes in the report; Tzvi is asked first
  only for something unusually expensive." The rest of finding 7 is not a conflict: showing him BRAND.md or a
  before-and-after pair is not a fifth yes, and it happens on the board. The live-site writes need a when:
  SKILL's table gets "none, except his OK to the live-site writes in phase 1". Source: the cost line is commit
  cfb29f5d, 14 Oct (The Gift Boutique); the standing OK is Tzvi, 4 Nov: "so you dont need to ask me by every
  build".
- **21. Type and font numbers.** TRUE CONFLICT. A page with eight text sizes fails R3e.14 ("at most six") and
  passes R3x.13 ("at most 10", the script's limit). A third font passes R3x.7 and fails check-web-basics ("two
  at most"). R3e.14: "at most six text sizes" becomes "text sizes from the scale of 3x.13". For the third font,
  either drop "at most a third for one label style" (3g.1, R3x.7) or raise the script to three when BRAND.md
  names it. Digest 3d's "up to three accents" is the automatic builder's rule, a different situation: add
  "(automatic builder)". Source: six sizes is commit d5c349ec, 8 Oct (two of the twelve UI videos); ten is
  Tzvi, 4 Nov, measured on our sites (Bake away had 14); the third font is 16 Oct (The Brown Box); two families
  is the 4 Nov web-basics script.
- **26. The owner note's check.** TRUE CONFLICT, in one line only. R3af.2 says "owners are not asked for a note"
  and its HOW says "LOOK: `message-to-owner.md` asked for it". HOW becomes "LOOK: the note's words against what
  the owner sent; n/a when none was offered"; rules 3af.2 "asked of them" becomes "offered by them". The other
  two parts of finding 26 only need a when: 3ab.1's label "may name the section" gets "where it adds a fact
  (3ag.5)"; R3g.18's "headline or big words" gets "or the line directly under it (3ah.1)". Source: all three are this week's decisions (Tzvi, 22 Nov: "if
  they want to add one they can but its fine without it"; 21 Nov: "its way better").
- **39. A credit price in the owner's message.** TRUE CONFLICT as worded, almost certainly a slip. Rules 0b.2
  "named in the owner's first message" becomes "written in the first-look note". Source: commit a9938e35, 27 Oct ("named with the cost in the
  owner's first message"), three weeks after Tzvi's 6 Oct "dont ask a business that question"; today's reorder
  carried the wording over.

### The 14 that need a when

- **3. Whole, or running off the frame.** NEEDS A WHEN. The Burnt picture settles it: the live-edge board runs
  off the top right, while the iron and its mark, the hero, are whole and sharp. "Whole" is about the item;
  "running off" is about what it rests on. Rules 3aa.33.1, after "at least one corner or edge runs out of the
  frame", add: "of the surface or setting it rests on; the hero item itself is seen whole (3aa.8, 3aa.21)". No
  other line changes. Source: Tzvi, 18 and 19 Nov, on that picture ("the angle of the wood made it look
  dramatic and premium"); the picture opened.
- **4. How a product is photographed.** NEEDS A WHEN. The rules are for three different pictures: the advert
  picture (section 8, from the 16 advertising photos), the shop card (3ag.1, from the bakery shops) and the
  opening still (3aa.33, from the Burnt picture). 3ag.1 already says which photo gets a scene ("styled shot").
  Only one phrase collides: section 8 and R8.6 list "a product card" among the pictures that get a plinth and
  props. Add after it: "when it is a styled shot (3ag.1); a shop-ready or re-lit card photo stays on its plain
  ground". Rules 3h.11, after "never 'dark' ... as the default", add: "for a film; a staged opening still
  follows 3aa.33". Source: section 8 is Tzvi, 22 Oct, "after 16 advertising product photos"; 3ag.1 is Tzvi,
  19 Nov, Tova beside bakery shops (Baked Fresh's cards are plain and soft-lit, opened); 3h.11 is Tzvi, 16 Oct,
  The Brown Box film "too dark".
- **5. Words on the film.** NEEDS A WHEN. POUR / PLAY shows both at once: a huge word behind the grinder and a
  small "POUR" line at the side. Bramble has small chapter lines at the edge. So 3h.5 is about chapter lines and
  3aa.5 and 3aa.9 are about the step's one big word. Rules 3aa.5, "never small labels laid over the film"
  becomes "the step's own word is never a small label; a small chapter line at an edge (3h.5) may sit with it".
  R3h.25, add: "a word set into the still behind the object (3aa.9) is part of the picture". Rules 3al.3, "never
  words in the video" gets "for the headline and anything read to order". One sub-case stays a real clash and
  needs a decision: 3aa.9's fallback, "the word goes in code in front of the film", will fail check-film-clear's
  3%. Source: 3h.5 and 3h.9 are Tzvi, 16 Oct, The Brown Box ("the words block a lot of what's going on");
  3h.25 is Tzvi, 4 Nov, Krysp ("this is blocking a lot of the action", a headline card over the film); 3aa.5
  and 3aa.9 are POUR / PLAY, 12 Nov. All three complaints are about words covering the action, which a word
  behind the object does not do.
- **9. category-mistakes against required parts.** NEEDS A WHEN. The source says it plainly
  (`videos-2026-11-17/README.md`): the fault is "One skeleton, 21 times", the same parts in the same order in
  their default form, not the footer or the cards themselves. One sentence in category-mistakes, after "A new
  kind gets its own part": "The parts the rules ask of every site stay (footer 3v.1, gallery place 3m.1,
  product cards 3ag.2, the category's ground 3t); the mistake is the same order and the default form of each."
  Nothing in 3t, 3v.1 or 3g.7 changes. Source: category-mistakes' "every kind" part cites that README, which
  was read; Nate Herk's salon frame opened.
- **18. Intro.** NEEDS A WHEN. Three different things share the word. Rules 3al.8, after "An intro": "(a screen
  shown before the page; not the opening's arrival, a film's first event or a phone opening's clock, which play
  on every visit)". Source: Ruben Stom notes, video 4: "Loading / intro ... keep it to a few seconds; first
  visit only; skip it on information sites". He means a loading screen.
- **19. Decorations outside the menu.** NEEDS A WHEN. 3ai.1 already counts "anything added for looks", so the
  older effects are counted; the lines just do not say so. 3u.6 (cut-out pieces on the first screen) and 3al.7's
  parallax (layers from one photo) are different things, and 3u.6 has its own when ("where the first screen
  shows separate pieces"). One line in 3ai.2's menu: "any other effect added for looks counts the same way
  (3u.6 to 3u.8, 3v.8, 3x.5, 3x.6, 3x.12, 3g.7)". Rules 3x.5, "the one cursor effect" becomes "a cursor
  effect". Source: 3ai is Tzvi, 20 Nov, "calm the site"; 3u.6 is the 29 Oct video m491R3ewNgE (beans at
  different speeds), "do them all"; 3x.5 is commit 63d107f5, 4 Nov, when it was the only one.
- **20. Right after the opening.** NEEDS A WHEN. Bramble shows them together: the dark film ends on the bottle,
  a lime band divides, the pale shop follows. So 3h.8's bold change is the new ground the film's last step
  turns into (3aa.11), and the kosher band can be that dividing band. Only the maker needs a phrase. Rules
  3s.12 and R3s.12, after "right after the opening": "or, when a film flows into the shop (3aa.11), right after
  the shop". Source: 3s.12 is the nine videos of 20 Oct; 3h.8 the PULP video, 16 Oct; 3aa.11 POUR / PLAY's
  last frame (the cup with the bags round it); Bramble's sheet opened.
- **22. The Shop page.** NEEDS A WHEN. 3ah.3 already carries it ("four or more products"), and its featured
  item beside the title is 3k.1's stage. Rules 3k.1, after "one item at a time on a stage": "with four or more
  products, the featured item on the stage and the rest as cards (3ah.3)". Rules 3ag.2, "then its choices" gets
  "in its sheet (3ah.2)". Source: 3k.1 is Tzvi's product-page recordings, 20 Oct ("The product IS the page,
  one at a time", shops with a few items); 3ah.3 is the Baked Fresh shop, 20 Nov (rows of cards under one big
  photo). Two kinds of shop.
- **24. Live art as an opening.** NEEDS A WHEN. Both hold when the art sits behind the words on the photo's
  plain side. Rules 3ah.8, after "live art in code (3ak.1)": "behind the words on the plain side; the photo
  keeps its 70% (3h.1)". Source: `cwai-flow-field-hero.png`, opened: the art fills a hero with no photo, so
  as an opening of ours it has to share the screen.
- **25. "Generate the film first".** NEEDS A WHEN. The intent, one master per item, is unchanged; only the word
  "film" is out of date, and it applies only when the owner has no photo of the item. Rules 3h.12: "Generate the
  film first and the item pictures from its final frame" becomes "When the owner has no photo of an item, make
  the film's end still first and the item pictures from it". Source: commit 660bb56a, 18 Oct, Chicken Munch
  (Tzvi: "the poppers ... look different than when choosing each type").
- **27. Two touches on the 3bb menu.** NEEDS A WHEN. Bramble's "02 - Let the good stuff fall" is a named
  chapter of a film, not the bare "01/06" section counter that 5b.6 bans. Rules 3bb.23, add "in a film's
  chapters, with the chapter's words". The start button (BMW) is a laptop touch: 3bb.24, add "on a laptop; a
  phone opening plays by itself (3ac.1)". Source: commit 25671798, 13 Nov (Tzvi: "add all these subtle
  additions"); Bramble's sheet opened, BMW's frame not opened.
- **28. A reversed clip.** NEEDS A WHEN. Section 8 bans faking an action by reversing its opposite (a wrap
  played backwards as an untying). 3h.16 plays one real action forward and then back with the scroll. Rules
  3h.16, add: "for the way back of the same action only; the action itself is always generated in its real
  direction (section 8)". Source: section 8 is Tzvi, 13 Oct, The Gift Boutique's ribbon; 3h.16 is Chicken
  Munch, 18 Oct, whose approved steps were "3 blasts apart, 4 flies back together".
- **8. The owner approves every piece.** NEEDS A WHEN. The line was written for the automatic builder, where
  the owner picks a version and presses Publish, so the owner is the approver there. On a hand build Tzvi
  approves. Rules section 8: "The owner approves every piece before it can be used" gets "in the automatic
  builder; on a hand build Tzvi approves each on the design board". R8.3: "the owner approved every piece"
  becomes "approved (Tzvi on the board)". Source: commit 6b8dfe33, 23 Sep, "AI media is enhanced-from-theirs
  ... owner confirms", the same day as "Nothing the AI makes goes live on its own".
- **23. Grounds.** NEEDS A WHEN. 3i.5 is about a choice colouring its own section, not a new ground for every
  section. Rules 3i.5, after "each section's ground matches its product": "the product chosen there; the home
  page still keeps 3ag.3's three grounds". Source: commit 7ec1a3b8, 16 Oct, "The Brown Box: the chosen bowl
  colours its section"; 3ag.3 is Tzvi, 19 Nov, on Tova's six grounds.

### The 2 withdrawn

- **42. Two digest clauses.** NOT A CONFLICT. "Category and atmosphere tiles only" is about sets made from
  words alone, which is what the rulebook says too ("Product pictures are edited from their own photo"). The
  footer line belongs to the automatic builder's rules.
- **43. Who writes the blueprint's answers.** NOT A CONFLICT. The CLAUDE.md sentence sits in the paragraph about
  ads and means the ad blueprint.

### The 9 "Tzvi's call" items, one line each

| Finding | Now | Why |
|---|---|---|
| 3 | NEEDS A WHEN | the item whole, its surface may run off (the Burnt picture) |
| 4 | NEEDS A WHEN | advert picture, shop card and opening still are three pictures |
| 8 | NEEDS A WHEN | written for the automatic builder, where the owner publishes |
| 17 | not a clash of rules | the digest's numbers differ from the rulebook's; the fix stands |
| 19 | NEEDS A WHEN | 3ai.1 already counts them |
| 20 | NEEDS A WHEN | only the maker's place needs a phrase (Bramble) |
| 24 | NEEDS A WHEN | art on the plain side, photo keeps 70% |
| 27 | NEEDS A WHEN | film chapters and laptops |
| 43 | NOT A CONFLICT | the sentence is about ads |

---

Not re-reported, as decided today: labels (3ag.5 and 5b.6), B5 on laptops only, the opening type per business
(3ah.8), the optional owner note (3af.2), the 3al.7 menu, Krysp and Aaron spared. Finding 26 lists three lines
those decisions left behind.

---

## 1. ORDER. Film yes or no, and the chosen idea, are fixed before Tzvi picks

- SKILL phase 0: "`--has film=yes|no <build>`". SKILL phase 3: "Start CONCEPT.md: the category, the chosen idea
  and why". Rules 0b.4: "When an idea is chosen, write `## Chosen: <letter>` and add its kind to motions.json".
- SKILL phase 4 and rules 3ah.8, 3aj.2: the three first screens are "three different opening types" (a staged
  product, a light reveal, a split opening, a film) and Tzvi picks.
- Problem: whether the site has a film, and which idea is chosen, are both his pick in phase 4 (and the film's
  story is his pick of a sketch row in phase 5). The builder is told to decide both earlier. With `film=no`
  the blueprint never reads the film rules; with a chosen idea the three screens become three versions of one
  idea, which 3ah.8 bans.
- Fix, SKILL phase 0: after "`--has film=yes|no <build>`" add: "Answer yes when any idea could be a film. It is
  set for good after his pick of the first screen."
- Fix, SKILL phase 3: old "Start CONCEPT.md: the category, the chosen idea and why, the `- avoids:` line." New
  "Start CONCEPT.md: the category and the `- avoids:` line. The three strongest ideas go forward as the three
  first screens; none is chosen yet."
- Fix, SKILL phase 4 gate, add: "Then write `## Chosen` in IDEAS.md and CONCEPT.md, add its kind to
  `scrollcraft/motions.json`, and set `--has film=yes|no` to match his pick."

## 2. ORDER. Five parts of the film brief that the film gate demands belong to no phase

- `scripts/hooks/film-gate.mjs` refuses a paid clip unless the brief has "## How it really happens" (3h.21.1),
  "## Key moment" (3h.21.2), "Enough:" (3aa.31), "## Looks real" (3w.15) and "## Clip plan" (3w.10.5).
- SKILL phase 5 lists only "the sketch sheet ... the motion as numbered steps ... every object's source and end
  ... the scroll timeline ... how phones get the film". Phase 6 and phase 8 name none of the five.
- Problem: they surface when the gate refuses, in phase 8, after Tzvi approved the stills and they were paid
  for. Two of them change the stills: the key moment "gets its own clip between its own before and after
  stills", and "Enough" changes how much of a thing is in the picture.
- Fix, SKILL phase 5, in the film list after "(rules 3h.18)": add "how it really happens, from a real
  reference, and the key moment with its own clip (rules 3h.21); the Enough line (3aa.31);".
- Fix, SKILL phase 6, after "then read the picture's `Skip:` line again against the still": add "A generated
  place or material is put beside its real photograph (`## Looks real`, rules 3w.15). Then write the brief's
  `## Clip plan` from the finished stills (rules 3w.10)."

## 3. CONTRADICTION. The product is "whole" in five rules and "running off the frame" in one

- Whole: rules 3aa.8 "its object whole and large in the middle"; 3h (smooth) 4 and R3h.20 "keeps the product
  and photos whole"; 3aa.21 "nothing the film is about ... touches or crosses an edge"; 3ag.4 and R3ag.4 "the
  product whole"; 3ah.8 "the product whole on one side".
- Running off: rules 3aa.33.1 "Close, running off the frame ... at least one corner or edge runs out of the
  frame", repeated in the digest and R3aa.33 ("close").
- Problem: 3aa.33 applies to "any business whose opening shows a thing", so every product opening is asked for
  both. This is the exact fault Burnt hit (the close-up, then the whole board back in view).
- Fix (Tzvi's call; default keeps his approved Burnt framing). Rules 3aa.33.1, old first two sentences. New:
  "**Close.** The camera is near and the product fills most of the width. On a large flat product (a board, a
  tray, a table) a far corner or edge may run out of the frame. The part the step is about, and everything
  3aa.21 names, stays whole."
- Rules 3aa.8, add at the end: "On a shot made to 3aa.33, whole means the hero part and what the step is
  about; a far edge may leave the frame."
- R3aa.8: "shows its object whole and large" becomes "shows its object large, the part the step is about
  whole (a far edge may leave the frame under 3aa.33)". R3ag.4 and 3ah.8: after "the product whole" add
  "(3aa.33.1 aside)".

## 4. CONTRADICTION. Four rules say how a product is photographed, and they disagree on props, light and angle

- Rules section 8, "The product hero shot", and R8.6: "Every main product picture (a hero, a size or flavour
  photo, a product card)" stands on a plinth with "its own ingredients around it", "a warm key light", "eye
  level". R8.8: "two to four props ... never one lonely prop".
- Rules 3ag.1 and R3ag.1: "One plain ground, one soft light, nothing round the product", and "All of a site's
  photos are re-lit to the same ground and light".
- Rules 3aa.33.2 and .3: "about 20 to 40 degrees above the surface", "One hard light from one side ... Never
  soft even light". Rules 3w.4: "one large soft light from the side". Rules 3h.11: "bright, warm, soft light
  ... never 'dark', 'black' or 'moody' as the default", against 3aa.33.5 "the ground goes quickly to near
  black".
- Problem: a product card cannot have props round it and nothing round it. A builder obeying the older line
  fails the newer one, and both are checklist lines every new site answers.
- Fix: one scope sentence at each home (Tzvi's call on the split; default below).
  - Rules section 8, first line under "The product hero shot": "Since 19 Nov 2026 this is for the styled shot
    of 3ag.1 (the opening picture, the showpiece's pictures, a photo that cannot reach a 5 re-lit) and for
    size or flavour sets. A shop-ready or re-lit photo on a product card follows 3ag.1: plain ground, nothing
    round it. An opening still follows 3aa.33 for camera and light."
  - R8.6: "Every main product picture is a product hero shot" becomes "Every styled shot (3ag.1) and size or
    flavour picture is a product hero shot". R8.8: "Each product picture in a set" becomes "Each styled
    product picture in a set".
  - Rules 3h.11, add: "A staged opening still of a product follows 3aa.33 (one hard side light, the ground
    falling off); this item is for films and every other generated still." Rules 3w.4, add "(food in a film;
    a staged product still is 3aa.33)".

## 5. CONTRADICTION. Words on the film: small at an edge, or huge behind the object

- Small or off the film: rules 3h.5 and R3h.5 "small, at an edge"; 3h.9 "at most a third of the screen's
  height"; 3h.17 and R3h.25 "cover at most 3% of it ... wait for its end or sit beside or under it"; 3i.8
  "beside the subject, never on it"; 3al.3 "never words in the video"; section 8 and R8.3 "no text baked into
  an image".
- Huge and inside the picture: rules 3aa.5 and R3aa.5 "one or two huge words ... never small labels"; 3aa.9
  and R3aa.9 "huge, nearly the frame's width, behind the object ... set into the still in code".
- Problem: R3h.5 and R3aa.5 are both lines of the Opening stage, so one film site must answer "pass" to
  opposite rules. A step word set into the still is also a word in the video (3al.3) and text in an image
  (R8.3). If the clip bends the letters, 3aa.9 puts the word "in code in front of the film", which R3h.25
  then fails.
- Fix. Rules 3h.5, add: "On a film built to 3aa (since 12 Nov 2026) the step words follow 3aa.5 and 3aa.9
  instead of this item." R3h.5, add "; n/a for a film whose words follow R3aa.5 and R3aa.9".
- R3h.25, add: "(a step word set into the still behind the object, 3aa.9, is part of the picture and is not
  counted; a word laid over the film in code is)".
- Rules 3al.3: "the headline and copy stay real HTML text, never words in the video" becomes "the headline and
  anything a visitor must read to order stay real HTML text; the step words of 3aa.9, set into the stills in
  code, are the one exception". R8.3: "no text baked into an image" becomes "no text painted by the image
  model (3aa.9's words are set in code)".

## 6. CONTRADICTION. Higgsfield through the MCP connection, or through the API only

- Rules section 8, twice: "the MCP connection while building, the API when it refuses". Digest section 1:
  "(MCP while building, API if it refuses)".
- Digest section 0: "Higgsfield, through the API only (Tzvi, 2 Nov 2026; the hook ... refuses a paid call
  through the MCP connection)". SKILL Tools: "through the API only". Rules 3x.1: "Higgsfield API rule".
- Problem: the older text tells a builder to start with the route the hook blocks.
- Fix: in all three places replace the quoted words with "through the API only (2 Nov 2026)".

## 7. CONTRADICTION. Tzvi "says yes four times", but other lines ask him more often

- SKILL: "He says yes four times" and the table's "0 to 3 | free | none". Digest section 0: generated "without
  asking ... the spend goes in the report".
- Rules 3g.15 (and digest 3g.15): "The cost is told to Tzvi before each generation". Rules 3x.7: BRAND.md
  "written and shown to Tzvi before any picture is generated". Rules section 8, right the first time, 7: "Then
  show Tzvi the pair". Rules 0b.3: "List every live-site action ... and ask for all of them in one go", while
  SKILL phase 1 says "load the products" inside a phase marked "none" (the project CLAUDE.md asks for his OK
  before any write to the live database).
- Problem: a builder either stops for approvals the phases say are not needed, or skips ones the rules still
  ask for. The live-site write is the costly one to get wrong.
- Fix. Rules 3g.15 and digest 3g.15: old sentence becomes "The price is read with get_cost before each
  generation and the spend goes in the report (standing OK, 4 Nov 2026); Tzvi is asked first only for
  something unusually expensive."
- Rules 3x.7: "written and shown to Tzvi before" becomes "written before"; add "He sees it at work in the
  three first screens."
- Rules section 8, point 7: "Then show Tzvi the pair." becomes "The pair goes on the design board."
- SKILL phase 1: take "and every live-site write the build needs" out of the owner's message and add a
  sentence: "List every live-site write the build needs (loading products, delivery settings) and ask Tzvi for
  all of them in one go before the first one (§0b.3)." SKILL table: "0 to 3 | free | none" becomes "0 to 3 |
  free | none, except his OK to the live-site writes in phase 1".

## 8. CONTRADICTION. "The owner approves every piece" has no place in the phases

- Rules section 8, policy: "The owner approves every piece before it can be used." R8.3: "the owner approved
  every piece".
- SKILL: the owner gets one message in phase 1 and "The owner's video comes last, from the live page" in phase
  11, after publishing. Rules 0b.11 says the same.
- Problem: every new site with a generated picture must answer R8.3 "pass" to something that never happened.
- Fix (Tzvi's call; default follows how builds really run). Rules: "Tzvi approves every generated piece on the
  design board before it is used. The owner sees them in the finished site, and any piece they turn down is
  replaced with their own photo." R8.3: "the owner approved every piece" becomes "Tzvi approved every piece on
  the board; anything the owner turned down was replaced". The other choice: add to SKILL phase 10 "the owner
  is sent the generated pictures before publishing".

## 9. CONTRADICTION. category-mistakes lists as "AI defaults" several things the rules require

- `docs/category-mistakes.md`, every kind: "a four-column footer", "a gallery, FAQ", "product cards", "three
  numbered 'how it works' steps", "the business name set huge to close". fashion-shop: "A beige ground with a
  thin serif", "Size and colour choices hidden until the product page". trainer: "Three pricing tiers with the
  middle one 'most popular'".
- Rules 3v.1 and R3v.1: the full footer in four parts "on every page, the same on each". Rules 3m.1: "A
  gallery on every designed page". Rules 3ag.2: every product a card. Rules 3t table: fashion-shop "White or
  beige throughout ... thin serif ... a 'how it works' strip"; events "a giant name in the footer"; service
  "numbered steps"; trainer "3 to 4 offer cards". Rules 3g.7: the closing name set huge. Rules 3ah.2: choices
  "live in the item's sheet". Rules 3j.6: the middle option "shown as the natural pick".
- Problem: both files are read in phase 2 and both feed a gate (check-site CATEGORY and R3t.1; check-concept's
  `- avoids:` line, which must say "how this site avoids each"). A builder cannot avoid a footer it must build.
- Fix, category-mistakes, new paragraph after "A new kind gets its own part": "What the rules ask of every
  site stays asked: the full footer (3v.1), the gallery place (3m.1), product cards (3ag.2), the FAQ when the
  owner sends one, the category's own ground and type (3t). The mistake is the default form of each. The
  `- avoids:` line says what this site does differently inside them."
- Reword four lines there: "a four-column footer" becomes "a footer that is only link columns, with nothing of
  theirs in it"; "Size and colour choices hidden until the product page" becomes "Nothing on the card says
  which sizes and colours exist (3l.2); the choosing itself is in the sheet (3ah.2)"; the beige line gets ",
  with nothing else of the brand's own"; the trainer line gets "when the owner never said so (3j.6)".
- Rules 3g.7, add: "It is one of the defaults in docs/category-mistakes.md: use it only when neither of the
  two sites built before closes that way." Rules 3t, fashion-shop cell: 'a "how it works" strip and FAQ'
  becomes "how ordering and returns work, under headings that say the benefit (3ab.1), and the FAQ when the
  owner sends one".

## 10. ORDER. The phase 7 gate cannot pass as written

- SKILL phase 7 gate: check-build "passes every line except `independent review`, `check-compared` and, with a
  film, the film checks".
- `scripts/blueprint.mjs --rules` writes `todo` for every line not yet built, and check-rules fails on any
  `todo`. At phase 7 the lines of the clips, the judging, the report and the publish are all still `todo`.
- Problem: the gate is unreachable, so it will be waved through by judgement, which is what gates are for
  stopping.
- Fix: after "`check-compared`" add ", `check-rules` (its only `todo` lines are those of the clips, the
  judging, the report and the publish)".

## 11. ORDER. Four plan lines are first checked by a script at the judging

- `scripts/check-compared.mjs` holds NOFIVE (R3ah.7: "before any idea"), SHOWPIECE (R3ah.5), TREATMENTS
  (R3ai.1) and MOTION (R3e.28, R3al.4). All four are written in phases 2 and 5.
- SKILL names the script only in phase 9; the phase 7 gate skips it by name.
- Problem: a missing `## Why they are a 5`, a fourth decoration or a motion line without numbers is caught
  after the site and the clips are built. The script already prints each fault under its own label, so it can
  be read early.
- Fix, SKILL phase 2 gate, add: "and `node scripts/check-compared.mjs <build>` prints no NOFIVE line (its
  other lines wait for the judging)". SKILL phase 5 gate, add: "`check-compared.mjs` prints no SHOWPIECE,
  TREATMENTS or MOTION line."

## 12. ORDER. Checklist section 8b puts order-form, first-screen and film-look rules in the last stages

- `blueprint.mjs` ORDER is `1, 6, 5, 2, 3, 8c, 4, 7, 8, 8b, 9`, so section 8b is stage 10, planned in phase 7
  ("Plan the last stages first").
- Section 8b holds R3u.2 and R3u.3 (the order form, built in phase 1), R3u.5 to R3u.8 (the first screen's
  arrival, depth, rotating word and label, decided in phase 4), R3u.9 and R3u.10 (sections, phase 5), and
  R3w.1, R3w.2, R3w.3 and R3w.7 (how generated food and places must look), which carry no `when:film`, so
  `--check <build> film` does not read them either.
- Problem: these are planned after the form is built, the first screen picked and the stills paid for.
- Fix, checklist: move R3u.2 and R3u.3 to "6. Order and booking flow"; R3u.5, R3u.6, R3u.7, R3w.1, R3w.2,
  R3w.3, R3w.4, R3w.5, R3w.6 and R3w.7 to "2. Opening"; R3u.8, R3u.9 and R3u.10 to "3. Sections and worlds".
  Leave R3u.11 to R3u.14 and rename 8b "Build habits and report". Ids do not change, so no live site's
  RULES.md is touched. Then `node scripts/blueprint.mjs --order` and `node scripts/check-rule-homes.mjs`.
- Rules 0b.0 also lists the stages without this one: after "motion, phone," add "order details and report,".

## 13. ORDER. check-concept wants all five wow answers at the page plan; the fourth exists only at the judging

- `scripts/check-concept.mjs`: "Wow gate: N of the 5 answers". It is in the SKILL phase 5 gate.
- Rules 3n.4: "the answer names compare.jpg and the rating". SKILL phase 9: "Finish the wow-gate answers".
- Problem: to pass the phase 5 gate the builder must write a fourth answer about a sheet and a rating that do
  not exist yet.
- Fix, rules 3n.4 and digest 3n.4, add: "With the page plan the answer names the two sites it will be compared
  with; compare.jpg and the rating are added at the judging." SKILL phase 5, after "Write `## Effects` with its
  `- touch:` line (§3p).", add: "Write the five wow answers (§3n); the fourth names the two sites and is
  finished at the judging."

## 14. ORDER. The comparison and the judges come after the largest spend, and score motion from pictures

- SKILL: clips are phase 8, "paid, the largest". `compare-sheet.mjs`, `## Compared` and the two judges are
  phase 9.
- Rules 3aj.4: the judges "are given only the pictures and the scale" and score "motion". The preview video
  and its contact sheet are made in phase 10.
- Problem: a fault in layout, light or colour found in phase 9 can mean new stills and new clips. Motion is
  scored from a still sheet. And the reviewer runs before the judges, so a judge's change needs a second
  review (review.md must be "dated after the site's last change").
- Fix, SKILL phase 7 gate, add: "Then `compare-sheet.mjs` and `## Compared` on the site with its stills; fix
  what it shows before the film goes in." SKILL phase 9: start with "Record the preview with
  `scripts/record.mjs` and look at its contact sheet", put the two judges before the reviewer, and keep
  compare-sheet only "again if the page changed". Phase 10 then sends the video already made.
- Rules 3aj.4: "They are given only the pictures and the scale" becomes "They are given compare.jpg, the
  preview video's contact sheet for the motion score, and the scale".

## 15. ORDER. Phase 3 writes two things that depend on later picks

- SKILL phase 3: "Write the look into `scrollcraft/fingerprints.json`" and the gate "`check-fingerprints.mjs
  <build>` pass". The script fails without an id for every effect kind (button, link, tile, reveal, steps,
  price, heading), and the look's hero, signature and layout. Those are decided by the first-screen pick
  (phase 4) and the page plan (phase 5, where `## Effects` is written).
- SKILL phase 3 also writes BRAND.md with the shop's button colour "taken from its photo" (3g.19). The page's
  photo is re-lit or restyled in phase 6, and check-button-colour fails "a colour that is under 1% of the named
  photo".
- Problem: both are guessed, then redone.
- Fix, SKILL phase 3: "Write the look into" becomes "Write the fonts and colours into"; add "Its hero, layout
  and effects entries are finished with the page plan." Gate: "`check-fingerprints.mjs` shows no font or
  colour clash (its EFFECTS lines wait for the page plan)". SKILL phase 5 gate, add "`check-fingerprints.mjs`
  passes in full".
- SKILL phase 6, after the product-match sheet: "Run `check-button-colour.mjs --suggest` on the picture the
  page will use, and correct BRAND.md and the meta if the colour moved."

## 16. ORDER. Two blueprint checks sit on the wrong side of the thing they plan

- SKILL phase 4 gate: "Then plan the Opening stage: `--check <build> 4` passes." The Opening stage holds the
  film lines (R3aa.10, R3aa.15, R3h.2 and others), and the film's story is picked in phase 5.
- SKILL phase 6: "Plan the Photos stage: `--check <build> 7`" comes after "Only now are pictures paid for".
- Problem: rules 0b.0 says the plan is written "Before building a stage". The first is planned before its
  story exists, the second after its pictures are paid.
- Fix: delete the phase 4 sentence (the phase 5 gate's `--check <build> 6` already covers stage 4). Move the
  phase 6 sentence to the start of phase 6: "Plan the Photos stage first (`--check <build> 7`). Only then are
  pictures paid for:".

## 17. REPETITION. The digest and the rulebook give the same number to different rules

- Digest line 53: "Section numbers are unchanged, so '3g.13', '3h.11' and the like still point to the same
  text." Not so for seven sections: digest 1 is rules 2; digest 2 is rules 5; digest 3 is rules 3b; digest 3b
  is rules "3 (cont.)"; digest 4 is rules 5a, 5b and 8; digest 5 is the table in rules 3a; digest 6 is rules
  3a. Digest 3e folds rules 3e.1 to 3e.25 into ten items.
- So "3b.4" is the FAQ in SKILL phase 1 ("FAQ ... (§3b.4)") and "few photos, facts carry the page" in the
  checklist (R3b.4). "3b.3" is the CTA section in the digest and "one solid action per screen" in R3b.3.
- Problem: BLUEPRINT.md lines cite the rulebook's numbers; a builder who opens the digest at that number reads
  another rule.
- Fix (smallest): replace the digest sentence with "From 3c on, section and item numbers match the full
  rulebook. Seven do not: digest 1 is rules 2; 2 is rules 5; 3 is rules 3b; 3b is rules 3 (cont.); 4 is rules
  5a, 5b and 8; 5 is the table in rules 3a; 6 is rules 3a. Digest 3e groups rules 3e.1 to 3e.25 into ten
  items. The checklist and BLUEPRINT.md always use the rulebook's numbers."
- Better (Tzvi's call): rename those seven digest headings to the rulebook's numbers and change SKILL's
  citations to match (phase 1 "§3b.4", phase 7 "§1 ... §2 ... §3, §3b ... §4 ... §5", phase 9 "§6").

## 18. CONTRADICTION. "Intro" means three things, and one rule limits it to the first visit

- Rules 3al.8 and R3al.8: "An intro plays on the first visit only and lasts a few seconds."
- Rules 3aa.29: `kit.opening_slides(intro=<seconds>)` plays the first clip on arrival, and check-iphone fails
  "an opening with no `data-intro`". Rules 3ac.1: on a phone the opening runs "on a clock that starts when the
  page has loaded". Rules 3u.5 and 3ah.8: the first screen's arrival, "once".
- Problem: read literally, 3al.8 switches off the film's first event and the phone opening on a second visit,
  which check-iphone and check-phone-opening then fail.
- Fix, rules 3al.8 (and R3al.8's first clause): "An intro is a screen shown before the page itself (a name or
  logo reveal, the split opening of 7). It plays on the first visit only and lasts a few seconds. The
  opening's own arrival (3u.5, 3ah.8), a film's first event (3aa.29) and a phone opening's clock (3ac.1) are
  not intros: they play on every visit."
- Rules 3e.16c, moment (1), add: "(the order and length are 3u.5's; a film opening follows 3aa.29)".

## 19. CONTRADICTION. Decorations outside the menu still read as rules, or are not counted

- Rules 3ai.1: "three decorations at most ... anything added for looks". Rules 3ai.2 lists the menu.
- R3u.6: "Depth on laptops: separate pieces on the first screen move at their own speeds", n/a only "if the
  first screen has no separate pieces", so it is required where pieces exist. Rules 3al.7 puts "layered
  parallax" on the menu as "never required".
- Not on the menu and silent about the count: R3u.7 (rotating word), R3u.8 (tilted label), R3v.8 (seven
  effects, "within the budget of 3h.20"), R3x.5 (following light), R3x.6 (sentence that lights up), R3x.12
  (progress line), R3g.7 (closing signature), rules 3i.6 and 3i.10.
- Rules 3x.5 "the one cursor effect 8a.4 allows" and 8a.4 "the laptop-only depth of 3u.6 is the one allowed
  kind" are no longer true beside 3al.7's custom cursor and parallax, 3v.8's light on the cards and 3bb.12.
  Rules 3x.5 and 3al.7's "cursor flashlight" are one effect with two conditions ("whose own world is dark",
  "whose story is light or mood").
- Problem: a site can pick three from the menu and add six more "allowed" effects, which is the busy page 3ai
  was written against.
- Fix (Tzvi's call; default: they count). Rules 3ai.2, add a menu bullet: "depth on laptops (3u.6), the
  rotating word (3u.7), the tilted label (3u.8), the effects of 3v.8 to 3v.16, the following light (3x.5, the
  same thing as 3al.7's cursor flashlight), the sentence that lights up (3x.6), the progress line (3x.12),
  floating cut-out tiles (3i.6), the floor line (3i.10) and the closing signature (3g.7)".
- R3u.6 becomes "A choice (3ai.2): when picked, separate pieces on the first screen move at their own speeds
  ...; n/a when not picked". Add "counts as one of 3ai's three, named on the treatments line" to R3u.7, R3u.8,
  R3v.8, R3x.5, R3x.6, R3x.12 and R3g.7.
- Rules 3x.5: "This is the one cursor effect 8a.4 allows" becomes "One of the pointer effects a site may pick
  (3al.7 lists the others)". Rules 8a.4: "(the laptop-only depth of 3u.6 is the one allowed kind)" becomes
  "(only a treatment picked from the menu of 3ai.2)".

## 20. CONTRADICTION. Four rules each claim the place right after the opening

- Rules 3aa.11 and R3aa.11: the film's last step "turns into the next section's ground ... and that section is
  the shop". Rules 3w.14: "The film's last frame is the next section's picture". Rules 3aa.3: "the film's
  ground is the page's ground".
- Rules 3s.12 and R3s.12: "The maker and their real work right after the opening". Rules 3b (food): the kosher
  band "just after the opening". Rules 3h.8 and R3h.8: "The section after the opening changes the mood boldly
  (after a lit film, a bold colour block)".
- Problem: on a food site with a film all four are asked, and a bold colour block cannot also be the film's
  own ground.
- Fix (Tzvi's call). Rules 3aa.11, add: "The order after a film: the film flows into the shop on the same
  ground; the kosher band (3b) is a strip at the top of that section; the maker (3s.12) comes next and takes
  the bold change of ground 3h.8 asks for." Rules 3h.8 and R3h.8: "The section after the opening" becomes "The
  first section after the shop the film flows into (3aa.11)". Rules 3s.12 and R3s.12: add "or, after a film,
  after the shop section it flows into".

## 21. CONTRADICTION. Three numbers for type and fonts disagree

- Text sizes: rules 3e.14, R3e.14 and digest 3e.6 "at most six text sizes"; rules 3x.13 and R3x.13 "at most 10
  text sizes on a page" (the script's limit).
- Font families: rules 3x.8 and `check-web-basics.mjs` "at most two font families" (it fails a third); rules
  3g.1, R3x.7, digest 3g.1 and digest 3d "two fonts plus at most a third for one label style".
- Accents: digest 3d "up to three accents and four quiet touches"; rules 3f.2 "No number of accents is asked
  (changed 22 Nov 2026)".
- Fix. R3e.14, rules 3e.14 and digest 3e.6: "at most six text sizes" becomes "text sizes from the one scale of
  3x.13". Delete "at most a third for one label style" in rules 3g.1, R3x.7, digest 3g.1 and digest 3d (the
  script already refuses it). Digest 3d: "one bold moment, up to three accents and four quiet touches" becomes
  "one bold moment; no number of accents is asked (3f.2); three decorations at most (3ai)".

## 22. CONTRADICTION. Three descriptions of the Shop page and the product card

- Rules 3k.1 and digest 3k.1: the Shop is "one item at a time on a stage ... switching items crossfades".
- Rules 3ah.3: "A shop opens on its products ... three or four to a row", built with
  `shop_page(..., featured=True)`. Rules 3ah.2: a card is its photo, then name, price and one line.
- Rules 3ag.2: "the photo, then the name and price, then its choices", against 3ah.2 "choices live in the
  item's sheet ... never as rows of buttons on the card". Rules 3ag.2 asks 200 px, 3ah.3 asks 240 px.
- Fix. Rules 3k.1 and digest 3k.1, old sentence from "The Shop is built as a product page" to "switching items
  crossfades;" becomes: "The Shop opens on its products (3ah.3, `shop_page(featured=True)`): one big photo of
  the popular item beside the title, then the product cards (3ah.2). A business with one to three products may
  keep the one-item stage of docs/inspo/product-pages-2026-10-20;".
- Rules 3ag.2: "then its choices" becomes "its choices are in the sheet (3ah.2)", and after "200 px wide at a
  laptop" add "(240 on a shop page, 3ah.3)".

## 23. CONTRADICTION. Two grounds for the page, or a colour for every section

- Rules 3ag.3 and R3ag.3: "The home page's sections use two grounds, three at most".
- Rules 3i.5 and digest 3i.5: "One colour family per section ... each section's ground matches its product
  (peach, red, cream) instead of one tone all the way down". Rules 3bb.1 and 3bb.33 offer the same.
- Fix. Rules 3i.5 and digest 3i.5 become: "Colour follows the product inside the chooser or stage (3i.2,
  3n.3), never as a new ground for every section: the sections use two grounds, three at most (3ag.3), and one
  or two bold bands reset attention." Rules 3bb.1, add "(inside the opening or a chooser; the sections keep
  3ag.3's two grounds)".

## 24. CONTRADICTION. Live art is offered as an opening type, but the opening must be a photo

- Rules 3ah.8 and R3ah.8 list "live art in code (3ak.1)" among the opening types.
- Rules 3h.1 and R3h.1: the opening is "at least 70% picture" (check-site OPENING). Rules 3ah.1: "on one
  photo". Rules 3ak.1: live art is "never on the product photo".
- Fix, rules 3ah.8 and R3ah.8: "live art in code (3ak.1)" becomes "live art in code round the photo (3ak.1;
  the photo still fills 70% of the screen, 3h.1)". Or drop it from the list of opening types and leave it on
  the menu only.

## 25. CONTRADICTION. "Generate the film first" against the new order

- Rules 3h.12: "Generate the film first and the item pictures from its final frame, not the other way round."
  Digest 3h.12: "Film first, item pictures from its last frame."
- SKILL: pictures are paid in phase 6, clips in phase 8.
- Fix, rules: "Make the film's end still first (3al.1) and the item pictures from it, never the other way
  round; no clip is needed for this." Digest: "The film's end still first, item pictures from it."

## 26. CONTRADICTION. Three lines left behind by today's decisions

- Owner note. Rules 3af.2 still opens "A short note ... (three sentences or so, asked of them ...)", and
  R3af.2's HOW is "LOOK: `message-to-owner.md` asked for it", while the same line says "owners are not asked".
  Fix: "asked of them" becomes "offered by them"; the HOW becomes "LOOK: the note's words against what the
  owner sent; n/a when no note was offered".
- Labels. Rules 3ab.1: "A small label above a heading may name the section; the heading itself may not."
  3ag.5 now allows a label "only where it adds a fact". Fix: "A small label above a heading is allowed only
  where it adds a fact (3ag.5); the heading itself is never a section label."
- Offers. R3g.18 and rules 3g.18's second bullet: "each named in the headline or big words". Rules 3ah.1 moved
  them to "the line directly under it". Fix: "each named in the headline or the line directly under it
  (3ah.1)".

## 27. CONTRADICTION. Two touches on the 3bb menu are banned elsewhere

- Rules 3bb.23 (and the digest's list): "Chapter counter in the corner ... '02 - Let the good stuff fall'".
  Rules 5b.6, R5b.6, 3i.3 and category-mistakes: no "01/06" counters.
- Rules 3bb.24: "A start button as the gate ... the screen waits for a press". Rules 3ac.1: on a phone the
  opening "plays by itself"; 3h.20: nothing "between a phone visitor and the products".
- Fix: delete 3bb.23, or add "(a film's own chapters only, never a section counter, 5b.6)". 3bb.24: add
  "(laptops only; a phone opening plays by itself, 3ac.1)", or delete.

## 28. CONTRADICTION. A reversed clip is "a free second scene" and also banned

- Rules 3h.16: "A clip played backwards is a free second scene ... Consider it on every film".
- Rules section 8, real physical process, 6 (and digest section 1): "Never a 'doing' clip played backwards to
  fake 'undoing'".
- Fix, section 8 point 6, add: "The one use of a reversed clip is 3h.16: the same motion taken back by the
  scroll (explode, then fly back together)." Rules 3h.16, add: "Only for a motion that truly runs backwards;
  never to stand for a different action (section 8)."

## 29. REPETITION. "One study a build" was added without removing the older "search for every piece"

- Rules 3g.17 keeps both: its first paragraph ("Before any section or effect is built: one Mobbin, one 21st
  and one Inspo search for that piece") and its third ("Every piece, not only every page ... each get their own
  search"), with "this one wins" between them.
- Rules 3c.1: "search every source we have: Inspo, Mobbin and 21st, each time" and "write down in CONCEPT.md
  which ones were used" (the checklist says REFERENCES.md is "their one home"). Rules 3e.24: "in CONCEPT.md".
  Digest 3c.1: "Search fresh for every piece on every build". Digest section 0: "Search 21st fresh on every
  build first". Rules 8a: "The library never replaces the search". Rules 3h.6 and 3c.1 name the sources
  without Pinterest (3aa.7 added it).
- Fix. Rules 3g.17: delete the third paragraph down to "or the library.", keep its last two sentences; in the
  first paragraph replace the quoted words with "The searches are run once a build (below)"; delete "Where the
  paragraph below asks for a search for every piece, this one wins."
- Rules 3c.1: first quote becomes "the one study of 3g.17 (Inspo, Mobbin, 21st, Pinterest and docs/inspo)";
  "in CONCEPT.md" becomes "in REFERENCES.md" there and in 3e.24 and digest 3c.1. Digest 3c.1 and digest
  section 0: the "search fresh" sentences become "One study a build: 3g.17." Rules 8a, add to that paragraph:
  "Since 22 Nov 2026 the search is the one study, and pieces other than the first screen, the showpiece and
  the product card may come straight from the library (3g.17)." Rules 3h.6: "search Mobbin, Inspo and 21st
  (and docs/inspo)" becomes "from the study of 3g.17".

## 30. REPETITION. Six rules each put something beside the main button

- Rules 3b.2 "Proof touches the main button"; 3c.6 "Under it, a row of up to three icons with the owner's real
  guarantees"; 3j.1 a guarantee "under or beside the main button"; 3j.3 a free taster "beside the main
  button"; 3v.14 "Three true facts right under the main button"; 3ab.4 a rating "beside the headline or main
  button"; 3g.13 trust "right under the button". Checklist: R3b.2, R3j.1, R3j.3, R3v.14, R3ab.4, R3c.3.
- Problem: 3c.6's icon row and 3v.14's three facts are the same thing in two shapes, and nothing says what
  wins when a site has a price, a certificate, a guarantee and a rating.
- Fix. Rules 3b.2, add (its home): "What sits under or beside the main button, in this order, and nothing
  else: the three facts of 3v.14 (the price, the certificate and the guarantee are among them when they
  exist), then the rating line of 3ab.4 when there is a real one. A free taster (3j.3) is the button's own
  words." Rules 3c.6 and digest 3c.6: the icon sentence becomes "Under it, the three facts of 3v.14."

## 31. REPETITION. "Signature" names three things with three counts

- One: the hard rule `signature` "At most one scroll section per page"; rules 5a.7 "one-idea, one-peak,
  one-signature"; section 9 "At most one signature section per page"; R5a.7; R3n.2 "One signature moment".
- Two or more: rules 3ad.1 and R3ad.1 "At least two sections ... on a `- signature:` line" (decided today that
  two stay). Plus "one showpiece" (3ah.5), which "may be one of the two".
- Also section 9 and R9.1 "A page without the right material stays still", against rules 3f.2 "One effect on
  an otherwise still page is a draft".
- Fix. Rules 5a.7, add: "Since 17 Nov 2026 'signature' is also 3ad.1's word for the two or more body sections
  shaped by the business's own data. Those are not peaks. One of them may be this peak, and one may be the
  showpiece (3ah.5)." R5a.7: "One signature idea and one peak per page; at most one signature scroll section"
  becomes "One peak per page, and at most one held scroll section that is it (R3ad.1's two signature sections
  are a different thing)". R3n.2: "One signature moment" becomes "The peak (R5a.7)". Section 9 and R9.1: add
  "(the automatic page builder; a hand-built site follows 3f.2)".

## 32. REPETITION. Checklist lines that check the same thing twice

Each pair below is answered separately on every new site. Merge by the checklist's own Retired procedure
(`- R<old> -> R<new> (date): why`), keeping the line that has a script.

| Keep | Retire into it | Same thing |
|---|---|---|
| R3k.9 (check-site SAVE) | R0b.13 | the order is saved before WhatsApp opens |
| R3k.7 (site FLOW) | R3s.25 | empty form says what is missing, total in the message |
| R3s.1 (site STATE) | R3e.9's state clause | hover and pressed states |
| R3aa.27 | R3al.1's first half | each clip lands on an end still made first |
| R3w.4 | R3h.19's "at most two tries" | no third roll |
| R3o.1 | R3w.1's 4 fps look | generated food watched frame by frame |
| R3al.4 (MOTION) | R3e.28's CONCEPT clause | the `- motion:` line |
| R3x.8 (check-web-basics) | R3s.19's second half | each page's own title, description and og tags |
| R3v.2 (check-menu) | R3k.2's "identical menu bar" | the same bar on every page |
| R3h.10 (motion) | R3n.3's script half | a choice changes the picture |
| R3aa.7 (check-references) | R3g.17's first half | the sources are searched once and named |
| R3aj.2, R3aj.3, R3aj.8 | R3q.1's "first screens, avoids, board and page plan lines" | the same CONCEPT lines |
| R3j.4 | R3c.7's "standing discounts need no date" | standing discounts |
| R3j.6 | R3c.5's "Most popular only when the owner says so" | most popular |
| R3a.5 | R3al.8's "parallax off on phones" | no parallax on phones |
| R3s.24 (site MEDIA) | R3al.3's poster clause | every video has a poster |
| R3ag.3 (check-look) | R3c.2's "at least one section on a contrasting ground" | grounds |

Where only a clause moves, shorten the retiring line; do not retire the id.

## 33. STALE. Five ids were retired today, but the rule text they came from was left as it was

- R3n.1 to R3h.1: rules 3n.1 and digest 3n.1 still say the photo "fills at least half of the first screen".
  Fix: add "(since 22 Nov 2026 the measure is 3h.1's 70% picture)".
- R3b.1 to R3ah.1 and R3v.14: rules 3b.1 and digest 3.1 still say "The first screen answers all four
  questions", and "The page goes to the owner only when all six ... pass". Rules "3 (cont.)" 1: "It still
  answers the four questions". Fix: add to 3b.1 "(answered since 22 Nov 2026 by the one statement of 3ah.1 and
  the three facts of 3v.14)".
- R3c.1 to R3aa.7: see finding 29.
- R3r.1 to R3r.3: rules 3r.1 and digest 3r.1 list five scripts as "all of them". Fix: "check-build runs every
  script on every page (3a)."
- R3t.4 to R3v.1: rules 3t still says "a real footer (a last big line, the button, link columns, contact)",
  while 3v.1 says the footer's link is "not a second solid button". Rules 3v.1 still says "says what R3t.4
  means". Fix: 3t becomes "the full footer of 3v.1"; delete the R3t.4 clause in 3v.1.

## 34. STALE. Sixteen places name a phase by its number, against the rule added the same day

- Rules, "How a rule is added", 2: "Name a step by what it does, never by its number ... build step and phase
  numbers change."
- Rules lines 553 (3e.16c "phase 5"), 2877, 2878 and 2883 (3ag.1 "phase 1", "phase 6", "the phase 1 note"),
  2902 (3ag.6 "phase 9"), 2954 (3ah.5), 2962 and 2966 (3ah.7 "phase 2", "phase 9"), 3005 (3ai.1), 3051
  (3aj.2 "In phase 4"), 3068 (3aj.4), 3144 (3ak.2), 3151 (3ak.3 "phase 3"). Digest: 3ag.1 "Marked in phase 1,
  paid for in phase 6", 3ai "phase 5", 3aj.2 "In phase 4".
- Fix: delete each "(phase N)"; the words beside it already name the step ("with the page plan", "at the
  review"). 3ag.1: "(phase 1)" and "(phase 6)" go, "in phase 1 each photo" becomes "at the first look each
  photo", "the phase 1 note" becomes "the first-look note". 3aj.2: "In phase 4, before" becomes "Before".
  3ah.7: "In the study phase (phase 2)" becomes "In the study".

## 35. STALE. Files the rules point to that are not in the repo

These four exist only as uncommitted files in the main checkout's folder (not ignored, never added), so a
fresh worktree of origin/main, which SKILL phase 0 requires, does not have them:

- `docs/inspo/subtle-touches-2026-11-12.md` (rules 3bb, digest 3bb: the list of the 29 touches).
- `docs/inspo/pinterest-touches-2026-11-12/` (rules 3bb.30 to 3bb.50: 22 picture paths) and
  `docs/inspo/pinterest-burnt-2026-11-18/` (rules 3aa.34). check-ideas refuses an idea that cites "a picture
  that does not exist", so no build in a worktree can use these touches.
- `scrollcraft/builds/burnt-meatboards/` (rules 3aa.9 `gen/fire_words.py` and `fire_wordpng.mjs`; 3aa.17
  `gen/fire_hero.py`; 3aa.33 `gen/fire_stills.py`; 3aa.34 `gen/fire/iron-close-vs-inspo.jpg`): four "worked
  example" lines lead nowhere.
- `docs/inspo/videos-2026-11-17/README.md` (category-mistakes, intro).

Also:

- `docs/build-brief-template.md`: rules 3a says "Builders start from" it. Last changed 25 Oct 2026; it sends
  the sources to CONCEPT.md and asks for "three numbered film" ideas, with no blueprint, board or phases.
- `gen/board/index.html` (SKILL, rules 3aj.8 "made from"): the starter has no template for it; each build
  writes it from nothing.
- Fix: commit the three inspo items and the Burnt gen scripts from the main checkout (files, not folders of
  frames), or point each line at a file that is on main; rewrite or retire the brief template (and its mention in 3a); add a board template to `scrollcraft/starter`
  or say in SKILL "written by the build".

## 36. STALE. Cross references that point at the wrong rule, or at none

- Rules 3ab intro and 3ab.4, R3ab.4, digest 3ab: "3c.2" (the AI look) should be 3b.2 (proof beside the
  button). Rules 3v.14 "(3.2)" should be 3b.2. Rules 3v.1 "(3.3)" should be 3b.3.
- Rules 3g.13 and R3g.13 "3t.3's big line"; rules 5b.2 and digest 2.9 "3t.4"; rules 5b.3, section 8 and R5b.3
  "3t.2": section 3t has had no numbered items since 22 Oct 2026. Fix: "3t".
- Rules 3af.2 and R3af.2 "1.1": there is no rule 1.1. Fix: "section 2".
- Rules 3ae.2 "(3h.25)": the rules stop at 3h.22; this is checklist id R3h.25 (rules 3h.5 and 3h.17). Fix:
  "(3h.17)". The same trap holds for R3h.20 to R3h.25 and R3aa.34 to R3aa.38, whose numbers differ from their
  rules' (the checklist says so once, in "How to use it").
- Rules 3ae.1 and 3af.3, R3af.3 "(3s.27)" after "would cover words": 3s.27 is "same thing, same place". Fix:
  "(3s OVERLAP)".
- Rules 3ah.5 "by the judge in 7": the single judge was replaced. Fix: "by the judges of 3aj.4".

## 37. STALE. Text left from the old order

- Rules 0b.1a and digest 0b.1a: "junction both `node_modules` into it ... `config core.hooksPath .githooks`"
  by hand. SKILL phase 0 runs `node scripts/setup-worktree.mjs`, which does both. Fix: replace the hand steps
  with the script's name.
- SKILL lines 73 to 74: "Rule text written before 22 Nov 2026 may name the old steps: step 2 is phase 1 ...".
  No rule file names an old step number any more. Fix: delete.
- SKILL line 17: digest sections "(1, 2, 3, 3b to 3v, 4, 5, 6)". The digest now runs to 3al, with 0, 0b and
  3d. SKILL description: "the review loop with four scripts". Fix: "(0, 0b, 1, 2, 3, 3b to 3al, 3d, 4, 5, 6)";
  drop "with four scripts ...".
- Rules 0b.10 and digest 0b.10: "Run all three checks before any link, screenshot or video reaches Tzvi".
  Board parts now reach him in phases 4 to 6 with other checks. Fix: add "(a board part goes with the free
  scripts for that part, 3aj.8)".
- Rules 3r.3 and digest 3r.3: "Only then is it shown to Tzvi". Fix: "Only then is the finished site shown to
  Tzvi (the board parts come earlier, 3aj.8)".
- Digest section 6: step 3 ends "The cinematic's own checks from scroll-craft (`shoot.mjs` ...)", while digest
  section 0 says scroll-craft is only read for ideas; step 5 "Then show the owner"; the last paragraph "Each
  build keeps a `RULES.md` answering every line" (it is written from the blueprint, 0b.0). Fix: delete the
  scroll-craft line; step 5 becomes "Then show Tzvi (phase 10)"; add "(written from BLUEPRINT.md, 0b.0)".
  The same RULES.md sentence is in rules 3r.
- `scripts/check-concept.mjs` still prints "search 21st fresh for this business on every build ... rule 3c.1".

## 38. STALE. Credit prices quoted from memory, and they disagree

- SKILL: "Prices are read with `get_cost` at the time, never from memory."
- Rules 3h.19.3 "2 credits each"; section 8 "a 2-credit still ... a 10-credit clip", "2k is 2 credits", "about
  12.5 credits for 5 s"; 3w.10 "7.5 credits at 480p and 10 at 2K", "about 1 credit each"; 3w.15 "A still costs
  about a credit and a clip sixteen"; 3ag.1 "about 1 credit each".
- Fix: replace each figure with "price from get_cost", or keep it only with its date as history ("on 2 Nov
  2026: ...").

## 39. CONTRADICTION. A generation price "named in the owner's first message"

- Rules 0b.2: "one nano_banana_2 fill per shape (price from get_cost, named in the owner's first message)".
- Rules section 2 and R2.2: the owner is never told "tools, credits, image sources".
- Fix: "named in the owner's first message" becomes "written in the first-look note" (as 3ag.1 has it).

## 40. ORDER. The first message asks less than the rules say it must

- SKILL phase 1 lists: missing facts, more photos, guarantee, FAQ, per-item choices, which number takes
  WhatsApp, prices against the menu.
- Also due in that message by the rules: the three worry questions (3c, R2.3); reviews with the name the owner
  may show (3 cont. 5, 3ab.3); how many each size serves (3u.3); lead time, closed days and the most common
  choice (3k.8, 3u.2); which size a photo shows (R8.9); the originals of screenshots (3o.7); a photo of the
  owner (3e.22).
- Problem: the order form is built in phase 1 and needs the lead time, closed days and servings on day one.
- Fix, SKILL phase 1, after "prices against their menu (§0b.3)": add ", the worry questions (§3c), reviews and
  the name each may show (3ab.3), servings per size (3u.3), lead time, closed days and the usual choice (3k.8),
  which size each photo shows (rules 8), the originals of any screenshot (§3o.7) and a photo of themselves
  (3e.22); only what the record does not already answer".

## 41. ORDER. The two sites a build is planned against and the two it is judged beside need not be the same

- SKILL phase 2: "`## Why they are a 5` from the two best sites of the kind". SKILL phase 9:
  "`compare-sheet.mjs <build> <pic 1> <pic 2>`". Rules 3ag.6 and 3ah.7 never say they are the same two.
- Fix, SKILL phase 9: "`<pic 1> <pic 2>`" becomes "the same two sites as `## Why they are a 5`".

## 42. CONTRADICTION. Two digest clauses the rulebook dropped

- Digest section 4: a set is generated "(category and atmosphere tiles only, never a product being chosen)".
  Rules section 8 and digest section 1: generated images "may go anywhere on the page, product cards and
  choice tiles included" (8 Oct 2026). Fix: delete the bracket; add "product pictures are edited from their
  own photo (3h.12)".
- Digest 3d: "The footer says when tier 2 was used", against "without a label" in the same policy. Fix: delete
  the sentence, or mark it "automatic page builder only".

## 43. CONTRADICTION. Who writes the blueprint's answers

- SKILL Models: Fable writes "opening ideas, the 'Own:' idea, film stories, headlines"; the session builds.
- Project CLAUDE.md, "Ads are made from their blueprint": "the ideas, the headlines and the blueprint's
  answers for every ad, moving ad and site are written by one subagent with `model: "fable"`".
- Fix (Tzvi's call): in CLAUDE.md change "and the blueprint's answers for every ad, moving ad and site" to
  "for every ad, moving ad and site, and the blueprint's answers for an ad".

## 44. STALE. Two small leftovers in the digest's menu line

- Digest 3al.7 lists the menu without "a custom cursor and the photo sphere" (digest 3ai has them). Fix: add
  them.
- Digest 3ak.4 gives the calm-prices rule without B5's laptop flip (digest section 0 has it). Fix: add "(B5
  flips on a laptop only, the price also on the card)".

---

## Clean bill: checked and found consistent

- The four yeses and what each unlocks: SKILL's table, rules 0b intro, 3aj.8, 3c.11, 3h.6, 3aa.35, 0b.6 and
  the digest all agree (pictures after yes 1, clips after yes 3, three yeses with no film).
- Blueprint stage numbers in SKILL (`--check 3`, `4`, `6`, `7`) match `blueprint.mjs`'s order (facts, order
  flow, prices, opening, sections, site structure, photos).
- Every script named in the five files exists (in `scripts/`, the skill's `scripts/`, `scrollcraft/starter`
  or `scripts/hooks`), including all the check scripts, `judges.mjs`, `compare-sheet.mjs`, `inspo-beside.py`,
  `check-light-pool.py`, `product-match-sheet.py`, `relight_photo.py`, `extend_photo.py`, `keep_change.py`,
  `record_facts.py`, `setup-worktree.mjs`, `wait-deploy.mjs`. The four hooks exist.
- `check-rule-copies` and `check-rule-homes` pass: `reference/full-rules.md` is the same text as the rulebook,
  and every rule has its section.
- The retired list (seven ids) and the renumbered ids (R0b.15, R3e.26 to R3e.28) are used consistently in the
  checklist; no retired id is cited as live in SKILL.
- Savings and prices (3j, 3s Prices, 3aa.19, R3j.7 to R3j.14, 3u.3): one method throughout, percentage rounded
  down, against the smallest size, from the listing.
- Urgency and claims (hard rules, 3c.7, 3c.10, 3e rejected list, 3j Never, 3s Never, 5c.7): consistent, with
  one home.
- The order flow (3k.1 steps, 3k.6, 3k.8, 3l, 3u.1 to 3u.4, 3x.9, 3x.10, 3x.14, R3k.7 to R3k.10): consistent.
- Generated food in motion (3o.1, 3h.13 to 3h.16, 3w.1 exception, section 8): one policy, pointed to from each
  place.
- Phones (3ac.1, 3aa.14, 3aa.24, 3aa.26, 3aa.30, 3b.6, 5b.3's 40% rule, no parallax): consistent.
- The six screen sizes: every mention points to 3p.6 and lists the same six.
- The 3ai.2 menu items themselves (3ae.1, 3ae.2, 3af.1, 3af.3, 3af.4, 3z.1, 3ak.1, 3al.7, 3bb): rules,
  checklist and digest all say "a choice ... n/a when not picked".
- Labels (3ag.5, 5b.6, R3ag.5, R5b.6, digest), B5 (3ak.4, 8a, digest section 0, R3ak.4), the per-business
  opening (3ah.8, 3aj.2, SKILL phase 4, R3ah.8, R3aj.2) and the spared builds (rules "How a rule is added" 3,
  `scrollcraft/rules-as-of.json` exists): consistent apart from finding 26.
- `docs/static-ad-rules.md` section 27 agrees with rules 3ak.3, R3ak.3 and SKILL phase 3 on BRAND.md's
  `## For ads` part and ad step A27.1.
- Text over imagery (5b.3 as the home; 3a, 3e.12, 3g.8, 3z.4, 0b.7 point to it) and brightness for films
  (3h.11 as the home): consistent, apart from the opening stills in finding 4.

## How we can do better

1. A check for dangling references: one script that reads every rule number and file path cited in the four
   rule files and fails on one that does not exist on main (this audit found 5 missing paths and 10 wrong
   numbers by hand). Home: `scripts/check-rule-homes.mjs`.
2. The same script could refuse "phase N" in rule text, as it already refuses an id ending in a letter
   (finding 34). Home: `scripts/check-rule-homes.mjs`.
3. A gate should be run once as written before it is committed: the phase 7 gate (finding 10) would have
   failed on its first run. Home: "How a rule is added", step 4.
4. For the product: the three first screens could each be held against `docs/category-mistakes.md` before Tzvi
   sees them, with one of the three always taken from an opening type no live site uses yet, such as Ruben
   Stom's split opening or panel wipe (`docs/inspo/videos-ruben-stom-2026-11-22`). Home: SKILL phase 4.

Say which of these to add; nothing is written until then.
