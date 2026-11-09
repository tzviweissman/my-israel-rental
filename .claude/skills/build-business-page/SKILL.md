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

## The steps

1. **Fetch the record.** `scrollcraft/starter/fetch_business.py`, real slug from
   the live record, every photo on one numbered sheet. Read everything they
   already told us; never re-ask it (§1, §0b.1).
2. **Look at every photo.** Duplicates, screenshots, small sizes, kinds (§3o.6,
   §3o.7). A big photo of the wrong shape is extended with
   `scrollcraft/starter/extend_photo.py`, never zoomed or cropped (§0b.2b, rules 3c.12).
3. **Ask the owner, once, then build while waiting.** Only about their
   business: missing facts, more photos, guarantee (§3j.1), FAQ with 5 to 8
   example questions (§3b.4), per-item choices for similar products (§3l.1),
   which number takes WhatsApp (§3o.4), prices against their menu (§0b.3).
   List every live-site write the build needs in the same message. Start
   building the moment it goes out; no placeholders on the page (§0b.2a).
4. **Blueprint.** `node scripts/blueprint.mjs <build>` writes BLUEPRINT.md;
   plan each stage (`--check <build> <stage>`) before building it (§0b).
5. **Sources, then ideas.** `REFERENCES.md` and `node scripts/check-references.mjs <build>`;
   then `IDEAS.md` (two saved pictures per idea, a kind no other site used) and
   `node scripts/check-ideas.mjs <build>`. Both pass before any idea is shown
   or any credit spent; hooks enforce it (§0b.4).
6. **Concept and look.** CONCEPT.md: category (§3t), style sheet (§3g.1),
   three or more opening ideas with one "Own:" idea, the wow-gate answers
   (§3n), the effect budget (§3f.2) and `## Effects` with sources and the
   `- touch:` line (§3p.5). Write the look into `scrollcraft/fingerprints.json`;
   `node scripts/check-fingerprints.mjs <build>` and `check-concept.mjs` pass
   (§3p, §3q). Choose it yourself and say why in one line.
7. **Film, if there is one.** Sketch sheet first and Tzvi picks a row (§0b.5b);
   a physically possible story, every object's source and end listed (rules 3h.18);
   confirm the motion as numbered steps; plan the phone frame; three concept
   stills; `brightness.py` on every still and clip; check-clip on every clip
   (§3h, §3o.1, §1). Generate in the background while writing the page.
8. **Build from the starter** (`scrollcraft/starter`, §3p.1) as a website,
   not a page: pages by kind, one menu bar, full footer, Shop with steps, basket
   between pages, orders saved before WhatsApp (§3k, §3v). While building,
   follow: facts and claims (§1), copy (§2), the first screen (§3g.13), the
   category checklist (§3, §3b), design and persuasion (§3c, §3e, §3g, §3i,
   §3s), honest deals (§3j), similar products (§3l), owner-filled places (§3m),
   design and story (§4), build rules (§5).
9. **Whole page right with a still, then the film.** Build and check with a
   still where the film goes, then put it in and check again; new motion tried
   on `scrollcraft/starter/kit/test.html` first (§0b.6a).
10. **Check it.** Render at the six sizes of §3p.6, both languages, reduced
    motion, phones as phones (§6.1, §6.2). Run every check on every page:
    `readable.mjs`, `clipped.mjs`, `cutoff.mjs`, `scroll-finish.mjs` for each
    scroll-tied effect, `overlay-truth.mjs` for anything placed on a picture,
    `cutout.py --check` for cut-outs (§6.3), and `check-fits`, `check-site`,
    `check-motion` (§3r, §3s). Fix and run again until a full pass is clean.
11. **Someone else reviews it.** A Sonnet subagent that did not build it, against
    `docs/page-review-checklist.md`; fix every FAIL, it looks again (§3r.2). Score
    the wow gate (§3n).
12. **RULES.md.** Answer every line of `docs/rules-checklist.md` and pass
    `node scripts/check-rules.mjs <build>` before anyone sees the site (§6).
13. **Report.** Ends with "Not done yet" and "For your call", after a
    shorter-version pass on every long line (§0b.10a). Videos for Tzvi at 1.5x
    with an HTML link, recorded with `scripts/record.mjs` from the live page,
    contact sheet looked at first (§3c.11).
14. **Publish.** `node scripts/publish-page.mjs <folder> <slug> --check` lists
    every problem; then publish (it re-records the preview clip). Afterwards
    `check-showcase-previews.mjs` and `check-business-pages` on live (§0b.12).

## When Tzvi gives a new rule

Follow "How a rule is added" at the end of §6: find every line it touches,
show a before and after picture and get his yes, try it on every live site it
covers, make its check fail before and pass after. Add it to `full-rules.md`,
to the matching section of `reference/rules-digest.md`, and to
`docs/rules-checklist.md` the same day. Edit this skill in the repo copy
(`.claude/skills/build-business-page`), then `node scripts/check-rule-copies.mjs --sync`.
