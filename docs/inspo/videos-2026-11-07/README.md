# Six pro-site videos, 7 Nov 2026

Tzvi asked: compare how these designers build sites with how we do. Look at the wow moment on the first
screen, how the site is put together, how it moves from words to pictures, and where things sit. Watch the
videos, not only the words.

**Method.** I got the full captions of all six (yt-dlp, `en-orig`). I took 292 stills, one every 12 to 30
seconds, by streaming each video through ffmpeg, and looked at them as contact sheets. I compared those with
the first screens of six of our live sites (`frontend/public/showcase/*.webp`).
**Not done:** sound, continuous motion (no bursts of frames, so the motion claims below come from the
narration plus single stills), and the comments.
Nothing here is a rule. Tzvi, 8 Nov 2026: existing sites stay as they are (owners like them), and these are **options** for new sites, not rules, because not every business has these things.

| Video | Who | Worth |
|---|---|---|
| How To Use Claude Code 2.0 To Make Websites 10X Better (vLzxufFCVIk) | Zinho Automates | **High.** Two finished sites (an F1 driver and a football launch) seen section by section. Higgsfield affiliate links, plus a free community |
| Gemini 4 Just Killed 3D Web Design (xiWJE3FPJSE) | Viktor Oddy | Medium-high. A watch site and Nexa ("Nature doesn't guess"). Funnel to his own prompt site, motionsites |
| Design Is Over. Claude Just Changed Everything (Ivd-dxxPvLE) | Viktor Oddy | Medium. The bee and 3D-stack heroes, and "make a picture of the page first". Same funnel |
| Head Of Design At X's New Claude Skill Is Insane (of628n5754g) | AI Labs, on Benji Taylor's "stageshow" skill | Medium-high. Rules for product demos, and checking motion with a frame sheet. OpenArt sponsor |
| Google Just Fixed AI Design By Releasing This (au2TI8sdq8E) | AI Labs | Medium. Brief, then stills, then build, then two reviews. WhisperFlow sponsor |
| How to Use Claude Design Better Than 99% of People (IYNAyRkUsjI) | Jack Roberts | Low-medium. 35 minutes, mostly a list of inspiration sites. Funnel to a paid course, Higgsfield links |

Pictures in this folder:
- `theirs-top-ours-bottom.jpg`: their three heroes on the top row, three of ours on the bottom row.
- `our-six-openings.jpg`: six of our live first screens.
- `f1-site-sections.jpg` and `football-site-sections.jpg`: the sections of Zinho's two sites.
- `bee-and-stack-heroes.jpg`: Oddy's heroes.
- `nexa-hands.jpg`: the Nexa site.

## The one idea

**Their first screen is a cut-out object and a huge word sharing an empty ground. Ours is mostly a photo with
words printed over its bottom corner.** Frame-verified in five sites:
- Theo's helmet sits in front of "THEO VARGA".
- The bee sits on its flower, breaking into the headline.
- The gold watch sits beside "Time, gilded.".
- The 3D stack sits beside "Your next landing page could look like this.".
- The point-cloud hands sit beside "Nature doesn't guess. Neither should AI.".

The ground is always plain: white, pale lilac or black. On top of it there is one headline of 3 to 8 words,
one short line, and one button. The rest of the screen is empty.

Our side, from the six showcase stills:
- The Brown Box, American Crust and Elisheva put the headline bottom-left, over a dark shade, on a full-bleed
  photo.
- Chicken Munch is the one built their way: a giant name on the ground, the bowl breaking it, and labels around it.
- Blazin' opens on the word alone. Gift Boutique opens on the film with no words yet.

Our rules already ask for their way: 3i.4 "Words and object overlap", 3i.8 "One word or short line per scene
... on empty ground beside the subject", and 3h.17 "Words and film take turns". The older sites were built
before those rules and are spared by rule dates. So the gap is in the sites, not the rules.

## How they move from words to pictures (frame-verified unless marked)

