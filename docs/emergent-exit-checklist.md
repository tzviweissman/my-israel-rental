# Emergent exit — pre-cutover checklist

Status as of 2026-07-24. Tick the remaining items before pointing DNS at a new host.

## Done

- [x] **Production data → your own Atlas cluster.** 32 collections / 6,469 docs, verified count-for-count.
- [x] **LLM integration → direct Anthropic SDK.** `emergentintegrations` removed; `utils/llm.py` shim; `ANTHROPIC_API_KEY`. Verified live.
- [x] **Google Sign-In → Google Identity Services.** No Emergent auth hop. Verified live with a real account.
- [x] **Contract files moved out of the public static tree** (`backend/private_contracts/`, never mounted).
- [x] **Authenticated contract endpoints** (`/bookings/{id}/signed-contract`, `/properties/{id}/contract-file`) with party-only access. Verified: no-auth 403, outsider 403, renter/owner 200.
- [x] **`/contracts/download/{id}` had no auth at all** — fixed.
- [x] **Frontend fetches contracts with a token** instead of public `<a href>` links.
- [x] **Emergent frontend tooling removed** — `emergent-main.js` CDN script, `@emergentbase/visual-edits` craco plugin + dependency. Build output verified free of any `emergent` reference.
- [x] **Brand logo self-hosted.** Was loaded from `customer-assets.emergentagent.com` in 5 places (nav, og:image, JSON-LD, notifications). Now `frontend/public/brand-logo.png`, shipped in the build.
- [x] **Env templates** — `backend/.env.example`, `frontend/.env.example` (committed; real `.env` still ignored).
- [x] **Uploads + contracts gitignored** so they stop being committed.

## Railway-specific (added 2026-07-24)

- [x] **Bundled fonts** (`backend/fonts/`). Contract PDFs read fonts from
      `/usr/share/fonts/...`, which only existed in Emergent's image — on Railway
      Hebrew contracts would render as **blank boxes** and signed-name stamps
      would fall back to a tiny bitmap font. Now bundled (Arimo + Noto Sans
      Hebrew + DejaVu, static Regular/Bold instanced from the variable
      originals) with the system paths kept as fallback. Verified by rendering
      the Hebrew template and confirming the font is embedded.
- [x] **`/api/health` endpoint** — pings Mongo so a deploy that boots but can't
      reach Atlas is reported unhealthy. Wired into `railway.json`.
- [x] **`nixpacks.toml`** installs `tesseract-ocr` + Hebrew/English data, which
      the contract OCR path needs (it silently returns empty text without it).
- [x] **Property-contract uploads now write to the private dir.** This endpoint
      was still writing into the public `uploads/` tree and storing a public URL
      — it would have recreated the exposure for every new upload. Verified
      end-to-end: upload → 404 public → 200 authenticated → delete cleans up.
- [ ] **Attach a Railway volume at `/app/backend/private_contracts`.** Without
      it, newly-uploaded contracts are wiped on each redeploy.

## Blocking — must happen before cutover

- [x] **Contract files moved to durable PRIVATE storage.** All 8 surviving
      contracts uploaded to Cloudinary as `raw` + `type=authenticated` assets and
      hash-verified (each read back and SHA-256 compared before the DB was
      touched). Public access is denied by Cloudinary itself (unsigned GET → 401,
      verified); the app fetches bytes server-side with a short-lived signed URL
      and streams them through the permission-checked endpoint, so no signed URL
      ever reaches a browser. `*_public_id` fields added; legacy URL fields left
      intact so disk fallback still works.
- [ ] **Set every variable from `.env.example` on the new host.** Missing
      `MONGO_URL` / `DB_NAME` / `JWT_SECRET` = the process won't boot. Missing
      `CLOUDINARY_*` = silent reversion to ephemeral local disk.
- [ ] **Google Cloud console:** add the production domain(s) to *Authorized
      JavaScript origins*, and publish the OAuth consent screen (currently in
      Testing mode — only listed test users can sign in). No Google verification
      review needed for the `openid`/`email`/`profile` scopes in use.
- [ ] **Atlas Network Access:** allowlist the new host's egress IPs (or use its
      VPC peering). Remove the temporary personal-IP entry afterwards.
- [ ] **Rotate credentials exposed during this migration** — the Atlas password,
      the Emergent production Mongo URI, the Anthropic API key, and the Cloudinary
      API secret were all pasted in plaintext during the work.

## After the new backend is deployed

- [ ] **Normalise the 9 legacy contract URLs** in Atlas
      (`scratchpad/normalize_contract_urls.py --apply`, writes a rollback backup).
      Cosmetic only — the backend resolves both the legacy `/api/uploads/...` form
      and a bare filename — but do NOT run it before the new code is live, or the
      currently-deployed frontend builds broken links.

## Data-quality issues found (your call)

- Booking `a11bafc9-12c8-4dda-8004-bc8f1fa7d81a`'s "signed contract" is a **1×1
  pixel PNG** (70 bytes) — an empty placeholder, not a real signature. Migrated
  faithfully rather than silently dropped, but that booking has no usable signed
  contract.

## Known data loss (already happened)

- `properties.contract_url` on property `1c727522-1862-4949-8dd2-f7f452fdb0e3`
  points at `contract_6e484844-46d9-488c-b8d3-8ee4f3edd54f.pdf`, which is **404 on
  production and absent from git** — Emergent's ephemeral disk already wiped it.
  Either re-upload the contract or clear the dangling reference.

## Your call (not done deliberately)

- **Contracts are in git history.** `.gitignore` stops future commits; it does not
  remove past ones. Purging requires rewriting shared history (`git filter-repo` /
  BFG) — destructive, so left to you.
- **Hosting target undecided.** The app needs an always-on process (it runs
  background asyncio loops for iCal sync and mention emails), so serverless is a
  poor fit. Render / Railway / Fly / a VM all work.
- **`.emergent/` directory** still in the repo (cron watcher pointing at
  `ea.int.apis.emergentagent.com`). Harmless — the real scheduled work runs
  in-process — but it can be deleted once you leave.
