# Blueprint: gifted-israel

Every rule of docs/rules-checklist.md, in the order the site is built. Before building a stage, write the plan for
each of its lines (what this site will do for that rule, or `n/a: <why the site has no such thing>`), then
`node scripts/blueprint.mjs --check gifted-israel <stage>`. Tick [x] as each is built. RULES.md is written from this
file (`--rules`); the scripts named in a line confirm it at publish.

## Stage 1. Facts and words

- [x] R0b.1 Published under the business's real slug from the live record, not a made-up one
  plan: gifted-israel, read from the public business record, in gen/shoot paths and sitekit og links
- [x] R0b.3 Prices and currency on the page match the owner's own menu or flyer; the real menu is loaded in their shop with fixed product ids
  plan: Prices are their own website's (gen/assets.py) and match their WhatsApp catalogue apart from four listed in gen/catalog/whatsapp-check.md and asked; loaded into their live shop with fixed ids on 5 Nov 2026 (gen/catalog/load_products.py), on Tzvi yes
- [x] R2.1 Only facts the owner or record gave: no invented number, "since", "fresh daily", "trusted by", guest counts
  plan: Facts only from their flyer, listing and GiftedIsrael.com; no founding year, so no since line; 161 and from 30 are counted from their catalogue
- [x] R2.2 The owner is asked only about their own business, never how we build (no tools, credits, vendors), and never what the record already answers
  plan: OWNER-QUESTIONS.md asks only about the business: name, numbers, delivery, engraving, finishes, gift sets, prices, paying
- [x] R2.3 The message to the owner has 5 to 8 example FAQ questions written from this business's real details, plus the worry / first days / photo-in-use questions when the page does not answer them
  plan: OWNER-QUESTIONS.md question 14 has eight questions from their pieces (Chanukah timing, gift wrap, Lucite near flames, cleaning, sets)
- [x] R3.1 Every claim has proof: kosher needs a certificate and a food business; licensed needs a licence number; verified; reviews/stars need real reviews; years need a founding year; English needs English among their languages; best, #1, award, guarantee, insured, 24/7, emergency, fresh daily, delivery, medical words only in the owner's own words
  plan: No kosher, licence, review, year or guarantee claim; "We deliver" is their flyer's own words
- [x] R3.2 No urgency or scarcity: only N left, hurry, today only, limited time, ends soon, countdowns without a real end date, booked N times, invented counters
  plan: No urgency anywhere; their "ends at midnight" line from their own site is left out
- [x] R3.3 No sentence that fits any business (welcome to, look no further, one-stop shop, passionate about, quality you can trust, world-class, top-notch, and Hebrew equivalents)
  plan: Read through: every line names their pieces or Waterdale
- [x] R3.4 No exclamation marks, no long dashes, no words in capitals unless their name
  plan: No exclamation marks or long dashes; capitals only in the small label style and their name GIFTED
- [x] R3.5 The headline or the line under it names something they really sell, in the words of their own listings (a place name alone does not count)
  plan: The line under the headline names Shabbos, Havdalah and Chanukah pieces, their own categories
- [x] R3.6 Everything written is in the page's language; a Hebrew page is Hebrew in every line and is written, not translated; RTL layout checked
  plan: English site as their own site is; Hebrew appears only on the products themselves
- [x] R3.7 Nothing missing is faked: no FAQ section until the owner sends questions and answers, no reviews/social proof unless real and consented, no empty section, no placeholder or "coming soon"
  plan: FAQ and gallery stay hidden until the owner fills them; no reviews; no placeholder text on the page
- [x] R3.8 No logo walls, "As seen on", award laurels, invented "Best match / Popular" badges, stars or counts without real reviews, "$80 of value" gifts, intro prices that renew higher
  plan: No logos, badges, stars or invented picks
- [x] R3.9 The page repeats the promise that brought the visitor, and its words match the ad, flyer or message that sent them
  plan: Same line as their flyer and listing: For all your gifting needs, a full line of Waterdale products in Israel
- [x] R3.10 At most two strengths, each checkable and with its proof
  plan: One strength: the full Waterdale line in Israel, in their own words; engraving is shown, not claimed
- [x] R5.1 Their words first and specific: every line could only be about this business; a line a competitor could say is rewritten; the customer's problem comes before what they do
  plan: Their words first: flyer headline, listing description, site's gift help line
- [x] R5.2 Professional voice: no teasing, scolding, slang or jokes; the owner would print every line on their menu
  plan: Plain and calm, nothing the owner would not print
- [x] R5.3 Short labels are full phrases ("Kosher, hechsher from Rabbi Weiner", "Made in Jerusalem, delivered across Israel")
  plan: n/a: no certificate or licence to label; the labels are product names
- [x] R5.4 The visitor is "you"; the business is "we" or its name, never "they", "them" or "their" about itself, in labels, errors, captions, alt text and footers; every English line makes sense said by the owner
  plan: We and you everywhere, including hints, alt text and errors
