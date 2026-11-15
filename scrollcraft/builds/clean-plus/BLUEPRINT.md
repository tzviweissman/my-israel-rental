# Blueprint: clean-plus

Every rule of docs/rules-checklist.md, in the order the site is built. Before building a stage, write the plan for
each of its lines (what this site will do for that rule, or `n/a: <why the site has no such thing>`), then
`node scripts/blueprint.mjs --check clean-plus <stage>`. Tick [x] as each is built. RULES.md is written from this
file (`--rules`); the scripts named in a line confirm it at publish.

## This site has

Answer each before stage 1: `node scripts/blueprint.mjs --has <thing>=yes|no clean-plus`. A "no" moves that thing's rules
out of the stages (listed once at the end, not read); the files are checked for it at --done, --rules and check-rules.

- film: no  Does the site have any video: an opening or scroll film, a background video or a generated clip?

## Stage 1. Facts and words

- [x] R0b.1 Published under the business's real slug from the live record, not a made-up one
  plan: slug clean-plus, read from the live public record /api/marketplace/business/clean-plus
- [x] R0b.3 Prices and currency on the page match the owner's own menu or flyer; the real menu is loaded in their shop with fixed product ids
  plan: one price, the listing's Weekly cleaning 4 hours ₪325 (ILS), shown as ₪325; nothing else priced; the listing has no products, so the request saves against that tier
- [x] R2.1 Only facts the owner or record gave: no invented number, "since", "fresh daily", "trusted by", guest counts
  plan: n/a: no founding year in the record, so no "since" line
- [x] R2.2 The owner is asked only about their own business, never how we build (no tools, credits, vendors), and never what the record already answers
  plan: OWNER-QUESTIONS.md asks only about the business (phone, prices, what a visit includes, supplies, hours, areas, photos, reviews), nothing the record already answers
- [x] R2.3 The message to the owner has 5 to 8 example FAQ questions written from this business's real details, plus the worry / first days / photo-in-use questions when the page does not answer them
  plan: OWNER-QUESTIONS.md 13: seven example questions from a weekly cleaner's real details (be home, skip a week, oven and fridge, Pesach, offices, paying, not happy), plus photos (10) and a promise (11)
- [x] R3.1 Every claim has proof: kosher needs a certificate and a food business; licensed needs a licence number; verified; reviews/stars need real reviews; years need a founding year; English needs English among their languages; best, #1, award, guarantee, insured, 24/7, emergency, fresh daily, delivery, medical words only in the owner's own words
  plan: n/a: no certificate, licence, insurance or reviews in the record, so no such claim; "professional cleaners" is the flyer's own words
- [x] R3.2 No urgency or scarcity: only N left, hurry, today only, limited time, ends soon, countdowns without a real end date, booked N times, invented counters
  plan: no counts, no deadlines, no "only today" anywhere
- [x] R3.3 No sentence that fits any business (welcome to, look no further, one-stop shop, passionate about, quality you can trust, world-class, top-notch, and Hebrew equivalents)
  plan: every line names weekly cleaning, Jerusalem, the 4-hour visit or the plan; no stock phrases
- [x] R3.4 No exclamation marks, no long dashes, no words in capitals unless their name
  plan: checked: no exclamation marks, no long dashes, no capital words
- [x] R3.5 The headline or the line under it names something they really sell, in the words of their own listings (a place name alone does not count)
  plan: headline is the flyer's "Home cleaning, your way." and the line under it "Weekly home cleaning across Jerusalem. Four hours, ₪325."
- [x] R3.6 Everything written is in the page's language; a Hebrew page is Hebrew in every line and is written, not translated; RTL layout checked
  plan: English only, every line; the record's language is English
- [x] R3.7 Nothing missing is faked: no FAQ section until the owner sends questions and answers, no reviews/social proof unless real and consented, no empty section, no placeholder or "coming soon"
  plan: no reviews, no questions section and no gallery until the owner sends them; nothing says coming soon
- [x] R3.8 No logo walls, "As seen on", award laurels, invented "Best match / Popular" badges, stars or counts without real reviews, "$80 of value" gifts, intro prices that renew higher
  plan: none of these on any page
- [x] R3.9 The page repeats the promise that brought the visitor, and its words match the ad, flyer or message that sent them
  plan: the flyer's promise word for word: "Home cleaning, your way", "Pick the options that fit you and we'll build the right plan", and WhatsApp
- [x] R3.10 At most two strengths, each checkable and with its proof
  plan: two strengths only: weekly 4 hours for ₪325 (the listing) and the same cleaner every week on request (the flyer); both their words
- [x] R5.1 Their words first and specific: every line could only be about this business; a line a competitor could say is rewritten; the customer's problem comes before what they do
  plan: the flyer's words throughout (every week, every two weeks or just once; same cleaner; equipment and supplies; move-ins, after renovations; before Shabbat, holidays or guests)
- [x] R5.2 Professional voice: no teasing, scolding, slang or jokes; the owner would print every line on their menu
  plan: plain professional lines, read aloud as the owner would say them
- [x] R5.3 Short labels are full phrases ("Kosher, hechsher from Rabbi Weiner", "Made in Jerusalem, delivered across Israel")
  plan: n/a: no certificate in the record, so no short label about one
- [x] R5.4 The visitor is "you"; the business is "we" or its name, never "they", "them" or "their" about itself, in labels, errors, captions, alt text and footers; every English line makes sense said by the owner
  plan: the business speaks as "we"; visible text searched for they, them and their about itself
