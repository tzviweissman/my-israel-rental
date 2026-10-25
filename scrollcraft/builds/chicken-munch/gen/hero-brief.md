# Brief: what was generated for Chicken Munch (rule 8, R8.7)

Recorded after the fact (25 Oct 2026). The brief rule came on 24 Oct; the work below was done 17-23 Oct. Nothing here was written before the generation. What is known comes from gen/film/keys.sh, gen/film/pipeline.sh, gen/still.py, gen/clip.py, docs/site-reviews/2026-10-23/hero-shots.md and the commits.

## A. Product hero shots, 23 Oct (all five kinds, in use on home and menu)
- Reference: his own photos (src/owner/oct19/cornflake.jpg, fruity.jpg, rice-krispie.jpg; Classic and Hot Poppers from his plate and bowl photos, commit 7ec83ec9).
- Traits kept: the kraft bowl, the coating on that kind, the sauce pot with his round CHICKEN MUNCH label and 055-331-6975 (Classic's lid number checked).
- Changed: camera and setting only, a dark plinth, its own coating scattered round it, one warm light.
- Model: Higgsfield nano_banana_2, image_references, 2k, one job at a time. Jobs: cornflake 7b66991b, fruity cdb5d2a9, rice krispie 966628ee (Classic and Hot Poppers job ids not recorded). Prompt text not kept.
- Comparison: gen/hero-compare.jpg (his photo left, new shot right; Classic and Hot Poppers are not on that sheet). Looked at on 25 Oct: bowl, coating colour and label wording match; the corn flake chicken is a smaller heap than in his photo and the fruity sauce lid leans differently; the rice krispie piece count differs. The coatings read as the same product.

## B. The generated film and its last frame (18-19 Oct): assets/box-full.webp is still on the page
- Made from words alone (no photo of his as reference): Higgsfield Soul stills (gen/still.py, higgsfield-ai/soul/standard) from the prompts in gen/film/keys.sh (k1 empty kraft box on a lemon yellow table, k3 box full of seven kinds of chicken), then MiniMax H3 image-to-video clips (gen/clip.py) chained in gen/film/pipeline.sh, prompts there. Exact prompts are in those two files.
- The film and picker built on it were removed on 18 Oct for his own photos (commit 8a49d777: "no generated food", the film kept in gen/index-v5-film.html), but assets/box-full.webp, the last frame of the film, is still the third colour room on index.html and menu.html.
- Comparison made 25 Oct: gen/box-full-compare.jpg (his box photo left, box-full right). Differences seen: his sauce pots carry the round CHICKEN MUNCH label, the generated pots have none; the pretzel coating in the generated frame looks like alphabet pasta, his is dark and ricey; the glossy orange glazed pieces and the plain breaded nuggets are not in his photo; his box has a window lid. It does not pass "result compared beside their photo": it looks like his food in kind only.
