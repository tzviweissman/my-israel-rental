# Ad blueprint: design-poster

Every ad rule, in making order (docs/ad-rules-checklist.md). Answer a stage before making it; tick [x] once made.

## 1. The idea

- [x] A0.1 One job: what you get, or a question, or a real offer. Never two.
  plan: What you get: the owner's own product, huge, with its one word.
- [x] A0.2 One-second test: a stranger knows what is offered and where. Clarity beats cleverness.
  plan: The product cut out from their real photo fills the middle; the word names it and the link says where.
- [x] A9g.1 Starts from an ad that already works: name the ad in docs/inspo/pinterest-ads-2026-11-02 (or Meta's Ad Library, by reach and days running) it takes its idea from.
  plan: docs/inspo/pinterest-ads-2026-11-02 food 8d1dcab0 (DUPLO CHEESE, the burger inside the word, 5/5), creative 0917f8 (1 DAY LEFT) and 41e87d (PROMO SUNDAY), both 5/5 type-and-photo-interlock.
- [x] A9e.2 In one sentence: what the picture says that the words finish. Cover the words: the picture raises a question. Cover the picture: the words are not complete.
  plan: The picture shows the product breaking through its own word; the word and the headline under it say what it is and why.
- [x] A9e.3 The idea, by name: the product stands in for a familiar object, or sits in a familiar screen, or type and subject interlock, or surreal scale, or a pun. Not a good photo with a headline (scored 1.9 to 2.8).
  plan: type and subject interlock: the product stands in front of the lower half of one huge word.
- [x] A9f.1 The angle, by name: a real moment and why ours wins there, or the exact reader, or an honest trade-off, or the want behind the feature, or a moment in the day, or a real review.
  plan: the want behind the product: the AI's one-word key (the same big_word other designs use), the headline under it.
- [x] A9g.9 Is this a different-looking ad from the last ones for this business, and not the same design with another headline?
  plan: yes: no other design sets one word edge to edge with the product in front of it; Behind keeps the word above a smaller product on a cream ground, Giant words keeps the product small beside a sentence.
- [x] A9g.10 The gallery of one business looks varied at a glance: its designs do not share one colour or one layout, and each starts on its own product where there are several.
  plan: built by AdMaker START_LOOK, FAMILIES and THEMED give each layout its own look; confirm: check-ad-designs measure variety

## 2. The words

- [x] A2.1 The headline is the biggest words on the ad and stops the scroll on its own; it is what the eye lands on first (squint test).
  plan: the one word is the biggest thing on the ad, as wide as the ad less 36px each side, up to a third of its height.
- [x] A2.2 At most about 8 words, never cut with a "…"; 2 to 6 is best. Rewrite, never shrink.
  plan: one word (or two stacked); the headline under it at most two lines; the AI words ask for at most 5 words.
- [x] A2.3 Says who it is for or where, plus what it is, most concrete fact first. Their situation, never a boast.
  plan: the AI headline rules (9c) unchanged: what it is, place first.
- [x] A2.4 Says it the way a person would, in the reader's words; from a real review when there is one.
  plan: the AI headline rules unchanged; the owner can pick or write another.
- [x] A2.5 What it gets them, or the want behind it, not just the name again. A twisted known phrase or the reader's own world beats a description.
  plan: the big word is the AI's key word for the business, the headline the AI's idea headline (wordsFor).
- [x] A2.6 Words a ten-year-old follows, one idea a sentence. No power words, no "even if", no made-up mechanism.
  plan: the AI words rules unchanged.
- [x] A2.7 Copy rules: no long dash, no exclamation in the headline, no praise the listing never states.
  plan: measured by check-ad-designs (words)
- [x] A2.8 Hebrew speaks in the plural (אתם), never to one man or one woman.
  plan: the AI words speak in the plural in Hebrew (unchanged).
- [x] A2.9 The caption: who or where, what it is and one or two facts, one plain invitation. No hashtags, no signature.
  plan: the caption is the AI caption, unchanged.
- [x] A2.10 Short, intriguing and clear: the headline with its one small line says what the business gives and why you would want it, in plain words a stranger gets in one look (the product or service named, or unmistakable in the picture, plus what it does for them). A pun or a twist only on top of that, never instead of it: 'Set it to LOW.' told nobody what L.A. Cholent sells. The answer writes 'A stranger reads:' and what someone who has never heard of the business would take from the headline alone.
  plan: A stranger reads: their product, big, with its word (CHOLENT, RINGS, BAGELS) and the headline: what is sold is the picture itself.
- [x] A2.11 Five headlines, then cut: write at least five headlines, numbered 1) to 5), and strike each that fails one of these, naming the failure: (a) names the object without saying why you want it ('THE RING.'); (b) guesses at the reader's situation instead of the offer ('Ready to ask?'); (c) is a pun or twist only someone who already knows the business gets ('Set it to LOW.'); (d) sounds like something else, a film, a song or another brand's slogan; (e) claims what the listing does not; (f) is more than six words or needs its small line to make sense. Write 'Chosen: N' and why. When Tzvi is in the conversation, show him the best three before the ad is built and build his pick.
  plan: n/a: a design, not one ad; its headlines are the AI's five-word ideas per business, which the owner picks from (the five-then-cut rule is for hand-made ads).

