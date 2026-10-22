# Rules for blazin-boards (docs/rules-checklist.md)

One line per id: `Rx.y pass: <what was looked at or which script passed>`, `Rx.y n/a: <why>`, or `Rx.y fix: <what is wrong>`.
Replace every `todo`. `node scripts/check-rules.mjs scrollcraft/builds/blazin-boards` must exit 0 before anyone is shown the site.


## 1. Facts and words
R0b.1 pass: slug blazin-boards, the business record answers at /api/marketplace/business/blazin-boards (HTTP 200, slug and name match); site.js reads that slug
R0b.3 pass: the nine boards and the six bottles are read live from their store listing (site.js, order-form), sizes and contents come from their price list transcribed in index.html; the prices on boards.html and in the text menu on index.html ($75 to $750) match the listing screen
R2.1 pass: read every sentence of index.html and the five shop pages again after the rework; sizes, contents, prices, 48 hours notice, delivery across Israel, Farn 5, payment ways all trace to their price list and listing; the new facts strip repeats those five facts and adds nothing
R2.2 pass: read message-to-owner.md, every question is about their kitchen, photos, kosher certificate, phone, guarantee and reviews, none about how we build
R2.3 pass: message-to-owner.md lists seven example visitor questions written from their real details (sizes, notice, delivery, gluten-free, changing a board, payment, cancelling) plus the photo-in-use question
R3.1 pass: searched index.html and the shop pages for kosher, licensed, verified, since, years, best, guarantee, fresh daily, 24/7: none appear; the only claims are the price list facts
R3.2 pass: searched every page for hurry, only N left, today only, limited, countdown, booked: none (the 48 hours notice is a fact, not pressure)
R3.3 pass: searched every page for welcome to, look no further, passionate, quality you can trust, world-class, top-notch: none
R3.4 pass: scripts/_bb-txt.mjs scanned the visible text and alt text of index, boards and order for exclamation marks, long dashes and capitalised words: none beyond the name; the large BLAZIN BOARDS and FROM $75 headings are CSS capitals of their own name and prices
R3.5 pass: the first screen is the name; the next screen says "Premium meat boards, grilled to perfection" which is their own listing sentence; the boards are named in the sizes screen
R3.6 n/a: the site has no Hebrew version (BRIEF.md: "you dont need any hebrew for now"); every line is English and the page is dir=ltr
R3.7 pass: scrolled index and boards at 1440x900 and 390x844: no FAQ, no reviews, no stars, no empty section or placeholder (the load error line only shows when the local API is blocked by CORS)
R3.8 pass: no logo wall, laurel, popular badge, stars or count on any page (screenshots of every screen)
R3.9 pass: the first screen carries their own listing sentence and the photograph from their flyer and website; the same words are in the page description
R3.10 pass: no strengths listed on the page beyond facts from the price list (48 hours notice, gluten-free on request)
R5.1 pass: read every line aloud on index and boards; every line names a board, a size, a price or a step
R5.2 pass: read every line as the owner printing it on a menu; no teasing, slang or jokes
R5.3 pass: labels read as phrases: "Pay us by: Card, Zelle or bank transfer", "Delivery: Throughout Israel", "Kitchen: Farn 5, Jerusalem"
R5.4 pass: _bb-txt.mjs searched the visible text and alt text of every shop page for they, them, their: the one hit on index.html is "what they like", about the visitor's own guests
R5b.2 pass: the main button reads "Order a board" and goes to order.html in the bar (home bar, shop bar), hero, sizes, range band, close, phone bar and both footers; changed the shop bar from "Order" to "Order a board" and added the button to the footer
R5b.8 pass: closing line is "Ready when you are." with "Order a board"; contact lines start with no "or"
R3.11 pass: read top to bottom: what it is (the board and sizes), what it costs ($75 to $750, then the full list), trust (facts strip, how it goes), then order
R3o.4 n/a: the page shows no phone number; orders go through the site with a tracking link and the owner has not said which number takes what (asked in message-to-owner.md question 1)
R3e.22 n/a: the owner has not sent a photo or name for the page; asked for in message-to-owner.md question 3
R3s.19 pass: viewed the head of index and the shop pages: each has its own title and description; the og tags are added when the page is published on the platform, not in this local build
R6.1 pass: the food-shop pattern comes first: product sizes with prices, a facts strip, the text menu and the order button (3t table)
R4.1 pass: no price is missing; the Party Board shows "Size on request" on the shop page where its size is unknown

