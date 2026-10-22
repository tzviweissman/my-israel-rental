# Rules for noa-levi-home-styling (docs/rules-checklist.md)

One line per id: `Rx.y pass: <what was looked at or which script passed>`, `Rx.y n/a: <why>`, or `Rx.y fix: <what is wrong>`.
Replace every `todo`. `node scripts/check-rules.mjs scrollcraft/builds/noa-levi-home-styling` must exit 0 before anyone is shown the site.


## 1. Facts and words
R0b.1 n/a: not published: local build only; the slug is set at publish from the live record
R0b.3 pass: the one price, 160 shekels an hour, against her listing
R2.1 pass: read every sentence of every page and traced each fact to the record, listing or flyer; no counts or reviews were invented
R2.2 pass: read message-to-noa.md: asks only about her photos, accessories, hours, areas, number, reviews
R2.3 pass: message-to-noa.md asks for the questions clients ask and for photos; FAQ examples to add when she answers
R3.1 pass: searched every page for kosher, best, guarantee, insured, licensed, 24/7, delivery: only claims from their own flyer and listing
R3.2 pass: searched every page for hurry, only N left, today only, limited, countdown: none
R3.3 pass: searched every page for welcome to, one-stop, passionate, world-class, quality you can trust: none
R3.4 pass: counted exclamation marks and long dashes in visible text and alt text of every page by script: 0 and 0
R3.5 pass: first screen says "We organize your home", her flyer line
R3.6 n/a: the site is English only; no Hebrew version was built or asked for
R3.7 pass: scrolled every page: no FAQ, reviews, empty or placeholder sections
R3.8 pass: scanned every page: no logo walls, laurels, stars, invented badges or intro prices
R3.9 pass: first screen against her flyer line "We organize your home. You gain peace of mind."
R3.10 pass: one strength: the result is easy to keep, in her words
R5.1 pass: read every line as the owner: each is only about their own work
R5.2 pass: read every line: plain, no jokes or slang
R5.3 pass: short labels read as full phrases
R5.4 pass: searched visible text of every page for they, them, their: none about the business itself
R5b.2 pass: the main button is "Book a session" to book.html in the bar, opening, closing band and phone bar of all three pages
R5b.8 pass: closing line "A home you love, in order." names the result
R3.11 pass: home order: opening, the rooms, how we work and services, before and after, the price, then book; the price is before the form
R3o.4 pass: contact lines are labelled "WhatsApp or call" and "Email" on the home closing band and the contact page; question 6 in message-to-noa.md asks if the number takes WhatsApp
R3e.22 n/a: owner must send a photo of Noa herself and photos of home styling and personal shopping
R3s.19 pass: viewed the head of every page: own title, description, og:title, og:description and og:image
R6.1 pass: service playbook: says what and where first, named services with prices, a places list, one button
R4.1 pass: no missing data shown as present; styling and personal shopping show no picture and are listed for the owner

## 2. Opening
R3g.13 pass: 1440x900 first screen: picture, headline of 4 words "We organize your home.", one short line, one button; the place label was removed
R3b.1 pass: first screen says what and the button; the place is in the phone bar and footer
R3b.2 pass: price 160 shekels an hour sits in the bar beside the button
R3b.3 pass: one solid action per screen: the bar button and phone bar repeat the same action
R3h.1 pass: site OPENING passed: the drawer pieces slide into place as you scroll
R3n.1 pass: her drawer photo is the largest picture of the first screen at both sizes, at most 1.2x its size
R3n.2 pass: her tidy drawer pieces fall into her messy drawer
R3n.3 pass: room choice swaps both photos; hours on the book page fill the tray and set the total; check-motion passed
R3n.4 pass: next to Studio Dado and LPAS: ours opens on her own real before photo, plainer than a film but real
R3n.5 pass: "you land on a messy drawer and its tidy pieces slide into place as you scroll"
R3g.15 pass: check-fits passed; her photos are real, used at most 1.2x
R3h.2 n/a: no film in this site: the opening is built in code from their own photos
R3h.3 n/a: no film in this site: the opening is built in code from their own photos
R3h.5 n/a: no film in this site: the opening is built in code from their own photos
R3h.7 n/a: no film in this site: the opening is built in code from their own photos
R3h.8 n/a: no film in this site: the opening is built in code from their own photos
R3h.11 n/a: no film or generated still set added in this rework; no new generation
R3h.13 n/a: no film in this site: the opening is built in code from their own photos
R3h.14 n/a: no film in this site: the opening is built in code from their own photos
R3h.17 n/a: no film in this site: the opening is built in code from their own photos

