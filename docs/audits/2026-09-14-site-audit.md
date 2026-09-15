# Site audit — 2026-09-14 (evening follow-up)

Scope: everything committed since this morning's `docs/audits/2026-09-14-ui-audit.md`
(range `21e2926..HEAD`, i.e. commits `d421a26` through `2fd90f9`). That range is two
pieces of work: **(1)** the fix for the translation-safety bug that morning's audit
flagged ("Cheese danish" gig showing a model's refusal text as its Hebrew title),
and **(2)** a rewrite of the admin **Smart Lists** tool (WhatsApp/share list builder)
plus a fix for the home-preview "site has no listings" false-empty-state bug that
same morning's audit also flagged.

This was a read-only investigate-and-report pass. Nothing was fixed, committed as a
code change, or deployed — this file is the report only.

## How this was done

No Obsidian vault was reachable from this session (no such connector is configured
on this account), so "what was added recently" was scoped from the repo's own
commit history and today's existing audit doc instead — a strictly more precise
source for this repo anyway.

- Full diff read of every file touched in the range, plus enough surrounding code
  in each file to understand behavior, not just the diff hunks.
- Two independent deep-dive passes (separate context windows): (1) the Smart Lists
  backend + frontend rewrite, (2) the home-preview load-failure/i18n fix.
- I read the translation-safety fix (`backend/utils/translate.py`,
  `backend/scripts/clear_bad_translations.py`) directly myself, plus its test file
  and every call site of `translate_marketing`/`translate_marketing_to_hebrew`.
- Mechanical checks run directly: `scripts/test-i18n-parity.mjs` (bilingual key
  parity across every `t()` call in the frontend) — passed clean.
- **Could not run the backend test suite or start the app.** This session's
  container has no `backend/.env` (only `.env.example`), no local MongoDB, and no
  `pytest` installed — so `test_smart_lists_filter_db.py`, `test_smart_lists_recency.py`
  and `test_translate_plausible.py` were read and reasoned about, not executed.
  Unlike this morning's audit (which had a real shell, local Mongo and a headless
  browser), this one is static code review only — no live rendering, no
  Playwright, no RTL computed-style checks. Flagged again under "Not checked."

---

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 1 |
| Medium | 5 |
| Low | 6 |

**Fix these three first:**

1. **The WhatsApp share-list length guard measures the wrong string** and can
   silently let an admin send a WhatsApp message that gets cut off by WhatsApp's
   real limit — the exact bug this rewrite's commit message says it fixed, just
   moved one layer down.
2. **Switching a saved Smart List's category can silently reactivate a stale rent
   filter** the admin never set for the new context, quietly narrowing or emptying
   results with no visible cause.
3. **The new translation-safety check only recognizes English-language refusals.**
   A Hebrew-language refusal from the model on an English→Hebrew translation
   would sail through undetected — the same class of bug the fix exists to close,
   in the one direction that isn't tested.

None of this is Critical: no data loss, no security exposure, and no false claim
reaches real users as things stand today (the truthfulness bug from this morning
*is* correctly fixed for the case it names — see Verified clean).

---

## Findings

### 1. [High] The WhatsApp share length guard checks raw string length, not the length actually sent to WhatsApp
**File:** `frontend/src/components/admin/SmartListsTab.jsx:310-320`, `smartListText.js` (`WA_TEXT_LIMIT = 3900`)

`overWaLimit` compares `messageText.length` — a plain JS string length — against
3900, then builds the link as `https://wa.me/?text=${encodeURIComponent(messageText)}`.
The guard measures the wrong thing: every ILS price runs through `formatPrice()`,
which emits `₪` (U+20AA); `encodeURIComponent('₪')` is `%E2%82%AA` — 9 characters
sent for every 1 character measured. A recency header also always adds an em dash
`—`, same ~9:1 blow-up.

**Failure scenario:** an admin selects 20-25 ILS-priced listings (allowed —
`SEND_CAP_OPTIONS` goes up to 25, or 0 for no cap) with "Added to site" recency
turned on. `messageText.length` might read 3600 — under the gate, button enabled,
no warning — while the actual encoded URL WhatsApp receives is hundreds of
characters longer purely from the `₪` and `—` characters, and can exceed WhatsApp's
real limit. This is precisely the "silently truncated" failure the commit message
says was fixed, just at the wrong measurement point.

**Fix direction:** gate on `encodeURIComponent(messageText).length` (or the full
`https://wa.me/?text=...` string), not the raw string length.

### 2. [Medium] A vacation category's disabled rent inputs don't clear the underlying rent filter — it can reappear silently after reopening a saved list
**File:** `SmartListsTab.jsx:63-64` (state), `169-178` (`currentFilters()`), `406-424` (rent inputs), `246-247` (`openSavedList`), `456-458` (`save_smart_list`)

