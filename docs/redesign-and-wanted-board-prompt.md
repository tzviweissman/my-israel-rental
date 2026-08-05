# Implementation prompt — home redesign, blue+gold rebrand, and the Requests board

You are working in the **MyIsraelRental** repo (FastAPI backend in `backend/`, React CRA/craco frontend in `frontend/`, MongoDB Atlas, on-platform chat, WhatsApp+email notifications, deployed on Railway).

**Before anything, read `CLAUDE.md` and follow every guardrail in it** — especially: never print secrets; do not regress the contract-file storage rules; the Railway/CRA build gotchas; and **confirm with me before** anything that spends real API credit, writes to production Atlas, pushes, or triggers a deploy. Work against local/dev, not production data.

There are three self-contained preview files at the repo root that are the **visual source of truth** — open and study them before writing code:
- `home-redesign-preview.html` — the redesigned home page
- `wanted-board-preview.html` — a brand-new "Requests" demand board feature
- `brand/` — final logo assets: `logo-mark.png` (gold buildings only), `logo-gold-blue.png` / `logo-light-trim.png` (light bg), `logo-gold-blue-dark.png` / `logo-dark-trim.png` (dark bg)

Implement in **three phases. After each phase, show me the diff and wait for approval before continuing.** Reuse existing components/utilities/patterns rather than duplicating (per CLAUDE.md). Keep everything bilingual (react-i18next `en.js`/`he.js`) and RTL-safe.

