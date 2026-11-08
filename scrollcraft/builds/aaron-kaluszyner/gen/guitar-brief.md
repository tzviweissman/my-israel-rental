# Brief: the guitar behind the strings (rule 8.7)

Why (Tzvi, 5 Nov 2026): "the strings look out of place with the wall make the background a guitar so the strings actually
make sense". This replaces the stone wall (gen/wall-brief.md). The strings stay drawn in code so they can ring, so the
picture must have none of its own. It is a generated guitar, not presented as his own instrument.

- Source to match: the guitar in src/owner/p01.jpg (his Kumzits flyer).
- Kept from it: honey-gold spruce top, dark rosette rings round the soundhole, tortoiseshell pickguard, black fretboard
  with small white dots, warm soft light.
- Changed: only the camera (straight down, very close, the neck running out of the frame to the left and the body out to
  the right, so the code's strings can cross the whole screen), and no strings on it.
- No idealising words. No people, text, logos.
- Shapes: 16:9 for laptops, 9:16 for phones; two of each (one call each), Higgsfield API soul/standard, 1080p.
- The words sit on their own card low on the left, so the soundhole sits high and right of centre on the laptop picture.
- Compared beside p01.jpg before use. Redo only the trait that is wrong.

Wide prompt: "Top-down close-up photograph of an unstrung acoustic guitar lying flat, guitar neck horizontal: the black
fretboard with small white dots comes in from the left edge and ends at a round black soundhole just right of the centre
of the frame, ringed by dark rosette rings, with a tortoiseshell pickguard below it. Honey-gold spruce top with fine
straight grain fills the rest of the frame out to the right edge. No strings at all, no bridge, no tuning pegs, no hands,
no text, no logo. Soft even warm light, sharp detail."

Tall prompt: "Top-down close-up photograph of an unstrung acoustic guitar lying flat, guitar neck horizontal: the black
fretboard with small white dots comes in from the left edge and ends at a large round black soundhole in the upper half
of the frame, ringed by dark rosette rings, with a tortoiseshell pickguard below it. Honey-gold spruce top with fine
straight grain fills the whole lower half of the frame. No strings at all, no bridge, no tuning pegs, no hands, no text,
no logo. Soft even warm light, sharp detail."

## Log
- Picture used: round 2 wide (guitar/wide2-0.png), its level neck and huge soundhole; its painted strings are taken out and frets added in gen/guitar.py; the tall picture is the same guitar extended with its own wood. Round 2 tall had a vertical neck and was not used.
- Round 1: wide came out as a whole guitar on white, with its own strings and a label in the soundhole; tall had no strings but its neck ran diagonally, so level strings would cross it. One image each. Round 2 asks for a macro, level neck, no background.
