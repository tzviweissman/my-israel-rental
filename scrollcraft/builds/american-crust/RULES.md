# Rules for american-crust (docs/rules-checklist.md)

One line per id: `Rx.y pass: <what was looked at or which script passed>`, `Rx.y n/a: <why>`, or `Rx.y fix: <what is wrong>`.
Replace every `todo`. `node scripts/check-rules.mjs scrollcraft/builds/american-crust` must exit 0 before anyone is shown the site.


## 1. Facts and words
R0b.1 n/a: local build only, nothing published; the slug is american-crust from the live record (src/record.json) and is set at publish
R0b.3 pass: listed every price: bagel dough 30 and pizza dough 27 on index, shop and bar against the record products (ids c071ddf18cff and f0651cac7342) and the flyers; names tidied only by comma and capital (see R3k.9)
R2.1 pass: read every sentence of the three pages; each traces to the record, the flyers (p02, p04, p05, p06) or the task facts: Boil. Bake. Brag., 6 bagels, 2 personal pies (500 g), Premium quality, Fresh and ready to use, Pareve, three stores, Ramat Eshkol, cash or Zelle, the one FAQ
R2.2 pass: read message-to-owner.md: lead time, delivery fee and days, store pick-up, shelf life, instructions, flavours, certificate, FAQ, photos and name; nothing about tools, and nothing the record already answers
R2.3 pass: message-to-owner.md has seven example questions written from their details (shelf life and freezer, Friday and Shabbat, delivery fee, pick-up, boil and bake, what one order makes, events), plus the first-days and photo-in-use questions
R3.1 pass: searched every page: Premium quality, Fresh and ready to use and delivery are their own flyer words; no stars, years or awards; the hechsher is the record kosher_certification body Rabbi Akiva Dershowitz and the certificate image is asked for in message item 11; ESTD 5786 is on their logo and in the footer from the record founded year
R3.2 pass: searched for only, hurry, left, limited, ends, countdown: none; Get yours today is their own closing line and offers no deadline
R3.3 pass: searched for welcome to, look no further, one-stop, passionate, world-class, top-notch, trusted: none
R3.4 pass: searched visible text and alt text: no exclamation marks (their flyer ones became full stops), no long dashes; capitals only in their name and ESTD from their logo; the one small shop label is sentence case, set in capitals by CSS
R3.5 pass: first screen: Boil. Bake. Brag. is their own line; the line under it names the bagel and pizza dough and the delivery area; the cards under it name both doughs
R3.6 n/a: English only site, the record languages are English and no Hebrew version was asked for
R3.7 pass: scrolled every page: the FAQ holds only their one question and answer; no reviews, no founder block, no placeholder; the owner gallery place is hidden until they add photos
R3.8 pass: scanned every page: no logo wall, laurels, stars, counts or popular badges
R3.9 pass: first screen against the flyers: Boil. Bake. Brag., the American dough, delivery in Ramat Eshkol, both prices; the page repeats the flyer promise
R3.10 pass: two strengths shown, both their own words: Premium quality and Fresh and ready to use; Pareve (their word) with the hechsher named
R5.1 pass: read every line as the owner: each names the dough, the stores, the price or the delivery; none could be printed by a competitor
R5.2 pass: read every line: plain and direct, no jokes or teasing
R5.3 pass: labels are full phrases: Pareve, hechsher from Rabbi Akiva Dershowitz; Find us in; Makes 2 personal pies (500 g); delivered in Ramat Eshkol, Jerusalem
R5.4 pass: searched visible text of every page for they, them, their: none; the page speaks as we and our
R5b.2 pass: Order goes to shop.html#order in the header bar, phone bar and closing band on every page (outline in the header, solid in the bar and band); the Add buttons are the cards add action, a different job, labelled Add
R5b.8 pass: closing line is Get yours today from their own flyer, what the customer gets; no line starts with or or prefer; the contact lines say what each number does
R3.11 pass: order follows the visitor: their line and the one-line description, both doughs with prices and Add, where to find them, what you bake, delivery payment kosher, the FAQ, the close
R3o.4 pass: contacts labelled: WhatsApp +1 732 503 1703 and Text or call +972 55 336 2730 in the close band and on the contact page; the flyer says Whatsapp 732.503.1703 and Text/Call 055.336.2730 so no number-purpose question is open
R3e.22 n/a: the owner sent no name or photo; asked in message items 13 and 14, so the owner is not shown as a person yet
R3s.19 pass: view source: each page has its own title, description, og:title, og:description and og:image (og.webp, a crop of their flyer products); the home page and the shop show the same two doughs and prices
R6.1 pass: food-shop playbook: products with prices lead (cards on the first screen), then where to find us, what you bake, delivery and kosher facts, FAQ
R4.1 pass: missing data is not shown or invented: no fee, lead time, hours, owner story or instructions; each is a numbered question in message-to-owner.md

