# Code audit, 24 Oct 2026

## In short
- Nothing broken for customers or business owners in the last day's changes (the "Ask this business" box, the automatic "we got your message" reply, AI review-reply drafts, the weekly to-do email). The one failing check was a small wording-check failure on the new automatic-reply card.
- Fixed tonight: the automatic-reply card's explanation text now passes the language check (branch `claude/exciting-bell-n2kxz0`, commit 3361830). Nothing looks different to users.
- Worth knowing: anyone can send a visitor question to a business's leads board (up to 10 a day per person, no limit per business), and one busy day of questions can use up a business's 300 daily answers. Both Low.
- Not checked tonight: the database could not be installed in the sandbox, so the backend tests that need it did not run.

## New findings
1. [Low] `backend/routes/marketplace/ask.py:~137` (`forward`): no sign-in and only a per-visitor limit (10 a day). No cap per business, so many visitors can fill one business's leads board and bell. Fix: add `check_rate(..., bucket="ask-forward-biz", key_extra=biz["_id"], ip_agnostic=True)`, say 100 a day. Proof: the only `check_rate` in the function is `ask-forward-ip`.
2. [Low] `ask.py:~101`: the per-business answer cap (`ask-biz-day`, 300 a day) is shared by everyone, so one visitor spreading across addresses can switch the box off for the day. The per-person limits keep the Claude cost bounded. Accept or lower the risk by keeping as is.
3. [Low] `away_reply.py:run_once`: runs every 60 seconds and, per business with the reply on, loads its gigs and queries messages (one query set per business and per waiting customer). Fine at today's size; will not scale to thousands of businesses. Decision for later.

## Fixed this run
- `awayReply.body` used `{{count}}` for a fixed number of minutes, which the plural check flags (`node scripts/test-i18n-parity.mjs` failed: "no NEW t(key, { count }) without a plural set"). Renamed to `{{minutes}}` in en.js, he.js and the card. Commit 3361830. After: the i18n check passes, and `craco build` passes.

## Still open
See `docs/audits/open-issues.md` (unchanged apart from the lines below).

## Could not confirm
- Whether the automatic reply and the leads-board rule behave right with real data: `tests/test_owner_tools.py::test_away_reply_and_weekly_todo` needs the database and timed out connecting (the other test in that file passes).

## Verified working
- `tests/test_listing_price_parity.py`: passes (price parity, website vs server).
- Every `t()` key exists in en.js and he.js; no stray Hebrew keys.
- Production build passes.
- Reviewed `ask.py`, `away_reply.py`, the review-draft route and the weekly to-do: owner checks present (`business_access`, review `owner_user_ids`), rate limits on every Claude call, no phone or email in the business facts sent to the model, dashes stripped from model output, automatic replies marked `auto` and not counted as a real answer on the leads board or reply badge.

## Not checked
- MongoDB download blocked in the sandbox (no `mongod` under /tmp), so the API did not start: the full backend suite, `?as=owner` pages, screenshots, Hebrew renders.
- PRICE CHECK DID NOT RUN (the live site is blocked in the sandbox); the parity test above stands in.
- Other `scripts/test-*.mjs`: all pass except the i18n one fixed above.
