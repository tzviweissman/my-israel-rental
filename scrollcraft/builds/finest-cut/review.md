# Second review of Finest Cuts, home opening (independent reviewer)

Checked: real Chrome (Playwright, channel chrome) at 360x640, 390x844, 1280x650, 1440x900. Scrolled the opening in 13 steps (0 to 12 of 12), looked at every picture (gen/review-shots/r2-<size>-openNN.jpg, sheets r2-sheet-<size>.png). Reduced motion at 360x640 and 390x844 (r2-ph2-reduced.jpg, r2-ph-reduced.jpg). Measured the end words, button and href, and logged console errors and any response of 400 or more.

## Earlier findings
1. 360x640 end of film: FIXED. Whole board now sits below the header (header 68px, board starts about 75px, r2-ph2-open12.jpg); words at y 387 to 608, none over the board; button visible (y 560 to 608).
2. 360x640 reduced motion: board is no longer under the header, but see new problem A.
3. 1280x650 end line over the board: FIXED. At step 11 no words show; at step 12 words are in the left column (x 44 to 505) and the board starts right of them, no overlap (r2-short-open11/12.jpg).
4. 1280x650 mid-film board fills the screen, top under the header (r2-short-open08.jpg): ACCEPTED as camera climb; it is gone by step 9 and the board is whole at 10 to 12. Same at 390x844 step 7 to 8 (board top touches the header edge, fine).
5. 404 on load: FIXED. Zero failed requests and zero console errors at all four sizes and both reduced runs.

## Also checked, fine
- 390x844 and 1440x900 end: board whole, words below or left of it, nothing over the food. End button is "Order the feast", href shop.html?add=feast#order.
- 390x844 reduced: board whole, words clear below it (r2-ph-reduced.jpg).
- First screen at every size reads and the button is there; chapter lines readable on laptop sizes.

## Third pass (problem A re-check)
A. FIXED. 360x640 reduced motion (gen/review-shots/r3-ph2-reduced.jpg): board top about y 112 (header ends 68), bottom row ends about y 290, headline starts about y 358, so no words over the board, nothing cut off, button visible. 390x844 reduced motion (r3-ph-reduced.jpg) is unchanged from r2 (board whole, words below it). No console errors or failed requests in either.

Verdict: PASS