## 2. Opening
R3g.13 pass: 1440x900 and 390x844 first screens: one picture (the ring), the headline Boil. Bake. Brag. (3 words), one short line (their description plus where we deliver, so no separate place label), and the two cards below; the header Order is outline and the Add buttons are the cards
R3b.1 pass: first screen answers what (American bagel and pizza dough), where (Ramat Eshkol, Jerusalem), trust (their own line and flyer words) and what to do (Add on each card)
R3b.2 pass: the prices touch the Add buttons on each card; kosher is stated once on the home page (delivery band tile), once on the shop (facts line) and not on the contact page: at most two per page
R3b.3 pass: first screen: the header Order is outline, the two Add buttons are the only solid actions, one per card with the same label; the phone bar and closing band repeat Order
R3h.1 n/a: food-shop sells from the first screen (3t): the opening shares the screen with both product cards, so the ring is about 13 percent of the 1440x900 first screen, not 70. Something does happen (see R3n.5). Judgement call listed for Tzvi in the report
R3n.1 n/a: same reason as R3h.1: the strongest photo (the everything bagels) fills a 460 px ring and the left half of the kitchen section, not half the first screen, because both cards must be on the first screen. Listed for Tzvi in the report
R3n.2 pass: the ring: raw bagel dough drops in as Boil lands and their baked everything bagels wipe over it as Bake lands, then the basket counts what you will bake; only this business has those three words and those two pictures
R3n.3 pass: choosing the pizza dough turns the whole shop stage from mustard to black with its own photo, name, price and makes line (check-motion passes); the basket text and phone bar change with what is added
R3n.4 pass: compared the first screen with Best Bean Best Cup (docs/inspo/awwwards-anatomy-2026-10-22/food/bestbean-colour-per-product.webp) and the Mobbin Touchy Coffee shop cards: same buy-from-the-top pattern, ours adds an opening event; not plainly weaker
R3n.5 pass: you land and Boil. Bake. Brag. drop in word by word while their raw dough becomes a baked bagel in a ring; checked as frames every 150 ms for 4 seconds: raw dough ring with ripples, wipe to baked, settle, line fades in
R3g.15 pass: the opening uses their own photos at their own size (check-fits: no photo over 1.35x); the ring crop of the flyer render is shown at about 0.8x and the baked photo at 0.6x; nothing generated
R3h.2 n/a: no film: the opening is built in code from their own photos (no generation allowed on this task)
R3h.3 n/a: no film: the opening is built in code from their own photos (no generation allowed on this task)
R3h.5 n/a: no film: the opening is built in code from their own photos (no generation allowed on this task)
R3h.7 n/a: no film: the opening is built in code from their own photos (no generation allowed on this task)
R3h.8 n/a: no film: the opening is built in code from their own photos (no generation allowed on this task)
R3h.11 n/a: no film and no generated stills: every picture is the owner own photo
R3h.13 n/a: no film: the opening is built in code from their own photos (no generation allowed on this task)
R3h.14 n/a: no film: the opening is built in code from their own photos (no generation allowed on this task)
R3h.17 n/a: no film: the opening is built in code from their own photos (no generation allowed on this task)

