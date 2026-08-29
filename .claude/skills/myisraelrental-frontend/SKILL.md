---
name: myisraelrental-frontend
description: Project-specific frontend rules for MyIsraelRental. Use for ANY UI work in this repo — building or restyling a page, porting CSS from a preview file, touching colours, type, buttons, or copy, or adding a component. Encodes the locked brand, the shadcn token collision, the RTL font trap, the preview-cascade trap, and the bilingual copy requirement. Read this before writing frontend code here; it is the accumulated result of bugs already shipped and fixed.
---

# MyIsraelRental — frontend rules

Project-specific. Generic design skills (`taste-skill`, `redesign-skill`) still apply for judgment; this file governs where they conflict.

Sources of truth, in order:
1. The five preview files at repo root — `cinematic-preview.html` (**this is `/`**), `stays-preview.html`, `services-preview.html`, `wanted-board-preview.html`, `home-redesign-preview.html` (**section library only, never a page**).
2. `brand/design-tokens.css`
3. `docs/redesign-and-wanted-board-prompt.md`, `docs/acceptance-checklist.md`
4. `CLAUDE.md`

Where `docs/hero-cinematic-spec.md` conflicts with `cinematic-preview.html`, the preview wins.

---

## 1. The brand is locked — copy values, never invent them

- Primary blue `#1E5F8C` (dark `#184E73`, deep `#123B57`)
- Gold `#C9A227` — `--gold-text` `#8A6A14` and `--gold-lg` `#A9831C` are **light backgrounds only**
- Limestone `#EFE9DC`, ink `#23201B`, muted `#6B6459`, border `#E1D8C6`, surface `#FFFFFF`
- **Green is functional only** — status/verified/available (`#2E7D4F` on `#E6F4EA`, verified `#1F8A50` on `#E3F3EA`). Never a brand accent, never a button.
- Type: Playfair Display headings, Manrope body. RTL: Frank Ruhl Libre + Assistant.
- Display headings ≥ ~48px render at the light weight (400); smaller headings at 600. Hebrew runs one notch heavier at each step.

Scope: "no hardcoded hex" applies to **new and changed** code. Do not refactor the ~1,275 existing hardcoded hexes. The hero uses literal values on purpose.

## 2. The shadcn collision — this breaks silently

`frontend/src/index.css` defines `--primary`, `--border`, `--muted` as **HSL triplets** consumed via `hsl(var(--…))`.

- Brand colours are namespaced `--brand-primary`, `--brand-border`, `--brand-muted`.
- `brand/design-tokens.css` must be imported **after** `index.css`.
- **Never** redefine those three shadcn names as hex — `background: var(--primary)` then returns an HSL triplet, the declaration is dropped, and the button silently loses its fill.
- When porting preview CSS: rewrite `var(--border)`→`var(--brand-border)`, `var(--muted)`→`var(--brand-muted)`. Safe as-is: `--teal*`, `--gold*`, `--ink`, `--bg`, `--surface`.

**A variable that doesn't exist fails the same way as a colliding one** — `--blue` was used in a ported block and simply didn't exist in our tokens, producing an invisible button. Neither failure shows up in a value check. Verify by reading computed styles in the browser.

## 3. Porting preview CSS — copy the cascade, not just the values

Four separate bugs came from this one mistake. Preview files are standalone documents whose rules depend on context the app doesn't share:

- The preview `<body>` sets `color:#fff`; ours is ink-on-limestone. A ported heading rendered dark-on-dark and was invisible.
- A base rule preceded by a comment was dropped during extraction, so notification cards had no positioning and stacked at the top of the viewport.
- `@media` blocks got flattened, changing behaviour at breakpoints.

**Rule: when porting a block, port every rule it inherits from — including the base rule, the media queries, and any colour it inherits rather than declares.** Prefer copying by hand over an extraction script for anything visually load-bearing.

## 4. RTL — every page, both directions

- RTL swaps the font **variables**: `[dir="rtl"]{--font-head:var(--font-head-he);--font-body:var(--font-body-he)}`.
- **Never write `fontFamily: 'Playfair Display'` inline.** Inline styles beat the RTL selector, and Playfair has no Hebrew glyphs, so the heading silently falls back to a system serif. Any heading you touch must read `fontFamily: 'var(--font-head)'`. (~69 sites across ~45 files still have this bug; fix the ones you touch.)
- Verify by reading a heading's **computed** `fontFamily` with `dir="rtl"` set — not by eye.
- Use logical properties (`margin-inline-start`, `inset-inline-end`), never `left`/`right`.

## 5. Copy is bilingual or it is broken

- Every new string needs keys in **both** `frontend/src/locales/en.js` and `he.js`. A missing Hebrew key renders English to Hebrew readers with no error — the entire finale shipped that way once.
- Never hardcode display copy in a component.

## 6. Never invent numbers

Placeholder figures from the preview files ("1,200+ active rentals", "19 cities", "450+ verified pros") once reached a build; the real numbers were 196, one city, three providers. Any count shown to a user comes from the database. If a number isn't available, **omit the clause** — do not estimate, do not round up.

## 7. Buttons and layout

- Accent buttons: solid gold with ink text (chosen after a measured comparison). Primary: solid blue, white text. Over the hero photo: white + outline-white by design.
- Gold on dark surfaces uses `--gold`; `--gold-lg` is large/display gold on **light only** (~3.3:1 on dark).
- Icons are `lucide-react`. The previews' `<use href="#i-…">` are placeholders — see the mapping table in `docs/hero-cinematic-spec.md`.
- Scroll reveal uses the fail-safe `.js-reveal` pattern: content is visible if JS never runs. Never ship `.reveal{opacity:0}` unconditionally.
- Respect `prefers-reduced-motion` — posters instead of video.

## 8. Known traps

- `HeroSlideshow` accepts only `images`/`holdMs`/`fadeMs`/`className`/`children` and **drops `style`** — wrap it in an absolutely-positioned div.
- `html, body { overflow-x: hidden }` **kills `position: sticky`** in descendants. This silently broke every pinned scene on the cinematic page. Use `overflow-x: clip`, or move the guard off html/body.
- A section whose children are all absolutely positioned collapses to height 0 — give pinned/hero sections an explicit height.
- Port-in-clips must not `loop` unless crossfaded; a looping push-in visibly rewinds on scroll-back.
- Port 3000 is often taken by an unrelated app on this machine; if `npm start` fails, that's why.
- Frontend installs need `--legacy-peer-deps` (react-day-picker vs date-fns v4).

## 9. Before claiming done

Run `scripts/screenshot.mjs` (headless Playwright) at **1280, 768 and 375** — 768 is mandatory, it's where two-column layouts collapse — in **both LTR and RTL**, and compare against the matching preview file. Do not stall waiting for a human screenshot. For scroll-driven pages use the scroll-stepped sweep (see the `visual-diff` skill). No console errors; Lighthouse a11y ≥ 90; keyboard focus visible.

Show the diff. Touch no unrelated files. Never print secrets, never write to production Atlas, never `git push` or trigger a Railway deploy without explicit approval.
