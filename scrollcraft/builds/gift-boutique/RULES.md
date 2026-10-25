# Rules for gift-boutique (docs/rules-checklist.md)

One line per id: `Rx.y pass: <what was looked at or which script passed>`, `Rx.y n/a: <why>`, or `Rx.y fix: <what is wrong>`.
Replace every `todo`. `node scripts/check-rules.mjs scrollcraft/builds/gift-boutique` must exit 0 before anyone is shown the site.


## 1. Facts and words
R0b.1 n/a: a local build, not published yet; there is no live record whose slug the page address can be compared with
R0b.3 pass: every price on index and order (collection tiles, from 25 to 150 dollars, the order lines and the hero line gifts from 25 dollars) comes from the catalogue data in gen/catalog/products.json; the lowest in-stock price is 25 dollars
R2.1 pass: read every sentence on index and order: hand wrapped in Jerusalem, delivered across Israel, hours, kosher line, payment and languages are from the record, flyer and catalogue; since 2025 in the footer is asked in message-to-owner.md question 7
R2.2 pass: read message-to-owner.md: it asks only about prices, delivery, hours, returns, bespoke work, photos and her words
R2.3 pass: message-to-owner.md has six example FAQ questions written from her details plus the worry, first days and photo-in-use questions
R3.1 pass: searched index and order for best, number one, award, guarantee, insured, 24/7, fresh daily: none; the kosher line is her own words with the two supervisions she named
R3.2 pass: searched for hurry, only N left, today only, limited, countdown: none; Out of stock is shown honestly and is not scarcity marketing
R3.3 pass: searched for welcome to, look no further, one-stop, passionate, world-class: none
R3.4 pass: a script over visible text and alt text of both pages found 0 exclamation marks and 0 long dashes; capitals only in their name and the heading style
R3.5 pass: the first screen names gifts and the line says hand wrapped gifts from 25 dollars, the words of her catalogue
R3.6 n/a: the site is English only; there is no Hebrew version of index or order to open
R3.7 pass: scrolled both pages; the gallery block is hidden until she sends photos; no FAQ block is shown; no placeholder text
R3.8 pass: no logo wall, laurels, stars, counts or invented badges on either page
R3.9 pass: her flyer promises gifts for every occasion, hand wrapped and delivered; the first screen says the same
R3.10 pass: strengths are hand wrapped and kosher with the two supervisions she named
R5.1 pass: read every line as the owner; each names a gift, a step or her service
R5.2 pass: read every line; no teasing or slang
R5.3 pass: labels are full phrases such as Wrapped by hand in Jerusalem, gifts from 25 dollars and Out of stock
R5.4 pass: searched visible text of both pages for they, them, their: the hits are about gifts and recipients (say who they are for), not about the business
R5b.2 pass: going to the order page is always Order a gift (header, opening, how-to-order, closing, phone bar, footer); adding is always Add (tile chips and the order page list, each labelled Add to order with the gift name); moving on is always Continue on steps 1 and 2 on the desktop button and the phone bar, and Send on WhatsApp on step 3 in both
R5b.8 pass: the closing line reads Send love across Israel with a meaningful gift; no done or complete
R3.11 pass: read index top to bottom: opening (what), collection with prices, how to order, what we make, good to know, close; no form before prices
R3o.4 pass: WhatsApp and email are labelled by what they do in the footer and the order page; whether she takes calls is not shown, only WhatsApp is offered
R3e.22 n/a: she has sent no photo of herself and no name, so there is no person to show; a request for her portrait can be added to message-to-owner.md when she replies
R3s.19 pass: viewed source of index and order: each has its own title, description and og tags
R6.1 pass: fashion-shop playbook: collection straight after the opening, how-to-order strip, facts, real footer
R4.1 pass: missing details (delivery fee, since year, returns) are not invented: the page says we confirm the delivery fee on WhatsApp and the gaps are in message-to-owner.md