## 3. Sections and worlds
R3.12 pass: hero (opening), features (the two cards and the kitchen section with Premium quality, Fresh and ready to use, Pareve), a closing call-to-action band with Order, the phone numbers and the giant name
R3c.1 pass: CONCEPT.md cites five saved inspo pictures plus two Mobbin searches and an Inspo recommend of 22 Oct; check-concept passes; the pick and reason are in Chosen
R3g.17 pass: CONCEPT.md names where each effect came from: effects library entries B9, L6, R5 and H4 and inspo pictures for T4 and P6, and fresh Mobbin and Inspo searches for the cards; the 21st search failed three times with a catalog error and is said so; nothing reused from the last two pages (check-fingerprints passes)
R3c.2 pass: whole page at 1440 wide: mustard, black and cream from their brand with condensed type, not cream with a serif and an italic word; the black stores and closing bands and the black pizza card are contrasting grounds
R3g.1 pass: CONCEPT.md Style sheet written before building; site.css follows it: mustard, black, cream, League Gothic and Barlow, 22 px radius
R3g.3 pass: the owner own look is mustard and black so mustard is the ground colour of the opening, cards and delivery band; the solid buttons are black with a cream label (mustard on black); prices are in the text colour (ink on light cards, cream on the black card) with a thin mustard line under; one emphasised word (Kitchen, underlined) on its screen
R3g.7 pass: one closing signature: the giant American Crust name cropped at the bottom of the black band on every page
R3g.11 n/a: English only site: League Gothic and Barlow are SIL Open Font License faces on Google Fonts without a Hebrew subset, so they are not on the approved Latin and Hebrew table; proposed for the table in the report
R3p.3 pass: check-fingerprints.mjs: different from all 9 other pages
R3p.5 pass: touch X30: the basket counts what you will bake from their own yields, Your basket bakes 12 bagels and 2 personal pies; seen working in the shop
R3q.1 pass: check-concept.mjs: concept ready for american-crust
R5a.7 pass: one signature: the ring; one peak: Brag. landing with the baked bagels; the ending resolves on the Order band
R9.1 pass: the ring uses only their own raw-dough crop and their own baked-bagel photo; nothing else moves
R3f.2 pass: effect budget: signature (the ring, plays on its own once), accents (cards tilt toward the mouse, the stage changes room colour, the basket counts what you bake), quiet touches (scale reveal, chip turns, marker link); all seen in the captured frames
R3m.1 n/a: the gallery place is on the home page (data-mir-gallery, hidden until the owner adds photos); the two product cards are not bound to data-mir-catalog because each card carries its own colour room which a generated list would drop. Listed in the report
R3m.3 pass: delivery and payment sit in fixed tiles and the FAQ in its own block; no free text boxes
R3k.1 pass: pages are index, shop and contact; the menu and the order are one page (shop.html); no old Menu or Order addresses exist to forward
R3k.2 pass: identical bar on all three pages: name to Home, Home Shop Contact with aria-current, the one Order button with the basket count; on a phone it folds into Menu and Close and closes on Escape or a link tap (kit site.js)
R3k.4 pass: one site.css and one site.js serve every page; the card info block is .info, the opening is .open, the reveal state is .in only on .rev, no shared state reuses a page class
R8a.1 pass: viewed the source: no 21st or generated component code was used (the search failed); no external script or image hosts except Google Fonts css
R3b.4 pass: few photos: facts carry the page (two cards, three stores, delivery and payment tiles); nothing padded
R3c.3 pass: worries answered where they arise: parve answered in the cards and the FAQ, delivery area and payment in the tiles and under the address field
R3c.8 n/a: the owner has not said what happens after the order; asked in message items 1 to 3
R3e.10 pass: cards read name (32 px), what it is, makes line, then the price big with Add; site ALIGN passes; the longest name wraps to two lines
R3e.14 pass: one body family Barlow in 400, 600 and 700; text sizes measured on all pages: 14, 16, 18 px body and 32, 48, 64 px display, plus the two set pieces (opening words, giant footer name); spacing in rem steps
R3c.9 pass: one radius (22 px cards, pill buttons), one icon style (round chips and thin line icons, drawn inline), one soft shadow on cards (3px down, 30px blur, dark tint at 12 percent), no gradients, no decorative arrows
R3s.4 pass: check-site ALIGN passes on all three pages
R3s.6 pass: check-site ALIGN passes; Add buttons share one size, the outline header button and menu share one height
R3s.7 pass: buttons in sentence case, pale dividers, no Price labels, body line height 1.6, contrast measured by readable.mjs
R3s.9 pass: one colour per meaning: black button, mustard chips and markers; the Pareve and hechsher marks use the same round mustard icon everywhere
R3s.12 n/a: no photo of the maker was sent (asked in item 13); the real product photos (their baked bagels and tubs) follow the opening
R3s.14 n/a: the owner gave no figures to show big; 6 bagels and 2 pies appear in the card lines and the basket line
R3s.11 n/a: the owner has not said why the dough costs what it does; asked in the FAQ list and item 6
R5b.6 pass: no scroll cue, no counters; the only label above a heading is the small Shop label on the shop stage
R3.13 pass: no doubled contact: the close band holds the numbers on the home and shop pages and the contact page shows them once in its tiles with a close band that has only the line and button; no empty dividers; the gallery is hidden, not under 3 photos
R3a.1 pass: walked 1440x900 and 1280x650 laptops plus 390x844 and 360x640 touch phones, all three pages, normal and reduced motion (check-site MEDIA), top to bottom in 100 px stops on phones; English only
R3r.1 pass: run on index, shop and contact after the last edit: check-site, check-fits, check-motion, readable, clipped, check-fingerprints, check-concept; cutoff is n/a (no held section)
R3r.2 fix: waiting for the independent reviewer
R3g.12 pass: walked the whole order with external requests blocked on a local page: basket from the home Add buttons, pizza stage, pick-up from Good Market, name and phone, and the WhatsApp message was read (items, total 84, pick-up store, day); the order POST fails here because no local API runs, and WhatsApp still opens; nothing was sent to the owner
R0b.12 n/a: nothing published yet

