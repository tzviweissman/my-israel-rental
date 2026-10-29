# Site audit — 24 Sep 2026

Scope: everything merged since the last audit follow-up (`de9fd08`, "audit
follow-up, 24 Sep") through the current head (`30ff890`). No Obsidian
connector is available in this environment (checked via `ListConnectors`,
no match), so recency was scoped from `git log` instead:

- `4a1bceb` Hebrew business pages: Hebrew description and category headings
- `69584cf` Page recipes from the category study (Inspo + Mobbin, 24 Sep)
- `5acce41` Upgrade panel: cheapest price first

Read-only pass. Nothing was fixed or committed.

## Summary

1 Medium finding, 1 Low. Nothing Critical or High. Worth doing first:

1. Fix the write side of the Hebrew business description (finding 1) —
   the read-side fix shipped today has almost nothing to read yet.
2. Add a test for the cheapest-first sort (finding 2) — cheap to add,
   guards a real user-facing ordering.
3. Re-run the live price check once outbound access to the production
   site is available in this environment (see "Not checked").

## Findings

### 1. (Medium) Hebrew business description: read path fixed, write path still missing
- **File:** `frontend/src/components/dashboard/BusinessDetailsForm.jsx:48-61`,
  `backend/routes/marketplace/businesses.py:69,87,153`
- **What it is:** Today's commit `4a1bceb` fixes `BusinessPage.jsx` to prefer
  `biz.description_he` for Hebrew readers, and `businesses.py:858` now returns
  that field from the public endpoint. Good fix, but there is still no way
  for an owner to *write* it. `BusinessDetailsForm.jsx` — the only form that
  edits a business's `description` — has a single `description` field (line
  50: `description: b.description || ''`) and no `description_he` field or
  language toggle. The business create/update payload models in
  `businesses.py` (lines 69, 87, 153) never accept `description_he` either.
  The only code that ever populates `businesses.description_he` is
  `backend/scripts/backfill_business_from_listings.py`, a one-off backfill
  that copies it from the business's first listing, and
  `backend/utils/businesses.py:196`, which sets it to `None` on creation.
- **User-visible impact:** for any business created or edited after that
  one-off backfill ran (i.e. essentially all of them going forward), a
  Hebrew reader still sees the English description on the business page —
  the exact bug the commit's own comment says it fixed ("found 24 Sep
  2026"), just one layer down. It's silent: nothing errors, the page just
  quietly shows the wrong language.
- **Suggested fix:** add a `description_he` field to `BusinessDetailsForm`
  (mirroring how gigs already do it in `gigs.py`) and accept it in the
  business create/update payload models.

### 2. (Low) No automated test for "cheapest price first"
- **Files:** `frontend/src/pages/BusinessPage.jsx:566-570`,
  `frontend/src/pages/GigDetail.jsx:692-698`
- **What it is:** Both files now sort offers by `cheapest_price` (missing/zero
  prices sort last via `Infinity`) before handing them to `ClarityPanel`,
  which only renders the first 3 (`ClarityPanel.jsx:24`,
  `offers.slice(0, 3)`) — so the sort has real visible effect: it changes
  *which* 3 offers a visitor sees, not just their order. I traced the logic
  by hand and it's correct (stable sort, `Number(...) > 0` guard, no index
  mismatch with the separate unsorted `firstOf()` lookups used for the
  primary button). No test file exists for either component
  (`find frontend/src -iname "*BusinessPage*test*"` etc. found nothing), so
  a future change to `ClarityPanel`'s slice size or the sort key would have
  nothing to catch a regression.
- **Suggested fix:** a small test asserting offers render cheapest-first and
  that a listing with no price sorts to the end.

## Verified clean

- **`backend/utils/page_recipes.py`** (new, 345 lines) — the page-recipe
  selection logic from today's category study. All 6 of its own tests pass
  (`pytest tests/test_page_recipes.py`, 6 passed). Read through the trickier
  parts by hand: Hebrew area-name lookup (`_area`), hero word-count limits,
  and `options()`'s guarantee that the three drafts actually differ (it
  falls back to a theme-dial flip if reordering the body doesn't
  differentiate them). No bugs found. **It is not wired to any route yet**
  (`grep` for callers outside `tests/` found none) — it's inert groundwork
  for the future AI page builder, so there's no live user-facing risk from
  it today.
- **`backend/tests/test_listing_price_parity.py`** — 17/17 passed. Frontend
  and backend still price every listing the same way.
- **Cheapest-first sort itself** — logic correct (see finding 2 for why it's
  only Low, not clean-but-untested).
- **`frontend/src/utils/businessCollections.js`** — the new
  `categoryLabels.${key}` lookup for auto-grouped section headings. The
  `label()` helper is in scope, and the category keys it looks up
  (`real-estate-services`, `cleaning-services`, etc.) exist in both
  `frontend/src/locales/en.js` and `he.js`.
- **Docs cited by the new code** — `docs/ai-page-builder-spec.md` and
  `docs/page-generation-rules.md` both exist and are internally consistent;
  the rules doc's own new "Gaps" section honestly flags known unbuilt
  pieces (a photo-less hero, a property block) rather than hiding them.
- **No fabricated numbers, no new hardcoded secrets, no new i18n keys**
  introduced by this diff (checked the full diff for `t('...'` calls — the
  three matches are pre-existing keys shown only as diff context).
- **`backend/routes/marketplace/businesses.py`** change itself (adding
  `description_he` to the public response) — safe, additive, no
  authorization implications (it's already a public endpoint returning
  public fields).

## Not checked

- **Live price check** (`backend/scripts/live_price_check.py`) — did not
  run. It hits `https://myisraelrental.com/api/properties` by default, and
  this environment's outbound proxy returned `403 Forbidden` (Tunnel
  connection failed) for that host. This is an environment limitation, not
  a finding about the site's prices — **do not read this as "prices are
  fine tonight."** Re-run from an environment with outbound access to the
  production domain, or point `--base` at a reachable instance.
- **Obsidian** — no Obsidian connector is installed for this account
  (`ListConnectors` returned no match for "obsidian"), so I could not use
  it to see what was recently added, as asked. Substituted `git log` against
  the last audit-follow-up commit for the same purpose.
- **Full frontend production build, lint, and full test suite** — not run;
  installing all frontend deps and running a full CRA build was out of
  scope for the time available on a nightly pass focused on the new diff.
  The two changed `.jsx` files were reviewed by hand instead (see above).
- **Visual/RTL screenshot diff** — no local dev server was running, and
  standing one up (Mongo + backend + CRA dev server) was out of scope for
  this pass. `scripts/shot-page-recipes.mjs` (new this diff) needs the same
  setup and was read for correctness only, not executed.
- **`scripts/preview-page-recipes.py`** — read for correctness (looks
  careful: refuses to run against a non-localhost `MONGO_URL`), not
  executed, since it writes to a database and no local Mongo was available.
- **Everything outside this diff's scope** (security/IDOR sweep, contract
  storage, double-booking, dependency audit, Lighthouse) — not part of
  tonight's pass; last covered in earlier audits in this directory.
