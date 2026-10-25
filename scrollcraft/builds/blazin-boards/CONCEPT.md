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
- tile: T9, colour wash on the board cards, from the existing build; T2 photo eases closer
- reveal: R1 fade up, from the existing build; R2 clip wipe tied to the scroll
- steps: S3, vertical line with dots, from the existing build
- price: P8, plain in the row, in the text colour, from docs/inspo/awwwards-anatomy-2026-10-22/food/qissa.webp
- heading: H1, from the existing build
- touch: the ruler beside the growing board, drawn from their real board sizes

## Not alike
check-fingerprints (22 Oct 2026) still reports clashes inherited from the earlier build (shared warm browns with aidy-yaniv and the-gift-boutique; reveal and tile effects shared with chicken-munch, l-a-cholent, the-brown-box). Not changed: the brief keeps colours and fonts, and Blazin' Boards is live.

## Sources (25 Oct 2026, the two openings)
- 21st search "giant hero text with product image rising in front, scroll parallax": "Phone Scroll Hero" (https://21st.dev/@ruixen.ui/components/phone-scroll-hero), a product that climbs up over the headline as you scroll; used only as the idea for opening 1, built by hand with their own board.
- Mobbin: the two links in the Wow gate above. Inspo: docs/inspo/awwwards-anatomy-2026-10-22/food/qissa.webp (one dark ground, gold button), still the grammar of the whole page.

## Combined opening (index-combo.html, 25 Oct 2026)
Tzvi chose a mix of the two: "do the flying board and it lands in front of the giant blazin". The giant BLAZIN' fills the top of the wine ground from the start; their board tumbles in on opening 3's smooth path and lands in front of the lower part of the letters (the top of the word stays clear), with a plain-gradient glow and its baked shadow behind it; then the headline, the price and Order a board. On phones the board is already in view and comes up under the word. Sources, both as above: Eat Hungry Tiger "WE BOTTLE BOLD", giant type with the product in front, https://mobbin.com/sites/sections/0a65ae4c-404c-4d2d-bc70-bef248345510 ; Impossible Foods "TALK MEAT", red on deep wine, https://mobbin.com/sites/sections/d57d01c4-90c2-419f-94a7-fa3217ba9e00 ; 21st "Phone Scroll Hero" (https://21st.dev/@ruixen.ui/components/phone-scroll-hero), the product climbing over the headline; Inspo docs/inspo/awwwards-anatomy-2026-10-22/food/qissa.webp.

Decision, 25 Oct 2026: Tzvi approved the combined opening; it is now index.html (the earlier one is saved as gen/index-before-combo.html). On phones the end state is spread over the screen: word, board, headline and button with even gaps.
