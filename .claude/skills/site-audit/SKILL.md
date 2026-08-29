---
name: site-audit
description: Run a thorough correctness, security, data-integrity, bilingual and visual audit of MyIsraelRental. Use when asked for a code check, bug check, health check, pre-launch review, or a periodic audit. Read-only by default — produces a triaged report with evidence; fixes only what the user approves afterwards.
---

# Site audit

A repeatable, evidence-driven review of this codebase. **Investigate and report first; do not fix anything until the report is approved.** A silent fix inside an audit hides the finding.

## Rules of engagement

- **Read-only pass first.** No edits, no migrations, no deploys.
- **Never print secrets.** Check that a variable is *set*, never its value. `cat .env`, `railway variables list` and full env dumps are forbidden.
- **Never write to production Atlas.** Any query that touches data runs against the local dev database; confirm `backend/.env`'s `MONGO_URL` before running anything.
- **No `git push`, no Railway deploy.**
- **Every finding needs evidence** — file and line, a command output, or a screenshot. A finding without evidence is a guess and should be labelled as one.
- **Prioritise by what has actually broken here**, not by what is theoretically bad. The classes below are ranked by real incidents in this repo.

---

## 1. Truthfulness of what users see (highest priority — this has bitten repeatedly)

- **Invented numbers.** Grep the frontend for hardcoded counts, "500+", "1,200+", star ratings, review counts, "X people viewing". Every user-facing figure must trace to a query. *(Precedent: "1,200+ active rentals / 19 cities / 450+ verified pros" shipped from preview placeholders when the real figures were 196, one city, three providers.)*
- **Claims that outrun the data** — response times with too few samples, availability implied but not checked, "verified" badges not backed by a verification record.
- **Dark patterns**: fake scarcity, countdowns, painted progress. None should exist.

## 2. Bilingual completeness

- **Every `t()` key used in the frontend exists in BOTH `en.js` and `he.js`.** A missing Hebrew key renders English silently, with no error. Script this — do not spot-check. *(Precedent: the entire cinematic finale rendered in English for Hebrew readers.)*
- Hardcoded display strings in components that bypass i18n entirely.
- Bilingual content fields: records with `title` but no `title_he` / `title_en`, and vice versa.

## 3. RTL correctness

- **Inline `fontFamily: 'Playfair Display'`** anywhere — inline styles beat the `[dir="rtl"]` variable swap and Playfair has no Hebrew glyphs, so headings silently fall back to a system serif. Must read `var(--font-head)`.
- Physical properties (`left`, `right`, `margin-left`, `padding-right`, `text-align: left`) where logical ones belong.
- Verify by setting `dir="rtl"` and reading **computed** styles, not by eye.

## 4. Design-system drift

- Hardcoded hex values in **new or changed** code (existing ~1,275 are out of scope unless asked).
- **Undefined CSS variables** — `var(--blue)` and friends that don't exist in `design-tokens.css` silently drop the declaration, producing invisible elements. *(Precedent: an invisible finale button.)*
- **shadcn collision**: `--primary`, `--border`, `--muted` are HSL triplets in `index.css`; brand colours must use `--brand-*`.
- Green used as anything other than functional status.
- Contrast: every text/background pair measured, not eyeballed. Reuse `scripts/check-tile-contrast.mjs` where it fits.

## 5. Security

- **Secrets**: nothing real in `.env.example`, no keys committed, `.gitignore` covers `.env`, `.r2.env` and similar. Verify with `git check-ignore`.
- **Authorisation**: every route that reads or mutates a record checks ownership. Look specifically for IDOR — object ids accepted from the client without a permission check.
- **Contract files** must be served only through permission-checked endpoints, never from a public static mount. *(This bug existed three separate times.)*
- **Short links** point only at already-public content — never contracts, dashboards or chat threads.
- **Payment links** validated against a closed allowlist, matched on the registrable domain (`*.domain`, never `endswith`, which lets `evil-paybox.com` through), HTTPS only, enforced at the model not just the form.
- **PII**: no phone or email in any public API response or UI. Contact is chat-only.
- Rate limits on unauthenticated endpoints.

## 6. Data integrity

- **Double-booking**: does a pending or confirmed booking actually remove the slot from availability? *(Known gap — availability is generated from opening hours and nothing subtracts a taken slot.)*
- Bookings agreed off-platform (WhatsApp) that the system never records.
- Orphaned records: gigs without a business, requests without a poster, short links pointing at deleted targets.
- Expiry and lifecycle jobs actually running — and safe if the app runs more than one replica.

## 7. Correctness traps specific to this codebase

Check for recurrences of each:

- `html, body { overflow-x: hidden }` breaking `position: sticky` in descendants.
- Sections whose children are all absolutely positioned collapsing to height 0.
- `HeroSlideshow` given a `style` prop (it drops it).
- Preview CSS ported without its surrounding cascade — inherited colour, base rules preceded by comments, flattened `@media`.
- Looping push-in video clips that visibly rewind on scroll-back.
- Prices computed in the frontend that the backend would compute differently (Smart Pricing overrides).
- Redirect destinations containing a port — crashes `serve-handler`.

## 8. Build, tests and dependencies

- Production build passes; list new warnings separately from pre-existing ones.
- Test suite passes; note skipped tests and untested critical paths (auth, booking, payments, permissions).
- Dependency audit for known vulnerabilities. Note that `--legacy-peer-deps` is required here (react-day-picker vs date-fns v4).
- Dead code: components not imported, routes not reachable, feature flags permanently off.

## 9. Documentation drift

- **Every doc cited from code or from another doc actually exists.** *(Precedent: four specs cited by name were never committed and vanished.)*
- Specs describing behaviour the code no longer has, or vice versa.
- `CLAUDE.md` still accurate on positioning, discontinued offerings and guardrails.

## 10. Visual and accessibility

Use the `visual-diff` skill. Screenshots at **1280 / 768 / 375**, in **both LTR and RTL**, for every page changed since the last audit, plus the permanent set: home, Stays, Services, a business page, a listing, the dashboard, `/join`.

- No console errors on any page.
- Lighthouse accessibility ≥ 90.
- Keyboard focus visible and order sane; modals have `role="dialog"` and `aria-modal`.
- Empty states, error states and loading states all render deliberately — check each page with no data and with the API failing.

## 11. Performance

- Largest images served at sensible sizes; below-fold media lazy-loaded.
- Obvious N+1 queries in list endpoints.
- Indexes on fields actually filtered and sorted on.

---

## Output

A single report, in this shape:

1. **Summary** — counts by severity, and the three things worth doing first.
2. **Findings**, each: severity (Critical / High / Medium / Low), what it is, **evidence** (file:line, output, or screenshot), user-visible impact, and suggested fix.
3. **Verified clean** — a short list of what was checked and found sound. This matters: it tells the reader what the silence covers.
4. **Not checked** — anything skipped, and why. Never let an unchecked area read as a clean one.

Severity guide: **Critical** = data loss, security, or a false claim to users. **High** = broken flow. **Medium** = degraded experience. **Low** = polish.

Then stop and wait. Fix only what is approved, one group per commit, verified per `docs/acceptance-checklist.md`.