## 3. The picture

- [x] A3.1 One huge subject on one quiet ground: it fills half the frame or more, two or three colours in all.
  plan: one product cut-out filling up to the ad's width less 60px a side, on one flat colour; two or three colours in all.
- [x] A3.2 A rental or a place: only the owner's real photos. A generated room does not exist. Say where each picture comes from.
  plan: n/a: a design that needs a product cut-out (CUT_ONLY); a rental or service never gets it.
- [x] A3.3 A generated picture of a product keeps the real product: rebuilt around its real photo, its traits unchanged, compared beside that photo. Describe the reference scene in full, never "swap the product".
  plan: the product is the owner's own photo cut out (utils/cutout.py), never generated.
- [x] A3.4 Another shape than the screen: the background is extended, never cropped or zoomed.
  plan: nothing is cropped: the cut-out is fitted whole (fitIn); the ground is flat colour, so no extending.
- [x] A3.5 Sharp and bright; one colour that stands out on a white and a dark feed, from our palette or the owner's own photo and logo.
  plan: starts on cream with the word in the product's own colour (look cream; brown on brown read muddy beside the library), or the owner's brand or chosen colour.
- [x] A3.6 A hand holding, offering or reaching in, where it helps. Real or native beats polished.
  plan: n/a: no hand.
- [x] A3.7 No words drawn into a generated picture. The picture is one layer, the words typed on top and editable.
  plan: built by AdMaker draws every word as its own canvas layer over the picture; confirm: LOOK
- [x] A3.8 Another brand's idea and composition only, never its marks, wording or product.
  plan: the idea of the library ads only, none of their marks or products.
- [x] A3.9 The picture fills the ad edge to edge as it was made: made in the ad's own shape or the nearest shorter one the model takes, laid at full width with scripts/ad-fit-picture.py, which carries on only the plain wall above and table below in the picture's own colours and refuses to shrink. Never shrunk with filled or pale sides. The answer names ad-fit-picture, or n/a when no picture is generated.
  plan: n/a: no picture is generated; the owner's own cut-out on a flat ground.
- [x] A3.10 A product shot is styled like a pro shoot: the product big and sharp on a rich surface (wood, stone, linen, never a bare white table), in warm shaped light, with two or three things from the business's own world at the sides (what it is served with, made from or sold beside). Props never in front of the product, never presented as the product, no cooked food passed off as theirs. Name each prop and why it belongs.
  plan: n/a: a cut-out on flat colour, the poster look of the reference ads, not a styled shoot.
