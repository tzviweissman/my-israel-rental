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
