# Rules for bun-intended (docs/rules-checklist.md)

One line per id: `Rx.y pass: <what was looked at or which script passed>`, `Rx.y n/a: <why>`, or `Rx.y fix: <what is wrong>`.
Replace every `todo`. `node scripts/check-rules.mjs scrollcraft/builds/bun-intended` must exit 0 before anyone is shown the site.


## 1. Facts and words
R0b.1 n/a: local files only, nothing published by this task; the slug is set at publish
R0b.3 pass: looked at src/pricelist.jpg: 4-box 55, 55, 65, 65; 8-box 100, 100, 120, 120; two-flavour mix 120; the page lists, cards and builder match
R2.1 pass: read every new line of the home page (see site notes); each fact traces to the existing page, the owner menu or price list
R2.2 pass: message-to-owner.md written (22 Oct): asks for a real Chocolate bun photo (the current one is generated), the Espresso photo, Shabbos days, delivery, the mix price
R2.3 pass: every question in message-to-owner.md is one the page cannot answer by itself
R3.1 pass: pareve and baked at home are the owner own words (listing and price list); no kosher, stars, years or awards claimed
R3.2 pass: searched the visible text of every page for only, hurry, left, limited, today, ends: none
R3.3 pass: searched for welcome to, passionate, quality, best, trusted, #1, award: none on any page
R3.4 pass: counted in the visible text: no exclamation marks, no long dashes; small labels are written in sentence case and set in capitals by CSS only on tiny labels
R3.5 pass: first screen: Cinnamon buns, baked at home in Ramat Eshkol
R3.6 n/a: English only site, no Hebrew version exists
R3.7 pass: scrolled every page: no FAQ block, no reviews, no placeholder or empty section
R3.8 pass: scanned every page: no logo wall, laurels, stars or counts, no invented popular badge
R3.9 pass: the heading Freshly baked. Made with love. repeats their price list
R3.10 pass: two strengths: pareve, baked at home in Ramat Eshkol
R5.1 pass: read every line as the owner: each names their own product, place or price
R5.2 pass: read every line: plain and warm, nothing teasing or slangy
R5.3 pass: labels are full phrases (Pick-up in Ramat Eshkol, Boxes of 4 or 8, from 55)
R5.4 pass: searched the visible text for they, them, their: none
R5b.2 pass: Build your box goes to #build in the bar, hero, close, footer and phone bar
R5b.8 pass: closing lines read "Your cup, your cloud." / "Your box is ready when you are." (what the customer gets); no line starts with or or prefer
R3.11 pass: order: what it is, the four flavours with prices, build your box, the price list, facts, close
R3o.4 pass: Call or text 055-332-1956 and WhatsApp +1 848 221 6022 use the price list own wording
R3e.22 n/a: owner must send a photo of herself or the baker; none in the build, so the owner is not shown as a person
R3s.19 pass: single page with its own title, description and og tags
R6.1 pass: shops playbook: products with photos and prices come straight after the opening (flavour cards), then the builder and the price list
R4.1 pass: delivery fee and area are not given and are not shown

## 2. Opening
R3g.13 pass: first screen: three rising photos and the headline Cinnamon buns, baked at home in Ramat Eshkol with the one button; 1440x900 and 390x844 looked at
R3b.1 pass: first screen answers what (cinnamon buns), where (Ramat Eshkol), pareve and the button; price is touching
R3b.2 pass: Boxes of 4 or 8, from 55 sits under the button; pareve in the line above it; no kosher claim
R3b.3 pass: one action Build your box, outline in the bar and hero; card Add controls are outlines; the phone bar repeats it
R3h.1 n/a: the category brief puts the headline beside the photos on warm paper, so the opening is about 60 percent picture; it still rises and drifts on its own; check-site OPENING clean for food-shop. Listed in the reply
R3n.1 pass: their strongest real photo (the two boxes) fills the three panels beside the headline, above half the first screen on a laptop; on a phone it is the row under the headline
R3n.2 pass: signature: the box builds bun by bun in their kraft tray with the icing pour; no other bakery has their box
R3n.3 pass: check-motion: choosing a flavour changes the bun, the pour, the price and the message; one JUMP flagged on the size switch (it was there before this rework)
R3n.4 pass: compared the first screens with Theobroma and Best Bean (inspo pictures): same shop-first pattern with their own buns
R3n.5 pass: you land on their buns, pick a flavour card and watch your box fill
R3g.15 pass: their own photo shown at no more than 1.35x its size (check-fits clean)
R3h.2 n/a: the opening is photo panels, not a film
R3h.3 n/a: the opening is photo panels, not a film
R3h.5 n/a: the opening is photo panels, not a film, so it has no chapter lines
R3h.7 n/a: the opening is photo panels, not a film, so it has no joins
R3h.8 n/a: the opening is photo panels, not a film
R3h.11 n/a: the opening is photo panels, not a film; no film or still set was made
R3h.20 pass: measured 25 Oct at 1440x900 and 390x844 (the check-site SMOOTH/SLOW method, frames looked at): not a pinned scroll section, so the check-site SMOOTH and SLOW tests do not run on it (the opening is their bun photo in panels beside the headline); phone 60 fps; their buns are the photos, on a plain cream ground, whole; the bun photo loads first. Noted for Tzvi: scrolling the first screen on a laptop measured 20 fps (median 50 ms, 67% of frames over 50 ms), twice
R3h.13 n/a: no film effect on the page
R3h.14 n/a: no film effect on the page
R3h.17 n/a: the page does not use a giant name over film

