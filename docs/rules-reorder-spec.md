# Rules reorder: the spec to carry out (22 Nov 2026)

Tzvi: "fix the rules to make it in a good order and make our builds as quick and efficient as possible while
creating the best outcome". Earlier: "the order is just as important as the rules themselves and see if any are
repeated or unnecessary".

This file is the whole job. It was checked against the files in this worktree at commit `72b5bada`. The older
draft, `docs/build-order-plan-draft.md`, is replaced by it. Do not commit the draft.

## Read this first (rules for whoever carries it out)

- Work only in `C:\Users\tzviw\Documents\mir-reorder` (branch `rules/reorder-build`).
- Never change a live site. Nothing under `frontend/public/pages/` and nothing under `scrollcraft/builds/` is
  edited.
- No published site may fail a check it passes today. Section 5 proves it on every build, before and after.
- No checklist id is deleted. A merged id moves to the checklist's new `## Retired` list (change S2). 182 answers
  to the seven retired ids sit in live sites' RULES.md today, so a plain delete would refuse every one of them.
- Every checklist id keeps a record in `docs/rules-as-blueprint/rules.json` and a section in the digest and the
  full rules. `node scripts/check-rule-homes.mjs` must pass.
- Edit with the Edit tool, never a shell replace. "Old" text below is copied from the files. If an old text does
  not match, stop and read the lines named; do not guess.
- The same edit is often made in two files: the full rules (`docs/page-generation-rules.md`) and the digest
  (`.claude/skills/build-business-page/reference/rules-digest.md`). Never edit `reference/full-rules.md`: the sync
  copies it.
- Save with `node scripts/commit-rules.mjs "<message>" <the seven scripts and the other paths>` (section 5, step 8).
  It runs `check-rule-copies --sync` itself. That sync overwrites the skill every session loads
  (`~/.claude/skills/build-business-page`), so run it only when everything else is done.
- Do not push. Pushing to main is Tzvi's call.
- Plain English, short sentences, no long dashes (`brand/voice.md`).
- Line numbers are as at `72b5bada`. They move as you edit, so find by the quoted text.

What was found wrong in the draft, so nothing stale is carried over:

- The draft said 311 rules. There are 324 checklist lines, and the scripts see 320 (see "For Tzvi", point 3).
- The draft's "new rules 1 to 7" are already on main as 3aj.1 to 3aj.7. R7.1 already allows the three first
  screens. `check-concept.mjs` already checks the `- first screens:` line.
- The draft's "main checkout is 63 commits behind" is about another folder. This worktree is current.
- The draft wanted a new `phase:` tag on every checklist line. Not needed: one line in `blueprint.mjs` reorders
  the stages (change S1).
- The draft named `scripts/record.mjs`. It is the skill's `scripts/record.mjs`.
- The full rules already say `brightness.py` is for clips and `check-light-pool.py` for opening stills (3aa.33).
  Only SKILL.md, the digest's 3h.11 and checklist line R3h.11 still say otherwise.

---

## 1. The new "The steps" section of SKILL.md (paste as it is)

Replace everything in `.claude/skills/build-business-page/SKILL.md` from the line `## The steps` down to the line
before `## Fixing a fault on a site already live` with the block below.

```markdown
## The steps

Twelve phases, in this order (Tzvi, 22 Nov 2026: "the order is just as important as the rules themselves").
The cheap things come first: words, sketches, grey-box HTML. A paid picture waits for his pick of the first
screen. A paid clip waits for his yes to the film as stills. He says yes four times, each just before the next
costly thing. Every phase ends at a gate: a script, or his quoted words, never the builder's own opinion.

Rule text written before 22 Nov 2026 may name the old steps: step 2 is phase 1, step 5 is phase 2, step 6 is
phases 3 to 5, step 7 is phases 5, 6 and 8, step 11 is phase 9.

**The design board (§3aj.8).** One artifact a build, "Design board: <business>", made from
`gen/board/index.html` and republished from that same file each time, so its link never changes. Put the link
on CONCEPT.md's `- board:` line. Four parts, filled as the phases pass: A the references (phase 2), B three
first screens (phase 4), C the grey-box page and the film sketch (phase 5), D the film as stills (phase 6).
Tzvi answers in his own words, and they are copied to the line each gate names. A "no" or a change goes into
FEEDBACK.md first. Before he sees a part, the free scripts for that part have passed.

| Phase | Cost | Tzvi |
|---|---|---|
| 0 to 3 | free | none |
| 4 | free | yes 1: the first screen |
| 5 | free | yes 2: the page plan and the film sketch |
| 6 | paid, small (pictures and stills) | yes 3: the film as stills |
| 7 | free | none |
| 8 | paid, the largest (clips) | none |
| 9 | free | none |
| 10 | free | yes 4: the finished site |
| 11 | free | none |

Prices are read with `get_cost` at the time, never from memory.

0. **Set up and fetch (free).** A new worktree of origin/main (§0b.1a), then `node scripts/setup-worktree.mjs`
   inside it. `scrollcraft/starter/fetch_business.py`: the real slug from the live record, every photo on one
   numbered sheet. Read everything they already told us; never re-ask it (§1, §0b.1). Read the last lines
   (`record_facts.py`): what the order form must send and what to ask first (§0b.1b). Create FEEDBACK.md with
   `- none yet` (§3aj.6). `node scripts/blueprint.mjs <build>`, then `--has film=yes|no <build>`.
   **Gate:** the record, the photo sheet, FEEDBACK.md and BLUEPRINT.md exist.
1. **Look, ask once, start the working parts (free).** Look at every photo: duplicates, screenshots, small
   sizes, kinds (§3o.6, §3o.7). Mark each one shop-ready, re-light or styled shot (§3ag.1), and note any big
   photo of the wrong shape (§0b.2b). These are decisions only. Nothing is paid for yet. Send the owner one
   message, only about their business: missing facts, more photos, guarantee (§3j.1), FAQ with 5 to 8 example
   questions (§3b.4), per-item choices for similar products (§3l.1), which number takes WhatsApp (§3o.4),
   prices against their menu (§0b.3), and every live-site write the build needs. Then build what never changes
   with the design: load the products, the order form, the basket, and run
   `node scripts/check-order-data.mjs <form page>` the day the form first sends (§0b.2a, §0b.8a). Plan
   blueprint stages 1 to 3 (facts and words, order flow, prices).
   **Gate:** `message-to-owner.md` is sent, OWNER-QUESTIONS.md holds every ASK FIRST line, and
   `node scripts/blueprint.mjs --check <build> 3` passes.
2. **Study the kind of business (free).** Name the category (§3t). Read `docs/category-mistakes.md` first, the
   "every kind" part and the business's own (§3aj.3). Then `reference/playbooks.md`, `docs/inspo/`, Inspo,
   Mobbin, 21st and Pinterest: one study a build (§3g.17, §3aa.7). Write REFERENCES.md: a line for every
   source, `Take:` and `Skip:` on each kept picture (§3aj.1), and `## Why they are a 5` from the two best
   sites of the kind, one of them a live site named by its address (§3ah.7, §3ag). Start the board with part A.
   **Gate:** `node scripts/check-references.mjs <build>` passes.
3. **Ideas in words, and the brand sheet (free).** One Fable subagent (see Models) writes the opening ideas,
   the "Own:" idea, the film stories and the headlines into IDEAS.md. Run the one-sentence test on the words:
   "you land and ___ happens" must be about the business (§3n). Write BRAND.md: colours with their uses, two
   fonts, one radius, motion limits, the design bans taken from `docs/category-mistakes.md` (§3x.7), and its
   `## For ads` part, which every ad for the business will read (§3ak).
   Write the look into `scrollcraft/fingerprints.json` (§3p). Start CONCEPT.md: the category, the chosen idea
   and why, the `- avoids:` line.
   **Gate:** `node scripts/check-ideas.mjs <build>` and `node scripts/check-fingerprints.mjs <build>` pass.
   The hooks block any paid generation until check-ideas does (§0b.4).
4. **Three first screens (free, then Tzvi).** Read the blueprint's Opening stage first. Build the first screen
   three times as plain HTML in `gen/board/` (`first-a.html`, `first-b.html`, `first-c.html`), one per
   reference. Same colours and fonts from BRAND.md, same words, the owner's photos as they are. Only the layout
   differs. A picture still to be made is a plain grey picture of its final shape. A photo of the wrong shape
   sits whole, with grey where it will be extended. Show each as a laptop frame beside a phone frame (§3aa).
   Run `check-says-offer.mjs`, `check-five.mjs` and `readable.mjs` on each; fix or drop one that fails. They
   are part B of the board.
   **Gate, yes 1:** CONCEPT.md has
   `- first screens: gen/board/first-a.html gen/board/first-b.html gen/board/first-c.html; Tzvi: "<his pick>"`
   (§3aj.2). Then plan the Opening stage: `node scripts/blueprint.mjs --check <build> 4` passes.
5. **The page in grey boxes, and the film in sketches (free, then Tzvi).** Write CONCEPT.md `## Body`: the
   `- sections:` line (§3ad), two `- signature:` lines, one of which may be the showpiece (§3ad, §3ah), the
   `- showpiece:` line, the `- treatments:` line, three at most, picked from the menu (§3ai), and the
   `- motion:` line (§3e). Write `## Effects` with its `- touch:` line (§3p). Build the home page from the
   starter with real words and real prices, and a plain grey picture, at the final shape, wherever a picture is
   still to be made. Run the sameness checks now, while a change costs nothing: `check-body-alike.mjs`,
   `check-rhythm.mjs`, `check-heights.mjs`, `check-signature-body.mjs`, `check-fits.mjs`.
   With a film (`film=yes`): `node scripts/blueprint.mjs --check <build> film`, then the sketch sheet
   `gen/storyboard.png`, a row per concept, drawn to those rules (§0b.5b); the motion as numbered steps
   (§0b.5); every object's source and end (rules 3h.18); the scroll timeline, a line for each scene saying
   where in the scroll it starts and ends, what moves, and when its words come and go (§3ak); and the
   question of how phones get the film (3aa.26). The grey-box page and the sketch sheet are part C of the board.
   **Gate, yes 2:** CONCEPT.md has `- page plan: Tzvi: "<his words>"` (§3aj.8). With a film, the brief quotes
   his picked row and its "Phones asked:" line. `node scripts/check-concept.mjs <build>` and
   `node scripts/blueprint.mjs --check <build> 6` pass.
6. **The pictures, then the film as stills (paid, small, then Tzvi).** Only now are pictures paid for: re-light
   (`scrollcraft/starter/relight_photo.py`), extend to the shape the picked layout needs
   (`scrollcraft/starter/extend_photo.py`), and the styled shots (§3ag.1). A brief before every paid picture
   (rules 8), `get_cost` first, one made and checked before the rest. `scripts/product-match-sheet.py` for
   every re-lit or styled product. Plan the Photos stage: `node scripts/blueprint.mjs --check <build> 7`.
   With a film: make each clip's start and end still, all of one scene from one base picture
   (`scrollcraft/starter/keep_change.py`, 3aa.17). Check each still alone, in this order:
   `scripts/check-light-pool.py` (for stills it is the brightness check); `scripts/inspo-beside.py` with its
   colour grid and the `shot_seen` line (§3aj.5); a close crop of each hero object beside its inspo (3aa.34);
   then read the picture's `Skip:` line again against the still. Then one sheet of the whole film as stills:
   each clip's start and end, laptop beside phone, what moves (3aa.35). It is part D of the board.
   **Gate, yes 3:** `beats_seen` quotes his yes to every setup; `clipchain.py make` refuses a clip without it.
   A site with no film has no part D and no yes here: its gate is the product-match sheets.
7. **Build the real site, with the stills where the film goes (free).** Plan the last stages first
   (`node scripts/blueprint.mjs --check <build>`), and tick lines as they are built. Build from the starter
   (`scrollcraft/starter`, §3p.1) as a website, not a page: pages by kind, one menu bar, full footer, Shop with
   steps, basket between pages, orders saved before WhatsApp (§3k, §3v). While building, follow: facts and
   claims (§1), copy (§2), the first screen (§3g.13, §3ah), the category checklist (§3, §3b), design and
   persuasion (§3c, §3e, §3g, §3i, §3s), honest deals and calm prices (§3j, §3ak), similar products (§3l),
   owner-filled places
   (§3m), design and story (§4), build rules (§5). The approved stills sit in the real opening
   (`kit.opening_slides`, `slides.js`), so the film can be scrolled as stills before any clip exists (§0b.6a).
   New motion is tried on `scrollcraft/starter/kit/test.html` first. Hold the built first screen to the mockup
   Tzvi picked with the repo's `visual-diff` skill. No grey picture is left on any page.
   **Gate:** with `scripts/serve-builds.mjs` running, `node scripts/check-build.mjs scrollcraft/builds/<folder>`
   passes every line except `independent review`, `check-compared` and, with a film, the film checks. A real
   test order went through (§3g.12).
