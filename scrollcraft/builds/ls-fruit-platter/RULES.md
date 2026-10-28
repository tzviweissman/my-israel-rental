# Rules for ls-fruit-platter (docs/rules-checklist.md)

One line per id: `Rx.y pass: <what was looked at or which script passed>`, `Rx.y n/a: <why>`, or `Rx.y fix: <what is wrong>`.
Replace every `todo`. `node scripts/check-rules.mjs scrollcraft/builds/ls-fruit-platter` must exit 0 before anyone is shown the site.


## 1. Facts and words
R0b.1 pass: slug ls-fruit-platter equals the slug in src/record.json
R0b.3 pass: the four sizes are shop products with fixed ids (PID in shop.html, live order form lists all four, check-site SAVE ids clean); their board sizes in cm written to the products 28 Oct (gen/catalog/sizes.py)
R2.1 pass: read every sentence on the three pages; each fact is from the record, her logo line or her flyer; the board sizes in cm (Small 30 x 30, Medium 40 x 28, Large 58 x 28, Extra large 115 x 25) are hers, sent through Tzvi on 28 Oct
R2.2 pass: read message-to-owner.md: only about her business, nothing about our tools; questions 13 to 15 added on 22 Oct (the Party Platter on her flyer, same-day orders, "from our kitchen")
R2.3 pass: message-to-owner.md question 12 asks for her questions and answers; the FAQ stays hidden until she sends them
R3.1 pass: searched for kosher, best, guarantee, fresh daily and delivery: kosher is her listing's hechsher in her own words; none of the others appear
R3.2 pass: searched every page for hurry, only N left, today only, countdowns: none
R3.3 pass: searched every page for welcome to, look no further, passionate and the other stock lines: none
R3.4 pass: searched visible text and alt text for exclamation marks, long dashes and capitalised words: none
R3.5 pass: first screen: "Fresh, beautiful fruit platters" and "For your home and events, in four sizes" name what she sells in her logo line and listing words
R3.6 n/a: the site is English only
R3.7 pass: the FAQ and gallery stay hidden until the owner fills them; no reviews, no placeholder; the Medium size has its photo
R3.8 pass: scanned every page: no logo wall, laurels, stars, counts or invented badges
R3.9 pass: compared the first screen with her listing and flyer: same promise
R3.10 pass: one strength shown, kosher, with the hechsher beside it
R5.1 pass: read every line as the owner: each is about fruit platters, sizes, Jerusalem, kosher or ordering
R5.2 pass: read every line: plain and printable on their menu
R5.3 pass: "Kosher, hechsher:" with her named body is a full phrase
R5.4 pass: searched visible text for they, them, their: none that speak about the business (the Brown Box order form says "Their phone" for a gift recipient)
R5b.2 pass: main button "Order a platter" to shop.html#sizes in the bar, the film, the story band and the footer; the card buttons "Add, N" are the product control that adds that size
R5b.8 pass: the closing line is "Order a platter" with her WhatsApp and phone; no "or" without both choices visible
R3.11 pass: headline names what she sells; order of the home page: sizes with prices, her story, how to order, trust facts; price comes before any form
R3o.4 pass: WhatsApp and Call are labelled; message-to-owner.md question 7 asks which number takes what
R3e.22 n/a: owner must send her name and a real photo of herself or her kitchen; none is in the record, so none is shown (listed in the report)
R3s.19 pass: viewed the head of all three pages: own title, description, og:title, og:description and og:image on each
R6.1 pass: food-shop playbook: product cards with price and Add first, then story, how to order, trust
R4.1 pass: missing servings, delivery and hours are not invented; they are asked in message-to-owner.md

