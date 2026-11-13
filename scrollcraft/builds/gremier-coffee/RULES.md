# Rules for gremier-coffee, written from BLUEPRINT.md (scripts/blueprint.mjs --rules)

R0b.1 pass: built to the blueprint: slug gremier-coffee, read from the live record (src/record.json, fetch_business.py); folder gremier-coffee
R0b.3 pass: built to the blueprint: every price is from their own shop page at gremiercoffee.co.il, read 10 Nov 2026 (src/facts.md); the 19 products are in their live shop with these fixed ids since 12 Nov 2026 (gen/load_products.py, Tzvi: "Yes, load them")
R2.1 pass: built to the blueprint: every fact comes from src/record.json or their own site (src/facts.md); no since line, no counts, no reviews, no number of brewing hours (their site gives none)
R2.2 pass: built to the blueprint: OWNER-QUESTIONS.md asks only about their business, and nothing the record or their site answers
R2.3 pass: built to the blueprint: OWNER-QUESTIONS.md has seven example questions from their details (how long a bottle keeps, how much per guest, mix or not, strongest, setup, dispenser return, keeping lattes cold), and the worry and photo questions
R3.1 pass: built to the blueprint: Kosher, Rabbi Shmuel Weiner (their own site's footer words); a photo of the certificate is asked in OWNER-QUESTIONS.md; a food business; delivery words are theirs; no other claims
R3.2 pass: built to the blueprint: none on any page; read through; "Order by Wednesday, receive by Shabbat" is their standing delivery rule, not a countdown
R3.3 pass: built to the blueprint: none; every line names their cold brew, their coffees, their coffee bar or their own words
R3.4 pass: built to the blueprint: none in any line, read through; capitals only in names
R3.5 pass: built to the blueprint: the h1 says Cold brew & coffee bars, the two things their listing sells
R3.6 n/a: their record has no Hebrew description and the page is English only; Hebrew is listed in the report as not done
R3.7 pass: built to the blueprint: FAQ and gallery places stay hidden until the owner fills them; no reviews; nothing marked coming soon
R3.8 pass: built to the blueprint: none of these; "Most popular" on Classic and the sale prices are their own site's
R3.9 pass: built to the blueprint: their own line "Brewed for hours, not minutes" is under the headline, their tagline "Elevate every day" closes the page
R3.10 pass: built to the blueprint: two strengths in the story: brewed for hours not minutes, and beans chosen for cold brew, both their own words
R5.1 pass: built to the blueprint: their words first: brewed for hours, stock your fridge, make it a coffee bar, small bottles big favourites
R5.2 pass: built to the blueprint: plain and professional throughout
R5.3 pass: built to the blueprint: Kosher, Rabbi Shmuel Weiner; Order by Wednesday, receive by Shabbat; full phrases
R5.4 pass: built to the blueprint: visitor is you, the business is we or Gremier in labels, errors and alt text; searched for they, them and their about the business
R5b.2 pass: built to the blueprint: Shop cold brew on the header, opening, delivery card, closing band, phone bar and footer, all to shop.html
R5b.8 pass: built to the blueprint: the closing line is their own "Elevate every day."; the sent line says the order is open in WhatsApp to send
R3.11 pass: built to the blueprint: headline says what you get; order of the page: what it is (opening), trust (kosher band), what it costs (coffees, minis, jugs, bars with prices), what to do (how ordering works); no enquiry form
R3o.4 pass: built to the blueprint: WhatsApp (their site: "WhatsApp is the fastest way to reach us") and email; whether it takes calls is asked in OWNER-QUESTIONS.md
R3e.22 n/a: the record and their site name no person and show no photo of one; asked in OWNER-QUESTIONS.md; their story of the founder and direct WhatsApp are on the page
R3s.19 pass: built to the blueprint: the same promise and their coffee bar photo on the link preview (og.webp), home and shop; each page has its own title, description and og tags
R6.1 pass: built to the blueprint: the food shop lead block, product cards with price and Add, comes right after the opening and kosher band
R4.1 pass: built to the blueprint: delivery fees, coffee bar prices per guest count and the Basic bar are left out, said as "confirmed on WhatsApp", and listed in OWNER-QUESTIONS.md and gen/report.md
R3g.13 pass: built to the blueprint: picture, headline "Cold brew & coffee bars" (4 words), one line, one button; the three facts under the button are 3v.14
R3g.18 pass: built to the blueprint: two kinds, cold brew and coffee bar, both in the h1 (meta offers; check-says-offer passes)
R3b.1 pass: built to the blueprint: what: cold brew and coffee bars; where: delivered across Israel; trust: kosher and the prices by the button; next: Shop cold brew
R3b.2 pass: built to the blueprint: the prices touch the button; a kosher band sits just after the opening, not crowding the button; the certificate photo is asked
R3b.3 pass: built to the blueprint: one solid button on the first screen; the header button is the outline one; the phone bar repeats it
R3h.20 pass: built to the blueprint: the film runs 5.2 screens on a laptop and 4.6 on a phone, played as video tied to the scroll (film.js); every scene is on their own cream wall and oak
R3h.21 pass: built to the blueprint: only the opening holds the page; no other section holds the scroll
R3h.22 pass: built to the blueprint: one sketch sheet of rough drawings (gen/journey-sketch.png) approved by Tzvi ("yes looks good") before any photoreal still; only that concept was made
R3h.23 pass: built to the blueprint: every clip passed check-clip (C4's jump in its last frame is covered by the fade into their photo; the joined film passes); How it really happens and Key moment in gen/film-brief.md; each step ticked off on the 4 fps sheets
R3h.24 pass: built to the blueprint: played as real video tied to the scroll (data-video, every frame a keyframe, starter film.js); check-film-video
R3h.25 pass: built by the starter: the opening words leave as the film starts; the chapter words are small at the left edge on a laptop and on a small cream card in the tall phone film (at the bottom on the grinder and the ocean, at the top on the glass and the coffee bar), each only once its scene is on screen; the closing words come only once the last photo has landed, at the top over the pale columns on a phone (check-film-clear)
R3h.1 pass: built to the blueprint: opens on a full-screen film of their product being made, from beans to their own coffee bar
R3n.1 pass: built to the blueprint: the film fills the first screen on laptop and phone, ending on their own coffee bar photo
R3n.2 pass: built to the blueprint: the cold brew journey led by the scroll: beans, fine powder, the steep, the pour, the milk, their bar
R3n.3 pass: built to the blueprint: the coffee bar's place choice changes the photo and which bar the visitor sees; the steeping changes the opening as you scroll
R3n.4 pass: built to the blueprint: beside the Pinterest coffee site Tzvi sent (docs/inspo/pinterest-coffee-2026-11-11) and PULP (docs/inspo/videos-2026-11-07), ours tells the same kind of journey for cold brew, ending on their real bar
R3n.5 pass: built to the blueprint: you land as beans pour into a grinder under Cold brew & coffee bars, and scrolling follows them out as fine powder into a jar of cold water that steeps dark, over ice, milk swirling, out to their coffee bar
R3g.15 pass: built to the blueprint: the film is made for this business at 2K, ending on their own full-size photo; on a phone the last photo is their own photo whole on the cream ground, never a crop, with the closing words right above it
R3h.2 pass: built to the blueprint: the film goes from the beans to their real coffee bar and the Shop button, every step true to how cold brew is made
R3h.3 pass: built to the blueprint: full screen, 2K clips, 1920 video and 1680 frames, never shrunk or masked
R3h.5 pass: built to the blueprint: chapter lines are 4 to 7 words at the left edge on a soft shade, under a one-word chapter name (readable)
R3h.7 pass: built to the blueprint: each join checked on the 2 fps sheet; the C4 end jump covered by a 0.5 s fade into their photo
R3h.8 pass: built to the blueprint: the kosher band and the cards on cream follow the film's sunlit table
R3h.11 pass: built to the blueprint: stills and film are bright: their cream wall fills most of every frame; checked by eye on the 2 fps sheet (gen/film/opening-sheet.jpg)
R3h.13 pass: built to the blueprint: one cause and one result per clip: beans poured in, powder out; grounds in, the water darkens; tap poured, then milk; the camera pulls back
R3h.14 pass: built to the blueprint: each clip keeps its one object whole (the grinder, the jar, the glass); the phone crop is centred on it
R3h.18 pass: built to the blueprint: every object listed in gen/film-brief.md (Every object) with where it comes from and ends; the jar to dispenser and glass to bar joins are dissolves, said in the Clip plan
R3h.19 pass: built to the blueprint: the story was chosen first (the real way cold brew is made); each clip's start and end hold the same object (grinder, jar, glass); two tries at most
R3h.17 pass: built to the blueprint: the headline sits on the cream wall beside the grinder and leaves as the film starts; the chapter words take turns with the film
R3x.5 n/a: not a dark-world business; no following light
R3z.2 pass: built to the blueprint: three layers: the film at the back, the soft cream shade and words in the middle, the menu bar on top
R3z.6 pass: built to the blueprint: the h1 says cold brew and coffee bars; the line says delivered across Israel (search words: cold brew, coffee bar, Israel)
R3.12 pass: built to the blueprint: hero, features (one card per product with price and what is in it), call to action (delivery card and closing band), FAQ place, footer
R3c.1 pass: built to the blueprint: references kept with links in REFERENCES.md and CONCEPT.md (Blue Bottle, Onyx, Fellow, Mooala on Inspo; Assembly Coffee and Escape Cafe on Mobbin); one direction chosen with its reason
R3g.17 pass: built to the blueprint: every effect has its source in CONCEPT.md Effects: 21st Liquid Button, Mobbin Escape Cafe, docs/inspo bestbean colour per product, effects library L4
R3g.19 pass: built to the blueprint: the main buttons are the cold brew colour #3B0A02 from their Classic photo (meta product-colour, BRAND.md)
R3c.2 pass: built to the blueprint: not the AI look: no italic word, no gradient, no three identical cards in a row; Noto Serif and IBM Plex Sans; cream is the colour of their own photos' wall
R3g.1 pass: built to the blueprint: style sheet in CONCEPT.md before building
R3g.3 pass: built to the blueprint: the accent is only on the main buttons and the closing band; prices bold in ink
R3g.7 pass: built to the blueprint: one closing signature: the cold brew band with their line; no giant name
R3g.11 pass: built to the blueprint: Noto Serif (+ Hebrew) and IBM Plex Sans (+ Hebrew), both on the approved list, SIL Open Font License
R3p.3 pass: built to the blueprint: check-fingerprints: different from all 20 other pages; no shared heading face
R3p.5 pass: built to the blueprint: the basket count in a small round ring from their GREMIER badge
R3q.1 pass: built to the blueprint: CONCEPT.md complete; check-concept passes
R5a.7 pass: built to the blueprint: one signature (the journey film) and one peak; no other scroll section; the film ends on Stock your fridge and Shop cold brew
R9.1 pass: built to the blueprint: the film ends on their own coffee bar photo; their products are their own photos
R3f.2 pass: built to the blueprint: signature: the cold brew journey film. accents: the chapter words, the coffee bar place choice, the label stripe on cards. quiet: the coffee level rising in buttons, ring arrows on links, the brew line over headings, sale tags
R3m.1 pass: built to the blueprint: gallery place on the home page with its template; every product in data-mir-catalog with list, group and item templates on the shop
R3m.3 pass: built to the blueprint: FAQ, gallery and gift cards are the kit's fixed places; delivery words are fixed lines
R3k.1 pass: built to the blueprint: pages by kind: Home, Shop (all products and the order on one page), Contact
R3k.2 pass: built to the blueprint: one menu bar on every page with aria-current, Shop cold brew with the basket count; Menu on a phone
R3k.4 pass: built to the blueprint: shared site.css, site.js and gc.js on every page; section classes never reused for state
R8a.1 pass: built to the blueprint: nothing left from 21st: only the idea of the rising fill was taken, rebuilt in CSS; no demo text, no network calls
R3b.4 n/a: they have many photos; facts sit by the button and in the delivery card
R3c.3 pass: built to the blueprint: the worries the record answers sit where they belong: kosher after the opening, delivery days by the order steps, the dairy note on the lattes
R3c.8 pass: built to the blueprint: their site says what happens: order by Wednesday, receive by Shabbat, said on the home page and in the order step
R3e.10 pass: built to the blueprint: cards: name, then the price bold in ink with its size lighter, then Add
R3e.14 pass: built to the blueprint: IBM Plex Sans in 400 and 600; sizes from --t-1 to --t5; gaps on the --s scale
R3c.9 pass: built to the blueprint: one radius 14px for images and buttons, no icon set needed, one soft warm shadow
R3s.4 pass: built to the blueprint: one left edge per section (check-site passes)
R3s.6 pass: built to the blueprint: every Add is the same small button; chips and place pills share one shape
R3s.7 pass: built to the blueprint: buttons in sentence case, pale hairlines, no "Price:" labels, body lines 1.6
R3s.9 pass: built to the blueprint: one colour per meaning: each coffee's label stripe colour, the same wherever it appears
R3s.12 pass: built to the blueprint: their real products (the coffees) come right after the opening and kosher band, and their real coffee bars in real settings follow
R3s.14 pass: built to the blueprint: their real sizes shown big in the jugs section: 5 L in one jug, 15 L in three
R3s.11 pass: built to the blueprint: beside the bottle prices: "Pour it over ice, add milk if you like" and the story line "brewed in small batches and bottled fresh"; the jugs say the price per litre
R5b.6 pass: built to the blueprint: no scroll cues, counters or labels above sections
R3.13 pass: built to the blueprint: no doubled contact or facts; their own photos only; the gallery stays hidden until filled
R3a.1 pass: built to the blueprint: rendered at the six sizes by the checks, looked at on laptop and phone in the browser, reduced motion checked; English only
R3r.1 pass: built to the blueprint: check-build ran every script on every page
R3r.2 pass: built to the blueprint: review.md from a Sonnet subagent that did not build the site
R3g.12 pass: built to the blueprint: the order flow run to the end on laptop and phone with the save answered by a test route, never their inbox (gen/test_order.mjs)
R0b.12 n/a: not published; publish-page records the clip when Tzvi says yes
R3x.1 n/a: no product to turn
R3x.2 n/a: no counted number
R3x.3 n/a: no tabs for sizes
R3x.4 pass: built to the blueprint: the jugs (one and three) are listed with the same measures in the same order
R3x.11 n/a: no product to turn
R3z.1 pass: built to the blueprint: the delivery card (order by Wednesday, with its button) hangs over the top edge of the cold brew closing band
R3z.5 n/a: the site is on a light ground
R8.1 pass: built to the blueprint: every card photo is from their one sunlit oak-table shoot (same light, wall, table and angle); the coffee bar photos are their one event series
R8.6 pass: built to the blueprint: every product card is their own studio hero shot; the film's generated stills show only the making, never a product of theirs redrawn
R8.8 n/a: every product card is the owner's own photo from their site; no product picture set was generated
R8.9 pass: built to the blueprint: each card shows the owner's photo of that product (assets.py pairs each item with its own photo); the 6-pack card is six of their litre photos
R8.7 pass: built to the blueprint: gen/journey-brief.md and gen/film-brief.md were written before any paid still or clip: traits kept, only camera, light and setting described; each still compared beside their own photos; the orange steep and the white-appliance dispenser were made again
R8.2 pass: built to the blueprint: their own photos for every product and the film's last frame; the film's first stills (grinder, powder, jar, dispenser, glass) generated as one set from one style preamble (gen/journey_stills.py), since they have no photos of making it
R3p.7 pass: built to the blueprint: every bottle, mini and jug card shows one product in the same shoot at the same crop
R3p.8 n/a: the touch lives on the basket count, not on buttons
R3h.12 pass: built to the blueprint: each product has one photo used on its card, the sheet and the order; their bar in the film's last frame is their own photo
R3h.10 pass: built to the blueprint: the coffee bar's place choice changes the photo to their own bar photo for that place, one shoot, sharp at the size shown
R3g.14 pass: built to the blueprint: one warm golden grade across all their photos; nothing added
R3o.1 pass: built to the blueprint: generated food in motion only in the full-screen opening film, checked at 4 fps (gen/film/*-sheet.jpg): nothing from nowhere, opaque coffee, no glass or neon look; everywhere else their real photos
R3o.2 pass: built to the blueprint: the generated coffee is opaque deep brown; the steep's orange glow was graded to coffee brown (gen/journey/steep-3.png)
R3o.3 pass: built to the blueprint: their photos are untouched; the coffee and labels read true
R3o.6 pass: built to the blueprint: one photo per product from their site, each kept once (src/site, site-sheet.jpg); Tzvi's catalogue screenshots were not used because their site has the full-size originals
R8.3 pass: built to the blueprint: generated media only of the making of what they sell (beans, grounds, cold brew, milk); no person, no premises, no text (a made-up label on the grinder was made again without it); their bottles and bar are never generated; Tzvi approved the six-step sheet
R8.4 pass: built to the blueprint: the moving coffee, powder and milk are generated clips (Higgsfield API, MiniMax H3), each showing its cause: beans poured in, powder falling, grounds sinking, milk poured
R3c.13 pass: built to the blueprint: nothing cut off at the six sizes (clipped and check-fits)
R3c.14 n/a: no cut-outs
R5b.3 pass: built to the blueprint: the opening's words sit on the soft out-of-focus band of their photo with a soft cream edge shade behind the words only; readable passes at every size
R3e.8 pass: built to the blueprint: readable.mjs passes on every page; phone sentences at 14 px
R3s.24 pass: built to the blueprint: every photo under 600 KB (gen/assets.py), every img has width and height, no video
R3p.6 pass: built to the blueprint: check-fits passes at all six sizes; the opening photo is shown at no more than 1.35 times its size (1422 px canvas)
R3o.5 pass: built to the blueprint: ₪ in IBM Plex Sans through .sym; check-site GLYPH passes
R3x.7 pass: built to the blueprint: BRAND.md written before any picture work, and the site uses its colours and faces
R3z.4 pass: built to the blueprint: no layer over the whole photo; one soft cream shade behind the opening words only
R3z.7 n/a: every card picture is their own photo
R3c.5 pass: built to the blueprint: choices are tiles (place pills, category chips); "Most popular" only on Classic, as their own site says
R3c.6 pass: built to the blueprint: buttons say what happens with a number: "Add, ₪49", "Send for Thursday, ₪516"
R3c.7 n/a: the site has no offer with an end date; their two sale prices are standing on their site
R3j.1 n/a: no guarantee given; asked in OWNER-QUESTIONS.md
R3j.2 pass: built to the blueprint: one add-on in the basket step: their Caramel Syrup, with Add and No thanks, not pre-ticked, gone once added or declined
R3j.3 n/a: no free taster offered
R3j.4 n/a: no group discounts offered
R3j.5 n/a: their points club is not copied here (it is on their own site); no fake come-back features
R3j.6 n/a: no three sizes of one thing to pick between
R3j.7 pass: built to the blueprint: the struck prices (₪54 for House Blend and Colombia) are their own site's; no .90 endings
R3j.8 pass: built to the blueprint: the jugs' saving is worked per litre like for like (₪32.60 against ₪33.80 for the same Classic); the sale prices are the same bottle before and after
R3j.9 pass: built to the blueprint: shown only within each small group: the two sale bottles, and the one-jug and three-jug Classic
R3j.10 pass: built to the blueprint: the sale bottles show "9% off" with the real old price struck through
R3j.11 n/a: no package made of other basket lines
R3j.13 pass: built by the starter: every size saving is worked out against the litre of the same coffee bought as many times (6-pack 6 x, 5L jugs 5 x, 3 x 5L 15 x the litre price; was_of in shopkit.catalog_js); House and Colombia show their own sale price struck; only the struck price and the percent show
R3j.14 pass: built by the starter: prices.json names all 19 prices by their listing names (shopkit.prices_json); catalog.js reads window.MIR_PRICES first, repaints every price row and works the 6-pack saving out from the live litre price; tried with a changed Classic price (52): card, 6-pack (11% off) and basket unit followed
R3j.12 pass: built to the blueprint: their "best price per litre" was checked against their prices and is true
R3.14 pass: built to the blueprint: prices shown loud because they are real and listed
R3z.3 n/a: no answer depends on a choice; the coffee bar price for a guest count is confirmed on WhatsApp
R3k.7 pass: built to the blueprint: Step 1 basket, Step 2 delivery or pickup and the day, Step 3 details, the steps bar and the order with total beside every step
R3k.8 pass: built to the blueprint: every basket line has a 40 px remove button beside its stepper
R3k.6 pass: built to the blueprint: the basket is kept between pages (gc-basket-v1); an Add on the home page shows in the shop's order
R3k.9 pass: built to the blueprint: every order POSTs to their order form (gig bb714c5a) before WhatsApp, with the 19 product ids loaded in their live shop on 12 Nov 2026; delivery is off on their business, so only pickup orders save until it is switched on (report, For your call)
R3k.10 pass: built to the blueprint: the day field holds the first day regular delivery can do (two days on, never Shabbat), quantity 1, delivery chosen
R3.15 pass: built to the blueprint: ordering has its shop and order steps; contact has its page
R7.1 pass: built to the blueprint: one direction, chosen with its reason in CONCEPT.md
R8.5 pass: built to the blueprint: every main button goes to the shop and its order steps; WhatsApp is the last step
R0b.13 pass: built to the blueprint: shop.js saves first and adds the track_url to the message (gen/test_order.mjs with a stand-in save); live saving waits on loading the products
R3l.1 n/a: for choices: no item has options on their site; each is sold as it is; the coffee bar's guest count goes in the note, asked in OWNER-QUESTIONS.md
R3l.2 pass: built to the blueprint: each item says its size on the card, the sheet and the order ("1 litre", "4 × 250 ml", "5 litres")
R3l.3 n/a: no item has choices
R3l.4 pass: built to the blueprint: the five coffees side by side with what differs: their roast and taste line in each sheet, the stripe colour on each card
R3l.6 pass: built to the blueprint: every picture is the product as their site sells it now
R3l.7 pass: built to the blueprint: each item's card and sheet say what it is, its size and its price alone
R3e.9 pass: built to the blueprint: buttons rest, hover, pressed and disabled; fields focus and error with messages; Add confirms with a toast; Send confirms with the sent line
R3e.19 pass: built to the blueprint: the order ends on "Thanks, your order is open in WhatsApp"
R3s.16 pass: built to the blueprint: the shop starts with five category chips, then the products
R3s.18 pass: built to the blueprint: out of stock shows on the sheet; the order note takes anything else
R3s.25 pass: built to the blueprint: empty, the form sends nothing and says what is missing; filled, WhatsApp carries the total shown (gen/test_order.mjs)
R3x.9 n/a: not a request-type business
R3x.10 pass: built to the blueprint: the order and total stay beside the form on a laptop; the total sits above the button on a phone
R3x.14 pass: built to the blueprint: the gift card section is on the shop page, hidden until the owner switches gift cards on
R3f.1 pass: built to the blueprint: the film plays while it fills the held screen; captured at 0, 33 and 99%
R3f.8 pass: built to the blueprint: the film finishes while the stage is held mid-screen
R3f.9 n/a: no list that lights item by item
R3f.5 pass: built to the blueprint: text widths in rem
R3f.4 n/a: no logo motif in motion
R3g.4 pass: built to the blueprint: each motion has one job: the steeping shows how it is made, the button fill confirms, the brew line reveals
R3e.16 pass: built to the blueprint: eased curves only, under 0.5 s (the button fill 340 ms)
R3e.17 pass: built to the blueprint: the product sheet closes by swipe-down and by its close button
R3e.18 n/a: no ambient background video; the film is the scroll film
R3a.2 pass: built to the blueprint: only the film moves; the words hold still and never re-wrap
R3a.3 pass: built to the blueprint: nothing is placed on a spot in the film; the chapter words sit at the left edge on their own shade
R3a.4 pass: built to the blueprint: the held stage is the full screen and fits at 1280x650
R3a.5 pass: built to the blueprint: the film follows the scroll, never takes its speed; reduced motion shows the last frame, their coffee bar
R3s.2 pass: built to the blueprint: nothing jumps: photos have width and height; the place choice fades within a fixed box
R3s.1 pass: built to the blueprint: everything pressable answers with hover and pressed states (check-site passes)
R3s.8 pass: built to the blueprint: the opening button sits on the soft cream shade over the photo
R3s.10 pass: built to the blueprint: each product name has its photo beside it
R3s.27 pass: built to the blueprint: every card writes name, price and size in the same place; every Add is in the same place
R3s.29 pass: built to the blueprint: no button breaks onto two lines; every Add is the same height
R3s.30 pass: built by the starter: every card row (shop products, home products, events) puts its words and Add button under the photo on the one page ground, so all are one colour; no card has its own ground
R3s.28 pass: built to the blueprint: no blank screen: check-blank passes
R3i.3 n/a: no live readout; the chapter words name true steps of their process
R3s.21 pass: built to the blueprint: no script errors or dead links (check-site passes)
R3x.6 n/a: no word-by-word sentence
R3x.12 n/a: no progress line
R3b.6 pass: built to the blueprint: on a phone the bar holds From ₪49 and Shop cold brew from after the first screen until the order
R3f.7 pass: built to the blueprint: the bar fits at 360 px
R3a.6 pass: built to the blueprint: room is kept for the phone bar (check-site passes)
R3s.22 pass: built to the blueprint: taps at least 40 px, none overlapping (check-site passes)
R3s.23 pass: built to the blueprint: no sideways scroll on a phone (check-site passes)
R3s.26 pass: built to the blueprint: check-overlap passes at short laptops, 1440x900 and phone
R3t.1 pass: built to the blueprint: food-shop in CONCEPT.md and a site-category meta on every page; follows food-shop: product, price and Add early, kosher band
R3t.2 pass: built to the blueprint: price and Add within the first two screens; every card has photo, name, size and price
R3t.3 n/a: not a trainer
R3t.4 pass: built to the blueprint: the kit's full footer, identical on every page
R3a.7 pass: built to the blueprint: phone checks with touch emulation (gen/test_order.mjs, the checks)
R3a.8 pass: built to the blueprint: the dotted facts line becomes a plain list on a phone so it never wraps
R3u.2 pass: built to the blueprint: a day inside the lead time or on Shabbat gets one line naming the first possible day, with a button to choose it
R3u.3 n/a: no servings given
R3u.5 n/a: the home page opens on a scroll film; the opening words still arrive in order
R3u.6 n/a: no depth layers
R3u.7 n/a: no rotating word
R3u.8 n/a: no tilted label
R3u.9 pass: built to the blueprint: questions are rounded cards on details with + in a cold brew circle turning to x
R3u.10 n/a: one place
R3u.11 pass: built to the blueprint: the page passed check-build with a still opening before the film went in (10 Nov)
R3u.12 pass: built to the blueprint: the steeping was tried on the page in the browser at each stop before the checks; kit parts not used
R3u.13 pass: built to the blueprint: gen/report.md ends with Not done yet and For your call
R3u.14 pass: built to the blueprint: gen/copy-pass.md
R3w.1 n/a: no generated food
R3w.2 n/a: no generated liquids
R3w.3 n/a: no generated food
R3w.4 pass: built to the blueprint: the start and end stills were made and looked at before any clip; each clip made once at 2K; dissolves and holds in code
R3w.5 n/a: no bite, chew or tear
R3w.6 pass: built to the blueprint: the scrub ends on their coffee bar photo held 0.7 s, which is the section's last frame and the start of the page below
R3w.7 pass: built to the blueprint: the generated wall, oak and light were compared beside their own photos of the same world (gen/film-brief.md, Looks real)
R3v.1 pass: built to the blueprint: the kit's full footer on every page: who we are, pages, ordering, reach us, the base line
R3v.2 pass: built to the blueprint: the menu bar lists Home, Shop, Contact on every page; no #jumps
R3v.6 pass: built to the blueprint: check-heights passes: the opening, a thin kosher band, cards, a compact minis band, a short jugs band, the coffee bar, a taller story, how ordering works
R3v.7 pass: built to the blueprint: layouts: full-screen opening, five-across cards, four-across cards, photo beside a price list, photo beside a choice, words beside a photo, three steps, an overhanging card; no layout twice in a row
R3v.8 pass: built to the blueprint: from 3v: picture buttons (the coffee bar place choice) and a statement band (the closing band)
R3v.14 pass: built to the blueprint: three true facts under the button: ₪49 a litre bottle, coffee bars from ₪349, kosher (check-facts passes)
R3x.8 pass: built to the blueprint: skip link, one h1, focus rings, labelled fields with type and autocomplete, live basket count, role=status on the sent line and alert on errors (check-web-basics passes)
R3x.13 pass: built to the blueprint: the starter's scales unchanged, recorded in BRAND.md
R3r.3 pass: built to the blueprint: check-rules run after the last edit
R3r.4 n/a: nothing Tzvi has pointed out twice on this site
R3aa.1 pass: built by the starter: every step is a full-screen clip (grind, cold, steep, pour, serve), one film in place
R3aa.2 pass: built by the starter: five clips chained by clipchain.py, each from the last frame of the one before, carried on in place (data-same, no push, no fade); CONCEPT.md - join:
R3aa.3 pass: built by the starter: one warm light from the left and one cream ground through the grinder, the waves and the glass; the pull-back to their sunlit terrace (their own photo) has a short dissolve in the last clip, named for Tzvi
R3aa.4 pass: built by the starter: the same grounds, water and cold brew from the grinder to the glass
R3aa.5 pass: built by the starter: one word per step, each naming its own scene (Grind, Cold, Steep, Pour, Serve) with one short line; GRIND drawn huge into the first still
R3aa.6 pass: built by the starter: five steps, each held a screen (slides.js hold 1)
R3aa.7 pass: Pinterest coffee site (docs/inspo/pinterest-coffee-2026-11-11) saved and named in REFERENCES.md with what was taken
R3aa.8 pass: built by the starter: every chain.json step has its frame line; the grinder whole and large, the water edge to edge, the glass whole, the whole bar at the end
R3aa.9 pass: built to the blueprint: GRIND huge behind the whole grinder, drawn into the still from the layout sketch (gen/world/g0-layout.png); the later steps are water and glass, so their words are the page's
R3aa.10 pass: built to the blueprint: the grinder starts whole and comes apart in the air in clip 1
R3aa.11 pass: built to the blueprint: the film's last frame floods into the coffees: its tablecloth colour runs down into the cream ground on a laptop, and the section is the shop: the glass the film ended on in the middle with four litre bottles round it, Add on each (on a phone the film already ends on the cream ground)
R3aa.12 pass: built to the blueprint: one palette of cream, terracotta and brew; beans pour, ice drifts, milk curls in every scene
R3aa.13 pass: built to the blueprint: gen/journey-sketch-2.png and gen/pour-sketch.png show each scene as a laptop frame beside a phone frame
R3aa.14 pass: built by the starter: phones get their own tall 9:16 clips (gen/chain-tall.json, 13 Nov), shown whole, the thin band on taller phones at the top under the menu bar; a laptop window narrower than 16:10 shows the whole film on the ground (site.css), never its sides cut
R3aa.15 pass: built to the blueprint: the ocean fills the width edge to edge at the waterline; no glass or wall until the pour, the bar only in the pull-back
R3aa.16 pass: built by the starter: the closing words come once the last clip has played and take the Serve word's place; on a phone step words sit on the ground above the film; on a laptop the closing card sits in the clear top left, off the glass
R3aa.17 pass: built by the starter: the four chained clips carry on in place, no push
R3aa.18 pass: built by the starter: Added shows in the basket button and the phone bar, which becomes the basket
R3aa.19 pass: built by the starter: prices.json and window.MIR_PRICES; savings worked out from the litre price
R3bb.1 pass: built to the blueprint: CONCEPT.md - touches: the product handled (the grinder coming apart), the product part of the word (the grinder in front of the I of GRIND), its world around it (the milk, syrups, cups and straws round the glass)
R3ab.1 pass: check-headings: every heading says something on all 3 pages
R3ab.2 n/a: no reviews on their site or in the record
R3ab.3 n/a: no reviews on their site or in the record
R3ab.4 n/a: no real rating in the record, nothing stands in its place
R3aa.20 pass: built by the starter: a chained step's word waits until 45% into its clip, when its own scene is on screen (slides.js "early"); every chain.json step has its word line (GRIND by the beans, COLD at the cold water, STEEP as it browns, POUR into the glass, SERVE at the bar); clipchain refuses a step without one
R3aa.21 pass: built by the starter: each new clip's start_seen says what touches each edge (g0, K1's last frame with the floor painted out, o1, K3's last frame)
R3aa.22 pass: built by the starter: the grinder starts whole before it comes apart, the water clear before it browns, the whirlpool before the pour; start_seen says so
R3aa.23 pass: built by the starter: the floor band under the grinder painted out of clip 1 (gen/world/nofloor.png) before clip 2 was remade; the ocean's waterline has its floor_ok line
R3aa.24 pass: built by the starter: chain.json phone_plan: tall 9:16 clips, Tzvi's choice on 13 Nov; each step's phone line points at its tall clip
R3aa.25 pass: built by the starter: site.css plain links in ink, underlined, and [id] scroll-margin-top clear of the menu bar
R3aa.26 pass: built by the starter: Tzvi was asked on 12 Nov and answered on 13 Nov, "do the 60"; the brief has the Phones asked line and chain.json phone_plan quotes him; the film gate and clipchain refuse without it