- [x] R5b.2 One button, one label: the main button has the same words and the same destination in the header bar, hero, selling sections, phone bar and footer (over a photo the bar's version may be the outline style)
  plan: "Build your plan" to book.html in the header, opening, board, options, price card, close band, phone bar and footer
- [x] R5b.8 A finish or closing line names what the customer gains, never "done" or "complete"; every line makes sense where it sits; "or" and "prefer" only when the other choice is visible
  plan: close line "A clean home every week, on the day you choose."; no "or" without the other choice shown
- [x] R3.11 The headline says what the customer gets (their result, in the owner's words), and the order of the page follows the visitor's questions: what is it, can I trust it, what does it cost, what do I do; prices come before any enquiry form
  plan: headline is their result (home cleaning your way); order: what (opening), what it costs (₪325 card), what is in a plan (the six options), how it works, then Build your plan; the price comes before the form
- [x] R3o.4 Every contact is labelled by what it does ("WhatsApp or call", "Call only, no WhatsApp"); the owner said which number takes what
  plan: one number, +972 50-423-2291 from the listing, labelled "WhatsApp"; whether it or the flyer's 058-713-0664 takes calls is asked (question 1)
- [x] R3e.22 The owner stays visible as a person: name, real photo, direct WhatsApp
  plan: n/a: no owner name or photo in the record; asked for photos (question 10); WhatsApp goes straight to the owner
- [x] R3s.19 The same promise line and photos on the link preview, home page and shop; every page has its own title, description and og:title/og:description/og:image
  plan: every page has its own title, description and og tags; one og picture made from the opening, same promise line on all three
- [x] R6.1 The category playbook's lead block comes first and its must-have blocks are there
  plan: cleaning playbook: the service and its price lead after the opening, the action is the plan request, no insured or eco claims
- [x] R4.1 Missing data reads as deliberate ("Ask for a quote" instead of a missing price) and is listed as a content gap, never invented
  plan: everything without a price reads "Price on request" in the plan summary; gaps listed in gen/report.md

## Stage 2. Photos and media

- [x] R8.1 A set of images shown side by side (category tiles, product grids, size or flavour photos, thumbnails) reads as one shoot: same camera angle, same light from the same side, same plain background, subject at the same size and crop
  plan: n/a: no set of images side by side; the site has one picture
- [x] R8.6 Every main product picture is a product hero shot: one product large and sharp, eye level, slightly turned, on a plinth from its own world, its own real ingredients round it, one colour story, one warm light, still or mid-air (not both); the product is exactly theirs
  plan: n/a: a service with no product to shoot
- [x] R8.8 Each product picture in a set is a full scene: two to four props from the business's world, never one lonely prop; plinth, props and product in the same places and height on every card, a bigger size bigger on the same plinth; one layout sketch for the set
  plan: n/a: no product pictures
- [x] R8.9 The owner's photo goes only on the size or item it shows; asked which one when they did not say
  plan: n/a: no owner photo of an item; the flyer is used for facts and colours only
- [x] R8.7 Every paid generation had a gen/<name>-brief.md first: a close crop of the one item, its traits written from the crop and kept, only the camera, light or setting changed, no idealising words, still before video, result compared beside their photo before showing
  plan: gen/room-brief.md written before generating; no owner photo to compare with, only the flyer's feel
- [x] R8.2 The set came from the owner's own matching photos first; else the whole set generated in one pass from one style preamble (product pictures are edited from their own photo, never made again from words alone); stock only from one photographer's matching series; no cut-outs mixed from many photos
  plan: n/a: one opening picture only, no set
- [x] R3p.7 Similar items are shown the same way: if one flavour's thumbnail is one jar, every flavour's is one jar; a list where pointing at an item changes a big photo does so for every item
  plan: n/a: no item pictures
- [x] R3p.8 Optional: if the site's touch lives on its buttons, every button doing that job carries it in the same shape, small, moving only when pointed at or pressed, words still readable, reduced motion respected; n/a when the touch is elsewhere
  plan: the touch is the gold booked mark on the board, not on buttons; the button arrow is the same shape on every Build your plan button, moves only when pointed at, off with reduced motion
- [x] R3h.12 One look per product everywhere: film frame, close-up, picker, tile, card and order form show the same object, cut or edited from one master; a name with unknown look gets no picture
  plan: n/a: no products
- [x] R3h.10 Choosing an option changes its picture, words and button; one photo per option, from one shoot, sharp at the size shown (check: motion)
  plan: n/a: the tiles change the plan's lines, sentence and link; there are no option photos
- [x] R3g.14 One colour grade across every image and clip on the page
  plan: one picture, so one grade
- [x] R3o.1 Generated food in motion appears only in the full-screen opening film (advert style, checked frame by frame at 4 fps or more: no food from nowhere, no glass or neon look, pieces never fade or vanish); everywhere else on the page food is the owner's real photo; outside the film generate only scenery, light, steam or a plain drawing
  plan: n/a: no food
- [x] R3o.2 A generated liquid (opening film only) is opaque, satin, with specks, not glass or neon
  plan: n/a: no generated liquid
- [x] R3o.3 Product colours look true (no cast from cloth or light)
  plan: n/a: no product colours
- [x] R3o.6 One photo per kind, from everything the owner sent, duplicates skipped, unclear kinds asked about; screenshots cropped at their real resolution
  plan: two owner images: the flyer (text baked in) used for facts and colours only; the receipt shows a customer's name and is never used; real photos asked for
- [x] R8.3 Generated media only of items they really sell; no generated person shown as their staff or customer; no made-up premises; no text baked into an image; nothing non-kosher in a kosher business's images; the owner approved every piece
  plan: the generated room is a home like a customer's, no people, no text; never called their work or premises
- [x] R8.4 Any moving real material (ribbon, fabric, steam, a pour) is a generated clip made in Higgsfield (kie.ai only if Higgsfield cannot), showing cause then effect, never SVG or CSS; food in motion only per R3o.1; reduced motion shows the still
  plan: n/a: no moving real material; nothing on the site is filmed
- [x] R3c.13 Nothing cut off: every label, number, ruler and photo sits wholly in its section at every size (only things marked `data-clip-ok` may be cut while travelling) (check: clipped)
  plan: clipped run on every page
- [x] R3c.14 A cut-out is one subject: no stray garnish, specks or pale fringe, looked at on a dark and a light ground (check: cutout)
  plan: n/a: no cut-outs
- [x] R5b.3 Text over imagery: words sit on the picture with a soft edge shade (or a small solid card), never big dark pools, full-frame darkening or frosted glass, and meet contrast at the brightest frame; on a phone they cover at most 40% of the opening picture's detail; a plain strip under the photo only where the picture is too busy (check: readable)
  plan: words on the calm white wall of the picture with a soft white edge shade at the left; on a phone the words sit under the picture on white; readable passes
- [x] R3e.8 Every word is at least 12 px (14 px for a sentence on a phone) and 4.5:1 contrast (3:1 large), button text 4.5:1 on its fill (check: readable)
  plan: readable passes on every page
- [x] R3s.24 Media is light and sized: no photo over 600 KB, every `<img>` has width and height, every video has a poster, nothing stays hidden with motion off (check: site)
  plan: pictures under 100 KB, every img with width and height; no video
- [x] R3p.6 Fits on one screen: every section fits below the menu bar at the laptop sizes; no photo taller than the screen at any of the six sizes; no photo shown over 1.35x its own size; a big photo of another shape than its box is extended to the box's shape (padded, the new edges generated, the original pasted back), never zoomed or framed (3c.12, Tzvi 27 Oct) (check: fits)
  plan: fits passes at the six sizes; the room is made in both shapes so nothing is zoomed
- [x] R3o.5 Every special character (₪, arrows, Hebrew, dots) renders in the font used for it (check: site)
  plan: the ₪ sign set in the system face (system-ui, which has it on every platform) through kit.price and the .sym class
- [x] R3x.7 BRAND.md in the build folder (colours with their uses, two fonts, logo on light and dark, textures, Design bans) was written before any picture was generated, and the site uses it
  plan: BRAND.md written before the picture: colours with uses, Plus Jakarta Sans and Public Sans, the scale, logo on light and dark, bans
- [x] R3z.4 No dark layer or gradient over a whole photo or film; a shade only behind the words where measured contrast needs it
  plan: no dark layer over the photo; a white shade only behind the words on the left half
- [x] R3z.7 Card pictures generated without owner photos were made as one set from a saved screenshot of a real site's grid (path in docs/inspo), each tile checked as R8.1
  plan: n/a: no card pictures

## Stage 3. Opening

- [x] R3g.13 The first screen holds a picture, a headline of 2 to 5 words that says what the customer gets, at most one short line (where the business is: the line or the small label, not both; trust goes there or right under the button) and one button; the header does not count
  plan: the room picture, the 4-word headline "Home cleaning, your way.", one short line with the place and the price, one button, then the three facts
- [x] R3g.18 The first screen shows what the business offers before any scroll: one kind may be shown by the picture or the words; two or more different kinds are each named in the headline or big words; the home page lists them in <meta name="offers"> (check: check-says-offer)
  plan: one kind, weekly home cleaning, said in the headline and the line under it; meta offers "weekly home cleaning"
- [x] R3b.1 The first screen answers: what it is, where, why trust it, what to do next
  plan: what (home cleaning, weekly), where (all around Jerusalem), trust (the ₪325 price and the WhatsApp number by the button), next (Build your plan)
- [x] R3b.2 Proof (price, credential or rating) touches the main button; for food a kosher band sits just after the opening, not crowding the button, and the certificate is stated at most twice as a sentence or band (a small identical kosher tag on items does not count)
  plan: the ₪325 a visit fact touches the main button; n/a for kosher: not a food business
- [x] R3b.3 One solid action per screen: header button and phone bar repeat it; the header button is outline when the hero shows a solid one; everything else is outline, link or tile
  plan: one solid blue button per screen; the header button is outline; the board's button is the same Build your plan action
- [x] R3h.20 A scroll-driven opening runs at 60 fps, is at least 3 screens long, shows the product on a plain ground of its own world (never on a photo of the same kind of product), keeps the product and photos whole, and loads the first screen first (check: check-opening-scroll)
  plan: n/a: no scroll-driven opening; the opening is an event built in code that plays as the page arrives and on each tap
- [x] R3h.21 Effects, never too much: the opening film may hold the page for its length; any other section that holds the page while the scroll changes it is at most a screen and a half, at most three in all; longer turning becomes a tap; nothing stands between a phone visitor and the products or the order (check: check-one-scroll)
  plan: nothing holds the page or follows the scroll; the board sits beside the headline and the options have their own plan line
- [x] R3aa.1 A scroll-led opening changes the whole screen as the product's journey (camera travels, product crosses, layout grows), never a small change on a still
  plan: n/a: not a scroll-led opening; the event is the visits landing and repeating as the page arrives
- [x] R3aa.2 The opening is one continuous story with no cuts or fades between scenes, joined one way named in CONCEPT.md "- join:"; clips start on the last frame of the one before (check: check-clip)
  plan: n/a: no film or clips
- [x] R3aa.5 One or two huge words per step in the clear space of the picture, at most one short line under them, never small labels on the film
  plan: n/a: no film steps; one headline on the picture's calm wall
- [x] R3aa.6 One large subject, each step held about a screen of scrolling, three to five steps
  plan: n/a: no film steps
- [x] R3aa.7 Pinterest searched on every build beside Inspo, Mobbin, 21st and docs/inspo; kept pictures saved to docs/inspo; REFERENCES.md says what was taken and why
  plan: Pinterest searched: docs/inspo/pinterest-clean-plus-2026-11-15 (four pictures, README), named in REFERENCES.md
- [x] R3aa.10 Where the product has parts or a process, one step shows it taken apart or opened in the air
  plan: n/a: a service, no parts
- [x] R3aa.12 One palette and a little life: props from their world in the site's two or three colours, one small movement in each scene beside the main one
  plan: one palette: white, the flyer's pale blue and navy, royal blue visits, the gold booked mark as the small movement beside the main one
- [x] R3aa.13 Every sketch, still and clip for approval is shown as a laptop frame beside a phone frame
  plan: n/a: no sketch or clip for approval; the opening is shown live at a laptop and a phone size in the report
- [x] R3aa.18 An Add says Added in the basket button and the phone bar, which becomes the basket; never a message floating over the products
  plan: n/a: no basket
- [x] R3aa.19 Every saving is worked out from the live prices of the smallest size of the same thing; a dashboard price change reaches every card, saving and total
  plan: n/a: no savings
- [x] R3aa.25 Plain links in the site's ink and underlined; link targets clear of the menu bar
  plan: plain links in the accent-deep blue, underlined; nothing sits under the menu bar
- [x] R3aa.30 Every page passes check-iphone: no script error, nothing wider than the screen, the film moves
  plan: check-iphone runs on every page through publish-page: no script error, nothing wider than the screen; no film to move
- [x] R3bb.1 A new site picks at least three small touches from 3bb that fit its category and story, named on a "- touches:" line in CONCEPT.md, not the same three as the site built before; each shows only true facts
  plan: CONCEPT.md touches: each choice brings its own pieces, ending on how it arrives (the WhatsApp message), one signature button shape (arrow on a line); RBS, built before, had none of these
- [x] R3h.1 The home page opens on a full-screen picture or film (at least 70% picture) and it is an event from their own thing (a film, or an event built in code), proposed with the first build, never after (check: site)
  plan: opens full screen on the room picture with the plan board, an event in code from their own promise: the visits land on Tuesday and repeat down four weeks
- [x] R3n.1 The owner's strongest real photo fills at least half the first screen on a laptop and on a phone, not a small card or cut-out shape
  plan: n/a for the owner's photo: none exists; the generated room fills the first screen on a laptop and 46% of a phone's, asked for real photos (question 10)
- [x] R3n.2 One signature moment only this business could have, driven by the visitor (scroll scene or a choice)
  plan: the plan board: a 4-hour visit landing and repeating, moved by the visitor's tap
- [x] R3n.3 The visitor's choice changes the page (colour, hero, order), not just one picture (check: motion)
  plan: a day tap moves every visit; the pills lift visits off; the option tiles add lines and change the label; the sentence, price and link follow
- [x] R3n.4 Side by side with the closest reference in docs/inspo for this kind of business, ours is not plainly weaker
  plan: beside the saved plan cards (CONCEPT.md wow 4), ours books itself and answers each tap
- [x] R3n.5 The one-sentence test, told to someone else and run on the first five seconds and the first full scroll: "you land and ___ happens" is about the business, not a decoration ("nothing", "the camera moves", "it fades in" fail)
  plan: "you land on a bright Jerusalem living room and a 4-hour cleaning visit drops onto Tuesday and repeats down the weeks; tap another day and every visit moves to it"
- [x] R3g.15 The opening is made for this business at full quality: never a flyer crop or low-resolution photo, and a generated setting is never presented as their real premises (check: fits)
  plan: never the flyer: the room is made for the page at 1920 wide and never called a customer's or our home
- [x] R3h.11 Every film and generated still set is bright: middle third at least 33, whole frame at least 22, average at least 30; the subject is the brightest thing; viewed on a phone in daylight (check: brightness)
  plan: the room picture is bright morning light; checked with brightness numbers before it stayed
- [x] R3h.13 One cause, one motion: the cause and its result are one clip, code pieces start on the cause frame and match the film's material, and the effect passes a 4 fps watch (no fall-then-fly, no pause, no blocks for flakes, no heap from nowhere, nothing wrong played backwards)
  plan: one cause, one motion: the tap is the cause, the visits sliding to the day is the one result
- [x] R3h.14 The product stays recognisable through the whole effect; a moving camera never loses it; on a phone the frame widens if pieces travel past the crop
  plan: n/a: no product in the effect
- [x] R3x.5 A following light is used only for a dark-world business, has an off button, sweeps once by itself on a phone and with reduced motion, and never dims the words or main button
  plan: n/a: a bright business, no following light
- [x] R3z.2 The first screen has three layers: a real photo, the film or a soft shape of the business's colour at the back, the words and any card in the middle, the main button in front with the only soft shadow
  plan: three layers: the room photo at the back, the words and the plan board in the middle, the Build your plan button in front; the board has the only soft shadow
- [x] R3z.6 The h1 or the line under it holds the words a customer searches for this business and its place, the search words named in its BLUEPRINT.md plan line
  plan: search words "home cleaning" and "Jerusalem": the h1 says home cleaning, the line under it says weekly home cleaning all around Jerusalem
- [x] R3ab.4 A real rating sits on the first screen beside the headline or main button with its score, count and source; with no real rating nothing stands in its place
  plan: n/a: no real rating yet; nothing stands in its place

## Stage 4. Sections

- [x] R3.12 Sections every page has: a dramatic hero, a features section (one scannable item per product or service with price and what is included), a call-to-action section of its own near the end with the proof beside the button
  plan: opening with the plan board, the six options (one tile each, in the flyer's words), the price card with what a visit is, the steps, the close band with the button, footer
- [x] R3c.1 References came first: 3 to 5 real screens of businesses of the same kind kept, each with its source link in CONCEPT.md; the builder chose and said in one line what was picked and why (fresh searches per piece: R3g.17) (check: concept)
  plan: references in REFERENCES.md and CONCEPT.md with source links (Mobbin Blue Apron, Inspo glideapps-com, 21st Schedule Picker, the saved Pinterest plan cards)
- [x] R3g.17 Every piece (button, arrow, each card or list effect, each section) came from a fresh Mobbin, 21st and Inspo search for this business, with the source named; nothing reused from the last two pages; each effect has a reason (says what a control does) (check: concept)
  plan: each piece sourced in CONCEPT.md Effects from fresh 21st, Mobbin and Inspo searches made for this build (REFERENCES.md)
- [x] R3g.19 Shops (food-shop, fashion-shop): the main buttons are in the product's own colour, taken from its photo (meta product-colour with data-from, in BRAND.md), text 4.5:1 on it, and each button stands out 3:1 from what is behind it; n/a for other categories (check: check-button-colour)
  plan: n/a: a service, not a shop
- [x] R3c.2 No AI default look: not cream + serif + one italic word (unless their brand), no default font, purple or two-colour gradient, exactly three identical cards, frosted glass used everywhere, default "premium" palette; at least one section on a contrasting ground
  plan: white and the flyer's pale blue with navy, Plus Jakarta Sans, a two-by-three tile grid, one navy card, no gradient but the edge shade
- [x] R3g.1 A style sheet exists in CONCEPT.md before building (accent, ink, ground, two faces plus at most a third for one label style, one radius, motion limits) and every section follows it
  plan: CONCEPT.md style sheet
- [x] R3g.3 The accent colour is used for the main button only; prices and everything else are in the main text colour, prices bold and large; at most one emphasised word per screen, set apart by weight or style in the text colour
  plan: royal blue on the main buttons and the visits they book; the one emphasis is "your way."; prices in ink or white, bold and large; icons, steps, toggles and chips in navy
- [x] R3g.7 At most one closing signature (giant cropped name, or one playful moment in the footer/404), never in the way of the order path
  plan: n/a: no closing signature; the close band is plain
- [x] R3g.11 Fonts come from the approved Latin + Hebrew list, licence checked
  plan: Plus Jakarta Sans and Public Sans (SIL OFL), English only; the ₪ sign in the system face
- [x] R3p.3 Not alike: no heading face shared with another site, no shared body face plus script, no two brand colours alike, design different on at least 4 of 6, effects overlap at most 2 points (check: prints)
  plan: check-fingerprints: different from every other page
- [x] R3p.5 One small touch only this business would have, from their product, tagline or craft (check: concept)
  plan: the gold booked mark, the flyer's sparkle, set as each visit lands
- [x] R3q.1 CONCEPT.md is complete: 3 or more ideas each citing a saved effect picture, an "Own:" idea, which was chosen, the five wow answers, an Effects line per kind, the "Not alike" line (check: concept)
  plan: check-concept passes
- [x] R5a.7 One signature idea and one peak per page; at most one signature scroll section; the ending resolves on the action; not carried over from another business
  plan: one signature (the plan board), one peak; ends on Build your plan
- [x] R9.1 The page's signature section is used only when their own photos or items support it; a page without the right material stays still
  plan: the board needs no photo of theirs; it is their own promise and price
- [x] R3f.2 The effect budget is filled and ticked on captured frames: one signature moment (held where it fits 1280x650, otherwise playing as the page scrolls), at least three accents (arriving opening, a scroll-tied detail mid-page, a closing payoff), quiet touches
  plan: signature: the plan board; accents: the pills' gliding highlight, the toggles, the hanging price card; quiet: the button arrow on its line
- [x] R3m.1 A gallery place on every designed page (`data-mir-gallery` with template), and priced products inside `data-mir-catalog` with `data-mir-list`, group and item templates
  plan: gallery place with template on the home page; no catalog because the listing has no products
- [x] R3m.3 Details the owner changes (hours, areas and fees, guarantee, FAQ, reviews) sit in fixed places with length limits, never free text boxes
  plan: the FAQ place is owner-filled; areas and the price in fixed places, no free text
- [x] R3k.1 The site is pages by kind of business; the menu and the order are ONE page (the Shop, or Book); old Menu/Order addresses forward to it
  plan: pages: Home, Build your plan (the plan is the booking), Contact
- [x] R3k.2 One identical menu bar on every page (name to Home, pages, the one Order/Book button with basket count, `aria-current="page"`); on a phone it folds into a Menu button with Close that closes on Escape or a link tap
  plan: one menu bar from sitekit on every page with aria-current, Menu on a phone
- [x] R3k.4 Shared `site.css` and `site.js` serve every page; a page-section class name (`.open`, `.in`) is never reused for a shared part's state
  plan: one site.css and site.js; page classes not reused for shared state
- [x] R8a.1 Nothing left over from 21st or generated components: no demo headline, name, review, star count, statistic, logo wall or stock photo; no network calls, tracking or new script tags; restyled in the business's tokens
  plan: nothing copied from 21st; patterns rebuilt in our tokens, no demo text
- [x] R3b.4 With few photos, facts carry the page (offers, key facts), nothing padded; for a place, hours and where come before the description
  plan: facts carry the page: the options, the price, the steps, the area
- [x] R3c.3 Proof sits where the worry is: each worry the owner named is answered beside the button or price it belongs to; no wall of one-line reviews
  plan: n/a: no worries named by the owner yet (question 13)
- [x] R3c.8 If the owner told us what happens after the order or booking, the page and tracking page say it first
  plan: n/a: the owner has not said what happens after a plan is sent; the steps say only that we confirm on WhatsApp
- [x] R3e.10 Cards have one reading order (name largest, one emphasised fact, usually the price in the main text colour, bold and large, the rest lighter), big photos; long names truncate; an icon on a photo sits on a solid circle or gradient (check: site)
  plan: option tiles: icon, name largest, one line lighter, the toggle last
- [x] R3e.14 One body family in up to three weights and at most six text sizes; spacing on a 4 px grid, related close, unrelated apart
  plan: Public Sans in two weights, sizes from the scale, spacing on the --s scale
- [x] R3c.9 One quiet system: one corner radius for images and buttons, one icon set (lucide), one soft shadow (3s.3: about 3 px down, 30 px blur, no spread, tinted with the background or brand colour, never black), no two-colour gradients, no decorative arrows or outlines
  plan: one radius 18 px (the board's day cells a smaller step inside), lucide line icons, one soft shadow under the board and the plan summary
- [x] R3s.4 One left edge: headings, text and buttons line up on the same margin (check: site)
  plan: one left edge per section; site passes
- [x] R3s.6 Controls that do the same job look the same (height, corner, style) (check: site)
  plan: buttons, toggles, pills and chips share heights and corners by kind; site passes
- [x] R3s.7 Buttons in sentence case, pale dividers, no "Price:" style labels, body lines 1.5 to 1.6 apart, contrast never lowered to look soft
  plan: sentence case buttons, pale lines, no "Price:" labels, body 1.5
- [x] R3s.9 One colour per meaning everywhere (the kosher tag looks the same on every item)
  plan: n/a: no tags or certificates
- [x] R3s.12 The maker and their real work come right after the opening, with at least one real photo of the product in use or a real setting
  plan: n/a: no photo of the owner or their real work exists yet; asked for in question 10
- [x] R3s.14 Real numbers shown big (three times the body size) with a one-line label, only numbers the owner gave
  plan: the one number given, ₪325, big beside its label "a visit, 4 hours"
- [x] R3s.11 One true sentence beside the price says why it costs that (handmade, the ingredient, the time)
  plan: "Four hours of cleaning every week for ₪325": the time is why it costs that, the listing's own terms
- [x] R5b.6 No scroll cues, no "01/06" counters, no label above every section
  plan: no scroll cues, counters or labels above sections but the one kicker in the opening and the price card
- [x] R3.13 Structure: no doubled contact, facts or gallery; no two dividers in a row, no ending on one; only their own photos that exist; a photo gallery has at least 3
  plan: no doubled sections; no gallery or questions until the owner adds them
- [x] R3a.1 The page was rendered as a visitor meets it (the six sizes of 3p.6, each language, normal and reduced motion), every screen looked at, a scroll page walked at several positions per section, every payoff checked at its start and finish on a phone and laptop
  plan: rendered at the six sizes with normal and reduced motion
- [x] R3r.1 Every script above was run on EVERY page of the site, not only the home page
  plan: publish-page --check runs every script on every page
- [x] R3r.2 Someone who did not build the page used it against `docs/page-review-checklist.md`, the builder fixed every FAIL and the reviewer looked again
  plan: a separate reviewer reads the pages against docs/page-review-checklist.md; fixes looked at again
- [x] R3g.12 A real test went through every form and order button (to a test business, never the owner's live inbox) before the owner saw it
  plan: the plan was sent against a local API, never the owner
- [x] R0b.12 The business's pages-list preview clip shows the current version of the page
  plan: n/a: not on the business pages list until it is published
- [x] R3x.1 A product to turn is made from the owner's photo through the API and compared beside it; its dots (at most four, 44 px) say only the owner's facts; buttons turn it too; it loads after the page and is their photo with no script or reduced motion
  plan: n/a: a service, nothing to turn
- [x] R3x.2 A counted number is a real figure from the record, counts once, ends exact, and is in the page text so it shows with no script or reduced motion
  plan: n/a: no counted number
- [x] R3x.3 Tabs for sizes or packages change one panel in place: picture, price and facts stay in the same spot
  plan: n/a: one item in one size, so no tabs
- [x] R3x.4 With two or more sizes or packages, each is a card with its picture, price and the same measures in the same order
  plan: n/a: one item in one size, nothing to compare
- [x] R3x.11 A product to turn passed the suitability check, was made from a grey-ground source of the owner's photo as two candidates reviewed from four angles, has two or three light buttons named for the business, and keeps touch-action pan-y on a phone
  plan: n/a: no product to turn
- [x] R3z.1 One card the visitor would use (open slots, order card, price from, facts or a review) hangs a third to a half over the edge of the next section on the home page, the only thing that crosses an edge; on a phone it is whole and readable
  plan: the plan line under the six options (the order card: your plan and Build your plan) hangs just under half its height over the top of the price section, the only thing that crosses an edge; on a phone it is whole
- [x] R3z.5 A site on a dark ground has one light section (questions, prices or how ordering works) joined by a clean edge, not a fade
  plan: n/a: a light site
- [x] R3ab.1 Every h1 to h3 says what the visitor gets on its own, never only a section label ("How it works", "Our services", "Why choose us" and their Hebrew); "Questions" and contact headings allowed
  plan: headings say what you get: Your plan, Pick what fits your home, Four hours of cleaning every week for ₪325, Your plan in three steps
- [x] R3ab.2 Real reviews are stacked and fully shown on a phone, never in a swiping row, moving ribbon or fold-out
  plan: n/a: no reviews yet
- [x] R3ab.3 Each review shows the first name the owner may show and where it was left (with a link when the source has one), a photo only with permission; a press mention is the outlet's own sentence, never a bare logo
  plan: n/a: no reviews yet

## Stage 5. Site structure (menu, footer, facts, layouts)

- [x] R3v.1 A full footer, the same on every page: who they are (name, one line, a quiet link to the main action), every page, how ordering works or Visit, Reach us, and a base line with © year, the MyIsraelRental line and a Privacy link; parts only when the record fills them (check: check-footer)
  plan: sitekit full footer, the same on all three pages: Clean plus and its own line with a quiet Build your plan link; pages; how it works (pick options, we confirm on WhatsApp); where we clean (all around Jerusalem); reach us (WhatsApp); base line with Privacy
- [x] R3v.2 The menu bar lists the site's pages, the same on every page; a site with other pages has no #jumps in the bar; order and booking steps may keep a quieter bar (check: check-menu)
  plan: menu lists Home, Build your plan and Contact on every page, no #jumps
- [x] R3v.6 Sections of different heights: at least two sizes on a page, never three in a row the same height (check: check-heights)
  plan: home: opening tall, the six options long, price card medium, how it works medium, the close band short; never three of one height in a row
- [x] R3v.7 Layouts (bento, zigzag steps, callouts, picture beside four facts, peek row) chosen by what the business has, never the same layout twice in a row on a page
  plan: home: a bento of the six options from the flyer, a price card beside its four inclusions, numbered steps, a close band; no layout twice in a row
- [x] R3v.8 Effects from 3v (light on cards, fanned photos, rolling letters, circle reveal, curtain between pages, picture buttons, statement band) are chosen for this business, not the set of the site built before it, each with its phone and reduced-motion version
  plan: none of the 3v shelf effects; the plan that builds itself is this site's own
- [x] R3v.14 Three true facts from the record right under the main button on the home page (class btn-facts) (check: check-facts)
  plan: three facts under the main button: Weekly, 4 hours, ₪325 · All around Jerusalem · WhatsApp +972 50-423-2291
- [x] R3x.8 Web basics on every page: skip link first, one h1 and no skipped levels, focus rings, labelled fields with type and autocomplete, live basket count and form messages, opening picture first and far ones lazy, two font families at most, title 60 and description 155 at most, og:title and a 1200x630 share picture, JSON-LD for the business on the home page (check: check-web-basics)
  plan: sitekit writes the skip link, footer h2s and JSON-LD (ld_type HouseCleaningService); the build adds one h1 per page, focus rings, labelled fields with type and autocomplete, a role=status line on the plan form, the first picture with fetchpriority high
- [x] R3x.13 One type scale and one spacing scale: every text size is a step of --t-1 to --t5 and every gap of --s1 to --s10, recorded in BRAND.md; at most 10 text sizes on a page (check: check-web-basics)
  plan: every text size a step of --t-1..--t5 and every gap of --s1..--s10, written into BRAND.md; check-web-basics passes

## Stage 6. Prices and savings

- [x] R3c.5 Choices (sizes, flavours, tiers) are tiles to tap, never a dropdown; "Most popular" only when the owner says so
  plan: every choice on Build your plan is a tile to tap (how often, which day, extras); nothing marked popular
- [x] R3c.6 The button says what happens next with a real number where there is one ("Order 4 buns, ₪55"), never "Submit" or "Buy now"; price, unit and action sit together
  plan: the last button says "Send my plan, ₪325 a visit" for weekly 4 hours, "Send my plan" when the visit has no price yet
- [x] R3c.7 Offers are contained: a time-limited offer shows its real end date, a first-order offer says so, standing discounts (students, soldiers, olim) need no date, "ends soon" without a real date is banned; no permanent sale, no discount on their famous item unless they say
  plan: n/a: no offers
- [x] R3j.1 A guarantee the owner offers sits beside the main button in their words and states its limit; none offered means none shown
  plan: n/a: no promise offered yet (question 11); none shown
- [x] R3j.2 One real relevant add-on before ordering, with Add and "No thanks", not pre-ticked, gone once added or declined
  plan: n/a: no priced add-on in the record; equipment and supplies is an option tile, its price asked (question 4)
- [x] R3j.3 A free taster, sample, consultation or quote the owner really offers is the headline offer beside the main button
  plan: n/a: the owner offers no free quote or taster; the flyer's "Tell us what you need on WhatsApp" is the action
- [x] R3j.4 Group discounts (students, soldiers, first order, olim) only when the owner offers them, said once near the price; they are standing, so no end date is needed
  plan: n/a: no group discounts
- [x] R3j.5 Come-back features only if real: a stamp card the owner runs, a Reorder button; no streaks, valueless points, or reminders for something not started
  plan: n/a: no come-back features; a weekly plan is the service itself
- [x] R3j.6 The natural pick among three sizes/packages is shown, but no invented option to make another look good
  plan: n/a: one package
- [x] R3j.7 Never: a struck-through or "was" price that is not real, prices changed to .90/.99 endings, an endorsement they do not have
  plan: n/a: no struck prices or endorsements
- [x] R3j.8 A saving is shown only when true like for like: same contents, same product line, worked out per unit in a table of every option, and the bigger option's unit price is lower than EVERY smaller option, measured against the cheapest
  plan: n/a: no savings
- [x] R3j.9 A lone saving among many products is not shown, but each small group (single/double pack, 4/8 box, service with its add-on) shows its own
  plan: n/a: no savings
- [x] R3j.10 A saving is shown as a percentage badge of two or three words ("25% off") with the real separate price struck through beside the new price; percentage = (separate minus new) / separate, rounded DOWN to a whole number; the button carries the offer and its price and no sentence explains it again; never how much more the bigger one costs
  plan: n/a: no savings
- [x] R3j.11 A combined service against its parts, and basket lines a package would make cheaper (one line with the saving and a Switch button), are shown when real
  plan: n/a: no combined services
- [x] R3j.12 An owner's own savings claim the prices contradict is not printed; the owner is asked
  plan: n/a: no savings claims
- [x] R3j.13 With three or more sizes, every saving is against the smallest size bought as many times as it takes to feed the same (Large = 2 Mediums, Kiddush = 4 Mediums), never the size below, so the saving rises with the size; only the struck price and the percentage show, no line naming the sizes
  plan: n/a: one priced size, no savings
- [x] R3j.14 Every price shown and every total sent comes from the listing: prices.json names each price the page shows, an order total reads window.MIR_PRICES first, a saving is worked out from those prices, never typed
  plan: prices.json names the one price, Weekly cleaning 4 hours ₪325; the plan summary reads window.MIR_PRICES first, so a dashboard change reaches the card and the message
- [x] R3.14 Loud prices only when prices exist, never on a premium or quote-based business
  plan: the one real price is large on its card; every other clean says "Price on request", as the owner has not priced it
- [x] R3z.3 Where the answer depends on a choice, a free taste of at most three questions ends on a real answer and price from the record and carries it into the order; no contact details asked
  plan: the Build your plan page is the taste: how often, which day, and what else, at most three questions, ending on the real ₪325 a visit for weekly 4 hours; contact details only at the send step

## Stage 7. Order and booking flow

- [x] R3k.7 The order is in steps after choosing: Step 1 basket, Step 2 when and where, Step 3 details; a three-line "Step N: name" bar; order and total beside every step (under it on a phone); the button names the next step and, last, what happens with the total; a Back button; the browser back button goes back one step (#order-2); each step checks only its own fields (check: site)
  plan: book.html in three steps with a "Step N: name" bar (Step 1 Your plan, Step 2 When and where, Step 3 Your details), the plan and price beside every step, Back and browser back, each step checks its own fields
- [x] R3k.8 Every basket line, packages included, has a remove button (40 px, "Remove X from the basket") beside its stepper (check: site)
  plan: n/a: no basket, a plan request
- [x] R3k.6 The basket lives between pages: an Add on any page puts the item in and opens the order page with it there
  plan: n/a: no basket; the board and the options carry the chosen plan to book.html (?often=&day=&kind=)
- [x] R3k.9 Every order or booking is POSTed to MyIsraelRental (the business's order form) before WhatsApp opens; every product on the site is a product of the listing with the same name and price
  plan: the plan POSTs to /api/marketplace/gigs/8d8bb8e8-1571-45ce-a6e9-5b177b83561e/book (the listing's tier Weekly cleaning 4 hours) before WhatsApp opens
- [x] R3k.10 The order form arrives filled in: the day field holds the first day the business can do (lead time, closures), quantity 1, the owner's most common choice pre-chosen; all changeable, a customer's pick never overwritten (check: check-prefill)
  plan: arrives filled in: every week, weekly 4 hours, a weekday morning, the first day tomorrow; all changeable
- [x] R3.15 What the brief asks visitors to do has a place to do it (book or order needs the services block, message needs contact, visit needs hours and address)
  plan: plan request page, WhatsApp on every page, "all around Jerusalem" said on the home page and footer
- [x] R7.1 Three options are for the automatic page builder only; a hand build picks one direction itself and says why in one line in CONCEPT.md, with no options page put to Tzvi or the owner unless asked
  plan: one direction chosen, said in one line in CONCEPT.md Chosen
- [x] R8.5 Every main button goes to the quickest route to a finished order the business has: its order page, then its price list, only then WhatsApp; WhatsApp stays the quiet secondary; the how-to-order steps describe the real path
  plan: every main button goes to Build your plan; WhatsApp is the quiet second
- [x] R0b.13 The order saves with a tracking link before opening WhatsApp, and the order reaches the owner complete
  plan: saved first, the tracking link added to the WhatsApp text
- [x] R3l.1 For every family of similar items the owner was asked what a customer can choose and how many
  plan: n/a: no families of products; a single service with options, asked in questions 2 to 5
- [x] R3l.2 Each item says on itself what it allows ("Up to 4 kinds of chicken · 3 sauces", "1 kind"), in the same words on the tile, the order line and the order message
  plan: n/a: no products
- [x] R3l.3 Choices belong to the item: options appear once it is added, only for items that allow them; one choice is radio; a limit greys out the rest; an item needing a choice cannot be sent without it, with the reason beside it
  plan: which weekday appears only for every week and every two weeks; a one-time clean asks for a date instead
- [x] R3l.4 Three or more alike items are compared at a glance: only what differs, side by side
  plan: n/a: no alike items
- [x] R3l.6 A picture is of the item as it is sold now; no picture beats a misleading one
  plan: n/a: no item pictures
- [x] R3l.7 Read each item alone: a customer can tell what they get and what they can choose without reading another item
  plan: each option tile reads alone: what it is, in the flyer's words, and its price or "Price on request"
- [x] R3e.9 Buttons have rest, hover, pressed and disabled states; fields have focus and error states with a message; every action confirms ("Sent", "Copied"); anything hover-only has a phone version (check: site)
  plan: buttons have hover, pressed, busy and disabled; fields focus and error with messages; the status line says Sent
- [x] R3e.19 Every flow has a visible end: a clear "Done" screen after ordering, lists that end, "Save and finish later" on long forms; progress shows only true numbers
  plan: the last step ends on a Sent screen with the tracking link and WhatsApp
- [x] R3s.16 Fewer choices first: a plain question ("How many people?") before a long list; the sensible option is chosen on purpose
  plan: one plain question first ("How often?"), the sensible answer, every week, chosen on purpose
- [x] R3s.18 Not available shows the nearest real alternative; every choice list has a way out ("None", "Other", "I'm not sure")
  plan: "Something else" on the kind of clean and "Any day" on the day; a neighbourhood field, not a list
- [x] R3s.25 The order or booking form sends nothing when empty and shows what is missing; filled, it sends a WhatsApp message carrying the total the page shows (check: site)
  plan: empty send shows what is missing; filled, the WhatsApp text carries the summary and ₪325 a visit where weekly 4 hours is chosen
- [x] R3x.9 A request-type business's form builds a plain summary beside it as the fields fill, sends that summary, and states no price or promise the record lacks
  plan: the plan summary builds beside the form as tiles are tapped and is what is sent; no price but ₪325, no promise
- [x] R3x.10 The prices or running total stay in view beside the order or booking form on a laptop, and a total line sits above the send button on a phone
  plan: the summary and price stay beside the form on a laptop and a total line sits above the send button on a phone
- [x] R3x.14 The order page has the gift card section (SITE.gift_section, gift.js): hidden until the owner switches gift cards on, bought in place with no sign-in, and it shows only the owner's amounts, note and payment links (check: check-web-basics)
  plan: SITE.gift_section() and gift.js on plan.html; hidden until the owner switches gift cards on; amounts in shekels

## Stage 8. Motion

- [x] R3f.1 A scroll effect plays while its subject is wholly on screen (held on a stage that fits, or started only when all in view); captured at 0, 25, 50, 75 and 100 percent on laptop, short laptop and phone, the whole subject is visible and the effect is mid-way where it should be
  plan: n/a: no scroll effect; the board's landing plays as the page arrives, the board whole on the first screen at every laptop size
- [x] R3f.8 A scroll-tied effect finishes while its subject is mid-screen (top on screen, centre no higher than 40%) at six sizes (check: scroll-finish)
  plan: n/a: no scroll-tied effect
- [x] R3f.9 A list that stacks on a phone runs item by item (each item lights at about 80% down)
  plan: n/a: no list that lights up
- [x] R3f.5 Text widths are in em or rem, never `ch`; a text shimmer is an overlay, never background-clip on the letters
  plan: widths in em and rem; no shimmer
- [x] R3f.4 A motif from the logo (a bow) never lands on the logo that already has it
  plan: n/a: the house mark is not used in motion
- [x] R3g.4 Every motion has one job (guide, confirm, reveal); loops start and end on the same frame; text settles soft to sharp without bounce; list rows about 100 ms apart; menu hover under 300 ms
  plan: the visits landing guide to the plan; the glide confirms a choice; no loops, no bounce
- [x] R3e.16 No linear easing (ease-out or a spring); a transition grows from what was tapped and finishes under 0.5 s
  plan: ease-out curves, every transition under 0.5 s; a visit slides from the cell it was in
- [x] R3e.17 A carousel shows a sliver of the next card, with visible buttons or dots (mirrored in Hebrew); a bottom sheet closes by swipe-down AND a close button
  plan: n/a: no carousel or sheet
- [x] R3a.2 Nothing moves without a reason: a clip behind text holds still except its subject; text never re-wraps while its container animates; no in-between state looks unfinished (checked at the middle of every transition)
  plan: only the visits and the pill highlight move; the sentence changes its words without moving the layout (it keeps its height)
- [x] R3a.3 Anything placed on a spot in a photo/video is placed by measurement and lives inside the media's element; a label never covers what it labels; a caption stays until the next replaces it (check: overlay-truth)
  plan: n/a: nothing placed on a spot in the photo
- [x] R3a.4 A held (pinned) section is designed to fit its content at 1280x650; if it truly cannot, it plays as the page scrolls without holding the screen and is still the signature; the order section is never held (check: cutoff)
  plan: nothing is pinned or sticky
- [x] R3a.5 Pinning and scrubbing yes, taking the scroll's speed or direction no, no parallax on phones, reduced motion shows a still
  plan: no parallax; reduced motion shows the visits in place with no landing
- [x] R3s.2 Nothing jumps: late photos fade in over 200 to 400 ms into space kept for them; choosing something never moves the layout (check: site)
  plan: the picture has its box; a tap never moves the layout (the plan page's how often and which day keep their space)
- [x] R3s.1 Everything pressable answers within 100 ms with a hover and a pressed state (check: site)
  plan: every button, tile and day reacts within 100 ms with hover and pressed
- [x] R3s.8 Buttons over a photo sit in a soft container, checked on a light and a dark photo
  plan: the opening button sits on the white edge shade over the wall
- [x] R3s.10 The picture appears the moment a thing is named
  plan: n/a: nothing named with a picture
- [x] R3s.27 Same thing, same place: a repeated kind of thing (each size, step, card, slide, scroll state) is written in the same place and style every time, and a growing block hangs from a fixed top so its heading never moves
  plan: every option tile in the same order and style; every visit block the same size in the same place in its cell
- [x] R3s.29 Same button, same shape: no button's words break onto a second line at any size, and a repeated button (each card's) is the same height every time; the text beside it gives way, never the button (check: check-same-button)
  plan: no button breaks onto two lines; the toggles are one line at every size
- [x] R3s.30 Cards of one kind side by side on different grounds have words and buttons all one colour or in a mirrored pattern (white, black, white), never two of one and one of the other; order the grounds to get it, never force a colour that fails contrast
  plan: the six tiles all ink words on pale blue (one on white with a line), one pattern
- [x] R3s.28 No blank screen anywhere in the scroll: at every stop something is there to look at (words, a picture, the film), never a screen of plain ground (check: check-blank)
  plan: every stop shows words, the board, tiles or the price card
- [x] R3i.3 A live readout tied to the scroll shows only a true fact of their process, small mono at a corner, never a made-up number
  plan: n/a: no live readout
- [x] R3s.21 No script errors, console errors, 404s or dead links between the site's pages (check: site)
  plan: site check passes: no errors, no dead links
- [x] R3x.6 At most one sentence lights up word by word, and the site built just before does not have one
  plan: n/a: no sentence lights up
- [x] R3x.12 A progress line is used only on a page of six screens or more, 2 to 3 px in the accent, aria-hidden, never over the menu or phone bar
  plan: n/a: no progress line

## Stage 9. Phone

- [x] R3b.6 On a phone the action is pinned to the bottom with the price or proof beside it, from after the first screen until the order section; a bar that carries a counter or clock is there from the first screen and only its button waits
  plan: phone bar with "Weekly, 4 hours, ₪325" and Build your plan from after the first screen, hidden on plan.html
- [x] R3f.7 The bottom bar fits at 360 px: its label shrinks or wraps, its button never
  plan: the bar label wraps, the button never wraps
- [x] R3a.6 A fixed bar never covers content (room is kept for it, including the last line and the end of the page) (check: site)
  plan: room kept for the bar at the page end
- [x] R3s.22 Everything to tap is at least 40 px on a phone and no two taps overlap (check: site)
  plan: tiles, links and buttons 44 px
- [x] R3s.23 The page never scrolls sideways on a phone (check: site)
  plan: no sideways scroll at 360 px
- [x] R3s.26 No words sit on other words anywhere on the page, pinned scenes included, on short laptops (1366x768, 1280x720), 1440x900 and a phone (check: check-overlap)
  plan: check-overlap passes
- [x] R3t.1 The site declares its category (CONCEPT.md and a site-category meta on every page) and follows that category's row of the 3t table: ground and colour, pictures, how it sells, type
  plan: site-category service on every page and in CONCEPT.md: white ground, facts and prices, plain sans
- [x] R3t.2 food-shop and fashion-shop: a price and an Add or Order control within the first two screens; every product card has photo, name, size or servings, price and a button
  plan: n/a: a service, not a shop
- [x] R3t.3 trainer: at least a third of sections are picture, never three plain sections in a row
  plan: n/a: not a trainer
- [x] R3t.4 A real footer on every page, identical: a last big line, the button, link columns, contact, the MyIsraelRental line (since 1 Nov 2026 the full footer of R3v.1)
  plan: n/a: no founding year in the record, so no "since" line; the full sitekit footer is the same on every page
- [x] R3a.7 Every state is checked on the device that shows it (touch emulation for phones, never a narrow desktop window; hover-only looks have a touch version)
  plan: phones checked with touch emulation; the tiles have a pressed look on touch
- [x] R3a.8 A line of items separated by dots never wraps
  plan: the three facts stack on a phone instead of wrapping

## Stage 10. Order details and report

- [x] R3u.2 A day the business cannot do (closed, full, inside the lead time) or a quantity over its limit gets one plain line under the field naming the next possible one, with a button to choose it; the form never quietly refuses or changes the pick
  plan: a day before tomorrow gets one line naming tomorrow
- [x] R3u.3 Price per portion beside each size ("about ₪25 a person") when the owner gave servings or pieces, rounded down; without figures the question is in message-to-owner.md
  plan: n/a: no servings
- [x] R3u.5 A home page with no scroll film: the first screen arrives in order (bar, headline, line, picture, button), about 1.5 s, once; all there without JS or with motion off (check: check-arrival)
  plan: the first screen arrives in order once: bar, headline, line, picture, button, then the board, about 1.5 s; all there without a script and with reduced motion; check-arrival
- [x] R3u.6 Depth on laptops: separate pieces on the first screen move at their own speeds with the scroll (near faster, far slower), laptops with a mouse only, still on phones and with motion off
  plan: on laptops with a mouse the room moves at 0.35 of the scroll while the words and board move at full speed; never on touch, never with reduced motion
- [x] R3u.7 At most one rotating word, in the headline, from the owner's real occasions or products; reads right with each; full list for screen readers; first word with motion off; not beside a film's moving words
  plan: n/a: no rotating word
- [x] R3u.8 A tilted label over headings, if used, is this site's own shape from its world and in fingerprints.json, never another site's
  plan: n/a: no tilted label
- [x] R3u.9 Questions are rounded cards on `<details>`, "+" in an accent circle turning into "x", the answer opening smoothly inside the card
  plan: n/a until the owner sends questions; then rounded cards on details, as the rule says
- [x] R3u.10 A business with two or more places has its list beside a map in the site's colours with numbered pins, the map held on a laptop and above the list on a phone
  plan: n/a: no places with addresses, one city
- [x] R3u.12 Every moving piece not in the kit was tried on a test page with buttons for each state before it went in
  plan: the plan board's moves tried first on scrollcraft/starter/kit/test.html with a button per state
- [x] R3u.13 gen/report.md ends with "Not done yet" and "For your call" (at most two)
  plan: gen/report.md ends with Not done yet and For your call
- [x] R3u.14 gen/copy-pass.md holds a shorter version of every line over 20 words and paragraph over three lines; the shorter is used unless it drops a fact
  plan: gen/copy-pass.md written
- [x] R3w.1 Every generated food shot has a real cause on screen (a hand, a spoon, gravity), one event of 2 to 4 s, and its end stays; nothing floats into place or appears, no smoke or flash wipes between shots; except in the opening film, where the owner's own ingredients may swirl and float round the product in advert style, marked in the brief (the product itself never changes, nothing pops in or out in the open)
  plan: n/a: no food
- [x] R3w.2 Generated liquids and steam look real: sauces opaque and thick, no glassy drips or big glass bubbles, steam thin wisps lit from behind, never a cloud
  plan: n/a: no generated liquid
- [x] R3w.3 Generated food is lit from the side and behind with the camera side darker, never flat from the front; a pour or fall stays sharp when paused
  plan: n/a: no food
- [x] R3w.7 Generated places and materials look photographed: no dune-smooth hills, model villages, stones in tidy equal rows or flat soft light, checked at full size beside a real photograph of that place or material before any clip
  plan: the room picture, gen/view/wide-0.png and tall-0.png, looked at full size: uneven, weathered Jerusalem-stone blocks with real joints, morning sun from one side, not flat; the tall one kept as the same room

## Stage 11. Finish

- [x] R3r.3 `check-rules` passes, every script above passed on every page after the last edit, and a fix was checked on the screen it was for (check: check-rules)
  plan: check-rules passes after the last edit
- [x] R3r.4 A rule Tzvi had to point out twice has a script or a line in this file the same day
  plan: n/a: nothing pointed out twice on this site yet

## Not on this site

37 rules for things this site does not have, n/a without being read:

- [-] R3h.22 (film: no)
- [-] R3h.23 (film: no)
- [-] R3h.24 (film: no)
- [-] R3h.25 (film: no)
- [-] R3aa.3 (film: no)
- [-] R3aa.4 (film: no)
- [-] R3aa.8 (film: no)
- [-] R3aa.9 (film: no)
- [-] R3aa.11 (film: no)
- [-] R3aa.14 (film: no)
- [-] R3aa.15 (film: no)
- [-] R3aa.16 (film: no)
- [-] R3aa.17 (film: no)
- [-] R3aa.20 (film: no)
- [-] R3aa.21 (film: no)
- [-] R3aa.22 (film: no)
- [-] R3aa.23 (film: no)
- [-] R3aa.24 (film: no)
- [-] R3aa.26 (film: no)
- [-] R3aa.27 (film: no)
- [-] R3aa.28 (film: no)
- [-] R3aa.29 (film: no)
- [-] R3aa.31 (film: no)
- [-] R3aa.32 (film: no)
- [-] R3h.2 (film: no)
- [-] R3h.3 (film: no)
- [-] R3h.5 (film: no)
- [-] R3h.7 (film: no)
- [-] R3h.8 (film: no)
- [-] R3h.18 (film: no)
- [-] R3h.19 (film: no)
- [-] R3h.17 (film: no)
- [-] R3e.18 (film: no)
- [-] R3u.11 (film: no)
- [-] R3w.4 (film: no)
- [-] R3w.5 (film: no)
- [-] R3w.6 (film: no)