## 2. Opening
R3g.13 pass: 1440x900 and 390x844 first screens: the film frame, a three word headline, one line, one button; the kosher band sits just under
R3b.1 pass: first screen says what (fruit platters), where (Jerusalem), trust (Kosher) and what to do (Order a platter)
R3b.2 pass: the kosher band follows the opening; the certificate is stated twice (the band and the trust row)
R3b.3 pass: one solid action per screen: the bar button is the outline version over the film
R3h.1 pass: the home page opens on the fruit rain, which follows the scroll (26 Oct, Tzvi: "why is it not scrollable"): her empty board fills as you scroll, empties on the way back up
R3h.20 pass: scroll-driven since 26 Oct: the film section is 3.2 screens (320svh) with a sticky stage; frames on a canvas (assets/film/d and m), loaded in passes, shown point eased toward the scroll; her board on a plain red ground, the whole board on a tall phone (frames m); check-site SMOOTH/SLOW run by publish-page
R3n.1 pass: her Large platter fills the whole first screen on laptop and phone
R3n.2 pass: the fruit bursts up off her Large board in the opening film; no other business has her board
R3n.3 pass: on the shop page choosing a size changes the stage photo, name, price, button and the page ground to that size's colour; check-motion COLOUR clean
R3n.4 pass: set the first screen beside Best Bean and Theobroma in the food study: ours is a film of her own board, theirs a still pack shot
R3n.5 pass: "you land and her fruit bursts up off the board, then four sizes sit in a row, each with a price and Add"
R3g.15 pass: the film is made from her own Large photo; check-fits shows no photo over 1.35x its size
R3h.2 pass: walked the film: her empty board on the red ground, the fruit falls in from above and lands as her Large board, ending on her platter picture
R3h.3 pass: full screen, video at screen size, looked at at 1440x900 and 1920x1080
R3h.5 n/a: the film has no chapter lines; the headline sits on the calm left
R3h.7 pass: one clip, no joins (Kling 3.0 Pro, first and last frame pinned, gen/film_v3.py), cut into 161 frames per size
R3h.8 pass: after the red film the page turns to a light ground with four colour cards
R3h.11 pass: brightness.py on assets/opening.mp4: 25 frames, average 37, bright enough
R3h.13 pass: one cause (falling), one motion per piece: each piece falls and lands; watched at 8 fps on 26 Oct, no fall-then-fly, no heap from nowhere
R3h.14 pass: the board is in every frame and never moves; it only fills
R3h.18 pass: gen/opening-film-v3-brief.md lists every object (board, ground, each fruit, droplets) with where it comes from and ends; the clip was watched at 8 fps object by object on 26 Oct: every piece enters past the top edge and stays on the board, nothing changes or vanishes. The burst idea (one watermelon becoming a platter) was dropped for failing this
R3h.17 n/a: the page does not use a giant name over the film

