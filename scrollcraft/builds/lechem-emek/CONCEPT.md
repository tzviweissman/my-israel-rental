# Lechem Emek, concept

Category: place (bakery with a counter)

## Ideas
- **One warm ground after a moody opening, trust first** (docs/inspo/awwwards-anatomy-2026-10-22/food/stgeorges.webp): Le Saint Georges puts address, phone and hours where they cannot be missed and keeps one calm ground with one picture per section.
- **Menu as a plain priced list with round photos** (docs/inspo/awwwards-anatomy-2026-10-22/food/delice.webp): Delice shows each dish as a round photo with name, one line and price, and a text list for the menu.
- **Order always in the bar, menu as text** (docs/inspo/awwwards-anatomy-2026-10-22/food/qissa.webp): Qissa keeps one button in the top bar all the way down and the menu as a text list with prices.
- Own: "The scroll is the morning": the page starts at 04:00 in the dark and the sun comes up as you reach the door, the clock in the corner walking to 07:00.

- Mobbin search 25 Oct, after the build, "bakery shop opening hours and location section": Little Amps Coffee (https://mobbin.com/sites/sections/74a3a0da-d93a-419b-a675-1a641b46a4eb: name, address and hours beside a framed shop photo) and Monte (https://mobbin.com/sites/sections/2b8ad772-2f97-44a9-bea1-29d14f646b83: "open today til 1:30pm" on the first screen). Ours puts the hours and address in the Visit block with the shopfront photo, like Little Amps; it does not show "open today" on the first screen as Monte does.
- 21st search 25 Oct, after the build, "bakery order basket sheet with steps": found Checkout Steps Breadcrumb (https://21st.dev/@cnippet-dev/components/v-breadcrumb-12, numbered circles with back and continue) and Add to basket (https://21st.dev/@motiondotdev/components/motion-add-to-basket, tile flies into the cart). Nothing taken: our basket sheet already has Step 1 of 3 to 3 of 3 with back and continue.

## Chosen
The night opening and the door at seven stay as the event; after the door everything sits on one warm cream ground: hours, address and kosher at once, the counter as a grouped price list with round photos, the baker's story as a framed photo beside her words, the shopfront framed beside the address, a closing line with one framed photo. The start-your-order button is in the bar throughout.

## Wow gate
1. Strongest real photo, big: the baker sliding loaves out of the stone oven fills the first screen.
2. Signature moment from their own thing: the scroll is the morning, 04:00 to 07:00, and the door opens onto daylight.
3. The choice changes the page: adding an item opens a basket that carries the items, day and total into the order.
4. Side by side: Le Saint Georges and Delice (pictures above): ours is the same trust-first, one-ground page with a priced list. Sources (recorded 25 Oct): closest Mobbin reference https://mobbin.com/sites/sections/74a3a0da-d93a-419b-a675-1a641b46a4eb; Inspo docs/inspo/awwwards-anatomy-2026-10-22/food/stgeorges.webp.
5. One sentence: you land in the dark bakery at four and the door opens at seven.

## Effects
- button: B1, lift and press, from the existing build
- link: none
- tile: none
- reveal: R1, fade up as each block comes into view, from the existing build
- steps: none
- price: P12, since 25 Oct the price ends a dotted line from the name like a bakery price board (was P8, plain beside the name, shared with Blazin's), from docs/inspo/awwwards-anatomy-2026-10-22/food/delice.webp
- heading: H1, lines rise from a mask, from the existing build
- touch: the clock in the corner that walks from 04:00 to 07:00 with the scroll

## Not alike
lechem-emek: different from all 12 other pages
after Tzvi's 25 Oct decision: headings Lora (were Playfair Display, as Blazin'), prices on a dotted line (P12, was P8), effects added to scrollcraft/fingerprints.json

## Invented facts (practice page)
Lechem Emek is a practice page with no owner. The address (Emek Refaim 41), the hours, "since 1998", "Rabbanut Yerushalayim" and, since the 22 Oct 2026 review, the phone number in the trust strip (02-555-0141) are invented for the demo and need real proof before any owner is shown this.

## Night section (22 Oct 2026 review)
The old pinned "shaping" act and the separate "bake" section were mostly blank screens. They are one flow section, `#bake`: four lines stacked, each seen as you pass (Every loaf is shaped by hand. / By whoever is in that morning. / It is the slowest part of the day... / Steam for the first ten minutes. Then you wait.).
