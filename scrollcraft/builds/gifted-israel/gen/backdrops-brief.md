# Brief: the set behind every item (rule 8, R8.7)

Tzvi, 6 Nov 2026: "to have a beautiful product image UI we need more than just on a nice stand", look at the Pinterest product pictures; then "yes do all 161" after a test on four items.

## What the Pinterest pictures have
A deep, rich colour; one strong light with real shadows; a real world round the piece (stone, cloth, branches), blurred; walls and a floor, so depth; the piece the sharpest thing, with clean edges. Studied in the main checkout's docs/inspo/pinterest-ads-2026-11-02/, the 65 strongest product ads.

## Reference
No item goes to the generator: clear Lucite and small Hebrew print get redrawn wrongly. Only empty sets are generated; their own photo is laid over one in gen/backdrops.py.

## Prompts (Higgsfield API, higgsfield-ai/soul/standard, 1:1, 1080p)
gen/scene.py: seven colours, one per category, each with a standing set (a block at eye level) and a surface set (seen from above, for pieces photographed lying down). Terracotta and honey and olive and plum were approved on the four-item test.

## Changed, in code
The set's light falls gently on the piece, with a contact shadow, a cast shadow and a thin rim of light; its colours stay theirs. Solid pieces are laid on whole. Clear pieces (CLEAR in gen/backdrops.py, by eye) keep their print and show the set through the white.

## Result
gen/look/backdrops-sheet.jpg: all 161. Generations: 4 sets on the test, then 10, then 9 redone because the surface sets came back with table edges and two blocks were the wrong shape, then 1 more block: 24 stills. The surface sets were then cropped to remove stray edges. Price could not be read first: no price check is available to this session.

## For next time
A new piece needs no credit: put its plain photo in src/plain, cut it (backend/utils/cutout.py) into src/cut, run gen/backdrops.py and look at it on the sheet. A clear piece goes in CLEAR. The pile in the opening stays cut out, with no set.