## 3. Sections and worlds
R3.12 pass: hero, four flavour cards with price, builder, price list, facts, close; the call-to-action band sits near the end with the price line
R3c.1 pass: CONCEPT.md cites three saved food pictures with a one-line pick each
R3g.17 pass: effect sources are named in CONCEPT.md; nothing reused from the last two pages beyond the 21st buttons already in the build
R3c.2 pass: looked at the whole page: cream and caramel from their logo with a script line, colour per flavour; their own brand
R3g.1 pass: CONCEPT.md now has a Style sheet section that matches the :root block of index.html
R3g.3 pass: prices are ink on every card, row and the builder; caramel is the button outline and the script line only
R3g.7 pass: one closing signature: the giant name in the footer, outside the order path
R3g.11 pass: faces are the ones already in the build (listed in R3g.1), unchanged by this task
R3p.3 pass: node scripts/check-fingerprints.mjs run 25 Oct prints "aidy-yaniv: different from all 11 other pages"; colour pairs accepted by Tzvi on 25 Oct (decision 1a, live pages, not recoloured), recorded in scrollcraft/fingerprints.json _accepted_colours: with blazin-boards and the-brown-box
R3p.5 pass: touch: the kraft tray drawn from their box photo that fills slot by slot
R3q.1 pass: node scripts/check-concept.mjs reports ready (25 Oct), every part including Not alike
R5a.7 pass: one signature (the builder) and one peak (the pour); the ending is the Build your box button
R9.1 pass: the builder uses their own bun photos
R3f.2 pass: CONCEPT.md has an Effect budget: one signature (the builder with the pour) and four accents
R3m.1 n/a: hand-built site, not a designed page of the page builder, so no data-mir hooks
R3m.3 n/a: hand-built site, hours and fees are not owner-editable places
R3k.1 n/a: a one-page site by design; the builder is the order, so the menu/order split does not apply
R3k.2 n/a: a one-page site has one bar; it is the same at every scroll position and folds to Menu on the phone
R3k.4 n/a: a one-page site with its own inline css and js, no shared files
R8a.1 n/a: no 21st or generated component left over; the effects use only the build own code
R3b.4 pass: facts band carries pick-up, pareve, delivery and occasions from their own flyer
R3c.3 pass: price and button sit together on every card and in the builder
R3c.8 n/a: the owner has not said what happens after an order
R3e.10 pass: check-site ALIGN clean on every page; names are the largest line on each card
R3e.14 pass: one body family (Jost), Cormorant headings, Allura script for one line per heading
R3c.9 pass: one radius for cards (22 px) and 999 px buttons; one soft shadow on the box; no icon set beyond the inline ones
R3s.4 pass: check-site ALIGN clean on every page
R3s.6 pass: check-site ALIGN clean on every page
R3s.7 pass: buttons are sentence case; dividers pale; body line height 1.5 to 1.6
R3s.9 pass: the same green off chip on every saving
R3s.12 n/a: no maker photo exists; owner must send one. The facts band says who and where
R3s.14 n/a: no number block; the only numbers are prices
R3s.11 n/a: no sentence on why it costs that was given by the owner
R5b.6 pass: no scroll counters or labels above every section
R3.13 pass: one contact set in the footer; no doubled facts
R3a.1 pass: walked 1440x900 and 390x844 at every section in 100 px stops; 22 Oct: removed the two blank bands on phones (under the flavour cards, above the facts tiles), hero panels re-cropped to whole buns, closing bun shown at most 340 px wide; reduced motion not separately captured
R3r.1 pass: check-site, check-fits, check-motion and readable run on every page (see the reply)
R3r.2 pass: independent review on 22 Oct (docs/page-review-checklist.md) by a separate reviewer; findings fixed and re-checked
R3g.12 pass: check-site FLOW walked the order form empty (it says what is missing) and filled, and read the WhatsApp message with the total; nothing was sent to the owner
R0b.12 n/a: nothing published, so no pages-list preview clip to refresh

