# Rules for chicken-munch (docs/rules-checklist.md)

One line per id: `Rx.y pass: <what was looked at or which script passed>`, `Rx.y n/a: <why>`, or `Rx.y fix: <what is wrong>`.
Replace every `todo`. `node scripts/check-rules.mjs scrollcraft/builds/chicken-munch` must exit 0 before anyone is shown the site.


## 1. Facts and words
R0b.1 n/a: local build, not published in this task (no publishing allowed)
R0b.3 pass: every price is carried over unchanged from his menu card (boxes $69, $140, $220 with $276 struck; pans ₪275 ($85), roaster ₪650 ($210) with ₪825 struck, rice ₪75); the shop ids in gen/catalog are not touched
R2.1 pass: read every sentence on the four pages; the new card lines are his menu card lines; I removed a line of mine ("coated, fried and packed in Jerusalem") that he never said
R2.2 pass: read message-to-owner.md: it asks only about their own business (photos, days, delivery, prices, guarantee), nothing about how we build and nothing the record already answers
R2.3 pass: message-to-owner.md has 8 example FAQ questions written from their real details, plus the worry and the photo-in-use questions
R3.1 pass: kosher appears only with the hechsher of Rav Akiva Dershowitz and "chicken is Edah Chareidis or Rav Landau" from his flyer; no best, award, guarantee or fresh claims
R3.2 pass: searched for hurry, only N left, limited, ends soon, countdown: none; the Shabbos orders line is his own
R3.3 pass: searched for welcome to, look no further, passionate, quality you can trust: none
R3.4 pass: facts script: no exclamation mark, no long dash; capitals are the display type and his name
R3.5 pass: the first screen says kosher American fried chicken, boxes and pans with prices
R3.6 n/a: the site is English only, there is no Hebrew version
R3.7 pass: no FAQ, review or gallery section is shown (the FAQ and gallery blocks stay hidden until the owner sends content); no placeholder text
R3.8 pass: searched visible text and markup: no logo wall, laurels, stars, counts, "popular" badges or intro prices
R3.9 n/a: no ad or flyer message brings visitors here; the first screen carries the flyer words anyway
R3.10 pass: the only strength on the page is the hechsher, with its rabbi named
R5.1 pass: read aloud as him; lines are about boxes, pans, kinds and sauces
R5.2 pass: plain voice, no jokes; "Dangerously addicting" is his flyer line
R5.3 pass: "Kosher, hechsher of Rav Akiva Dershowitz" and "The chicken is Edah Chareidis or Rav Landau" are full phrases
R5.4 pass: facts script found no they, them or their about the business on the home page; the one hit on the menu page is his menu line about customers
R5b.2 pass: the one main button reads "Order now" and goes to order.html in the bar, opening, bands, footer and phone bar; the Add buttons are secondary outline pills
R5b.8 pass: closing lines read "Now taking Shabbos orders" then the button
R3.11 pass: order of the home page: what it is, kosher, boxes with prices, kinds, handcrafted line, pans, Shabbos orders
R3o.4 pass: contact page and footer label "WhatsApp or call" and "From the US, call (no WhatsApp)"
R3e.22 n/a: owner must send a photo of himself or his kitchen; his WhatsApp number is in the footer and contact page
R3s.19 pass: facts script on the home page shows its own title, description, og:title, og:description and og:image (bowl); menu, order and contact have their own
R6.1 pass: lead block is the product with its prices and the order button; boxes, kinds, kosher and contact all present
R4.1 pass: 9x13 rice has no photo so it is a text row; Shnitzel Bites, Pretzel and Buffalo Wings have no photo so they are plain colour tiles; listed for the owner