8. **The clips (paid, the largest spend; film only).** May start once yes 3 is in and the opening passes
   `check-photo-clear.mjs`, `readable.mjs` and `check-fits.mjs` with the stills in place. It runs in the
   background while phase 7 goes on. `scrollcraft/starter/clipchain.py`, one clip first. On every clip:
   `scripts/check-clip.mjs`, `brightness.py`, and its `end_seen` line. Two tries at most (§3w). A clip that
   fails changes the story, not only the prompt (rules 3h.19). Then `clipchain.py story`, read by someone who
   did not write the prompts (3aa.32), and encode. Put the film in.
   **Gate:** `check-film-video.mjs`, `check-film-clear.mjs`, `check-opening-scroll.mjs`,
   `check-phone-opening.mjs` and `check-iphone.mjs` pass.
9. **Judged by people who did not build it (free).** Render at the six sizes of §3p.6, both languages, reduced
   motion, phones as phones (§6). `node scripts/compare-sheet.mjs <build> <pic 1> <pic 2>` puts screens.jpg
   beside two of the best sites of its kind, and REFERENCES.md gets `## Compared` (§3ag). A Sonnet subagent
   that did not build the site uses it against `docs/page-review-checklist.md`; fix every FAIL, it looks again
   (§3r.2). Two Sonnet judges that did not build it score layout, light, colour, type, detail and motion beside
   compare.jpg, one `Judge N:` line each in review.md; the median plus Tzvi's calibration is the `Rating:`, 4
   or more with no area under 3.5 (§3aj.4). Finish the wow-gate answers (§3n). Do not also run
   `design-kit:design-loop` or `design-kit:page-conversion-review`: the reviewer and the judges do their job.
   **Gate:** `node scripts/check-build.mjs scrollcraft/builds/<folder>` prints "all N checks pass". It runs
   every script on every page, writes RULES.md from the blueprint, and runs check-rules, the judges and the
   feedback check, so none of them is run by hand.
10. **Tzvi sees the site (Tzvi).** Send the link to the local preview and a video at 1.5x with an HTML link,
    recorded with the skill's `scripts/record.mjs`, its contact sheet looked at first (§3c.11). New words from
    him go into FEEDBACK.md first, then the work goes back to the phase they belong to. Each time he gives a
    verdict on a judged site, add it to `docs/judge-calibration.json`.
    **Gate, yes 4:** his yes to publish, quoted in the report.
11. **Publish, check it live, report (free).** `node scripts/publish-page.mjs <folder> <slug> --check` lists
    every problem. Then publish in the background (`run_in_background`), never in the foreground: re-recording
    the preview passes 10 minutes on long sites (The Gift Boutique, 16 Nov 2026). Pushing is Tzvi's call; it
    runs `check-push-rules` (.githooks/pre-push), so push a new rule together with the sites whose RULES.md
    answer it, then `node scripts/wait-deploy.mjs`. On live: `check-showcase-previews.mjs` and
    `check-business-pages` (§0b.12). The owner's video comes last, from the live page, at normal speed
    (`--speed 1`); send its `-whatsapp.mp4` copy. The report is written only after the change is seen live. It
    ends with "Not done yet", "For your call" and "How we can do better", after a shorter-version pass on every
    long line (§0b.10a), and it states the credits spent.
```

Notes on that block, for the reviewer (not pasted):

- Every `§` names a section the digest has, so `check-rule-homes` passes. Full-rulebook-only sections (3a, 7, 8)
  are written as "rules 8", never with `§`.
- `§3aj.8` is the new rule of change K1, and `§3ak` the new section of part G. Do both in the same commit.
- Old step 10 (run ten scripts by hand) and old step 12 (answer RULES.md) are gone: `check-build.mjs` does both.
- Old step 13 (report) came before step 14 (publish). The report is now last, after the live check.

---

## 2. The change list

Files, short names used below:

- **SKILL** = `.claude/skills/build-business-page/SKILL.md`
- **DIGEST** = `.claude/skills/build-business-page/reference/rules-digest.md`
- **FULL** = `docs/page-generation-rules.md`
- **LIST** = `docs/rules-checklist.md`
- **REG** = `docs/rules-as-blueprint/rules.json`

### A. Script changes (do these first; each is small)

**S1. `scripts/blueprint.mjs`: the stages follow the phases.**
Old:
```js
const ORDER = ['1', '4', '2', '3', '8c', '5', '6', '7', '8', '8b', '9'];
```
New:
```js
// 22 Nov 2026: the stages follow the phases of SKILL.md. Paid pictures (4) come after the opening and the page plan.
const ORDER = ['1', '6', '5', '2', '3', '8c', '4', '7', '8', '8b', '9'];
```
Why: a builder plans only the stage in hand. Today the plan for photos is asked before the layout that decides
them. Stage numbers become: 1 facts, 2 order flow, 3 prices, 4 opening, 5 sections, 6 site structure, 7 photos,
8 motion, 9 phone, 10 section 8b, 11 finish. BLUEPRINT.md files are read by rule id, so old ones still load.

**S2. NEW, small: a retired rule no longer refuses a site.** Three files, one idea: a line
`- R3n.4 -> R3ag.6 (date): why` under `## Retired` in LIST means "this id was merged; ignore answers to it".

`scripts/check-rules.mjs`, old:
```js
for (const id of answers.keys()) if (!seen.has(id)) { problems.push(`${id}: not in docs/rules-checklist.md (typo, or the rule was removed)`); counts.bad++; }
```
New:
```js
// a rule merged into another is listed under "## Retired" in the checklist ("- R3n.4 -> R3ag.6 (date): why"); a site
// made before the merge still answers it, and that answer is ignored, never refused (22 Nov 2026)
const retired = new Set([...fs.readFileSync(CHECKLIST, 'utf8').matchAll(/^- (R[0-9][0-9a-z]*\.[0-9]+) ->/gm)].map((m) => m[1]));
for (const id of answers.keys()) if (!seen.has(id) && !retired.has(id)) { problems.push(`${id}: not in docs/rules-checklist.md (typo, or the rule was removed)`); counts.bad++; }
```

`scripts/check-push-rules.mjs`, old:
```js
const list = new Set([...git('show', `${ref}:docs/rules-checklist.md`).matchAll(/^(R[0-9][0-9a-z]*\.[0-9]+)\s*\|/gm)].map((m) => m[1]));
```
New (the regex also reads the Retired lines):
```js
const list = new Set([...git('show', `${ref}:docs/rules-checklist.md`).matchAll(/^(?:- )?(R[0-9][0-9a-z]*\.[0-9]+)\s*(?:\||->)/gm)].map((m) => m[1]));
```

`scripts/pre-commit-check.mjs`, two lines, the same regex swap in each. Old:
```js
  const ids = (s) => new Set([...s.matchAll(/^(R[0-9][0-9a-z]*\.[0-9]+)\s*\|/gm)].map((m) => m[1]));
```
New:
```js
  const ids = (s) => new Set([...s.matchAll(/^(?:- )?(R[0-9][0-9a-z]*\.[0-9]+)\s*(?:\||->)/gm)].map((m) => m[1]));
```
Old:
```js
  const known = new Set([...(idx.stdout || '').matchAll(/^(R[0-9][0-9a-z]*\.[0-9]+)\s*\|/gm)].map((m) => m[1]));
```
New:
```js
  const known = new Set([...(idx.stdout || '').matchAll(/^(?:- )?(R[0-9][0-9a-z]*\.[0-9]+)\s*(?:\||->)/gm)].map((m) => m[1]));
```
Why: without the first, 182 old answers refuse their sites. Without the second, a push of an old site is refused.
Without the third, every site commit is refused as "behind main's rules" while a local `main` still has the old
ids, and a republished old site's RULES.md is refused. `rule-dates.mjs`, `blueprint.mjs` and
`check-rule-homes.mjs` need no change: they read only `id |` lines.

**S3. `scripts/check-seams.mjs`: judge only what the page marks.**
In `judge()`, old:
```js
    return { url, cross, travel, needSpan: 1.5 * 800 };
```
New:
```js
    return { url, cross, crossMarked: await p.$('[data-cross]') !== null, travel, needSpan: 1.5 * 800 };
```
In `report()`, old (three lines):
```js
  if (!r.cross) why.push(`CROSS: nothing sits across a line between two sections (a picture or object at least ${INTO} px into each, 3ae.1)`);
  const t = r.travel;
  if (!t.marked) why.push('TRAVEL: no element marked data-travel (one object that goes down the page with you, 3ae.2)');
  else if (t.span < r.needSpan || !t.from || t.from === t.to) why.push(`TRAVEL: [data-travel] is in view for ${t.span} px of scroll (${t.from} to ${t.to}); it must stay ${r.needSpan} px and reach another section (3ae.2)`);
```
New:
```js
  // 3ae is a choice since 22 Nov 2026 (rules 3ai.2): each is judged only when the page marks it (data-cross, data-travel)
  if (!r.cross && r.crossMarked) why.push(`CROSS: the page marks data-cross, but nothing sits across a line between two sections (a picture or object at least ${INTO} px into each, 3ae.1)`);
  const t = r.travel;
  if (t.marked && (t.span < r.needSpan || !t.from || t.from === t.to)) why.push(`TRAVEL: [data-travel] is in view for ${t.span} px of scroll (${t.from} to ${t.to}); it must stay ${r.needSpan} px and reach another section (3ae.2)`);
```
In the self-test, old:
```js
  const ok = g.cross && g.travel.span >= g.needSpan && g.travel.from !== g.travel.to && !b.cross && !(b.travel.span >= b.needSpan && b.travel.from !== b.travel.to);
```
New:
```js
  // a page that marks neither is not judged; one that marks data-travel and does not travel still fails
  const plain = { url: 'plain', cross: null, crossMarked: false, travel: { marked: false, span: 0, from: null, to: null }, needSpan: 1200 };
  const ok = g.cross && g.travel.span >= g.needSpan && g.travel.from !== g.travel.to && !b.cross && !(b.travel.span >= b.needSpan && b.travel.from !== b.travel.to) && report(plain) && !report(b);
```
In the header comment, after the line ` * A page of fewer than three such sections is not judged.` add:
```
 * Since 22 Nov 2026 both are choices (rules 3ai.2): CROSS is judged only on a page with a data-cross mark, TRAVEL
 * only on one with data-travel. A page that marks neither passes.
```
Why: the check's own header says eight real shops were tried and none crossed a line. It can only pass more
sites than before, so no published site is hurt.

**S4. `scripts/check-concept.mjs`: the ideas and the sources are written once.**
(a) Old:
```js
  const ideas = part('Ideas');
```
New:
```js
  // IDEAS.md is the one home of the ideas (0b.4); a build that has it needs no "## Ideas" copy here (22 Nov 2026)
  const ideasFile = fs.existsSync(path.join(dir, 'IDEAS.md'));
  const ideas = part('Ideas');
```
Then put `!ideasFile && ` at the start of three conditions:
- `if (uniqueRefs.size < 3) problems.push(` becomes `if (!ideasFile && uniqueRefs.size < 3) problems.push(`
- `if (missing.length) problems.push(` becomes `if (!ideasFile && missing.length) problems.push(`
- `if (!/^\s*[-*]\s*Own:/im.test(ideas)) problems.push(` becomes
  `if (!ideasFile && !/^\s*[-*]\s*Own:/im.test(ideas)) problems.push(`

A build with IDEAS.md is already sent through `checkIdeas` a few lines above, which asks for three ideas, an
"Own" and the sources.

(b) Old (two lines, each starts `  if (!/mobbin\.com\//i.test(s))` and `  if (!/21st[^\n]{0,40}("[^"]+"|search)/i.test(s))`):
change `.test(s)` to `.test(src)` in those two lines only, and add this line just above the first:
```js
  const src = s + (fs.existsSync(path.join(dir, 'REFERENCES.md')) ? fs.readFileSync(path.join(dir, 'REFERENCES.md'), 'utf8') : '');   // REFERENCES.md is the one home of the sources
```
Do not touch the later `Wow gate:` line that also tests for mobbin.

