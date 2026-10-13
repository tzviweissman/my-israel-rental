---
name: audit-followup
description: Work through the newest nightly UI audit report — verify each finding by rendering the page, fix the blockers, and push back on anything wrong. Use when asked to "do the audit follow-up", "check last night's audit", "go through the audit report", or at the start of a session after a nightly audit has run.
---

# Audit follow-up

Three cloud routines audit the site (who does what: `docs/audits/README.md`).
Each starts a local copy of the site in its sandbox, renders and tests what
it can, fixes up to five small safe things, and pushes its report and fixes
to its own `claude/<name>-<random>` branch. **Nothing reaches `main` until
this follow-up merges it.** The report's "Not checked" section says what its
sandbox could not run; that part is yours.

---

## 1. Gather the runs

```bash
bash scripts/audit-history.sh                       # all reports, every branch
git fetch -q origin && git branch -r --sort=-committerdate | grep claude/ | head -8
```

For each audit branch newer than the last follow-up, see what it changed
beyond `docs/audits/`: `git diff origin/main...origin/<branch> --stat`.
If the newest report is more than two days old, check the routines are
still running (`RemoteTrigger` list_runs) and say so.

## 1b. Review and merge

- Review every fix commit on the branch as you would a stranger's: read the
  diff, re-run the check it names, render it if it is visible. A fix you
  disagree with is reverted on the branch, with the reason, before merging.
- Then merge the branch into the working branch (report, `open-issues.md`,
  screenshots and the fixes you kept) and, with Tzvi's go-ahead to push,
  into `main`. Two runs may both have edited `open-issues.md`: keep every
  line from both.

## 2. Verify before you fix. This is the point of the exercise.

The auditor reasoned about the code without seeing it render. Some findings will
be wrong in ways only a render reveals: an element it thinks overlaps may be in
a container that clips, a contrast pair it computed may never appear together on
screen, a touch target it measured statically may grow at the breakpoint that
matters.

For anything that depends on layout, spacing, overlap, contrast-in-context or
size, **render it before you touch it**:

```bash
node scripts/screenshot.mjs   # check the file for the args it expects
```

Cover 1280 / 768 / 375, **both directions**. RTL is where this repo breaks.

Findings you can confirm by reading alone — a missing `he.js` string, an inline
`fontFamily: 'Playfair Display'`, a physical CSS property where a logical one
belongs, an em-dash in a visible string — do not need a render. Do not waste a
screenshot on them.

## 3. Fix, in this order

1. **Blockers**, but only the ones you confirmed. A blocker you could not
   reproduce goes to step 4, not into a fix.
2. **Should-fix items** where the fix is small and the evidence held up.
3. **Nits only if you are already in the file.** Do not open ten files for ten
   nits; that is a large diff of small opinions and it makes review harder.

Standards, non-negotiable, as everywhere in this repo:
- `brand/design-tokens.css` is law. Mind the shadcn collision: `--primary`,
  `--border`, `--muted` are HSL triplets, brand values are `--brand-*`.
- Green is functional only. Status, verified, available. Never a brand accent.
- Every user-facing string in `en.js` **and** `he.js`.
- Headings read `var(--font-head)`, never a literal font face.
- Real numbers or the line does not render.

## 4. Argue back. This section is required, not optional.

**Say what you rejected and why.** A follow-up that fixes everything the auditor
listed is a follow-up that was not thinking. The auditor is working from static
analysis and it will be confidently wrong sometimes.

For each rejected finding: what it claimed, what you actually observed, and the
evidence — a screenshot, a computed value, a line of code that makes it moot.

If a finding is wrong because the auditor lacks context that lives somewhere in
the repo, **fix that at the source**: add the note to `CLAUDE.md` or to
`.claude/skills/myisraelrental-frontend/SKILL.md` so tonight's run does not
repeat it. A recurring false positive is a documentation bug, not an auditor bug.

## 5. The improvement of the night

Part B of each report proposes one psychology-grounded improvement. **Do not
build it.** Read it, say whether you think it is right, and leave it for Tzvi to
rule on. Suggestions are cheap and shipping them silently is how a design system
drifts.

## 6. Report back

Keep it short:

- Findings verified, and how many were wrong.
- What you fixed, with the commit.
- **What you rejected and why**, with evidence.
- Whether you updated `CLAUDE.md` or the frontend skill, and what you added.
- Your one-line read on the improvement of the night.
- Anything the audit missed that you noticed while you were in there.

Commit the fixes separately from any documentation change, so the design fix and
the standards change can be reviewed on their own terms.
