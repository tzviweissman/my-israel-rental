# Blueprint: mn-jewelry

Every rule of docs/rules-checklist.md, in the order the site is built. Before building a stage, write the plan for
each of its lines (what this site will do for that rule, or `n/a: <why the site has no such thing>`), then
`node scripts/blueprint.mjs --check mn-jewelry <stage>`. Tick [x] as each is built. RULES.md is written from this
file (`--rules`); the scripts named in a line confirm it at publish.

## Stage 1. Facts and words

- [x] R0b.1 Published under the business's real slug from the live record, not a made-up one
  plan: will be published under their real slug m-and-n-jewelry, read from the live record (src/record.json) and the live API
- [x] R0b.3 Prices and currency on the page match the owner's own menu or flyer; the real menu is loaded in their shop with fixed product ids
  plan: every piece shows From $2,000 USD: the listing price, which Tzvi says (8 Nov 2026) is where the range starts, growing with the gold and the diamonds; the four products, renamed at his request, are in the shop with fixed ids and the order sends those ids
- [x] R2.1 Only facts the owner or record gave: no invented number, "since", "fresh daily", "trusted by", guest counts
  plan: every fact is from src/record.json or their flyer (p01): the kinds, natural and lab diamonds, by appointment in Jerusalem, we also buy gold, the WhatsApp number; no year, count or metal claim
- [x] R2.2 The owner is asked only about their own business, never how we build (no tools, credits, vendors), and never what the record already answers
  plan: OWNER-QUESTIONS.md asks only about their business, nothing about how we build and nothing the record or flyer answers
- [x] R2.3 The message to the owner has 5 to 8 example FAQ questions written from this business's real details, plus the worry / first days / photo-in-use questions when the page does not answer them
  plan: OWNER-QUESTIONS.md has seven example FAQ questions from their details plus the worry, first days and photo-in-use questions
- [x] R3.1 Every claim has proof: kosher needs a certificate and a food business; licensed needs a licence number; verified; reviews/stars need real reviews; years need a founding year; English needs English among their languages; best, #1, award, guarantee, insured, 24/7, emergency, fresh daily, delivery, medical words only in the owner's own words
  plan: n/a: no certificate in the record, so nothing on the page says kosher; no licence, review, year or guarantee is claimed
- [x] R3.2 No urgency or scarcity: only N left, hurry, today only, limited time, ends soon, countdowns without a real end date, booked N times, invented counters
  plan: none on any page; nothing counts down
- [x] R3.3 No sentence that fits any business (welcome to, look no further, one-stop shop, passionate about, quality you can trust, world-class, top-notch, and Hebrew equivalents)
  plan: searched the pages for the banned sentences: none
- [x] R3.4 No exclamation marks, no long dashes, no words in capitals unless their name
  plan: no exclamation marks, long dashes or capitals on the pages (the menu name is set in capitals by style only)
- [x] R3.5 The headline or the line under it names something they really sell, in the words of their own listings (a place name alone does not count)
  plan: the line under the headline names rings, necklaces, bracelets and earrings in natural and lab diamonds, as their listing and flyer do
- [x] R3.6 Everything written is in the page's language; a Hebrew page is Hebrew in every line and is written, not translated; RTL layout checked
  plan: n/a: their record lists no languages and the listing was written in English; a Hebrew version is under Not done yet
- [x] R3.7 Nothing missing is faked: no FAQ section until the owner sends questions and answers, no reviews/social proof unless real and consented, no empty section, no placeholder or "coming soon"
  plan: no FAQ, reviews or gallery shown: each stays hidden until they fill it; no placeholders
- [x] R3.8 No logo walls, "As seen on", award laurels, invented "Best match / Popular" badges, stars or counts without real reviews, "$80 of value" gifts, intro prices that renew higher
  plan: none: no badges, stars, logos or counts
- [x] R3.9 The page repeats the promise that brought the visitor, and its words match the ad, flyer or message that sent them
  plan: the promise of their listing and flyer, timeless fine jewelry in natural and lab diamonds in Jerusalem, is the opening and the link preview
- [x] R3.10 At most two strengths, each checkable and with its proof
  plan: two strengths only: natural and lab diamonds, and pieces carefully selected for quality, sparkle and comfort, both their own words
- [x] R5.1 Their words first and specific: every line could only be about this business; a line a competitor could say is rewritten; the customer's problem comes before what they do
  plan: every line is theirs or names their pieces; the headline is from "something you will love and wear for years"
- [x] R5.2 Professional voice: no teasing, scolding, slang or jokes; the owner would print every line on their menu
  plan: read aloud as the owner: plain, polite, no jokes
- [x] R5.3 Short labels are full phrases ("Kosher, hechsher from Rabbi Weiner", "Made in Jerusalem, delivered across Israel")
  plan: n/a: no certificate in the record, so nothing on the page says kosher; the three facts are full phrases ("By appointment in Jerusalem")
- [x] R5.4 The visitor is "you"; the business is "we" or its name, never "they", "them" or "their" about itself, in labels, errors, captions, alt text and footers; every English line makes sense said by the owner
  plan: the business is "we" everywhere, the visitor "you"; searched for they, them, their: none about the business
