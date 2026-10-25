# Rules for lechem-emek (docs/rules-checklist.md)

One line per id: `Rx.y pass: <what was looked at or which script passed>`, `Rx.y n/a: <why>`, or `Rx.y fix: <what is wrong>`.
Replace every `todo`. `node scripts/check-rules.mjs scrollcraft/builds/lechem-emek` must exit 0 before anyone is shown the site.


## 1. Facts and words
R0b.1 n/a: Lechem Emek is a practice page (BRIEF.md: no owner, photos generated mockups); there is no owner, record, flyer or listing to trace this to, and nothing is published
R0b.3 n/a: Lechem Emek is a practice page (BRIEF.md: no owner, photos generated mockups); there is no owner, record, flyer or listing to trace this to, and nothing is published; the four prices on the counter (18, 46, 38, 32 shekels) are unchanged from the original brief
R2.1 n/a: Lechem Emek is a practice page (BRIEF.md: no owner, photos generated mockups); there is no owner, record, flyer or listing to trace this to, and nothing is published; no sentence was added in the rework beyond labels (Bread, Pastry, Open, Address, Kosher) reusing the existing hours, address and hechsher lines
R2.2 n/a: Lechem Emek has no owner (practice page), so there is no message-to-owner.md
R2.3 n/a: no owner and so no message to the owner (practice page)
R3.1 n/a: Lechem Emek is a practice page (BRIEF.md: no owner, photos generated mockups); there is no owner, record, flyer or listing to trace this to, and nothing is published; the "since 1998" and "Rabbanut Yerushalayim" lines and, since the 22 Oct review, the phone number in the trust strip (02-555-0141) are invented for the demo and need real proof before any owner is shown this (noted in CONCEPT.md)
R3.2 pass: searched the page for hurry, only N left, limited, countdown: none; "Shabbos orders close Thursday at two" is a standing cut-off, not a counter
R3.3 pass: searched the page for welcome to, look no further, passionate, world-class, top-notch: none
R3.4 pass: scanned the visible text and alt text of the page for exclamation marks and long dashes: none
R3.5 pass: the first screen says "Flour at four. Bread by seven." and the line under it names the bakery and what is on the shelf (challah, babka, rugelach, sourdough are named on the counter)
R3.6 n/a: the page text is English only; the direction button only mirrors the layout (RTL layout of the new trust strip, counter list and visit block checked in a screenshot). Hebrew copy for the practice page was never written and is outside this rework
R3.7 pass: scrolled the page at 1440x900 and 390x844: no FAQ, no reviews, no empty or placeholder section
R3.8 pass: no logo wall, laurel, badge, stars or count on the page (screenshots of every screen)
R3.9 pass: the page repeats the promise in the title, the description and the hero ("Everything on the shelf was baked in this room today")
R3.10 pass: one strength shown, the hechsher line "Kosher, Rabbanut Yerushalayim", in the Good to know block and the footer (practice copy, see R3.1)
R5.1 pass: read every line aloud; the story and counter lines are about this bakery (the starter, Batya, Thursday babka)
R5.2 pass: read every line as the baker printing it on a menu; none teases or jokes
R5.3 pass: labels read as phrases: "Open: Sunday to Thursday, 07:00 to 19:00", "Address: Emek Refaim 41, Jerusalem", "Kosher: Rabbanut Yerushalayim"
R5.4 pass: searched the visible text and alt text for they, them, their: none
R5b.2 pass: the main button reads "Start your order" and opens the basket in the bar, hero, trust strip, counter end, visit, close and footer; "See the counter" is a second, ghost link, not a main button
R5b.8 pass: closing line is "Order for Shabbos before Thursday at two." with "Start your order"; no line starts with "or"
R3.11 pass: read top to bottom after the door: hours and where, the priced counter, how it is made, come in, good to know, order
R3o.4 n/a: the page shows no phone number; there is no owner to say which number takes what
R3e.22 n/a: no owner; the story names Batya as practice copy and no photo of a person exists
R3s.19 pass: the page head has its own title and description and the new site-category meta; the og tags are added at publishing (practice page, not published)
R6.1 pass: the place pattern comes first: hours, address and kosher right after the opening, then the menu list, story, visit
R4.1 pass: nothing is missing on the page that is read as a gap; the counter shows four items only, the full list is asked for in the reply

