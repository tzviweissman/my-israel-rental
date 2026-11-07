# Claude Code makes INSANE Cinematic AI Ads (full tutorial)
Channel: Duncan Rogoff | Learn Claude Code. Length 13:19 (799 s). Maker: a former art director (Apple, PlayStation, Nissan) selling a $9 community and a prebuilt "Ad Studio" skill.
Method: auto-captions (en-orig, de-duplicated into transcript.txt), then 34 frames pulled from the 720p stream every 15-40 s, viewed as contact sheets (sheetA-D.jpg); 10 best frames saved here.
Note: this is a VIDEO-ad (15 s Seedance clip) workflow, not static ads. Most on-screen "ads" are AI-generated film stills.

## The one transferable idea
"Strategy first, pixels last." Before any image: one line on what the brand really sells, who buys, the off-brand blacklist, then 3 concepts, pick one, THEN the look. Random prompts make random ads.

## Techniques
1. Research brief first: true value (why people really buy), audience psychographics (not demographics), design DNA sampled from the product photo, blacklist of clichés to avoid. Frame-verified: redbull-brief-hold-my-red-bull.jpg ("True value... sells permission to send it", "Blacklists"). Narration: North Face "people buy it because it's a famous jacket... says I have good taste", age 18-32.
2. Three concepts, one picked, built on an idea/joke: North Face = "Same Jacket, Different Mountain" (every epic mountain shot cuts to the boring city twin; same pose, same yellow jacket). Frame-verified: concept-three-options-A-B-C.jpg. Honest, funny, shareable truth about real users.
3. One named hook per ad: "HOLD MY RED BULL" - outstretched hand holding the can in frame, product is the hero, viewer is the rider (POV, no face). Frame-verified: redbull-pov-hand-holding-can.jpg, redbull-brief-hold-my-red-bull.jpg.
4. Palette sampled from the product itself (summit gold / charcoal / white, Red Bull silver+cobalt+red); one brand line to end: "Made for mountains. Worn everywhere." Frame-verified: northface-closeup-logo-tagline-end-card.jpg (huge condensed caps over a tight logo close-up, text at bottom).
5. Consistency by locked words: "consistency tokens" (exact descriptor words reused verbatim in every prompt) plus the approved hero frame as reference. Frame-verified: hero-casting-three-takes.jpg; prompt text on screen. Mood board of 3 stills before shots.
6. Look defined in 5 dimensions + keyword line: lighting, colour palette, film stock/texture, camera lenses/angles, depth of field; plus an "authenticity spec" (grain, halation, real flaws) so it reads as real. Frame-verified: prompt 04 on screen (sheetC.jpg). Narration for the rest.
7. Story as four acts (Tension, Turn, Payoff, Brand), 8-12 shots in 15 s, shots 0.5-1 s fast, 2-3 s holds; the model critiques its own list: thumbnail test (shots must look different at small size), spine test, variety test, time budget. Frame-verified: four-act-story-arc-prompt.jpg, storyboard-12-shot-grid.jpg (12 frames, mountain/city twins, final = fit-check then brand).
8. One timestamped prompt: "[00:00-00:03] Scene one: camera motion + action" in Seedance 2.0 yields the whole cut ad; storyboard frames passed as references; music prompt (~110 BPM instrumental) baked in with ffmpeg. Frame-verified: prompt7-timestamped-seedance.jpg.
9. Human approval gate before spend: review stills, tell it which frame to fix, then "approved" to render video. Narration only.

## Discount
$9 community/skill pitch, "agencies used 8 people", no results data (no CTR/ROAS/conversion shown), the final ad was "pretty good" by his own words. Opus/Higgsfield/Seedance cost never quoted. Nothing about static ad layout, price/offer display, QR or CTA buttons.

## Versus our ads
Pros here (video): story and idea first, real-feeling photography (grain, POV, real city), a joke/contrast concept, the product always the hero in someone's hand, one end card with logo + tagline, consistent palette from the product. Ours: headline + cut-out photo + sticker + footer band, no concept step, a template each time.
Differences: (a) they pick an IDEA per brand (twin/contrast, POV) while ours picks a layout; (b) a person or hand is in the frame, ours has none; (c) real-looking environment, ours a flat colour ground; (d) palette sampled from the product photo; (e) blacklist of clichés per brand; (f) 8-12 shots with rhythm vs one frame; (g) a single closing line + logo.
Adoptable free, in code: sample palette from the owner's photo (ground, sticker, headline colour); a "contrast pair" layout (two photos split: before/after, "mountain vs city" style, e.g. kitchen vs plate, old flat vs new flat); a tagline end line; a per-business blacklist + one-line "what they really sell" prompt to the owner before choosing words; a thumbnail test (shrink to 150 px; do two designs look alike?); a short slideshow/story from 3-4 of the owner's own photos with timed text (code-drawn, no generation); one hook phrase in the headline style ("Hold my ...").
Needs generation or a photographer: hand/POV shots, person in scene, real-looking locations, mood boards, consistent hero person across shots, the 15 s film and music.
