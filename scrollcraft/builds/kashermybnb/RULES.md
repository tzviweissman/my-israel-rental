# Rules for kashermybnb (docs/rules-checklist.md)

One line per id: `Rx.y pass: <what was looked at or which script passed>`, `Rx.y n/a: <why>`, or `Rx.y fix: <what is wrong>`.
Replace every `todo`. `node scripts/check-rules.mjs scrollcraft/builds/kashermybnb` must exit 0 before anyone is shown the site.


## 1. Facts and words
R0b.1 n/a: not published: local build only; the slug is set at publish from the live record
R0b.3 pass: every price against the listing: $350 whole kitchen, $180 pots and cutlery, +$40 oven, $15 new frying pan
R2.1 pass: read every sentence of every page and traced each fact to the record, listing or flyer; no counts or reviews were invented
R2.2 pass: read message-to-owner.md: asks only about their own business; the WhatsApp number in site.js comes from their own MyIsraelRental listing (whatsapp +972584031989, confirmed), noted in CONCEPT.md; the pots words now come from BRIEF.md (their listing and flyer)
R2.3 pass: message-to-owner.md has 7 example FAQ questions from their real details and asks the photo, phone and preparation questions
R3.1 pass: searched every page for kosher, best, guarantee, insured, licensed, 24/7, delivery: only claims from their own flyer and listing
R3.2 pass: searched every page for hurry, only N left, today only, limited, countdown: none
R3.3 pass: searched every page for welcome to, one-stop, passionate, world-class, quality you can trust: none
R3.4 pass: counted exclamation marks and long dashes in visible text and alt text of every page by script: 0 and 0
R3.5 pass: first screen says kitchen kashering, the listing words
R3.6 n/a: the site is English only; no Hebrew version was built or asked for
R3.7 pass: scrolled every page: no FAQ, reviews, empty or placeholder sections
R3.8 pass: scanned every page: no logo walls, laurels, stars, invented badges or intro prices
R3.9 pass: first screen against the flyer: what they kasher and who for match
R3.10 pass: strengths: expert mashgichim following cRc guidelines, and since 2019, both from the flyer
R5.1 pass: read every line as the owner: each is only about their own work
R5.2 pass: read every line: plain, no jokes or slang
R5.3 pass: short labels read as full phrases
R5.4 pass: searched visible text of every page for they, them, their: none about the business itself
R5b.2 pass: the main button is "Book a kashering" to book.html in the bar, the opening, both service panels, the closing block, the phone bar and the footer; product pages only preselect the service it names
R5b.8 pass: closing lines "Settle in, ready to use." and the fine print name what the customer gets
R3.11 pass: home page order: what it is, the two services with prices, how it works, who it is for and where, then book; prices come before the booking form
R3o.4 n/a: no phone number or email shown, contact is the chat and WhatsApp only (BRIEF.md)
R3e.22 n/a: owner must send a photo of the person who kashers, and photos of a real kitchen done
R3s.19 pass: viewed the head of every page: own title, description, og:title, og:description and og:image
R6.1 pass: service playbook: says what and where first, named services with prices, a places list, one button
R4.1 pass: prices outside Jerusalem say "a fee by distance" rather than a number; nothing invented