When the selected category is vacation-like, the rent inputs are disabled and show
blank, but the `minRent`/`maxRent` React state is never cleared — `currentFilters()`
reads the raw state regardless. The backend correctly skips price filtering for
vacation-like categories, so on-screen results look right *in the moment*, but a
saved preset created while vacation-like still stores the stale rent bounds in its
`filters` document.

**Failure scenario:** an admin builds and saves a vacation list (no rent shown, none
applied). Later they reopen that saved list and switch its category to
long-term/short-term. The stale rent bound from whenever it was last set for a
non-vacation category reactivates with no visible cause, quietly narrowing or
emptying the result set.

**Fix direction:** gate the saved payload the same way the display is gated
(`isVacationLike ? null : minRent`), or clear the state on category change.

### 3. [Medium] The translation-safety fix's "model talked back instead of translating" check is English-only
**File:** `backend/utils/translate.py:100-107` (`_META_REPLY`), `114-131` (`plausible_translation`)

Today's fix (`d421a26`) rejects saved translations that are empty, mostly in the
wrong language, suspiciously long, or match a refusal/commentary phrase like
*"please share the copy..."*, *"as an AI..."*. The refusal-phrase regex only matches
**English** phrasing. `detect_lang(out) != target_lang` won't catch a refusal
either, because a Hebrew-language refusal *is* in the target language when the
request is English→Hebrew.

**Failure scenario:** if the model ever answers an English→Hebrew translation
request with a Hebrew-language clarifying question or refusal instead of an actual
translation, none of the three checks catch it, and it gets saved — reproducing
the exact "Cheese danish" bug this fix exists to close, just in the untested
direction. `test_translate_plausible.py` only covers English-phrased refusals; there
is no test for a Hebrew one.

**Fix direction:** add a small set of Hebrew refusal/commentary phrases to the
detector (or a language-agnostic heuristic, e.g. the output containing a question
mark plus first-person model language), and a test case for it.

### 4. [Medium] No server-side validation that a Smart List's min ≤ max (rent or bedrooms)
**File:** `backend/routes/admin_smart_lists.py:77-88` (`SmartListFilters`), `272-281` (`_apply_filters`)

Only the frontend checks for an inverted range before submitting. The backend
model has no cross-field validator; `_apply_filters` ANDs both bounds
independently, which for `min > max` always excludes every property with no error.

**Failure scenario:** any direct caller of the `generate`/save routes (a script, a
future integration, a stray Postman request) that sends an inverted range gets a
silent `count: 0` — or an always-empty saved preset — with nothing explaining why.

**Fix direction:** a Pydantic validator on `SmartListFilters` enforcing `min <= max`
for both rent and bedrooms, returning 422.

### 5. [Medium] The home-preview's automatic retry window is shorter than the outage it says it covers
**File:** `frontend/src/components/home/useHomeShowcase.js:83, 90` (`RETRY_DELAYS_MS`)