- [x] R5b.2 One button, one label: the main button has the same words and the same destination in the header bar, hero, selling sections, phone bar and footer (over a photo the bar's version may be the outline style)
  plan: Shop the collection to shop.html in the bar, opening, phone bar, closing band and footer; once the basket has something the bar button reads Basket and goes to it
- [x] R5b.8 A finish or closing line names what the customer gains, never "done" or "complete"; every line makes sense where it sits; "or" and "prefer" only when the other choice is visible
  plan: Closing line is their own: For all your gifting needs; the send line says what happens next
- [x] R3.11 The headline says what the customer gets (their result, in the owner's words), and the order of the page follows the visitor's questions: what is it, can I trust it, what does it cost, what do I do; prices come before any enquiry form
  plan: Headline in their words; order follows the questions: what it is, the pieces with prices, engraving, categories, who we are, how ordering works
- [x] R3o.4 Every contact is labelled by what it does ("WhatsApp or call", "Call only, no WhatsApp"); the owner said which number takes what
  plan: WhatsApp and Call labelled as their flyer and site show them; the rest is asked in question 2
- [x] R3e.22 The owner stays visible as a person: name, real photo, direct WhatsApp
  plan: Direct WhatsApp is everywhere; the owner's name and photo are asked in question 1 and go into the who-we-are section when answered, never guessed
- [x] R3s.19 The same promise line and photos on the link preview, home page and shop; every page has its own title, description and og:title/og:description/og:image
  plan: Same line in the share text, home and shop; each page has its own title, description and og tags
- [x] R6.1 The category playbook's lead block comes first and its must-have blocks are there
  plan: Shops playbook: product grid just below the first screen, then occasions and how ordering works
- [x] R4.1 Missing data reads as deliberate ("Ask for a quote" instead of a missing price) and is listed as a content gap, never invented
  plan: Delivery fee reads "we confirm the fee on WhatsApp"; engraving price the same; gaps listed in OWNER-QUESTIONS.md

## Stage 2. Photos and media

- [x] R8.1 A set of images shown side by side (category tiles, product grids, size or flavour photos, thumbnails) reads as one shoot: same camera angle, same light from the same side, same plain background, subject at the same size and crop
  plan: All product photos are one studio white from their own site; five with another ground (bibs, napkin rings) are named in the report for better photos
- [x] R8.6 Every main product picture is a product hero shot: one product large and sharp, eye level, slightly turned, on a plinth from its own world, its own real ingredients round it, one colour story, one warm light, still or mid-air (not both); the product is exactly theirs
  plan: Their own studio shots: one product large and sharp on white, as sold
- [x] R8.7 Every paid generation had a gen/<name>-brief.md first: a close crop of the one item, its traits written from the crop and kept, only the camera, light or setting changed, no idealising words, still before video, result compared beside their photo before showing
  plan: Fourteen empty sets generated (gen/backdrops-brief.md), no item in them: every piece on the site is their own photo laid over one, nothing of theirs redrawn
- [x] R8.2 The set came from the owner's own matching photos first; else the whole set generated in one pass from one style preamble (product pictures are edited from their own photo, never made again from words alone); stock only from one photographer's matching series; no cut-outs mixed from many photos
  plan: The set is their own matching photos; where the main photo was off-ground another of the same piece on white is used (gen/assets.py ALT)
- [x] R3p.7 Similar items are shown the same way: if one flavour's thumbnail is one jar, every flavour's is one jar; a list where pointing at an item changes a big photo does so for every item
  plan: Every item is shown the same way: one square photo on white
- [x] R3h.12 One look per product everywhere: film frame, close-up, picker, tile, card and order form show the same object, cut or edited from one master; a name with unknown look gets no picture
  plan: Each piece is one cut-out from its one master photo, set in its room and on its card and sheet the same way (gen/backdrops.py, gen/rooms_layers.py)
- [x] R3h.10 Choosing an option changes its picture, words and button; one photo per option, from one shoot, sharp at the size shown (check: motion)
  plan: Finish and nusach chips change the words and order line; their photos show one finish, so the picture stays and the piece says so (question 5)
- [x] R3g.14 One colour grade across every image and clip on the page
  plan: One studio white across the product photos; the one clip is their own warm-white footage
- [x] R3o.1 Generated food in motion appears only in the full-screen opening film (advert style, checked frame by frame at 4 fps or more: no food from nowhere, no glass or neon look, pieces never fade or vanish); everywhere else on the page food is the owner's real photo; outside the film generate only scenery, light, steam or a plain drawing
  plan: n/a: not food
- [x] R3o.2 A generated liquid (opening film only) is opaque, satin, with specks, not glass or neon
  plan: n/a: no liquid generated
- [x] R3o.3 Product colours look true (no cast from cloth or light)
  plan: Their studio photos unedited apart from size
- [x] R3o.6 One photo per kind, from everything the owner sent, duplicates skipped, unclear kinds asked about; screenshots cropped at their real resolution
  plan: Every product once, doubles merged (Scalloped Finger Towel) and checked against the WhatsApp catalogue; flyer not used as a picture
- [x] R8.3 Generated media only of items they really sell; no generated person shown as their staff or customer; no made-up premises; no text baked into an image; nothing non-kosher in a kosher business's images; the owner approved every piece
  plan: Fourteen empty sets generated (gen/backdrops-brief.md), no item in them: every piece on the site is their own photo laid over one, nothing of theirs redrawn
- [x] R8.4 Any moving real material (ribbon, fabric, steam, a pour) is a generated clip made in Higgsfield (kie.ai only if Higgsfield cannot), showing cause then effect, never SVG or CSS; food in motion only per R3o.1; reduced motion shows the still
  plan: n/a: no moving real material; the only clip is their own video
- [x] R3c.13 Nothing cut off: every label, number, ruler and photo sits wholly in its section at every size (only things marked `data-clip-ok` may be cut while travelling) (check: clipped)
  plan: clipped and fits scripts pass on all pages
- [x] R3c.14 A cut-out is one subject: no stray garnish, specks or pale fringe, looked at on a dark and a light ground (check: cutout)
  plan: n/a: no cut-outs; pieces stay on their own white, the logo mark checked on light and dark
- [x] R5b.3 Text over imagery: words sit on the picture with a soft edge shade (or a small solid card), never big dark pools, full-frame darkening or frosted glass, and meet contrast at the brightest frame; on a phone they cover at most 40% of the opening picture's detail; a plain strip under the photo only where the picture is too busy (check: readable)
  plan: Words sit on a stone card or along the floor line, never over a piece; the big room name is behind the piece, and the piece is laid over it
- [x] R3e.8 Every word is at least 12 px (14 px for a sentence on a phone) and 4.5:1 contrast (3:1 large), button text 4.5:1 on its fill (check: readable)
  plan: readable script passes; smallest text is the scale's --t-1 at 13 px in labels only
- [x] R3s.24 Media is light and sized: no photo over 600 KB, every `<img>` has width and height, every video has a poster, nothing stays hidden with motion off (check: site)
  plan: Product photos 800 px webp around 30 KB, width and height on every img, video has a poster
- [x] R3p.6 Fits on one screen: every section fits below the menu bar at the laptop sizes; no photo taller than the screen at any of the six sizes; no photo shown over 1.35x its own size; a big photo of another shape than its box is extended to the box's shape (padded, the new edges generated, the original pasted back), never zoomed or framed (3c.12, Tzvi 27 Oct) (check: fits)
  plan: fits script passes at the six sizes; the pieces are their photos cut off their white, the floor is made in code; item pictures are their photos over a generated empty set (gen/backdrops.py), never cropped
- [x] R3o.5 Every special character (₪, arrows, Hebrew, dots) renders in the font used for it (check: site)
  plan: Shekel sign and Hebrew render in Alef; arrows in the body face
- [x] R3x.7 BRAND.md in the build folder (colours with their uses, two fonts, logo on light and dark, textures, Design bans) was written before any picture was generated, and the site uses it
  plan: BRAND.md written before any picture; none generated; site.css follows it

## Stage 3. Opening

- [x] R3g.13 The first screen holds a picture, a headline of 2 to 5 words that says what the customer gets, at most one short line (where the business is: the line or the small label, not both; trust goes there or right under the button) and one button; the header does not count
  plan: Picture, five-word headline, one line, one button; the small label says where; trust facts under the button
- [x] R3g.18 The first screen shows what the business offers before any scroll: one kind may be shown by the picture or the words; two or more different kinds are each named in the headline or big words; the home page lists them in <meta name="offers"> (check: check-says-offer)
  plan: One kind of offer, gifts: the headline says "For all your gifting needs" on the first screen over their piece in its room, and each room names its kind of gift huge; <meta name="offers" content="gifts"> on the home page; check-says-offer passes
- [x] R3b.1 The first screen answers: what it is, where, why trust it, what to do next
  plan: What and where in the label and line, trust as prices and the count, next step the button
- [x] R3b.2 Proof (price, credential or rating) touches the main button; for food a kosher band sits just after the opening, not crowding the button, and the certificate is stated at most twice as a sentence or band (a small identical kosher tag on items does not count)
  plan: n/a: not a food business, nothing on the site says kosher
- [x] R3b.3 One solid action per screen: header button and phone bar repeat it; the header button is outline when the hero shows a solid one; everything else is outline, link or tile
  plan: One red button per screen; header outline; everything else link, tile or chip
- [x] R3h.20 A scroll-driven opening runs at 60 fps, is at least 3 screens long, shows the product on a plain ground of its own world (never on a photo of the same kind of product), keeps the product and photos whole, and loads the first screen first (check: check-opening-scroll)
  plan: n/a: no scroll-driven opening; the first screen plays on arrival and on each tap
- [x] R3h.21 Effects, never too much: the opening film may hold the page for its length; any other section that holds the page while the scroll changes it is at most a screen and a half, at most three in all; longer turning becomes a tap; nothing stands between a phone visitor and the products or the order (check: check-one-scroll)
  plan: Nothing holds the scroll anywhere on the site
- [x] R3h.22 A film starts as one storyboard sheet of rough line drawings (one row per concept, 3 to 4 panels), approved by Tzvi before any photoreal still; only the chosen concept is made as stills
  plan: n/a: no film on this site; the opening is an event built in code from their own photos in generated rooms (GI-F2), no clip
- [x] R3h.23 Every film clip passes check-clip (no JUMP, RUSH, BLANK, VANISH or APPEAR), its brief has "How it really happens" from a real reference and a "Key moment" with its own clip, and each numbered step was ticked off against the clip at 8 fps (check: check-clip)
  plan: n/a: no film on this site; the opening is an event built in code from their own photos in generated rooms (GI-F2), no clip
- [x] R3h.24 A scroll film is real video tied exactly to the scroll (data-video, every frame a keyframe, starter/film.js): within 0.4 s of the scroll and never still over 400 ms or on over 15% of frames while scrolling, laptop and phone, in real Chrome (check: check-film-video)
  plan: n/a: no film on this site; the opening is an event built in code from their own photos in generated rooms (GI-F2), no clip
- [x] R3h.25 Nothing covers a scroll film while it plays: at 20, 40 and 60% of the film, on a laptop and a phone, words, cards and names cover at most 3% of it (the site's menu bar aside); the words wait for its end or sit beside or under it (check: check-film-clear)
  plan: n/a: no film on this site; the opening is an event built in code from their own photos in generated rooms (GI-F2), no clip
- [x] R3h.1 The home page opens on a full-screen picture or film (at least 70% picture) and it is an event from their own thing (a film, or an event built in code), proposed with the first build, never after (check: site)
  plan: A real event from what they are: the scroll walks through seven rooms, one per category, each wiping into the next with their own piece on its stone and the name behind it (Tzvi, 9 Nov 2026: "yes 1"); built in code, the rooms are the generated sets of the shop pictures made at the screen shapes
- [x] R3n.1 The owner's strongest real photo fills at least half the first screen on a laptop and on a phone, not a small card or cut-out shape
  plan: Their photo fills the first screen on its own white, the menorah about half of a laptop and the top half of a phone
- [x] R3n.2 One signature moment only this business could have, driven by the visitor (scroll scene or a choice)
  plan: The visitor leads: the scroll walks the rooms, and the room list on a laptop jumps to any of them
- [x] R3n.3 The visitor's choice changes the page (colour, hero, order), not just one picture (check: motion)
  plan: What is typed changes the piece, the button words, the basket line and the WhatsApp order
- [x] R3n.4 Side by side with the closest reference in docs/inspo for this kind of business, ours is not plainly weaker
  plan: Beside Moto's product on a plinth and Kalstore's personalisation in CONCEPT.md: ours shows it on the real piece
- [x] R3n.5 The one-sentence test, told to someone else and run on the first five seconds and the first full scroll: "you land and ___ happens" is about the business, not a decoration ("nothing", "the camera moves", "it fades in" fail)
  plan: You land in a honey room where their Mayim Achronim settles on an onyx block with SHABBOS behind it, then scrolling wipes in Havdalah, Home, Judaica, Rosh Hashana, Chanukah and Games, one coloured room each
- [x] R3g.15 The opening is made for this business at full quality: never a flyer crop or low-resolution photo, and a generated setting is never presented as their real premises (check: fits)
  plan: Their full-size studio photo, never a flyer crop; no setting made up
- [x] R3h.2 A film opening goes from where the product comes from to their real product and the button, every step true
  plan: n/a: no film on this site; the opening is an event built in code from their own photos in generated rooms (GI-F2), no clip
- [x] R3h.3 A film is full screen, crisp, drawn as sharp frames or near-lossless video at screen size, never shrunk, masked or in a column
  plan: n/a: no film on this site; the opening is an event built in code from their own photos in generated rooms (GI-F2), no clip
- [x] R3h.5 A film's chapter lines are 2 to 6 words, small, at an edge, at most a third of the screen's height, on a soft edge shade only, never over the action (check: readable)
  plan: n/a: no film on this site; the opening is an event built in code from their own photos in generated rooms (GI-F2), no clip
- [x] R3h.7 A film's seams are checked: each join compared, a jumping clip regenerated
  plan: n/a: no film on this site; the opening is an event built in code from their own photos in generated rooms (GI-F2), no clip
- [x] R3h.8 The section after a lit film changes the mood boldly
  plan: n/a: no film on this site; the opening is an event built in code from their own photos in generated rooms (GI-F2), no clip
- [x] R3h.11 Every film and generated still set is bright: middle third at least 33, whole frame at least 22, average at least 30; the subject is the brightest thing; viewed on a phone in daylight (check: brightness)
  plan: n/a: no film on this site; the opening is an event built in code from their own photos in generated rooms (GI-F2), no clip
- [x] R3h.13 One cause, one motion: the cause and its result are one clip, code pieces start on the cause frame and match the film's material, and the effect passes a 4 fps watch (no fall-then-fly, no pause, no blocks for flakes, no heap from nowhere, nothing wrong played backwards)
  plan: n/a: no film on this site; the opening is an event built in code from their own photos in generated rooms (GI-F2), no clip
- [x] R3h.14 The product stays recognisable through the whole effect; a moving camera never loses it; on a phone the frame widens if pieces travel past the crop
  plan: n/a: no film on this site; the opening is an event built in code from their own photos in generated rooms (GI-F2), no clip
- [x] R3h.18 The film is physically possible: every object on screen is listed with where it comes from and where it goes (in frame, enters or leaves past an edge, cut from something seen); nothing appears, turns into something else or vanishes in a way that looks off at normal speed (something filling in naturally is fine: Tzvi, 26 Oct); list shown with the steps before generating
  plan: n/a: no film on this site; the opening is an event built in code from their own photos in generated rooms (GI-F2), no clip
- [x] R3h.19 Generate once, by choosing a physically possible story before generating (a better prompt only helps a little; a failed clip changes the story, not just the prompt): each clip's start and end frames hold the same objects (or they enter or leave past an edge), one kind of action per clip, clips chained by stills made and checked before any video, frame 1 / middle / last written in the brief first, at most two tries per clip
  plan: n/a: no film on this site; the opening is an event built in code from their own photos in generated rooms (GI-F2), no clip
- [x] R3h.17 Words and film take turns: a giant name sits on plain ground, the film appears as letters part, the film moves aside before the headline arrives (check: readable)
  plan: n/a: no film on this site; the opening is an event built in code from their own photos in generated rooms (GI-F2), no clip
- [x] R3x.5 A following light is used only for a dark-world business, has an off button, sweeps once by itself on a phone and with reduced motion, and never dims the words or main button
  plan: n/a: no following light; not a dark-world business

## Stage 4. Sections

- [x] R3.12 Sections every page has: a dramatic hero, a features section (one scannable item per product or service with price and what is included), a call-to-action section of its own near the end with the proof beside the button
  plan: Hero with the event, product grid with prices, closing band with the button and contacts
- [x] R3c.1 References came first: 3 to 5 real screens of businesses of the same kind kept, each with its source link in CONCEPT.md; the builder chose and said in one line what was picked and why (fresh searches per piece: R3g.17) (check: concept)
  plan: REFERENCES.md and CONCEPT.md with links; one line in Chosen
- [x] R3g.17 Every piece (button, arrow, each card or list effect, each section) came from a fresh Mobbin, 21st and Inspo search for this business, with the source named; nothing reused from the last two pages; each effect has a reason (says what a control does) (check: concept)
  plan: Fresh Mobbin, 21st and Inspo searches named in CONCEPT.md Effects
- [x] R3g.19 Shops (food-shop, fashion-shop): the main buttons are in the product's own colour, taken from its photo (meta product-colour with data-from, in BRAND.md), text 4.5:1 on it, and each button stands out 3:1 from what is behind it; n/a for other categories (check: check-button-colour)
  plan: Main buttons in gift red #6F0D0C, within 16 of the pomegranate red #7A351B on their Rosh Hashanah Painted Pomegranate Honey Dish (assets/g/gia0015d7c59.webp), written in BRAND.md and <meta name="product-colour"> with data-from; white text 12.6:1; check-button-colour passes on phone and laptop
- [x] R3c.2 No AI default look: not cream + serif + one italic word (unless their brand), no default font, purple or two-colour gradient, exactly three identical cards, frosted glass used everywhere, default "premium" palette; at least one section on a contrasting ground
  plan: White with one stone room and a red band; thin serif on white is the shop category, no italic word, no gradient, not three identical cards
- [x] R3g.1 A style sheet exists in CONCEPT.md before building (accent, ink, ground, two faces plus at most a third for one label style, one radius, motion limits) and every section follows it
  plan: Style sheet in CONCEPT.md and BRAND.md, followed in site.css
- [x] R3g.3 The accent colour is used for the main button only; prices and everything else are in the main text colour, prices bold and large; at most one emphasised word per screen, set apart by weight or style in the text colour
  plan: Red on the main button and closing band only; prices bold in ink; no emphasised words
- [x] R3g.7 At most one closing signature (giant cropped name, or one playful moment in the footer/404), never in the way of the order path
  plan: One closing signature: the giant thin GIFTED in their red band, below the button
- [x] R3g.11 Fonts come from the approved Latin + Hebrew list, licence checked
  plan: David Libre and Alef from the approved list, SIL Open Font licence
- [x] R3p.3 Not alike: no heading face shared with another site, no shared body face plus script, no two brand colours alike, design different on at least 4 of 6, effects overlap at most 2 points (check: prints)
  plan: check-fingerprints passes; new faces, their own red
- [x] R3p.5 One small touch only this business would have, from their product, tagline or craft (check: concept)
  plan: The basket count sits in a small gift box like their logo
- [x] R3q.1 CONCEPT.md is complete: 3 or more ideas each citing a saved effect picture, an "Own:" idea, which was chosen, the five wow answers, an Effects line per kind, the "Not alike" line (check: concept)
  plan: CONCEPT.md complete, check-concept passes
- [x] R5a.7 One signature idea and one peak per page; at most one signature scroll section; the ending resolves on the action; not carried over from another business
  plan: One signature, the seven rooms; the page ends on the shop button
- [x] R9.1 The page's signature section is used only when their own photos or items support it; a page without the right material stays still
  plan: Engraving is on 11 of their pieces and the base is a flat face in their own photo
- [x] R3f.2 The effect budget is filled and ticked on captured frames: one signature moment (held where it fits 1280x650, otherwise playing as the page scrolls), at least three accents (arriving opening, a scroll-tied detail mid-page, a closing payoff), quiet touches
  plan: Signature the rooms; accents: typed engraving, occasion cards opening, closing band; quiet: button press, arrows, reflection on cards
- [x] R3m.1 A gallery place on every designed page (`data-mir-gallery` with template), and priced products inside `data-mir-catalog` with `data-mir-list`, group and item templates
  plan: Gallery place on the home page; the shop's products are in data-mir-catalog with list, group and item templates
- [x] R3m.3 Details the owner changes (hours, areas and fees, guarantee, FAQ, reviews) sit in fixed places with length limits, never free text boxes
  plan: Delivery, FAQ and gallery sit in fixed places; product details come from the catalogue
- [x] R3k.1 The site is pages by kind of business; the menu and the order are ONE page (the Shop, or Book); old Menu/Order addresses forward to it
  plan: Home, Shop (menu and order on one page), Contact
- [x] R3k.2 One identical menu bar on every page (name to Home, pages, the one Order/Book button with basket count, `aria-current="page"`); on a phone it folds into a Menu button with Close that closes on Escape or a link tap
  plan: One bar from sitekit with aria-current, phone Menu with Close, Escape and link tap
- [x] R3k.4 Shared `site.css` and `site.js` serve every page; a page-section class name (`.open`, `.in`) is never reused for a shared part's state
  plan: Shared site.css and site.js; state class names are my own
- [x] R8a.1 Nothing left over from 21st or generated components: no demo headline, name, review, star count, statistic, logo wall or stock photo; no network calls, tracking or new script tags; restyled in the business's tokens
  plan: Only the engraved-letter idea was rebuilt in CSS; no demo text, no packages, no network calls
- [x] R3b.4 With few photos, facts carry the page (offers, key facts), nothing padded; for a place, hours and where come before the description
  plan: n/a: 161 product photos, a full shop; not a place with hours
- [x] R3c.3 Proof sits where the worry is: each worry the owner named is answered beside the button or price it belongs to; no wall of one-line reviews
  plan: Worries answered where they arise: the engraving line beside the field, the delivery fee line beside the address
- [x] R3c.8 If the owner told us what happens after the order or booking, the page and tracking page say it first
  plan: How ordering works section and the send note say your order opens in WhatsApp and we confirm it there
- [x] R3e.10 Cards have one reading order (name largest, one emphasised fact, usually the price in the main text colour, bold and large, the rest lighter), big photos; long names truncate; an icon on a photo sits on a solid circle or gradient (check: site)
  plan: Name, then price bold at the right, big photo on top; long names cut at two lines
- [x] R3e.14 One body family in up to three weights and at most six text sizes; spacing on a 4 px grid, related close, unrelated apart
  plan: Alef in two weights on the scale, spacing on the --s steps
- [x] R3c.9 One quiet system: one corner radius for images and buttons, one icon set (lucide), one soft shadow (3s.3: about 3 px down, 30 px blur, no spread, tinted with the background or brand colour, never black), no two-colour gradients, no decorative arrows or outlines
  plan: One radius 6 px, one shadow tinted red or warm; no gradients but the card reflection
- [x] R3s.4 One left edge: headings, text and buttons line up on the same margin (check: site)
  plan: Opening, sections and footer share the wrap's left edge
- [x] R3s.6 Controls that do the same job look the same (height, corner, style) (check: site)
  plan: Chips share one height and style; buttons share one
- [x] R3s.7 Buttons in sentence case, pale dividers, no "Price:" style labels, body lines 1.5 to 1.6 apart, contrast never lowered to look soft
  plan: Sentence case buttons, pale lines, no Price: labels, body 1.6
- [x] R3s.9 One colour per meaning everywhere (the kosher tag looks the same on every item)
  plan: n/a: not a food business, nothing on the site says kosher
- [x] R3s.12 The maker and their real work come right after the opening, with at least one real photo of the product in use or a real setting
  plan: Their own Chanukah clip in a real setting, with who they are, after the shop grid and engraving because a shop sells first (3t)
- [x] R3s.14 Real numbers shown big (three times the body size) with a one-line label, only numbers the owner gave
  plan: n/a: the only numbers are the count and from-price under the button, no big-number section
- [x] R3s.11 One true sentence beside the price says why it costs that (handmade, the ingredient, the time)
  plan: Each piece's own line in the product sheet says what it is made of, from their description
- [x] R5b.6 No scroll cues, no "01/06" counters, no label above every section
  plan: No scroll cues or counters; the one small label is on the opening only
- [x] R3.13 Structure: no doubled contact, facts or gallery; no two dividers in a row, no ending on one; only their own photos that exist; a photo gallery has at least 3
  plan: Reach us once in close and footer as the kit lays out; gallery hidden until 3 or more
- [x] R3a.1 The page was rendered as a visitor meets it (the six sizes of 3p.6, each language, normal and reduced motion), every screen looked at, a scroll page walked at several positions per section, every payoff checked at its start and finish on a phone and laptop
  plan: Rendered at six sizes by the scripts, looked at on laptop and phone, gen/look/
- [x] R3r.1 Every script above was run on EVERY page of the site, not only the home page
  plan: check-build runs them on all three pages
- [x] R3r.2 Someone who did not build the page used it against `docs/page-review-checklist.md`, the builder fixed every FAIL and the reviewer looked again
  plan: review.md from a Sonnet subagent that did not build the site
- [x] R3g.12 A real test went through every form and order button (to a test business, never the owner's live inbox) before the owner saw it
  plan: Order flow run to the end locally with the save answered by a test route, never their inbox (gen/test_order.mjs)
- [x] R0b.12 The business's pages-list preview clip shows the current version of the page
  plan: publish-page re-records the clip when Tzvi approves publishing; this site is not on the list yet
- [x] R3x.1 A product to turn is made from the owner's photo through the API and compared beside it; its dots (at most four, 44 px) say only the owner's facts; buttons turn it too; it loads after the page and is their photo with no script or reduced motion
  plan: n/a: clear Lucite fails the 3D suitability check; their photo is used
- [x] R3x.2 A counted number is a real figure from the record, counts once, ends exact, and is in the page text so it shows with no script or reduced motion
  plan: n/a: no number counts
- [x] R3x.3 Tabs for sizes or packages change one panel in place: picture, price and facts stay in the same spot
  plan: n/a: no tabs; a piece's choices are chips
- [x] R3x.4 With two or more sizes or packages, each is a card with its picture, price and the same measures in the same order
  plan: n/a: no sizes or packages to compare
- [x] R3x.11 A product to turn passed the suitability check, was made from a grey-ground source of the owner's photo as two candidates reviewed from four angles, has two or three light buttons named for the business, and keeps touch-action pan-y on a phone
  plan: n/a: no product to turn

## Stage 5. Site structure (menu, footer, facts, layouts)

- [x] R3v.1 A full footer, the same on every page: who they are (name, one line, a quiet link to the main action), every page, how ordering works or Visit, Reach us, and a base line with © year, the MyIsraelRental line and a Privacy link; parts only when the record fills them (check: check-footer)
  plan: Footer from sitekit: name and their line, pages, ordering from their words, reach us, base line; no founding year so no since
- [x] R3v.2 The menu bar lists the site's pages, the same on every page; a site with other pages has no #jumps in the bar; order and booking steps may keep a quieter bar (check: check-menu)
  plan: Bar lists Home, Shop, Contact on every page
- [x] R3v.6 Sections of different heights: at least two sizes on a page, never three in a row the same height (check: check-heights)
  plan: Sections of clearly different heights
- [x] R3v.7 Layouts (bento, zigzag steps, callouts, picture beside four facts, peek row) chosen by what the business has, never the same layout twice in a row on a page
  plan: Full-screen picture, one row of four, picture beside form, tall cards, clip beside words, three facts: no layout twice in a row
- [x] R3v.8 Effects from 3v (light on cards, fanned photos, rolling letters, circle reveal, curtain between pages, picture buttons, statement band) are chosen for this business, not the set of the site built before it, each with its phone and reduced-motion version
  plan: None of the 3v set; own effects chosen for this business, each with phone and reduced-motion versions
- [x] R3v.14 Three true facts from the record right under the main button on the home page (class btn-facts) (check: check-facts)
  plan: From 30 shekels, 161 pieces, we deliver, from their catalogue and flyer, one row with dots
- [x] R3x.8 Web basics on every page: skip link first, one h1 and no skipped levels, focus rings, labelled fields with type and autocomplete, live basket count and form messages, opening picture first and far ones lazy, two font families at most, title 60 and description 155 at most, og:title and a 1200x630 share picture, JSON-LD for the business on the home page (check: check-web-basics)
  plan: sitekit parts, one h1, labels and autocomplete, live regions, lazy images, Store JSON-LD; check-web-basics passes
- [x] R3x.13 One type scale and one spacing scale: every text size is a step of --t-1 to --t5 and every gap of --s1 to --s10, recorded in BRAND.md; at most 10 text sizes on a page (check: check-web-basics)
  plan: Every size from the starter scale and every gap from --s; recorded in BRAND.md

## Stage 6. Prices and savings

- [x] R3c.5 Choices (sizes, flavours, tiers) are tiles to tap, never a dropdown; "Most popular" only when the owner says so
  plan: Finish, nusach and delivery are tiles to tap; no Most popular
- [x] R3c.6 The button says what happens next with a real number where there is one ("Order 4 buns, ₪55"), never "Submit" or "Buy now"; price, unit and action sit together
  plan: Add 2, 770 shekels; Send for Thursday with the total
- [x] R3c.7 Offers are contained: a time-limited offer shows its real end date, a first-order offer says so, standing discounts (students, soldiers, olim) need no date, "ends soon" without a real date is banned; no permanent sale, no discount on their famous item unless they say
  plan: n/a: the record and their words give no saving; every piece shows its one price
- [x] R3j.1 A guarantee the owner offers sits beside the main button in their words and states its limit; none offered means none shown
  plan: n/a: no guarantee offered in anything they wrote; question 13 asks
- [x] R3j.2 One real relevant add-on before ordering, with Add and "No thanks", not pre-ticked, gone once added or declined
  plan: n/a: no add-on they named; matching sets are asked in question 14
- [x] R3j.3 A free taster, sample, consultation or quote the owner really offers is the headline offer beside the main button
  plan: n/a: no free offer in their words
- [x] R3j.4 Group discounts (students, soldiers, first order, olim) only when the owner offers them, said once near the price; they are standing, so no end date is needed
  plan: n/a: no group discounts offered
- [x] R3j.5 Come-back features only if real: a stamp card the owner runs, a Reorder button; no streaks, valueless points, or reminders for something not started
  plan: n/a: no stamp card or come-back offer
- [x] R3j.6 The natural pick among three sizes/packages is shown, but no invented option to make another look good
  plan: n/a: pieces are not sizes or packages
- [x] R3j.7 Never: a struck-through or "was" price that is not real, prices changed to .90/.99 endings, an endorsement they do not have
  plan: No was-prices; their ₪115 was ₪135 Megilla set waits for its date (question 9); prices kept as theirs
- [x] R3j.8 A saving is shown only when true like for like: same contents, same product line, worked out per unit in a table of every option, and the bigger option's unit price is lower than EVERY smaller option, measured against the cheapest
  plan: n/a: the record and their words give no saving; every piece shows its one price
- [x] R3j.9 A lone saving among many products is not shown, but each small group (single/double pack, 4/8 box, service with its add-on) shows its own
  plan: n/a: the record and their words give no saving; every piece shows its one price
- [x] R3j.10 A saving is shown as a percentage badge of two or three words ("25% off") with the real separate price struck through beside the new price; percentage = (separate minus new) / separate, rounded DOWN to a whole number; the button carries the offer and its price and no sentence explains it again; never how much more the bigger one costs
  plan: n/a: the record and their words give no saving; every piece shows its one price
- [x] R3j.11 A combined service against its parts, and basket lines a package would make cheaper (one line with the saving and a Switch button), are shown when real
  plan: n/a: the record and their words give no saving; every piece shows its one price
- [x] R3j.12 An owner's own savings claim the prices contradict is not printed; the owner is asked
  plan: n/a: they make no savings claim
- [x] R3.14 Loud prices only when prices exist, never on a premium or quote-based business
  plan: Prices calm and in ink, never loud, for a shop with real prices

## Stage 7. Order and booking flow

- [x] R3k.7 The order is in steps after choosing: Step 1 basket, Step 2 when and where, Step 3 details; a three-line "Step N: name" bar; order and total beside every step (under it on a phone); the button names the next step and, last, what happens with the total; a Back button; the browser back button goes back one step (#order-2); each step checks only its own fields (check: site)
  plan: Three steps, three-line step bar, order and total beside each, Back, browser back through #order-2 and -3
- [x] R3k.8 Every basket line, packages included, has a remove button (40 px, "Remove X from the basket") beside its stepper (check: site)
  plan: Remove button of 40 px beside each stepper
- [x] R3k.6 The basket lives between pages: an Add on any page puts the item in and opens the order page with it there
  plan: Basket in localStorage across pages; the engraving Add puts the menorah in and opens the order
- [x] R3k.9 Every order or booking is POSTed to MyIsraelRental (the business's order form) before WhatsApp opens; every product on the site is a product of the listing with the same name and price
  plan: Every order POSTs to their order form before WhatsApp; the ids are all in their live shop since 5 Nov 2026
- [x] R3k.10 The order form arrives filled in: the day field holds the first day the business can do (lead time, closures), quantity 1, the owner's most common choice pre-chosen; all changeable, a customer's pick never overwritten (check: check-prefill)
  plan: The day field holds tomorrow, moved off a Saturday; quantity 1; first finish and nusach chosen
- [x] R3.15 What the brief asks visitors to do has a place to do it (book or order needs the services block, message needs contact, visit needs hours and address)
  plan: Shop page with order; contact page
- [x] R7.1 Three options are for the automatic page builder only; a hand build picks one direction itself and says why in one line in CONCEPT.md, with no options page put to Tzvi or the owner unless asked
  plan: One direction picked, the reason in CONCEPT.md Chosen
- [x] R8.5 Every main button goes to the quickest route to a finished order the business has: its order page, then its price list, only then WhatsApp; WhatsApp stays the quiet secondary; the how-to-order steps describe the real path
  plan: Main buttons go to the shop; WhatsApp stays the quiet link
- [x] R0b.13 The order saves with a tracking link before opening WhatsApp, and the order reaches the owner complete
  plan: Every order, pickup or delivery, saves with its tracking link before WhatsApp: the ids and delivery are on in their live shop since 5 Nov 2026
- [x] R3l.1 For every family of similar items the owner was asked what a customer can choose and how many
  plan: OWNER-QUESTIONS.md 4, 5 and 12 ask about engraving, finishes, nusach and colours
- [x] R3l.2 Each item says on itself what it allows ("Up to 4 kinds of chicken · 3 sauces", "1 kind"), in the same words on the tile, the order line and the order message
  plan: Each piece says on its sheet what it allows; the same words on the order line and message
- [x] R3l.3 Choices belong to the item: options appear once it is added, only for items that allow them; one choice is radio; a limit greys out the rest; an item needing a choice cannot be sent without it, with the reason beside it
  plan: Chips only on pieces that have them, radio, always one chosen; engraving is optional
- [x] R3l.4 Three or more alike items are compared at a glance: only what differs, side by side
  plan: n/a: pieces are not sizes of one thing; a compare table has nothing to compare
- [x] R3l.6 A picture is of the item as it is sold now; no picture beats a misleading one
  plan: Their own photo of each piece as sold
- [x] R3l.7 Read each item alone: a customer can tell what they get and what they can choose without reading another item
  plan: Each sheet stands alone: name, price, what it is, sizes, choices
- [x] R3e.9 Buttons have rest, hover, pressed and disabled states; fields have focus and error states with a message; every action confirms ("Sent", "Copied"); anything hover-only has a phone version (check: site)
  plan: Buttons and fields have all states; fields show errors with a message; Added toast; hover has a tap version
- [x] R3e.19 Every flow has a visible end: a clear "Done" screen after ordering, lists that end, "Save and finish later" on long forms; progress shows only true numbers
  plan: The sent line after WhatsApp opens says what to do; the grid ends
- [x] R3s.16 Fewer choices first: a plain question ("How many people?") before a long list; the sensible option is chosen on purpose
  plan: Category tiles first on the shop and home
- [x] R3s.18 Not available shows the nearest real alternative; every choice list has a way out ("None", "Other", "I'm not sure")
  plan: Out of stock from the live shop is said and greyed; the WhatsApp link stays for anything else
- [x] R3s.25 The order or booking form sends nothing when empty and shows what is missing; filled, it sends a WhatsApp message carrying the total the page shows (check: site)
  plan: check-site FLOW: empty shows what is missing, filled sends the total
- [x] R3x.9 A request-type business's form builds a plain summary beside it as the fields fill, sends that summary, and states no price or promise the record lacks
  plan: n/a: a shop with a basket, not a request form
- [x] R3x.10 The prices or running total stay in view beside the order or booking form on a laptop, and a total line sits above the send button on a phone
  plan: The total stays in the sticky summary beside the steps on a laptop, and above the send button on a phone
- [x] R3x.14 The order page has the gift card section (SITE.gift_section, gift.js): hidden until the owner switches gift cards on, bought in place with no sign-in, and it shows only the owner's amounts, note and payment links (check: check-web-basics)
  plan: SITE.gift_section and gift.js on the shop page, hidden until they switch gift cards on; question 10 asks their amounts

## Stage 8. Motion

- [x] R3f.1 A scroll effect plays while its subject is wholly on screen (held on a stage that fits, or started only when all in view); captured at 0, 25, 50, 75 and 100 percent on laptop, short laptop and phone, the whole subject is visible and the effect is mid-way where it should be
  plan: The rooms follow the scroll; the first piece settles and its name slides in on load, whole subject on screen; transforms and clip only
- [x] R3f.8 A scroll-tied effect finishes while its subject is mid-screen (top on screen, centre no higher than 40%) at six sizes (check: scroll-finish)
  plan: n/a: no scroll-tied effect
- [x] R3f.9 A list that stacks on a phone runs item by item (each item lights at about 80% down)
  plan: n/a: no list that lights item by item
- [x] R3f.5 Text widths are in em or rem, never `ch`; a text shimmer is an overlay, never background-clip on the letters
  plan: Widths in rem and %, font in cqw; no background-clip
- [x] R3f.4 A motif from the logo (a bow) never lands on the logo that already has it
  plan: n/a: no logo motif moves
- [x] R3g.4 Every motion has one job (guide, confirm, reveal); loops start and end on the same frame; text settles soft to sharp without bounce; list rows about 100 ms apart; menu hover under 300 ms
  plan: Arriving guides, spark and letters reveal, press confirms; clip loops their own footage once it is on screen
- [x] R3e.16 No linear easing (ease-out or a spring); a transition grows from what was tapped and finishes under 0.5 s
  plan: var(--out) easing; transitions under 0.5 s
- [x] R3e.17 A carousel shows a sliver of the next card, with visible buttons or dots (mirrored in Hebrew); a bottom sheet closes by swipe-down AND a close button
  plan: Product sheet on a phone closes by swipe-down and a Close button; no carousels
- [x] R3e.18 Ambient background video only: camera locked, subtle, seamless loop of about 6 s, still poster, still for reduced motion
  plan: Six seconds of their own clip, only on screen, muted, with a poster and no motion when reduced
- [x] R3a.2 Nothing moves without a reason: a clip behind text holds still except its subject; text never re-wraps while its container animates; no in-between state looks unfinished (checked at the middle of every transition)
  plan: Text never moves or re-wraps with the pieces: names are placed once, then fade in
- [x] R3a.3 Anything placed on a spot in a photo/video is placed by measurement and lives inside the media's element; a label never covers what it labels; a caption stays until the next replaces it (check: overlay-truth)
  plan: Engraving placed by measurement inside the photo's figure, gen/look/base-crop.png
- [x] R3a.4 A held (pinned) section is designed to fit its content at 1280x650; if it truly cannot, it plays as the page scrolls without holding the screen and is still the signature; the order section is never held (check: cutoff)
  plan: n/a: nothing is pinned
- [x] R3a.5 Pinning and scrubbing yes, taking the scroll's speed or direction no, no parallax on phones, reduced motion shows a still
  plan: No scroll-speed tricks: the scroll leads the wipe; reduced motion switches rooms without the slide; without the script the rooms stand one under another
- [x] R3s.2 Nothing jumps: late photos fade in over 200 to 400 ms into space kept for them; choosing something never moves the layout (check: site)
  plan: Images have width and height; the sheet opens over the page; check-site passes
- [x] R3s.1 Everything pressable answers within 100 ms with a hover and a pressed state (check: site)
  plan: Hover and press on all controls under 100 ms to start
- [x] R3s.8 Buttons over a photo sit in a soft container, checked on a light and a dark photo
  plan: n/a: no buttons over photos
- [x] R3s.10 The picture appears the moment a thing is named
  plan: The sheet shows its photo as the name appears
- [x] R3s.27 Same thing, same place: a repeated kind of thing (each size, step, card, slide, scroll state) is written in the same place and style every time, and a growing block hangs from a fixed top so its heading never moves
  plan: Name, price and button in one place on every card and sheet
- [x] R3s.28 No blank screen anywhere in the scroll: at every stop something is there to look at (words, a picture, the film), never a screen of plain ground (check: check-blank)
  plan: check-blank passes
- [x] R3i.3 A live readout tied to the scroll shows only a true fact of their process, small mono at a corner, never a made-up number
  plan: n/a: no live readout
- [x] R3s.21 No script errors, console errors, 404s or dead links between the site's pages (check: site)
  plan: check-site passes; no script errors or dead links
- [x] R3x.6 At most one sentence lights up word by word, and the site built just before does not have one
  plan: n/a: no sentence lights up
- [x] R3x.12 A progress line is used only on a page of six screens or more, 2 to 3 px in the accent, aria-hidden, never over the menu or phone bar
  plan: n/a: no progress line

## Stage 9. Phone

- [x] R3b.6 On a phone the action is pinned to the bottom with the price or proof beside it, from after the first screen until the order section; a bar that carries a counter or clock is there from the first screen and only its button waits
  plan: Phone bar from the kit with From 30 and the button, after the first screen until the order
- [x] R3f.7 The bottom bar fits at 360 px: its label shrinks or wraps, its button never
  plan: Bar's label wraps at 360 px, the button keeps its size
- [x] R3a.6 A fixed bar never covers content (room is kept for it, including the last line and the end of the page) (check: site)
  plan: Body padding kept for the bar via --pad-bar
- [x] R3s.22 Everything to tap is at least 40 px on a phone and no two taps overlap (check: site)
  plan: Chips and buttons 44 px, removes 40 px
- [x] R3s.23 The page never scrolls sideways on a phone (check: site)
  plan: check-site passes at phone widths
- [x] R3s.26 No words sit on other words anywhere on the page, pinned scenes included, on short laptops (1366x768, 1280x720), 1440x900 and a phone (check: check-overlap)
  plan: check-overlap passes
- [x] R3t.1 The site declares its category (CONCEPT.md and a site-category meta on every page) and follows that category's row of the 3t table: ground and colour, pictures, how it sells, type
  plan: fashion-shop in CONCEPT.md and meta on all pages; white, grid just under the first screen, thin serif, occasions row, how it works
- [x] R3t.2 food-shop and fashion-shop: a price and an Add or Order control within the first two screens; every product card has photo, name, size or servings, price and a button
  plan: A grid of pieces with name, price and link in the first two screens; size is on the sheet from their spec lines
- [x] R3t.3 trainer: at least a third of sections are picture, never three plain sections in a row
  plan: n/a: not a trainer
- [x] R3t.4 A real footer on every page, identical: a last big line, the button, link columns, contact, the MyIsraelRental line (since 1 Nov 2026 the full footer of R3v.1)
  plan: Full footer of 3v.1 from sitekit on every page
- [x] R3a.7 Every state is checked on the device that shows it (touch emulation for phones, never a narrow desktop window; hover-only looks have a touch version)
  plan: Phone states shot with touch emulation (gen/shoot.mjs), sheet swipe included
- [x] R3a.8 A line of items separated by dots never wraps
  plan: The three facts stay on one line at 360 px

## Stage 10. Order details and report

- [x] R3u.2 A day the business cannot do (closed, full, inside the lead time) or a quantity over its limit gets one plain line under the field naming the next possible one, with a button to choose it; the form never quietly refuses or changes the pick
  plan: A past day shows one line naming the first day with a button to choose it
- [x] R3u.3 Price per portion beside each size ("about ₪25 a person") when the owner gave servings or pieces, rounded down; without figures the question is in message-to-owner.md
  plan: n/a: gifts do not have servings
- [x] R3u.5 A home page with no scroll film: the first screen arrives in order (bar, headline, line, picture, button), about 1.5 s, once; all there without JS or with motion off (check: check-arrival)
  plan: data-arrive in order on the first screen, about 1.5 s, once, all there with no script or motion
- [x] R3u.6 Depth on laptops: separate pieces on the first screen move at their own speeds with the scroll (near faster, far slower), laptops with a mouse only, still on phones and with motion off
  plan: n/a: one main piece on the first screen, no separate layers
- [x] R3u.7 At most one rotating word, in the headline, from the owner's real occasions or products; reads right with each; full list for screen readers; first word with motion off; not beside a film's moving words
  plan: n/a: no rotating word
- [x] R3u.8 A tilted label over headings, if used, is this site's own shape from its world and in fingerprints.json, never another site's
  plan: n/a: no tilted label
- [x] R3u.9 Questions are rounded cards on `<details>`, "+" in an accent circle turning into "x", the answer opening smoothly inside the card
  plan: kit.faq place is the starter's; restyled if the owner fills it
- [x] R3u.10 A business with two or more places has its list beside a map in the site's colours with numbered pins, the map held on a laptop and above the list on a phone
  plan: n/a: no places listed
- [x] R3u.11 The page passed its checks with a still where the film goes before the film went in
  plan: n/a: no film went in
- [x] R3u.12 Every moving piece not in the kit was tried on a test page with buttons for each state before it went in
  plan: The rooms were sketched (gen/look/new-openings.jpg) and shot on the page before the checks
- [x] R3u.13 gen/report.md ends with "Not done yet" and "For your call" (at most two)
  plan: gen/report.md ends with Not done yet and For your call
- [x] R3u.14 gen/copy-pass.md holds a shorter version of every line over 20 words and paragraph over three lines; the shorter is used unless it drops a fact
  plan: gen/copy-pass.md
- [x] R3w.1 Every generated food shot has a real cause on screen (a hand, a spoon, gravity), one event of 2 to 4 s, and its end stays; nothing floats into place or appears, no smoke or flash wipes between shots; except in the opening film, where the owner's own ingredients may swirl and float round the product in advert style, marked in the brief (the product itself never changes, nothing pops in or out in the open)
  plan: n/a: no film, no food
- [x] R3w.2 Generated liquids and steam look real: sauces opaque and thick, no glassy drips or big glass bubbles, steam thin wisps lit from behind, never a cloud
  plan: n/a: no film, no food
- [x] R3w.3 Generated food is lit from the side and behind with the camera side darker, never flat from the front; a pour or fall stays sharp when paused
  plan: n/a: no film, no food
- [x] R3w.4 The film's start and end pictures were right before any clip was made; each clip was made once at full quality (a draft only where get_cost showed it under a third of the price); simple motion (a growing crack, push-in, drift, holds) is done in code; every clip judged at 4+ fps
  plan: n/a: no film on this site; the opening is an event built in code from their own photos in generated rooms (GI-F2), no clip
- [x] R3w.5 No bite, chew or tear is shown in motion unless Tzvi approved that take; otherwise the film cuts to the result
  plan: n/a: no film, no food
- [x] R3w.6 A scroll film's scrub ends where the clip's motion ends (check-clip's figure), the last hold is short, and its last frame is the picture the next section shows
  plan: n/a: no film on this site; the opening is an event built in code from their own photos in generated rooms (GI-F2), no clip
- [x] R3w.7 Generated places and materials look photographed: no dune-smooth hills, model villages, stones in tidy equal rows or flat soft light, checked at full size beside a real photograph of that place or material before any clip
  plan: No place is generated. The 14 generated sets behind the shop pictures (stone blocks, plaster walls, a branch, linen) were looked at full size before use: veined, pitted stone, hard window light with soft-edged leaf shadows, no smooth hills, tidy rows or flat light. The six surface sets with stray table edges or walls were cropped (gen/scene.py CROP). No clip is made from them

## Stage 11. Finish

- [x] R3r.3 `check-rules` passes, every script above passed on every page after the last edit, and a fix was checked on the screen it was for (check: check-rules)
  plan: check-rules run after the last edit
- [x] R3r.4 A rule Tzvi had to point out twice has a script or a line in this file the same day
  plan: n/a: nothing Tzvi has had to point out twice on this site
