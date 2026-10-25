# Blazin' Boards, concept

Category: food-shop (premium dark brand; the category row allows a darker warm ground)

## Ideas
- **Dark oxblood and gold, one ground, framed pictures** (docs/inspo/awwwards-anatomy-2026-10-22/food/qissa.webp): Qissa keeps one dark ground for the whole site, gold for the one button, menus as plain text lists with prices, a trust block of facts near the top.
- **Round or framed dishes with a name, one line and a price** (docs/inspo/awwwards-anatomy-2026-10-22/food/delice.webp): Delice's menu shows each dish framed, with a price rule, not full-bleed.
- **Product rows with the price on each** (docs/inspo/awwwards-anatomy-2026-10-22/food/theobroma-shop-grid.webp): every product card carries its price and a buy control.
- Own: "Five sizes, to scale": their board grows through the real sizes beside a 10 cm ruler, each size lighting up its boards and prices.

## Chosen
The Qissa pattern around their own board tumble and size ruler: one warm dark ground on every page, the shop cards dark with gold buttons, pictures framed with a thin gold edge, a facts strip (kitchen, notice, delivery, payment) right after the sizes, the full price list as a text menu. Order forms stay on light panels so they read.

## Wow gate
1. Strongest real photo, big: their own board, cut out and large, on a plain wine table (index.html, opening 3) or rising in front of a giant BLAZIN' (index-name.html, opening 1).
2. Signature moment from their own thing: the board grows to scale against a ruler, with prices.
3. The choice changes the page: the size reached lights up every board of that size with its price.
4. Side by side: Qissa (picture above) is dark with one gold button and a text menu; ours is the same grammar with their boards.
5. One sentence: you land on their board tumbling in, then watch it grow to real size with the price.

### Two openings to compare (25 Oct 2026, Tzvi: the board flew in unsmoothly, a meat board sat on a meat board, the picture was cut off)
- **Opening 3, the flying board (index.html):** the tumble kept, smooth, landing on a plain oxblood table with a soft shadow shaped like their own board, the whole board on screen, then the name and headline as before.
- **Opening 1, the name is the stage (index-name.html):** a giant BLAZIN' across the dark wine screen; as you scroll, their real board (assets/board-cut.webp, their own cut-out) rises from below in front of the letters and settles with a warm glow behind it, then the headline, the price and Order a board appear. It follows the scroll both ways. Sources: Eat Hungry Tiger "WE BOTTLE BOLD", giant type with the product held in front of it, https://mobbin.com/sites/sections/0a65ae4c-404c-4d2d-bc70-bef248345510 ; Impossible Foods "TALK MEAT", red on deep wine, https://mobbin.com/sites/sections/d57d01c4-90c2-419f-94a7-fa3217ba9e00 .
- Wow source for both openings, Inspo: docs/inspo/awwwards-anatomy-2026-10-22/food/qissa.webp (plain dark ground, the product the only picture).
- Both: no photograph behind the board, no scroll cue, no blended full-screen layer (the old heat glow was one and held the page to 20 fps).

## Effects
- button: B5, flips to show the price, from the existing build
- link: none
- tile: T9, colour wash on the board rows, from the existing build; T16 a photo lifts, tilts a few degrees and gets a warm ember edge light, from 21st search "card hover lifted tilt glow edge ember": "Optimized Tilt Card" (https://21st.dev/@sh20raj/components/optimized-tilt-card), kept to a lift and an edge glow
- reveal: R13 blocks slide in from alternating sides and settle, like a board set down on a table (a short slide with a small overshoot, no clip wipe), from 21st search "giant hero text with product image rising in front, scroll parallax": "Hero Parallax" (https://21st.dev/@manuarora700/components/hero-parallax), translation and rotation with opacity
- steps: S3, vertical line with dots, from the existing build
- price: P13, the price on a small gold tag with a punched hole, like a butcher's price tag, from 21st search "price tag badge product card": "Badge Tag" (https://21st.dev/@prebuiltui/components/badge-tag) and "Product Card" (https://21st.dev/@deltacomponents/components/product-card); the Qissa menu still sets the layout (docs/inspo/awwwards-anatomy-2026-10-22/food/qissa.webp)
- heading: H1, from the existing build
- touch: the ruler beside the growing board, drawn from their real board sizes

## Not alike
blazin-boards: different from all 8 other pages (check-fingerprints, 25 Oct 2026). Tzvi chose fire orange (#FF7A2E, the site's own ember) over gold for the buttons and price tags; small text is the logo's own light pink (#F0E0E0); the size board is a wine-stained wood; the reveal, tile and price effects are Blazin's own (R13, T16, P13). Own colours from the logo: #82001E, #F0E0E0.

## Sources (25 Oct 2026, the two openings)
- 21st search "giant hero text with product image rising in front, scroll parallax": "Phone Scroll Hero" (https://21st.dev/@ruixen.ui/components/phone-scroll-hero), a product that climbs up over the headline as you scroll; used only as the idea for opening 1, built by hand with their own board.
- Mobbin: the two links in the Wow gate above. Inspo: docs/inspo/awwwards-anatomy-2026-10-22/food/qissa.webp (one dark ground, gold button), still the grammar of the whole page.

## Combined opening (now index.html, 25 Oct 2026)
Tzvi chose a mix of the two: "do the flying board and it lands in front of the giant blazin". The giant BLAZIN' fills the top of the wine ground from the start; their board tumbles in on opening 3's smooth path and lands in front of the lower part of the letters (the top of the word stays clear), with a plain-gradient glow and its baked shadow behind it; then the headline, the price and Order a board. On phones the board is already in view and comes up under the word. Sources, both as above: Eat Hungry Tiger "WE BOTTLE BOLD", giant type with the product in front, https://mobbin.com/sites/sections/0a65ae4c-404c-4d2d-bc70-bef248345510 ; Impossible Foods "TALK MEAT", red on deep wine, https://mobbin.com/sites/sections/d57d01c4-90c2-419f-94a7-fa3217ba9e00 ; 21st "Phone Scroll Hero" (https://21st.dev/@ruixen.ui/components/phone-scroll-hero), the product climbing over the headline; Inspo docs/inspo/awwwards-anatomy-2026-10-22/food/qissa.webp.

Decision, 25 Oct 2026: Tzvi approved the combined opening; it is now index.html (the earlier one is saved as gen/index-before-combo.html). On phones the end state is spread over the screen: word, board, headline and button with even gaps.

Own effects (25 Oct 2026, Tzvi: stop clashing with other sites): the reveal, tile and price above replace R1 + R2, T2 and P8; check-fingerprints now reports no effect clashes, only the colour ones (aidy-yaniv, the-gift-boutique).