The code comment says the retry schedule exists to cover "unreachable for about a
minute... a schedule that outlasts a deploy swap," but `RETRY_DELAYS_MS = [3000,
8000, 20000]` sums to 31 seconds across 4 total attempts, then stops retrying
automatically (a manual click or the browser's `online` event is needed after
that).

**Failure scenario:** during a real ~60-second Railway deploy swap, a visitor who
loads the home preview partway through sees the correct, honest "couldn't load" +
retry message (the underlying truthfulness bug is *not* reintroduced) — but for
roughly the back half of a typical deploy, self-healing requires them to click
Retry rather than happening on its own, contrary to what the comment promises.

**Fix direction:** extend the retry schedule to actually cover ~60s (e.g. a fourth,
longer delay), or soften the comment's claim to match the real coverage.

### 6. [Medium] Smart Lists' new admin-only auth check, ownership scoping, and interactive selection logic have no test coverage
**File:** `backend/tests/test_smart_lists_filter_db.py`, `test_smart_lists_recency.py`, `frontend/src/components/admin/smartListText.test.js`

All three test files call internal functions (`_apply_filters`,
`_parse_iso_datetime`, the Pydantic models, or the pure text helpers) directly —
none use an HTTP test client against the actual FastAPI routes. There is no test
that hits a `/admin/smart-lists*` route with a non-admin token and checks for a
403, or that one admin's saved list is actually invisible to another admin
(the one IDOR-relevant check in this file). The stateful part of the rewrite that
is the actual point of the commit — selection capping, the send-cap trim, the
Share/Copy WhatsApp-limit gating in `SmartListsTab.jsx` — is entirely untested at
the component level; only pure helper functions extracted into `smartListText.js`
are covered.

Note: on manual read, the admin check (`_require_admin`, first line of all 6
routes, reading a server-signed JWT) and the ownership filter on saved lists both
look correct — see Verified clean. This finding is about missing regression
coverage, not a confirmed bug today.

**Fix direction:** one `TestClient` integration test for the 403/404 auth and
ownership paths; a React Testing Library test for the selection toolbar.

---

## Low / nits

- **The "Today's picks" section vanishes entirely — heading included — during the
  home preview's ~31s retry window**, with no loading placeholder.
  (`frontend/src/pages/HomePreview.jsx:304-338` wraps the whole section, including
  its heading, in the loaded/failed/retrying condition; the "Recently added"
  section below it keeps its heading visible the whole time.) During a real outage
  this reads as a broken layout — hero → doors → an abrupt gap → "Recently added"
  → businesses — rather than "still loading." Fix: keep the heading always
  rendered and only swap the body, matching the pattern already used for
  "Recently added."
- **The two new error states aren't visually consistent** — one is centered, one
  is start-aligned, because they reuse two different pre-existing CSS classes.
  Cosmetic only.
- **Pre-existing, found incidentally while reading `admin_smart_lists.py`:** a
  listing priced at exactly `₪0`/`$0` sorts as if it had no price at all (falls to
  the "unpriced" sentinel because `0` is falsy in the sort key), landing last
  instead of first under "cheapest first." Not touched by this diff.
- **Pre-existing, found incidentally:** the properties query behind Smart Lists
  caps at 1000 documents before the new recency/price/bedroom filters run, with no
  signal to the admin if a filter combination ever matches more than that. Not a
  live risk today (~196 total properties per CLAUDE.md) and not touched by this
  diff — worth a note for later.
- **Pre-existing hardcoded English strings remain in `SmartListsTab.jsx`** (labels,
  toasts, a couple of `aria-label`s) that bypass `t()`. Not a regression — none of
  these lines were touched by this diff, and the file already documents that only
  the two sort options this change added were translated.
- **Confirmed no LLM/Anthropic API call anywhere in the Smart Lists rewrite**,
  despite the name — it's a deterministic Mongo filter plus a manual selection UI.
  So the "cost/API-credit risk" audit category simply doesn't apply here; noted so
  the silence isn't mistaken for an unchecked risk.

---

## Verified clean

- **This morning's home-page truthfulness bug is actually fixed.** Traced
  line-by-line: a network/HTTP failure and a malformed (non-array) response are
  both now counted as "failed," distinct from a genuine empty list; the page never
  shows "No offers yet" as the result of a failed request. No permanent-spinner
  path, no stuck-loading state, no race between a manual retry and a scheduled one.
- **Bilingual completeness, checked two ways:** the repo's own
  `scripts/test-i18n-parity.mjs` passed clean across every `t()` call in the
  frontend (including dynamic-key families). Separately, every new `sweep.*` key
  used by Smart Lists (~36 keys, including a dynamic template) and every new
  `home.v2.*` error/retry key were individually grepped against both `en.js` and
  `he.js` — present in both, matching interpolation placeholders, and the Hebrew
  values are real translations, not English left in place.
- **Smart Lists admin-only check:** `_require_admin` (reading `role` from a
  server-signed JWT, not client-suppliable) is the first line of the body in all 6
  routes in `admin_smart_lists.py`.
- **Smart Lists saved-list ownership (IDOR):** get/delete both filter by
  `{id, owner_id}` with `owner_id` from the verified JWT — one admin cannot read or
  delete another admin's saved list.
- **No Mongo/NoSQL injection path** in the new filter code — free-text search uses
  `re.escape()`, bedroom/rent bounds are typed floats, no client-controlled dict
  keys reach the query.
- **The FX conversion call can't take the endpoint down** — network failures fall
  back to a cached/default rate internally.
- **The "field silently dropped on save" bug this rewrite fixes is actually fixed
  and tested** — a round-trip test confirms every filter field survives a save.
- **No duplicate selections or duplicate results** in the new selection UI.
- **No hardcoded hex colors or new design-token violations** in either diff.
- **No new inline `fontFamily: 'Playfair Display'`** in any changed file.
- **`clear_bad_translations.py`** (the cleanup script for existing bad
  translations) correctly refuses `--apply` against a non-local database without
  an explicit `--production` flag, spends no API credit, and never prints post
  text — only ids and lengths.
- **`translate_missing_side` and the one route caller
  (`marketplace/requests.py`)** both already guard on the translation being
  non-empty before writing it, so today's change to return `""` on a rejected
  translation doesn't break either caller — it just correctly leaves the field for
  the next edit to retry, as designed.

---

## Not checked (and why)

- **The backend test suite was not run.** No `backend/.env`, no local MongoDB, no
  `pytest` in this session's container. All three new/changed test files were read
  and reasoned about statically, not executed.
- **No live rendering, no Playwright, no screenshots, no RTL computed-style
  checks.** This session had no dev server and no headless browser available —
  unlike this morning's audit, everything here is static code review. Take the
  "Verified clean" bilingual/CSS findings as code-level checks, not visual
  confirmation.
- **Whether `SmartListsTab.jsx` looks right in Hebrew/RTL** was not checked
  visually for the same reason.
- **Production data** was not queried — no read-only production access in this
  session. Whether the "Cheese danish" gig (or anything like it) is still live is
  unverified; this morning's fix commit says it cleared 49 bad fields locally, all
  test fixtures plus that one gig, but that was a local-database run.
