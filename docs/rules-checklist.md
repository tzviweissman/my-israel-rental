# Rules checklist (one line per rule that can be judged on a finished site)

Written 22 Oct 2026, brought in line with the cleaned rules the same day (Tzvi's decisions: percentage savings, generated food only in the opening film, headline says the result, accent for the main button only). Cause: rules in `docs/page-generation-rules.md` (the rules doc) kept being
skipped on builds because the doc is ~1,950 lines, briefs cited only some sections and only some
rules have scripts. Example: rule 8 "a set of images reads as one shoot" was never applied to the
LS Fruit Platter site. This file is the whole rulebook as a list you cannot skim: every line must
be answered for every site before anyone is shown it.

## How to use it

1. `node scripts/check-rules.mjs --template scrollcraft/builds/<site>` writes `<site>/RULES.md`
   with every id below set to `todo`.
2. Run the scripts named in the HOW column on every page of the site, and do every LOOK by
   actually opening the page (the six sizes of 3p.6 in the rules doc (laptops 1280x650, 1440x900, 1536x753, 1920x1080;
   phones 390x844 and 360x640 with touch emulation), English and Hebrew if the site has both). A LOOK names what to compare, so write
   what you compared.
3. Replace each `todo` with one of:
   - `R8.1 pass: <what was looked at, or which script passed>`
   - `R8.1 n/a: <why this site has no such thing>`
   - `R8.1 fix: <what is wrong>` (then fix it, re-check, and change the line to `pass`)
4. `node scripts/check-rules.mjs scrollcraft/builds/<site>` must exit 0 before the site is shown
   to Tzvi, the owner, or published. It fails on a missing id, a `todo`, a `fix:`, a line with no
   reason, or a RULES.md older than the newest .html/.css/.js/.py in the build (any edit means
   the rules are looked at again).
5. The person who did not build the site also answers `docs/page-review-checklist.md` (3r.2).

**A rule added to `docs/page-generation-rules.md` (or to the skill's SKILL.md) must be added to
this file the same day, with a HOW. A rule with no way to check it is not finished.**

Ids are `R<section>.<number>` using the rules doc's own numbering (`R3g.13` = section 3g, rule 13).
Where a rule is an unnumbered paragraph its number continues after the last numbered one.
Lines are `id | rule | reference | HOW`. Scripts, all run from the repo root against a served URL
(`scripts/serve-builds.mjs`) except where noted:

- `site` = `node scripts/check-site.mjs <every page>` (BROKEN SHIFT GLYPH STATE TAP ALIGN PHONE MEDIA FLOW; OPENING and WORLDS on the home page only)
- `fits` = `node scripts/check-fits.mjs <every page>` (sections and photos fit the screen at the six sizes of 3p.6; photo not shown over 1.35x its size)
- `motion` = `node scripts/check-motion.mjs <every page>` (choices switch smoothly, no flash, take their colour)
- `prints` = `node scripts/check-fingerprints.mjs <build>`; `concept` = `node scripts/check-concept.mjs <build>`
- `readable`, `cutoff`, `clipped`, `scroll-finish`, `overlay-truth`, `cutout`, `brightness` = the scripts in `.claude/skills/build-business-page/scripts/`
  (`readable`: size and contrast of every word at six sizes; `clipped`: words or pictures cut by their box at seven sizes, whole scroll; `cutoff`: anything cut by a held or full-screen section at the six sizes of 3p.6 and more)

## 1. Facts and words

R0b.1 | Published under the business's real slug from the live record, not a made-up one | 0b.1 | LOOK: compare the page address with the live business record's slug
R0b.3 | Prices and currency on the page match the owner's own menu or flyer; the real menu is loaded in their shop with fixed product ids | 0b.3 | LOOK: list every price on the page against the menu/flyer and the shop listing
R2.1 | Only facts the owner or record gave: no invented number, "since", "fresh daily", "trusted by", guest counts | 2, 3 numbers, 5a.4 | LOOK: read every sentence of every page and trace each fact to the record, listings, flyer or an owner answer
R2.2 | The owner is asked only about their own business, never how we build (no tools, credits, vendors), and never what the record already answers | 2 | LOOK: read `message-to-owner.md`
R2.3 | The message to the owner has 5 to 8 example FAQ questions written from this business's real details, plus the worry / first days / photo-in-use questions when the page does not answer them | 3 (cont.) FAQ, 3c | LOOK: `message-to-owner.md`
R3.1 | Every claim has proof: kosher needs a certificate and a food business; licensed needs a licence number; verified; reviews/stars need real reviews; years need a founding year; English needs English among their languages; best, #1, award, guarantee, insured, 24/7, emergency, fresh daily, delivery, medical words only in the owner's own words | 3 claims, 5.9 | LOOK: search every page for these words and match each to the record
R3.2 | No urgency or scarcity: only N left, hurry, today only, limited time, ends soon, countdowns without a real end date, booked N times, invented counters | 3 urgency, 3j, 3c.10 | LOOK: search every page for them
R3.3 | No sentence that fits any business (welcome to, look no further, one-stop shop, passionate about, quality you can trust, world-class, top-notch, and Hebrew equivalents) | 3 generic | LOOK: search every page
R3.4 | No exclamation marks, no long dashes, no words in capitals unless their name | 3 punctuation, 5.6 | LOOK: search every page's visible text and alt text for `!`, long dashes and capitalised words
R3.5 | The headline or the line under it names something they really sell, in the words of their own listings (a place name alone does not count) | 3 congruency, 5c.1 | LOOK: first screen against the listings
R3.6 | Everything written is in the page's language; a Hebrew page is Hebrew in every line and is written, not translated; RTL layout checked | 3 language, 5.7, 3e.17 | LOOK: open the Hebrew version of every page (n/a only if the site has no Hebrew)
R3.7 | Nothing missing is faked: no FAQ section until the owner sends questions and answers, no reviews/social proof unless real and consented, no empty section, no placeholder or "coming soon" | 3 (cont.) 4 and 5, 4, 0b.2 | LOOK: scroll every page for empty, placeholder or invented sections
R3.8 | No logo walls, "As seen on", award laurels, invented "Best match / Popular" badges, stars or counts without real reviews, "$80 of value" gifts, intro prices that renew higher | 3e rejected list, 3s Never | LOOK: scan every page
R3.9 | The page repeats the promise that brought the visitor, and its words match the ad, flyer or message that sent them | 3e.5, 5c.1 | LOOK: compare the first screen with the owner's flyer / message / listing
R3.10 | At most two strengths, each checkable and with its proof | 5.9 | LOOK: strengths listed on the page against the record
R5.1 | Their words first and specific: every line could only be about this business; a line a competitor could say is rewritten; the customer's problem comes before what they do | 5.1, 5.2, 3g.10 | LOOK: read every line aloud as the owner and ask "could a competitor print this?"
R5.2 | Professional voice: no teasing, scolding, slang or jokes; the owner would print every line on their menu | 5.10 | LOOK: read every line
R5.3 | Short labels are full phrases ("Kosher, hechsher from Rabbi Weiner", "Made in Jerusalem, delivered across Israel") | 5.11 | LOOK: every badge, proof line and tag
R5.4 | The visitor is "you"; the business is "we" or its name, never "they", "them" or "their" about itself, in labels, errors, captions, alt text and footers; every English line makes sense said by the owner | 5.8 | LOOK: search visible text of every page for they, them, their
R5b.2 | One button, one label: the main button has the same words and the same destination in the header bar, hero, selling sections, phone bar and footer (over a photo the bar's version may be the outline style) | 5b.2, 3b.3, 3e.3, 3t.4, 3k.2 | LOOK: list every main button's label and destination on every page; they must be identical
R5b.8 | A finish or closing line names what the customer gains, never "done" or "complete"; every line makes sense where it sits; "or" and "prefer" only when the other choice is visible | 5b.2 | LOOK: closing moments, contact lines, anything starting "or"
R3.11 | The headline says what the customer gets (their result, in the owner's words), and the order of the page follows the visitor's questions: what is it, can I trust it, what does it cost, what do I do; prices come before any enquiry form | 3 hero, 5.3, 3e.1, 3e.4 | LOOK: read the page top to bottom in order
R3o.4 | Every contact is labelled by what it does ("WhatsApp or call", "Call only, no WhatsApp"); the owner said which number takes what | 3o.4 | LOOK: header, footer, contact page, order message; check `message-to-owner.md` asked it
R3e.22 | The owner stays visible as a person: name, real photo, direct WhatsApp | 3e.22 | LOOK: first two screens after the opening and the footer
R3s.19 | The same promise line and photos on the link preview, home page and shop; every page has its own title, description and og:title/og:description/og:image | 3s.19, 3k.5 | LOOK: view source of every page and compare the head tags
R6.1 | The category playbook's lead block comes first and its must-have blocks are there | 3 playbook, 6 | LOOK: the business's playbook in section 6 against the page's order
R4.1 | Missing data reads as deliberate ("Ask for a quote" instead of a missing price) and is listed as a content gap, never invented | 4 | LOOK: every place data is missing

## 2. Opening

R3g.13 | The first screen holds a picture, a headline of 2 to 5 words that says what the customer gets, at most one short line (where the business is: the line or the small label, not both; trust goes there or right under the button) and one button; the header does not count | 3g.13, 3 hero, 5b.1, 3b.1, 3e.2, 3t.3 | LOOK: 1440x900 and 390x844 screenshots of every page's first screen, counting the pieces of text
R3b.1 | The first screen answers: what it is, where, why trust it, what to do next | 3b.1 | LOOK: same screenshots
R3b.2 | Proof (price, credential or rating) touches the main button; for food a kosher band sits just after the opening, not crowding the button, and the certificate is stated at most twice as a sentence or band (a small identical kosher tag on items does not count) | 3b.2, 3b, 3s.9 | LOOK: first screen and the next; count the kosher sentences and bands on every page
R3b.3 | One solid action per screen: header button and phone bar repeat it; the header button is outline when the hero shows a solid one; everything else is outline, link or tile | 3b.3 | LOOK: every screen position while scrolling
R3h.1 | The home page opens on a full-screen picture or film (at least 70% picture) and something happens on the first screen, on its own or as you scroll | 3h.1, 3n | script: site OPENING (home page) plus LOOK to confirm it is an event, not a drift
R3n.1 | The owner's strongest real photo fills at least half the first screen on a laptop and on a phone, not a small card or cut-out shape | 3n.1 | LOOK: first screen at 1440x900 and 390x844
R3n.2 | One signature moment only this business could have, driven by the visitor (scroll scene or a choice) | 3n.2, 5a.6 | LOOK: name it in one line and say why no other business could have it
R3n.3 | The visitor's choice changes the page (colour, hero, order), not just one picture | 3n.3, 3i.2 | script: motion (switch is smooth, takes the colour) plus LOOK that the hero itself changes
R3n.4 | Side by side with the closest reference in docs/inspo for this kind of business, ours is not plainly weaker | 3n.4 | LOOK: put the two first-screen screenshots next to each other
R3n.5 | The one-sentence test, told to someone else and run on the first five seconds and the first full scroll: "you land and ___ happens" is about the business, not a decoration ("nothing", "the camera moves", "it fades in" fail) | 3n.5, 3n | LOOK: write the sentence; a decoration ("a cloud puffs") fails
R3g.15 | The opening is made for this business at full quality: never a flyer crop or low-resolution photo, and a generated setting is never presented as their real premises | 3g.15 | script: fits (no photo over 1.35x its size) plus LOOK
R3h.2 | A film opening goes from where the product comes from to their real product and the button, every step true | 3h.2 | LOOK: n/a if no film; walk the film
R3h.3 | A film is full screen, crisp, drawn as sharp frames or near-lossless video at screen size, never shrunk, masked or in a column | 3h.1, 3h.4 | LOOK: n/a if no film; 1440x900 and 1920x1080
R3h.5 | A film's chapter lines are 2 to 6 words, small, at an edge, at most a third of the screen's height, on a soft edge shade only, never over the action | 3h.5, 3h.9 | script: readable, plus LOOK at every scene for what the words cover; n/a if no film
R3h.7 | A film's seams are checked: each join compared, a jumping clip regenerated | 3h.7 | LOOK: frames either side of every join; n/a if no film
R3h.8 | The section after a lit film changes the mood boldly | 3h.8 | LOOK: n/a if no film
R3h.11 | Every film and generated still set is bright: middle third at least 33, whole frame at least 22, average at least 30; the subject is the brightest thing; viewed on a phone in daylight | 3h.11, 3i.1 | script: brightness.py on every film and still set, plus LOOK on a phone screen
R3h.13 | One cause, one motion: the cause and its result are one clip, code pieces start on the cause frame and match the film's material, and the effect passes a 4 fps watch (no fall-then-fly, no pause, no blocks for flakes, no heap from nowhere, nothing wrong played backwards) | 3h.13, 3h.15, 3h.16 | LOOK: frames at 4 fps or more; n/a if no such effect
R3h.14 | The product stays recognisable through the whole effect; a moving camera never loses it; on a phone the frame widens if pieces travel past the crop | 3h.14 | LOOK: n/a if no film effect
R3h.17 | Words and film take turns: a giant name sits on plain ground, the film appears as letters part, the film moves aside before the headline arrives | 3h.17 | script: readable; n/a if the page does not use it

## 3. Sections and worlds

R3t.1 | Home page sections change ground: a full-bleed photo/film, then a calm plain ground, then a picture again; never three sections in a row on the same plain ground | 3t.1 | script: site WORLDS (home page)
R3t.2 | At least a third of the home page's sections are mostly picture or film edge to edge, with the words on the picture | 3t.2 | script: site WORLDS (home page)
R3t.3 | One big short line per section (on the first screen it is the headline of 3g.13), at most one short line under it, small calm body text, lots of space | 3t.3 | LOOK: every section of the home page
R3t.5 | A true detail of the business (prices, sizes, hours, street, fruit, cuts) is used as texture instead of decoration | 3t.5 | LOOK: name the detail
R3t.6 | Plain sections (numbered lists, prices, FAQ, contact) are calm rests on a plain ground with hairlines, between the pictures | 3t.6 | LOOK
R3t.7 | A real footer: a last big line, the button, link columns, contact, the MyIsraelRental line | 3t.7, 3k.3 | LOOK: footer of every page; identical on every page
R3.12 | Sections every page has: a dramatic hero, a features section (one scannable item per product or service with price and what is included), a call-to-action section of its own near the end with the proof beside the button | 3 (cont.) 1 to 3 | LOOK
R3c.1 | References came first: 3 to 5 real screens of businesses of the same kind kept, each with its source link in CONCEPT.md; the builder chose and said in one line what was picked and why (fresh searches per piece: R3g.17) | 3c.1, 3e.24 | script: concept (needs cited pictures) plus LOOK that named searches are real
R3g.17 | Every piece (button, arrow, each card or list effect, each section) came from a fresh Mobbin, 21st and Inspo search for this business, with the source named; nothing reused from the last two pages; each effect has a reason (says what a control does) | 3g.17, 3c.1, 0b.4 | script: concept (every effect has "from") and prints (effects), plus LOOK at the sources
R3c.2 | No AI default look: not cream + serif + one italic word (unless their brand), no default font, purple or two-colour gradient, exactly three identical cards, frosted glass used everywhere, default "premium" palette; at least one section on a contrasting ground | 3c.2, 3g.2, 5b.4 | LOOK: whole page at laptop width
R3g.1 | A style sheet exists in CONCEPT.md before building (accent, ink, ground, two faces plus at most a third for one label style, one radius, motion limits) and every section follows it | 3g.1 | LOOK: CONCEPT.md against the page's computed styles
R3g.3 | The accent colour is used for the main button only; prices and everything else are in the main text colour, prices bold and large; at most one emphasised word per screen, set apart by weight or style in the text colour | 3g.3, 3e.10, 5.5 | LOOK: every screen position while scrolling; computed colour of every price
R3g.7 | At most one closing signature (giant cropped name, or one playful moment in the footer/404), never in the way of the order path | 3g.7 | LOOK: footer and 404
R3g.11 | Fonts come from the approved Latin + Hebrew list, licence checked | 3g.11 | LOOK: faces in site.css against `reference/design-rules.md`
R3p.3 | Not alike: no heading face shared with another site, no shared body face plus script, no two brand colours alike, design different on at least 4 of 6, effects overlap at most 2 points | 3p.2, 3p.3, 3p.4 | script: prints
R3p.5 | One small touch only this business would have, from their product, tagline or craft | 3p.5 | script: concept (the `- touch:` line) plus LOOK that it works
R3q.1 | CONCEPT.md is complete: 3 or more ideas each citing a saved effect picture, an "Own:" idea, which was chosen, the five wow answers, an Effects line per kind, the "Not alike" line | 3q | script: concept
R5a.7 | One signature idea and one peak per page; at most one signature scroll section; the ending resolves on the action; not carried over from another business | 5a.6, 5a.7, 9, 3 signature | LOOK: name the one signature and the one peak
R9.1 | The page's signature section is used only when their own photos or items support it; a page without the right material stays still | 9 | LOOK
R3f.2 | The effect budget is filled and ticked on captured frames: one signature moment (held where it fits 1280x650, otherwise playing as the page scrolls), at least three accents (arriving opening, a scroll-tied detail mid-page, a closing payoff), quiet touches | 3f.2 | LOOK: CONCEPT.md list against frames
R3m.1 | A gallery place on every designed page (`data-mir-gallery` with template), and priced products inside `data-mir-catalog` with `data-mir-list`, group and item templates | 3m.1, 3m.2, 8 | LOOK: grep the html
R3m.3 | Details the owner changes (hours, areas and fees, guarantee, FAQ, reviews) sit in fixed places with length limits, never free text boxes | 3m.3 | LOOK
R3k.1 | The site is pages by kind of business; the menu and the order are ONE page (the Shop, or Book); old Menu/Order addresses forward to it | 3k.1 | LOOK: file list and addresses
R3k.2 | One identical menu bar on every page (name to Home, pages, the one Order/Book button with basket count, `aria-current="page"`); on a phone it folds into a Menu button with Close that closes on Escape or a link tap | 3k.2, 5b.2 | LOOK: every page, phone menu opened
R3k.4 | Shared `site.css` and `site.js` serve every page; a page-section class name (`.open`, `.in`) is never reused for a shared part's state | 3k.4 | LOOK: grep
R8a.1 | Nothing left over from 21st or generated components: no demo headline, name, review, star count, statistic, logo wall or stock photo; no network calls, tracking or new script tags; restyled in the business's tokens | 8a.2, 8a.3, 8a.5 | LOOK: view source for external script/img hosts; read every text
R3b.4 | With few photos, facts carry the page (offers, key facts), nothing padded; for a place, hours and where come before the description | 3b.4, 3b.5 | LOOK
R3c.3 | Proof sits where the worry is: each worry the owner named is answered beside the button or price it belongs to; no wall of one-line reviews | 3c.3, 3s.13 | LOOK
R3c.8 | If the owner told us what happens after the order or booking, the page and tracking page say it first | 3c.8 | LOOK; n/a if not told
R3e.10 | Cards have one reading order (name largest, one emphasised fact, usually the price in the main text colour, bold and large, the rest lighter), big photos; long names truncate; an icon on a photo sits on a solid circle or gradient | 3e.10, 3e.11 | script: site ALIGN (name at least 1.25x its line) plus LOOK at the longest name
R3e.14 | One body family in up to three weights and at most six text sizes; spacing on a 4 px grid, related close, unrelated apart | 3e.13, 3e.14 | LOOK: list computed font sizes and weights
R3c.9 | One quiet system: one corner radius for images and buttons, one icon set (lucide), one soft shadow (3s.3: about 3 px down, 30 px blur, no spread, tinted with the background or brand colour, never black), no two-colour gradients, no decorative arrows or outlines | 3c.9, 3e.15, 3s.3 | LOOK: list radii, shadows and icon sources
R3s.4 | One left edge: headings, text and buttons line up on the same margin | 3s.4 | script: site ALIGN
R3s.6 | Controls that do the same job look the same (height, corner, style) | 3s.6 | script: site ALIGN
R3s.7 | Buttons in sentence case, pale dividers, no "Price:" style labels, body lines 1.5 to 1.6 apart, contrast never lowered to look soft | 3s.7 | LOOK: computed line-height on body text
R3s.9 | One colour per meaning everywhere (the kosher tag looks the same on every item) | 3s.9 | LOOK
R3s.12 | The maker and their real work come right after the opening, with at least one real photo of the product in use or a real setting | 3s.12, 3c.4 | LOOK
R3s.14 | Real numbers shown big (three times the body size) with a one-line label, only numbers the owner gave | 3s.14 | LOOK
R3s.11 | One true sentence beside the price says why it costs that (handmade, the ingredient, the time) | 3s.11 | LOOK: price on the Shop
R5b.6 | No scroll cues, no "01/06" counters, no label above every section | 5b.6, 9 | LOOK
R3.13 | Structure: no doubled contact, facts or gallery; no two dividers in a row, no ending on one; only their own photos that exist; a photo gallery has at least 3 | 3 structure, images | LOOK
R3a.1 | The page was rendered as a visitor meets it (the six sizes of 3p.6, each language, normal and reduced motion), every screen looked at, a scroll page walked at several positions per section, every payoff checked at its start and finish on a phone and laptop | 3a.1 to 3a.5, 3a | LOOK: write which sizes and states you walked
R3r.1 | Every script above was run on EVERY page of the site, not only the home page | 3r.1, 3k.7, 0b.10 | LOOK: list the pages and the scripts run on each
R3r.2 | Someone who did not build the page used it against `docs/page-review-checklist.md`, the builder fixed every FAIL and the reviewer looked again | 3r.2 | LOOK: note the reviewer and the result
R3g.12 | A real test went through every form and order button (to a test business, never the owner's live inbox) before the owner saw it | 3g.12 | LOOK: say what was ordered and what arrived
R0b.12 | The business's pages-list preview clip shows the current version of the page | 0b.12 (skill) | script: `node scripts/check-showcase-previews.mjs`; n/a before publishing

## 4. Photos and media

R8.1 | A set of images shown side by side (category tiles, product grids, size or flavour photos, thumbnails) reads as one shoot: same camera angle, same light from the same side, same plain background, subject at the same size and crop | 8 (first paragraph) | LOOK: put every row/grid/picker of pictures on one contact sheet at the rendered size and compare angle, light, background and crop; redo any that breaks the set
R8.6 | Every main product picture is a product hero shot: one product large and sharp, eye level, slightly turned, on a plinth from its own world, its own real ingredients round it, one colour story, one warm light, still or mid-air (not both); the product is exactly theirs | 8 (The product hero shot) | LOOK: each hero, size, flavour and card photo against the eight points; compare the product with the owner's original photo piece by piece
R8.2 | The set came from the owner's own matching photos first; else the whole set generated in one pass from one style preamble (product pictures are edited from their own photo, never made again from words alone); stock only from one photographer's matching series; no cut-outs mixed from many photos | 8 (first paragraphs), 3h.12 | LOOK: sources of every image in the set
R3p.7 | Similar items are shown the same way: if one flavour's thumbnail is one jar, every flavour's is one jar; a list where pointing at an item changes a big photo does so for every item | 3p.7, 3r | LOOK: hover/tap every item
R3h.12 | One look per product everywhere: film frame, close-up, picker, tile, card and order form show the same object, cut or edited from one master; a name with unknown look gets no picture | 3h.12 | LOOK: all appearances of each item on one sheet; two that could pass for different products fail
R3h.10 | Choosing an option changes its picture, words and button; one photo per option, from one shoot, sharp at the size shown | 3h.10, 3i.2, 3s.15 | script: motion plus LOOK at every option
R3g.14 | One colour grade across every image and clip on the page | 3g.14 | LOOK: all images on one sheet
R3o.1 | Generated food in motion appears only in the full-screen opening film (advert style, checked frame by frame at 4 fps or more: no food from nowhere, no glass or neon look, pieces never fade or vanish); everywhere else on the page food is the owner's real photo; outside the film generate only scenery, light, steam or a plain drawing | 3o.1, 3h.13 to 3h.16, 8 | LOOK: every moving food outside the opening film; n/a if not food
R3o.2 | A generated liquid (opening film only) is opaque, satin, with specks, not glass or neon | 3o.2 | LOOK; n/a if none
R3o.3 | Product colours look true (no cast from cloth or light) | 3o.3 | LOOK
R3o.6 | One photo per kind, from everything the owner sent, duplicates skipped, unclear kinds asked about; screenshots cropped at their real resolution | 3o.6, 3o.7, 0b.2 | LOOK: the numbered sheet of the owner's photos against the page
R8.3 | Generated media only of items they really sell; no generated person shown as their staff or customer; no made-up premises; no text baked into an image; nothing non-kosher in a kosher business's images; the owner approved every piece | 8 (policy) | LOOK: every generated image
R8.4 | Any moving real material (ribbon, fabric, steam, a pour) is a generated clip made in Higgsfield (kie.ai only if Higgsfield cannot), showing cause then effect, never SVG or CSS; food in motion only per R3o.1; reduced motion shows the still | 8 | LOOK; n/a if none
R3c.13 | Nothing cut off: every label, number, ruler and photo sits wholly in its section at every size (only things marked `data-clip-ok` may be cut while travelling) | 3c (paragraph after 3c.12), 3a | script: clipped on every page
R3c.14 | A cut-out is one subject: no stray garnish, specks or pale fringe, looked at on a dark and a light ground | 3c (paragraph after 3c.12) | script: cutout.py --check on each cut-out; n/a if none
R5b.3 | Text over imagery: words sit on the picture with a soft edge shade (or a small solid card), never big dark pools, full-frame darkening or frosted glass, and meet contrast at the brightest frame; a plain strip under the photo only where the picture is too busy | 5b.3, 3e.12, 3g.8, 3t.2 | script: readable on every page
R3e.8 | Every word is at least 12 px (14 px for a sentence on a phone) and 4.5:1 contrast (3:1 large), button text 4.5:1 on its fill | 3e.8, 5b.3 | script: readable on every page
R3s.24 | Media is light and sized: no photo over 600 KB, every `<img>` has width and height, every video has a poster, nothing stays hidden with motion off | 3s MEDIA | script: site MEDIA
R3p.6 | Fits on one screen: every section fits below the menu bar at the laptop sizes; no photo taller than the screen at any of the six sizes; no photo shown over 1.35x its own size | 3c.12, 3p.6, 3a | script: fits on every page
R3o.5 | Every special character (₪, arrows, Hebrew, dots) renders in the font used for it | 3o.5, 3s GLYPH | script: site GLYPH

## 5. Prices and savings

R3c.5 | Choices (sizes, flavours, tiers) are tiles to tap, never a dropdown; "Most popular" only when the owner says so | 3c.5, 3j.6 | LOOK: grep `<select>`; check badges
R3c.6 | The button says what happens next with a real number where there is one ("Order 4 buns, ₪55"), never "Submit" or "Buy now"; price, unit and action sit together | 3c.6, 3e.3, 3e.6, 3e.7, 3s.17 | LOOK: every button
R3c.7 | Offers are contained: a time-limited offer shows its real end date, a first-order offer says so, standing discounts (students, soldiers, olim) need no date, "ends soon" without a real date is banned; no permanent sale, no discount on their famous item unless they say | 3c.7, urgency, 3j.4 | LOOK; n/a if no offers
R3j.1 | A guarantee the owner offers sits beside the main button in their words and states its limit; none offered means none shown | 3j.1, 3s.13 | LOOK; `message-to-owner.md` asked it
R3j.2 | One real relevant add-on before ordering, with Add and "No thanks", not pre-ticked, gone once added or declined | 3j.2 | LOOK; n/a if none fits
R3j.3 | A free taster, sample, consultation or quote the owner really offers is the headline offer beside the main button | 3j.3 | LOOK; n/a if none
R3j.4 | Group discounts (students, soldiers, first order, olim) only when the owner offers them, said once near the price; they are standing, so no end date is needed | 3j.4 | LOOK; n/a if none
R3j.5 | Come-back features only if real: a stamp card the owner runs, a Reorder button; no streaks, valueless points, or reminders for something not started | 3j.5, 3c.10, 3e.21 | LOOK; n/a if none
R3j.6 | The natural pick among three sizes/packages is shown, but no invented option to make another look good | 3j.6 | LOOK
R3j.7 | Never: a struck-through or "was" price that is not real, prices changed to .90/.99 endings, an endorsement they do not have | 3j Never, 3j (Show the deal) | LOOK: every struck-through price traced to the same items bought separately at real prices, or a price really charged before
R3j.8 | A saving is shown only when true like for like: same contents, same product line, worked out per unit in a table of every option, and the bigger option's unit price is lower than EVERY smaller option, measured against the cheapest | 3j (Show the deal) 1 to 4 | LOOK: write the per-unit table into RULES.md or CONCEPT.md and check each badge against it
R3j.9 | A lone saving among many products is not shown, but each small group (single/double pack, 4/8 box, service with its add-on) shows its own | 3j (Show the deal) 5 | LOOK: judge each saving by its group
R3j.10 | A saving is shown as a percentage badge of two or three words ("25% off") with the real separate price struck through beside the new price; percentage = (separate minus new) / separate, rounded DOWN to a whole number; the button carries the offer and its price and no sentence explains it again; never how much more the bigger one costs | 3j (Show the deal), 3s Prices | LOOK: recompute every badge from the per-unit table; n/a if no saving
R3j.11 | A combined service against its parts, and basket lines a package would make cheaper (one line with the saving and a Switch button), are shown when real | 3j (Show the deal) | LOOK: build a basket that qualifies
R3j.12 | An owner's own savings claim the prices contradict is not printed; the owner is asked | 3j (Show the deal) | LOOK
R3.14 | Loud prices only when prices exist, never on a premium or quote-based business | 3 prices | LOOK

## 6. Order and booking flow

R3k.7 | The order is in steps after choosing: Step 1 basket, Step 2 when and where, Step 3 details; a three-line "Step N: name" bar; order and total beside every step (under it on a phone); the button names the next step and, last, what happens with the total; a Back button; the browser back button goes back one step (#order-2); each step checks only its own fields | 3k.1 | script: site FLOW (walks the steps, empty form says what is missing, total in the message) plus LOOK at the names, Back and browser back
R3k.8 | Every basket line, packages included, has a remove button (40 px, "Remove X from the basket") beside its stepper | 3k.1 | script: site TAP (size) plus LOOK on a basket with a package
R3k.6 | The basket lives between pages: an Add on any page puts the item in and opens the order page with it there | 3k.6, 3k.7 | LOOK: add on one page, arrive on the order page
R3.15 | What the brief asks visitors to do has a place to do it (book or order needs the services block, message needs contact, visit needs hours and address) | 3 action | LOOK
R7.1 | Three options are for the automatic page builder only; a hand build picks one direction itself and says why in one line in CONCEPT.md, with no options page put to Tzvi or the owner unless asked | 3, 7, 3c.1, 8a | LOOK: CONCEPT.md names the pick and the reason
R8.5 | Every main button goes to the quickest route to a finished order the business has: its order page, then its price list, only then WhatsApp; WhatsApp stays the quiet secondary; the how-to-order steps describe the real path | 8 (The quickest way to order) | LOOK: follow every main button
R0b.13 | The order saves with a tracking link before opening WhatsApp, and the order reaches the owner complete | 0b.3, 3l.5 | LOOK: send a test order and read what arrives
R3l.1 | For every family of similar items the owner was asked what a customer can choose and how many | 3l.1 | LOOK: `message-to-owner.md`
R3l.2 | Each item says on itself what it allows ("Up to 4 kinds of chicken · 3 sauces", "1 kind"), in the same words on the tile, the order line and the order message | 3l.2 | LOOK: three places for each item
R3l.3 | Choices belong to the item: options appear once it is added, only for items that allow them; one choice is radio; a limit greys out the rest; an item needing a choice cannot be sent without it, with the reason beside it | 3l.3 | LOOK: order every package/option once and choose everything it allows
R3l.4 | Three or more alike items are compared at a glance: only what differs, side by side | 3l.4 | LOOK
R3l.6 | A picture is of the item as it is sold now; no picture beats a misleading one | 3l.6 | LOOK
R3l.7 | Read each item alone: a customer can tell what they get and what they can choose without reading another item | 3l.7 | LOOK
R3e.9 | Buttons have rest, hover, pressed and disabled states; fields have focus and error states with a message; every action confirms ("Sent", "Copied"); anything hover-only has a phone version | 3e.9, 3s.1 | script: site STATE and FLOW plus LOOK at disabled, focus and confirmation
R3e.19 | Every flow has a visible end: a clear "Done" screen after ordering, lists that end, "Save and finish later" on long forms; progress shows only true numbers | 3e.19, 3e.20 | LOOK: finish a test order
R3s.16 | Fewer choices first: a plain question ("How many people?") before a long list; the sensible option is chosen on purpose | 3s.16 | LOOK
R3s.18 | Not available shows the nearest real alternative; every choice list has a way out ("None", "Other", "I'm not sure") | 3s.18 | LOOK
R3s.25 | The order or booking form sends nothing when empty and shows what is missing; filled, it sends a WhatsApp message carrying the total the page shows | 3s FLOW | script: site FLOW

## 7. Motion

R3f.1 | A scroll effect plays while its subject is wholly on screen (held on a stage that fits, or started only when all in view); captured at 0, 25, 50, 75 and 100 percent on laptop, short laptop and phone, the whole subject is visible and the effect is mid-way where it should be | 3f.1, 3f.10 | LOOK: those frames
R3f.8 | A scroll-tied effect finishes while its subject is mid-screen (top on screen, centre no higher than 40%) at six sizes | 3f.8 | script: scroll-finish on each scroll-tied effect; n/a if none
R3f.9 | A list that stacks on a phone runs item by item (each item lights at about 80% down) | 3f.9 | LOOK at 390x844; n/a if none
R3f.5 | Text widths are in em or rem, never `ch`; a text shimmer is an overlay, never background-clip on the letters | 3f.5, 3f.6 | LOOK: grep css for `ch` and `background-clip`
R3f.4 | A motif from the logo (a bow) never lands on the logo that already has it | 3f.4 | LOOK; n/a if none
R3g.4 | Every motion has one job (guide, confirm, reveal); loops start and end on the same frame; text settles soft to sharp without bounce; list rows about 100 ms apart; menu hover under 300 ms | 3g.4 | LOOK
R3e.16 | No linear easing (ease-out or a spring); a transition grows from what was tapped and finishes under 0.5 s | 3e.16 | LOOK: grep css/js for `linear`, check durations
R3e.17 | A carousel shows a sliver of the next card, with visible buttons or dots (mirrored in Hebrew); a bottom sheet closes by swipe-down AND a close button | 3e.17 | LOOK; n/a if none
R3e.18 | Ambient background video only: camera locked, subtle, seamless loop of about 6 s, still poster, still for reduced motion | 3e.18 | LOOK; n/a if none
R3a.2 | Nothing moves without a reason: a clip behind text holds still except its subject; text never re-wraps while its container animates; no in-between state looks unfinished (checked at the middle of every transition) | 3a table, 3h.5 | LOOK: frames mid-transition
R3a.3 | Anything placed on a spot in a photo/video is placed by measurement and lives inside the media's element; a label never covers what it labels; a caption stays until the next replaces it | 3a table, 3a Overlays | script: overlay-truth (at most 4 px off at six sizes); n/a if no overlay
R3a.4 | A held (pinned) section is designed to fit its content at 1280x650; if it truly cannot, it plays as the page scrolls without holding the screen and is still the signature; the order section is never held | 3a table, 3a Cut off | script: cutoff at the six sizes of 3p.6 on every page; n/a if no held section
R3a.5 | Pinning and scrubbing yes, taking the scroll's speed or direction no, no parallax on phones, reduced motion shows a still | 9, 3e settled | LOOK: reduced-motion pass; phone pass
R3s.2 | Nothing jumps: late photos fade in over 200 to 400 ms into space kept for them; choosing something never moves the layout | 3s.2 | script: site SHIFT and motion (JUMP, FLASH, COLOUR; two quick taps)
R3s.1 | Everything pressable answers within 100 ms with a hover and a pressed state | 3s.1 | script: site STATE
R3s.8 | Buttons over a photo sit in a soft container, checked on a light and a dark photo | 3s.8 | LOOK
R3s.10 | The picture appears the moment a thing is named | 3s.10 | LOOK
R3i.3 | A live readout tied to the scroll shows only a true fact of their process, small mono at a corner, never a made-up number | 3i.3 | LOOK; n/a if none
R3s.21 | No script errors, console errors, 404s or dead links between the site's pages | 3s BROKEN | script: site BROKEN

## 8. Phone

R3b.6 | On a phone the action is pinned to the bottom with the price or proof beside it, from after the first screen until the order section; a bar that carries a counter or clock is there from the first screen and only its button waits | 3b.6, 3a payoff row | LOOK: 390x844 and 360x640 with touch emulation, whole scroll
R3f.7 | The bottom bar fits at 360 px: its label shrinks or wraps, its button never | 3f.7 | LOOK: 360x640
R3a.6 | A fixed bar never covers content (room is kept for it, including the last line and the end of the page) | 3a table | script: site PHONE
R3s.22 | Everything to tap is at least 40 px on a phone and no two taps overlap | 3s TAP | script: site TAP
R3s.23 | The page never scrolls sideways on a phone | 3s PHONE | script: site PHONE
R3a.7 | Every state is checked on the device that shows it (touch emulation for phones, never a narrow desktop window; hover-only looks have a touch version) | 3a table, 3e.9 | LOOK: record which emulation was used
R3a.8 | A line of items separated by dots never wraps | 3a table | LOOK at 360x640

## 9. Finish

R3r.3 | `check-rules` passes, every script above passed on every page after the last edit, and a fix was checked on the screen it was for | 3a.4, 3r | script: check-rules (this file)
R3r.4 | A rule Tzvi had to point out twice has a script or a line in this file the same day | 3r.3 | LOOK: any new Tzvi correction since the last build is in this file
