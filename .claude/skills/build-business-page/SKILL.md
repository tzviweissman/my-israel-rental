---
name: build-business-page
description: Tzvi's complete method for building a website or landing page for a business (any site, any stack), including scroll cinematic pages. Use when building, redesigning or reviewing a business's home page, landing page, scroll page or AI-generated page, before showing it to the owner. Points to the same tools (design-kit skills incl. scroll-craft, Inspo, Mobbin, Higgsfield) and covers facts and honesty, copy voice, the category checklist, motion and video build rules, a worked cinematic example, and the review loop with four scripts (readability, cut-off, overlay alignment, preview video).
---

# Building a page for a business

The job in one line: **arrange what the business told you into the clearest
page for someone deciding whether to use them, without adding a single fact
of your own.**

This file is the steps, in order. The rules live in side files and are read
when a step names them; open the named section every time, never work from
memory of it. Every rule there is a defect that once reached Tzvi.

- `reference/rules-digest.md`: the short version of every rule, by section
  number (1, 2, 3, 3b to 3v, 4, 5, 6). "§3h" below means that section there.
- `reference/full-rules.md`: the complete rulebook (`docs/page-generation-rules.md`),
  for anything the digest does not settle.
- `reference/design-rules.md`: the page builder's design rules (v3); `reference/playbooks.md`:
  per kind of business; `reference/media-and-video.md`: generating, steadying,
  masking, encoding, recording.
- `examples/la-cholent/` (a finished cinematic page), `examples/effects-library/index.html`
  (35 tested effects), `examples/FINGERPRINTS-myisraelrental.md` (looks already used).
- `docs/rules-checklist.md` in the repo: every rule a finished site is judged on.

## Tools

Check what is connected first. Skills: `design-kit:scroll-craft` for any page
where scrolling drives the story, `design-kit:design-pipeline` if unsure which,
others as §0 lists. Before designing: Inspo, Mobbin, 21st (searched fresh on
every build, §3g.17) and our own `docs/inspo/`. Generation: Higgsfield through
the API, `get_cost` first; standing OK to generate what looks significantly
better than code, spend in the report (§0, §1). Browser pane for previews,
always with `?as=owner`, never a sign-in.

## Models (Tzvi, 15 Nov 2026)

- **Ideas on Fable.** Steps 5 to 7's ideas (opening ideas, the "Own:" idea,
  film stories, headlines) are written by one subagent with `model: "fable"`,
  given the record, the photo sheet, `REFERENCES.md` and the digest's §3g, §3h,
  §3n, §3t, §3ag and §3ah, with REFERENCES.md's `## Why they are a 5`, plus the section rules a plan most often breaks (3b.3 one
  solid button a screen, 3z.1 a card over an edge, 3u.3 the price a piece,
  check-fits' one screen a section). It writes them; you check them with the step's scripts as usual.
  This is the one exception to "subagents run on Sonnet".
- **Building on this session's model** (Opus, medium effort). Searches and the
  step 11 review stay on Sonnet.
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

1. **Fresh copy, then fetch the record.** Work in a new worktree of origin/main
   (§0b.1a) and turn its checks on: `git -C ../mir-<slug> config core.hooksPath
   .githooks`. `scrollcraft/starter/fetch_business.py`, real slug from the live
   record, every photo on one numbered sheet. Read everything they already told
   us; never re-ask it (§1, §0b.1). Its last lines (`record_facts.py`) say what
   the order form must send and what to ask first (§0b.1b).
2. **Look at every photo.** Duplicates, screenshots, small sizes, kinds (§3o.6,
   §3o.7). A big photo of the wrong shape is extended with
   `scrollcraft/starter/extend_photo.py`, never zoomed or cropped (§0b.2b, rules 3c.12).
   Mark each photo shop-ready, re-light, or styled shot (§3ag.1): a photo that
   cannot reach a 5 even re-lit (flat angle, mixed ground, casual tray) becomes
   a styled shot of the same bake, checked against hers; the opening and the
   showpiece always are, unless hers already look like the references. Plan
   it and its credits now, never after the build (Cakes by Tova stopped at
   3.5 of 5 on her photos). Re-light (`relight_photo.py`), then extend. The first screen must be at least 70%
   picture (3h.1, `check-site` OPENING), so plan now which opening photos get
   a plain side for the words (§3ag.4); a box beside the words fails (Cakes by
   Tova, 17 and 19 Nov 2026: the opening was built twice, then a third time).
