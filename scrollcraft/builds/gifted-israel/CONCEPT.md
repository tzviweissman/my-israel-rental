# Gifted Israel: concept (rules 3q)

Category: gift-shop (rule 3t, shops): a shop of 162 Judaica and home pieces from the Waterdale Collection, every
one a studio photo on white with its price on their own site (GiftedIsrael.com). So the site sells like the shops
in docs/inspo/awwwards-anatomy-2026-10-22/shops: the product big on its own ground, the grid on white, price and Add
on every card. All references: REFERENCES.md. Ideas in full: IDEAS.md. Brand: BRAND.md.

## Ideas
- A. Engraved for them: their Diamond Menorah stands whole on its own white beside the headline; a point of light
  cuts "Chanukah 5787" into its gold base, then the visitor types their own words and sees them cut in. One product
  on its plinth with one big line and one pill (docs/inspo/moto-card-2026-10-21/hero-2500.webp); a preview that
  builds as you type (docs/inspo/videos-2026-11-04/brief-form-live-summary.jpg).
- B. Through the year: tall cards per occasion, the coming one open (docs/inspo/awwwards-categories-2026-10-18/tedxportland-1-year-card-strip.webp).
- C. Through the Lucite: a clear block bends the headline (docs/inspo/awwwards-categories-2026-10-18/flux-theory-1-steamed-glass-opening.webp). Dropped: it would be a drawn look-alike of their piece.
- Own: their site's own line "Set your Shabbos table", a switch lighting their candle-lighting tray
  (docs/inspo/awwwards-categories-2026-10-18/halcyon-lighting-1-lights-off-toggle.webp). Waits: no photo of theirs has lit candles.

## Chosen
I, Tzvi's pick on 9 Nov 2026 ("yes 1") after "try a new wow moment this isnt good", replacing H. Before: H, Tzvi's pick on 5 Nov 2026 with his own change: their real pieces fall into a pile on the floor, and choosing an occasion makes that occasion's pieces rise out of the pile and flow into a line with names and prices. It says what the shop is all year: gifts for any occasion. Nothing generated: their own photos cut off their white in gen/gifts.py. A stays as the engraving section lower on the page, B as the category row.

## Style sheet (3g.1)
- Ground: white #FFFFFF, the white their photos stand on; one stone room #F5F1EC; one red band #6F0D0C to close.
- Ink #1F1B1A, soft #5F5752, line #E6DFD7.
- Accent, main button only (3g.3): their logo's red #6F0D0C with white text. Prices bold in ink.
- Faces: David Libre for headings (Bellefair until 8 Nov 2026, when Hadassah Prys took it live first; Bona Nova is The Brown Box's), Alef for text (both on the approved list, both with Hebrew); ₪ in Alef.
- One radius 6px (cut Lucite corners, not pills); one soft shadow tinted warm; no gradients.
- Motion: under 0.5 s, eased, never linear; the engraving is the one loud moment; nothing holds the scroll.

## Effect budget (3f.2)
- Signature: the seven rooms (GI-F2), one per category, wiped in by the scroll.
- Accents: the engraving typed by the visitor (GI-X1); the occasion cards open when pointed at; the closing red band answers the opening with "For all your gifting needs" under the name.
- Quiet touches: GI-B1 press on buttons, L3 links, GI-R1 blocks settle in, the piece's own reflection grows on cards.

## Wow gate
1. Their strongest thing, big: one of their own pieces per category, on its stone in a room of that category's colour, the category's name huge behind it.
2. The signature only they could have: the range itself, room by room, each with its real piece and its price line.
3. The visitor's choice changes the page: the occasion chosen decides which six rise, and each goes straight to that piece in the shop.
4. Side by side with a reference: Delta Cafes' quiz (docs/inspo/awwwards-food-2026-10-18/delta-cafes-3-floating-packs-quiz.webp) only floats packs round a question; ours answers on the spot. Itsua's intent picker (docs/inspo/awwwards-categories-2026-10-18/itsua-1-intent-picker.webp) is the "pick the one that sounds like you" model; Mobbin Kalstore (https://mobbin.com/sites/sections/1616aa46-b42b-44f0-b46c-6bdb800bb145) sells gifts with a plain grid.
5. One sentence: you land in a honey room where their Mayim Achronim settles on its stone with SHABBOS behind it, and each scroll wipes in the next coloured room with its own piece.

## Effects
- button: GI-B1, new, from 21st "Engraved Client Plates" (https://21st.dev/@cipriantitire/components/engraved-client-plates): on press the label sinks in like letters cut into metal
- link: L3, from the effects library (arrow lifts away), after the 21st search above found no link effect for gift shops
- tile: GI-T1, new, from docs/inspo/awwwards-anatomy-2026-10-22/shops/serotoninn-2-all-products-grid.webp: the piece's own reflection on white grows a little when pointed at
- reveal: GI-R1, new, from Mobbin Palmer Dinnerware (https://mobbin.com/sites/sections/dfb1f238-01a9-4866-afae-db35c7863ae8): blocks settle down a few pixels with no fade of the pictures
- steps: none
- price: GI-P1, new, from Mobbin Clay (https://mobbin.com/sites/sections/01b34e93-b604-4c50-ac12-333b6c84ae2f): the price on the name's line, right, bold ink, the ₪ small
- heading: none
- other: GI-F1, new, from docs/inspo/awwwards-food-2026-10-18/delta-cafes-3-floating-packs-quiz.webp and a site Tzvi saw with emojis piled at the bottom of the screen: a pile of real pieces, and the chosen ones rise and flow into a line. GI-X1, new, from docs/inspo/videos-2026-11-04/brief-form-live-summary.jpg and 21st "Engraved Client Plates": words cut into the product's gold base as they are typed
- touch: the menu bar's basket count sits in a small gift box, from their own logo's G box (src/owner/p01.jpg)

## Not alike
gifted-israel: different from all 19 other pages

(pasted from scripts/check-fingerprints.mjs once the pages exist)

- other: GI-F2, new, from docs/inspo/videos-2026-11-08/bramble-chain.jpg and docs/inspo/pro-references/shop-type-and-photo.jpg: a room of the product's own colour per chapter, the word huge behind the piece.
