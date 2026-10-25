# Brief: what was generated for L.A. Cholent (rule 8, R8.7)

Recorded after the fact (25 Oct 2026). The brief rule came on 24 Oct; everything below was made 5-6 Oct and 23 Oct. Known from BRIEF.md, RULES.md, docs/site-reviews/2026-10-23/hero-shots.md and the git history; the scripts and prompts of the 5-6 Oct work were taken out of the repo on 9 Oct (commit 1597a84c) and the generation folder left on disk holds no prompt text.

## A. Three size-card tub shots, 23 Oct (in use: assets/tub-gold.webp, tub-olive.webp, tub-steel.webp)
- Reference: their one photo of four sealed tubs (assets/tubs.webp, from src/medium.jpg).
- Traits kept: the clear tub with cling film, the black label "L.A. CHOLENT By Rabbi Samuels", the recipe steps and "Yields approx. 3-4 pounds".
- Changed: camera and setting only. One tub, three-quarter view, on a dark stone slab with beans, a potato and a marrow bone (both in his recipe), one warm light, a colour ground per size card (gold, then plum (the Large card is olive since 22 Oct, see below), steel).
- Model: Higgsfield nano_banana_2, image_references, 2k. Jobs: gold b001b430, plum ad6b6ec3, steel 428e8013. Prompt text not kept. The steel shot's label said "Stir wall" and was fixed in code by copying the label from the gold shot.
- Comparison: gen/tubs-compare.jpg (their photo left, new shot right; the sheet shows the plum version, the build now carries an olive version for the Large card, added in commit 7ec83ec9 because the card turned olive on 22 Oct; how it was made and its job id are not recorded, and it is not on the sheet). Looked at 25 Oct: label layout and wording, tub shape and film match; the fill reads slightly smoother and more orange than their darker beans; the stone, beans, potato and bone are added props, not his product. Only one tub is shown where their photo has four.

## B. Scenery stills and clips, 5-6 Oct (assets/scratch.*, pot.*, table.*; the page opens on them)
- Made from words alone; no reference photo of his, because they are scenery and props, not his product: a messy scratch kitchen, a closed slow cooker in candlelight, a Shabbos table. No cholent in them (BRIEF.md: "the setting and props only").
- Stills first (pot.png, scratch.png, table.png, 2k upscales), then each film from its still. The model names, job ids and prompts were not written down anywhere I could find: not kept.
- Comparison: there is no product of theirs in these, so nothing to put beside their photo; the grade differs from their bright marble tub photo (R3g.14).
- Known fault (R3h.11): the three films are darker than rule 3h.11 allows (brightness.py, 25 Oct: pot whole 9 middle 14; scratch whole 30 middle 29; table whole 17 middle 32).