## 2. Opening
R3g.13 pass: first screen at 1440x900 and 390x844: the oven photograph, headline "Flour at four. Bread by seven.", one short line, two buttons; check-site OPENING passed
R3b.1 pass: what (bakery), where (Emek Refaim), why trust (since 1998 line, hours and kosher strip), what to do (Start your order) within the first three screens
R3b.2 pass: the hechsher sits in the trust strip right after the door and again in Good to know and the footer, three mentions of one fact on one page; not beside the button
R3b.3 pass: the gold "Start your order" is the one solid action per screen; "See the counter" is outlined
R3h.1 pass: check-site OPENING passed; full-screen oven photograph that pushes in on scroll and the clock starts walking
R3n.1 pass: the baker photo (generated practice mockup) fills the whole first screen at both sizes
R3n.2 pass: "the scroll is the morning": the clock in the corner walks from 04:00 to 07:00 as the dark bakery turns to daylight at the door
R3n.3 pass: adding items changes the basket, total and the bar; the page itself changes from night to day at the door (check-motion: no choices on the page)
R3n.4 pass: put the page next to Le Saint Georges and Delice contact sheets: ours has the same trust strip and one warm ground after a stronger opening
R3n.5 pass: "you land in a dark bakery at four and the door opens at seven"
R3g.15 pass: check-fits passed at the six sizes; the opening is a generated practice photograph and is not presented as the owner's
R3h.2 n/a: the opening is a photograph with a scroll push-in, there is no film on this site
R3h.3 n/a: the opening is a photograph with a scroll push-in, there is no film on this site
R3h.5 n/a: the opening is a photograph with a scroll push-in, there is no film on this site
R3h.7 n/a: the opening is a photograph with a scroll push-in, there is no film on this site
R3h.8 n/a: the opening is a photograph with a scroll push-in, there is no film on this site
R3h.11 n/a: the opening is a photograph with a scroll push-in, there is no film on this site
R3h.20 pass: measured 25 Oct at 1440x900 and 390x844 (the check-site SMOOTH/SLOW method, frames looked at at five points): lengthened 25 Oct to data-sc-span 3.1 (was 2.0 screens): 3.1 screens on both, 60 fps with no frame over 50 ms (an earlier laptop run, with other jobs on the machine, had 22%); their oven photo is the ground, whole; the hero photo loads first; check-site clean
R3h.13 n/a: the opening is a photograph with a scroll push-in, there is no film on this site
R3h.14 n/a: the opening is a photograph with a scroll push-in, there is no film on this site
R3h.17 n/a: the opening is a photograph with a scroll push-in, there is no film on this site

