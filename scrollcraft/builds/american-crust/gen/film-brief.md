# Brief: American Crust generated media (rule 8, R8.7)

Recorded after the fact (25 Oct 2026). The brief rule came on 24 Oct; the opening film was made 22 Oct and the hero shots 23 Oct. Known from commits 8472097d and e38ce384, gen/film.sh, docs/site-reviews/2026-10-23/hero-shots.md; prompt texts were not kept in the repo.

## A. Product hero shots, 23 Oct (assets/bagel-hero.webp, pizza-hero.webp)
- Reference: their flyer render of the bagel pack (src/owner/p02.jpg) and their tub photo (src/owner/p05.jpg).
- Traits kept: the clear clamshell with six bagel doughs, the yellow BAGEL DOUGH label; the round tub, the black PIZZA DOUGH label with its logo.
- Changed: camera and setting only: one product on a floured walnut block, mustard ground, one warm light from the left, everything-bagel seeds or tomatoes and basil beside it.
- Model: Higgsfield nano_banana_2, image_references, 2k. Jobs: bagel pack 05a4ba4e, pizza tub 7318e229. The tub label was misread three times (50GRAM, 60GRAM, 855-330-2730); their real label was cut from their photo and pasted back in code.
- Comparison: gen/hero-compare.jpg (their photo left, new shot right). Looked at 25 Oct: the pack label wording and layout match except the fine print, which is now unreadable blur on both; the tub label matches because it is their own. Differences: the pack is shown at three-quarter view on a block, the pack's own yellow ground is gone.

## B. Opening film, 22 Oct (assets/film/ frames from gen/film/opening.mp4)
- Three stills (gen/film/s1-boil.png, s2-bake.png, s3-brag.png, sheet gen/film/stills-sheet.jpg) "made from their own photos" (commit message), then three MiniMax H3 clips (c1-boil, c2-bake, c3-brag) joined by gen/film.sh; Tzvi approved the stills and clips on 22 Oct. Model name for the stills, job ids and prompts: not kept.
- Traits meant to be kept: the pale speckled bagel dough of their pack, their everything-bagel topping (sesame, poppy, onion, garlic).
- Comparison made 25 Oct: gen/film-compare.jpg (their baked bagels and their dough pack beside the generated brag and boil stills). Seen: the topping reads as the same kind (sesame and poppy on a golden crust); the generated bagels are rounder and more evenly seeded than theirs, the boil still shows dough rings without the visible speckle of their pack, and the oven tray and wooden board are invented scenery. They are the same product in kind, not the same objects; the film shows the process, not a product to be bought.

## C. The pizza at the end of the film, 23 Nov 2026 (gen/film/s4-end.png, c4-pizza.mp4)
- Why: the owner, via Tzvi: the opening "only showcases the bagels", he wants his pizza in it too. Tzvi approved the four steps and the object list before anything was made.
- Steps: 1 Boil, Bake and Brag as before; 2 the camera pulls back and slides left along the same table, the bagel board leaves past the right edge; 3 a baked cheese pie on its own board comes in past the left edge; 4 the film ends on the pie, the bagels at the right edge.
- Objects: the bagel stack and its board stay the same objects, only moving in frame; the pie is on the table all along, outside the frame at the start; nothing appears, changes shape or vanishes (checked at 8 fps).
- End still: alibaba/qwen-image-3/edit from the film's last frame (s4-start.png), prompt kept in gen/film.sh's comment; it came back square and was cut 16:9 through the plain wall and table only. Clip: minimax/h3/image-to-video, 6 s, start s4-start.png, end s4-end.png.
- The pie is not their own: there is no photo of a pizza made from their dough, so it is a plain classic American cheese pie. If the owner sends a photo of one of his pies, remake s4-end.png from it (one look per product, R3h.12).

## D. Four chapters, 24 Nov 2026 (replaces C; gen/film/c2-stretch, c3-bake, c4-brag)
- Why: Tzvi, 24 Nov: the pie added after Brag "just randomly shows the pizza at the end". He chose four chapters, Boil, Stretch, Bake, Brag, so the pizza runs through the story (Crust is in the name). "Boil. Bake. Brag." is the owner's own flyer line (src/owner/p04.jpg); the headline now reads "Boil. Stretch. Bake. Brag."
- Steps: 1 Boil as before (c1); 2 Stretch: two hands stretch the pizza dough round, a spoon spreads sauce in a spiral, a hand sprinkles mozzarella (s2-stretch-start -> s2-stretch-end); 3 Bake: one tray, three everything bagels beside the pie, the cheese bubbles (s3-bake); 4 Brag: the pie on its board, a slice lifted with stretching cheese, steam, the bagel stack beside it (s4-end, made for C).
- Objects: the sauce comes from the bowl in frame, the cheese from a hand entering from above; nothing else appears or vanishes (checked at 2 fps on each clip). The dough round, tray, pie and board keep their shape.
- Stills: alibaba/qwen-image-3/edit via starter/still.py: the stretch still from s3-brag (the film's own table and light; a second edit removed a garbled tub label and a lump of dough), the sauced round from the stretch still, the tray from s2-bake. All came back square and were cut 16:9 through plain wall, table or oven only. Clips: minimax/h3/image-to-video, 6 s each, via starter/clip.py.
- Phone: the 9:16 crop slides across Bake (bagels to pie) and Brag (pie to the bagel stack) so both products are seen (gen/film.sh).
- The pie and the hands are not the owner's own; a photo of his pie would let s3-bake and s4-end be remade from it.

## E. Into the oven, and Brag reframed, 25 Nov 2026 (replaces D's Bake and Brag; gen/film/c3a-in, c3b-bake, c4b-brag)
- Why: Tzvi, 25 Nov: the bake "just appear[s] cooked" with nothing going into the oven, and the bagels at the end were cut off with much of the frame empty. He left out a topping step: what happens between scenes may be skipped when it is obvious.
- Steps: Boil and Stretch as before; Bake: oven mitts slide the tray (raw pie, raw everything bagels) into the oven (s3-door -> s3-raw), then the bake speeded up, cheese melting and browning (s3-raw -> s3-baked); Brag: the pie on its board, the slice lifting, the whole bagel stack beside it, both in the right two thirds (s4-brag).
- Stills: qwen-image-3/edit via starter/still.py, 7 edits (two redos: a raw tray cut at the right, a baked tray that stayed raw). Fix that worked: pad the 16:9 picture to a square with grey bands and ask to fill them, so the model keeps the whole tray; then crop 16:9. Clips: minimax/h3, 6 s each, 3 clips.
