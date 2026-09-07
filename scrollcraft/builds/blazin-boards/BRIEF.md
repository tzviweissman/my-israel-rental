# Blazin' Boards, a scroll-driven page from real data (revision 2)

**Self-authored, on instruction.** Tzvi, 6 Sep 2026: "use one of the real
businesses on the site to see what you would make. Use blazin boards as the
test run but dont affect the live site only show it here. Use scrollcraft to
make a full hero page like you did for the bakery. Make the hero cinematic
and use your disgression to choose what is placed on the hero page and where
using sales psychology. Make it look professional and beautiful."

Then, 7 Sep 2026, on the first revision: "it has too many blank pages and
doesnt show any of the products and the cinematic isnt a real cinematic it
just zooms in a tiny bit. make it look nice using scrollcraft skill and you
can generate pictures and cinematic scroll videos using higgsfield mcp."

So revision 2 changes three things and keeps the rest. The grammar moves
from typographic poster (which forbids video, and is why the hero only
zoomed) to filmic one-shot. The products get their own act. The empty
screen goes. Nothing on this page touched production: one public GET,
read-only, no account.

## What the business actually has (the whole input)

- Name: Blazin' Boards. Area: Jerusalem. Member since 2026.
- One listing, "Meatboards", a store: *"Experience the Flavours of Blazin'
  Boards in Israel. Discover a Blend of premium meats cooked and grilled to
  perfection."* No tiers, no prices.
- One photograph (a flyer with the headline baked in), no logo, no cover,
  no hours, no rating, no reviews.
- Payment note: "credit card, zelle, bank transfer".

## Assets, and what is honest about them

- **Their photograph, animated.** The board cut out of their flyer was
  uploaded to Higgsfield and given a slow tracking move (Kling 3.0, 5s).
  The hero clip is their actual product, moving.
- **Six generated stills** (Nano Banana, one style preamble reused
  verbatim) and **one generated macro clip** (brisket being cut, Kling 3.0).
  These are illustrations. They are not photographs of Blazin' Boards'
  food, and a line at the foot of the page says so. Tzvi approved the
  spend for this test run; on a real deploy these would be replaced by the
  business's own photographs, or the act would use whatever they upload.
- Kosher-consistent by construction: every prompt excluded dairy, pork and
  shellfish, because the flyer carries a hechsher stamp.

## The eight answers (self-authored, unchanged where still true)

1. **Vibe.** Heat, char, appetite. A boxing poster's confidence, a
   steakhouse's light.
2. **The scroll.** The board itself, moving under your hand. Then the
   boards you can order, sideways. Then the cut, close, with their words
   over it. Then the plain facts and how ordering works, on one screen.
   Then the ask.
3. **Loud and quiet.** Loud open, a browsing beat, the loudest thing on the
   page third, then it settles and stays settled.
4. **Feeling and the moment.** See the curve. The moment: the knife has
   just gone through the brisket and the camera is going in, slowly, and
   the visitor is the one moving it.
5. **One thing no site does.** Scroll speed is the flame. Kept from
   revision 1: it was the one thing that was not the problem.
6. **Range.** Editorial with a filmic open. Photographs, one serif, one
   accent.
7. **World or scenes.** One shot. Grounds drift, never cut.
8. **Assets.** Above.

## The feeling curve

```
1  Appetite     their board, tracking slowly along the meat under the wheel,
                the promise in the corner, present the instant the page lands
2  Choice       four boards travelling sideways, each named by what is on it,
                no prices because there are none, "message for a price"
3  Hunger       the brisket cut, the camera pushing in, their words crossing
                the frame one line at a time. THE PEAK
4  Certainty    the facts and the three steps side by side on one screen
5  Resolve      a full table under a spotlight, one button, the page stops
```

Five acts, no two adjacent with the same feeling, no empty screen anywhere.
Act 2 is the browsing beat that makes act 3 land.

## The peak

**Act 3.** The largest span on the page (3.0vh against 2.6 for the hero),
the second and last scrub clip, dwell set so the camera settles exactly
where the last line of their sentence holds. The visitor's sentence:

