# Blueprint: finest-cut

Every rule of docs/rules-checklist.md, in the order the site is built. Before building a stage, write the plan for
each of its lines (what this site will do for that rule, or `n/a: <why the site has no such thing>`), then
`node scripts/blueprint.mjs --check finest-cut <stage>`. Tick [x] as each is built. RULES.md is written from this
file (`--rules`); the scripts named in a line confirm it at publish.

## Stage 1. Facts and words

- [x] R0b.1 Published under the business's real slug from the live record, not a made-up one
  plan: slug finest-cut, read from the live public API (src/public.json); folder finest-cut
- [x] R0b.3 Prices and currency on the page match the owner's own menu or flyer; the real menu is loaded in their shop with fixed product ids
  plan: one product, Ultimate Feast, $215 USD as in the listing, live product id idx:0 from the live order form; the listing spells it "Ulimate", Tzvi is told so it can be corrected before publishing
- [x] R2.1 Only facts the owner or record gave: no invented number, "since", "fresh daily", "trusted by", guest counts
  plan: every fact comes from src/record.json or the flyer src/owner/p01.jpg; no since line, no counts, no reviews
- [x] R2.2 The owner is asked only about their own business, never how we build (no tools, credits, vendors), and never what the record already answers
  plan: OWNER-QUESTIONS.md asks only about the business, and nothing the record answers
- [x] R2.3 The message to the owner has 5 to 8 example FAQ questions written from this business's real details, plus the worry / first days / photo-in-use questions when the page does not answer them
  plan: OWNER-QUESTIONS.md has FAQ examples from their details (boxes, names of the types, serves how many, lead time, payment), and the worry, first days and photo questions
- [x] R3.1 Every claim has proof: kosher needs a certificate and a food business; licensed needs a licence number; verified; reviews/stars need real reviews; years need a founding year; English needs English among their languages; best, #1, award, guarantee, insured, 24/7, emergency, fresh daily, delivery, medical words only in the owner's own words
  plan: kosher is their own "Under Hashgacha of Rabbi Weiner" and the seal on their flyer; a food business; delivery is their own words; no other claims
- [x] R3.2 No urgency or scarcity: only N left, hurry, today only, limited time, ends soon, countdowns without a real end date, booked N times, invented counters
  plan: none on any page; read through
- [x] R3.3 No sentence that fits any business (welcome to, look no further, one-stop shop, passionate about, quality you can trust, world-class, top-notch, and Hebrew equivalents)
  plan: none; every line names their chicken, their board or their own flyer words
- [x] R3.4 No exclamation marks, no long dashes, no words in capitals unless their name
  plan: none in any line, read through; capitals only in names
- [x] R3.5 The headline or the line under it names something they really sell, in the words of their own listings (a place name alone does not count)
  plan: the line says Gourmet American schnitzel boards, from their listing
- [x] R3.6 Everything written is in the page's language; a Hebrew page is Hebrew in every line and is written, not translated; RTL layout checked
  plan: n/a: the record gives no Hebrew description of the business and the page is English only; Hebrew is listed in the report as not done
- [x] R3.7 Nothing missing is faked: no FAQ section until the owner sends questions and answers, no reviews/social proof unless real and consented, no empty section, no placeholder or "coming soon"
  plan: FAQ and gallery places stay hidden until the owner fills them; no reviews; nothing marked coming soon
- [x] R3.8 No logo walls, "As seen on", award laurels, invented "Best match / Popular" badges, stars or counts without real reviews, "$80 of value" gifts, intro prices that renew higher
  plan: none of these on any page
- [x] R3.9 The page repeats the promise that brought the visitor, and its words match the ad, flyer or message that sent them
  plan: the flyer line "The crunch you crave, delivered" is the headline and the closing band
- [x] R3.10 At most two strengths, each checkable and with its proof
  plan: two strengths: the XL board with its count, and the hashgacha of Rabbi Weiner
- [x] R5.1 Their words first and specific: every line could only be about this business; a line a competitor could say is rewritten; the customer's problem comes before what they do
  plan: their words first: crunch, feast in style, enhance your table, a taste of home
- [x] R5.2 Professional voice: no teasing, scolding, slang or jokes; the owner would print every line on their menu
  plan: plain and professional throughout; no teasing or slang
- [x] R5.3 Short labels are full phrases ("Kosher, hechsher from Rabbi Weiner", "Made in Jerusalem, delivered across Israel")
  plan: Kosher, under the hashgacha of Rabbi Weiner, a full phrase; "Delivery throughout Jerusalem"
- [x] R5.4 The visitor is "you"; the business is "we" or its name, never "they", "them" or "their" about itself, in labels, errors, captions, alt text and footers; every English line makes sense said by the owner
  plan: visitor is you, the business is we in labels, errors and alt text; searched for they, them and their about the business