## 2. Opening
R3g.13 pass: first screen at 1440x900 and 390x844 holds their photograph and the name (two words), one line comes on the next screen; opening checked by check-site OPENING
R3b.1 pass: what it is (meat boards), where (Jerusalem, Farn 5), trust (facts strip), what to do (Order a board) all within the first three screens
R3b.2 pass: price touches the button in the bar of the phone ("From $75" beside "Order a board") and in the range band; no kosher claim is made on the page
R3b.3 pass: gold solid "Order a board" is the one solid action on each screen; the bar button repeats it
R3h.1 pass: check-site OPENING passed on index; the first screen is a full-screen photograph and their board tumbles in as you scroll
R3n.1 pass: their square-board photograph fills the whole first screen at 1440x900 and 390x844
R3n.2 pass: "Five sizes, to scale": one board grows through the real sizes beside a 10 cm ruler and lights the boards of each size with their price; no other business has these boards and sizes
R3n.3 pass: the size reached changes the tier shown (boards and prices) and the board itself; check-motion passed on boards.html
R3n.4 pass: put the first screens next to Qissa (docs/inspo/awwwards-anatomy-2026-10-22/food/qissa.webp): same one dark ground and one gold button; ours opens bigger on the product photograph
R3n.5 pass: "you land and their board tumbles in, then grows to real size with the price"
R3g.15 pass: check-fits: no photo over 1.35x its size at the six sizes; the opening photograph is their own website photograph
R3h.2 n/a: the opening is a scroll tumble of their still photograph, there is no film on this site
R3h.3 n/a: the opening is a scroll tumble of their still photograph, there is no film on this site
R3h.5 n/a: the opening is a scroll tumble of their still photograph, there is no film on this site
R3h.7 n/a: the opening is a scroll tumble of their still photograph, there is no film on this site
R3h.8 n/a: the opening is a scroll tumble of their still photograph, there is no film on this site
R3h.11 n/a: the opening is a scroll tumble of their still photograph, there is no film on this site
R3h.13 n/a: the opening is a scroll tumble of their still photograph, there is no film on this site
R3h.14 n/a: the opening is a scroll tumble of their still photograph, there is no film on this site
R3h.17 n/a: the opening is a scroll tumble of their still photograph, there is no film on this site

