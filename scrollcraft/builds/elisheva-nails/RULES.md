# Rules for elisheva-nails (docs/rules-checklist.md)

One line per id: `Rx.y pass: <what was looked at or which script passed>`, `Rx.y n/a: <why>`, or `Rx.y fix: <what is wrong>`.
Replace every `todo`. `node scripts/check-rules.mjs scrollcraft/builds/elisheva-nails` must exit 0 before anyone is shown the site.


## 1. Facts and words
R0b.1 pass: page address in og:image is myisraelrental.com/pages/elisheva-brandeis/, the slug in scrollcraft/fingerprints.json; the live record was not queried (production)
R0b.3 pass: listed every price on the three pages (90, 130 struck, 110, 110, 40, hours) against the facts in gen/build.py header (her listing and flyer): same figures; no shop menu exists, so no fixed product ids
R2.1 pass: read every sentence of the three pages; every price, hour, phone, the four years and the services trace to the listing and flyer in gen/build.py; nothing added in this pass
R2.2 pass: read message-to-elisheva.md: every question is about her own business (photos, colours, preparation, how long gel lasts, payment, numbers, reviews, price reasons, client questions), none about how we build and none the record already answers
R2.3 pass: message-to-elisheva.md asks the worry question (before the appointment, cancelling), how long gel lasts, payment, and now lists 6 example FAQ questions written from her services
R3.1 pass: searched all pages for best, number one, award, guarantee, licensed, insured, kosher, 24/7, emergency, fresh daily, delivery, verified, medical words: none ; the only claim is "more than four years of experience", from her flyer ("4+ years")
R3.2 pass: searched every page for hurry, only N left, today only, limited time, ends soon, countdowns, counters: none
R3.3 pass: searched every page for welcome to, look no further, one-stop, passionate about, quality you can trust, world-class, top-notch: none
R3.4 pass: searched visible text and alt text of every page for exclamation marks, long dashes and capitalised words: none left
R3.5 pass: first screen at 1440x900: headline "Gel nails and nail art" names what she sells, in the words of her listing
R3.6 n/a: the page is English only; no Hebrew version exists to check
R3.7 pass: scrolled every page: no empty or placeholder section, no FAQ and no reviews section (none given yet)
R3.8 pass: scanned every page: no logo wall, laurel, invented Popular badge, stars or counts, "value" gift or intro price; the only saving badge is computed from her own prices
R3.9 pass: compared the first screen with her flyer (gel nails, French nails, nail art, Romema): gel nails, nail art and Romema, Jerusalem are on it
R3.10 pass: one strength on the page, "more than four years of experience", with its proof (the flyer)
R5.1 pass: read every line aloud as the owner: each is about this business and its prices and hours
R5.2 pass: read every line: no teasing, slang or jokes
R5.3 pass: checked every badge and short label: "15% off" / "25% off", "about 45 minutes", "Selected", "Part of the programme", "Students at most" read as full phrases
R5.4 pass: searched visible text for they, them, their: none
R5b.2 pass: "Book a time" in the bar, hero, every service row, the pair sections, studio card, footer, phone bar: all go to book.html
R5b.8 pass: read the closing moments: "Book your nails", "Come to the studio", the toast "Press send in WhatsApp and I will confirm your time"; none says done or complete; no "or" without a visible choice
R3.11 pass: read the home page top to bottom: what is it (gel nails, nail art), her real work, what it costs (service rows), what to do (book)
R3o.4 pass: the numbers are labelled by what they do ("WhatsApp or call +44 7871 822590", "Text +972 53 348 4521") in the footer block of every page; the message to her asks whether they are right
R3e.22 n/a: owner must send a portrait of Elisheva; the page has her name and a WhatsApp number but no photo of her (message-to-elisheva.md to be extended with this request)
R3s.19 pass: viewed the head of every page: each has its own title, description, og:title, og:description and og:image; the preview image is the same photo the page opens on or her portrait
R6.1 pass: docs/page-generation-rules.md section 6 Personal care: lead is services with durations and prices or their own photos: the home page leads with her work and the service rows with time and price; book is the action
R4.1 pass: missing data reads as deliberate: the street shows as "Romema, Jerusalem" and is a content gap in message-to-elisheva.md

