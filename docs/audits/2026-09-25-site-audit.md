# Site audit, 25 Sep 2026

Scope: full read-only pass per `.claude/skills/site-audit/SKILL.md`, with the
deepest scrutiny on the newest work — everything committed since the last
full site audit (14 Sep) and, most closely, the last three days (23-25 Sep):
verified reviews (Google import), the AI page-builder rule engine
(`page_rules.py`/`page_recipes.py`/`page_composition.py`), the size-ladder
page block, and the business/gig page edits that went with them (39 files
touched in that window).

## Summary

**0 Critical, 0 High, 1 Medium, 3 Low.** Nothing here needs a middle-of-the-night
fix. The three things worth doing first, in order:

1. `GET /marketplace/businesses/{id}/reviews` and `/marketplace/listings/{id}/reviews`
   don't check whether the parent business/listing is deactivated or public —
   a deactivated business's reviews stay fetchable by ID (Medium).
2. **The nightly live-price check did not run** — the sandbox this audit ran in
   can't reach `myisraelrental.com` (network policy blocks it), so tonight's
   pass over real listing prices is missing. This is an environment gap, not
   a code problem, but it means the one check precedent shows matters most
   (real listings, real prices) is unverified tonight. See "Not checked."
3. Two small, low-risk data-quality notes in the reviews code (below) — no
   rush, but worth a look next time that file is open.

Everything else checked — backend security/IDOR/flags on the new features,
frontend RTL/bilingual/design-tokens on the new components, and doc-vs-code
drift for the two new specs — came back clean.

## Findings

### Medium

**1. Review endpoints don't check the parent's visibility before serving.**
`backend/routes/reviews.py:177-186` — `GET .../businesses/{id}/reviews` and
`GET .../listings/{id}/reviews` call `_page({"business_id": ...})` directly.
Compare `public_business()` (`backend/routes/marketplace/businesses.py:801-820`),
which 404s a deactivated or empty business before showing anything else about
it. The reviews endpoints have no equivalent check, so a deactivated
business's (or an unpublished gig's) reviews can still be read by ID even
though the business page itself now 404s.
*Impact:* minor information leak / inconsistency — someone who has (or
guesses) a business ID can still read its reviews after the owner
deactivates it. Not PII, not a security hole, just inconsistent with the
rest of the surface's hide-on-deactivate rule.
*Suggested fix:* have both routes look up the parent the same way
`public_business()` does and 404 under the same condition, before paging
reviews.

### Low

**2. Google-imported reviewer names aren't truncated like native ones.**
`backend/utils/google_reviews.py:172-173` stores `reviewer.displayName`
verbatim (only "anonymous" reviews are relabelled "Google user"). Native
reviews go through `display_name()` (`backend/utils/reviews.py:128-134`),
which truncates to "First L." before the same `public_review()` serializer
shows either kind. Likely fine in practice (a Google review's name is
already public on Google Maps), but it's an inconsistency between the two
sources of "verified reviews" that's worth a one-line decision either way.

