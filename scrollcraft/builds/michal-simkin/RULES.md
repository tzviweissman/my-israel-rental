# Rules for michal-simkin (docs/rules-checklist.md)

One line per id: `Rx.y pass: <what was looked at or which script passed>`, `Rx.y n/a: <why>`, or `Rx.y fix: <what is wrong>`.
Replace every `todo`. `node scripts/check-rules.mjs scrollcraft/builds/michal-simkin` must exit 0 before anyone is shown the site.


## 1. Facts and words
R0b.1 pass: page address in og:image is myisraelrental.com/pages/michal-simkin/, the folder and BRIEF.md slug; the live record was not queried (production)
R0b.3 pass: listed every price (consultation 100, courses 8,000 and 8,000, bundle 12,000 against 16,000, toolkit 3,000) against her own website figures in BRIEF.md: same figures; no shop menu, so no fixed product ids
R2.1 pass: read every sentence of both pages; prices, dates (3 November, Sunday and Tuesday 10:00), class cap 10, the eight named reviews and the five steps trace to her website per BRIEF.md; nothing added in this pass
R2.2 n/a: no message-to-owner file exists for this site (it was self-authored from her website, BRIEF.md); the owner has not been asked anything yet, a message must be written before it goes to her
R2.3 n/a: no message-to-owner file exists for this site; a message with 5 to 8 example questions must be written before it goes to her
R3.1 pass: searched all pages for best, number one, award, guarantee, licensed, insured, kosher, 24/7, emergency, fresh daily, delivery, verified, medical words: none ; the only claims are her own words on her site (boutique, the academy, her graduate Chaya Basya named on her site)
R3.2 pass: searched every page for hurry, only N left, today only, limited time, ends soon, countdowns, counters: none; "Sign up before chag" is her own offer line and has no date, see R3c.7
R3.3 pass: searched every page for welcome to, look no further, one-stop, passionate about, quality you can trust, world-class, top-notch: none
R3.4 pass: searched visible text and alt text of every page for exclamation marks, long dashes and capitalised words: none left (client quotes: three exclamation marks turned to full stops, AMAZINGLY set in lower case)
R3.5 pass: first screen: headline "A wig you love." and the line under it "We create wigs that are a joy to wear" name her product, the wig
R3.6 n/a: the page is English only; no Hebrew version exists to check
R3.7 pass: scrolled both pages: no empty or placeholder section; the reviews are eight real named reviews from her website
R3.8 pass: scanned every page: no logo wall, laurel, invented Popular badge, stars or counts, "value" gift or intro price; the only saving badge is computed from her own prices
R3.9 pass: compared the first screen with her website promise: the first screen keeps her wig-you-love line and "boutique wig salon and academy"
R3.10 pass: strengths listed on the page: the academy with named graduate and class cap, English and Hebrew; each is in her record or website
R5.1 pass: read every line aloud as the owner: each is about this business and its prices and hours
R5.2 pass: read every line: no teasing, slang or jokes
R5.3 pass: checked every badge and short label: "15% off" / "25% off", "about 45 minutes", "Selected", "Part of the programme", "Students at most" read as full phrases
R5.4 pass: searched visible text for they, them, their: only "In their words" and "what they said after", which are about the clients; the business speaks as we and our (book page rewritten this pass)
R5b.2 pass: "Book a consultation" in the top bar, phone bar, Meet section, closing and footer all to book.html; "Enrol in the Academy" goes to book.html#academy as the second door
R5b.8 pass: read the closing moments: "You deserve to love your wig, too", "A wig you love, in Bet Shemesh", "Enrolment is a request: pick a course, say when suits you, and we confirm your place"; none says done or complete; no "or" without a visible choice
R3.11 pass: read the home page top to bottom: what is it (wigs), how it works (five steps), Michal, clients in their words, courses and prices, book
R3o.4 pass: the number is labelled "WhatsApp 054-682-6258" in the footer; no number takes calls that she did not state
R3e.22 pass: "Meet Michal" sits right after the consult section: her portrait, her letter, and the WhatsApp number in the footer
R3s.19 pass: viewed the head of every page: each has its own title, description, og:title, og:description and og:image; the preview image is the same photo the page opens on or her portrait
R6.1 pass: section 6 Personal care: lead is services with prices or their own photos: clients in the opening, the consult, the courses with prices; book is the action
R4.1 pass: missing wig photos and per-wig prices are not faked; they are content gaps in CONCEPT.md