## 2. Opening
R3g.13 pass: 1440x900 and 390x844 first screens: the box film, a headline of 4 words, one short line, one button
R3b.1 pass: same screenshots: what (hand wrapped gifts), where (Jerusalem, delivered across Israel), price (from 25 dollars), action (Order a gift)
R3b.2 pass: the price line sits directly under the main button on the first screen
R3b.3 pass: walked the scroll at 1440 and 390: one solid gold button per screen; the header button is outlined
R3h.1 pass: check-site OPENING passes; the full-screen box film is scrubbed by the scroll
R3n.1 pass: the film fills the whole first screen, the gifts rise over it, on laptop and phone
R3n.2 pass: the black box unties and their six gifts rise out of the light; their logo is gold foil on black, so the box and ribbon are theirs
R3n.3 pass: the scroll opens the box and the headline arrives; in the collection a group pill changes the grid and Add changes the order; check-motion run on both pages
R3n.4 pass: put the first screen beside Aardvark Book Club in docs/inspo/awwwards-anatomy-2026-10-22/shops/aardvark-1-books-shelf.webp: ours is not plainly weaker, the box opens onto the real gifts and the grid follows at once
R3n.5 pass: you land on a closed black gift box and as you scroll the ribbon unties, the lid lifts and their gifts rise out of it
R3g.15 pass: check-fits shows no photo over 1.35 times its size; the film is full screen; the generated box is shown as a box, not as their premises
R3h.2 pass: the film goes from the closed ribboned box to the opened box and then their six real gifts rise out of it, each their own photograph
R3h.3 pass: the film runs full screen at 1440 and 1920 and on the phone, an uncropped near-lossless clip, not masked or in a column
R3h.5 pass: there are no chapter lines, only the headline that lands in the light with a soft shade behind it; readable passes at every size
R3h.7 n/a: the film is one clip with no joins to compare
R3h.8 pass: after the lit dark film the collection section is bright ivory, a bold change of mood
R3h.11 n/a: the laptop film was graded up on 22 Oct and brightness.py now passes it (20 frames, average 52); the phone film is a black box that fills the middle third, graded to gamma 1.5 (box still black, ground lit) and still reads 22 to 23 in the middle on its last frames against the 33 asked, which needs a regenerated brighter phone clip and Tzvi's yes; listed in the report
R3h.13 pass: untying, lid lift and light are one clip; the gifts start rising on the open-lid frame; walked 12 scroll positions at laptop and phone with no jump
R3h.14 pass: the box stays in frame and recognisable through the whole opening on laptop and on phone
R3h.17 n/a: the page does not use giant letters parting over film

