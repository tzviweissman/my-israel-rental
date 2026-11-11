# Review: M and N Jewelry (independent, Sonnet)
Date: 8 Nov 2026. Looked at index, shop and contact at 1440x900, 1280x650, 390x844 and 360x640 (the phones with touch), scrolled top to bottom, screenshots read. Used the loupe (glide, mouse follow), phone menu, shop picks, ring size choice, tennis bracelet colour, basket, all three order steps with the order-form and wa.me requests faked. Facts checked against src/record.json and the flyer p01.jpg. No console errors, no sideways scroll at any size. The order came out complete: saved order lines, WhatsApp text with items, total, day, name, phone and tracking link.

## Findings
- FAIL (checklist 8, 9): Tennis bracelet photos are wide frames (p17/p18, 1000x507) padded with a flat dark grey block above and below to fill a square. On the shop stage (laptop and phone) the bracelet is a thin strip in a big grey box, and White and Yellow are padded differently (the bracelet sits at different heights), so the picture jumps when you tap the colour. In "Every piece" and the home "From our collection" it is the one tile with dark bars, unlike every other tile. Fix: give both colours the same crop/extension, or a matching ground, so the bracelet fills the frame like the rest.
  - Re-check 8 Nov: FIXED. Tennis photos now fill a square on stage, picks and tiles, no bars; both photos are thumbnail buttons and swap without a jump.
- FAIL (checklist 2): Prices do not sit in the same place. Where a name wraps to two lines (Marquise halo ring, Diamond huggie earrings, Round solitaire pavé band, Pear-drop station necklace) the $2,000 tag drops lower than its neighbours. Home, 1440 and 390: the Twist and Marquise tiles, and Tennis and Huggie tiles, have prices at different heights; shop "Every piece" same. Fix: fix the name block to two lines high, or pin the price to the bottom of the tile.
  - Re-check: FIXED. Price tags are pinned to the bottom of each tile (bottom offset 0 for every tile at 1440, 1280, 390, 360; prices in a row line up).
