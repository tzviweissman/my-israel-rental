# Acceptance checklist — verify before claiming any phase "done"

**Rule for the coding agent:** After implementing each item, run the app, screenshot the affected page with `scripts/screenshot.mjs` (headless Playwright → PNG at **1280, 768, and 375**), paste all three, and visually compare them to the matching mockup (`home-redesign-preview.html` / `wanted-board-preview.html`). **768 is mandatory** — it's where the two-column dual-door cards most often collapse badly, and the width nobody checks. Do not report a phase complete until every box below is true AND the screenshot matches the mockup. Only if the screenshot script genuinely can't run (missing dep you can't install) do you fall back to asking the user for a screenshot. Copy exact values from `brand/design-tokens.css` and the mockups — never re-derive or invent styles.

**Two carve-outs to the "no hardcoding" rule (so spec and checklist don't contradict):**
1. **Scope** — "no hardcoded hex/spacing/shadows" applies to **new and changed** UI you write, using `design-tokens.css`. It is NOT a mandate to refactor the ~1,275 existing hardcoded hexes across the app; leave existing code alone unless asked.
2. **Hero literals** — the hero (`docs/hero-cinematic-spec.md`) intentionally uses literal values (radius 26px, layered rgba gradients, its shadow). Copy those verbatim; they're exempt.
3. **Hero buttons** — over the hero photo the CTAs are `.btn-white` + `.btn-outline-white` by design; the "accent buttons are gold" rule is for accent CTAs elsewhere, not the hero.

## Global / brand (Phase 1)
- [ ] `brand/design-tokens.css` is imported once; **new/changed** components reference its CSS variables (no new hardcoded hex/spacing/shadows). Existing app code is out of scope.
- [ ] Palette exact: primary `#1E5F8C`, gold `#C9A227`, limestone bg `#EFE9DC`. No teal/green left as a *brand* color.
- [ ] Green appears ONLY on functional status (Open pill `#2E7D4F`, Verified `#1F8A50`) — never on buttons/brand.
- [ ] Fonts: Playfair headings, Manrope body; Frank Ruhl Libre + Assistant under `[dir="rtl"]`.
- [ ] **RTL headings actually use the Hebrew face.** Toggle `dir="rtl"` and confirm a heading's *computed* `fontFamily` reads "Frank Ruhl Libre" — not a system serif. Any heading you touch must read `var(--font-head)`, never inline `'Playfair Display'` (inline styles beat the RTL selector; ~69 existing sites have this bug).
- [ ] Accent buttons (`.btn-accent`/`.btn-gold`) are frosted glass-gold with **white** text on section surfaces. (Hero CTAs are the white/outline exception.)
- [ ] All placeholder `<use href="#i-…">` icons replaced with the mapped `lucide-react` components (see hero spec table); no empty icon slots.
- [ ] `.reveal` uses the fail-safe `.js-reveal` pattern — with JS disabled, all content is visible (no blank sections).
- [ ] Nav logo = the raw gold `brand/logo-mark.png` floating (~44px, drop shadow, NO navy tile) + "MyIsraelRental" wordmark to its right, inside the glass nav (copy from any preview file). Footer uses the dark-bg logo. Favicon from `logo-mark.png`.

## Home + Stays + Services (Phase 2)
- [ ] `/` is the cinematic scroll experience matching `cinematic-preview.html`: scenes pin, captions/cards fade on scroll, scene-2 zooms through the wall into the interior STILL (framing identical at any scroll speed), push-in clips do NOT loop, reduced-motion shows posters.
- [ ] Stays and Services pages match `stays-preview.html` / `services-preview.html` visually while keeping ALL existing search/filter/data logic.
- [ ] Glass nav identical on every page (bubbles, floating gold logo, active-page bubble + gold dot); Stays/Services/Requests links go to dedicated pages, not anchors.

### Section library (from home-redesign-preview.html)
- [ ] Dual front-door hero (Find a place to stay / Find or offer services), equal weight, over the hero image with the dark overlay + vignette.
- [ ] The two doors + quick chips deep-link into `/stays` and `/services` with REAL param names/slugs (verified against `Stays.jsx` and `servicesCatalog.js` — not invented).
- [ ] All sections present and in order: hero → stat strip → featured rentals rail → services grid → tabbed how-it-works → testimonials → owner/provider band → cities → footer.
- [ ] Section spacing generous (~94px), soft shadows, property cards lift + image zoom on hover, scroll reveal is slow/soft.
- [ ] Fully responsive (test 375px, 768px, 1280px) and RTL mirrors correctly. Existing SEO/JSON-LD preserved.

## Requests board (Phase 3)
- [ ] Routes `/requests`, `/requests/:id`, `/requests/post` (post gated to signed-in). New module, not overloading `marketplace_jobs`.
- [ ] Post form switches fields by type (rental vs service); posting is signed-in-only.
- [ ] Contact is chat-only ("Message seeker"); no phone/email ever exposed in the UI or API responses.
- [ ] Cards show type badge, structured chips, poster + Verified, and status row (Open · expires in N days).
- [ ] Lifecycle works: mark-as-found, renew, 30-day auto-expire (soft-expire, not a TTL delete).
- [ ] Filters are URL-driven; nav "Requests" item + cross-links from Stays/Services empty states.
- [ ] i18n keys added to `en.js` AND `he.js`.

## Every phase
- [ ] Screenshot matches the mockup (spacing, colors, radii, type scale).
- [ ] No console errors; Lighthouse a11y ≥ 90; keyboard focus states visible.
- [ ] Diff shown to the user; no unrelated files touched; CLAUDE.md guardrails respected (no secrets printed, no prod writes/deploys without approval).
