# Review of RBS Cleaning, second pass (reviewer did not build it)

Re-rendered in real Chrome at 1440x900 and 390x844 (isMobile, hasTouch): index at scroll 0, 1, 2, 3, 3.3 screens and every section, book.html (all three steps filled in for real for a window clean, a basic clean and a regular clean; the book POST and wa.me caught with page.route and fulfilled locally, nothing reached the owner), contact.html. Sources: src/public.json and the flyer src/owner/p01.jpg.

1. Items of one kind shown alike: PASS. Four service cards share one layout at both sizes (Basic is the deliberate dark one). No thumbnails.
2. Prices, units, buttons in one place: PASS. One price (₪400). Every card link sits at the bottom of its card.
3. One wording per purpose: PASS (fixed). Every quote link and card button now says "Get a free quote". Form buttons differ by purpose only ("Continue to ...", "Send for a free quote", "Send the request, ₪400"). Deep and post-construction is one card on the home page and one choice ("Deep and post-construction") in the form.
4. Pressable things respond: PASS. Pointer cursor and hover/press on buttons and chips; chips fill when chosen.
5. List beside a photo changes the photo: n/a.
6. Choices right under what they belong to: PASS (fixed). Regular shows "How often?" at once; Window cleaning shows "Which side of the windows?" (inside and outside, inside only, outside only, not sure); the choice reaches the message ("Window cleaning, inside and outside for a 4 room apartment"). Judgement call accepted: rooms and home type asked for every clean so the form does not jump; they are on screen from the start and cost one tap.
7. Order message complete and correct: PASS (fixed). The WhatsApp text carries the clean, place, day, time of day, note, name, phone and the tracking link. The saved booking says tier "Free quote" for a window clean and "Basic home clean" only for the basic clean. Every WhatsApp link on index, book and contact is wa.me/972535269002 (checked with grep). A past day gives "The earliest day you can ask for is Friday 6 November".
7a. Savings: PASS (n/a). None claimed.
8. Photos not soft, stretched or cropped: PASS apart from the known film softness, not worse than reported.
9. One look per product: PASS (fixed). The end of the film is now the same terrace-and-hills room on phone and laptop.
10. Every stop makes sense: PASS. Screens 0 to 3.3 on both sizes: film, then the finished room with the headline readable, then the grid. The "Where we clean" band has an empty navy stretch above the closing line on laptop; harmless.
11. Nothing blank: PASS. No empty reveal band at any stop on either size.
12. Phone order bar never covers what you press: PASS. On the form page it slides away while the form is in view (button never under it); on the home page the card links clear it. A tap through all three steps on the phone worked.
13. Every fact is theirs: PASS (fixed). Place reads "RBS", "Beit Shemesh", "The surrounding moshavim", "Jerusalem", "Ashdod" (flyer and public.json). The hero line is "Regular cleaning weekly, every two weeks or monthly", as on the flyer. Apartment management now says "Tell us about your apartment and we will quote it", a request, not a claim. Phone, services, ₪400, free quotes all match. Judgement call accepted: the day field defaults to tomorrow because the rules need a prefilled day, and the error now only says the earliest day you can ask for. Ask the owner for a lead time and set it. The old "to the day the builders leave" flourish is gone; the section lede now just lists the services. "RBS" stands alone with no expansion, as on the flyer.
14. A small touch only this business has: PASS. The film is a window squeegeed clear, revealing the finished room, with the broom in the logo; it works with the scroll.

Notes, not fails: the hero facts under the button are now larger and readable. Console shows a CORS error only because the local page asks the gift-card endpoint on localhost:8001, which is not running here; the gift section stays hidden, as intended.

Verdict: PASS


## After this review (5 Nov, the builder, not independent)
The opening changed at Tzvi's request: the camera pulls back into a furnished room and the words moved to a card. Looked at by the builder on laptop and phone; the publish check passes. Not re-read by an independent reviewer.
