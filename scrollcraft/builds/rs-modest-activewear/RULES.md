# Rules for rs-modest-activewear (docs/rules-checklist.md)

One line per id: `Rx.y pass: <what was looked at or which script passed>`, `Rx.y n/a: <why>`, or `Rx.y fix: <what is wrong>`.
Replace every `todo`. `node scripts/check-rules.mjs scrollcraft/builds/rs-modest-activewear` must exit 0 before anyone is shown the site.


## 1. Facts and words
R0b.1 n/a: a local build, not published yet; the slug rs-modest-activewear is set in gen/build.py and there is no live record to compare with
R0b.3 pass: the one price on every page (cards, opening button, closing band, phone bar, shop, basket) is 320 shekels, the Premium Modest Sports Skirt price in her listing
R2.1 pass: read every sentence on index, shop and contact: skirts with built-in leggings, King George 31, the three words and the brand line are from her listing and flyer; the single product card is her one listed skirt at 320 shekels shown with her flyer photo; no colour products are shown because her files list none; collect from the store is the order form's only option; no count, year or claim added
R2.2 pass: read message-to-ravit.md: it asks only about her skirts, hours, delivery, payment, photos and name
R2.3 pass: message-to-ravit.md now ends with six example FAQ questions written from her details (sizes, trying on, exchange, delivery, hours, washing) and the worry, first days and photo-in-use questions
R3.1 pass: searched all three pages for best, number one, award, guarantee, delivery, fresh, insured, 24/7: none; premium appears only in her own product name and brand line
R3.2 pass: searched for hurry, only N left, today only, limited, ends soon, countdown: none
R3.3 pass: searched for welcome to, look no further, one-stop, passionate, quality you can trust, world-class: none
R3.4 pass: a script over every page's visible text and alt text found 0 exclamation marks and 0 long dashes; capitals only in RS
R3.5 pass: the first screen line reads skirts with built-in leggings, the words of her listing
R3.6 n/a: this site has no Hebrew version (English only), so there is no Hebrew page to open
R3.7 pass: scrolled all three pages; the gallery and FAQ blocks stay hidden until she sends photos and questions; no placeholder text
R3.8 pass: no logo wall, laurels, badges, stars or counts on any page
R3.9 pass: her flyer says visit the store at 31 King George Street and shows the skirts; the first screen and its second state say the same
R3.10 pass: the only strength stated is built-in leggings, from her own listing
R5.1 pass: read every line as Ravit; each names this shop's skirt, street or order steps
R5.2 pass: read every line; no teasing or slang
R5.3 pass: labels are full phrases: With built-in leggings; See the skirts on the rail; Collect at King George 31
R5.4 pass: searched visible text of every page for they, them, their: one hit, in Write them in your basket, where them is the size and colour
R5b.2 pass: going to the shop is always Shop the skirt, 320 shekels (opening, visit section, closing band and phone bar, which holds only that button); adding is always Add to basket with the price on the card and the shop; the header Basket button is the basket link, not a second main button
R5b.8 pass: closing lines read Visit us at King George 31 and Back to the skirt on the shop; no done or complete
R3.11 pass: read index top to bottom: opening (what), product row with price, how to order, the brand words, the store; no enquiry form before prices
R3o.4 pass: contacts labelled WhatsApp and Email on the contact page, closing band and footer; whether she takes calls is asked in message-to-ravit.md question 7
R3e.22 n/a: Ravit has sent no photo of herself and no name beyond the listing owner field, so there is no person to show; a portrait is in the owner photo requests
R3s.19 pass: viewed source of index, shop and contact: each has its own title, description, og:title, og:description and og:image
R6.1 pass: fashion-shop playbook: product row straight after the opening, how-to-order strip, store address and photos, real footer
R4.1 pass: missing sizes, hours and delivery are not invented: the basket asks size and colour in words and the gaps are the questions in message-to-ravit.md

