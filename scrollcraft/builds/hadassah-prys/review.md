# Review: Hadassah Prys site (index, book, contact) at 1440x900, 1280x650, 390x844, 360x640

Sources read: src/record.json and src/owner/p02.jpg (flyer: "Now in Jerusalem", hadassah makeup artist, "get ready to glow", phone icon 0557753535, WhatsApp icon +44 7712331169) and p01.jpg (logo). Screenshots in the scratchpad review folder. Booking send tested with /book and wa.me intercepted; no real request sent.

1. PASS: One service (Makeup, 260) shown the same everywhere: hero strip, service section, bar, booking card, footer. Nothing to compare for thumbnails.
2. PASS: Price sits beside the service name in the booking card and under the title in the service section; Book button is always bottom right of the band and in the top bar.
3. PASS: "Book" is the word for the main action everywhere; "Choose a day and time" is a different purpose (link to the same page). Step buttons say Continue to occasion / Continue to your details / Send on WhatsApp, which match what each does.
4. PASS: Buttons, nav items, chips, switch show hover/press styles in screenshots; the three step markers look like buttons but only completed steps are clickable (hover not tested with a real pointer on every item).
5. PASS: Not applicable, no list beside a changing photo.
6. PASS: The one service is preselected; day and time appear in step 1 under the service, the summary updates as each is picked (checked at all four sizes).
7. PASS: Sent message captured: "Hi Hadassah, I would like to book: Makeup with lashes included, 60 minutes, for Wedding, on Sunday 8 November at 11:00, in Jerusalem, Baka. From Test Person, 0501234567. Please bring lashes / Price on your listing: 260 / Follow the booking: ..." and the /book body had the right tier, date, slot, name, phone. Saturday 14 Nov shows closed message with a button to the next Sunday. Friday slots run 09:00 to 12:00 start (checked via code).
7a. PASS: No saving is claimed; single service so no pack/size savings exist.
8. PASS: Hero room, brush and logo are sharp at all sizes and show the whole mirror / brush. Note: both pictures are generated, not her work (page does not claim they are).
9. PASS: One product, brush picture appears once.
10. PASS: At each stop checked (laptop and phone) text sits with its section; the brush photo is cut by the screen edge only mid-scroll.
11. PASS: No blank bands on any page at any size after the reveals ran. Index right half of "How booking works" is empty at 1440 (layout choice, not a bug).
12. PASS: Second look: the phone bar now leaves before the closing band, so only one Book shows there (P390-s03/s05/s06, 360 too); the in-page "Choose a day and time" is clear of the bar at the stops checked.
13. PASS: Third look: step 3 now reads "Send it on WhatsApp, and you can go over the details with Hadassah there." This matches the form (WhatsApp opens with the text written out and the customer sends it) and the record (booking_mode whatsapp, WhatsApp number). "Call only, no WhatsApp" is gone. All other facts are in the sources.
14. PASS: The mirror bulbs come on one by one with a Lights on/off switch, and the closing band has a row of bulbs that light when reached. Works at all sizes (see extra FAIL below about how weak the off state looks).
Extra (beyond checklist):
15. PASS: Second look: every call link is now tel:+972557753535 on index, book, contact, footer (read from the DOM at 1440, 390, 360); label shows 055-775-3535.
16. PASS: Second look: bulbs off and part lit are now clearly different from fully lit at laptop and phone: the wall and table go to a dark mauve with white bulbs, then bulbs warm one by one with a glow, then the bright pink room (r2-P390-e0/e2/off/lit, r2-L1440-off/e3). Switch off and on again works; headline and Book stay readable in the dark state.
17. PASS: Second look: on phone step 3 the request summary and "Send on WhatsApp, 260" sit in a panel pinned to the bottom of the screen (r2-P390-b3), and at the page end it sits in place under Back (r2-P360-b3). Not verified: whether the pinned panel hides the note box while typing in it.
Notes: first-pass header ghosting, missing done state on step markers and faux-bold bar text are fixed in the second look (see below); console shows connection refused to localhost:8001 (taken-slots, expected locally); gallery and FAQ sections stay hidden (no data); not checked: Hebrew/RTL, real hover on each element, real network, the 1280 booking screenshots were taken but only the layout sizes above were viewed.


## Second look
Re-checked on the same server at 1440x900, 390x844, 360x640: (1) phone bar and closing band while scrolling index; (2) call label on all pages and step 3 of How booking works; (3) tel links read from the page; (4) first 1.5 seconds of the opening, fully lit, switch off, switch on again, laptop and phone; (5) phone booking step 3 with Send, name and phone filled; plus the header while scrolled (now solid, no ghost shapes; L1440 hdr screenshot) and the bar text (no longer faux-bold). Send was intercepted and not clicked. Not checked: Hebrew, hover on every control, typing in the note box under the pinned panel.

Fourth look: "When and where" now has 32px top and bottom padding (measured, section 241px tall at 1440, 439px at 390). Looked at it with the sections around it at 1440x900 and 390x844: nothing cut off or crowded, hairlines separate it cleanly from the service and How booking sections, text and rows keep their spacing. It is tighter than its neighbours but reads as a deliberate compact band, not a defect.

FAILs: 0
Verdict: PASS