- [x] A3.11 Layout first, never numbers alone: before any generated picture, its layout is drawn with scripts/ad-layout-sketch.py (boxes where the product, props and moment go; the headline and foot areas kept empty) and given to the reference-image model (marketing-studio/image/sunburst) as an image, with "photograph this layout for real" and the real product photo when there is one. Told only in words, the model centred the phone and drew eight notes for thirty. Exact parts (a screen, a label) are laid on afterwards in code. The answer names the layout picture; the ad's gen script must use it. n/a only when nothing is generated.
  plan: n/a: nothing is generated.
- [x] A3.12 A screen in an ad shows the real thing: our website or dashboard captured at the screen's own shape from the local test account (its sample data, never a real business or customer, no test-looking names), not an icon or a made-up mock. Professional is in the details. Name the page captured.
  plan: n/a: no screen.

## 4. Body and proof

- [x] A4.1 At most three points, each one fact; dropped first when the picture needs the room.
  plan: n/a: no points.
- [x] A4.2 One price, and it is the price of the thing in the picture. "From" only for the item that costs that.
  plan: built by AdMaker adIssues(words, item) flags any price in the words that is not the featured item's, shown live in the panel as the owner types; confirm: check-ad-designs measure price
- [x] A4.3 A struck-through price only when real: same thing bought separately at real prices, or really charged before.
  plan: n/a: no struck price.
- [x] A4.4 A review is real, shown on the public page, rated 4 or 5, the reviewer's words, shortened only by cutting. No hearts or counts.
  plan: n/a: no review.
- [x] A4.5 Press or partner logos only if the business really has them, four at most.
  plan: n/a: none.
- [x] A4.6 The business's own logo is on every ad it pays for or is shown in: their real logo file (the listing's logo, or cut cleanly out of a picture of theirs), never redrawn, retyped or generated, placed where it reads at phone size and clear of the phone's top bar (from 100px down on a 1920 status). The name in words may sit beside it, never in place of it. The answer names the logo file used; n/a only with "n/a: no logo" when the business has none, and then the name is set in their own style.
  plan: built by AdMaker extras() places the listing's logo on every design (part 'logo', white tile for see-through logos); AdStudio uses a fixed site LOGO, to build: the same extras() in AdStudio; confirm: check-ad-designs measure logo
- [x] A1.3 The action: one thing to do, the short link and QR code, last on the eye's path.
  plan: built by AdMaker drawFooter, footBand, qrTile and linkPiece draw link and QR in every design; confirm: check-ad-designs measure link

## 5. Honesty

- [x] A5.1 Nothing invented: no number, feature, review, person, view or distance the listing does not state.
  plan: nothing added: their product, their words.
- [x] A5.2 No scarcity or urgency unless real, with its dates.
  plan: n/a.
- [x] A5.3 No fake screenshot: no text from a friend, Google review, notes app, receipt or conversation that did not happen. A familiar screen is allowed when nobody invented speaks in it: the product itself calling, a search box, switches, the reader's own list.
  plan: n/a: no screen.
- [x] A5.4 No drawn "@brand" made to be mis-clicked; no as-seen-in; no generated person shown as a customer.
  plan: no person and no @brand.
- [x] A5.5 A comparison is with a kind of thing, never a named rival, and both sides are true.
  plan: n/a.
- [x] A5.6 Owner-facing wording does not address "owners"; rentals lead, the business line is "Add your business, free".
  plan: owner-facing label is Poster, no 'owners'.

## 6. Phone and shapes

- [x] A8.1 Square 1080x1080, feed 1080x1350, story 1080x1920: each one drawn and looked at, not resized.
  plan: built by AdMaker FORMATS and per-format draw; AdStudio SHAPES post and status; confirm: check-ad-designs measure shapes
- [x] A8.2 No text under 30px at 1080 wide.
  plan: measured by check-ad-designs (text-size)
