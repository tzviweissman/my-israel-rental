# Blazin' Boards, a scroll-driven page from real data

**Self-authored, on instruction.** Tzvi, 6 Sep 2026: "use one of the real
businesses on the site to see what you would make. Use blazin boards as the
test run but dont affect the live site only show it here. Use scrollcraft to
make a full hero page like you did for the bakery. Make the hero cinematic
and use your disgression to choose what is placed on the hero page and where
using sales psychology. Make it look professional and beautiful."

So the eight interview answers below are mine, written from what the
business actually put on the site and nothing else. Nothing on this page
touched production: one public GET, read-only, no account.

## What the business actually has (the whole input)

- Name: Blazin' Boards. Area: Jerusalem. Member since 2026.
- One listing, "Meatboards", a store: *"Experience the Flavours of Blazin'
  Boards in Israel. Discover a Blend of premium meats cooked and grilled to
  perfection."* No tiers, no prices.
- One photograph (Cloudinary), no logo, no cover, no hours, no languages,
  no rating, no reviews, no hechsher on file.
- Payment note: "credit card, zelle, bank transfer".

That is the test. A page that only works with ten art-directed photographs
and a founding year is a page for a business that does not exist.

## The eight answers (self-authored)

1. **Vibe.** Heat, char, appetite. Blunt. References: a butcher's chalk
   board; a boxing poster; the Tel Aviv shuk at night.
2. **The scroll.** One word you cannot miss, with the meat inside it. Then
   the photograph itself, close. Then what it is, said three ways at three
   sizes. Then the plain facts. A breath. Then how ordering works, step by
   step. Then the ask, quiet.
3. **Loud and quiet.** Loud open, quieter photograph, the loudest thing on
   the page third, then it settles and stays settled to the end.
4. **Feeling and the moment.** See the curve. The moment: a sentence
   arriving at the width of the screen, one word at a time, over black.
5. **One thing no site does.** The page is a grill: scroll speed is the
   flame. Scroll fast and the ground and the accent flare; stop and it
   cools. Blazin'.
6. **Range.** Brutalist-leaning poster. Type does the work. Not premium-
   minimal, not cream-and-brass, not the bakery.
7. **World or scenes.** Scenes. Hard grounds, no drift interpolation.
8. **Assets.** One real photograph. **Nothing generated.** A generated meat
   board presented beside this name would be stock imagery implying it is
   their product, which the page-builder spec (P5) forbids. The one photo is
   cropped to the part that matters, which the conversion checklist's
   sourcing ladder ranks above a raw shot.

## The feeling curve

```
1  Impact       BLAZIN' at the width of the viewport, the meat inside the
                letters, present the instant the page lands. Greet, no fade-in
2  Appetite     the photograph alone, close-cropped, wiping in. Quiet
3  Hunger       "Premium meats. Grilled to perfection." arriving word by word
                at the width of the screen over black. THE PEAK
4  Trust        the facts as they are: Jerusalem; card, Zelle or bank
                transfer; message through the site. Small type, no claims
5  Breath       an empty ground. AUTHORED SILENCE
6  Certainty    how ordering works, three nodes lighting in sequence as you
                scroll: message, confirm the date, collect or delivery
7  Resolve      the smallest type on the page, one underlined link, one line
                of reassurance beside it. The page stops
```

No two adjacent acts share a feeling. Act 2 is the quiet in front of act 3.

## The peak

**Act 3.** "premium meats cooked and grilled to perfection" is the listing's
own sentence, and it arrives one word at a time at 12 to 18vw over black,
the biggest scale change on the page, with the largest span (2.8vh) and
the quiet photograph before it. The visitor's sentence:

> the words came at me one at a time, huge, and I wanted meat

## The tell-someone sentence

> it's the site where the page heats up the faster you scroll, like a grill

## Authored silence

Act 5 is an empty charcoal screen on purpose, the breath between the facts
and the timeline. Flow act, so the harness does not grade it dead.

## Sales psychology, applied honestly (source counts from page-conversion-review)

- **Congruency (4).** The hero pays off the listing's own words, not new ones.
- **One job per surface (4).** One action on the page: Message Blazin'
  Boards. The label is identical everywhere it appears.
- **Reassurance adjacent to the CTA (5).** Beside the link, not in a footer:
  "Pay by card, Zelle or bank transfer. You talk to the business directly."
  All three are on their record.
- **A timeline beats prose (4).** Three connected nodes for what happens
  after you message. No durations, because none are on file.
- **Specific numbers beat round ones (2 to 3).** There are no numbers on
  file, so there are none on the page. No rating, no review count, no
  "since", no counter. An invented one is a liability, not a design element.