## 3. Sections and worlds
R3.12 pass: hero, the counter with price per item, a closing call to action, a footer
R3c.1 pass: references are Le Saint Georges, Delice and Qissa contact sheets in docs/inspo/awwwards-anatomy-2026-10-22/food, cited in CONCEPT.md
R3g.17 pass: effects in CONCEPT.md name their source; the rework added no new effect
R3c.2 pass: looked at the page at laptop width on 25 Oct: it is the brand's limestone, ink and gold with Lora headings (Playfair Display until 25 Oct, changed by Tzvi's decision); the italic accent word in two headings is the practice brand, kept as the brief said
R3g.1 pass: the :root tokens in index.html (Lora, Manrope, Frank Ruhl and Assistant for RTL, night, limestone, cream, gold) match the brand in BRIEF.md except the heading face, changed from Playfair Display to Lora on 25 Oct (Tzvi)
R3g.3 pass: gold is the button fill and the italic words in headings and item names; prices are in the ink colour (.item__price set to var(--sc-ink))
R3g.7 pass: one closing signature, the giant footer line
R3g.11 pass: Lora (Latin headings, Google OFL, paired with Frank Ruhl Libre in RTL), Manrope, Frank Ruhl Libre and Assistant; computed h1/h2 font Lora, loaded
R3p.3 pass: node scripts/check-fingerprints.mjs run 25 Oct prints "lechem-emek: different from all 12 other pages"; after Tzvi's 25 Oct decision: headings Lora (were Playfair Display, as Blazin'), prices on a dotted line (P12, was P8), effects added to scrollcraft/fingerprints.json
R3p.5 pass: the clock that walks from 04:00 to 07:00 is the touch (CONCEPT.md touch line)
R3q.1 pass: node scripts/check-concept.mjs reports ready (25 Oct), every part including Not alike
R5a.7 pass: one signature (the morning) and one peak (the door at seven); the ending is the order button
R9.1 pass: the morning uses the practice bakery photographs that exist; no photograph was invented for the rework
R3f.2 pass: effect budget in CONCEPT.md: sunrise, push-in, reveal; frames of the hero, door and counter captured in this rework
R3m.1 n/a: hand-built practice page outside the page-builder platform; no data-mir attributes (grep finds none)
R3m.3 n/a: the same, no owner-editable text boxes
R3k.1 n/a: Lechem Emek is one page with a basket sheet; the menu and order are one place already
R3k.2 n/a: one page; its bar carries name, three links, the one button with a basket count
R3k.4 n/a: single page, no shared site.css or site.js
R8a.1 pass: no 21st or demo components; no external script or image hosts other than Google Fonts
R3b.4 pass: for a place, hours and address come first after the door (trust strip), before the description
R3c.3 pass: Shabbos cut-off sits beside the counter button and the close button
R3c.8 n/a: no owner to tell us
R3e.10 pass: check-site ALIGN passed; item name largest, price next to it, note lighter
R3e.14 pass: Manrope body in up to three weights and Lora headings; sizes follow the engine scale
R3c.9 pass: one pill radius for buttons, 14 px for the framed photos, round item photos; no icon library
R3s.4 pass: check-site ALIGN passed
R3s.6 pass: check-site ALIGN passed; the Add buttons share one height and corner
R3s.7 pass: buttons in sentence case; body line height 1.5 or more from the kit
R3s.9 pass: gold means action everywhere; the hechsher tick is green in the one place it appears
R3s.12 n/a: no maker to photograph (practice page); the hands photograph is the generated stand-in
R3s.14 n/a: the owner gave no numbers; none are shown
R3s.11 pass: each item has its one line (six strands, laminated Thursday, twelve, one starter) beside the price
R5b.6 pass: no scroll cue or counters; the clock is a true readout (R3i.3)
R3.13 pass: hours and address appear in the trust strip, Good to know and the footer; the same fact in three standard places, no doubled block
R3a.1 pass: rendered at 1440x900 and 390x844 (every section), RTL once, the six sizes by check-fits and cutoff, reduced motion by check-site MEDIA
R3r.1 pass: review pass of 22 Oct: check-site, check-fits, check-motion, readable, cutoff and clipped ran on the only page; stepped screenshots every 100 px at 1440x900, 390x844 and 360x640 with document scrollWidth equal to the viewport at every stop; the basket walked to the WhatsApp message at 390 and 1440 with external requests blocked; the clipped reports are named in R3c.13
R3r.2 pass: independent review on 22 Oct (docs/page-review-checklist.md) by a separate reviewer; findings fixed and re-checked
R3g.12 pass: Add on the counter fills the basket sheet and total (tested through check-site STATE); the WhatsApp send is not made
R0b.12 n/a: the site is not published

