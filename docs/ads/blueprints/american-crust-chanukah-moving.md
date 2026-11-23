# Ad blueprint: american-crust-chanukah-moving

Every ad rule, in making order (docs/ad-rules-checklist.md). Answer a stage before making it; tick [x] once made.

## 1. The idea

- [ ] A0.1 One job: what you get, or a question, or a real offer. Never two.
  plan: what you get: American Crust's American-style bagel dough, for Chanukah. No offer, no question.
- [ ] A0.2 One-second test: a stranger knows what is offered and where. Clarity beats cleverness.
  plan: the jars and the Maccabee from the first frame; their pack with its label in the third shot; their name, link and QR at the end.
- [ ] A9g.1 Starts from an ad that already works: name the ad in docs/inspo/pinterest-ads-2026-11-02 (or Meta's Ad Library, by reach and days running) it takes its idea from.
  plan: motion library d09 and d76 (5/5: a character acts out a short story on the real product), n04 (pack to oven to plate); the same 3D Maccabees as the Chicken Munch Chanukah ad (Tzvi liked that direction, 22 Nov 2026).
- [ ] A9e.2 In one sentence: what the picture says that the words finish. Cover the words: the picture raises a question. Cover the picture: the words are not complete.
  plan: seven jars empty, the eighth glows: the picture asks what is in it; the words finish it: stop searching, start baking.
- [ ] A9e.3 The idea, by name: the product stands in for a familiar object, or sits in a familiar screen, or type and subject interlock, or surreal scale, or a pun. Not a good photo with a headline (scored 1.9 to 2.8).
  plan: the product stands in for a familiar thing: their bagel dough pack takes the place of the jug of oil in the Chanukah story.
- [ ] A9f.1 The angle, by name: a real moment and why ours wins there, or the exact reader, or an honest trade-off, or the want behind the feature, or a moment in the day, or a real review.
  plan: a moment in the year: Chanukah, where the find in the jar is the story everyone knows.
- [ ] A9g.9 Is this a different-looking ad from the last ones for this business, and not the same design with another headline?
  plan: yes: a 3D story in a lamp-lit hall instead of their earlier flat moving ad (Boil. Bake. Brag. on mustard), the pack found in a jar, then baked and eaten.
- [ ] A9g.10 The gallery of one business looks varied at a glance: its designs do not share one colour or one layout, and each starts on its own product where there are several.
  plan: measured by check-ad-designs (variety)
- [ ] A27.1 The site's brand: for a business with a custom site, name its scrollcraft/builds/<folder>/BRAND.md and say which of its colours and fonts this ad uses and which of its bans it keeps; or "n/a: no custom site".
  plan: scrollcraft/builds/american-crust/BRAND.md (written 22 Nov 2026 from the site as built): mustard #FDB225 and black #141414, tall condensed capitals (League Gothic) for the headline, their label and logo as printed; keeps its bans (no invented claims, kosher wording exactly theirs).
- [ ] A28.1 The look is chosen before anything is built: one cheap sample still of the same moment in each look that fits the idea (drawn flat, 3D animated film, real photo), shown to Tzvi side by side; the answer names the look he chose and the sample sheet.
  plan: the look was chosen by Tzvi on 22 Nov 2026 as the same 3D animated film look as the Chicken Munch Chanukah ad ("make a similar gif video", "just make it an american crust film"); the glowing-jar still is made first and checked before the rest.
- [ ] A28.2 A product rebuilt in a generated scene keeps its own label: the real label or sticker, cut from their photo, is laid over the rebuilt one on the still ad and on frames where it holds still. The answer names the label file, or n/a: the product is their own photo.
  plan: their real label (label.png) cut from frontend/public/pages/american-crust/assets/bagel-dough.webp, laid over the rebuilt pack on the still ad; in the moving shots (d3, d6, c5) fitted frame by frame with scripts/label-fit.py onto the clip's own label, in the room's light (Tzvi, 23 Nov: the flat paste looked off).
- [ ] A28.3 When a generated still or clip shows their product: their real product photo is given to the model as a reference image, and the prompt asks for the product with a plain panel in the label's main colour, the label's shape and place, and no writing on it. The answer names the product photo and the panel colour, or n/a: no product in a generated shot.
  plan: their pack photo bagel-dough.webp was given as the reference (gen3d.py FILES "pack"); the stills were made before this rule, so the model drew its own lookalike label, which label-fit covers. Next remake asks for a plain #FDB225 panel.

## 2. The words

- [ ] A2.1 The headline is the biggest words on the ad and stops the scroll on its own; it is what the eye lands on first (squint test).
  plan: the headline is the biggest words on the last frame, tall condensed capitals, the second line in their mustard.
- [ ] A2.2 At most about 8 words, never cut with a "…"; 2 to 6 is best. Rewrite, never shrink.
  plan: 4 words, with one small line under it.
- [ ] A2.3 Says who it is for or where, plus what it is, most concrete fact first. Their situation, never a boast.
  plan: what it is in the small line: American Crust's American-style bagel dough, makes 6 bagels.
- [ ] A2.4 Says it the way a person would, in the reader's words; from a real review when there is one.
  plan: Tzvi's pick, 22 Nov 2026: 'Stop searching. Start baking.'
- [ ] A2.5 What it gets them, or the want behind it, not just the name again. A twisted known phrase or the reader's own world beats a description.
  plan: the want: the Chanukah search ends in fresh bagels at home.
- [ ] A2.6 Words a ten-year-old follows, one idea a sentence. No power words, no "even if", no made-up mechanism.
  plan: yes, two short sentences.
- [ ] A2.7 Copy rules: no long dash, no exclamation in the headline, no praise the listing never states.
  plan: measured by check-ad-designs (words)
- [ ] A2.8 Hebrew speaks in the plural (אתם), never to one man or one woman.
  plan: n/a: English ad.
- [ ] A2.9 The caption: who or where, what it is and one or two facts, one plain invitation. No hashtags, no signature.
  plan: Stop searching. Start baking. American Crust's American-style bagel dough makes 6 bagels: boil, bake, enjoy. Pareve, hechsher of Rabbi Akiva Dershowitz. Delivery in Ramat Eshkol and around. Order on myisraelrental.com/p/american-crust
- [ ] A2.10 Short, intriguing and clear: the headline with its one small line says what the business gives and why you would want it, in plain words a stranger gets in one look (the product or service named, or unmistakable in the picture, plus what it does for them). A pun or a twist only on top of that, never instead of it: 'Set it to LOW.' told nobody what L.A. Cholent sells. The answer writes 'A stranger reads:' and what someone who has never heard of the business would take from the headline alone.
  plan: A stranger reads: a Maccabee searches the jars and finds bagel dough instead of oil; it is American Crust's bagel dough, kosher, to bake at home for Chanukah.
- [ ] A2.11 Five headlines, then cut: write at least five headlines, numbered 1) to 5), and strike each that fails one of these, naming the failure: (a) names the object without saying why you want it ('THE RING.'); (b) guesses at the reader's situation instead of the offer ('Ready to ask?'); (c) is a pun or twist only someone who already knows the business gets ('Set it to LOW.'); (d) sounds like something else, a film, a song or another brand's slogan; (e) claims what the listing does not; (f) is more than six words or needs its small line to make sense. Write 'Chosen: N' and why. When Tzvi is in the conversation, show him the best three before the ad is built and build his pick.
  plan: 1) struck: Finding dinner shouldn't take a miracle. (e) dough is not dinner, and it jokes on the miracle. 2) Stop searching. Start baking. 3) struck: Not everything is hard to find. (f) needs its small line. 4) struck: The oil was the hard part. (c) and a taste claim. 5) struck: Local businesses, without the search. (a) the ad is now American Crust's own, not the marketplace's. Chosen: 2, Tzvi's pick; the small line names the product so (a) and (f) pass. Headlines written by Fable 5.2.