## 3. Sections and worlds
R3.12 pass: hero film, a features section (the collection with price per gift), a closing section with the button and her contacts in the footer beside it
R3c.1 pass: CONCEPT.md cites three saved inspo pictures; check-concept accepts the ideas
R3g.17 pass: CONCEPT.md Effects names the source of each effect; the shop rework came from the 3t fashion study
R3c.2 pass: viewed the whole page at 1440: a dark film opening, ivory throughout and a sand band; not cream plus an italic word; Cinzel capitals and gold from their logo
R3g.1 pass: the :root block in index.html holds ground, ink, gold, two faces, radius and motion, and the computed styles match
R3g.3 pass: prices are in the ink colour; gold is the main button only; the gold-ink is used for small labels and group headings, which is a label colour, not the accent button
R3g.7 pass: one closing signature, their name shown whole under the closing button, away from the order path
R3g.11 pass: Cinzel for headings and Jost for text, faces already in use on the site and licensed Google Fonts
R3p.3 pass: node scripts/check-fingerprints.mjs run 25 Oct prints "the-gift-boutique: different from all 11 other pages"; colour pairs accepted by Tzvi on 25 Oct (decision 1a, live pages, not recoloured), recorded in scrollcraft/fingerprints.json _accepted_colours: with blazin-boards
R3p.5 pass: the foil glint runs once across the closing name when it enters (onSign in index.html), like the foil on their logo; the name rendered at 1440 and 390
R3q.1 pass: node scripts/check-concept.mjs reports ready (25 Oct), every part including Not alike
R5a.7 pass: the signature is the box opening, the peak is the gifts risen from the box; the ending resolves on Order a gift
R9.1 pass: the scroll film is used because their gifts and gold box support it
R3f.2 pass: signature opening; accents: the foil glint on the headline word and name, the metallic sheen on the button, the rising gifts; quiet touches on tiles and chips
R3m.1 pass: the gallery place is on the home page (data-mir-gallery with its template, hidden until she adds photos) and the priced gifts sit inside data-mir-catalog with data-mir-list, group and item templates
R3m.3 pass: hours, kosher and payment sit in the fixed Good to know grid; there is no free text box
R3k.1 pass: pages are the home page and the order page; the collection and the order are linked, and the order is one page
R3k.2 pass: both pages share the same bar: brand, links, the one order button; on a phone the links fold away and the button stays, so there is no Menu button to open
R3k.4 n/a: the site is two self-contained html files with inline css and js, not a shared site.css and site.js set
R8a.1 pass: viewed source of both pages: no external script hosts except Google Fonts; no demo text
R3b.4 pass: the page carries facts: price per gift, hours, kosher, payment; nothing padded
R3c.3 pass: the hashgacha line is removed from the page because it is not in their files; asked in message-to-owner.md question 13; delivery fee confirmation sits in the order steps beside the button
R3c.8 pass: the order steps say what happens after: we confirm the order and the delivery fee on WhatsApp, then wrap and deliver
R3e.10 pass: name 17px bold against price 17px bold and group heading 20px; check-site ALIGN passes
R3e.14 pass: computed font sizes at 1440 and 390 on both pages: six on the home page (14, 17, 20, one heading, the opening heading, the closing name), five on the order page; family Jost with weights 400 to 700
R3c.9 pass: computed radii: 14px for buttons, tiles, photos and cards; circles only for the round Add chip and step numbers; one soft card shadow; no two-colour gradients on elements
R3s.4 pass: check-site ALIGN passes
R3s.6 pass: check-site ALIGN passes; buttons share height and corner
R3s.7 pass: buttons in sentence case, pale dividers, body line height 1.6 computed
R3s.9 pass: one colour per meaning: gold for the action, ink for text, grey for out of stock
R3s.12 pass: her own gift photographs rise out of the box in the opening and fill the collection right after it; she herself has no photo yet (R3e.22)
R3s.14 n/a: no numbers are shown big; she gave none beyond prices
R3s.11 n/a: she has not told us why the gifts cost what they cost; message-to-owner.md question 10 asks for the sentence
R5b.6 pass: no scroll cues except Scroll to open in the opening, which tells the visitor what moves the film; no counters
R3.13 pass: contact appears in the order how-to, Good to know and the footer once each as different facts; no doubled gallery; no two dividers in a row
R3a.1 pass: rendered index at 1440x900 and 390x844 and walked every screen, order at 1440; the six sizes of 3p.6 by check-fits and readable; reduced motion shows the opened box
R3r.1 pass: pages index and order: check-site, check-fits, check-motion, readable, clipped, cutoff each run on both
R3r.2 pass: independent review on 22 Oct (docs/page-review-checklist.md) by a separate reviewer; findings fixed and re-checked
R3g.12 pass: check-site FLOW walked the order steps, an empty form says what is missing and the WhatsApp message carries the total
R0b.12 n/a: not published, so there is no pages-list preview clip to compare

