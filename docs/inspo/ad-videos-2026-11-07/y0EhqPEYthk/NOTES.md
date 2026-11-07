# How I Use AI to Copy Winning Ads (and Scale to 5x in ROAS FAST)

Channel: Janson Smith (Honest Brands, e-com agency). Length 13:42 (822 s). https://youtu.be/y0EhqPEYthk
Method: English auto-captions (transcript.txt, cleaned), frames pulled with ffmpeg from the 720p stream every 20 s plus bursts at 330-390, 530-760 s where ads are shown. Frames kept are the ex-*.jpg files here.

## The one transferable idea
Do not invent an ad. Collect 30-40 ads already proven (long-running, high impressions) in your niche and nearby niches, then re-make each one with your own product, keeping its layout, headline pattern and colour logic. Then take any winner and make 5-20 variations (colours, text, background, layout).

## Techniques
1. Pick proven ads by run time and spend, not taste. Meta Ads Library sorted by impressions high-to-low; Brand Search filters (10,000 monthly visitors, 200+ active ads). Narration only; frame ex-brandsearch-filters.jpg shows the filter panel (Traffic, Ad count, Adspend, Niches). Frame-verified for the tool, narration only for the logic.
2. Mood board of 30-40 ads (Milanote) plus Pinterest searches like "skin care ads lifestyle". Frame-verified: ex-moodboard-prompt-to-output-grid.jpg, ex-pinterest-skincare-ad-lifestyle-results.jpg. Pinterest has no performance order, so it is taste only.
3. Re-make = source ad image + your product photo + a long structured JSON prompt written by a custom GPT (Nano Banana Pro/2, batch of 2-4, 1:1, 1K). Fields seen: task "generate_recreated_scene_with_new_product", attached_references image_1 "new product reference image only", image_description, subject, product_integration ("tube centered vertically at the bottom of the frame..."). Frame-verified: ex-json-prompt-in-nano-banana.jpg. His claim that JSON beats a one-line prompt is shown with before/after (below).
4. Naive prompt ("swap the product in image 1 for the product in image 2, and amend the colour scheme") gives a product that looks pasted in. Frame-verified: ex-source-ad-vs-product-and-naive-prompt.jpg, ex-naive-nivea-swap-looks-pasted.jpg. JSON prompt result looks native (same checkerboard room, same pose, product scaled and grounded): ex-json-prompt-nivea-result.jpg (source: ex-pinterest-kdelle-source-ad.jpg).
5. The ad pattern itself (frame-verified, ex-final-loreal-ads-ribbon-sticker.jpg and the source in ex-source-ad-vs-product-and-naive-prompt.jpg): portrait ad, headline in 4 lines at top as a problem-plus-guarantee ("If your fine lines aren't gone in 15 minutes, get your money back"), each line on a white label box (variants: only key phrases highlighted in a dark-red box), one product centred in the lower half on a graduated same-colour ground, a ribbon behind it for depth, a round "50% OFF" sticker beside the product, tiny "Cyber Monday sale" line at the bottom. Whole palette taken from the packaging red.
6. Variation loop: feed the winner back and change colours, text, background, layout to get 5-20 ads. Narration only (the three red variants in the frame differ only in label style, ribbon and shade).
7. Kdelle source (frame-verified): a person in a coloured room reaching toward the product, product at the bottom, brand mark top-right, no price, no CTA. Pure lifestyle image ad.

## Discount
"Four and five-figure days in under a week", "5x ROAS": no evidence shown. Luxury Tools account-sharing ($30/month for 30-40 tools) is a sales pitch and likely breaks those tools' terms; ignore. The free GPT is a lead magnet. Product-swap results are shown only as stills, never with sales data. Copying others' ads wholesale carries brand/IP risk; copy structure, not wording or imagery.

## Comparison with our ads (canvas-drawn, owner photo cut out, yellow price sticker, footer band with link + QR)
Same already: round discount/price sticker, one product centred, single-colour ground, short headline.
Differences:
- Their headline is a claim or guarantee with a stake ("get your money back"), ours is a short label or name. Theirs reads as a promise; ours as a sign.
- Their text boxes: each headline line on a white highlight box, key words reversed out. Good legibility on any ground and a recognisable "ad" look.
- Depth props: ribbon behind, shadow under, gradient ground. Ours is flat with soft shadow.
- Palette pulled from the product pack; ours is brand-fixed.
- Their sources use people and hands in a staged set; ours has none.
- They have no footer band; ours is heavy on link/QR (needed for us, since no storefront ad click).
- They test 5-20 variants of one winner; we offer different designs but no one-click variants.
Adoptable free in code:
- Highlight-box headline style (white or dark label per line), with a "reverse key phrase" option.
- Palette from the cut-out photo (sample dominant colour, make a graduated ground and sticker colour).
- Gradient ground + a drawn ribbon/swoosh/arc shape behind the cut-out; a ground shadow ellipse.
- Promise-style headline templates ("Not happy? Don't pay", "Ready in 24 hours or free") chosen by the owner, plus a small "limited time" line.
- One-click variants: same ad with 3-6 palettes/label styles, owner picks.
Would need generation or a photographer:
- Matching a staged lifestyle scene (person, hand, coloured set) around the owner's product.
- Natural re-lighting and integration of the product into a new scene (the JSON/Nano Banana step).
- Real people/UGC.