1. **The object swaps sides as the words change.** On the watch site the screen first has "Time, gilded."
   on the left and the watch on the right. Next it has the watch on the left and "Sculpted from solid gold"
   on the right. The watch stays one object the whole time. This is not in our rules.
2. **One object changes into each kind the business sells.** The football twists from match ball to
   training ball to futsal ball to street ball, and each version gets its own section ("EVERY SESSION.",
   "MADE IN LAYERS."). Narration plus four stills. Our 3i.4 only lets a product "carry through" the
   sections. Changing it into each of the business's kinds would show the whole offer, which is our 3g.18
   (the opening shows the offer), in one moving thing. For example, an acai bowl that turns into a board,
   then into a gift box.
3. **Each section is a headline of 2 to 4 words ending in a full stop, plus one line and one picture.**
   Examples: "THIS SEASON, SO FAR.", "ON THE RADIO.", "FROM KARTS TO FIVE TITLES.", "YOUR TURN.", "YOUR SHOT.",
   "ROOFTOP.". Sections alternate dark and light. The pictures are full-bleed photos with a single label word
   on them, or split cards.
4. **One sentence lights up word by word** (Nexa: "Every conversation carries a signal..."). We have this
   already as 3x.6.
5. **A row of big numbers on plain ground** (Nexa: 98%, 40ms, 2.1B; F1: P1, 7, 12). We have count-ups.
6. **A hands-on finale where the visitor does the thing.** On the F1 site you hold to grab the trophy, then
   the five lights go out. On the football site you pick a corner and beat the keeper. Both are made in code
   (frames). Ours closest is Elisheva's "tap a shade". Nothing in our rules asks for a finale like this.

## How they work (process)

- **Make a picture of the first screen before coding it.** Four of the six videos say this: Oddy twice,
  AI Labs (Stitch stills), and Roberts (his "design loop"). Oddy takes a screenshot of a reference, has an
  image model redraw it with his own subject and fonts, then tells Claude to match the fonts and the
  position of every element. We already make stills first for films (3h), but not for the page layout.
  A picture costs about 1 credit.
- **Few words.** Three of the six say this:
  - Zinho: "walls of tiny text" scream AI.
  - Roberts: after roasting hundreds of sites, text density was the biggest problem.
  - Benji Taylor: only 3 to 7 real words in a product demo, and grey bars for the rest.
- **Phones need a layout of their own, not the laptop one shrunk.** Two say this (AI Labs, Benji). Oddy says
  the opposite, that AI "creates everything mobile responsive" and needs no checking. AI Labs found that
  exact claim wrong when they tested it.
- **Too much motion is a fault.** Two say this:
  - AI Labs' story review cut their star field.
  - Zinho asks a side chat whether anything feels "too much or too slow".
- **Check motion in a frame sheet, not a still** (Benji). Record the animation, lay every moment side by
  side, and check for jumps and text overflow. A demo loops with its last moment matching its first.
  Benji admits the check cannot tell whether the idea is boring. We partly have this (check-clip, the SMOOTH
  check).
- **The brief comes from an interview, and the first picture is never accepted as is** (AI Labs, Zinho).
  We already have this: interview-me, BLUEPRINT.md and the wow gate.
- **Zinho's ban line for every prompt:** "no gradient text, no generic copy, keep the text short and
  readable". It matches our copy rules.

## What to discount

- Every video sells something: affiliate links (Higgsfield, OpenArt, WhisperFlow), paid communities, or
  Oddy's prompt site.
- Every site shown is a fictional brand, built in one go from one prompt. None is a real business with real
  photos and real prices.
- Oddy says "AI content is not copyright protected, so you can use it freely". That is a legal claim given
  without support. Don't rely on it.
- Oddy's visitor numbers (166,000 a week) are shown, not checked.
- Roberts' "15 hacks" are mostly links to inspiration sites. Some of these we already use: Mobbin, the Inspo
  archive and 21st.

## What it could mean here (for Tzvi to choose)