## 3. The picture

- [ ] A3.1 One huge subject on one quiet ground: it fills half the frame or more, two or three colours in all.
  plan: one subject at the end: the three round the table with their pack and the bagels, under a dark arch kept clear for words.
- [ ] A3.2 A rental or a place: only the owner's real photos. A generated room does not exist. Say where each picture comes from.
  plan: n/a: a product.
- [ ] A3.3 A generated picture of a product keeps the real product: rebuilt around its real photo, its traits unchanged, compared beside that photo. Describe the reference scene in full, never "swap the product".
  plan: the pack rebuilt in 3D from their photo assets/bagel-dough.webp (clear clamshell, six pale dough rings, mustard label) and the bagels from assets/baked-bagels.webp (everything topping), each checked beside the photo (product-match-sheet).
- [ ] A3.4 Another shape than the screen: the background is extended, never cropped or zoomed.
  plan: made 9:16.
- [ ] A3.5 Sharp and bright; one colour that stands out on a white and a dark feed, from our palette or the owner's own photo and logo.
  plan: warm lamp-lit gold with their mustard label and logo: stands out on a white and a dark feed.
- [ ] A3.6 A hand holding, offering or reaching in, where it helps. Real or native beats polished.
  plan: the Maccabee tips the jars, lifts the lid, lifts out the pack; a friend pulls the paddle; they eat (A11.11).
