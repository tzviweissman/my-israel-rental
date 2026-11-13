# You are the coffee: Gremier's opening film (12 Nov 2026)

Tzvi's idea, on the POUR / PLAY coffee site (docs/inspo/pinterest-coffee-2026-11-11/pour-play-key-frames.jpg): "make the
steep look like the waves and see the brown coffee dropping into the waves and turning them brown then have it
whirlpool and come out into the cup and zoom out and see their coffee bar so people feel like they were the coffee".
Sketch: gen/journey-sketch-2.png (laptop beside phone, rules 3aa.13). Rules 3aa.8 to 3aa.14 and the product's-journey
option.

## Steps
1. Grind: their black grinder taken apart in the air inside a huge terracotta "COLD" on the cream ground, one letter in
   front of it; beans pour into the hopper, fine grounds fall out of the bottom.
2. Steep: the camera falls with the grounds into waves of clear cold water that fill the whole screen, edge to edge, so
   the visitor does not yet know it is the inside of their jar (Tzvi, 12 Nov: "so people dont yet realize that they
   were in the jar"); where the grounds land the waves turn brown. The word STEEP is the page's, in code.
3. Swirl: all the water now brown, the waves turn into a whirlpool.
4. Out: the whirlpool narrows into one stream that pours down into a glass of ice, where milk is already curling.
5. Serve: the camera pulls back from that glass, past the syrups and the milk carafe, to their whole coffee bar, landing
   exactly on their own photo (assets/open-wide.webp).

## Every object
- Grinder: there from the first frame; leaves upward out of the picture as the camera falls with the grounds (C1).
- Beans: pour in from above the picture into the hopper (C1), become the grounds.
- Grounds: fall out of the grinder (C1), land on the waves and dissolve into them (C2). Never vanish: they become the brown.
- Water: the waves are the water inside their jar, seen very close; there from C1's end to C3, it becomes cold brew.
- The cold brew: stays the same liquid: waves (C2), whirlpool (C3), stream into the glass (C3), in the glass (C4).
- Glass of ice with milk: the one at the front left of their photo; seen first as the stream fills it (C3), ends where it is
  in their photo (C4). The milk is already in it (their photo shows the milk curl), so nothing appears.
- Dispenser, milk carafe, syrups, cups, straws, table, terrace: only seen in C4 as the camera pulls back, where they
  stand in their photo; there all along, outside the close shots.
- Words: COLD is drawn into the first still; STEEP, SWIRL and SERVE are the page's words, in code (the water fills the
  frame, nothing to write on). If a clip bends COLD, it goes in code too.

## How it really happens
Dry grounds landing on cold water float a moment, wet, then sink in dark curling clouds, like ink, and the water turns
brown slowly from where they landed (docs/inspo/pinterest-coffee-2026-11-11/pour-play-key-frames.jpg, the grounds falling
through the pour-over; our own W2 clip, gen/world/W2-sheet.jpg). Stirred or draining liquid forms a whirlpool: a spiral
that narrows into a funnel. Cold brew poured over ice in a glass with milk: the dark stream pushes the milk into
swirling ribbons (their own photo, assets/open-wide.webp, front left glass).

## Key moment
The steep: the grounds landing on the waves and turning them brown. It has its own clip (C2), from its own before still
(gen/world/j2.png, grounds just landing on clear waves) to the whirlpool, shared with no other step.

## Looks real
Stills compared at full size with their own photo of the coffee bar (assets/open-wide.webp, from
https://gremiercoffee.co.il) and with the previous film's real-looking grinder still (gen/world/w1.png). Coffee opaque
and deep brown, real ice, water clear, no glow, no glassy coffee.

## Clip plan
Model minimax/h3/image-to-video through the API, 6 s, 2K, 16:9. Credits checked with get_cost on 12 Nov 2026: 12 a clip,
2 a still. Two tries per clip at most (3h.19.5).
- C1 grind to waves: start gen/world/j1.png, end gen/world/j2.png (waves filling the frame, made again 12 Nov after the
  first had a glass rim and a wall; the first C1, already paid, is kept as J1-old). Edges: the grinder whole in the
  middle, beans above; at the end water edge to edge. Same item: the black grinder, its colour and size as w1.png. One change: the camera falls with
  the grounds from the grinder down into the water. 12 credits.
- C2 steep (key moment): start = C1's last frame. One change: the grounds sink in clouds, the waves turn brown and begin to
  turn into a whirlpool. 12 credits.
- C3 out: start = C2's last frame. One change: the whirlpool narrows into one stream that pours down into the glass of ice
  and milk. 12 credits.
- C4 back: start = C3's last frame, end their photo (gen/world/bar-end.png from assets/open-wide.webp). One change: the camera
  pulls back from the glass to the whole coffee bar. 12 credits.
- In code: the step words on the page if the film bends them; the scroll scrub (slides.js, one film in place); the
  closing words and button over the last frame; the shop below.
- Trim: each clip's first 0.25 s (clipchain); any frame where something appears from nowhere is cut, not remade.
- Total about 52 credits: 4 clips (48) and 2 stills (4); plus 12 for the first C1 and 2 for the first waves still.

Approved by Tzvi: 12 Nov 2026 ("Yes, make it", after the five-scene sketch gen/journey-sketch-2.png)

## Remade opening, 12 Nov 2026 (Tzvi: "its still zoomed in and i dont see the coffee grinder come apart or the beans being dropped in the top"; "make the waves look like a wavy ocean filling the screen ... make a viewer feel like they are in it")
1. GRIND: their black grinder whole, wide, clear space above (gen/world/g0.png); beans pour into the hopper, then it pulls apart into its pieces and the grounds start to fall (K1). The word is GRIND, not COLD (rule 3aa.20).
2. COLD: the camera falls with the grounds to the waterline of a wavy ocean across the whole width, swells rolling toward the camera, the cream page above the waves (K2, ends on gen/world/o1.png). COLD is the page's word, in code.
3. STEEP: the grounds turn the ocean brown, swell by swell, the camera riding with it; it begins to whirl (K3).
4. SERVE: the whirlpool pulls the camera down and pours out as one stream into their glass of ice, ending on the old glass frame (gen/world/J3-last.png) so J4, the pull-back to the bar, is kept (K4).
Clips K1 to K4, minimax/h3 2K 16:9, 12 credits each; stills g0 and o1, 2 each: about 52 credits.

Approved by Tzvi: 12 Nov 2026 ("Yes, make it", after the five numbered ocean steps)

## The phone film, tall 9:16 (13 Nov 2026, Tzvi: "do the 60")

The same five steps and the same motion as the laptop film (approved 12 Nov), made tall for a phone held upright so the
ocean fills the screen. gen/chain-tall.json: K1t to K4t and J4t, the same prompts; only the framing is tall.
- Starts and ends: g0t, o1t, J3t from gen/tall_layouts.py with the wide still as the second reference (6 credits, 2 each);
  J4t ends on their own photo extended tall (assets/open-tall.webp, made 10 Nov), their pixels untouched.
- Looked at beside the wide stills: the same grinder, the same ocean, the same glass; g0t has no floor under the grinder.
- How it really happens and Key moment: as in the laptop film above, step for step.
- Cost: five clips at 12 credits, 60.

Phones asked: 12 Nov, the wide film on cream offered with tall clips at 12 credits each; Tzvi 13 Nov: "do the 60"
