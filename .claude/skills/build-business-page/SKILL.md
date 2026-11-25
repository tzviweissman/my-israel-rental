---
name: build-business-page
description: Tzvi's complete method for building a website or landing page for a business (any site, any stack), including scroll cinematic pages. Use when building, redesigning or reviewing a business's home page, landing page, scroll page or AI-generated page, before showing it to the owner. Points to the same tools (design-kit skills incl. scroll-craft, Inspo, Mobbin, Higgsfield) and covers facts and honesty, copy voice, the category checklist, motion and video build rules, a worked cinematic example, and the review loop.
---

# Building a page for a business

The job in one line: **arrange what the business told you into the clearest
page for someone deciding whether to use them, without adding a single fact
of your own.**

This file is the steps, in order. The rules live in side files and are read
when a step names them; open the named section every time, never work from
memory of it. Every rule there is a defect that once reached Tzvi.

- `reference/rules-digest.md`: the short version of every rule, by the full rulebook's section
  number (0, 0b, 2, 3, 3a to 3al, 5, 5a). "§3h" below means that section there.
- `reference/full-rules.md`: the complete rulebook (`docs/page-generation-rules.md`),
  for anything the digest does not settle.
- `reference/design-rules.md`: the page builder's design rules (v3); `reference/playbooks.md`:
  per kind of business; `reference/media-and-video.md`: generating, steadying,
  masking, encoding, recording.
- `examples/la-cholent/` (a finished cinematic page), `examples/effects-library/index.html`
  (35 tested effects), `examples/FINGERPRINTS-myisraelrental.md` (looks already used).
- `docs/rules-checklist.md` in the repo: every rule a finished site is judged on.

## Tools

Check what is connected first. The site and its opening are built with the
starter (`scrollcraft/starter`); `design-kit:scroll-craft` is read for ideas
and used only for a scroll scene the kit does not have. This file is the
router: no other skill runs a whole build (§0). Before designing: Inspo,
Mobbin, 21st, Pinterest and our own `docs/inspo/`, one study a build (§3g.17).
Generation: Higgsfield through the API only, `get_cost` first; standing OK to
generate what looks significantly better than code, spend in the report (§0,
§2). Browser pane for previews, always with `?as=owner`, never a sign-in.

## Models (Tzvi, 15 Nov 2026)

- **Ideas on Fable.** Phase 3's ideas (opening ideas, the "Own:" idea,
  film stories, headlines) are written by one subagent with `model: "fable"`,
  given the record, the photo sheet, `REFERENCES.md` and the digest's §3g, §3h,
  §3n, §3t, §3ag and §3ah, with REFERENCES.md's `## Why they are a 5`, plus the section rules a plan most often breaks (3b.3 one
  solid button a screen, 3z.1 a card over an edge, 3u.3 the price a piece,
  check-fits' one screen a section). It writes them; you check them with the step's scripts as usual.
  This is the one exception to "subagents run on Sonnet".
- **Building on this session's model** (Opus, medium effort). Searches, and
  phase 9's reviewer and judges, stay on Sonnet.
- **Never switch the model mid-chat.** It pays for the whole chat again and a
  smaller model loses the bigger one's thinking. A new kind of job gets a
  handoff and a fresh chat.
- **A weak result:** fix the brief first, then compare against a reference and
  list the differences, then one effort level up, then a bigger model at a
  lower effort.

## Keep going until it passes (/goal)

When the build starts, give Tzvi this one line to paste (fill in the folder
and slug):

`/goal node scripts/publish-page.mjs <folder> <slug> --check prints "every check passes"; no other site in scrollcraft/builds or frontend/public/pages changed; stop after 25 turns`

The judge reads only the chat. So after each run, put the check's last line in
your reply, either "every check passes" or the problems it listed.

## The steps

Twelve phases, in this order (Tzvi, 22 Nov 2026: "the order is just as important as the rules themselves").
The cheap things come first: words, sketches, grey-box HTML. A paid picture waits for his pick of the first
screen. A paid clip waits for his yes to the film as stills. He says yes four times, each just before the next
costly thing. Every phase ends at a gate: a script, or his quoted words, never the builder's own opinion.