- [ ] A3.7 No words drawn into a generated picture. The picture is one layer, the words typed on top and editable.
  plan: no words generated: the label is laid on in code from their photo, all words typed.
- [ ] A3.8 Another brand's idea and composition only, never its marks, wording or product.
  plan: d09's idea (a character acting on real food) only.
- [ ] A3.9 The picture fills the ad edge to edge as it was made: made in the ad's own shape or the nearest shorter one the model takes, laid at full width with scripts/ad-fit-picture.py, which carries on only the plain wall above and table below in the picture's own colours and refuses to shrink. Never shrunk with filled or pale sides. The answer names ad-fit-picture, or n/a when no picture is generated.
  plan: n/a: every still is made 9:16, nothing shrunk or filled.
- [ ] A3.10 A product shot is styled like a pro shoot: the product big and sharp on a rich surface (wood, stone, linen, never a bare white table), in warm shaped light, with two or three things from the business's own world at the sides (what it is served with, made from or sold beside). Props never in front of the product, never presented as the product, no cooked food passed off as theirs. Name each prop and why it belongs.
  plan: their pack and bagels as photographed, in a lamp-lit stone hall with jars and a menorah from the Chanukah story; nothing in front of the product.
- [ ] A3.11 Layout first, never numbers alone: before any generated picture, its layout is drawn with scripts/ad-layout-sketch.py (boxes where the product, props and moment go; the headline and foot areas kept empty) and given to the reference-image model (marketing-studio/image/sunburst) as an image, with "photograph this layout for real" and the real product photo when there is one. Told only in words, the model centred the phone and drew eight notes for thirty. Exact parts (a screen, a label) are laid on afterwards in code. The answer names the layout picture; the ad's gen script must use it. n/a only when nothing is generated.
  plan: layout sketch docs/ads/gen/american-crust-chanukah-moving/layout.png (the last frame: dark arch kept clear for words, the three round the table, the pack centre), given to the reference-image model with s5; the story shots s1 to s4 are close shots described in words, following the Chicken Munch Chanukah shots, and each is checked by eye before its clip.
- [ ] A3.12 A screen in an ad shows the real thing: our website or dashboard captured at the screen's own shape from the local test account (its sample data, never a real business or customer, no test-looking names), not an icon or a made-up mock. Professional is in the details. Name the page captured.
  plan: n/a: no screen.

## 4. Body and proof

- [ ] A4.1 At most three points, each one fact; dropped first when the picture needs the room.
  plan: one line: Pareve, hechsher of Rabbi Akiva Dershowitz.
- [ ] A4.2 One price, and it is the price of the thing in the picture. "From" only for the item that costs that.
  plan: measured by check-ad-designs (price)
- [ ] A4.3 A struck-through price only when real: same thing bought separately at real prices, or really charged before.
  plan: n/a: no price (Tzvi, 22 Nov 2026: no price).
- [ ] A4.4 A review is real, shown on the public page, rated 4 or 5, the reviewer's words, shortened only by cutting. No hearts or counts.
  plan: n/a: no review.
- [ ] A4.5 Press or partner logos only if the business really has them, four at most.
  plan: n/a: no press logos.
- [ ] A4.6 The business's own logo is on every ad it pays for or is shown in: their real logo file (the listing's logo, or cut cleanly out of a picture of theirs), never redrawn, retyped or generated, placed where it reads at phone size and clear of the phone's top bar (from 100px down on a 1920 status). The name in words may sit beside it, never in place of it. The answer names the logo file used; n/a only with "n/a: no logo" when the business has none, and then the name is set in their own style. Since 18 Nov 2026 its lettering is at least 30px tall at 1080 wide, measured: check-moving-ad.py does it on a moving ad's last frame, and a still ad's answer quotes backend/.venv/Scripts/python scripts/logo_check.py <ad.png> <x,y,w,h>. A badge, seal or flyer whose letters are small or sit on a busy picture is not shrunk into a corner: their wordmark is cut out clean (docs/ads/gen/la-cholent-chain-moving/logo-mark.png) and shown large.
  plan: their round logo frontend/public/pages/american-crust/assets/logo.webp at the top centre from 236px, about 300px wide (its letters measured over 30px by check-moving-ad).