## 2. Opening
R3g.13 pass: 1440x900 and 390x844 first screens: the doors fill the screen, headline of 4 words on the green fade, one short line, one button
R3b.1 pass: same screenshots: what (modest activewear skirts), where (Jerusalem, King George 31), the action (Shop the skirt, price)
R3b.2 pass: the price sits inside the main button on the first screen
R3b.3 pass: walked the scroll at 1440 and 390: one solid button per screen; header Basket and card Add buttons are outlined
R3h.1 pass: check-site OPENING passes (24 Oct): the doors of her skirts photo fill the screen (upscaled from her own photo to 2160 px so it stays sharp) and swing open onto her store as you scroll; 26 Oct a framed version (photo in its own shape, a dark blurred copy round it) was tried after Tzvi said it was too zoomed in, and taken back 27 Oct when Tzvi said the whole screen opening looked better; 27 Oct the skirts photo was extended to the screen's shape instead (gen/wide-brief.md: more of the same plain wall and floor, her pixels pasted back untouched), wide and extra wide for laptops and tall for phones, so it fills the screen with the whole outfit showing; only the store photo behind the doors keeps a marked crop (data-crop-ok), since extending a real store would invent it
R3h.20 pass: measured 25 Oct at 1440x900 and 390x844 (the check-site SMOOTH/SLOW method, frames looked at): pinned opening 3.4 screens on a laptop and a phone (was 2.2), 60 fps (median 16.7 ms, no frame over 50 ms); her skirt beside a plain stone block and wall (the approved skirt shot, gen/skirt-brief.md), never on other clothes, skirt whole; the doors photo loads first
R3n.1 pass: the skirts photo fills the doorway, over half the first screen on the laptop and the full width on the phone
R3n.2 pass: two shop doors made of her skirts photo swing open onto her store at King George 31; no other shop has that door or that address
R3n.3 pass: the scroll opens the doors and changes the words; in the shop a photo tap changes the stage and Add changes the basket and total; check-motion run on every page
R3n.4 pass: compared the home page with fa-outfit-sheet.webp and fa-oddritual-sheet.webp in docs/inspo/awwwards-anatomy-2026-10-22/shops: same pattern (product row under the first screen, name and price under each, one light ground); ours shows fewer products because she lists one skirt
R3n.5 pass: you land on a pair of shop doors made from her skirts photo and as you scroll they swing open into her store
R3g.15 pass: check-fits shows no photo over 1.35 times its size; the doors use her real photos and no generated setting
R3h.2 n/a: no film; the opening is built in code from her own photos
R3h.3 n/a: no film on this site
R3h.5 n/a: no film, so no chapter lines
R3h.7 n/a: no film, so no seams
R3h.8 n/a: no lit film; the section after the opening is the light product row
R3h.11 n/a: no film and no generated stills on this site
R3h.13 n/a: no film or cause-and-effect clip; the doors are one scroll-driven transform
R3h.14 n/a: no film effect
R3h.17 n/a: the page does not use letters parting over film