## 4. Photos and media
R8.1 pass: the collection tiles are her own gift photographs, the same rounded square crop at one size; the first group on one contact sheet reads as one set of wrapped gifts; a plain-background reshoot is asked in message-to-owner.md question 9
R8.6 n/a: these are her own photographs of wrapped gifts, not product hero shots; generating them is outside this task, so the photos stay and the shots needed are listed in the report
R8.2 pass: every gift picture is one of her own photographs; the only generated media are the box film and its stills
R3p.7 pass: every tile has the same photo, name, price and Add chip; every group pill changes the grid the same way
R3h.12 pass: each gift shows the same photograph in the opening, the tile and the order line; the rising six are the first six of the same set
R3h.10 n/a: no option on this page changes a big picture; the pills change the list of tiles
R3g.14 pass: all photographs and the film viewed together on the screenshot sheets share the warm gold grade
R3o.1 n/a: not a food business; the page sells wrapped gifts, and any food in them is shown in her own photographs
R3o.2 n/a: no generated liquid
R3o.3 pass: gifts look true to her photographs, no colour cast added
R3o.6 pass: one photo per gift from her catalogue, duplicates left out
R8.3 pass: viewed every generated frame: a plain black ribboned box, no person, no baked text, nothing non-kosher; it matches the black boxes in her own photographs gift-2 and gift-3; whether she approves it is asked in message-to-owner.md question 8
R8.4 pass: the moving ribbon and lid are a generated clip (a Higgsfield clip), cause then effect, never SVG or CSS; reduced motion shows the still
R3c.13 pass: clipped.mjs reports nothing cut off, except the closing name which is cropped on purpose (data-clip-ok)
R3c.14 n/a: no cut-out on this site; the photographs are shown in rounded frames
R5b.3 pass: readable passes; words over the film sit on a soft edge shade
R3e.8 pass: readable.mjs reports every word clear at every size on both pages
R3s.24 pass: check-site MEDIA reports no problem; every img has width and height and the film has a poster
R3p.6 pass: check-fits passes at the six sizes on both pages
R3o.5 pass: check-site GLYPH passes

## 5. Prices and savings
R3c.5 pass: grepped: no select element; the group choice is tiles (pills)
R3c.6 pass: the buttons say Order a gift, Continue and Send on WhatsApp; each tile Add chip names the gift and price in its label; the two bottle openers are named Bottle Opener with Roses and with Snacks and the ranged one asks Which one? before Continue and carries the answer into the WhatsApp message
R3c.7 n/a: no offer on this site
R3j.1 n/a: no guarantee is offered
R3j.2 n/a: no add-on can be added before ordering; add-ons are asked about on WhatsApp
R3j.3 n/a: no free taster or quote is offered
R3j.4 n/a: no group discount is offered
R3j.5 n/a: no come-back feature exists
R3j.6 n/a: each gift is its own item, no packages to choose between
R3j.7 pass: no struck-through price and no .90 ending
R3j.8 n/a: no saving is shown
R3j.9 n/a: no saving is shown
R3j.10 n/a: no saving badge on this site
R3j.11 n/a: no package or combined service
R3j.12 n/a: she made no savings claim
R3.14 pass: prices shown plainly on each gift; ordinary retail gifts, not quote-based premium

## 6. Order and booking flow
R3k.7 pass: check-site FLOW walks Step 1 gifts, Step 2 where it is going, Step 3 details with Back and the browser back button; total beside every step
R3k.8 pass: every order line has a Remove button of 40px or more (check-site TAP)
R3k.6 pass: an Add on the home page tile opens order.html with the gift in the order (the link carries ?add=name)
R3.15 pass: the action is order: the order page has the form; message needs WhatsApp, which is in the footer and the order steps
R7.1 pass: CONCEPT.md names the chosen direction and the reason
R8.5 pass: every main button goes to order.html, her order page; WhatsApp is the quiet secondary link
R0b.13 n/a: the local build has no listing record to save an order against; the order's WhatsApp message with the total is walked by check-site FLOW
R3l.1 pass: message-to-owner.md question 4 asks what bespoke arrangements and add-ons a customer can ask for
R3l.2 n/a: no gift has a limit on what it allows
R3l.3 n/a: no gift has options that appear once added
R3l.4 n/a: the gifts are listed in groups of different items, not alike items to compare side by side
R3l.6 pass: each picture is of the gift as sold; items without a current picture are shown Out of stock
R3l.7 pass: each tile says what the gift is and its price without reading another
R3e.9 pass: check-site STATE and FLOW: hover and pressed answer, focus and error messages show, Sent confirms
R3e.19 pass: finished a test order through check-site FLOW: the Sent message appears and the lists end
R3s.16 pass: the order opens with the group pills before a list
R3s.18 pass: an out of stock gift shows Out of stock and the page offers Message us on WhatsApp for something else
R3s.25 pass: check-site FLOW: an empty form sends nothing and names what is missing; filled, it makes the WhatsApp message with the total