(c) NEW rule 3aj.8. Just before the final `return problems;` of `checkConcept`, after the `R3aj.3` block, add:
```js
  if (!newer.has('R3aj.8')) {
    // one design board a build, and Tzvi's yes to the grey-box page before the real site (rules 3aj.8, 22 Nov 2026)
    const board = (/^\s*[-*]\s*board\s*:\s*(\S+)/im.exec(s) || [])[1] || '';
    const plan = (/^\s*[-*]\s*page plan\s*:(.*)$/im.exec(s) || [])[1] || '';
    if (!fs.existsSync(path.join(dir, 'gen', 'board', 'index.html')) || !/^https?:\/\//.test(board)) problems.push('Board: no gen/board/index.html, or no "- board: <its artifact link>" line in CONCEPT.md (3aj.8: one design board a build, the same link throughout)');
    if (!/["“][^"”]+["”]/.test(plan)) problems.push('Page plan: quote Tzvi\'s yes to the grey-box page ("- page plan: Tzvi: \\"yes, swap the third and fourth\\"") (3aj.8)');
  }
```
In the header comment, after the line ` *   the line printed by scripts/check-fingerprints.mjs for this build` add:
```
 * Since 22 Nov 2026 a build with IDEAS.md needs no "## Ideas" part here, the Mobbin and 21st sources may be named in
 * REFERENCES.md, and a new build has "- board:" and "- page plan:" lines (rules 3aj.8).
```
Why: (a) and (b) end writing the same ideas and links twice; both only loosen. (c) is the one new gate: it makes
yes 2 real. A site published before today is spared by `rule-dates.mjs`, as 3aj.2 and 3aj.3 are.

No other script changes. `publish-page.mjs`, `check-build.mjs`, `check-ideas.mjs`, `judges.mjs`,
`rule-dates.mjs`, `commit-rules.mjs`, `check-rule-copies.mjs`, `check-rule-homes.mjs` and the hooks stay as
they are.

### B. Checklist and register (LIST and REG)

**K1. New line, R3aj.8.** In LIST, directly under the `R3aj.7 | ...` line, add:
```
R3aj.8 | One design board a build: gen/board/index.html published as one artifact, its link on CONCEPT.md's - board: line, and Tzvi's yes to the grey-box page plan quoted on the - page plan: line before the real site is built | 3aj.8 | script: `node scripts/check-concept.mjs <build>` (Board, Page plan)
```
In REG, add after the `R3aj.7` record:
```json
  {
   "id": "R3aj.8",
   "rule": "One design board a build (gen/board/index.html, one artifact link), and Tzvi's yes to the grey-box page plan quoted before the real site is built",
   "how": ["KIT", "ASK"],
   "built_by": "Phases 2, 4, 5 and 6 fill gen/board/index.html; check-concept wants the - board: and - page plan: lines",
   "confirmed_by": "node scripts/check-concept.mjs <build>",
   "status": "built"
  }
```

**K2. Seven merges.** Delete these seven lines from their places in LIST, delete their seven records from REG,
and add this section at the very end of LIST (after the `R3r.4` line):
```markdown

## Retired

Merged into another line on the date shown. A site's RULES.md may still answer one; check-rules, the commit check
and the push check ignore that answer. A retired id is never used again.

- R3n.1 -> R3h.1 (22 Nov 2026): the strongest photo, big. 3h.1's 70% picture is the stricter measure, and a script.
- R3n.4 -> R3ag.6, R3aj.4 (22 Nov 2026): beside a reference. The compare sheet and the two judges do it once.
- R3b.1 -> R3ah.1, R3v.14 (22 Nov 2026): what, where, trust, next. The one statement and the three facts say them.
- R3c.1 -> R3aa.7, R7.1 (22 Nov 2026): references first. REFERENCES.md is their one home.
- R3g.1 -> R3x.7 (22 Nov 2026): the style sheet. BRAND.md is its one home.
- R3r.1 -> R3r.3 (22 Nov 2026): every script on every page. check-build runs them all.
- R3t.4 -> R3v.1 (22 Nov 2026): the footer. check-footer measures it.
```
None of the seven is a key in any script (checked: the ids named in `publish-page.mjs`, `check-build.mjs`,
`check-concept.mjs`, `check-ideas.mjs` and `blueprint.mjs`). The rule text of each stays in FULL and DIGEST.
Why: each is a LOOK the builder answered about its own work, already measured by the line it merges into.

**K3. Reworded lines (ids kept).** Replace each whole line in LIST with the new line. The old line is the one
that starts with the same id.

```
R3h.1 | The home page opens on a full-screen picture or film (at least 70% picture): the owner's strongest real photo, or the styled shot of it (3ag.1). It is an event from their own thing (a film, or an event built in code), proposed with the first build, never after | 3h.1, 3n | script: site OPENING (home page) plus LOOK to confirm it is an event, not a drift
R3h.11 | Every film and generated still set is bright: middle third at least 33, whole frame at least 22, average at least 30; the subject is the brightest thing; viewed on a phone in daylight. Opening stills of a product on a ground that is dark on purpose are measured by check-light-pool instead (R3aa.33) | 3h.11, 3i.1, 3aa.33 | script: brightness.py on every film and still set (check-light-pool for the opening stills), plus LOOK on a phone screen
R3aa.7 | REFERENCES.md names every saved source, Inspo, Mobbin, 21st and Pinterest, with what was taken and why, 3 to 5 real screens of the same kind of business among them; kept pictures saved to docs/inspo | 3aa.7, 3c.1 | script: check-references (concept runs it) plus LOOK: REFERENCES.md has a pinterest line
R3g.17 | One study a build: Mobbin, 21st, Inspo, Pinterest and docs/inspo searched once for this business (REFERENCES.md), with a fresh search of its own only for the first screen, the showpiece and the product card; every other piece from the kit or the effects library with its source named; nothing reused from the last two pages; each effect has a reason (says what a control does) | 3g.17, 3c.1, 0b.4 | script: concept (every effect has "from") and prints (effects), plus LOOK at the sources
R3q.1 | CONCEPT.md is complete: which idea was chosen and why (the ideas are in IDEAS.md), the five wow answers, an Effects line per kind, the "Not alike" line, and the first screens, avoids, board and page plan lines | 3q | script: concept
R3f.2 | The effect budget is written in CONCEPT.md and ticked on captured frames: one signature moment (held where it fits 1280x650, otherwise playing as the page scrolls), the opening's arrival, the five moments of the motion line (3e.16c) and any picked treatment that moves; no number of accents is asked | 3f.2, 3ai | LOOK: CONCEPT.md list against frames
R3x.7 | BRAND.md in the build folder (colours with their uses, two fonts plus at most a third for one label style, one radius, motion limits, logo on light and dark, textures, Design bans) was written before any picture was generated, and every section follows it; CONCEPT.md points to it | 3x.7, 3g.1 | LOOK: BRAND.md against the CSS and the page's computed styles
R3r.3 | check-build passes after the last edit (it runs every script on every page, then check-rules), and a fix was checked on the screen it was for | 3a.4, 3r | script: check-build (runs check-rules, this file)
R3ad.1 | At least two sections after the opening take a form only this business could have, shaped by its own data or main task (not a card grid in new colours), each on a "- signature:" line (its #id, what the visitor does or sees, and from: what data or task) in CONCEPT.md "## Body"; the showpiece (R3ah.5) may be one of the two | 3ad.1, 3ah.5 | script: `node scripts/check-signature-body.mjs <build>` plus LOOK that each is this business's own
R3ae.1 | A choice (3ai.2): when picked on the "- treatments:" line, one of the business's own pictures, films or objects, marked data-cross, sits across the line between two neighbouring home sections, 48 px or more into each; n/a when not picked | 3ae.1, 3ai | script: `node scripts/check-seams.mjs <urls>` (CROSS, judged when the page has data-cross)
R3ae.2 | A choice (3ai.2): when picked, one object of the business's own, marked data-travel and planned on a "- travels:" line in CONCEPT.md "## Body", stays in view for a screen and a half of scroll and reaches another section, never covering words; n/a when not picked | 3ae.2, 3h.25, 3ai | script: `node scripts/check-seams.mjs <urls>` (TRAVEL, judged when the page has data-travel) plus LOOK that it moves well
R3af.1 | A choice (3ai.2): when picked, one drawn mark taken from the business's own logo or product (or a mascot drawn from them) appears in three or more parts of the site doing a job (bullets, pointer, chosen state, dividers, confirmation), planned on a "- mark:" line in CONCEPT.md "## Body"; never a stock icon set; n/a when not picked | 3af.1, 3ai | LOOK: the mark in each place listed on the "- mark:" line, laptop and phone
R3af.2 | When the owner gave the words and a photo: a short note in their own words, signed with their name, beside their real photo and photos of the place or customers, planned on a "- owner:" line; never invented, and not a decoration; n/a, and asked for as a content gap, when they have not | 3af.2, 1.1 | LOOK: the note's words against what the owner gave
R3af.3 | A choice (3ai.2): when picked, and the site has four or more photos of their own work, one set is laid loose (tilted, overlapping, labelled by hand) and can be dragged or tapped to flip to what it is and its price; a tap is enough on a phone, still under reduced motion, planned on a "- loose:" line; n/a when not picked | 3af.3, 3s.27, 3ai | LOOK: tap and drag at laptop and phone, reduced motion on
R3af.4 | A choice (3ai.2): when picked, and there are three or more kinds, styles or flavours, each is on its own card in its own colour from that product, with its own cut-out picture and one line of character, planned on a "- cards:" line; n/a when not picked. Whatever is picked, kinds are never a grey list of names | 3af.4, 3g.19, 3ai | LOOK: the cards against the "- cards:" line
R3z.1 | A choice (3ai.2): when picked, one card the visitor would use (open slots, order card, price from, facts or a review) hangs a third to a half over the edge of the next section on the home page, the only thing that crosses an edge; on a phone it is whole and readable; n/a when not picked | 3z.1, 3ai | LOOK: laptop and phone screenshots of the edge
R3z.2 | When the picked first screen (3aj.2) is layered, it has three layers: a real photo, the film or a soft shape of the business's colour at the back, the words and any card in the middle, the main button in front with the only soft shadow; n/a when it is not layered | 3z.2, 3aj.2 | LOOK: same screenshots
R3bb.1 | A choice (3ai.2): any small touch used comes from 3bb's list or the site's own references, is not one the site built before it used, and shows only true facts; a touch that is there for looks is named on the "- treatments:" line and counts as one of the three; no number is asked; n/a when none is used | 3bb, 3ai | LOOK: CONCEPT.md treatments line and each touch on the site
R3ah.7 | REFERENCES.md has ## Why they are a 5 (five lines or more, each with how this site does it) before any idea; the rating itself is R3aj.4's | 3ah.7 | script: `node scripts/check-compared.mjs <build>` (NOFIVE)
R3ai.1 | Three decorations at most beyond photos, grounds and type, picked from the menu of 3ai.2 and the site's references and listed on CONCEPT.md's - treatments: line; a fourth only with (Tzvi OK, date) | 3ai | script: `node scripts/check-compared.mjs <build>` (TREATMENTS) + LOOK
```
Why: these are the "every site must have" lines. Followed together they gave every site the same thirteen parts.
Rewording keeps the id, so each line keeps its first date in git, and `rule-dates.mjs` still spares older sites.

