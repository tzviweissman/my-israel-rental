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
- **A new ad rule:** add it to `docs/static-ad-rules.md` as a numbered section (or inside the numbered section it
  belongs to) and here in the same commit, its line naming that section number, tried on the real designs first.
  `node scripts/check-rule-homes.mjs` refuses an unnumbered section or a step that names none. A rule added after a design shipped does not block that design (designs listed under "Made before the
  blueprint" in `scripts/ad-blueprint.mjs`), but the `auto` lines still measure it.

Line format: `id | rule | where it comes from | auto:<measure>` or `decide`, optionally followed by `since:<date>`: a
blueprint written before that date has no such line and is not held to it (new-rules-spare-made-sites). `auto` lines are measured by
`check-ad-designs`, on every design, shape and language. `decide` lines get a written answer for this ad.

## 1. The idea

A0.1 | One job: what you get, or a question, or a real offer. Never two. | static-ad-rules 0 | decide
A0.2 | One-second test: a stranger knows what is offered and where. Clarity beats cleverness. | 0 | decide
A9g.1 | Starts from an ad that already works: name the ad in docs/inspo/pinterest-ads-2026-11-02 (or Meta's Ad Library, by reach and days running) it takes its idea from. | 9d, 9g.1 | decide
A9e.2 | In one sentence: what the picture says that the words finish. Cover the words: the picture raises a question. Cover the picture: the words are not complete. | 9d, 9e.2 | decide
A9e.3 | The idea, by name: the product stands in for a familiar object, or sits in a familiar screen, or type and subject interlock, or surreal scale, or a pun. Not a good photo with a headline (scored 1.9 to 2.8). | 9d, 9e.3 | decide
A9f.1 | The angle, by name: a real moment and why ours wins there, or the exact reader, or an honest trade-off, or the want behind the feature, or a moment in the day, or a real review. | 9f | decide
A9g.9 | Is this a different-looking ad from the last ones for this business, and not the same design with another headline? | 7, 9b, 9f.6, 9g.9 | decide
A9g.10 | The gallery of one business looks varied at a glance: its designs do not share one colour or one layout, and each starts on its own product where there are several. | 9g, Tzvi 5 Nov | auto:variety

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
A2.10 | Short, intriguing and clear: the headline with its one small line says what the business gives and why you would want it, in plain words a stranger gets in one look (the product or service named, or unmistakable in the picture, plus what it does for them). A pun or a twist only on top of that, never instead of it: 'Set it to LOW.' told nobody what L.A. Cholent sells. The answer writes 'A stranger reads:' and what someone who has never heard of the business would take from the headline alone. | 16, Tzvi 10 Nov | decide since:2026-11-10
A2.11 | Five headlines, then cut: write at least five headlines, numbered 1) to 5), and strike each that fails one of these, naming the failure: (a) names the object without saying why you want it ('THE RING.'); (b) guesses at the reader's situation instead of the offer ('Ready to ask?'); (c) is a pun or twist only someone who already knows the business gets ('Set it to LOW.'); (d) sounds like something else, a film, a song or another brand's slogan; (e) claims what the listing does not; (f) is more than six words or needs its small line to make sense. Write 'Chosen: N' and why. When Tzvi is in the conversation, show him the best three before the ad is built and build his pick. | 18, Tzvi 10 Nov | decide since:2026-11-10

## 3. The picture

