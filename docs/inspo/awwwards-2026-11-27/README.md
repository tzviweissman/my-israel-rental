# Awwwards Sites of the Day, Sep to Nov 2026: what repeats (27 Nov 2026)

Tzvi: "go through awwwards.com to see what rules we can add or change or remove to make our sites award
winning ... look at many sites to get a good feel".

**Sample.** The 48 newest Sites of the Day (27 Sep to 27 Nov 2026) plus four Site of the Month entries, minus the
eight studied before (`awwwards-2026-10-18`, `awwwards-anatomy-2026-10-22`). Of the 41 captured, 37 could be seen:
Cartier refused automated visits, Heron AI showed a Cloudflare check, Colonia Zacamil and Cominvi never drew. Each was
captured at 1440x900 (0.8, 2.5 and 5 s after load, then a frame every ~0.8 screen of wheel scrolling) and 390x844
(five phone screens), and its code was read for what it is built with. Three of our own live sites were captured the
same way for comparison (`sheets/ours-*`).

- `sheets/<site>-desktop.webp`, `sheets/<site>-phone.webp`: contact sheets, read left to right.
- `sites.md`: per site, the opening, every section in order, type and colour, effects, menu and footer, phone,
  the one memorable idea and how a local business could borrow it (four readers, ten sites each).
- `signals.tsv`: what each page is built with (smooth scrolling, GSAP, WebGL, video, page transitions, cursor,
  marquee, fonts, menu links, headline).
- `capture.mjs <list> <outdir>` and `sheets.py <outdir>`: rerun the capture (list lines: `name url`).

Limits: stills, not video, so motion is read from consecutive frames; about half the phone sheets were looked at.
Eight of the 37 are fixed-screen showcase pages (studios, a game, a film archive) with little to scroll; their
openings count, their structure does not.

## What repeats (counts out of the 37 seen; the tools out of the 40 that loaded)

| Pattern | Count | Examples |
|---|---|---|
| Weighted smooth scrolling (Lenis) | 30 of 40 | every studio, Vineyard Hotel, Odyssée clinic, MyFrida |
| Only 2 or 3 colours, one strong accent | ~34 | Odyssée (cream, stone, ink), Two26 (cream, orange, ink) |
| Huge headline or word (1/6 to 1/3 of the screen) beside tiny letter-spaced or numbered labels ([01], 1/4) | ~26 | Pragen Hatlen, ESR, Huxley, Polpharma, Signal-A |
| A loader, percent counter or "enter" gate before the page | ~24 | Bulletproof, Justin Jefferson, Edolus, Forge |
| The whole ground changes colour from section to section (no hairline dividers) | 22 | Vineyard (cream, sage, navy), MyFrida (pink, mustard, purple, lime), Polpharma, LPAS |
| WebGL canvas (3D object, distortion, particles) | 23 of 40 | Grail, Mecha, Sweet Tape, Santal |
| Video on the page | 23 of 40 | Vineyard, Odyssée, ESR, Preymaker |
| Custom cursor | 19 of 40 | ESR, Pragen, Justin Jefferson |
| Moving strip of words or logos | 16 of 40 | MyFrida flavour words, Two26, Signal-A footer |
| Giant name or statement closing the page | 14 | Huxley, ESR, MyFrida, Two26, Bulletproof, Odyssée (name on a 3D pearl) |
| One pinned scene that swaps content as you scroll (chapters, numbered steps) | ~14 | Polpharma pillars, LPAS service panels, Vineyard Sleep/Eat/Meet/Play |
| Next section slides over the last (curve, sheet, stacked colour panel) | ~8 | MyFrida's stacked product panels, Polpharma, Grail, LPAS |
| Small menu (a "Menu" pill or a few tiny links) with ONE persistent button | ~30 | Vineyard "Book Now", Pragen "Place your interest", Grail "Join waitlist" |
| Collage of pictures of different sizes with words in the gaps | ~8 | Odyssée, Spyker, Vineyard |
| A row of rules (number, name, short line, picture on hover) as the list of services or work | ~6 | Signal-A, Bulletproof, Neutomni |
| Phone version recomposed, not shrunk | most of those checked | Signal-A, A24, Polpharma; three show "desktop only" |

**Absent from nearly all of them:** rows of equal boxes (three feature cards, icon rows, step cards), uniform photo
grids, card carousels of reviews, stock photos, the left-aligned "headline, line, two buttons" hero, drop shadows,
glass and gradients. Also absent, and this is why we do not copy them whole: prices, hours, maps, ordering, reviews.
Award judges score design, usability, creativity and content; our sites also have to sell.

## Ours beside them (American Crust, The Gift Boutique, The Brown Box)

Our openings hold up (a real film of the product, the payoff on the first screen) and our closing name matches the
winners. The gap is the body after the opening:
- **Type size is NOT the gap (measured, `type-sizes.json`).** On the 22 winners with ten or more headings the biggest
  heading is 96 px at the median and 2.27 times their middle heading; ours are 83 to 102 px and 1.56 to 2.1 times.
  Raising 3ad.3's 1.6 to 2 would fail 10 of the 22 winners, so it stays.
- **Equal boxes.** "Delivery, pickup, payment and kosher" as three equal cards, "How to order" as three step cards,
  "From our gift tables" as a 3x3 grid of equal tiles. No winner does this.
