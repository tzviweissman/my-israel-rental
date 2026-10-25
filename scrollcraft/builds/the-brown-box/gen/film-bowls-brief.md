# Brief: the Brown Box generated media (rule 8, R8.7)

Recorded after the fact (25 Oct). The film and stills were made on 16 Oct, the bowl hero shots on 23 Oct; the brief rule came on 24 Oct, so no brief existed before. Everything below is read from gen/*.sh, gen/*.py and docs/site-reviews/2026-10-23/hero-shots.md.

## Three kinds of generated media
1. **The opening film** (gen/film.sh, gen/frames.sh): five keyframe stills from Higgsfield soul/standard (text only, no reference photo), then five MiniMax H3 image-to-video clips, each starting on the last frame of the one before and ending on the next keyframe. Exact still prompts and clip prompts are in gen/film.sh. Still before video: yes.
2. **The bowl photos** (gen/bowls.sh, soul/standard, 1:1, text only, one prompt per bowl, exact text in the script) and the topping tiles (gen/tops.sh, same model). Their menu photos were not used as the reference then.
3. **The five bowl hero shots** (23 Oct, nano_banana_2, 2k): classic b7c5e9c8, tropical bb2bfe05, sunrise 7c1f2df5, superfruit 1f5207a9, own 2d808b99, each edited from the bowl photo of item 2. Prompt text not kept.

## Reference crop and traits kept
For items 1 and 2 there was no crop of their food: the bowls were described in words (rows of banana, blueberries, granola and so on), not taken from their photos. That is the gap this record shows. For item 3 the reference was the generated bowl of item 2; the bowl, its clear lid ring and the toppings in their rows were kept, only the setting changed (travertine plinth, warm wall, loose fruit as props).

## Result compared with their photo
`film-compare.jpg`: their menu photo of the acai bowl (left, strawberries and apple on acai in a clear tub) against the last film frame (right, a bowl with banana, blueberries, granola and peanut butter drizzle inside a gold-brown box). They do not match: the film shows a generic invented bowl and a gold box, not their real bowl and packaging. Their real photos are small (239 px for the boxes). `bowls-compare.jpg`: the five hero shots against the bowls they were edited from; toppings, bowl and lid ring match, the setting changed as planned. Open for Tzvi: the film bowl and box are invented, not theirs.