- [ ] A1.3 The action: one thing to do, the short link and QR code, last on the eye's path.
  plan: measured by check-ad-designs (link)

## 5. Honesty

- [ ] A5.1 Nothing invented: no number, feature, review, person, view or distance the listing does not state.
  plan: ...
- [ ] A5.2 No scarcity or urgency unless real, with its dates.
  plan: ...
- [ ] A5.3 No fake screenshot: no text from a friend, Google review, notes app, receipt or conversation that did not happen. A familiar screen is allowed when nobody invented speaks in it: the product itself calling, a search box, switches, the reader's own list.
  plan: ...
- [ ] A5.4 No drawn "@brand" made to be mis-clicked; no as-seen-in; no generated person shown as a customer.
  plan: ...
- [ ] A5.5 A comparison is with a kind of thing, never a named rival, and both sides are true.
  plan: ...
- [ ] A5.7 Every listing photo the ad uses is clean, checked before the layout: cut to its subject with no phone number, email or person's name, no screenshot edges or app icons, no other logo or certificate, no 'before' photo without its 'after'. A photo that cannot be cut clean is left out. The answer lists each photo and its cut, or n/a: the ad uses no listing photos.
  plan: ...
- [ ] A5.6 Owner-facing wording does not address "owners"; rentals lead, the business line is "Add your business, free".
  plan: ...

## 6. Phone and shapes

- [ ] A8.1 Square 1080x1080, feed 1080x1350, story 1080x1920: each one drawn and looked at, not resized.
  plan: measured by check-ad-designs (shapes)
- [ ] A8.2 No text under 30px at 1080 wide.
  plan: measured by check-ad-designs (text-size)
- [ ] A8.3 Nothing cut off: every line inside the picture.
  plan: measured by check-ad-designs (text-inside)
- [ ] A8.4 A story keeps the top 220px and bottom 230px clear.
  plan: measured by check-ad-designs (story-safe)
- [ ] A8.5 Words over a photo cover at most 40% of it, and never the subject.
  plan: ...