Also in LIST, "How to use it", after the paragraph that ends `A rule with no way to check it is not finished.**` add:
```markdown
**A rule merged into another is never deleted.** Its line moves to `## Retired` at the end of this file as
`- R<old> -> R<new> (date): why`, and its record leaves `docs/rules-as-blueprint/rules.json`. Live sites answered
it, and the checks ignore a retired answer; a deleted one would refuse them. An id's number is not always the
rule's number (R3aa.38 is rule 3aa.35): the third column names the rule.
```

**K4. REG, the records of the reworded lines.** For each id, set the fields named. Leave every other field.

| id | field | new value |
|---|---|---|
| R3ae.1 | rule | `A choice (3ai.2): when picked, one of the business's own pictures or objects, marked data-cross, crosses the line between two home sections, 48 px into each` |
| R3ae.1 | built_by | `Phase 5 - treatments: line names it and the seam it crosses; the object is marked data-cross` |
| R3ae.1 | confirmed_by | `check-seams CROSS (only when data-cross is on the page) -> confirm only` |
| R3ae.2 | rule | `A choice (3ai.2): when picked, one object of the business's own (data-travel, '- travels:' in CONCEPT.md) goes down the page with the visitor for 1.5 screens into another section` |
| R3ae.2 | confirmed_by | `check-seams TRAVEL (only when data-travel is on the page) -> confirm only, LOOK for the motion` |
| R3af.1 | rule | `A choice (3ai.2): when picked, one drawn mark from the business's own logo or product does a job in three or more parts of the site` |
| R3af.2 | rule | `When the owner gave the words and a photo, a short signed note beside their real photos; not a decoration; missing words are a content gap` |
| R3af.3 | rule | `A choice (3ai.2): when picked, with four or more work photos, one set is laid loose and flips or drags to show what it is` |
| R3af.4 | rule | `A choice (3ai.2): when picked, three or more kinds each get their own colour card, cut-out picture and one line of character` |
| R3z.1 | rule | `A choice (3ai.2): when picked, one card hangs over the edge of the next section on the home page, whole on a phone` |
| R3z.2 | rule | `When the picked first screen is layered: photo, film or shape, words, button in front` |
| R3bb.1 | rule | `A choice (3ai.2): any small touch used is from 3bb or the references, counts toward the three when it is there for looks; no number is asked` |
| R3bb.1 | built_by | `Phase 5 - treatments: line names the touches picked; to build: starter parts for the code-only touches (progress line, footer fill, price highlight, chapter counter, tag pill, corner join card)` |
| R3f.2 | rule | `Effect budget written and ticked on frames: one signature, the opening's arrival, the motion line's five moments, any picked treatment that moves; no number of accents` |
| R3ai.1 | built_by | `Phase 5 picks up to three decorations from the menu of 3ai.2 and the references and writes the - treatments: line` |
| R3ah.7 | rule | `REFERENCES ## Why they are a 5 before any idea; the rating is R3aj.4's` |
| R3ah.7 | built_by | `Phase 2 writes ## Why they are a 5` |
| R3ah.7 | confirmed_by | `check-compared NOFIVE` |
| R3h.11 | rule | `Films and still sets bright (thirds 33, whole 22, avg 30), subject brightest; opening stills by check-light-pool` |
| R3h.11 | confirmed_by | `brightness.py on clips and still sets, check-light-pool on opening stills -> confirm only` |
| R3g.17 | rule | `One study a build, a fresh search only for the first screen, the showpiece and the product card; nothing reused from the last two pages` |
| R3h.1 | rule | `Home opens on full-screen picture/film (>=70%), the strongest real photo or its styled shot, an event from their own thing` |
| R3x.7 | rule | `BRAND.md written before any picture (colours, fonts, one radius, motion limits, bans); every section follows it` |
| R3aa.7 | rule | `REFERENCES.md names every saved source, Inspo, Mobbin, 21st and Pinterest, 3 to 5 screens of the same kind among them` |
| R3aa.7 | confirmed_by | `check-references + LOOK` |
| R3r.3 | rule | `check-build passes after the last edit (every script on every page, then check-rules); fix checked on its screen` |
| R3q.1 | rule | `CONCEPT.md complete: chosen idea and why (ideas in IDEAS.md), wow answers, Effects lines, Not alike, first screens, avoids, board, page plan` |
| R3ad.1 | rule | `At least two sections after the opening take a form only this business could have; the showpiece may be one of the two` |
| R3ag.1 | built_by | `Photo sheet in phase 1 marks each photo shop-ready, re-light or styled shot; paid for in phase 6, after the first screen is picked, with scrollcraft/starter/relight_photo.py to one ground` |
| R3ag.6 | built_by | `Phase 9: scripts/compare-sheet.mjs, then the ## Compared lines (difference -> what changed)` |
| R3ah.1 | built_by | `Phase 4 builds the opening three ways as one statement; the offers in the line under the headline and in meta offers` |
| R3ah.5 | built_by | `Phase 5: the - showpiece: line in CONCEPT.md, planned with Fable from REFERENCES ## Why they are a 5` |
| R3ah.8 | built_by | `Phase 1 marks the hero as a styled shot, phase 6 makes it; phase 3 plans the wow (Tova: a light sweep)` |
| R3aj.2 | built_by | `Phase 4 builds gen/board/first-a.html to first-c.html and shows them as part B of the design board; check-concept wants the - first screens: line with his pick` |
| R3e.16c | built_by | `Phase 5 writes CONCEPT - motion:; built within 3e.16b's limits` |

### C. Merges in the rule text (FULL and DIGEST)

**M1. The ideas live in IDEAS.md only (3q).** The same edit in FULL and DIGEST, section 3q. Old (wrapped the same
way in both files):
```
Before any section is built, the build folder gets `CONCEPT.md`: three or
more opening ideas, each citing a saved effect from `docs/inspo` by its
picture; one idea marked "Own:" from the business's own words or world (its
tagline, its process, its place); which was chosen and why; the five wow-gate
```
New:
```
Before any section is built, the build folder gets `CONCEPT.md`: which idea
was chosen and why (the ideas themselves, three or more with one "Own:", live
in IDEAS.md, 0b.4; only a build with no IDEAS.md keeps them here under
`## Ideas`); the five wow-gate
```
And in the same section, both files, old:
```
CONCEPT.md is also where the style sheet (3g.1), the effect budget (3f.2) and
the effect sources (3g.17) are written.
```
New:
```
CONCEPT.md is also where the effect budget (3f.2) and the effect sources
(3g.17) are written. The style sheet is BRAND.md (3x.7), its one home.
```
Why: the same ideas, pictures, colours and fonts were written in up to four files.

**M2. The style sheet lives in BRAND.md (3g.1).** In FULL and in DIGEST, at the end of item 1 of section 3g, add
the sentence: `Since 22 Nov 2026 it is written in BRAND.md (3x.7), its one home; CONCEPT.md points to it.`
Why: K2 merges R3g.1 into R3x.7.

**M3. "Beside a reference" is done once (3n.4).** FULL and DIGEST, section 3n, item 4. Old (same in both):
```
   the closest Awwwards reference in docs/inspo for that kind of business; if
   ours is plainly weaker, it is not shown.
```
New:
```
   the closest Awwwards reference in docs/inspo for that kind of business; if
   ours is plainly weaker, it is not shown. Since 22 Nov 2026 this is done once,
   by the compare sheet (3ag.6) and the two judges (3aj.4): the answer names
   compare.jpg and the rating.
```
Why: five rules asked for a comparison (3n.4, 3ag.6, 3ah.7, 3aa.33, 3aj.4 and 3aj.5). Two stay: `inspo-beside.py`
for stills, the judges for the finished site.

**M4. One rating, not two (3ah.7).** FULL, section 3ah, item 7.
- Old: `7. **Planned against a 5, judged a 5.** At step 5, before any idea, the two best sites of the category`
  New: `7. **Planned against a 5, judged a 5.** In the study phase (phase 2), before any idea, the two best sites of the category`
- Old: `   At step 11, before the review, a Sonnet judge that did not build the site rates it from 1 to 5 beside two real top`
  New: `   At the review (phase 9), until 3aj.4's two judges replaced it on 22 Nov 2026, a Sonnet judge that did not build the site rates it from 1 to 5 beside two real top`

DIGEST, section 3ah. Old:
```
(check-listing-prices). (7) REFERENCES.md `## Why they are a 5` before any idea; a judge rates the site beside two
real top sites and review.md says `Rating: 4/5` or better before anyone sees it (check-build; real award winners score 4 to
4.5). New sites only.
```
New:
```
(check-listing-prices). (7) REFERENCES.md `## Why they are a 5` before any idea (check-compared). The rating is
3aj.4's two judges; real award winners score 4 to 4.5. New sites only.
```
Why: 3aj.4 says it replaces 3ah.7's single rating, but 3ah.7 still asked for it.

**M5. Three paid concept stills are replaced by the sketch sheet (3h.6).** FULL, section 3h, item 6. Old:
```
6. **Three concepts as stills first,** each a different film, before any clip
   is paid for; the chosen one is challenged once (what is weak, what is
   missing) before rendering. They go to Tzvi in the message that starts the
   build, never after it, unless the opening is already an event built from
```
New:
```
6. **Concepts as sketches first, never as paid stills** (changed 22 Nov 2026:
   two of every three photoreal concept stills were paid for and thrown away).
   The concepts are the rows of the sketch sheet below. Only the picked row is
   made as stills, and Tzvi sees those as one sheet before any clip (3aa.35).
   The chosen one is challenged once (what is weak, what is missing) before
   any still. The sketch sheet goes to Tzvi with the page plan (3aj.8), before
   the real site is built, unless the opening is already an event built from
```
DIGEST, section 3h. Old: `6. **Three concept stills before any clip**, the chosen one challenged once.`
New: `6. **Concepts as a sketch sheet** (0b.5b), never as paid stills; the picked row becomes the film as stills, seen whole before any clip (3aa.35).`
Why: six approvals stood before one film. Two sittings stay: the sketch sheet (with the numbered steps and the
phone question) and the sheet of stills.

**M6. "Style frames" (3c.11).** FULL, section 3c, item 11. Old:
```
    Before any video is sent, look at the sheet, fix, render again. Anything
    paid (generated stills or clips) waits for the owner's yes on two or
    three style frames.
```
New:
```
    Before any video is sent, look at the sheet, fix, render again. Anything
    paid waits for its yes on the design board (3aj.8): pictures for the pick
    of the first screen, clips for the film as stills.
```
DIGEST, section 3c, item 11. Old:
```
    length or the stops changed. Paid
    generation waits for the owner's yes on two or three style frames.
```
New:
```
    length or the stops changed. Paid
    generation waits for its yes on the design board (3aj.8).
