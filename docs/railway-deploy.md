# Deploying to Railway

Two services from one repo: a **backend** (FastAPI, always-on) and a **frontend**
(static React build). Plus one **volume** for contract files.

## 1. Backend service

**Root directory:** `backend`

The service uses the **RAILPACK** builder, set in the Railway service settings.
That setting overrides the `"builder": "NIXPACKS"` line in `backend/railway.json`,
and **Railpack does not read `nixpacks.toml`** — so the setup phase in that file
never runs. The start command still comes from `railway.json`:

```
uvicorn server:app --host 0.0.0.0 --port $PORT
```

> **Known gap — contract OCR (found 27 Aug 2026).** `backend/nixpacks.toml`
> installs `tesseract-ocr` plus Hebrew and English trained data. Because that
> file is inert, the `tesseract` **binary is not in the image**. `pytesseract`
> installs fine from pip — it is only a wrapper — so nothing fails at build or
> boot; `utils/files.extract_text_from_image` catches the runtime error and
> returns `""` with a log line, and a contract uploaded as a photo silently
> loses its extracted text.
>
> Confirm with `tesseract --version` in the deployed container. Two candidate
> fixes, both needing a preview deploy first: switch the service builder back
> to NIXPACKS so the existing file applies, or add a Railpack/Dockerfile
> equivalent of its `aptPkgs`.

Do **not** hardcode a port — Railway injects `$PORT`.

### Volume (required)

Attach a volume with **mount path `/app/backend/private_contracts`**.

Without it, contracts uploaded after deploy are wiped on the next redeploy.
Railway's filesystem is ephemeral — this is exactly how a contract was already
lost on Emergent. Existing contracts are already safe in Cloudinary; the volume
covers newly-uploaded ones until the upload path is moved to Cloudinary too.

### Environment variables

Paste from `backend/.env.example`. Minimum to boot: `MONGO_URL`, `DB_NAME`,
`JWT_SECRET`. Do not skip `CLOUDINARY_*` — missing values silently fall back to
ephemeral local disk instead of erroring.

Set `CORS_ORIGINS` to the real frontend origin(s), comma-separated.

### Health check

`/api/health` returns `{"status","database","cloudinary"}` and pings Mongo, so a
deploy that boots but can't reach Atlas is reported unhealthy instead of quietly
serving errors. Already wired in `railway.json`.

## 2. Frontend service

**Root directory:** `frontend`

Built by **Railpack**, which detects Node and picks its own commands. The
observed plan (27 Aug 2026):

```
install:  yarn install --frozen-lockfile
build:    yarn run build
deploy:   node server.js          <- from frontend/railway.json
```

Three things follow from that, none of them obvious:

- **The deploy installs with yarn, not npm.** There is no `yarn.lock` in the
  repo, so `--frozen-lockfile` resolves from `package.json`. `package-lock.json`
  is kept honest for local work but the deploy does not read it. A dependency
  is installed because it is declared in `package.json` — nothing else.
- **`--legacy-peer-deps` is a LOCAL requirement, not a deploy one.** `date-fns`
  v4 conflicts with `react-day-picker`'s peer range, so `npm install` needs it
  on a developer machine. Yarn 1 does not enforce peer ranges, so the deploy
  never needed it.
- **`CI=false` comes from the Railway service variable**, not from any file in
  the repo. Without it react-scripts treats CRA's lint warnings as build errors.

`frontend/nixpacks.toml` used to state the first two of those and was deleted on
27 Aug 2026: Railpack never read it, so it described a build that was not
happening.

- Publish directory: `build` (served by `frontend/server.js`, see below)

`REACT_APP_*` values are baked in at **build** time, so set them before building
and redeploy after any change. They are public by design — no secrets.

Set `REACT_APP_BACKEND_URL` to the backend service's public URL.

## 3. Atlas network access

Railway egress IPs are not static on all plans. Either enable a static
egress/VPC option, or allow `0.0.0.0/0` on the Atlas cluster **while relying on
the database user password for security**. Remove the temporary personal-IP
entry once the migration is done.

## 4. Google Cloud console

Add the production origin(s) to **Authorized JavaScript origins** for the OAuth
client, and publish the consent screen (it is in Testing mode, so only listed
test users can sign in). No Google verification review is required for the
`openid` / `email` / `profile` scopes in use.

## 5. Post-deploy verification

```
curl https://<backend>/api/health          # expect status=ok, database=true, cloudinary=true
curl -I https://<frontend>/                # expect 200
curl -I https://<backend>/api/uploads/signed_<any>.pdf   # expect 404 — contracts must NOT be public
```

Then in the browser: sign in with Google, open a booking with a signed contract,
confirm it downloads.

Finally, run `normalize_contract_urls.py --apply` (optional, cosmetic — the
backend resolves both URL formats).

## Notes

- The app runs background asyncio loops (iCal sync, mention emails) inside the
  web process, so it needs an always-on service — not serverless/scale-to-zero.
- Fonts for contract PDFs are bundled in `backend/fonts/` and committed. They
  used to be read from `/usr/share/fonts/...`, which only existed in Emergent's
  image; without them Hebrew contracts render as blank boxes.
