# The ad blueprint: every ad rule as a step

Tzvi, 5 Nov 2026: "make all rules the blueprint for making ads so rules dont get
skipped". `docs/static-ad-rules.md` explains the rules; this file is what is
followed. Each line is one rule, in the order an ad is made: an ad cannot reach a
stage until the stage before it is answered.

    node scripts/ad-blueprint.mjs <name>                  write docs/ads/blueprints/<name>.md, one per ad or batch
    node scripts/ad-blueprint.mjs --check <name> <stage>  fails unless stages 1 to <stage> are all answered
    node scripts/ad-blueprint.mjs --done <name>           fails unless every line is ticked or n/a
    node scripts/ad-blueprint.mjs --designs               every design in the two ad areas has a finished blueprint
    node scripts/check-ad-designs.mjs                     draws every design and measures the `auto` lines

- **New design in `AdMaker.jsx` or `AdStudio.jsx`:** its blueprint is written and finished first. The commit is
  refused without it (`--designs`, run by `scripts/pre-commit-check.mjs`).
- **Hand-made ad or batch, generated or not:** the blueprint comes first. Stages 1 to 4 are answered before any
  paid picture is generated.
- **A new ad rule:** add it to `docs/static-ad-rules.md` and here in the same commit, tried on the real designs
  first. A rule added after a design shipped does not block that design (designs listed under "Made before the
  blueprint" in `scripts/ad-blueprint.mjs`), but the `auto` lines still measure it.

Line format: `id | rule | where it comes from | auto:<measure>` or `decide`. `auto` lines are measured by
`check-ad-designs`, on every design, shape and language. `decide` lines get a written answer for this ad.

## 1. The idea

A0.1 | One job: what you get, or a question, or a real offer. Never two. | static-ad-rules 0 | decide
A0.2 | One-second test: a stranger knows what is offered and where. Clarity beats cleverness. | 0 | decide
A9g.1 | Starts from an ad that already works: name the ad in docs/inspo/pinterest-ads-2026-11-02 (or Meta's Ad Library, by reach and days running) it takes its idea from. | 9d, 9g.1 | decide
A9e.2 | In one sentence: what the picture says that the words finish. Cover the words: the picture raises a question. Cover the picture: the words are not complete. | 9d, 9e.2 | decide
A9e.3 | The idea, by name: the product stands in for a familiar object, or sits in a familiar screen, or type and subject interlock, or surreal scale, or a pun. Not a good photo with a headline (scored 1.9 to 2.8). | 9d, 9e.3 | decide
A9f.1 | The angle, by name: a real moment and why ours wins there, or the exact reader, or an honest trade-off, or the want behind the feature, or a moment in the day, or a real review. | 9f | decide
A9g.9 | Is this a different-looking ad from the last ones for this business, and not the same design with another headline? | 7, 9b, 9f.6, 9g.9 | decide

## 2. The words

A2.1 | The headline is the biggest words on the ad and stops the scroll on its own; it is what the eye lands on first (squint test). | 1, 2, 9c | decide
A2.2 | At most about 8 words, never cut with a "…"; 2 to 6 is best. Rewrite, never shrink. | 2, 9e.1 | decide
A2.3 | Says who it is for or where, plus what it is, most concrete fact first. Their situation, never a boast. | 9b, 9c | decide
A2.4 | Says it the way a person would, in the reader's words; from a real review when there is one. | 2, 9g.6 | decide
A2.5 | What it gets them, or the want behind it, not just the name again. A twisted known phrase or the reader's own world beats a description. | 2, 9e.4, 9f.5, 9g.5 | decide
A2.6 | Words a ten-year-old follows, one idea a sentence. No power words, no "even if", no made-up mechanism. | 9c | decide
A2.7 | Copy rules: no long dash, no exclamation in the headline, no praise the listing never states. | voice.md, 5 | auto:words
A2.8 | Hebrew speaks in the plural (אתם), never to one man or one woman. | 9f, voice.md | decide
A2.9 | The caption: who or where, what it is and one or two facts, one plain invitation. No hashtags, no signature. | 9c | decide

## 3. The picture

A3.1 | One huge subject on one quiet ground: it fills half the frame or more, two or three colours in all. | 3, 9e.5 | decide
A3.2 | A rental or a place: only the owner's real photos. A generated room does not exist. Say where each picture comes from. | 3 | decide
A3.3 | A generated picture of a product keeps the real product: rebuilt around its real photo, its traits unchanged, compared beside that photo. Describe the reference scene in full, never "swap the product". | 9g.2, generate-right-first-time | decide
A3.4 | Another shape than the screen: the background is extended, never cropped or zoomed. | 3, page rules 3c.12 | decide
A3.5 | Sharp and bright; one colour that stands out on a white and a dark feed, from our palette or the owner's own photo and logo. | 3, 9g.3 | decide
A3.6 | A hand holding, offering or reaching in, where it helps. Real or native beats polished. | 3, 9e.6, 9g.4 | decide
A3.7 | No words drawn into a generated picture. The picture is one layer, the words typed on top and editable. | 6, 9g.8 | decide
A3.8 | Another brand's idea and composition only, never its marks, wording or product. | 9g.2 | decide

## 4. Body and proof

A4.1 | At most three points, each one fact; dropped first when the picture needs the room. | 4 | decide
A4.2 | One price, and it is the price of the thing in the picture. "From" only for the item that costs that. | 4, 9e.8 | auto:price
A4.3 | A struck-through price only when real: same thing bought separately at real prices, or really charged before. | 4 | decide
A4.4 | A review is real, shown on the public page, rated 4 or 5, the reviewer's words, shortened only by cutting. No hearts or counts. | 4 | decide
A4.5 | Press or partner logos only if the business really has them, four at most. | 4 | decide
A1.3 | The action: one thing to do, the short link and QR code, last on the eye's path. | 1, 8 | auto:link

## 5. Honesty

A5.1 | Nothing invented: no number, feature, review, person, view or distance the listing does not state. | 5 | decide
A5.2 | No scarcity or urgency unless real, with its dates. | 5 | decide
A5.3 | No fake screenshot: no text from a friend, Google review, notes app, receipt or conversation that did not happen. A familiar screen is allowed when nobody invented speaks in it: the product itself calling, a search box, switches, the reader's own list. | 5, 9e.3 | decide
A5.4 | No drawn "@brand" made to be mis-clicked; no as-seen-in; no generated person shown as a customer. | 5 | decide
A5.5 | A comparison is with a kind of thing, never a named rival, and both sides are true. | 5, 9f | decide
A5.6 | Owner-facing wording does not address "owners"; rentals lead, the business line is "Add your business, free". | CLAUDE.md | decide

## 6. Phone and shapes

A8.1 | Square 1080x1080, feed 1080x1350, story 1080x1920: each one drawn and looked at, not resized. | 8 | auto:shapes
A8.2 | No text under 30px at 1080 wide. | 8 | auto:text-size
A8.3 | Nothing cut off: every line inside the picture. | 8 | auto:text-inside
A8.4 | A story keeps the top 220px and bottom 230px clear. | 8 | auto:story-safe
A8.5 | Words over a photo cover at most 40% of it, and never the subject. | 8 | decide
A8.6 | The QR is at least 150px at 1080 wide, dark on white, with the short link printed on the ad, beside it unless the owner moved them. No drag can shrink it below 150px, cut it off or put it where a story covers it. | 8, Tzvi 5 Nov | auto:qr
A8.7 | Works in Hebrew and English: right-aligned, the QR moves to the left, letters in a font that has them. | 8 | auto:languages
A8.8 | Words readable on their background: 3:1 for large text; the price circle stays visible. | ad maker 4 Nov | decide
A8.9 | The picture that leaves the site is drawn at double size (2160 wide) from the best copy of the photo, never the preview. | Tzvi 5 Nov | auto:sharp

## 7. Before it goes out

A9.1 | Drawn and looked at on the real business, at phone size, beside the reference it came from. | test-with-a-real-business | decide
A9.2 | Would it stop you? Say what is surprising about it in one sentence; if nothing is, it goes back to stage 1. | 9d, ads-need-an-idea | decide
A9.3 | The owner can change every word and the price stays right. | intro, 6 | decide
A9.4 | Cost read from the API before any generation, and the spend reported. | CLAUDE.md | decide