## 4. Photos and media
R8.1 pass: the four round counter photos come from one generated bakery set, same light and background on one contact sheet
R8.6 n/a: no new product picture was made in this pass; the current four item photos stay and hero shots of challah, babka, rugelach and sourdough are listed in the reply
R8.2 pass: every picture is from the one generated bakery set made on 6 Sep (BRIEF.md)
R3p.7 pass: all four items are the same round photo and row; no pointing changes a photo
R3h.12 pass: each item has one photo used in the counter and the basket
R3h.10 n/a: the counter has no option switch; each item is one fixed photo
R3g.14 pass: all images on one sheet: warm amber grade, from one generated set
R3o.1 n/a: no food in motion beyond a still photograph with a push-in
R3o.2 n/a: no generated liquid
R3o.3 pass: bread and pastry colours look true on cream
R3o.6 pass: one photo per item from the generated set
R8.3 pass: the generated bakery set shows items the practice bakery lists, no person shown as staff, no text baked in; hands photograph is a stand-in and is labelled so in BRIEF.md
R8.4 n/a: no moving real material (steam is baked into the still)
R3c.13 pass: check-fits and cutoff passed at the sizes (cutoff at nine sizes, 22 Oct); clipped reports only held stages sliding under the fixed bar at scroll 0 and at a pin entry (1000x700 at 2148), the same code as before the rework (checker limit)
R3c.14 n/a: the page has no cut-outs
R5b.3 pass: the hero and door words sit on the soft edge scrims; readable passes except the mid-fade sample named in R3e.8
R3e.8 pass: readable ran on the page: one report remains, the hero "Start your order" at 3.5:1 at 1280x650 and 390x844 stop 1, where the hero copy is fading out (opacity near 0.7); at every other stop it passes
R3s.24 pass: check-site MEDIA passed; the largest asset is 507 KB
R3p.6 pass: check-fits passed at the six sizes
R3o.5 pass: check-site GLYPH passed (the shekel sign renders)

## 5. Prices and savings
R3c.5 pass: no select; items are rows with Add
R3c.6 pass: buttons read "Start your order", "Add, 18 shekels"; none says Submit or Buy now
R3c.7 n/a: no offer is shown on this page
R3j.1 n/a: no guarantee, add-on, taster, discount, saving, struck price or come-back feature is shown on the page
R3j.2 n/a: no add-on is offered
R3j.3 n/a: no guarantee, add-on, taster, discount, saving, struck price or come-back feature is shown on the page
R3j.4 n/a: no guarantee, add-on, taster, discount, saving, struck price or come-back feature is shown on the page
R3j.5 n/a: no guarantee, add-on, taster, discount, saving, struck price or come-back feature is shown on the page
R3j.6 n/a: no guarantee, add-on, taster, discount, saving, struck price or come-back feature is shown on the page
R3j.7 n/a: no guarantee, add-on, taster, discount, saving, struck price or come-back feature is shown on the page
R3j.8 n/a: no guarantee, add-on, taster, discount, saving, struck price or come-back feature is shown on the page
R3j.9 n/a: no guarantee, add-on, taster, discount, saving, struck price or come-back feature is shown on the page
R3j.10 n/a: no guarantee, add-on, taster, discount, saving, struck price or come-back feature is shown on the page
R3j.11 n/a: no guarantee, add-on, taster, discount, saving, struck price or come-back feature is shown on the page
R3j.12 n/a: no guarantee, add-on, taster, discount, saving, struck price or come-back feature is shown on the page
R3.14 pass: prices are shown at normal size beside each item