## 2. Opening
R3g.13 pass: 1440x900 and 390x844 first screens: picture, headline of 4 words "Kitchen kashering across Israel.", one line, one button in the card
R3b.1 pass: first screen says what, where, proof (mashgichim, cRc, since 2019) and the button
R3b.2 pass: price, cRc and since 2019 sit in the card with the button
R3b.3 pass: one solid action per screen: the bar button and phone bar repeat the same action
R3h.1 pass: site OPENING passed: the kitchen walk moves the camera to each part as you scroll
R3n.1 pass: the kitchen photo fills the whole first screen at 1440x900 and 390x844
R3n.2 pass: the walk: a camera visits oven, microwave, stovetop, countertops, sink and hot plate and ticks each
R3n.3 pass: the booking steps change the total and the review; the home opening itself responds to scroll only; 25 Oct: the order list's kitchen and pots thumbnails load from the script's own folder, so they show on the live /business/ page too (check-published found them pointing at /business/assets/)
R3n.4 pass: next to Truck'N Roll and Aventura (services study): ours opens on a real kitchen and names the job in line one, not plainly weaker
R3n.5 pass: "you land on a kitchen and a camera walks round it ticking off each part they kasher"
R3g.15 pass: check-fits: no photo over 1.35x; the kitchen picture is a generated setting and is not called their premises
R3h.2 n/a: no film in this site: the opening is built in code from their own photos
R3h.3 n/a: no film in this site: the opening is built in code from their own photos
R3h.5 n/a: no film in this site: the opening is built in code from their own photos
R3h.7 n/a: no film in this site: the opening is built in code from their own photos
R3h.8 n/a: no film in this site: the opening is built in code from their own photos
R3h.11 n/a: no film or generated still set added in this rework; no new generation
R3h.20 pass: measured 25 Oct at 1440x900 and 390x844 (the check-site SMOOTH/SLOW method, frames looked at): pinned walk 6.0 screens on a laptop and 4.2 on a phone, 60 fps (median 16.7 ms, no frame over 50 ms); the kitchen is a plain setting with the stops drawn on it, cards whole; the kitchen picture loads first
R3h.13 n/a: no film in this site: the opening is built in code from their own photos
R3h.14 n/a: no film in this site: the opening is built in code from their own photos
R3h.17 n/a: no film in this site: the opening is built in code from their own photos