## 3. Sections and worlds
R3.12 pass: hero (doors), a features section (the product row with price and what is included), a closing band with the button and contacts beside it
R3c.1 pass: CONCEPT.md cites saved inspo pictures; check-concept says ready
R3g.17 pass: CONCEPT.md Effects names the source of each effect; this rework used the 3t fashion study (Outfit, Odd Ritual) for the product row and strip
R3c.2 pass: viewed the whole page at 1440: beige throughout with a green opening, the about band is beige with white hang tags; not cream plus an italic serif word
R3g.1 pass: CONCEPT.md now holds a Style sheet block (ground, ink, accent, faces, radius, motion) and the computed styles match it
R3g.3 pass: computed colour of every price (card prices, shop tag, basket total) is the ink colour; the accent is the black main button only; no emphasised accent word
R3g.7 pass: one closing signature, the giant RS under the closing band, away from the order path
R3g.11 pass: Marcellus for headings and Hanken Grotesk for text, Heebo only for the shekel sign, the faces set in gen/base.css by the starter
R3p.3 pass: node scripts/check-fingerprints.mjs scrollcraft/builds/rs-modest-activewear reports it different from the other pages
R3p.5 pass: the menu bar basket is a paper bag with ribbon handles like her RS bag; Add sends a small photo along an arc into it and the handle gives; exercised on the shop page
R3q.1 pass: node scripts/check-concept.mjs reports ready
R5a.7 pass: the signature is the shop doors, the peak is the doors fully open on her store; the ending resolves on the Shop button
R9.1 pass: the doors use her own photos of skirts and store; nothing else is held
R3f.2 pass: signature doors; accents: hang-in reveal, swinging hang tags, the bag flight; quiet touches on links and buttons; seen in captured frames
R3m.1 pass: the gallery place is on the home page (data-mir-gallery with its template); the one priced skirt is her own order form, not a catalogue list, so no data-mir-catalog is used
R3m.3 n/a: she has sent no hours, areas or fees yet; the FAQ and gallery sit in fixed hidden places (data-mir-faq, data-mir-gallery) with length limits
R3k.1 pass: pages are Home, Shop, Contact; the shop and the order are one page; no old Menu or Order address exists
R3k.2 pass: same bar on all three pages with aria-current; the phone Menu button opens and Close closes it (check-site STATE and FLOW)
R3k.4 pass: grepped: shared site.css and site.js; the opening uses its own class names, not the shared state classes
R8a.1 pass: viewed source of all three pages: no external script or image hosts except Google Fonts; no demo text
R3b.4 pass: with five photos the facts carry the page: price, built-in leggings, address, how to order; nothing padded
R3c.3 n/a: Ravit has named no customer worry yet, so there is no worry to answer beside the button; the questions are in message-to-ravit.md
R3c.8 n/a: Ravit has not told us what happens after an order; the page says only what the form does: it reaches her on WhatsApp and the skirt is collected
R3e.10 pass: card name is 20px against 14px lines beneath; check-site ALIGN passes on all pages
R3e.14 pass: computed font sizes on all three pages at 1440 and 390: six only (14, 17, 20, one section heading, one page heading, the giant RS), body family Hanken Grotesk in weights 400 to 700
R3c.9 pass: computed radii: 3px everywhere; no box shadows on the site; the icons are our own strokes at one line weight
R3s.4 pass: check-site ALIGN passes on all pages
R3s.6 pass: check-site ALIGN: card Add buttons, header Basket and menu button share height and corner
R3s.7 pass: buttons in sentence case, pale dividers, body line height 1.6 computed
R3s.9 pass: one colour per meaning: black for the main button, soft text for labels, green only in the opening
R3s.12 pass: the real skirt and store photos come straight after the opening; Ravit herself has no photo yet (see R3e.22)
R3s.14 n/a: no numbers are shown on the pages, she gave none beyond the price
R3s.11 n/a: she has not told us why the skirt costs 320 shekels; question 10 in message-to-ravit.md asks for the one true sentence
R5b.6 pass: no scroll cues, counters or label above each section
R3.13 pass: each place the address appears carries it once (opening, visit section, closing band, footer); no doubled gallery block; no two dividers in a row
R3a.1 pass: rendered index at 1440x900 and 390x844 and walked every screen, shop at 1440, the add-to-basket route from the home page, contact; the six sizes of 3p.6 by check-fits and readable; reduced motion shows the opened store
R3r.1 pass: pages index, shop, contact: check-site, check-fits, check-motion, readable, clipped, cutoff each run on all three
R3r.2 pass: independent review on 22 Oct (docs/page-review-checklist.md) by a separate reviewer; findings fixed and re-checked
R3g.12 pass: check-site FLOW walked the three steps of the shop, an empty form says what is missing and the WhatsApp message carries the total; the home page Add button was clicked and arrived in the basket
R0b.12 n/a: not published, so there is no pages-list preview clip to compare

## 4. Photos and media
R8.1 pass: the two product cards are crops of the one flyer photo (same light, ground, scale); the third tile is the store, a visit tile and not a product
R8.6 pass: the product card shows a product hero shot of her black skirt (23 Oct), edited from her flyer photo: the one skirt hung on a travertine block, warm stone ground, one warm light, still; the doors keep her flyer photo
R8.7 pass (recorded after the fact): the skirt shot was made 23 Oct, before this rule (24 Oct); gen/skirt-brief.md holds the reference, the traits kept, the exact prompt, the model, the side-by-side, and the 24 Oct upscale of the doors photo with its before and after
R8.2 pass: every picture is one of her own five photos, and the skirt hero shot is edited from her flyer photo (Higgsfield nano_banana_2)
R3p.7 pass: the one product card and each of the three shop thumbnails change the stage photo; tapped all three
R3h.12 pass: the product card comes from the same master photo shown on the shop stage
R3h.10 n/a: no option on this site changes a picture; colour and size are written in the basket
R3g.14 pass: all images are her own photos, viewed together on the screenshot sheet
R3o.1 n/a: not a food business
R3o.2 n/a: no liquid or food
R3o.3 pass: black and white look true to her photo, no colour cast added
R3o.6 pass: five photos used, one per kind (skirts, store, sign, bag, og); the LinkedIn screenshot is left out; originals of the sign and bag are asked in message-to-ravit.md question 5
R8.3 pass: generated media only of the skirt she sells, from her photo; no person, no premises, no text but her own RS mark; Tzvi approved 22 Oct; she sees it before anything goes live
R8.4 n/a: no moving real material; the doors and hang tags are scroll transforms of her photos and reduced motion shows the still
R3c.13 pass: clipped.mjs reports nothing cut off on the pages at the seven sizes
R3c.14 n/a: no cut-out on this site
R5b.3 pass: readable passes on every page; words over the opening sit on a soft green edge shade; on a phone her skirts stand on top with nothing over them and the words sit under them on the green (28 Oct 2026; check-photo-clear: 7-9% covered, was 41-52%); on a phone the doors use crops of her already-extended wide photo shaped for the phone box (skirts-phone, skirts-short for short phones), so the whole skirts show (check-fits passes); the shop's second and third photos load with the page so their fade runs on the first tap (check-motion JUMP)
R3e.8 pass: readable.mjs reports every word clear at every size on all three pages
R3s.24 pass: check-site MEDIA reports no problem; every img has width and height
R3p.6 pass: check-fits passes at 1280x650, 1440x900, 1536x753, 1920x1080, 390x844 and 360x640 on all pages; 27 Oct: the opening skirts photo is extended to each screen shape, not cropped (3c.12)
R3o.5 pass: check-site GLYPH passes; the shekel sign is set in Heebo

