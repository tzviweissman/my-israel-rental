# Krysp: concept (rules 3q)

Category: food-shop (rule 3t), on the owner's own look: her logo (src/owner/p01.jpg) is a peach circle with dark brown
heavy rounded capitals and golden brown small type, so the site is peach, cream and dark brown. Food-shop pattern:
the price and an Add button are on the first screens, the product is the packed board in her real photo. All references:
REFERENCES.md; all ideas and their steps: IDEAS.md.

## Ideas
- E. The blueprint: her real photo turns into a numbered drawing of the board and back
  (docs/inspo/awwwards-2026-10-18/usav-4-photo-to-map.webp, docs/inspo/awwwards-food-2026-10-18/acme-1-1-line-drawing-cutaway.webp,
  docs/inspo/awwwards-food-2026-10-18/mam-com-1-circular-tray-diagram.webp). Not chosen: it needs piece counts only she can give.
- Own: F. The snap, KRYSP says crisp: one half-dipped chew is bent until it breaks in two and the instant freezes, the camera goes
  round the break, then tilts down onto her real board
  (docs/inspo/product-films-2026-10-21/can-6.8.jpg, docs/inspo/awwwards-categories-2026-10-18/easyseller-1-object-through-headline.webp,
  docs/inspo/awwwards-2026-10-18/drone-2-stat-readout.webp, docs/inspo/awwwards-categories-2026-10-18/mediaquestweb-1-dashed-path.webp).
  Own because the name is the sound of the product: the crack is the one thing only a peanut chew board has, and it comes back as the
  site's touch (the button) and the line between sections.
- G. From one grain to the board: the camera pulls back from one crisp rice grain to her whole board
  (docs/inspo/awwwards-categories-2026-10-18/odyssee-2-close-up-opening.webp, docs/inspo/awwwards-food-2026-10-18/meatopia-1-map-world-opening.webp).
- H. The board in your hand: her board tilts with the mouse and a line of light runs along the drizzle
  (docs/inspo/awwwards-2026-10-18/drone-5-follows-mouse.webp, docs/inspo/awwwards-2026-10-18/butter-6-keys-jingle.webp,
  docs/inspo/awwwards-categories-2026-10-18/halcyon-lighting-1-lights-off-toggle.webp).

## Chosen
F (Tzvi, 29 Oct 2026: asked for it bigger, "do it without hands if you can", "yes"). It is the only idea whose event is her product
breaking, the one moment every peanut chew shares, and the name Krysp says it. The film (gen/snap-brief.md, made 31 Oct
when Tzvi said "and create the film") (remade 1 Nov after "the bend and the snap dont look natural") is five stills from her photo and three
MiniMax H3 clips joined by gen/film.sh: one of her half-dipped chews bows, one crack opens, and it tears apart in slow motion on her peach under the giant KRYSP, the moment freezes and the camera goes round into the broken face
(no labels: what is inside her chews is not in her record), then her real board dissolves in,
where the price and Order wait on a card. The inside is taken from the cut ends of the bars in her photo; if her broken-chew photo
differs, clip 2 is redone. Scroll-driven frames on a canvas (film.js).

## Style sheet (3g.1)
- Ground: her logo peach #F3D5BB (opening, how it works, closing band); cream #FBF1E6 for the board and gallery sections;
  one dark band, her logo brown #392615, for the hashgacha line.
- Ink #392615; muted #6B5440. Accent, main button only (3g.3): golden brown #8A5A1E from her logo's small type, cream text on it (6.0 to 1).
- Faces: Nunito 900 in capitals for headings (heavy and rounded like her logo's letters); Mulish for text; the dollar sign in the heading face.
- One radius 18px (images and buttons alike, buttons are pills); one soft shadow tinted brown, 0 3px 30px.
- Motion: under 0.6 s, eased, never linear; only the opening film follows the scroll; everything else changes on a tap.

## Effect budget (3f.2)
- Signature: the opening snap film (X32, idea F).
- Accents: the crack lines between sections drawing in (R14); the board tile's light that follows the pointer (T5); headings whose letters
  close up as they arrive (H10).
- Quiet touches: the button crack on press (B20), squiggle links (L5), the price in large numerals (P7), the phone bar with the price.

## Wow gate
1. Her strongest real photo, big: the Luxe board (src/owner/p02.jpg, whole, never cropped)
   ends the film full screen (extended to the screen's shape, never cropped) and is the shop's picture.
2. The signature only she could have: a peanut chew snapping under the word KRYSP, the camera going round the break
   (gen/snap-brief.md), made 31 Oct.
3. The visitor's choice changes the page: the shop stage changes its picture, name, price and Add for each board she adds to her shop
   (one board today, so nothing to choose yet), and the quantity changes the total in the button.
4. Side by side with a reference: re_'s huge letters behind a product on a warm ground
   (https://mobbin.com/sites/sections/724b94eb-3a56-4a47-aa2d-1fa5ed6b43fb) and the saved product-film still
   docs/inspo/product-films-2026-10-21/can-6.8.jpg (the can held with its ingredients frozen round it); ours has the same giant name, one product
   and the frozen break.
5. One sentence: you land and one of her peanut chews bends and snaps in two, the instant freezes and you look inside it, then you see
   her whole board.

## Effects
- button: B20, new, from 21st search "button press crack effect" (Pop Button, https://21st.dev/@tom_ui/components/pop-button, for the press) and the film's break: pressing it draws a thin crack across the face
- link: L5, from 21st search "squiggle underline link hover" (Squiggly Underline, https://21st.dev/@manuarora700/components/squiggly-underline), a squiggle that draws in under the words on hover
- tile: T5, from 21st search "spotlight product card pointer light" (Spotlight Card, https://21st.dev/@preetsuthar17/components/spotlight-card), a soft peach light follows the pointer over the board tile; and Mobbin's MANA single product (https://mobbin.com/sites/sections/397dea4b-1996-40fc-9527-88406c00385b) for the tile's photo, name, price and button
- reveal: R14, new, from docs/inspo/awwwards-categories-2026-10-18/mediaquestweb-1-dashed-path.webp: a thin crack draws between sections as each comes in; the blocks themselves fade up (R1 is common and scores 0)
- steps: S5, from Mobbin re_ (https://mobbin.com/sites/sections/b3bbfa7a-e557-47ec-b9dd-10c6bb6f3008) plain numbered rows on hairlines under its product, no lighting up
- price: P7, from the effects library price set marked for food and shops (big display numerals), checked against Mobbin MANA's price beside the name
- heading: H10, new, from Mobbin re_ (https://mobbin.com/sites/sections/724b94eb-3a56-4a47-aa2d-1fa5ed6b43fb), whose big words are set tight: each heading's letters start stretched a little wide and close up as it arrives
- other: X32, new, from docs/inspo/awwwards-categories-2026-10-18/easyseller-1-object-through-headline.webp and the snap idea: a thin crack drawn down the peach beside her board by the scroll
- touch: from her product's own crunch: pressing the order button cracks its face with a thin line, and a crack line runs between the sections, the crunch of a peanut chew, the one thing in her product that is hers

## Not alike
krysp: different from all 17 other pages

(pasted from scripts/check-fingerprints.mjs, 29 Oct 2026)
