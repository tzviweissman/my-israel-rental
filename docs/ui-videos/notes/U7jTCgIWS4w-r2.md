# uxpeak: "The Same App Designed By An $80K vs $250K UX/UI Designer" (second study)

- Channel: uxpeak. URL: https://youtu.be/U7jTCgIWS4w. Length 15:32.
- Method: video downloaded at 720p and read as contact sheets (a frame every 3.5 s, 9 sheets, all looked at) plus full-size pulls at 1:58, 3:52, 4:12, 4:22, 9:44 and 10:03, read against the transcript (fetched with youtube_transcript_api; the subtitle download was rate limited again). First study: `U7jTCgIWS4w.md`. This one only adds what that one missed.
- Subject: two comparisons of the same app by "junior / mid / senior / staff" designers. Part 1 (0:00-5:10) a food delivery list. Part 2 (8:00-15:00) a home-search filter sheet. 5:10-7:40 is a Mobbin MCP sponsor segment (ad, ignored).
- Correction to the first notes: in the video the letters are shuffled (C is the junior, A the mid, D the senior, B the staff), so the presenter's "which one do you pick" is a blind test. Nothing else there was wrong.

## What is shown (video time)

- 0:00-0:30 Hook: four phones side by side, same photos and meals. The presenter asks the viewer to pick before the reveal; Junior/Mid/Senior/Staff badges appear only afterwards.
- 0:37-1:00 Junior card. The photo is of the food, not the restaurant logo ("a logo tells you who is selling, a photo tells you what you are eating"). Then a 56 px callout on the thumbnail. At 1:58 a full frame shows the card: name "Salt & Lime" in 13 px black, then one grey 11.5 px line holding rating, count, cuisine, distance, time and delivery fee, with the rest of the line blacked out to prove it has no internal order.
- 1:05-1:40 Why so small: "six restaurants fit above the fold". Callouts "Radius 4" on every box while the category images are circles (two shape languages).
- 1:50-2:20 Filters and sort hidden inside two dropdowns "with 17 options behind them".
- 2:05-2:50 Mid: photos change from square to a rectangle three times wider, two to a row; one radius everywhere; name larger, rating with a star and weight, the rest drops back; eight chips (All, Under 30 min, Free delivery, 4.8+) on screen; "Sort" at the heading's right edge.
- 2:45-3:50 Senior: one full-width photo per card with the name, rating and time laid over a dark fade at the photo's bottom; category photos replaced by one icon set; filter and sort buttons as round icons beside the chips; "640 places" beside the heading; a cards/list toggle at the heading's right edge (4:12 full frame is the Staff card, 3:52 the Senior).
- 3:50-4:25 Staff (full frames 3:52 and 4:12): search says "Search places, dishes or cuisines"; "BEST MATCH" tag on the top card, said to be "based on what we know about the user"; photo is clean and full width with rounded corners; under it the name bold at the left, and at the right two bold facts stacked ("20 min", and "Free" in functional green); second line "4.8 (3,201) . Tacos and ceviche . 0.8 km" in small grey with a star. Uber Eats shown as the same pattern (4:25).
- 4:30-5:00 Promotional uxpeak+ course ad; at 4:40 a four-phone final row (the junior to the staff, left to right at 4:22) is the best single before/after in the video.
- 8:00-8:50 Part 2 opening: a counter ticking from 1,491 to 1,557 homes; a sticky note "around $500-900k, 3 bedrooms, 2 bathrooms". The note is then crossed over live: "or a bit more?", "2 could work". Point: requirements are soft; people trade them off while looking.
- 9:00-9:50 Junior filter flow: "7 taps" bubbles, results vanish behind each full page, the button "Show homes". A "Decision ease vs Simplicity" pair of sliders (9:20) frames the lesson: less on screen is not the same as easier. Another slide (9:48, "Simpler / Easier") puts a listing card with "Book a viewing" beside one with three time chips and "Book Sat 11:30" (small and blurred in the frames I could pull; read from the contact sheet).
- 9:44 "Only the essentials": the junior sheet is a list of rows (Price, Bedrooms, Bathrooms, Home type) with the value at the right and a chevron.
- 10:00-11:10 Mid: one scrolling sheet over the results; price slider plus two typed boxes; steppers "- Any +" (criticised); button "Show 638 homes" (10:03 full frame).
- 11:27-12:55 Senior: histogram behind the slider; "Studio 1+ 2+ 3+ 4+" tiles with an "Exact number of bedrooms" checkbox; home types as icon tiles; button "Show 359 homes".
- 12:57-14:30 Staff: "459 of 1,557" and median price above the histogram; counts under every bedroom tile (3+ 459, 4+ 229); mortgage calculator row; chat bubbles ("What's your maximum price?" / "I have $65,000 for a deposit...") explain why it asks for deposit and monthly budget instead of a maximum price.
- 14:30-15:30 Close: the four sheets side by side again, comment prompt.

## Lessons