## 3. Sections and worlds
R3.12 pass: home page: a hero, the two services with price and what is included, a closing block with the button
R3c.1 pass: CONCEPT.md cites the services study pictures it took from (Truck'N Roll, Townhouse, Aventura) with their paths, and says what was picked
R3g.17 pass: every new piece (service panels from Aventura, numbered steps from Townhouse, places list from Truck'N Roll) is named in CONCEPT.md with its study sheet; nothing reused from another page
R3c.2 pass: light ground with a blue accent, services on named panels, a dark footer; not cream plus serif
R3g.1 pass: style sheet in CONCEPT.md and site.css; the new sections use the existing tokens
R3g.3 pass: accent only on the button and the one emphasised word; prices in ink, checked in the services panels
R3g.7 pass: one closing signature: the big "Settle in, ready to use." line
R3g.11 pass: Bricolage Grotesque and Instrument Sans, Google fonts, unchanged
R3p.3 pass: ran check-fingerprints 25 Oct: "kashermybnb-kashering-services: different from all 11 other pages" (checked under its published slug)
R3p.5 pass: touch: the station index in the bar ticks as the camera visits each part
R3q.1 pass: ran check-concept 25 Oct: concept ready for kashermybnb (Category: service, ideas, Own idea, Mobbin and 21st lines, wow gate, effects)
R5a.7 pass: one signature (the walk) and one peak ("Ready to use")
R9.1 pass: the signature uses their own photos
R3f.2 pass: effect budget unchanged by this rework; no new motion added
R3m.1 n/a: the gallery and catalog template markers belong to the automatic page builder; this is a hand build
R3m.3 n/a: no owner-editable places in this hand build
R3k.1 pass: pages: home, whole kitchen, pots and cutlery, and Book as one flow of four steps
R3k.2 pass: home and product pages share one bar with the Book a kashering button; on phones the bar is one row with a Pages menu; the four booking steps keep a bare bar on purpose
R3k.4 pass: shared site.css and site.js serve the pages
R8a.1 pass: no 21st components were added in this rework; no external scripts, only Google fonts
R3b.4 pass: few photos (kitchen, pots), so facts carry the page: prices, steps, places
R3c.3 pass: the worry (what is included, what cannot be kashered) is answered inside each service panel next to the button
R3c.8 pass: what happens after booking is on the page in the steps: we confirm on WhatsApp
R3e.10 pass: service panels and room tiles read name first, then the price or one line; site ALIGN passed
R3e.14 pass: one body family; new sections use existing sizes
R3c.9 pass: one corner radius and shadow in the new sections, no gradients or decorative arrows
R3s.4 pass: site ALIGN passed on every page
R3s.6 pass: site ALIGN passed; the buttons share one style
R3s.7 pass: sentence case buttons, pale dividers, 1.45 to 1.6 line height in the new text
R3s.9 pass: one colour per meaning; no kosher tag in this site
R3s.12 n/a: owner must send a real photo of the person and the work in use
R3s.14 pass: real numbers shown: 2019, 6 parts, 2 hrs, all from their listing and flyer
R3s.11 n/a: the owner gave no reason for the price to print; asked in the owner questions, nothing invented
R5b.6 pass: numbered steps 01 to 04 are real steps with a sentence each, not scroll counters; no scroll cues
R3.13 pass: no doubled contact or facts, no two dividers in a row, own photos only
R3a.1 pass: 22 Oct review fixes rendered at 1440x900 and 390x844 touch: the walk in 100 to 130 px stops, kitchen, pots, book, sent page and the phone bar; the walk is 4.2 screens on phones and ends on a full Ready to use panel, no blank band; check-site, fits and motion run
R3r.1 pass: check-site, check-fits and check-motion run on every page of the site after the last edit; readable crashed (see R3e.8)
R3r.2 pass: independent review on 22 Oct (docs/page-review-checklist.md) by a separate reviewer; all findings fixed and re-checked, owner gaps listed in message-to-owner
R3g.12 pass: check-site FLOW: an empty form sends nothing and shows what is missing; a filled form builds the wa.me message with the shown total; sending opens WhatsApp, so nothing reached the owner
R0b.12 n/a: not published, no pages-list preview yet

## 4. Photos and media
R8.1 pass: the two service pictures (kitchen wall, pots) are from different shoots but now framed the same way (same crop, no blue bands) on the home cards and the order page; they are two services, not a set of one product
R8.6 n/a: not a food business: no food, liquid or product hero shots
R8.2 pass: the set is the owner's own photos; no generated or stock images were added
R3p.7 pass: both service panels are shown the same way: a picture, name, price, time, text, button
R3h.12 n/a: no products with a film, picker and tile: nothing sold as an object
R3h.10 n/a: no option picker on the home page; the booking step choices were not changed
R3g.14 pass: the kitchen photo and the pots photo share a light, cool white ground
R3o.1 n/a: not a food business: no food, liquid or product hero shots
R3o.2 n/a: not a food business: no food, liquid or product hero shots
R3o.3 pass: colours look true in the screenshots
R3o.6 pass: one photo per kind; no duplicates; no photos were removed or added
R8.3 pass: the kitchen is a generated setting and not claimed as theirs; no generated person; no text baked in
R8.4 n/a: nothing of this kind on the site
R3c.13 pass: nothing cut off in screenshots at 1440x900 and 390x844 of every new section, and check-fits passed at six sizes
R3c.14 pass: the pots picture is a cut-out on a plain blue ground, looked at: no fringe
R5b.3 pass: no text over a picture except the opening, which has a soft wash; readable could not be run, so by eye at 1440x900 and 390x844
R3e.8 pass: readable (reduced to 1440x900 and 390x844, 8 scroll stops, because the full six sizes crash the renderer on this machine) said every word clear on each page
R3s.24 pass: site MEDIA clean (25 Oct): with motion off the walk is not held; the kitchen and the opening words stay as the first screen and every station card and the Ready panel sit open under it as a list (looked at 1280x800 and 390x844)
R3p.6 pass: check-fits passed on every page at the six sizes
R3o.5 pass: site GLYPH passed

## 5. Prices and savings
R3c.5 pass: no dropdowns: grep select found 0
R3c.6 pass: the button says Book a kashering; the review button says Send on WhatsApp with the total
R3c.7 n/a: no offers on the site
R3j.1 n/a: no guarantee offered by the owner
R3j.2 n/a: no add-on prompt added
R3j.3 n/a: no free taster or quote offered
R3j.4 n/a: no group discounts
R3j.5 n/a: no come-back features
R3j.6 n/a: there are not three packages
R3j.7 pass: no struck-through or invented prices
R3j.8 n/a: no savings shown
R3j.9 n/a: no savings shown
R3j.10 n/a: no savings shown
R3j.11 n/a: no combined service price
R3j.12 n/a: no savings claim
R3.14 pass: prices are loud only where the owner has real prices; both sites have real prices

## 6. Order and booking flow
R3k.7 pass: the booking is four steps with a Step bar, total, Back and browser back; script FLOW passed
R3k.8 n/a: no basket: one booking, no multiple lines
R3k.6 n/a: no basket between pages
R3k.9 pass: check-site SAVE passes on the order pages and the review step POSTs to /api/marketplace/gigs/d2a374fd-.../book with tier_name Kashering Kitchen (or Kashering of Pots, Cutlery & Utensils when only pots), preferred_date, time_slot, guest_name, contact_phone, message (every line and add-on as text); the time of day chips were replaced by the start times of the listing (18:00 to 23:00, Sunday to Friday), because /book needs HH:MM and a quote request is refused (404) on an appointment listing; WhatsApp opens first, carries the tracking link; a failed save still opens WhatsApp
R3.15 pass: booking is the action and Book has the services; contact has hours and area
R7.1 pass: hand build, one direction chosen: the category pattern in CONCEPT.md
R8.5 pass: the main button goes to the booking page, the quickest route; WhatsApp is where it ends
R0b.13 pass: the booking is saved with a tracking link (/bookings/track/...) before WhatsApp opens, and the message carries that link (see R3k.9)
R3l.1 n/a: no family of similar items
R3l.2 n/a: no family of similar items
R3l.3 n/a: no family of similar items
R3l.4 n/a: no three similar items
R3l.6 pass: every picture is of the thing as it is
R3l.7 pass: each service reads alone
R3e.9 pass: site STATE and FLOW passed on every page
R3e.19 pass: the booking ends on the Booking sent page
R3s.16 pass: one question first: the service or the hours
R3s.18 n/a: no unavailable states shown
R3s.25 pass: site FLOW passed: sends nothing when empty and shows what is missing

## 7. Motion
R3f.1 pass: the walk was unchanged and plays held; the new sections use only a fade
R3f.8 n/a: no scroll-tied effect was added or changed; the only scroll-tied scene is the unchanged opening walk
R3f.9 n/a: no list that stacks as an effect
R3f.5 pass: new CSS uses rem and px, no ch widths added
R3f.4 n/a: no motif from the logo
R3g.4 pass: no new motion
R3e.16 pass: no new transitions, no linear easing in the new CSS
R3e.17 n/a: no carousel or sheet
R3e.18 n/a: no ambient video
R3a.2 pass: nothing moves in the new sections
R3a.3 pass: the marks on the kitchen photo are measured and unchanged
R3a.4 pass: the held kitchen walk was unchanged; check-fits passed at 1280x650
R3a.5 pass: reduced motion shows the opening at its first state, then every station as a plain list (looked at, 25 Oct)
R3s.2 pass: site SHIFT passed, images have width and height
R3s.1 pass: site STATE passed
R3s.8 pass: buttons over the opening sit in a white card or solid fill
R3s.10 pass: pictures appear at once
R3i.3 n/a: no scroll readout
R3s.21 pass: site BROKEN passed

## 8. Phone
R3b.6 pass: the phone bar with the price and button appears after the first screen at 390x844
R3f.7 pass: the bar fits at 390x844; 360x640 passed check-fits
R3a.6 pass: site PHONE passed
R3s.22 pass: site TAP passed
R3s.23 pass: site PHONE passed: no sideways scroll
R3t.1 pass: Category: service in CONCEPT.md and the site-category meta on all seven pages; light ground, two named service panels, numbered steps, places list, one dark footer
R3t.2 n/a: category is service
R3t.3 n/a: category is service
R3t.4 pass: every page has the same dark footer: last line, link columns, contact, MyIsraelRental line
R3a.7 pass: phone checks used touch emulation (hasTouch, isMobile) at 390x844
R3a.8 pass: no dot-separated line of items

## 9. Finish
R3r.3 pass: check-rules passes; site, fits and motion run after the last edit
R3r.4 pass: no new Tzvi correction in this rework beyond rule 3t, already in the checklist
R8.7 pass (recorded after the fact, 25 Oct): the one generated image is the kitchen setting; gen/kitchen-brief.md says what is known (Higgsfield soul, prompt not kept, no brief existed before, no photo of theirs to compare with because it is a setting, not their product); looked at assets/kitchen.webp on 25 Oct: empty kitchen, no people, no text
R3h.18 n/a: no film: the walk is drawn in code over one still kitchen picture (checked 26 Oct)