## 5. Prices and savings
R3c.5 pass: grepped: no select element; no Most popular badge
R3c.6 pass: buttons say Add to basket (price directly above), Shop the skirt with its price, Continue to collecting; none says Submit
R3c.7 n/a: no offer on this site
R3j.1 n/a: no guarantee is offered
R3j.2 n/a: no add-on fits one skirt
R3j.3 n/a: no free taster or quote is offered
R3j.4 n/a: no group discount is offered
R3j.5 n/a: no come-back feature exists
R3j.6 n/a: one product, no sizes or packages to choose between
R3j.7 pass: no struck-through price and no .90 ending: the one price is 320
R3j.8 n/a: no saving is shown
R3j.9 n/a: no saving is shown
R3j.10 n/a: no saving badge on this site
R3j.11 n/a: no package or combined service
R3j.12 n/a: she made no savings claim
R3.14 pass: one priced item at her listing price, shown plainly; not a quote-based premium business

## 6. Order and booking flow
R3k.7 pass: check-site FLOW walks Step 1 basket, Step 2 collecting, Step 3 details with Back and the browser back button; total beside every step
R3k.8 pass: the basket line has a Remove button of 40px or more (check-site TAP)
R3k.6 pass: clicked Add on the home page card: arrived at shop.html#order with the skirt in the basket and total 320
R3k.9 pass: Step 3 of the shop's order POSTs to /api/marketplace/order-form/<her listing>/orders (product Premium Modest Sports Skirt, pickup, day, name, phone, note with size and colour) and only then opens WhatsApp to her number with the order and the tracking link; if saving fails WhatsApp still opens and the failure is console-logged; a Which day field was added to Step 2 because the endpoint needs a date; check-site SAVE and FLOW pass
R3.15 pass: the action is buy or visit: the shop has the order form and the address and directions are on the home and contact pages
R7.1 pass: CONCEPT.md names the chosen direction and the reason
R8.5 pass: every main button goes to the shop page, which is the order page; WhatsApp is only the contact link
R0b.13 n/a: the local build has no listing record to save an order against; the order's WhatsApp message is walked by check-site FLOW
R3l.1 pass: message-to-ravit.md question 1 asks which colours and sizes she sells
R3l.2 n/a: no item has a limit on what it allows
R3l.3 n/a: no item has options that appear once added
R3l.4 n/a: only one item, nothing to compare
R3l.6 pass: the pictures are her own photo of the skirts as she sells them
R3l.7 pass: the card says name, built-in leggings and price without reading another
R3e.9 pass: check-site STATE and FLOW: hover and pressed answer, focus and error messages show, Sent confirms
R3e.19 pass: finished a test order through check-site FLOW: the Sent message appears and the lists end
R3s.16 pass: the order opens with the basket, then collecting, then details
R3s.18 n/a: collection is the only option and no choice list exists
R3s.25 pass: check-site FLOW: an empty form sends nothing and names what is missing; filled, it makes the WhatsApp message with the total