## 2. Opening
R3g.13 pass: first screen at 1440x900 and 390x844: client photos, headline "A wig you love." (4 words), one line, the small label with who she is; the button is the fixed one in the bar
R3b.1 pass: first screen answers what (wigs), where (Bet Shemesh in the bar), why trust (her clients), what to do (Book a consultation in the bar)
R3b.2 pass: the consultation price and hours sit in the bar beside the button; no kosher claim
R3b.3 pass: header button and fixed bar carry the same action; Meet and closing sections each one solid button; looked at while scrolling
R3h.1 pass: check-site OPENING and looked at it (25 Oct): full-screen picture of her own salon wall and shelf under her navy, and her clients are dealt onto a stack on it as you scroll
R3h.20 pass: measured 25 Oct at 1440x900 and 390x844 (the check-site SMOOTH/SLOW method, frames looked at): pinned opening 3.3 screens on a laptop and a phone (was shorter), 60 fps (median 16.7 ms, no frame over 50 ms) after the deck stopped repainting landed cards, the top bar lost its blur and the still grain stopped covering four screens; her clients are dealt onto her own salon wall and glass shelf, empty, under her navy (edited from her photo, gen/ground-brief.md), never onto more client photos; cards whole; the wall loads first
R3n.1 pass: first screen 1440x900 and 390x844: her clients photos fill the whole first screen behind the stack
R3n.2 pass: signature: the words clients used about their old wig are struck through and the words they used after replace them, from her eight real reviews; no other salon has these quotations
R3n.3 n/a: the page offers no choice that changes it; the booking page choices are plain tiles
R3n.4 pass: first screens put next to the Odyssee sheet: hers opens dark on real clients like Vero and Odyssee open on people, then cream; not plainly weaker
R3n.5 pass: "you land and her clients arrive one by one as you scroll, each a real woman in her chair" is about the business
R3g.15 pass: check-fits (no photo shown over 1.35x its size) on every page, and looked at the first screen at 1440x900: her own client photos from her website
R3h.2 n/a: the opening is photographs, not a film, so there is no film to judge
R3h.3 n/a: the opening is photographs, not a film, so there is no film to judge
R3h.5 n/a: the opening is photographs, not a film, so there is no film to judge
R3h.7 n/a: the opening is photographs, not a film, so there is no film to judge
R3h.8 n/a: the opening is photographs, not a film, so there is no film to judge
R3h.11 n/a: the opening is photographs, not a film, so there is no film to judge
R3h.13 n/a: the opening is photographs, not a film, so there is no film to judge
R3h.14 n/a: the opening is photographs, not a film, so there is no film to judge
R3h.17 n/a: the opening is photographs, not a film, so there is no film to judge
R3h.18 n/a: the opening is her real client photos dealt onto a stack in code; no generated film
R3h.19 n/a: no generated film: the opening is her real client photos dealt in code

