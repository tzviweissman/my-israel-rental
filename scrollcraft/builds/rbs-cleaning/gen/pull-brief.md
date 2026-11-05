# Pull-back film brief (R3h.18, 19, 23): from the clean view back into the clean apartment

Replaces the dissolve at the end of the squeegee film. Tzvi, 5 Nov: "the scene outside the windo doesnt smoothly zoom out to see the nice clean apartment thats what it should do".

Approved by Tzvi: 5 Nov 2026, "yes thats it, go ahead", to the six steps below; then "make there more furniture to make it feel more homey", the same move into a furnished room; then "the scene and the stone look kind of fake make a more realsitic scene", the same move with a real-looking view (gen/view/).

## Steps
1. The squeegee has finished and the clean view of hills and olive trees fills the screen (the film's own last frame).
2. The camera starts moving straight back, smoothly, with no fade or cut.
3. The window frame comes in from the edges of the screen: you were standing right at the glass.
4. Still moving back, the white walls, ceiling, shiny floor, sofa and table come into shot.
5. It slows to a stop on the whole bright apartment, the same hills through the window (gen/pull/room-d.png).
6. In code: the headline and button appear on the calm part of the room.

## Every object
- The view: there from the first frame, behind the glass the whole way, ends through the window.
- Window frame: comes in past all four edges of the screen, stays.
- Ceiling, walls, shelf, side windows: come in past the screen's edges as the camera backs away, stay.
- Floor, rug, coffee table, vase of olive branches: come in past the bottom edge, stay.
- Sofa, cushions, throw, floor lamp, wall pictures: come in past the left and bottom edges, stay.
- Armchair, side table, plant, sideboard with framed pictures: come in past the right and bottom edges, stay.
- Nothing fades, no person in shot.

## How it really happens
A dolly out as real-estate videographers shoot it, read from Aryeo's guide (https://blog.aryeo.com/?p=11545) and HomeJab's gimbal tips (https://homejab.com/how-to-shoot-real-estate-video-pro-camera-gimbal-tips/): start close on one thing, then back away slowly and level on a gimbal so the room is revealed around it. I read these guides; no video of this exact shot was found. From the geometry of the move: near things (sofa, table) pass the edges fastest, the frame shrinks steadily, verticals stay straight, and the speed eases in and out with no jolt.

## Looks real
The first view (smooth hills, a model village, even blocks of stone) looked fake to Tzvi. The stills now come from gen/view/a-0.png, compared at full size with real photographs of the Judea hills on Alamy (https://www.alamy.com/stock-photo/judea-hills.html, looked at only, none used): scrubby slopes, dark pine, exposed rock, plain white blocks on the ridge, rough weathered stone. A second still (gen/view/b-0.png) came out painted and was not used.

## Key moment
The window frame first entering the screen, where a full-screen view turns into a window. It gets this clip of its own, separate from the squeegee, between its own stills: before (gen/pull/start-c.png, no frame in shot) and after (gen/pull/room-d.png, the whole room).

## How it is made
- End still: one generated furnished room (gen/pull/homey-0.png), with the film's own view put through its window in code (gen/pull/compose-homey.py), so the hills match all the way. The framed photos it drew held made-up people; they hold the hills instead.
- Clip: MiniMax H3 through the API, start and end frames, 8 s, 16 credits by get_cost on 5 Nov.
- Used now: gen/view/pull.mp4, between gen/view/pull-start.png and gen/view/room.png (gen/view/make.py). Takes before it, kept in gen/pull/, had the first fake-looking view:
- First take (gen/pull/a.mp4) not used: the start frame had a thin dark edge, which became black bars across the glass that later faded. Second take from a slightly tighter crop of the squeegee film (gen/pull/start-b.png). Its take (gen/pull/b.mp4) not used either: a small twig at the edge of the view grew into a long dark line across the sky. Third take from a tighter crop without the twig (gen/pull/start-c.png, gen/pull/c.mp4): clean, but Tzvi asked for a homier room. Fourth take into the furnished room (gen/pull/d.mp4): it moved too fast from 1.96 to 3.46 s, so that stretch is slowed in code (gen/pull/d-timed.mp4, gen/film.sh).
- check-clip, then watched at 8 fps against the steps. The room still dissolves in on the last frames to stay crisp.
