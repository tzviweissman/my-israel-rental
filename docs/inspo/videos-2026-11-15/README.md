# Two Claude Code workflow videos, 15 Nov 2026

Tzvi: "watch these videos and see what we can add to be as efficient as possible and come out with the best quality outputs".
Method: auto-captions through yt-dlp, read in full. I skipped frames because both are talking heads with slides.

## 1. Simon Scrapes, "How the Top 1% Use Claude Code Differently" (J9NQTYUP6k0, 10 Oct 2026, 18 min)

The main idea: **write a brief, let Claude work, then check the result against a test it can run.** He doesn't plan up front.

- **The brief has three parts:** the task, the guardrails (what must not change, and who must not get an email), and what "done" looks like.
- **A runnable check of "done" improves results 2-3x** (Boris Cherny). Writing "double-check your work" in the prompt does nothing. A check that answers pass or fail does. It can be a script or a document to compare against. The stricter it is, the more mistakes it catches.
- **`/goal`** repeats "continue" until the check passes. A small model judges each turn, but it only reads the chat. So a vague goal stops too early. A good goal has:
  - one end state;
  - how to prove it;
  - what must not change;
  - a turn limit.

  His example: "/goal check-report passes, template unchanged, stop after 15 turns".
- **"think hard" is just words now.** Effort is a setting. Opus 5.5 on medium is the recommended default.
- **CLAUDE.md as an index:**
  - under 200 lines;
  - only what Claude can't guess, house ways, repeated gotchas and limits;
  - everything else is a path in backticks, with when to open it;
  - no `@` imports, which load the whole file every time;
  - point to each file straight from the index;
  - any file over 100 lines gets a contents list at the top, because only about the first 100 lines get previewed.
- **Skills should list only what Claude got wrong.** Run the job with no skill first, then write down the corrections. One tester ran 450 trials of 9 popular skill packs, and only 2 beat a dummy file of the same length. Ways to check a skill:
  - `claude plugin eval` scores the same task with and without the skill;
  - `/skill-doctor` shows what each skill costs and how often it is used.
- **Rules in capital letters should be deleted or turned into a hook.**
- **Subagents:** Claude now spins them up on its own. Set a cap. Move heavy research or connector steps into a subagent.

What to discount: an Agentic Academy (Skool) pitch twice, and "top 1%" in the title. The 2-3x and the 2-of-9 figures are quoted, not shown.

## 2. Ben AI, "Copy this Claude Mod, Never Overpay Claude Again" (_ioUbQftxBc, 14 Nov 2026, 16 min)

The main idea: **two dials.** The model decides how much Claude knows, and effort decides how hard it tries. Turning up effort never adds knowledge.

- **Haiku:** summarising, sorting, routing and simple read-only lookups. It is weak at judgment: about 20% worse on a hard search task.
- **Sonnet:** jobs where "done" fits in one sentence. Most skills with a fixed workflow fit this. A `model: sonnet` line at the top of a SKILL.md runs that skill on Sonnet. This works in Claude Code only.
- **Opus 5.5:** the daily driver and the best default. An Opus lead with up to 25 Sonnet subagents cost about a third less than Opus alone, for about the same score.
- **Fable 5.2:** open-ended work where judgment matters, with "more wisdom, creativity, and writing skills". It costs twice Opus per token.
- **Effort, stop at the first yes:**
  - back-and-forth or a simple job: low;
  - a hidden mistake would cost money or a client: high;
  - a long, critical job you walk away from: extra high (max rarely pays).
  - Everything else: medium. One simple redesign took 1 minute on low and 28 on max, with a similar result.
- **When an output is bad, ask:** did Claude not know enough (move to a bigger model), or not try hard enough (raise effort)? Fix it in this order:
  1. Fix the prompt (`/rewind`, or Esc twice).
  2. Give a reference or checklist to compare against, and ask for a list of differences.
  3. Raise effort by one level.
  4. Move to the next model up, at a *lower* effort.
- **Switching models mid-chat** pays the full cache again, and moving down loses the bigger model's thinking. Pick the model at the start, or write a handoff and open a fresh chat.
- **Mods:** a "Model Selector Pack" (4 mods): a model selector, a subagent model router, handoff and cache clock. It is free behind his email link (c.benai.co/htapt-free). We already have handoff and cache-clock from his earlier bundle. The selector and the router are new.

What to discount: an accelerator pitch twice. The "70% saved" is from one of his own runs.

## What already matches here

- The checks after each build (`publish-page --check`, check-rules, `check-ad-designs`, the hooks) are the "runnable done" both videos push.
- The commit hooks and gates are the "must-hold rule as a hook".
- Subagents already run on Sonnet ([[subagents-use-sonnet]]).
- Tzvi gets an HTML link after each change ([[always-send-html-link]]). That is the "one-page visual of what it did".
- The handoff mod is installed.

## Options (Tzvi, 15 Nov: "Do 1, 2 and 3"; 4 to 6 not adopted)

Done: 1 in the build-business-page skill (Models) and the ads line in CLAUDE.md; 2 removed the repo copies of image-to-code-skill, brandkit and redesign-skill (design-kit plugin has them; taste-skill stays because the cloud ui-audit reads it from the repo); 3 in the skill (Keep going until it passes).

1. **Pick the model for each kind of job, at the start of the chat.**
   - Fable for concepts: site ideas, film stories, ad ideas and headlines. These are where Tzvi has said "basic" or "bland".
   - Opus medium for building.
   - Sonnet subagents.
   - Hand off when the job changes kind, instead of switching mid-chat.
2. **Skill clean-up:**
   - Run `/skill-doctor` and `claude plugin eval`.
   - taste-skill, image-to-code-skill, redesign-skill, brandkit and visual-diff each exist twice: in `.claude/skills/` and in the design-kit plugin.
   - The three biggest are 410-455 lines each and load on every use.
3. **A `/goal` line for each build**, using the existing check, for example: "/goal `node scripts/publish-page.mjs <folder> <slug> --check` passes, no other site changed, stop after 20 turns". I haven't tested `/goal` here yet.
4. **Contents lists at the top** of the long rule files Claude reads. `docs/page-generation-rules.md` is 3,108 lines.
5. **Ben's Model Selector Pack:** Tzvi downloads the zip, then I install it and patch it for Windows as before ([[benai-mods-windows]]).
6. **The fix-a-bad-output order** (prompt, reference, effort, model) as a short line in the build-business-page skill.
