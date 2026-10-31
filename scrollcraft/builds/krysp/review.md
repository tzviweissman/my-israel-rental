# Krysp review (docs/page-review-checklist.md), re-review of the scroll film opening

Used with Playwright at 1440x900, 1280x650, 390x844 and 360x640 (touch), plus reduced motion at 1440 and 390: the home film scrolled at every 5% (21 screenshots per size, contact sheets and full-size looks), the section after it, the phone menu, shop and contact, a board added in the shop and all three order steps with error states at 1440 and 390 (order POST and wa.me stubbed; the saved order and WhatsApp text were read). Also measured the frame files (assets/film/d and m) for blank frames. No console or page errors, no horizontal scroll at any size. Screenshots are in gen/review-shots/ (sheet-*.jpg, cmp*.jpg and the per-scroll PNGs).

1. PASS. One product; Luxe looks the same in tile, shop and order.
2. PASS. Price and Add together on tile and shop; Order card/button in the same place at the end of the film.
3. PASS. "Order" everywhere, "Keep shopping" in both places.
4. PASS. Buttons, nav, steppers and the end Order card have cursor/hover/press; the card is clickable at the end (hit-tested at 1440 and 1280).
5. PASS. One item only.
6. PASS. The day, note, name and phone sit on the step they belong to.
7. PASS. 3 boards = $114; message is complete (items, total, day, note, name and phone, tracking link); saved order carries the same lines; per-step errors show.
7a. PASS. No savings shown, none missing.
8. PASS. The final board photo is whole and sharp on laptop (1440 and 1280) and phone (390 and 360); frames are sharp, nothing zoomed.
9. PASS, for the owner's call. The film's chew is a half-dipped crisp-rice bar with white drizzle; her board has half-dipped pieces with the same drizzle, so it still reads as one of her kinds of pieces, though thicker and bigger than the pieces on the board. Coordinator is putting it to Chaya.
10. PASS. Re-run at every 5%: every stop shows a photo, with the words or the price card. One short stop (about 80% on laptop, 1280 included) shows only the blurred cloth on peach with no words yet (the card appears at 84%); on phone the words stay under it. Brief, but see note under 11.
11. PASS. Frame files re-measured: no blank frame (lowest contrast 42 laptop, 36 phone, was 19.7 and 2.8). No blank screen at any of the 21 stops at 1440x900, 1280x650, 390x844 or 360x640. Note, not counted: the join from the break to the cloth (frames 144 to 148) is still a hard cut (the biggest jump in the film), where a short dissolve would be smoother.
12. PASS. Phone: the Order button is inside the words under the 4:3 frame the whole time, the sticky bar is hidden on the home opening; the phone has no price card (hidden by CSS), so laptop and phone differ in that price and Order sit in a card over the board on laptop and in the words on phone, which is acceptable.
13. PASS. The three labels and the screen-reader line are gone (no `pin` in index.html); every printed fact matches src/record.json (Luxe $38, Rabbi Wiener, Jerusalem, +972 53-485-7841, kryspboards@gmail.com). Note: the inside of the chew in the film is generated, not her own photo (OWNER-QUESTIONS 10 still open); it makes no claim in words.
14. PASS. The snap and the crack lines between sections still work (a thin crack draws on pressed buttons).

Film checks that passed: no words cover the break on laptop; the board is whole at the end on laptop and both phone sizes; the Order card is clickable at the end (1440 and 1280, hit-tested); phone has no card and keeps Order in the words; reduced motion shows the last frame with the words.

## FAILs
None.

Verdict: PASS
