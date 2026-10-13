---
name: ui-audit
description: Daily UI/UX review of MyIsraelRental's visible changes, rendered in a browser in English and Hebrew on phone and laptop, plus one psychology-grounded improvement idea. Use for the morning UI audit routine, or when asked to review how recent changes look.
---

# UI / UX audit

Read `docs/audits/README.md` first and follow it: setup, known issues,
proof for every finding, small safe fixes, the report shape, the
notification. This file only says what this audit looks at.

**Your area:** what a visitor or owner sees, changed in the last 26 hours.
Backend logic and security belong to the code review (`site-audit`); the
whole-site link sweep belongs to `dead-ends`.

## Step 1. Scope, and the silence rule

```bash
git log --since="26 hours ago" --oneline
OLDEST=$(git log --since="26 hours ago" --format="%H" | tail -1)
git diff --stat "${OLDEST}^" HEAD -- frontend/ brand/ scrollcraft/ '*.html'
```

Do NOT use `git diff "@{26 hours ago}"`: it reads the reflog and silently
returns nothing. If nothing visible changed, write one line, "No visible
changes since yesterday.", send no notification and stop.

## Step 2. Read the standards (not from memory)

- `CLAUDE.md`: the locked design system and the traps.
- `.claude/skills/myisraelrental-frontend/SKILL.md`: bugs already shipped here.
- `.claude/skills/taste-skill/SKILL.md` section 9: the hard bans.
- `frontend/src/styles/theme-flow.css` (loads last, wins) and `brand/design-tokens.css`.
- `docs/page-generation-rules.md` when a hand-built business page changed.
- `docs/research-driven-changes.md` for Part B.

## Step 3. Look at it rendered

After `bash scripts/audit-setup.sh`, for every page touched by the diff:

- `node scripts/screenshot.mjs "http://localhost:3210/<path>?as=owner" <name>`
  at 1280, 768 and 375 wide. Repeat with Hebrew on (the language switch, or
  `localStorage.setItem('i18nextLng','he')` before load). Look at every
  screenshot: anything overlapping, cut off, unreadable, untranslated,
  empty, or plainly broken is a finding even if no rule below names it.
- Add a short laptop (1536x753) for anything with a pinned or full-screen
  section: the default heights hide the worst bugs.
- Run the checks covering what changed: `node scripts/check-hebrew-pages.mjs`,
  `node scripts/check-tile-contrast.mjs`, `node scripts/test-i18n-parity.mjs`,
  `node scripts/test-theme-scope.mjs`, and any `scripts/check-*.mjs` named
  after the changed area.
- **Hand-built business pages** (`frontend/public/pages/<slug>/`, built in
  `scrollcraft/builds/`), for each one changed, on every page of it:
  ```bash
  node .claude/skills/build-business-page/scripts/clipped.mjs  http://localhost:3210/pages/<slug>/<page>.html
  node .claude/skills/build-business-page/scripts/readable.mjs http://localhost:3210/pages/<slug>/<page>.html
  python3 .claude/skills/build-business-page/scripts/cutout.py --check <each changed cut-out .webp>
  ```
  and walk the order or booking flow from the first page to the last.

## Step 4. The defect list (each has shipped here before)

1. Inline `fontFamily: 'Playfair Display'` or any literal face in JSX (no
   Hebrew glyphs; must be `var(--font-head)`).
2. shadcn collision: `--primary`, `--border`, `--muted` are HSL triplets;
   brand colours are `--brand-*`.
3. New hardcoded hex in changed lines (not the ~1,275 old ones).
4. Contrast: measured on the rendered page where possible, else computed
   from token values with the WCAG formula (say which). Under 4.5:1 body,
   3:1 large. Accent `#167AB8` on white passes; text on a solid accent is white.
5. Green as decoration (green is status only).
6. Wrong button: solid actions are black with white text; the accent
   button is the soft blue wash with ink text.
7. RTL: physical left/right where logical belongs, unmirrored arrows,
   English user content inheriting RTL.
8. Missing Hebrew: keys added to `en.js` without `he.js` (diff both files).
9. Copy bans: long or en dashes in visible text (titles and meta too),
   exclamation marks, emoji, section-number eyebrows, scroll cues, fake UI.
10. `overflow-x: hidden` above a `position: sticky` (use `clip`).
11. Images without dimensions or aspect ratio.
12. Touch targets under 44px at 375, including inside dialogs and bars.
13. Accessibility: alt text, labels, keyboard use, visible focus,
    `role="dialog"` + `aria-modal`.
14. Dangling references: a CSS variable, locale key or test id nothing defines.
15. Anything cut off by its section, a fixed bar covering content, or text
    over a photo with no band behind it.

## Part B. One improvement, grounded in psychology

Read `docs/audits/mechanisms-used.md` (gathered copy in `/tmp/prior-audits/`)
and never repeat a mechanism on the same surface. Name the mechanism, the
surface and file:line, the change, and what you would expect to see if it
worked, preferably in data the app already records. "No new improvement
worth proposing" is a correct answer.

Honesty rules override every technique: real numbers or nothing, no
manufactured scarcity or countdowns, no dark patterns. Rentals lead; the
site is not aimed at property owners; the supply call to action is "Add
your business, free". The home page is exempt from positioning changes.

Part B is a proposal only: never build it. Add one line to
`docs/audits/mechanisms-used.md`: `{date} - {mechanism} - {surface}`.

## Report

`docs/audits/YYYY-MM-DD-ui-audit.md`, in the shape from the README, with
Part B as its own section after "Verified working".