**The design board (§3aj.8).** One artifact a build, "Design board: <business>", made from
`gen/board/index.html` (written by the build; the starter has no template for it) and republished from that same
file each time, so its link never changes. Put the link
on CONCEPT.md's `- board:` line. Four parts, filled as the phases pass: A the references (phase 2), B three
first screens (phase 4), C the grey-box page, the film sketch and each scroll-tied effect as start, midpoint
and end pictures (phase 5, §3al.5), D the film as stills (phase 6). Tzvi answers in his own words, and they are copied to the line each gate names. A "no" or a change goes into
FEEDBACK.md first. Before he sees a part, the free scripts for that part have passed.

| Phase | Cost | Tzvi |
|---|---|---|
| 0 to 3 | free | none, except his OK to the live-site writes in phase 1 |
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
   numbered sheet. Read everything they already told us; never re-ask it (§2, §0b.1). Read the last lines
   (`record_facts.py`): what the order form must send and what to ask first (§0b.1b). Create FEEDBACK.md with
   `- none yet` (§3aj.6). `node scripts/blueprint.mjs <build>`, then `--has film=yes|no <build>`. Answer yes when any idea could be a film. It is
   set for good after his pick of the first screen.
   **Gate:** the record, the photo sheet, FEEDBACK.md and BLUEPRINT.md exist.
1. **Look, ask once, start the working parts (free).** Look at every photo: duplicates, screenshots, small
   sizes, kinds (§3o.6, §3o.7). Mark each one shop-ready, re-light or styled shot (§3ag.1), and note any big
   photo of the wrong shape (§0b.2b). These are decisions only. Nothing is paid for yet. Send the owner one
   message, only about their business: missing facts, more photos, guarantee (§3j.1), FAQ with 5 to 8 example
   questions (§3 (cont.) 4), per-item choices for similar products (§3l.1), which number takes WhatsApp (§3o.4),
   prices against their menu (§0b.3), the worry questions (§3c), reviews and the name each may show (3ab.3), servings
   per size (3u.3), lead time, closed days and the usual choice (3k.8), which size each photo shows (rules 8), the
   originals of any screenshot (§3o.7) and a photo of themselves (3e.22); only what the record does not already
   answer. List every live-site write the build needs (loading products, delivery settings) and ask Tzvi for all of
   them in one go before the first one (§0b.3). Then build what never changes
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
   **Gate:** `node scripts/check-references.mjs <build>` passes, and `node scripts/check-compared.mjs <build>` prints no
   NOFIVE line (its other lines wait for the judging).
3. **Ideas in words, and the brand sheet (free).** One Fable subagent (see Models) writes the opening ideas,
   the "Own:" idea, the film stories and the headlines into IDEAS.md. Run the one-sentence test on the words:
   "you land and ___ happens" must be about the business (§3n). Write BRAND.md: colours with their uses, two
   fonts, one radius, motion limits, the design bans taken from `docs/category-mistakes.md` (§3x.7), its
   `## For ads` part, which every ad for the business will read (§3ak), and its `## Image style` paragraph
   (light, colour, mood, three colours given to three named objects), pasted at the end of every image prompt
   of the build (§3al.6).
   Write the fonts and colours into `scrollcraft/fingerprints.json` (§3p). Its hero, layout and effects entries are
   finished with the page plan. Start CONCEPT.md: the category and the `- avoids:` line. The three
   strongest ideas go forward as the three first screens; none is chosen yet.
   **Gate:** `node scripts/check-ideas.mjs <build>` passes and `node scripts/check-fingerprints.mjs <build>` shows no
   font or colour clash (its EFFECTS lines wait for the page plan).
   The hooks block any paid generation until check-ideas does (§0b.4).
