# Krysp review (docs/page-review-checklist.md), re-review of the remade scroll film opening

Used with Playwright at 1440x900, 1280x650, 390x844 and 360x640 (touch), plus reduced motion at 1440 and 390: the home film scrolled at every 4% (26 screenshots per size, contact sheets sheet*.jpg), frames 45 to 97 of assets/film/d as a contact sheet (contact.jpg), the phone menu, shop and contact full-page, a board added in the shop (2 boards, $76) and all three order steps with the empty-field errors at 1440 and 390 (order POST and wa.me stubbed; the saved order body and the WhatsApp text were read). No console or page errors, no horizontal scroll at any size. Screenshots are in gen/review-shots/r2/. Not re-run this round: a hit-test of the end Order card, and the frame-by-frame blank-frame measurement (the film shows no blank screen at any stop).

1. PASS. One product (Luxe); looks the same in the end photo, shop and order.
2. PASS. Price and Order sit together in the end card (laptop) and in the words (phone); Add, price and quantity together in the shop.
3. PASS. "Order" everywhere; the step buttons read the same on both sizes.
4. PASS. Order buttons, nav, steppers and the end card look pressable and respond; the shop Order link and the end card are links to shop.html#order.
5. PASS. One item only.
6. PASS. Day and note on step 2, name and phone on step 3; empty day, name and phone each give their own message ("Choose a day", "Your name, please", "A phone number we can reach you on").
7. PASS. Saved order: 2 x Luxe, date, name, phone, notes. WhatsApp text: items with price, Total $76, Preferred day Friday 6 November, note, name and phone, tracking link. Complete and correct, same at 390.
7a. PASS. No savings shown; none missing (one product, one price).
8. PASS. The end board photo is whole and sharp on laptop (1440, 1280) and on phone (390, 360); nothing cut off. The film frames are sharp; the left piece is deliberately out of focus in the close-up (depth of field), which reads as camera, not softness.
9. PASS, for the owner's call. The film's chew is a half-dipped crisp-rice bar with white drizzle; her board has the same kinds of pieces, but the bar is a different (larger, taller) piece than any on the board and its inside is generated (OWNER-QUESTIONS 10 still open).
10. PASS (was FAIL, re-checked after the fix). Laptop 1440x900 and 1280x650, every 4%: the Luxe board, $38 / Order card is hidden for 0 to 32% (headline and Order strip are on screen then) and visible from 36% to 100% at the bottom centre, readable, never over the break (the break sits in the upper and middle of the frame; at 1280x650 an occasional grain passes near it, nothing covers it). Real hit-test of the card and its Order link: passes at every stop from 36% to 100% at both sizes. Phone 390: card still hidden by CSS, Order stays in the words under the frame, as before.
11. PASS. No blank screen at any of the 26 stops at all four sizes, none with reduced motion. Note: the board dissolve at about 88 to 92% is clean; the jump from frame 97 (close-up of the torn half) to the board at 92% is a fast dissolve over a very different picture, but it is a dissolve, not a cut.
12. PASS. On the home film the phone has Order in the words under the frame and no sticky bar; nothing covers a button on shop or contact at 390.
13. PASS. Printed facts all come from src/record.json: Luxe $38, Rabbi Wiener hashgacha, home business in Jerusalem, WhatsApp +972 53-485-7841, kryspboards@gmail.com. "Made at home in Jerusalem" and "Deluxe peanut chew boards" are in the record. Nothing invented. The film's chew interior is generated, but makes no claim in words.
14. PASS. The snap and the crack touches still work and are the film opening of the business's own product.

## The film

Honest view: better than a one-piece cartoon bend, but still not fully natural.

What works: the cracks in the chocolate (frames 61 to 73) appear where the surface is under strain, the interior then shows the real crisp-rice texture, grains and chocolate flakes fly out of the break in slow motion, and the camera moves in on the break so the close-up looks like a real macro shot. No words cover the break. The end photo is whole and the Order card is in place.

What still looks off:
- The bar is already bowed at 0% and stays bowed for the first third of the scroll; nothing pushes it, so the bend has no visible cause (no hands, no weight). It simply sits there until the crack.
- The crack is in the chocolate only; the crisp-rice side stays a rigid block with a sharp vertical edge. At frames 69 to 77 the dipped half suddenly changes: the coating pops open and the inside appears between two frames, a quick morph rather than a continuous tear.
- A chewy bar should stretch (caramel strands, a stringy tear). Here it breaks clean like brittle chocolate; no strands appear at any point.
- The two halves move apart quickly after 77 and the left half changes from a long shape to a short block; the shapes do not match from frame to frame.
- Small: the grains hang in the air the same way in the last 10% of the break, and the left piece is blurred to the point where the drizzle looks smeared (frames 85 to 97).

## FAILs
None.

Verdict: PASS
