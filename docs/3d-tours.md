# 3D walkthrough tours

An owner uploads a walkthrough video of a property; a reconstruction
service turns it into a 3D tour; the tour appears on the listing page
beside the photos.

**Status: built, wired, and switched OFF.** Every piece exists and is
tested, but `TOUR_PROVIDER` is unset, so the endpoints report themselves
unconfigured. It cannot be switched on until the vendor question below is
answered.

---

## The vendor question — read this first

The feature was specified against the **Luma AI** video-to-3D capture API.
That API is **undocumented and unsupported, but still running.**

Probed 30 Aug 2026 with `python -m scripts.probe_luma_capture` (no API key
needed — re-run it any time):

| Check | Result |
|---|---|
| `/api/v2/capture`, `/api/v2/capture/{slug}` | **live** — auth error, not 404 |
| Junk paths on the same host (the control) | 404 "Resource not found" |
| `Authorization: luma-api-key=<bogus>` | **401 "API key does not exist"** — header parsed, key looked up |
| `Bearer` / `x-api-key` / malformed | generic error — not understood |

The junk-path control is what makes this proof rather than noise: a host
that rejected *everything* unauthenticated would look identical. And the
401 confirms the one line of `LumaTourProvider` that no amount of reading
could — the auth header format is correct.

**Still unverified, because it needs a real key:** every field name
`submit` and `_to_job` read — `capture.slug`, `signedUrls.source`,
`latestRun.status`, `latestRun.artifacts[].type`. Those come from Luma's
old client and should be expected to need adjusting on first contact.
`probe_luma_capture.py` checks them too if you give it `LUMA_API_KEY`.

**What "alive" does not mean.** The capture API is absent from
`docs.lumalabs.ai/llms.txt` and from `lumalabs.ai/api`, which now markets
only Ray3.2 and Uni-1.1. Luma's own client repo says they no longer
actively support it. So it runs, unadvertised, and could stop without a
deprecation notice — and it is unclear whether a key issued from
`platform.lumalabs.ai` today still carries capture scope. **That is the
open question: get a key and re-run the probe.**

None of this changes the architecture. The vendor sits behind
`TourProvider` precisely because it is the piece most likely to vanish;
swapping is one class and one env var. Candidates if Luma does go:
Polycam, Meshy, Matterport.

> An earlier version of this document said the API "appears to be
> discontinued". That was too strong — the endpoints answer. Corrected
> after probing rather than reading.

## Files

| Piece | Where |
|---|---|
| Provider seam + Luma adapter | `backend/utils/tour_provider.py` |
| Routes | `backend/routes/tours_3d.py` |
| Index creation ("the migration") | `backend/scripts/create_tour_indexes.py` |
| Owner upload UI | `frontend/src/components/property/Tour3DUpload.jsx` |
| Renter embed + toggle | `frontend/src/components/property/Tour3DViewer.jsx` |
| Embed URL guard (pure) | `frontend/src/utils/embedSafety.js` |
| Tests | `backend/tests/test_tour_provider.py`, `scripts/test-tour3d-embed-safety.mjs` |
| Live vendor probe (no key needed) | `backend/scripts/probe_luma_capture.py` |

Named `tours_3d` / `Tour3D*` deliberately: `frontend/src/components/tour/`
is already the onboarding coach-mark tour, and `/api/onboarding/tour`
already exists. Two unrelated "tour" features in one repo is a trap.

## Flow

1. Owner opens a listing for edit and clicks **Add 3D tour**.
2. Browser validates format, size and duration, then
   `POST /api/properties/{id}/tour` reserves a `property_tours` record and
   returns a Cloudinary signature scoped to
   `myisraelrental/tours/{property_id}`.
3. Browser uploads **straight to Cloudinary** — the backend is never in
   the path for the 500MB leg.
4. `POST /api/properties/{id}/tour/attach` — the server re-reads the real
   size and duration from Cloudinary (not from the request body, which
   the client controls), enforces the limits again, and hands the video
   to the provider. Status becomes `processing`.
5. Railway cron calls `POST /api/tours/poll-pending` until the job
   resolves. Status becomes `ready` (with an embed URL) or `failed`.
6. The listing page shows a Photos/3D toggle when `ready`, a quiet
   "coming soon" strip when `processing`, and **nothing at all** when
   `failed` — renters cannot act on a failure and a listing advertising
   its own broken feature is worse than one that never mentioned it. The
   owner sees the failure and a re-upload button on their dashboard.

## Configuration

Add to the backend service (see `backend/.env.example`):

```
TOUR_PROVIDER=luma
LUMA_API_KEY=<from the vendor>
TOUR_POLL_SECRET=<generate>
```

Generate the poll secret with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Then create the indexes — dry run first, as always:

```bash
python -m scripts.create_tour_indexes
```

```bash
python -m scripts.create_tour_indexes --apply
```

### The cron job

Railway cron, every 5 minutes, calling the backend:

```bash
curl -fsS -X POST "$PUBLIC_API_URL/api/tours/poll-pending" -H "X-Tour-Poll-Secret: $TOUR_POLL_SECRET"
```

An endpoint rather than an in-process loop: it survives redeploys, cannot
double-run if the backend ever scales past one instance (which would
double-charge the vendor), and can be curled by hand when something looks
stuck.

A tour gives up after 24 polls — about two hours at a 5-minute interval —
so a vendor that loses a job cannot leave a listing saying "coming soon"
forever.

## Things that are load-bearing

- **The `property_id` index is UNIQUE.** That is what makes "one tour per
  listing" a rule the database keeps rather than a convention a route
  remembers. Without it, two fast upload clicks leave two tours and the
  listing page picks one arbitrarily.
- **The attach endpoint re-reads the file facts from Cloudinary.** The
  browser knows the size and duration and could simply send smaller
  numbers. Asking Cloudinary is the only version of those facts the client
  cannot choose.
- **The signature is scoped to one folder and one public_id**, and attach
  refuses anything outside it. Otherwise a valid signature would be a
  licence to attach any asset in the cloud — including another owner's
  listing video — to your own listing.
- **The iframe is sandboxed without `allow-same-origin`**, and the URL
  must be plain https (`utils/embedSafety.js`). The embed URL comes from a
  third party and lands on a page where visitors are signed in; a
  `javascript:` URL in an iframe `src` executes in our origin.
- **A provider that cannot sign a webhook does not get one accepted.**
  `LumaTourProvider.verify_webhook` returns False unconditionally and the
  route 404s any provider with `supports_webhook = False`. An accepted
  unsigned callback would let anyone who guesses a tour id choose the URL
  we embed.

## Known gaps

- The Luma adapter's response-body field names are unverified against a
  live key (endpoints and auth format are verified — see above).
- Luma will not accept our Cloudinary URL — it wants bytes PUT to a signed
  URL of its own — so `submit` streams the video through this container.
  The browser→Cloudinary leg still bypasses us, which is the one the
  waiting person feels, but a 500MB file does cross the backend. A
  provider that accepts a source URL would remove this entirely.
- No admin view of failed tours across all listings; owners see their own.
- `_hmac_ok` in `tour_provider.py` is unused until a provider with real
  webhooks exists.