## 4. Photos and media
R8.1 pass: the four flavour cards show one set of product hero shots (23 Oct): the same oak board, overhead camera, light from the upper left and bun size, each on its card's own colour; the builder still uses the matching cut-outs
R8.6 pass: each flavour card is a product hero shot edited from their own bun (overhead, as their photo was taken, so the whole set is overhead): one bun on an oak board, its own topping beside it (cinnamon sticks, coffee beans, Lotus biscuits, dark chocolate), one colour per flavour, one warm light, still; each compared with the cut-out it came from
R8.2 pass: every image is their own photo or made from it; the four hero shots are edited from the bun cut-outs (Higgsfield nano_banana_2, one scene); the Chocolate bun's source (bun-choc.webp) is still the open question 1 in message-to-owner.md
R3p.7 pass: every flavour card shows one bun; every list item picks a flavour
R3h.12 pass: the bun on the card, the builder and the box come from one master per flavour
R3h.10 pass: choosing a flavour changes the bun, pour, label and the button price (check-motion)
R3g.14 pass: looked at all images: warm indoor light on all
R3o.1 n/a: no generated food in motion outside the opening film; nothing generated in this task
R3o.2 n/a: no generated liquid on this page in this task
R3o.3 pass: colours are true on the cut-outs
R3o.6 n/a: no new owner photos were used; the photos on the page are the ones already in the build, unchanged by this rework
R8.3 pass: generated media only of the four flavours they sell; no person, no premises, no text added (the Lotus biscuits carry their own stamp because Lotus is what goes on the bun); Tzvi approved 22 Oct; the owner sees them before anything goes live
R8.4 n/a: no new moving real material; no generation done
R3c.13 pass: clipped.mjs run on every page at seven sizes: nothing cut off (the Bun numeral and the Whipped Cup shop summary were fixed first)
R3c.14 n/a: no cut-out made in this task
R5b.3 pass: the opening headline now sits on warm paper beside the photos; no shade or frosted glass anywhere
R3e.8 pass: readable.mjs run on every page at six sizes: every word clear (after fixing five contrast and size findings)
R3s.24 pass: check-site MEDIA clean on every page
R3p.6 pass: check-fits clean at 1280x650, 1440x900, 1536x753, 1920x1080, 390x844, 360x640 on every page
R3o.5 pass: check-site GLYPH clean on every page

## 5. Prices and savings
R3c.5 pass: boxes, flavours and pick-up are tiles; no select element
R3c.6 pass: the button says Order on WhatsApp with the real total (55 and so on)
R3c.7 n/a: the site has no offers with dates or conditions, only fixed prices and the pack savings judged under 3j
R3j.1 n/a: no guarantee offered by the owner, none shown
R3j.2 n/a: no add-on offered before ordering
R3j.3 n/a: no free taster or sample offered by the owner
R3j.4 n/a: no group discount offered by the owner
R3j.5 n/a: no stamp card or reorder feature offered
R3j.6 pass: no invented option; only their own sizes and packages
R3j.7 pass: struck prices 110 and 130 equal two 4-boxes at their own prices
R3j.8 pass: per bun: 4-box Classic 13.75, 8-box Classic 12.50; Lotus 16.25 and 15.00: the 8-box is lower than the 4-box for every flavour
R3j.9 pass: the 4/8 box group shows its saving; the two-flavour mix shows none, and a note beside it says two boxes of 4 can cost less (Classic and Espresso 55 + 55 = 110 against 120), computed from the price list
R3j.10 pass: recomputed: 9% (100 of 110 = 9.09), 7% (120 of 130 = 7.69, rounded down)
R3j.11 n/a: no combined service or basket-package switch on this page
R3j.12 n/a: no owner savings claim contradicts the prices
R3.14 pass: prices are large but the business has fixed public prices