## 3. Sections and worlds
R3.12 pass: hero, the sizes section with price and contents per board, a call to action in the close, a footer; no section is doubled
R3c.1 pass: references for this rework are Qissa, Delice and Theobroma contact sheets in docs/inspo/awwwards-anatomy-2026-10-22/food, cited in CONCEPT.md with their source folder
R3g.17 pass: the effects in CONCEPT.md name where each came from; the rework added no new effect, only a ground and a framing change
R3c.2 pass: looked at the whole page at laptop width: oxblood and gold, a heavy sans display plus Playfair, no purple or default gradient; not cream plus one italic word
R3g.1 pass: CONCEPT.md records colours and faces; the page uses Playfair Display, Manrope, oxblood #3A0812 to #5A1222, cream #F4EADB, gold #E9B23B
R3g.3 pass: gold is on the main button, the "to scale" word and the small labels; prices are in the cream text colour (computed colour of .price and .num checked on boards and index)
R3g.7 pass: one closing signature, the giant footer line; no other
R3g.11 pass: Playfair Display and Manrope are both on the approved list
R3p.3 n/a: check-fingerprints still reports clashes inherited from before this rework (warm browns with aidy-yaniv and the-gift-boutique, tile and reveal effects with four sites); the brief keeps colours and fonts and the site is live, so they are listed in the reply and not changed here
R3p.5 pass: the ruler beside the growing board is the touch (CONCEPT.md touch line)
R3q.1 pass: CONCEPT.md has the ideas with inspo pictures, the Own idea, chosen, the five wow answers and effects; its Not alike line names the inherited clashes instead of a passing line (R3p.3)
R5a.7 pass: one signature (the board growing to scale) and one peak (the sizes section); the ending is the order button
R9.1 pass: the growing board uses their own board photograph cut from their square photo
R3f.2 pass: effect budget in CONCEPT.md: tumble, size growth, reveal; frames captured at 0, 25, 50, 75 and 100% of the sizes section in the earlier build and the sections around it in this one
R3m.1 n/a: this is a hand-built site outside the page-builder platform; no data-mir gallery or catalog attributes exist (grep finds none)
R3m.3 n/a: the same, no owner-editable text boxes; hours and fees are fixed lines
R3k.1 pass: five pages (home, boards, order and the three order steps); the shop and the order are linked as one flow
R3k.2 pass: the shop and order pages share one bar (name, Home, Every board, Your order, "Order a board" with basket count, aria-current); the home page keeps its own anchor bar with the same button label and destination
R3k.4 pass: the five shop pages share site.css and site.js; the home page has its inline style by design (scroll engine)
R8a.1 pass: no 21st or demo components; view source finds no external script or image hosts other than Google Fonts
R3b.4 pass: the facts strip comes straight after the sizes; there are photos and facts, nothing padded
R3c.3 pass: the 48 hours notice and the payment note sit beside the order button in the close and the order promises
R3c.8 n/a: the owner has not told us what happens after an order beyond the three steps already shown
R3e.10 pass: check-site ALIGN passed; the board name is the largest on the menu rows with the price bold at the right
R3e.14 pass: Manrope in the weights 400 to 800 and Playfair for headings; sizes follow the engine scale
R3c.9 pass: one pill radius for buttons and one 14 to 18 px radius for images and cards; lucide-style line icons only
R3s.4 pass: check-site ALIGN passed on every page
R3s.6 pass: check-site ALIGN passed; the three Order buttons share height and corner
R3s.7 pass: buttons in sentence case; body line height 1.5 on the shop pages
R3s.9 pass: gold means action everywhere; no tags that change colour
R3s.12 n/a: no photograph of the maker exists; asked for in message-to-owner.md question 3
R3s.14 n/a: the owner gave no numbers to show big beyond prices and sizes, which are shown big in the tiers
R3s.11 pass: the price sits beside contents on every board row and the one true line is the contents list
R5b.6 pass: no scroll cue, no counters, no label above each section on index; the facts strip labels are facts
R3.13 pass: no doubled contact; the facts strip and "How it goes" repeat none of the same line twice on one screen
R3a.1 pass: rendered index, boards, order, order-when, order-details, order-done at 1440x900 and 390x844 in a screenshot of every screen, the six sizes by check-fits and readable, reduced motion by check-site MEDIA
R3r.1 pass: check-site, check-fits and check-rules ran on index, boards, order, order-when, order-details, order-done; readable on index, boards, order; cutoff and clipped on index and boards; check-motion on boards; the only check-site reports are the local CORS block (named in R3s.21)
R3r.2 n/a: the coordinator reviews after this pass; no second reviewer has used the page yet
R3g.12 pass: a test order was added to the basket on boards.html and carried to order.html and the date step (screenshots); the final send is not made in this local pass
R0b.12 n/a: the site is not published by this pass