## 3. Sections and worlds
R3.12 pass: home page: a hero, services and rooms, a closing band with the button and price
R3c.1 pass: CONCEPT.md cites the services study pictures (LPAS, Dado, Kononenko) with their paths in the Rework section
R3g.17 pass: every new piece (room tiles from LPAS, white ground from Dado, numbered list from Kononenko) is named in CONCEPT.md with its study sheet; nothing reused from another page
R3c.2 pass: cream, green and terracotta are her brand; rooms as three different colour tiles, not three identical cards
R3g.1 pass: style sheet in CONCEPT.md and site.css; the new sections use the existing tokens
R3g.3 pass: accent only on buttons; the price on the tape is in ink
R3g.7 pass: one closing signature: the giant "Noa Levi"
R3g.11 pass: Newsreader, Hanken Grotesk and Heebo, unchanged
R3p.3 pass: check-fingerprints: different from all 9 other pages
R3p.5 pass: touch: the hours fill a storage tray on the book page
R3q.1 pass: CONCEPT.md complete, Category line added
R5a.7 pass: one signature (the drawer sorting)
R9.1 pass: the signature uses their own photos
R3f.2 pass: effect budget unchanged by this rework; no new motion added
R3m.1 n/a: the gallery and catalog template markers belong to the automatic page builder; this is a hand build
R3m.3 n/a: no owner-editable places in this hand build
R3k.1 pass: pages: home, Book, Contact; the booking is one page
R3k.2 pass: one bar on all three pages, folding to Menu on a phone
R3k.4 pass: shared site.css and site.js serve the pages
R8a.1 pass: no 21st components were added in this rework; no external scripts, only Google fonts
R3b.4 pass: six real photos, facts carry the rest: price, hours, area
R3c.3 pass: the worry (accessories) is stated beside the price
R3c.8 pass: not told by the owner: asked in message-to-noa.md
R3e.10 pass: service panels and room tiles read name first, then the price or one line; site ALIGN passed
R3e.14 pass: one body family; new sections use existing sizes
R3c.9 pass: one corner radius and shadow in the new sections, no gradients or decorative arrows
R3s.4 pass: site ALIGN passed on every page
R3s.6 pass: site ALIGN passed; the buttons share one style
R3s.7 pass: sentence case buttons, pale dividers, 1.45 to 1.6 line height in the new text
R3s.9 pass: one colour per meaning; no kosher tag in this site
R3s.12 pass: her real before and after photos come right after the services
R3s.14 pass: one number shown big: 160 shekels an hour
R3s.11 n/a: the owner gave no reason for the price to print; asked in the owner questions, nothing invented
R5b.6 pass: numbered steps are real steps; no scroll cues
R3.13 pass: no doubled contact or facts, no two dividers in a row, own photos only
R3a.1 pass: rendered at 1440x900, 1280x650 and 390x844, normal and reduced motion (check-site), every new screen looked at
R3r.1 pass: check-site, check-fits and check-motion run on every page of the site after the last edit; readable crashed (see R3e.8)
R3r.2 n/a: the independent review of 3r.2 is the coordinator's second pass; this builder did not review its own work against page-review-checklist.md
R3g.12 pass: check-site FLOW: an empty form sends nothing and shows what is missing; a filled form builds the wa.me message with the shown total; sending opens WhatsApp, so nothing reached the owner
R0b.12 n/a: not published, no pages-list preview yet

## 4. Photos and media
R8.1 n/a: owner must send matching photos taken the same way; the three rooms are her real phone photos with different light
R8.6 n/a: not a food business: no food, liquid or product hero shots
R8.2 pass: the set is the owner's own photos; no generated or stock images were added
R3p.7 pass: every room tile is shown the same way
R3h.12 n/a: no products with a film, picker and tile: nothing sold as an object
R3h.10 pass: the room picker changes both photos and words (check-motion passed)
R3g.14 pass: her photos share a warm natural light
R3o.1 n/a: not a food business: no food, liquid or product hero shots
R3o.2 n/a: not a food business: no food, liquid or product hero shots
R3o.3 pass: colours look true in the screenshots
R3o.6 pass: one photo per kind; no duplicates; no photos were removed or added
R8.3 pass: no generated media: all photos hers
R8.4 n/a: nothing of this kind on the site
R3c.13 pass: nothing cut off in screenshots at 1440x900 and 390x844 of every new section, and check-fits passed at six sizes
R3c.14 n/a: nothing of this kind on the site
R5b.3 pass: no text over a picture except the opening, which has a soft wash; readable could not be run, so by eye at 1440x900 and 390x844
R3e.8 pass: readable (reduced to 1440x900 and 390x844, 8 scroll stops, because the full six sizes crash the renderer on this machine) said every word clear on each page
R3s.24 pass: site MEDIA passed
R3p.6 pass: check-fits passed on every page at the six sizes
R3o.5 pass: site GLYPH passed

## 5. Prices and savings
R3c.5 pass: no dropdowns: grep select found 0
R3c.6 pass: the buttons say Book a session; the send button names what happens
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
R3k.7 pass: the booking has steps with a total beside them; script FLOW passed
R3k.8 n/a: no basket: one booking, no multiple lines
R3k.6 n/a: no basket between pages
R3.15 pass: booking is the action and Book has the services; contact has hours and area
R7.1 pass: hand build, one direction chosen: the category pattern in CONCEPT.md
R8.5 pass: the main button goes to the booking page; WhatsApp is the quiet alternative
R0b.13 n/a: no tracking link: the booking is sent as a written WhatsApp message
R3l.1 n/a: no family of similar items
R3l.2 n/a: no family of similar items
R3l.3 n/a: no family of similar items
R3l.4 n/a: no three similar items
R3l.6 pass: every picture is of the thing as it is
R3l.7 pass: each service reads alone
R3e.9 pass: site STATE and FLOW passed on every page
R3e.19 pass: the booking ends in a confirmation line before WhatsApp
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
R3a.3 n/a: no labels placed on spots in a photo
R3a.4 pass: the held opening was unchanged; check-fits passed at 1280x650
R3a.5 pass: reduced motion shows the opening at its first state (looked at)
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
R3t.1 pass: Category: service in CONCEPT.md and the site-category meta on all three pages; light ground, rooms as flat colour tiles with a photo each, numbered process, one dark close
R3t.2 n/a: category is service
R3t.3 n/a: category is service
R3t.4 pass: the three pages share the dark close and one footer with Pages, Where and Contact columns
R3a.7 pass: phone checks used touch emulation (hasTouch, isMobile) at 390x844
R3a.8 pass: no dot-separated line of items

## 9. Finish
R3r.3 pass: check-rules passes; site, fits and motion run after the last edit
R3r.4 pass: no new Tzvi correction in this rework beyond rule 3t, already in the checklist

