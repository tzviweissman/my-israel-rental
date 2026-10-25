# Site audit, 3 Oct 2026 (automated overnight run)

Scope: everything merged 23 to 25 Sep (page recipes, size ladder, audit follow-up, Hebrew business pages, cheapest-first upgrade panel). Read-only; nothing was changed except this file.

## Summary
No Critical or High findings in the code that changed. Two checks could not run, so this is NOT a full clean bill of health (see "Not checked").

## Findings
- **Low: size ladder invents a length.** `SizeLadderBlock.jsx` (`l: Number(x.length_cm) || Number(x.width_cm)`) draws a product as a square when the owner gave a width but no length. The section's own rule says "a scale nobody measured is invented". Fix: leave out products with no length, or only require width and draw a bar.
- **Low: `known_numbers` in `backend/utils/page_rules.py` calls `float()` on `width_cm`/`length_cm` unguarded.** The model validates the values on write, so it is safe today; old or hand-edited records could raise.
- **Info: the "obsidian" notes source named in the task was not found** in this container (no `.obsidian` folder). "Recently added" was taken from git history instead.

## Verified clean
- Hebrew/English keys: 2,649 distinct `t()` keys used, 0 missing from `en.js` or `he.js` (the one hit, `tips.tip.share`, is a comment in `OnboardingProvider.jsx`, not a real call). All English keys exist in Hebrew. The 25 Hebrew-only keys are `_two` plural forms, which is expected.
- No inline `fontFamily: 'Playfair Display'` left in `frontend/src` (3 grep hits are comments).
- No new hardcoded hex colours and no undefined CSS variables in the frontend changes of the last 10 days.
- Every `docs/*.md` file cited by the new code exists.
- `overflow-x` on html/body is `clip`, not `hidden`, so the ladder's sticky scrolling is not broken.
- The new `width_cm`/`length_cm` fields are bounded (greater than 0, at most 500). The Google reviewer name is now cleaned and capped at 80 characters. The Google disconnect route is deliberately not behind the import flag.

## Not checked
- **Live price check DID NOT RUN:** the container's network proxy returned 403 for myisraelrental.com. So there is no "worth a call to the owner" list tonight. Do not read that as "prices are fine".
- **Python tests (including `test_listing_price_parity.py`) did not run:** installing backend requirements hung in this environment, so `motor` was missing. Not a code failure.
- Production build, dependency audit, screenshots (LTR/RTL, 3 widths), Lighthouse, authorisation/IDOR review of older routes, double-booking and data-integrity checks against a database.