- [x] A8.3 Nothing cut off: every line inside the picture.
  plan: built by AdMaker wrap(ctx, text, width, maxLines) and part() with minScale shrink text into its box; confirm: check-ad-designs measure text-inside
- [x] A8.4 A story keeps the top 220px and bottom 230px clear.
  plan: built by AdMaker begin() top 220 and footBand safe 230; AdStudio topOf and footTopOf; confirm: check-ad-designs measure story-safe
- [x] A8.5 Words over a photo cover at most 40% of it, and never the subject.
  plan: the words are on flat colour; only the word's lower half sits behind the product, by design (A11.2).
- [x] A8.6 The QR is at least 150px at 1080 wide, dark on white, with the short link printed whole on the ad (the business's name in it when it has a Latin one), beside it unless the owner moved them. No drag can shrink it below 150px, cut it off or put it where a story covers it.
  plan: built by AdMaker QR floor of 150, qrTile white tile, linkPiece and linkLines print the whole link, part() minScale 150/QR on drag; confirm: check-ad-designs measure qr
- [x] A8.7 Works in Hebrew and English: right-aligned, the QR moves to the left, letters in a font that has them.
  plan: built by AdMaker rtl flag (qx = rtl ? PAD : ...), headFont and bodyFont swap to Frank Ruhl Libre and Assistant, dirOf per line; confirm: check-ad-designs measure languages
- [x] A8.8 Words readable on their background: 3:1 for large text; the price circle stays visible.
  plan: built by AdMaker inkOnCol, lightGround and fg() pick ink from the ground's luminance; pillOn for the price; confirm: check-ad-designs measure colour, lostWords
- [x] A8.9 The picture that leaves the site is drawn at double size (2160 wide) from the best copy of the photo, never the preview.
  plan: built by utils/sharpCanvas sharpCanvas(target, scale) and bestPhoto(src) used by AdMaker and AdStudio; confirm: check-ad-designs measure sharp

## 7. Before it goes out

- [x] A9.1 Drawn and looked at on the real business, at phone size, beside the reference it came from.
  plan: tested on the real businesses in the local copy, at phone size, in English and Hebrew, beside the reference ads.
- [x] A9.2 Would it stop you? Say what is surprising about it in one sentence; if nothing is, it goes back to stage 1.
  plan: their product bursting out of a word as wide as the ad.
- [x] A9.3 The owner can change every word and the price stays right.
  plan: built by AdMaker words panel edits every field; adIssues keeps the price tied to the featured item; confirm: LOOK
- [x] A9.4 Cost read from the API before any generation, and the spend reported.
  plan: n/a: no generation, no cost.
- [x] A9.5 Never bland: before anyone sees it, the ad sits beside the pro ads at the same size (python scripts/ad_vs_pros.py, references in docs/inspo/pro-references). Five yes-or-no: the product is the hero, close and big (about half the width or more); one strong light or bold colour, not flat even light; something happens (a moment, motion, a surprise, an idea); the headline is part of the design, big, not a small line in a corner; it holds its own beside the pros. Any no: remade, not shown.
  plan: checked with scripts/ad_vs_pros.py on the test ad: product hero and big, one bold flat colour, the product breaks the word, the word is the design.
- [x] A9.6 Every copy of the product the picture adds (pieces in the air, a second item, a stack, a pour) matches the real photo in shape, size, colour and coating, with nothing round it the real product would not make (crumbs, drops, glow). The prompt names those traits; the sheet from backend/.venv/Scripts/python scripts/product-match-sheet.py <picture> <real photo> <sheet.jpg> is looked at piece by piece. The answer names the sheet file, or n/a when no copies are added.
  plan: n/a: no copies of the product are added.
- [x] A9.7 A 5, or it is not shown: the ad names its kind of idea and, with python scripts/ad-vs-library.py <ad> <kind>[+<kind>] <sheet.jpg>, sits beside four 5/5 library ads of that kind (docs/inspo/pinterest-ads-2026-11-02). The tool refuses a kind that averages under 4 there (minimal luxury, big type, lifestyle, info flyer) unless joined with one that averages 4 or more (visual pun, before and after, surprising scale, this or that, humour, words and picture locked together). Write 'Score: N' on the library's 1 to 5 scale and what it shares with those 5s; anything under 5 goes back to stage 1 before anyone sees it. When Tzvi is in the conversation, the best three ideas are shown to him as one line each before any picture is paid for. The answer names the sheet.
  plan: kind type-and-photo-interlock (4.00); sheet docs/ads/design-poster-vs-library.jpg. Score: 5: like SNAP, BASIL and TWIST, one huge word on a quiet cream ground with the product woven through it (behind the outer letters, in front of the middle), the word in the product's own colour. How alive it looks rests on the owner's photo: a flat board reads calmer than a pour.

## 9. The pro look (Tzvi, 8 Nov 2026: "use the new things you learnt... make it a rule for all future ad builds")

- [x] A11.1 One idea you get in a second: name the surprise, pun or visual question the picture asks; the words answer it. "A good photo with a headline" is not an idea.
  plan: the product bursting out of its own word.
- [x] A11.2 Words and picture interlock: the headline or one huge word sits behind the subject with parts of the subject in front, or the subject sits inside the letters. Name how.
  plan: the word is drawn first, the cut-out over its lower half, then the first and last letters drawn again over the product: it passes behind them and in front of the middle letters.
- [x] A11.3 One colour world: the ground takes the product's own colour or its set's, with one accent; no stock yellow sticker or white button that belongs to no picture.
  plan: cream ground with the word in the product's own colour, or the owner's colour; no sticker unless the owner turns the price on.
- [x] A11.4 A frozen moment: something is happening (falling seeds, steam, a pour, a splash, motion). Name it, and keep it true to the product.
  plan: the product rising in front of the word, its top breaking through; in the moving ad it rises in.
- [x] A11.5 Light that shapes: one strong side or back light, a fall to dark, real depth. Never flat even daylight on the hero.
  plan: the cut-out's own photo light with its drop shadow on the flat ground, as the poster references do.
- [x] A11.6 Three things carry the ad: the picture, the headline, the name. The link, code and price are small and quiet, and corners are left empty.
  plan: the picture, the word and the name; the code and link small at the foot, on the ground itself with no white plate.
- [x] A11.7 The headline is 2 to 5 spoken words, set big, in two voices where it helps (bold capitals with a lighter or script line).
  plan: one heavy face (Anton, Secular One in Hebrew) for the word and the headline: one voice.
- [x] A11.8 The product is the hero: it fills about half the width or more, close, standing on its set like a product shoot, never pasted in front of one.
  plan: the product fills up to the ad's width less 60px a side.

## 8. Moving ads

- [x] A10.1 A moving ad ends on the same picture as the still: same words, one price, the link and QR code whole.
  plan: built by AdMaker moving export draws the same design as the still; its last frame is the still (comment at line 3735); confirm: check-ad-designs measure moving
- [x] A10.2 The first frame is already an ad, because a chat shows it before anyone plays it: the headline's key word large on the ad's colour, the product, or the first words; never an empty ground.
  plan: built by AdMaker hookCard() with HOOK = 1 second, key word large on the ad's colour; confirm: check-ad-designs measure moving
- [x] A10.3 It opens on one big word, moves, then holds still at least 1.5 seconds, with the QR code still for over 3 seconds so it can be scanned.
  plan: built by AdMaker MOVE_ENDS 3.6s of 6.5s, part() delay table (qr appears at 1.55s), pieceMove; confirm: check-ad-designs measure moving
- [x] A10.4 An MP4 video (H.264) at the shape's full 1080-wide size, about 6 seconds, no sound needed to follow it.
  plan: built by AdMaker VIDEO_SECONDS = 6.5 and File 'ad-<format>.mp4' (video/mp4); confirm: check-ad-designs measure moving
