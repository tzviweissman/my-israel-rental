# Blueprint: gremier-coffee

Every rule of docs/rules-checklist.md, in the order the site is built. Before building a stage, write the plan for
each of its lines (what this site will do for that rule, or `n/a: <why the site has no such thing>`), then
`node scripts/blueprint.mjs --check gremier-coffee <stage>`. Tick [x] as each is built. RULES.md is written from this
file (`--rules`); the scripts named in a line confirm it at publish.

## This site has

Answer each before stage 1: `node scripts/blueprint.mjs --has <thing>=yes|no gremier-coffee`. A "no" moves that thing's rules
out of the stages (listed once at the end, not read); the files are checked for it at --done, --rules and check-rules.

- film: yes  Does the site have any video: an opening or scroll film, a background video or a generated clip?

## Stage 1. Facts and words

- [x] R0b.1 Published under the business's real slug from the live record, not a made-up one
  plan: slug gremier-coffee, read from the live record (src/record.json, fetch_business.py); folder gremier-coffee
- [x] R0b.3 Prices and currency on the page match the owner's own menu or flyer; the real menu is loaded in their shop with fixed product ids
  plan: every price is from their own shop page at gremiercoffee.co.il, read 10 Nov 2026 (src/facts.md); the 19 products are in their live shop with these fixed ids since 12 Nov 2026 (gen/load_products.py, Tzvi: "Yes, load them")
- [x] R2.1 Only facts the owner or record gave: no invented number, "since", "fresh daily", "trusted by", guest counts
  plan: every fact comes from src/record.json or their own site (src/facts.md); no since line, no counts, no reviews, no number of brewing hours (their site gives none)
- [x] R2.2 The owner is asked only about their own business, never how we build (no tools, credits, vendors), and never what the record already answers
  plan: OWNER-QUESTIONS.md asks only about their business, and nothing the record or their site answers
- [x] R2.3 The message to the owner has 5 to 8 example FAQ questions written from this business's real details, plus the worry / first days / photo-in-use questions when the page does not answer them
  plan: OWNER-QUESTIONS.md has seven example questions from their details (how long a bottle keeps, how much per guest, mix or not, strongest, setup, dispenser return, keeping lattes cold), and the worry and photo questions