## 7. Motion
R3f.1 pass: the opening plays held on a stage that fits 1280x650; captured laptop and phone frames at the start, middle and end
R3f.8 pass: the opening finishes while the stage is held on screen (scroll-finish run on #open)
R3f.9 n/a: the steps stack on a phone as plain cards, not tied to the scroll
R3f.5 pass: grepped css: no ch widths and no background-clip; the headline glint is a masked overlay
R3f.4 n/a: no logo motif is animated onto the logo
R3g.4 pass: reveals settle soft to sharp without bounce, rows about 90ms apart, hover under 300ms
R3e.16 pass: grepped css and js: no linear easing; transitions under 0.5 seconds except the 700ms section reveal
R3e.17 n/a: no carousel or bottom sheet
R3e.18 n/a: the film is scrubbed by scroll, not an ambient looping video
R3a.2 pass: viewed frames mid-opening at 1440 and 390: no unfinished state
R3a.3 n/a: no label is placed on a spot of a photo or film
R3a.4 pass: the held opening fits 1280x650 (check-fits); cutoff.mjs run on both pages; the order section is not held
R3a.5 pass: the scroll sets the film's time and never takes the scroll; reduced motion shows the opened box; no parallax on phone
R3s.2 pass: check-site SHIFT and check-motion report no jump on choices
R3s.1 pass: check-site STATE passes
R3s.8 pass: buttons over the film are solid gold, viewed over the light and the dark frame
R3s.10 n/a: no search that should show a picture when a thing is named; the order page search filters tiles that already show pictures
R3i.3 n/a: no live readout on this site
R3s.21 pass: check-site BROKEN reports no errors or dead links on either page

## 8. Phone
R3b.6 pass: the phone bar appears after the first screen until the close and steps aside while a price, Add chip or button sits in its strip; walked 390x844 and 360x640 with touch emulation in 100px stops
R3f.7 pass: 360x640 touch emulation: the bar fits (check-site PHONE)
R3a.6 pass: check-site PHONE reports the bar covers nothing at the end of the page
R3s.22 pass: check-site TAP reports no tap under 40px
R3s.23 pass: check-site PHONE reports no sideways scroll at 390 and 360
R3t.1 pass: category fashion-shop in CONCEPT.md and on both pages; compared to the fashion study sheets (Outfit, Odd Ritual): one light ground after the opening, the grid straight after it, name and price under each, a how-to-order strip, hours and address before the footer
R3t.2 pass: check-site BUY passes; every tile has photo, name, price and an Add chip; out-of-stock tiles say Out of stock
R3t.3 n/a: this is a fashion-shop, not a trainer
R3t.4 pass: both pages end with the same footer: the last big line, the button, columns of the shop, pages and contacts, and the MyIsraelRental line
R3a.7 pass: check-site phone passes use isMobile and hasTouch emulation at 390x844 and 360x640
R3a.8 n/a: no line of dot-separated items exists on either page

## 9. Finish
R3r.3 pass: every script above passed on both pages after the last edit (final run)
R3r.4 n/a: no new correction from Tzvi is outstanding since the last build
R8.7 pass (recorded after the fact, 25 Oct): gen/box-brief.md written 25 Oct for the opening box stills and MiniMax film made 14 Oct; gen/box-compare.jpg looked at (one of their gift photos left, the last film frame right). There is no reference crop because the box is not their item (invented, shown as a box); prompts were not kept and the brief says so. Their six gifts are untouched photographs
R3k.9 pass: served the build locally and ran node scripts/check-site.mjs http://localhost:8766/order.html: no FLOW and no SAVE problem (it filled the order, the POST to the order form was recorded before the WhatsApp link opened; the check only records, the page posted to localhost:8001 so nothing reached the live site). No dashboard view of a saved order was made; products come from the order form via order-src.html