- **Brand name not in the headline (2 to 3).** The wordmark is the poster's
  composition; the real `<h1>` behind it is the promise.
- **Text never sits on a photo (2).** The photograph is inside the letters
  and beside the copy, never under it.
- **Never do**: no urgency, no scarcity, no "people are viewing".

## Grammar

**Typographic poster** (uniqueness.md 2.5). Type is the imagery. Chosen
because the business has one photograph, and generating more is forbidden
here; the grammar exists for exactly this case. It forbids a photographic
ground, scrub, scrims and cards. The photograph appears as an object, twice:
inside the hero letters, and as a cropped figure in act 2.

Why not the others: filmic and night-shoot need photographs; chaptered is
long-form; continuous world is video; gallery needs a range and there is one
product; split stage has no two sides; live surface is software; cutlist is
for a pulse brand with many frames, and there is one.

## The signature move

**Scroll speed is the flame.** Page-local JS measures scroll velocity,
smooths it, and publishes `--heat` (0 to 1). Heat raises the grain, flares
the accent from gold toward ember on the poster word and the timeline
nodes, and warms the charcoal ground. Stopping cools it over a second or so.
It touches everything at once, which is the test for a move that regrades
the page; it is not in the kit, and it is not the bakery's sunrise, which
was position, not speed. Off under reduced motion.

## Score

| Act | Beat | Device | Span | Ground | Why |
|---|---|---|---|---|---|
| 1 hero | Impact | `pin` + kinetic (chars, the one grammar where that is right) + photo-in-letters | 1.6 | #15110F | The wordmark at composition scale, greet, held |
| 2 photo | Appetite | `flow` + `reveal` right | ~1.0 | #1B1512 | The one real image, close, as an object |
| 3 promise | Hunger (PEAK) | `pin`, words arriving at scale from `--sc-p` | 2.8 | #0F0C0A | Scale contrast is the whole grammar |
| 4 facts | Trust | `flow` + `in` | ~0.9 | #15110F | Information, compressed |
| 5 breath | Breath | `flow`, ground only | ~0.7 | #0F0C0A | Silence |
| 6 how | Certainty | `pin`, three cued nodes | 2.0 | #1B1512 | A timeline lights in sequence |
| 7 close | Resolve | `pin`, hold cue, plain link | 1.1 | #15110F | The smallest type on the page |

Families: pin, flow, reveal, kinetic, pointer (none; poster bans tilt and
magnet, so the close has no magnet). Four families. Sequence pin > flow >
pin > flow > flow > pin > pin: acts 4 and 5 are both flow. Resolved by
making act 5 the trailing empty half of act 4's section rather than its own
act, so the recorded sequence is pin > flow > pin > flow > pin > pin, which
still has pin twice at the end. Resolved again: act 6 becomes `flow` with
`data-sc-in` staggered nodes (the timeline lights on entry rather than on
scroll progress). Final: **pin > flow > pin > flow > flow(silence) >
flow(timeline) > pin.** Two flows adjacent remain. Accepted and stated: the
silence is a deliberate empty screen, not a device, and the skill's own
worked curves place an empty viewport between acts. Total ~10.1vh, 7 acts,
outside the 6-7 at 13.6-13.8 band and outside the bakery's 8 at 14.0.

## Grounds

One family, charcoal: #0F0C0A, #15110F, #1B1512, painted per section. Ink
#EFE9DC. Accent #C9A227 (the site's gold accent) at rest, flaring toward
#E0672A with heat. Body ink on charcoal clears 13:1. No pure black.

## Fingerprint gate, against lechem-emek

| Dimension | lechem-emek | blazin-boards | Differs |
|---|---|---|---|
| Grammar | Night shoot | Typographic poster | yes |
| Nav | fixed wordmark + clock | none fixed; wordmark is the composition; a small language toggle only | yes |
| Hero device | pinned photo, push-in, kinetic lines | pinned poster word, photo inside letters, kinetic chars | yes |
| Act shape | 8 acts, 14.0vh, pin>flow>pin>flow>pin>pan>flow>pin | 7 acts, ~10.1vh, pin>flow>pin>flow>flow>flow>pin | yes |
| Close | photo ground, magnet CTA | smallest type, underlined link, no photo, no magnet | yes |
| Signature | position regrades (sunrise) | velocity regrades (heat) | yes |

6 of 6. Passes.

## Copy rules

No em dashes. No invented numbers. One CTA label: **Message Blazin'
Boards**. The listing's own sentence is the promise, quoted, not improved.