A3.1 | One huge subject on one quiet ground: it fills half the frame or more, two or three colours in all. | 3, 9e.5 | decide
A3.2 | A rental or a place: only the owner's real photos. A generated room does not exist. Say where each picture comes from. | 3 | decide
A3.3 | A generated picture of a product keeps the real product: rebuilt around its real photo, its traits unchanged, compared beside that photo. Describe the reference scene in full, never "swap the product". | 9g.2, generate-right-first-time | decide
A3.4 | Another shape than the screen: the background is extended, never cropped or zoomed. | 3, page rules 3c.12 | decide
A3.5 | Sharp and bright; one colour that stands out on a white and a dark feed, from our palette or the owner's own photo and logo. | 3, 9g.3 | decide
A3.6 | A hand holding, offering or reaching in, where it helps. Real or native beats polished. | 3, 9e.6, 9g.4 | decide
A3.7 | No words drawn into a generated picture. The picture is one layer, the words typed on top and editable. | 6, 9g.8 | decide
A3.8 | Another brand's idea and composition only, never its marks, wording or product. | 9g.2 | decide
A3.9 | The picture fills the ad edge to edge as it was made: made in the ad's own shape or the nearest shorter one the model takes, laid at full width with scripts/ad-fit-picture.py, which carries on only the plain wall above and table below in the picture's own colours and refuses to shrink. Never shrunk with filled or pale sides. The answer names ad-fit-picture, or n/a when no picture is generated. | 15, Tzvi 10 Nov | decide since:2026-11-10
A3.10 | A product shot is styled like a pro shoot: the product big and sharp on a rich surface (wood, stone, linen, never a bare white table), in warm shaped light, with two or three things from the business's own world at the sides (what it is served with, made from or sold beside). Props never in front of the product, never presented as the product, no cooked food passed off as theirs. Name each prop and why it belongs. | 15, Tzvi 10 Nov | decide since:2026-11-10
A3.11 | Layout first, never numbers alone: before any generated picture, its layout is drawn with scripts/ad-layout-sketch.py (boxes where the product, props and moment go; the headline and foot areas kept empty) and given to the reference-image model (marketing-studio/image/sunburst) as an image, with "photograph this layout for real" and the real product photo when there is one. Told only in words, the model centred the phone and drew eight notes for thirty. Exact parts (a screen, a label) are laid on afterwards in code. The answer names the layout picture; the ad's gen script must use it. n/a only when nothing is generated. | 17, Tzvi 10 Nov | decide since:2026-11-10
A3.12 | A screen in an ad shows the real thing: our website or dashboard captured at the screen's own shape from the local test account (its sample data, never a real business or customer, no test-looking names), not an icon or a made-up mock. Professional is in the details. Name the page captured. | 17, Tzvi 10 Nov | decide since:2026-11-10

## 4. Body and proof

A4.1 | At most three points, each one fact; dropped first when the picture needs the room. | 4 | decide
A4.2 | One price, and it is the price of the thing in the picture. "From" only for the item that costs that. | 4, 9e.8 | auto:price
A4.3 | A struck-through price only when real: same thing bought separately at real prices, or really charged before. | 4 | decide
A4.4 | A review is real, shown on the public page, rated 4 or 5, the reviewer's words, shortened only by cutting. No hearts or counts. | 4 | decide
A4.5 | Press or partner logos only if the business really has them, four at most. | 4 | decide
A4.6 | The business's own logo is on every ad it pays for or is shown in: their real logo file (the listing's logo, or cut cleanly out of a picture of theirs), never redrawn, retyped or generated, placed where it reads at phone size and clear of the phone's top bar (from 100px down on a 1920 status). The name in words may sit beside it, never in place of it. The answer names the logo file used; n/a only with "n/a: no logo" when the business has none, and then the name is set in their own style. | 20, Tzvi 11 Nov | decide since:2026-11-11
A1.3 | The action: one thing to do, the short link and QR code, last on the eye's path. | 1, 8 | auto:link

## 5. Honesty

A5.1 | Nothing invented: no number, feature, review, person, view or distance the listing does not state. | 5 | decide
A5.2 | No scarcity or urgency unless real, with its dates. | 5 | decide
A5.3 | No fake screenshot: no text from a friend, Google review, notes app, receipt or conversation that did not happen. A familiar screen is allowed when nobody invented speaks in it: the product itself calling, a search box, switches, the reader's own list. | 5, 9e.3 | decide
A5.4 | No drawn "@brand" made to be mis-clicked; no as-seen-in; no generated person shown as a customer. | 5 | decide
A5.5 | A comparison is with a kind of thing, never a named rival, and both sides are true. | 5, 9f | decide
A5.7 | Every listing photo the ad uses is clean, checked before the layout: cut to its subject with no phone number, email or person's name, no screenshot edges or app icons, no other logo or certificate, no 'before' photo without its 'after'. A photo that cannot be cut clean is left out. The answer lists each photo and its cut, or n/a: the ad uses no listing photos. | 25 | decide since:2026-11-17
A5.6 | Owner-facing wording does not address "owners"; rentals lead, the business line is "Add your business, free". | 5, CLAUDE.md | decide