3. **Ask the owner, once, then build while waiting.** Only about their
   business: missing facts, more photos, guarantee (§3j.1), FAQ with 5 to 8
   example questions (§3b.4), per-item choices for similar products (§3l.1),
   which number takes WhatsApp (§3o.4), prices against their menu (§0b.3).
   List every live-site write the build needs in the same message. Start
   building the moment it goes out; no placeholders on the page (§0b.2a).
4. **Blueprint.** `node scripts/blueprint.mjs <build>` writes BLUEPRINT.md;
   answer "This site has" (`--has film=yes|no <build>`: a "no" takes the 17
   video-only rules out, unread, and the files are checked for video later);
   then plan each stage (`--check <build> <stage>`) before building it (§0b).
   Every rule left in the stages is read and planned; none is skipped.
5. **Sources, then ideas.** `REFERENCES.md` and `node scripts/check-references.mjs <build>`.
   Before any idea, the two best sites of the category (Pinterest, Awwwards or
   Inspo) go into `## Why they are a 5`: five lines or more, each what they do
   and how this site will do it (§3ah.7). The site is planned to a 5 here, not
   found short of one at step 11. Then `IDEAS.md` (two saved pictures per idea, a kind no other site used) and
   `node scripts/check-ideas.mjs <build>`. Both pass before any idea is shown
   or any credit spent; hooks enforce it (§0b.4).
6. **Concept and look.** CONCEPT.md: category (§3t), style sheet (§3g.1),
   three or more opening ideas with one "Own:" idea, the wow-gate answers
   (§3n), the effect budget (§3f.2) and `## Effects` with sources and the
   `- touch:` line (§3p.5), and the `- showpiece:` line: one thing the visitor
   does, adapted from a top site of the category (§3ah.5). Plan the opening as
   one headline naming every offer, one line, one button (§3ah.1), cards led by
   their photos with choices in the sheet (§3ah.2), a shop that opens on its
   products (§3ah.3), and every priced listing item in the catalogue (§3ah.6,
   `check-listing-prices`). Write the look into `scrollcraft/fingerprints.json`;
   `node scripts/check-fingerprints.mjs <build>` and `check-concept.mjs` pass
   (§3p, §3q). Choose it yourself and say why in one line.
7. **Film, if there is one.** Sketch sheet first and Tzvi picks a row (§0b.5b);
   a physically possible story, every object's source and end listed (rules 3h.18);
   confirm the motion as numbered steps; plan the phone frame; three concept
   stills; `brightness.py` on every still and clip; check-clip on every clip
   (§3h, §3o.1, §1). Generate in the background while writing the page.
   Before the sketch sheet, plan every film rule in BLUEPRINT.md
   (`node scripts/blueprint.mjs --check <build> film`: rules 3aa and every film
   line) and draw the sketches to them; a row that breaks one names the rule for
   Tzvi. The film gate refuses paid clips until it passes.
8. **Build from the starter** (`scrollcraft/starter`, §3p.1) as a website,
   not a page: pages by kind, one menu bar, full footer, Shop with steps, basket
   between pages, orders saved before WhatsApp (§3k, §3v). While building,
   follow: facts and claims (§1), copy (§2), the first screen (§3g.13), the
   category checklist (§3, §3b), design and persuasion (§3c, §3e, §3g, §3i,
   §3s), honest deals (§3j), similar products (§3l), owner-filled places (§3m),
   design and story (§4), build rules (§5). The day the form first sends,
   `node scripts/check-order-data.mjs <form page>` (§0b.8a).