```
Why: one more approval that the board now covers.

**M7. One study a build (3g.17).** FULL, section 3g, item 17. Just above the line that starts
`    **Every piece, not only every page** (Tzvi, 7 Oct 2026, after the Blazin'` insert:
```
    **One study a build, since 22 Nov 2026** (Tzvi: merge the repeats, drop what
    is unnecessary). The searches are run once, in the study phase, and written
    in REFERENCES.md. A fresh search of its own is kept for three pieces only:
    the first screen, the showpiece (3ah.5) and the product card. Every other
    piece (a button, an arrow, a list effect) comes from the starter's kit or
    the effects library, its source named on CONCEPT.md's `## Effects` line, and
    check-fingerprints still refuses a set too like another site's. Where the
    paragraph below asks for a search for every piece, this one wins. Rejected:
    a search for every piece (dozens a build; Inspo's own budget is one
    recommend, one or two searches and three to five screens).
```
DIGEST, section 3g, item 17. Old:
```
17. **Unique effects from fresh Mobbin, 21st and Inspo searches** (the single
    home of the fresh-search rule): one of each for every piece (the button,
    the arrow, each card or list effect, each section), for this business,
    before the effects library is opened; say for each pick where it came from
    (a new search, named, or the library) in CONCEPT.md and the reply. An effect
```
New:
```
17. **Unique effects, from one study a build** (the single home of the
    fresh-search rule; changed 22 Nov 2026): Mobbin, 21st, Inspo and Pinterest
    are searched once for this business (REFERENCES.md), with a fresh search of
    its own only for the first screen, the showpiece and the product card.
    Other pieces come from the kit or the effects library; say for each pick
    where it came from in CONCEPT.md and the reply. An effect
```
Also FULL, section 0b, item 4. Old: `4. **Research before building**: Mobbin and 21st per section (§3g.17). Both`
New: `4. **Research before building**: one study a build (§3g.17). Both`
And DIGEST, section 0b, item 4. Old: `4. Mobbin and 21st per section before building (3g.17). **Every source before any idea**`
New: `4. One study a build before building (3g.17). **Every source before any idea**`
Why: a search for every button and arrow is dozens a build and found little.

**M8. The signature sections (3ad.1).** FULL, section 3ad, item 1. Old:
`   site's publish; that it really is this business's own is a LOOK.`
New:
`   site's publish; that it really is this business's own is a LOOK. The showpiece (3ah.5) may be one of the two, on a signature line of its own.`
DIGEST, section 3ad. Old: `task, each on a `- signature: #id | what | from: ...` line in CONCEPT.md `## Body` (check-signature-body).`
New: `task, each on a `- signature: #id | what | from: ...` line in CONCEPT.md `## Body` (check-signature-body); the showpiece (3ah.5) may be one of the two.`
Why: a signature moment, two signature sections and a showpiece were three special sections on every site.

### D. The menu (FULL and DIGEST)

**N1. 3ai.2 becomes the menu.** FULL, section 3ai, item 1. Old:
`   pattern or texture, a drawn mark used as ornament, a travelling object, scallops under links or buttons. They are`
`   chosen at step 6 from the references (3ag.6) and written in CONCEPT.md as`
New:
`   pattern or texture, a drawn mark used as ornament, a travelling object, scallops under links or buttons. They are`
`   chosen with the page plan (phase 5) from the menu below and the references (3ag.6) and written in CONCEPT.md as`

FULL, section 3ai, item 2. Old (four lines):
```
2. **The rules that ask for a decoration are choices among the three**: the mark (3af.1), the travelling object
   (3ae.2), the loose photos (3af.3) and the colour cards (3af.4) each count as one when used. A site that uses
   all four asks Tzvi first. Labels above headings (3ag.5) are plain small type, not a ribbon or badge, and do not
   count.
```
New:
```
2. **The decorations are a menu, not a list to complete** (Tzvi, 22 Nov 2026: a site that followed every "each
   site has" rule had the same thirteen parts as the last one). Each new site picks three at most, from what its
   picked first screen and its references do (their `Take:` lines, 3aj.1), and names them on the `- treatments:`
   line. The menu:
   - something of theirs crosses a section line (3ae.1, marked `data-cross`);
   - one object of theirs travels with the visitor (3ae.2, marked `data-travel`);
   - a drawn mark of their own (3af.1);
   - loose photos to play with (3af.3);
   - a colour card for each product (3af.4);
   - one card over the edge of the next section (3z.1);
   - live art drawn in code behind the words (3ak.1);
   - any small touch of 3bb that is there for looks.
   One that is not picked is answered `n/a: not picked (treatments)`. A site that wants a fourth asks Tzvi first.
   These do not count: the owner's signed note (3af.2), which is words and photos and is used whenever the owner
   gave them; a 3bb touch that only states a true fact; labels above headings (3ag.5), which are plain small type.
   Still asked of every new site, because they are how a site works or what makes it its own: the order flow, the
   basket, the menu bar and the footer (3k, 3v.1, 3v.2); the three facts (3v.14); two signature sections, one of
   which may be the showpiece (3ad.1, 3ah.5); the rhythm (3ad.3); the one small touch (3p.5); and every honesty,
   phone, speed and accessibility rule. Rejected: asking each of them of every site (check-seams' own header: eight
   real shops were tried and none crossed a section line).
```
DIGEST, section 3ai. Old (the whole paragraph under the heading):
```
Full text: reference/full-rules.md section 3ai. Beyond photos, grounds and type, a site uses three decorations at most
(edges, ribbons, tinted cards, tilted prints, patterns, a mark as ornament, a travelling object), chosen at step 6 from
the references and listed on CONCEPT.md's `- treatments:` line; a fourth needs Tzvi's yes. 3ae.2, 3af.1, 3af.3 and 3af.4
each count as one when used. Labels above headings are plain small type. check-compared TREATMENTS. New sites only.
```
New:
```
Full text: reference/full-rules.md section 3ai. Beyond photos, grounds and type, a site uses three decorations at most
(edges, ribbons, tinted cards, tilted prints, patterns, a mark as ornament, a travelling object), chosen with the page
plan (phase 5) and listed on CONCEPT.md's `- treatments:` line; a fourth needs Tzvi's yes. **They are a menu, not a
list to complete** (22 Nov 2026): pick from what the picked first screen and the references do. The menu: a crossing
(3ae.1), a travelling object (3ae.2), a drawn mark (3af.1), loose photos (3af.3), colour cards (3af.4), a card over
an edge (3z.1), live art in code (3ak.1), a 3bb touch that is there for looks. One not picked is `n/a: not picked (treatments)`. Not counted:
the owner's note (3af.2), a touch that only states a true fact, plain labels above headings. Still asked of every
new site: order flow, basket, menu bar, footer, three facts, two signature sections (the showpiece may be one), the
rhythm, the one touch (3p.5), and every honesty, phone, speed and accessibility rule. check-compared TREATMENTS.
New sites only.
```
Why: this is Tzvi's decision. 3ai.2 already made four of them choices; 3ae.1, 3z.1 and 3bb were still asked of all.

**N2. 3ae (crossing and travelling).** FULL, section 3ae. Old:
`only Aidy Yaniv and Clean Plus had anything across a line, and no site had an object that travels.`
New: the same line, followed by a blank line and this paragraph:
```
**Both are choices since 22 Nov 2026 (3ai.2), not asked of every site.** A site that picks one names it on the
`- treatments:` line and marks it (`data-cross`, `data-travel`). check-seams judges only what the page marks.
```
Item 1, old: `1. **Something crosses the line.** At least one picture, film or object sits across the line between two neighbouring`
new: `1. **Something crosses the line.** When picked, one picture, film or object, marked `data-cross`, sits across the line between two neighbouring`
Item 1, old: `would cover words (3s.27). Mark a non-picture object `data-cross` to have it counted. Checked by`
new: `would cover words (3s.27). Checked by`
Item 2, old: `2. **One object travels with you.** One element, the business's own (the product from the opening, a balloon, the`
new: `2. **One object travels with you.** When picked, one element, the business's own (the product from the opening, a balloon, the`

DIGEST, section 3ae. Old:
```
Full text: reference/full-rules.md section 3ae. Our sections all stop at a straight edge.
(1) At least one of the business's own pictures or objects sits across the line between two home sections, 48 px into
each (mark a non-picture `data-cross`). (2) One object of the business's own, marked `data-travel` and planned on a
```
New:
```
Full text: reference/full-rules.md section 3ae. Our sections all stop at a straight edge. Both are choices from the
menu of 3ai, judged only when the page marks them.
(1) One of the business's own pictures or objects, marked `data-cross`, sits across the line between two home
sections, 48 px into each. (2) One object of the business's own, marked `data-travel` and planned on a
```

**N3. 3af (mark, note, loose photos, colour cards).** FULL, section 3af. Old:
`before 18 Nov 2026 (rule-dates.mjs). Each is planned in CONCEPT.md's `## Body` before layout and judged by LOOK.`
New: the same line, then on the next line:
```
**Since 22 Nov 2026 the mark (1), the loose photos (3) and the colour cards (4) are choices from the menu of 3ai.2.
The owner's note (2) is used whenever the owner gave the words and a photo; it is not a decoration.**
```
DIGEST, section 3af. Old:
`docs/inspo/awwwards-food-2026-10-18. Each planned on its`
New:
`docs/inspo/awwwards-food-2026-10-18. (1), (3) and (4) are choices from the menu of 3ai; (2) is used whenever the owner gave the words and a photo. Each planned on its`

**N4. 3z.1 and 3z.2.** FULL, section 3z.
- Old: `1. **One card hangs over the edge of the next section** on the home page, so the page stops reading as a stack of`
  New: `1. **A choice (3ai.2): one card hangs over the edge of the next section** on the home page, so the page stops reading as a stack of`
- Old: `2. **The first screen is three layers** (Herk; `sites/herk-60-30-10-depth.jpg`): at the back a real photo, the`
  New: `2. **When the picked first screen is layered (3aj.2), it is three layers** (Herk; `sites/herk-60-30-10-depth.jpg`): at the back a real photo, the`

DIGEST, section 3z. Old:
```
Full text: reference/full-rules.md section 3z; frames in docs/inspo/videos-2026-11-10/sites. One card the visitor
would use hangs a third to a half over the edge of the next section on the home page, whole on a phone (3z.1). The
first screen is three layers: a real photo, film or shape at the back, words and card in the middle, the main
```
New:
```
Full text: reference/full-rules.md section 3z; frames in docs/inspo/videos-2026-11-10/sites. A choice from the menu
of 3ai: one card the visitor would use hangs a third to a half over the edge of the next section on the home page,
whole on a phone (3z.1). When the picked first screen is layered, it
is three layers: a real photo, film or shape at the back, words and card in the middle, the main
```

**N5. 3bb (small touches).** FULL, section 3bb. Old:
```
paths below are under `docs/inspo/`). They are a menu for new sites, never changes to a site already live
(new-rules-spare-made-sites): each new site picks at least three, the ones that fit its category and its story, names
them in CONCEPT.md on a `- touches:` line, and does not take the same three as the site built just before it. A touch
```
New:
```
paths below are under `docs/inspo/`). They are a menu for new sites, never changes to a site already live
(new-rules-spare-made-sites): a new site may pick the ones that fit its category and its story. No number is asked
(changed 22 Nov 2026: "at least three" here, beside 3ai's "three at most", gave every site the same count). A touch
that is there for looks is one of 3ai's three decorations and is named on CONCEPT.md's `- treatments:` line; one
that only states a true fact (who models the size, the price beside the booking) does not count. A site does not
take the same touches as the site built just before it. A touch
```
DIGEST, section 3bb. Old:
```
docs/inspo/subtle-touches-2026-11-12.md. Each new site picks at least three that fit its category and story, names them
on a `- touches:` line in CONCEPT.md, never the same three as the site before; only true facts in them; never added to a
site already live. Among them:
```
New:
```
docs/inspo/subtle-touches-2026-11-12.md. A menu: a new site may pick the ones that fit its category and story; no
number is asked. A touch that is there for looks counts as one of 3ai's three and is named on the `- treatments:`
line. Never the same as the site before; only true facts in them; never added to a site already live. Among them:
```

**N6. 3f.2 (the effect budget).** FULL, section 3f, item 2. Old:
```
   5a.7); at least three accents (an opening that arrives
   in order, one scroll-tied detail in the middle of the page, a payoff at the
   close that answers the signature); and quiet touches (sections ease in,
   buttons react to hover and press, tiles lift). Then tick each one off on
   the captured frames. One effect on an otherwise still page is a draft.
```
New:
```
   5a.7); the opening's arrival; the five moments of the motion line
   (3e.16c); any picked treatment that moves (3ai); and quiet touches
   (sections ease in, buttons react to hover and press, tiles lift). No number
   of accents is asked (changed 22 Nov 2026). Then tick each one off on the
   captured frames. One effect on an otherwise still page is a draft.
```
DIGEST, section 3f, item 2. Old:
```
   three accents (an arriving opening, a scroll-tied detail mid-page, a
   closing payoff that answers the signature); quiet touches (eased reveals,
```
New:
```
   the opening's arrival, the motion line's five moments (3e.16c) and any picked treatment that moves, no number
   of accents asked; quiet touches (eased reveals,
```
and in the line just above it, delete the two words `at least` that end the line
(`...(a 3h film opening is that signature); at least` becomes `...(a 3h film opening is that signature);`).

### E. Moves (when a thing is done)

**V1. SKILL: the steps.** Section 1 of this file. It is the main change.

**V2. SKILL: the Models paragraph follows the phases.**
- Old: `- **Ideas on Fable.** Steps 5 to 7's ideas (opening ideas, the "Own:" idea,`
  New: `- **Ideas on Fable.** Phase 3's ideas (opening ideas, the "Own:" idea,`
- Old (two lines):
  `- **Building on this session's model** (Opus, medium effort). Searches and the`
  `  step 11 review stay on Sonnet.`
  New:
  `- **Building on this session's model** (Opus, medium effort). Searches, and`
  `  phase 9's reviewer and judges, stay on Sonnet.`

**V3. The build order section points to the phases (0b).** FULL, section 0b. Old:
`a round with Tzvi. Done in this order, none of them happens.`
New: the same line, then a blank line and:
```
**The order itself is SKILL.md's twelve phases (22 Nov 2026).** The numbered lessons below keep their numbers,
because rules and the checklist cite them. Where a lesson's timing has changed, it says so. The short version: decide
with words, sketches and grey-box HTML first; pay for pictures only after Tzvi picks the first screen (3aj.2); pay for
clips only after his yes to the film as stills (3aa.35); one design board a build (3aj.8).
```
DIGEST, section 0b. Directly under the heading `## 0b. Build order (learned from the last builds, Tzvi 15 Oct 2026)`
and its blank line, insert the same four-line paragraph, then a blank line.

**V4. The blueprint's stage order, in words.** FULL, section 0b, item 0. Old:
```
   as a step, in build order (facts, photos, opening, sections, site structure, prices, order flow,
   motion, phone, finish), with what the record already decides filled in (the three facts, the footer
```
New:
```
   as a step, in build order (facts, order flow, prices, opening, sections, site structure, photos,
   motion, phone, finish), with what the record already decides filled in (the three facts, the footer
```

**V5. Photos are marked first and paid for after the pick (3ag.1, 0b.2, 3c.12).**
FULL, section 3ag, item 1:
- Old: `   **Decided at step 2, not after the build** (20 Nov 2026): re-lit phone photos still scored 3 of 5 for photos with two`
  New: `   **Decided when the photos are first looked at (phase 1), paid for once the first screen is picked (phase 6)** (20 and 22 Nov 2026): re-lit phone photos still scored 3 of 5 for photos with two`
- Old: `   judges, and every redesign round of Cakes by Tova stopped at 3.5 overall because of them. So at step 2 each photo is`
  New: `   judges, and every redesign round of Cakes by Tova stopped at 3.5 overall because of them. So in phase 1 each photo is`
- Old: `   the owner's own already look like the references. The plan and its credits go in the step 2 report, before layout.`
  New: `   the owner's own already look like the references. The plan and its credits (from get_cost) go in the phase 1 note. Nothing is paid for until Tzvi has picked the first screen (3aj.2): the layout decides the shape and the plain side each picture needs (Cakes by Tova's opening was built three times).`

DIGEST, section 3ag. Old: `product-match-sheet.py. Decided at step 2: each photo shop-ready, re-light, or styled shot (the same bake in a styled`
New: `product-match-sheet.py. Marked in phase 1, paid for in phase 6 after the first screen is picked: each photo shop-ready, re-light, or styled shot (the same bake in a styled`

FULL, section 0b, item 2. Old:
```
   (9:16). If it differs, extend it before the first draft with
   `scrollcraft/starter/extend_photo.py` (§3c.12): `pad`, one nano_banana_2
   fill per shape (about 1.5 credits each, named with the cost in the
   owner's first message), `paste`, `ultra`. The page is built on the
   extended pictures from the start, so it never ships zoomed or framed. A
```
New:
```
   (9:16). If it differs, note it now and extend it once the first screen is
   picked (3aj.2), before the real page is built, with
   `scrollcraft/starter/extend_photo.py` (§3c.12): `pad`, one nano_banana_2
   fill per shape (price from get_cost, named in the owner's first message),
   `paste`, `ultra`. The three first screens show the photo whole, with grey
   where it will be extended. The real page is built on the extended pictures
   from the start, so it never ships zoomed or framed. A
```
DIGEST, section 0b, item 2b. Old:
```
2b. Check every big photo's shape before the first draft (Tzvi, 27 Oct
   2026). An opening or full-screen photo that is not 16:9 (laptop) or 9:16
   (phone) is extended with `scrollcraft/starter/extend_photo.py` (pad, one
   nano_banana_2 fill per shape at ~1.5 credits, paste, ultra; rules 3c.12),
   never zoomed or framed. A real place keeps a crop and `data-crop-ok`.
```
New:
```
2b. Check every big photo's shape when the photos are first looked at (Tzvi,
   27 Oct 2026). An opening or full-screen photo that is not 16:9 (laptop) or
   9:16 (phone) is extended once the first screen is picked (3aj.2), with
   `scrollcraft/starter/extend_photo.py` (pad, one nano_banana_2 fill per
   shape, price from get_cost, paste, ultra; rules 3c.12), never zoomed or
   framed. A real place keeps a crop and `data-crop-ok`.
```
FULL, section 3c, item 12. Old:
```
    model resized or moved the photo). Done at build-order step 2 (§0b),
    before the first draft.
```
New:
```
    model resized or moved the photo). Done once the first screen is picked
    (3aj.2), before the real page is built.
```
Why: the styled shot copies the references' scene and the plain side depends on the layout. Both are known only
after the pick.

**V6. Clips are generated after the stills are approved (0b.6).** FULL, section 0b, item 6. Old:
```
6. **Run generation in the background while the page is written**, with a
   script that saves the job number and retries a slow status check (a read
   timeout lost a paid clip). Never wait idle on a clip.
```
New:
```
6. **Clips run in the background, and only after the stills are approved.** A
   clip is made once Tzvi has said yes to the film as stills (3aa.35) and the
   opening passes its checks with those stills in place (6a). Then it runs in
   the background while the rest of the site is finished, with a script that
   saves the job number and retries a slow status check (a read timeout lost a
   paid clip). Never wait idle on a clip. On Burnt, clips were paid for on
   setups he then rejected (22 Nov 2026).
```
DIGEST, section 0b, item 6. Old:
```
6. Generate in the background while writing the page; scripts keep the job
   number and retry slow status checks.
```
New:
```
6. Clips only after Tzvi's yes to the film as stills (3aa.35) and after the opening passes with those stills (6a);
   then in the background while the site is finished; scripts keep the job number and retry slow status checks.
```

**V7. Step numbers in the newer rules.** FULL:
- section 3e, item 16c. Old: `places it. At step 6, CONCEPT.md gets a `- motion:` line naming five moments`
  New: `places it. With the page plan (phase 5), CONCEPT.md gets a `- motion:` line naming five moments`
- section 3ag, item 6. Old: `6. **Compared before review.** Before the independent review (step 11), the home page's `screens.jpg` is put beside`
  New: `6. **Compared before review.** Before the independent review (phase 9), the home page's `screens.jpg` is put beside`
- section 3ah, item 5. Old: `showing her bakes for it). It is planned at step 6 with the ideas, written in CONCEPT.md as`
  New: `showing her bakes for it). It is planned with the page plan (phase 5), written in CONCEPT.md as`
- section 3aj, item 2. Old: `   - At step 6, before the rest of the site and before any paid picture for the first screen, the first screen is`
  New: `   - In phase 4, before the rest of the site and before any paid picture for the first screen, the first screen is`
- section 3aj, item 2. Old: `   - They are shown side by side in one artifact, and Tzvi picks one.`
  New: `   - They are shown side by side as part B of the design board (8), and Tzvi picks one.`
- section 3aj, item 4. Old: `   - At step 11, two fresh Sonnet subagents that did not build the site each score it beside the two top sites`
  New: `   - At the review (phase 9), two fresh Sonnet subagents that did not build the site each score it beside the two top sites`

DIGEST, section 3aj, item 2. Old: `2. At step 6, three first screens are made as plain HTML, one per reference: same colours, fonts, words and photos,`
New: `2. In phase 4, three first screens are made as plain HTML, one per reference: same colours, fonts, words and photos,`
and old: `   grey boxes for pictures to be generated, only the layout differs. They are shown side by side, Tzvi picks one, and`
new: `   grey boxes for pictures to be generated, only the layout differs. They are part B of the design board (8), Tzvi picks one, and`

**V8. The new rule 3aj.8 (the design board and the four yeses).** FULL, section 3aj: after item 7's last line
(`     it.`) and before `## 4. What is reported to the owner instead (content gaps)`, add a blank line and:
```
8. **One design board a build, and four yeses** (Tzvi, 22 Nov 2026: "fix the rules to make it in a good order and
   make our builds as quick and efficient as possible while creating the best outcome").
   - The cheap things are decided first: words, sketches, grey-box HTML. A paid picture waits for his pick of the
     first screen. A paid clip waits for his yes to the film as stills (3aa.35).
   - One artifact a build, "Design board: <business>", made from `gen/board/index.html` and republished from that
     same file, so its link never changes. The link is on CONCEPT.md's `- board:` line.
   - Four parts, filled in order: A the references with their `Take:` and `Skip:` lines and the `- avoids:` list;
     B the three first screens (2); C the home page in grey boxes with real words and prices, and the film as a
     sketch sheet (3h.6); D the film as stills (3aa.35).
   - Tzvi says yes four times: to the first screen (B, quoted on `- first screens:`), to the page plan and the
     sketch row (C, quoted on `- page plan:` and in the film brief), to the film as stills (D, `beats_seen`), and
     to the finished site before it is published. A site with no film has no D and three yeses.
   - Before he sees a part, the free scripts for that part have passed.
   - `gen/` is not published and does not make RULES.md stale, so the board can change freely.
   - Checked by `scripts/check-concept.mjs` (Board, Page plan). Worked example: the first site built to it.
   - Rejected: paying for pictures at the photo step (Cakes by Tova's opening was built three times), and three
     photoreal concept stills (two were paid for and thrown away).
```
DIGEST, section 3aj: after item 7 (the line `   all three).`) add:
```
8. One design board a build: `gen/board/index.html`, one artifact, the same link, on CONCEPT.md's `- board:` line.
   Parts: A references, B three first screens, C the grey-box page and the film sketch, D the film as stills. Tzvi
   says yes four times: first screen, page plan and sketch (`- page plan: Tzvi: "..."`), film as stills, finished
   site. Pictures are paid for after yes 1, clips after yes 3 (check-concept).
```

### F. Stale lines

**T1. DIGEST section 0: Higgsfield is API only.** Old (five lines):
```
- **Higgsfield**, connected two ways: the **MCP connection** for one-off
  stills, clips and upscales while building, and the **API** (Python SDK
  `higgsfield-client`, key in `HF_KEY` in a gitignored `.env.local`, never
  printed; worked example `backend/higgsfield_demo/main.py` in the
  MyIsraelRental repo) when a site or script must generate on its own. API
```
New:
```
- **Higgsfield, through the API only** (Tzvi, 2 Nov 2026; the hook
  `~/.claude/hooks/higgsfield-api-only.mjs` refuses a paid call through the
  MCP connection): the Python SDK `higgsfield-client`, key in `HF_KEY` in a
  gitignored `.env.local`, never printed; worked example
  `backend/higgsfield_demo/main.py` in the MyIsraelRental repo. API
```
Why: the old line invites a call the hook blocks.

**T2. DIGEST section 0: the skills list.** Replace from the line `**Skills (design-kit plugin)**` through the line
`- `interview-me`: only when there is no brief and the facts aren't available.` (fifteen lines) with:
```
**Skills**
- This skill is the router and the builder. The site and its opening are built with the starter
  (`scrollcraft/starter`: `sitekit.py`, `kit.opening_slides`, `slides.js`, `clipchain.py`).
- `design-kit:scroll-craft`: read for ideas, and used only for a scroll scene the starter's kit does not have.
  Its interview, its FINGERPRINTS list and its kie.ai generation are not used: the record answers the questions,
  `scrollcraft/fingerprints.json` is our list, and pictures come from the Higgsfield API.
- `design-kit:taste-skill` or `premium-web-design`: may draft one of the three first screens (3aj.2), so three
  hands give three layouts. Never a whole build: that gives their default look, not the reference's.
- The repo's `visual-diff` holds the built first screen to the mockup Tzvi picked. The repo's `dead-ends` checks
  that every control goes where it says. Use the repo's copies, not design-kit's: they know this project.
- `design-kit:image-to-code-skill`: only to read a mockup's screenshot. `motion-design-patterns`: read once, when
  the `- motion:` line is written (3e.16c).
- Not used in a site build: `design-kit:design-pipeline` (this skill is the router), `design-kit:redesign-skill`,
  `design-kit:brandkit` (BRAND.md is ours, 3x.7), `design-kit:design-loop` and
  `design-kit:page-conversion-review` (the reviewer of 3r.2 and the two judges of 3aj.4 do their job),
  `interview-me` and `superpowers:brainstorming` (section 1: never re-ask what the record answers; the owner
  message and Tzvi's four yeses replace them).
```
Why: the old list told a build to use scroll-craft as the engine and kie.ai for pictures. Rule 3aa says the opening
is built by `kit.opening_slides`, `slides.js` and `clipchain.py`.

**T3. DIGEST section 0: the Inspo line.** Old: `  not looks. The six-point checklist in section 3 came from this study.`
New: `  not looks. The six-point checklist in section 3 came from this study. One study a build (3g.17).`

**T4. SKILL: the Tools paragraph.** Old (seven lines):
```
Check what is connected first. Skills: `design-kit:scroll-craft` for any page
where scrolling drives the story, `design-kit:design-pipeline` if unsure which,
others as §0 lists. Before designing: Inspo, Mobbin, 21st (searched fresh on
every build, §3g.17) and our own `docs/inspo/`. Generation: Higgsfield through
the API, `get_cost` first; standing OK to generate what looks significantly
better than code, spend in the report (§0, §1). Browser pane for previews,
always with `?as=owner`, never a sign-in.
```
New:
```
Check what is connected first. The site and its opening are built with the
starter (`scrollcraft/starter`); `design-kit:scroll-craft` is read for ideas
and used only for a scroll scene the kit does not have. This file is the
router: no other skill runs a whole build (§0). Before designing: Inspo,
Mobbin, 21st, Pinterest and our own `docs/inspo/`, one study a build (§3g.17).
Generation: Higgsfield through the API only, `get_cost` first; standing OK to
generate what looks significantly better than code, spend in the report (§0,
§1). Browser pane for previews, always with `?as=owner`, never a sign-in.
```

**T5. Brightness of stills.** DIGEST, section 3h, item 11. Old:
`   "moody" by default); run `scripts/brightness.py` on every film and still`
New:
`   "moody" by default); run `scripts/brightness.py` on every film and still (opening stills of a product: `check-light-pool.py` instead, 3aa.33)`
(The next line, `   set (middle 33+, whole 22+, average 30+ of 100) and grade up or regenerate`, stays. Checklist line R3h.11 is
in K3. SKILL's old "`brightness.py` on every still and clip" goes with the old steps.)

**T6. FULL section 7: the options rule names its exception.** Old:
```
direction itself, says why in one line, and puts no options page to Tzvi or the
owner unless asked (3c.1, 8a).
```
New:
```
direction itself, says why in one line, and puts no options page to Tzvi or the
owner unless asked (3c.1, 8a), except the three first screens of 3aj.2.
```
Why: checklist line R7.1 already says so; the rule text did not.

**T7. SKILL: how a rule is retired.** In the section `## When Tzvi gives a new rule`, at its end, add:
```

A rule merged into another is never deleted: its checklist line moves to `## Retired` at the end of
`docs/rules-checklist.md` (`- R<old> -> R<new> (date): why`) and its record leaves
`docs/rules-as-blueprint/rules.json`. Live sites answered it, and the checks ignore a retired answer.
```

### G. The four approved rules from the Create With AI videos (new section 3ak)

Tzvi approved all four on 22 Nov 2026 (`docs/inspo/videos-2026-11-22/README.md`, the last "What is new to us" list).
In that README, add one line under that list: `All four approved by Tzvi, 22 Nov 2026: page rules 3ak.1 to 3ak.4
and ad step A27.1.` The README's uncommitted change and the four `cwai-*.png` pictures beside it go into this
commit: they are the rules' pictures.

**P1. FULL: new section 3ak.** After the new item 8 of section 3aj (change V8) and before
`## 4. What is reported to the owner instead (content gaps)`, add:
```
## 3ak. From the Create With AI videos (Tzvi, 22 Nov 2026: approved all four)

Four things his test sites did that our rules did not ask for. Notes and frames: `docs/inspo/videos-2026-11-22/`.
None is asked of a site published before 22 Nov 2026 (rule-dates.mjs).

1. **Live art drawn in code, behind the words: a choice.** A field of lines or dots drawn on a canvas behind the
   first screen or one section (`cwai-flow-field-hero.png`). It is on the menu of 3ai.2 and counts as one of the
   three decorations. When picked:
   - It is seeded from the business's name, so no two sites get the same pattern, and it uses only the site's own
     colours (BRAND.md).
   - It bends round the pointer on a device with a mouse (`hover: hover`) only. A phone gets fewer lines and no
     pointer effect. Under reduced motion it is drawn once and holds still.
   - It is `aria-hidden`, stops drawing when it is off screen, and the words over it still pass `readable.mjs`.
   - It is never on the product photo, the prices or the order form (4).
   - Planned on the `- treatments:` line. Checked by LOOK at laptop and phone with reduced motion on, plus
     `readable.mjs` for the words. Free to make: code, no generation.

2. **A scroll timeline in every film plan.** For each scene of a scroll film, one line says where in the scroll it
   starts and ends (as a percent of the opening), what moves, and when its words come and go
   (`cwai-scroll-timeline.png`). It is written with the sketch sheet (phase 5), shown on part C of the design board,
   and kept in `gen/chain.json` as a `scroll` line on each step, beside its `frame` and `word` lines (3aa.8,
   3aa.20). A step's words never show before its scene starts or after it ends. Our chain.json planned each clip
   but not its place in the scroll, so words and picture could drift apart. Checked by LOOK: each step's `scroll`
   line against the opening scrolled to 20, 50 and 80 percent, laptop and phone. A site with no film has none.

3. **The site's brand is carried into its ads.** BRAND.md (3x.7) gets a `## For ads` part when it is written
   (phase 3): the two or three colours an ad uses, the two fonts, the logo file, and the Design bans an ad keeps too.
   Every hand-made ad or new design for a business with a custom site reads it: ad step A27.1 in
   `docs/ad-rules-checklist.md` names the file and what was taken, and `scripts/ad-blueprint.mjs` refuses an answer
   that names no BRAND.md that exists. Until now the ad checklist never read the site's BRAND.md, so an ad and its
   site could look like two brands. Checked on the site side by LOOK (the part is there), on the ad side by the
   ad blueprint.

4. **Prices and order controls stay calm.** No tilt, 3D turn, parallax or scroll-tied effect on a price, a total,
   a quantity stepper, an Add button or the order button. They may arrive once with their section and answer a
   press within 3e.16b's limits. A highlight behind a price on hover (3bb, touch 11) is fine: it does not move the
   price. A button that flips or turns to show its price is not used on a new site. Checked by LOOK: point at,
   press and scroll past every price and order control, laptop and phone.
```

**P2. DIGEST: new section 3ak.** After the new item 8 of section 3aj and before the heading
`## 3ab. Proof that is seen and checkable (Tzvi, 12 Nov 2026)`, add:
```
## 3ak. From the Create With AI videos (Tzvi, 22 Nov 2026)

Full text: reference/full-rules.md section 3ak. New sites only.
1. A choice from the menu of 3ai: live art drawn in code behind the words, seeded from the business's name, in the
   site's colours; bends round the pointer on mouse devices only, fewer lines on phones, still under reduced motion,
   aria-hidden, words over it pass readable.mjs.
2. Every scroll film has a scroll timeline: a `scroll` line per chain.json step (where in the scroll it starts and
   ends, what moves, when its words come and go), written with the sketch sheet.
3. BRAND.md has a `## For ads` part (colours, fonts, logo file, bans). Every ad for the business reads it (ad step
   A27.1; ad-blueprint refuses an answer naming no BRAND.md that exists).
4. No tilt, 3D, parallax or scroll effect on prices, totals, steppers, Add or the order button.

```
The contents lists at the top of both files are rebuilt by the sync. Do not edit them by hand.

**P3. LIST: four new lines.**
In `## 2. Opening`, directly under the `R3aa.38 | ...` line:
```
R3ak.2 | Every scroll film has a scroll timeline: each chain.json step has a scroll line saying where in the scroll it starts and ends, what moves, and when its words come and go; no step's words show outside its scene | 3ak.2, 3aa.20 | LOOK: each step's scroll line against the opening at 20, 50 and 80 percent, laptop and phone; n/a with no film when:film
```
In `## 3. Sections and worlds`, directly under the new `R3aj.8 | ...` line:
```
R3ak.1 | A choice (3ai.2): when picked, live art drawn in code behind the words is seeded from the business's name, uses only the site's colours, bends round the pointer on mouse devices only, has fewer lines on a phone, holds still under reduced motion, is aria-hidden and is never on the product photo, prices or order form; n/a when not picked | 3ak.1, 3ai | LOOK: laptop and phone, reduced motion on, plus script: readable for the words over it
```
In `## 4. Photos and media`, directly under the `R3x.7 | ...` line:
```
R3ak.3 | BRAND.md has a "## For ads" part (the colours an ad uses, the two fonts, the logo file, the bans an ad keeps), and every ad for the business names it in its blueprint (ad step A27.1) | 3ak.3, 3x.7 | LOOK: BRAND.md's For ads part; the ad side is checked by `node scripts/ad-blueprint.mjs --check <name> 1`
```
In `## 5. Prices and savings`, directly under the `R3.14 | ...` line:
```
R3ak.4 | Prices and order controls stay calm: no tilt, 3D turn, parallax or scroll-tied effect on a price, a total, a quantity stepper, Add or the order button; a hover highlight behind a price is fine | 3ak.4, 3e.16b | LOOK: point at, press and scroll past every price and order control, laptop and phone
```
`when:film` on R3ak.2 means a site that answered `film: no` never reads it. The other three have no `when:`.

**P4. REG: four new records**, after the `R3aj.8` record:
```json
  {
   "id": "R3ak.1",
   "rule": "A choice (3ai.2): live art drawn in code behind the words, seeded from the business's name, quieter on phones, still under reduced motion",
   "how": ["ASK", "KIT"],
   "built_by": "Phase 5 - treatments: line picks it; to build: a starter part kit.live_art(seed, colours) that does the seed, the phone and the reduced-motion versions",
   "confirmed_by": "LOOK + readable.mjs",
   "status": "planned"
  },
  {
   "id": "R3ak.2",
   "rule": "Every scroll film has a scroll timeline: a scroll line per chain.json step (start and end in the scroll, what moves, when its words come and go)",
   "how": ["ASK", "EYE"],
   "built_by": "Phase 5 writes the timeline with the sketch sheet; phase 6 copies it into gen/chain.json as each step's scroll line",
   "confirmed_by": "LOOK: the scroll lines against the opening at 20, 50 and 80 percent",
   "status": "planned"
  },
  {
   "id": "R3ak.3",
   "rule": "BRAND.md has a ## For ads part, and every ad for the business names it (ad step A27.1)",
   "how": ["GEN", "ASK"],
   "built_by": "Phase 3 writes BRAND.md with its ## For ads part; ad-blueprint stage 1 asks for it (A27.1)",
   "confirmed_by": "LOOK on the site side; scripts/ad-blueprint.mjs BRAND_RULES on the ad side",
   "status": "planned"
  },
  {
   "id": "R3ak.4",
   "rule": "Prices and order controls stay calm: no tilt, 3D, parallax or scroll effect on them",
   "how": ["KIT", "EYE"],
   "built_by": "The starter's price row, stepper and Add carry no transform or scroll effect; the build adds none",
   "confirmed_by": "LOOK at laptop and phone",
   "status": "planned"
  }
```

**P5. The ad side of 3ak.3: where BRAND.md is read.** Today nothing in the ad system reads it. Four files.

`docs/static-ad-rules.md`: at the very end of the file, add:
```markdown

## 27. The site's brand in its ads (Tzvi, 22 Nov 2026)

A business with a custom site has `scrollcraft/builds/<folder>/BRAND.md`, and since 22 Nov 2026 it has a `## For ads`
part: the colours an ad uses, the two fonts, the logo file and the bans an ad keeps (page rules 3ak.3). Before any
picture, the ad's blueprint names that file and says which colours and fonts this ad takes from it and which ban it
keeps (A27.1). An ad and its site then read as one brand. A business with no custom site answers
`n/a: no custom site` and follows A3.5 as before. An in-app design answers `built by ...`, naming how the maker gets
the business's colours. Rejected: choosing an ad's colours from the photo alone when the site already has a brand
sheet (the ad and the site looked like two brands).
```

`docs/ad-rules-checklist.md`: in `## 1. The idea`, directly under the `A9g.10 | ...` line, add:
```
A27.1 | The site's brand: for a business with a custom site, name its scrollcraft/builds/<folder>/BRAND.md and say which of its colours and fonts this ad uses and which of its bans it keeps; or "n/a: no custom site". | 27, page rules 3ak.3 | decide since:2026-11-22
```
It sits in stage 1, so it is answered before any paid picture (stages 1 to 4 come first). `since:` spares every
blueprint written before today.

`scripts/ad-blueprint.mjs`: two edits. Old:
```js
const LOGO_RULES = new Set(['A4.6']);
```
New:
```js
const LOGO_RULES = new Set(['A4.6']);
const BRAND_RULES = new Set(['A27.1']);   // the site's BRAND.md, read before any picture (page rules 3ak.3, 22 Nov 2026)
```
Then, in `problems()`, directly above the line `      if (SHEET_RULES.has(it.id) && !/^n\/a:/i.test(g.plan)) {`, add:
```js
      // the site's brand carried into its ads: the answer names the site's BRAND.md, and that file exists
      if (BRAND_RULES.has(it.id) && !/^(n\/a: no custom site|built by )/i.test(g.plan)) {
        const files = [...g.plan.matchAll(/([\w./-]*BRAND\.md)/g)].map((x) => x[1]);
        if (!files.some((f) => fs.existsSync(path.resolve(ROOT, f)))) out.push(`stage ${s.n}, ${it.id}: name the site's BRAND.md (scrollcraft/builds/<folder>/BRAND.md) and what this ad takes from it, or "n/a: no custom site"`);
      }
```
Keep it above the SHEET block: that block's `else if` belongs to the SHEET `if` and must stay attached to it.

`docs/rules-as-blueprint/ad-rules.json`: add one record at the end of `rules`:
```json
  {
   "id": "A27.1",
   "rule": "For a business with a custom site, the ad names its BRAND.md and the colours, fonts and bans taken from it",
   "how": ["ASK"],
   "built_by": "ad-blueprint stage 1 asks for the site's BRAND.md (## For ads); to build: AdMaker reads the business's brand colours",
   "confirmed_by": "scripts/ad-blueprint.mjs BRAND_RULES (the named BRAND.md exists) + LOOK",
   "retried": false,
   "status": "planned"
  }
```
Why here: the blueprint's first stage is where an ad's look is decided before money is spent, and it is the gate
the `ad-gate` hook already reads.

Check for P5, on a throwaway blueprint (delete it after):
```bash
node scripts/ad-blueprint.mjs zz-brand-test && node scripts/ad-blueprint.mjs --check zz-brand-test 1 | grep A27.1   # "no answer" for A27.1
rm docs/ads/blueprints/zz-brand-test.md
```

---

## 3. What stays exactly as it is, and why

- **Every live site and every build folder.** Tzvi's rule: never alter a site he approved.
- **Every honesty, facts, copy, price, order-flow, basket, phone, speed and accessibility rule** (sections 1, 2,
  3j, 3k, 3l, 3s, 3x.8, 3aj.7, 3ac and their checklist lines). They are how a site works.
- **Required on every new site, on purpose:** the footer and the menu bar (3v.1, 3v.2), the three facts (3v.14),
  sections of different heights (3v.6), the rhythm (3ad.3), two signature sections (3ad.1), the showpiece
  (3ah.5), the one small touch (3p.5, check-concept asks for it), the one statement and the staged opening (3ah.1,
  3ah.8: Tzvi, 21 Nov, "we should always make it more like this"), photo-led cards (3ah.2 to 3ah.4), two grounds
  (3ag.3).
- **R5b.6 and R3ag.5** (labels above headlines). They clash and Tzvi has not decided. Not touched, and
  `check-look.mjs` HEADINGS is not touched.
- **R3g.13** (the first screen). It overlaps R3ah.1 but costs a kit build nothing: its register record is "built"
  and the blueprint ticks it by itself.
- **R3n.2, R3n.3, R3n.5 and the five wow-gate answers** in CONCEPT.md. `check-concept.mjs` still asks for all five.
- **R3k.2** (menu bar). It asks for more than R3v.2 measures (basket count, the phone menu).
- **`publish-page.mjs`, `check-build.mjs`, `check-ideas.mjs`, `judges.mjs`, `rule-dates.mjs`, `commit-rules.mjs`,
  `check-rule-copies.mjs`, `check-rule-homes.mjs`, `check-look.mjs`, `check-signature-body.mjs`, `site-has.mjs` and
  the three hooks.** They already do what the new order needs. `clipchain.py` already refuses a clip without
  `beats_seen`.
- **The digest's and the full rules' section numbers and the numbered lessons of 0b.** Rules and the checklist cite
  them (0b.1b, 0b.4, 0b.12). Only their timing words change.
- **Checklist ids whose number differs from the rule's** (R3aa.35 to R3aa.38). Sites answer them by id. The third
  column names the rule, and K3 now says so.
- **The 29 touches of 3bb and the effects of 3v.** They are already lists to choose from.
- **`reference/full-rules.md`.** The sync writes it. **CLAUDE.md.** Ask Tzvi before editing it; nothing here needs it.
- **`docs/category-mistakes.md`, `docs/judge-calibration.json`, `docs/page-review-checklist.md`.** In use, correct.
- **The draft's idea of sending the 211 LOOK lines to the reviewer.** It is the larger job of
  `docs/rules-as-blueprint/PLAN.md`. Not part of this change.
- **`AdMaker.jsx`, `AdStudio.jsx` and `check-ad-designs.mjs`.** Rule 3ak.3 is a written step for hand-made ads and
  new designs. The in-app maker is not changed here, so the drawing check is not triggered.

---

## 4. For Tzvi

1. Labels above headlines: R5b.6 says no label above every section, R3ag.5 says every headline has one. Which wins?
2. "Prices stay calm" (3ak.4) bans tilt, 3D and scroll effects on prices and order controls. Two things you liked
   earlier sit close to it: the button that flips to its price (B5) and the highlight behind a price on hover
   (touch 11). The spec keeps the highlight and stops the flip on new sites. Right?
3. Four checklist lines have a letter after the number (R0b.4i, R3e.11b, R3e.16b, R3e.16c). The blueprint and
   check-rules cannot see them, so no site answers them, and two checks tied to them run on every site however
   old. Fixing it needs your call on which sites it should then apply to.
4. Builds in progress that are not yet published (Burnt, and Krysp and Aaron Kaluszyner in this copy) will be asked
   for the design board and your quoted yes to the page plan when they next take main. OK, or spare them?
5. Does the one small touch (the cloud pointer kind) count as one of the three decorations? Today it does not.
6. Two signature sections stay required on every site, and the showpiece may be one of them. Enough, or should
   that be one?
7. The staged, side-lit opening on a deep ground (3ah.8) is asked of every site. You chose it on 21 Nov. It is the
   one "every site" look rule left. Keep it for all, or make it one of three first-screen options?
8. The owner's signed note is now used only when the owner gave the words. Should every owner be asked for it in
   the first message?
9. Nothing is pushed. Say when to push this to main.

---

## 5. How to verify

Run everything from `C:\Users\tzviw\Documents\mir-reorder`. If `node_modules` is missing, run
`node scripts/setup-worktree.mjs` first (check-seams needs Playwright).

**Step 1. Before any edit, save today's result for every build** (the three named ones are among them):
```bash
mkdir -p "$TEMP/reorder" && for b in scrollcraft/builds/*/; do n=$(basename $b); for s in check-rules check-concept check-ideas; do node scripts/$s.mjs $b >/dev/null 2>&1; echo "$n $s $?"; done; done > "$TEMP/reorder/before.txt"
```
Known today: bake-away, finest-cut and gremier-coffee pass check-rules and check-concept; finest-cut and
gremier-coffee pass check-ideas; bake-away fails check-ideas ("no IDEAS.md", an older site). That is the baseline,
not a fault to fix.

**Step 2. After the edits, the rule files agree with each other:**
```bash
node scripts/blueprint.mjs --order          # "blueprint: all 318 checklist rules have a build stage" (320 - 7 + 5)
node scripts/check-rule-copies.mjs --sync   # prints the files it synced
node scripts/check-rule-homes.mjs           # "rule homes: every page and ad rule has its section"
node scripts/check-rule-copies.mjs          # "rule copies: the repo and ~/.claude agree"
node scripts/check-seams.mjs --self-test    # "self-test: passes the page with both, fails the page with neither"
grep -cE '^R[0-9][0-9a-z]*\.[0-9]+[a-z]?\s*\|' docs/rules-checklist.md   # 322 (324 - 7 + 5)
node -e "console.log(JSON.parse(require('fs').readFileSync('docs/rules-as-blueprint/rules.json','utf8')).rules.length)"   # 322
node -e "console.log(JSON.parse(require('fs').readFileSync('docs/rules-as-blueprint/ad-rules.json','utf8')).rules.length)"   # 90 (89 + 1)
node scripts/ad-blueprint.mjs --designs     # passes as it does today: A27.1 carries since:2026-11-22, so older blueprints are spared
grep -cP "\x{2014}" .claude/skills/build-business-page/SKILL.md   # 0: no long dash in the new steps
```

**Step 3. No published site is worse off:**
```bash
for b in scrollcraft/builds/*/; do n=$(basename $b); for s in check-rules check-concept check-ideas; do node scripts/$s.mjs $b >/dev/null 2>&1; echo "$n $s $?"; done; done > "$TEMP/reorder/after.txt"
diff "$TEMP/reorder/before.txt" "$TEMP/reorder/after.txt"
```
Passing: the diff shows no line that went from 0 to 1 for a published build. The two unpublished builds (krysp,
aaron-kaluszyner) may newly fail check-concept on "Board" and "Page plan": that is rule 3aj.8 and is point 4 for
Tzvi. Then look at the three named builds by eye:
```bash
for b in bake-away finest-cut gremier-coffee; do node scripts/check-rules.mjs scrollcraft/builds/$b | tail -1; node scripts/check-concept.mjs scrollcraft/builds/$b; done
```
Passing: each prints `rules: every one of N rules answered for <site>` (N is 7 lower than today: 192, 222, 272) and
`concept ready for <site>`. No line says "not in docs/rules-checklist.md": that would mean S2 did not take.

**Step 4. The retired ids are truly ignored, and a wrong id is still caught.** bake-away's RULES.md answers R3n.1.
Step 3 passing proves the first half. For the second, without saving anything:
```bash
cp -r scrollcraft/builds/finest-cut "$TEMP/reorder/fc" && echo "R9z.99 pass: a made-up rule" >> "$TEMP/reorder/fc/RULES.md" && node scripts/check-rules.mjs "$TEMP/reorder/fc" | grep "R9z.99"
```
Passing: it prints `FAIL R9z.99: not in docs/rules-checklist.md`.

**Step 5. The blueprint's new order, on a copy:**
```bash
cp -r scrollcraft/builds/gremier-coffee "$TEMP/reorder/gc" && node scripts/blueprint.mjs --update "$TEMP/reorder/gc" && grep "^## Stage" "$TEMP/reorder/gc/BLUEPRINT.md"
```
Passing: stages read 1 Facts and words, 2 Order and booking flow, 3 Prices and savings, 4 Opening, 5 Sections,
6 Site structure, 7 Photos and media, 8 Motion, 9 Phone, 10 8b, 11 Finish. (`$TEMP` copies are outside the repo, so
`rule-dates` treats them as never published and `--update` adds the newer rules, R3ak.1 to R3ak.4 among them:
that is expected.)

**Step 6. The new gate fires and clears, on a copy:**
```bash
node scripts/check-concept.mjs "$TEMP/reorder/gc"
```
Passing: it lists "Board:" and "Page plan:" among its problems (a copy outside `scrollcraft/builds` counts as a new
build). Then add `- board: https://claude.ai/code/artifact/test` and `- page plan: Tzvi: "yes"` to the copy's
CONCEPT.md, create an empty `gen/board/index.html` in the copy, run it again: those two problems are gone.

**Step 7. SKILL.md reads right.** Read the new steps once from top to bottom. Each phase has: what, the scripts, a
gate, a cost. The four yeses are at phases 4, 5, 6 and 10. No phase pays for a picture before phase 6 or a clip
before phase 8.

**Step 8. Save (no push):**
```bash
node scripts/commit-rules.mjs "Rules reorder (Tzvi, 22 Nov 2026: \"make our builds as quick and efficient as possible while creating the best outcome\"): the steps become twelve phases, cheap decisions first, his four yeses before each spend, one design board a build (3aj.8); the decoration rules (3ae, 3af, 3z.1, 3bb, 3f.2) become a menu under 3ai's three; seven repeated checklist lines retired, never deleted; one study a build; stale lines fixed (Higgsfield API only, scroll-craft, brightness of stills); rules 3ak from the Create With AI videos (live art in code, a scroll timeline in the film plan, the site's BRAND.md read by its ads as ad step A27.1, calm prices)" scripts/blueprint.mjs scripts/check-rules.mjs scripts/check-push-rules.mjs scripts/pre-commit-check.mjs scripts/check-seams.mjs scripts/check-concept.mjs scripts/ad-blueprint.mjs docs/static-ad-rules.md docs/ad-rules-checklist.md docs/rules-as-blueprint/ad-rules.json docs/inspo/videos-2026-11-22/README.md docs/inspo/videos-2026-11-22/cwai-driftwave-before-after.png docs/inspo/videos-2026-11-22/cwai-flow-field-hero.png docs/inspo/videos-2026-11-22/cwai-liquid-shape-morphs.png docs/inspo/videos-2026-11-22/cwai-scroll-timeline.png docs/rules-reorder-spec.md
node scripts/check-push-rules.mjs HEAD      # "every rule the sites answer is in the rules list (HEAD)"
git status --short                          # only docs/build-order-plan-draft.md remains
```
The commit check runs `check-rule-copies`, `check-rule-homes` and `blueprint --order` again. If it refuses, read
what it prints and fix that; never `--no-verify`. End the commit message with the attribution line the session
gives.

## How we can do better

1. The checklist can only grow: until S2 there was no safe way to remove a line. Home: the `## Retired` list and
   SKILL's "When Tzvi gives a new rule". Use it each time a new rule covers an old one.
2. Rule text names step numbers, so every reorder leaves stale words. Home: "How a rule is added" in the full
   rules: name the phase by what it does ("with the page plan"), not by number. Add it?
3. Four checklist ids with a letter suffix are invisible to the scripts (For Tzvi, point 3). Home:
   `check-rule-homes.mjs` could refuse an id the blueprint cannot read. Add it?
4. The product itself: the menu takes each site's decorations from its own picked reference, so the next sites
   should stop sharing one skeleton. Worth checking on the first two sites built this way, side by side, as
   `docs/inspo/sameness-2026-11-17` did.