## 4. Photos and media
R8.1 n/a: the two products come from different sources (their flyer render of the bagel pack, their photo of the pizza tub), so they do not read as one shoot; both kept as honest crops until product hero shots are made, listed in the report
R8.6 n/a: no generation on this task: the pack and tub pictures are crops, the hero-shot candidates and their starting photos are listed in the report
R8.2 pass: every image is the owner own: p02 (bagel pack flyer render), p03 (everything bagels), p05 (tubs) and p01 (logo); nothing generated, no stock
R3p.7 pass: the two doughs are shown the same way on the card, the stage and the picker: photo, name, makes line, price, Add; tapping either picker changes the big photo
R3h.12 pass: each dough is the same object in the ring, card, stage and picker (one crop each); the baked-bagels and tubs-in-a-row photos are labelled as in use pictures, not the same item
R3h.10 pass: check-motion: choosing a dough switches photo, words, price and button smoothly
R3g.14 pass: all five photos are warm yellow and cream on one sheet; the black label tub photo is the coolest and sits on the black card
R3o.1 pass: no generated food anywhere; food is their real photos, the ring only moves them as whole photos
R3o.2 n/a: no generated liquid
R3o.3 pass: product colours look true: the dough is cream, labels black and mustard as on their flyer and tub
R3o.6 pass: one photo per kind from the numbered sheet: p01 logo, p02 flyer render crop, p03 everything bagels, p05 tubs; p04 and p06 repeat p02 artwork with other lines and are not used
R8.3 pass: nothing generated, no person, no made-up premises, no text baked in by us (the labels on their pack are in their photo)
R8.4 n/a: no moving real material
R3c.13 pass: clipped.mjs: nothing cut off at seven sizes on index, shop and contact
R3c.14 n/a: no cut-outs
R5b.3 pass: no text over photos except the small cream circle button on the stage photo; readable.mjs passes on every page
R3e.8 pass: readable.mjs: every word clear at every size checked on all three pages; button labels are ink on mustard or cream on black
R3s.24 pass: check-site MEDIA passes: every image has width and height, none over 600 KB (largest 185 KB), no video, nothing hidden with motion off
R3p.6 pass: check-fits.mjs: every section and photo fits at 1280x650, 1440x900, 1536x753, 1920x1080, 390x844 and 360x640
R3o.5 pass: check-site GLYPH passes: the shekel sign comes from Heebo, the arrow is drawn in CSS