## 2. Opening
R3g.13 pass: first screen at 1440x900 and 390x844: his photo, the headline "The taste of America" (4 words), one small line (Kosher American fried chicken, Jerusalem), the price line beside the one button; the old lede line was removed on 22 Oct
R3b.1 pass: opening says kosher American fried chicken, Jerusalem, hechsher line right under, Order now
R3b.2 pass: price line sits beside the Order now button; one kosher band after the opening and one in the footer (two)
R3b.3 pass: one solid yellow action per screen; header and Add are outline
R3h.1 pass: check-site OPENING passed; the bowl drops across the giant name and the letters spread as you scroll
R3n.1 pass: his bowl photo and the cornflake photo fill the first screen at 1440x900 and 390x844
R3n.2 pass: the bowl dropping onto CHICKEN MUNCH with stickers that stick on; no other business has his bowl and name
R3n.3 pass: Add changes the basket count in the bar on every page and fills the order page; the menu page list swaps the stage photo and caption
R3n.4 pass: first screens put next to Best Bean Best Cup and Theobroma in docs/inspo/awwwards-anatomy-2026-10-22/food; the colour-room row has the same structure with his boxes
R3n.5 pass: you land and a bowl of poppers drops onto the name CHICKEN MUNCH
R3g.15 pass: his own photos at their own resolution; check-fits found none over 1.35x
R3h.2 pass: no film opening exists (the opening is his photo with code letters)
R3h.3 pass: no film opening exists
R3h.5 pass: no film chapter lines exist
R3h.7 pass: no film joins exist
R3h.8 pass: no film exists; the section after the opening turns bright and bold (cream with colour rooms)
R3h.11 pass: no film or generated still set exists on this site
R3h.13 pass: no generated effect exists
R3h.14 pass: no film effect exists
R3h.17 pass: the page does not use words-and-film turns

## 3. Sections and worlds
R3.12 pass: dramatic opening, a features section (boxes and pans with price and what is included), a closing band with the order button beside the hechsher line in the footer
R3c.1 pass: three category-study pictures cited in CONCEPT.md, plus a fresh Mobbin and Inspo search on 22 Oct (Touchy Coffee product row, re_, Graza, Mooala) named in CONCEPT.md; 21st search failed twice so nothing is from it
R3g.17 pass: pieces came from searches named in CONCEPT.md (Mobbin Touchy Coffee for the product row with name, size and price and an ADD pill; Best Bean Best Cup for the colour room); 21st search failed twice, so no piece is from 21st; each effect has a reason
R3c.2 pass: not cream plus serif plus italic: loud Anton on his own colours; one ground that is a contrasting black in the opening and footer
R3g.1 pass: CONCEPT.md gives the colours and faces; site.css tokens match (gold, red, navy, orange, black; Anton and Archivo)
R3g.3 pass: facts script: prices are in the card text colour (ink or white), the accent yellow is only the main button; no emphasised word in colour
R3g.7 pass: one closing signature, the giant CHICKEN MUNCH in the footer, away from the order path
R3g.11 pass: Anton, Archivo and Heebo (Hebrew fallback) are from the approved list; unchanged from the earlier build
R3p.3 fix: check-fingerprints still reports Anton shared with michal-yodaiken and tile and reveal effects alike with the-brown-box and the-gift-boutique; scrollcraft/fingerprints.json may not be touched in this task and Anton is his logo face: needs Tzvi or the coordinator
R3p.5 pass: CONCEPT.md touch line: the sticker labels drift against the mouse over the bowl; works (seen in the screenshots)
R3q.1 fix: check-concept passes every part but "Not alike", which cannot pass until the fingerprint clash above is settled
R5a.7 pass: one signature (the bowl drop), one peak (the opening); the ending resolves on the Shabbos orders and the button
R9.1 pass: the bowl drop uses his own bowl photo only
R3f.2 pass: effect budget: one signature (the bowl drop), accents (letters spread on scroll, sticker drift, the Add and card hovers), no more added; captured frames at 0 to 90 percent at three sizes show them
R3m.1 pass: data-mir-gallery block present and hidden until photos exist
R3m.3 pass: hours, areas and FAQ stay in fixed hidden blocks until the owner sends them
R3k.1 pass: pages are Home, Menu, Order, Contact; the menu and the order are the Order page flow; old addresses are not used
R3k.2 pass: one identical menu bar on all four pages with the Order now button and basket count; the phone menu opens and closes on Escape or a link tap
R3k.4 pass: shared site.css and site.js; section classes are not reused for shared state
R8a.1 pass: no 21st components or external script hosts; only the Google Fonts stylesheet
R3b.4 pass: facts carry the page, nothing padded
R3c.3 pass: the kosher worry is answered by the band under the opening and in the footer
R3c.8 n/a: the owner has not told us what happens after the order (asked in message-to-owner.md questions 3 and 4)
R3e.10 pass: each card has the name largest, feeds line, one line of what is in it and the price in the card colour; the cards of a row are built as photo, text, price row so titles and prices sit at the same height (looked at at 1440x900 and 390x844); check-site ALIGN passed
R3e.14 pass: six text sizes as CSS variables in site.css: --t1 14px small, --t2 17px body, --t3 titles and prices, --t4 headings, and --f and --f2, the two sizes of his logo name (opening CHICKEN and MUNCH; MUNCH and the footer name share --f2); every font-size in the file reads one of them; computed sizes counted on every page: home 6, menu 5, order 5, contact 5 at 1440x900 and 1280x650, and 5 on every page at 390x844. Cost: prices are now the same size as card titles (they were larger), headings top out at 4.4rem, the footer name is one line on a laptop and two on a phone
R3c.9 pass: radii 999px pills and 14 to 22px photos; one icon (the arrow, lucide shape); no two-colour gradients; one shadow style on the opening bowl
R3s.4 pass: check-site ALIGN passed
R3s.6 pass: check-site ALIGN passed; Add buttons are all the same outline pill
R3s.7 pass: buttons in sentence case, pale dividers, body line height 1.5 or more
R3s.9 pass: the kosher band is one red band, the savings tag is one style everywhere (a white pill on a photo, black on the white pan photos)
R3s.12 n/a: owner must send a photo of himself or his kitchen; his real product photos come right after the opening
R3s.14 n/a: the owner has given no counts or numbers; only prices are shown big
R3s.11 n/a: owner must tell us why the boxes cost what they cost (asked in message-to-owner.md, question 5)
R5b.6 pass: no scroll cues, no 01/06 counters, no label above each section
R3.13 pass: no doubled contact (the footer holds it once), no two dividers in a row
R3a.1 pass: rendered at 1440x900, 390x844 with touch emulation, and the six sizes through check-fits; every screen of the home page looked at; every place changed in the review looked at at 1440x900 and 390x844
R3r.1 pass: check-site (clean on all four pages), check-fits (clean at the six sizes) and check-motion run on every page of the site after the last edit; readable.mjs on every page (see R3e.8)
R3r.2 pass: independent review on 22 Oct (docs/page-review-checklist.md) by a separate reviewer, all its findings fixed and re-checked
R3g.12 pass: check-site FLOW filled the order form and followed it to the written WhatsApp message with the total (nothing sent to the owner); every Order now button is a link to order.html, checked in the DOM
R0b.12 n/a: not published, so there is no pages-list preview clip yet