- [ ] A8.6 The QR is at least 150px at 1080 wide, dark on white, with the short link printed whole on the ad (the business's name in it when it has a Latin one), beside it unless the owner moved them. No drag can shrink it below 150px, cut it off or put it where a story covers it.
  plan: measured by check-ad-designs (qr)
- [ ] A8.7 Works in Hebrew and English: right-aligned, the QR moves to the left, letters in a font that has them.
  plan: measured by check-ad-designs (languages)
- [ ] A8.8 Words readable on their background: 3:1 for large text; the price circle stays visible.
  plan: ...
- [ ] A8.9 The picture that leaves the site is drawn at double size (2160 wide) from the best copy of the photo, never the preview.
  plan: measured by check-ad-designs (sharp)

## 7. Before it goes out

- [ ] A9.1 Drawn and looked at on the real business, at phone size, beside the reference it came from.
  plan: ...
- [ ] A9.2 Would it stop you? Say what is surprising about it in one sentence; if nothing is, it goes back to stage 1.
  plan: ...
- [ ] A9.3 The owner can change every word and the price stays right.
  plan: ...
- [ ] A9.4 Cost read from the API before any generation, and the spend reported.
  plan: ...
- [ ] A9.5 Never bland: before anyone sees it, the ad sits beside the pro ads at the same size (python scripts/ad_vs_pros.py, references in docs/inspo/pro-references). Five yes-or-no: the product is the hero, close and big (about half the width or more); one strong light or bold colour, not flat even light; something happens (a moment, motion, a surprise, an idea); the headline is part of the design, big, not a small line in a corner; it holds its own beside the pros. Any no: remade, not shown.
  plan: ...
- [ ] A9.6 Every copy of the product the picture adds (pieces in the air, a second item, a stack, a pour) matches the real photo in shape, size, colour and coating, with nothing round it the real product would not make (crumbs, drops, glow). The prompt names those traits; the sheet from backend/.venv/Scripts/python scripts/product-match-sheet.py <picture> <real photo> <sheet.jpg> is looked at piece by piece. The answer names the sheet file, or n/a when no copies are added.
  plan: ...
- [ ] A9.7 A 5, or it is not shown: the ad names its kind of idea and, with python scripts/ad-vs-library.py <ad> <kind>[+<kind>] <sheet.jpg>, sits beside four 5/5 library ads of that kind (docs/inspo/pinterest-ads-2026-11-02). The tool refuses a kind that averages under 4 there (minimal luxury, big type, lifestyle, info flyer) unless joined with one that averages 4 or more (visual pun, before and after, surprising scale, this or that, humour, words and picture locked together). Write 'Score: N' on the library's 1 to 5 scale and what it shares with those 5s; anything under 5 goes back to stage 1 before anyone sees it, unless Tzvi says to send it as it is: then add 'Sent as it is: Tzvi, <date>'. When Tzvi is in the conversation, the best three ideas are shown to him as one line each before any picture is paid for. The answer names the sheet.
  plan: ...
- [ ] A9.8 The drawing is kept: a hand-made ad's page or script that draws its words and motion (with the pictures it lays) lives in docs/ads/gen/<name>/, so it can be changed or remade without measuring the finished picture. The answer names the file there; n/a only for a design the ad maker draws.
  plan: ...

## 9. The pro look (Tzvi, 8 Nov 2026: "use the new things you learnt... make it a rule for all future ad builds")

- [ ] A11.1 One idea you get in a second: name the surprise, pun or visual question the picture asks; the words answer it. "A good photo with a headline" is not an idea.
  plan: ...
- [ ] A11.2 Words and picture interlock: the headline or one huge word sits behind the subject with parts of the subject in front, or the subject sits inside the letters. Name how.
  plan: ...
- [ ] A11.3 One colour world: the ground takes the product's own colour or its set's, with one accent; no stock yellow sticker or white button that belongs to no picture.
  plan: ...
- [ ] A11.4 A frozen moment: something is happening (falling seeds, steam, a pour, a splash, motion). Name it, and keep it true to the product.
  plan: ...
- [ ] A11.5 Light that shapes: one strong side or back light, a fall to dark, real depth. Never flat even daylight on the hero.
  plan: ...
- [ ] A11.6 Three things carry the ad: the picture, the headline, the name. The link, code and price are small and quiet, and corners are left empty.
  plan: ...
- [ ] A11.7 The headline is 2 to 5 spoken words, set big, in two voices where it helps (bold capitals with a lighter or script line).
  plan: ...
- [ ] A11.8 The product is the hero: it fills about half the width or more, close, standing on its set like a product shoot, never pasted in front of one.
  plan: ...
- [ ] A11.9 Its own look: the ground is the business's own colour (from its logo, product or place, named), and the layout is one none of its earlier ads and none of our last five ads (docs/ads) used. List those ads and say how this one differs. The foot is the logo, one line, and the link with its QR, never a block of small lines.
  plan: ...
- [ ] A11.10 The product takes another thing's place: name the familiar object whose place it takes (food in a ring box, tubs wrapped as a gift) and what the viewer works out. A paid ad without one says why.
  plan: ...
- [ ] A11.11 A hand or a person acts on the product (lifts, offers, sprays, bites): a real hand, a drawn figure or the owner's own photo, never a generated customer (A5.4). Name who does what, or n/a: why the ad is stronger without.
  plan: ...

## 8. Moving ads

- [ ] A10.1 A moving ad ends on the same picture as the still: same words, one price, the link and QR code whole.
  plan: measured by check-ad-designs (moving)
- [ ] A10.2 The first frame is already an ad, because a chat shows it before anyone plays it: the headline's key word large on the ad's colour, the product, or the first words; never an empty ground.
  plan: measured by check-ad-designs (moving)
- [ ] A10.3 It opens on one big word, moves, then holds still at least 1.5 seconds, with the QR code still for over 3 seconds so it can be scanned. Since 18 Nov 2026 the product may keep living in a window.LIVING box while the words and QR hold (M8).
  plan: measured by check-ad-designs (moving)
- [ ] A10.4 An MP4 video (H.264) at the shape's full 1080-wide size, about 6 seconds, no sound needed to follow it.
  plan: measured by check-ad-designs (moving)
- [ ] A10.5 A hand-made moving ad passes backend/.venv/Scripts/python scripts/check-moving-ad.py <ad.mp4> before anyone sees it: H.264 1080 wide, 5 to 10 seconds, a first frame that is already an ad, moving within its first second and never stalling over a second before the end (moving-ad rulebook M2, M5), still for 1.5 seconds or more at the end, and the QR code read and still for over 3 seconds. The answer quotes its line, or n/a for a still or a maker design (check-ad-designs measures those).
  plan: ...
- [ ] A10.6 A hand-made ad is committed as soon as it is sent: the ad, its page or script, its pictures, its sheets and this blueprint, by name, with node scripts/ad-blueprint.mjs --note <name> as a line of the commit message (its library score, and "sent as it is" under 5). The answer says so, or n/a for a maker design.
  plan: ...
- [ ] A10.7 The last frame is planned before the moving ad is built: sketched (scripts/ad-layout-sketch.py, or the page's still at its end) and put beside the library with python scripts/ad-vs-library.py <sketch> <kind>[+<kind>] <sheet.jpg>. The idea has to be in the picture, not only in words over a photo. Before the full recording, a few test frames are drawn (node scripts/record-moving-ad.mjs <folder> <name> '' <t,t,t,7.9>) and the last one scored, so a hidden joke is found in seconds, not after a five-minute recording (Chicken Munch's drips, 17 Nov 2026). The answer names the sheet and 'Score: N'; under 5 the idea changes before anything moves (or 'Sent as it is: Tzvi, <date>').
  plan: ...
- [ ] A10.8 The movement is judged, not only the end: python scripts/moving-ad-vs-library.py <ad.mp4> <sheet.jpg> [--cat <category>] puts six frames of it above three 5/5 moving ads. A 5 acts one idea out (it builds, falls in, gets eaten, splits); words appearing over a still photo is a 3. The answer names the sheet and 'Motion score: N' (or 'Sent as it is: Tzvi, <date>').
  plan: ...
- [ ] A10.9 Starts from the kit: node scripts/new-moving-ad.mjs <name> <business slug> writes docs/ads/gen/<name>/ with the business's name, logo, link and QR, the timing helpers and window.render(t); the ad adds only its idea. The answer says so.
  plan: ...
- [ ] A10.10 Real things move as real footage: steam, a pour, bubbles, a bite or the product turning is a generated clip of their own product (docs/ads/gen/<name>/clip.py, its price read through the API first), played frame by frame under the words by the kit's clip layer; code draws the words, the logo and the QR. The answer names the clip, or n/a: why code looks as real.
  plan: ...
- [ ] A10.11 The idea is named from the moving-ad rulebook's table (build, morph, tap or swap, grow or stack, split and re-form, drop, chain, swap surroundings, reveal) with a library 5 that does it, and why it fits this offer: flavours or varieties are never shown as sizes and sizes never as a tap. One idea per ad.
  plan: ...
- [ ] A10.12 Before anything is built, one sentence says what moves in depth or what physically causes each beat (a pulse swings the ring, the pour falls through the word); tiles sliding in just to arrive is a 3 (the MyIsraelRental first cut, 17 Nov 2026). Everything moves for a reason the viewer can see (a drop, a cut, a tap, a pour), and the product fills half the screen's width or more through the action, centred and sharp.
  plan: ...
- [ ] A10.13 Words wait: during the action at most one big word or short line per beat; the headline, offer and foot arrive on the last frame. One colour world per beat, edge to edge. From 18 Nov 2026 the name, link and QR are not on screen until the last beat (a small logo may stay; the kit's K.footIn does it, and check-moving-ad.py fails a QR readable in the first two seconds); the answer says at what second they arrive.
  plan: ...
- [ ] A10.14 It loops: the last frame leads back into the first (same ground colour, or the product in the same place); best when the loop is the action itself (eaten and whole again, emptied and refilled). The answer says how.
  plan: ...
- [ ] A10.15 Someone does something to the product: a hand, a person or a small drawn character on the real photo acts (taps, lifts, sneaks one out, climbs in), never a generated customer. Name the actor and what it does, with the library ad it follows (d09, t02), or n/a: why nobody acting is stronger.
  plan: ...
- [ ] A10.16 Several shots for a product made, cooked or used in steps: two to four shots, each its own picture of the same product, cut on a beat (d01, n04). A cut that joins two round things is lined up with scripts/match-shots.py, its transform used at the cut. List the shots, or n/a: the idea is one continuous action in one picture (a pour, a build, a morph).
  plan: ...
