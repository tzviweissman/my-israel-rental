# CLAUDE.md

Guardrails and project knowledge for working in this repo. Read this before making changes.

## What this is

MyIsraelRental — a rental/marketplace web app. FastAPI backend (`backend/`) + React (CRA/craco) frontend (`frontend/`). MongoDB Atlas for data, Cloudinary for media and private contract storage, Google Identity Services for sign-in, the direct Anthropic API for LLM features (translation, CSV mapping, bulk extraction). Deployed on Railway. Migrated off Emergent (formerly hosted there) in July 2026 — see `docs/emergent-exit-checklist.md` for what that involved and what's still outstanding.

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

## Contract file storage — do not regress this

Signed contracts and uploaded contract templates are **personal/legal documents** and must never be reachable through the public static file mount:

- They live in `backend/private_contracts/` locally, and on Railway that resolves to `/app/private_contracts` inside the container (Root Directory strips the `backend/` prefix — the path is *not* `/app/backend/private_contracts`). A persistent volume is mounted there so new uploads survive redeploys.
- Durable copies of *migrated* contracts live in Cloudinary as `raw` + `type=authenticated` assets (verified: unsigned fetch → 401). **New uploads through `routes/contracts.py` / `routes/properties/contract.py` currently only write to the volume-backed local path — they are not yet pushed to Cloudinary.** That's a known gap, not a design decision; wiring `upload_contract_to_cloudinary` into those upload paths is still open.
- Every contract read goes through a permission-checked endpoint (`/bookings/{id}/signed-contract`, `/properties/{id}/contract-file`, `/contracts/download/{id}`) that verifies the caller is a party to that contract (owner, renter with a matching booking, or admin) before serving bytes. Do not add a route that serves a contract file directly from a public static mount — that exact bug existed three separate times before this was fixed (see `docs/emergent-exit-checklist.md`) and cost one contract permanently (Emergent's ephemeral disk wiped it before the fix landed).

## Local dev

See `backend/.env.example` and `frontend/.env.example` for the full list of variables and what each does. Local dev typically runs a local MongoDB rather than pointing at production Atlas — check `backend/.env`'s current `MONGO_URL` before assuming which database you're touching, especially before running any migration or backfill script.
