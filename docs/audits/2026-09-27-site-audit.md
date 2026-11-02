# Site audit, 27 Sep 2026

Scope: everything landed since the last full audit (`2026-09-14-site-audit.md`), with the deepest pass on what's changed since the `24 Sep` audit follow-up was merged (`de9fd08`) — the size-ladder feature, cheapest-first pricing, Hebrew business-page fixes, and the page-recipes/brief-verdict work (commits `f6db488`..`7dfa615`, 14 commits, 25 files, ~2,630 lines). No Obsidian connector is installed on this account, so git history stood in for it as the record of what's new.

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 1 |
| Medium | 0 |
| Low | 0 |

**Do first:**
1. Fix `_lede()` in `backend/utils/page_recipes.py` — the "!" hero-lede fix from commit `ffc2925` doesn't work; descriptions written in exclamation sentences still get an empty hero lede.
2. Re-run the live price check once network access to the production site is available from wherever this audit runs next — it didn't run tonight (see Not checked).
3. Nothing else needs action tonight — the rest of the new feature (size ladder, cheapest-first sort, Hebrew descriptions) checked out clean.

## Findings

### High — the "!" hero-lede fix doesn't fix anything
- **File:** `backend/utils/page_recipes.py:274-284` (`_lede()`)
- **Evidence:** the fix in commit `ffc2925` (25 Sep) changed the sentence-splitting regex from `(?<=[.?])\s+` to `(?<=[.?!])\s+` so that "!" also ends a sentence. But the split is a lookbehind — it doesn't consume the punctuation — so every fragment produced by splitting on "!" still *contains* an "!". The very next line still discards any fragment with `("!" in s)`. Reproduced directly:
  ```
  >>> from utils.page_recipes import _lede
  >>> _lede({"description": "Great food! Fast delivery! Cheap prices!"}, "en", title="Cholent house")
  ''
  ```
  Same empty result for the Hebrew case. No test exercises `_lede()` or this scenario — `test_page_recipes.py` has no test with `!` at all — so nothing caught it.
- **User-visible impact:** exactly the bug the commit claims to have fixed. Any business whose owner wrote their description in short, punchy, exclamation-ended sentences (common, plain-language copy) still gets a blank hero lede on their AI-built page — the hero shows a headline with nothing under it.
- **Suggested fix:** strip the trailing punctuation from `s` before the `"!" in s` check, or check for `!` only *inside* the sentence (i.e. `s.rstrip("!.?")` then test `"!" in that`). Add a test with an all-"!" description in both languages so this doesn't silently regress again.

## Verified clean

- **Live-diff scope (`de9fd08`..`HEAD`, the size-ladder / cheapest-first / Hebrew-description work):**
  - `frontend/src/locales/en.js` / `he.js`: the two new key groups (`sizeFields`, `sizeLadder`) are present and translated in both files — no parity gap.
  - `SizeLadderBlock.jsx` / `SizeFields.jsx`: RTL-safe (logical `end-0`, `dir="ltr"` wrapped around numerals, `dir="auto"` on names), no hardcoded hex, every `--pg-*`/`--action*` CSS variable it reads is defined in `page-theme.css` / `theme-flow.css` — no invisible-element risk.
  - `width_cm`/`length_cm`: bounded `gt=0, le=500` server-side in `routes/marketplace/shared.py`'s `ProductItem`, not just in the client's `<input max>` — a client bypass can't smuggle a bogus size onto a page.
  - Frontend `sizes` block registry (`BlockList.jsx`) and backend `BLOCKS` registry (`page_composition.py`) agree on the block name and its one variant — no drift between what the generator can emit and what the renderer can draw.
  - Cheapest-first sort (`BusinessPage.jsx`, `GigDetail.jsx`): both copies push unpriced/quote-only items to the end via `Infinity`, consistent with each other.
  - `description_he` fix in `routes/marketplace/businesses.py` and `BusinessPage.jsx`'s `about` selector: Hebrew readers now get the Hebrew description instead of silently falling back to English; English readers unaffected.
  - `businessCollections.js`'s new category label lookup falls back to the old title-cased slug when no translation key exists — a safe fallback, not a silent blank.
  - Every doc path referenced from the new/changed code (`docs/ai-page-builder-spec.md`, `docs/business-page-customization-spec.md`, `docs/business-page-spec.md`, `docs/owner-sharing-spec.md`, `docs/page-builder-research.md`, `docs/page-generation-rules.md`, `scrollcraft/FINGERPRINTS.md`) exists on disk.
  - No hardcoded hex or inline `fontFamily: 'Playfair Display'` introduced anywhere in the diff.
- **Tests:** `backend/tests/test_listing_price_parity.py` — 17/17 pass (website and server price every listing the same way). `backend/tests/test_page_rules.py`, `test_page_recipes.py`, `test_page_composition.py` — 19 passed, 20 intentionally skipped (need a live backend, see below); nothing failed.

## Not checked

- **Live price check** (`backend/scripts/live_price_check.py`) — did not run. This sandbox's outbound network is proxied and returned `403 Forbidden` reaching `myisraelrental.com`. Per the skill's own instruction, this reads as **not checked**, not as clean — it should be the first thing re-run from an environment with real outbound access.
- **The rest of the backend test suite** (everything outside the three page-builder files above) — needs a running MongoDB and a live FastAPI server on `localhost:8001`; neither is available in this sandbox (no `mongod` installed). The 20 skipped page-builder tests need the same live server. This also means `scripts/check-page-builder.mjs` and `scripts/check-size-ladder.mjs` (both fetch a running dev server) could not run.
- **Visual/RTL screenshots** — no dev server to screenshot against; the RTL/design-token review above was done by reading computed CSS variable names statically, not by rendering.
- **Everything outside the `de9fd08..HEAD` diff** — the 9/14 and 9/23-9/24 audits already covered the codebase broadly and their fixes are merged; this run intentionally focused on what's landed since, per the "what was added recently" instruction, rather than re-walking ground already audited 13 days ago. A full re-sweep of security/data-integrity/accessibility across the whole app wasn't attempted tonight.