## 5. Prices and savings
R3c.5 pass: choices are tiles (the two dough pickers, delivery or pick-up, the three stores); no select element; no popular badge
R3c.6 pass: Add on the stage says Add, with the number (Add, 30 shekels); the cards say Add beside the price; the step button names the next step and the last one names the day and the total
R3c.7 n/a: no offers
R3j.1 pass: no guarantee shown because none is offered; asked in message item 10
R3j.2 n/a: only two products, each already shown; no add-on that is not on the page
R3j.3 n/a: no taster or free offer
R3j.4 n/a: no group discount
R3j.5 n/a: no stamp card or reorder
R3j.6 n/a: only two products, no sizes to choose between
R3j.7 pass: no struck-through price, no .90 endings, no endorsement
R3j.8 pass: per unit: bagel dough 30 for 6 bagels is 5 a bagel, pizza dough 27 for 2 pies is 13.5 a pie; two different products, so no saving is shown
R3j.9 n/a: no saving exists
R3j.10 n/a: no saving exists, so no badge or struck price
R3j.11 n/a: no package or combined service
R3j.12 n/a: the owner made no savings claim
R3.14 pass: loud prices on a two-product food shop with fixed prices; both prices come from the record

## 6. Order and booking flow
R3k.7 pass: site FLOW passes: Step 1 basket, Step 2 delivery or pick-up and the day, Step 3 details, three-step bar, order and total beside every step, button names the next step then the total, Back, browser back goes back one step, each step checks only its fields
R3k.8 pass: every basket line has a 40 px bin button labelled Remove X from the basket beside its stepper; check-site TAP passes
R3k.6 pass: home Add buttons put the dough in the basket (localStorage) and the shop shows it with the total (walked: one bagel and two pizza gave 84)
R3k.9 pass: check-site SAVE passes: the order is POSTed through the order form of the listing 4ed30fc8 before WhatsApp opens, with the product ids c071ddf18cff (30) and f0651cac7342 (27), and WhatsApp still opens if the POST fails; the page names match the listing except the comma, the capital and the exclamation mark tidied; the saved copy in the owner dashboard can only be read after publishing because no local API runs
R3.15 pass: the brief asks visitors to order: the shop has the order; to ask: the contact page has both numbers
R7.1 pass: one direction picked: CONCEPT.md Chosen names the ring and why; no options page
R8.5 pass: every Order button goes to the order page (shop.html#order); WhatsApp is where the written order goes after the form and the quiet number on the contact page
R0b.13 n/a: the code carries the tracking link into the message when the POST returns one (as Chicken Munch does), but no local API runs here so a saved order was not read; to check after publishing
R3l.1 pass: message-to-owner.md item 8 asks what a customer can choose for each dough
R3l.2 n/a: two unlike products with no options on the listing, nothing to restate
R3l.3 n/a: no item has options
R3l.4 n/a: two items only
R3l.6 pass: each picture is the dough as sold now (their flyer pack and their tub photo)
R3l.7 pass: read each card alone: what it is, what it makes, the price, nothing else to choose
R3e.9 pass: check-site STATE passes (hover on every button), fields show focus and an error message, the Add button confirms with a toast and a turning chip, the send button shows busy while it saves
R3e.19 pass: a test order ended on Thanks, X. Your order is open in WhatsApp. Send the message there so we get it.; lists end
R3s.16 n/a: only two products and one question at a time per step already
R3s.18 n/a: nothing can be out of stock yet; every choice has both options visible
R3s.25 pass: check-site FLOW passes: an empty form sends nothing and names what is missing; filled, it sends a WhatsApp message carrying the shown total

## 7. Motion
R3f.1 pass: no scroll effect needs its subject whole: the opening plays on its own once at the top (viewed as frames) and the section reveals are quiet 5 percent scale-ups
R3f.8 n/a: no scroll-tied effect
R3f.9 n/a: no stacked list effect
R3f.5 pass: grepped site.css: no ch units, no background-clip; the key-word underline is a background stroke under the text
R3f.4 n/a: no logo motif is animated on the logo
R3g.4 pass: every motion has a job (words land, ring drops and wipes: show the process; chip turns and toast: confirm); nothing loops; text settles soft to sharp without bounce; hover transitions under 330 ms
R3e.16 pass: grepped: no linear easing; the opening runs about 3.5 seconds once, UI transitions are 160 to 600 ms with ease curves
R3e.17 n/a: no carousel or sheet
R3e.18 n/a: no background video
R3a.2 pass: frames every 150 ms through the opening: each state is a finished picture; the ring wipe and word landing never leave an empty panel
R3a.3 n/a: nothing placed on a spot in a photo
R3a.4 n/a: no held section
R3a.5 pass: no pinning or parallax; reduced motion shows the finished opening (check-site MEDIA passes)
R3s.2 pass: check-site SHIFT and check-motion pass (JUMP, FLASH, COLOUR, two quick taps)
R3s.1 pass: check-site STATE passes; hover and pressed states on every button
R3s.8 pass: the only button over a photo is a solid cream circle with a black border on the stage photo, readable on both photos
R3s.10 pass: the dough photo appears the moment a dough is picked
R3i.3 n/a: no live readout
R3s.21 pass: check-site BROKEN passes on all pages: no errors, no 404, no dead links between pages

## 8. Phone
R3b.6 pass: 390x844 and 360x640 touch emulation, whole scroll in 100 px stops: the bar (From 27 shekels and Order) appears after the first screen and is gone while the stage, the order form or the closing band is on screen so it never covers a price or button
R3f.7 pass: 360x640: the bar text fits and the Order button keeps its size
R3a.6 pass: check-site PHONE passes; no price or button under the bar at any 100 px stop (110 stops, 0 problems)
R3s.22 pass: check-site TAP passes: every tap target 40 px or more
R3s.23 pass: document scrollWidth equals the viewport at every 100 px stop on all pages at 390 and 360 wide
R3t.1 pass: category food-shop in CONCEPT.md and the site-category meta on every page; bright mustard ground, a colour room per product (mustard card, black card), buy from the first screen, short text; compared with Best Bean and Theobroma sheets
R3t.2 pass: check-site BUY passes; both cards have photo, name, makes line, price and Add
R3t.3 n/a: the category is food-shop
R3t.4 pass: footer on every page: giant name, the Order button, page links, contact (the contact page has it in its tiles), the MyIsraelRental line
R3a.7 pass: phones checked with touch emulation (isMobile and hasTouch) at 390x844 and 360x640; the hover-only tilt is mouse only and the cards read the same on touch
R3a.8 pass: no dotted line of items; checked the small label and facts at 360x640

## 9. Finish
R3r.3 pass: check-rules passes except R3r.2; every script passed on every page after the last edit
R3r.4 pass: the only new rule during this build (every order saved before WhatsApp opens) is already in the checklist as R3k.9 with check-site SAVE; no other correction was received