## 4. Photos and media
R8.1 n/a: owner must send a matching set (one photo per box and per pan, same angle and ground); today the three box photos come from three shoots (Mini and Grand are one box photo at two crops, the Supreme is a pile of chicken on yellow) and the 9x13 pan photo is cut flat at its bottom edge in the file the owner sent, so it runs off the bottom of its frame; no uncut copy exists in src/owner: listed for the owner
R8.6 n/a: owner must send a clean photo of each box and pan so hero shots can be made from them (the brief forbids generating now); the list is in the report
R8.2 pass: only his own photos are used; no stock, no cut-outs mixed from many photos
R3p.7 pass: every kind of chicken is a tile; five show his photo, the three without (Shnitzel Bites, Pretzel, Buffalo Wings) are plain colour tiles
R3h.12 pass: each item looks the same everywhere (the same photo file on home, menu and order)
R3h.10 pass: the menu page list swaps the stage and caption for every one of the eight kinds: five with his photo (Classic added), three on their own colour tile (Shnitzel Bites, Pretzel, Buffalo Wings); the home page has no option picker
R3g.14 n/a: owner must send a matching photo set; the photos now on the page come from different shoots and grounds: listed in the report
R3o.1 pass: no generated food anywhere on the page; every food picture is his own photo
R3o.2 pass: no generated liquid exists on the page
R3o.3 pass: colours look true, no cast on any photo
R3o.6 pass: one photo per kind taken from src/owner and assets; duplicates left out
R8.3 pass: nothing generated on the page
R8.4 pass: nothing generated or moving as real material exists on the page
R3c.13 pass: check-fits found nothing cut; check-site found nothing cut
R3c.14 pass: the only cut-out is the opening bowl; looked at on the dark opening and on the red Shabbos band with no fringe
R5b.3 pass: words on pictures sit on a darkened photo with white or gold letters (the opening) and cards put words on solid colour; looked at in the 1440x900 and 390x844 screenshots; no frosted glass
R3e.8 pass: readable.mjs is clean on the order and contact pages; on the menu page its two hits are list lines passing under the sticky photo at 390x844 (the photo covers them); on the home page its hits are the opening animation (the letters of MUNCH over the golden glaze of the bowl, the Kosher sticker scaling in) and are the same on the file before this review; the label under the opening name was lightened to #FFC24D (it measured 4.32:1)
R3s.24 pass: check-site MEDIA (photos light and sized, every img has width and height, checked in the page facts script)
R3p.6 pass: check-fits passed at 1280x650, 1440x900, 1536x753, 1920x1080, 390x844 and 360x640
R3o.5 pass: check-site GLYPH found no unrendered character

