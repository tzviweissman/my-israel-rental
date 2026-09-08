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
| blazin-boards | 2026-09-07 (r3; r1 poster and r2 filmic were rebuilt on request) | Product tumble (named): flat brand-coloured typographic ground, the product as a cut-out object performing under the scroll, no video | Fixed minimal bar: wordmark with their logo, one CTA | Their board cut out of their own photograph, tumbling in three dimensions from the top corner to a flat landing beside the promise, keyframed on --sc-p | pin > pin > flow > flow > pin, 5 acts, 10.3vh | Pinned photograph, pointer spotlight, magnetic CTA, reassurance beside it, footer in the stage | The board grows to scale: one plank through the five real sizes at one px-per-cm with a ruler, every board at that size lighting up with its price | Their photography only, oxblood from their logo, cream and mustard | 4501 |
| michal-simkin | 2026-09-08 | Lookbook (named): chaptered scenes with hard grounds, the photographs as objects that arrive, the type as the argument, no video | None on top; a fixed bottom bar with her mark, one CTA and the reassurance beside it | Her clients' portraits dealt onto a stack under the wheel, each landing at its own angle; her headline holds | pin > flow > pin > flow > pin, 5 acts, 9.9vh | A letter: her sign-off, her name, one button, no photo ground, no magnet | The same wig: clients' before-words strike through under the scroll and their after-words rise, every pair one reviewer's own words | Her photography only, navy and blush from her site, rose-gold from her logo | 4502 |


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

- **blazin-boards** claims (revision 3): the named "Product tumble" grammar
  (flat brand ground, cut-out product performing under the scroll); the
  wordmark-plus-one-CTA bar; the 3D cut-out tumble hero; the shape
  pin > pin > flow > flow > pin at 5 acts and 10.3vh; and the
  grows-to-scale move (one plank through the real sizes with a ruler and
  prices). Shares with lechem-emek only the pinned-photo-plus-magnet close.
  Revisions 1 and 2 released their claims: those pages no longer exist.
- **michal-simkin** claims: the named "Lookbook" grammar (hard grounds,
  portraits as arriving objects); the fixed bottom action bar with no top
  nav; the dealt-portraits hero; the shape pin > flow > pin > flow > pin
  at 5 acts and 9.9vh; the letter close; and the same-wig move (quoted
  words rewriting themselves). Differs from both prior rows on all six
  dimensions.
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
