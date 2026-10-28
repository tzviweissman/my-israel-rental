# Rules for bake-away (docs/rules-checklist.md)

One line per id: `Rx.y pass: <what was looked at or which script passed>`, `Rx.y n/a: <why>`, or `Rx.y fix: <what is wrong>`.
Replace every `todo`. `node scripts/check-rules.mjs scrollcraft/builds/bake-away` must exit 0 before anyone is shown the site.


## 1. Facts and words
R0b.1 n/a: local build only, nothing published; the slug is bake-away from the live record (src/record.json) and is set at publish
R0b.3 pass: listed every price on index, shop, site.js and the bar against the record tiers: doughnuts 16 (Milky and Parve), Cream 18, DIY kit 70, Trays of cake 120, Challos 40, Cinnamon buns 50, Cakes 45, Mini cheese cakes 120, Cheese cakes 250, Babka 60; names tidied only by capital and spelling (cheesecakes, doughnuts). Her menu is not loaded as shop products, so there are no product ids yet: reported, needs Tzvi's OK (see R3k.9)
R2.1 pass: read every sentence of the three pages and traced each: description, "high-quality, homemade taste", "Our home bakery" (her "home-based business"), founded 2020, Hebrew and English, Jerusalem, order 24 to 48 hours ahead (lead_time), delivery Jerusalem and more (delivery_note), cash, bit or bank transfer, kosher wording from kosher_certification.body, shabbat_closing, every menu line from the tiers, "Milky or parve" (her doughnut tiers); no owner name (her record has none; the independent review, 28 Oct), "Founded in 2020"; the word cookies appears only in her card line under the giant name
R2.2 pass: read message-to-owner.md: 13 numbered questions, all about her own business (photos, cookies, kosher, doughnuts, cakes, cheesecakes, delivery, order days, phone, promise, customers' questions, flavours, worries and photos); nothing about tools or credits, nothing the record already answers
R2.3 pass: item 11 holds seven example questions written from her menu (how far ahead before a simcha, a name on a cake, bar mitzvah or kiddush cakes, how long doughnuts stay fresh, freezing challahs and babkas, nuts or eggs or dairy, the DIY kit); item 13 adds the worry, first-days and photo questions
R3.1 pass: searched every page for kosher, certified, licensed, verified, stars, since, best, award, guarantee, fresh daily, delivery: kosher is her exact words (all ingredients Badatz Eida HaChareidis) and no hechsher on the kitchen is claimed; founded 2020 is founded_year; delivery is her delivery_note; English and Hebrew are her languages; no reviews, stars, awards or guarantees
R3.2 pass: searched all pages for only, hurry, left, limited, ends, countdown, today only: none
R3.3 pass: searched all pages for welcome to, look no further, one-stop, passionate, world-class, top-notch, quality you can trust: none
R3.4 pass: searched visible text, alt text and aria-labels of all three pages: no exclamation marks, no long dashes; capitals only by CSS on small labels and her card line CAKES, COOKIES & MORE and the name BAKE AWAY
R3.5 pass: first screen: headline "High-quality, homemade taste" (her words) and the line "Doughnuts, cakes, challah and cheesecakes, baked at home in Jerusalem" name what she sells in her listing's words
R3.6 n/a: English only, as briefed; her languages are Hebrew and English but no Hebrew page was asked for
R3.7 pass: scrolled all three pages: no FAQ section and no reviews (no answers or reviews exist), no placeholder or coming soon; the owner gallery place is hidden until she adds photos
R3.8 pass: scanned all pages: no logo wall, laurels, stars, counts, popular badges or struck-through prices
R3.9 pass: first screen against her listing description and card: homemade, high-quality taste, doughnuts, cakes, challah, cheesecakes, Jerusalem, Order and the doughnut price
R3.10 pass: strengths shown are her own: the high-quality homemade taste (her description) and all ingredients Badatz Eida HaChareidis; no third claim
R5.1 pass: read every line as Malky: each names a doughnut, a cake, her ordering time, delivery or payment; none could be printed by another bakery
R5.2 pass: read every line: plain and direct, no jokes
R5.3 pass: labels are full phrases: From ₪16 a doughnut, Order 24 to 48 hours ahead, All ingredients are Badatz Eida HaChareidis, Same price, milky or parve, Founded in 2020 in Jerusalem
R5.4 pass: searched visible text, alt text and script strings of every page for they, them, their: none; the page speaks as we and our, and you for the visitor
R5b.2 pass: Order goes to shop.html#order with the same word in the header (outline), the first screen (solid), the phone bar and the closing band on every page; Add on a card or the flavour spot is the add action and cakes say Choose because they need a choice first
R5b.8 pass: the closing line is Order 24 to 48 hours ahead, what the customer needs to do and when; no line starts with or or prefer; contact lines say what each is (WhatsApp, Email)
R3.11 pass: order follows the visitor: headline and line, price and Order, the doughnut flavours with price and Add, cream doughnuts, the rest of her menu with prices, who bakes it, delivery payment and kosher, the close
R3o.4 pass: contacts labelled in the close band and on the contact page: WhatsApp +972 58-323-3995 (label WhatsApp only until question 9 is answered) and Email; asked in message item 9
R3e.22 pass: Malky Ballon is named in the band after the menu and her WhatsApp is in the close band of every page; no photo of her was sent, asked in message item 13, so none is shown
R3s.19 pass: viewed the head of each page: own title, description, og:title, og:description and og:image (og.webp, the film's last frame, her doughnut); the home page, the spot and the shop show the same doughnut look and prices
R6.1 pass: food-shop playbook: products with prices lead (flavour spot with price and Add, cards), then the maker, delivery and kosher facts, close; no FAQ or reviews because none exist
R4.1 pass: missing data is not shown or invented: no delivery fee (said as confirmed on WhatsApp), no flavour names (described by what is on them), no cookies, no hechsher on the kitchen; each is a numbered question in message-to-owner.md

## 2. Opening
R3g.13 pass: 1440x900 and 390x844 first screens: the film picture, the headline High-quality, homemade taste (3 words), one line, and the Order button with From ₪16 a doughnut under it; the small chapter line is the film's own (R3h.5)
R3b.1 pass: first screen answers what (doughnuts, cakes, challah, cheesecakes), where (baked at home in Jerusalem), trust (her high-quality homemade taste, the price) and what to do (Order)
R3b.2 pass: From ₪16 a doughnut sits directly under the Order button; she has no kosher certificate (certificate_url empty), so there is no band; the Badatz ingredients sentence appears once per page (home tile, shop facts line, contact tile)
R3b.3 pass: first screen has one solid button (Order) and an outline one in the header; each later screen has the Add buttons of its own cards (copper, same label) and nothing else solid
R3h.20 pass: check-site SMOOTH and SLOW pass: the film runs 4.3 screens of scroll (430vh, 4 on a phone) on a canvas; the doughnut is whole on plain slate (her own photo's world, never a photo of other doughnuts); the first screen loads first (every 8th frame, then sharper passes); 28 Oct: the flavour spot now lights as it scrolls in (it was blank for about a screen after the film, seen in the owner video's contact sheet; check-site re-run clean after the change)
R3h.1 pass: check-site OPENING passes: a full-screen film that the scroll drives, an event (chocolate is drizzled across her doughnut); Tzvi confirmed concept A and its five steps on 28 Oct
R3n.1 pass: the film's last frame is her white-glazed doughnut (edited from src/owner/p05, compared in gen/k1b-compare.jpg), about half the screen width and most of its height on a laptop, 94% of the width on a phone
R3n.2 pass: you scroll and chocolate is drizzled across her own doughnut, then the same spot turns through her flavours with price and Add; no other business has these doughnuts or this scene
R3n.3 pass: each flavour changes the doughnut, the words beside it and the line that Add puts in the basket (check-motion passes: crossfade, no flash); on the shop the stage photo, option and total follow the choice
R3n.4 pass: put the first screen and the spot beside docs/inspo/awwwards-food-2026-10-18/still-2-flavour-glow-swap.webp (name left, one product centre, buying right) and Savor's film opening: ours opens on a closer single product with the drizzle and adds a price and Add; not weaker
R3n.5 pass: you land and chocolate is drizzled across her white-glazed doughnut as you scroll, then her other doughnuts turn in its place, each with its price and an Add button; frames looked at at 0, 33, 66 and 100 percent
R3g.15 pass: check-fits passes (no photo over 1.35x its size); the film frames are 1680 wide on laptop and 720x1280 on phone, the doughnut is her own photo edited into the approved scene; the slate is never presented as her kitchen
R3h.2 pass: walked the film at 0, 33, 66 and 100 percent: her plain glazed doughnut, a stream of chocolate enters past the top edge and lays the lines, the finished doughnut and the Order button; every step true
R3h.3 pass: 1680-wide frames drawn to cover the laptop screen (1440x900, 1280x650 and 1920x1080 looked at) and 720x1280 frames fitted to the phone's width on the film's own slate so her doughnut is never cropped; none shrunk into a column
R3h.5 pass: chapter lines are Drizzled by hand (3 words), Baked at home in Jerusalem (5) and Order 24 to 48 hours ahead (6), small, at the left edge on a laptop and above the headline on a phone, well under a third of the height, on the soft left or bottom shade only; looked at every chapter: they never touch the doughnut
R3h.7 n/a: the film is one clip with no joins (gen/film/drizzle.mp4, MiniMax H3 6 s), so there is no seam to compare
R3h.8 n/a: the film is a dark slate scene and the whole site is dark by the owner's own card, so there is no lit film followed by a mood change; the one bold change of ground is the ivory room
R3h.11 pass: scripts/brightness.py: laptop frames average 32 (middle third and whole frame pass); the phone frames show the doughnut in the upper 60 percent, which averages 41, and the rendered phone screen passes its middle third; the doughnut is the brightest thing in every frame
R3h.13 pass: one cause, one motion: a chocolate stream and the lines it lays are one clip (gen/film/sheet8fps.jpg and tail.jpg watched at 8 fps); no code pieces are added to the film
R3h.14 pass: the doughnut stays whole and recognisable through the whole film; the phone frames are fitted to the width so nothing travels past the crop
R3h.18 pass: gen/film-brief.md lists every object (doughnut in frame throughout; the chocolate stream enters past the top edge, lays the lines and leaves past the top edge; nothing else appears) and the clip was watched at 8 fps object by object
R3h.19 pass: gen/film-brief.md has the plan (K0, middle, K1) written first; one clip made in one try, the end frame K1 needed one redo (job 14f1ffcd then 70318d16), within two tries
R3h.17 n/a: the page does not use the giant-name-then-film device; the words sit over the film on its left or bottom shade (R3h.5)

## 3. Sections and worlds
R3.12 pass: hero (the film), features (the flavour spot, cream doughnuts and the room of cards each with price and what it is), a closing call-to-action band with Order, the phone numbers and the giant name
R3c.1 pass: check-concept passes; CONCEPT.md cites docs/inspo pictures, Mobbin Savor and Koto links and a 21st component, with REFERENCES.md covering every source; the pick (A) and the reason are in Chosen
R3g.17 pass: check-concept passes (every effect line has its from source) and check-fingerprints passes (different from all 16 other pages); effects B19, L1, T6, R4, P1, H1 and X31 are written in CONCEPT.md Effects
R3c.2 pass: whole page at 1440 wide: dark warm slate with copper and ivory, not cream plus serif plus one italic word (no italics at all); no default font, no purple or two-colour gradient, no frosted glass; the ivory room and the deep bands give contrasting grounds
R3g.1 pass: CONCEPT.md style sheet against site.css tokens: ground #241B1B, deep #161110, ivory #F3EBDD, muted #B9A797, copper #C2824B on buttons, Forum and Work Sans (Heebo only for the shekel sign), radius 14px, one soft tinted shadow
R3g.3 pass: checked every screen while scrolling: copper only on the Order, Add and Choose buttons; the basket count, selected states and the radio are ivory; every price is ivory bold and large (computed colour of each price #F3EBDD or the dark ink on the ivory room); no emphasised word
R3g.7 pass: one closing signature: the giant BAKE AWAY under the close band; it sits after the order path and nothing else is playful
R3g.11 n/a: English only as briefed; Forum and Work Sans are Latin faces from CONCEPT.md, and Heebo (on the approved list) carries the shekel sign; a Hebrew page would pair Forum with Bellefair and Work Sans with Heebo as the rules' pairing note says
R3p.3 pass: check-fingerprints: bake-away is different from all 16 other pages (line pasted in CONCEPT.md Not alike)
R3p.5 pass: the one touch is the chocolate drip that runs down from the top edge of every copper button on hover (B19), the same chocolate as her film; watched on hover
R3q.1 pass: check-concept passes: three ideas with pictures, the Own idea, Chosen, the five wow answers, the Effects lines with a touch, and the Not alike line
R5a.7 pass: one signature (the drizzle film into the flavour spot) and one peak (the doughnut finished, then turning flavours); the close resolves on Order; not carried over from another business
R9.1 pass: the signature is used because her own doughnut photos support it: nine glazed doughnuts and the film made from p05; p10 was left out as its cut-out is broken
R3f.2 pass: CONCEPT.md budget against frames: signature (film into spot), accents (words arriving one line at a time on a mask, the flavours turning as the scroll passes, the giant name closing), quiet touches (R4 slide in, drip on buttons, link line wipe, cards T6)
R3m.1 pass: grep: each page's gallery place from sitekit (data-mir-gallery with a template, hidden until she adds photos); no data-mir-catalog because her menu is not loaded as shop products yet
R3m.3 pass: the details she changes (delivery, payment, lead time) are fixed short tiles; no free text boxes; her FAQ place is not built until she sends answers
R3k.1 pass: files: index.html, shop.html (menu and order on one page), contact.html; there are no old Menu or Order addresses to forward
R3k.2 pass: identical bar on all three pages: name to Home, pages, Order with a basket count, aria-current on the current page; opened the phone menu: Close, Escape and a link tap close it
R3k.4 pass: grep: one site.css and one site.js (plus film.js) serve every page; the opening uses .film and the spot uses .spot, never reused for a shared part's state (the spot's .on is on its own section)
R8a.1 pass: viewed source of all three pages: no external scripts or images except Google Fonts; no demo text, reviews or stock photos; the 21st reference only informed the card slide
R3b.4 pass: her photos are many, and facts carry the cards (what is in each, price); nothing padded
R3c.3 pass: the worry about timing is answered beside the price and button: Order 24 to 48 hours ahead in the chapter line, the shop facts and the card slide; kosher sits in the facts line beside the shop's Add; her own worries are asked in message item 13
R3c.8 n/a: she has not told us what happens after an order; asked in message item 13
R3e.10 pass: check-site ALIGN passes; cards read name (largest), what it is, then price large and Add; the longest name, Mini cheesecakes, wraps to two lines in its card without clipping
R3e.14 pass: computed styles: Work Sans in 400, 600 and 700 only, Forum 400 for headings and prices; body and label text between 0.875rem and 1.125rem plus the heading sizes; spacing in .45, .6, .8, 1 and 1.2rem steps
R3c.9 pass: one radius 14px (cards, images, buttons are pills by design for controls), one shadow 0 3px 30px of the ground colour, one icon style (bin and arrow drawn inline), no two-colour gradients (the only gradients are the film's soft edges); the glow behind the flavour doughnut is a soft ivory radial
R3s.4 pass: check-site ALIGN passes: headings, text and buttons share each section's left edge
R3s.6 pass: check-site ALIGN passes: the Add buttons share height and shape; seg and chip buttons share 44 to 46px
R3s.7 pass: sentence case buttons (labels in small caps only by CSS for kickers), pale dividers, no Price: labels, body line-height 1.5 to 1.6, no lowered contrast (readable passes)
R3s.9 pass: the one kosher sentence looks the same in the tile, the shop facts and the contact tile; no kosher tags on items
R3s.12 pass: the maker band (Baked at home by Malky Ballon with her description) follows the menu; the real photos of her trays, doughnuts and cakes appear in the cards; no photo of her was sent
R3s.14 n/a: she gave no numbers to show big beyond prices; prices are shown large (R3g.3), and no counts or years are invented
R3s.11 pass: one true sentence beside the price: the Order 24 to 48 hours ahead line and Baked at home on cards; her own words, no claim of why it costs that beyond them
R5b.6 pass: no scroll cues, no 01/06 counters (the spot's 1 of 8 is a true count of the flavours shown), no label above every section
R3.13 pass: one contact in each close band, no doubled facts or gallery (the contact page's tiles replace the band numbers), no two dividers in a row, no ending on one; every photo is hers and exists
R3a.1 pass: rendered all three pages at 1440x900, 1280x650, 1536x753, 1920x1080 (check-fits), 390x844 and 360x640 with touch emulation; walked the film at 0, 33, 66 and 100 percent on laptop, short laptop and phone, the spot at flavours 1, 3 and 6, the shop with a doughnut and with cakes, the order step 1; reduced motion walked by check-site MEDIA
R3r.1 pass: ran check-site, check-fits, check-motion and readable on index, shop and contact, plus clipped and cutoff on all three, via check-build and by hand
R3r.2 n/a: the second person's pass against docs/page-review-checklist.md is the next step after this build and is left to the caller
R3g.12 pass: check-site FLOW went through the shop: empty form says what is missing, a filled form with Add reached the WhatsApp message carrying the total the page shows (WhatsApp stubbed, nothing sent to her)
R0b.12 n/a: not published yet, so there is no pages-list preview clip

## 4. Photos and media
R8.1 pass: put the eight cut-outs on one sheet (gen/cut/sheet.jpg and the rendered chips): same camera angle, same plain white origin, doughnut at the same size; her cards and trays are real photos from her own shoots
R8.6 pass: the doughnut is a clean cut-out centred on a plain ground with a soft shadow; each shop and card photo is her own original; compared the film doughnut with p05 piece by piece (gen/k1b-compare.jpg)
R8.7 pass: gen/film-brief.md was written before any generation (crop reference, traits kept, only the setting and light changed, stills first); K1 was compared beside her photo (gen/k1b-compare.jpg); nothing was generated in this build pass
R8.2 pass: the set comes from her own matching photos: the eight doughnut cut-outs are her p05 to p14 photos from one shoot; the film doughnut is edited from her p05; no stock
R3p.7 pass: tapped flavours in the spot and in the shop (check-motion taps them): every flavour has a thumbnail of its own doughnut at the same size and shows it large; every shop item chip changes the big photo
R3h.12 pass: the doughnut looks the same everywhere: the film end frame is her p05 edited, and the spot, chips and shop use the same cut-out of p05 (one master per flavour); the other items use her one photo each
R3h.10 pass: choosing a flavour changes its picture, its words and the line in the Add button; check-motion passes; one photo per flavour from one shoot, 900px wide
R3g.14 pass: one sheet of all images: her photos are warm food photography on wood, white or marble; the cut-outs sit on one dark ground with the same soft shadow; the film is graded in the same warm slate
R3o.1 pass: generated food in motion appears only in the opening film; everywhere else food is her own photo; nothing is generated outside the film
R3o.2 pass: the chocolate in the film is opaque and satin with a stream that folds on the glaze (gen/film/tail.jpg); not glass or neon
R3o.3 pass: product colours look true beside her photos: the glaze reads ivory in the film as in p05 (k1b-compare.jpg); the cut-outs keep their own colours on the dark ground
R3o.6 pass: the numbered sheet.jpg against the page: one photo per kind (cream doughnuts p02 to p04 shown as three, tray p09, kit p15, trays p16, challos p17, buns p18, cakes p19, mini p20, cheesecakes p21, babka p22, card p01 unused on the pages); p02 to p04 screenshots are cropped at their real 1080px resolution to the photo area; the originals are asked for in message item 1
R8.3 pass: generated media only of items she sells (her doughnut); no person, no made-up premises, no text in images; nothing non-kosher; Tzvi approved the stills and the clip steps
R8.4 pass: the moving material (chocolate) is a generated clip made in Higgsfield, cause (the stream) then effect (the lines), shown frame by frame from the scroll; reduced motion shows the last frame
R3c.13 pass: clipped.mjs on all three pages at 1440x900, 1536x753, 1280x650, 1000x700, 768x1024, 390x844 and 360x640: nothing cut off
R3c.14 pass: cutout.py --check on the eight cut-outs (backend venv): no stray pieces after gen/strays.py; the pale-edge percentage reported on the white-glazed doughnuts is the glaze itself; looked at on the dark ground at full size after the rim, hole and slit cleaning of gen/clean_cut.py
R5b.3 pass: readable passes on every page: the film words sit on a soft left shade (bottom shade on a phone), no dark pools or frosted glass
R3e.8 pass: readable passes on every page: every word 12px or more (14px for a sentence on a phone) and 4.5:1, copper buttons with dark text
R3s.24 pass: check-site MEDIA passes: no photo over 600 KB (largest 220 KB), every img has width and height, the film has its first frame as the canvas background, nothing hidden with motion off
R3p.6 pass: check-fits passes on every page at 1280x650, 1440x900, 1536x753, 1920x1080, 390x844 and 360x640; no photo drawn over 1.35x its size; photos are shown whole (contain) in their boxes and never zoomed or framed, so none needs extending
R3o.5 pass: check-site GLYPH passes: the shekel sign renders in Heebo through the font stack and sits in the text face beside the figures

## 5. Prices and savings
R3c.5 pass: grep: no select element; milky or parve, flavours and the cake flavour are buttons; no Most popular badge
R3c.6 pass: every button says what happens next: Order, Add with the price (Add 2, ₪32), Choose, Continue to delivery or pickup, Send for Monday, ₪32 on the last step; never Submit
R3c.7 n/a: she offers no offers, no discounts and no sale
R3j.1 n/a: she was asked in message item 10 whether she offers a guarantee; none is known, so none is shown
R3j.2 n/a: no add-on from her menu clearly fits an order, and she has told us nothing about pairings
R3j.3 n/a: she offers no taster, sample or free quote
R3j.4 n/a: no group discount is known
R3j.5 n/a: no stamp card or reorder scheme is known
R3j.6 n/a: no three sizes or packages of one thing exist; the natural pick is not claimed
R3j.7 pass: searched every page: no struck-through or was price, prices are her own whole shekels, no endorsement
R3j.8 n/a: no item is the same thing in another amount (the DIY kit, trays and cakes differ in contents), so no saving is shown and no per-unit table is needed
R3j.9 n/a: no group of the same item in different sizes exists
R3j.10 n/a: no saving is shown on the page
R3j.11 n/a: no package makes single basket lines cheaper
R3j.12 n/a: she made no savings claim
R3.14 pass: prices are loud (large Forum numerals) and she has prices; the business is not premium or quote-based

## 6. Order and booking flow
R3k.7 pass: check-site FLOW walks the steps: Step 1 Your basket, Step 2 Delivery or pickup, Step 3 Your details, a three-line bar, the order and total beside every step (under it on a phone), the button names the next step and the last says Send ... with the total, Back, browser back goes back a step (#order-2); each step checks only its own fields
R3k.8 pass: every basket line has a 40px bin button named Remove X from the basket beside its stepper (check-site TAP passes); no packages exist
R3k.6 pass: an Add on the home page puts the item in the basket (localStorage) and the count shows on every page; the shop reads the same basket, so the order section has it
R3k.9 pass: the order is POSTed to /api/marketplace/order-form/<gig>/orders before WhatsApp opens; her menu is loaded as 10 shop products with fixed ids (gen/catalog/load_products.py, 28 Oct, Tzvi: "add them as products"), the PID map in shop.html points at them, and check-site SAVE (now also checking the ids against the live shop) is clean
R3.15 pass: what the page asks visitors to do (order) has a place: the shop with the order in three steps and the WhatsApp message
R7.1 pass: a hand build: CONCEPT.md names the pick (A, drizzle into flavours) and the reason; no options page
R8.5 pass: every main Order button goes to shop.html#order, her order page; WhatsApp is the last step of that page and the contact page
R0b.13 n/a: the order cannot be saved with a tracking link until her menu is loaded as shop products (needs Tzvi's OK, see R3k.9); until then the whole order reaches her in the WhatsApp message, itemised with the total
R3l.1 pass: message-to-owner.md asks what can be chosen: doughnut flavours and milky or parve (items 4 and 12), cake flavours (5), cheesecake flavours and size (6), the DIY kit (11)
R3l.2 pass: each item carries what it allows, in the same words on the card, the shop line and the order message: Doughnut: flavour, milky or parve; Cake, marble or honey or mocca; the rest say what is in them (24 pieces of cake)
R3l.3 pass: options show on the shop item only for doughnuts (kind and flavour) and cakes (flavour), as buttons with a default chosen; ordered a doughnut and a cake with every option once; the cake card on the home page says Choose and opens the shop so no cake is added without its flavour
R3l.4 n/a: no three or more alike items exist to compare; her ranges differ in kind and contents
R3l.6 pass: each picture is her photo of that item as shown to us: trays, challah, buns, cakes (p19 loaf cakes), mini and large cheesecakes, babka; the cheesecake photo shows several cakes and the card says a variety
R3l.7 pass: read each shop item alone: its description, its choices and its price are on the item
R3e.9 pass: check-site STATE and FLOW pass: rest, hover and pressed states on every button, the idle Continue button dims and brightens on hover, fields have focus rings and an error message under them, every Add shows a toast and Added
R3e.19 pass: finished a test order in the browser: the sent line reads Thanks, Test. Your order is open in WhatsApp; progress shows only the three true steps
R3s.16 pass: the shop asks milky or parve first (a plain two-way choice) before the flavours, and the first flavour is the film's doughnut chosen on purpose
R3s.18 pass: choices have the nearest real alternative on the item itself and nothing is shown unavailable; no list needs a way out because each has a default
R3s.25 pass: check-site FLOW passes: an empty form sends nothing and says what is missing; a filled one sends a WhatsApp message carrying the total the page shows

## 7. Motion
R3f.1 pass: the film and the flavour spot are held on stages that fit the screen and play over the hold; captured at 0, 33, 66 and 100 percent on 1440x900, 1280x650 and 390x844: the whole doughnut is visible in each frame
R3f.8 n/a: both scroll-tied effects run inside held stages that fill the screen, so their subject is in the middle of the screen when each completes (the spot's content is only shown once its stage is held)
R3f.9 n/a: no list that runs item by item exists; the flavour chips wrap into two rows on a phone
R3f.5 pass: grep css: no ch units, no background-clip: text
R3f.4 n/a: no logo motif is reused as an effect
R3g.4 pass: every motion has one job: the film reveals, the lines rise to reveal, the flavour crossfade guides, the drip confirms a hover; no loops; no bounce on text; menu hover is 160ms
R3e.16 pass: grep css and js: no linear easing (ease-out curves only); every motion finishes in 480ms or less (headline lines 380ms plus 100ms of stagger, slides 480ms, the flavour crossfade 480ms, the drip 480ms, hovers 160 to 200ms)
R3e.17 n/a: no carousel exists on the page; the ranges are a grid
R3e.18 n/a: no ambient background video; the film is scroll-driven frames
R3a.2 pass: looked at mid-transition frames of the flavour crossfade (check-motion: no jump or flash) and the chapter lines; the film itself holds still except the stream; text never re-wraps while animating (the heading masks keep their width)
R3a.3 n/a: no overlay is placed on a spot in the film; the words sit at the left edge or bottom and never on the doughnut
R3a.4 pass: cutoff.mjs at the nine sizes: ok on all three pages; the film and the flavour spot are held stages that fit 1280x650 (the spot shows its content only once held); the order section is not held
R3a.5 pass: pinning and scrubbing only; no parallax; reduced motion shows the finished doughnut still with its last chapter and the spot's content at once (MEDIA passes)
R3s.2 pass: check-site SHIFT passes and check-motion passes (no jump, flash or colour change; two quick taps); photos fade in over 480ms into kept space; the options area has a fixed height so nothing moves when an item is chosen
R3s.1 pass: check-site STATE passes: every pressable thing has hover and pressed states under 200ms
R3s.8 pass: the only buttons over the film are the solid copper Order, checked on the light glaze and the dark slate
R3s.10 pass: the picture appears the moment a flavour or item is named (crossfade at the same time as the words)
R3s.27 pass: measured the tops of the name, description, options, price and Add on the shop for all ten items at 1440x900 and 390x844: identical for every item (fixed heights on the options area, name and description); the spot's name, doughnut, Add and chips keep the same top across all eight flavours
R3i.3 n/a: no live readout tied to scroll beyond the flavour count (a true fact)
R3s.21 pass: check-site BROKEN passes on every page: no script or console errors, no 404s, no dead links between pages

## 8. Phone
R3b.6 pass: on a phone the bar shows From ₪16 or the basket total with Order, from after the first screen until the order section, hidden over the film, the spot and the shop stage which carry their own price and button (390x844 and 360x640 with touch emulation, whole scroll)
R3f.7 pass: looked at 360x640 with touch emulation: the bar's label wraps and its button (84px wide) stays whole inside the screen
R3a.6 pass: check-site PHONE passes: the bar never covers a button or the last line (the page keeps room for it)
R3s.22 pass: check-site TAP passes: everything to tap is at least 40px and none overlap (the home mark is 44px)
R3s.23 pass: check-site PHONE passes: no sideways scroll at 390x844 and 360x640
R3s.26 pass: check-site OVERLAP passes at 1366x768, 1280x720, 1440x900 and 390x844: no words on other words
R3t.1 pass: CONCEPT.md and a site-category meta food-shop on every page; the page follows the food-shop row on the owner's own dark ground (rule 3t's owner look wins): product shot as a cut-out on a flat ground, buy from the first screen, a tight type family, a kitchen band mid-page
R3t.2 pass: check-site BUY passes: price and Order within the first screen; every card has photo, name, what it is, price and a button
R3t.3 n/a: the site is food-shop, not trainer
R3t.4 pass: footer of every page identical: the closing line, the Order button, WhatsApp and email, a giant BAKE AWAY with her card line, page links and the MyIsraelRental line
R3a.7 pass: phones checked and screenshotted with touch emulation (isMobile and hasTouch) at 390x844 and 360x640; the hover-only slide on the cards has no touch version because the same line is in the shop and the facts, and is hidden on touch
R3a.8 pass: no dotted lines of items exist on the pages; the footer links use a dot between names and fit on one line at 360x640

## 9. Finish
R3r.3 pass: check-build was run after the last edit: check-site, check-fits, check-motion and readable on all three pages, then check-concept, check-fingerprints and check-rules; the fixes were checked on the screens they were for
R3r.4 pass: no new Tzvi correction since the last build is missing from this file; the photo-shape rule (3c.12) is followed by showing every photo whole
