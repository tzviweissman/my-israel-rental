# Krysp review (docs/page-review-checklist.md)

Used with Playwright at 1440x900, 1280x650, 390x844 and 360x640 (touch): all three pages scrolled and viewed section by section, buttons hovered and clicked, board added, all three order steps with error states, phone menu opened, order endpoint and wa.me stubbed. No horizontal scroll at any size. No console errors other than the expected 404 from the stubbed catalogue fetch.

1. PASS. One product; the same photo (luxe) in the opening, the tile and the shop, cropped the same way.
2. PASS. Price and the Add button sit together on the home tile and in the shop; the price is in the same style everywhere.
3. PASS (re-run: both links now read "Keep shopping"). Was: two words for one purpose: step 1 of the order says "Add more" and the order card says "Keep shopping", both going to the same place (#items). Pick one.
4. PASS. Buttons, tile, nav, steppers, bin and back all have pointer cursor, hover and press (button press draws a thin crack for 0.9 s, over the label but brief and intended).
5. PASS. One item; the photo and name match.
6. PASS. The only choices (how many, the day, a note) sit right at the thing they belong to.
7. PASS. 3 boards: $114 is right; message is "Hi Krysp, I would like to order:", the line, total, preferred day, note, name and phone, then the tracking link when saved. The saved order notes say collection or delivery is to be agreed on WhatsApp. Empty-field errors show per step.
7a. PASS. No savings shown, none missing (single product).
8. PASS. Photo whole and sharp at every size; the opening one is tilted but whole.
9. PASS. Same photo everywhere.
10. PASS. Stopping points show a photo with its words and price, or a full section.
11. PASS. No blank bands, laptop or phone.
12. PASS. The phone bar hides on the opening, the shop and the order form, and never sits over a control you need.
13. PASS (re-run: Saturday is accepted, field now "A note for us"). Was: order form said "Shabbat: choose another day" and refuses Saturday: a rule about her availability that nothing in her sources says. Remove it or ask her. Also note, not counted: the order sent to her dashboard carries fulfilment "pickup" (hidden field; the page text correctly leaves it to WhatsApp) and the step is titled "When and where" with "Where you are", which hints at delivery; consider "When" and "Anything we should know". All printed facts otherwise match her record (Luxe $38, Rabbi Wiener, Jerusalem, WhatsApp and email).
14. PASS. The crack: a line drawn beside the board as you scroll, cracks between sections and on pressed buttons, all working.

## Re-run
Re-ran the order flow at 1440x900 and 390x844: three steps work, Saturday accepted, thanks message shows, no errors, no horizontal scroll. Fulfilment "pickup" is a hidden default the builder keeps; the order note says collection is agreed on WhatsApp (accepted).

## FAILs
None.

Verdict: PASS
