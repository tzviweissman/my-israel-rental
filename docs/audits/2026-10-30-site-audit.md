# Code review, 30 Oct 2026

## In short
- No customer-facing bug found in last night's changes. The new "Confirm / Decline from WhatsApp" feature checks that the message really came from Meta and that the sender is the business's own number, and it cannot be replayed. I read every line of it.
- One loose end: if the order fails to move after the owner taps Confirm (a rare database hiccup), the tap is lost and the owner gets no answer. Not reproduced; listed as low.
- Fixed tonight: the settings template was missing the WhatsApp sender's phone-number id, so a fresh setup would silently keep WhatsApp off (branch `claude/exciting-bell-6t1mgu`, commit 5d2b6f5f).
- Needs your decision: none.
- Could not run tonight: the full backend suite and the live price check (no database or site access in the sandbox). See "Not checked".

## New findings
1. **Low, config.** `backend/.env.example`: `WHATSAPP_PHONE_NUMBER_ID` is read by `utils/whatsapp.py` (`_meta_config`, returns None without it) but was not in the template. Proof: `grep WHATSAPP_PHONE_NUMBER_ID backend/.env.example` printed nothing. Fixed, see below.
2. **Low, `routes/whatsapp_webhook.py:114`.** `_first_time(msg["id"])` records the message before `_transition` runs. If `_transition` raises (database error, or a 409 when two taps race), the exception is logged and swallowed, the id stays burned and the owner is told nothing. Fix: record the id after the move succeeds, or delete it on failure. Not reproduced (no database).

## Fixed this run
- 5d2b6f5f: `WHATSAPP_PHONE_NUMBER_ID` added to `backend/.env.example` with a comment. No secret value. Check: file reread; the new tests for the sender (31 tests across webhook, confirm send, ad praise and price parity) pass.

## Still open
See `docs/audits/open-issues.md`. The two plural-key failures in `scripts/test-i18n-parity.mjs` (`awayReply.body`, `stays.repliesWithinHours`) are already fixed in the 30 Oct audit merge, which this branch predates.

## Could not confirm
- Ad maker can return an empty caption: `_strip_praise` drops every sentence that praises with a word the listing never used, so a short listing could end with no caption. Needs a live model call to see.
- Ad maker accepts `http://` photo links (`_ad_photos` checks only `startswith("http")`); posted on an https page they could be blocked. Low.

## Verified working
- WhatsApp webhook: GET verify uses a constant-time compare and refuses when the token is unset; POST refuses (403) without a valid `X-Hub-Signature-256`, and refuses when `WHATSAPP_APP_SECRET` is unset; repeated deliveries are ignored; only the listing's WhatsApp number or the owner's own may move an order; the status move is atomic (`find_one_and_update` on the old status), so Confirm and Decline cannot both land.
- Order tracking page: the new payment links go through `allowed_payment_links` and are hidden once paid or cancelled.
- Ad maker (`POST /ads/make`): checks ownership before any work, rate limited to 20 a day per person, model text has long dashes removed, listing text is passed as data.
- New backend routes are registered; no real secrets in `.env.example`; `backend/.env` and `frontend/.env` are git-ignored.
- Production build (`craco build`) passes. Backend tests that need no database pass (31 of the new and price-parity tests). New Hebrew keys (`ads.*`) are present alongside English, with no long dashes in the added strings.

## Not checked
- FAILED  playwright + chromium (sandbox download blocked)
- FAILED  mongodb on :27017 (403 from the proxy); API skipped. The full backend suite therefore could not run (about 78 files need MONGO_URL or a database); only tests that run without one were used.
- PRICE CHECK DID NOT RUN: could not read https://myisraelrental.com/api/properties (403 from the sandbox proxy). The offline price-parity test passes.
- `tests/test_type_coverage.py` (mypy) fails on old untyped code across the backend, including the new files; pre-existing in kind.
