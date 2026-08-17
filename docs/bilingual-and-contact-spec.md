# Bilingual content, easy contact, and smarter search

Goal: a Hebrew speaker and an English speaker should be able to use the same board without either of them noticing there is a language barrier — and contacting someone should take one tap and zero decisions.

Written against the code as it stands (verified 16 Aug 2026), not from memory.

---

## What already exists

- `utils/translate.py` → `translate_marketing_to_hebrew()` — marketing-tone translator, Sonnet.
- `routes/marketplace/shared.py` → background helper fills `title_he` / `description_he` on save (lines ~89–130).
- `routes/marketplace/requests.py` → same on create and on edit (`_backfill_hebrew`, ~line 308; re-run when title/description change or Hebrew is missing, ~line 567).
- `shared.py::_search_clauses` → tokenised search that **already queries `title_he` and `description_he`** alongside the base fields (~line 726–730), and already handles the Hebrew unicode block when tokenising.
- Chat has its own translation path (`utils/chat_translate.py`).

The foundation is right. Three things are missing.

---

## Problem 1 — Translation only runs one way

`translate_marketing_to_hebrew()` assumes the input is English. So:

- **English post** → `title` (EN) + `title_he` (HE). Works.
- **Hebrew post** → `title` (HE), and `title_he` gets Hebrew fed through an English→Hebrew prompt. There is **no English version at all**, so an English-speaking owner browsing the board sees Hebrew and moves on.

That is the whole of the user-visible problem.

### Fix — store both languages, always, keyed by language not by "original"

**1.1 Detect the source language on save.** Cheap and deterministic: if the text contains characters in `֐-׿` above a small threshold, treat it as Hebrew; otherwise English. No API call needed for detection.

**1.2 Add `title_en` / `description_en`** alongside the existing `_he` fields, on requests, gigs/services, and property listings.

**1.3 Generalise the translator.** Add `translate_marketing(text, target_lang)` in `utils/translate.py` (keep `translate_marketing_to_hebrew` as a thin wrapper so nothing breaks). Same marketing-tone system prompt, target language parameterised.

**1.4 On save, fill whichever side is missing** — Hebrew source fills `_en`, English source fills `_he`. Keep it in the existing background task; do not block the write. Store `source_lang` on the record so the UI can label the original.

**1.5 Failure must never block a post.** Existing behaviour — if the API call fails the post still publishes and the backfill retries on next edit. Preserve that exactly.

**1.6 Backfill.** One script, modelled on `scripts/backfill_hebrew_gigs.py`, to populate `_en` for existing Hebrew-authored records. **Run against the dev database first and report counts before touching Atlas** — this spends real API credit per record, so quote the estimated cost and wait for approval before the production run.

---

## Problem 2 — Search is bilingual by accident, not by design

`_search_clauses` already looks in `title_he` / `description_he`, so once `_en` fields exist they must be added to the same `$or`. But the bigger gap is **place names**.

**2.1 Add `title_en` / `description_en` to the `$or` in `_search_clauses`.** One-line change, and worthless until 1.2 ships.

**2.2 Canonical area IDs.** "Ramat Eshkol", "רמת אשכול", "Ramot Eshkol" and "ramat-eshkol" are one place, and today `area` is matched with a case-insensitive `$regex` (`requests.py` ~line 406), which matches none of the others. Introduce a small alias table mapping every spelling — English, Hebrew, common misspellings — to one canonical area ID; store the ID on the record and match on it. This is the single highest-value change in this document: it is what makes a Hebrew post findable by an English search.

**2.3 Index the fields that are now searched.** Mongo indexes on the `_en` / `_he` fields and the canonical area ID.

---

## Problem 3 — Contact takes too many decisions

**3.1 One affordance, everywhere.** "Message" on every card and detail view. No phone, no email, no contact form — anywhere in UI or API response. (This is already the rule; enforce it on the new surfaces.)

**3.2 Pre-fill the first message** from context, editable before sending:
- Listing: *"Hi — I saw your 3-bedroom in Ramat Eshkol. Is it available from September?"*
- Request: *"Hi — I have a place that might fit what you're looking for."*
An empty compose box is where people stall. Compose it in **the sender's language**; the recipient's existing chat translation handles the rest.

**3.3 Show responsiveness** where it's known: "usually replies within a few hours." Compute from existing chat timestamps (median first-reply time, last 90 days). Show nothing rather than something misleading if there are fewer than ~5 data points.

**3.4 Language badge on cards** — a small `EN` / `HE` marker showing the original language, plus **"Translated from Hebrew · see original"** on detail views, toggling to the source text. Never hide that a translation is machine-made; people trust it more when it's labelled, and native speakers want the original.

---

## Problem 4 — Make the search box do the parsing (do this last)

**4.1 Free-text → filters.** "3 bed Ramat Eshkol September under 7000" becomes structured filters shown as removable chips. One Anthropic call on submit, works in both languages, and it turns the search box into the smartest control on the site.

Guardrails: cache identical queries; fall back silently to the existing token search if the call fails or returns nothing usable; never let it block results.

**4.2 Two-sided matching.** When a request is posted, surface listings that fit it to the seeker; when a listing is posted, show the owner the open requests it answers. Both datasets already exist. This is the flywheel — but it belongs after the board has real volume, not before.

---

## Order of work

1. **1.1–1.5** (bilingual storage) — the user-visible fix.
2. **2.1–2.3** (search + canonical areas) — makes it actually work.
3. **3.1–3.4** (contact) — small, independent, high polish.
4. **1.6** backfill — after 1–2 are proven on new records.
5. **4.x** — later, deliberately.

## Constraints

- Anthropic spend: one call per post per missing language, on write only, never on read. Quote estimated cost before any bulk backfill; local dev DB first (`backend/.env` `MONGO_URL` — check before running anything).
- i18n keys for all new strings in **both** `en.js` and `he.js`.
- Every new surface works LTR and RTL; headings use `var(--font-head)`.
- Verification per `docs/acceptance-checklist.md`: screenshots at 1280/768/375 in both directions, no console errors.