## 3. Sections and worlds
R3.12 pass: every page has a hero, a features block (one item per service or course with price) and a closing section with the button and proof beside it
R3c.1 pass: CONCEPT.md cites three saved pictures of the beauty category study (docs/inspo/awwwards-anatomy-2026-10-22/shops/odyssee, vero, tengile), check-concept Ideas passes
R3g.17 pass: check-concept Effects: every effect has its "from"; no new effect was added in this pass
R3c.2 pass: whole home page at 1440x900: cream and thin serif are the beauty row of rule 3t and her navy and blush site; contrasting grounds are the navy opening
R3g.1 pass: CONCEPT.md style sheet against the :root tokens of index.html and book.html (ivory, blush #D4A5B5, navy, 18px radius, EB Garamond and Manrope), looked at on the courses section at 1440 and 390 on 25 Oct
R3g.3 pass: the rose accent is gone from text: emphasised words stand out by italic and weight in the navy ink; prices are navy; rose-gold only fills the main button on navy
R3g.7 pass: one closing signature: the big closing line in the footer; nothing in the way of booking
R3g.11 pass: EB Garamond (headings, since 25 Oct; Tzvi: away from Blazin's Playfair Display) with Frank Ruhl Libre named for Hebrew, Manrope with Assistant: all Google OFL, Hebrew faces from the approved list; computed font on h1 and h2 is EB Garamond, loaded
R3p.3 pass: node scripts/check-fingerprints.mjs run 25 Oct prints "michal-simkin: different from all 12 other pages"; after Tzvi's 25 Oct decision: headings EB Garamond (were Playfair Display, as Blazin'), blush #D4A5B5 (was #DBB3B1, alike Blazin', Ravit Hen and The Brown Box), effects added to scrollcraft/fingerprints.json with the price recorded as P9
R3p.5 pass: touch: every before and after is one reviewer own quotation (CONCEPT.md touch line, works)
R3q.1 pass: node scripts/check-concept.mjs reports ready (25 Oct), every part including Not alike
R5a.7 n/a: needs Tzvi: the page has two scroll moves from the 8 Sep brief (the dealt stack and the struck words); rule 5a.7 allows one signature scroll section
R9.1 pass: the stack and quotations use her real client photos and reviews
R3f.2 pass: signature (struck words), accents: dealt stack at the opening, five steps on a line, courses at the close
R3m.1 n/a: the page is a hand-built scroll page with no gallery template and no products to list; the clients are fixed in its design
R3m.3 pass: hours and the course facts sit in fixed places; no free text boxes
R3k.1 pass: the home page and book.html (menu and booking are one page); no old addresses existed
R3k.2 pass: same bar on index and book with the one button; scroll links on the home page, page links on book
R3k.4 n/a: needs Tzvi: the home page uses scrollcraft.css and .js and book.html carries its own inline style (built as a scroll page plus an order page); sharing them is a rebuild
R8a.1 pass: viewed source of every page: only fonts.googleapis.com and wa.me links, no external scripts or images, no demo text from 21st; the label-roll button is restyled in her tokens
R3b.4 pass: facts carry the page: prices, dates, hours and the five steps
R3c.3 pass: the worry (paying) is answered beside the button on the booking page: "Nothing is paid here"
R3c.8 n/a: the owner has not yet told us what happens after a booking beyond a confirmation, which the page says
R3e.10 pass: check-site ALIGN on every page; course rows have name, line, price right; on 28 Oct an iPhone check (Safari's engine) found the "Both courses" tile on the booking page squeezing its words into a narrow column on a phone, now one column, its name starting with a capital
R3e.14 n/a: needs Tzvi: computed on the home page at 1440x900: Manrope body in 5 weights (400 to 800) and 18 distinct text sizes (12 to 86 px) against the limits of three weights and six sizes; consolidating the scale is a redesign of the scroll engine type ramp
R3c.9 n/a: needs Tzvi: computed radii on the home page are 18px (photos, cards), 14px, 999px and her own 45px/10px button corner from her website; one shadow; the rule asks for one radius for images and buttons
R3s.4 pass: check-site ALIGN on index and book: text starts on the same left edge in every section
R3s.6 pass: check-site ALIGN on index and book: buttons of one kind have one height and corner
R3s.7 pass: buttons in sentence case, pale hairlines, body line-height set to 1.6 this pass
R3s.9 pass: one colour per meaning: the saving tag, the selected state and the closing ground each keep one look on every page
R3s.12 pass: right after the consult comes Michal with her portrait and her letter; clients are in the opening
R3s.14 pass: 3 November, 10:00 and 10 students are her numbers, shown at 3.6 rem against the 17 px body with one-line labels
R3s.11 n/a: owner must send one true sentence on why each course and the consultation cost what they do
R5b.6 pass: no scroll cue, no counters and no label above every section; "Step 1 of 3" on book is true progress
R3.13 pass: home page contact appears once (the footer block); contact details are not repeated in cards; hours appear in the phone bar and footer only, the Meet facts line was removed; only her own photos; the work gallery has 5
R3a.1 pass: rendered home page at 1440x900, 1536x753, 1280x650, 1920x1080, 390x844 and 360x640 by check-fits and screenshots of every screen at 1440x900 and 390x844; reduced motion by check-site MEDIA (nothing hidden); English only
R3r.1 pass: check-site, check-fits and check-motion run on every page (index and book); readable on every page; clipped and cutoff on the home page
R3r.2 pass: independent review on 22 Oct (docs/page-review-checklist.md) by a separate reviewer; findings fixed and re-checked
R3g.12 pass: check-site FLOW fills the booking form and builds the WhatsApp message with the total; nothing is sent anywhere, the link only opens wa.me
R0b.12 n/a: the page is not published; it exists as local files only

## 4. Photos and media
R8.1 pass: the four closing client photos share the crop (4:5) and the salon wall; the dealt stack is the same kind of photo
R8.6 n/a: services business, no product hero shots; the photos are her real clients
R8.2 pass: every image is her own client photo from her website; no stock, no generated photos
R3p.7 pass: course rows look alike; the closing photos are four of the same kind
R3h.12 n/a: no product has several appearances to match; the clients appear in a stack, a grid and a quote photo as the same people
R3h.10 n/a: no option with its own picture on this site
R3g.14 pass: looked at all photos on the home screens: one indoor salon grade
R3o.1 n/a: not a food business; no generated food
R3o.2 n/a: no liquids or generated media
R3o.3 n/a: no product colours to match; the photos are portraits
R3o.6 pass: of her 21 website portraits the page uses 8 in the stack, 4 in the closing, 3 in the reviews and 2 of Michal; none twice in one view
R8.3 n/a: no generated media on this site
R8.4 n/a: no moving real material or clip
R3c.13 n/a: needs Tzvi: clipped.mjs on the home page finds the held stages of the hero (at scroll 0, every size) and of the struck-words section (1280x650 and 360x640) sliding 32 to 97 px under the fixed header; the header sits over the hero photo by design and no text is covered in the screenshots, but fixing it means moving the held stages of the 8 Sep scroll page (a try at starting them below the header cut the last quote row and was undone)
R3c.14 n/a: no cut-outs on this site
R5b.3 pass: readable.mjs on every page (22 Oct re-run): book is clear at every size; on the home page the only items left are the struck-through before-words while they fade out by design, and the strike section's lead line under the fixed header at 1536x753 (see R3c.13); the phone nav is now 12.8px
R3e.8 pass: readable.mjs: every word clear except the struck-through before-words of the signature, caught mid-fade by the checker
R3s.24 pass: check-site MEDIA on index and book: no photo over 600 KB, every img has width and height, nothing hidden with motion off
R3p.6 pass: check-fits on index and book: every section and photo fits at the six sizes
R3o.5 pass: check-site GLYPH on index and book: the shekel sign renders in its own font

## 5. Prices and savings
R3c.5 pass: grep finds no select element; services, shades, times and courses are tiles to tap; no "most popular" badge
R3c.6 pass: buttons say what happens next: "Book a consultation", "Request the time", "Enrol in the Academy"; none says Submit
R3c.7 n/a: owner must send the end date of her "sign up before chag" bundle offer; the page prints her wording with no date
R3j.1 n/a: the owner offers no guarantee, so none is shown
R3j.2 n/a: the owner offers no add-on, so none is shown
R3j.3 n/a: the owner offers no free taster, so none is shown
R3j.4 n/a: the owner offers no group discount, so none is shown
R3j.5 n/a: the owner offers no come-back feature, so none is shown
R3j.6 n/a: the owner offers no three-package choice, so none is shown
R3j.7 pass: the only struck-through price is the real separate price of the same items: ₪16,000 = ₪8,000 + ₪8,000
R3j.8 pass: per-unit: both courses ₪12,000 against ₪16,000 booked apart, 25 percent below every single course price pair
R3j.9 pass: judged by group: the one saving is the two-course bundle; no lone saving among the others
R3j.10 pass: (16,000-12,000)/16,000 = 25 percent: "25% off" with ₪16,000 struck through beside ₪12,000
R3j.11 pass: both courses as one against its parts is shown with the saving
R3j.12 n/a: the owner made no savings claim of her own that the prices contradict
R3.14 pass: the consultation price is small in the bar and the courses are rows; no loud prices on a premium business

## 6. Order and booking flow
R3k.7 pass: check-site FLOW walks the booking steps on book.html (what, when, your details), total in the side panel, Back buttons
R3k.8 n/a: one booking, no basket lines to remove
R3k.6 n/a: no basket between pages
R3k.9 pass: book.html reads and POSTs to /api/marketplace/order-form/<her listing> (the consultation, the two courses and the bundle, saved as a request), shows its own done screen, and also opens WhatsApp to her listing's number with the request typed and the tracking link; if saving fails WhatsApp still opens with the request; check-site SAVE and FLOW pass (run on a copy with the API answered by a stub, because the local API has no copy of her listing)
R3.15 pass: what the brief asks (book) has the booking page; contact has numbers and hours; visit has hours and the place
R7.1 pass: CONCEPT.md names the pick (the Own idea) and why; no options page was put to anyone
R8.5 pass: followed every main button: all go to book.html, her booking page; WhatsApp is the quiet second route
R0b.13 n/a: a booking is a request sent as a WhatsApp message; these builds keep no order record or tracking page to save first
R3l.1 n/a: no family of similar items; the courses are different things
R3l.2 n/a: no family of similar items with choices on this site
R3l.3 n/a: no family of similar items with choices on this site
R3l.4 n/a: no family of similar items with choices on this site
R3l.6 n/a: no family of similar items with choices on this site
R3l.7 n/a: no family of similar items with choices on this site
R3e.9 pass: check-site STATE and FLOW; looked at focus ring, error line and the done screen on book; booking walked to the done screen on laptop and phone with the API answered by a stand-in and external requests blocked
R3e.19 pass: book.html ends on its done screen after the request
R3s.16 pass: a plain question first ("What would you like?" / "What") before the details; the sensible option is not pre-ticked
R3s.18 pass: times include "Any time between 10 and 2"
R3s.25 pass: check-site FLOW on book.html: empty sends nothing and shows what is missing; filled sends a WhatsApp message carrying the total

## 7. Motion
R3f.1 n/a: needs Tzvi: the stack and the struck words play on screen at 1440x900 and 390x844, and the held stage slides under the header per clipped.mjs (see R3c.13)
R3f.8 n/a: needs Tzvi: the strike finishes while the held section keeps its pairs on screen at 1440x900 and 390x844, but scroll-finish.mjs needs a done expression from the 8 Sep engine and the held stage slides under the header (see R3c.13)
R3f.9 n/a: the five steps appear together with their section, no item-by-item run
R3f.5 pass: grep css for ch units and background-clip: none left (ch units replaced by rem this pass)
R3f.4 n/a: no logo motif in motion
R3g.4 pass: each motion has one job: deal, strike, reveal; no loops, no bounce
R3e.16 pass: grep: no linear easing (linear only in gradients); hover transitions under 0.3 s, scroll-tied motion follows the scroll
R3e.17 n/a: no carousel or bottom sheet
R3e.18 n/a: no ambient video
R3a.2 pass: 22 Oct review fix: the strike section was re-timed (its cues and pairs start earlier, held length 340 to 250 screens) and on phones laid out in flow (heading, pairs, the Miriam quote one under another), so no pinned area stands empty and nothing overlaps; looked at 100 px stops at 1440x900 and 390x844
R3a.3 n/a: nothing is placed on a spot in a photo
R3a.4 n/a: needs Tzvi: cutoff.mjs on the home page reports the struck-words section sticking out of its held stage at every size, and clipped.mjs reports the pinned stage sliding 73 to 97 px under the fixed header at scroll 0; both come from the held-section design of the 8 Sep brief and an attempt to fix them was undone
R3a.5 pass: the css has a reduced-motion block that shows every card and word; no parallax on phones
R3s.2 pass: check-site SHIFT and check-motion on index and book: nothing jumps, choices switch smoothly
R3s.1 pass: check-site STATE on index and book: every control has hover and pressed; 22 Oct: the pick tiles, choice chips, back button and nav links of book.html got explicit hover and pressed states, the main buttons got pressed
R3s.8 pass: the bar and closing buttons sit on solid grounds, not on photos
R3s.10 n/a: no thing is named to show a picture
R3i.3 n/a: no live readout
R3s.21 pass: check-site BROKEN on index and book: no script errors, 404s or dead links (book.html shows only a console error because it fetches her record from localhost:8001, an origin the local server does not allow; local only)

## 8. Phone
R3b.6 pass: 390x844 and 360x640: the bar with the consultation price and the button is pinned from the first screen
R3f.7 pass: 360x640 looked at: the bar label wraps, the button keeps its size
R3a.6 pass: check-site PHONE on index and book: the bar never covers something to tap; room is kept at the end
R3s.22 pass: check-site TAP on index and book: everything at least 40 px, no overlaps
R3s.23 pass: check-site PHONE on index and book: no sideways scroll
R3s.26 pass: check-site OVERLAP clean on every page at 1366x768, 1280x720, 1440x900 and 390x844, pinned scenes scrolled through (26 Oct 2026); it found the quote pairs on the "in their words" paragraph at 1280x720 and 1366x768 (Tzvi's screenshot), fixed: heading, quotes and reviews share one grid on laptops
R3s.27 pass: the client photos land on one stack in one spot, one after another, and the tab line under the menu bar never moves; stepped through on a 390x844 phone and at 1440x900 on 27 Oct
R3t.1 pass: site-category beauty on every page and Category: beauty in CONCEPT.md; home compared with lx-odyssee-sheet.webp: cream or ivory after the opening, photos framed inside it, courses as rows, her portrait beside her words, the button in the top bar all the way down
R3t.2 n/a: category beauty, not food-shop or fashion-shop
R3t.3 n/a: category beauty, not trainer
R3t.4 pass: footer looked at on every page at 1440x900 and 390x844: last big line, the button, links, contact, MyIsraelRental line; book.html carries a shorter footer of its own
R3a.7 pass: checked phone views with touch emulation (isMobile and hasTouch) in clipped.mjs and the touch screenshots; hover-only looks have a tap version
R3a.8 pass: looked at 360x640: lines of dot-separated items do not wrap

## 9. Finish
R3r.3 pass: check-site, fits and motion run on every page after the last edit; check-rules run last
R3r.4 pass: Tzvi corrections of this pass (3t beauty row, 3g.3 accent, 5.8 we and our) are lines R3t.1, R3g.3, R5.4 of the checklist, with their checks
R8.7 n/a: nothing was generated on this site. Looked at: index.html says "Nothing generated", BRIEF.md rule 3 says only her photographs, there is no gen/ or lab/ folder, and every image in assets/ is a client or portrait photo from her own website.