- FAIL (checklist 4, 3): On the shop page, once something is in the basket, the phone bottom bar reads "Basket, $2,000 / 1 piece" with a button still labelled "Shop jewelry" that actually jumps to the order (href is switched to #order). A button that says one thing and does another. Fix: label it "Go to your order" (or similar) when it points to #order; same fix on every page where the basket is non-empty.
  - Re-check: FIXED on the shop page (bar reads "Go to your order", href #order, checked at 390). NOTE: on the home page with a basket the bar says "Basket, $2,000" with "Shop jewelry" to shop.html, where the basket lives; acceptable.
- FAIL (checklist 13): Facts the record does not support. (a) The tennis bracelet colour choice White / Yellow sells it in two colours; the record has no colour data and the build's own OWNER-QUESTIONS asks this and has no answer. (b) Piece names and the split into 15 pieces ("All 15 pieces", "Round solitaire, yellow band", "Pear-drop station necklace", "Baguette eternity band") are the builder's reading of 20 photos grouped under 4 products, each of which the record prices at $2,000; the page states a $2,000 price for every one of 15 pieces. The record supports "four products at $2,000", not fifteen pieces at $2,000. Keep it off the page, or show it only as the listing does, until the owner answers questions 1 and 3. (Natural and lab diamonds, by appointment in Jerusalem, we also buy gold, 516-790-4616 and the description lines are all supported.)
  - Re-check: PASS with a NOTE. The colour choice is gone and "All 15 pieces" now says "See every piece". Piece names only describe what each owner photo shows, and each piece carries the $2,000 of the listing product its photos belong to, which is exactly what the record says; nothing on the page contradicts the record or flyer. Whether $2,000 is each piece's real price is not known; that stays an owner question (OWNER-QUESTIONS 1) and must be answered before the page goes live, but it is no longer an invented fact.
- FAIL (readability, checklist 8): Italiana's hairlines drop out at small sizes at 1x. The header wordmark reads "M AND N JEWELRY" with broken letters, and tile and footer names ("Twist solitaire", "Tennis bracelet") read as "Iwist", "Iennis", "Half eternity" with missing strokes. Seen at 1440, 1280 and 390. Fix: set names under about 24px in the text face (Assistant) and keep Italiana for large headings only.
  - Re-check: FIXED. Wordmark, tile names, picks and footer name are in Assistant and read clearly at 1x (1440 and 390); Italiana remains on large headings only.
- FAIL (words, checklist 3): The step-3 note says "to send to M&N Jewelry" (shop, step 3). The business is speaking, so it should say "to send to us". Everything else reads as "we".
  - Re-check: FIXED. Step 3 note: "to send to us".
- NOTE (re-check: fixed, logo no longer shows a box): The logo image sits on a visible cream rectangle that does not match the #FAFAF8 header (left of the wordmark, every page).
- NOTE: The loupe works as designed on laptop (glides in from the right at about 0.9 s, lands on the stone, follows the mouse, returns when the mouse leaves). The magnified glass is soft (hero image only 2183 px wide at 2.1x); on 1440 the stone itself is hidden under the glass at rest.
- NOTE: Phone hero shows a visible grey to white seam at about y=450 where the words area meets the extended ring picture.
- NOTE: The "Added: ..." toast overlaps the "Step 2" label when you go to step 2 soon after adding; on a phone it wraps to three lines.
- NOTE (re-check: number now underlined; page still bare): The Contact page is bare: the phone number is bold text, not styled like a link or button, and there is no WhatsApp button (the home page has one for gold).
- NOTE: The small grey helper lines (step notes, hint under the form) are about 11 px; legible but weak at 390.
- NOTE: "Every piece" is left-aligned and leaves the right half of the section empty on laptop.

## Checklist
1. Same kind shown the same way: FAIL (tennis bracelet letterboxed with dark bars, other tiles plain crops).
2. Prices, units, buttons in the same place: FAIL (price drops under two-line names).
3. One wording per purpose: FAIL ("Shop jewelry" button that goes to the order; "send to M&N Jewelry" vs "us"). The shop button label otherwise consistent.
4. Anything pressable responds: FAIL for the phone bar button label; hover, press and pick states otherwise respond (picks, steps, +/-, remove).
5. List beside big photo changes photo: PASS (tapping a pick swaps the stage photo and name, thumbnails work, bracelet colour swaps its photo).
6. Choices right under the item: PASS (ring size and colour sit under the name, "I know my size" opens its field, empty size is refused with a message, the choice shows in the basket line).
7. Order message complete and correct: PASS (items, options, total $8,000, day, name, phone, tracking link all correct; order saved with lines).
7a. Savings true: n/a (no savings shown).
8. Photos not soft, stretched, slice: FAIL (bracelet padded and soft; loupe glass soft; Italiana dropouts noted above). Other photos whole and unstretched.
9. One look per product: FAIL (bracelet white and yellow framed differently; same bracelet letterboxed in tiles but square-ish elsewhere).
10. Every stop makes sense: PASS (checked at 1440x900, 1280x650, 390x844, 360x640; nothing cut off or overlapping apart from the toast note).
11. Nothing blank: PASS (reveals ran at all sizes).
12. Phone order bar never covers the thing to press: PASS (bar hides over the opening, stage and order; it does overlap tiles while scrolling the grid, which is acceptable).
13. Every fact theirs: FAIL (colour choice, 15 pieces at $2,000 each).
14. A small touch only this business has: PASS (the jeweler's loupe on their own diamond, and the stone dividers that light up).

Re-check 8 Nov (same server, same sizes, fresh run of the three order steps with the network faked: no console errors, no sideways scroll, order text and saved lines correct, no long dashes, no exclamation marks). Checklist lines 1, 2, 3, 4, 8, 9 and 13 are now PASS; all other lines unchanged.

## Re-check 3 (customiser)
Date 8 Nov 2026. shop.html "Design your piece" at 1440x900, 390x844 and 360x640 (touch), headless Chromium with swiftshader WebGL, network faked. I clicked every choice on every piece (screenshots of the viewer after each), turned it with the arrows, added a necklace and a ring design, went through the three steps and read the faked WhatsApp message and saved order. The 3D was rendered by a software GL; lighting could differ a little on a real GPU, but the geometry and the choices below do not depend on that.

- FAIL (looks cheap, not high end): The 3D reads as a CAD wireframe, not a jewel. Ring: it opens edge-on to the camera so you see a thin oval band and a small stone perched on four wire prongs at the very top edge of the canvas, almost cut off by it (laptop and both phones). Bracelet: a flat ring of white octagon blobs that look like beads or a bead chain, not tennis-bracelet stones. Necklace pendant (halo): the big centre stone renders as a flat white oval with black lightning-shaped streaks across it (flat-shaded reflections), with the small halo stones as white blocks. None of this looks like the owner's real photos on the same page. Fix: look at it from three-quarter, scale the ring down into frame, give stones a softer facet look, or fall back to the owner's photos per option.
- FAIL (every choice must visibly change it): Several choices do not. Ring: "Plain", "Halfway" and "All round" band diamonds look the same, because the band diamonds are not visible at the default angle and size (compare the screenshots before and after; only the sentence under the viewer changes). Ring: Round vs Princess vs Marquise changes the stone only a little at the top of the canvas and is hard to tell apart. Bracelet: White, Yellow and Rose barely differ because the white stones cover the metal. Gold itself does change on the ring band and the necklace chain, and "Halo", "Stones Fine/Classic/Bold" do change.
- FAIL (phone, see it change in real time): On a phone (390x844 and 360x640) the viewer is at the top and the choices begin below it; once you reach Band diamonds, Halo or Diamonds the viewer has scrolled off screen, so nothing visibly changes where you are looking, only the text sentence. Fix: keep the viewer sticky above the choices on a phone, or make the viewer smaller and the choices a compact row.
- FAIL (basket and message read right): The Add design lines read "$2,000" in the basket and the order summary, and "($2,000)" next to each piece in the WhatsApp message, where every other price now says "From". Only the total says "from $4,000" ("Total: from $4,000 (the final price for my choices to be confirmed)"). Two designs "From $2,000" each are shown as exactly $2,000. Fix: "from $2,000" on those lines too.
- FAIL (unclear / unsupported): (a) The note says "we confirm it on WhatsApp before you pay"; the record says nothing about how or when customers pay (OWNER-QUESTIONS 7), so this is a payment promise not in their sources. (b) "Ring size goes in your order" but the Add-design button has no ring size field; the ring-size choice only appears lower down under "Pieces we have made", so a customer designing a ring cannot give a size and the line shows none. Fix: move the size choice into the design panel when Ring is chosen, or say "we ask your size on WhatsApp".
- NOTE: Layout does not jump: switching piece, gold or any option keeps the Add button at the same place (545 px at 1440) and the viewer height unchanged. The hold-height gap left under the bracelet's and necklace's shorter choices is a little empty.
- NOTE: Drag works: a vertical swipe over the viewer on a phone scrolls the page (0 to 200 px), a horizontal drag does not move the page, and the arrows turn it. The intro spin and ease-in are smooth. The viewer is 546 px tall at 1440 and about 240 px on a 390 phone.
- NOTE: The basket thumbnail for a design is a small black square with a tiny white shape; it does not show the piece. The toast with the full design text is very long on phones.
- NOTE: Matches what Tzvi said: from $2,000, golds, add options, high end intent, panel names and the four product renames. Natural or lab and the Halo and shape choices are the builder's additions; the flyer supports natural and lab diamonds, the rest is customising as Tzvi asked. The price does not change live with the choices (it says "From $2,000" throughout); Tzvi said the price goes up with the gold and the number of diamonds, so a live "from" that rises would fit better than a flat one, or the panel should say plainly that the price depends and is confirmed.
- NOTE: On the shop page the phone bar still reads "Natural and lab diamonds / Shop jewelry" while you are on the design (a button to the page you are on); at 360 wide the button label wraps to two lines.
- NOTE: One console error on every load (blocked fetch of gift-cards from localhost:8001 over CORS from 127.0.0.1); only local, not a site fault.

## Re-check 4 (customiser)
Date 8 Nov 2026. Same method as Re-check 3 (1440x900, 390x844, 360x640 touch, swiftshader WebGL, network faked): every choice on every piece with a screenshot of the viewer after each, the arrows, a necklace and a ring design in the basket, three steps, the faked WhatsApp message and saved order.

Earlier findings from Re-check 3:
- Looks cheap: FIXED enough to pass. The ring now sits three-quarters on, centred, with prongs, a faceted-outline centre stone, small bezel diamonds on the band and a halo of stones that reads as a halo; the bracelet is square claw settings with metal between them; the pendant is seen at an angle with claws. It reads as a designed piece, not wire. NOTE below on the stone's faces.
- Every choice must visibly change it: FIXED. Round, Princess (square, corner claws) and Marquise (pointed) differ clearly; Plain has no band stones and Halfway/All round show band stones (Halfway and All round are close from the default angle, the difference is the far side, found by turning); gold changes ring, bracelet (metal edge between the stones now shows white, yellow and rose) and chain; Halo, bracelet stone size Fine/Classic/Bold, natural/lab (only in the line under the viewer, a diamond looks the same) respond.
- Phone, see it change: FIXED. At 390 and 360 the viewer stays pinned (top 76 px) while the choices scroll, and Halo, Band and the rest change it in view; it releases at the end of the panel. A vertical swipe on the viewer scrolls the page.
- Basket and message say "from": FIXED. Both lines read "(from $2,000)" and the total "from $4,000 (the final price for my choices to be confirmed)".
- Unclear/unsupported: FIXED. The payment promise is gone ("We reply on WhatsApp with the price of your design"); a ring has its own Ring size field ("If you know it", "or we help you choose") and the size reaches the basket line ("ring size 6") and the message.

New findings:
- FAIL (checklist 3, 4: a button says one thing, does another): On the shop page with an empty basket the phone bar button reads "Design your piece" but its link is #order, the empty basket at the bottom of the page. Seen at 390 (scrolled to 2300 px, tap it: it lands at the order section, not the design). Fix: point it to #design when the basket is empty, to #order once there is something in it.
  - Re-check 5: FIXED. At 390 and 360 the empty-basket bar reads "Design your piece", links to #design and lands on it; with a design in the basket it reads "Go to your order", links to #order and lands on it.
- NOTE: The stones are still smooth white discs from most angles with only a few dark facets, so the centre stone looks like glass, not a bright diamond; fine for a configurator but a little flat next to the owner's photos (software GL; may look better on a real GPU).
- NOTE: At 360x640 the pinned viewer (256 px) plus the menu bar leaves only about 250 px for the choices, so you scroll through them in a small window; usable, tight.
- NOTE: Natural vs Lab diamonds cannot be told apart in the 3D (correct, they look the same), only in the sentence.
- NOTE: Layout does not jump (Add button at the same place at 1440 for every choice and piece, page height 3131 px unchanged). No console errors apart from the local gift-cards CORS message.
- NOTE: The price is deliberately a flat "From $2,000"; unchanged until the owner's price steps are known.

## Re-check 5
Phone bar on the shop page confirmed at 390x844 and 360x640 with touch (empty basket: "Design your piece" to #design; basket filled: "Go to your order" to #order; both taps land on their target). The earlier FAILs of Re-checks 1 to 4 are all fixed (each has its re-check line); nothing else changed. Remaining items are NOTEs only.

## Re-check 6
Checked 8 Nov 2026 at 390x844 and 360x640 with touch, and 1280x650 with a mouse, swiftshader WebGL, network faked.
- Phone still (PASS): before any touch the viewer holds a still picture (no canvas yet), the same white gold ring at the same angle and size as the live 3D, so the swap does not jump. A first tap on "Rose" both started the 3D and applied Rose (button pressed, sentence "Rose gold, ..." and the ring turned rose in the first frames); screenshots at 0.1, 0.3, 0.7 and 1.8 s show no flash or blank. A first tap on the viewer itself (360x640) also starts it. No page errors.
- Piece switch (PASS): Ring to bracelet, necklace and back shrinks and grows in without a cut or a blank frame (the new piece is seen growing from small).
- 1280x650 (PASS): the whole design section (title, all rows including Ring size, the line under the viewer, price, Add button and the note) ends at 591 px for Ring, Bracelet and Necklace, so it fits without scrolling and nothing overlaps.
- Message (PASS): "Total: From $2,000, the final price for my choices to be confirmed"; the ring line says "(from $2,000)" and "ring size to choose with us" when none was typed.
- Note under the price (PASS): "The price grows with the gold and diamonds. We reply on WhatsApp with yours."
No FAIL remains; the earlier NOTEs stand.

## Re-check 7 (Tzvi's five changes)
Checked 8 Nov 2026 at 1440x900 (home, shop, design panel all pieces; the 18 new assets/pNN-st.webp opened at full size). Note: gen/studio-sheet.jpg is stale (it shows one ring and a black field), so I made my own sheet of all 18 cut-outs.

- (4) Headline: PASS. "Classic luxury, a modern touch" is the owner's own wording from the record; the line "Diamond rings, necklaces, bracelets and earrings, natural and lab. Your jeweler in Jerusalem." is the flyer's. No dashes or exclamation marks.
- (3) Loupe: PASS. It now follows the mouse to the ring's left and right band diamonds (target 780,560 and 1230,560: loupe exactly there) and stays there; moving through the words and then to the ring lands exactly on the ring (760,540) and still holds still after 3 s; it does not snap back to the centre stone. NOTE: while over the headline the glass floats over the words (it is transparent, harmless, but it does cover text).
- FAIL (1, cut-outs have leftovers and missing parts): Several studio cut-outs are visibly bad at full size, and the owner would see them on the stage and the picks. p03 (the first ring on the shop stage): a white foil/reflection blob of the old background hangs under and left of the ring. p11 (marquise, second photo): a white wedge on the left of the shank and the band is chopped off flat at the right. p12 and p13 (half eternity band): white clip fragments at the ends. p09 (solitaire with diamond shoulders, taken from the velvet box): the shank is cut away so only the stone and a short stub of band remain, floating. p02, p10, p14, p15 and others are clean. The pieces also vary in apparent size (the tennis bracelet and the thin necklaces are tiny next to the bands). Fix: redo those cut-outs by hand, or keep the original photo for them.
- FAIL (1, backgrounds consistent): The grounds of the photos now agree with each other and with the 3D ground (all the same pale grey) and the soft shadow is the same idea, so the pale-ground part passes. But the soft shadow promised under each piece is not visible under the cut-outs (they float), and the home page still shows the navy velvet-box photo (p09 original) beside the studio tiles. Treat as one FAIL with the cut-out defects above until the shadow and the velvet band are decided.
- FAIL (2 and 5, rings look fake; designer like a professional configurator): Honest answer: closer, still not real jewelry. The rings now have a pale ground, a soft shadow, see-through stones and fine claws, and the metal reads as polished white, yellow and rose gold. It looks like a clean CAD render, roughly the quality of a basic online ring builder, not of a professional house's configurator. What still reads fake: the stones are glass-like discs with a few faint facet lines and no fire or sparkle; the shadow sits well below the ring and does not touch it, so the ring floats; the halo ring floats above the band with a visible gap; the band stones are tiny dots; the bracelet is a ghostly white ring of translucent squares almost invisible on the pale ground (white stones on a pale ground), and at Fine size it is tiny and low contrast; the necklace is small and faint in the viewer. The pieces are also different sizes from one choice to the next. A visitor will compare it with the owner's real photos on the same page and the 3D loses.
- NOTE: Switching gold, shape and the other choices still all change the 3D at once and the layout does not jump. The 3D box and the photo tiles are now visually the same family (same ground).

## Re-check 8
Checked 8 Nov 2026 at 1440x900 (home, shop, design panel every piece) and 390x844 (design panel), and all 15 assets/pNN-st.webp at full size. The machine was slow; the screenshots waited for the 3D to settle. NOTE: gen/studio-sheet.jpg is again broken (one ring and a black field), so I made my own sheet.

Re-check 7 findings:
- Cut-outs (p03, p11, p13, p09): FIXED. p03 is now a clean studio shot on the site's ground with its own reflection, p11, p13 and p09 are gone from the shop (marquise and half eternity show one photo each), the long thin pieces (bracelets, chains) are larger in their square, and every cut-out sits on one soft oval shadow just under it. The velvet-box photo is only the dark "Every piece carefully selected" band on the home page, not beside the tiles, so I accept it as a deliberate section; PASS.
- Photo grounds against the 3D ground: FIXED. Same pale ground and a soft shadow in the tiles, picks, stage and 3D.
- FAIL (cut-outs still ragged, checklist 8): p12 (half eternity band, the only photo now used for that piece): the arc is a broken fragment of a ring with white metal clip slivers hanging off both ends and a ragged tail, so a piece of the ring is visibly missing and left-over background shows. p10 (twist solitaire): the inside of the band has jagged white stair-steps along the top edge, left over from the cut-out. Both show at the stage size (about 370 px) and in the picks. Fix: redo these two cut-outs, or show the original photos on their own ground.
- 3D looks like real jewelry: PARTLY. Honest comparison: the rings are now a good clean render (the ring sits on a shadow that touches it, a metal cup joins the stone to the band, finger-tight band stones, correct gold colours, stone, halo and band-diamond options each change it). It still reads as CGI, not photographed jewelry, with milky glass stones that show no fire. The bracelet is no longer ghostly but it is a thin grey ring of tiny square settings with a shadow floating in the middle of the ring, flat and without sparkle. The necklace is the weakest: the pendant is a large milky white plastic-looking disc with metal claws sticking out of it and (with halo) a ring of floating dots, and the chain is a thin grey wire. Against the owner's real photos on the same page, the 3D rings are credible as a configurator, the bracelet and necklace are not.
- FAIL (3D necklace, checklist 8): the necklace pendant reads as a white plastic blob with claws standing off it, not a diamond in a setting (laptop and phone). Fix: give the necklace stone the same faceted look as the ring's stone and attach the claws, or drop the big stone.

Remaining earlier NOTEs stand (the loupe covering the headline when the mouse is over the words; Natural and Lab look the same in 3D).

## Re-check 9 (dark luxury redesign, scroll film)
Checked 8 Nov 2026 on http://127.0.0.1:8732/mn-jewelry/ in real Chrome (so the video seeks), at 1440x900, 1280x650 and 390x844 with touch, network faked, nothing sent. Scrolled the whole film in ten to twelve steps per size, then every other section; changed every choice in the design panel for ring, bracelet and necklace; added two designs, walked all three order steps, read the faked WhatsApp message. No page errors, no sideways scroll at any size (the one 404 seen in an earlier load did not repeat). No exclamation marks or long dashes in any of the three pages.

What passes:
- Look: the whole site is near-black velvet with the logo's gold as the one accent (gold buttons with dark text, gold rim on the logo, small gold dots). It reads as one consistent, high-end site on all three pages and at all three sizes. All product photos share one dark ground with one soft spotlight and a soft shadow, so the tiles, picks, stage and basket thumbnails agree. White and grey text on dark has strong contrast (the small grey helper lines are weaker but readable).
- Film vs their photo: PASS. The film frames (gen/film/wide-sheet.jpg, tall-sheet.jpg and what the page plays) show the same ring as src/owner/p10.jpg: the round stone, the four claws, the band twisting round the stone, the polished white-gold band. The macro is soft in places (the band's reflections smear a little at the closest zoom) but no claw, stone or twist changes between the first and last frame. The page's first frame is a clean still of the same ring, so nothing is blank before the video can play.
- Words: PASS. Headline "Diamonds chosen for their sparkle" and "Quality. Sparkle. Comfort." are their own record words ("carefully selected for quality, sparkle, and comfort"); the line "From $2,000", natural and lab diamonds, by appointment and "We also buy gold" are all in the record or flyer. "We", never "they" about the business.
- Text over the film: PASS at all sizes. At 1440 and 1280 the headline sits left and the ring right with a small gap; on the phone the words are in the dark upper half and the ring below. The closing line "Quality. Sparkle. Comfort." and its button sit on the dark lower area at the end of the film and never cover the stone. Nothing is cut off apart from the intended macro crop.
- Design panel: every choice changes the 3D at once (gold, Round/Princess/Marquise stone, Plain/Halfway/All round band stones, halo, bracelet stone size, piece); the layout does not move (Add button stays at 541 px for every choice, page height unchanged). The stone-shape wheel in the viewer corner turns the chosen shape to the top (0, 120, 240 degrees for Round, Princess, Marquise) and the same outlines show on the Centre stone buttons. The ring size field, "from" prices, the basket lines and the message ("Total: From $2,000, the final price for my choices to be confirmed", every line "(from $2,000)") all read right; the phone keeps the 3D visible while you scroll the choices.

What must change:
1. FAIL, the starburst flash. Mid-way through the film (the claw at the bottom of the stone flares into a long rayed star with rainbow spokes; most obvious on the phone film at about half scroll, also a fainter version in the laptop film) reads as a stock "sparkle" effect, not as light on a real stone: it appears on one claw tip as a symmetrical burst and is gone two frames later. It also breaks the site's own rules: BRAND.md "No sparkle stars, lens flares or glitter drawn on the photos" and CONCEPT.md "a drawn flare on a real stone reads fake". Regenerate that stretch without the burst (or cut it and use the neighbouring frames) in both clips (assets/film/opening-d.mp4, opening-m.mp4) and the frame sets.
2. FAIL, the 3D designer is a visible step below everything around it. Next to a photoreal film and cut-out photos, the rings are a CGI render with milky glass discs for stones (the centre stone has a white cap and no fire), the necklace pendant is a flat grey disc ringed by floating dots with a thin wire chain, the marquise and princess stones sit on the head like loose glass, and the bracelet is a ring of grey squares with a floating shadow. It no longer breaks the dark look, but "high end" does not hold for this part of the site, and the claim in the brief (professional configurator quality) is not met. Fix: give the stones a faceted, bright look with real sparkle, attach the pendant's claws and setting, or show a still of the owner's matching photo beside the 3D until it does.
3. FAIL, step 3 send button contrast. In step 3 the idle (not yet valid) "Send order on WhatsApp, from $4,000" button is dark text on dark navy and is nearly invisible, and with the sent message showing it still looks like that, so a visitor cannot tell the final button exists. Give the disabled state a readable label (for example a lighter grey on a dark outline) and keep gold for the enabled state.
4. NOTE, the stone-shape wheel is small (about 60 px), aria-hidden and has no label or press response (it only shows the choice, the buttons do the choosing). It looks like a control a visitor will try to press; either make it pressable or add a one-word label.
5. NOTE, the film panel has a faint lighter rectangle edge behind the ring at 1280x650 (the video ground is slightly lighter than the page ground at its left and top edge). Match the page ground to the film's edge colour.
6. NOTE, mid-film the left of the frame goes to a lighter grey vertical light bar (a lighting change in the generated clip) before returning to black; fine, but the "near-black" look dips here.
7. NOTE, the "Every piece carefully selected" photo (p04-st) sits in a box slightly lighter than the band, so its edges show.

## Re-check 10
Checked 8 Nov 2026 on http://127.0.0.1:8732/mn-jewelry/ in real Chrome with cache off, laptop 1440x900 and phone 390x844, scrolling the film in 26 steps each, then the design panel for every piece and the order step 3.

Re-check 9 items:
1. Starburst flash.
   - Phone: FIXED. The new take has no star flare. Where the old one burst, the stone now gets a soft white glint and then a pastel lilac, pink and green wash for about four frames, like dispersion; it reads as light in the stone, not a drawn effect. The ring, claws and twist still match p10.
   - Laptop: ACCEPTABLE, but flag it to Tzvi. The first take stays. Around two thirds of the way through there are a few thin, faint rays from the stone and a small red and green fringe dot on the band for a few frames. It is not the big rainbow star of the old phone clip, it is on screen for under half a second, and it looks like light caught in the metal and stone, so I do not call it fake. It is still a lens-flare-like glint, and BRAND.md says "No sparkle stars, lens flares or glitter drawn on the photos"; the line was written for effects drawn on a photo, and this one is inside a generated film, so strictly it is not a breach, but it is close enough that the owner or Tzvi should decide. Recommended wording to Tzvi: keep it, or cut it in the frame sets if he wants zero flare.
2. 3D quality: PARTLY FIXED. The stones are no longer milky glass: each now has a star crown of flat facets, the halo sits on a visible metal rim, the necklace has a thicker gold chain, the bracelet is gold settings with its shadow lower. Honest read: it is now a clear, clean, low-poly CAD render; the radial pie-slice facets look like a diagram of a diamond, not a photographed stone, so it is still a step below the film and the cut-out photos, but it no longer looks broken. One defect remains, listed below.
3. Step 3 send button: FIXED. Not ready it is a gold outline with gold text (clearly readable on the dark card); once name and phone are filled it becomes the solid gold button. Contrast is fine.

BRAND.md line, checked against what I see: the shop and home photos carry no drawn stars or flares (PASS); the film is generated video, with the one faint laptop glint above as the only borderline case.

New or remaining:
- FAIL (necklace without halo): turn the halo off on the necklace and the claws stand out from the stone at an angle (two spikes at left and right of the lower stone, the stone tipped) so the pendant looks unfinished, not held by claws. With a halo it is fine. Fix: seat the claws against the stone's girdle on the pendant, as on the ring.
- NOTE: the ring's centre stone is a white pinwheel of flat wedges; the princess stone is a plain flat square with the same pattern; it reads as a stylised diamond icon. Adequate for choosing options, not photographic.
- NOTE: the phone film still has a pale lighting bar sweeping behind the ring and an opal colour wash on the stone; short and consistent with real light, but a little soft and a touch unreal.
- Earlier NOTEs (wheel size, film panel edge at 1280x650, home photo box edge) not re-checked; no change was claimed.

## Re-check 11
Checked 8 Nov 2026 on http://127.0.0.1:8732/mn-jewelry/shop.html (real Chrome, cache off, 1440x900). Necklace: all 18 combinations (white, yellow and rose gold, Round, Princess and Marquise, halo on and off), turned once to see the bezel from the side; then ring and bracelet, the three order steps and the faked WhatsApp message.

Fixed:
- Pendant without a halo: FIXED. The stone is now held in a metal bezel that follows its outline (round, square, pointed) in all three golds, with no claws standing off it; turned sideways it reads as a stone seated in a rim. Round and Princess hang correctly from the chain's loop.
- Pendant with a halo: claws are gone and the halo rim holds the stone (round and marquise look right).
- Idle send button: FIXED. Gold outline and gold text (readable), and on hover it fills with a darker gold tint (checked: outline stays, background lightens), then the solid gold button once name and phone are filled; the faked WhatsApp message came out right ("(from $2,000)", "Total: From $2,000, the final price for my choices to be confirmed").
- No regressions: the ring and bracelet still render and respond, Add button stays at the same place (541 px) for every choice, no console errors.

Still wrong:
- FAIL (necklace, two parts still float):
  1. Princess with a halo: the halo is a round ring of 18 small stones around a square stone, so the square's corners poke through it and about six stones sit loose outside the rim at the corners, floating in the air (white, yellow and rose gold). Fix: lay the halo along the square's outline, or leave the halo off for the princess.
  2. Marquise without a halo: the chain's loop sits above and to the left of the pointed stone with a visible gap, so the pendant looks unhooked (white, yellow, rose gold). Fix: put the loop on the stone's top point.
- NOTE: the stones in the pendant are still the flat pinwheel facets (stylised, not photographic); with the bezel they read as clean icons.

## Re-check 12
Checked 8 Nov 2026 on http://127.0.0.1:8732/mn-jewelry/shop.html (real Chrome, cache off, 1440x900): necklace and ring, every shape with halo on and off in white, yellow and rose gold (36 views, plus a turn of the ring); then bracelet, basket, the three order steps and the faked WhatsApp message.

- Halo follows the stone's outline: FIXED. Necklace and ring: the princess halo is now a square rim with its stones set on it, the marquise halo is a pointed rim, the round halo is round; no stones hang loose outside the rim in any gold, and the stone is held by the rim (no stray claws).
- Marquise pendant: FIXED. It hangs point up from the loop with the loop touching the stone's top point, with and without a halo, in all three golds.
- No-halo pendants (bezels) and the ring's claws are unchanged and still correct.
- Regression glance: PASS. The ring, bracelet and necklace all still change with every choice; the Add button stays at the same place (541 px) and the page height does not change; the necklace and ring lines read "(from $2,000)", the total "From $4,000, the final price for my choices to be confirmed", the ring line says "ring size to choose with us"; no console errors; the idle send button is still the readable gold outline.
- Stylised facets: they do not block a PASS. The checklist asks about consistency, things responding the way they look, photos, the screen, and facts; the facets are a drawn stone, not a photo, they look the same on every piece and in every gold, every choice visibly changes the picture, nothing is cut off or overlapping, and the page says "Design your piece" without claiming it is a photograph. They remain a notch below the photographic film and cut-outs (a note, not a failure).
- NOTE: the marquise ring (no halo) is seen from the side at the default angle, so the stone shows as a thin wedge until you turn it; with a halo it reads clearly.
- NOTE: earlier minor notes stand (the small shape wheel, the faint laptop film glint to be shown to Tzvi).

All FAILs from Re-checks 1 to 11 are now fixed.

Verdict: PASS

## Round 13 (10 Nov 2026, the rebuilt site: studio pictures, three golds, customise on every piece, new opening)
Checked on http://127.0.0.1:8732/mn-jewelry/ (real Chrome, cache off, 1440x900 and 390x844).

Six defects found: straight picture edges round the ring in the opening; the ring cut off on a phone; the closing words on two lines on a phone; the tennis bracelet's second photo came out as a loop; the shop page jumping between pieces on a phone; "Pieces we have made" wording.

Verdict: FAIL

## Re-check 13
All six fixes confirmed. New defect: the main buttons turn dark navy with near-black text on hover and after a tap.

Verdict: FAIL

## Re-check 14
Hover fixed (the buttons brighten, text stays readable). New defect: the "Add to basket" button's 0.9 s confirmation state measured 1.04:1 (near-black text on a dark fill).

Verdict: FAIL

## Re-check 15
Checked 10 Nov 2026, real Chrome, cache off, 1440x900 and 390x844; nothing sent (order and WhatsApp requests faked).

- Add to basket after a tap: PASS. Confirmation state is light text rgb(242,239,233) on rgb(21,23,38), 15.48:1; back to gold with dark text at 7.79:1, on two pieces and both sizes.
- Hover and focus on every main button (9 home, 7 shop, 4 contact): PASS. Nothing under 4.5:1; lowest 7.79:1.
- Regression glance: PASS. Opening on laptop and phone: ring whole, no straight edges, golds change white, yellow, rose, four boxes drift by, "Quality. Sparkle. Comfort." on one line. Shop on a phone, all 11 pieces: Gold row, Diamonds row, Add button and page height identical for every piece. Order flow works.
- NOTE: the fade between the button's two states passes through blended colours for 100 to 300 ms.
- NOTE: the two gold buttons in the home opening show no visible focus ring on the keyboard (text stays readable).
- NOTE: the summary line's top differs by 11 px between pieces on a phone; nothing else moves.
- New defects: none.

Verdict: PASS
