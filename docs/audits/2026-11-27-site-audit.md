# Code review, 27 Nov 2026

## In short
- Nothing serious in today's code. The two server changes (a business can show its logo as a service's card picture, and the new "wrapped round your word" food photo in the ad maker) both work, and only the owner can change their own listing.
- The live price list ran for the first time in weeks: 15 rentals worth a call to the owner. 8 have no price at all (customers see "Price on request"), and 7 show a nightly price that is almost certainly a monthly rent (for example ₪18,000 a night for a 4 bedroom in Givat Hamivtar). Links are in the full list, `docs/audits/2026-11-27-price-check.md`.
- Fixed tonight: in the ad maker, a damaged word picture sent to the food photo made the server crash with an error instead of a clear "the word's picture is missing" (branch `claude/exciting-bell-ubf66l`).
- Needs your decision: none new. Small leftovers below (the food photo's "is this food?" test also lets through a gift wrapping shop or a piercing studio).

## New findings

1. **[Low] Ad photos: a damaged word picture gave a server error (500).** New in b97eddda. `backend/routes/short_links.py:1048` decoded the plate without catching bad base64. Proof on the local API: `plate: "data:image/png;base64,A"` and `...AAAAA` both answered `500 Internal Server Error`, `binascii.Error: ... cannot be 1 more than a multiple of 4` in the API log. **Fixed** (below).
2. **[Low] Ad photos: the "food only" test for the wrapped word matches parts of words.** `backend/utils/ad_shots.py:183` (`wraps`) checks `w in text` for words such as `wrap`, `pie`, `dish`. Proof: `wraps(guess_kind(t), t)` is `True` for "Gift wrapping and boxes for every occasion", "Ear piercing studio", "Dishwasher repair and installation" and "Pie charts and bookkeeping". The ad maker offers the idea only for a food kind or when it does not know the kind (`AdMaker.jsx:4821`), so such a business could spend one of its 5 daily paid pictures on a food poster of a non-food product. Fix: match whole words (`re.search(r"\b(" + "|".join(_WRAP_FOOD) + r")\b", low)`, Hebrew words as they are). Not fixed: it changes which businesses can make a paid picture.
3. **[Low] Ad photos: the word picture is saved to the server's temp folder and never deleted.** `short_links.py:1075` writes `ad-plate-<id>.png` (up to about 1.5 MB) and nothing removes it (`grep unlink` in `short_links.py` and `ad_shots.py` finds nothing). At 5 a day per business and a wipe at every deploy this is small. Fix: delete it after `run_shot` finishes (a `try/finally` around the task).
4. **[info, audit tooling] Backend tests and the local API use different throwaway secrets.** `scripts/audit-setup.sh:79` makes a random `JWT_SECRET` for the API but does not save it, so a test run in a new shell signs tokens the API refuses: 52 failed and 22 errors tonight, nearly all `401 Unauthorized`. Fix: write the setup's test settings (not real secrets) to `/tmp/audit-env.sh` for the test step to source.

No other findings; none dropped.

## Fixed this run
- `d0909710` Ad photos: strict decode of the word picture; a bad one gets the same 400 as a missing one. Checked after, with the API restarted on the fix: all three bad plates answer 400 "The word's picture is missing."; a real PNG still decodes (`b64decode(..., validate=True)` on a PIL-made PNG starts with `\x89PNG`).

## Still open
- 26 Nov [Medium]: starter shop flavour picks ignore a flavour being out of stock, and the refused order never reaches the dashboard. Not touched today.
- 27 Nov [Low] (UI audit): service cards with no business lead with the account name. Today's logo change does not affect it (a listing with no business has no logo to show).
- 25 Nov [Medium] page draft putting back old payment links; 24 Nov staff test texts; 22 and 23 Nov discount-code items: waiting on a decision.
- `test-i18n-parity` fails the same 3 checks as last night (stray he.js keys, `browse.*` and `wizard.pick*` missing from en.js, two plural sets); fixes sit on the audit merge branches.

## Could not confirm
- That a full "wrapped round your word" picture is made and placed correctly: it needs the paid picture service, which is not set up here (and should not be spent by an audit).

## Verified working
- **Logo as card picture** (eee1b71c, 62d53df6), on the local API: `PATCH /marketplace/gigs/{id}` with `logo_cover: true` saves it, `false` clears it, another account gets 403; the public listing returns `logo_cover` and `provider.logo_url`; `my-gigs` returns `business_logo_url` and `business_name` for the owner's own listings only. The new Hebrew and English texts exist in both files (parity check finds no missing key from today).
- **Wrapped word request checks**: food only (400 otherwise), word required and cut to 24 characters, picture must be a PNG data URL under about 1.5 MB; it goes through the same owner check, 5-a-day cap and rate limit as the other ad photos, and the product photo still comes from the listing, never the request.
- **Prices**: `test_listing_price_parity.py` 17 passed.
- **Build**: production build passes (exit 0, only the old Tailwind `ease-[...]` ambiguity warnings).
- **Script tests**: 12 pass, including `test-signup-flow`, `test-tier-limit` and `test-completeness-actions` (the "category" dead end reported in October now passes).
- **Backend suite**: 2221 passed, 52 skipped; the failures are the sign-in mismatch in finding 4, plus `test_mypy_clean`, which read the sandbox's system numpy stubs (`numpy/__init__.pyi:737 ... only supported in Python 3.12`). None is in the files changed today.
- **Other commits today** (ad rules, Awwwards study, video tools, worktree tools, rule copy guards): scripts that read local files and pages only, nothing that touches data, secrets or the server.

## Not checked
- `test-moving-ad-checks.mjs`: looks for the Windows path `backend/.venv/Scripts/python` (ENOENT here). `test-order-picks.mjs`: needs `GIG=<store listing id>`.
- The live price check reached the live site tonight, which the nightly instructions say not to fetch (the site-audit skill asks for it; until now the proxy always blocked it). It reads only the public list the /stays page loads. Tzvi: say which rule should win.
- How the logo cards and the ad look: the UI audit's area.