4. **Three first screens (free, then Tzvi).** Read the blueprint's Opening stage first. Build the first screen
   three times as plain HTML in `gen/board/` (`first-a.html`, `first-b.html`, `first-c.html`), one per
   reference. Same fonts from BRAND.md, same words, the owner's photos as they are. Each is a different opening
   type that fits the business (§3ah.8: a staged side-lit product, a light reveal, a split opening, a film,
   layered parallax...), each as dramatic and premium as Tova's, so Tzvi picks between real alternatives. A picture still to be made is a plain grey picture
   of its final shape. A photo of the wrong shape
   sits whole, with grey where it will be extended. Show each as a laptop frame beside a phone frame (§3aa).
   Plan each picture that words will sit on around where they sit (a quiet area or their own panel, never a shade
   over the light), on CONCEPT.md's `- words on pictures:` line (§3aj.11).
   Run `check-says-offer.mjs`, `check-five.mjs` and `readable.mjs` on each; fix or drop one that fails. Then two
   fresh Sonnet judges score each screen with `judges.mjs --brief` beside the two top sites; fix any under 4 and
   judge again before Tzvi sees them, the lines in `gen/board/judged.md` (§3aj.10). They are part B of the board. On the next new site (Tzvi, 22 Nov 2026), one of the three tries the split
   opening and one the panel wipe (§3al.7), both free code, set beside Ruben Stom's frames
   (`docs/inspo/videos-ruben-stom-2026-11-22/Op5kncXOL-A-split-intro-halves-opening.png`,
   `MJojygFwGjA-panel-rises-wipes-over-image-labels-up.png`), to see whether they stop our openings looking alike.
   **Gate, yes 1:** CONCEPT.md has
   `- first screens: gen/board/first-a.html gen/board/first-b.html gen/board/first-c.html; Tzvi: "<his pick>"`
   (§3aj.2). Then write `## Chosen` in IDEAS.md and CONCEPT.md, add its kind to `scrollcraft/motions.json`, and
   set `--has film=yes|no` to match his pick.
5. **The page in grey boxes, and the film in sketches (free, then Tzvi).** Write CONCEPT.md `## Body`: the
   `- sections:` line (§3ad), two `- signature:` lines, one of which may be the showpiece (§3ad, §3ah), the
   `- showpiece:` line, the `- treatments:` line, three at most, picked from the menu (§3ai, which lists
   3ak.1 and the choices of §3al.7), and the `- motion:` line (§3e), written with numbers: each moment's
   duration, distance or scale and stagger, what waits until the previous step has settled, alignments in
   pixels (§3al.4). No intro on a menu, prices or shop page, intros on the first visit only, parallax off on
   phones (§3al.8). Each scroll-tied effect gets a start, midpoint and end picture on the board (§3al.5).
   Write `## Effects` with its `- touch:` line (§3p). Write the five wow answers (§3n); the fourth names the two sites
   and is finished at the judging. Build the home page from the starter with real words and real prices, and a plain grey picture, at the final shape, wherever a picture is
   still to be made. Draw the showpiece at its final size and place, with its motion written beside it, never a small
   placeholder (§3aj.12). Run the sameness checks now, while a change costs nothing: `check-body-alike.mjs`,
   `check-rhythm.mjs`, `check-heights.mjs`, `check-signature-body.mjs`, `check-fits.mjs`.
   With a film (`film=yes`): `node scripts/blueprint.mjs --check <build> film`, then the sketch sheet
   `gen/storyboard.png`, a row per concept, drawn to those rules (§0b.5b); the motion as numbered steps
   (§0b.5); every object's source and end (rules 3h.18); how it really happens, from a real reference, and the key moment with
   its own clip (rules 3h.21); the Enough line (3aa.31); the scroll timeline, a line for each scene saying
   where in the scroll it starts and ends, what moves, and when its words come and go (§3ak); and the
   question of how phones get the film (3aa.26). The grey-box page and the sketch sheet are part C of the board.
   Two fresh judges score the grey-box page (told which part is the showpiece) before Tzvi sees it; under 4 is
   fixed and judged again (§3aj.10, `gen/board/judged.md`, its newest judging 4 or more).
   **Gate, yes 2:** CONCEPT.md has `- page plan: Tzvi: "<his words>"` (§3aj.8). With a film, the brief quotes
   his picked row and its "Phones asked:" line. `node scripts/check-concept.mjs <build>` and
   `node scripts/blueprint.mjs --check <build> 6` pass, `check-compared.mjs` prints no SHOWPIECE, TREATMENTS or MOTION
   line, and `check-fingerprints.mjs` passes in full.
