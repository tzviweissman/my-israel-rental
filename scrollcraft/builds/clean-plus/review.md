# Review of Clean Plus (reviewer did not build it)

Rendered in real Chrome (Playwright) at 1440x900, 1366x768, 1280x720, 768x1024, 390x844 and 360x640 (phones as touch devices), index, book and contact, scrolled top to bottom at every size, plus reduced motion at 1440x900 and 360x640. Tapped the board's day cells, the three pills, all four option toggles, and walked all three steps of Build your plan at 390, 360 and 1440 with /book and wa.me caught by route (nothing was sent). Sources: src/record.json, flyer src/owner/p01.jpg, and the facts given for this review. No page errors; no sideways scroll at any size.

1. Items of one kind shown alike: PASS. Six option tiles share one layout at every size. Note: "Professional cleaners" is a white tile and "Weekly visits" has no toggle while the other four have one (index, 1440x900 and 390x844); both are deliberate (statement tiles) and read fine.
2. Prices, units, buttons in one place: PASS. One price, shown as "₪325 a visit"; every toggle sits at the bottom of its tile; "Build your plan" buttons use one shape.
3. One wording per purpose: PASS. The action is "Build your plan" in the header, hero, board, option strip, price card, close band, footer and phone bar. Nit: contact.html at 1440 and 390 shows the heading "WhatsApp" directly above the line "WhatsApp +972 50-423-2291".
4. Pressable things respond: PASS. Day cells, pills, toggles, step chips and the form chips take taps at 390 and 360 (touch) and clicks at 1440; pressed states show (toggle fills dark with a check).
5. List beside a big photo changes the photo: N/A. One picture only, the option tiles change the plan line, not a photo.
6. Choices under what they belong to: PASS. A toggle changes the plan sentence and line list right below the tiles at once; deep and one-time are exclusive (pressing one-time unpressed deep) and move the sentence to "price on WhatsApp". The board's choices (often, day, same, supplies, deep, once) reach book.html through the link and arrive pre-chosen (checked: kind=once, extra=same, extra=sup, wday=thu). Every two weeks lifts every other visit.
7. Order message complete and correct: PASS. Every-two-weeks plan sent at 390, 360 and 1440: saved with tier "Price on WhatsApp", the preferred date, name and phone, and the WhatsApp text carries the plan, the added line, name, phone and the tracking link. Number is 972504232291 everywhere (index, book, contact).
7a. Savings: N/A. None claimed. Price shown only for the weekly plan; every-two-weeks, deep and one-time say "We send the price on WhatsApp".
8. Photos not soft, stretched or cropped: PASS. Room picture sharp at all sizes; at 768 it is shown whole above the words; at 390 and 360 it is the tall version and shows the whole sofa and window.
9. One look per product: PASS. One picture (the same room wide and tall). It is generated and never called their work or a customer's home: alt text reads "A bright, tidy Jerusalem living room with a big window onto stone buildings", no caption claims anything.
10. Every stop makes sense: PASS. No stop shows half a photo with words missing. Nit (not a fail): at 1440x900 the price card ends above a stretch of empty tinted band left of the "Your plan in three steps" list.
11. Nothing blank: PASS. Entry order finishes on its own; with reduced motion at 1440x900 and 360x640 the full page shows with no empty reveal bands. The gallery ("From our cleans") and "Your questions" sections are `hidden` and empty (display none, zero height), so no fake reviews or FAQ show.
12. Phone order bar never covers what you press: PASS. At 390 and 360 the bar sits under the cards; every toggle, pill, day cell and the Build your plan buttons were tapped through it without being blocked. The bar is not shown over the form.
13. Every fact is theirs: FAIL (two small points; see below). Phone +972 50-423-2291, ₪325, 4 hours, all around Jerusalem, "Home cleaning, your way.", "Pick the options that fit you and we'll build the right plan" idea, and the six options are all in the owner's words. Flags:
   - index.html, all sizes: step 3 "We confirm your first visit. Then we come on the same day, all around Jerusalem." is a process promise that is not in the listing or flyer ("we come on the same day" is read as a same-day promise next to "confirm"). Reword to the flyer: "We confirm your plan on WhatsApp."
   - index.html and book.html: "Deep, one-time and every-two-weeks cleans are priced for your home on WhatsApp" and "Morning / Afternoon / Any time" and the "Anything we should know about your home" fields claim a pricing method and choices the owner has not given. They are requests rather than facts, so treat as a question for the owner, not a block. 
   - Contradiction in the form: book.html, step 1, with "Every two weeks" chosen the chip "The same cleaner every week" is still offered and goes into the message ("Every two weeks ... The same cleaner every week, please."). Say "The same cleaner each visit" or hide it for one-time.
   The flyer's own number 058-713-0664 differs from the listing's; the page uses the listing's, as instructed.
