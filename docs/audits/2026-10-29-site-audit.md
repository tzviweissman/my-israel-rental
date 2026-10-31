# Code audit, 29 Oct 2026

## In short
- The new "people searched" lines (Why list, Why host, join) show counts anyone can fake: a script sending three different made-up visitor ids makes "3 people searched in Tel Aviv" appear, and it can make any text it likes the "most searched area". It is a claim to visitors that nothing real backs, which the site rules forbid.
- Smaller: the visitor count behind an owner's new rental and sales figures can be inflated the same way, and a failed translation still uses up the owner's daily allowance.
- Fixed tonight: nothing; none of these is a small safe change (they change what is counted and stored).
- Needs your decision: how to make demand counts hard to fake (suggested below), or whether the lines wait until traffic is real.

## New findings
1. **[Medium] Faked demand numbers.** `backend/routes/site_visits.py` `record_site_search`: `visitor` is read from the `X-Visitor-Id` header with no check, rows are unique per (day, visitor, kind, area, what), and `site_demand` publishes `stays_people_7d`, `services_people_7d` and `top_area` once 3 distinct ids exist (`MIN_SHOWN = 3`). Rate limit is 60 per minute per IP, so one machine reaches 3 in a second. `area` is free text up to 80 characters and goes straight to the public `top_area.area`. Proof: the lines above (read; not run, no database in this sandbox). Fix: only count ids that have already made a counted visit (the visits collection), accept `area` only from the known area list (`utils/area_normalize`), and raise MIN_SHOWN or require ids older than a day.
2. **[Low] Inflatable visitor counts.** `routes/marketplace/page_edits.py` `designed_site_visit` records any `X-Visitor-Id`, 120 requests per 10 minutes per IP. The count feeds "requests per hundred visitors" in `properties/browse.py` `rental_figures` and the sales summary. Fix: same as above (only ids seen before, or one per id per day is already the case, so cap new ids per IP).
3. **[Low] Translation allowance spent on failures.** `page_edits.py` `translate_page_words` adds `len(texts)` to the day's counter before calling the model; a 502 still costs the owner. Fix: increment after success, or subtract on failure.

## Fixed this run
None.

## Still open
- [Low] `awayReply.body` and `stays.repliesWithinHours` use a count with no plural set, so `scripts/test-i18n-parity.mjs` still fails (first seen 28 Oct; fixes sit on audit branches not yet on main).
- Audit setup cannot install Playwright or MongoDB in this sandbox (first seen 15 Oct).

## Could not confirm
- Whether `view_tracking.record_view` caps the length of a visitor id; if not, long ids are stored as sent. Would confirm: read `utils/view_tracking.py` against a request with a 10,000 character header.

## Verified working
- Production build passes (`craco build`).
- 45 tests that need no database pass: analytics periods, page translate, page edits, listing price parity (website and server price every listing the same way).
- Ownership checks: `/ads/make` checks the caller owns the target before spending model credit and is limited to 20 a day per person; `/ad/extract` needs sign-in and is limited to 20 an hour; rental analytics and the bookings CSV only read the caller's own listings and bookings; page translate checks ownership.
- `frontend/server.js` visit script: the slug put in the page is restricted to the published hand-built list, so it cannot carry script.
- Currency codes: the validator also covers the edit route (it uses the same model).

## Not checked
- FAILED  playwright + chromium (download blocked in the sandbox)
- FAILED  mongodb on :27017 (download returned 403)
- SKIPPED api (no database): so the rest of the backend test suite and any request against the API did not run.
- PRICE CHECK DID NOT RUN: could not read the live site (proxy blocks it). Parity test above stands in.
- Pages as rendered (the UI audit's area).