## 5. Prices and savings
R3c.5 pass: no <select> on any page; sizes and kinds are tiles or chips; no "most popular" badge
R3c.6 pass: Add on a card, "Order now" in the bar; the order page button names the next step and the total
R3c.7 pass: the standing savings are real, with the separate price struck through; no offer with an end date
R3j.1 pass: no guarantee is shown because none is offered
R3j.2 pass: the order page offers a 9x13 rice after a pan with Add rice and No thanks, not pre-ticked
R3j.3 pass: no taster is shown because none is offered
R3j.4 pass: no group discount is shown because none is offered
R3j.5 pass: no come-back feature is shown
R3j.6 pass: the Grand box is tagged Family size; no invented option
R3j.7 pass: every struck price is the real price of the same items bought separately: $276 is four Mini boxes, ₪825 is three 9x13 pans (the tag title says so); no .99 endings
R3j.8 pass: per unit: Mini $69 feeds 3 to 4; Supreme $220 for 16 against four Minis $276; pans: three 9x13 pans ₪825 for 18 to 20 against the Roaster ₪650
R3j.9 pass: each small group (the boxes, the pans) shows its own saving, not a lone saving
R3j.10 pass: Supreme 20% off: (276-220)/276 = 20.3 rounded down to 20, $276 struck beside $220; Roaster 21% off: (825-650)/825 = 21.2 rounded down to 21 in shekels, ₪825 struck beside ₪650, with $210 as a plain second line (no struck dollar figure); the earlier 17% was the dollar pair
R3j.11 pass: no combined service or package exists to compare; the basket offers no switch lines
R3j.12 pass: the owner made no savings claim; the savings shown were derived from his prices
R3.14 pass: loud prices only because prices exist (boxes, pans, sizes), none invented

## 6. Order and booking flow
R3k.7 pass: check-site FLOW walks the three steps (Step 1 basket, Step 2 when and where, Step 3 details); unchanged code, only the colours changed
R3k.8 pass: every basket line has a 40px remove button; check-site TAP passed
R3k.6 pass: Add on any page puts the item in the shared basket and opens the order page with it
R3.15 pass: ordering has the order page; contact has WhatsApp, call and email
R7.1 pass: CONCEPT.md names the pick and the reason; no options page
R8.5 pass: every main button goes to order.html, his own order page
R0b.13 pass: the order code (gen/order_save.py then WhatsApp) was not changed; check-site FLOW passed through the order steps; no live order was sent
R3l.1 pass: message-to-owner.md question 7 asks what a customer can choose per size; the earlier build already holds the limits per box and pan (up to 4 types and 3 sauces, and so on)
R3l.2 pass: each item says what it allows ("Up to 4 types of chicken and 3 sauces") on the card, the order line and the message
R3l.3 pass: unchanged order code: choices appear once added; check-site FLOW passed
R3l.4 pass: three boxes compared side by side, only what differs shown
R3l.6 pass: the box photos are his own boxes; all three cards use one frame and one crop style, but no box shot of the Supreme exists (only a pile of chicken in a box on yellow), so the three read as one set by crop and not by subject: flagged for the owner
R3l.7 pass: each card reads alone: name, feeds, what is in it, price
R3e.9 pass: check-site STATE and FLOW passed; buttons have rest, hover and pressed states; fields have focus and error states
R3e.19 pass: the order ends with WhatsApp opening with the written order; unchanged
R3s.16 pass: unchanged order flow asks a basket first
R3s.18 pass: unchanged; chip lists have a way out
R3s.25 pass: check-site FLOW passed (empty form says what is missing, total in the message)