**3. `google_mappings` can attach a review to the wrong business of the same owner.**
`backend/routes/reviews.py:331` resolves a `property`-type Google mapping
target's business via an unscoped `find_one({"owner_user_id": ...})` — it
picks *some* business belonging to that owner, not necessarily the one the
property actually belongs to, if the owner runs more than one business. Not
an IDOR (still scoped to the caller's own data), just a possible
mis-attachment for owners with multiple businesses.

**4. The page-rules content checker (`page_rules.py`) isn't wired into any route yet — by design, but flag it so it isn't missed.**
`check_composition`/`check_options`/`check_unique` (the rules that reject
invented numbers, unbacked claims, fake urgency, generic filler) are never
called from `backend/routes/`; `businesses.py:555-561` validates a saved
page only against the `PageComposition` *schema*, not the content rules.
This matches the docs exactly — `docs/ai-page-builder-spec.md:2-6` and
`docs/page-generation-rules.md:22` both say the AI generator "is not
switched on yet," and there's no generation endpoint to wire it into. Not a
bug today. Noted so that whenever a generation/publish route does ship,
`check_composition` is required to gate it — the tests already prove the
checker itself works (see below), it just isn't load-bearing anywhere yet.

## Verified clean

- **Live-listing price parity**: `pip install pytest` +
  `python3 -m pytest backend/tests/test_listing_price_parity.py -q` — **17/17
  passed.** The website and the server price every listing the same way.
- **Verified-reviews feature flags**: `REVIEWS_NATIVE_ENABLED` and
  `REVIEWS_GOOGLE_IMPORT_ENABLED` both default OFF (`utils/reviews.py:74,78`,
  exact `"1"` match), `.env.example` ships them blank, and every native/Google
  route 404s when its flag is off. The one intentionally-ungated route
  (`google_disconnect`) has an in-code comment explaining why (an owner must
  be able to revoke access even after the flag is turned off) and only
  deletes/hides, never exposes. Both background loops check their flag and
  no-op when off. Frontend (`GoogleReviewsCard.jsx`, `ReviewsSection.jsx`)
  defers to the backend's `/reviews/config` endpoint rather than keeping its
  own copy of the flag logic, so there's no path for the UI to show before
  the backend allows it.
- **IDOR / ownership checks**: every review mutation (create/edit/respond/
  report/remove) checks caller identity server-side; every business mutation
  goes through `_owned()`; Google-location mapping is restricted to the
  caller's own businesses/properties/gigs; admin routes check
  `role == "admin"`.
- **PII**: `public_review()` returns no author id/email; the public business
  page strips whatsapp/email/phone; `page_brief` is owner-only.
- **Invented numbers / fabricated claims**: `page_rules.py`'s `CLAIMS`/
  `URGENCY`/`numbers` checks reject any number or claim not traceable to
  `known_numbers()` or the owner's own text; `page_recipes.hero()` builds
  headlines only from real listing titles/areas/descriptions. No hardcoded
  stats found in either file. Cross-checked all 39 changed files —
  no new hardcoded counts, ratings, or "X people viewing" strings anywhere
  in the diff.
- **AI page-builder docs vs. code**: spot-checked four concrete rules from
  `docs/page-generation-rules.md` against `page_rules.py`/
  `SizeLadderBlock.jsx` (size-ladder minimum-3-items/10cm-ruler/reduced-motion
  rule, the kosher/licensed claims rule, the full rule-id table, and the
  "AI is not switched on yet" framing) — all match the code exactly, nothing
  documented as shipped that isn't.
- **CLAUDE.md "Discontinued" section**: `DOCUMENT_SERVICES_ENABLED` appears
  only in test-file comments (no live route/flag), and no `storage`-related
  UI or copy was added anywhere in the 23-25 Sep diff (the only touched
  locale lines were an unrelated toggle-switch accessibility fix).
- **Docs cited by name** inside `docs/verified-reviews.md`,
  `docs/ai-page-builder-spec.md`, and `docs/page-generation-rules.md` all
  exist in the repo — no vanished-spec repeat of the earlier incident.
- **RTL / design tokens / bilingual completeness**, all 17 newest frontend
  files (`SizeLadderBlock.jsx`, `ClarityPanel.jsx`, `SizeFields.jsx`,
  `GoogleReviewsCard.jsx`, `ReviewsSection.jsx`, `BusinessPage.jsx`,
  `CreateGig.jsx`, `GigDetail.jsx`, `PropertyDetail.js`, the dashboard tabs,
  `App.css`): no inline `fontFamily: 'Playfair Display'`, no new hardcoded
  hex, no shadcn-token collisions, no physical-property RTL bugs (numeric
  size runs are correctly wrapped in `dir="ltr"` spans), no invented display
  numbers. Every new `t()` key exists in both `en.js` and `he.js` —
  `node scripts/test-i18n-parity.mjs` passed clean.
- **JS unit tests**: `npx craco test --watchAll=false` — 119/119 passed, 5/5
  suites.
- **New page-builder pytest suites**: `test_page_recipes.py` and
  `test_page_rules.py` — 19/19 passed. `test_page_composition.py` has 20
  tests that need a live backend on `:8001`; skipped (no server running in
  this read-only pass), not failed.
- **Production build**: `npm run build` succeeded. All ESLint
  `react-hooks/exhaustive-deps` warnings in the output pre-date this window
  (confirmed by diffing `GigDetail.jsx`, the one changed file among the
  warned files, against the pre-window commit — the warned lines aren't in
  its diff). No new warnings introduced.

## Not checked

- **Live price check did not run.** `python3 backend/scripts/live_price_check.py`
  failed with `Tunnel connection failed: 403 Forbidden` — this sandbox's
  outbound network policy blocks reaching `myisraelrental.com`. Per the
  script's own design, a check that can't run prints
  `PRICE CHECK DID NOT RUN` rather than silently reading as "no problems,"
  and that's being carried into this report the same way: **tonight's pass
  over real listing prices did not happen.** The parity test (price *logic*
  matches between server and site) did run and passed — what's missing is
  the check against live *data* (a typo'd price, a missing price, etc). Rerun
  from an environment with outbound access to the production site to close
  this gap; it's the highest-value single check per the skill's own
  precedent notes.
- **Lighthouse / visual screenshots / accessibility scoring** — not run this
  pass; this audit focused on the code-level review of the newest feature
  work rather than a full visual sweep (the last visual/dead-ends passes were
  14-15 Sep and 23 Sep respectively). Worth a `visual-diff` pass next time
  focused on the size-ladder block and the reviews UI, since neither has been
  screenshotted yet.
- **`test_page_composition.py`'s 20 server-dependent tests** — skipped, no
  live backend running in this read-only sandbox pass.
- **Full existing-code hex/RTL/security sweep** — out of scope by the skill's
  own rules (only new/changed code is in scope); the ~1,275 pre-existing
  hardcoded hex values and older files were not re-audited.
