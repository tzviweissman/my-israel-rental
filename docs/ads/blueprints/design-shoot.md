# Ad blueprint: design-shoot

Every ad rule, in making order (docs/ad-rules-checklist.md). Answer a stage before making it; tick [x] once made.

## 1. The idea

- [x] A0.1 One job: what you get, or a question, or a real offer. Never two.
  plan: What you get: the product itself, photographed like a product shoot, with its price.
- [x] A0.2 One-second test: a stranger knows what is offered and where. Clarity beats cleverness.
  plan: The product fills the lower half; the big word names it; the business name is the eyebrow and the link.
- [x] A9g.1 Starts from an ad that already works: name the ad in docs/inspo/pinterest-ads-2026-11-02 (or Meta's Ad Library, by reach and days running) it takes its idea from.
  plan: docs/inspo/pro-references/cafe-costa-beans.jpg (product standing on its own material, one warm light, two-voice headline) and the two hand-made tests docs/ads/american-crust-status-ad.jpg and docs/ads/blazin-boards-status-ad.jpg that Tzvi approved (8 Nov 2026: "it looks good").
- [x] A9e.2 In one sentence: what the picture says that the words finish. Cover the words: the picture raises a question. Cover the picture: the words are not complete.
  plan: The picture shows the product at its best on a set from its own world; the lead line plus big word finish it ("Bring the" + MEAT).
- [x] A9e.3 The idea, by name: the product stands in for a familiar object, or sits in a familiar screen, or type and subject interlock, or surreal scale, or a pun. Not a good photo with a headline (scored 1.9 to 2.8).
  plan: Type and subject interlock: one huge word with the product standing in front of it (when its cut-out comes out; otherwise the word sits just above it).
- [x] A9f.1 The angle, by name: a real moment and why ours wins there, or the exact reader, or an honest trade-off, or the want behind the feature, or a moment in the day, or a real review.
  plan: The want behind the product: the lead line says the moment, the big word is the thing.
- [x] A9g.9 Is this a different-looking ad from the last ones for this business, and not the same design with another headline?
  plan: Yes: the only design that is a full photographed scene; every other design is a graphic ground.
- [x] A9g.10 The gallery of one business looks varied at a glance: its designs do not share one colour or one layout, and each starts on its own product where there are several.
  plan: measured by check-ad-designs (variety)

## 2. The words

- [x] A2.1 The headline is the biggest words on the ad and stops the scroll on its own; it is what the eye lands on first (squint test).
  plan: The big word is the largest thing on the ad, up to a quarter of its height, set in Anton (Secular One in Hebrew).
- [x] A2.2 At most about 8 words, never cut with a "…"; 2 to 6 is best. Rewrite, never shrink.
  plan: Lead 2 to 5 words plus one big word, from the AI writer (lead, big_word).
- [x] A2.3 Says who it is for or where, plus what it is, most concrete fact first. Their situation, never a boast.
  plan: The big word is the thing itself from the listing; the eyebrow says the business; the price line names the item.
- [x] A2.4 Says it the way a person would, in the reader's words; from a real review when there is one.
  plan: The lead is written "the way a person would say it" (writer rules for lead).
- [x] A2.5 What it gets them, or the want behind it, not just the name again. A twisted known phrase or the reader's own world beats a description.
  plan: The lead names the moment or want ("Bring the", "Missing real American").
- [x] A2.6 Words a ten-year-old follows, one idea a sentence. No power words, no "even if", no made-up mechanism.
  plan: Writer rules.
- [x] A2.7 Copy rules: no long dash, no exclamation in the headline, no praise the listing never states.
  plan: measured by check-ad-designs (words)
- [x] A2.8 Hebrew speaks in the plural (אתם), never to one man or one woman.
  plan: Writer rules, plural Hebrew.
- [x] A2.9 The caption: who or where, what it is and one or two facts, one plain invitation. No hashtags, no signature.
  plan: The same caption as every design.

## 3. The picture

- [x] A3.1 One huge subject on one quiet ground: it fills half the frame or more, two or three colours in all.
  plan: The product fills 75 to 85 percent of the width in the lower part (prompt); one set, its own two or three colours.
- [x] A3.2 A rental or a place: only the owner's real photos. A generated room does not exist. Say where each picture comes from.
  plan: Businesses only: the endpoint refuses rentals and sites, and takes the photo from the business's own listing, never from the request.
- [x] A3.3 A generated picture of a product keeps the real product: rebuilt around its real photo, its traits unchanged, compared beside that photo. Describe the reference scene in full, never "swap the product".
  plan: The image model gets the owner's own product photo as image 1 and is told to keep its shape, colours, arrangement and count; the set is described in full (utils/ad_shots.py). Checked beside the real photo on American Crust and Blazin' Boards.
- [x] A3.4 Another shape than the screen: the background is extended, never cropped or zoomed.
  plan: The picture is made in the ad's own shape (1:1, 4:5, 9:16), so nothing is cropped; a missing shape is made, not cut from another.
- [x] A3.5 Sharp and bright; one colour that stands out on a white and a dark feed, from our palette or the owner's own photo and logo.
  plan: Made at 2K; the big word in the kind's own accent (gold on grill, rust on bakery, rose on gift...).
- [x] A3.6 A hand holding, offering or reaching in, where it helps. Real or native beats polished.
  plan: n/a: the product alone on its set, as in a product shoot.
- [x] A3.7 No words drawn into a generated picture. The picture is one layer, the words typed on top and editable.
  plan: The prompt forbids text and letters; every word is typed on top by the ad maker and editable.
- [x] A3.8 Another brand's idea and composition only, never its marks, wording or product.
  plan: Only the composition of the reference; no marks or words of it.

## 4. Body and proof

- [x] A4.1 At most three points, each one fact; dropped first when the picture needs the room.
  plan: No points: the photo carries it, the price line names the item.
- [x] A4.2 One price, and it is the price of the thing in the picture. "From" only for the item that costs that.
  plan: measured by check-ad-designs (price)
- [x] A4.3 A struck-through price only when real: same thing bought separately at real prices, or really charged before.
  plan: n/a: no struck price.
- [x] A4.4 A review is real, shown on the public page, rated 4 or 5, the reviewer's words, shortened only by cutting. No hearts or counts.
  plan: n/a: no review unless the owner adds the real-review bubble.
- [x] A4.5 Press or partner logos only if the business really has them, four at most.
  plan: n/a: none.
- [x] A1.3 The action: one thing to do, the short link and QR code, last on the eye's path.
  plan: measured by check-ad-designs (link)

## 5. Honesty

- [x] A5.1 Nothing invented: no number, feature, review, person, view or distance the listing does not state.
  plan: Only the item's name and price from the listing; the product is the owner's own, redrawn, never invented.
- [x] A5.2 No scarcity or urgency unless real, with its dates.
  plan: None; a deal shows only with its end date.
- [x] A5.3 No fake screenshot: no text from a friend, Google review, notes app, receipt or conversation that did not happen. A familiar screen is allowed when nobody invented speaks in it: the product itself calling, a search box, switches, the reader's own list.
  plan: Not a screen.
- [x] A5.4 No drawn "@brand" made to be mis-clicked; no as-seen-in; no generated person shown as a customer.
  plan: None.
- [x] A5.5 A comparison is with a kind of thing, never a named rival, and both sides are true.
  plan: n/a: no comparison.
- [x] A5.6 Owner-facing wording does not address "owners"; rentals lead, the business line is "Add your business, free".
  plan: Customer-facing words only; the owner panel says "your business", never "owners".

## 6. Phone and shapes

- [x] A8.1 Square 1080x1080, feed 1080x1350, story 1080x1920: each one drawn and looked at, not resized.
  plan: measured by check-ad-designs (shapes)
- [x] A8.2 No text under 30px at 1080 wide.
  plan: measured by check-ad-designs (text-size)
- [x] A8.3 Nothing cut off: every line inside the picture.
  plan: measured by check-ad-designs (text-inside)
- [x] A8.4 A story keeps the top 220px and bottom 230px clear.
  plan: measured by check-ad-designs (story-safe)
- [x] A8.5 Words over a photo cover at most 40% of it, and never the subject.
  plan: Words sit in the top part the picture is made to keep plain and on the shade at the foot; the product is never under them, only in front of the big word.
- [x] A8.6 The QR is at least 150px at 1080 wide, dark on white, with the short link printed whole on the ad (the business's name in it when it has a Latin one), beside it unless the owner moved them. No drag can shrink it below 150px, cut it off or put it where a story covers it.
  plan: measured by check-ad-designs (qr)
- [x] A8.7 Works in Hebrew and English: right-aligned, the QR moves to the left, letters in a font that has them.
  plan: measured by check-ad-designs (languages)
- [x] A8.8 Words readable on their background: 3:1 for large text; the price circle stays visible.
  plan: Light words on a dark set with a shade under them, dark words on a light set with a light shade; the foot always on a dark shade.
- [x] A8.9 The picture that leaves the site is drawn at double size (2160 wide) from the best copy of the photo, never the preview.
  plan: measured by check-ad-designs (sharp)

## 7. Before it goes out

- [x] A9.1 Drawn and looked at on the real business, at phone size, beside the reference it came from.
  plan: American Crust and Blazin' Boards, English and Hebrew, feed and story, beside the hand-made tests.
- [x] A9.2 Would it stop you? Say what is surprising about it in one sentence; if nothing is, it goes back to stage 1.
  plan: A real product shoot of a small business's own product, with the product standing in front of a huge word.
- [x] A9.3 The owner can change every word and the price stays right.
  plan: The lead and big word are editable like every word; the price comes from the item in the picture.
- [x] A9.4 Cost read from the API before any generation, and the spend reported.
  plan: Higgsfield's API pricing for Marketing Studio Image read before the first test (about 2 credits, $0.11, a picture); capped at 5 a business a day, each kept and reused.
- [x] A9.5 Never bland: before anyone sees it, the ad sits beside the pro ads at the same size (python scripts/ad_vs_pros.py, references in docs/inspo/pro-references). Five yes-or-no: the product is the hero, close and big (about half the width or more); one strong light or bold colour, not flat even light; something happens (a moment, motion, a surprise, an idea); the headline is part of the design, big, not a small line in a corner; it holds its own beside the pros. Any no: remade, not shown.
  plan: Beside the pros (scripts/ad_vs_pros.py): product the hero, one warm side light, smoke or seeds falling, the big word part of the design, holds its own. Sheet: docs/ads/shoot-vs-pros.jpg.

## 9. The pro look (Tzvi, 8 Nov 2026: "use the new things you learnt... make it a rule for all future ad builds")

- [x] A11.1 One idea you get in a second: name the surprise, pun or visual question the picture asks; the words answer it. "A good photo with a headline" is not an idea.
  plan: The product, shot like an advert, in front of its own name in huge letters.
- [x] A11.2 Words and picture interlock: the headline or one huge word sits behind the subject with parts of the subject in front, or the subject sits inside the letters. Name how.
  plan: The big word behind the product: the cut-out is drawn over the word's foot.
- [x] A11.3 One colour world: the ground takes the product's own colour or its set's, with one accent; no stock yellow sticker or white button that belongs to no picture.
  plan: The set is chosen for the business's kind and the word takes that kind's accent colour.
- [x] A11.4 A frozen moment: something is happening (falling seeds, steam, a pour, a splash, motion). Name it, and keep it true to the product.
  plan: Per kind: smoke and falling salt on grill, flour dust on bakery, steam on cafe, confetti on gift, water drops on kitchen.
- [x] A11.5 Light that shapes: one strong side or back light, a fall to dark, real depth. Never flat even daylight on the hero.
  plan: Per kind: one warm side light falling to dark (grill, cafe, Chanukah), soft window light (bakery), soft daylight (gift, beauty, kitchen).
- [x] A11.6 Three things carry the ad: the picture, the headline, the name. The link, code and price are small and quiet, and corners are left empty.
  plan: Picture, big word, business name; price and link small in the foot on a shade.
- [x] A11.7 The headline is 2 to 5 spoken words, set big, in two voices where it helps (bold capitals with a lighter or script line).
  plan: Lead 2 to 5 words in italic serif, the big word in condensed capitals: two voices.
- [x] A11.8 The product is the hero: it fills about half the width or more, close, standing on its set like a product shoot, never pasted in front of one.
  plan: The model photographs the product standing on the set, 75 to 85 percent of the width; nothing is pasted.

## 8. Moving ads

- [x] A10.1 A moving ad ends on the same picture as the still: same words, one price, the link and QR code whole.
  plan: measured by check-ad-designs (moving)
- [x] A10.2 The first frame is already an ad, because a chat shows it before anyone plays it: the headline's key word large on the ad's colour, the product, or the first words; never an empty ground.
  plan: measured by check-ad-designs (moving)
- [x] A10.3 It opens on one big word, moves, then holds still at least 1.5 seconds, with the QR code still for over 3 seconds so it can be scanned.
  plan: measured by check-ad-designs (moving)
- [x] A10.4 An MP4 video (H.264) at the shape's full 1080-wide size, about 6 seconds, no sound needed to follow it.
  plan: measured by check-ad-designs (moving)
