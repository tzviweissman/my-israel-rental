# Blazin' Boards, a scroll-driven page from real data (revision 3)

**Self-authored, on instruction, then answered.** Tzvi, 6 Sep 2026: build a
cinematic page for a real business, Blazin' Boards, shown locally only.
7 Sep, on revision 2: "the cinematic scroll that you keep doing isnt doing
anything it just zooms ... for example i like the eat hungry tiger website
... it wasnt the color i liked it was the cinematic jar rolling as the
website scrolled. you dont need to do this exactly but unique ideas like
this are what make an award winning site." Then, to four questions: motion
like the reference (the product itself moves), their photographs first
with generated fill only where a gap exists, the real boards with prices,
one bold brand colour. Then: "you dont need any hebrew for now lets keep
this simpler."

Nothing on this page touched production: one public GET of their record,
and their public website read for the price list and photographs.

## What the business actually has (all of it now)

- Name, area Jerusalem, one listing "Meatboards", a payment note (card,
  Zelle, bank transfer), one flyer image on our platform.
- Their own website: nine boards with sizes, contents and dollar prices;
  wine and whisky add-ons; orders 48 hours ahead; delivery throughout
  Israel; gluten-free and soy-free on request; the kitchen at Farn 5,
  Jerusalem; five professional photographs; a crimson badge logo.

Every word, number and photograph on the page is from those two sources.
Nothing generated: the design has no per-product image slot, so there is
no gap to fill.

## The reference, read correctly

Eat Hungry Tiger (Awwwards Site of the Day, 2025) puts the product on a
flat brand-coloured ground and makes the *product* perform under the
scroll: the jar slides in, tilts, rolls and grows while a giant two-word
headline scrolls away. No camera move, no zoom. The colour was not the
point; the idea was.

## The two ideas, both theirs

1. **The tumble.** Their board, cut out of their own photograph (the
   square board with the bone), tumbles in three dimensions through the
   hero: spinning in small and edge-on from the top corner, rolling end
   over end, landing flat and large beside the promise as the name scrolls
   away. A plank is the one product that looks right tumbling, because it
   is flat. Keyframes on `--sc-p`, page JS, engine untouched.
2. **The board grows to scale. THE PEAK, and the signature move.** Their
   boards are literally sizes, 15x20 to 37x57 cm. One plank grows through
   the five sizes at one pixels-per-centimetre ratio with a 10 cm ruler
   beside it, and every board sold at that size lights up with its price.
   It answers the buyer's real question, how big is $700, with the
   business's own numbers. No food site does this.

## The feeling curve

```
1  Play         the name, then the board spinning in, rolling, landing.
                Greet, no fade-in. The promise takes the name's place
2  Size         the plank growing, the ruler, the prices. THE PEAK
3  Choice       every board, their photographs, the add-ons. A menu
4  Certainty    notice, delivery, on request, payment, the kitchen; how it goes
5  Resolve      their photograph, a spotlight, one button
```

## The peak

Act 2, the largest span (3.6vh). The visitor's sentence:

> it showed me how big each board actually is, next to a ruler, with the
> price, and I picked the medium

## The tell-someone sentence

> it's the site where the meat board rolls in and lands as you scroll, and
> then grows to real size so you can see what $700 buys

## Grammar

**Named: "Product tumble."** A flat brand-coloured ground, typographic at
the open, with the product as a cut-out object performing under the scroll.
Closest kin: typographic poster (type as ground) crossed with the
reference's product-forward scroll. Forbids: video, photographic ground
before the close, scrims on type over photographs (the copy never sits on
one), section counters, scroll cues.

## Sales psychology, applied

- **Congruency (4).** The promise is their listing's own sentence.
- **Show the product, price it (2 to 4).** Nine boards with sizes,
  contents and prices, transcribed. Real numbers, not round ones.
- **One job (4).** One label everywhere: **Message Blazin' Boards**.
- **Reassurance adjacent to the CTA (5).** The 48-hour notice and the
  payment methods sit beside the button.
- **Timeline beats prose (4).** Three steps beside the facts.
- **Never**: no urgency, no scarcity, no counters, no rating.

## Score

| Act | Beat | Device | Span | Ground |
|---|---|---|---|---|
| 1 hero | Play | `pin` + bespoke 3D tumble + greet cues | 3.2 | #4B0C19 |
| 2 sizes | Size (PEAK) | `pin` + bespoke scale interpolation + five tier cues | 3.6 | #3A0812 |
| 3 menu | Choice | `flow` + `reveal` + `in` | ~1.3 | #5A1222 |
| 4 facts | Certainty | `flow` + `in` | ~0.9 | #4B0C19 |
| 5 close | Resolve | `pin` + `spotlight` + `magnet` | 1.2 | #3A0812 |

pin > pin > flow > flow > pin, about 10.3 viewport-heights on a laptop.
Two pins adjacent, accepted: they are the two ideas, and each is a
different bespoke mechanism. Scroll speed still flares the ground
(`--heat`), kept as texture.

## Colour

One brand colour, the reference's move, and it is theirs: the oxblood of
their logo badge, deepened for a ground (#3A0812, #4B0C19, #5A1222), cream
type (#F4EADB), mustard accent and buttons (#E9B23B). Cream on oxblood is
about 12:1, mustard about 7:1.

## Fingerprint gate, against lechem-emek

Grammar (product tumble vs night shoot), nav (wordmark and one CTA vs
wordmark and clock), hero device (3D cut-out tumble vs pinned still
push-in), act shape (5 acts, 10.3vh, pin>pin>flow>flow>pin vs 8 acts,
14.0vh) and signature move (scale vs sunrise) all differ. Close shares
pinned photo plus magnet. 5 of 6. Registry row revised in place: it
describes this build, and revisions 1 and 2 no longer exist as pages.

## Verification

Harness at desktop, phone and reduced motion: no dead scroll, every line
clears 4.5:1 at its worst frame (the decorative name is display-size and
briefly under the tumbling board, which is the point). The heat check
confirms the accent mixes and cools. Hebrew is off for now, on request.