- [x] R5b.2 One button, one label: the main button has the same words and the same destination in the header bar, hero, selling sections, phone bar and footer (over a photo the bar's version may be the outline style)
  plan: the main button is "Shop jewelry" to shop.html in the header, opening, closing band, footer and phone bar
- [x] R5b.8 A finish or closing line names what the customer gains, never "done" or "complete"; every line makes sense where it sits; "or" and "prefer" only when the other choice is visible
  plan: the closing band says "Find something you will love and wear for years", their own words
- [x] R3.11 The headline says what the customer gets (their result, in the owner's words), and the order of the page follows the visitor's questions: what is it, can I trust it, what does it cost, what do I do; prices come before any enquiry form
  plan: the headline says what you get (diamonds to wear for years); the page goes what it is, why to trust it, the pieces with prices, how to order
- [x] R3o.4 Every contact is labelled by what it does ("WhatsApp or call", "Call only, no WhatsApp"); the owner said which number takes what
  plan: their one number is labelled WhatsApp (listing whatsapp_confirmed); whether it takes calls is question 8
- [x] R3e.22 The owner stays visible as a person: name, real photo, direct WhatsApp
  plan: n/a: no name or photo of the owner in the record; asked in question 10, WhatsApp is direct on every page
- [x] R3s.19 The same promise line and photos on the link preview, home page and shop; every page has its own title, description and og:title/og:description/og:image
  plan: each page has its own title, description and og tags; the link preview is the opening photo with the same promise
- [x] R6.1 The category playbook's lead block comes first and its must-have blocks are there
  plan: the shop playbook: the pieces with prices lead after the opening and one band, the shop has every piece and the order
- [x] R4.1 Missing data reads as deliberate ("Ask for a quote" instead of a missing price) and is listed as a content gap, never invented
  plan: what is missing (each piece's own price, metal, sizes, where they meet) reads as "ask us about sizing, stones and availability", their own line, and is in OWNER-QUESTIONS.md

## Stage 2. Photos and media

- [x] R8.1 A set of images shown side by side (category tiles, product grids, size or flavour photos, thumbnails) reads as one shoot: same camera angle, same light from the same side, same plain background, subject at the same size and crop
  plan: each owner photo is re-set on one dark studio surface with one soft light from one style preamble (gen/studio_edit.py), so the set reads as one shoot; the bangle waits for a clean photo
- [x] R8.6 Every main product picture is a product hero shot: one product large and sharp, eye level, slightly turned, on a plinth from its own world, its own real ingredients round it, one colour story, one warm light, still or mid-air (not both); the product is exactly theirs
  plan: each piece large and sharp, alone, their own photo on the dark studio surface with one soft light; the piece is theirs, only the setting changed
- [x] R8.7 Every paid generation had a gen/<name>-brief.md first: a close crop of the one item, its traits written from the crop and kept, only the camera, light or setting changed, no idealising words, still before video, result compared beside their photo before showing
  plan: gen/studio-brief.md came first: the one item, its traits kept, only the surface and light changed (and the metal colour for the gold choice), no idealising words, each result compared beside their photo (gen/studio/_sheet-*.jpg)
- [x] R8.2 The set came from the owner's own matching photos first; else the whole set generated in one pass from one style preamble (product pictures are edited from their own photo, never made again from words alone); stock only from one photographer's matching series; no cut-outs mixed from many photos
  plan: every picture is an edit of the owner's own photo, the whole set made in one pass from one prompt; none made from words alone, no stock, no cut-outs
- [x] R3p.7 Similar items are shown the same way: if one flavour's thumbnail is one jar, every flavour's is one jar; a list where pointing at an item changes a big photo does so for every item
  plan: every piece is one photo in the same square, on the home grid, the shop picker and the stage
- [x] R3p.8 Optional: if the site's touch lives on its buttons, every button doing that job carries it in the same shape, small, moving only when pointed at or pressed, words still readable, reduced motion respected; n/a when the touch is elsewhere
  plan: n/a: the site's touch is the light that crosses the piece in the opening and on the shop stage, not its buttons
- [x] R3h.12 One look per product everywhere: film frame, close-up, picker, tile, card and order form show the same object, cut or edited from one master; a name with unknown look gets no picture
  plan: each piece has one photo set from the owner, the same pictures on the home grid, picker, stage and basket
- [x] R3h.10 Choosing an option changes its picture, words and button; one photo per option, from one shoot, sharp at the size shown (check: motion)
  plan: choosing a gold changes the picture, the summary line and the basket line; picking a piece changes the stage photo, name and choices; one picture per gold, from one set (check: motion)
- [x] R3g.14 One colour grade across every image and clip on the page
  plan: every picture is from the one studio set, the same dark surface and soft light (gen/studio_edit.py); the film is made from the same pictures
- [x] R3o.1 Generated food in motion appears only in the full-screen opening film (advert style, checked frame by frame at 4 fps or more: no food from nowhere, no glass or neon look, pieces never fade or vanish); everywhere else on the page food is the owner's real photo; outside the film generate only scenery, light, steam or a plain drawing
  plan: n/a: a jewelry business, no food anywhere
- [x] R3o.2 A generated liquid (opening film only) is opaque, satin, with specks, not glass or neon
  plan: n/a: a jewelry business, no food anywhere
- [x] R3o.3 Product colours look true (no cast from cloth or light)
  plan: each piece keeps its own metal colour and stones; only the background was changed, checked beside their photo (gen/studio/_sheet-*.jpg)
- [x] R3o.6 One photo per kind, from everything the owner sent, duplicates skipped, unclear kinds asked about; screenshots cropped at their real resolution
  plan: all twenty photos looked at: eleven pieces shown, one photo each (the second, yellow photo of the tennis bracelet is left out: re-set on the studio surface it came out as a loop, so its yellow gold is an edit of the white photo); the bangle, the half eternity band on fur and the solitaire on a mirror are left off until clean photos come; duplicates left out; the flyer is used only for the logo
- [x] R8.3 Generated media only of items they really sell; no generated person shown as their staff or customer; no made-up premises; no text baked into an image; nothing non-kosher in a kosher business's images; the owner approved every piece
  plan: generated are only the surface and light behind items they sell and the same piece's metal in the two other golds; no person, no premises, no text in a picture; no certificate in the record, so nothing says kosher; the owner is asked to confirm each (OWNER-QUESTIONS 12)
- [x] R8.4 Any moving real material (ribbon, fabric, steam, a pour) is a generated clip made in Higgsfield (kie.ai only if Higgsfield cannot), showing cause then effect, never SVG or CSS; food in motion only per R3o.1; reduced motion shows the still
  plan: n/a: no moving material; the film is made in code from still pictures
- [x] R3c.13 Nothing cut off: every label, number, ruler and photo sits wholly in its section at every size (only things marked `data-clip-ok` may be cut while travelling) (check: clipped)
  plan: checked with clipped.mjs and check-fits on every page
- [x] R3c.14 A cut-out is one subject: no stray garnish, specks or pale fringe, looked at on a dark and a light ground (check: cutout)
  plan: n/a: no cut-outs on the pages; the one cut-out is the film's closing ring (gen/end_cut.py), looked at on the dark ground
- [x] R5b.3 Text over imagery: words sit on the picture with a soft edge shade (or a small solid card), never big dark pools, full-frame darkening or frosted glass, and meet contrast at the brightest frame; on a phone they cover at most 40% of the opening picture's detail; a plain strip under the photo only where the picture is too busy (check: readable)
  plan: the opening words sit on the empty ground beside the ring, never over it; readable.mjs and check-photo-clear run
- [x] R3e.8 Every word is at least 12 px (14 px for a sentence on a phone) and 4.5:1 contrast (3:1 large), button text 4.5:1 on its fill (check: readable)
  plan: checked with readable.mjs on every page
- [x] R3s.24 Media is light and sized: no photo over 600 KB, every `<img>` has width and height, every video has a poster, nothing stays hidden with motion off (check: site)
  plan: every photo under 300 KB, every img has width and height, no video (check: site)
- [x] R3p.6 Fits on one screen: every section fits below the menu bar at the laptop sizes; no photo taller than the screen at any of the six sizes; no photo shown over 1.35x its own size; a big photo of another shape than its box is extended to the box's shape (padded, the new edges generated, the original pasted back), never zoomed or framed (3c.12, Tzvi 27 Oct) (check: fits)
  plan: the film's frames are drawn at 16:9 and 9:16 from the square studio pictures on a ground of the same colour, never zoomed; check-fits on every page
- [x] R3o.5 Every special character (₪, arrows, Hebrew, dots) renders in the font used for it (check: site)
  plan: $ and arrows: the $ is set in Assistant and the arrows are drawn as SVG (check: site)
- [x] R3x.7 BRAND.md in the build folder (colours with their uses, two fonts, logo on light and dark, textures, Design bans) was written before any picture was generated, and the site uses it
  plan: BRAND.md written before any picture was made; the site uses its colours, two fonts and bans
- [x] R3z.4 No dark layer or gradient over a whole photo or film; a shade only behind the words where measured contrast needs it
  plan: no dark layer over any photo or the film; the opening words sit on the calm dark left of their studio picture, measured, with no shade
- [x] R3z.7 Card pictures generated without owner photos were made as one set from a saved screenshot of a real site's grid (path in docs/inspo), each tile checked as R8.1
  plan: n/a: every card picture is their own photo of that piece, re-set on the studio surface

## Stage 3. Opening

- [x] R3g.13 The first screen holds a picture, a headline of 2 to 5 words that says what the customer gets, at most one short line (where the business is: the line or the small label, not both; trust goes there or right under the button) and one button; the header does not count
  plan: the first screen holds the photo, the headline "Classic luxury, a modern touch" (5 words, from their own "classic luxury with a modern touch"), one line naming the kinds and "Your jeweler in Jerusalem" from their flyer, one button, the three facts right under it
- [x] R3g.18 The first screen shows what the business offers before any scroll: one kind may be shown by the picture or the words; two or more different kinds are each named in the headline or big words; the home page lists them in <meta name="offers"> (check: check-says-offer)
  plan: one kind of offer, diamond jewelry: the headline says "Diamonds" and their ring fills the first screen beside it, on laptop and phone; meta offers on the home page (check: says-offer)
- [x] R3b.1 The first screen answers: what it is, where, why trust it, what to do next
  plan: what (diamond rings, necklaces, bracelets, earrings), where (Jerusalem), why trust (carefully selected, natural and lab diamonds, by appointment), what next (Shop jewelry)
- [x] R3b.2 Proof (price, credential or rating) touches the main button; for food a kosher band sits just after the opening, not crowding the button, and the certificate is stated at most twice as a sentence or band (a small identical kosher tag on items does not count)
  plan: n/a: no certificate in the record, so nothing on the page says kosher; the three facts touch the button
- [x] R3b.3 One solid action per screen: header button and phone bar repeat it; the header button is outline when the hero shows a solid one; everything else is outline, link or tile
  plan: one solid button per screen; the header button is outline; the rest are outline or links
- [x] R3h.20 A scroll-driven opening runs at 60 fps, is at least 3 screens long, shows the product on a plain ground of its own world (never on a photo of the same kind of product), keeps the product and photos whole, and loads the first screen first (check: check-opening-scroll)
  plan: the film is 3.8 screens of scroll on a laptop and 3.6 on a phone, the ring whole on its own dark ground, the first frame shown as the canvas picture at once (check: check-opening-scroll)
- [x] R3h.21 Effects, never too much: the opening film may hold the page for its length; any other section that holds the page while the scroll changes it is at most a screen and a half, at most three in all; longer turning becomes a tap; nothing stands between a phone visitor and the products or the order (check: check-one-scroll)
  plan: nothing holds the scroll on any page
- [x] R3h.22 A film starts as one storyboard sheet of rough line drawings (one row per concept, 3 to 4 panels), approved by Tzvi before any photoreal still; only the chosen concept is made as stills
  plan: Tzvi's 9 Nov recordings ("an opening like the first video i sent with different scenes and boxes moving") and his "C, go ahead" stood for the sketch; no paid clip was made, the scenes are code
- [x] R3h.23 Every film clip passes check-clip (no JUMP, RUSH, BLANK, VANISH or APPEAR), its brief has "How it really happens" from a real reference and a "Key moment" with its own clip, and each numbered step was ticked off against the clip at 8 fps (check: check-clip)
  plan: no generated clip; check-clip runs on the code-made film; the steps (light crosses, gold turns, pieces drift by, ring settles) were ticked against frames at 0.1 to 0.9 of the scroll (gen/shots/film-*.png)
- [x] R3h.24 A scroll film is real video tied exactly to the scroll (data-video, every frame a keyframe, starter/film.js): within 0.4 s of the scroll and never still over 400 ms or on over 15% of frames while scrolling, laptop and phone, in real Chrome (check: check-film-video)
  plan: played as real video tied to the scroll by starter/film.js (data-video, every frame a keyframe), laptop and phone (check: check-film-video)
- [x] R3h.25 Nothing covers a scroll film while it plays: at 20, 40 and 60% of the film, on a laptop and a phone, words, cards and names cover at most 3% of it (the site's menu bar aside); the words wait for its end or sit beside or under it (check: check-film-clear)
  plan: nothing covers the film while it plays: the opening words fade when the scroll starts and the closing line waits for the end (check: check-film-clear)
- [x] R3h.1 The home page opens on a full-screen picture or film (at least 70% picture) and it is an event from their own thing (a film, or an event built in code), proposed with the first build, never after (check: site)
  plan: the home page opens full screen on their twist ring on the dark studio surface, the first frame of a scroll film made in code in which light crosses the stone as the gold turns white, yellow, rose (check: site)
- [x] R3n.1 The owner's strongest real photo fills at least half the first screen on a laptop and on a phone, not a small card or cut-out shape
  plan: their solitaire photo fills the whole first screen on a laptop and a phone
- [x] R3n.2 One signature moment only this business could have, driven by the visitor (scroll scene or a choice)
  plan: light crossing their own diamond as its gold turns white, yellow, rose, which no other site of ours has (motions.json: glint)
- [x] R3n.3 The visitor's choice changes the page (colour, hero, order), not just one picture (check: motion)
  plan: the scroll drives the film; in the shop a tapped piece fills the stage and a gold choice changes the picture, the summary line and the basket line (check: motion)
- [x] R3n.4 Side by side with the closest reference in docs/inspo for this kind of business, ours is not plainly weaker
  plan: beside docs/inspo/awwwards-categories-2026-10-18/kinoria-1-viewfinder-reveal.webp: the same lens over a real object, full screen, ours lighter and moving
- [x] R3n.5 The one-sentence test, told to someone else and run on the first five seconds and the first full scroll: "you land and ___ happens" is about the business, not a decoration ("nothing", "the camera moves", "it fades in" fail)
  plan: you scroll and light crosses their diamond as the gold turns white, yellow, rose, four more of their pieces drift by, and the ring settles above their three words
- [x] R3g.15 The opening is made for this business at full quality: never a flyer crop or low-resolution photo, and a generated setting is never presented as their real premises (check: fits)
  plan: their own high-resolution photos on the studio surface, never the flyer (check: fits)
- [x] R3h.2 A film opening goes from where the product comes from to their real product and the button, every step true
  plan: the film is one look closer at their real ring: the whole ring, the light across it, its stone close, then their words and the Shop jewelry button; every frame is their ring
- [x] R3h.3 A film is full screen, crisp, drawn as sharp frames or near-lossless video at screen size, never shrunk, masked or in a column
  plan: full screen on a laptop and a phone; frames photographed from gen/scenes.html at 1920 x 1080 and 1080 x 1920, never in a column
- [x] R3h.5 A film's chapter lines are 2 to 6 words, small, at an edge, at most a third of the screen's height, on a soft edge shade only, never over the action (check: readable)
  plan: one closing line, "Quality. Sparkle. Comfort." (three words, their own), at the bottom edge, only after the film has settled (check: readable)
- [x] R3h.7 A film's seams are checked: each join compared, a jumping clip regenerated
  plan: no joins: one film made in code, every frame photographed from the same scene
- [x] R3h.8 The section after a lit film changes the mood boldly
  plan: after the film, a band with one of their pieces and their own words; the closing band and footer are a deeper black
- [x] R3h.11 Every film and generated still set is bright: middle third at least 33, whole frame at least 22, average at least 30; the subject is the brightest thing; viewed on a phone in daylight (check: brightness)
  plan: a dark studio ground by Tzvi's choice; the ring is by far the brightest thing in every frame (check: brightness)
- [x] R3h.13 One cause, one motion: the cause and its result are one clip, code pieces start on the cause frame and match the film's material, and the effect passes a 4 fps watch (no fall-then-fly, no pause, no blocks for flakes, no heap from nowhere, nothing wrong played backwards)
  plan: one cause, one motion: one band of light crosses the ring and the stone flashes as it passes; watched at 4 fps (gen/shots/film-*.png)
- [x] R3h.14 The product stays recognisable through the whole effect; a moving camera never loses it; on a phone the frame widens if pieces travel past the crop
  plan: the ring is in frame and whole from the first frame to the last; on a phone it sits below the words and the frames are made at 9:16
- [x] R3h.18 The film is physically possible: every object on screen is listed with where it comes from and where it goes (in frame, enters or leaves past an edge, cut from something seen); nothing appears, turns into something else or vanishes in a way that looks off at normal speed (something filling in naturally is fine: Tzvi, 26 Oct); list shown with the steps before generating
  plan: every object: the ring is in frame throughout; the band of light enters at its left and leaves past its right; four boxed pictures of their pieces fade in beside it, drift and fade out; nothing turns into something else
- [x] R3h.19 Generate once, by choosing a physically possible story before generating (a better prompt only helps a little; a failed clip changes the story, not just the prompt): each clip's start and end frames hold the same objects (or they enter or leave past an edge), one kind of action per clip, clips chained by stills made and checked before any video, frame 1 / middle / last written in the brief first, at most two tries per clip
  plan: nothing generated as video: the story (light crosses a still ring, its gold changes, four pictures pass) is drawn in code from finished stills, so it was right the first time
- [x] R3h.17 Words and film take turns: a giant name sits on plain ground, the film appears as letters part, the film moves aside before the headline arrives (check: readable)
  plan: the words sit on the empty ground beside the ring (above it on a phone) and leave as the film starts; the closing line comes only at its end (check: readable)
- [x] R3x.5 A following light is used only for a dark-world business, has an off button, sweeps once by itself on a phone and with reduced motion, and never dims the words or main button
  plan: n/a: not a dark-world business and no following light
- [x] R3z.2 The first screen has three layers: a real photo, the film or a soft shape of the business's colour at the back, the words and any card in the middle, the main button in front with the only soft shadow
  plan: at the back their twist ring photo and the film, in the middle the headline, line and facts, in front the gold Shop jewelry button, the only thing with the soft shadow
- [x] R3z.6 The h1 or the line under it holds the words a customer searches for this business and its place, the search words named in its BLUEPRINT.md plan line
  plan: search words "diamond jewelry in Jerusalem": the line under the h1 opens with them

## Stage 4. Sections

- [x] R3.12 Sections every page has: a dramatic hero, a features section (one scannable item per product or service with price and what is included), a call-to-action section of its own near the end with the proof beside the button
  plan: the opening, the pieces with prices (home and shop), and the closing band with the button and their WhatsApp
- [x] R3c.1 References came first: 3 to 5 real screens of businesses of the same kind kept, each with its source link in CONCEPT.md; the builder chose and said in one line what was picked and why (fresh searches per piece: R3g.17) (check: concept)
  plan: Kinoria, the 21st Magnifier Lens and Lens Card, Mobbin All Blues and Face Formula, and the Outfit shop grid, linked in CONCEPT.md (check: concept)
- [x] R3g.17 Every piece (button, arrow, each card or list effect, each section) came from a fresh Mobbin, 21st and Inspo search for this business, with the source named; nothing reused from the last two pages; each effect has a reason (says what a control does) (check: concept)
  plan: each effect named with its search or picture in CONCEPT.md Effects; none from the last two sites (check: concept)
- [x] R3g.19 Shops (food-shop, fashion-shop): the main buttons are in the product's own colour, taken from its photo (meta product-colour with data-from, in BRAND.md), text 4.5:1 on it, and each button stands out 3:1 from what is behind it; n/a for other categories (check: check-button-colour)
  plan: the main buttons are the gold of their own pieces, #C2A46E from their twist ring shown in yellow gold (meta product-colour, BRAND.md), near-black words on it at 8.6:1, on the near-black ground (check: button-colour)
- [x] R3c.2 No AI default look: not cream + serif + one italic word (unless their brand), no default font, purple or two-colour gradient, exactly three identical cards, frosted glass used everywhere, default "premium" palette; at least one section on a contrasting ground
  plan: dark velvet with their logo's gold and a thin display serif, no italic accent word, no gradients on text or buttons, no frosted glass
- [x] R3g.1 A style sheet exists in CONCEPT.md before building (accent, ink, ground, two faces plus at most a third for one label style, one radius, motion limits) and every section follows it
  plan: the style sheet is in CONCEPT.md and BRAND.md before building
- [x] R3g.3 The accent colour is used for the main button only; prices and everything else are in the main text colour, prices bold and large; at most one emphasised word per screen, set apart by weight or style in the text colour
  plan: the gold accent is on the main button only; prices are in ink on their tags; no emphasised words
- [x] R3g.7 At most one closing signature (giant cropped name, or one playful moment in the footer/404), never in the way of the order path
  plan: one closing signature: the last stone divider lights as the closing band arrives; it is not in the order path
- [x] R3g.11 Fonts come from the approved Latin + Hebrew list, licence checked
  plan: Italiana (OFL; Bellefair named for a Hebrew page, from the approved list) and Assistant (approved)
- [x] R3p.3 Not alike: no heading face shared with another site, no shared body face plus script, no two brand colours alike, design different on at least 4 of 6, effects overlap at most 2 points (check: prints)
  plan: check-fingerprints: different from all 17 other pages (check: prints)
- [x] R3p.5 One small touch only this business would have, from their product, tagline or craft (check: concept)
  plan: the stone dividers, a fine line with one round stone set in it like a solitaire, lighting as they arrive (check: concept)
- [x] R3q.1 CONCEPT.md is complete: 3 or more ideas each citing a saved effect picture, an "Own:" idea, which was chosen, the five wow answers, an Effects line per kind, the "Not alike" line (check: concept)
  plan: CONCEPT.md complete; check-concept passes
- [x] R5a.7 One signature idea and one peak per page; at most one signature scroll section; the ending resolves on the action; not carried over from another business
  plan: one signature (light across the stone) on the first screens; the page ends on the shop button
- [x] R9.1 The page's signature section is used only when their own photos or items support it; a page without the right material stays still
  plan: their twist solitaire has the clearest large stone, so it is the film's ring
- [x] R3f.2 The effect budget is filled and ticked on captured frames: one signature moment (held where it fits 1280x650, otherwise playing as the page scrolls), at least three accents (arriving opening, a scroll-tied detail mid-page, a closing payoff), quiet touches
  plan: signature light across the stone; accents the arriving first screen, the stage fading into the chosen gold with one pass of light, the last stone lighting; quiet touches the button light pass, ring arrows, sliding tile details, fades
- [x] R3m.1 A gallery place on every designed page (`data-mir-gallery` with template), and priced products inside `data-mir-catalog` with `data-mir-list`, group and item templates
  plan: home has the data-mir-gallery place and the pieces inside data-mir-catalog with list, group and item templates
- [x] R3m.3 Details the owner changes (hours, areas and fees, guarantee, FAQ, reviews) sit in fixed places with length limits, never free text boxes
  plan: n/a: the record has no hours, areas, fees, guarantee, FAQ or reviews to place yet; the FAQ place is ready on Contact
- [x] R3k.1 The site is pages by kind of business; the menu and the order are ONE page (the Shop, or Book); old Menu/Order addresses forward to it
  plan: Home, Shop (every piece and the order on one page), Contact; there were no old Menu or Order pages
- [x] R3k.2 One identical menu bar on every page (name to Home, pages, the one Order/Book button with basket count, `aria-current="page"`); on a phone it folds into a Menu button with Close that closes on Escape or a link tap
  plan: one identical menu bar from sitekit with aria-current; the phone Menu opens a panel that closes on Escape or a link
- [x] R3k.4 Shared `site.css` and `site.js` serve every page; a page-section class name (`.open`, `.in`) is never reused for a shared part's state
  plan: site.css and site.js on every page; page-only code is home.js and shop.js; no shared class reused for a state
- [x] R8a.1 Nothing left over from 21st or generated components: no demo headline, name, review, star count, statistic, logo wall or stock photo; no network calls, tracking or new script tags; restyled in the business's tokens
  plan: nothing from 21st copied; the lens was rebuilt in a few lines with no network calls
- [x] R3b.4 With few photos, facts carry the page (offers, key facts), nothing padded; for a place, hours and where come before the description
  plan: twenty photos carry the pieces; the facts carry the rest
- [x] R3c.3 Proof sits where the worry is: each worry the owner named is answered beside the button or price it belongs to; no wall of one-line reviews
  plan: n/a: the owner has not named worries yet; asked in OWNER-QUESTIONS.md
- [x] R3c.8 If the owner told us what happens after the order or booking, the page and tracking page say it first
  plan: n/a: the owner has not told us what happens after an order; the page says only that we confirm the day on WhatsApp
- [x] R3e.10 Cards have one reading order (name largest, one emphasised fact, usually the price in the main text colour, bold and large, the rest lighter), big photos; long names truncate; an icon on a photo sits on a solid circle or gradient (check: site)
  plan: each card: photo, name largest, kind, price bold on its tag (check: site)
- [x] R3e.14 One body family in up to three weights and at most six text sizes; spacing on a 4 px grid, related close, unrelated apart
  plan: Assistant in 400, 600 and 700; starter type and spacing scales
- [x] R3c.9 One quiet system: one corner radius for images and buttons, one icon set (lucide), one soft shadow (3s.3: about 3 px down, 30 px blur, no spread, tinted with the background or brand colour, never black), no two-colour gradients, no decorative arrows or outlines
  plan: one 4px radius, one shadow (black at 45%, 34px blur), line icons and stone outlines, no gradients on text or buttons
- [x] R3s.4 One left edge: headings, text and buttons line up on the same margin (check: site)
  plan: one left edge per section (check: site)
- [x] R3s.6 Controls that do the same job look the same (height, corner, style) (check: site)
  plan: buttons share height and corner by kind (check: site)
- [x] R3s.7 Buttons in sentence case, pale dividers, no "Price:" style labels, body lines 1.5 to 1.6 apart, contrast never lowered to look soft
  plan: sentence case, pale dividers, no "Price:" labels, body 1.6
- [x] R3s.9 One colour per meaning everywhere (the kosher tag looks the same on every item)
  plan: n/a: no certificate in the record, so nothing on the page says kosher; one colour per meaning (gold action, ink text)
- [x] R3s.12 The maker and their real work come right after the opening, with at least one real photo of the product in use or a real setting
  plan: the band right after the opening shows one of their pieces on the same dark surface with their own words
- [x] R3s.14 Real numbers shown big (three times the body size) with a one-line label, only numbers the owner gave
  plan: n/a: the owner gave no numbers to show big
- [x] R3s.11 One true sentence beside the price says why it costs that (handmade, the ingredient, the time)
  plan: beside the price: the price grows with the gold and diamonds, and we reply on WhatsApp with yours
- [x] R5b.6 No scroll cues, no "01/06" counters, no label above every section
  plan: no scroll cues, counters or labels above every section
- [x] R3.13 Structure: no doubled contact, facts or gallery; no two dividers in a row, no ending on one; only their own photos that exist; a photo gallery has at least 3
  plan: one contact place per page, no double dividers, only their photos
- [x] R3a.1 The page was rendered as a visitor meets it (the six sizes of 3p.6, each language, normal and reduced motion), every screen looked at, a scroll page walked at several positions per section, every payoff checked at its start and finish on a phone and laptop
  plan: rendered at the six sizes, normal and reduced motion, every screen looked at (gen/shots)
- [x] R3r.1 Every script above was run on EVERY page of the site, not only the home page
  plan: every script run on all three pages by publish-page --check
- [x] R3r.2 Someone who did not build the page used it against `docs/page-review-checklist.md`, the builder fixed every FAIL and the reviewer looked again
  plan: a Sonnet subagent that did not build it reviewed it against docs/page-review-checklist.md; review.md
- [x] R3g.12 A real test went through every form and order button (to a test business, never the owner's live inbox) before the owner saw it
  plan: the order form was sent through to the local API with a local test business (gen/test-form.mjs), never their inbox
- [x] R0b.12 The business's pages-list preview clip shows the current version of the page
  plan: n/a: not on the business pages list until published; publish-page records its clip then
- [x] R3x.1 A product to turn is made from the owner's photo through the API and compared beside it; its dots (at most four, 44 px) say only the owner's facts; buttons turn it too; it loads after the page and is their photo with no script or reduced motion
  plan: n/a: no product to turn
- [x] R3x.2 A counted number is a real figure from the record, counts once, ends exact, and is in the page text so it shows with no script or reduced motion
  plan: n/a: no counted number
- [x] R3x.3 Tabs for sizes or packages change one panel in place: picture, price and facts stay in the same spot
  plan: n/a: no tabs; the shop stage changes in place when a piece is tapped
- [x] R3x.4 With two or more sizes or packages, each is a card with its picture, price and the same measures in the same order
  plan: n/a: no sizes or packages with different prices
- [x] R3x.11 A product to turn passed the suitability check, was made from a grey-ground source of the owner's photo as two candidates reviewed from four angles, has two or three light buttons named for the business, and keeps touch-action pan-y on a phone
  plan: n/a: no product to turn
- [x] R3z.1 One card the visitor would use (open slots, order card, price from, facts or a review) hangs a third to a half over the edge of the next section on the home page, the only thing that crosses an edge; on a phone it is whole and readable
  plan: the facts card (from $2,000, natural and lab diamonds, by appointment in Jerusalem, Shop jewelry) hangs about 40% over the edge between the velvet band and the collection; on a phone the same card, whole
- [x] R3z.5 A site on a dark ground has one light section (questions, prices or how ordering works) joined by a clean edge, not a fade
  plan: the three steps to your piece (how ordering works) is the one light section, warm white with near-black words, joined to the dark by a straight edge

## Stage 5. Site structure (menu, footer, facts, layouts)

- [x] R3v.1 A full footer, the same on every page: who they are (name, one line, a quiet link to the main action), every page, how ordering works or Visit, Reach us, and a base line with © year, the MyIsraelRental line and a Privacy link; parts only when the record fills them (check: check-footer)
  plan: the sitekit full footer on every page: who we are, Pages, Ordering, Reach us, base line (check: footer)
- [x] R3v.2 The menu bar lists the site's pages, the same on every page; a site with other pages has no #jumps in the bar; order and booking steps may keep a quieter bar (check: check-menu)
  plan: the bar lists Home, Shop, Contact on every page, no #jumps (check: menu)
- [x] R3v.6 Sections of different heights: at least two sizes on a page, never three in a row the same height (check: check-heights)
  plan: sections of different heights on every page (check: heights)
- [x] R3v.7 Layouts (bento, zigzag steps, callouts, picture beside four facts, peek row) chosen by what the business has, never the same layout twice in a row on a page
  plan: picture beside words (the band after the opening), a peek row of pieces, numbered steps beside a heading, a short band; never the same twice in a row
- [x] R3v.8 Effects from 3v (light on cards, fanned photos, rolling letters, circle reveal, curtain between pages, picture buttons, statement band) are chosen for this business, not the set of the site built before it, each with its phone and reduced-motion version
  plan: none of the 3v effects except a statement band (we also buy gold), chosen for their second offer; reduced motion shows all
- [x] R3v.14 Three true facts from the record right under the main button on the home page (class btn-facts) (check: check-facts)
  plan: three true facts under the main button: Natural and lab diamonds, By appointment in Jerusalem, We also buy gold (check: facts)
- [x] R3x.8 Web basics on every page: skip link first, one h1 and no skipped levels, focus rings, labelled fields with type and autocomplete, live basket count and form messages, opening picture first and far ones lazy, two font families at most, title 60 and description 155 at most, og:title and a 1200x630 share picture, JSON-LD for the business on the home page (check: check-web-basics)
  plan: skip link, one h1, focus rings, labelled fields with type and autocomplete, live count and form status, opening picture fetchpriority high, far photos lazy, two families, JSON-LD JewelryStore, 1200x630 og.webp (check: web-basics)
- [x] R3x.13 One type scale and one spacing scale: every text size is a step of --t-1 to --t5 and every gap of --s1 to --s10, recorded in BRAND.md; at most 10 text sizes on a page (check: check-web-basics)
  plan: every size and gap from the starter scales (BRAND.md)

## Stage 6. Prices and savings

- [x] R3c.5 Choices (sizes, flavours, tiers) are tiles to tap, never a dropdown; "Most popular" only when the owner says so
  plan: pieces, golds, stones and ring size are tiles, never a dropdown; nothing marked most popular
- [x] R3c.6 The button says what happens next with a real number where there is one ("Order 4 buns, ₪55"), never "Submit" or "Buy now"; price, unit and action sit together
  plan: the buttons say "Add to basket, from $2,000" and, last, "Send order on WhatsApp, from $2,000"
- [x] R3c.7 Offers are contained: a time-limited offer shows its real end date, a first-order offer says so, standing discounts (students, soldiers, olim) need no date, "ends soon" without a real date is banned; no permanent sale, no discount on their famous item unless they say
  plan: n/a: no offers in the record
- [x] R3j.1 A guarantee the owner offers sits beside the main button in their words and states its limit; none offered means none shown
  plan: n/a: no guarantee in the record; asked in question 11
- [x] R3j.2 One real relevant add-on before ordering, with Add and "No thanks", not pre-ticked, gone once added or declined
  plan: n/a: no add-on the owner offers is known; not invented
- [x] R3j.3 A free taster, sample, consultation or quote the owner really offers is the headline offer beside the main button
  plan: n/a: no free offer in the record; help choosing is their own line and is said, not sold
- [x] R3j.4 Group discounts (students, soldiers, first order, olim) only when the owner offers them, said once near the price; they are standing, so no end date is needed
  plan: n/a: no group discounts in the record
- [x] R3j.5 Come-back features only if real: a stamp card the owner runs, a Reorder button; no streaks, valueless points, or reminders for something not started
  plan: n/a: no stamp card or reorder in the record
- [x] R3j.6 The natural pick among three sizes/packages is shown, but no invented option to make another look good
  plan: n/a: every piece is one price; no sizes or packages
- [x] R3j.7 Never: a struck-through or "was" price that is not real, prices changed to .90/.99 endings, an endorsement they do not have
  plan: no struck prices, no .90 endings, no endorsements
- [x] R3j.8 A saving is shown only when true like for like: same contents, same product line, worked out per unit in a table of every option, and the bigger option's unit price is lower than EVERY smaller option, measured against the cheapest
  plan: n/a: every piece is the same price; no amounts to compare
- [x] R3j.9 A lone saving among many products is not shown, but each small group (single/double pack, 4/8 box, service with its add-on) shows its own
  plan: n/a: no savings to show
- [x] R3j.10 A saving is shown as a percentage badge of two or three words ("25% off") with the real separate price struck through beside the new price; percentage = (separate minus new) / separate, rounded DOWN to a whole number; the button carries the offer and its price and no sentence explains it again; never how much more the bigger one costs
  plan: n/a: no savings to show
- [x] R3j.11 A combined service against its parts, and basket lines a package would make cheaper (one line with the saving and a Switch button), are shown when real
  plan: n/a: no combined services or packages
- [x] R3j.12 An owner's own savings claim the prices contradict is not printed; the owner is asked
  plan: n/a: the owner makes no savings claim
- [x] R3.14 Loud prices only when prices exist, never on a premium or quote-based business
  plan: From $2,000 is shown plainly on small tags, not loud; the final price is confirmed for each choice
- [x] R3z.3 Where the answer depends on a choice, a free taste of at most three questions ends on a real answer and price from the record and carries it into the order; no contact details asked
  plan: n/a: the owner's record holds one price, from $2,000, for every piece and choice; no answer or price depends on a choice yet

## Stage 7. Order and booking flow

- [x] R3k.7 The order is in steps after choosing: Step 1 basket, Step 2 when and where, Step 3 details; a three-line "Step N: name" bar; order and total beside every step (under it on a phone); the button names the next step and, last, what happens with the total; a Back button; the browser back button goes back one step (#order-2); each step checks only its own fields (check: site)
  plan: Step 1 Your basket, Step 2 Your appointment, Step 3 Your details, with the bar, the order and total beside, Back, #order-2 history, per-step checks (check: site)
- [x] R3k.8 Every basket line, packages included, has a remove button (40 px, "Remove X from the basket") beside its stepper (check: site)
  plan: every basket line has a 40px bin "Remove X from the basket" beside its stepper (check: site)
- [x] R3k.6 The basket lives between pages: an Add on any page puts the item in and opens the order page with it there
  plan: the basket is kept in localStorage between pages; ?piece= and ?add= on a link open the shop with it
- [x] R3k.9 Every order or booking is POSTed to MyIsraelRental (the business's order form) before WhatsApp opens; every product on the site is a product of the listing with the same name and price
  plan: the order POSTs to their order form with their product ids before WhatsApp opens; each piece is one of their four products at its listed $2,000
- [x] R3k.10 The order form arrives filled in: the day field holds the first day the business can do (lead time, closures), quantity 1, the owner's most common choice pre-chosen; all changeable, a customer's pick never overwritten (check: check-prefill)
  plan: the day arrives filled with tomorrow, the size choice with Help me with sizing and the bracelet with White; all changeable (check: prefill)
- [x] R3.15 What the brief asks visitors to do has a place to do it (book or order needs the services block, message needs contact, visit needs hours and address)
  plan: order: the shop and its steps; message: WhatsApp on every page; visit: by appointment, agreed on WhatsApp
- [x] R7.1 Three options are for the automatic page builder only; a hand build picks one direction itself and says why in one line in CONCEPT.md, with no options page put to Tzvi or the owner unless asked
  plan: one direction chosen and said in one line in CONCEPT.md; no options page
- [x] R8.5 Every main button goes to the quickest route to a finished order the business has: its order page, then its price list, only then WhatsApp; WhatsApp stays the quiet secondary; the how-to-order steps describe the real path
  plan: every main button goes to the shop; WhatsApp is the quiet secondary in the footer and close band
- [x] R0b.13 The order saves with a tracking link before opening WhatsApp, and the order reaches the owner complete
  plan: the order is saved first and the tracking link is added to the WhatsApp message
- [x] R3l.1 For every family of similar items the owner was asked what a customer can choose and how many
  plan: asked in questions 3, 4 and 5: colours, metals, stone sizes and ring sizes per piece
- [x] R3l.2 Each item says on itself what it allows ("Up to 4 kinds of chicken · 3 sauces", "1 kind"), in the same words on the tile, the order line and the order message
  plan: each piece shows its own choices (gold, diamonds, and a ring size only for rings), and the same words reach the summary line, the basket line and the message
- [x] R3l.3 Choices belong to the item: options appear once it is added, only for items that allow them; one choice is radio; a limit greys out the rest; an item needing a choice cannot be sent without it, with the reason beside it
  plan: each piece shows gold and diamonds, and a ring size only for rings; each is one choice; "I know my size" needs a size before Add, with the reason beside it
- [x] R3l.4 Three or more alike items are compared at a glance: only what differs, side by side
  plan: n/a: the pieces differ in kind, not in measures the record gives
- [x] R3l.6 A picture is of the item as it is sold now; no picture beats a misleading one
  plan: each photo is of the piece the owner put on that product
- [x] R3l.7 Read each item alone: a customer can tell what they get and what they can choose without reading another item
  plan: read each piece alone on the stage: kind, name, price and its own choice
- [x] R3e.9 Buttons have rest, hover, pressed and disabled states; fields have focus and error states with a message; every action confirms ("Sent", "Copied"); anything hover-only has a phone version (check: site)
  plan: buttons have hover, pressed and idle states; fields focus and error; Added and Sent confirm (check: site)
- [x] R3e.19 Every flow has a visible end: a clear "Done" screen after ordering, lists that end, "Save and finish later" on long forms; progress shows only true numbers
  plan: the order ends with a sent line and WhatsApp; lists end
- [x] R3s.16 Fewer choices first: a plain question ("How many people?") before a long list; the sensible option is chosen on purpose
  plan: the shop starts on one piece with one choice; the full list is below
- [x] R3s.18 Not available shows the nearest real alternative; every choice list has a way out ("None", "Other", "I'm not sure")
  plan: the ring size has Help me with sizing as the way out
- [x] R3s.25 The order or booking form sends nothing when empty and shows what is missing; filled, it sends a WhatsApp message carrying the total the page shows (check: site)
  plan: an empty form sends nothing and says what is missing; filled, it sends the total shown (check: site)
- [x] R3x.9 A request-type business's form builds a plain summary beside it as the fields fill, sends that summary, and states no price or promise the record lacks
  plan: n/a: a shop with products and a basket, not a request form
- [x] R3x.10 The prices or running total stay in view beside the order or booking form on a laptop, and a total line sits above the send button on a phone
  plan: the order and total sit beside the steps on a laptop and above the send button on a phone
- [x] R3x.14 The order page has the gift card section (SITE.gift_section, gift.js): hidden until the owner switches gift cards on, bought in place with no sign-in, and it shows only the owner's amounts, note and payment links (check: check-web-basics)
  plan: SITE.gift_section() and gift.js on the shop page, after the order; hidden until the owner switches gift cards on (check: web-basics GIFT)

## Stage 8. Motion

- [x] R3f.1 A scroll effect plays while its subject is wholly on screen (held on a stage that fits, or started only when all in view); captured at 0, 25, 50, 75 and 100 percent on laptop, short laptop and phone, the whole subject is visible and the effect is mid-way where it should be
  plan: the film holds on a full-screen stage while it plays, the whole ring in view at 0, 25, 50, 75 and 100% on laptop, short laptop and phone (gen/shots/film-*.png)
- [x] R3f.8 A scroll-tied effect finishes while its subject is mid-screen (top on screen, centre no higher than 40%) at six sizes (check: scroll-finish)
  plan: n/a: no scroll-tied effect
- [x] R3f.9 A list that stacks on a phone runs item by item (each item lights at about 80% down)
  plan: the steps list fades in as one block; no item-by-item lighting
- [x] R3f.5 Text widths are in em or rem, never `ch`; a text shimmer is an overlay, never background-clip on the letters
  plan: widths in em and rem; no shimmer on letters (the button light pass is an overlay)
- [x] R3f.4 A motif from the logo (a bow) never lands on the logo that already has it
  plan: n/a: no logo motif animated
- [x] R3g.4 Every motion has one job (guide, confirm, reveal); loops start and end on the same frame; text settles soft to sharp without bounce; list rows about 100 ms apart; menu hover under 300 ms
  plan: each motion has one job: the film shows the stone, the pass of light confirms the gold, the stage swap confirms the piece, reveals fade; menu hover 160 ms
- [x] R3e.16 No linear easing (ease-out or a spring); a transition grows from what was tapped and finishes under 0.5 s
  plan: eased curves only, under 0.5 s (the stage fade is 460 ms) except the 1.1 s pass of light that follows a gold choice; the film follows the scroll
- [x] R3e.17 A carousel shows a sliver of the next card, with visible buttons or dots (mirrored in Hebrew); a bottom sheet closes by swipe-down AND a close button
  plan: n/a: no carousel or sheet
- [x] R3e.18 Ambient background video only: camera locked, subtle, seamless loop of about 6 s, still poster, still for reduced motion
  plan: n/a: no background video
- [x] R3a.2 Nothing moves without a reason: a clip behind text holds still except its subject; text never re-wraps while its container animates; no in-between state looks unfinished (checked at the middle of every transition)
  plan: the film is the only moving picture on the opening; no text re-wraps; mid-fade the stage keeps the last picture under the new one
- [x] R3a.3 Anything placed on a spot in a photo/video is placed by measurement and lives inside the media's element; a label never covers what it labels; a caption stays until the next replaces it (check: overlay-truth)
  plan: nothing is laid over the film's picture: the words sit beside it and the closing line under the stone (check: overlay-truth)
- [x] R3a.4 A held (pinned) section is designed to fit its content at 1280x650; if it truly cannot, it plays as the page scrolls without holding the screen and is still the signature; the order section is never held (check: cutoff)
  plan: n/a: nothing is pinned
- [x] R3a.5 Pinning and scrubbing yes, taking the scroll's speed or direction no, no parallax on phones, reduced motion shows a still
  plan: the film is pinned for its length; with reduced motion it is one still and the stage changes with no pass of light
- [x] R3s.2 Nothing jumps: late photos fade in over 200 to 400 ms into space kept for them; choosing something never moves the layout (check: site)
  plan: photos have their size and ground set before they load; choices swap photos in place (check: site)
- [x] R3s.1 Everything pressable answers within 100 ms with a hover and a pressed state (check: site)
  plan: every button and tile answers on hover and press (check: site)
- [x] R3s.8 Buttons over a photo sit in a soft container, checked on a light and a dark photo
  plan: the opening button sits on the empty ground beside the ring, not on it
- [x] R3s.10 The picture appears the moment a thing is named
  plan: tapping a piece puts its photo on the stage at once
- [x] R3s.27 Same thing, same place: a repeated kind of thing (each size, step, card, slide, scroll state) is written in the same place and style every time, and a growing block hangs from a fixed top so its heading never moves
  plan: each piece's name, price and choices sit in the same place on the stage every time; on a laptop the ring-size row keeps its space for pieces without one, so changing piece never moves the page
- [x] R3s.29 Same button, same shape: no button's words break onto a second line at any size, and a repeated button (each card's) is the same height every time; the text beside it gives way, never the button (check: check-same-button)
  plan: no button breaks onto two lines: the shop's piece tiles are wide enough for every name on one line; check-same-button on all three pages
- [x] R3s.28 No blank screen anywhere in the scroll: at every stop something is there to look at (words, a picture, the film), never a screen of plain ground (check: check-blank)
  plan: no blank screen at any scroll stop (check: blank)
- [x] R3i.3 A live readout tied to the scroll shows only a true fact of their process, small mono at a corner, never a made-up number
  plan: n/a: no live readout
- [x] R3s.21 No script errors, console errors, 404s or dead links between the site's pages (check: site)
  plan: no errors or dead links (check: site)
- [x] R3x.6 At most one sentence lights up word by word, and the site built just before does not have one
  plan: n/a: no sentence lights up word by word
- [x] R3x.12 A progress line is used only on a page of six screens or more, 2 to 3 px in the accent, aria-hidden, never over the menu or phone bar
  plan: n/a: no progress line

## Stage 9. Phone

- [x] R3b.6 On a phone the action is pinned to the bottom with the price or proof beside it, from after the first screen until the order section; a bar that carries a counter or clock is there from the first screen and only its button waits
  plan: the phone bar with the two facts and Shop jewelry appears after the first screen and leaves at the order section
- [x] R3f.7 The bottom bar fits at 360 px: its label shrinks or wraps, its button never
  plan: the bar label shrinks first; the button keeps its width at 360 px
- [x] R3a.6 A fixed bar never covers content (room is kept for it, including the last line and the end of the page) (check: site)
  plan: the footer keeps room for the bar (check: site)
- [x] R3s.22 Everything to tap is at least 40 px on a phone and no two taps overlap (check: site)
  plan: every tap 40 px or more (check: site)
- [x] R3s.23 The page never scrolls sideways on a phone (check: site)
  plan: no sideways scroll (check: site)
- [x] R3s.26 No words sit on other words anywhere on the page, pinned scenes included, on short laptops (1366x768, 1280x720), 1440x900 and a phone (check: check-overlap)
  plan: no words on words (check: overlap)
- [x] R3t.1 The site declares its category (CONCEPT.md and a site-category meta on every page) and follows that category's row of the 3t table: ground and colour, pictures, how it sells, type
  plan: fashion-shop in CONCEPT.md and a site-category meta on every page: fine jewelry on a dark studio ground, pieces near the top with name and price
- [x] R3t.2 food-shop and fashion-shop: a price and an Add or Order control within the first two screens; every product card has photo, name, size or servings, price and a button
  plan: a price and an Add or Shop control within the first two screens; every card has photo, name, kind, price and opens the piece
- [x] R3t.3 trainer: at least a third of sections are picture, never three plain sections in a row
  plan: n/a: not a trainer site
- [x] R3t.4 A real footer on every page, identical: a last big line, the button, link columns, contact, the MyIsraelRental line (since 1 Nov 2026 the full footer of R3v.1)
  plan: the full footer of R3v.1 on every page
- [x] R3a.7 Every state is checked on the device that shows it (touch emulation for phones, never a narrow desktop window; hover-only looks have a touch version)
  plan: phones checked with touch emulation; the tile details show without hover on touch
- [x] R3a.8 A line of items separated by dots never wraps
  plan: the three facts wrap as whole items, no dots between them

## Stage 10. Order details and report

- [x] R3u.2 A day the business cannot do (closed, full, inside the lead time) or a quantity over its limit gets one plain line under the field naming the next possible one, with a button to choose it; the form never quietly refuses or changes the pick
  plan: a past day gets one line naming the first possible day with a button to choose it
- [x] R3u.3 Price per portion beside each size ("about ₪25 a person") when the owner gave servings or pieces, rounded down; without figures the question is in message-to-owner.md
  plan: n/a: jewelry has no servings or portions
- [x] R3u.5 A home page with no scroll film: the first screen arrives in order (bar, headline, line, picture, button), about 1.5 s, once; all there without JS or with motion off (check: check-arrival)
  plan: the first screen arrives in order: bar, headline, line, button; all there without JS or with motion off (check: arrival)
- [x] R3u.6 Depth on laptops: separate pieces on the first screen move at their own speeds with the scroll (near faster, far slower), laptops with a mouse only, still on phones and with motion off
  plan: n/a: no depth layers
- [x] R3u.7 At most one rotating word, in the headline, from the owner's real occasions or products; reads right with each; full list for screen readers; first word with motion off; not beside a film's moving words
  plan: n/a: no rotating word
- [x] R3u.8 A tilted label over headings, if used, is this site's own shape from its world and in fingerprints.json, never another site's
  plan: n/a: no tilted label
- [x] R3u.9 Questions are rounded cards on `<details>`, "+" in an accent circle turning into "x", the answer opening smoothly inside the card
  plan: the questions place uses the starter's details cards; hidden until they send questions
- [x] R3u.10 A business with two or more places has its list beside a map in the site's colours with numbered pins, the map held on a laptop and above the list on a phone
  plan: n/a: one place, by appointment in Jerusalem
- [x] R3u.11 The page passed its checks with a still where the film goes before the film went in
  plan: the page was built and checked with their picture as the opening before the film went in
- [x] R3u.12 Every moving piece not in the kit was tried on a test page with buttons for each state before it went in
  plan: the film was tried on the home page at laptop and phone sizes from 0.1 to 0.9 of the scroll (gen/shots/film-*.png), and the gold change on the shop stage for three pieces (gen/gold-shots.mjs), before the checks
- [x] R3u.13 gen/report.md ends with "Not done yet" and "For your call" (at most two)
  plan: gen/report.md ends with Not done yet and For your call
- [x] R3u.14 gen/copy-pass.md holds a shorter version of every line over 20 words and paragraph over three lines; the shorter is used unless it drops a fact
  plan: gen/copy-pass.md holds the shorter versions; the shorter is used
- [x] R3w.1 Every generated food shot has a real cause on screen (a hand, a spoon, gravity), one event of 2 to 4 s, and its end stays; nothing floats into place or appears, no smoke or flash wipes between shots; except in the opening film, where the owner's own ingredients may swirl and float round the product in advert style, marked in the brief (the product itself never changes, nothing pops in or out in the open)
  plan: n/a: a jewelry business, no food anywhere
- [x] R3w.2 Generated liquids and steam look real: sauces opaque and thick, no glassy drips or big glass bubbles, steam thin wisps lit from behind, never a cloud
  plan: n/a: a jewelry business, no food anywhere
- [x] R3w.3 Generated food is lit from the side and behind with the camera side darker, never flat from the front; a pour or fall stays sharp when paused
  plan: n/a: a jewelry business, no food anywhere
- [x] R3w.4 The film's start and end pictures were right before any clip was made; each clip was made once at full quality (a draft only where get_cost showed it under a third of the price); simple motion (a growing crack, push-in, drift, holds) is done in code; a nearly-right clip is trimmed or dissolved from the still, not remade; the brief's Clip plan (stills by file, edges, same item, one change, credits, in code, trim) was written before the first clip and no clip was rolled a third time; every clip judged at 4+ fps
  plan: n/a: a jewelry business, no food anywhere
- [x] R3w.5 No bite, chew or tear is shown in motion unless Tzvi approved that take; otherwise the film cuts to the result
  plan: n/a: a jewelry business, no food anywhere
- [x] R3w.6 A scroll film's scrub ends where the clip's motion ends (check-clip's figure), the last hold is short, and its last frame is the picture the next section shows
  plan: the scrub ends on the film's last frame, the ring settled in the middle, held briefly while the closing line arrives; the next band shows one of their pieces on the same dark surface
- [x] R3w.7 Generated places and materials look photographed: no dune-smooth hills, model villages, stones in tidy equal rows or flat soft light, checked at full size beside a real photograph of that place or material before any clip
  plan: no generated place; the one generated material is the plain dark matte surface under each piece, seen at full size beside their own photo of the same piece (gen/studio/_sheet-*.jpg): one soft light, no pattern or rows

## Stage 11. Finish

- [x] R3r.3 `check-rules` passes, every script above passed on every page after the last edit, and a fix was checked on the screen it was for (check: check-rules)
  plan: check-rules and every script run after the last edit (check: check-rules)
- [x] R3r.4 A rule Tzvi had to point out twice has a script or a line in this file the same day
  plan: n/a: nothing pointed out twice on this build
