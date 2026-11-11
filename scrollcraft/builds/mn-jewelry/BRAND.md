# Brand: M and N Jewelry, fine jewelry in Jerusalem (m-and-n-jewelry)

Written 7 Nov 2026 before any picture was made (rule 3x.7). Taken from their own flyer (a gold M&N in an oval on white
marble with gold veins, "Natural & lab diamond jewelry", "Your jeweler in Jerusalem") and their photos (pieces on white
linen, glass and pale fur, one ring in a navy velvet box).

## Colours

| Token | Hex | Use |
|---|---|---|
| `--ground` | `#121319` | page ground: near-black, the dark of the studio pictures (dark look, Tzvi 8 Nov 2026) |
| `--surface` | `#1A1C24` | tiles, the shop stage's summary, cards |
| `--ink` | `#F2EFE9` | all text, prices, outline buttons (16:1) |
| `--soft` | `#A9A7A1` | secondary text (7.9:1) |
| `--accent` | `#C2A46E` | the main button only: the gold of their own pieces (taken from their twist ring shown in yellow gold, `assets/p10-st-yellow.webp`, rule 3g.19), which is also their logo's gold |
| `--accent-ink` | `#121319` | text on the main button (8.6:1) |
| `--line` | `#2C2E38` | dividers, field borders |
| `--velvet` | `#0B0C10` | the closing band and the footer |
| `--gold` | `#C2A46E` | the small stone on the dividers, the summary's edge, the order steps' hover line |

## Fonts (Google Fonts, SIL Open Font License)

- Headings: **Italiana**, a thin high-contrast display face like the engraved capitals of their logo. It has no Hebrew; a
  Hebrew page would set its headings in **Bellefair** from the approved list, the same thin luxury feel (design rules,
  approved fonts: "a Latin display face with no Hebrew may lead the English page only if the Hebrew page names its own
  face").
- Text: **Assistant** 400, 600 and 700 (approved, Hebrew subset listed).
- The $ is set in the text face (`.sym`).

## Type scale and spacing scale (rule 3x.13)

The starter's scales, nothing in between: text `--t-1` to `--t5`, gaps `--s1` to `--s10`. One radius, `--r: 4px`, the
small square corner of a jewelry box; buttons are the same 4px, never pills.

## Logo

Their own M&N oval, cut from the flyer: on the dark bar only its gold is kept and the marble behind it removed
(gen/mark_gold.py), never recoloured.

## Textures

- Their own pieces only. Each owner photo is re-set on one dark studio surface with one soft light through the image-edit
  API (gen/studio_edit.py, gen/studio-brief.md) and checked beside the original (gen/studio/_sheet-*.jpg).
- Generated: the surface and the light, and, for the gold choice, the same picture's metal in the two other golds. Both
  are for the owner to confirm (OWNER-QUESTIONS.md 12). No generated hands, faces or rooms.
- The opening film is made in code from these pictures (gen/scenes.html).

## Design bans

- No generated person, hand or face, ever; no generated piece: every picture starts from their own photo.
- No sparkle stars, lens flares or glitter drawn on the shop, tile or band pictures. The one exception is the opening
  film's one brief flash as the light crosses the stone (for Tzvi's call, gen/report.md).
- No karat or carat claims (14k, 18k, carat weight): the record does not say; asked in OWNER-QUESTIONS.md. White, yellow
  and rose gold and natural or lab diamonds are offered as choices on Tzvi's word (8 Nov 2026).
- No "natural" or "lab" stated as a fact about any one photographed piece: it is the customer's choice.
- No reviews, stars, "trusted by" or "since": they have none in the record.
- No gold body text, no gradients on text or buttons, no frosted glass, no cream with one italic word.
- Never "store", "showroom" or an address: the flyer says by appointment, located in Jerusalem, nothing more.