## 7. Motion
R3f.1 pass: the doors play held on a stage that fits 1280x650; captured laptop and phone frames at the start, middle and end
R3f.8 pass: the doors finish while the stage is still pinned on screen (scroll-finish run on #stage)
R3f.9 n/a: the three how-to-order steps stack on a phone but are revealed as each enters, not scroll-tied
R3f.5 pass: grepped css: widths in em or rem (ch removed from unused rules), no background-clip
R3f.4 n/a: no logo motif is animated
R3g.4 pass: reveals are 560ms ease-out settle, tags swing once, nothing loops
R3e.16 pass: grepped css and js: no linear easing; transitions under 0.5 seconds
R3e.17 n/a: no carousel or bottom sheet
R3e.18 n/a: no ambient background video
R3a.2 pass: viewed frames mid-door-swing at 1440 and 390: no unfinished state
R3a.3 n/a: no overlay placed on a spot of a photo (the leggings dot was removed)
R3a.4 pass: the held doors stage fits 1280x650 (check-fits); cutoff.mjs run on every page; the order section is not held
R3a.5 pass: the scroll sets the doors and never takes the scroll; reduced motion shows the opened store; no parallax on phone
R3s.2 pass: check-site SHIFT and check-motion report no jump on choices
R3s.1 pass: check-site STATE passes
R3s.8 pass: buttons over the opening photo are solid ground-coloured, viewed over the light and the dark frame
R3s.10 n/a: no search or naming that should show a picture
R3i.3 n/a: no live readout on this site
R3s.21 pass: check-site BROKEN reports no errors or dead links on any page

## 8. Phone
R3b.6 pass: the phone bar appears after the first screen with the price, until the order section; walked 390x844 with touch emulation
R3f.7 pass: 360x640 touch emulation: the bar fits (check-site PHONE)
R3a.6 pass: check-site PHONE reports the bar covers nothing at the end of the page
R3s.22 pass: check-site TAP reports no tap under 40px
R3s.23 pass: check-site PHONE reports no sideways scroll at 390 and 360
R3t.1 pass: category fashion-shop in CONCEPT.md and on every page; compared to the fashion study sheets (Outfit, Odd Ritual): light ground, product row under the first screen, price under each, how-it-works strip
R3t.2 pass: check-site BUY passes; the product card has photo, name, price and an Add to basket button (size and colour are written in the note in the basket because she has sent none)
R3t.3 n/a: this is a fashion-shop, not a trainer
R3t.4 pass: all three pages end with the same closing band (last big RS, the button, contact) and a footer of Pages, Visit and Reach us columns with the MyIsraelRental line
R3a.7 pass: check-site phone passes use isMobile and hasTouch emulation at 390x844 and 360x640
R3a.8 pass: the dotted lines were replaced by commas; the one dot line left is the footer sentence, which may wrap

## 9. Finish
R3r.3 pass: every script above passed on every page after the last edit (final run)
R3r.4 n/a: no new correction from Tzvi is outstanding since the last build
R3h.18 n/a: no film: the doors are her own skirts photo opened in code (checked 26 Oct)
R3h.19 n/a: no generated film; the doors are her photo opened in code
R3s.26 pass: check-site OVERLAP clean on every page at 1366x768, 1280x720, 1440x900 and 390x844, pinned scenes scrolled through (26 Oct 2026, run across all 45 pages by the lead session)
R3s.27 pass: stepped the opening through 30 scroll states at 1440x900 and 390x844 on 27 Oct: her name headline holds one top (299-301 px laptop, 575-576 px phone) and the store line under the doors holds another (351-356, 589-594, a 5 px rise as it fades in), each in one size throughout; the shop cards sit in a fixed grid; nothing else repeats
R3k.10 pass: the Which day field defaults to tomorrow (the page accepts from today; her open days are still question 2 to her, so the page does not promise same-day; set on load, a picked day is never overwritten); check-prefill clean
R3u.2 n/a: the owner has not said which days she is open or any lead time (question 2 and the new question 12 in message-to-ravit.md), so there is no real closure to name; the page does not name a closed day. The 10 skirt cap in the basket is a page limit, not hers
R3u.3 n/a: one skirt at one price, no sizes by servings or pieces
R3u.5 pass: check-arrival passes on the home page; the bar drops in, the headline, line and button arrive in order and the doorway photo arrives by a green cover lifting off it (a rise or fade of the whole pinned 3D door scene stalled scrolling to 15 to 30 fps in check-site SMOOTH); looked at 0.1 s and 2 s at 1440x900 and 390x844; all there without JS or with motion off
R3u.6 n/a: the first screen is one whole photo in a pinned door scene, no separate cut-out pieces
R3u.7 n/a: one product and no list of occasions, so no word to rotate
R3u.8 n/a: not added (no tilted label asked for this site)
R3u.9 pass: contact.html FAQ (filled from the shop) restyled as rounded cards, "+" in a dark circle turning into "x", smooth open; looked at on 390x844 with two test questions, one open, one closed (no question is published yet, the section stays hidden until the owner sends some)
R3u.10 n/a: one shop, King George 31
R3u.11 n/a: site made before 3u (29 Oct 2026); no new film
R3u.12 pass: pieces taken from scrollcraft/starter/kit, tried on kit/test.html
R3u.13 n/a: site made before 3u (29 Oct 2026); no new film
R3u.14 n/a: site made before 3u (29 Oct 2026); no new film
