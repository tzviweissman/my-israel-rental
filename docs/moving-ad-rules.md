# Moving-ad rulebook

Tzvi, 16 Nov 2026: "we should have our own set of rules for moving ads. we should take whats applicable from regular
ads but im sure theres a lot more to moving ads that we can learn."

Written from 130 moving ads kept in the motion library (`docs/inspo/pinterest-ads-2026-11-02/motion/`, open
`index.html`; 29 scored 5) out of about 420 watched: Dribbble and Pinterest animated ads on 16 Nov, then 215 more
regular video ads (CGI and AI product commercials, food, drink, dessert and snack ads) the same evening, and Tzvi's
two references, Kenetik (t01) and Lay's (t02). Codes in brackets are rows in that library. The steps that are
followed are A10.1 to A10.14 in `docs/ad-rules-checklist.md`; `docs/static-ad-rules.md` section 24 points here.

## What a moving ad keeps from the still-ad rules

All of these apply unchanged, to the whole film and above all to its last frame:

- **Honesty** (static rules 5, 14): nothing invented; every copy of the product matches the real one; a stay shows
  only its own real photos, never a generated room.
- **Their logo, the link and the QR** (20, 8): the last frame carries them, the QR at least 150px and still for over
  3 seconds.
- **The headline** (2, 16, 18): on the last frame, 2 to 6 spoken words that say the offer; five written, then cut.
- **Phone shape** (8): story safe areas, nothing under 30px, readable on its ground, Hebrew and English.
- **The pro look** (13, 15): the product is the hero on a set or a one-colour ground, styled like a shoot.
- **A 5 every time** (19): judged beside the library, the end frame (A10.7) and the movement (A10.8).

What changes: a still ad freezes one moment (A11.4); a moving ad **acts the moment out**. Its picture is not a
layout with things in it, it is one event with a cause, a middle and an end.

## M1. One idea, acted out, chosen by name

Every 5 does one thing to the product, and that thing can be named in a word. Choose it before anything is drawn,
from the library's ideas, and say why it fits this offer:

| The offer | Ideas that fit | Library 5s |
|---|---|---|
| A dish or product made of parts | **build**: the layers drop in one by one; **morph**: the ingredients fly together and become it | n07 (burger), n10 (juice), t01, n01 |
| Flavours or varieties | **tap / swap**: one tap or wipe changes the product and the whole ground's colour | t02, n12, n29 |
| Sizes | **grow / stack**: one item grows step by step, or they stack up, each with its size and price; never the tap | (Tzvi 16 Nov: "the lays style is better for different flavors not as much for different sizes") |
| A sauce, glaze, syrup or drink | **pour, acting on something**: the pour falls through the headline or onto the product and changes it (the word drips, the product gets coated); a pour alone is a 4: every pour-only ad in the library scored 4 (n14, n18, n45, n46, n60) | n03 (a bar rides a chocolate ribbon), Chicken Munch's DRIPPING HOT. (17 Nov 2026) |
| One hero product | **split and re-form**: it breaks apart and comes back whole; **drop**: it lands for a reason | n06 (chocolate), p034 |
| Food that is cooked or served | **chain**: pack to pan to plate, one continuous event | n04 |
| A range or a menu | **swap surroundings**: the product stays put while everything around it changes | n11 |
| A place or a service | **reveal**: a door, a lid or a cover opens onto the real photo; **before and after** on one wipe | d31, p096 |

One idea per ad. Two ideas in eight seconds read as neither (one-cause-one-motion).

## M2. It opens mid-action

Frame one is already moving: the ingredients are already falling, the bag is already landing. Never a logo sting,
never an empty ground that fills in. A chat shows frame one before anyone presses play (A10.2), so frame one is
also an ad. `check-moving-ad.py` fails a video where nothing changes in its first second.

## M3. Everything moves for a reason

A thing falls because it was dropped, splits because it was cut, flips because it was tapped, swirls because it is
poured. Nothing floats about for no reason; nothing slides in from the side just to arrive. The cause can be seen:
a finger, a knife, gravity, a pour (n03: the bar rides a chocolate ribbon).

