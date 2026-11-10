# Rules for static ads

The rules for every still advert MyIsraelRental makes: the ad maker on the
dashboard (`frontend/src/components/dashboard/AdMaker.jsx`, words from
`POST /ads/make` in `backend/routes/short_links.py`), and any ad we design
by hand for a listing or a business.

Written 30 Oct 2026 for Tzvi, from five YouTube videos (sources at the end)
and from the page rules (`docs/page-generation-rules.md`) and the voice rules
(`brand/voice.md`) where they apply to an ad too. Where this file and those two
disagree about honesty, they win: this file adds to them, it never loosens
them.

**Start at the blueprint.** Every rule below is a step in
`docs/ad-rules-checklist.md`, in making order (Tzvi, 5 Nov 2026). No ad, batch or
new design is made without `node scripts/ad-blueprint.mjs <name>` answered first;
`node scripts/check-ad-designs.mjs` measures size, cut-offs, safe areas, the QR and
the price on every design. A rule added here is added there in the same commit.

**How the videos were read.** All five transcripts were read in full. The
example ads were also checked as pictures: 11 frames from four of the videos
(the ads from protein.com, Shay & Blue, Pela, Dose and Loop; the price-anchor and
"native" receipt examples; the Instagram-story ad built in Figma). A rule
marked *(seen)* was checked against an ad on screen, not just the narration.
*(N videos)* says how many of the five made the point independently.

---

## 0. The one idea

**A static ad has one glance to work, so it must say one thing, and the picture
has to stop the scroll on its own.** Every video says a version of this. A video
ad has a few seconds to hook someone. A still has the time it takes a thumb to
slow down (5 videos).

Two checks before any ad goes out, from Dara Denney's video (studied earlier,
in the Obsidian note *Static Ad Formats And Frameworks*), which these five
agree with:

- **One job per ad.** It is about what you get, or a question, or a real offer.
  Never two. Doing two jobs in one ad is the failure she sees most.
- **The one-second test.** If a stranger cannot tell in one second what is
  offered and where, the ad is not ready. Clarity beats cleverness.

---

## 1. Anatomy: three layers, in this order

Every ad has exactly three layers (3 videos; Goodo calls them headline, image
and CTA, Alessio calls them hook, body and CTA):

1. **The hook.** The picture, plus the headline. Its only job is to stop the
   scroll. The headline is the biggest words on the ad *(seen: Shay & Blue,
   Loop, Pela)*.
2. **The body.** The two or three things that make someone want it: the
   points, the price, a real review.
3. **The action.** What to do and where: in our ads, the short link and its QR
   code, at the bottom.

The eye moves top to bottom: headline, picture, points, action *(seen: Dose,
Loop)*. Nothing sits between the reader and that path.

**In the ad maker:** the picture is on top, then the place or business name,
the headline, the price, up to 3 points, and the link and QR on the bottom
edge. That is this order.

---

## 2. The headline carries the ad

- **The headline matters most.** Goodo quotes Ogilvy: "80 cents of your dollar"
  is the headline. If the headline does not stop someone, nothing below it is
  read (2 videos).
- **One specific claim beats a description.** "91% noise reduction", "The only
  phone case not made in Chinese factories". It must be one the listing can
  back (section 5).
- **Say it the way a person would.** A customer's words beat the brand's words:
  the same message tested as a quote outperformed the brand headline "almost
  every time" (Alessio; one agency's own tests, not shown). A line that sounds
  "polished enough for a billboard" does worse in the personal formats.
- **Personal language, not technical language.** "Tired under eyes", not
  "periorbital hyperpigmentation". For us that means "3 bedrooms, 5 minutes
  from the shuk", not "3BR apt, central loc." (but only when the listing says
  the 5 minutes).
- **Say what it gets them.** This is the page rule `hero`, which applies here
  unchanged: what the customer gets, not just the name again.
- **At most about 8 words.** The ad maker allows two lines and cuts with "…";
  a headline that needs the "…" is too long. Rewrite it, do not shrink it.

---

## 3. The picture

- **The picture stops the scroll, or nothing does** (4 videos). It is sharp,
  bright, and the thing being sold is the clear subject *(seen: Shay & Blue,
  Loop)*.
- **Only the owner's own photos.** Page rule `images`. The videos generate
  product scenes with AI (Nano Banana, 3 videos). **We do not do that for a
  rental or a place**: a generated room is a room that does not exist, and the
  renter finds out at the door. The only AI change allowed to a real photo is
  extending its background to fit a shape (Tzvi's rule of 27 Oct; page rules
  3c.12), never adding, removing or "improving" what is in it.
- **Whole, at its own shape, never cropped.** Same rule. The ad maker fits each
  photo whole inside its space and lets the words take what is left.
- **Leave room for the words.** Goodo shot their photos with deliberate empty
  space for the headline *(seen: Dose, Loop)*. When an owner asks how to
  photograph for an ad: step back, and leave sky or wall above the subject.