- **One ground.** Gift Boutique is cream from top to bottom; American Crust does change ground (yellow, dark,
  cream), and reads livelier for it.
- **Hard section edges and a plain scroll.** Sections butt against each other; the scroll has no weight.

## Rule changes (added as page rules 3an on 27 Nov 2026, Tzvi: "Add all 4"; checked by scripts/check-award-body.mjs)

1. **Add: weighted smooth scrolling on laptops** (30 of 40 winners use Lenis; 0 of our 3). The starter loads Lenis
   (vendored, about 10 KB), off on touch screens and under reduced motion; the scroll-led film (`film.js`) reads the
   same scroll position, and `check-film-video.mjs` must still pass (FOLLOW, FREEZE). Where: `scrollcraft/starter`,
   page rules 3s, check in check-web-basics.
2. **Add 3ad.5: no rows of equal boxes for facts or steps** (absent from all 37 winners; on 2 of our 3). Delivery,
   payment, kosher, hours and "how to order" become ruled rows (number, name, line), one fact per line in a band, or
   one item per screen; photos become a collage or one picture per screen. Product cards stay equal (page rules §8: a row of
   products reads as high-end because they match). Check: a new `scripts/check-boxes.mjs` fails three or more sibling
   boxes of the same size with a fill or border outside a marked product grid.
3. **Add to the 3ai menu: the next section slides over the last** (a sheet with a rounded top edge, or product panels
   that stack as you scroll, as MyFrida, Polpharma, Grail and LPAS do). It counts as one of the three decorations.
4. **Change 8a.4: one moving strip is allowed** (16 of 40 winners): real facts only (stockists, delivery areas,
   flavours, the kosher line), slow, pauses on hover, still under reduced motion, counted as one of 3ai's three.
   Today 8a.4 bans auto-playing marquees outright.
5. **Do not copy** (no rule needed; listed so nobody adds them): loaders, percent counters and "enter" gates (about
   24 of 37, all studios and showcases; for a shop they are a wait before the product, and on a phone 3ac already plays the
   opening by itself); "desktop only" pages; hiding prices, hours and ordering.

## Openings and what moves (27 Nov 2026, second pass: "take a closer look ... how they show the opening screen and
## what happens throughout the screen if things follow along")

Recorded with `scripts/watch-site.mjs` (8 s of untouched opening, a mouse circle, a slow scroll) and measured;
sheets and notes in `motion/` (`<site>-opening.webp` two frames a second, `-mouse`, `-scroll`; `notes.md` per site;
`motion-summary.json` what follows, moves at its own speed, slides, fades, grows). 37 winners, our 3 beside them.
Counts are by eye on the sheets, with the measurements as hints.

**Openings.**
- **Wait before it can be used:** about 18 of 37 make the visitor wait. Loaders, counters and gates take 5 to 13 s
  (Sweet Tape 8 s of flat green, La Boite 13 s, Emotion 12 s or more, Forge never without a click).
- **The fast ones open in 0 to 4 s and arrive in beats:** a plain ground with only the name and a line for about
  1 s, then the film or photo fades or grows in under it, then the headline writes in letter by letter or line by
  line (Odyssée, ESR, Huxley, LPAS, Polpharma, Mecha, Two26, Neutomni, Viv, PSP).
- **Headlines that write in** (letters, lines, from blur or blocks): about 13 of 37.
- **Ours:** they open fast (American Crust at 0 s, the other two by 0.5 s), faster than half the winners. But on a
  laptop nothing more arrives: all 16 frames of American Crust's and Gift Boutique's first 8 s are the same,
  because the scroll film waits for the scroll and nothing else moves. `check-arrival.mjs` skips film openings, so
  it never saw this.

**While scrolling.**
- **A pinned full-screen scene whose content swaps with the scroll:** about 12 of 37. Ours have this already, as the
  scroll film. It is our strongest part, and ours shows the product itself.
- **The next section slides over the pinned opening:** about 9 of 37 (Huxley, Odyssée, Polpharma, ESR, LPAS,
  Preymaker, Bulletproof, Twks, PSP). Ours cut from the film to a flat section.
- **Hand-overs between sections:** a colour change at a hard edge is the most common; curved, torn, slanted or
  block-step wipes appear on about 8.
- **Something travels with you or crosses a section:** about 6 of 37 (Justin Jefferson's card, House of Giants'
  footprints, Vineyard's rating bar). Measured on ours: nothing follows and nothing slides.
- **A sticky list whose active line swaps a picture:** about 7 of 37 (ESR, Polpharma, LPAS, Bulletproof, Neutomni,
  Mecha). Not proposed: Tzvi ruled on 20 Oct 2026 that steps lighting up as you scroll are overused.

**Mouse.** About 9 of 37 react to the pointer in a visible way: a label chip such as "See more", a picture card
following the pointer, a glow, a dot. None of our 3 does. Not a majority, so it stays a choice (a custom cursor is
already on the 3ai menu).

**Endings.**
- **The page lifts off to show a fixed footer:** 5 (Huxley, Neutomni, Twks, LPAS, Mecha).
- **A giant name or object at the close:** about 13 (Odyssée's pearl, ESR, Bulletproof, Viv, House of Giants...).
  Two of our three already have the giant name.
