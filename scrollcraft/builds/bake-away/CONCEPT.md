# Bake away: concept (rules 3q)

Category: food-shop (rule 3t), on the owner's own dark look: her business card is near-black with copper
Roman capitals (src/owner/p01.jpg), so the ground stays dark and the rest follows the food-shop pattern
(buy from the first screens, price and Add on every card). All references: REFERENCES.md.

## Ideas
- A. The drizzle: a stream of milk chocolate is drizzled across her white-glazed doughnut on black slate,
  then the doughnut stays and the same spot turns through her flavours. One product alone, then the page
  grows from it (docs/inspo/awwwards-food-2026-10-18/kindi-land-1-biscuit-opening.webp); one fixed product
  whose name and glow change (docs/inspo/awwwards-food-2026-10-18/still-2-flavour-glow-swap.webp); a pour
  over the product under a big line, as Savor and Koto open (Mobbin, see Wow gate).
- B. The first slice: a wedge of her striped cheesecake lifted out on its gold server. Dropped: her photo
  does not show the inside, so the cut would be invented.
- C. Her table as the menu: the camera travels across her card's own table (flour, egg, cookies) to her
  doughnut, then the label on the table cycles through her ranges
  (docs/inspo/awwwards-food-2026-10-18/pier88-coast-2-plate-as-menu.webp).
- Own: "Bake away, cakes, cookies & more" and the scene on her own business card: the dark table, the
  copper capitals and the line CAKES, COOKIES & MORE carry the site; the toppings landing on mini
  doughnuts for her DIY kit (docs/inspo/awwwards-2026-10-18/butter-4-icons-land.webp) is kept for the kit card.

## Chosen
A (Tzvi, 28 Oct 2026: "go with A"; the five motion steps confirmed with "Yes, make it"). It opens on a real
event with her own doughnut, it hands straight into the thing only she has (more doughnut flavours than
any business we have built for), and the visitor drives both: the scroll pours, a tap chooses the flavour, and Add is beside every flavour.

## Style sheet (3g.1)
- Ground: warm near-black slate #241B1B (the film's own top band, so page and film meet); a deeper band
  #161110; one ivory room #F3EBDD for the cakes and challah section.
- Ink on dark: ivory #F3EBDD; muted #B9A797. Ink on ivory: #241B1B.
- Accent, main button only (3g.3): her card's copper #C2824B, dark text on it.
- Faces: Forum (Roman capitals like her card) for headings; Work Sans for text; the shekel sign in the
  text face (3o.5).
- One radius 14px; one soft shadow tinted with the ground; no gradients except the film's soft edges.
- Motion: under 0.5 s, eased, never linear; only the film follows the scroll; the flavour spot changes on a tap.

## Effect budget (3f.2)
- Signature: the drizzle film into the flavour spot (X31).
- Accents: tapping a flavour changes the doughnut on the same spot (part of X31; never a second scroll effect, Tzvi 29 Oct 2026); the range cards' details
  slide up (T6); the closing band answers the opening with her card's line under a giant copper BAKE AWAY.
- Quiet touches: B19 drip on the main button, L1 links, R4 sections slide in, H1 headings rise from a mask.

## Wow gate
1. Her strongest photo, big: her white-glazed doughnut with chocolate lines (src/owner/p05.jpg, the film's
   last frame edited from it and checked beside it, gen/k1b-compare.jpg) fills the first screen on a laptop
   and more than half of it on a phone.
2. The signature only she could have: chocolate drizzled across her own doughnut as you scroll, then her
   nine doughnut flavours turning on the same spot (src/owner p05 to p14, cut out from her photos).
3. The visitor's choice changes the page: each flavour changes the doughnut, its name, its price line and
   what the Add button puts in the basket.
4. Side by side with a reference: Savor's opening film of chocolate poured into moulds
   (https://mobbin.com/sites/sections/9578c9fe-7f5c-4d32-b868-786881a90d32) and the saved flavour swap
   (docs/inspo/awwwards-food-2026-10-18/still-2-flavour-glow-swap.webp); ours is a closer, single product.
5. One sentence: you land and chocolate is drizzled across her doughnut as you scroll, then you tap through her
   other doughnuts in its place, each with its price and an Add button.

## Effects
- button: B19, new, from the drizzle itself (her chocolate line); compared with 21st search "bakery donut product showcase scroll"
- link: L1, from the effects library (links: anyone), after the same 21st search found no link effect for bakeries
- tile: T6, from 21st "Cinematic Product Scroll Section" (https://21st.dev/@Loomix/components/cinematic-product-scroll-section), details that rise on the card
- reveal: R4, from docs/inspo/awwwards-food-2026-10-18/kindi-land-2-category-cards-product-pop.webp (cards that come in from the side)
- steps: none
- price: P1, from the effects library price set marked for food and shops
- heading: H1, from Mobbin Savor's large serif lines (https://mobbin.com/sites/sections/3310e934-d36d-44a4-b4b7-65297ca0924b)
- other: X31, new, from docs/inspo/awwwards-food-2026-10-18/still-2-flavour-glow-swap.webp and Mobbin Savor
- touch: the main button grows a small chocolate drip on hover, from the film's own chocolate

## Not alike
bake-away: different from all 16 other pages

(pasted from scripts/check-fingerprints.mjs once the pages exist)