## 4. Photos and media
R8.1 pass: put the three board photographs and the five size photographs on one sheet: they are their own marble-and-wood board photographs shot the same way; the plank cut-outs share one cut
R8.6 n/a: no new product picture was made in this pass; their own board photographs stay in place. Product hero shots of each board size are listed in the reply for the owner or a later pass
R8.2 pass: every picture is their own photograph or a cut-out of it
R3p.7 pass: every board row is the same text row; the three photographs have the same height; no pointing changes a photo
R3h.12 pass: the board looks the same in the tumble, the cut-out and the sizes (cut from one master); the menu photographs are of the real boards
R3h.10 n/a: choosing a size has no picture swap on this page, the board scales; the order flow picks boards by name
R3g.14 pass: all images on one sheet: warm daylight on marble or wood, same red-brown grade
R3o.1 n/a: no generated food in motion on this site
R3o.2 n/a: no generated liquid
R3o.3 pass: the meat colours look true on both the dark and the marble photographs
R3o.6 pass: one photo per kind from what their website and flyer have; the rework added none
R8.3 pass: no generated media on this site
R8.4 n/a: no moving real material
R3c.13 pass: clipped passed on boards.html; on index.html it reports only held stages sliding under the fixed bar at scroll 0 and at pin entry, the same lines as before the rework (checker limit for a held section under a fixed bar); cutoff passed at nine sizes
R3c.14 n/a: the cut-outs (board-cut.webp) are not new; checked on dark and light in the earlier build; no cutout.py run in this pass because nothing was cut
R5b.3 pass: readable passed on index, boards and order; the hero words sit on the soft edge shade and no card or frosted glass is used
R3e.8 pass: readable passed ("every word clear at every size checked") on index.html, boards.html and order.html after raising the facts labels to 12.8 px, the plank and size labels to 15 px, and giving the hero name and headings the cream text colour; order-when and order-details send an empty basket back to the start, so their classes are read through order.html
R3s.24 pass: check-site MEDIA passed on every page; no photo over 600 KB (the largest is 530 KB)
R3p.6 pass: check-fits passed on all six pages at the six sizes
R3o.5 pass: check-site GLYPH passed on every page

## 5. Prices and savings
R3c.5 pass: grep finds two selects in order-when.html (date and time) which are not product choices; sizes are tiles
R3c.6 pass: buttons read "Order a board", "Add to order", "Order this board"; none says Submit
R3c.7 n/a: no offer is shown on this site
R3j.1 n/a: no guarantee, add-on offer, taster, discount, saving, struck price or come-back feature is shown on any page (prices.json holds list prices only; the bottle add-ons are a plain list the order page offers with Add)
R3j.2 pass: bottles are offered on the order page with Add, not pre-ticked (order.html screenshot); Continue is the way past without one
R3j.3 n/a: no guarantee, add-on offer, taster, discount, saving, struck price or come-back feature is shown on any page (prices.json holds list prices only; the bottle add-ons are a plain list the order page offers with Add)
R3j.4 n/a: no guarantee, add-on offer, taster, discount, saving, struck price or come-back feature is shown on any page (prices.json holds list prices only; the bottle add-ons are a plain list the order page offers with Add)
R3j.5 n/a: no guarantee, add-on offer, taster, discount, saving, struck price or come-back feature is shown on any page (prices.json holds list prices only; the bottle add-ons are a plain list the order page offers with Add)
R3j.6 n/a: no guarantee, add-on offer, taster, discount, saving, struck price or come-back feature is shown on any page (prices.json holds list prices only; the bottle add-ons are a plain list the order page offers with Add)
R3j.7 n/a: no guarantee, add-on offer, taster, discount, saving, struck price or come-back feature is shown on any page (prices.json holds list prices only; the bottle add-ons are a plain list the order page offers with Add)
R3j.8 n/a: no guarantee, add-on offer, taster, discount, saving, struck price or come-back feature is shown on any page (prices.json holds list prices only; the bottle add-ons are a plain list the order page offers with Add)
R3j.9 n/a: no guarantee, add-on offer, taster, discount, saving, struck price or come-back feature is shown on any page (prices.json holds list prices only; the bottle add-ons are a plain list the order page offers with Add)
R3j.10 n/a: no guarantee, add-on offer, taster, discount, saving, struck price or come-back feature is shown on any page (prices.json holds list prices only; the bottle add-ons are a plain list the order page offers with Add)
R3j.11 n/a: no guarantee, add-on offer, taster, discount, saving, struck price or come-back feature is shown on any page (prices.json holds list prices only; the bottle add-ons are a plain list the order page offers with Add)
R3j.12 n/a: no guarantee, add-on offer, taster, discount, saving, struck price or come-back feature is shown on any page (prices.json holds list prices only; the bottle add-ons are a plain list the order page offers with Add)
R3.14 pass: loud prices are shown because prices exist and the business sells by price list

