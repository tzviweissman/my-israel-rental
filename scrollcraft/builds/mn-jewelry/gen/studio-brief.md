# Studio pictures brief (rule R8.7), written before gen/studio_edit.py ran

Tzvi, 10 Nov 2026: "make all the diamonds look real and high end". The cut-outs on a drawn velvet read as stickers, so each
piece is shown as their own photo with only what is behind it changed.

## The item
One owner photo per picture (src/pNN), the one piece in it. Its traits are kept exactly: the number, cut and layout of
the stones, the setting and prongs, the band's shape and width, the metal colour, the angle it was photographed from.

## What changes
- Only the background: a matte charcoal stone surface in a dark studio, one soft light, a soft shadow under the piece.
  Props (linen, glass, fur, a box) go with the old background.
- For the gold choice only: the same finished picture with the metal's colour changed to yellow or rose gold (or white
  where their photo is yellow or rose). Stones, shape and setting unchanged.

## What never changes
The piece. No added stones, no extra sparkle, no hands, no text, no second piece. No idealising words in the prompt
("perfect", "flawless", "luxury") so the model does not remake the stone.

## Check before showing
Every result beside their photo, piece by piece (gen/studio_sheet.py: gen/studio/_sheet-*.jpg and _sheet-golds-*.jpg).
A picture whose stones, setting or shape differ is made again or the piece is left off: the bangle, the half eternity
band on fur and the solitaire on a mirror are off for that reason.

## Still to confirm
The owner's yes that each picture looks like the piece and that each piece comes in all three golds (OWNER-QUESTIONS.md 12).
