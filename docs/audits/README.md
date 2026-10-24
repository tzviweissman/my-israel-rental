# How the audits run

Rules every MyIsraelRental audit follows, whichever one it is. Each audit's
own instructions (the skill named below) say *what* to look at; this file
says *how* to run, report and fix. Written 12 Oct 2026 after Tzvi asked
"can we make the audits better": the reports were landing on branches
nobody merged, re-finding the same issues, mixing guesses with confirmed
bugs, fixing nothing, and leaving most checks "not run" because the sandbox
had no browser, database or backend packages.

## Who looks at what (no overlap)

| Audit | When (UTC) | Skill | Looks at |
|---|---|---|---|
| Code review | nightly 22:00 | `.claude/skills/site-audit` | The last day's commits **outside** the visual layer: backend routes, data, security, prices, server.js, tests, build. |
| UI / UX review | daily 06:00 | `.claude/skills/ui-audit` | The last day's **visible** changes: pages as rendered, English and Hebrew, phone and laptop, hand-built business pages, order flows. Plus one improvement idea. |
| Dead ends | weekly, Sunday 22:00 | `.claude/skills/dead-ends` | The whole site: every button and link, every prompt that sends someone somewhere, every feature nobody can reach. |
| Audit follow-up | daily 07:15 UTC (10:15 Israel) | `.claude/skills/audit-followup` | Gathers the audits' fix commits not yet on main, reviews and re-checks each, and opens one pull request `Audit fixes <date>` for Tzvi; never merges or deploys itself (24 Oct 2026: two weeks of fixes had piled up unmerged). |

If a finding belongs to another audit's area, add it to `open-issues.md`
with a one-line note and leave the detail to that audit.

## 1. Set up first

```bash
bash scripts/audit-setup.sh      # ~5-10 minutes; read its summary
bash scripts/audit-history.sh    # every earlier report, from every branch
```

`audit-setup.sh` starts a local copy of the site with throwaway test data:
the database, the API on :8001, the site on :3210, Playwright with
Chromium, and the backend's packages. Open any page with `?as=owner` (or
`renter`, `provider`, `admin`) to be signed in. Never fetch
myisraelrental.com: the sandbox's proxy blocks it, and the local copy is
the better test anyway.

A step that prints FAILED is not a reason to stop. Put that line, verbatim,
under "Not checked" and do everything that does not need it.

## 2. Know what is already known

Read `/tmp/prior-audits/open-issues.md` (the newest copy, gathered from all
branches) and skim the last week's reports in `/tmp/prior-audits/`.

- An issue already on the list is **not new**. If it is still there, move
  it to "Still open" with its age, one line, no re-explaining.
- If it has been fixed, mark it fixed with the commit.
- Only genuinely new issues get the full write-up.

## 3. Confirm every finding, or drop it

A finding goes in the report only with proof that you saw it happen:

- a screenshot (saved under `docs/audits/shots/YYYY-MM-DD/`),
- a test or check that fails, with its output,
- a command that shows it (a regex accepting the bad input, a request
  returning the wrong status), or
- for copy and translation issues, the exact line of code.

Helper agents' and sweeps' results are leads, not findings. Something you
suspect but could not show goes under "Could not confirm", never mixed in
with the confirmed list.

## 4. Fix the small, safe things

Fix it yourself when **all** of these hold:

- the change is small (roughly under 20 lines) and obvious,
- it is one of: a copy-rule break (long dash, exclamation mark, wrong
  wording), a missing or wrong Hebrew string (written naturally, not
  translated word for word), a colour or contrast fix using an existing
  token, a broken link or label, or a one-line bug whose cause you proved,
- nothing about payments, sign-in, permissions, contracts or stored data
  changes (those are reported, never fixed by an audit),
- the relevant check passes afterwards: the test you added or ran, the
  build, a before-and-after screenshot for anything visible.

Each fix is its own commit, on this run's branch, with the reason in the
message. At most five fixes per run. Never push to `main`, never deploy,
never touch production data. If `gh` works, open one pull request titled
`Audit DD Mon: N fixes` against `main`; if not, the branch name in the
summary is enough, and the follow-up session merges it.

Everything else is reported for Tzvi to decide.

## 5. The report

Write `docs/audits/YYYY-MM-DD-<kind>.md`, starting with **the summary for
Tzvi**, in plain words for someone who is not technical:

```
# <Kind> audit, 12 Oct 2026

## In short
- Top issue in one sentence: what goes wrong, and for whom (customers,
  business owners, renters). No file names here.
- Up to two more.
- Fixed tonight: what, in plain words (and the branch or PR).
- Needs your decision: anything only Tzvi can decide.

## New findings        (confirmed; file:line, proof, exact fix, severity)
## Fixed this run      (commit, what was checked after)
## Still open          (one line each, with first-seen date)
## Could not confirm   (suspicions, with what would confirm them)
## Verified working    (what was checked and is fine)
## Not checked         (and why: copy FAILED setup lines here)
```

No long dashes. At most 10 new findings; say how many more you dropped.

Then update `docs/audits/open-issues.md` (start from the copy in
`/tmp/prior-audits/`): add new issues, mark fixed ones, keep each to one
line with severity, area, first-seen date and the report it came from.

## 6. Commit, push, notify

Commit the report, `open-issues.md`, any screenshots and the fixes, and
push this run's branch. Then send one push notification: the "In short"
section, nothing else. If nothing changed in your area since the last run
and nothing new was found, send no notification and write no report.