## 3. Sections and worlds
R3.12 pass: hero film, four size cards with price, a closing band with the button and her contacts
R3c.1 pass: CONCEPT.md cites docs/inspo pictures; the food contact sheets (bestbean, theobroma, delice) were the references for this pass
R3g.17 pass: check-concept and check-fingerprints pass for this build; every effect has a source line
R3c.2 pass: whole home page at laptop width: a red film, a light ground, one pale green band; not cream plus italic word
R3g.1 pass: CONCEPT.md and the tokens at the top of site.css: ink, ground, one accent, DM Serif Display, Open Sans, one radius
R3g.3 pass: the accent is on the main button only; prices, the stroke under the heading word and the step numerals are in the ink colour
R3g.7 pass: the footer holds one closing signature at most, below the order path
R3g.11 pass: the two faces set in the page head and css; checked against reference/design-rules.md
R3p.3 pass: ran check-fingerprints 25 Oct: ls-fruit-platter: different from all 12 other pages
R3p.5 pass: the scroll bar across the top is cut from her Extra large platter
R3q.1 pass: check-concept: concept ready for ls-fruit-platter
R5a.7 pass: one signature: the burst opening; the peak is the four card row
R9.1 pass: the burst film is built from her own board photo
R3f.2 pass: the opening burst (signature), the slat stage on the shop, the basket fly and the top bar are the accents
R3m.1 pass: grepped the html: the gallery and list places exist where the owner can fill them
R3m.3 n/a: the owner gave no hours, fees or guarantee, so there are no such places
R3k.1 pass: the shop page is the menu and the order on one page
R3k.2 pass: one menu bar on every page with the Order button; on a phone it folds into Menu
R3k.4 pass: one site.css and site.js serve all three pages
R8a.1 pass: view source: no external script or image hosts beyond the font stylesheet
R3b.4 pass: few photos: sizes and prices carry the page
R3c.3 pass: the owner named no worry yet
R3c.8 n/a: the owner has not told us what happens after ordering
R3e.10 pass: check-site ALIGN clean; the size name is the largest, the price below it bold in ink; the longest name, Extra large, fits
R3e.14 pass: Open Sans in regular, semibold and bold; DM Serif Display for headings
R3c.9 pass: one radius family, one line icon set, one soft shadow, no gradients except the film edge shade
R3s.4 pass: check-site ALIGN clean (one left edge)
R3s.6 pass: check-site ALIGN clean; the card buttons share one height and corner
R3s.7 pass: buttons in sentence case; pale dividers; body line height 1.5 to 1.6
R3s.9 pass: the kosher line looks the same everywhere
R3s.12 n/a: owner must send a photo of herself or her kitchen; the story band shows her own platter photo until then (listed in the report)
R3s.14 n/a: the owner gave no numbers to show big
R3s.11 n/a: the owner gave no reason for the price to state
R5b.6 pass: no scroll cues beyond the film hint, no counters, no label above every section
R3.13 pass: no doubled contact, facts or gallery; no two dividers in a row; no ending on a divider
R3a.1 pass: rendered every page at 1280x650, 1440x900, 1536x753, 1920x1080, 390x844, 360x640 (check-fits), scrolled the home page at 1440x900 and 390x844 and looked at every screen; English only; reduced motion shows the held frame
R3r.1 pass: review pass of 22 Oct: check-site, check-fits, check-motion and readable ran on index, shop and contact; stepped screenshots every 100 px at 1440x900, 390x844 and 360x640 with document scrollWidth equal to the viewport at every stop and at each of the three order steps; the order walked to the WhatsApp message at 390 and 1440 with external requests blocked
R3r.2 pass: independent review on 22 Oct (docs/page-review-checklist.md) by a separate reviewer; findings fixed and re-checked
R3g.12 pass: check-site FLOW built the order message with the total and opened the WhatsApp link without sending it; nothing reached the owner
R0b.12 n/a: the site is not published, so there is no pages-list preview yet

## 4. Photos and media
R8.1 pass: put the four size photos (assets/size-1 to 4) and the four card pictures (assets/card-1 to 4) on one contact sheet: same slab, angle, blush ground, light from the left and crop; one shoot; each card shows the whole shot, nothing sliced by the card edge
R8.6 pass: each size photo is a product hero shot on a travertine plinth with its own fruit round it, from her own photo, checked fruit by fruit on 22 Oct
R8.2 pass: all four were edited from her own photos in one pass (gen/prep.py); no stock
R3p.7 pass: all four sizes are shown the same way on the home cards, the shop stage and the pick tiles; the size name stays on one line so the prices sit in the same row whatever the name length (checked at 390, 360 and from 900 to 1920 px)
R3h.12 pass: each size looks the same on the card, the stage and the tile: all come from one h-*.jpg master
R3h.10 pass: tapping a size changes its photo, name, price and button on the shop; check-motion clean
R3g.14 pass: all images share the blush slab grade; the film is a red scene by design
R3o.1 pass: generated food in motion is only in the full-screen opening burst; elsewhere the photos are her own or edited from hers as hero shots
R3o.2 n/a: no generated liquid outside the opening film (see R3o.1)
R3o.3 pass: fruit colours look true against her photos
R3o.6 pass: the photos in src/owner were all considered; four are the hero masters, the rest feed the gallery place
R8.3 pass: only her four platters; no person; no text baked in; fruit only; the owner has not yet approved the generated pieces (listed in the report)
R8.4 n/a: no moving real material beyond the opening film
R3c.13 pass: clipped clean at 1440x900, 1536x753, 1280x650, 1000x700, 768x1024, 390x844, 360x640 on every page
R3c.14 n/a: no cut-out image: every picture is a whole photo
R5b.3 pass: words over the film sit on a soft edge shade; readable clean on every page
R3e.8 pass: readable: every word clear at every size on all three pages (re-run on 22 Oct after the changes)
R3s.24 pass: check-site MEDIA clean; every img has width and height (the empty gallery template placeholder aside)
R3p.6 pass: check-fits clean at 1280x650, 1440x900, 1536x753, 1920x1080, 390x844, 360x640 on every page
R3o.5 pass: check-site GLYPH clean; the shekel sign sits in the body face

