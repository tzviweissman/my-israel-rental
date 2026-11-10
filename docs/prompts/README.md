# Prompt library

Start every new picture or clip prompt from the closest one here (Tzvi, 10 Nov 2026: get it right
first time instead of regenerating from mistakes). Copy its shape, then swap in the new item's own
traits read from its crop. The shape is rule 3w.9 in `docs/page-generation-rules.md`; the slot template
is in `docs/inspo/videos-2026-11-01/README.md`.

**Adding one:** only a prompt whose result was used, with the number of takes it needed and the file
it came from. A prompt that needed fixes goes in with the fix that made it work. Many briefs say
"prompt text not kept"; from now on every gen script keeps its prompt in the file, as these do.

## Every prompt fills these slots

| Slot | Example words |
|---|---|
| Shot length (video) | "6 s, one continuous shot, no cuts" |
| Lens and camera | "tiny probe lens", "camera locked", "rises straight up and tilts down in one soft curve" |
| The item, from its crop | "the same kraft paper bowl", "four clear sealed tubs with the dark label on each lid" |
| Layout (pictures), in percent | "top third empty", "bowl rim at about 55 percent of the height" |
| One action, and when | "four pieces leap up, frozen mid-air", "a thin wisp of steam rises from the vent" |
| Material | "thick, opaque, matte to satin, never glassy", "visible crumbs and pores" |
| Light | "warm key light from the upper left", "from behind and above", "falling to near black at the corners" |
| Do not | "no added or removed pieces, no hands, text, sparks, glow, particles or smoke" |

No praise words ("ultra sharp", "perfect", "stunning", "powerful", "real physics"): they describe
nothing physical, and design words ("neat", "clearly readable") make the food look like stock.

## Video

### Camera flies over the product as a landscape (Finest Cuts, 1 take)

`scrollcraft/builds/finest-cut/gen/clip.py`, MiniMax H3 reference-to-video, 6 s, 2K, three references
(their crust crop, their cups crop, the drawn composition).

> One continuous shot on a tiny probe lens, one smooth motion-control move. The camera flies slowly
> forward, very low, a centimetre above a huge landscape made of this exact fried chicken from the
> reference pictures, so the ridges of crust rise like golden mountains on both sides and in front, with
> very deep perspective. It glides between the ridges and rises slightly over a crest, and ends looking
> over the three round sauce cups with the black logo lids from the reference, lying ahead like lakes in
> the landscape, as in the composition reference. + KEEP

### Camera rises to a top view between two stills (Finest Cuts, 1 take)

Same file, MiniMax H3 image-to-video, start and end stills given.

> One continuous shot, one smooth motion-control move. From low over the three sauce cups the camera
> rises straight up and tilts down in one soft curve, climbing higher and higher, until the whole board is
> seen from directly above on black stone, exactly as in the last picture, where it stops. + KEEP

**KEEP**, the suffix both share (the material, light and "Do not" slots, written once):

> Real photographed fried chicken: thick, opaque, golden crumbed crust with visible crumbs and pores,
> matte to satin, never glassy. Only the camera moves; the food stays perfectly still and keeps its
> shapes. Warm light on the food from behind and above, the far distance falling into black. Thin wisps
> of steam drift slowly left. Do not add or remove pieces, do not add hands, utensils, text, sparks, glow,
> particles or smoke walls. No cuts.

### What not to do (Chicken Munch crunch, 5+ takes)

`scrollcraft/builds/chicken-munch/gen/crunch/*.sh`: one sentence per clip, the action described with
"powerful", "hundreds of" and "real physics, ultra sharp", with no lens, no timing, no material and no
"Do not" list; the first blast barely moved, so an end still had to be made to force it. Two actions
in one clip (split, then explode) also break rule 3h.19.

## Pictures

### Product on a set with an atmosphere (L.A. Cholent status ad, 1 take)

`docs/ads/gen/la-cholent-status/gen.py`, nano_banana_2, 2k, 9:16; image 1 their tubs, image 2 the kind
of slow cooker.

> Professional food advertising photograph, vertical. Image 1 is the real product: keep it exactly, the
> four clear plastic sealed tubs with the brown raw cholent kit inside and the dark label on each lid, the
> same four tubs, the same labels. Image 2 shows the kind of slow cooker: a brushed stainless steel slow
> cooker with a black glass lid and black handles. Composition, strictly: the TOP THIRD of the picture is
> empty warm dark background, a softly lit dark kitchen wall, nothing in it. The slow cooker stands on a
> white marble counter in the middle of the picture, centred, lid on, filling about 60 percent of the
> width, its lid top at about 40 percent of the picture's height. The four tubs from image 1 stand in
> front of it on the marble, in two rows of two, slightly angled so their labels face the camera, their
> front edge at about 78 percent of the picture's height. Below that, only marble. Moment: a thin, soft
> wisp of steam rises from the lid's vent. Light: warm low candle-coloured light from the left, a gold
> glow on the steel, a gentle fall to dark at the edges, real depth. No text, no letters and no logos
> anywhere except the tubs' own labels; no hands, no people, no other props, no food outside the tubs.

### Pieces in the air above the product (Chicken Munch status ad, 3 takes, fixed)

`docs/ads/gen/chicken-munch-status/gen.py`, nano_banana_2, 2k, 9:16; image 1 their bowl photo. Take 1
left no room for the headline; take 2 made square, glowing pieces with dry crumbs
(`docs/ads/chicken-munch-pieces-vs-real.jpg`). The fix, now in the prompt: the layout in percent, and
each piece in the air described as a copy of the real ones (shape, size, colour, glaze), lit from the
same side, with nothing else in the air.

> Professional food advertising photograph, vertical. Image 1 is the real product: keep it exactly, the
> same kraft paper bowl and the same glazed popcorn chicken, the same deep navy blue cloth under it.
> Composition, strictly: the TOP THIRD of the picture is completely empty smooth dark navy backdrop,
> nothing in it. The bowl stands on the navy cloth, centred, filling about 65 percent of the width; its
> top rim is at about 55 percent of the picture's height and its bottom at about 78 percent; below it only
> the navy cloth, empty. Moment: like popcorn popping, four pieces leap up out of the bowl, frozen in
> mid-air close above it, all of them between 36 and 55 percent of the picture's height. Every piece in
> the air is a copy of the pieces in Image 1's bowl and must look exactly like them: a round, puffy,
> irregular lump of boneless chicken about the size of a walnut, never square, never boxy, never
> flat-sided, no spiky flakes; deep amber-red, the same colour as the pieces in the bowl; completely
> coated in a thick, wet, glossy sticky glaze, the same as in the bowl. Nothing else in the air: no
> crumbs, no flakes, no drops, no drips. Light: one warm key light from the upper left and soft fill from
> the front, so every piece is lit from the front like the bowl's pieces, with a gentle warm rim; no
> glowing or see-through edges; the navy falling to near black at the corners, real depth, the leaping
> pieces sharp. No text, no letters, no logos, no labels, no hands, no people, no props.
