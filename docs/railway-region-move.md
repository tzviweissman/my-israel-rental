# Moving Railway closer to Israel

Written 2026-08-19 after measuring the live site.

## Why

Both services run in **`sfo` (San Francisco)**. Every request from Israel
crosses to California and back. Measured on production:

| | |
|---|---|
| `/api/health` (does nothing) | **~0.58 s** |
| `/api/properties?limit=1000` | ~1.2 s (127 KB — the payload is not the cost) |

The health check does no real work, so that ~0.6 s is almost entirely
travel time. It is paid on *every* request, by *every* visitor, on *every*
page. Amsterdam (`europe-west4`) is roughly a third of the distance.

## Do the FRONTEND first

It is the bigger win and carries no data risk:

- it serves every page, every script and every image — the majority of
  requests a visitor makes;
- it is a static file server with **no volume and no database**, so there
  is nothing to migrate and nothing to lose;
- if it goes wrong, redeploy puts it back.

### Steps (dashboard — the region is not exposed to the CLI or the MCP)

1. Railway → project **My Israel Rental Project** → service **My Israel
   Rental Frontend** → **Settings** → **Regions** (under Deploy).
2. Change `sfo` → **`europe-west4` (Amsterdam)**. Keep replicas at 1.
3. **Deploy**. Railway builds in the new region, then swaps.
4. Watch the deploy finish and confirm it reports SUCCESS.

### Verify before calling it done

```bash
curl -s -o /dev/null -w "%{time_starttransfer}s\n" https://myisraelrental.com/
```

Run it three times before and three times after — expect roughly 0.3–0.4 s
off. Then load the site and confirm pages, images and the QR redirect all
still work.

Custom domains (`myisraelrental.com`, `www.`) follow the service; DNS does
not change. Expect a short blip during the swap, so do it at a quiet hour.

## The BACKEND is not the same job — do not treat it as one

**It has a volume mounted at `/app/private_contracts` holding signed
contracts.** On Railway a volume belongs to a region, and a service cannot
simply carry it to another one.

This project has lost a contract once already (Emergent's ephemeral disk,
before the volume existed — see `docs/emergent-exit-checklist.md`), and
`CLAUDE.md` treats contract storage as never-to-regress. So:

1. **Back up the volume first.** Every file under `/app/private_contracts`,
   copied off Railway and verified readable, before anything moves.
2. Confirm the migrated Cloudinary copies (`raw` + `type=authenticated`)
   cover the same set, so there are two independent copies.
3. Only then move the service, and re-attach or re-create the volume in the
   new region.
4. Verify a contract download end-to-end afterwards, through the
   permission-checked endpoint, not by listing files.

There is also a smaller consideration: MongoDB Atlas sits in its own
region. Moving the backend to Amsterdam only helps if Atlas is in or near
Europe — otherwise the backend↔database hop gets *longer* while the
browser↔backend hop gets shorter. **Check the Atlas cluster's region before
moving the backend**, and move them together if needed.

## Order

1. Frontend → Amsterdam. Measure. (Low risk, immediate benefit.)
2. Check where Atlas lives.
3. Plan the backend + volume move separately, with backups verified first.