## 5. Prices and savings
R3c.5 pass: grepped for select: none; choices are tiles or buttons
R3c.6 pass: buttons read "Order a platter" and "Add, 300" with an aria-label naming the size
R3c.7 n/a: no offers on the page
R3j.1 n/a: the owner offers no guarantee, so none is shown
R3j.2 n/a: no add-on fits before ordering; none shown
R3j.3 n/a: no free taster or consultation is offered
R3j.4 n/a: no group discounts are offered
R3j.5 n/a: no stamp card or reorder feature is offered
R3j.6 pass: no invented option; every size or bowl is a real one from their list
R3j.7 n/a: no struck-through or was price on this site
R3j.8 n/a: no savings are shown on this site
R3j.9 n/a: no savings are shown on this site
R3j.10 n/a: no savings are shown on this site
R3j.11 n/a: no combined service or package that saves money
R3j.12 n/a: no owner savings claim is printed
R3.14 pass: prices are loud because prices exist; this is a priced shop

## 6. Order and booking flow
R3k.7 pass: check-site FLOW: Step 1 basket, Step 2 when and where, Step 3 details; the three step buttons have a pointer cursor, hover, pressed and focus states and a later step can be tapped (it goes as far as the filled-in steps allow and shows what is missing); Back button; browser back goes back a step; total beside each step
R3k.8 pass: every basket line has a 40 px remove button
R3k.9 pass: the Send button POSTs to /api/marketplace/order-form/cbf66136-.../orders (platter product ids 55113012e889 etc. from the 22 Oct add_site_products run; the time goes in notes) while a blank WhatsApp tab is already open, then fills the tab with the message and the tracking link; a failed POST still opens WhatsApp. Intercepted a full order in Playwright (fulfilment delivery, city jerusalem, address, date, name, phone, notes match WebsiteOrderIn); check-site SAVE and FLOW pass; nothing sent to the live site. Live saving also needs the listing converted to a store (convert_to_store in site_products_plan.json) and whether she delivers: listed in the reply
R3k.6 pass: Add on a home card opens shop.html#order with that size already in the basket (add=1)
R3.15 pass: ordering has the shop; messaging has contact
R7.1 pass: CONCEPT.md names the pick (film plus slat stage) and the reason
R8.5 pass: every main button goes to the shop and its order steps; WhatsApp is the last step
R0b.13 pass: the order is saved with a tracking link before WhatsApp opens (see R3k.9); the live save waits for the listing to be a store
R3l.1 pass: message-to-owner.md question 3 asks what a customer can choose
R3l.2 n/a: no size allows a choice; each is one platter
R3l.3 n/a: no item has options
R3l.4 pass: four sizes sit side by side with only name and price differing; servings are asked in message-to-owner.md question 2
R3l.6 pass: each picture is the platter as sold
R3l.7 pass: each card says its size and price on its own
R3e.9 pass: check-site STATE and FLOW clean; buttons have hover, pressed and disabled states in the css
R3e.19 pass: finishing an order shows "Thank you, name. Your order is open in WhatsApp"
R3s.16 pass: size or bowl first, then when and where, then details
R3s.18 n/a: every size or item is always available; nothing unavailable to replace
R3s.25 pass: check-site FLOW clean: an empty form sends nothing, a filled one builds the WhatsApp message with the total