1. **Lead with the thing they will get, not the seller's logo.** The junior list was praised for using food photos instead of logos. A card for a business shows the product, the dish, the finished job, never only the business logo. NEW (3c.4 covers "show it in use" on a page, not the card, and the first notes only said "not a logo" in passing). Check: every card's image is a photo of the offer; a logo is allowed only as a small mark on top.
2. **Hierarchy has numbers.** The failing card had a 13 px name over an 11.5 px line, all one colour: a 1.13x step. The fixed ones step the name up clearly, bold it, and put one fact in a different weight. NEW (3e.10 says "one reading order" with no size). Check in the review script: name font-size at least 1.25x the supporting line, and the name has a heavier weight; supporting text lighter in colour.
3. **Put the two facts people decide on in their own column, opposite the name.** The staff card has name and rating at the left and "20 min" and "Free" bold at the right. For us: price and "ready in" / "next free slot" / "serves 10" at the right of the product name, bold; description under, small. NEW. Check: price sits on the same row as the name, right-aligned, and is the second heaviest text on the card.
4. **Say how many there are next to the list heading** ("640 places"). People then know how much looking is ahead. For us: "12 cakes", "9 services" beside a menu or service heading, only if counted from the real list, never a rounded-up number. NEW. Check: count is generated from the data, not typed.
5. **Making it look simpler is not making it easier.** The junior filter hid everything one level down and cost 7 taps; the fix was putting connected choices on one screen where each affects the others. On a small business site: size, flavour and date for one order sit together with a running total, not on three steps, and the visitor never loses sight of what they have chosen so far. NEW (3k covers multi-page structure, not splitting one decision across steps). Check: count taps from landing to "ready to send" for the main order; all choices that change the price are visible at once.
6. **Show what each option costs or leaves before it is chosen.** The staff sheet shows a count under every tile. For us: each size chip carries its price; each slot chip shows the time. NEW as a general rule (3c.5 and 3l cover choices with prices; this adds per-choice consequence). Check: no option tile is only a label if a real number exists for it.
7. **A button that names the slot or the result** ("Show 41 homes", "Book Sat 11:30"). ALREADY 3c.6 and first notes #7; the "Book Sat 11:30" version (a real next slot on the button) is new in practice. Only with a real calendar.
8. **Photos get most of the card, one per row on a phone.** Mid had two small photos per row, senior and staff one full width. For appetite items (bakery, caterer, boards) use one large photo per card on a phone. NEW as a number. Check at 390 px wide: card photo is at least 90% of the card width and at least 40% of the card height; thumbnails below 25% fail (first notes #1).
9. **Text over a photo needs a fade; text under a photo needs nothing.** The senior card kept text on the photo with a dark fade at the bottom; the staff card moved it below so any photo works. ALREADY 3e.12 and 5b.3.
10. **Category icons: one family, quiet, on soft tiles, and fewer than the items shown below.** The junior used photo circles that competed with the meal photos; the fix used one outline-style icon set with pale tiles. ALREADY first notes #8, and 3c.9 (lucide).
11. **One radius, one shape language.** Junior mixed 4 px boxes with circles. ALREADY 3e.15.
12. **Filters or choices must not be buried in dropdowns.** "17 options behind two dropdowns". ALREADY 3c.5 (tiles, never a dropdown).
13. **Search fields say what they accept.** ALREADY first notes #6.
14. **Soft requirements: show the near miss.** The sticky note went from "3 bedrooms, around $900k" to "or a bit more?" and "2 could work". For us: if the exact size or date is not available, say what is near: "Sold out for Friday, Thursday is open", "Not in 8 inch, the 10 inch serves 12". NEW. Check: every "unavailable" state offers the nearest real alternative.
15. **"3+" style labels say what they mean** and an exact option exists beside them ("Exact number" checkbox). For us: "Serves 8+" vs "Serves exactly 8". NEW but minor.
16. **The final comparison row is the proof.** Four screens in a row, left to right, made the improvement visible in two seconds. Use the same for our own reviews: render the old and new version side by side before showing Tzvi. NEW (review habit; 3p.7 asks for review by someone else but not a before/after row).
17. **Best-match tags rest on knowing the user.** The video says it is "based on what we know about the user". We know nothing, so no "Best match" or "Recommended". ALREADY 3c.5 ("Most popular" only if real).

## Do not copy

- Mortgage calculator, histogram, steppers, filter sheets, "459 of 1,557 fit": app search for thousands of items. Our businesses have 5 to 40 items.
- "Best match" and any ranking label: personalised in the video, invented on our pages.
- The Mobbin pitch and 20% code: paid promotion. The uxpeak+ course plugs likewise.
- Dark, moody food photos on terracotta in the staff screen: the look belongs to that mock app, not to our businesses' own colours.
- Round filter icon buttons without labels: pass for an app with a known pattern, but on a small business site a labelled chip beats an unlabelled icon.

## For our pages

- A bakery, caterer or meat board is judged on the first photo: one big, clean photo per item, name bold at the left, price bold at the right, a short grey line under it, and the count ("14 boards") beside the heading. That alone separates a professional page from a list of thumbnails.
- Keep one order on one screen: size, flavour, date and total together, and a button that says what will happen ("Book Thursday 4:30"), never a step-by-step wizard for something with three choices.
- Each option tile carries its real number (price, serves, next free time). A gym or nail salon shows the slot on the chip and repeats it on the button.
- When something is full or missing, show the nearest real alternative on the spot, so a visitor never reaches a dead end.
- Before showing anything, line up the old and new version in one row and check the card with a squint: one thing must win, and it must be the photo, then the name, then the price.
