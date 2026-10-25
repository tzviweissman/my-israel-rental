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
