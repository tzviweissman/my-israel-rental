# Fingerprints

Every site you build with **scroll-craft** gets one row here, appended after it
ships. The registry exists so your next build can prove it is a different page
rather than a re-skin of one you already made.

This file is **yours**. It starts empty on purpose: the gate is about not
repeating *yourself*, so it has nothing to say until you have built something.

The rules and the gate live in the skill's
`references/uniqueness.md`. Short version:

**A new build must differ from EVERY row below on at least 4 of the 6
dimensions.** Four against each row individually, not four on average across the
table. If a planned build fails, change the plan. Never edit a row to make room
for it.

The six dimensions are: **grammar**, **nav treatment**, **hero device**,
**act-sequence shape**, **close pattern**, **signature move**.

Dimension 6 is free, because a signature move is unique by definition. So the
gate really asks for three more out of the remaining five, and a build that
changes only grammar and world will fail it.

---

## The registry

| Build | Grammar | Nav treatment | Hero device | Act-sequence shape | Close pattern | Signature move | World | Port |
|---|---|---|---|---|---|---|---|---|
| lechem-emek | 2026-09-06 | Night shoot (named): distinct scenes, full-bleed photographic hero, one dark-to-light cut at the peak | Fixed wordmark + time-of-morning clock, no CTA in the bar | Pinned still photograph with a --sc-p push-in and a greet-and-fade kinetic headline | pin > flow > pin > flow > pin > pan > flow > pin, 8 acts, 14.0vh | Pinned photo, one held cue, magnetic CTA, footer inside the stage | The scroll is the sunrise: one --dawn value walks the clock 04:00 to 07:00 and regrades every night photograph and ground together, then cuts to day | Photographic, generated stills, warm | 4500 |
| blazin-boards | 2026-09-06 | Typographic poster: type is the imagery, charcoal grounds cut per section, one real photograph used twice as an object, never as ground | None. No bar, no wordmark item; the wordmark is the hero composition, and the only fixed chrome is the direction toggle | A single word at 25vw with the business's own photograph clipped inside the letters, growing with --sc-p, the real h1 beneath | pin > flow > pin > flow > flow > flow > pin, 7 acts, about 10vh | Inverts the page: the smallest type on it, the CTA as a plain underlined link, reassurance beside it, no photo, no magnet | Scroll speed is the flame: velocity, smoothed into --heat, flares an ember layer, the grain and the accent (gold toward ember) together, and cools when the scroll stops | Typographic, charcoal, one real cut-out photo | 4501 |


---

## What is taken

Add a bullet here whenever a build claims something a later build should avoid
reusing: a grammar, a nav treatment, a close pattern, a signature move, an
act-count-and-length band. The shared columns are what the next build inherits
as a constraint, so writing them down is the whole point.

- **lechem-emek** claims: the named "Night shoot" grammar (distinct scenes,
  photographic hero, one dark-to-light cut at the peak); a fixed
  wordmark-plus-clock chrome with no CTA in the bar; the still-photograph
  hero with a `--sc-p` push-in; the shape pin > flow > pin > flow > pin > pan
  > flow > pin at 8 acts and 14.0vh; the pinned-photo close with a magnetic
  CTA; and the sunrise move (one scroll value regrading the whole page and
  a clock). Shares nothing with prior rows, since there were none.

- **blazin-boards** claims: the typographic poster grammar on charcoal; the
  no-chrome nav (wordmark as composition, direction toggle only); the
  photo-inside-the-letters hero; the shape pin > flow > pin > flow > flow >
  flow > pin at 7 acts and about 10vh; the inverted close (smallest type,
  underlined link, no photo); and the velocity move (scroll speed regrades
  the page, cooling on stop). Shares with lechem-emek: the site's gold accent
  and Playfair/Manrope, which are the brand's and not the build's; nothing on
  the six dimensions.
---

## Appending a row

After shipping, add one line to the table and one bullet to **What is taken** if
the build claimed something new. Fill every column. Say what the build shares
with existing rows.

Rows are append-only. A build that has been superseded stays in the table,
because the space it occupies is still occupied.

---

## Worked example

The skill's author kept a registry of twelve builds across eight page grammars.
If you want to see what a filled-in table looks like, and which shapes tend to
collide, read `EXAMPLES.md` in the scroll-craft repository. Treat it as
illustration only: those rows are somebody else's builds and they do **not**
constrain yours.