Before anything is built, write one sentence saying what moves in depth or what causes each beat. The MyIsraelRental
ad's first cut had tiles sliding into slots "just to arrive" and scored 4; its second, where each colour pulse from the
stay swings a ring of real businesses round it in depth, scored 5 (17 Nov 2026).

## M4. The product is big through the action

During the action the product fills at least half the screen's width, centred, sharp. Small products in a busy
scene read as nothing on a phone at feed speed. It is the same product as the still and the listing
(one-look-per-product).

## M5. A change every beat

About one change every half second to a second: a layer lands, the colour flips, the next flavour arrives.
Between changes the product still lives (sways, bobs, turns a little), so the film never stops before its end hold.
`check-moving-ad.py` fails a stall of more than a second before the end.

## M6. Words wait

During the action, at most one big word or one short line per beat, slammed or wiped in on the beat (the flavour's
name, BEAT THE HEAT). The headline, the offer and the foot arrive on the last frame. Everything reads with the sound
off; there is no voice and no paragraph. The name, link and QR are not on screen during the action (a small logo may
stay): with them there from the first frame, L.A. Cholent and American Crust read as posters with an effect (18 Nov
2026). Until the last beat the screen is the product and the action (p107, n06 in the motion library).

## M7. One colour world per beat, the whole screen

The ground is one saturated colour taken from the product, the flavour or the brand, edge to edge. When the beat
changes flavour the whole ground changes with it (a circle from the tap, a wipe), never a coloured box in a white
frame.

## M8. It ends whole, on a clean hero frame

The film ends on the product whole and big, on a plain ground, with the headline, name, link, QR and logo, still
for 1.5 to 3.5 seconds (A10.1, A10.3). If the idea broke it apart, it ends re-formed.

## M8b. Score the end before the full recording

Draw a few test frames with `record-moving-ad.mjs <folder> <name> '' <t,t,t,7.9>` and score the last one beside the
library (A10.7) before recording all 240 frames. Chicken Munch's first cut scored 4 only because its drips sat behind
the chicken; that was found after a full recording.

## M9. It loops

A GIF and a story loop. The last frame leads back into the first: the same ground colour, or the product in the
same place, so the restart reads as one more beat and not as a jump cut. Best of all, the loop is itself the action:
the cake slice is eaten bite by bite and is whole again (p107), the cup empties popper by popper and refills.

## M10. Real things move as real footage

Steam, a pour, a splash, cheese pulling, a bite: a generated clip of their own product (A10.10), not code. Code
draws the words, the colour wipes, the drops of cut-outs, the logo and the QR.

## M11. Length

6 to 10 seconds (8 is our default). A GIF has no length limit of its own; the limits are where it is shown: Google
display animations stop at 30 seconds and 150 KB; Facebook, Instagram and WhatsApp turn GIFs into video, so send the
MP4 where a video is taken and keep the GIF (540 wide) for chats.

## M12. The template follows the idea

`node scripts/new-moving-ad.mjs <name> <slug>` for a free idea, `--tap` for flavours or varieties
(`docs/ads/gen/_kit/tap.html`), `--clip` to lay a generated clip under the words. Sizes are not a tap (M1).

## M13. Someone does something to the product (Tzvi, 18 Nov 2026)

In Chicken Munch and American Crust nobody acts: sauce falls, or words appear. The ones people remember have an actor:
a drawn stick man climbs into a real rice bowl and dances (d09), a finger taps the bag to change the flavour (t02). A
hand, a person or a small drawn character living on the real photo does the thing: a doodle sneaks poppers out of the
cup one at a time. Never a generated customer (A5.4). The blueprint names the actor and what it does (A10.15).

## M14. Several shots, not one locked picture (Tzvi, 18 Nov 2026)

L.A. Cholent's eight frames (`docs/ads/la-cholent-moving-frames.jpg`) are one table; only the words change. A product
that is made, cooked or used in steps is shown in two to four shots, each its own picture: the grill, the cheese
melting, the burger landing (d01); pack to pan to plate (n04). For L.A. Cholent: the tub tipped into the pot, steam
under the lid, a full bowl served. Each shot is the same product (one-look-per-product), cut on a beat. One locked
picture is allowed only when the idea is one continuous action in it (a pour, a build, a morph) (A10.16).