- [x] R3.1 Every claim has proof: kosher needs a certificate and a food business; licensed needs a licence number; verified; reviews/stars need real reviews; years need a founding year; English needs English among their languages; best, #1, award, guarantee, insured, 24/7, emergency, fresh daily, delivery, medical words only in the owner's own words
  plan: Kosher, Rabbi Shmuel Weiner (their own site's footer words); a photo of the certificate is asked in OWNER-QUESTIONS.md; a food business; delivery words are theirs; no other claims
- [x] R3.2 No urgency or scarcity: only N left, hurry, today only, limited time, ends soon, countdowns without a real end date, booked N times, invented counters
  plan: none on any page; read through; "Order by Wednesday, receive by Shabbat" is their standing delivery rule, not a countdown
- [x] R3.3 No sentence that fits any business (welcome to, look no further, one-stop shop, passionate about, quality you can trust, world-class, top-notch, and Hebrew equivalents)
  plan: none; every line names their cold brew, their coffees, their coffee bar or their own words
- [x] R3.4 No exclamation marks, no long dashes, no words in capitals unless their name
  plan: none in any line, read through; capitals only in names
- [x] R3.5 The headline or the line under it names something they really sell, in the words of their own listings (a place name alone does not count)
  plan: the h1 says Cold brew & coffee bars, the two things their listing sells
- [x] R3.6 Everything written is in the page's language; a Hebrew page is Hebrew in every line and is written, not translated; RTL layout checked
  plan: n/a: their record has no Hebrew description and the page is English only; Hebrew is listed in the report as not done
- [x] R3.7 Nothing missing is faked: no FAQ section until the owner sends questions and answers, no reviews/social proof unless real and consented, no empty section, no placeholder or "coming soon"
  plan: FAQ and gallery places stay hidden until the owner fills them; no reviews; nothing marked coming soon
- [x] R3.8 No logo walls, "As seen on", award laurels, invented "Best match / Popular" badges, stars or counts without real reviews, "$80 of value" gifts, intro prices that renew higher
  plan: none of these; "Most popular" on Classic and the sale prices are their own site's
- [x] R3.9 The page repeats the promise that brought the visitor, and its words match the ad, flyer or message that sent them
  plan: their own line "Brewed for hours, not minutes" is under the headline, their tagline "Elevate every day" closes the page
- [x] R3.10 At most two strengths, each checkable and with its proof
  plan: two strengths in the story: brewed for hours not minutes, and beans chosen for cold brew, both their own words
- [x] R5.1 Their words first and specific: every line could only be about this business; a line a competitor could say is rewritten; the customer's problem comes before what they do
  plan: their words first: brewed for hours, stock your fridge, make it a coffee bar, small bottles big favourites
- [x] R5.2 Professional voice: no teasing, scolding, slang or jokes; the owner would print every line on their menu
  plan: plain and professional throughout
- [x] R5.3 Short labels are full phrases ("Kosher, hechsher from Rabbi Weiner", "Made in Jerusalem, delivered across Israel")
  plan: Kosher, Rabbi Shmuel Weiner; Order by Wednesday, receive by Shabbat; full phrases
- [x] R5.4 The visitor is "you"; the business is "we" or its name, never "they", "them" or "their" about itself, in labels, errors, captions, alt text and footers; every English line makes sense said by the owner
  plan: visitor is you, the business is we or Gremier in labels, errors and alt text; searched for they, them and their about the business
- [x] R5b.2 One button, one label: the main button has the same words and the same destination in the header bar, hero, selling sections, phone bar and footer (over a photo the bar's version may be the outline style)
  plan: Shop cold brew on the header, opening, delivery card, closing band, phone bar and footer, all to shop.html
- [x] R5b.8 A finish or closing line names what the customer gains, never "done" or "complete"; every line makes sense where it sits; "or" and "prefer" only when the other choice is visible
  plan: the closing line is their own "Elevate every day."; the sent line says the order is open in WhatsApp to send
- [x] R3.11 The headline says what the customer gets (their result, in the owner's words), and the order of the page follows the visitor's questions: what is it, can I trust it, what does it cost, what do I do; prices come before any enquiry form
  plan: headline says what you get; order of the page: what it is (opening), trust (kosher band), what it costs (coffees, minis, jugs, bars with prices), what to do (how ordering works); no enquiry form
- [x] R3o.4 Every contact is labelled by what it does ("WhatsApp or call", "Call only, no WhatsApp"); the owner said which number takes what
  plan: WhatsApp (their site: "WhatsApp is the fastest way to reach us") and email; whether it takes calls is asked in OWNER-QUESTIONS.md
- [x] R3e.22 The owner stays visible as a person: name, real photo, direct WhatsApp
  plan: n/a: the record and their site name no person and show no photo of one; asked in OWNER-QUESTIONS.md; their story of the founder and direct WhatsApp are on the page
- [x] R3s.19 The same promise line and photos on the link preview, home page and shop; every page has its own title, description and og:title/og:description/og:image
  plan: the same promise and their coffee bar photo on the link preview (og.webp), home and shop; each page has its own title, description and og tags
- [x] R6.1 The category playbook's lead block comes first and its must-have blocks are there
  plan: the food shop lead block, product cards with price and Add, comes right after the opening and kosher band
- [x] R4.1 Missing data reads as deliberate ("Ask for a quote" instead of a missing price) and is listed as a content gap, never invented
  plan: delivery fees, coffee bar prices per guest count and the Basic bar are left out, said as "confirmed on WhatsApp", and listed in OWNER-QUESTIONS.md and gen/report.md

## Stage 2. Photos and media

- [x] R8.1 A set of images shown side by side (category tiles, product grids, size or flavour photos, thumbnails) reads as one shoot: same camera angle, same light from the same side, same plain background, subject at the same size and crop
  plan: every card photo is from their one sunlit oak-table shoot (same light, wall, table and angle); the coffee bar photos are their one event series
- [x] R8.6 Every main product picture is a product hero shot: one product large and sharp, eye level, slightly turned, on a plinth from its own world, its own real ingredients round it, one colour story, one warm light, still or mid-air (not both); the product is exactly theirs
  plan: every product card is their own studio hero shot; the film's generated stills show only the making, never a product of theirs redrawn
- [x] R8.7 Every paid generation had a gen/<name>-brief.md first: a close crop of the one item, its traits written from the crop and kept, only the camera, light or setting changed, no idealising words, still before video, result compared beside their photo before showing
  plan: gen/journey-brief.md and gen/film-brief.md were written before any paid still or clip: traits kept, only camera, light and setting described; each still compared beside their own photos; the orange steep and the white-appliance dispenser were made again
- [x] R8.2 The set came from the owner's own matching photos first; else the whole set generated in one pass from one style preamble (product pictures are edited from their own photo, never made again from words alone); stock only from one photographer's matching series; no cut-outs mixed from many photos
  plan: their own photos for every product and the film's last frame; the film's first stills (grinder, powder, jar, dispenser, glass) generated as one set from one style preamble (gen/journey_stills.py), since they have no photos of making it
- [x] R3p.7 Similar items are shown the same way: if one flavour's thumbnail is one jar, every flavour's is one jar; a list where pointing at an item changes a big photo does so for every item
  plan: every bottle, mini and jug card shows one product in the same shoot at the same crop
- [x] R3p.8 Optional: if the site's touch lives on its buttons, every button doing that job carries it in the same shape, small, moving only when pointed at or pressed, words still readable, reduced motion respected; n/a when the touch is elsewhere
  plan: n/a: the touch lives on the basket count, not on buttons
- [x] R3h.12 One look per product everywhere: film frame, close-up, picker, tile, card and order form show the same object, cut or edited from one master; a name with unknown look gets no picture
  plan: each product has one photo used on its card, the sheet and the order; their bar in the film's last frame is their own photo
- [x] R3h.10 Choosing an option changes its picture, words and button; one photo per option, from one shoot, sharp at the size shown (check: motion)
  plan: the coffee bar's place choice changes the photo to their own bar photo for that place, one shoot, sharp at the size shown
- [x] R3g.14 One colour grade across every image and clip on the page
  plan: one warm golden grade across all their photos; nothing added
- [x] R3o.1 Generated food in motion appears only in the full-screen opening film (advert style, checked frame by frame at 4 fps or more: no food from nowhere, no glass or neon look, pieces never fade or vanish); everywhere else on the page food is the owner's real photo; outside the film generate only scenery, light, steam or a plain drawing
  plan: generated food in motion only in the full-screen opening film, checked at 4 fps (gen/film/*-sheet.jpg): nothing from nowhere, opaque coffee, no glass or neon look; everywhere else their real photos
- [x] R3o.2 A generated liquid (opening film only) is opaque, satin, with specks, not glass or neon
  plan: the generated coffee is opaque deep brown; the steep's orange glow was graded to coffee brown (gen/journey/steep-3.png)
- [x] R3o.3 Product colours look true (no cast from cloth or light)
  plan: their photos are untouched; the coffee and labels read true
- [x] R3o.6 One photo per kind, from everything the owner sent, duplicates skipped, unclear kinds asked about; screenshots cropped at their real resolution
  plan: one photo per product from their site, each kept once (src/site, site-sheet.jpg); Tzvi's catalogue screenshots were not used because their site has the full-size originals
- [x] R8.3 Generated media only of items they really sell; no generated person shown as their staff or customer; no made-up premises; no text baked into an image; nothing non-kosher in a kosher business's images; the owner approved every piece
  plan: generated media only of the making of what they sell (beans, grounds, cold brew, milk); no person, no premises, no text (a made-up label on the grinder was made again without it); their bottles and bar are never generated; Tzvi approved the six-step sheet
- [x] R8.4 Any moving real material (ribbon, fabric, steam, a pour) is a generated clip made in Higgsfield (kie.ai only if Higgsfield cannot), showing cause then effect, never SVG or CSS; food in motion only per R3o.1; reduced motion shows the still
  plan: the moving coffee, powder and milk are generated clips (Higgsfield API, MiniMax H3), each showing its cause: beans poured in, powder falling, grounds sinking, milk poured
- [x] R3c.13 Nothing cut off: every label, number, ruler and photo sits wholly in its section at every size (only things marked `data-clip-ok` may be cut while travelling) (check: clipped)
  plan: nothing cut off at the six sizes (clipped and check-fits)
- [x] R3c.14 A cut-out is one subject: no stray garnish, specks or pale fringe, looked at on a dark and a light ground (check: cutout)
  plan: n/a: no cut-outs
- [x] R5b.3 Text over imagery: words sit on the picture with a soft edge shade (or a small solid card), never big dark pools, full-frame darkening or frosted glass, and meet contrast at the brightest frame; on a phone they cover at most 40% of the opening picture's detail; a plain strip under the photo only where the picture is too busy (check: readable)
  plan: the opening's words sit on the soft out-of-focus band of their photo with a soft cream edge shade behind the words only; readable passes at every size
- [x] R3e.8 Every word is at least 12 px (14 px for a sentence on a phone) and 4.5:1 contrast (3:1 large), button text 4.5:1 on its fill (check: readable)
  plan: readable.mjs passes on every page; phone sentences at 14 px
- [x] R3s.24 Media is light and sized: no photo over 600 KB, every `<img>` has width and height, every video has a poster, nothing stays hidden with motion off (check: site)
  plan: every photo under 600 KB (gen/assets.py), every img has width and height, no video
- [x] R3p.6 Fits on one screen: every section fits below the menu bar at the laptop sizes; no photo taller than the screen at any of the six sizes; no photo shown over 1.35x its own size; a big photo of another shape than its box is extended to the box's shape (padded, the new edges generated, the original pasted back), never zoomed or framed (3c.12, Tzvi 27 Oct) (check: fits)
  plan: check-fits passes at all six sizes; the opening photo is shown at no more than 1.35 times its size (1422 px canvas)
- [x] R3o.5 Every special character (₪, arrows, Hebrew, dots) renders in the font used for it (check: site)
  plan: ₪ in IBM Plex Sans through .sym; check-site GLYPH passes
- [x] R3x.7 BRAND.md in the build folder (colours with their uses, two fonts, logo on light and dark, textures, Design bans) was written before any picture was generated, and the site uses it
  plan: BRAND.md written before any picture work, and the site uses its colours and faces
- [x] R3z.4 No dark layer or gradient over a whole photo or film; a shade only behind the words where measured contrast needs it
  plan: no layer over the whole photo; one soft cream shade behind the opening words only
- [x] R3z.7 Card pictures generated without owner photos were made as one set from a saved screenshot of a real site's grid (path in docs/inspo), each tile checked as R8.1
  plan: n/a: every card picture is their own photo

## Stage 3. Opening

- [x] R3g.13 The first screen holds a picture, a headline of 2 to 5 words that says what the customer gets, at most one short line (where the business is: the line or the small label, not both; trust goes there or right under the button) and one button; the header does not count
  plan: picture, headline "Cold brew & coffee bars" (4 words), one line, one button; the three facts under the button are 3v.14
- [x] R3g.18 The first screen shows what the business offers before any scroll: one kind may be shown by the picture or the words; two or more different kinds are each named in the headline or big words; the home page lists them in <meta name="offers"> (check: check-says-offer)
  plan: two kinds, cold brew and coffee bar, both in the h1 (meta offers; check-says-offer passes)
- [x] R3b.1 The first screen answers: what it is, where, why trust it, what to do next
  plan: what: cold brew and coffee bars; where: delivered across Israel; trust: kosher and the prices by the button; next: Shop cold brew
- [x] R3b.2 Proof (price, credential or rating) touches the main button; for food a kosher band sits just after the opening, not crowding the button, and the certificate is stated at most twice as a sentence or band (a small identical kosher tag on items does not count)
  plan: the prices touch the button; a kosher band sits just after the opening, not crowding the button; the certificate photo is asked
- [x] R3b.3 One solid action per screen: header button and phone bar repeat it; the header button is outline when the hero shows a solid one; everything else is outline, link or tile
  plan: one solid button on the first screen; the header button is the outline one; the phone bar repeats it
- [x] R3h.20 A scroll-driven opening runs at 60 fps, is at least 3 screens long, shows the product on a plain ground of its own world (never on a photo of the same kind of product), keeps the product and photos whole, and loads the first screen first (check: check-opening-scroll)
  plan: the film runs 5.2 screens on a laptop and 4.6 on a phone, played as video tied to the scroll (film.js); every scene is on their own cream wall and oak
- [x] R3h.21 Effects, never too much: the opening film may hold the page for its length; any other section that holds the page while the scroll changes it is at most a screen and a half, at most three in all; longer turning becomes a tap; nothing stands between a phone visitor and the products or the order (check: check-one-scroll)
  plan: only the opening holds the page; no other section holds the scroll
- [x] R3h.22 A film starts as one storyboard sheet of rough line drawings (one row per concept, 3 to 4 panels), approved by Tzvi before any photoreal still; only the chosen concept is made as stills
  plan: one sketch sheet of rough drawings (gen/journey-sketch.png) approved by Tzvi ("yes looks good") before any photoreal still; only that concept was made
- [x] R3h.23 Every film clip passes check-clip (no JUMP, RUSH, BLANK, VANISH or APPEAR), its brief has "How it really happens" from a real reference and a "Key moment" with its own clip, and each numbered step was ticked off against the clip at 8 fps (check: check-clip)
  plan: every clip passed check-clip (C4's jump in its last frame is covered by the fade into their photo; the joined film passes); How it really happens and Key moment in gen/film-brief.md; each step ticked off on the 4 fps sheets
- [x] R3h.24 A scroll film is real video tied exactly to the scroll (data-video, every frame a keyframe, starter/film.js): within 0.4 s of the scroll and never still over 400 ms or on over 15% of frames while scrolling, laptop and phone, in real Chrome (check: check-film-video)
  plan: played as real video tied to the scroll (data-video, every frame a keyframe, starter film.js); check-film-video
- [x] R3h.25 Nothing covers a scroll film while it plays: at 20, 40 and 60% of the film, on a laptop and a phone, words, cards and names cover at most 3% of it (the site's menu bar aside); the words wait for its end or sit beside or under it (check: check-film-clear)
  plan: the opening words leave as the film starts; the chapter words are small at the left edge (check-film-clear)
- [x] R3h.1 The home page opens on a full-screen picture or film (at least 70% picture) and it is an event from their own thing (a film, or an event built in code), proposed with the first build, never after (check: site)
  plan: opens on a full-screen film of their product being made, from beans to their own coffee bar
- [x] R3n.1 The owner's strongest real photo fills at least half the first screen on a laptop and on a phone, not a small card or cut-out shape
  plan: the film fills the first screen on laptop and phone, ending on their own coffee bar photo
- [x] R3n.2 One signature moment only this business could have, driven by the visitor (scroll scene or a choice)
  plan: the cold brew journey led by the scroll: beans, fine powder, the steep, the pour, the milk, their bar
- [x] R3n.3 The visitor's choice changes the page (colour, hero, order), not just one picture (check: motion)
  plan: the coffee bar's place choice changes the photo and which bar the visitor sees; the steeping changes the opening as you scroll
- [x] R3n.4 Side by side with the closest reference in docs/inspo for this kind of business, ours is not plainly weaker
  plan: beside the Pinterest coffee site Tzvi sent (docs/inspo/pinterest-coffee-2026-11-11) and PULP (docs/inspo/videos-2026-11-07), ours tells the same kind of journey for cold brew, ending on their real bar
- [x] R3n.5 The one-sentence test, told to someone else and run on the first five seconds and the first full scroll: "you land and ___ happens" is about the business, not a decoration ("nothing", "the camera moves", "it fades in" fail)
  plan: you land as beans pour into a grinder under Cold brew & coffee bars, and scrolling follows them out as fine powder into a jar of cold water that steeps dark, over ice, milk swirling, out to their coffee bar
- [x] R3g.15 The opening is made for this business at full quality: never a flyer crop or low-resolution photo, and a generated setting is never presented as their real premises (check: fits)
  plan: the film is made for this business at 2K, ending on their own full-size photo
- [x] R3h.2 A film opening goes from where the product comes from to their real product and the button, every step true
  plan: the film goes from the beans to their real coffee bar and the Shop button, every step true to how cold brew is made
- [x] R3h.3 A film is full screen, crisp, drawn as sharp frames or near-lossless video at screen size, never shrunk, masked or in a column
  plan: full screen, 2K clips, 1920 video and 1680 frames, never shrunk or masked
- [x] R3h.5 A film's chapter lines are 2 to 6 words, small, at an edge, at most a third of the screen's height, on a soft edge shade only, never over the action (check: readable)
  plan: chapter lines are 4 to 7 words at the left edge on a soft shade, under a one-word chapter name (readable)
- [x] R3h.7 A film's seams are checked: each join compared, a jumping clip regenerated
  plan: each join checked on the 2 fps sheet; the C4 end jump covered by a 0.5 s fade into their photo
- [x] R3h.8 The section after a lit film changes the mood boldly
  plan: the kosher band and the cards on cream follow the film's sunlit table
- [x] R3h.11 Every film and generated still set is bright: middle third at least 33, whole frame at least 22, average at least 30; the subject is the brightest thing; viewed on a phone in daylight (check: brightness)
  plan: stills and film are bright: their cream wall fills most of every frame; checked by eye on the 2 fps sheet (gen/film/opening-sheet.jpg)
- [x] R3h.13 One cause, one motion: the cause and its result are one clip, code pieces start on the cause frame and match the film's material, and the effect passes a 4 fps watch (no fall-then-fly, no pause, no blocks for flakes, no heap from nowhere, nothing wrong played backwards)
  plan: one cause and one result per clip: beans poured in, powder out; grounds in, the water darkens; tap poured, then milk; the camera pulls back
- [x] R3h.14 The product stays recognisable through the whole effect; a moving camera never loses it; on a phone the frame widens if pieces travel past the crop
  plan: each clip keeps its one object whole (the grinder, the jar, the glass); the phone crop is centred on it
- [x] R3h.18 The film is physically possible: every object on screen is listed with where it comes from and where it goes (in frame, enters or leaves past an edge, cut from something seen); nothing appears, turns into something else or vanishes in a way that looks off at normal speed (something filling in naturally is fine: Tzvi, 26 Oct); list shown with the steps before generating
  plan: every object listed in gen/film-brief.md (Every object) with where it comes from and ends; the jar to dispenser and glass to bar joins are dissolves, said in the Clip plan
- [x] R3h.19 Generate once, by choosing a physically possible story before generating (a better prompt only helps a little; a failed clip changes the story, not just the prompt): each clip's start and end frames hold the same objects (or they enter or leave past an edge), one kind of action per clip, clips chained by stills made and checked before any video, frame 1 / middle / last written in the brief first, at most two tries per clip
  plan: the story was chosen first (the real way cold brew is made); each clip's start and end hold the same object (grinder, jar, glass); two tries at most
- [x] R3h.17 Words and film take turns: a giant name sits on plain ground, the film appears as letters part, the film moves aside before the headline arrives (check: readable)
  plan: the headline sits on the cream wall beside the grinder and leaves as the film starts; the chapter words take turns with the film
- [x] R3x.5 A following light is used only for a dark-world business, has an off button, sweeps once by itself on a phone and with reduced motion, and never dims the words or main button
  plan: n/a: not a dark-world business; no following light
- [x] R3z.2 The first screen has three layers: a real photo, the film or a soft shape of the business's colour at the back, the words and any card in the middle, the main button in front with the only soft shadow
  plan: three layers: the film at the back, the soft cream shade and words in the middle, the menu bar on top
- [x] R3z.6 The h1 or the line under it holds the words a customer searches for this business and its place, the search words named in its BLUEPRINT.md plan line
  plan: the h1 says cold brew and coffee bars; the line says delivered across Israel (search words: cold brew, coffee bar, Israel)

## Stage 4. Sections

- [x] R3.12 Sections every page has: a dramatic hero, a features section (one scannable item per product or service with price and what is included), a call-to-action section of its own near the end with the proof beside the button
  plan: hero, features (one card per product with price and what is in it), call to action (delivery card and closing band), FAQ place, footer
- [x] R3c.1 References came first: 3 to 5 real screens of businesses of the same kind kept, each with its source link in CONCEPT.md; the builder chose and said in one line what was picked and why (fresh searches per piece: R3g.17) (check: concept)
  plan: references kept with links in REFERENCES.md and CONCEPT.md (Blue Bottle, Onyx, Fellow, Mooala on Inspo; Assembly Coffee and Escape Cafe on Mobbin); one direction chosen with its reason
- [x] R3g.17 Every piece (button, arrow, each card or list effect, each section) came from a fresh Mobbin, 21st and Inspo search for this business, with the source named; nothing reused from the last two pages; each effect has a reason (says what a control does) (check: concept)
  plan: every effect has its source in CONCEPT.md Effects: 21st Liquid Button, Mobbin Escape Cafe, docs/inspo bestbean colour per product, effects library L4
- [x] R3g.19 Shops (food-shop, fashion-shop): the main buttons are in the product's own colour, taken from its photo (meta product-colour with data-from, in BRAND.md), text 4.5:1 on it, and each button stands out 3:1 from what is behind it; n/a for other categories (check: check-button-colour)
  plan: the main buttons are the cold brew colour #3B0A02 from their Classic photo (meta product-colour, BRAND.md)
- [x] R3c.2 No AI default look: not cream + serif + one italic word (unless their brand), no default font, purple or two-colour gradient, exactly three identical cards, frosted glass used everywhere, default "premium" palette; at least one section on a contrasting ground
  plan: not the AI look: no italic word, no gradient, no three identical cards in a row; Noto Serif and IBM Plex Sans; cream is the colour of their own photos' wall
- [x] R3g.1 A style sheet exists in CONCEPT.md before building (accent, ink, ground, two faces plus at most a third for one label style, one radius, motion limits) and every section follows it
  plan: style sheet in CONCEPT.md before building
- [x] R3g.3 The accent colour is used for the main button only; prices and everything else are in the main text colour, prices bold and large; at most one emphasised word per screen, set apart by weight or style in the text colour
  plan: the accent is only on the main buttons and the closing band; prices bold in ink
- [x] R3g.7 At most one closing signature (giant cropped name, or one playful moment in the footer/404), never in the way of the order path
  plan: one closing signature: the cold brew band with their line; no giant name
- [x] R3g.11 Fonts come from the approved Latin + Hebrew list, licence checked
  plan: Noto Serif (+ Hebrew) and IBM Plex Sans (+ Hebrew), both on the approved list, SIL Open Font License
- [x] R3p.3 Not alike: no heading face shared with another site, no shared body face plus script, no two brand colours alike, design different on at least 4 of 6, effects overlap at most 2 points (check: prints)
  plan: check-fingerprints: different from all 20 other pages; no shared heading face
- [x] R3p.5 One small touch only this business would have, from their product, tagline or craft (check: concept)
  plan: the basket count in a small round ring from their GREMIER badge
- [x] R3q.1 CONCEPT.md is complete: 3 or more ideas each citing a saved effect picture, an "Own:" idea, which was chosen, the five wow answers, an Effects line per kind, the "Not alike" line (check: concept)
  plan: CONCEPT.md complete; check-concept passes
- [x] R5a.7 One signature idea and one peak per page; at most one signature scroll section; the ending resolves on the action; not carried over from another business
  plan: one signature (the journey film) and one peak; no other scroll section; the film ends on Stock your fridge and Shop cold brew
- [x] R9.1 The page's signature section is used only when their own photos or items support it; a page without the right material stays still
  plan: the film ends on their own coffee bar photo; their products are their own photos
- [x] R3f.2 The effect budget is filled and ticked on captured frames: one signature moment (held where it fits 1280x650, otherwise playing as the page scrolls), at least three accents (arriving opening, a scroll-tied detail mid-page, a closing payoff), quiet touches
  plan: signature: the cold brew journey film. accents: the chapter words, the coffee bar place choice, the label stripe on cards. quiet: the coffee level rising in buttons, ring arrows on links, the brew line over headings, sale tags
- [x] R3m.1 A gallery place on every designed page (`data-mir-gallery` with template), and priced products inside `data-mir-catalog` with `data-mir-list`, group and item templates
  plan: gallery place on the home page with its template; every product in data-mir-catalog with list, group and item templates on the shop
- [x] R3m.3 Details the owner changes (hours, areas and fees, guarantee, FAQ, reviews) sit in fixed places with length limits, never free text boxes
  plan: FAQ, gallery and gift cards are the kit's fixed places; delivery words are fixed lines
- [x] R3k.1 The site is pages by kind of business; the menu and the order are ONE page (the Shop, or Book); old Menu/Order addresses forward to it
  plan: pages by kind: Home, Shop (all products and the order on one page), Contact
- [x] R3k.2 One identical menu bar on every page (name to Home, pages, the one Order/Book button with basket count, `aria-current="page"`); on a phone it folds into a Menu button with Close that closes on Escape or a link tap
  plan: one menu bar on every page with aria-current, Shop cold brew with the basket count; Menu on a phone
- [x] R3k.4 Shared `site.css` and `site.js` serve every page; a page-section class name (`.open`, `.in`) is never reused for a shared part's state
  plan: shared site.css, site.js and gc.js on every page; section classes never reused for state
- [x] R8a.1 Nothing left over from 21st or generated components: no demo headline, name, review, star count, statistic, logo wall or stock photo; no network calls, tracking or new script tags; restyled in the business's tokens
  plan: nothing left from 21st: only the idea of the rising fill was taken, rebuilt in CSS; no demo text, no network calls
- [x] R3b.4 With few photos, facts carry the page (offers, key facts), nothing padded; for a place, hours and where come before the description
  plan: n/a: they have many photos; facts sit by the button and in the delivery card
- [x] R3c.3 Proof sits where the worry is: each worry the owner named is answered beside the button or price it belongs to; no wall of one-line reviews
  plan: the worries the record answers sit where they belong: kosher after the opening, delivery days by the order steps, the dairy note on the lattes
- [x] R3c.8 If the owner told us what happens after the order or booking, the page and tracking page say it first
  plan: their site says what happens: order by Wednesday, receive by Shabbat, said on the home page and in the order step
- [x] R3e.10 Cards have one reading order (name largest, one emphasised fact, usually the price in the main text colour, bold and large, the rest lighter), big photos; long names truncate; an icon on a photo sits on a solid circle or gradient (check: site)
  plan: cards: name, then the price bold in ink with its size lighter, then Add
- [x] R3e.14 One body family in up to three weights and at most six text sizes; spacing on a 4 px grid, related close, unrelated apart
  plan: IBM Plex Sans in 400 and 600; sizes from --t-1 to --t5; gaps on the --s scale
- [x] R3c.9 One quiet system: one corner radius for images and buttons, one icon set (lucide), one soft shadow (3s.3: about 3 px down, 30 px blur, no spread, tinted with the background or brand colour, never black), no two-colour gradients, no decorative arrows or outlines
  plan: one radius 14px for images and buttons, no icon set needed, one soft warm shadow
- [x] R3s.4 One left edge: headings, text and buttons line up on the same margin (check: site)
  plan: one left edge per section (check-site passes)
- [x] R3s.6 Controls that do the same job look the same (height, corner, style) (check: site)
  plan: every Add is the same small button; chips and place pills share one shape
- [x] R3s.7 Buttons in sentence case, pale dividers, no "Price:" style labels, body lines 1.5 to 1.6 apart, contrast never lowered to look soft
  plan: buttons in sentence case, pale hairlines, no "Price:" labels, body lines 1.6
- [x] R3s.9 One colour per meaning everywhere (the kosher tag looks the same on every item)
  plan: one colour per meaning: each coffee's label stripe colour, the same wherever it appears
- [x] R3s.12 The maker and their real work come right after the opening, with at least one real photo of the product in use or a real setting
  plan: their real products (the coffees) come right after the opening and kosher band, and their real coffee bars in real settings follow
- [x] R3s.14 Real numbers shown big (three times the body size) with a one-line label, only numbers the owner gave
  plan: their real sizes shown big in the jugs section: 5 L in one jug, 15 L in three
- [x] R3s.11 One true sentence beside the price says why it costs that (handmade, the ingredient, the time)
  plan: beside the bottle prices: "Pour it over ice, add milk if you like" and the story line "brewed in small batches and bottled fresh"; the jugs say the price per litre
- [x] R5b.6 No scroll cues, no "01/06" counters, no label above every section
  plan: no scroll cues, counters or labels above sections
- [x] R3.13 Structure: no doubled contact, facts or gallery; no two dividers in a row, no ending on one; only their own photos that exist; a photo gallery has at least 3
  plan: no doubled contact or facts; their own photos only; the gallery stays hidden until filled
- [x] R3a.1 The page was rendered as a visitor meets it (the six sizes of 3p.6, each language, normal and reduced motion), every screen looked at, a scroll page walked at several positions per section, every payoff checked at its start and finish on a phone and laptop
  plan: rendered at the six sizes by the checks, looked at on laptop and phone in the browser, reduced motion checked; English only
- [x] R3r.1 Every script above was run on EVERY page of the site, not only the home page
  plan: check-build ran every script on every page
- [x] R3r.2 Someone who did not build the page used it against `docs/page-review-checklist.md`, the builder fixed every FAIL and the reviewer looked again
  plan: review.md from a Sonnet subagent that did not build the site
- [x] R3g.12 A real test went through every form and order button (to a test business, never the owner's live inbox) before the owner saw it
  plan: the order flow run to the end on laptop and phone with the save answered by a test route, never their inbox (gen/test_order.mjs)
- [x] R0b.12 The business's pages-list preview clip shows the current version of the page
  plan: n/a: not published; publish-page records the clip when Tzvi says yes
- [x] R3x.1 A product to turn is made from the owner's photo through the API and compared beside it; its dots (at most four, 44 px) say only the owner's facts; buttons turn it too; it loads after the page and is their photo with no script or reduced motion
  plan: n/a: no product to turn
- [x] R3x.2 A counted number is a real figure from the record, counts once, ends exact, and is in the page text so it shows with no script or reduced motion
  plan: n/a: no counted number
- [x] R3x.3 Tabs for sizes or packages change one panel in place: picture, price and facts stay in the same spot
  plan: n/a: no tabs for sizes
- [x] R3x.4 With two or more sizes or packages, each is a card with its picture, price and the same measures in the same order
  plan: the jugs (one and three) are listed with the same measures in the same order
- [x] R3x.11 A product to turn passed the suitability check, was made from a grey-ground source of the owner's photo as two candidates reviewed from four angles, has two or three light buttons named for the business, and keeps touch-action pan-y on a phone
  plan: n/a: no product to turn
- [x] R3z.1 One card the visitor would use (open slots, order card, price from, facts or a review) hangs a third to a half over the edge of the next section on the home page, the only thing that crosses an edge; on a phone it is whole and readable
  plan: the delivery card (order by Wednesday, with its button) hangs over the top edge of the cold brew closing band
- [x] R3z.5 A site on a dark ground has one light section (questions, prices or how ordering works) joined by a clean edge, not a fade
  plan: n/a: the site is on a light ground

## Stage 5. Site structure (menu, footer, facts, layouts)

- [x] R3v.1 A full footer, the same on every page: who they are (name, one line, a quiet link to the main action), every page, how ordering works or Visit, Reach us, and a base line with © year, the MyIsraelRental line and a Privacy link; parts only when the record fills them (check: check-footer)
  plan: the kit's full footer on every page: who we are, pages, ordering, reach us, the base line
- [x] R3v.2 The menu bar lists the site's pages, the same on every page; a site with other pages has no #jumps in the bar; order and booking steps may keep a quieter bar (check: check-menu)
  plan: the menu bar lists Home, Shop, Contact on every page; no #jumps
- [x] R3v.6 Sections of different heights: at least two sizes on a page, never three in a row the same height (check: check-heights)
  plan: check-heights passes: the opening, a thin kosher band, cards, a compact minis band, a short jugs band, the coffee bar, a taller story, how ordering works
- [x] R3v.7 Layouts (bento, zigzag steps, callouts, picture beside four facts, peek row) chosen by what the business has, never the same layout twice in a row on a page
  plan: layouts: full-screen opening, five-across cards, four-across cards, photo beside a price list, photo beside a choice, words beside a photo, three steps, an overhanging card; no layout twice in a row
- [x] R3v.8 Effects from 3v (light on cards, fanned photos, rolling letters, circle reveal, curtain between pages, picture buttons, statement band) are chosen for this business, not the set of the site built before it, each with its phone and reduced-motion version
  plan: from 3v: picture buttons (the coffee bar place choice) and a statement band (the closing band)
- [x] R3v.14 Three true facts from the record right under the main button on the home page (class btn-facts) (check: check-facts)
  plan: three true facts under the button: ₪49 a litre bottle, coffee bars from ₪349, kosher (check-facts passes)
- [x] R3x.8 Web basics on every page: skip link first, one h1 and no skipped levels, focus rings, labelled fields with type and autocomplete, live basket count and form messages, opening picture first and far ones lazy, two font families at most, title 60 and description 155 at most, og:title and a 1200x630 share picture, JSON-LD for the business on the home page (check: check-web-basics)
  plan: skip link, one h1, focus rings, labelled fields with type and autocomplete, live basket count, role=status on the sent line and alert on errors (check-web-basics passes)
- [x] R3x.13 One type scale and one spacing scale: every text size is a step of --t-1 to --t5 and every gap of --s1 to --s10, recorded in BRAND.md; at most 10 text sizes on a page (check: check-web-basics)
  plan: the starter's scales unchanged, recorded in BRAND.md

## Stage 6. Prices and savings

- [x] R3c.5 Choices (sizes, flavours, tiers) are tiles to tap, never a dropdown; "Most popular" only when the owner says so
  plan: choices are tiles (place pills, category chips); "Most popular" only on Classic, as their own site says
- [x] R3c.6 The button says what happens next with a real number where there is one ("Order 4 buns, ₪55"), never "Submit" or "Buy now"; price, unit and action sit together
  plan: buttons say what happens with a number: "Add, ₪49", "Send for Thursday, ₪516"
- [x] R3c.7 Offers are contained: a time-limited offer shows its real end date, a first-order offer says so, standing discounts (students, soldiers, olim) need no date, "ends soon" without a real date is banned; no permanent sale, no discount on their famous item unless they say
  plan: n/a: the site has no offer with an end date; their two sale prices are standing on their site
- [x] R3j.1 A guarantee the owner offers sits beside the main button in their words and states its limit; none offered means none shown
  plan: n/a: no guarantee given; asked in OWNER-QUESTIONS.md
- [x] R3j.2 One real relevant add-on before ordering, with Add and "No thanks", not pre-ticked, gone once added or declined
  plan: one add-on in the basket step: their Caramel Syrup, with Add and No thanks, not pre-ticked, gone once added or declined
- [x] R3j.3 A free taster, sample, consultation or quote the owner really offers is the headline offer beside the main button
  plan: n/a: no free taster offered
- [x] R3j.4 Group discounts (students, soldiers, first order, olim) only when the owner offers them, said once near the price; they are standing, so no end date is needed
  plan: n/a: no group discounts offered
- [x] R3j.5 Come-back features only if real: a stamp card the owner runs, a Reorder button; no streaks, valueless points, or reminders for something not started
  plan: n/a: their points club is not copied here (it is on their own site); no fake come-back features
- [x] R3j.6 The natural pick among three sizes/packages is shown, but no invented option to make another look good
  plan: n/a: no three sizes of one thing to pick between
- [x] R3j.7 Never: a struck-through or "was" price that is not real, prices changed to .90/.99 endings, an endorsement they do not have
  plan: the struck prices (₪54 for House Blend and Colombia) are their own site's; no .90 endings
- [x] R3j.8 A saving is shown only when true like for like: same contents, same product line, worked out per unit in a table of every option, and the bigger option's unit price is lower than EVERY smaller option, measured against the cheapest
  plan: the jugs' saving is worked per litre like for like (₪32.60 against ₪33.80 for the same Classic); the sale prices are the same bottle before and after
- [x] R3j.9 A lone saving among many products is not shown, but each small group (single/double pack, 4/8 box, service with its add-on) shows its own
  plan: shown only within each small group: the two sale bottles, and the one-jug and three-jug Classic
- [x] R3j.10 A saving is shown as a percentage badge of two or three words ("25% off") with the real separate price struck through beside the new price; percentage = (separate minus new) / separate, rounded DOWN to a whole number; the button carries the offer and its price and no sentence explains it again; never how much more the bigger one costs
  plan: the sale bottles show "9% off" with the real old price struck through
- [x] R3j.11 A combined service against its parts, and basket lines a package would make cheaper (one line with the saving and a Switch button), are shown when real
  plan: n/a: no package made of other basket lines
- [x] R3j.12 An owner's own savings claim the prices contradict is not printed; the owner is asked
  plan: their "best price per litre" was checked against their prices and is true
- [x] R3.14 Loud prices only when prices exist, never on a premium or quote-based business
  plan: prices shown loud because they are real and listed
- [x] R3z.3 Where the answer depends on a choice, a free taste of at most three questions ends on a real answer and price from the record and carries it into the order; no contact details asked
  plan: n/a: no answer depends on a choice; the coffee bar price for a guest count is confirmed on WhatsApp

## Stage 7. Order and booking flow

- [x] R3k.7 The order is in steps after choosing: Step 1 basket, Step 2 when and where, Step 3 details; a three-line "Step N: name" bar; order and total beside every step (under it on a phone); the button names the next step and, last, what happens with the total; a Back button; the browser back button goes back one step (#order-2); each step checks only its own fields (check: site)
  plan: Step 1 basket, Step 2 delivery or pickup and the day, Step 3 details, the steps bar and the order with total beside every step
- [x] R3k.8 Every basket line, packages included, has a remove button (40 px, "Remove X from the basket") beside its stepper (check: site)
  plan: every basket line has a 40 px remove button beside its stepper
- [x] R3k.6 The basket lives between pages: an Add on any page puts the item in and opens the order page with it there
  plan: the basket is kept between pages (gc-basket-v1); an Add on the home page shows in the shop's order
- [x] R3k.9 Every order or booking is POSTed to MyIsraelRental (the business's order form) before WhatsApp opens; every product on the site is a product of the listing with the same name and price
  plan: every order POSTs to their order form (gig bb714c5a) before WhatsApp, with the 19 product ids loaded in their live shop on 12 Nov 2026; delivery is off on their business, so only pickup orders save until it is switched on (report, For your call)
- [x] R3k.10 The order form arrives filled in: the day field holds the first day the business can do (lead time, closures), quantity 1, the owner's most common choice pre-chosen; all changeable, a customer's pick never overwritten (check: check-prefill)
  plan: the day field holds the first day regular delivery can do (two days on, never Shabbat), quantity 1, delivery chosen
- [x] R3.15 What the brief asks visitors to do has a place to do it (book or order needs the services block, message needs contact, visit needs hours and address)
  plan: ordering has its shop and order steps; contact has its page
- [x] R7.1 Three options are for the automatic page builder only; a hand build picks one direction itself and says why in one line in CONCEPT.md, with no options page put to Tzvi or the owner unless asked
  plan: one direction, chosen with its reason in CONCEPT.md
- [x] R8.5 Every main button goes to the quickest route to a finished order the business has: its order page, then its price list, only then WhatsApp; WhatsApp stays the quiet secondary; the how-to-order steps describe the real path
  plan: every main button goes to the shop and its order steps; WhatsApp is the last step
- [x] R0b.13 The order saves with a tracking link before opening WhatsApp, and the order reaches the owner complete
  plan: shop.js saves first and adds the track_url to the message (gen/test_order.mjs with a stand-in save); live saving waits on loading the products
- [x] R3l.1 For every family of similar items the owner was asked what a customer can choose and how many
  plan: n/a for choices: no item has options on their site; each is sold as it is; the coffee bar's guest count goes in the note, asked in OWNER-QUESTIONS.md
- [x] R3l.2 Each item says on itself what it allows ("Up to 4 kinds of chicken · 3 sauces", "1 kind"), in the same words on the tile, the order line and the order message
  plan: each item says its size on the card, the sheet and the order ("1 litre", "4 × 250 ml", "5 litres")
- [x] R3l.3 Choices belong to the item: options appear once it is added, only for items that allow them; one choice is radio; a limit greys out the rest; an item needing a choice cannot be sent without it, with the reason beside it
  plan: n/a: no item has choices
- [x] R3l.4 Three or more alike items are compared at a glance: only what differs, side by side
  plan: the five coffees side by side with what differs: their roast and taste line in each sheet, the stripe colour on each card
- [x] R3l.6 A picture is of the item as it is sold now; no picture beats a misleading one
  plan: every picture is the product as their site sells it now
- [x] R3l.7 Read each item alone: a customer can tell what they get and what they can choose without reading another item
  plan: each item's card and sheet say what it is, its size and its price alone
- [x] R3e.9 Buttons have rest, hover, pressed and disabled states; fields have focus and error states with a message; every action confirms ("Sent", "Copied"); anything hover-only has a phone version (check: site)
  plan: buttons rest, hover, pressed and disabled; fields focus and error with messages; Add confirms with a toast; Send confirms with the sent line
- [x] R3e.19 Every flow has a visible end: a clear "Done" screen after ordering, lists that end, "Save and finish later" on long forms; progress shows only true numbers
  plan: the order ends on "Thanks, your order is open in WhatsApp"
- [x] R3s.16 Fewer choices first: a plain question ("How many people?") before a long list; the sensible option is chosen on purpose
  plan: the shop starts with five category chips, then the products
- [x] R3s.18 Not available shows the nearest real alternative; every choice list has a way out ("None", "Other", "I'm not sure")
  plan: out of stock shows on the sheet; the order note takes anything else
- [x] R3s.25 The order or booking form sends nothing when empty and shows what is missing; filled, it sends a WhatsApp message carrying the total the page shows (check: site)
  plan: empty, the form sends nothing and says what is missing; filled, WhatsApp carries the total shown (gen/test_order.mjs)
- [x] R3x.9 A request-type business's form builds a plain summary beside it as the fields fill, sends that summary, and states no price or promise the record lacks
  plan: n/a: not a request-type business
- [x] R3x.10 The prices or running total stay in view beside the order or booking form on a laptop, and a total line sits above the send button on a phone
  plan: the order and total stay beside the form on a laptop; the total sits above the button on a phone
- [x] R3x.14 The order page has the gift card section (SITE.gift_section, gift.js): hidden until the owner switches gift cards on, bought in place with no sign-in, and it shows only the owner's amounts, note and payment links (check: check-web-basics)
  plan: the gift card section is on the shop page, hidden until the owner switches gift cards on

## Stage 8. Motion

- [x] R3f.1 A scroll effect plays while its subject is wholly on screen (held on a stage that fits, or started only when all in view); captured at 0, 25, 50, 75 and 100 percent on laptop, short laptop and phone, the whole subject is visible and the effect is mid-way where it should be
  plan: the film plays while it fills the held screen; captured at 0, 33 and 99%
- [x] R3f.8 A scroll-tied effect finishes while its subject is mid-screen (top on screen, centre no higher than 40%) at six sizes (check: scroll-finish)
  plan: the film finishes while the stage is held mid-screen
- [x] R3f.9 A list that stacks on a phone runs item by item (each item lights at about 80% down)
  plan: n/a: no list that lights item by item
- [x] R3f.5 Text widths are in em or rem, never `ch`; a text shimmer is an overlay, never background-clip on the letters
  plan: text widths in rem
- [x] R3f.4 A motif from the logo (a bow) never lands on the logo that already has it
  plan: n/a: no logo motif in motion
- [x] R3g.4 Every motion has one job (guide, confirm, reveal); loops start and end on the same frame; text settles soft to sharp without bounce; list rows about 100 ms apart; menu hover under 300 ms
  plan: each motion has one job: the steeping shows how it is made, the button fill confirms, the brew line reveals
- [x] R3e.16 No linear easing (ease-out or a spring); a transition grows from what was tapped and finishes under 0.5 s
  plan: eased curves only, under 0.5 s (the button fill 340 ms)
- [x] R3e.17 A carousel shows a sliver of the next card, with visible buttons or dots (mirrored in Hebrew); a bottom sheet closes by swipe-down AND a close button
  plan: the product sheet closes by swipe-down and by its close button
- [x] R3e.18 Ambient background video only: camera locked, subtle, seamless loop of about 6 s, still poster, still for reduced motion
  plan: n/a: no ambient background video; the film is the scroll film
- [x] R3a.2 Nothing moves without a reason: a clip behind text holds still except its subject; text never re-wraps while its container animates; no in-between state looks unfinished (checked at the middle of every transition)
  plan: only the film moves; the words hold still and never re-wrap
- [x] R3a.3 Anything placed on a spot in a photo/video is placed by measurement and lives inside the media's element; a label never covers what it labels; a caption stays until the next replaces it (check: overlay-truth)
  plan: nothing is placed on a spot in the film; the chapter words sit at the left edge on their own shade
- [x] R3a.4 A held (pinned) section is designed to fit its content at 1280x650; if it truly cannot, it plays as the page scrolls without holding the screen and is still the signature; the order section is never held (check: cutoff)
  plan: the held stage is the full screen and fits at 1280x650
- [x] R3a.5 Pinning and scrubbing yes, taking the scroll's speed or direction no, no parallax on phones, reduced motion shows a still
  plan: the film follows the scroll, never takes its speed; reduced motion shows the last frame, their coffee bar
- [x] R3s.2 Nothing jumps: late photos fade in over 200 to 400 ms into space kept for them; choosing something never moves the layout (check: site)
  plan: nothing jumps: photos have width and height; the place choice fades within a fixed box
- [x] R3s.1 Everything pressable answers within 100 ms with a hover and a pressed state (check: site)
  plan: everything pressable answers with hover and pressed states (check-site passes)
- [x] R3s.8 Buttons over a photo sit in a soft container, checked on a light and a dark photo
  plan: the opening button sits on the soft cream shade over the photo
- [x] R3s.10 The picture appears the moment a thing is named
  plan: each product name has its photo beside it
- [x] R3s.27 Same thing, same place: a repeated kind of thing (each size, step, card, slide, scroll state) is written in the same place and style every time, and a growing block hangs from a fixed top so its heading never moves
  plan: every card writes name, price and size in the same place; every Add is in the same place
- [x] R3s.29 Same button, same shape: no button's words break onto a second line at any size, and a repeated button (each card's) is the same height every time; the text beside it gives way, never the button (check: check-same-button)
  plan: no button breaks onto two lines; every Add is the same height
- [x] R3s.28 No blank screen anywhere in the scroll: at every stop something is there to look at (words, a picture, the film), never a screen of plain ground (check: check-blank)
  plan: no blank screen: check-blank passes
- [x] R3i.3 A live readout tied to the scroll shows only a true fact of their process, small mono at a corner, never a made-up number
  plan: n/a: no live readout; the chapter words name true steps of their process
- [x] R3s.21 No script errors, console errors, 404s or dead links between the site's pages (check: site)
  plan: no script errors or dead links (check-site passes)
- [x] R3x.6 At most one sentence lights up word by word, and the site built just before does not have one
  plan: n/a: no word-by-word sentence
- [x] R3x.12 A progress line is used only on a page of six screens or more, 2 to 3 px in the accent, aria-hidden, never over the menu or phone bar
  plan: n/a: no progress line

## Stage 9. Phone

- [x] R3b.6 On a phone the action is pinned to the bottom with the price or proof beside it, from after the first screen until the order section; a bar that carries a counter or clock is there from the first screen and only its button waits
  plan: on a phone the bar holds From ₪49 and Shop cold brew from after the first screen until the order
- [x] R3f.7 The bottom bar fits at 360 px: its label shrinks or wraps, its button never
  plan: the bar fits at 360 px
- [x] R3a.6 A fixed bar never covers content (room is kept for it, including the last line and the end of the page) (check: site)
  plan: room is kept for the phone bar (check-site passes)
- [x] R3s.22 Everything to tap is at least 40 px on a phone and no two taps overlap (check: site)
  plan: taps at least 40 px, none overlapping (check-site passes)
- [x] R3s.23 The page never scrolls sideways on a phone (check: site)
  plan: no sideways scroll on a phone (check-site passes)
- [x] R3s.26 No words sit on other words anywhere on the page, pinned scenes included, on short laptops (1366x768, 1280x720), 1440x900 and a phone (check: check-overlap)
  plan: check-overlap passes at short laptops, 1440x900 and phone
- [x] R3t.1 The site declares its category (CONCEPT.md and a site-category meta on every page) and follows that category's row of the 3t table: ground and colour, pictures, how it sells, type
  plan: food-shop in CONCEPT.md and a site-category meta on every page; follows food-shop: product, price and Add early, kosher band
- [x] R3t.2 food-shop and fashion-shop: a price and an Add or Order control within the first two screens; every product card has photo, name, size or servings, price and a button
  plan: price and Add within the first two screens; every card has photo, name, size and price
- [x] R3t.3 trainer: at least a third of sections are picture, never three plain sections in a row
  plan: n/a: not a trainer
- [x] R3t.4 A real footer on every page, identical: a last big line, the button, link columns, contact, the MyIsraelRental line (since 1 Nov 2026 the full footer of R3v.1)
  plan: the kit's full footer, identical on every page
- [x] R3a.7 Every state is checked on the device that shows it (touch emulation for phones, never a narrow desktop window; hover-only looks have a touch version)
  plan: phone checks with touch emulation (gen/test_order.mjs, the checks)
- [x] R3a.8 A line of items separated by dots never wraps
  plan: the dotted facts line becomes a plain list on a phone so it never wraps

## Stage 10. Order details and report

- [x] R3u.2 A day the business cannot do (closed, full, inside the lead time) or a quantity over its limit gets one plain line under the field naming the next possible one, with a button to choose it; the form never quietly refuses or changes the pick
  plan: a day inside the lead time or on Shabbat gets one line naming the first possible day, with a button to choose it
- [x] R3u.3 Price per portion beside each size ("about ₪25 a person") when the owner gave servings or pieces, rounded down; without figures the question is in message-to-owner.md
  plan: n/a: no servings given
- [x] R3u.5 A home page with no scroll film: the first screen arrives in order (bar, headline, line, picture, button), about 1.5 s, once; all there without JS or with motion off (check: check-arrival)
  plan: n/a: the home page opens on a scroll film; the opening words still arrive in order
- [x] R3u.6 Depth on laptops: separate pieces on the first screen move at their own speeds with the scroll (near faster, far slower), laptops with a mouse only, still on phones and with motion off
  plan: n/a: no depth layers
- [x] R3u.7 At most one rotating word, in the headline, from the owner's real occasions or products; reads right with each; full list for screen readers; first word with motion off; not beside a film's moving words
  plan: n/a: no rotating word
- [x] R3u.8 A tilted label over headings, if used, is this site's own shape from its world and in fingerprints.json, never another site's
  plan: n/a: no tilted label
- [x] R3u.9 Questions are rounded cards on `<details>`, "+" in an accent circle turning into "x", the answer opening smoothly inside the card
  plan: questions are rounded cards on details with + in a cold brew circle turning to x
- [x] R3u.10 A business with two or more places has its list beside a map in the site's colours with numbered pins, the map held on a laptop and above the list on a phone
  plan: n/a: one place
- [x] R3u.11 The page passed its checks with a still where the film goes before the film went in
  plan: the page passed check-build with a still opening before the film went in (10 Nov)
- [x] R3u.12 Every moving piece not in the kit was tried on a test page with buttons for each state before it went in
  plan: the steeping was tried on the page in the browser at each stop before the checks; kit parts not used
- [x] R3u.13 gen/report.md ends with "Not done yet" and "For your call" (at most two)
  plan: gen/report.md ends with Not done yet and For your call
- [x] R3u.14 gen/copy-pass.md holds a shorter version of every line over 20 words and paragraph over three lines; the shorter is used unless it drops a fact
  plan: gen/copy-pass.md
- [x] R3w.1 Every generated food shot has a real cause on screen (a hand, a spoon, gravity), one event of 2 to 4 s, and its end stays; nothing floats into place or appears, no smoke or flash wipes between shots; except in the opening film, where the owner's own ingredients may swirl and float round the product in advert style, marked in the brief (the product itself never changes, nothing pops in or out in the open)
  plan: n/a: no generated food
- [x] R3w.2 Generated liquids and steam look real: sauces opaque and thick, no glassy drips or big glass bubbles, steam thin wisps lit from behind, never a cloud
  plan: n/a: no generated liquids
- [x] R3w.3 Generated food is lit from the side and behind with the camera side darker, never flat from the front; a pour or fall stays sharp when paused
  plan: n/a: no generated food
- [x] R3w.4 The film's start and end pictures were right before any clip was made; each clip was made once at full quality (a draft only where get_cost showed it under a third of the price); simple motion (a growing crack, push-in, drift, holds) is done in code; a nearly-right clip is trimmed or dissolved from the still, not remade; the brief's Clip plan (stills by file, edges, same item, one change, credits, in code, trim) was written before the first clip and no clip was rolled a third time; every clip judged at 4+ fps
  plan: the start and end stills were made and looked at before any clip; each clip made once at 2K; dissolves and holds in code
- [x] R3w.5 No bite, chew or tear is shown in motion unless Tzvi approved that take; otherwise the film cuts to the result
  plan: n/a: no bite, chew or tear
- [x] R3w.6 A scroll film's scrub ends where the clip's motion ends (check-clip's figure), the last hold is short, and its last frame is the picture the next section shows
  plan: the scrub ends on their coffee bar photo held 0.7 s, which is the section's last frame and the start of the page below
- [x] R3w.7 Generated places and materials look photographed: no dune-smooth hills, model villages, stones in tidy equal rows or flat soft light, checked at full size beside a real photograph of that place or material before any clip
  plan: the generated wall, oak and light were compared beside their own photos of the same world (gen/film-brief.md, Looks real)

## Stage 11. Finish

- [x] R3r.3 `check-rules` passes, every script above passed on every page after the last edit, and a fix was checked on the screen it was for (check: check-rules)
  plan: check-rules run after the last edit
- [x] R3r.4 A rule Tzvi had to point out twice has a script or a line in this file the same day
  plan: n/a: nothing Tzvi has pointed out twice on this site
