# Lechem Emek, a scroll-driven bakery page

Interviewed 6 Sep 2026. Four of eight answers given by the human; the other
four were left blank and are answered below in the brand's voice, each one
marked **(delegated)** so nobody mistakes it for something Tzvi said.

## The eight answers, verbatim

1. **Vibe, references.** "bake shop". No references given.
2. **The scroll, in their order.** "hero image, then whatever is normal on a
   hero page but make it for one page because i wont have multiple pages they
   should be wowed from the hero make a cinematic scroll with a baked good"
3. **Loud and quiet.** (delegated) Quiet and dark to open, one held breath
   before the peak, the peak is the loudest thing on the page, then bright and
   easy to the end.
4. **Feeling and the one moment.** (delegated) See the curve and the peak
   below.
5. **One thing no site does.** (delegated) The scroll is the morning: the page
   starts at four in the dark and the sun comes up as you reach the counter.
6. **Range.** (delegated) Editorial. Photographs and a serif, restraint, real
   copy. Not premium-minimal: it is a bakery, it is warm, and it is not
   pretending to be a watch.
7. **One world or distinct scenes.** "distinct"
8. **Assets.** "nothingb to ad for now". So: the ten photographs generated
   earlier today (frontend/public/images/mockups/bakery/, copied to assets/),
   the locked brand, and nothing else. No footage, no key, no spend.

## The feeling curve

One line per act. Emotion first, then what on screen causes it.

```
1  Stillness     04:00. One dark photograph of the oven, pushing in under the
                 hand, a headline that arrives line by line and leaves
2  Intimacy      The hands. A column of plain copy about flour, water, salt,
                 and a photograph that wipes up beside it
3  Patience      05:15. The shaping held still while three lines cross:
                 by hand, by whoever is in, and nobody has agreed to hurry
4  Held breath   06:40. Almost nothing. Ember ground, the rack barely there,
                 one line about steam. AUTHORED SILENCE, see below
5  Awe           07:00. The door. Hard cut from ember to daylight, the counter
                 opens in an iris, the clock snaps to seven, the whole page
                 has become morning. THE PEAK
6  Appetite      The counter travelling sideways: four things, each labelled
                 with its name, its nickname and its price, nothing else
7  Warmth        The shopfront, the hours, the address, the hechsher. Plain
                 facts in a list, the photograph beside them
8  Resolve       The Shabbat table. One line, one button, the page stops
```

No two adjacent acts share a feeling. Act 4 is deliberately quieter than
act 3 so act 5 has something to arrive from.

## The peak

**Act 5.** The sentence a visitor would say:

> it was dark and warm like the inside of an oven and then the shop door
> opened and it was morning

It gets the largest span on the page (3.4vh against nothing else above 2.8),
the silence before it (act 4), and the only `iris` reveal on the page.

## The tell-someone sentence

> it's the site where you scroll through the night in a bakery and the sun
> comes up as you reach the counter

## Authored silence

Act 4 (`#bake`) is a near-empty screen on purpose: ember ground, the cooling
rack at low opacity, one short line. It is a flow act so the harness does not
grade it as dead scroll, and it is the quiet that makes the cut to daylight
read as a change rather than as another section.

## Grammar

**Named: "Night shoot".** A photo essay in distinct scenes, opened by a
full-bleed photographic hero, with a persistent time-of-morning readout as
the only chrome, and the ground family cut from dark to light exactly once,
at the peak.

Why not the eight:

- *Filmic one-shot* forbids hard cuts between grounds. The peak IS a hard
  cut, and the human said "distinct".
- *Chaptered editorial* is the closest fit for distinct scenes, and its hard
  per-chapter grounds are used here. But it forbids the full-bleed hero and
  any media above the fold, and the human's first answer was "hero image,
  they should be wowed from the hero". That one forbid is disqualifying.
- *Continuous world* requires worldflight video and is the fragile, expensive
  one; the human asked for distinct scenes, not one place.
- *Typographic poster* forbids a photographic ground, which throws away the
  ten photographs that were generated for this.
- *Gallery / catalog* bans a hero claim; the counter borrows its label
  schema for one act, but the page is a story with a counter in it, not a
  catalogue.
- *Split stage* has no two-sided argument to resolve.
- *Live surface* is for software.
- *Rhythmic cutlist* is for pulse brands and bans `pin`, which the peak
  needs.

What this grammar forbids: drift interpolation between grounds (grounds are
painted per section and cut, per devices.md section 10); pinned crossfade
type as the default act; more than one dark-to-light cut; a wordmark-and-CTA
bar (the clock is the chrome); a scroll cue; section numbers.

## The signature move

**The scroll is the sunrise.** A small fixed readout, top-start beside the
wordmark, shows the time of morning: 04:00 at the top of the page, advancing
with scroll, snapping to 07:00 at the door and holding. It is not decoration.
The same scroll value (`--dawn`, 0 to 1 across the night acts) regrades every
photograph in the dark half (brightness and warmth), warms the ground from
near-black to ember, and picks the accent stop. One value, and everything on
the page moves with it, which is the test uniqueness.md sets for "one
control that regrades the whole page". Page-local JS reading `scrollY`
against the door act; the engine is untouched.

The readout doubles as the tell-someone sentence made visible.

## Score

| Act | Beat | Device | Span | Ground | Why this one |
|---|---|---|---|---|---|
| 1 hero | Stillness | `pin` + kinetic + a push-in from `--sc-p` | 2.0 | #14100C | The photograph is the open; a slow push under the hand is the camera already moving |
| 2 making | Intimacy | `flow` + `in` + `reveal` up | ~1.0 | #1A1410 | A column of plain copy reads as a document, and that contrast is what makes the pins land |
| 3 shaping | Patience | `pin`, three crossing cues | 1.8 | #221812 | The frame holds still while the words move, which is what patience looks like |
| 4 bake | Held breath | `flow`, ground only, one line | ~0.8 | #2A1A10 | The silence before the drop |
| 5 door | Awe (PEAK) | `pin` + `reveal` iris + kinetic | 3.4 | #EFE9DC | A wipe is a change of state; the only iris on the page |
| 6 counter | Appetite | `pan` + `tilt` on items | 2.8 | #F7F3EA | Sideways reads as breadth: what there is, not why |
| 7 visit | Warmth | `flow` + `in` + `reveal` left | ~1.0 | #EFE9DC | Facts are information, not experience; compressed |
| 8 close | Resolve | `pin` + `magnet` on the CTA | 1.2 | #EFE9DC | The page stops moving and starts responding |

Families used: pin, flow+in, pan, reveal, kinetic, pointer. Six. No family
twice in a row (pin, flow, pin, flow, pin, pan, flow, pin). No scrub: no
clip exists and none was generated. Total about 14.0 viewport-heights across
8 acts, outside the 6-to-7-acts-at-13.6-to-13.8 band.

## Grounds

Two families, one hard cut. Dark: #14100C, #1A1410, #221812, #2A1A10. Light:
#EFE9DC, #F7F3EA. Ink is limestone on dark and #23201B on light, restated as
`color` on each subtree. Accent is one hue at two stops: #C9A227 on dark,
#A9831C for large display words on light. Body on light is ink, never gold.

## Fingerprint gate

Registry is empty (first build in this workspace). Nothing to clear. Row
appended after shipping.

## Copy rules kept

No em dashes. No invented numbers (1998 and the hours are the demo
business's own facts; no counters). One CTA label everywhere: **Message the
bakery**. Hero holds four elements at most.
