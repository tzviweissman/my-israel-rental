# Rules for rbs-cleaning, written from BLUEPRINT.md (scripts/blueprint.mjs --rules)

R0b.1 pass: built to the blueprint: slug daniel, read from the live public record /api/marketplace/business/daniel
R0b.3 pass: built to the blueprint: one price, the listing's Basic home clean ₪400, shown as ₪400; nothing else priced; the listing has no products, the request saves against its tier
R2.1 n/a: no founding year in the record, so no "since" line
R2.2 pass: built to the blueprint: OWNER-QUESTIONS.md asks only about the business (areas, inclusions, prices, hours, phone, photos), nothing the record already answers
R2.3 pass: built to the blueprint: OWNER-QUESTIONS.md 12 and 13: eight example questions from a cleaner's real details plus the worry question
R3.1 n/a: no certificate in the record, so nothing on the page says kosher
R3.2 pass: built to the blueprint: no counts, no deadlines, no "only today" anywhere
R3.3 pass: built to the blueprint: every line names cleaning, Beit Shemesh, the squeegee or the request; no stock phrases
R3.4 pass: built to the blueprint: checked: no exclamation marks, no long dashes, no capital words
R3.5 pass: built to the blueprint: headline "Your home, crystal clear." and the line "Home cleaning in Beit Shemesh and the surrounding areas"
R3.6 pass: built to the blueprint: English only, every line
R3.7 pass: built to the blueprint: gallery and questions are hidden owner-filled places; no reviews, no placeholder text
R3.8 pass: built to the blueprint: none of these on any page
R3.9 pass: built to the blueprint: the flyer's promise: cleaning services in Beit Shemesh, free quotes on WhatsApp, streak-free and crystal clear
R3.10 pass: built to the blueprint: two strengths only: the ₪400 basic clean and free quotes on WhatsApp, both from his listing and flyer
R5.1 pass: built to the blueprint: his flyer and listing words throughout (weekly, bi-weekly, monthly; moving in/out; streak-free, crystal clear)
R5.2 pass: built to the blueprint: plain professional lines; read aloud as Daniel would say them
R5.3 n/a: no certificate in the record, so nothing on the page says kosher
R5.4 pass: built to the blueprint: business speaks as "we"; searched visible text for they/them/their about itself
R5b.2 pass: built to the blueprint: "Get a free quote" to book.html in the header, opening, price card, steps, close band, phone bar and footer
R5b.8 pass: built to the blueprint: close line "A clean home, streak-free windows."; no "or" without the other choice shown
R3.11 pass: built to the blueprint: headline is the result; order: what (opening), what it costs (bento with ₪400 first), what to do (how a quote works); prices come before the form
R3o.4 pass: built to the blueprint: one number, labelled "WhatsApp", as his flyer says WhatsApp; whether it takes calls is asked (question 8)
R3e.22 n/a: no name or photo of Daniel is confirmed for the site yet; asked in OWNER-QUESTIONS.md 1 and 10; WhatsApp is direct
R3s.19 pass: built to the blueprint: every page has its own title, description and og tags; one og picture made from the opening
R6.1 pass: built to the blueprint: cleaning playbook: services with the price lead after the opening, action is the quote request, no insured or eco claims
R4.1 pass: built to the blueprint: everything without a price reads "Ask for a free quote"; gaps listed in gen/report.md
R3g.13 pass: built to the blueprint: picture, the 4-word headline, one short line with the place, one button, then the three facts
R3b.1 pass: built to the blueprint: what (home cleaning), where (Beit Shemesh), trust (₪400 price and WhatsApp number), next (Get a free quote)
R3b.2 n/a: no certificate in the record, so nothing on the page says kosher
R3b.3 pass: built to the blueprint: one solid green button per screen; header button is outline; links elsewhere
R3h.20 pass: built to the blueprint: scroll film 7.2 screens long, real video, the first screen is the first frame; check-opening-scroll passes
R3h.21 pass: built to the blueprint: only the film holds the page; nothing later pins
R3h.22 n/a: Tzvi waived the sketch for this build: "you dont need my permission to generate if code wont do a good job" (5 Nov); the steps are in gen/wipe-brief.md
R3h.23 pass: built to the blueprint: check-clip passes on the clip used; the first take was rejected; brief has How it really happens from a real video and a Key moment; steps looked at frame by frame
R3h.24 pass: built to the blueprint: data-video, every frame a keyframe, starter/film.js; check-film-video passes in real Chrome
R3h.25 pass: built to the blueprint: the words fade at 2.5% and return at 95%, after the camera has stopped in the room; check-film-clear passes
R3h.1 pass: built to the blueprint: opens full screen on soap running down a pane, an event in a generated film
R3n.1 pass: built to the blueprint: the film, then the room picture, fill the whole first screen on laptop and phone
R3n.2 pass: built to the blueprint: a squeegee pulled down the pane by the scroll
R3n.3 pass: built to the blueprint: on the quote page each chip rewrites the sentence, price line and button
R3n.4 pass: built to the blueprint: beside Flux Theory's misted glass, ours is wiped by the visitor (CONCEPT.md wow 4)
R3n.5 pass: built to the blueprint: "you land on a soapy window and, as you scroll, a squeegee pulls it clear and the camera backs away from the glass into a bright clean room"
R3g.15 pass: built to the blueprint: never the flyer: the film and room are made for the page and never called our premises
R3h.2 pass: built to the blueprint: the film goes from a soapy pane to the clean view, then the clean room and the button; every step is the real job
R3h.3 pass: built to the blueprint: full screen, 1920 wide video on a laptop, 720 wide on a phone, never in a column; the clip softens slightly as it is enlarged from the pane
R3h.5 n/a: no chapter lines, only the opening words before and after the film
R3h.7 pass: built to the blueprint: two clips joined at the clear view: the second starts on the last frame of the first (gen/film.sh, gen/pull-brief.md)
R3h.8 pass: built to the blueprint: the section after the bright opening is the white bento with the navy price card
R3h.11 pass: built to the blueprint: the room picture is bright, morning light; brightness checked when it exists
R3h.13 pass: built to the blueprint: one cause, one motion: the blade pulled down, the glass clear above it, in one clip
R3h.14 n/a: no product in the effect
R3h.18 pass: built to the blueprint: listed in gen/wipe-brief.md: glass, lather, blade and pole, view, room; each with where it comes from and ends
R3h.19 pass: built to the blueprint: second story after the first failed; start and end stills made first; two tries in all
R3h.17 n/a: no giant name; the words wait for the film
R3x.5 n/a: a bright business, no following light
R3.12 pass: built to the blueprint: opening, the bento of services with price and what is included, and the close band with the button
R3c.1 pass: built to the blueprint: references in REFERENCES.md and CONCEPT.md with source links
R3g.17 pass: built to the blueprint: each piece sourced in CONCEPT.md Effects from fresh 21st, Mobbin and Inspo searches
R3c.2 pass: built to the blueprint: white and sky with navy, Secular One, a bento not three equal cards, one navy band
R3g.1 pass: built to the blueprint: CONCEPT.md style sheet
R3g.3 pass: built to the blueprint: green only on the main button; prices in navy or white, bold and large
R3g.7 n/a: no closing signature; the close band is plain
R3g.11 pass: built to the blueprint: Secular One and Alef, both on the approved list
R3p.3 pass: built to the blueprint: check-fingerprints: different from all 17 other pages
R3p.5 pass: built to the blueprint: the words wait on the soap and come back when the glass is clear
R3q.1 pass: built to the blueprint: check-concept passes
R5a.7 pass: built to the blueprint: one signature (the wipe), one peak; ends on the quote button
R9.1 pass: built to the blueprint: the wipe needs only the one picture; no photo-based signature without his photos
R3f.2 pass: built to the blueprint: signature wipe; accents: the opening words, the zigzag steps, the close band; quiet: button fill and link arrow
R3m.1 pass: built to the blueprint: gallery place with template on the home page; no catalog because the listing has no products
R3m.3 pass: built to the blueprint: areas in a fixed list, questions in the owner-filled FAQ place, no free text
R3k.1 pass: built to the blueprint: pages: Home, Get a free quote (the request is the order), Contact
R3k.2 pass: built to the blueprint: one menu bar from sitekit on every page with aria-current, Menu and Close on a phone
R3k.4 pass: built to the blueprint: one site.css and site.js; page classes not reused for shared state
R8a.1 pass: built to the blueprint: nothing copied from 21st; patterns rebuilt in our tokens, no demo text
R3b.4 pass: built to the blueprint: facts carry the page: services, price, steps, areas
R3c.3 n/a: no worries named by the owner yet (question 12)
R3c.8 n/a: the owner has not said what happens after a request (question 9)
R3e.10 pass: built to the blueprint: service cards: name largest, one line, ticks lighter, link last
R3e.14 pass: built to the blueprint: Alef in two weights, sizes from the scale, spacing on the --s scale
R3c.9 pass: built to the blueprint: one radius 14 px, lucide line icons, one tinted soft shadow
R3s.4 pass: built to the blueprint: one left edge per section; site passes
R3s.6 pass: built to the blueprint: all buttons and chips share heights and corners; site passes
R3s.7 pass: built to the blueprint: sentence case buttons, pale lines, no "Price:" labels, body 1.6
R3s.9 n/a: no certificate in the record, so nothing on the page says kosher
R3s.12 n/a: no photo of Daniel or his real work exists yet; asked for in question 10
R3s.14 n/a: no numbers given beyond the price
R3s.11 n/a: the owner has not said what the ₪400 covers (question 3)
R5b.6 pass: built to the blueprint: no scroll cues, counters or labels above sections
R3.13 pass: built to the blueprint: no doubled sections, no gallery until he adds 3 photos
R3a.1 pass: built to the blueprint: rendered at the six sizes with normal and reduced motion, the opening at several scroll points
R3r.1 pass: built to the blueprint: publish-page --check runs every script on every page
R3r.2 pass: built to the blueprint: a separate reviewer read the pages against docs/page-review-checklist.md and fixes were looked at again
R3g.12 pass: built to the blueprint: the request was sent against a local API, never the owner
R0b.12 n/a: not on the business pages list until it is published
R3x.1 n/a: a service, nothing to turn
R3x.2 n/a: no counted number
R3x.3 n/a: one item in one size in the record, so no tabs
R3x.4 n/a: one item in one size in the record, nothing to compare
R3x.11 n/a: no product to turn
R8.1 n/a: no set of images side by side; the site has one picture
R8.6 n/a: a service with no product to shoot
R8.7 pass: built to the blueprint: gen/room-brief.md and gen/wipe-brief.md written before generating; no owner photo to compare with, only the flyer
R8.2 n/a: one opening picture only, no set
R3p.7 n/a: no item pictures
R3h.12 n/a: no products
R3h.10 n/a: chips change the request sentence and price line, there are no option photos
R3g.14 pass: built to the blueprint: one picture, so one grade
R3o.1 n/a: no food
R3o.2 n/a: no generated liquid; the soap film is drawn in code
R3o.3 n/a: no product colours
R3o.6 pass: built to the blueprint: his one photo is an illustrated flyer with text baked in; used for facts and colours only, real photos asked for
R8.3 n/a: no certificate in the record, so nothing on the page says kosher
R8.4 pass: built to the blueprint: the soap and blade are a generated clip made through the Higgsfield API, cause then effect; reduced motion shows the clean room
R3c.13 pass: built to the blueprint: clipped run on every page
R3c.14 n/a: no cut-outs
R5b.3 pass: built to the blueprint: words on a soft white edge shade at the left (bottom on a phone), no dark pools; readable passes
R3e.8 pass: built to the blueprint: readable passes on every page
R3s.24 pass: built to the blueprint: pictures under 600 KB, every img with width and height, the film has its first frame as poster
R3p.6 pass: built to the blueprint: fits passes at the six sizes; the opening picture is made in both shapes so nothing is zoomed
R3o.5 pass: built to the blueprint: the ₪ sign set in Alef through kit.price
R3x.7 pass: built to the blueprint: BRAND.md written before any picture: colours with uses, Secular One and Alef, the scale, logo on light and dark, bans
R3c.5 pass: built to the blueprint: every choice on the quote page is a chip; nothing marked popular
R3c.6 pass: built to the blueprint: the last button says "Send the request, ₪400" for the basic clean, "Send for a free quote" for the rest
R3c.7 n/a: no offers
R3j.1 n/a: no guarantee offered (question 11)
R3j.2 n/a: no add-on in the record
R3j.3 pass: built to the blueprint: the free quote from his flyer is the main button beside the ₪400 fact
R3j.4 n/a: no group discounts
R3j.5 n/a: no come-back features
R3j.6 n/a: one package
R3j.7 n/a: no struck prices or endorsements
R3j.8 n/a: no savings
R3j.9 n/a: no savings
R3j.10 n/a: no savings
R3j.11 n/a: no combined services
R3j.12 n/a: no savings claims
R3.14 pass: built to the blueprint: the one real price is large; everything else is a free quote, as he quotes
R3k.7 pass: built to the blueprint: the request in three steps with a Step bar, the sentence beside each step, Back, browser back, each step checks its own fields
R3k.8 n/a: no basket, a request
R3k.6 n/a: no basket; links carry the chosen clean (?svc=)
R3k.9 pass: built to the blueprint: the request POSTs to /api/marketplace/gigs/<listing>/book before WhatsApp opens
R3k.10 pass: built to the blueprint: day prefilled with tomorrow, apartment and any time of day chosen, all changeable
R3.15 pass: built to the blueprint: request page, WhatsApp on every page, areas listed
R7.1 pass: built to the blueprint: one direction chosen, said in CONCEPT.md Chosen
R8.5 pass: built to the blueprint: every main button goes to the request page; WhatsApp is the quiet second
R0b.13 pass: built to the blueprint: saved first, with the tracking link added to the WhatsApp text
R3l.1 n/a: no families of products
R3l.2 n/a: no products
R3l.3 pass: built to the blueprint: how often appears only for regular cleaning
R3l.4 n/a: no alike items
R3l.6 n/a: no item pictures
R3l.7 pass: built to the blueprint: each service card reads alone
R3e.9 pass: built to the blueprint: buttons have hover, pressed, busy; fields focus and error with messages; the status line says Sent
R3e.19 pass: built to the blueprint: the last step ends on the Sent line and WhatsApp
R3s.16 pass: built to the blueprint: one question at a time, sensible choices preset
R3s.18 pass: built to the blueprint: "Something else", "Somewhere else" and "I am not sure" on every list
R3s.25 pass: built to the blueprint: empty send shows what is missing; filled, the WhatsApp text carries the sentence and the ₪400 where chosen
R3x.9 pass: built to the blueprint: the request sentence builds beside the form and is what is sent; no price but ₪400, no promise
R3x.10 pass: built to the blueprint: the price line stays beside the form on a laptop and above the send button on a phone
R3x.14 pass: built to the blueprint: SITE.gift_section() and gift.js on the Get a free quote page; hidden until the owner switches gift cards on
R3f.1 pass: built to the blueprint: the film plays on a pinned full-screen stage, whole at every size
R3f.8 n/a: no scroll-tied effect but the pinned opening
R3f.9 n/a: no list that lights up
R3f.5 pass: built to the blueprint: widths in em and rem; no shimmer
R3f.4 n/a: no logo motif in motion
R3g.4 pass: built to the blueprint: the wipe guides to the words; rises once; no loops
R3e.16 pass: built to the blueprint: ease-out curves, under 0.5 s
R3e.17 n/a: no carousel or sheet
R3e.18 n/a: no background video
R3a.2 pass: built to the blueprint: only the blade and the lather change in the film
R3a.3 n/a: nothing placed on a spot in a photo
R3a.4 pass: built to the blueprint: the pinned stage is exactly the screen; the request is never held
R3a.5 pass: built to the blueprint: scroll drives the film; no parallax; reduced motion shows the clean room
R3s.2 pass: built to the blueprint: picture has its box; choosing a chip never moves the layout
R3s.1 pass: built to the blueprint: every button and chip reacts within 100 ms
R3s.8 pass: built to the blueprint: the opening button sits on the white edge shade
R3s.10 n/a: nothing named with a picture
R3s.27 pass: built to the blueprint: every service card and step card in the same order and style
R3s.28 pass: built to the blueprint: every stop of the opening shows the film or the room
R3i.3 n/a: no live readout
R3s.21 pass: built to the blueprint: site check passes: no errors, no dead links
R3x.6 n/a: no sentence lights up
R3x.12 n/a: no progress line
R3b.6 pass: built to the blueprint: phone bar with ₪400 and the button after the first screen, hidden at the form
R3f.7 pass: built to the blueprint: the bar label wraps, the button never wraps
R3a.6 pass: built to the blueprint: room kept for the bar at the page end
R3s.22 pass: built to the blueprint: chips, links and buttons 44 px
R3s.23 pass: built to the blueprint: no sideways scroll at 360 px
R3s.26 pass: built to the blueprint: check-overlap passes
R3t.1 pass: built to the blueprint: site-category service on every page, white ground, facts and prices, plain sans
R3t.2 n/a: a service, not a shop
R3t.3 n/a: not a trainer
R3t.4 n/a: no founding year in the record, so no "since" line
R3a.7 pass: built to the blueprint: phones checked with touch emulation
R3a.8 pass: built to the blueprint: the three facts stack on a phone instead of wrapping
R3u.2 pass: built to the blueprint: a day before the first possible one gets one line naming it
R3u.3 n/a: no servings
R3u.5 n/a: the home opens on a pinned scroll scene
R3u.6 n/a: one picture, no depth pieces
R3u.7 n/a: no rotating word
R3u.8 n/a: no tilted label
R3u.9 pass: built to the blueprint: questions place uses rounded cards when he sends questions
R3u.10 n/a: no places with addresses, areas only
R3u.11 pass: built to the blueprint: the page passed its checks with the room still before the film went in
R3u.12 pass: built to the blueprint: the drawn version was tried first on the page and replaced; the film uses the starter film.js
R3u.13 pass: built to the blueprint: gen/report.md ends with Not done yet and For your call
R3u.14 pass: built to the blueprint: gen/copy-pass.md written
R3w.1 n/a: no food
R3w.2 n/a: no generated liquid
R3w.3 n/a: no food
R3w.4 pass: built to the blueprint: the start and end stills were right before the clip; simple motion (the room coming in) is in code; judged frame by frame
R3w.5 n/a: no food
R3w.6 pass: built to the blueprint: the scrub ends 0.8 s after the blade leaves; the room then takes over
R3v.1 pass: built to the blueprint: sitekit full footer: name and his line, pages, where we clean, reach us, base line with Privacy
R3v.2 pass: built to the blueprint: menu lists the three pages, no #jumps
R3v.6 pass: built to the blueprint: opening tall, bento long, steps medium, areas short
R3v.7 pass: built to the blueprint: bento, zigzag steps, a band of place chips; no layout twice in a row
R3v.8 pass: built to the blueprint: none of the 3v effects; the wipe is this site's own
R3v.14 pass: built to the blueprint: three facts under the button: Basic home clean ₪400, weekly / every two weeks / monthly, the WhatsApp number
R3x.8 pass: built to the blueprint: skip link, one h1, focus rings, labelled fields with type and autocomplete, role=status line, picture first with fetchpriority, two families, JSON-LD
R3x.13 pass: built to the blueprint: every size a --t step and every gap an --s step; check-web-basics passes
R3r.3 pass: built to the blueprint: check-rules passes after the last edit
R3r.4 n/a: nothing pointed out twice on this site yet