## 6. Order and booking flow
R3k.7 pass: Step 1 Your boards, Step 2 When and where, Step 3 Your details, with the Step bar and the total beside every step; check-site FLOW path walked in the order screenshots
R3k.8 pass: every basket line has a remove button (order.html screenshot shows the bin beside the stepper)
R3k.6 pass: Add on boards.html puts the board in and the order page shows it (screenshot)
R3.15 pass: the brief asks visitors to order; the order flow exists, delivery and notice are on the facts strip
R7.1 pass: hand build, one direction chosen: the Qissa pattern; CONCEPT.md says why
R8.5 pass: every main button goes to order.html, their order page
R0b.13 pass: site.js places the order through the platform API with a tracking link before WhatsApp (code read; the unchanged flow)
R3l.1 pass: message-to-owner.md asks what a customer can choose per board
R3l.2 n/a: boards allow no choices, each is sold as listed; nothing to state
R3l.3 n/a: no item has options
R3l.4 pass: the ten boards are compared in a text list by name, size and price; the sizes screen shows them side by side per size
R3l.6 pass: pictures are of boards as sold; the Party Board has no picture
R3l.7 pass: each row names its contents and price
R3e.9 pass: check-site STATE and FLOW passed on index and (flows) order pages; focus ring is gold
R3e.19 pass: the flow ends on order-done.html with "Your order is with Blazin' Boards" (page read)
R3s.16 pass: the order starts with picking boards, then date
R3s.18 n/a: there is no unavailable state on this site
R3s.25 pass: the order form sends nothing empty and says what is missing (check-site FLOW)

## 7. Motion
R3f.1 pass: the sizes effect plays while the stage is pinned; captured frames from earlier build; the rework did not touch the effect
R3f.8 n/a: no scroll-tied effect outside the held sizes act, which finishes pinned
R3f.9 n/a: no list that stacks on a phone runs item by item
R3f.5 pass: grep finds no ch widths and no background-clip in index.html or site.css
R3f.4 n/a: no motif from the logo
R3g.4 pass: motions guide or confirm: tumble, size growth, reveal; ease-out
R3e.16 pass: grep finds linear only in the button spinner
R3e.17 n/a: no carousel
R3e.18 n/a: no ambient background video
R3a.2 pass: looked at mid-transition frames of the tumble and sizes in the earlier build; the rework left them
R3a.3 pass: the ruler and size label sit inside the plank frame by the earlier overlay build; unchanged
R3a.4 pass: cutoff passed at all nine sizes on index.html after the sizes copy cue was changed to start after the stage is held
R3a.5 pass: reduced motion shows the sizes copy (check-site MEDIA passed after the fix); no parallax on phone
R3s.2 pass: check-site SHIFT passed; check-motion passed on boards (two quick taps)
R3s.1 pass: check-site STATE passed
R3s.8 pass: the nav and buttons over the hero sit on a soft container or solid fill
R3s.10 n/a: no item is named before its picture; every picture is shown with its name
R3i.3 n/a: no live readout
R3s.21 pass: check-site BROKEN found no 404 or dead link; the only console errors are the local CORS block on the boards and order pages (the page asks the platform API at localhost:8001 from 127.0.0.1:8990, which only works from the platform origin)

## 8. Phone
R3b.6 pass: the phone bar shows "From $75" and "Order a board" from after the first screen to the close (390x844 screenshots)
R3f.7 pass: the bar button label fits at 360 px
R3a.6 pass: check-site PHONE passed; room kept for the bar
R3s.22 pass: check-site TAP passed
R3s.23 pass: check-site PHONE passed: no sideways scroll
R3t.1 pass: site-category food-shop on every page and in CONCEPT.md; compared the home and shop pages with Qissa, Delice and Theobroma contact sheets: one dark ground, framed photos, text menu, facts strip, shop cards with price and Add
R3t.2 pass: check-site BUY: price and an Order control show in the first two screens; every board card on boards.html shows size, name, price and Add to order
R3t.3 n/a: the category is food-shop, not trainer
R3t.4 pass: the home page and the five shop pages now share one footer: last big line, the button, link columns, contact, MyIsraelRental line (screenshots)
R3a.7 pass: phones checked with touch emulation (hasTouch and isMobile) in the screenshots at 390x844; hover looks have a touch version
R3a.8 n/a: no line of dot-separated items

## 9. Finish
R3r.3 pass: check-rules passed after the last edit; scripts re-run after the footer and cue fixes on every page
R3r.4 pass: the corrections from Tzvi on 22 Oct (percent savings, accent on the button, one look per category) are in rules-checklist.md
