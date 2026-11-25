# Ben AI, "Anthropic Just Revealed How To 10x Your Claude Memory"

youtu.be/uYdbxzxRWl8, 16:20, 77K views.

How it was read: the transcript panel in Chrome. No frames: it is about memory files, not design.

## The one idea

Memory goes stale unless something rereads the chats and tidies it. Anthropic's "dreaming" (a Managed Agents
feature) does this; he copied the framework into a `/dream` skill that runs every night.

## Mechanics

- Claude Code has three memory layers: the global `~/.claude/CLAUDE.md`, the project CLAUDE.md, and the hidden
  `memory/` folder (a MEMORY.md index of one-line pointers plus topic files). We use exactly this layout.
- Anthropic's numbers as he quotes them: memory took Opus 5.5 "from about 66% to 84%" on one task; answering only
  from dream-built notes went "from 13% to 48%" as it dreamed over more sessions. Fewer memory files often worked
  better.
- The run has three roles:
  - **The lead** finds every chat since the last run, strips tool calls, keys and passwords, groups chats by kind of
    work, and backs up memory first.
  - **Analyzers** (one per group, in parallel) fix notes a chat proved wrong (keeping one line of the old version),
    add new lessons, and propose a global rule when the same correction shows up in different projects. Anything
    uncertain is held back. Their one instruction: "save lessons learned the hard way that are still true and not
    already written down somewhere else". Strict rules like "save only failures" made strong models worse.
  - **The organizer** merges duplicates, rewrites the index by topic under 200 lines, and proposes moving project
    notes up to the global CLAUDE.md.
- Everything goes on one HTML review page: keep, revert or comment each change. CLAUDE.md lines are only ever
  proposed. His example: it noticed he rejected its YouTube titles three times and wrote the rule "titles must be
  based on real outlier videos".

## What to ignore

- The accelerator, the agency, his Baalda app.
- "10x your memory" in the title: the numbers are Anthropic's on their tasks, not his.
- It needs the app open and the computer awake every night.

## What it means here

- This is about the process, not the sites. We already end tasks with "How we can do better" and keep FEEDBACK.md
  per build (3aj.6), and the `consolidate-memory` skill exists.
- What we lack is the cross-site half: **the same correction from Tzvi on two different sites** should become a
  proposed rule, and today that relies on whoever is in the session noticing. A script that reads every build's
  FEEDBACK.md and lists repeated corrections would do the analyzers' job for builds.
