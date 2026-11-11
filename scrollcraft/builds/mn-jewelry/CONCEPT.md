# M and N Jewelry: concept (rules 3q)

Category: fashion-shop (rule 3t), fine jewelry: the pieces near the top with name and price under each, and the shop as
one page with the order in steps. Tzvi, 8 Nov 2026, after 22 high-end jewelry sites and videos: the dark luxury look (15 of
the 24 open on near-black), so every piece sits on the same dark studio surface with one soft light, their logo's gold is
the one accent, and one thin display serif like their logo's capitals. The opening is idea B, light across the stone,
remade in code on 10 Nov 2026 from the pieces' studio pictures after Tzvi said the generated clip "looks so fake": light
crosses their own twist ring as its gold turns white, yellow, rose, from their words "carefully selected for quality,
sparkle". All references: REFERENCES.md; ideas and
steps: IDEAS.md; brand: BRAND.md.

References kept (3c.1): the Kinoria viewfinder (docs/inspo/awwwards-categories-2026-10-18/kinoria-1-viewfinder-reveal.webp),
the 21st Magnifier Lens (https://21st.dev/@baozhouqi/components/magnifier-lens) and Lens Card
(https://21st.dev/@rmahammad/components/lens-card), Aino Agency's All Blues jewelry grid on Mobbin
(https://mobbin.com/sites/sections/a5c384c1-a04c-4c45-b077-25f5f5d646d9), Face Formula's product cards on Mobbin
(https://mobbin.com/sites/sections/2c42876f-e42f-49dc-ba18-b6acc4bdf204), and the Outfit shop grid
(docs/inspo/awwwards-anatomy-2026-10-22/shops/outfit-1-shop-grid-home.webp).

## Ideas
- Own: A. Look closer: a jeweler's loupe glides onto the diamond of their solitaire and the visitor moves it, from "carefully selected for quality, sparkle"
  (docs/inspo/awwwards-categories-2026-10-18/kinoria-1-viewfinder-reveal.webp, docs/inspo/videos-2026-11-04/turn-it-over-hotspots.jpg, docs/inspo/videos-2026-11-04/flashlight-hero.jpg).
- B. Light across the stone: a band of light crosses the ring with the scroll
  (docs/inspo/moto-card-2026-10-21/hero-2500.webp, docs/inspo/awwwards-categories-2026-10-18/preymaker-1-texture-film-hero.webp). Chosen, see below: the light is one soft band and one brief flash over their real picture, never a generated stone.
- C. Through the headline: their tennis bracelet across the words
  (docs/inspo/awwwards-categories-2026-10-18/easyseller-1-object-through-headline.webp, docs/inspo/awwwards-anatomy-2026-10-22/shops/outfit-1-shop-grid-home.webp). Not chosen: a cut-out of a fine bracelet frays at every stone.

## Chosen
B (Tzvi, 8 Nov 2026; A, the loupe, was built first and retired the same day). It was first a generated macro clip, which
Tzvi rejected on 9 Nov ("it looks so fake"), and the drawn 3D ring went after it ("the rings look very fake"). Since
10 Nov the film is made in code from the pieces' studio pictures (gen/scenes.html): nothing in it is generated as video
or drawn in 3D.

## Style sheet (3g.1)
- Ground dark velvet #121319; surface #1A1C24; ink #F2EFE9; soft #A9A7A1; line #2C2E38; the closing band and footer #0B0C10.
- Accent, main button only (3g.3): their logo's gold #C2A46E with #121319 text (8.6:1).
- Every photo is their own piece re-set on the same dark studio surface with one soft light (gen/studio_edit.py, gen/studio-brief.md), checked beside their photo (gen/studio/_sheet-*.jpg); the shop stage shows the same picture in white, yellow or rose gold.
- Faces: Italiana for headings (one weight, thin, like the capitals of their logo; Bellefair for a Hebrew page), Assistant 400, 600 and 700 for text; the $ in the text face.
- One radius 4px, the corner of a jewelry box; one soft shadow 0 6px 34px black at 45%.
- Type and spacing: the starter scales only (BRAND.md).
- Motion: under 0.6 s for everything but the opening film, which follows the scroll, and the stage's 1.1 s pass of light; eased, never linear; with reduced motion the film is one still and nothing moves by itself.

## Effect budget (3f.2)
- Signature: light across the stone (X39): scrolling sends light across their twist ring as its gold turns white, yellow, rose, four more of their pieces drift by in boxes, and the ring settles above "Quality. Sparkle. Comfort."
- Accents: the first screen arriving in order (kit 3u.5, headline, line, button); on the shop stage the gold choice fades the same piece into that gold with one pass of light and the picture grows under the pointer (X40); the stage swapping to the piece you tap (3h.10); the closing payoff, a solitaire divider whose small stone lights when the closing band arrives.
- Quiet touches: one light pass across the main button on hover (B11), the arrow in a ring on links (L4), details sliding up on tiles (T6), blocks fading in place (R6).

## Wow gate
1. Their strongest real photo, big: their twist solitaire (p10), on the dark studio surface, fills the first screen at the right (below the words on a phone), and is the first frame of the film.
2. The signature only they could have: their own stone, closer and closer, catching one band of light, from their own words "carefully selected for quality, sparkle"; no other site of ours opens on a light sweep (motions.json: glint).
3. The visitor's choice changes the page: the scroll drives the film; in the shop, tapping a piece puts it on the stage with its name, price and choices, and choosing white, yellow or rose gold changes the picture, the summary line and the basket line.
4. Side by side with a reference: the JMODELS and KANDA & CO ring films (pinterest.com/pin/904871750125886457, pinterest.com/pin/1013943303604517263), watched frame by frame on 8 Nov 2026: slow push-in, one sweep of light, the stone fills the frame. Ours follows the scroll instead of playing once (rule 3h.24). The boxes drifting by come from the recordings Tzvi sent on 9 Nov ("an opening like the first video i sent with different scenes and boxes moving"). Where the wow came from: those two Pinterest films, docs/inspo/moto-card-2026-10-21/hero-2500.webp (idea B's light across a dark product), Mobbin All Blues for the jewelry grid it leads to (https://mobbin.com/sites/sections/a5c384c1-a04c-4c45-b077-25f5f5d646d9), and 21st search "image magnifier lens zoom on hover" for the close look it grew from.
5. One sentence: you scroll and light crosses their diamond as the gold turns white, yellow, rose, four more of their pieces drift by, and the ring settles above their three words.

## Effects
- button: B11, from the effects library's button set, checked against a fresh 21st search "image magnifier lens zoom on hover": one light pass crosses the button on hover, as light crosses a polished band; press sinks it
- link: L4, from the effects library: the arrow sits in a small ring and moves on hover, says it leads somewhere
- tile: T6, from Mobbin Face Formula (https://mobbin.com/sites/sections/2c42876f-e42f-49dc-ba18-b6acc4bdf204): the piece's name and price stay put and "See this piece" slides up on hover
- reveal: R6, from docs/inspo/awwwards-categories-2026-10-18/half-the-sky-1-bust-grid-glow.webp (pale on pale, nothing jumps): blocks fade in place with no movement
- steps: S5, from Mobbin Face Formula's plain reading order: a plain numbered list, because ordering is three short things
- price: P3, from the effects library: the price on a small tag, like the tag on a piece in a jeweler's case
- heading: none
- other: X40, new, from 21st search "image magnifier lens zoom on hover" (the lens on a real object) carried to Tzvi's 9 Nov ask that every piece can be customised: the gold choice fades the piece into that gold with one pass of light, and the picture grows under the pointer
- other: X39, new, from the JMODELS and KANDA & CO ring films (Pinterest, 8 Nov 2026): a scroll film made in code from their studio pictures, light crosses their ring as the gold changes and four more pieces drift by in boxes
- touch: the section dividers are a fine line with one small round stone set in the middle, like a solitaire on its band; the last one's stone lights when the closing band arrives (from their own solitaire photos, and 21st Magnifier Lens's thin rim)

## Not alike
m-and-n-jewelry: different from all 17 other pages