## 6. Phone and shapes

A8.1 | Square 1080x1080, feed 1080x1350, story 1080x1920: each one drawn and looked at, not resized. | 8 | auto:shapes
A8.2 | No text under 30px at 1080 wide. | 8 | auto:text-size
A8.3 | Nothing cut off: every line inside the picture. | 8 | auto:text-inside
A8.4 | A story keeps the top 220px and bottom 230px clear. | 8 | auto:story-safe
A8.5 | Words over a photo cover at most 40% of it, and never the subject. | 8 | decide
A8.6 | The QR is at least 150px at 1080 wide, dark on white, with the short link printed whole on the ad (the business's name in it when it has a Latin one), beside it unless the owner moved them. No drag can shrink it below 150px, cut it off or put it where a story covers it. | 8, Tzvi 5 Nov | auto:qr
A8.7 | Works in Hebrew and English: right-aligned, the QR moves to the left, letters in a font that has them. | 8 | auto:languages
A8.8 | Words readable on their background: 3:1 for large text; the price circle stays visible. | 8, ad maker 4 Nov | decide
A8.9 | The picture that leaves the site is drawn at double size (2160 wide) from the best copy of the photo, never the preview. | 8, Tzvi 5 Nov | auto:sharp

## 7. Before it goes out

A9.1 | Drawn and looked at on the real business, at phone size, beside the reference it came from. | 9, test-with-a-real-business | decide
A9.2 | Would it stop you? Say what is surprising about it in one sentence; if nothing is, it goes back to stage 1. | 9d, ads-need-an-idea | decide
A9.3 | The owner can change every word and the price stays right. | intro, 6 | decide
A9.4 | Cost read from the API before any generation, and the spend reported. | 9, CLAUDE.md | decide
A9.5 | Never bland: before anyone sees it, the ad sits beside the pro ads at the same size (python scripts/ad_vs_pros.py, references in docs/inspo/pro-references). Five yes-or-no: the product is the hero, close and big (about half the width or more); one strong light or bold colour, not flat even light; something happens (a moment, motion, a surprise, an idea); the headline is part of the design, big, not a small line in a corner; it holds its own beside the pros. Any no: remade, not shown. | 12, Tzvi 8 Nov | decide
A9.6 | Every copy of the product the picture adds (pieces in the air, a second item, a stack, a pour) matches the real photo in shape, size, colour and coating, with nothing round it the real product would not make (crumbs, drops, glow). The prompt names those traits; the sheet from backend/.venv/Scripts/python scripts/product-match-sheet.py <picture> <real photo> <sheet.jpg> is looked at piece by piece. The answer names the sheet file, or n/a when no copies are added. | 14, Tzvi 9 Nov | decide since:2026-11-09
A9.7 | A 5, or it is not shown: the ad names its kind of idea and, with python scripts/ad-vs-library.py <ad> <kind>[+<kind>] <sheet.jpg>, sits beside four 5/5 library ads of that kind (docs/inspo/pinterest-ads-2026-11-02). The tool refuses a kind that averages under 4 there (minimal luxury, big type, lifestyle, info flyer) unless joined with one that averages 4 or more (visual pun, before and after, surprising scale, this or that, humour, words and picture locked together). Write 'Score: N' on the library's 1 to 5 scale and what it shares with those 5s; anything under 5 goes back to stage 1 before anyone sees it, unless Tzvi says to send it as it is: then add 'Sent as it is: Tzvi, <date>'. When Tzvi is in the conversation, the best three ideas are shown to him as one line each before any picture is paid for. The answer names the sheet. | 19, Tzvi 10 Nov | decide since:2026-11-10
A9.8 | The drawing is kept: a hand-made ad's page or script that draws its words and motion (with the pictures it lays) lives in docs/ads/gen/<name>/, so it can be changed or remade without measuring the finished picture. The answer names the file there; n/a only for a design the ad maker draws. | 21, Tzvi 16 Nov | decide since:2026-11-16

## 9. The pro look (Tzvi, 8 Nov 2026: "use the new things you learnt... make it a rule for all future ad builds")

From docs/inspo/pro-references/README.md, what every pro ad had and ours lacked. Planned before building, checked on
the ad-vs-pros sheet (A9.5) after.

A11.1 | One idea you get in a second: name the surprise, pun or visual question the picture asks; the words answer it. "A good photo with a headline" is not an idea. | 13, pro-references 1 | decide
A11.2 | Words and picture interlock: the headline or one huge word sits behind the subject with parts of the subject in front, or the subject sits inside the letters. Name how. | 13, pro-references 2 | decide
A11.3 | One colour world: the ground takes the product's own colour or its set's, with one accent; no stock yellow sticker or white button that belongs to no picture. | 13, pro-references 4 | decide
A11.4 | A frozen moment: something is happening (falling seeds, steam, a pour, a splash, motion). Name it, and keep it true to the product. | 13, pro-references 5 | decide
A11.5 | Light that shapes: one strong side or back light, a fall to dark, real depth. Never flat even daylight on the hero. | 13, pro-references 6 | decide
A11.6 | Three things carry the ad: the picture, the headline, the name. The link, code and price are small and quiet, and corners are left empty. | 13, pro-references 7 | decide
A11.7 | The headline is 2 to 5 spoken words, set big, in two voices where it helps (bold capitals with a lighter or script line). | 13, pro-references 8 | decide
A11.8 | The product is the hero: it fills about half the width or more, close, standing on its set like a product shoot, never pasted in front of one. | 13, Tzvi 8 Nov | decide
A11.9 | Its own look: the ground is the business's own colour (from its logo, product or place, named), and the layout is one none of its earlier ads and none of our last five ads (docs/ads) used. List those ads and say how this one differs. The foot is the logo, one line, and the link with its QR, never a block of small lines. | 26, Tzvi 18 Nov | decide since:2026-11-18
A11.10 | The product takes another thing's place: name the familiar object whose place it takes (food in a ring box, tubs wrapped as a gift) and what the viewer works out. A paid ad without one says why. | 26, Tzvi 18 Nov | decide since:2026-11-18
A11.11 | A hand or a person acts on the product (lifts, offers, sprays, bites): a real hand, a drawn figure or the owner's own photo, never a generated customer (A5.4). Name who does what, or n/a: why the ad is stronger without. | 26, Tzvi 18 Nov | decide since:2026-11-18

## 8. Moving ads

A10.1 | A moving ad ends on the same picture as the still: same words, one price, the link and QR code whole. | 11, Tzvi 6 Nov | auto:moving
A10.2 | The first frame is already an ad, because a chat shows it before anyone plays it: the headline's key word large on the ad's colour, the product, or the first words; never an empty ground. | 11, Tzvi 6 Nov, 7 Nov | auto:moving
A10.3 | It opens on one big word, moves, then holds still at least 1.5 seconds, with the QR code still for over 3 seconds so it can be scanned. | 11, Tzvi 6 Nov | auto:moving
A10.4 | An MP4 video (H.264) at the shape's full 1080-wide size, about 6 seconds, no sound needed to follow it. | 11, Tzvi 6 Nov | auto:moving
A10.5 | A hand-made moving ad passes backend/.venv/Scripts/python scripts/check-moving-ad.py <ad.mp4> before anyone sees it: H.264 1080 wide, 5 to 10 seconds, a first frame that is already an ad, moving within its first second and never stalling over a second before the end (moving-ad rulebook M2, M5), still for 1.5 seconds or more at the end, and the QR code read and still for over 3 seconds. The answer quotes its line, or n/a for a still or a maker design (check-ad-designs measures those). | 11, Tzvi 16 Nov | decide since:2026-11-16
A10.6 | A hand-made ad is committed as soon as it is sent: the ad, its page or script, its pictures, its sheets and this blueprint, by name, with node scripts/ad-blueprint.mjs --note <name> as a line of the commit message (its library score, and "sent as it is" under 5). The answer says so, or n/a for a maker design. | 22, Tzvi 16 Nov | decide since:2026-11-16
A10.7 | The last frame is planned before the moving ad is built: sketched (scripts/ad-layout-sketch.py, or the page's still at its end) and put beside the library with python scripts/ad-vs-library.py <sketch> <kind>[+<kind>] <sheet.jpg>. The idea has to be in the picture, not only in words over a photo. Before the full recording, a few test frames are drawn (node scripts/record-moving-ad.mjs <folder> <name> '' <t,t,t,7.9>) and the last one scored, so a hidden joke is found in seconds, not after a five-minute recording (Chicken Munch's drips, 17 Nov 2026). The answer names the sheet and 'Score: N'; under 5 the idea changes before anything moves (or 'Sent as it is: Tzvi, <date>'). | 23, Tzvi 16 Nov | decide since:2026-11-16
A10.8 | The movement is judged, not only the end: python scripts/moving-ad-vs-library.py <ad.mp4> <sheet.jpg> [--cat <category>] puts six frames of it above three 5/5 moving ads. A 5 acts one idea out (it builds, falls in, gets eaten, splits); words appearing over a still photo is a 3. The answer names the sheet and 'Motion score: N' (or 'Sent as it is: Tzvi, <date>'). | 23, Tzvi 16 Nov | decide since:2026-11-16
A10.9 | Starts from the kit: node scripts/new-moving-ad.mjs <name> <business slug> writes docs/ads/gen/<name>/ with the business's name, logo, link and QR, the timing helpers and window.render(t); the ad adds only its idea. The answer says so. | 23, Tzvi 16 Nov | decide since:2026-11-16
A10.10 | Real things move as real footage: steam, a pour, bubbles, a bite or the product turning is a generated clip of their own product (docs/ads/gen/<name>/clip.py, its price read through the API first), played frame by frame under the words by the kit's clip layer; code draws the words, the logo and the QR. The answer names the clip, or n/a: why code looks as real. | 23, Tzvi 16 Nov | decide since:2026-11-16
A10.11 | The idea is named from the moving-ad rulebook's table (build, morph, tap or swap, grow or stack, split and re-form, drop, chain, swap surroundings, reveal) with a library 5 that does it, and why it fits this offer: flavours or varieties are never shown as sizes and sizes never as a tap. One idea per ad. | 24, Tzvi 16 Nov | decide since:2026-11-16
A10.12 | Before anything is built, one sentence says what moves in depth or what physically causes each beat (a pulse swings the ring, the pour falls through the word); tiles sliding in just to arrive is a 3 (the MyIsraelRental first cut, 17 Nov 2026). Everything moves for a reason the viewer can see (a drop, a cut, a tap, a pour), and the product fills half the screen's width or more through the action, centred and sharp. | 24 | decide since:2026-11-16
A10.13 | Words wait: during the action at most one big word or short line per beat; the headline, offer and foot arrive on the last frame. One colour world per beat, edge to edge. From 18 Nov 2026 the name, link and QR are not on screen until the last beat (a small logo may stay; the kit's K.footIn does it, and check-moving-ad.py fails a QR readable in the first two seconds); the answer says at what second they arrive. | 24, M6 | decide since:2026-11-16
A10.14 | It loops: the last frame leads back into the first (same ground colour, or the product in the same place); best when the loop is the action itself (eaten and whole again, emptied and refilled). The answer says how. | 24, M9 | decide since:2026-11-16
A10.15 | Someone does something to the product: a hand, a person or a small drawn character on the real photo acts (taps, lifts, sneaks one out, climbs in), never a generated customer. Name the actor and what it does, with the library ad it follows (d09, t02), or n/a: why nobody acting is stronger. | 24, M13 | decide since:2026-11-18
A10.16 | Several shots for a product made, cooked or used in steps: two to four shots, each its own picture of the same product, cut on a beat (d01, n04). List the shots, or n/a: the idea is one continuous action in one picture (a pour, a build, a morph). | 24, M14 | decide since:2026-11-18
