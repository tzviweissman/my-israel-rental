# Deploying to Railway

Two services from one repo: a **backend** (FastAPI, always-on) and a **frontend**
(static React build). Plus one **volume** for contract files.

## 1. Backend service

**Root directory:** `backend`
Railway auto-detects `nixpacks.toml` + `railway.json`, which pin Python 3.12,
install `tesseract-ocr` (+ Hebrew/English data) for contract OCR, and start:

```
uvicorn server:app --host 0.0.0.0 --port $PORT
```

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

- Build: `npm install --legacy-peer-deps && npm run build`
  (`--legacy-peer-deps` is required — `date-fns` v4 conflicts with
  `react-day-picker`'s peer range.)
- Publish directory: `build`

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
