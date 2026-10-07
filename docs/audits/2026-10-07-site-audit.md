# Site audit, 7 Oct 2026 (automated, read-only)

Scope: commits of the last ~3 days (storefront sales features, guest booking, photo match, saved items, page builder v3 effects, reply badge, nudges). Obsidian was not reachable from this cloud run, so "what's new" came from git history.

## Summary
No Critical or High findings. 2 Medium, 2 Low. Production build passes.

## Findings
1. **Medium - photo-match daily cap can be beaten by parallel requests.** `backend/routes/marketplace/photo_match.py` (POST /gigs/{id}/photo-match): the cap is a count check, then a slow Cloudinary render (up to 60s), then the insert. Ten simultaneous requests all pass the check before any row is written, so the "10 a day" spend guard can be exceeded. Fix: insert a pending row (or atomic counter) before rendering.
2. **Medium - guest bookings hold calendar slots with only an IP rate limit.** `routes/marketplace/gigs.py` book_gig: 6 per hour per IP, no verification of the email/phone. Someone can squat a provider's slots until the hold expires. Fix: shorter hold for guests, or cap open guest holds per gig.
3. **Low - `test_jobs_end_to_end.py` fails at collection** in a clean environment (the rest of the suite needs a live MongoDB, so most DB tests error or hang without one).
4. **Low - `scripts/check-*.mjs` (page-v3-effects, storefront-sales, verify-email)** fail with ERR_MODULE_NOT_FOUND here, so their checks did not run.

## Verified clean
- Every `t()` key used in the frontend exists in both en.js and he.js (21 apparent misses were plural keys `_one/_other`, present in both).
- No hardcoded "1,200+"-style stats in the UI (only a comment explaining the old bug and a placeholder text).
- Only one inline `Playfair` mention, and it is a comment.
- Saved items (likes.py): all routes scoped to the caller's user_id; only published gigs; no contact details returned.
- Guest booking status link: 128-bit token, rate limited, returns no contact details.
- Photo match: only the cloud's own Cloudinary URLs accepted (no SSRF), only photos already on the caller's own gig.
- Frontend production build passes (`craco build`).
- 103 backend tests passed in the new-feature test files (price parity included); 15 skipped.

## Not checked
- **Live price check DID NOT RUN**: the sandbox proxy returned 403 for myisraelrental.com. No news on listing prices; run it from a machine with access.
- Backend tests needing MongoDB (photo match, reply badge, service nudge: 11 errors, all "connection refused").
- Visual/RTL screenshots, Lighthouse, dependency vulnerability audit, performance/indexes.
