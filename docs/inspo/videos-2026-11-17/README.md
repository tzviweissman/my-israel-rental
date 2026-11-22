# Why our 21 sites look alike, and seven videos on fixing it (17 Nov 2026)

Method: every live site in `frontend/public/pages/` screenshotted full-page at 1440 wide
(`our-sites-1.jpg`, `our-sites-2.jpg`; the tall empty blocks are the scroll films, which a
still capture shows blank). Section order read from each `index.html`, colours and fonts
from each `site.css`. Compared with `../awwwards-anatomy-2026-10-22/` (Delice, Theobroma and
the rest). Videos downloaded with yt-dlp: full captions read for all seven, frame sheets
pulled with ffmpeg and looked at for the four that show sites.

## What is wrong with ours

1. **One skeleton, 21 times.** After the opening, almost every site runs:
   bar, film, a row of product cards, "how it works" in three numbered steps, a three-column
   "good to know" (delivery, payment, kosher), gallery, FAQ, a closing band with the
   business name set huge, four-column footer. The giant-name close is on 13 of 21; the
   numbered three steps on about 12. Section ids are near identical
   (`top|nav|open|...|gallery|faq|close|foot full`).
   **Cause: our own rulebook.** `docs/page-generation-rules.md` is 3,108 lines, and most of
   its rules say "every site has X" (closing signature 3g.7, the footer 3v.1, "how it works
   strip and FAQ" in the 3t table, the three facts). Each rule added a part to every site;
   no rule ever asks for a different arrangement. Together they are a template.
2. **All the design is in the film; the rest is a document.** The opening takes 3 to 5
   screens; after it, each site is a narrow centred column of small cards on a flat ground,
   split by hairlines, at one heading size and one card size. Real sites (Delice,
   Theobroma) make every section a full screen led by a big picture.
3. **The brand's idea lives only in the hero.** Delice repeats its circles and red waves in
   every section and changes the ground colour per section; Theobroma repeats drips,
   stickers and chunky capitals everywhere. Ours drop the idea after the film. Chicken
   Munch, the one that carries its colour blocks and capitals all the way down, is the
   one that looks most like a real site.
4. **The same palette.** 13 of 21 are cream, ivory or blush ground + dark brown ink + one
   warm accent (caramel, kraft, rose, gold). The accent is then used everywhere: headings,
   chips, lines and buttons, so nothing stands out (Nate Herk's "highlighter" point).
   Heebo is on 10 sites; a display serif + plain sans pair on most.
5. **Flat depth.** Nothing overlaps or breaks a section edge; every block sits on one level.
6. **The main task comes late.** The videos' real sites put the job in the first screen
   (Altus "Find an expedition" form, car-part "I need a headlight for a 2017 Honda", the
   salon's "Next open slots" card). Ours put a film first and the order form far down.
   Clean Plus, with its plan card in the hero, reads most like a working business site.

## The videos

**Nate Herk, "I Studied 10,000 AI Websites" (mImbbszCjCI), the one Tzvi flagged.** Five patterns:
- *Mirror test*: the first screen answers who is this for, what do I get (the outcome, not
  the feature), what do I do next (one button). Write those three answers before any design.
- *Highlighter rule*: 60-30-10. 60 background, 30 structure (text, menu, cards), 10 accent
  on buttons and links only. His own site "looked so cheap" with the blue everywhere; back
  to black and white with blue only on what to click "felt way more premium".
- *Front, middle, back*: something real at the back (photo of the work, a soft shape), the
  content in the middle, the one action in front. Let one card or picture hang halfway into
  the next section so the page is not "a stack of boxes"; lift only the main button with a
  shadow. Frame-verified: his salon example, "Fill your calendar without answering DMs"
  over the stylist's chair, a "Next open slots" card crossing the bottom edge.
- *Motion with a job*: one thing moves per screen; words never wait (readable at once on the
  first screen); respect reduced motion, or give a motion-off switch. Cites a Purdue study:
  parallax rated more fun, not easier or better looking.
- *Free sample*: a quiz, a price estimator or a small tool answering the question every
  customer asks before buying (braces cost calculator, Wise converter, Zillow estimate).
- Discount: he gives away "Scrollcraft", the scroll skill we already use. The conversion
  figures (CXL +79.3%, Outgrow 45%) are his and the vendors', not checked.

**AI Labs on Leon Lin's workflow (-bv2xKQzZio).** Leon wrote taste-skill, which we also use.
Short prompt + 9 to 12 reference pictures, because words cannot carry layout or spacing.
Make a *target* first: three mockups side by side on one page, pick one, then build. Set a
number (match the references 99.9%) and correct the agent's self-score down when it is too
kind. Ban lists only move the model to its next default look. **Build with no animation
first, get the design right, then add motion.** Judge with a different model that did not
build it, to a set score (9.2/10). Packaged as the "cook" skill. Sponsor: Metal Bear.

**Jason Lee, Fable 5.2 vs Opus 5.5 (GdMnqbGPlyY).** With no references, Fable chose black and
white + one yellow matched to the car, and put the real part search in the hero. Opus was
close and half the price with references. His split: Fable plans, Opus builds (same as our
rule). Sponsor: Hostinger.

**Kyle Skelly, cinematic sites (F7ygmxQxwWM).** The one-shot site was "very visual heavy, but
no real structure". The fix was a human restructure around what the visitor came to do
(a find-an-expedition form in the hero), then a second version to compare, and a scroll
video kept to one section only. Cut-out mountain in front of the headline (layering).
Sponsor: OpenArt.

**Amboras, ecommerce tutorial (QcWz0xbEl-M).** Copy one real site's structure (Seed) section by
section from screenshots, and check each section "earns its position": "If a section is
there only because e-commerce websites normally have a section like it, I can either give
each section a clearer job or remove it." Objections answered again at checkout. Funnel for
Amboras.

**Create a Pro Website, GPT-6 Astra (r68MhqAUvR8).** Ask for the section list and a mockup
picture of the hero before building; a Dribbble screenshot as the style target; point-and-
annotate edits. Mostly a hosting walkthrough; little new.

**Sharbel, motion skill (9UmUhSPJe0I).** For films and ads, not pages: interview, show a board
of rendered styles to pick from, pitch three ideas (one bold) with a recommendation, a shot
table approved before any code, then a critic scoring six things out of 10 and redoing
anything under 8, up to three rounds. A library grown from links he saves.

**Said by more than one:** references beat words (5 videos); the main task or a tool in the
first screen (4); show visual options before building (4); motion only after the design
works, one moving thing at a time (2); an outside judge with a score (2).

## Proposed fixes (new builds only; live sites stay as approved)

1. **Structure from one real reference, not from the rulebook.** A new blueprint stage: pick
   one real site of the business's category (Inspo/Awwwards), list its sections in order,
   then write ours with a job for each. Turn the closing name, numbered steps, three facts
   and FAQ from "every site" into options. New check `check-structure` refuses a site whose
   section order matches any live site by more than about 60%.
2. **One device all the way down.** CONCEPT.md names the business's graphic device (from its
   real things: a box, a plate, a balloon shape); at least half the sections use it.
3. **Palette from the business's own photos, 60-30-10.** Accent only on what you click.
   Cream + brown + warm accent needs a reason; a check compares the palette with live sites.
4. **First screen = mirror test + the task.** Order, sizes, slots or a quote visible with
   the opening, plus one free sample (size picker, price estimate, quiz) where it fits.
5. **Design before motion.** Three static mockups side by side for Tzvi to pick, then the
   film and effects; a Fable judge that did not build it scores the page against the reference.
6. **Section rhythm.** Mostly full-width, picture-led sections of different heights and
   grounds, and one element that crosses a section edge.