9. **Whole page right with a still, then the film.** Build and check with a
   still where the film goes, then put it in and check again; new motion tried
   on `scrollcraft/starter/kit/test.html` first (§0b.6a).
10. **Check it.** Render at the six sizes of §3p.6, both languages, reduced
    motion, phones as phones (§6.1, §6.2). Run every check on every page:
    `readable.mjs`, `clipped.mjs`, `cutoff.mjs`, `scroll-finish.mjs` for each
    scroll-tied effect, `overlay-truth.mjs` for anything placed on a picture,
    `cutout.py --check` for cut-outs (§6.3), and `check-fits`, `check-site`,
    `check-motion`, `check-text-fits` (§3r, §3s). Fix and run again until a full pass is clean.
11. **Beside the best of its kind, then someone else reviews it.** First put the home
    page's screens.jpg beside two of the best sites of its category (Pinterest,
    Awwwards or Inspo): `node scripts/compare-sheet.mjs <build> <pic 1> <pic 2>`,
    then REFERENCES.md `## Compared` with each difference and what you changed
    (`check-compared`; §3ag). Photos shot for a shop (`relight_photo.py`), big
    product cards, two grounds, one headline size are §3ag's, and planned from
    step 6, not found here. Then a Sonnet subagent that did not build it, against
    `docs/page-review-checklist.md`; fix every FAIL, it looks again (§3r.2). Score
    the wow gate (§3n). Then a Sonnet judge that did not build it rates
    compare.jpg from 1 to 5 against the references, and review.md gets
    `Rating: N/5`; under 5, fix and judge again before anyone sees it (§3ah.7,
    `check-build`). Planned well at steps 5 and 6, this is a 5 the first time.
12. **RULES.md.** Answer every line of `docs/rules-checklist.md` and pass
    `node scripts/check-rules.mjs <build>` before anyone sees the site (§6).
13. **Report.** Ends with "Not done yet" and "For your call", after a
    shorter-version pass on every long line (§0b.10a). Videos for Tzvi at 1.5x
    with an HTML link, recorded with `scripts/record.mjs` from the live page,
    contact sheet looked at first (§3c.11). A video for the owner plays at
    normal speed (`--speed 1`); send its `-whatsapp.mp4` copy.
14. **Publish.** `node scripts/publish-page.mjs <folder> <slug> --check` lists
    every problem; then publish (it re-records the preview clip). Afterwards
    `check-showcase-previews.mjs` and `check-business-pages` on live (§0b.12).
    Run publish-page in the background (`run_in_background`), never in the
    foreground: re-recording the preview passes 10 minutes on long sites and the
    run gets cut off (The Gift Boutique, 16 Nov 2026). Pushing to main runs
    `check-push-rules` (.githooks/pre-push): push a new rule together with the
    sites whose RULES.md answer it.

## Fixing a fault on a site already live

After the edit and the publish, run the check that found the fault again on the
published page (served from `frontend/public`, or live after the deploy) and
look at it at that size. The edit alone proves nothing: an older, more specific
rule in the same file can win (The Gift Boutique, 16 Nov 2026: `body .brand span`
beat the new `.brand span` fix, and only `check-text-fits` caught it). Keep the
fix to the sizes that were wrong, so every other size stays as approved, and add
a dated line to that site's RULES.md saying what changed.

## When Tzvi gives a new rule

Follow "How a rule is added" at the end of §6: find every line it touches,
show a before and after picture and get his yes, try it on every live site it
covers, make its check fail before and pass after. Then, the same day, in this
order: the full text in `docs/page-generation-rules.md` (its one home), a short
version in the section of the same number in `reference/rules-digest.md` (what
builds read, so keep it short), and its line in `docs/rules-checklist.md`
naming that section. Run `node scripts/check-rule-copies.mjs --sync` (copies the
full rulebook into `reference/full-rules.md` and this skill to the loaded copy)
and `node scripts/check-rule-homes.mjs`; the commit is refused until both pass.