- [x] R5b.2 One button, one label: the main button has the same words and the same destination in the header bar, hero, selling sections, phone bar and footer (over a photo the bar's version may be the outline style)
  plan: Order the feast on the header, opening, feast, whose table, phone bar, closing band and footer, all to the shop order step
- [x] R5b.8 A finish or closing line names what the customer gains, never "done" or "complete"; every line makes sense where it sits; "or" and "prefer" only when the other choice is visible
  plan: the closing line is their own "The crunch you crave, delivered."; no finish word
- [x] R3.11 The headline says what the customer gets (their result, in the owner's words), and the order of the page follows the visitor's questions: what is it, can I trust it, what does it cost, what do I do; prices come before any enquiry form
  plan: headline the crunch you crave; order of the page: what it is, kosher, the feast and its price, whose table, how to order; no enquiry form before the price
- [x] R3o.4 Every contact is labelled by what it does ("WhatsApp or call", "Call only, no WhatsApp"); the owner said which number takes what
  plan: WhatsApp or call on the flyer number, and email; the owner has not said which it is, the listing says WhatsApp, and the question is in OWNER-QUESTIONS.md
- [x] R3e.22 The owner stays visible as a person: name, real photo, direct WhatsApp
  plan: n/a: the record names no person and has no photo of one; asked in OWNER-QUESTIONS.md; direct WhatsApp is on every page
- [x] R3s.19 The same promise line and photos on the link preview, home page and shop; every page has its own title, description and og:title/og:description/og:image
  plan: the same board picture and promise on the link preview, home and shop; each page has its own title, description and og tags
- [x] R6.1 The category playbook's lead block comes first and its must-have blocks are there
  plan: the food shop lead block, product and price, comes first and is on the first screen and the next ones
- [x] R4.1 Missing data reads as deliberate ("Ask for a quote" instead of a missing price) and is listed as a content gap, never invented
  plan: servings, fee, lead time, hours and the type names are left out and listed in OWNER-QUESTIONS.md and gen/report.md

## Stage 2. Photos and media

- [x] R8.1 A set of images shown side by side (category tiles, product grids, size or flavour photos, thumbnails) reads as one shoot: same camera angle, same light from the same side, same plain background, subject at the same size and crop
  plan: n/a: no set is shown side by side; the one product has one photo, and the two wood photos show one at a time
- [x] R8.6 Every main product picture is a product hero shot: one product large and sharp, eye level, slightly turned, on a plinth from its own world, its own real ingredients round it, one colour story, one warm light, still or mid-air (not both); the product is exactly theirs
  plan: the board is their own top-down advert photo on black stone; nothing is regenerated; top-down and no plinth is how they shot it, and the hero shot is offered in the report only if Tzvi wants it
- [x] R8.7 Every paid generation had a gen/<name>-brief.md first: a close crop of the one item, its traits written from the crop and kept, only the camera, light or setting changed, no idealising words, still before video, result compared beside their photo before showing
  plan: n/a: no paid generation on this build
- [x] R8.2 The set came from the owner's own matching photos first; else the whole set generated in one pass from one style preamble (product pictures are edited from their own photo, never made again from words alone); stock only from one photographer's matching series; no cut-outs mixed from many photos
  plan: all their own photos: the board photo and two crops from their flyer
- [x] R3p.7 Similar items are shown the same way: if one flavour's thumbnail is one jar, every flavour's is one jar; a list where pointing at an item changes a big photo does so for every item
  plan: n/a: one product, nothing to show alike; the three order steps all use a cup of the same size
- [x] R3h.12 One look per product everywhere: film frame, close-up, picker, tile, card and order form show the same object, cut or edited from one master; a name with unknown look gets no picture
  plan: the board is the same one photo in the opening, the feast card and the shop stage
- [x] R3h.10 Choosing an option changes its picture, words and button; one photo per option, from one shoot, sharp at the size shown (check: motion)
  plan: the whose table choice changes its picture, words, ground and the button link
- [x] R3g.14 One colour grade across every image and clip on the page
  plan: one warm grade: no photo is re-graded, all are their own warm shots
- [x] R3o.1 Generated food in motion appears only in the full-screen opening film (advert style, checked frame by frame at 4 fps or more: no food from nowhere, no glass or neon look, pieces never fade or vanish); everywhere else on the page food is the owner's real photo; outside the film generate only scenery, light, steam or a plain drawing
  plan: n/a: no generated food at all, in motion or still
- [x] R3o.2 A generated liquid (opening film only) is opaque, satin, with specks, not glass or neon
  plan: n/a: no generated liquid
- [x] R3o.3 Product colours look true (no cast from cloth or light)
  plan: colours left exactly as their photos have them; looked at on the sheet
- [x] R3o.6 One photo per kind, from everything the owner sent, duplicates skipped, unclear kinds asked about; screenshots cropped at their real resolution
  plan: two photos, one kind each; the flyer is cut only where it has no words, at its real size
- [x] R8.3 Generated media only of items they really sell; no generated person shown as their staff or customer; no made-up premises; no text baked into an image; nothing non-kosher in a kosher business's images; the owner approved every piece
  plan: n/a: nothing generated
- [x] R8.4 Any moving real material (ribbon, fabric, steam, a pour) is a generated clip made in Higgsfield (kie.ai only if Higgsfield cannot), showing cause then effect, never SVG or CSS; food in motion only per R3o.1; reduced motion shows the still
  plan: n/a: no moving real material; the light is a dimming of their still photo
- [x] R3c.13 Nothing cut off: every label, number, ruler and photo sits wholly in its section at every size (only things marked `data-clip-ok` may be cut while travelling) (check: clipped)
  plan: clipped.mjs run on every page
- [x] R3c.14 A cut-out is one subject: no stray garnish, specks or pale fringe, looked at on a dark and a light ground (check: cutout)
  plan: the logo, cups and seal are round crops, looked at on the dark ground; no other cut-outs
- [x] R5b.3 Text over imagery: words sit on the picture with a soft edge shade (or a small solid card), never big dark pools, full-frame darkening or frosted glass, and meet contrast at the brightest frame; on a phone they cover at most 40% of the opening picture's detail; a plain strip under the photo only where the picture is too busy (check: readable)
  plan: the words on the opening sit on the plain extended stone beside the board, not over it; chapter lines on a small solid card
- [x] R3e.8 Every word is at least 12 px (14 px for a sentence on a phone) and 4.5:1 contrast (3:1 large), button text 4.5:1 on its fill (check: readable)
  plan: readable.mjs on every page
- [x] R3s.24 Media is light and sized: no photo over 600 KB, every `<img>` has width and height, every video has a poster, nothing stays hidden with motion off (check: site)
  plan: all pictures under 600 KB with sizes; no video; check-site
- [x] R3p.6 Fits on one screen: every section fits below the menu bar at the laptop sizes; no photo taller than the screen at any of the six sizes; no photo shown over 1.35x its own size; a big photo of another shape than its box is extended to the box's shape (padded, the new edges generated, the original pasted back), never zoomed or framed (3c.12, Tzvi 27 Oct) (check: fits)
  plan: the opening picture is extended from its own stone to 16:9 and 9:20; check-fits on all pages
- [x] R3o.5 Every special character (₪, arrows, Hebrew, dots) renders in the font used for it (check: site)
  plan: only $, the Latin letters and × are used, all in the loaded faces; check-site
- [x] R3x.7 BRAND.md in the build folder (colours with their uses, two fonts, logo on light and dark, textures, Design bans) was written before any picture was generated, and the site uses it
  plan: BRAND.md written before any picture

## Stage 3. Opening

- [x] R3g.13 The first screen holds a picture, a headline of 2 to 5 words that says what the customer gets, at most one short line (where the business is: the line or the small label, not both; trust goes there or right under the button) and one button; the header does not count
  plan: the first screen: their board, 4 words "The crunch you crave", one line with where, one button; proof right under the button
- [x] R3b.1 The first screen answers: what it is, where, why trust it, what to do next
  plan: what: schnitzel boards. where: Jerusalem. trust: the hashgacha. next: Order the feast
- [x] R3b.2 Proof (price, credential or rating) touches the main button; for food a kosher band sits just after the opening, not crowding the button, and the certificate is stated at most twice as a sentence or band (a small identical kosher tag on items does not count)
  plan: $215 and the hashgacha sit right under the button; the kosher band follows the opening; the band and the facts line are the two statements, with shop and contact facts in their own sections
- [x] R3b.3 One solid action per screen: header button and phone bar repeat it; the header button is outline when the hero shows a solid one; everything else is outline, link or tile
  plan: one solid button per screen: the header one is outline, the phone bar is hidden when the opening end shows its own
- [x] R3h.20 A scroll-driven opening runs at 60 fps, is at least 3 screens long, shows the product on a plain ground of its own world (never on a photo of the same kind of product), keeps the product and photos whole, and loads the first screen first (check: check-opening-scroll)
  plan: sticky stage in 4.8 screens, only transform and opacity move, the board on its own black stone, first picture loads first; check-opening-scroll
- [x] R3h.21 Effects, never too much: the opening film may hold the page for its length; any other section that holds the page while the scroll changes it is at most a screen and a half, at most three in all; longer turning becomes a tap; nothing stands between a phone visitor and the products or the order (check: check-one-scroll)
  plan: the opening is the only held section; the Order button is on its first screen and the phone bar stays through it; check-one-scroll
- [x] R3h.22 A film starts as one storyboard sheet of rough line drawings (one row per concept, 3 to 4 panels), approved by Tzvi before any photoreal still; only the chosen concept is made as stills
  plan: n/a: no film made on this build; a sketch sheet of concepts goes to Tzvi with the report, for his yes first
- [x] R3h.23 Every film clip passes check-clip (no JUMP, RUSH, BLANK, VANISH or APPEAR), its brief has "How it really happens" from a real reference and a "Key moment" with its own clip, and each numbered step was ticked off against the clip at 8 fps (check: check-clip)
  plan: n/a: no film clip
- [x] R3h.24 A scroll film is real video tied exactly to the scroll (data-video, every frame a keyframe, starter/film.js): within 0.4 s of the scroll and never still over 400 ms or on over 15% of frames while scrolling, laptop and phone, in real Chrome (check: check-film-video)
  plan: n/a: no film; the opening is a still photo moved by the scroll
- [x] R3h.25 Nothing covers a scroll film while it plays: at 20, 40 and 60% of the film, on a laptop and a phone, words, cards and names cover at most 3% of it (the site's menu bar aside); the words wait for its end or sit beside or under it (check: check-film-clear)
  plan: n/a: no film; words stay beside the board and chapter cards at the bottom edge
- [x] R3h.1 The home page opens on a full-screen picture or film (at least 70% picture) and it is an event from their own thing (a film, or an event built in code), proposed with the first build, never after (check: site)
  plan: home opens on the full-screen board and an event built in code, driven by the scroll; a film is proposed in the report with this first build
- [x] R3n.1 The owner's strongest real photo fills at least half the first screen on a laptop and on a phone, not a small card or cut-out shape
  plan: their board photo on its extended stone fills the first screen on laptop and phone
- [x] R3n.2 One signature moment only this business could have, driven by the visitor (scroll scene or a choice)
  plan: the scroll takes the camera and light round 4 types and 3 sauces of their own board
- [x] R3n.3 The visitor's choice changes the page (colour, hero, order), not just one picture (check: motion)
  plan: whose table changes the picture, words, section ground and carries into the order form; check-motion
- [x] R3n.4 Side by side with the closest reference in docs/inspo for this kind of business, ours is not plainly weaker
  plan: beside docs/inspo/moto-card-2026-10-21/hero-2500.webp: one lit object on black; ours has real food, larger, that moves with the scroll
- [x] R3n.5 The one-sentence test, told to someone else and run on the first five seconds and the first full scroll: "you land and ___ happens" is about the business, not a decoration ("nothing", "the camera moves", "it fades in" fail)
  plan: you land on a whole chicken board on black, and every scroll the camera and light take you to the next of its 4 types and 3 sauces, ending on the price
- [x] R3g.15 The opening is made for this business at full quality: never a flyer crop or low-resolution photo, and a generated setting is never presented as their real premises (check: fits)
  plan: the opening uses their 2250 px board photo at full quality, never the flyer; no generated setting
- [x] R3h.2 A film opening goes from where the product comes from to their real product and the button, every step true
  plan: n/a: no film opening
- [x] R3h.3 A film is full screen, crisp, drawn as sharp frames or near-lossless video at screen size, never shrunk, masked or in a column
  plan: n/a: no film; the still is drawn at 3200 px
- [x] R3h.5 A film's chapter lines are 2 to 6 words, small, at an edge, at most a third of the screen's height, on a soft edge shade only, never over the action (check: readable)
  plan: chapter lines 2 to 6 words, small card at the bottom edge, never over the lit part; readable.mjs
- [x] R3h.7 A film's seams are checked: each join compared, a jumping clip regenerated
  plan: n/a: no film, so no joins
- [x] R3h.8 The section after a lit film changes the mood boldly
  plan: n/a: not a lit film; still, a kosher band and an amber band follow the opening
- [x] R3h.11 Every film and generated still set is bright: middle third at least 33, whole frame at least 22, average at least 30; the subject is the brightest thing; viewed on a phone in daylight (check: brightness)
  plan: n/a: no film or generated stills; the owner brand is dark and the food is much the brightest thing
- [x] R3h.13 One cause, one motion: the cause and its result are one clip, code pieces start on the cause frame and match the film's material, and the effect passes a 4 fps watch (no fall-then-fly, no pause, no blocks for flakes, no heap from nowhere, nothing wrong played backwards)
  plan: n/a: no film, no effect with a physical cause
- [x] R3h.14 The product stays recognisable through the whole effect; a moving camera never loses it; on a phone the frame widens if pieces travel past the crop
  plan: the board stays the same still through the tour, and each part is seen whole in the frame
- [x] R3h.18 The film is physically possible: every object on screen is listed with where it comes from and where it goes (in frame, enters or leaves past an edge, cut from something seen); nothing appears, turns into something else or vanishes in a way that looks off at normal speed (something filling in naturally is fine: Tzvi, 26 Oct); list shown with the steps before generating
  plan: n/a: no film; nothing on screen appears or vanishes, the photo only moves
- [x] R3h.19 Generate once, by choosing a physically possible story before generating (a better prompt only helps a little; a failed clip changes the story, not just the prompt): each clip's start and end frames hold the same objects (or they enter or leave past an edge), one kind of action per clip, clips chained by stills made and checked before any video, frame 1 / middle / last written in the brief first, at most two tries per clip
  plan: n/a: nothing generated
- [x] R3h.17 Words and film take turns: a giant name sits on plain ground, the film appears as letters part, the film moves aside before the headline arrives (check: readable)
  plan: n/a: no film; the words sit in the plain stone beside the board
- [x] R3x.5 A following light is used only for a dark-world business, has an off button, sweeps once by itself on a phone and with reduced motion, and never dims the words or main button
  plan: n/a: the light follows the scroll, not the pointer

## Stage 4. Sections

- [x] R3.12 Sections every page has: a dramatic hero, a features section (one scannable item per product or service with price and what is included), a call-to-action section of its own near the end with the proof beside the button
  plan: hero, the feast with price and what is included, the closing band with its button and contacts
- [x] R3c.1 References came first: 3 to 5 real screens of businesses of the same kind kept, each with its source link in CONCEPT.md; the builder chose and said in one line what was picked and why (fresh searches per piece: R3g.17) (check: concept)
  plan: kept references with links in CONCEPT.md, one direction chosen with its reason
- [x] R3g.17 Every piece (button, arrow, each card or list effect, each section) came from a fresh Mobbin, 21st and Inspo search for this business, with the source named; nothing reused from the last two pages; each effect has a reason (says what a control does) (check: concept)
  plan: fresh Mobbin, 21st and Inspo searches named in REFERENCES.md and CONCEPT.md Effects; check-concept
- [x] R3c.2 No AI default look: not cream + serif + one italic word (unless their brand), no default font, purple or two-colour gradient, exactly three identical cards, frosted glass used everywhere, default "premium" palette; at least one section on a contrasting ground
  plan: dark ground and amber from the logo, Secular One and Rubik; no gradients or glass; an amber section for contrast
- [x] R3g.1 A style sheet exists in CONCEPT.md before building (accent, ink, ground, two faces plus at most a third for one label style, one radius, motion limits) and every section follows it
  plan: style sheet in CONCEPT.md before building; site.css tokens follow it
- [x] R3g.3 The accent colour is used for the main button only; prices and everything else are in the main text colour, prices bold and large; at most one emphasised word per screen, set apart by weight or style in the text colour
  plan: amber is the button, and the one statement band as a ground as the owner flyer uses it; prices in the text colour, bold and large
- [x] R3g.7 At most one closing signature (giant cropped name, or one playful moment in the footer/404), never in the way of the order path
  plan: one closing signature: the name huge in the closing band
- [x] R3g.11 Fonts come from the approved Latin + Hebrew list, licence checked
  plan: Secular One from the approved list; Rubik from the approved list; both SIL Open Font License
- [x] R3p.3 Not alike: no heading face shared with another site, no shared body face plus script, no two brand colours alike, design different on at least 4 of 6, effects overlap at most 2 points (check: prints)
  plan: check-fingerprints passes; line in CONCEPT.md
- [x] R3p.5 One small touch only this business would have, from their product, tagline or craft (check: concept)
  plan: three order steps shown as their own three sauce cups, one lit per step
- [x] R3q.1 CONCEPT.md is complete: 3 or more ideas each citing a saved effect picture, an "Own:" idea, which was chosen, the five wow answers, an Effects line per kind, the "Not alike" line (check: concept)
  plan: CONCEPT.md complete; check-concept
- [x] R5a.7 One signature idea and one peak per page; at most one signature scroll section; the ending resolves on the action; not carried over from another business
  plan: one idea: the tour of the board; the page ends on the order; not used on any other site
- [x] R9.1 The page's signature section is used only when their own photos or items support it; a page without the right material stays still
  plan: their board photo really does hold four parts and three cups, so it carries the tour
- [x] R3f.2 The effect budget is filled and ticked on captured frames: one signature moment (held where it fits 1280x650, otherwise playing as the page scrolls), at least three accents (arriving opening, a scroll-tied detail mid-page, a closing payoff), quiet touches
  plan: signature: the tour. accents: the light coming up on arrival, the line under the numbers tied to the scroll, the closing name. quiet: blur-in reveals, button light, press
- [x] R3m.1 A gallery place on every designed page (`data-mir-gallery` with template), and priced products inside `data-mir-catalog` with `data-mir-list`, group and item templates
  plan: gallery place on the home page with its template, product in data-mir-catalog with list, group and item templates
- [x] R3m.3 Details the owner changes (hours, areas and fees, guarantee, FAQ, reviews) sit in fixed places with length limits, never free text boxes
  plan: FAQ is the kit fixed place; hours and fees are not shown until given; areas in fixed lines
- [x] R3k.1 The site is pages by kind of business; the menu and the order are ONE page (the Shop, or Book); old Menu/Order addresses forward to it
  plan: Home, Shop, Contact; the feast and the order are one page; no separate menu or order address exists to forward
- [x] R3k.2 One identical menu bar on every page (name to Home, pages, the one Order/Book button with basket count, `aria-current="page"`); on a phone it folds into a Menu button with Close that closes on Escape or a link tap
  plan: sitekit menu bar on all pages, Menu button with Close on a phone
- [x] R3k.4 Shared `site.css` and `site.js` serve every page; a page-section class name (`.open`, `.in`) is never reused for a shared part's state
  plan: site.css and site.js on all pages; open.js and shop.js page-only; the opening uses .on, shared parts use .shown
- [x] R8a.1 Nothing left over from 21st or generated components: no demo headline, name, review, star count, statistic, logo wall or stock photo; no network calls, tracking or new script tags; restyled in the business's tokens
  plan: nothing copied from 21st: rebuilt in plain CSS from the idea, no demo text
- [x] R3b.4 With few photos, facts carry the page (offers, key facts), nothing padded; for a place, hours and where come before the description
  plan: two photos, so facts carry the page: the big numbers, kosher, delivery; n/a for hours as this is not a place
- [x] R3c.3 Proof sits where the worry is: each worry the owner named is answered beside the button or price it belongs to; no wall of one-line reviews
  plan: n/a: the owner named no worries yet; asked; kosher and delivery still sit beside the button
- [x] R3c.8 If the owner told us what happens after the order or booking, the page and tracking page say it first
  plan: n/a: the owner has not told us what happens after the order; asked
- [x] R3e.10 Cards have one reading order (name largest, one emphasised fact, usually the price in the main text colour, bold and large, the rest lighter), big photos; long names truncate; an icon on a photo sits on a solid circle or gradient (check: site)
  plan: feast card: name largest, then the price bold in the text colour, then the lighter unit; big photo
- [x] R3e.14 One body family in up to three weights and at most six text sizes; spacing on a 4 px grid, related close, unrelated apart
  plan: Rubik only for body, three weights; the starter scales
- [x] R3c.9 One quiet system: one corner radius for images and buttons, one icon set (lucide), one soft shadow (3s.3: about 3 px down, 30 px blur, no spread, tinted with the background or brand colour, never black), no two-colour gradients, no decorative arrows or outlines
  plan: radius 14 px, pills for buttons; no icon but the bin; no shadow used; no gradients but the button light
- [x] R3s.4 One left edge: headings, text and buttons line up on the same margin (check: site)
  plan: one left edge in each wrap; check-site
- [x] R3s.6 Controls that do the same job look the same (height, corner, style) (check: site)
  plan: one button style and size; check-site
- [x] R3s.7 Buttons in sentence case, pale dividers, no "Price:" style labels, body lines 1.5 to 1.6 apart, contrast never lowered to look soft
  plan: sentence case, pale rules, no Price labels, body line height 1.6
- [x] R3s.9 One colour per meaning everywhere (the kosher tag looks the same on every item)
  plan: kosher is said the same way, with the same seal, each time
- [x] R3s.12 The maker and their real work come right after the opening, with at least one real photo of the product in use or a real setting
  plan: n/a: no maker named and no photo of one; the question is asked; real photos follow the opening
- [x] R3s.14 Real numbers shown big (three times the body size) with a one-line label, only numbers the owner gave
  plan: XL, 4 and 3 at the display size with one-line labels, all from their listing
- [x] R3s.11 One true sentence beside the price says why it costs that (handmade, the ingredient, the time)
  plan: XL chicken board with 4 types of chicken and 3 sauces, beside the price
- [x] R5b.6 No scroll cues, no "01/06" counters, no label above every section
  plan: none; labels only on the numbers
- [x] R3.13 Structure: no doubled contact, facts or gallery; no two dividers in a row, no ending on one; only their own photos that exist; a photo gallery has at least 3
  plan: contact appears in the closing band and footer as the kit has them; no doubled facts in one section; gallery hidden until 3 photos
- [x] R3a.1 The page was rendered as a visitor meets it (the six sizes of 3p.6, each language, normal and reduced motion), every screen looked at, a scroll page walked at several positions per section, every payoff checked at its start and finish on a phone and laptop
  plan: gen/shots.mjs at laptop, short laptop and two phones, every stop of the opening looked at; reduced motion checked; English only
- [x] R3r.1 Every script above was run on EVERY page of the site, not only the home page
  plan: publish-page --check runs them on all three pages
- [x] R3r.2 Someone who did not build the page used it against `docs/page-review-checklist.md`, the builder fixed every FAIL and the reviewer looked again
  plan: a Sonnet subagent that did not build it reviewed against the checklist; review.md
- [x] R3g.12 A real test went through every form and order button (to a test business, never the owner's live inbox) before the owner saw it
  plan: every form step run with test values and the POST caught in gen/test-form.mjs, never reaching the owner
- [x] R0b.12 The business's pages-list preview clip shows the current version of the page
  plan: n/a: not published on this branch, so no clip yet; publish-page records it when Tzvi says yes
- [x] R3x.1 A product to turn is made from the owner's photo through the API and compared beside it; its dots (at most four, 44 px) say only the owner's facts; buttons turn it too; it loads after the page and is their photo with no script or reduced motion
  plan: n/a: no product to turn
- [x] R3x.2 A counted number is a real figure from the record, counts once, ends exact, and is in the page text so it shows with no script or reduced motion
  plan: n/a: no counted number; 4 and 3 stand still
- [x] R3x.3 Tabs for sizes or packages change one panel in place: picture, price and facts stay in the same spot
  plan: n/a: one item in one size in the record, so no tabs
- [x] R3x.4 With two or more sizes or packages, each is a card with its picture, price and the same measures in the same order
  plan: n/a: one item in one size in the record, nothing to compare
- [x] R3x.11 A product to turn passed the suitability check, was made from a grey-ground source of the owner's photo as two candidates reviewed from four angles, has two or three light buttons named for the business, and keeps touch-action pan-y on a phone
  plan: n/a: no product to turn

## Stage 5. Site structure (menu, footer, facts, layouts)

- [x] R3v.1 A full footer, the same on every page: who they are (name, one line, a quiet link to the main action), every page, how ordering works or Visit, Reach us, and a base line with © year, the MyIsraelRental line and a Privacy link; parts only when the record fills them (check: check-footer)
  plan: who: Finest Cuts and one line of theirs; Pages; Ordering; Reach us; base line with © and MyIsraelRental and Privacy; no since line
- [x] R3v.2 The menu bar lists the site's pages, the same on every page; a site with other pages has no #jumps in the bar; order and booking steps may keep a quieter bar (check: check-menu)
  plan: Home, Shop, Contact in the bar on every page; check-menu
- [x] R3v.6 Sections of different heights: at least two sizes on a page, never three in a row the same height (check: check-heights)
  plan: band, opening, feast and how sections differ in height; check-heights
- [x] R3v.7 Layouts (bento, zigzag steps, callouts, picture beside four facts, peek row) chosen by what the business has, never the same layout twice in a row on a page
  plan: picture beside facts, a choice panel, a plain list: never the same twice in a row
- [x] R3v.8 Effects from 3v (light on cards, fanned photos, rolling letters, circle reveal, curtain between pages, picture buttons, statement band) are chosen for this business, not the set of the site built before it, each with its phone and reduced-motion version
  plan: statement band only from the 3v list; it has no motion issue on a phone
- [x] R3v.14 Three true facts from the record right under the main button on the home page (class btn-facts) (check: check-facts)
  plan: $215 the XL board, Delivery throughout Jerusalem, Under the hashgacha of Rabbi Weiner; check-facts
- [x] R3x.8 Web basics on every page: skip link first, one h1 and no skipped levels, focus rings, labelled fields with type and autocomplete, live basket count and form messages, opening picture first and far ones lazy, two font families at most, title 60 and description 155 at most, og:title and a 1200x630 share picture, JSON-LD for the business on the home page (check: check-web-basics)
  plan: sitekit writes the skip link, live basket count, footer h2s and JSON-LD (set ld_type for this business); the build adds a 1200x630 share picture, fetchpriority="high" on the opening picture, loading="lazy" far down, labelled fields with type and autocomplete, and a role="status" line on the form
- [x] R3x.13 One type scale and one spacing scale: every text size is a step of --t-1 to --t5 and every gap of --s1 to --s10, recorded in BRAND.md; at most 10 text sizes on a page (check: check-web-basics)
  plan: every text size from the starter scale --t-1..--t5 and every gap from --s1..--s10, written into BRAND.md; nothing sized in between

## Stage 6. Prices and savings

- [x] R3c.5 Choices (sizes, flavours, tiers) are tiles to tap, never a dropdown; "Most popular" only when the owner says so
  plan: whose table and where are tiles, never a dropdown
- [x] R3c.6 The button says what happens next with a real number where there is one ("Order 4 buns, ₪55"), never "Submit" or "Buy now"; price, unit and action sit together
  plan: Add, $215; on the last step Send for Sunday, $215
- [x] R3c.7 Offers are contained: a time-limited offer shows its real end date, a first-order offer says so, standing discounts (students, soldiers, olim) need no date, "ends soon" without a real date is banned; no permanent sale, no discount on their famous item unless they say
  plan: n/a: no offers
- [x] R3j.1 A guarantee the owner offers sits beside the main button in their words and states its limit; none offered means none shown
  plan: n/a: no guarantee offered; asked
- [x] R3j.2 One real relevant add-on before ordering, with Add and "No thanks", not pre-ticked, gone once added or declined
  plan: n/a: the listing has one product, nothing to add
- [x] R3j.3 A free taster, sample, consultation or quote the owner really offers is the headline offer beside the main button
  plan: n/a: no taster or free offer
- [x] R3j.4 Group discounts (students, soldiers, first order, olim) only when the owner offers them, said once near the price; they are standing, so no end date is needed
  plan: n/a: no group discount
- [x] R3j.5 Come-back features only if real: a stamp card the owner runs, a Reorder button; no streaks, valueless points, or reminders for something not started
  plan: n/a: no stamp card; the tracking link is the only return path
- [x] R3j.6 The natural pick among three sizes/packages is shown, but no invented option to make another look good
  plan: n/a: one size
- [x] R3j.7 Never: a struck-through or "was" price that is not real, prices changed to .90/.99 endings, an endorsement they do not have
  plan: none: the price is the listing price, nothing struck through
- [x] R3j.8 A saving is shown only when true like for like: same contents, same product line, worked out per unit in a table of every option, and the bigger option's unit price is lower than EVERY smaller option, measured against the cheapest
  plan: n/a: one product, nothing to compare
- [x] R3j.9 A lone saving among many products is not shown, but each small group (single/double pack, 4/8 box, service with its add-on) shows its own
  plan: n/a: one product
- [x] R3j.10 A saving is shown as a percentage badge of two or three words ("25% off") with the real separate price struck through beside the new price; percentage = (separate minus new) / separate, rounded DOWN to a whole number; the button carries the offer and its price and no sentence explains it again; never how much more the bigger one costs
  plan: n/a: no saving
- [x] R3j.11 A combined service against its parts, and basket lines a package would make cheaper (one line with the saving and a Switch button), are shown when real
  plan: n/a: one product
- [x] R3j.12 An owner's own savings claim the prices contradict is not printed; the owner is asked
  plan: n/a: the owner makes no savings claim
- [x] R3.14 Loud prices only when prices exist, never on a premium or quote-based business
  plan: one price, shown large, as a food shop does

## Stage 7. Order and booking flow

- [x] R3k.7 The order is in steps after choosing: Step 1 basket, Step 2 when and where, Step 3 details; a three-line "Step N: name" bar; order and total beside every step (under it on a phone); the button names the next step and, last, what happens with the total; a Back button; the browser back button goes back one step (#order-2); each step checks only its own fields (check: site)
  plan: three step bar, order and total beside each, Back, browser back with #order-2, each step checks its own fields; check-site
- [x] R3k.8 Every basket line, packages included, has a remove button (40 px, "Remove X from the basket") beside its stepper (check: site)
  plan: a bin button, 40 px, Remove Ultimate Feast from the basket, beside its stepper
- [x] R3k.6 The basket lives between pages: an Add on any page puts the item in and opens the order page with it there
  plan: any Order the feast link puts one in the basket by ?add= and opens the order step; kept in localStorage
- [x] R3k.9 Every order or booking is POSTed to MyIsraelRental (the business's order form) before WhatsApp opens; every product on the site is a product of the listing with the same name and price
  plan: POST to the order form with product id idx:0, then WhatsApp; the name differs from the listing only by the spelling Tzvi is asked to correct
- [x] R3k.10 The order form arrives filled in: the day field holds the first day the business can do (lead time, closures), quantity 1, the owner's most common choice pre-chosen; all changeable, a customer's pick never overwritten (check: check-prefill)
  plan: the day holds tomorrow, or Sunday after a Saturday; quantity 1; Your table and In Jerusalem chosen; check-prefill
- [x] R3.15 What the brief asks visitors to do has a place to do it (book or order needs the services block, message needs contact, visit needs hours and address)
  plan: ordering has the Shop; messaging has Contact
- [x] R7.1 Three options are for the automatic page builder only; a hand build picks one direction itself and says why in one line in CONCEPT.md, with no options page put to Tzvi or the owner unless asked
  plan: one direction with its reason in CONCEPT.md
- [x] R8.5 Every main button goes to the quickest route to a finished order the business has: its order page, then its price list, only then WhatsApp; WhatsApp stays the quiet secondary; the how-to-order steps describe the real path
  plan: every main button goes to the order step; WhatsApp is the quiet contact
- [x] R0b.13 The order saves with a tracking link before opening WhatsApp, and the order reaches the owner complete
  plan: shop.js saves first and adds the track_url to the message; tested with a stand-in API
- [x] R3l.1 For every family of similar items the owner was asked what a customer can choose and how many
  plan: asked in OWNER-QUESTIONS.md: can a customer choose the types or sauces
- [x] R3l.2 Each item says on itself what it allows ("Up to 4 kinds of chicken · 3 sauces", "1 kind"), in the same words on the tile, the order line and the order message
  plan: the one item says 4 types of chicken and 3 sauces on the tile, the order line and the message
- [x] R3l.3 Choices belong to the item: options appear once it is added, only for items that allow them; one choice is radio; a limit greys out the rest; an item needing a choice cannot be sent without it, with the reason beside it
  plan: n/a: the record lists no choices for the item; asked
- [x] R3l.4 Three or more alike items are compared at a glance: only what differs, side by side
  plan: n/a: one item
- [x] R3l.6 A picture is of the item as it is sold now; no picture beats a misleading one
  plan: the board photo is the listing photo for this product
- [x] R3l.7 Read each item alone: a customer can tell what they get and what they can choose without reading another item
  plan: the item reads alone: what you get and its price, with no choice to make
- [x] R3e.9 Buttons have rest, hover, pressed and disabled states; fields have focus and error states with a message; every action confirms ("Sent", "Copied"); anything hover-only has a phone version (check: site)
  plan: all buttons have rest, hover and pressed; fields focus and error; Add confirms by a note; check-site
- [x] R3e.19 Every flow has a visible end: a clear "Done" screen after ordering, lists that end, "Save and finish later" on long forms; progress shows only true numbers
  plan: after sending, a thank-you line says the order is open in WhatsApp; the basket empties
- [x] R3s.16 Fewer choices first: a plain question ("How many people?") before a long list; the sensible option is chosen on purpose
  plan: one question per screen, each with its sensible choice already made
- [x] R3s.18 Not available shows the nearest real alternative; every choice list has a way out ("None", "Other", "I'm not sure")
  plan: a Saturday shows the next day with a button; where can be Elsewhere in Israel
- [x] R3s.25 The order or booking form sends nothing when empty and shows what is missing; filled, it sends a WhatsApp message carrying the total the page shows (check: site)
  plan: empty basket shows why; filled, the message carries the total; check-site
- [x] R3x.9 A request-type business's form builds a plain summary beside it as the fields fill, sends that summary, and states no price or promise the record lacks
  plan: n/a: a shop with products and a basket, not a request form
- [x] R3x.10 The prices or running total stay in view beside the order or booking form on a laptop, and a total line sits above the send button on a phone
  plan: total card sticky beside the form on a laptop, under it on a phone with the total above the button
- [x] R3x.14 The order page has the gift card section (SITE.gift_section, gift.js): hidden until the owner switches gift cards on, bought in place with no sign-in, and it shows only the owner's amounts, note and payment links (check: check-web-basics)
  plan: SITE.gift_section() and gift.js on the order page; hidden until the owner switches gift cards on

## Stage 8. Motion

- [x] R3f.1 A scroll effect plays while its subject is wholly on screen (held on a stage that fits, or started only when all in view); captured at 0, 25, 50, 75 and 100 percent on laptop, short laptop and phone, the whole subject is visible and the effect is mid-way where it should be
  plan: the opening is a sticky stage that fits; stops looked at on laptop, short laptop and phones
- [x] R3f.8 A scroll-tied effect finishes while its subject is mid-screen (top on screen, centre no higher than 40%) at six sizes (check: scroll-finish)
  plan: the line under the numbers completes by the time they reach mid-screen; scroll-finish
- [x] R3f.9 A list that stacks on a phone runs item by item (each item lights at about 80% down)
  plan: the list reveals item by item as each comes into view
- [x] R3f.5 Text widths are in em or rem, never `ch`; a text shimmer is an overlay, never background-clip on the letters
  plan: em and rem widths; no text shimmer
- [x] R3f.4 A motif from the logo (a bow) never lands on the logo that already has it
  plan: n/a: nothing from the logo is animated
- [x] R3g.4 Every motion has one job (guide, confirm, reveal); loops start and end on the same frame; text settles soft to sharp without bounce; list rows about 100 ms apart; menu hover under 300 ms
  plan: each motion guides or confirms; nothing loops; hover under 300 ms
- [x] R3e.16 No linear easing (ease-out or a spring); a transition grows from what was tapped and finishes under 0.5 s
  plan: ease-out curves everywhere, under 0.5 s except the first arrival of the light
- [x] R3e.17 A carousel shows a sliver of the next card, with visible buttons or dots (mirrored in Hebrew); a bottom sheet closes by swipe-down AND a close button
  plan: n/a: no carousel or sheet
- [x] R3e.18 Ambient background video only: camera locked, subtle, seamless loop of about 6 s, still poster, still for reduced motion
  plan: n/a: no background video
- [x] R3a.2 Nothing moves without a reason: a clip behind text holds still except its subject; text never re-wraps while its container animates; no in-between state looks unfinished (checked at the middle of every transition)
  plan: nothing moves but the board and light; words are in fixed places; stops between parts looked at
- [x] R3a.3 Anything placed on a spot in a photo/video is placed by measurement and lives inside the media's element; a label never covers what it labels; a caption stays until the next replaces it (check: overlay-truth)
  plan: part positions measured on the photo, the light is inside the scene that moves with it; chapter cards stay until the next replaces them
- [x] R3a.4 A held (pinned) section is designed to fit its content at 1280x650; if it truly cannot, it plays as the page scrolls without holding the screen and is still the signature; the order section is never held (check: cutoff)
  plan: the stage is only the photo and short words, fits at 1280x650; the order section is never held; cutoff
- [x] R3a.5 Pinning and scrubbing yes, taking the scroll's speed or direction no, no parallax on phones, reduced motion shows a still
  plan: no scroll takeover, no parallax on a phone, reduced motion shows the still
- [x] R3s.2 Nothing jumps: late photos fade in over 200 to 400 ms into space kept for them; choosing something never moves the layout (check: site)
  plan: pictures have kept space; the whose table panels stack in one cell so nothing moves; check-site
- [x] R3s.1 Everything pressable answers within 100 ms with a hover and a pressed state (check: site)
  plan: hover and pressed on everything; check-site
- [x] R3s.8 Buttons over a photo sit in a soft container, checked on a light and a dark photo
  plan: no button sits over a photo: the words are on plain stone
- [x] R3s.10 The picture appears the moment a thing is named
  plan: the camera arrives at each part as its chapter line shows
- [x] R3s.27 Same thing, same place: a repeated kind of thing (each size, step, card, slide, scroll state) is written in the same place and style every time, and a growing block hangs from a fixed top so its heading never moves
  plan: chapter cards always in one place; the three order steps in one place; check-same-place
- [x] R3s.28 No blank screen anywhere in the scroll: at every stop something is there to look at (words, a picture, the film), never a screen of plain ground (check: check-blank)
  plan: every stop shows the board and words; check-blank
- [x] R3i.3 A live readout tied to the scroll shows only a true fact of their process, small mono at a corner, never a made-up number
  plan: the chapter line is a true count from the listing; not a section counter
- [x] R3s.21 No script errors, console errors, 404s or dead links between the site's pages (check: site)
  plan: looked for across all pages by check-site
- [x] R3x.6 At most one sentence lights up word by word, and the site built just before does not have one
  plan: n/a: no words light up
- [x] R3x.12 A progress line is used only on a page of six screens or more, 2 to 3 px in the accent, aria-hidden, never over the menu or phone bar
  plan: n/a: no progress line; the line under the numbers is a mid-page accent, not page progress

## Stage 9. Phone

- [x] R3b.6 On a phone the action is pinned to the bottom with the price or proof beside it, from after the first screen until the order section; a bar that carries a counter or clock is there from the first screen and only its button waits
  plan: phone bar with $215 and the button after the first screen, also through the opening, gone at the order and closing bands
- [x] R3f.7 The bottom bar fits at 360 px: its label shrinks or wraps, its button never
  plan: the bar has a short label and a nowrap button, looked at on 360 wide
- [x] R3a.6 A fixed bar never covers content (room is kept for it, including the last line and the end of the page) (check: site)
  plan: chapter cards and the page end keep room for the bar; check-site
- [x] R3s.22 Everything to tap is at least 40 px on a phone and no two taps overlap (check: site)
  plan: all taps at 44 px or more; check-site confirms
- [x] R3s.23 The page never scrolls sideways on a phone (check: site)
  plan: no wide parts on a phone; check-site confirms
- [x] R3s.26 No words sit on other words anywhere on the page, pinned scenes included, on short laptops (1366x768, 1280x720), 1440x900 and a phone (check: check-overlap)
  plan: check-overlap
- [x] R3t.1 The site declares its category (CONCEPT.md and a site-category meta on every page) and follows that category's row of the 3t table: ground and colour, pictures, how it sells, type
  plan: food-shop in CONCEPT.md and a meta on each page; the owner dark look stays, the rest follows food-shop
- [x] R3t.2 food-shop and fashion-shop: a price and an Add or Order control within the first two screens; every product card has photo, name, size or servings, price and a button
  plan: price and button on the first screen; the card has photo, name, size, price, button; servings are asked
- [x] R3t.3 trainer: at least a third of sections are picture, never three plain sections in a row
  plan: n/a: not a trainer
- [x] R3t.4 A real footer on every page, identical: a last big line, the button, link columns, contact, the MyIsraelRental line (since 1 Nov 2026 the full footer of R3v.1)
  plan: kit full footer on every page
- [x] R3a.7 Every state is checked on the device that shows it (touch emulation for phones, never a narrow desktop window; hover-only looks have a touch version)
  plan: phones checked with touch emulation; hover-only items have a press state
- [x] R3a.8 A line of items separated by dots never wraps
  plan: no dot lines: the facts are stacked

## Stage 10. Order details and report

- [x] R3u.2 A day the business cannot do (closed, full, inside the lead time) or a quantity over its limit gets one plain line under the field naming the next possible one, with a button to choose it; the form never quietly refuses or changes the pick
  plan: a Saturday or a past day shows one plain line and a button naming the next possible day
- [x] R3u.3 Price per portion beside each size ("about ₪25 a person") when the owner gave servings or pieces, rounded down; without figures the question is in message-to-owner.md
  plan: n/a: servings not given; asked in OWNER-QUESTIONS.md
- [x] R3u.5 A home page with no scroll film: the first screen arrives in order (bar, headline, line, picture, button), about 1.5 s, once; all there without JS or with motion off (check: check-arrival)
  plan: the light comes up on the board and the headline, line, button and facts arrive in order, about 1.3 s, once; all there without script or with motion off
- [x] R3u.6 Depth on laptops: separate pieces on the first screen move at their own speeds with the scroll (near faster, far slower), laptops with a mouse only, still on phones and with motion off
  plan: n/a: the scroll scene carries the depth; not used
- [x] R3u.7 At most one rotating word, in the headline, from the owner's real occasions or products; reads right with each; full list for screen readers; first word with motion off; not beside a film's moving words
  plan: n/a: no rotating word
- [x] R3u.8 A tilted label over headings, if used, is this site's own shape from its world and in fingerprints.json, never another site's
  plan: n/a: no tilted labels
- [x] R3u.9 Questions are rounded cards on `<details>`, "+" in an accent circle turning into "x", the answer opening smoothly inside the card
  plan: questions place uses details cards when filled; hidden now
- [x] R3u.10 A business with two or more places has its list beside a map in the site's colours with numbered pins, the map held on a laptop and above the list on a phone
  plan: n/a: no places
- [x] R3u.11 The page passed its checks with a still where the film goes before the film went in
  plan: the page passed before anything else; no film goes in
- [x] R3u.12 Every moving piece not in the kit was tried on a test page with buttons for each state before it went in
  plan: the tour and choice were tried on the page with shots at each stop; kit parts not used
- [x] R3u.13 gen/report.md ends with "Not done yet" and "For your call" (at most two)
  plan: gen/report.md ends with Not done yet and For your call
- [x] R3u.14 gen/copy-pass.md holds a shorter version of every line over 20 words and paragraph over three lines; the shorter is used unless it drops a fact
  plan: gen/copy-pass.md
- [x] R3w.1 Every generated food shot has a real cause on screen (a hand, a spoon, gravity), one event of 2 to 4 s, and its end stays; nothing floats into place or appears, no smoke or flash wipes between shots; except in the opening film, where the owner's own ingredients may swirl and float round the product in advert style, marked in the brief (the product itself never changes, nothing pops in or out in the open)
  plan: n/a: no generated food
- [x] R3w.2 Generated liquids and steam look real: sauces opaque and thick, no glassy drips or big glass bubbles, steam thin wisps lit from behind, never a cloud
  plan: n/a: nothing generated
- [x] R3w.3 Generated food is lit from the side and behind with the camera side darker, never flat from the front; a pour or fall stays sharp when paused
  plan: n/a: nothing generated
- [x] R3w.4 The film's start and end pictures were right before any clip was made; each clip was made once at full quality (a draft only where get_cost showed it under a third of the price); simple motion (a growing crack, push-in, drift, holds) is done in code; every clip judged at 4+ fps
  plan: n/a: no film
- [x] R3w.5 No bite, chew or tear is shown in motion unless Tzvi approved that take; otherwise the film cuts to the result
  plan: n/a: no film
- [x] R3w.6 A scroll film's scrub ends where the clip's motion ends (check-clip's figure), the last hold is short, and its last frame is the picture the next section shows
  plan: n/a: no scroll film

## Stage 11. Finish

- [x] R3r.3 `check-rules` passes, every script above passed on every page after the last edit, and a fix was checked on the screen it was for (check: check-rules)
  plan: publish-page --check run after the last edit
- [x] R3r.4 A rule Tzvi had to point out twice has a script or a line in this file the same day
  plan: n/a: Tzvi has pointed out nothing on this site yet
