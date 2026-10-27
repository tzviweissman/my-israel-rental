# Opening photo in the screen's shape (27 Oct 2026, written before generating)

Tzvi: "we cant make it fill the screen and not zoom in?" then "yes and you should always do this". The skirts photo
(assets/skirts-2k.webp, 2160x2544, tall) filled a wide laptop screen only by cutting off half its height.

Plan: extend the photo with more of the same plain room, never crop the outfit.
- Laptop canvas 16:9 (4522x2544): her photo untouched at the right, 2362 px of new wall and floor on the left,
  where the headline sits. The doors split at the screen's middle, just left of the black skirt.
- Phone canvas 9:16 (2160x3840): her photo at 1944 px wide near the top, new wall above, new floor below where the
  words sit.
- Only wall and floor are added: same cream wall, same light floor with the soft sun shadows. No new objects.
- After the fill, her original pixels are pasted back over their own place (feathered seam), so the skirts, bag,
  block and vase cannot change. Checked beside the original at full size.

Tried first (27 Oct): the outpaint tool, twice. It is not a pure extension: at 21:9 it cut off the leggings at the
bottom, and at 16:9 it re-made the whole scene (bag moved to the floor, plants and a second plinth added). Rejected.

The store photo behind the doors (shop.webp) is her real store, so it is NOT extended: inventing more of a real
place is untrue. It keeps its crop (the counter and rails stay in view) and is marked data-crop-ok.

## What was made (27 Oct)
- Laptop 16:9 (assets/skirts-wide.webp): one nano_banana_2 fill of the padded canvas; it kept her photo in place, and
  her original pixels were pasted back over it with a 90 px feathered seam. Seam checked at full size.
- Phone 9:16 (assets/skirts-tall.webp): the first fill (photo in the middle, padding on all sides) shrank and moved the
  scene, and pasting her photo back left ghost edges; rejected. The second canvas put her photo at the very top with
  floor below and thin side strips; the fill kept it in place (SIFT: scale 1.000, 2 px off), pasted back, sides trimmed.
- Extra wide 21:9 (assets/skirts-ultra.webp), for screens wider than 17:10: the 21:9 fill failed on Higgsfield, so the
  plain wall and floor at the left of the laptop version were stretched sideways instead; the skirts are not touched.
- Credits: two rejected outpaints (4), three fills (4.5), one failed fill (refunded if Higgsfield refunds failures).