6. **The pictures, then the film as stills (paid, small, then Tzvi).** Plan the Photos stage first
   (`node scripts/blueprint.mjs --check <build> 7`). Only then are pictures paid for: re-light
   (`scrollcraft/starter/relight_photo.py`), extend to the shape the picked layout needs
   (`scrollcraft/starter/extend_photo.py`), and the styled shots (§3ag.1). A brief before every paid picture
   (rules 8), `get_cost` first, one made and checked before the rest. `scripts/product-match-sheet.py` for
   every re-lit or styled product. Run `check-button-colour.mjs --suggest` on the picture the page will use, and
   correct BRAND.md and the meta if the colour moved.
   With a film: make each clip's start and end still, all of one scene from one base picture
   (`scrollcraft/starter/keep_change.py`, 3aa.17). The end still first, its prompt naming the room for the words;
   a clip where only light, smoke or steam moves says "static locked-off camera, nothing moves except the light"
   (§3al.1). One image model for the set, one change per edit (§3al.6). Check each still alone, in this order:
   `scripts/check-light-pool.py` (for stills it is the brightness check); `scripts/inspo-beside.py` with its
   colour grid and the `shot_seen` line (§3aj.5); a close crop of each hero object beside its inspo (3aa.34);
   then read the picture's `Skip:` line again against the still. A generated place or material is put beside its
   real photograph (`## Looks real`, rules 3w.15). Then write the brief's `## Clip plan` from the finished stills
   (rules 3w.10). Then one sheet of the whole film as stills:
   each clip's start and end, laptop beside phone, what moves (3aa.35). It is part D of the board.
   **Gate, yes 3:** `beats_seen` quotes his yes to every setup; `clipchain.py make` refuses a clip without it.
   A site with no film has no part D and no yes here: its gate is the product-match sheets.
7. **Build the real site, with the stills where the film goes (free).** Plan the last stages first
   (`node scripts/blueprint.mjs --check <build>`), and tick lines as they are built. Build from the starter
   (`scrollcraft/starter`, §3p.1) as a website, not a page. A site made by `gen/build.py` is changed in `gen/build.py`,
   `gen/own.css` or `gen/*.js` and rebuilt, never in the files it writes (§3aj.9, check-built): pages by kind, one menu bar, full footer, Shop with
   steps, basket between pages, orders saved before WhatsApp (§3k, §3v). While building, follow: facts and
   claims (§2), copy (§5), the first screen (§3g.13, §3ah), the category checklist and the sections every page has (§3b, §3), design and
   persuasion (§3c, §3e, §3g, §3i, §3s), honest deals and calm prices (§3j, §3ak), similar products (§3l),
   owner-filled places
   (§3m), design and story (§5a), build rules (§3a). The approved stills sit in the real opening
   (`kit.opening_slides`, `slides.js`), so the film can be scrolled as stills before any clip exists (§0b.6a).
   New motion is tried on `scrollcraft/starter/kit/test.html` first. Two habits (§3al.9): before a risky
   change (a new layout, a scroll effect, anything touching the order flow), write back in two or three lines
   what you understood, then build; and build each section from its own reference picture, still first, motion
   second. Hold the built first screen to the mockup Tzvi picked with the repo's `visual-diff` skill. No grey picture is left on any page.
   **Gate:** with `scripts/serve-builds.mjs` running, `node scripts/check-build.mjs scrollcraft/builds/<folder>`
   passes every line except `independent review`, `check-compared`, `check-rules` (its only `todo` lines are those of
   the clips, the judging, the report and the publish) and, with a film, the film checks. A real test order went
   through (§3g.12). Then `compare-sheet.mjs <build> <pic 1> <pic 2>`, with the same two sites as `## Why they are a 5`, and
   `## Compared` on the site with its stills; fix what it shows before
   the film goes in.
8. **The clips (paid, the largest spend; film only).** May start once yes 3 is in and the opening passes
   `check-photo-clear.mjs`, `readable.mjs` and `check-fits.mjs` with the stills in place. It runs in the
   background while phase 7 goes on. `scrollcraft/starter/clipchain.py`, one clip first. On every clip:
   `scripts/check-clip.mjs`, `brightness.py`, and its `end_seen` line. Two tries at most (§3w). A clip that
   fails changes the story, not only the prompt (rules 3h.19). Then `clipchain.py story`, read by someone who
   did not write the prompts (3aa.32), and encode: a poster for every clip, no sound, a smaller phone version,
   WebM beside the MP4 where the starter plays a file, the headline real HTML (§3al.3). Put the film in. At its
   end the film eases its playback rate down onto a sharp resting frame, never a hard stop or a freeze (§3al.2).
   **Gate:** `check-film-video.mjs`, `check-film-clear.mjs`, `check-opening-scroll.mjs`,
   `check-phone-opening.mjs` and `check-iphone.mjs` pass.