## 7. Motion
R3f.1 pass: the shop stage and the film play with their subject whole on screen at 1280x650, 1440x900 and 390x844
R3f.8 n/a: no scroll-tied effect finishes in a section
R3f.9 n/a: no list lights item by item
R3f.5 pass: grepped css: no ch widths, no background-clip text
R3f.4 n/a: the logo has no motif that the page repeats
R3g.4 pass: each motion has one job (confirm, reveal, guide); no linear easing; no bounce
R3e.16 pass: grepped css and js: no linear easing outside the loading bar; transitions under 0.5 s
R3e.17 n/a: no carousel and no bottom sheet on this site
R3e.18 n/a: no ambient background video
R3a.2 pass: mid-transition frames of the shop slat swap looked at; nothing unfinished
R3a.3 n/a: no label is placed on a spot in a photo
R3a.4 pass: cutoff clean at the six sizes on every page; the home page no longer pins
R3a.5 pass: no parallax on phones; reduced motion shows a still
R3s.2 pass: check-site SHIFT clean and check-motion has no JUMP or FLASH, including two quick taps
R3s.1 pass: check-site STATE clean
R3s.8 pass: over the opening photo the buttons are solid cream on a soft edge shade; looked at on the light and dark frames
R3s.10 pass: every item is named beside its photo
R3i.3 n/a: no scroll readout on this site
R3s.21 pass: check-site BROKEN clean on every page

## 8. Phone
R3b.6 pass: the phone bar "From 300, Four platter sizes" with the Order button from after the first screen; 360x640 looked at
R3f.7 pass: the bottom bar fits at 360x640
R3a.6 pass: check-site PHONE clean; room kept for the bar
R3s.22 pass: check-site TAP clean on every page
R3s.23 pass: check-site PHONE clean on every page
R3t.1 pass: check-site CATEGORY clean: site-category food-shop on every page and in CONCEPT.md; the home page was set beside the food contact sheets (bestbean, theobroma, delice) in docs/inspo/awwwards-anatomy-2026-10-22/food: light ground, one colour panel per product, price and Add on every card
R3t.2 pass: check-site BUY clean (a price and an Order or Add control inside the first two screens); looked at every card: photo, name, price, button
R3t.3 n/a: trainer rule; this site is food-shop
R3t.4 pass: the same footer on all three pages: closing line, button, link columns, contact, MyIsraelRental line
R3a.7 pass: phones were emulated with touch (hasTouch, isMobile) at 390x844 for screenshots and check-site TAP and STATE
R3a.8 pass: no dotted line of items wraps at 360x640

## 9. Finish
R3r.3 pass: check-rules passed after the last edit; every script was re-run after the last change to the pages
R3r.4 pass: no new correction from Tzvi since the last build is missing from this file
R8.7 pass: gen/opening-film-v3-brief.md written before generating (steps approved by Tzvi 26 Oct, object list, start still gen/v3-start-empty-board.jpg from assets/opening-end.webp, which is matched to her photo); earlier: gen/platters-brief.md, gen/opening-film-brief.md, gen/opening-film-v2-brief.md (the dropped burst idea and why)
R3h.19 pass: gen/opening-film-v3-brief.md was written before generating with the steps (approved by Tzvi 26 Oct) and every object's start and end; start and end stills pinned (the empty board edited from assets/opening-end.webp, and opening-end.webp itself), one action (fruit falls in past the top edge and settles), one clip between them; the number of tries is not recorded
R3s.26 pass: check-site OVERLAP clean on every page at 1366x768, 1280x720, 1440x900 and 390x844, pinned scenes scrolled through (26 Oct 2026, run across all 45 pages by the lead session)
R3s.27 pass: scripts/check-same-place.mjs clean on index, shop and contact at 390x844 and 1440x900 (27 Oct): the four sizes on the one-at-a-time stage share one place for name, size and price; the shop's size boxes sit in one row of equal boxes