> the knife went through the brisket and I was the one pushing the camera in

## The tell-someone sentence

> it's the site where you scroll the camera along the meat board yourself,
> and the page heats up the faster you go

## Sales psychology, applied (source counts from page-conversion-review)

- **Congruency (4).** Hero headline is the listing's own promise.
- **Show the product (the ask).** Four boards in a rail, the real listing
  name "Meatboards" as the heading, each board labelled by its contents.
- **No prices on file, so no prices (2 to 3).** Every board says "Message
  for a price." A made-up price is worse than none.
- **One job (4).** One label everywhere: **Message Blazin' Boards**. The
  bar carries it, the close carries it.
- **Reassurance adjacent to the CTA (5).** Payment methods and "you talk
  to the business directly" sit beside the button, not in a footer.
- **Timeline beats prose (4).** Three nodes beside the facts.
- **Text never sits on a photo without a local scrim (2).** Every line over
  video has a scrim under it; the harness measures the worst frame.
- **Never do**: no urgency, no scarcity, no counters, no rating.

## Grammar

**Filmic one-shot.** Chosen because the human asked for a real cinematic
and the poster grammar forbids `scrub`. Burden of proof, as the skill
requires: chaptered editorial forbids media above the fold; typographic
poster forbids video (revision 1, rejected); gallery bans a hero claim;
split stage has no two sides; live surface is software; cutlist bans `pin`
and is for pulse brands; continuous world needs a worldflight chain, and
one continuous flight is the fragile, expensive route the skill warns
against when two scrub acts and a rail do the job. Night shoot is the
bakery's and would fail the gate.

Forbids, kept: no chapter numbers, no progress readout, no hard cuts
between grounds (every act declares `data-sc-drift`, the engine
interpolates), one entry point.

## The signature move (kept)

**Scroll speed is the flame.** Velocity smoothed into `--heat`; an ember
layer, the grain and the accent flare together and cool when the scroll
stops. Off under reduced motion. Now it also sits over the video.

## Score

| Act | Beat | Device | Span | Drift | Why |
|---|---|---|---|---|---|
| 1 hero | Appetite | `scrub` (their board) + kinetic lines, greet | 2.6 | #15110F | The camera under the reader's hand is the strongest open there is |
| 2 boards | Choice | `pan` + `tilt`, four items | 2.2 | #1B1512 | Sideways reads as breadth: what there is |
| 3 cut | Hunger (PEAK) | `scrub` (macro) + three crossing cues | 3.0 | #0F0C0A | The only place the camera goes in close; their words over it |
| 4 facts | Certainty | `flow` + `in`, two columns | ~1.0 | #15110F | Information, compressed to one screen |
| 5 close | Resolve | `pin` + `spotlight` + `magnet` | 1.3 | #0F0C0A | The page stops moving and starts responding |

Families: scrub, pan, tilt, kinetic, flow+in, pin, pointer (spotlight,
magnet). No family twice in a row. Two scrubs, the maximum. About 10.1vh
across 5 acts, outside the 6-to-7-at-13.6-to-13.8 band and outside the
bakery's 8 at 14.0.

## Fingerprint gate, against lechem-emek

| Dimension | lechem-emek | blazin-boards r2 | Differs |
|---|---|---|---|
| Grammar | Night shoot | Filmic one-shot | yes |
| Nav | fixed wordmark + clock, no CTA | fixed wordmark + one CTA + toggle | yes |
| Hero device | pinned still, push-in, kinetic | scrub clip, kinetic | yes |
| Act shape | 8 acts, 14.0vh, pin>flow>pin>flow>pin>pan>flow>pin | 5 acts, ~10.1vh, scrub>pan>scrub>flow>pin | yes |
| Close | pinned photo, held cue, magnet | pinned photo, spotlight, magnet | no |
| Signature | sunrise (position) | heat (velocity) | yes |

5 of 6. Passes. The registry row for blazin-boards is revised in place,
because it describes this build and revision 1 no longer exists as a page.

## Copy rules

No em dashes. No invented numbers. One CTA label. The listing's own
sentence is the promise, quoted, not improved. Illustration note in the
close, small, honest.