**Read these first — they resolve every "don't invent" ambiguity, so nothing is left to guess:**
- Buttons/icons/tokens: `brand/design-tokens.css` now defines `.btn`, `.btn-lg`, `.btn-white`, `.btn-outline-white`, `.btn-accent`/`.btn-gold`, `.btn-primary`/`.btn-teal`, plus `--teal*` aliases so preview CSS resolves. Import it; don't redefine.
- Icons are **lucide-react**, not an SVG sprite — replace all `<use href="#i-…">` per the mapping table in `docs/hero-cinematic-spec.md`.
- Hero (exact copy, keeps the rotating scenes, i18n keys + Hebrew, HeroSlideshow caveat): `docs/hero-cinematic-spec.md`.
- "No hardcoding" is scoped to **new/changed** code; the hero's literal values and its white/outline CTAs are deliberate exceptions (see `docs/acceptance-checklist.md` carve-outs).
- Scroll reveal uses the fail-safe `.js-reveal` pattern (visible if JS doesn't run). Self-verify screenshots with `scripts/screenshot.mjs` (headless Playwright) — don't stall for a human.

---

## Phase 1 — Rebrand: blue + gold palette and logo (site-wide)

Adopt this palette (matches the mockups exactly). Wire it as CSS variables / theme tokens in the shared stylesheet, replacing the old teal/gold:

- Primary (blue): `--brand-primary:#1E5F8C`, hover `#184E73`, deep `#123B57`. **Brand tokens are namespaced `--brand-*` on purpose** — `--primary/--border/--muted` collide with shadcn's HSL tokens in `frontend/src/index.css` and would silently break (see the header comment in `design-tokens.css`). Import `design-tokens.css` **after** `index.css`, and when porting preview CSS rewrite `var(--border)`→`var(--brand-border)` and `var(--muted)`→`var(--brand-muted)`.
- Accent (gold): `--gold:#C9A227`, gold text on light `#8A6A14`, gold display `#A9831C`
- Neutrals: bg (limestone) `#EFE9DC`, surface `#FFFFFF`, ink `#23201B`, muted `#6B6459`, border `#E1D8C6`
- **Functional green (success only — do NOT use as a brand accent):** "Open"/available status `#2e7d4f` on `#e6f4ea`; "Verified" badge `#1F8A50` on `#E3F3EA`
- Primary buttons: solid `--primary`, white text. Accent buttons: frosted **glass gold** — `background:rgba(172,134,28,.64)`, `color:#fff`, `border:1.5px solid rgba(201,162,39,.85)`, `backdrop-filter:blur(10px)`, `text-shadow:0 1px 2px rgba(50,36,0,.5)`; on dark panels bump to `rgba(172,134,28,.72)`.
- Fonts: Playfair Display (headings), Manrope (body); for Hebrew use Frank Ruhl Libre (headings) + Assistant (body) scoped to `[dir="rtl"]`.

Logo (`components/Navigation.js` + footer): horizontal lockup = a navy rounded tile (`linear-gradient(135deg,#1E5F8C,#123B57)`, ~12px radius) holding `brand/logo-mark.png` (~34px tall), with "MyIsraelRental" wordmark beside it in Playfair, `--primary` color. In the footer (dark), use the light wordmark / `logo-gold-blue-dark.png`. Add the PNGs to the frontend assets and a favicon from `logo-mark.png`.

## Phase 2 — Home page redesign (`frontend/src/pages/Home.js`)

Rebuild the home page to match `home-redesign-preview.html`, keeping the existing `PageMeta`/JSON-LD SEO block:
- **Hero:** build it exactly per `docs/hero-cinematic-spec.md` (cinematic framed hero — smaller darkened card floating on a full-scale photo). **Keep the existing `HeroSlideshow` rotating scenes** (the `HERO_IMAGES` crossfade) as the stage background so they show through the transparent card.
- Hero over the existing hero image with a **dual front-door**: "Find a place to stay" (rentals) and "Find or offer services", both equal weight, plus a trust chip ("Free to search · No service fees · Deal with owners & pros directly").
- Below: stat/trust strip, a **featured rentals** horizontal rail (reuse the existing `/properties/featured` fetch), a **services showcase** category grid, a tabbed **how-it-works** (renting vs hiring), testimonials, a free-to-list **owner/provider band**, cities-served, footer.
- The two doors and their quick chips must **deep-link into the existing search pages** with correct params: rentals → `/stays?area=…` / `?subType=…`; services → `/services?category=<slug>`. Use the **real** area names and category slugs from the code (`servicesCatalog.js` / `CategoryCarousel`, and how `Stays.jsx` reads `useSearchParams`) — don't invent values.
- All copy through i18n keys; add Hebrew.

## Phase 3 — "Housing & Services Requests" demand board (new feature)

Build the demand board shown in `wanted-board-preview.html`. Confirmed product rules: **rental AND service requests; signed-in users only can post; owners/providers contact a seeker only through the existing on-platform chat (never expose phone/email); requests auto-expire after 30 days (with renew) and can be marked "found".**

Architecture: **new parallel module, cloned from the existing jobs board patterns** (`backend/routes/marketplace/jobs.py` + `pages/JobsBoard.jsx`/`PostJob.jsx`/`JobDetail.jsx`) — reuse their structure, `CATEGORIES`, notification tokens, the daily background-loop pattern in `availability_reminders.py`, and the chat stack. Do **not** overload `marketplace_jobs` (its contact model is apply/bid; ours is chat-only).

Backend (`backend/routes/marketplace/requests.py`, collection `requests`, UUID `_id`):
- Fields: `request_type` (rental|service), `poster_user_id`, `title`(+`title_he`), `description`(+`_he`), `area`, budget fields, service variant (`category`,`subcategory`,`preferred_date`), rental variant (`rental_kind`,`bedrooms_min`,`move_in_date`,`lease_months`,`furnished`,`amenities`), lifecycle (`status` open|found|expired|closed, `created_at`,`expires_at`,`renewed_count`,`reminder_sent_at`,`found_at`,`contact_count`), moderation (`hidden_by_admin`,`report_count`).
- **Soft-expire, not a Mongo TTL index** (seekers must be able to renew): a daily wall-clock background loop flips `open→expired` where `expires_at<now` and sends a pre-expiry reminder email (signed one-tap renew token, like `availability_reminders.py`).
- Endpoints (auth via `verify_token`): `GET /marketplace/requests` (public, filterable by type/category/area/rental_kind, status=open), `GET /marketplace/requests/{id}` (public, **no contact info**), `POST /marketplace/requests` (auth, per-type validation, `MAX_OPEN_REQUESTS_PER_USER` cap, rate-limit), `PATCH`/`DELETE` (owner), `POST …/found`, `POST …/renew`, `POST …/contact` (auth — the chat entry point; increments `contact_count`, returns `/chat/{id}?with={poster_user_id}`), `POST …/report`, `GET /marketplace/my-requests`.
- Add indexes in `server.py` startup; launch the lifecycle loop next to the existing daily loops. **Document the single-replica assumption** of in-process loops in the module docstring.
- Chat integration: add a `requests` fallback (label "Requests: …") in `chat.py` `get_conversations` and `_send_chat_email_safe`, and in `Chat.js`, mirroring how jobs already fall back. Matching-alert email to owners/providers reuses `_notify_matching_providers` + notification prefs.

Frontend: new routes in `App.js` (`/requests`, `/requests/:id`, `/requests/post` — post gated to signed-in), pages `RequestsBoard.jsx` / `PostRequest.jsx` / `RequestDetail.jsx` (clone the jobs trio; replace Apply with a single "Message seeker" → chat), a `MyRequestsTab.jsx` dashboard tab with status pills + renew/mark-found/contact-count. URL-driven filters via `useSearchParams`. Entry points: "Requests" nav item, a home-page promo tile, and cross-links from the `/stays` and `/services` empty states ("Can't find it? Post what you're looking for"). i18n keys under a `requests` namespace in `en.js` + `he.js`.

Anti-spam/privacy: signed-in-only post + contact, per-user open cap, create rate-limit, one-tap Report with auto-hide at a threshold, and never return seeker PII from public endpoints.

---

Suggested MVP order within Phase 3: structured posting + filterable board + chat-only contact + 30-day expiry/renew/found + report, then the owner-match daily digest. Ask me before enabling anything that calls the Anthropic API at scale (the Hebrew auto-translation) or writes to production.

## Phase 4 — Stand up a Railway PREVIEW environment (only after I approve phases 1–3)

Goal: a separate, shareable preview URL showing all the above changes that **does NOT touch production data or the live site**. Confirm with me before creating any service or deploying, and paste the preview URL when it's live.

- Work from a dedicated branch (e.g. `redesign-preview`), not `main`.
- In Railway, create a **new environment** (e.g. "preview") in the existing project, or new preview-only services — do not modify the production services. Link by **project ID**, not name (names can change).
- Give it its **own non-production MongoDB** (separate Atlas DB/cluster or a Railway Mongo plugin) with sample/staging data. **Never point the preview at the production Atlas `MONGO_URL`.**
- Copy other env vars but use **test/sandbox keys** wherever money, email, media, or LLM spend is involved (test Cloudinary folder, a capped/test Anthropic key, sandbox PayPal, a test email sender) so the demo can't spend real credit or email real users.
- Frontend (CRA): set all `REACT_APP_*` vars on the preview frontend service **before** the build (they're baked at build time), including the preview API URL. Build the static bundle and serve with `serve` (never `npm start`). Use `--legacy-peer-deps` on install; set Root Directory in the dashboard.
- Keep the preview password-gated or `noindex` so it isn't publicly crawled.
- Follow the Railway gotchas in `CLAUDE.md` exactly (directory-scoped `railway link`, `MSYS_NO_PATHCONV=1` for unix-style paths, dashboard-only Root Directory, get real service names via `railway service list --json`).

---

## Any other notes — make it feel premium

Overall goal: the site should feel like a **high-end, editorial product** — calm, spacious, and expensive-looking — not a dense listings utility. Two reference screenshots I like are saved at `brand/inspiration/inspo-1-glassmorphism-editorial.png` and `brand/inspiration/inspo-2-premium-travel.png` — **open both and match their *feeling*, not their colors.** Keep our blue + gold + limestone palette (do NOT adopt the brown/beige of inspo-1). What to borrow:

- **Whitespace & rhythm.** Be generous — large section padding, roomy line-height, a consistent 8px spacing scale. Let sections breathe like inspo-1. Don't fill every pixel.
- **Editorial typography.** Big, confident Playfair Display display headings with tight tracking, paired with restrained Manrope body. Use a real type scale (don't mix ad-hoc sizes). Keep the one **gold accent word** in the hero headline (like "…Stay **With You**" in inspo-2).
- **Cinematic hero.** Full-bleed, high-quality photography with a soft dark gradient overlay and the headline over it (inspo-2). Invest in better hero/property imagery — image quality is 80% of "premium."
- **Layered depth, used sparingly.** Overlapping cards, soft large-radius corners (16–24px), and *soft, low-opacity* shadows for lift (inspo-1). One or two tasteful glassmorphism moments (the hero trust chip, a floating element) — not everywhere.
- **A floating element that overlaps the hero.** e.g. a slim search/entry bar or the dual-door cards sitting half-over the hero image (both references do this) — it signals polish instantly.
- **Refined cards.** Property/service cards like inspo-2: large image, rounded corners, a subtle favorite heart, rating + price with clear hierarchy, and a gentle hover lift (translate-y + shadow, ~200ms ease).
- **Micro-interactions.** Smooth, subtle transitions on hover/scroll (fade-and-rise on section entry, button lifts). Nothing bouncy or fast — slow and soft reads as premium. Respect `prefers-reduced-motion`.
- **Trust row & promo band.** A quiet feature/benefit row under the hero (line icons + short labels, like inspo-2) and one elegant promotional band (e.g. featured areas) with a gold accent — restrained, not salesy.
- **Restraint with the accent.** Gold is a seasoning, not a base — thin rules, small highlights, one accent word, the CTA. Most of the page is neutral limestone/white with blue structure.
- **Consistency & detail.** Uniform corner radii, border weights, icon stroke widths, and consistent empty/loading states. Premium is mostly *consistency* and *detail*, not decoration.

Constraints: keep it fast (optimize/lazy-load images, mind CRA bundle size), accessible (WCAG AA contrast, focus states, keyboard nav), and fully responsive + RTL. Don't sacrifice load time for heavy effects — a slow premium site feels cheap. Treat `home-redesign-preview.html` as the structural baseline and elevate it toward this feeling; feel free to propose refinements and show me before/after.