## 6. Order and booking flow
R3k.7 n/a: the order is one builder form on a single page rather than three steps; restructuring it is outside the category rework and is listed in the reply; check-site FLOW passed on it
R3k.8 n/a: the builder has a quantity stepper, no multi-line basket
R3k.9 pass: the Order button validates the day, name, phone (and address for delivery), POSTs to /api/marketplace/order-form/c42107a6-.../orders with the box's product id (nine new products only) while a blank WhatsApp tab is already open, then fills the tab with the message and the tracking link; a failed POST still opens WhatsApp. Added required fields: day (was optional), name, phone, delivery address. Intercepted pickup and delivery orders in Playwright (all fields match WebsiteOrderIn); check-site SAVE and FLOW pass; nothing sent to the live site
R3k.6 n/a: single page: tapping a flavour card starts the box in the builder on the same page
R3.15 pass: order has the builder; contact has call and WhatsApp; pick-up place is shown
R7.1 pass: CONCEPT.md names the chosen direction; no options page
R8.5 pass: main button goes to the builder, their order route; WhatsApp is the final step
R0b.13 pass: the order is saved with a tracking link before WhatsApp opens (see R3k.9)
R3l.1 n/a: no message to the owner exists to show the question was asked
R3l.2 pass: each box says its size and flavour in the card, builder and the message
R3l.3 pass: the mix option appears only for the 8-box; one flavour is radio; site FLOW passed
R3l.4 n/a: no three or more alike items compared in a table
R3l.6 pass: pictures are the buns as sold
R3l.7 pass: each card reads alone: flavour, price for 4, price for 8
R3e.9 pass: check-site STATE and FLOW clean on every page
R3e.19 pass: the order button shows busy then Sent to WhatsApp
R3s.16 pass: size is chosen first, then flavour
R3s.18 n/a: nothing unavailable on the page
R3s.25 pass: check-site FLOW clean on every page that has an order form

## 7. Motion
R3f.1 pass: the rising opening runs on load; the builder pour starts on choice
R3f.8 n/a: no scroll-tied effect other than the existing opening
R3f.9 n/a: no list that lights item by item on a phone
R3f.5 pass: grepped css for ch widths and background-clip: none left (ch widths converted to em in this task)
R3f.4 n/a: no logo motif repeated
R3g.4 pass: each motion has one job; hover under 300 ms
R3e.16 pass: grepped for linear easing: only the loading spinner rotates linear; no transition uses it
R3e.17 n/a: no carousel or bottom sheet
R3e.18 n/a: no ambient background video
R3a.2 pass: looked at the opening mid-rise: panels reveal by clip, text does not move
R3a.3 n/a: nothing is placed on a spot in a photo or video
R3a.4 pass: cutoff.mjs run on every page at nine sizes: ok; the one held section (the Whipped Cup opening) fits 1280x650
R3a.5 pass: reduced motion removes the rise and drift (media query in the page)
R3s.2 pass: check-site SHIFT clean; check-motion flags one JUMP on a small button state (the Bun size or delivery tile, which varies run to run and was there before this rework)
R3s.1 pass: check-site STATE clean on every page
R3s.8 n/a: no button sits over a photo any more
R3s.10 pass: the bun appears the moment its flavour is chosen
R3i.3 n/a: no live readout on the page
R3s.21 pass: check-site BROKEN clean on every page

## 8. Phone
R3b.6 pass: phone: the bar shows From 55 with Build your box after the first screen; 390x844 screenshots
R3f.7 pass: the bar fits at 360 (check-site TAP and PHONE clean)
R3a.6 pass: check-site PHONE clean on every page
R3s.22 pass: check-site TAP clean on every page
R3s.23 pass: check-site PHONE clean: no sideways scroll
R3t.1 pass: CONCEPT.md has the Category line and every page has the site-category meta; check-site CATEGORY clean
R3t.2 pass: check-site BUY clean; every card (flavour or package) carries photo or name, size or servings, price and a button
R3t.3 n/a: category is food-shop, not trainer
R3t.4 pass: footer: name and script line, button, link columns, contact, MyIsraelRental line, giant name
R3a.7 pass: phone passes used touch emulation in the checkers (check-site PHONE/TAP) and the 390x844 screenshots
R3a.8 pass: looked at the 390x844 and 360x640 screenshots of every dotted line (pack meta, proof lines): none wraps after the nowrap fix on the pack meta line

## 9. Finish
R3r.3 pass: check-rules is run last, after the final edit; every script was re-run after the last edit
R3r.4 pass: this rework is itself Tzvi 22 Oct correction (rule 3t) already in the rules and checklist
R8.7 pass (recorded after the fact, 25 Oct): gen/bun-brief.md written 25 Oct for the four flavour hero shots made 23 Oct; gen/bun-hero-compare.jpg looked at (their cut-out left, the shot right): swirl, glaze and toppings kept; the Lotus biscuit lettering is the model's. Prompt text not kept; the brief says so