## 7. Motion
R3f.1 pass: the one scroll effect (the letters spreading and the bowl rising) was captured at 0, 20, 40, 55, 70, 85 and 100 percent at 1440x900, 1280x650 and 390x844: the bowl and name are whole on screen at the start and leave smoothly
R3f.8 n/a: the only scroll-tied effect is an exit motion (the letters spread as the opening leaves) with no finishing state to reach
R3f.9 n/a: no stacked list effects
R3f.5 pass: grepped css for ch units in widths and background-clip: none
R3f.4 pass: no logo motif effect exists on the page
R3g.4 pass: motions: letters rise, bowl drops, stickers stick, reveal fade; ease-out, none linear
R3e.16 pass: grepped css and js for linear easing: none left
R3e.17 pass: the page has no carousel or bottom sheet (the grid wraps to two columns on a phone)
R3e.18 pass: the page has no ambient background video
R3a.2 pass: no in-between states looked unfinished at the middle of the opening and the menu photo swap; on the menu page every kind now has a state of its own (his photo, or its own colour tile) and the caption always names the item shown (hover checked for Shnitzel Bites, Classic American Crunch and Buffalo Wings; tap and focus use the same handler)
R3a.3 pass: nothing is placed on a spot in a photo; the stickers belong to the bowl element and move with it
R3a.4 pass: no section is held; every section fits one screen (check-fits)
R3a.5 pass: no scroll hijack; reduced motion shows the finished page (the page checks matchMedia)
R3s.2 pass: check-site SHIFT and check-motion passed (no jump, no flash)
R3s.1 pass: check-site STATE passed
R3s.8 pass: opening button over a dark photo sits in the solid yellow pill
R3s.10 pass: pictures load with the card
R3i.3 pass: no live readout exists on the page
R3s.21 pass: check-site BROKEN found no script errors, console errors, 404s or dead links

## 8. Phone
R3b.6 pass: phone bar pinned at the bottom with "From $69" and Order now after the first screen, stepping aside while a card price or button is in its strip; seen at 390x844
R3f.7 pass: bar fits at 360 wide (check-fits and check-site PHONE passed)
R3a.6 pass: the phone bar steps aside while any price or button is in the strip it covers; stepped the scroll in 100px stops on touch-emulated 390x844 and 360x640 over the whole home page: no price or button was ever under the bar
R3s.22 pass: check-site TAP passed
R3s.23 pass: check-site PHONE passed (no sideways scroll); the section headings and their lines now take the same side gutter as the other pages
R3t.1 pass: site-category food-shop on every page and in CONCEPT.md; home and shop compared with docs/inspo/awwwards-anatomy-2026-10-22/food (Best Bean Best Cup, Theobroma, La Joya)
R3t.2 pass: BUY passed (price and Order now within the first two screens); every box and pan card has photo, name, feeds, price and Add; the kinds tiles are not for sale
R3t.3 n/a: not a trainer site
R3t.4 pass: footer on every page has a last big line, the order button, link columns and contact
R3a.7 pass: phone checks used a touch-emulated mobile context (hasTouch, isMobile), not a narrow desktop window
R3a.8 pass: no dot-separated line wraps; the footer nav dots fit at 360x640

## 9. Finish
R3r.3 pass: check-rules run; scripts run after the last edit as listed in the report
R3r.4 pass: the rework itself is Tzvi's correction of 22 Oct (rule 3t); it is in the rules and the checklist already