## 6. Order and booking flow
R3k.7 pass: the basket sheet has Step 1 of 3, 2 of 3, 3 of 3 with the total in its foot
R3k.8 pass: every basket line has a remove button in the sheet
R3k.6 pass: Add on the counter opens the basket with the item in it
R3.15 pass: order and visit both have a place: counter and basket, hours and address
R7.1 pass: hand build, one direction chosen: night opening then one warm ground; CONCEPT.md says why
R8.5 pass: every main button opens the basket sheet, the quickest route to an order
R0b.13 n/a: Lechem Emek is a practice page (BRIEF.md: no owner, photos generated mockups); there is no owner, record, flyer or listing to trace this to, and nothing is published; the WhatsApp send has no platform order or tracking link behind it
R3l.1 n/a: no owner to ask (practice page)
R3l.2 n/a: each item is sold as listed
R3l.3 n/a: no item has options
R3l.4 pass: four items in two groups, each row the same fields
R3l.6 pass: the practice photos show the items as listed
R3l.7 pass: each row says what it is, how, and the price
R3e.9 pass: check-site STATE and FLOW passed
R3e.19 pass: the sheet ends after the WhatsApp send with a toast; the "added" toast now sits at the top of a phone screen, under the bar, so it no longer covers the order bar text (checked at 390x844); the WhatsApp message gives the day as "Sunday 25 October at 10:00"
R3s.16 pass: the order starts with the basket then pickup or delivery
R3s.18 n/a: there is no unavailable state
R3s.25 pass: the sheet sends nothing empty and says what is missing (check-site FLOW)

## 7. Motion
R3f.1 pass: the sunrise runs under the pinned hero, the night lines and the door; the night lines are now one flow section (#bake) of four stacked lines instead of a pinned act and a separate silent section, so no stop is blank
R3f.8 n/a: no scroll-tied effect outside the held acts
R3f.9 n/a: no such list
R3f.5 pass: replaced the 12 ch widths in index.html with em; grep finds no ch and no background-clip
R3f.4 n/a: no motif from the logo
R3g.4 pass: motions reveal or confirm: push-in, sunrise, reveal
R3e.16 pass: grep finds no linear easing
R3e.17 n/a: no carousel (the horizontal counter rail was replaced by a list)
R3e.18 n/a: no ambient background video
R3a.2 pass: looked at mid-transition frames of the door iris
R3a.3 n/a: no label placed on a spot in a photo
R3a.4 pass: cutoff clean at all nine sizes after the night lines became one flow section (22 Oct review): every line is on screen as it is passed, none is cued
R3a.5 pass: reduced motion shows every line (check-site MEDIA passed)
R3s.2 pass: check-site SHIFT passed; check-motion passed
R3s.1 pass: check-site STATE passed
R3s.8 pass: the hero buttons are solid or ghost over a soft shade
R3s.10 n/a: same
R3i.3 pass: the 04:00 to 07:00 clock is the readout and shows only the morning of the bake
R3s.21 pass: check-site BROKEN found no errors

## 8. Phone
R3b.6 pass: the phone bar shows the basket total and View basket once an item is added; the header carries Start your order with count at 390x844
R3f.7 pass: the bar fits at 360 px by check-site PHONE
R3a.6 pass: check-site PHONE passed
R3s.22 pass: check-site TAP passed
R3s.23 pass: check-site PHONE passed
R3t.1 pass: site-category place on the page and in CONCEPT.md; compared with Le Saint Georges, Delice and Qissa: night opening then one warm ground, trust strip, priced list with round photos, framed pictures
R3t.2 n/a: the category is place, not food-shop
R3t.3 n/a: the category is place, not trainer
R3t.4 pass: one page; the footer has the big line, the button, four columns of links, address, hours, kosher and the MyIsraelRental line
R3a.7 pass: same touch emulation at 390x844
R3a.8 n/a: no line of dot-separated items

## 9. Finish
R3r.3 pass: check-rules passed after the last edit; every script was re-run after the last change to the page
R3r.4 pass: the same corrections are in rules-checklist.md
R8.7 pass (recorded after the fact): the ten photographs were generated on 6 Sep (Nano Banana Pro, one batch) before this rule; gen/photos-brief.md records what is known (prompts not kept) and gen/photos-sheet.jpg is the set looked at on 25 Oct; there is no owner photo to compare with because this is a practice page with no owner, so the compare step cannot apply until a real bakery uses it
R3k.9 n/a: practice page with no business, no listing and no order form on MyIsraelRental to POST to (R0b.1); its basket sheet opens wa.me with no number and has no POST (grep of index.html on 25 Oct), so check-site SAVE would fail; this must be added when a real bakery takes the page, before it is published