- **Real beats polished on social.** "Native" pictures (a hand holding the
  product, a phone photo in the kitchen, selfie light) are among the best
  performers right now, because they do not look like ads (4 videos). A
  rental's ordinary phone photo is not a weakness. Do not over-design around it.
- **Contrast with the feed.** A strong solid colour stands out on a white or a
  dark feed *(seen: protein.com's yellow, Shay & Blue's lilac)*. In our ads the
  colour comes from our palette or the owner's own photo and logo (page rules
  5b.4), never a colour invented for the ad.

---

## 4. The body: points, price, proof

- **Three points. Never more than five** (2 videos; Goodo: more than three
  comparisons "is too much" on a phone). The ad maker shows at most three and
  drops them entirely when the photo needs the room. That is right: points are
  the first thing to go, never the headline or the link.
- **A real review is the strongest proof** (3 videos). It can be the headline,
  set as a quote or a comment bubble *(seen: protein.com, where a short review
  sits in a social-media comment bubble with a small avatar and a heart above
  the product)*. Only a real review that the listing's or business's public
  page already shows (ours, or Google's when that import is switched on), rated
  4 or 5, in the reviewer's own words, shortened only by cutting, never
  reworded. No heart or like count: nobody liked it on our ad. A review keeps
  the direction of its own language, so an English review on a Hebrew ad still
  reads left to right. Page rule `claims`: no review, no review line.
- **Mine the reviews for the words.** Fraser reads every review "with the
  marketing cap on": a good review gives a headline, an angle and a caption
  (1 video, but it is the method all three agencies describe).
- **The price, when there is one, in a clear chip** *(seen: our price pill;
  the price-anchor example)*. A struck-through "was" price only when it is real:
  page rules 3j "show the deal", unchanged: the same thing bought separately at
  the owner's real prices, or a price really charged before, shown as "25% off"
  with the real price struck through. A business's own active discount on
  its listing (`discount` on a service) counts; nothing else does.
- **Logos of press or partners: three or four at most**, and only ones the
  business really has (1 video; page rule `claims`).

---

## 5. Honesty: what an ad may never do

Everything in page rules section 3 applies to an ad: `numbers`, `claims`,
`urgency`, `generic` and `punctuation`. And the voice rules' Banned list
applies too. The videos teach several formats that break these rules. **We do
not make them**, however well they sell:

| Format in the videos | Why we do not |
|---|---|
| Sellout, "sold out 5 times", "please don't buy", "we apologise for running out so fast" | Invented scarcity, unless the owner tells us it happened, with the dates. |
| "Limited time", "last chance", "it's always selling out so get one now" (said in a video's own example) | Page rule `urgency`. A real end date only ("Until 31 Oct"). |
| Fake screenshots: a text from a friend, a Google review, a notes app, a checkout receipt *(seen: the receipt-style ad)* | It shows a conversation or a review that did not happen. Allowed only as a real screenshot of a real message or review, with the person's permission. |
| (Allowed) Familiar screens where nobody invented speaks (9e.3): the product calling, a search box, switches, the reader's own list, a spinner | The line is an invented person or exchange, not the screen. The owner's real questions and answers may be set as messages (9b.6). |
| An "@brand" tag underlined to look clickable on an Instagram story (2 videos) | It is designed to be mis-clicked. On a real story with a real tag it is fine; drawn onto a picture it is a trick. |
| As-seen-in logos, "loved by experts" | Only with proof (page rule `claims`). |
| A generated person holding the product, presented as a customer | A customer who does not exist. |
| Praise the listing never states ("prestigious", "central", "spacious") | Enforced in code since 30 Oct 2026 (`_strip_praise` in `short_links.py`): a point or sentence with praise the owner never wrote is dropped. |

**Allowed and good:** a question that picks its reader ("Need a place for the
whole family over Sukkot?"), a problem said plainly, how it works, a real
before and after (a cleaner's real job, a renovation with real dates), a real
guarantee in the owner's words (page rules 3j.1), a real comparison when both
sides are true and the other side is a kind of thing, not a named competitor.

---

## 6. Words are kept apart from the picture

Two of the videos make the same point from their own mistakes: when the AI
generates the whole ad with the text drawn into the image, every change of
words means generating the whole thing again, and the label or the product
comes out wrong on each try (Fraser shows four tries in one video). Their fix is
to keep the picture as one layer and set the words on top in Figma or Canva.

**The ad maker already does this**: the words are typed text over the owner's
photo, editable before posting, and changing a word costs nothing. Keep it that
way. Never let a model draw words into an ad image. A model also cannot spell
Hebrew reliably.

---

## 7. Variations: test different ideas, not different commas

- **Variations should be different ads, not one ad with a new headline.**
  Meta's current system (which Fraser calls "Andromeda") treats near-copies as
  the same ad. Make the same message in different formats: a review ad, a
  question ad, a how-it-works ad (1 video, Fraser's agency practice).
- **Each owner gets at least three different angles to choose from**, not one
  headline rewritten (proposal for the ad maker, section 9).
- A message that works can become a video's opening line later (2 videos).
  Statics are the cheap way to find out which message works.

---

## 8. Making it work on a phone

These come from the page rules and from how our ads are actually seen (a
WhatsApp status, a Facebook group post, an Instagram story), not from the
videos.

- **Sizes:** square 1080×1080 (groups and the feed), feed 1080×1350,
  status or story 1080×1920. These are the three the ad maker makes.
- **Smallest text 30px at 1080 wide.** A 1080 image shows about 375px wide on a
  phone, so 30px reads as about 10px. Nothing smaller: not the link, not the
  place name. *(Checked: the ad maker's smallest text is 30px.)*
- **A story keeps the top and bottom clear.** Instagram and WhatsApp cover the
  top with the account name and the bottom with the reply bar. The ad maker
  keeps 64px of margin on every edge, except the "More photos" design, whose main photo touches the top edge. **Needs checking:** whether
  that is enough under a story's reply bar.
- **Words over a photo cover at most 40% of it on a phone** (Tzvi, 28 Oct; page
  rules, `check-photo-clear`). This applies to any design that puts the
  headline over the photo (section 9).
- **The QR code is at least 150px at 1080 wide, dark on a white tile**,
  including on the dark design. Scanners need dark on light (`QrShareCard.jsx`).
  The short link is printed under it, because most people will tap rather than
  scan.
- **The ad's language is the reader's language**, chosen per ad, not the
  owner's site language. Hebrew text is right-aligned and the QR moves to the
  left.

---

## 9. What this means for the ad maker

Ordered by how strongly the videos back them and how well they fit people
posting in groups and on WhatsApp. 1 and 2 were built on 1 Nov 2026; 3 to 5
are proposals, not built. The six designs in 9b were built the same day.

1. **A "Review" design** (3 videos): when the business or listing has a real
   review, the headline becomes that review in a comment bubble with the star
   rating, above the photo, in the protein.com layout. Real reviews only, from
   our own database. **Built 1 Nov 2026** (`drawReview` in `AdMaker.jsx`, the
   reviews from `_ad_reviews` in `short_links.py`; "Another review" steps
   through up to five). The design is greyed out when there is no review.
2. **A "Story" design** (4 videos): the photo full-screen, with two or three
   short lines in plain white boxes, in the owner's own voice, the way people
   write on their own story *(seen: Fraser's Figma build)*. Only in the
   status/story shape. It must pass the 40% rule. **Built 1 Nov 2026**
   (`drawStory`): picking it picks the story shape. The photo spans the full
   width, whole, starting just under the top 220px a story covers with the
   account name, on its own edge colour (never a blur); the headline and two
   points sit in white boxes, and the link in a white panel above the bottom
   230px, where the reply bar sits.
3. **A "Headline on the photo" design** *(seen: Loop)*: the photo full-bleed
   with one big headline over its emptiest part and the link under it. Only
   when the photo has room, measured, never covering the subject.
4. **Three angles, not one headline:** the AI writes three different headlines
   (what you get, a question for the right reader, a plain problem and fix)
   and the owner picks one.
5. **The owner's real discount in the price chip**, with the real price struck
   through, when the listing has an active discount.

Not proposed: generated scenes, fake screenshots, sellout and humble-brag
formats (section 5), and "meme" and "ugly" ads. Those last two are allowed,
but too easy to get wrong in an ad maker that works for every business at once.

## 9b. Standing out (12 more videos, 1 Nov 2026)

Tzvi, 1 Nov 2026: the five designs "all sound very basic". Twelve more videos
were read in full (captions) and three were checked frame by frame. What they
agree on, counted across videos:

- **It must not look like an ad** (8 of 12). Every winner the videos show
  looks like something people post themselves, or is so plain it reads as a
  sign. Our white card with a framed photo, headline and three ticks is the
  "middle ground" one video says ads die in: neither raw nor bold.
- **The photo and the headline complete each other** (3). Neither works
  alone, like a video title and its thumbnail. A headline that repeats the
  photo ("Beautiful apartment") wastes it.
- **Call out the reader in five to seven words** (5): a place or kind of
  job plus who it is for ("Moving in Haifa?", "For families of six"). This is
  the headline, not a tagline. It replaces the AI's general description.
- **One strong colour, not white** (1, and every poster ad sampled): a full
  flood of one colour stops the thumb before any word is read.
- **Several looks at once** (2): in one team only 9% of ads became winners,
  so the maker should hand over several different designs, not one.

### New designs (all six built 1 Nov 2026, `AdMaker.jsx`)

Each is drawable in code from what we already hold (photos, title, price,
items, reviews, link), honest, and works in Hebrew.

1. **Colour block** *(seen: Fraser, the three-column soap ad)*. The whole ad
   is one strong colour taken from the owner's own photo (its most saturated
   area, darkened until white text passes 4.5:1). The photo sits large and
   whole; the headline is huge, in white; the link is a white strip at the
   foot. Two businesses never get the same ad, because the colour is theirs.
2. **Grid** (2 videos; Dara Denney's top ad of 2024, over $2M spent). Four
   tiles: two or three of the owner's photos, each whole on its own edge
   colour, and one tile in the photo's colour holding the headline, the price
   and the QR. For a business with fewer than three photos, the design is
   greyed out.
3. **Side by side** *(seen: Fraser)*. For a business with items or price
   tiers: three columns, each one item's photo, name and real price, each on
   its own tint of one colour, with the link in a band across the foot. Real
   items only; greyed out with fewer than three that have a photo.
4. **Big words** (2 videos; "billboard", "text-heavy"). Half the ad is the
   callout headline at the largest size that fits, on a flat colour; the
   photo takes the other half. Reads at thumbnail size in a WhatsApp group.
5. **Sticky note** (3 videos, one warning it is overused). A yellow note
   "stuck" on the photo with a short line in a marker font: the price, or a
   real review cut short. It must sit over the photo's emptiest part and
   never cover the subject (page rules 3c). Hebrew needs a handwriting face
   with Hebrew letters (Amatic SC has them).
6. **Question and answer** *(seen: Aazar Shad, the Instagram question
   sticker; Matt Shiver's story ads)*. A question box in the story style with
   a question a customer would really ask ("Is there parking?") and the
   owner's answer under it. Needs the owner's question and answer; until the
   business has them, it is not offered.

And a change to every design: **the headline becomes the callout** (place or
job plus who it is for), and **the maker draws every design at once** as a row
of small previews, so the owner picks one instead of guessing.

### Seen in these videos and not adopted

| Format | Why not |
|---|---|
| Reddit or tweet lookalike with a second "user" replying | The replies in the example came from the founder's own accounts: a fake review (section 5). Our Review design already holds a real one. |
| A billboard mockup photo with the ad on it *(seen: Aazar Shad's Munich ad)* | Shows an advert that never stood on a street. |
| Memes, cartoons, mascots, "Microsoft Paint" fonts | Need a person's joke or an artist per ad; one video says the Paint font split results. |
| Before and after | Only from the owner's real before and after photos, which we do not hold yet. Worth adding as an upload later for cleaners, movers and renovators. |
| "Looking for five families…" | The number is a scarcity claim unless it is real. |
| Made-up statistics ("96% of users") | One video says they work even when invented. Never (section 5). |
| Negative reviews or "regret" headlines | Would harm the owner or invent a feeling. |

## 9c. How ads are worded (12 more videos, 1 Nov 2026)

Tzvi, 1 Nov 2026: "learn how they structure and word the ads". What the
copywriting videos agree on, and what the ad maker's prompt (`_AD_SYSTEM` in
`short_links.py`) now asks for:

- **One idea** (3 videos; Michael Masterson's "rule of one": 91 of 100 top
  offers were built on a single idea). The points only back it up.
- **Say who it is for, or where** (5 videos): "Home cleaning in Tel Aviv",
  "Flat for 6, near the beach", "Moving in Haifa?". The most concrete fact
  first: the place, the size, how many it sleeps, the kind of service.
- **Clear before clever** (3): words a ten-year-old follows, one idea a
  sentence (Jim Edwards' third-grader test).
- **The reader's situation, not a boast** (2): "for families of 6", not "we
  are the best". A family, couple or group only when the listing says so.
- **The caption in order** (2): who or where first, then what it is and one
  or two facts, then one plain invitation (look, book, message). One action
  only.
- **The squint test** (1, Evan Seech): on the picture, the headline is what
  the eye lands on first; one size and colour step above everything else.
  Every design here keeps the headline the largest text.

Not adopted: power words ("proven", "secret", "accelerator"), made-up
"mechanism" names, durations the listing never states ("28-day"), the P.S.
with a deadline, intro discounts, and "even if" lines that assume the
reader's pain. All break section 5.

---

## 9d. Ideas, not layouts (1,194 Pinterest ads, 2 Nov 2026)

Tzvi, 2 Nov 2026: the designs are "very basic, nothing original or eye
catching, just a picture of their product with a plain background". 1,194 ads
from Pinterest, about 50 for every category on the site, were labelled and
scored for how much each stops the thumb
([docs/inspo/pinterest-ads-2026-11-02/](inspo/pinterest-ads-2026-11-02/README.md)).

- The lowest scores went to what our maker draws: a list of services, a
  smiling worker, a good photo with a headline (1.9 to 2.8 out of 5).
- The highest went to ads with one idea that the picture and the words
  finish together: a visual pun (4.3), a before and after split (4.1), tiny
  people with a giant product (4.1), letters passing behind the subject
  (4.0), the photo inside a torn page, a phone or a newspaper (3.7), a fake
  app screen such as a loading spinner over an empty chair (3.6).
- Before any new ad design: pick its idea from the library, write in one
  sentence what the picture says that the words finish, and show it on one
  real business's own photos.
- The next designs the free maker can draw honestly from what we hold are
  listed in that README: fake app screen, torn paper reveal, on the map,
  this or that, newspaper front page, words behind the subject (needs a
  cut-out). Puns, giant products and jokes need a new picture per business,
  so they belong to the paid ads.

## 9e. What the best ads share (second look, 2 Nov 2026)

Tzvi asked for the library to be studied twice. First pass: every ad
scored 5 (186) beside the weakest (score 1). Second pass: the 147 strong
ones (4 and 5) that need no generated picture, to see what we can make.

What the 5s do, nearly every time:

1. **One thing, said once.** One subject, one headline of two to six
   words, the logo small. No list of services, no row of icons, no second
   headline, the phone number tiny or absent. Every score-1 ad breaks
   this: a collage of photos, a smiling worker, a services list, three
   phone numbers.
2. **Picture and words finish each other.** Neither works alone: "Will
   you..." over a hand opening a ring box with biryani in it; "Forget the
   roses, get a cookie" over cookies held as a bouquet; "Lies I tell
   myself" over a list ending in "just one more bite". Test: cover the
   words, and the picture should raise a question; cover the picture, and
   the words should not make full sense.
3. **The product takes the place of a familiar object, or sits in a
   familiar screen.** A donut as a padlock, a cup as a rocket, a QR code
   as the middle layer of a burger, a cookie inside the outline of an
   alarm clock. Or a format everyone reads in a second: an incoming call
   ("Cozy home is calling..."), a notification, toggle switches ("Work
   off, vacation on"), a search box with suggestions, a checklist, a
   receipt or bill, a newspaper, a map pin. The format does half the
   telling.
4. **The headline twists a phrase people already know** ("We'll fix it
   later", "Don't let life back up", "Stress off", "Bad-hair day? Never
   heard of her"). Plain description ("Professional cleaning services")
   never reaches a 5.
5. **One huge subject on one quiet ground.** The product fills half the
   frame or more, on one colour taken from it, with two or three colours
   in all. Small products on busy scenes score low.
6. **A human touch.** A hand holding, offering or reaching in appears in
   about a third of the 5s. It makes the product something you could take.
7. **Words built into the picture.** A giant word with the subject in
   front of part of it (GET MOVING, CHEESE, MEAT), or one letter replaced
   by the product (a bean as the O of COFFEE).

8. **One price, and it is the price of what is in the picture.** Tzvi
   caught "from $75" and "$149" on one Blazin' Boards ad (2 Nov 2026):
   the sticker said the cheapest board's price while the picture and the
   shop screen showed the $149 board. Two prices is two messages (rule 1);
   a price beside a different item tells the reader the pictured board
   costs $75, which breaks section 5. So: pick the item first, show its
   own photo, print its own price once. "From $X" only when the item
   shown is the one that costs $X. The ad maker must pass the price with
   the photo it belongs to, never a business-wide lowest price beside
   whatever photo comes first.

What we can make without paying (the second pass): the phone screens
(call, notification, toggles, search, checklist), giant words behind a
cut-out, a cut-out inside an everyday outline drawn in code, the QR code
made part of the picture, and a two-line setup and punchline. Each needs
only the business's own cut-out product, name, price and link. Generated
pictures stay for the paid ads (9d).

Applied to Blazin' Boards: "MEAT" behind their board, their board
bursting out of a phone, and "Dinner is calling..." with their board as
the caller (Decline: Cook, Accept: Order). A receipt listing their whole
menu was dropped: eight lines of prices is the list the 1s are made of.

## 9f. Three more videos (4 Nov 2026)

Watched as video, not only words: frames every 5s of Simon's "Psychology
of High Converting Static Ads" (adswithsimon, Statiq agency) and Jordan
Hayes' "100 winning ecommerce ads in 13 minutes", contact sheets read in
full; the Sweat Equity podcast with Levi Knox (Ultra pouches, ex Tube
Science) by its words, since its frames are three people on a sofa.

1. **The situation formula** (Levi; the strongest idea here). Not "Ultra
   is better than nicotine" but "nicotine in the gym sucks, Ultra is better
   in the gym": the thing people use now, in one real situation, and why
   ours wins there. Run the same product through six situations, one ad
   each. For a local business: "Cooking for twenty on Friday? Order the
   board." Find the situations in the reviews: one customer using it for
   something nobody else says is an angle to amplify.
2. **The mirror** (Simon, frame-verified): "Rude teenager?" in crayon
   letters, then three lines describing that exact home ("They snap
   before you finish a sentence / One-word answers at dinner / A
   different kid at home than at school"), then the product. Shown
   beside a wall of look-alike vitamin ads ("Your daily vitamin C" on
   pastel): the specific one is the one you see. Name the person and
   their situation, not the category.
3. **One message** (Simon, frame-verified): a yellow shoe ad built up
   layer by layer (three arrow labels, 25% off burst, SHOP NOW, "street
   deals") as the example of too many claims. The winning "This stuff
   taste nasty" ad is a logo, a quoted headline, a short honest letter and
   a hand holding the spoon. Text-heavy is fine; several claims is not.
4. **Honest and reverse** (Simon): saying the downside first ("tastes
   nasty... that's intentional") stopped the scroll and earned belief.
5. **The want behind the feature** (Simon): a features ad (20g protein,
   milk protein, muscle recovery badges) against the desire it serves.
6. **Variety, not reuse** (Jordan and Levi, two sources): Meta now
   rewards different-looking ads and punishes the same visual run for
   months. Jordan's 20 Dr. Squatch concepts, frame-verified names:
   notes-app list ("why i finally switched"), us vs them checklist
   (✓ ours / ✗ big soap), before/after, text messages, a tweet with
   counts, ingredients burst, two-panel meme ("POV: ..."), selfie,
   editorial, typographic, flat lay, Google autocomplete, review card
   ("Don't take our word for it"), ingredient label, subscription, gift.
7. **Who first, then what** (Jordan): the AI proposes three or four
   customer types, each with how aware they are of the problem, and the
   owner picks before any words are written.
8. **A moment in the day** (Jordan, frame-verified FLO ads): the product
   in a real moment with a time or place in the headline ("It lives in
   my bag now", "One before bed. Every night.", "3pm, the week before,
   and still myself"), serif headlines with one italic phrase in the
   brand colour. The real product photo is kept, never regenerated.

For the ad maker: (1) and (2) are words the model can write from the
listing and its reviews, each drawn by layouts we already have or by a
plain "mirror" card; the post and us vs them formats in (6) need only the
cut-out, words and code, so they stay free (9e). Text messages and a notes app
as Jordan makes them are fake screenshots (section 5): ours are the owner's real
questions and answers, and a plain numbered list. The post shows no counts.

Discount: Simon and Jordan both close on "book a call" with their
agencies, and every spend figure ($300k at 2x, $93k) is their own claim.
Jordan's system generates every picture through a paid image service,
which our free ads do not (9d). The podcast carries two sponsor reads
(Social Snowball) and one host is an investor in Tribe, which it praises.

## 9h. What makes it look designed (Tzvi, 6 Nov 2026: "can we make the ads better")

1. The maker offers three headlines with an idea (a twisted known phrase, the moment in the day, the want behind it), the plain one a tap away. Each still only states what the listing states.
2. One word of the headline is in the accent colour. The owner's own word colour turns this off.
3. A cut-out sits somewhere: light behind it, a dark soft patch where it touches, a slight turn on the layouts where that suits it. Fine grain over the ad, never when the owner typed an exact colour.

## 9g. Three more videos: why an ad catches the eye (4 Nov 2026)

Janson Smith "How I Use AI to Copy Winning Ads", Fraser Cottrell "The Ultimate
Guide to Static Image Ads", and Higgsfield's own "GPT-6 Astra Changed Meta Ads
Forever". All three read in full; contact sheets of frames every 5s sampled,
not every sheet (4 of 8, 3 of 14, 2 of 11), chosen where ads are on screen.

1. **Start from an ad that already works, never a blank page** (all three).
   Meta's Ad Library, sorted by reach, or how long an ad has run (Higgsfield's
   slide: 200 reach against 20,000 on the same money); Pinterest when no spend
   is known. Our library in docs/inspo/pinterest-ads-2026-11-02 is that board.
2. **Describe the reference, do not ask for a swap** (Janson, frame-verified).
   "Swap the bottle for a Nivea bottle" gave a product that looked pasted in.
   A long description of the reference (subject, composition, camera, light,
   background, materials), rebuilt around the attached product photo and its
   colours, gave a new scene that looked made for it: the Kdelle checkerboard
   room came back blue with Nivea, her hand on the bottle. Take the idea and
   the composition; never another brand's marks or wording.
3. **Eye-catching is mostly three things** (Fraser, frame-verified): one
   saturated colour that stands out on a white or dark feed (protein.com's
   yellow); a sharp, vibrant product front and centre; or something that does
   not look like an ad at all. Then a headline and one call to action, nothing
   more. Simon (9f) and Higgsfield's video say the same: the simplest win.
4. **Looks-native formats** (Fraser, frame-verified): a real review cut short
   in a comment bubble with a face and a heart over the product; a phone photo
   of a hand holding it with Instagram-story white boxes and an underlined
   @name, made in 15 minutes; a shocking close-up whose caption tells a long
   customer story, its first line working as the headline.
5. **A headline about the reader's world**: "Claim it before the group chat
   does" (Fraser). One such line then fed many other ads.
6. **Mine the reviews** (Fraser; Levi in 9f): a real line becomes the headline.
7. **Three kinds that convert** (Higgsfield, frame-verified): a callout diagram
   (thin lines from the product to circles showing each feature, saying what
   it does for the reader), a review card, an offer card with the old price
   struck through. For services: a pain, the result, and something free.
8. **Words stay out of the generated picture** (Fraser): changing a word must
   not mean paying for a new image. The picture is generated, the words stay
   editable on top.
9. **One message, many different-looking ads** (Fraser, with 9f.6): not the
   same design with another headline.

Discount: Janson sells a coaching community and pushes an account-sharing
service for paid tools, which we will not use. Fraser sells a course and an
agency. The third is Higgsfield promoting Higgsfield, its numbers its own.

## 10. What to discount from the videos

- **All five are sales funnels.** Three are from Fraser Cottrell's agency (the
  captions spell its name several ways; not checked), which pitches to brands "spending over 70,000 a month" and
  sells a course. Goodo Studios pitches the same way. Alessio's video ends with
  a "DM me" swipe file. Two have paid sponsor slots (Particle, Omnisend).
- **Their world is paid ads on Meta for online shops** (protein shakes,
  skincare, perfume). Our people mostly post free, in groups and on their own
  status, for a flat, a service or a local business. "Retargeting",
  "cold traffic" and spend figures do not transfer. What does transfer is the
  craft: one idea, a stopping picture, a real voice, three layers.
- **The numbers are asserted, not shown.** "Six figures of spend", "top 1%",
  "a 3.5% click-through rate". Treat them as anecdotes.
- **Several of their tactics break our honesty rules** (section 5). That they
  sell is not a reason.
- Comments on the videos were not read.

---

## Sources

| Video | Who | Used for |
|---|---|---|
| [Watch Me Create 3 Static Ads With AI](https://youtu.be/KlhBwk1kmzI) | Fraser Cottrell | native story format, words kept apart from the picture, AI scene prompting (not adopted) |
| [Canva magic layers for AI statics](https://youtu.be/SJi5todbhJg) | Fraser Cottrell | text baked into AI images is the problem, review plus stars plus CTA layout |
| [The Only Static Ads Tutorial You'll Ever Need](https://youtu.be/tNe7Y9YU1y8) | Alessio Cordeddu | 29 formats, three layers, stacking formats, which formats we refuse |
| [The Ultimate Guide to Static Image Ads](https://youtu.be/1FpqxqbHxVQ) | Fraser Cottrell | review in a comment bubble, native storytelling captions, mining reviews, variations |
| [How I Make Static Image Ads](https://youtu.be/JzwW3hbggXU) | Matthew, founder of Goodo Studios | research before design, headline is 80%, three comparisons max, room for words in the photo |
| [I Tested 500 Static Ads](https://youtu.be/TouPE2n7mzo) | Fraser Cottrell | colour block, collage grid, side by side, story native (frames checked) |
| [How To Make Ugly Meta Ads That Convert](https://youtu.be/quXF9Z172MY) | Aazar Shad | the "pretty ugly" headline formula, big words, question sticker, what was refused (frames checked) |
| [107 Creative Poster Ads](https://youtu.be/9RQoA9FG3xs) | All The Things | one object on one flat colour (frames only) |
| [10 Meta Ads Creative Formats](https://youtu.be/_ZHS6tW3f_Q) | Dara Denney | grid ad, text-heavy ads, 9% winners, so several looks |
| [The Ugly Ads Formula](https://youtu.be/OzkRU3Wx_1w) | Alex Cooper | raw or bold, never the middle |
| [The ONLY Marketing Video A Graphic Designer Needs](https://youtu.be/CzyCiQfqjEg) | Satori Graphics | one clear message (no formats) |
| [8 Static Creatives Analysed](https://youtu.be/jzXV-U_rSEk) | Blue Sense Digital | photo and headline complete each other, five-to-six-word callouts |
| [5 Static Ad Formats](https://youtu.be/4STF6AeiTjQ) | Carlos Lorio | sticky note, stars and quote, us versus them |
| [Psychology of Scroll-Stopping Ads](https://youtu.be/ScEbrSCN6Bs) | Motion | surprise and trust signals (video only, little used) |
| [Showing the Moment, Not the Problem](https://youtu.be/m_xSpYZE76w) | blake ecom | the moment line as a headline |
| [I Tested 1,000+ Static Ads](https://youtu.be/4mGhk4heWOc) | Jared Robinson | review that answers a doubt, headliners |
| [I Analysed 400+ Static Ads](https://youtu.be/UbGPW7N8S18) | Deniz Sancar | contrarian headlines must be backed up, objection answers |
| [4 Types of Static Ads That Generate Leads](https://youtu.be/wVtwwADTN3U) | Matt Shiver | story-native ads for services, hi-fi and lo-fi mix |
| [How To Make Ad Headlines That Get Clicks](https://youtu.be/kGfzLjPNsBU) | Alex Hormozi | headline on the banner, caption says who it is for |
| [The Copy Rule I Learned From The Best Copywriter](https://youtu.be/OyGKFhTf0go) | Alex Hormozi | Masterson's rule of one |
| [#1 Tip For Headlines That Hook](https://youtu.be/hk42MRVlNzM) | Jim Edwards | benefit-led headline, third-grader test |
| [Writing Ad Copy: The 4 Rules](https://youtu.be/qGGhnUE7sxY) | Stuff About Advertising | clear first |
| [7 Catchy Headline Formulas](https://youtu.be/SZb6NA0_ILc) | Jason Whaling | formulas; most refused (section 9c) |
| [Copy Hacks for Facebook Ads](https://youtu.be/fSZDxK0xfww) | Dara Denney | write the points first, then the lead line |
| [Facebook Ads for a Home Service Business](https://youtu.be/KAuxJabBkpA) | Jonas Olson | local call-out, caption order, one action |
| [Facebook Ad Copy for Local Businesses](https://youtu.be/MiYFfa0OEW8) | Travis Peters | short question opening |
| [Copywriting for Hotel Websites](https://youtu.be/6xLYqVsI0jo) | More Direct Bookings | one ideal guest, the local angle |
| [What I Learned Running $50M+ in Static Ads](https://youtu.be/h5dn_PTURjc) | Evan Seech | one idea, squint test, cut words |
| [I Made 150+ Static Ads](https://youtu.be/9hr1uEEap2o) | Nik Pakhrin | who it is for within half a second |
| [Static Ads Masterclass 2026](https://youtu.be/2BrGawWj1aI) | Fraser Cottrell | skimmable, objection, proof |

## Moving ads (Tzvi, 6 Nov 2026)

"Moving ads for WhatsApp, statuses, Instagram and Facebook, so it's not just a static ad." The pieces of the
same design move, drawn in the browser for free: the product arrives, the words land one at a time, the price
pops, the link and QR slide in, and it holds on the finished ad. A short MP4 rather than a GIF: it is sharper,
smaller, and what statuses and feeds expect. Every still rule still applies, because the last frame is the
still. Steps A10.1 to A10.4 in `docs/ad-rules-checklist.md`.

## Never bland (Tzvi, 8 Nov 2026)

"This seems a bit bland... make sure we dont make it bland in the future." Our first product-photo ad had six
small bagels under an empty wall, flat daylight, nothing happening and a small headline: correct, and forgettable
beside the pro ads. So every ad is put beside the pro references before it is shown (scripts/ad_vs_pros.py) and
must pass five checks: product as hero, strong light or colour, something happening, the headline as design, holds
its own beside the pros. Step A9.5 in docs/ad-rules-checklist.md.

## The pro look, for every ad (Tzvi, 8 Nov 2026)

"Use the new things you learnt for the ad and make it a rule for all future ad builds." What the pro ads share
(docs/inspo/pro-references/README.md) is now stage 9 of docs/ad-rules-checklist.md (A11.1 to A11.8): one idea you
get in a second; words and picture interlocked; one colour world; a frozen moment; light that shapes; three things
carry the ad; a short headline in two voices; the product as the hero, standing on its set. Planned in the
blueprint before building, checked on the ad-vs-pros sheet (A9.5) before anyone sees it.

## Every copy of the product matches the real one (Tzvi, 9 Nov 2026)

"He just might not like that the poppers look a little off, the ones in the air." Chicken Munch's status ad had his
real bowl of Hot Poppers right, but the four pieces the model added leaping out of it were square, lighter, glowing
at the edges and surrounded by dry crumbs his glazed poppers never shed. Only the bowl had been compared with his
photo; the added pieces were never looked at up close. So any generated picture that adds copies of the product
(pieces in the air, a second item, a stack, a pour) gets a sheet from scripts/product-match-sheet.py: each separate
piece cropped at full size over his real photo at the same scale, and each one must match in shape, size, colour and
coating, with nothing round it that the real product would not make (crumbs, drops, steam, sparks). The prompt says
so first: every added piece is a copy of the ones in the real photo, named by its own traits, and the light falls on
them from the front like the real photo's. Step A9.6 in docs/ad-rules-checklist.md; its answer names the sheet, or
"n/a" when the picture adds no copies.

Ad picture prompts start from the closest proven one in `docs/prompts/README.md` (Tzvi, 10 Nov 2026: right the
first time); a prompt whose picture is used goes in there with its number of takes.

## Edge to edge, and styled like a shoot (Tzvi, 10 Nov 2026)

"The la cholent ad is whiteish on the sides; show his product clearly and make it look premium and delicious like
with product photos with other things on the side to make it less plain." The first L.A. Cholent picture was made
too tall for the words, so it was shrunk and its sides filled with its own edge colours: pale bands that read as
unfinished. Two rules came of it. A3.9: the picture runs edge to edge as it was made, laid with
scripts/ad-fit-picture.py, which only carries on the plain wall above and the table below and refuses to shrink;
a picture that does not fit is made again in a shorter shape. A3.10: a product shot is styled like a pro shoot, on a
rich surface in warm light, with two or three things from the business's own world at the sides (for L.A. Cholent:
a challah, the marrow bones and beef they sell as add-ons, Shabbos candles), never in front of the product and never
passed off as it.

## The headline says the offer (Tzvi, 10 Nov 2026)

"Set to low doesnt help explain anything that the business is trying to give over... the message should be short,
intriguing, and clear." L.A. Cholent's "Set it to LOW." was a pun that worked only for someone who already knew the
kit. A headline, with its one small line, must tell a stranger in one look what is on offer and why they would want
it: the product or service named, or unmistakable in the picture, plus what it does for them ("Shabbos cholent?
Just add water."). Wordplay is welcome on top of that, never instead of it. Step A2.10 in docs/ad-rules-checklist.md:
the blueprint answer writes "A stranger reads:" and what that stranger would take from the headline alone, and the
blueprint refuses an answer without it.