14. Small touch only this business has: PASS. The week board with a gold booked mark on the chosen visits, which re-lays itself as you tap a day or switch every week, every two weeks or once; works by touch and by mouse.

## FAILs

A. index.html, 360x640 (also tight at 390x844): the three pills "Every week / Every two weeks / Just once" are narrower than their text. Measured at 360 wide: "Every two weeks" has scrollWidth greater than clientWidth, and "Every two weeks" runs into "Just once" ("Every two weeksJust once" touching on screen). At 320 wide "Every week" overflows too. Fix: let the pills wrap or shrink the label font and padding below 400px (or stack them), so each label fits with a gap.

B. index.html, 390x844 and 360x640, after choosing a one-time clean, a deep clean or every two weeks: the phone order bar still says "₪325 a visit, Weekly, 4 hours" while the plan sentence above it says "We send the price for your home on WhatsApp". A price is shown on a plan that is not priced. Fix: the bar should follow the plan (show "Price on WhatsApp") or say only "From the plan above".

C. index.html, all sizes, step 3 of "Your plan in three steps": "Then we come on the same day, all around Jerusalem." is invented (not in the listing or flyer). Replace with the flyer's wording or the confirmed plan only.

D. book.html, step 1, all sizes: "The same cleaner every week" can be added to an every-two-weeks or one-time plan and is then written into the WhatsApp message as a contradiction. Fix as above.

## Second pass (after the coordinator's fixes), rendered again

- A. Pills: STILL FAIL at 360x640 and 320x640. Text of "Every two weeks" is wider than its pill: at 360 the text overruns its box by 9px (scrollWidth 104 vs clientWidth 95) and sits about 2px from "Just once"; at 320 it overruns by 23px (104 vs 81) and runs into the neighbour. Passes at 390x844 (all three fit) and 768. Fix: below about 380px let the pills wrap or stack, or drop the label to "Every 2 weeks".
- B. Phone bar: PASS. At 390, 360 and 320 (touch): weekly shows "₪325 a visit / Weekly, 4 hours"; after tapping Every two weeks, Just once or the Deep clean toggle it reads "Your plan / Price on WhatsApp"; switching back restores the price.
- C. Step 3: PASS. Now "We confirm your first visit. On WhatsApp, anywhere in Jerusalem." No invented same-day promise.
- D. Same cleaner: PASS. Chip on book.html is "The same cleaner each visit" and the WhatsApp text carries "The same cleaner each visit, please."; the message, name, phone and tracking link are complete.
- Contact nit: PASS. The heading is now "Write to us".

## Third pass (pill fix and the options section split)

- A. Pills: PASS now. scrollWidth minus clientWidth is 0 for all three pills at 320x640, 360x640, 390x844, 1440x900 and 1280x650, and the screenshots show clear gaps (below 400px the label reads "Every 2 weeks"). No sideways scroll, no page errors.
- Section split (#pick-sec): PASS. Looked at index at 1440x900, 1280x650 and 390x844 from top to bottom. The opening fits one screen under the menu bar with the board visible beside the headline (1440, 1280) or below it (390); "Pick what fits your home" and the six tiles follow as their own section with nothing cut off or blank. Tapping Equipment then Deep still updates the sentence ("A deep clean on Tuesday 17 November. We send the price...") and the link, and book.html arrives with kind=deep, extra=sup, wday=tue chosen, at 1440 and by touch at 390.
- Nit, not a fail (320x640 only, below the sizes asked for): the board's "4 hours" marks are clipped on the narrow day cells, "Your plan / November to December" wraps, and the phone bar's "₪325 a visit" wraps onto two lines. 
- Nit: the lede "goes onto your plan above and the line below" still reads fine now the board is in the opening.

All four earlier FAILs (A, B, C, D) are fixed and the contact heading nit is fixed.

Verdict: PASS
