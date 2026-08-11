# CLAUDE.md

Guardrails and project knowledge for working in this repo. Read this before making changes.

## What this is

MyIsraelRental — a rental/marketplace web app. FastAPI backend (`backend/`) + React (CRA/craco) frontend (`frontend/`). MongoDB Atlas for data, Cloudinary for media and private contract storage, Google Identity Services for sign-in, the direct Anthropic API for LLM features (translation, CSV mapping, bulk extraction). Deployed on Railway. Migrated off Emergent (formerly hosted there) in July 2026 — see `docs/emergent-exit-checklist.md` for what that involved and what's still outstanding.

**Offerings:** property rentals (long/short-term, vacation), a two-sided local **services marketplace** (hire/offer pros), and a **Requests board** (post what you're looking for; owners/pros respond via chat). **Discontinued — do not surface or build for:** (1) document / government "paid services" (Arnona discount, name change, document filing, Bituach Leumi benefits) — related code may still exist behind the `DOCUMENT_SERVICES_ENABLED` flag; keep it off and clean it up separately, don't extend it; (2) **storage rentals** — the `storage` rental_type still exists in code (e.g. `property.storageType` labels, rental-type maps); don't show it in new UI or marketing, and clean it up separately.

## Before making changes

- **Look for existing code first.** Check `backend/routes/` and `backend/utils/` before adding a new backend module; check `frontend/src/components/` and `frontend/src/utils/` before adding a new frontend one. Don't duplicate what's already there.
- **Guard costly or irreversible operations.** Confirm before: calls that spend real API credit (Anthropic, Cloudinary uploads at scale), writes to the production Atlas database, `git push`, and anything that triggers a Railway deploy. A dry run first is usually the right move when a script is about to touch production data.
- **Ask before broad edits to this file or other standing config** (`.gitignore`, `railway.json`, `nixpacks.toml`, CI config). These are load-bearing — a wrong edit breaks the build silently.
- **Document what you learn.** When something fails in a non-obvious way (a rate limit, a platform quirk, a wrong assumption), write it down — in this file if it's a standing gotcha, in `docs/` if it's part of a larger effort, or as a code comment if it's local to one function. Future sessions (yours or not) shouldn't have to rediscover the same failure.

## Secrets — hard rules

- Real secrets live only in `backend/.env` / `frontend/.env` (gitignored). `.env.example` files are the checked-in template — keep them in sync when a new var is added, but never put a real value in them.
- **Never print a secrets file or a full variable dump to the terminal or into a response.** `cat`, `cat -A`, and `railway variables list` (no `--kv`, but it *still* shows raw values by default) will all put every secret in plaintext into the transcript. If you need to check a var is *set*, check for presence/key names only, or check application behavior (e.g. a health-check boolean), never the raw value.
- If a secret does end up printed or pasted into chat, say so plainly and get it rotated — don't let it linger unspoken.
- Frontend `REACT_APP_*` vars are **public** by design (CRA bakes them into the JS bundle at build time) — never put a real secret in one.

## Railway deploy — gotchas learned the hard way

- **CRA env vars are baked at build time.** Set `REACT_APP_*` vars on the frontend service *before* triggering a build/deploy, or the old (or empty) values ship in the bundle. Changing them requires a rebuild, not just a restart.
- **The Railway CLI's project link is directory-scoped.** `railway link` writes state relative to the current working directory. Run `railway link` and the command that needs it (`variable set`, `volume add`, etc.) from the *same* directory in the *same* command chain — `cd`-ing away between calls loses the link.
- **Git Bash mangles `/`-prefixed arguments** (like `/app/private_contracts`) into Windows paths before Railway's CLI sees them. Prefix the command with `MSYS_NO_PATHCONV=1` whenever passing an absolute Unix-style path as a CLI argument.
- **Railway's Root Directory setting is dashboard-only** — no CLI flag on `service add` or `service source connect` sets it. Create the service via CLI or dashboard, then set Root Directory by hand in Settings → Source.
- **Service names in the dashboard don't have to match what you typed when creating them** — Railway may auto-name from the GitHub repo. Check `railway service list --json` (or the dashboard) for the real name before scripting against it; don't assume.
- **Project/service names can change** (someone renames it in the dashboard) but the project ID doesn't. Prefer linking by `-p <project-id>` over project name for anything scripted.
- **CRA's `npm start` is a dev server** — never the production start command. The frontend's `railway.json`/`nixpacks.toml` build the static bundle and serve it with `serve`; don't revert to `npm start` for deploy.
- **Frontend install needs `--legacy-peer-deps`** — `react-day-picker@8.10.1` declares a peer on `date-fns ^2||^3`, but the app pins `date-fns ^4`. A plain `npm install` aborts on the conflict.
- **Set Root Directory BEFORE the first deploy, or the start command is guessed and sticks.** A service created from a repo without a root directory builds from the repo root, never sees `backend/railway.json`, and Railpack invents a start command — for FastAPI it guesses `uvicorn main:app`, which crashes with `Could not import module "main"` even after the root directory is fixed, because the guess was baked at build time. Setting `startCommand` explicitly on the service is the reliable fix; don't rely on `railway.json` being discovered.
- **Creating a service with a branch does not necessarily deploy that branch.** The MCP `create-deployment` (and the dashboard's repo picker) can trigger the first build from the repo's default branch even when another branch was named — the service config will *say* the right branch while the deployment metadata says `main`. Always check `list-deployments` → `meta.branch` after creating, and pin it with `railway service source connect --repo <owner/repo> --branch <branch> --service <name>`, which does take effect and triggers a correct deploy.

## Contract file storage — do not regress this

Signed contracts and uploaded contract templates are **personal/legal documents** and must never be reachable through the public static file mount:

- They live in `backend/private_contracts/` locally, and on Railway that resolves to `/app/private_contracts` inside the container (Root Directory strips the `backend/` prefix — the path is *not* `/app/backend/private_contracts`). A persistent volume is mounted there so new uploads survive redeploys.
- Durable copies of *migrated* contracts live in Cloudinary as `raw` + `type=authenticated` assets (verified: unsigned fetch → 401). **New uploads through `routes/contracts.py` / `routes/properties/contract.py` currently only write to the volume-backed local path — they are not yet pushed to Cloudinary.** That's a known gap, not a design decision; wiring `upload_contract_to_cloudinary` into those upload paths is still open.
- Every contract read goes through a permission-checked endpoint (`/bookings/{id}/signed-contract`, `/properties/{id}/contract-file`, `/contracts/download/{id}`) that verifies the caller is a party to that contract (owner, renter with a matching booking, or admin) before serving bytes. Do not add a route that serves a contract file directly from a public static mount — that exact bug existed three separate times before this was fixed (see `docs/emergent-exit-checklist.md`) and cost one contract permanently (Emergent's ephemeral disk wiped it before the fix landed).

## Local dev

See `backend/.env.example` and `frontend/.env.example` for the full list of variables and what each does. Local dev typically runs a local MongoDB rather than pointing at production Atlas — check `backend/.env`'s current `MONGO_URL` before assuming which database you're touching, especially before running any migration or backfill script.

## Design system (locked) — do not reinterpret

The brand and UI are locked. When building or changing any UI, treat these as the source of truth and **copy exact values — never re-derive, "improve", or invent** colors, spacing, radii, or component styles.

- **Source of truth files:** `brand/design-tokens.css` (import it; reference its CSS variables everywhere — no hardcoded hex/spacing in components), the two design mockups `home-redesign-preview.html` and `wanted-board-preview.html` (match them section-for-section), the logo assets in `brand/`, and `brand/inspiration/` for the intended premium feel. Full build spec: `docs/redesign-and-wanted-board-prompt.md`. Per-phase definition-of-done: `docs/acceptance-checklist.md`.
- **Palette:** primary blue `#1E5F8C` (dark `#184E73`, deep `#123B57`); accent gold `#C9A227` (small-text `#8A6A14`, display `#A9831C`); limestone bg `#EFE9DC`; ink `#23201B`; muted `#6B6459`; border `#E1D8C6`; surface `#FFFFFF`. **Green is functional only** (status/verified/available — `#2E7D4F` on `#E6F4EA`, verified `#1F8A50` on `#E3F3EA`) — never a brand accent or button color.
- **Type:** Playfair Display headings, Manrope body; Frank Ruhl Libre + Assistant under `[dir="rtl"]`. Every page must work LTR and RTL. **RTL font gotcha:** ~69 headings across ~45 files set `style={{ fontFamily: 'Playfair Display' }}` inline; inline styles beat `[dir="rtl"] h1{…}`, and Playfair has no Hebrew glyphs, so RTL headings silently fall back to a system serif. Fix is in `brand/design-tokens.css` — RTL swaps the font *variables*; any heading you touch must read `fontFamily: 'var(--font-head)'`, never the literal face. Verify via a heading's computed `fontFamily` in RTL.
- **Accent buttons** (`.btn-accent`/`.btn-gold`) are frosted glass-gold with **white** text (see `design-tokens.css`). Primary buttons are solid blue with white text. **Exception:** over the hero photo the CTAs are solid white (`.btn-white`) + outline-white (`.btn-outline-white`) by design.
- **Gold on dark:** use `--gold` (#C9A227) on dark surfaces; `--gold-lg` (#A9831C) is for large/display gold on **light** only (it's ~3.3:1 on dark).
- **Scope of "no hardcoding":** copy exact token values in **new/changed** UI; do not refactor the ~1,275 existing hardcoded hexes app-wide. The hero (`docs/hero-cinematic-spec.md`) uses literal values on purpose — copy them verbatim; that's the one intended exception.
- **shadcn token collision (load-bearing):** `frontend/src/index.css` defines `--primary`, `--border`, `--muted` as HSL triplets used via `hsl(var(--…))`. `brand/design-tokens.css` therefore namespaces brand colors as `--brand-primary`/`--brand-border`/`--brand-muted` and must be imported **after** `index.css`. Never redefine those three shadcn names as hex — `var(--primary)` would return an HSL triplet, `background:var(--primary)` gets dropped, and primary buttons silently lose their fill. When porting preview CSS, rewrite `var(--border)`→`var(--brand-border)`, `var(--muted)`→`var(--brand-muted)` (`--teal*`, `--gold*`, `--ink`, `--bg`, `--surface` are safe).
- **Icons:** the mockups' `<use href="#i-…">` are placeholders — implement with `lucide-react` (mapping in `docs/hero-cinematic-spec.md`). **Scroll reveal** must use the fail-safe `.js-reveal` pattern (content visible if JS doesn't run). **Verify with `scripts/screenshot.mjs`**, not by stalling for a human screenshot.
- **Logo:** nav = navy rounded tile holding `brand/logo-mark.png` + "MyIsraelRental" wordmark; footer uses the dark logo variant.
- **Feel:** premium/editorial — generous whitespace, large serif headings with a single gold accent word, soft layered shadows, gentle hover lifts, slow scroll reveals (respect `prefers-reduced-motion`). Restraint with gold; most of the page is neutral with blue structure.
- **Verify visually before claiming done.** After a UI change, run the app, screenshot the page, and compare against the matching mockup; fix differences before reporting complete. If you can't screenshot, ask for one — don't guess. Work one section/component at a time and show a diff.

