# Gremier Coffee: the cold brew journey film (11 Nov 2026)

Tzvi turned down the steeping-jar opening ("don't make a scroll when nothing but a small part of the screen moves"),
sent a Pinterest coffee site he loved (docs/inspo/pinterest-coffee-2026-11-11), approved the five-step sketch
(gen/journey-sketch.png), asked for the grinding to show fine powder, and approved the six-step sheet
(gen/journey-detail.png): "Yes, make the film".

## Steps
1. GRIND: beans pour from above into a black burr grinder. Word: GRIND.
2. Fine powder streams out of the grinder's outlet; the camera falls with it.
3. STEEP: the grounds fall into a jar of cold water, cloud through it, and the water turns to deep cold brew. Line: "Brewed for hours, not minutes."
4. POUR: cold brew runs from a glass dispenser's tap over ice into a tall glass.
5. SWIRL: cold milk pours in and curls through the coffee; the camera pulls back...
6. ...to their own coffee bar photo, which is the top of the page: "Cold brew & coffee bars", Shop cold brew.

## Every object
- Beans: from above the frame, into the grinder's clear hopper (still 1); they end inside it.
- The grinder: still 1 and its outlet in still 2; it does not move.
- Powder: out of the outlet (still 2), falling down out of the frame; next seen falling into the jar (still 3).
- The jar of water and ice: still 3 and 3b (same jar, made from still 3 in code); the clouds spread until it is even dark brew.
- The dispenser, its tap, the glass and ice: still 4; the stream runs from the tap into the glass.
- Milk: from above the frame into the glass (still 5), swirling; it stays in the glass.
- Their coffee bar: their own photo (assets/open-wide.webp), the last frame; their bottles, badge and dispenser are never redrawn.
- No hands, people, text or logos are generated. Words are the page's own, over the film.

## How it really happens
Cold brew is ground coffee steeped in cold water for hours, then served over ice with milk. A burr grinder takes beans
in at the top and drops fine powder out of the bottom; dry grounds hitting water sink in dark clouds, like ink. From the
Pinterest coffee site (docs/inspo/pinterest-coffee-2026-11-11): one unbroken shot, the camera riding down with what
falls, what comes out of one step falls into the next. From the commercial food shoots in
docs/inspo/videos-2026-11-01/real-food-filming.md: one smooth motion-control move per shot, liquids opaque, light from
the side and behind.

## Key moment
The steep: the water turning from clear to deep cold brew. It has its own clip, between its own before still
(gen/journey/steep-3.png, grounds clouding into clear water) and after still (gen/journey/steep-done.png, the same jar
hours later, evenly dark), shared with no other step.

## Looks real
Each generated still was compared at full size with their own photographs from their site, the same sunlit oak-table
shoot: https://gremiercoffee.co.il/products/classic-liter-lifestyle-v2.webp (the iced glass with milk, the oak and wall),
https://gremiercoffee.co.il/bar/gallery/01-sunlit-closeup-v3.webp (the dispenser). The first steep glowed orange and the
first dispenser was a white appliance; both were made again (gen/journey-brief.md). Coffee is opaque, ice real, no glow.

## Clip plan
Model minimax/h3/image-to-video through the API, 6 s, 2K, 16:9, start and end stills. Price last checked 6 Nov 2026:
12 credits a clip (the API does not report the charge per call). Two tries per clip at most (3h.19.5).
- C1 grind: start gen/journey/grind.png, end gen/journey/powder.png. Edges: beans above, outlet below. Same item: the black
  grinder. One change: the camera descends down the grinder as beans pour in, to its outlet streaming powder. 12 credits.
- C2 steep (key moment): start gen/journey/steep-3.png, end gen/journey/steep-done.png. Same item: the jar. One change:
  the grounds stop and the dark clouds spread until the water is evenly deep cold brew; the camera barely moves. 12 credits.
- C3 pour: start gen/journey/tap-2.png, end gen/journey/pour.png. Same item: the iced cold brew glass. One change: the
  camera moves down and in to the glass as the tap stream stops and milk pours in from above. 12 credits.
- C4 back: start gen/journey/pour.png, end gen/journey/bar-end.png (their photo, assets/open-wide.webp as PNG). One change: the camera pulls back and the
  glass settles into their coffee bar on the sunlit table. 12 credits.
- In code: powder to jar (still 2's falling powder dissolves into still 3's falling grounds, both falling the same way),
  and jar to dispenser (still 3b dissolves into still 4 as the camera keeps drifting down); the words per step, the
  scroll scrub (frames on a canvas, starter film.js), the last frame held as the page's top.
- Trim: each clip's first and last 0.3 s where the model eases in and out; any frame where something appears from nowhere.
- Total about 48 credits for the clips, plus the 7 stills already made (about 14).

## Slides (12 Nov 2026)
Tzvi, after his recording of the Pinterest site: "each scene doesnt really smoothly connect ... they are each on their
own slide so its not just fading away", and yes to gen/slides-sketch.png. The opening becomes four full-screen slides;
the scroll pushes each up as the next comes in from below; what falls crosses the seam in the middle of the screen. No
dissolves. Slide 1 C1b, slide 2 C2 (kept), slide 3 C3b, slide 4 C4 (kept).
- C1b grind: start gen/journey/grind.png only (no end still, so the grinder never turns into another one; C1's start
  ghosted between two grinders). One change: beans pour into the hopper and the camera glides down the same grinder to
  its outlet, where fine powder streams out and falls out of the bottom edge. 12 credits.
- C3b pour: start gen/journey/pour-start.png, end gen/journey/pour.png. Same item: the tall iced glass. One change: the
  cold brew stream from the top fills the glass and stops, then milk pours in from the top and swirls. 12 credits.
- In code: the slide push (each slide's clip scrubbed while it is held, then the next slides up over it), the words.
- Trim: the first and last 0.25 s of each clip.

## One world (12 Nov 2026, second try at slides)
Tzvi: "do you understand why the video i sent look better" and "yes do this for gremier", after the six sites in
docs/inspo/videos-2026-11-12 and the Pinterest coffee site. One world: every slide on one plain warm cream ground like the
page (#F6EEE3), soft daylight from the left, no table edges or walls; one camera that travels DOWN the whole way. The objects
stay the same objects because each clip starts on the last frame of the one before (W1 -> W2 -> W3 -> W4):
- W1: start gen/world/w1.png (a black grinder alone on the cream, beans falling into it from above). The camera travels down
  the grinder; fine powder streams out of its outlet and falls on down.
- W2: start the last frame of W1. The camera keeps falling with the powder into one tall clear glass jar of cold water below;
  dark clouds bloom and the water turns to deep cold brew.
- W3: start the last frame of W2 (the model made the vessel a tall glass of ice, so the tap step is dropped): the same glass
  darkens to even cold brew, then milk pours in from above and swirls.
- W4: start the last frame of W3, end gen/journey/bar-end.png (their photo). The camera pulls back from the glass to their bar.
Slides: each clip is a slide held by the scroll; between them the next slide pushes up from below, and because each starts on
the last frame of the one before, the seam shows the same picture on both sides. Huge words (GRIND, STEEP, POUR) behind the
coffee in code (mix-blend multiply, so dark coffee covers them and they show through clear glass). About 48 credits.

Approved by Tzvi: 11 Nov 2026 ("Yes, make the film", after the six-step sheet); slides approved 12 Nov 2026 ("Yes, make it")