## 2. Opening
R3g.13 pass: first screen at 1440x900 and 390x844: picture, headline "Gel nails and nail art" (4 words) with her script name, one line ("Gel from ₪90. More than four years of experience."), the small label with the place, one button
R3b.1 pass: first screen answers what (gel nails and nail art), where (Romema, Jerusalem), why trust (four years), what to do (Book a time)
R3b.2 pass: the price (gel from ₪90) and the four years touch the button on the first screen; no kosher claim
R3b.3 pass: one solid white button in the hero, the header button is an outline; service rows use outline buttons; pair sections one solid each, looked at while scrolling
R3h.1 pass: check-site OPENING on the home page and looked at it: her photo fills the screen and it is an event, the next shade spreads over it every few seconds
R3h.20 n/a: measured 25 Oct (check-site's SMOOTH/SLOW measure at 1440x900 and 390x844): the opening is not scroll-driven (no sticky stage); it is her own hands photo full screen with the words and the shade swatches on a soft shade, nothing to scroll through; 28 Oct: the shades change on their own only while her photo is on screen (each change restyles the page; below the photo a slowed phone was 29% busy doing nothing, now 0%); and, Tzvi's choice on 28 Oct, the automatic changes fade plainly while a tapped shade still spreads like polish (the spread running on its own kept a phone 44% busy with her photo on screen, now 2%)
R3n.1 pass: first screen 1440x900 and 390x844: her close-up of nails fills the whole first screen
R3n.2 pass: signature: tap a shade and her photo of that colour opens out from the chip across the opening; only a nail artist who shoots her work by colour has it
R3n.3 pass: tapping a shade changes the photo, the page tint, the name and the booking link (check-motion: every choice switches smoothly); 25 Oct: the tint band is stronger (38%, was 16%) and starts higher (90% of the opening, was 78%) so the page plainly turns the tapped colour on every shade, bubblegum included; the top nail in each photo stays clear
R3n.4 pass: first screens put next to docs/inspo/awwwards-anatomy-2026-10-22/shops/lx-odyssee-sheet.webp: hers opens on a close-up of the work like Odyssee opens on skin, then settles into cream; not plainly weaker
R3n.5 pass: "you land and her photo of nails in the colour you tap opens across the screen" is about the business, in the first five seconds and the first scroll
R3g.15 pass: check-fits (no photo shown over 1.35x its size) on every page, and looked at the first screen at 1440x900: her own photos, cropped from the originals in src/owner
R3h.2 n/a: the opening is photographs, not a film, so there is no film to judge
R3h.3 n/a: the opening is photographs, not a film, so there is no film to judge
R3h.5 n/a: the opening is photographs, not a film, so there is no film to judge
R3h.7 n/a: the opening is photographs, not a film, so there is no film to judge
R3h.8 n/a: the opening is photographs, not a film, so there is no film to judge
R3h.11 n/a: the opening is photographs, not a film, so there is no film to judge
R3h.13 n/a: the opening is photographs, not a film, so there is no film to judge
R3h.14 n/a: the opening is photographs, not a film, so there is no film to judge
R3h.17 n/a: the opening is photographs, not a film, so there is no film to judge

## 3. Sections and worlds
R3.12 pass: every page has a hero, a features block (one item per service or course with price) and a closing section with the button and proof beside it
R3c.1 pass: CONCEPT.md cites three saved pictures of the beauty category study (docs/inspo/awwwards-anatomy-2026-10-22/shops/odyssee, vero, tengile), check-concept Ideas passes
R3g.17 pass: check-concept Effects: every effect has its "from" (21st animated button search, docs/inspo ids); check-fingerprints effects listed; no new effect was added in this pass
R3c.2 pass: whole home page at 1440x900: cream and thin serif are the beauty row of rule 3t and her blush-and-rose logo colours; contrasting grounds are the dark opening and the ink closing block
R3g.1 pass: CONCEPT.md style sheet against site.css :root tokens (paper, blush, ink, rose, 18px radius, three faces): same
R3g.3 pass: accent rose is on the main button only; labels, script name, links and icons are in the ink colour; prices are ink (computed colour of every service price: ink)
R3g.7 pass: one closing signature: the giant script name in the footer block; nothing in the way of booking
R3g.11 pass: Bodoni Moda with Frank Ruhl Libre named for Hebrew, Albert Sans with Assistant (the shekel sign), Sacramento for her name only (all since 25 Oct, Tzvi: away from L.A. Cholent's Heebo and Pinyon Script; were Outfit, Heebo, Parisienne): all Google OFL; computed fonts on the home page: Bodoni Moda, Albert Sans, Sacramento, all loaded; check-site GLYPH clean on all three pages
R3p.3 pass: node scripts/check-fingerprints.mjs run 25 Oct prints "elisheva-brandeis: different from all 12 other pages"; after Tzvi's 25 Oct decision: body Albert Sans with Assistant for the shekel sign, script Sacramento (were Outfit, Heebo and Parisienne, which matched L.A. Cholent)
R3p.5 pass: touch: shades named by what they look like, each her own photo (CONCEPT.md touch line, works)
R3q.1 pass: node scripts/check-concept.mjs reports ready (25 Oct), every part including Not alike
R5a.7 pass: one signature (shade reveal) and one peak (the cream closing with her work); the ending resolves on Book a time
R9.1 pass: the shade photos are her own, one per colour; no signature without material
R3f.2 pass: signature (shade reveal), accents: arriving opening, work photos easing in mid-page, giant name at the close; quiet touches on buttons
R3m.1 pass: grep: data-mir-gallery on the Recent work section; no priced products to put in a catalog
R3m.3 pass: the opening hours sit in one fixed list; no free text boxes
R3k.1 pass: pages Home, Book, Contact; the menu and booking are one page (Book); no old Menu or Order addresses existed
R3k.2 pass: same bar on all three pages with aria-current and the one button; phone menu opens with Menu and closes on Escape or a link tap
R3k.4 pass: shared site.css and site.js serve all three pages; no page class reused for shared state
R8a.1 pass: viewed source of every page: only fonts.googleapis.com and wa.me links, no external scripts or images, no demo text from 21st; the label-roll button is restyled in her tokens
R3b.4 pass: with few photos facts carry the page: services, times, hours before the long description
R3c.3 pass: the worry (paying) is answered beside the button on the booking page: "Nothing to pay on this page"
R3c.8 n/a: the owner has not yet told us what happens after a booking beyond a confirmation on WhatsApp, which the page says
R3e.10 pass: check-site ALIGN (name at least 1.25x its line) on every page; service rows have name, price right, button; longest name "Nail art, French or gradient nails" fits
R3e.14 n/a: needs Tzvi: computed on the home page at 1440x900: one body family Albert Sans (Outfit until 25 Oct) in 3 weights (400, 500, 600) as the rule asks, but 14 distinct text sizes (13 to 20 px body, 27 to 173 px display) against the limit of six; consolidating the type scale is a redesign of every heading clamp
R3c.9 n/a: needs Tzvi: computed radii on the home page are 18px (photos, cards) and 999px (pill buttons), shadows 2, one icon set (lucide-style inline svg); the rule asks for one radius for images and buttons
R3s.4 pass: check-site ALIGN on index, book, contact: text starts on the same left edge in every section
R3s.6 pass: check-site ALIGN on index, book, contact: buttons of one kind have one height and corner
R3s.7 pass: buttons in sentence case, pale hairlines, body line-height set to 1.6 this pass (computed 1.6)
R3s.9 pass: one colour per meaning: the saving tag, the selected state and the closing ground each keep one look on every page
R3s.12 pass: right after the opening comes her real work (Recent work, five of her photos); the maker herself has no photo yet, see R3e.22
R3s.14 n/a: the only numbers are prices, which the rows carry; she gave no other numbers to show big
R3s.11 n/a: owner must send one true sentence on why each service costs what it does (question added to message-to-elisheva.md)
R5b.6 pass: no scroll cue, no counters and no label above every section; "Step 1 of 3" on book is true progress
R3.13 pass: home page contact appears once (the footer block); contact details are not repeated in cards (contact page cards now hold Book, Email and Where; the numbers are in the closing block); only her own photos; the work gallery has 5
R3a.1 pass: rendered home page at 1440x900, 1536x753, 1280x650, 1920x1080, 390x844 and 360x640 by check-fits and screenshots of every screen at 1440x900 and 390x844; reduced motion by check-site MEDIA (nothing hidden); English only
R3r.1 pass: check-site, check-fits and check-motion run on every page (index, book, contact); readable on every page; clipped and cutoff on the home page
R3r.2 pass: independent review on 22 Oct (docs/page-review-checklist.md) by a separate reviewer; findings fixed and re-checked
R3g.12 pass: check-site FLOW fills the booking form and builds the WhatsApp message with the total; nothing is sent anywhere, the link only opens wa.me
R0b.12 n/a: the page is not published; it exists as local files only

## 4. Photos and media
R8.1 pass: the five Recent work photos are one set (hands on a white towel, same crop 4:5) and the four shade photos one set; looked at on the home and book screens
R8.6 n/a: services business, no product hero shots; the photos are her real work
R8.2 pass: every image is cropped from her own photos in src/owner (gen/crops.py); no stock, no generated photos
R3p.7 pass: pointed at and tapped every shade: each shows its own photo the same way; service rows look alike
R3h.12 pass: each shade photo in the hero, the book stage and the chips is cropped from one owner photo per colour (gen/crops.py)
R3h.10 pass: choosing a shade changes its picture, name and the button link, one photo per shade (check-motion)
R3g.14 pass: looked at all images on the home and book screens: one soft daylight grade on white towels, no filter mix
R3o.1 n/a: not a food business; no generated food
R3o.2 n/a: no liquids or generated media
R3o.3 pass: looked at every shade photo: colours read true, no cast from cloth or light; 22 Oct: Sheer pink (a near twin of Soft nude) and With a touch of blue (nude nails with two blue accents, not blue nails) were dropped, four shades remain
R3o.6 pass: src/owner holds her 14 photos; the page uses her shade, work, studio and towel photos, no photo twice in one view
R8.3 n/a: no generated media on this site
R8.4 n/a: no moving real material or clip
R3c.13 pass: clipped.mjs on the home page at seven sizes: nothing cut off
R3c.14 n/a: no cut-outs on this site
R5b.3 pass: readable.mjs on every page, including the ruby state of the booking page (22 Oct: the unchosen service cards and style chips turn light on ruby, the "about 60 minutes" lines now read clearly); words over her photos sit on the soft edge shade; 28 Oct (Tzvi: on a phone her work was hard to see, covered by the words and the shade, worst on soft nude): on a phone her photo now stands clear above the words, nothing over it, each photo framed on her hands; the words sit under it on the shade colour; laptop unchanged. The phone photo box is wider than her tall photos, so towel above and below is trimmed and the frame is marked data-crop-ok: extending the photos sideways to fit would make her nails smaller, the opposite of the point; every nail stays whole at 390x844 and 375x667; with her own longer headline (three lines) the phone headline is set a little smaller so "Book a time" stays on the first screen
R3e.8 pass: readable.mjs on every page: every word clear at every size checked
R3s.24 pass: check-site MEDIA on index, book, contact: no photo over 600 KB, every img has width and height, nothing hidden with motion off
R3p.6 pass: check-fits on index, book, contact: every section and photo fits at the six sizes
R3o.5 pass: check-site GLYPH on index, book, contact: the shekel sign renders in its own font

## 5. Prices and savings
R3c.5 pass: grep finds no select element; services, styles, shades, times are tiles to tap; no "most popular" badge; Gel removal hides the colour choice, Nail art asks French, gradient or nail art and sends it in the message
R3c.6 pass: buttons say what happens next: "Book a time", "Continue to day and time", "Continue to your details"; none says Submit
R3c.7 pass: the only offer is a standing saving on gel with removal (no date claimed, none needed)
R3j.1 n/a: the owner offers no guarantee, so none is shown
R3j.2 n/a: the owner offers no add-on, so none is shown
R3j.3 n/a: the owner offers no free taster, so none is shown
R3j.4 n/a: the owner offers no group discount, so none is shown
R3j.5 n/a: the owner offers no come-back feature, so none is shown
R3j.6 n/a: the owner offers no three-package choice, so none is shown
R3j.7 pass: the only struck-through price is the real separate price of the same items: ₪130 = ₪40 removal + ₪90 gel
R3j.8 pass: per-unit: gel with removal ₪110 against ₪130 booked apart, the smaller option is not cheaper per unit
R3j.9 pass: judged by group: the one saving is gel with its removal; no lone saving among the others
R3j.10 pass: (130-110)/130 = 15.38 percent, rounded down 15: "15% off" with ₪130 struck through beside ₪110 on the home row and the booking option; no sentence explains it again
R3j.11 pass: gel with removal as a combined service against its parts is shown on the home row and the booking option
R3j.12 n/a: the owner made no savings claim of her own that the prices contradict
R3.14 pass: loud prices (2 rem) only where prices exist; this is a priced service business, not quote-based

## 6. Order and booking flow
R3k.7 pass: check-site FLOW walks the three steps on book.html: Step 1 your nails, Step 2 day and time, Step 3 details, total beside, Back button
R3k.8 n/a: one booking, no basket lines to remove
R3k.6 n/a: no basket between pages; a service row passes ?service= to the booking page
R3k.9 pass: check-site SAVE passes: the Send step POSTs to /api/marketplace/gigs/a6e275b1-.../book (appointment listing) with tier_name mapped to the live tier names (Gel Nails, Gel nails with removal, Gel Removal, Nail art / French Nails / Gradient nails), preferred_date, time_slot HH:MM from her real hours, guest_name, contact_phone, message; the WhatsApp tab opens first and is filled after the save, with the tracking link; if the save fails WhatsApp still opens and the failure is console-logged
R3.15 pass: what the brief asks (book) has the booking page; contact has numbers and hours; visit has hours and the place
R7.1 pass: CONCEPT.md names the pick (the Own idea) and why; no options page was put to anyone
R8.5 pass: followed every main button: all go to book.html, her booking page; WhatsApp is the quiet second route
R0b.13 pass: the booking is saved with a tracking link (/bookings/track/...) before WhatsApp opens, and the message carries that link (see R3k.9)
R3l.1 n/a: no family of similar items; the four services are different things
R3l.2 n/a: no family of similar items with choices on this site
R3l.3 n/a: no family of similar items with choices on this site
R3l.4 n/a: no family of similar items with choices on this site
R3l.6 n/a: no family of similar items with choices on this site
R3l.7 n/a: no family of similar items with choices on this site
R3e.9 pass: check-site STATE and FLOW; looked at disabled, focus ring, error message and the confirmation toast on book
R3e.19 pass: the booking ends with a visible toast "Booking written out", the WhatsApp message open, and the button reads "Opened in WhatsApp" with a tick (22 Oct: it was a tick alone); walked to the last step on laptop and phone with external requests blocked
R3s.16 pass: a plain question first ("What would you like?" / "What") before the details; the sensible option is not pre-ticked
R3s.18 pass: colour is optional; "Ask about a design" is the way out for designs not listed
R3s.25 pass: check-site FLOW on book.html: empty sends nothing and shows what is missing; filled sends a WhatsApp message carrying the total

## 7. Motion
R3f.1 n/a: nothing is tied to scroll position; a block fades in once when it comes into view
R3f.8 n/a: no scroll-tied effect
R3f.9 n/a: nothing on this site stacks and lights item by item
R3f.5 pass: grep css for ch units and background-clip: none left (ch units replaced by rem this pass)
R3f.4 n/a: no logo motif in motion
R3g.4 pass: each motion has one job: shade reveal, fade in; the shade photos change every 3 s and stop on a tap; no bounce
R3e.16 n/a: needs Tzvi: the shade reveal that is the signature takes 1.35 s by design (rule says under 0.5 s); no linear easing anywhere (grep: linear only in gradients)
R3e.17 n/a: no carousel or bottom sheet
R3e.18 n/a: no ambient video
R3a.2 pass: tapped a shade and looked at frames during the reveal: it spreads from the chip, the text does not re-wrap, no unfinished state
R3a.3 n/a: nothing is placed on a spot in a photo
R3a.4 n/a: no held section on this page
R3a.5 pass: reduced motion shows the chosen shade at once (js reduce path) and check-site MEDIA found nothing hidden; no parallax
R3s.2 pass: check-site SHIFT and check-motion on index, book, contact: nothing jumps, choices switch smoothly
R3s.1 pass: check-site STATE on index, book, contact: every control has hover and pressed
R3s.8 pass: the hero button is a solid white pill over the photo; looked at it over the milky and the ruby shades, light and dark photo
R3s.10 pass: tapping a shade names it and starts its picture at once
R3i.3 n/a: no live readout
R3s.21 pass: check-site BROKEN on index, book, contact: no script errors, 404s or dead links

## 8. Phone
R3b.6 pass: 390x844 and 360x640: the bar with "Gel nails ₪90, Romema" and the button is pinned from after the first screen to the end
R3f.7 pass: 360x640 looked at: the bar label wraps, the button keeps its size
R3a.6 pass: check-site PHONE on index, book, contact: the bar never covers something to tap; room is kept at the end
R3s.22 pass: check-site TAP on index, book, contact: everything at least 40 px, no overlaps
R3s.23 pass: check-site PHONE on index, book, contact: no sideways scroll
R3t.1 pass: site-category beauty on every page and Category: beauty in CONCEPT.md; home compared with lx-odyssee-sheet.webp: cream or ivory after the opening, photos framed inside it, services as rows with duration and price, the button in the top bar all the way down
R3t.2 n/a: category beauty, not food-shop or fashion-shop
R3t.3 n/a: category beauty, not trainer
R3t.4 pass: footer looked at on every page at 1440x900 and 390x844: last big line, the button, links, contact, MyIsraelRental line
R3a.7 pass: checked phone views with touch emulation (isMobile and hasTouch) in clipped.mjs and the touch screenshots; hover-only looks have a tap version
R3a.8 pass: looked at 360x640: lines of dot-separated items do not wrap

## 9. Finish
R3r.3 pass: check-site, fits and motion run on every page after the last edit; check-rules run last
R3r.4 pass: Tzvi corrections of this pass (3t beauty row, 3g.3 accent, 5.8 we and our) are lines R3t.1, R3g.3, R5.4 of the checklist, with their checks
R8.7 n/a: nothing was generated on this site. Looked at: gen/ holds only crops.py, build.py, wow_patch.py, book.js and index.html (no Higgsfield, kie, nano_banana, Seedance or Kling call), every image in assets/ is cropped from her own photos in src/owner, the two .mp4 files in the build root are screen recordings of the page itself, and R8.2 and R8.3 already say no generated media.
R3h.18 n/a: no film: the pages show only her photos (checked 26 Oct)
R3h.19 n/a: no generated film; only her own photos
R3s.26 pass: check-site OVERLAP clean on every page at 1366x768, 1280x720, 1440x900 and 390x844, pinned scenes scrolled through (26 Oct 2026, run across all 45 pages by the lead session)
R3s.27 pass: check-same-place clean on the home, booking and contact pages at 390x844 and 1440x900 (28 Oct); the shade swatches and their name stay in one place while the photo changes
