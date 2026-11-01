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
are proposals, not built.

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