1. **Re-do the first screen of the older photo-with-words sites** (The Brown Box, American Crust, Elisheva)
   the Chicken Munch way: a cut-out product and a giant word on a plain ground. This needs the owner's OK,
   because their sites are live and liked.
2. **New rule: one object, many kinds.** The hero product changes into each kind the business sells as you
   scroll, and each kind is named in big words. Code plus stills of each item, cut from the business's own
   photos.
3. **New rule: the object swaps sides as the words change.** Cheap, done in code.
4. **New rule: a hands-on finale.** One small thing the visitor does with the product near the end, for
   example: build a bowl, fill a gift box, tap a shade.
5. **New step: a picture of the first screen before building it.** About 1 credit, and it is shown with the
   concept sheet.
6. **Measure words per section:** a headline of at most 4 words with one line under it.

## The PULP smoothie site, watched frame by frame (8 Nov 2026)

Tzvi liked this one most. It is in Jack Roberts' video (IYNAyRkUsjI) at about 32:00. I watched it at 3 and
8 frames a second, not from the captions. See `pulp-smoothie.html` (the clip at 1.5x) and `pulp-smoothie-chain.jpg`.

**What happens as you scroll.** One shot, no cuts, led by the scroll (it plays backwards when you scroll up):
1. A strawberry hangs in a golden-hour field, with "PULP" huge behind and beside it.
2. The camera dips, "PULP" fades out, and the strawberry drops off its stem.
3. It falls with blueberries and an orange onto black: "Picked at dawn. Dropped by noon."
4. They splash into pink juice: "Blend the chaos."
5. The camera dives into the swirl: "100% fruit. 0% apologies."
6. It pulls back out. The swirl was inside a jar on a beige table: "Drink the riot.", on a frosted card with a button.
7. The beige table turns into the cream page: "Every bottle starts with a fall."
8. Four flavour cards, each in its fruit's colour (mango yellow, berry red, kiwi green, blueberry purple),
   with the fruit breaking out of the card's top corner. Then a ticker line, then a dark footer.

**Why the motion looks natural**
- **Every move has a real cause.** The fruit falls because it is picked, so it speeds up as it falls, tumbles a
  little and splashes, and drops of juice jump up. Nothing floats in or pops in.
- **The camera never stops.** It keeps a slow forward drift, so the screen is always alive, even while you read.
- **Each scene's end is the next scene's start.** The falling fruit is the splash. The swirl is the inside of the jar.
  The jar's table is the page. You never see a cut.
- **The colour travels with the story.** Gold field, then black, then pink juice, then beige, then cream page. The
  film's last colour is the page's ground, so the film hands over to the page with no line between them.
- **Words fade in place, they do not slide.** Each line fades in once the scene settles, sits in the middle of the
  screen, and fades out as the next thing moves past it. One line per scene.
- **The ending is still.** After the film, the page is plain and calm: a short headline, cards and a footer.

**What we already have.** Our film-opening rules 3h were written from this same PULP site on 16 Oct 2026 (from an
earlier video), so the big ideas are already ours: 3h.1 (one unbroken travelling shot), 3h.7 (seams), 3w.14 (the
film's last frame is the next section), 3h.17 (words and film take turns), 3w (real cause, one event). The Fruit Platter
fruit rain is our closest site. What this second look adds is how the motion is made to feel real.

**New, as options for a new site when the business has it (not rules)**
- **Colour cards per kind:** each kind or flavour gets its own colour card, with its real item breaking out of the
  top corner. Fits businesses with clear kinds (flavours, platters, gift boxes).
- **The colour travels:** plan the film's background colours as a path through the story that ends on the page's own
  ground colour, so the film melts into the page.
- **Gravity, not floating:** falling things speed up, tumble a little and land with a splash or bounce; the camera
  keeps a slow drift and never stops dead.

**Where PULP differs from our rules (left as they are):** PULP puts its lines big in the middle of the film; our 3h.9
puts them at the edge, because on The Brown Box the words covered the action. PULP's "Drink the riot." sits on a
frosted card; our rules avoid frosted glass over a moving film (it drops the frame rate, 60 fps rule).