9. **Judged by people who did not build it (free).** Record the preview with the skill's `scripts/record.mjs` (with
   `--expect "<business name>"`, so a wrong site on that port stops it) and look at its contact sheet. Render at the six sizes of §3p.6, both languages, reduced motion, phones as phones
   (§3a). Run `node scripts/compare-sheet.mjs <build> <pic 1> <pic 2>` again, with the same two sites as
   `## Why they are a 5`, only if the page changed since phase 7, and bring REFERENCES.md's `## Compared` up to
   date (§3ag). Two Sonnet judges, each given only the brief `node scripts/judges.mjs --brief` prints
   (the look, never reviews or how much content; seven areas with wow), compare.jpg, the build's kept inspo and
   Pinterest pictures and
   that did not build it score layout, light, colour, type, detail and motion from compare.jpg and the preview's
   contact sheet, one `Judge N:` line each in review.md; the median plus Tzvi's calibration is the `Rating:`, 4 or
   more with no area under 3.5 (§3aj.4). Then a Sonnet subagent that did not build the site uses it against
   `docs/page-review-checklist.md`; fix every FAIL, it looks again (§3r.2). Its brief lists CONCEPT.md's quoted
   yeses, FEEDBACK.md's done items and the every-site parts (three facts, full footer, menu): an item that only
   repeats one of those is "PASS (Tzvi chose: ...)", never FAIL (§3aj.13). Finish the wow-gate answers (§3n). Do not also run
   `design-kit:design-loop` or `design-kit:page-conversion-review`: the reviewer and the judges do their job.
   **Gate:** `node scripts/check-build.mjs scrollcraft/builds/<folder>` prints "all N checks pass". It runs
   every script on every page, writes RULES.md from the blueprint, and runs check-rules, the judges and the
   feedback check, so none of them is run by hand.
10. **Tzvi sees the site (Tzvi).** Send the link to the local preview and the video already made in phase 9, at
    1.5x with an HTML link (§3c.11). New words from
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

## Fixing a fault on a site already live

After the edit and the publish, run the check that found the fault again on the
published page (served from `frontend/public`, or live after the deploy) and
look at it at that size. The edit alone proves nothing: an older, more specific
rule in the same file can win (The Gift Boutique, 16 Nov 2026: `body .brand span`
beat the new `.brand span` fix, and only `check-text-fits` caught it). Keep the
fix to the sizes that were wrong, so every other size stays as approved, and add
a dated line to that site's RULES.md saying what changed.

## When Tzvi gives a new rule

Follow "How a rule is added" at the end of §3a (cont.): find every line it touches,
say **when** it applies (which pages, which part of the picture, which situation) and compare it with the
rules on the same subject, giving each a "when" where two could seem to clash; call it a contradiction only
after tracing both rules' sources (his words, the cited inspo or notes, the commit that added them) and only
when one real situation cannot satisfy both;
show a before and after picture and get his yes, try it on every live site it
covers, make its check fail before and pass after. Then, the same day, in this
order: the full text in `docs/page-generation-rules.md` (its one home), a short
version in the section of the same number in `reference/rules-digest.md` (what
builds read, so keep it short), and its line in `docs/rules-checklist.md`
naming that section. Run `node scripts/check-rule-copies.mjs --sync` (copies the
full rulebook into `reference/full-rules.md` and this skill to the loaded copy)
and `node scripts/check-rule-homes.mjs`; the commit is refused until both pass.

A rule merged into another is never deleted: its checklist line moves to `## Retired` at the end of
`docs/rules-checklist.md` (`- R<old> -> R<new> (date): why`) and its record leaves
`docs/rules-as-blueprint/rules.json`. Live sites answered it, and the checks ignore a retired answer.
