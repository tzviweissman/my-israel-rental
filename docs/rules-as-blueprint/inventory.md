# Rules as blueprint: inventory

Written 12 Nov 2026 for Tzvi. Goal: every website-build rule becomes something the build is made FROM, so a site comes out right first time instead of being built, checked many times and retried.

Sources read: `docs/rules-checklist.md` (all 242 rule ids), `scripts/blueprint.mjs` (stages, prefill from `src/record.json`, `--has film=no`, `--rules`), the starter (`README.md`, `sitekit.py`, `site.css`, `site.js`, `film.js`, `kit/`), and the finished Gremier Coffee build (`gen/build.py` 308 lines, `site.css` 594 lines of which about 430 are below the BELOW HERE line, `shop.js` 168, `home.js` 29, `slides.js` 57, `gc.js` 36). Nothing existing was edited.

## What the starter does and does not give today

- Gives by construction already: head/meta, skip link, menu bar, one CTA, phone bar, closing band, full footer, JSON-LD, gift section, gallery and FAQ hooks, type and spacing scales, contact labels, `kit.price`. Facts line, arrival and depth exist only as copyable kit CSS/JS.
- Does not give, so every site hand-writes it and the checks then catch the slips: the opening hero layout (Gremier wrote it in build.py with hand CSS), the scroll film markup and its words (`film.js` is bitmap-led; Gremier added `slides.js`), the order flow (`shop.js` is 168 lines copied from Gifted Israel), the shared Add/basket handler (`gc.js`), the choice swap with preloaded photos (`home.js`), section heights and layouts, the facts line, text-over-photo, hover/press states per control, copy lint, and all brief/prompt/negative-prompt text.
- One concrete cause found: starter `site.css` sets `--t-1: .8125rem` (13 px) and uses it for `.bar .p`, footer text, `.err` and the form summary; rule R3e.8 needs 14 px for any sentence on a phone. That alone explains the Gremier "phone sentences at 13px" retry.
- `blueprint.mjs` already writes one plan line per rule and pre-fills about ten from the record, but a plan is free text that nothing in the build reads. The design below turns the plan lines into a `site.json` (G1) that `build.py` and the generators read.

## Legend

How: KIT = starter code/CSS makes it true for every site; GEN = a generator script makes it from the blueprint's answers; ASK = one per-site choice that becomes a blueprint question whose answer the kit/generator uses; OWNER = a fact only the owner can give (an owner-question line); EYE = a human look stays as one final review item. Combinations mean both are needed.

Piece codes K1..K17 and G1..G12 are defined in the summary below. "check today -> confirm only" means that once the rule is built in, the named check (or LOOK) is run only as a final confirmation, not as the way to find out. "Gremier retry?" = yes when the rule is behind one of the retries of 10-12 Nov 2026. R0b.4i is a real id the checklist writes with a letter.

## Table

| id | short rule | how | what builds it | check today | Gremier retry? |
|---|---|---|---|---|---|
| R0b.1 | Real slug from the live record | ASK+GEN | site.json slug read from record.json by fetch_business; Site(slug) and publish take it | LOOK -> confirm only (G1 asserts slug equals record) | no |
| R0b.3 | Prices and currency match owner menu; real menu loaded in shop with fixed ids | OWNER+GEN | load_products.py from record/flyer into catalog.js and prices.json; owner confirms menu | check-site SAVE -> confirm only | no |
| R2.1 | Only facts the owner or record gave | GEN+EYE | G3 copy-lint: every number, since, claim word in copy.json must cite a record field or owner answer | LOOK (stays: one final read) | no |
| R2.2 | Owner asked only about own business, never how we build | GEN | G2 owner-questions generator from a fixed template; skips what the record answers | LOOK -> confirm only (lint on message-to-owner.md) | no |
| R2.3 | Message has 5-8 FAQ questions from real details plus worry/first-days/photo questions | GEN | G2 builds them from record fields and the spec | LOOK -> confirm only | no |
| R3.1 | Every claim has proof (kosher, licensed, reviews, years, best, 24/7) | GEN | G3 claim table: each trigger word needs a record field or the build refuses the line | LOOK -> confirm only (G3 lint) | no |
| R3.2 | No urgency or scarcity | GEN | G3 banned-phrase list on copy.json; kit never emits counters or countdowns | LOOK -> confirm only | no |
| R3.3 | No generic sentences (welcome to, one-stop shop, Hebrew equivalents) | GEN | G3 banned-phrase list EN+HE | LOOK -> confirm only | no |
| R3.4 | No exclamation marks, long dashes, capitals | GEN | G3 lint on copy.json, alt text, SITE strings; Site.write asserts on final HTML text | LOOK -> confirm only | no |
| R3.5 | Headline or line names something they sell in listing words | ASK+GEN | Blueprint question: headline words from listing names; G3 asserts h1 shares a word with a listing name | LOOK (stays: first screen) | no |
| R3.6 | Everything in the page language; Hebrew written, RTL checked | KIT+GEN | K16 kit.lang Hebrew twin from copy.json (he block required); dir=rtl and Hebrew font swap in site.css; G3 flags Latin words in Hebrew | check-hebrew-pages + LOOK (stays: Hebrew read) | no |
| R3.7 | Nothing faked: no FAQ/reviews/placeholders until real | KIT+GEN | kit.faq/gallery/reviews render hidden until real data (already); G3 refuses lorem and coming soon | LOOK -> confirm only | no |
| R3.8 | No logo walls, As-seen-on, laurels, invented badges, fake stars | KIT+GEN | No such component in the kit; badge only from an owner flag; G3 lint | LOOK -> confirm only | no |
| R3.9 | Page repeats the promise that brought the visitor | OWNER+ASK | Question: the owner's flyer/ad line; hero h1/line built from it | LOOK (stays) | no |
| R3.10 | At most two strengths, each with proof | ASK+KIT | Question picks two strengths from the record; kit.facts caps facts at 3 and strengths at 2 | LOOK -> confirm only | no |
| R5.1 | Their words first, specific; no line a competitor could print | GEN+EYE | G3 copy pass seeded from listing text; generic-phrase lint | LOOK (stays: one read aloud) | no |
| R5.2 | Professional voice, no teasing or slang | GEN+EYE | G3 copy-pass prompt carries the voice rules; banned word list | LOOK (stays) | no |
| R5.3 | Short labels are full phrases | GEN | G3 lint: badge/tag strings need 3+ words and a fact | LOOK -> confirm only | no |
| R5.4 | Visitor is you, business is we; never they/them about itself | GEN | G3 lint for they/them/their in all strings incl. alt, errors, footers | LOOK -> confirm only | no |
| R5b.2 | One button one label everywhere (header, hero, sections, bar, footer) | KIT | Site.cta is the only source; kit.button() takes no label; header, bar, footer, close, hero all read Site.cta; build asserts no other main-button text | check-menu + LOOK -> confirm only | no |
| R5b.8 | Finish/closing line names what the customer gains; no stray or/prefer | GEN+EYE | G3 bans done/complete in closing strings; or/prefer lint | LOOK (stays) | no |
| R3.11 | Headline says what customer gets; order follows visitor questions; prices before enquiry form | KIT+ASK | K7 section-order template (what, trust, cost, action) per category; kit refuses a form before a price block | LOOK (stays: read top to bottom) | no |
| R3o.4 | Every contact labelled by what it does; owner said which number takes what | KIT+OWNER | kit.Contact kinds already label; owner question in G2 gives the kind per number | LOOK -> confirm only | no |
| R3e.22 | Owner visible as a person: name, real photo, direct WhatsApp | ASK+OWNER+KIT | Question: owner photo and name; kit.maker() block right after the opening | LOOK (stays) | no |
| R3s.19 | Same promise/photos on link preview, home, shop; every page own title, description, og | KIT+GEN | K1 Site.write requires per-page title, desc, og; promise line from spec; og image built from hero | check-web-basics -> confirm only | yes |
| R6.1 | Category playbook lead block first, must-haves present | ASK+KIT | Question: category (3t); K7 loads that category's block order from playbooks.md as JSON | check-site CATEGORY + LOOK -> confirm only | no |
| R4.1 | Missing data reads as deliberate (Ask for a quote), listed as a gap | KIT+GEN | kit.price(None) renders Ask for a quote; G2 lists gaps in OWNER-QUESTIONS | LOOK -> confirm only | no |
| R3g.13 | First screen: picture, 2-5 word headline, one short line, one button | KIT | K2 kit.opening(h1, line, button) asserts word count 2-5, one line, one button, one place line | check-site OPENING + LOOK -> confirm only | yes |
| R3g.18 | First screen shows what the business offers; offers meta lists the kinds | ASK+KIT | Question: kinds of offer; K2 requires h1 to name each kind and writes meta offers | check-says-offer -> confirm only | no |
| R3b.1 | First screen answers what, where, trust, next | KIT | K2 slots: what (h1), where (line), trust (facts), next (button); all required args | LOOK -> confirm only | no |
| R3b.2 | Proof touches main button; kosher band after opening; certificate stated at most twice | KIT+ASK | K2 puts btn-facts under the button; kit.band('kosher') once after opening; count asserted | LOOK -> confirm only | no |
| R3b.3 | One solid action per screen; header button outline when hero has solid | KIT | site.css: .top .btn-line always outline, .btn only in hero/sections; Site.write asserts one .btn per section | LOOK -> confirm only | no |
| R3h.20 | Scroll opening 60 fps, >=3 screens, product on plain ground, whole, first screen first | KIT+ASK | K3 film height min 300svh enforced in CSS; poster loads first; ground colour is a spec value; video-led scrub | check-opening-scroll -> confirm only | yes |
| R3h.21 | Effects never too much: <=3 holds, each <=1.5 screens, nothing between phone visitor and order | KIT | K3 and kit.hold() register holds; Site.write counts them and refuses more | check-one-scroll -> confirm only | no |
| R3h.22 | Storyboard sheet of rough drawings approved before any still | GEN+EYE | G6 storyboard.py writes the sheet from the concept ideas; gate blocks stills until pick is recorded in film-brief.md | LOOK (stays: Tzvi's pick) | no |
| R3h.23 | Every clip passes check-clip; brief has How it really happens and Key moment | GEN | G6 brief template with required sections; G7 runs check-clip per clip right after generation | check-clip (per clip) -> confirm only | yes |
| R3h.24 | Scroll film is real video tied to the scroll within 0.4 s, no freezes | KIT+GEN | K3 film.js v2: every-frame-keyframe encode fixed in film.sh/G7, video-led scrub, bitmap fallback | check-film-video -> confirm only | yes |
| R3h.25 | Nothing covers a scroll film while it plays (3% max) | KIT | K3 film markup has no word slot over the picture; chapter lines are edge slots <=3% area; closing words only after film end | check-film-clear -> confirm only | yes |
| R3h.1 | Home opens on full-screen picture/film (>=70%), an event from their own thing | KIT+ASK | K2/K3 stage is 100svh full-bleed by construction; Question: which event (from G9 idea list) | check-site OPENING + LOOK (event stays) | yes |
| R3n.1 | Strongest real photo fills half the first screen on laptop and phone | KIT+ASK | K2 picture slot >=60% area; G5 picks the highest-resolution photo; Question: which photo | LOOK -> confirm only | no |
| R3n.2 | One signature moment only this business could have | ASK+EYE | Blueprint question (one line plus why no other business); G9 idea log | LOOK (stays) | no |
| R3n.3 | Visitor's choice changes the page, not one picture | KIT+ASK | K10 kit.choice(target=hero) updates hero, colour var, order; Question: what is the choice | check-motion + LOOK -> confirm only | yes |
| R3n.4 | Side by side with closest reference, ours not weaker | GEN+EYE | G10 makes the side-by-side sheet of our first screen vs the saved reference | LOOK (stays) | no |
| R3n.5 | One-sentence test: you land and X happens, about the business | ASK+EYE | Blueprint question: write the sentence; G9 rejects decoration verbs | LOOK (stays) | no |
| R3g.15 | Opening at full quality; no flyer crop; no fake premises | GEN+KIT | G5 refuses a hero source under 1600 px and extends or regenerates; K6 never shows a photo over 1.35x | check-fits -> confirm only | no |
| R3h.2 | Film goes from where product comes from to real product and button, every step true | GEN+EYE | G6 brief object list and story; G7 final frame = owner photo | LOOK (stays: walk film) | no |
| R3h.3 | Film full screen, crisp, near-lossless, never masked | KIT | K3 canvas/video cover 100svh, encode crf fixed, no mask CSS exists | LOOK -> confirm only | no |
| R3h.5 | Chapter lines 2-6 words, small, at an edge, <=third height, edge shade only | KIT+GEN | K3 .chap slot fixed to an edge with shade; G3 word count 2-6 | readable + check-film-clear -> confirm only | yes |
| R3h.7 | Film seams checked; a jumping clip regenerated | GEN | G7 compares last frame of clip n with first of n+1 (difference score) and flags a jump | LOOK -> confirm only (G7 numeric) | yes |
| R3h.8 | Section after a lit film changes mood boldly | ASK+KIT | K7 next section takes the contrasting ground token from BRAND.md | LOOK (stays: tiny) | no |
| R3h.11 | Film and stills bright (thirds 33, whole 22, avg 30), subject brightest | GEN | G7 brightness.py gate per still/clip; prompt template adds bright-light words | brightness.py -> confirm only | yes |
| R3h.13 | One cause one motion; passes a 4 fps watch | GEN+EYE | G6 brief forces cause+effect in one clip; G7 writes the 4 fps sheet | LOOK (stays: watch sheet) | yes |
| R3h.14 | Product recognisable through the effect; phone frame widens | GEN+EYE | G7 product-match sheet (product-match-sheet.py) per clip | LOOK (stays) | yes |
| R3h.18 | Film physically possible: every object listed with source and end | GEN+EYE | G6 object-list table required in brief; a story with an object lacking source/end is refused | LOOK (stays: object by object at 8 fps) | yes |
| R3h.19 | Generate once: possible story chosen, frame 1/mid/last written, max two tries | GEN | G6 clip-plan fields required; G7 counts tries per clip and stops at 2 | LOOK -> confirm only (G7 log) | yes |
| R3h.17 | Words and film take turns; giant name on plain ground | KIT | K3 stage states: words, film, words (never together); giant-name slot on a plain layer | readable -> confirm only | yes |
| R3x.5 | Following light only for dark-world business, off button, phone sweep | ASK+KIT | Question: dark world?; kit.css light piece carries off button and reduced-motion | LOOK (stays; mostly n/a) | no |
| R3z.2 | First screen has three layers: photo, film or shape, words, button in front | KIT | K2 z-layer structure (photo, shape, words, button with the only shadow) | LOOK -> confirm only | no |
| R3z.6 | h1/line holds the search words for the business and its place | ASK+GEN | Blueprint plan line names search words; G3 asserts h1/line contains them | LOOK -> confirm only | no |
| R3.12 | Every page has hero, features (one item per product with price), CTA section near end with proof | KIT | K7 page templates per category always emit hero, items, closing band (Site.footer close already) | LOOK -> confirm only | no |
| R3c.1 | References first: 3-5 real screens with sources in CONCEPT.md | GEN+EYE | G12 source log writes REFERENCES.md and CONCEPT.md skeleton from each Mobbin/21st/Inspo search made | check-concept/check-references -> confirm only; LOOK (stays: pick) | no |
| R3g.17 | Every piece from a fresh search for this business, nothing reused from last two pages | GEN+EYE | G12 logs each search and G9 compares chosen effects with last two sites' fingerprints before build | check-concept + prints -> confirm only | no |
| R3g.19 | Shops: main buttons in the product's own colour, 4.5:1, 3:1 from ground | GEN+KIT | G4 samples product photo, picks colour passing both contrasts, writes --btn token and meta product-colour | check-button-colour -> confirm only | no |
| R0b.4i | Opening ideas from saved sources, none a kind another site uses | GEN | G9 draws ideas from docs/inspo with pictures and filters kinds in motions.json | check-ideas -> confirm only | no |
| R3c.2 | No AI default look (cream+serif+italic, purple gradient, three identical cards...) | GEN+KIT | G4 palette/fonts picked from logo+photos and checked against banned combos; kit has no default gradient/frosted | LOOK (stays: whole page) | no |
| R3g.1 | Style sheet in CONCEPT.md before building; every section follows it | GEN | G4 writes tokens to BRAND.md AND site.css :root from one file; sections only use var() | LOOK -> confirm only (computed-style diff) | no |
| R3g.3 | Accent for main button only; prices in ink, bold and large; one emphasised word per screen | KIT | site.css: --accent used only by .btn; .pr rule is ink/bold/large; kit.price emits .pr | LOOK -> confirm only | no |
| R3g.7 | At most one closing signature, not in the order path | ASK+KIT | Question: signature or none; Site.close_extra is the only slot | LOOK -> confirm only | no |
| R3g.11 | Fonts from approved Latin+Hebrew list | GEN | G4 picks only from reference/design-rules.md list (pairs with Hebrew twin) | LOOK -> confirm only | no |
| R3p.3 | Not alike: no shared heading face, colours, design differs on 4 of 6 | GEN | G9/G4 pre-check fingerprints.json and offer only unused fonts/colours/effects before any CSS | check-fingerprints -> confirm only | no |
| R3p.5 | One small touch only this business would have | ASK+EYE | Question: the touch (from product/tagline/craft); recorded in CONCEPT.md | check-concept + LOOK (stays: works) | no |
| R3q.1 | CONCEPT.md complete: 3 ideas citing pictures, Own idea, five wow answers, effects line, Not alike | GEN | G12/G9 write CONCEPT.md from a template with every required line as a fillable field | check-concept -> confirm only | no |
| R5a.7 | One signature idea and one peak per page; not carried over | ASK+KIT | Question: the signature; K7 allows one signature slot per page | LOOK (stays) | no |
| R9.1 | Signature section only when own photos support it | ASK | Question: which photos support it; blueprint n/a otherwise | LOOK -> confirm only | no |
| R3f.2 | Effect budget filled: one signature, >=3 accents, quiet touches, on captured frames | GEN+EYE | G9 effect-budget table in CONCEPT.md; G10 captures frames at 0/25/50/75/100% | LOOK (stays: frames) | no |
| R3m.1 | Gallery place on every page; priced products inside data-mir-catalog | KIT | kit.gallery() and kit.items() emit data-mir hooks and templates (gallery exists) | LOOK -> confirm only | no |
| R3m.3 | Owner-changed details in fixed places with length limits | KIT | kit.hours(), kit.areas(), kit.faq() with max length data attrs (faq exists) | LOOK -> confirm only | no |
| R3k.1 | Menu and order are ONE page; old addresses forward | KIT+ASK | Site.pages shape asserted; G1 writes redirect stubs for menu/order html | LOOK -> confirm only (check-menu) | no |
| R3k.2 | One identical menu bar on every page; phone Menu/Close closes on Escape | KIT | Site.header + site.js already do this | check-menu -> confirm only | no |
| R3k.4 | Shared site.css/site.js; section class names never reused for shared state | KIT | starter ships both; shared state uses .shown/.on; a lint in Site.write rejects page CSS selectors .open/.in outside kit | LOOK -> confirm only | no |
| R8a.1 | Nothing left over from 21st/generated components | GEN | G3 scans html for external hosts, scripts, demo text before write | LOOK -> confirm only (grep) | no |
| R3b.4 | With few photos facts carry the page; place: hours and where first | ASK+KIT | Question: photo count; K7 picks facts-led template under 4 photos | LOOK -> confirm only | no |
| R3c.3 | Proof sits where the worry is, beside the button or price | OWNER+KIT | Question: owner's worries (G2); kit.proof(worry, near=button) slot | LOOK (stays) | no |
| R3c.8 | What happens after the order stated first, if owner told us | OWNER+KIT | Question to owner; Site.ordering footer part and order done screen read it | LOOK -> confirm only | no |
| R3e.10 | Cards have one reading order; long names truncate; icon on solid circle | KIT | K11 kit.items card markup and CSS fixed (name largest, one fact, price) | site ALIGN -> confirm only | no |
| R3e.14 | One body family, three weights, <=6 sizes, 4 px grid | KIT | site.css scales --t-1..--t5 and --s1..--s10 (exist); lint rejects non-scale font-size/gap in page CSS | check-web-basics SCALE -> confirm only | no |
| R3c.9 | One radius, one icon set, one shadow, no gradients, no decorative arrows | KIT | site.css --r and --shadow tokens only; lucide helper kit.icon(); lint bans linear-gradient with two colours | LOOK -> confirm only | no |
| R3s.4 | One left edge for headings, text, buttons | KIT | .wrap and grid utilities; page CSS lint rejects negative margins | site ALIGN -> confirm only | no |
| R3s.6 | Same-job controls look the same | KIT | only .btn/.btn-line/.btn-sm exist; kit.button() sizes fixed | site ALIGN -> confirm only | no |
| R3s.7 | Sentence case, pale dividers, no Price: labels, line-height 1.5-1.6 | KIT | site.css body line-height 1.6; kit.price has no label; lint on uppercase text-transform for buttons | LOOK -> confirm only | no |
| R3s.9 | One colour per meaning (kosher tag same everywhere) | KIT | kit.tag(kind) one style per kind | LOOK -> confirm only | no |
| R3s.12 | Maker and real work right after opening, one real photo in use | ASK+KIT | Question: which photo; kit.maker() placed by K7 right after opening | LOOK -> confirm only | no |
| R3s.14 | Real numbers shown big (3x body) with one-line label | KIT+OWNER | kit.stat(value,label) at --t5; values only from record or owner answer (G3) | LOOK -> confirm only | no |
| R3s.11 | One true sentence beside price says why it costs that | OWNER+KIT | Question per product; kit.items slot .why required when price shown | LOOK -> confirm only | no |
| R5b.6 | No scroll cues, counters, label above every section | KIT | No such component in the kit; lint rejects .caps kicker on every section | LOOK -> confirm only | no |
| R3.13 | Structure: no doubled contact/facts/gallery; no two dividers; gallery >=3 | KIT | Site.write asserts one contact block, one facts line, gallery needs >=3 photos else hidden | LOOK -> confirm only | no |
| R3a.1 | Rendered at six sizes, each language, every screen looked at | GEN+EYE | G10 renders contact sheets at six sizes in one command (screenshot.mjs exists) | LOOK (stays: look at the sheets) | no |
| R3r.1 | Every script run on every page | GEN | check-build already runs every check on every page; G1 lists pages from Site.pages | check-build -> confirm only | no |
| R3r.2 | Someone who did not build the page reviewed it | EYE | Reviewer opens page-review-checklist against G10 sheets | LOOK (stays) | no |
| R3g.12 | Real test through every form and order button to a test business | GEN | test_order.mjs generated per site from catalog (Gremier has one); K4 exposes #st-add test hooks | check-site FLOW/SAVE -> confirm only | yes |
| R0b.12 | Pages-list preview clip shows current version | GEN | publish-page records preview clip after publish | check-showcase-previews -> confirm only | no |
| R3x.1 | Product to turn made from owner photo via API and compared | ASK+GEN+EYE | Question: used?; G7 turn model + side-by-side sheet; kit.turn() component | LOOK (stays; n/a mostly) | no |
| R3x.2 | Counted number real, counts once, in page text | KIT | kit.stat(count=True) puts value in text, JS only animates | LOOK -> confirm only | no |
| R3x.3 | Tabs change one panel in place, same spots | KIT | K10 kit.tabs() fixed panel geometry | LOOK -> confirm only | no |
| R3x.4 | Two or more sizes/packages each a card with same measures in same order | KIT+ASK | K11 kit.sizes(items) one card shape; Question: sizes and servings | LOOK -> confirm only | no |
| R3x.11 | Product-to-turn suitability, candidates from four angles, touch-action pan-y | ASK+GEN | G7 turn pipeline; kit.turn() sets pan-y | LOOK (stays; n/a mostly) | no |
| R3z.1 | One card hangs over the edge of next section on home page, whole on phone | KIT+ASK | kit.overlap_card() component; Question: which card | LOOK -> confirm only | no |
| R3z.5 | Dark site has one light section joined by a clean edge | ASK+KIT | Question: dark ground?; K7 inserts light section token | LOOK -> confirm only | no |
| R8.1 | Set of images reads as one shoot | GEN+EYE | G5 generates whole set in one pass from one preamble; G10 contact sheet at rendered size | LOOK (stays: compare sheet) | yes |
| R8.6 | Main product pictures are hero shots, product exactly theirs | GEN+EYE | G6 still-brief template (8 points, plinth, props from business) and G7 product-match sheet vs owner photo | LOOK (stays) | yes |
| R8.8 | Each product picture a full scene, props same places per card | GEN | G6 one layout sketch (ad-layout-sketch style) for whole set fed to reference model | LOOK -> confirm only (sheet) | yes |
| R8.9 | Owner photo only on the item it shows | OWNER+ASK | Question per photo (G2); G5 maps photo to item id in catalog.js | LOOK -> confirm only | no |
| R8.7 | Every paid generation had a brief first, crop-based, compared beside the photo | GEN | G6 brief generator prerequisite of G7 (film-gate hook exists); side-by-side sheet auto-made | film-gate hook -> confirm only | yes |
| R8.2 | Set from owner photos first, else whole set in one pass; no mixed cut-outs | GEN | G5 sourcing order encoded; mixed sources refused | LOOK -> confirm only | no |
| R3p.7 | Similar items shown the same way | KIT | K11 kit.items one template for all items; hover behaviour set once on the list | LOOK -> confirm only | no |
| R3p.8 | Optional: touch on every button of that job | KIT | site.css .btn touch defined once (fingerprint choice) and applies to all .btn | LOOK -> confirm only | no |
| R3h.12 | One look per product everywhere, cut from one master | GEN | G5 master-per-item folder; every appearance cropped from master by script; G10 appearance sheet | LOOK (stays: two that could pass for different) | no |
| R3h.10 | Choosing an option changes picture, words, button; one photo per option | KIT+GEN | K10 kit.choice binds picture+words+button; images preloaded and decoded before swap | check-motion -> confirm only | yes |
| R3g.14 | One colour grade across all images and clips | GEN | G5 applies one grade LUT to every asset | LOOK -> confirm only (sheet) | no |
| R3o.1 | Generated food in motion only in the opening film; elsewhere real photo | ASK+GEN | G5 asset routing: food stills outside the film are owner photos only; generation limited to film folder | LOOK -> confirm only | yes |
| R3o.2 | Generated liquid opaque, satin, specks, not glass or neon | GEN+EYE | G6 prompt preamble (real-looking-sauce-prompts) + negative list | LOOK (stays: frames) | yes |
| R3o.3 | Product colours look true, no cast | GEN+EYE | G6 negative prompt (no orange glow, no colour cast); G7 samples product colour vs photo and flags drift | LOOK -> confirm only (numeric delta) | yes |
| R3o.6 | One photo per kind from all owner photos, duplicates skipped | GEN | G5 numbered sheet, perceptual-hash dedupe, kind labels | LOOK -> confirm only | no |
| R8.3 | Generated media only of real items; no text baked in; no non-kosher; owner approved | GEN+EYE | G6 negative prompt (no text, no labels, no logos); G7 OCR check on every still for text | LOOK (stays: owner approval) | yes |
| R8.4 | Moving real material is a generated clip, not SVG/CSS; reduced motion shows still | GEN | G6 routes any such motion to a clip brief; K3 still poster | LOOK -> confirm only | no |
| R3c.13 | Nothing cut off at any size | KIT | site.css overflow-safe sections (min-height/auto), data-clip-ok only in kit.pin | clipped -> confirm only | yes |
| R3c.14 | Cut-out is one subject, no fringe | GEN | G5 cutout.py --check as a pipeline step | cutout.py -> confirm only | no |
| R5b.3 | Text over imagery: soft edge shade, contrast, <=40% of opening on a phone | KIT | K12 kit.over: shade token, grid rows so text block is capped at 40% of the picture on phone, headline box never overlaps button | readable + check-photo-clear -> confirm only | yes |
| R3e.8 | Words >=12px (14px sentences on phone), 4.5:1 contrast | KIT | site.css min sizes (--t-1 is 13px in the starter; raise to 14px for sentences, 12px labels only); tokens contrast-checked by G4 | readable -> confirm only | yes |
| R3s.24 | Media light and sized: <=600 KB, width/height, poster, nothing hidden | KIT+GEN | K6 kit.photo needs width/height; G5 compresses to <=600 KB and writes poster | site MEDIA -> confirm only | no |
| R3p.6 | Fits one screen at six sizes; photo <1.35x; extended not cropped | KIT+GEN | K8 section CSS with clamp padding and max-height vs 100svh minus bar; K6 object-fit contain/extended picture; G5 extend_photo.py | check-fits -> confirm only | yes |
| R3o.5 | Special characters render in the font used for them | KIT | kit.price wraps symbol in body face; site.css subsets Latin+Hebrew families | site GLYPH -> confirm only | no |
| R3x.7 | BRAND.md written before any picture; the site uses it | GEN | G4 writes BRAND.md first and generates the :root block from it | LOOK -> confirm only | no |
| R3z.4 | No dark layer over a whole photo; shade only behind words where measured | KIT | K12 shade only in the text slot; no full-photo overlay class exists | LOOK -> confirm only | no |
| R3z.7 | Card pictures without owner photos made as one set from a saved site grid | GEN | G5/G6 set generation takes a screenshot reference path | LOOK -> confirm only; n/a often | no |
| R3c.5 | Choices are tiles, never a dropdown; Most popular only if owner says | KIT | K10 kit.choice renders radio tiles; no select helper; badge only from owner flag | LOOK -> confirm only (grep select) | no |
| R3c.6 | Button says what happens next with a real number; never Submit/Buy now | KIT+GEN | K4/K9 button text built from prices (Order 4 buns, ₪55); G3 bans Submit/Buy now | LOOK -> confirm only | no |
| R3c.7 | Offers contained: real end date for timed, standing discounts need none | OWNER+KIT | Question: any offers and end dates (G2); kit.offer(end=) refuses a timed offer with no date | LOOK -> confirm only | no |
| R3j.1 | Guarantee beside button in owner's words with limit | OWNER+KIT | Question (G2); kit.guarantee() slot next to button; absent if not given | LOOK -> confirm only | no |
| R3j.2 | One relevant add-on with Add and No thanks, not pre-ticked | ASK+KIT | Question: add-on; K4 add-on step component | LOOK -> confirm only | no |
| R3j.3 | Free taster/consultation the owner offers is headline offer beside button | OWNER+KIT | Question; K2 button-adjacent offer slot | LOOK -> confirm only | no |
| R3j.4 | Group discounts only when owner offers, said once near price | OWNER+KIT | Question; kit.offer(kind=standing) | LOOK -> confirm only | no |
| R3j.5 | Come-back features only if real | OWNER+KIT | Question; kit.stampcard()/Reorder only when switched on | LOOK -> confirm only | no |
| R3j.6 | Natural pick among three sizes shown; no invented option | ASK+KIT | Question: which size is the natural pick; kit.sizes marks it only on owner say | LOOK -> confirm only | no |
| R3j.7 | No fake was price; no .90/.99 changes | GEN+KIT | G8 prices.json has was only when typed from a real old price; kit.deal refuses a was with no source | LOOK -> confirm only | no |
| R3j.8 | Saving only true like for like, per-unit table, vs cheapest | GEN | G8 builds per-unit table from prices.json and flags any bigger option not cheaper per unit than every smaller one | LOOK -> confirm only (G8 table) | no |
| R3j.9 | Lone saving not shown; each small group shows its own | GEN | G8 groups items by family and only emits savings inside groups | LOOK -> confirm only | no |
| R3j.10 | Saving as percentage badge, rounded down, real separate price struck through | KIT | K9 kit.deal() computes floor percent, struck price, badge text, button text (Gremier price_row does it by hand) | LOOK -> confirm only | no |
| R3j.11 | Combined service and basket package prompts when real | KIT | K4 basket rule engine from G8 groups (Switch to package line) | LOOK -> confirm only (build a basket) | no |
| R3j.12 | Owner's savings claim contradicted by prices not printed | GEN+OWNER | G8 compares owner claim to table, adds a question to G2 | LOOK -> confirm only | no |
| R3j.13 | Every saving vs the smallest size bought as many times | GEN | G8 computes against smallest size only | LOOK -> confirm only | no |
| R3j.14 | Every price from the listing: prices.json, MIR_PRICES | KIT+GEN | G8 writes prices.json; K4/K9 read window.MIR_PRICES; no price literals in generated html (lint) | LOOK -> confirm only (change a price test) | no |
| R3.14 | Loud prices only when prices exist; none on premium/quote business | ASK+KIT | Question: priced or quote; kit.price(None) switches style | LOOK -> confirm only | no |
| R3z.3 | Taste of at most three questions ends on a real answer and price | ASK+KIT | Question: needed?; kit.taste() component; n/a with one product | LOOK (stays; n/a often) | no |
| R3k.7 | Order in three steps with bar, totals beside, Back, browser back, per-step checks | KIT | K4 order.js + kit.order_page() shared 3-step flow with #order-2 history; the step bar and summary are in the markup | check-site FLOW -> confirm only | yes |
| R3k.8 | Every basket line has a 40px remove button | KIT | K4 basket line template includes remove (packages too) | check-site TAP -> confirm only | no |
| R3k.6 | Basket lives between pages; Add opens order page | KIT | site.js siteBasket plus kit data-add handler moved into starter (Gremier gc.js did by hand) | LOOK -> confirm only | no |
| R3k.9 | Order POSTed to MyIsraelRental before WhatsApp; products are listing products | KIT+GEN | K4 POST then WhatsApp; load_products.py uses real product ids | check-site SAVE -> confirm only | no |
| R3k.10 | Order form arrives filled in: first possible day, qty 1, common choice | ASK+KIT | Question: lead time/closures (from record); K4 prefill from spec | check-prefill -> confirm only | no |
| R3.15 | Brief's action has a place to do it | ASK+KIT | Question: the one action; K7 template includes that block (shop, book, contact, hours) | LOOK -> confirm only | no |
| R7.1 | Hand build picks one direction and says why in CONCEPT.md | GEN | G9 CONCEPT.md template has Pick and Reason fields | check-concept -> confirm only | no |
| R8.5 | Main button goes to quickest route to a finished order | ASK+KIT | Question: order route; Site.cta is set to it | LOOK -> confirm only | no |
| R0b.13 | Order saves with tracking link before WhatsApp; reaches owner complete | KIT | K4 does POST then tracking link in the message | LOOK -> confirm only (test order) | no |
| R3l.1 | Owner asked what a customer can choose and how many per item family | OWNER | G2 asks per similar-item family | LOOK -> confirm only | no |
| R3l.2 | Each item says what it allows, same words on tile, order line, message | KIT | K11 one allows string from catalog used by card, basket, message | LOOK -> confirm only | no |
| R3l.3 | Choices belong to item; limits grey out; cannot send without required choice | KIT | K4/K10 options UI from catalog.allows | LOOK -> confirm only (order each package) | no |
| R3l.4 | Three or more alike items compared at a glance | KIT | kit.compare(items) table of differing fields | LOOK -> confirm only | no |
| R3l.6 | Picture is of item as sold now | OWNER+GEN | G5 maps photo to item; unknown look gets no picture | LOOK (stays) | no |
| R3l.7 | Each item readable alone | GEN+EYE | G3 lint: item description must name contents and choices | LOOK (stays) | no |
| R3e.9 | Buttons rest/hover/pressed/disabled; fields focus/error; confirmations | KIT | site.css gives every .btn, .btn-line, .chip, .fld all states; siteToast confirms; lint rejects a new button class without states | check-site STATE/FLOW -> confirm only | yes |
| R3e.19 | Every flow has a visible end screen | KIT | K4 done screen; lists end | LOOK -> confirm only | no |
| R3s.16 | Fewer choices first: plain question before long list | KIT+ASK | K4 step 1 asks one question; Question: the question | LOOK -> confirm only | no |
| R3s.18 | Not available shows nearest alternative; choice lists have a way out | KIT | K10 always appends None/Other; out-of-stock shows next item | LOOK -> confirm only | no |
| R3s.25 | Form sends nothing when empty; filled sends WhatsApp with total | KIT | K4 | check-site FLOW -> confirm only | yes |
| R3x.9 | Request-type form builds a plain summary beside it | ASK+KIT | Question: shop or request; kit.request_form() with live summary | LOOK -> confirm only; n/a for shops | no |
| R3x.10 | Total stays in view beside form on laptop; total above send on phone | KIT | K4 sticky summary (site.css .sum already) plus phone total line | LOOK -> confirm only | no |
| R3x.14 | Gift card section on order page | KIT | SITE.gift_section()+gift.js (exists); Site.order_page() includes it | check-web-basics GIFT -> confirm only | no |
| R3f.1 | Scroll effect plays while subject wholly on screen | KIT | K3/kit.hold() stage geometry uses min(100svh, content) and starts when all in view | LOOK (stays: frames at 5 stops) | no |
| R3f.8 | Scroll-tied effect finishes mid-screen | KIT | kit.scroll_tied() sets finish point 40% | scroll-finish -> confirm only | no |
| R3f.9 | Stacked list on a phone runs item by item at 80% down | KIT | kit.css list-in rule | LOOK -> confirm only | no |
| R3f.5 | Widths in em/rem never ch; shimmer is overlay | KIT | site.css lint rejects ch and background-clip | LOOK -> confirm only (grep) | no |
| R3f.4 | Logo motif never on the logo that has it | ASK | Question: logo motif; G9 excludes it | LOOK -> confirm only | no |
| R3g.4 | Every motion has one job; loops start/end same frame; list rows 100 ms; menu hover <300 ms | KIT | site.css motion tokens (--dur-fast 160, --dur 300, stagger 100) and loops only from G7 seamless encode | LOOK (stays: judgement) | no |
| R3e.16 | No linear easing; transitions <0.5 s | KIT | tokens only --out; lint rejects linear and durations >500 ms | LOOK -> confirm only (grep) | no |
| R3e.17 | Carousel shows sliver, buttons; sheet closes by swipe and button | KIT | kit.carousel() and kit.sheet() (Gremier shop sheet uses dialog) | LOOK -> confirm only | no |
| R3e.18 | Ambient background video locked, ~6 s seamless loop, poster | GEN+KIT | G7 loop encode; kit.ambient() with poster and reduced-motion still | LOOK -> confirm only | no |
| R3a.2 | Nothing moves without a reason; no text re-wrap while container animates | KIT+EYE | kit components animate transform/opacity only; text widths fixed | LOOK (stays: mid-transition frames) | no |
| R3a.3 | Overlays placed by measurement inside the media's element | KIT | K14 kit.pin() places by data-x/data-y percent inside the media element | overlay-truth -> confirm only | no |
| R3a.4 | Held section designed to fit 1280x650; order section never held | KIT | kit.hold() stage height = min(100svh, content) and refuses to wrap #order | cutoff -> confirm only | yes |
| R3a.5 | Pinning yes, taking scroll speed no; no parallax on phones; reduced motion still | KIT | kit.css/site.js gate depth to hover:hover and reduced-motion | LOOK -> confirm only | no |
| R3s.2 | Nothing jumps: late photos fade into reserved space; choosing never moves layout | KIT | K6 every photo in aspect-ratio slot with width/height; K10 preloads and decodes next option before swap (Gremier home.js did by hand) | site SHIFT + motion -> confirm only | yes |
| R3s.1 | Everything pressable answers within 100 ms with hover and pressed state | KIT | site.css base :active and :hover for every interactive element selector | site STATE -> confirm only | yes |
| R3s.8 | Buttons over a photo sit in a soft container | KIT | K12 .over .btn has container token | LOOK -> confirm only | no |
| R3s.10 | Picture appears the moment a thing is named | KIT | K11 card and K10 tile always carry photo; preloaded | LOOK -> confirm only | no |
| R3s.27 | Same thing same place across states | KIT | K10/K4 states share one grid with fixed top; heading never inside changing block | LOOK (stays: step through) | no |
| R3s.29 | No button wraps; repeated buttons same height | KIT | site.css .btn white-space: nowrap plus min-height; text beside gives way via flex-shrink | check-same-button -> confirm only | no |
| R3s.28 | No blank screen anywhere in scroll | KIT+GEN | K7 section min content check; G10 scroll-stop contact sheet lists empty stops | check-blank -> confirm only | no |
| R3i.3 | Live readout shows only a true fact | KIT | kit.readout() takes record fields only | LOOK -> confirm only | no |
| R3s.21 | No script/console errors, 404s, dead links | GEN | G1 asset manifest: build.py fails if an href/src does not exist on disk | site BROKEN -> confirm only | no |
| R3x.6 | At most one word-by-word sentence; site before had none | KIT | kit.words() registers use; G9 checks previous fingerprint | LOOK -> confirm only | no |
| R3x.12 | Progress line only on pages of six screens or more | KIT | kit.progress() self-hides under six screens | LOOK -> confirm only | no |
| R3b.6 | On a phone action pinned to bottom with price/proof; waits until after first screen | KIT | Site bar + site.js frame() (exists); film-aware version (Gremier gc.js in-film) moves into starter | LOOK -> confirm only | no |
| R3f.7 | Bottom bar fits at 360 px: label shrinks, button never | KIT | .bar .p flex-shrink; .bar .btn flex:none nowrap | LOOK -> confirm only (360x640) | no |
| R3a.6 | Fixed bar never covers content; room kept at end | KIT | body --pad-bar (exists) | site PHONE -> confirm only | no |
| R3s.22 | Tap targets >=40 px, no two overlap | KIT | site.css min-height 44 on .btn-line/.chip/.menu-btn and gap tokens; kit.items buttons 44 | site TAP -> confirm only | no |
| R3s.23 | No sideways scroll on phone | KIT | html overflow-x clip; images max-width; kit grids minmax(0,1fr) | site PHONE -> confirm only | no |
| R3s.26 | No words on words anywhere, pinned scenes included | KIT | K12/K3 slots are grid cells, never overlapping absolutes; chapter slot and headline slot never share a cell | check-overlap -> confirm only | yes |
| R3t.1 | Site declares category and follows its row of 3t | ASK+KIT | Question: category; Site.category writes meta site-category and picks K7 template and tokens | check-site CATEGORY + LOOK -> confirm only | no |
| R3t.2 | Shops: price and Add in first two screens; cards complete | KIT | K11 card always has photo, name, size, price, button; K7 shop template puts items in screen 2 | check-site BUY -> confirm only | no |
| R3t.3 | Trainer: a third of sections are picture | KIT | K7 trainer template ratio | check-site WORLDS -> confirm only; n/a for most | no |
| R3t.4 | Real footer on every page, identical | KIT | Site.full_footer (exists) | check-footer -> confirm only | no |
| R3a.7 | Every state checked on the device that shows it | GEN | G10 uses touch emulation runner for phone sheets | LOOK -> confirm only | no |
| R3a.8 | A dotted line of items never wraps | KIT | K8 kit.facts(): flex-wrap by item, separators drawn by CSS between items, nowrap per item; stacks at 360 px | LOOK -> confirm only (360x640) | yes |
| R3u.2 | Closed day or over-limit quantity gets one plain line and a button | KIT+ASK | K4 closed-day/limit line from spec closures and limits; Question: closed days and max qty | LOOK -> confirm only | no |
| R3u.3 | Price per portion beside each size when owner gave servings | OWNER+KIT | Question: servings (G2); kit.sizes computes floor(price/servings) | LOOK -> confirm only | no |
| R3u.5 | Home with no scroll film: first screen arrives in order, 1.5 s, once | KIT | K2 data-arrive pieces from kit.css/kit.js built into opening; all visible without JS | check-arrival -> confirm only | yes |
| R3u.6 | Depth on laptops: pieces move at own speeds with mouse only | KIT+ASK | kit [data-depth] gated to hover:hover; Question: pieces | LOOK -> confirm only | no |
| R3u.7 | At most one rotating word from real occasions | KIT+OWNER | kit.rot(words) full list for screen readers; words from record | LOOK -> confirm only | no |
| R3u.8 | Tilted label is this site's own shape in fingerprints.json | ASK+GEN | G9 picks unused label shape | LOOK -> confirm only | no |
| R3u.9 | Questions are rounded cards on details with + to x | KIT | kit.faq details.faq-q (exists) | LOOK -> confirm only | no |
| R3u.10 | Two or more places: list beside a map with numbered pins | KIT+OWNER | kit.map(places) in site colours; Question: places | LOOK -> confirm only; n/a mostly | no |
| R3u.11 | Page passed checks with a still where film goes before film went in | GEN | check-build runs on still-poster build first; G7 swaps film in after | LOOK -> confirm only | no |
| R3u.12 | Moving pieces not in the kit tried on a test page first | KIT | kit/test.html; new pieces added to kit only after test | LOOK -> confirm only | no |
| R3u.13 | report.md ends with Not done yet and For your call | GEN | G11 gen-report.mjs writes both headings from open blueprint lines | LOOK -> confirm only | no |
| R3u.14 | copy-pass.md holds shorter version of long lines | GEN | G3 flags lines >20 words / paragraphs >3 lines and asks one LLM pass for short versions; build uses shorter | LOOK -> confirm only | no |
| R3w.1 | Generated food shot has a real cause, one event 2-4 s, nothing floats in | GEN+EYE | G6 shot template (cause, event, end stays); G7 check-clip VANISH/APPEAR | LOOK (stays: 4 fps sheet) | yes |
| R3w.2 | Generated liquids and steam look real | GEN+EYE | G6 prompt preamble opaque/satin/thin wisps from behind + negative list | LOOK (stays) | yes |
| R3w.3 | Generated food lit from side and behind; pour stays sharp | GEN+EYE | G6 lighting preamble; G7 sharpness on paused fastest frame | LOOK (stays) | yes |
| R3w.4 | Start and end pictures right first; one clip at full quality; simple motion in code | GEN | G6 clip plan fields (stills, edges, credits, in code, trim); G7 get_cost before each call and logs tries | LOOK -> confirm only (G7 log) | yes |
| R3w.5 | No bite/chew/tear in motion unless approved | GEN | G6 banned-action list in prompts | LOOK -> confirm only | no |
| R3w.6 | Scroll film scrub ends where clip motion ends; last hold short | KIT+GEN | K3 data-end from check-clip figure written by G7 into the markup | LOOK -> confirm only | yes |
| R3w.7 | Generated places and materials look photographed | GEN+EYE | G6 Looks-real section requires a named real photograph; G10 full-size crop beside it | LOOK (stays) | yes |
| R3v.1 | Full footer same on every page | KIT | Site.full_footer (exists) | check-footer -> confirm only | no |
| R3v.2 | Menu bar lists the site's pages, same on every page | KIT | Site.header (exists) | check-menu -> confirm only | no |
| R3v.6 | Sections of different heights; never three in a row the same | KIT+GEN | K7 kit.section(size s/m/l) and G9 layout plan assigns sizes before build; Site.write asserts none three same | check-heights -> confirm only | yes |
| R3v.7 | Layouts chosen by what business has; never same twice in a row | KIT+GEN | K7 layout from kit.css (bento, zigzag, callouts...) assigned by G9 with no repeat | LOOK -> confirm only | no |
| R3v.8 | 3v effects chosen for this business, each with phone and reduced-motion version | KIT+GEN | kit.css pieces already carry phone/reduced versions; G9 compares with previous site's set | LOOK -> confirm only | no |
| R3v.14 | Three true facts under main button on home page (btn-facts) | KIT+ASK | K2/K8 kit.facts(three) required arg from spec; prefilled by blueprint R3v.14 plan | check-facts -> confirm only | yes |
| R3x.8 | Web basics on every page: skip link, one h1, focus, labels, lazy, title 60, desc 155, og, JSON-LD | KIT | K1 Site.write asserts title<=60, desc<=155, one h1, og exists 1200x630; K6 lazy by position (first picture eager, rest lazy); labels and autocomplete in K4 | check-web-basics -> confirm only | yes |
| R3x.13 | One type scale and one spacing scale | KIT | site.css tokens exist; lint rejects off-scale values in page CSS (Gremier relied on a human) | check-web-basics SCALE -> confirm only | no |
| R3r.3 | check-rules passes after last edit; fix checked on its screen | GEN | blueprint --rules writes RULES.md; check-build runs once | check-rules (final) | no |
| R3r.4 | A rule Tzvi pointed out twice has a script or line the same day | EYE | Process rule; lives in checklist upkeep (check-rule-homes) | LOOK (stays) | no |

## Summary

### Counts (242 rules)

| class | rules that need it (a rule may need two) | rules where it is the main (first) class |
|---|---|---|
| KIT | 155 | 121 |
| GEN | 100 | 73 |
| ASK | 47 | 32 |
| OWNER | 20 | 14 |
| EYE | 31 | 2 |

- Fully by construction with no human look needed (no EYE): 211 of 242. Rules that keep one final look (EYE in any form): 31; only 2 are pure EYE (R3r.2 independent reviewer, R3r.4 rule upkeep), the other 29 are generator/kit work plus a look at a generated contact sheet.
- Pure KIT 85; KIT with ASK/GEN/OWNER 69; pure GEN 43; GEN with EYE 25; ASK or OWNER only 5 (R0b.4i excluded, it is GEN).
- Rules behind a Gremier retry: 48. The retries that a script found at the end (check-fits, readable, check-film-clear, check-film-video, check-heights, check-web-basics, check-motion, check-arrival, check-opening-scroll, check-site STATE/FLOW/OPENING) all become KIT rules; the generated-media retries (orange glow, made-up label text, cross-faded clips) become GEN rules in G6/G7.
- Every check script today could become confirmation only for all KIT/GEN/ASK/OWNER rules. The 31 EYE rules keep one LOOK each, but on a generated sheet (G10) instead of a hunt.

### New kit pieces (starter) and what they cover

Blueprint stages (as in `blueprint.mjs`): 1 Facts and words, 2 Photos and media, 3 Opening, 4 Sections, 5 Site structure, 6 Prices, 7 Order, 8 Motion, 9 Phone, 10 Order details and report, 11 Finish.

- **K1 `Site.write` guards** (stage 5): assert title <= 60, description <= 155, one h1, no skipped heading levels, og image exists at 1200x630, per-page title/desc/og, meta site-category/offers/product-colour, no `!`/long dash/they-them in final text, no second contact block, one `.btn` per section, holds counted (<= 3), no external hosts. Covers R3x.8, R3s.19, R3.4, R3.13, R3b.3, R3h.21, R8a.1, R3t.1.
- **K2 `kit.opening()`** (stage 3): picture-first full-screen opening on a grid (no absolute pile): picture slot >= 60% of the screen, h1 of 2-5 words asserted, one line, one button, `btn-facts` of three, arrival built in, fetchpriority, on a phone the text block capped at 40% of the picture, headline and button on separate grid rows so they never overlap. Covers R3g.13, R3g.18, R3b.1, R3b.2, R3z.2, R3n.1, R3h.1, R3u.5, R3v.14, R5b.3, R3s.26.
- **K3 `film.js` v2 + `kit.film()`** (stages 3, 8): scroll film as real video led by the scroll (every-frame keyframe, fixed encode in G7), min 300 svh height, poster first, no word slot over the picture, chapter lines in an edge slot <= 3% area that hides mid-clip, closing words only after the end, scrub end taken from check-clip's figure, phone crop, reduced-motion last frame, phone bar steps aside during the film (Gremier `gc.js`). Covers R3h.20, R3h.24, R3h.25, R3h.5, R3h.17, R3h.3, R3w.6, R3h.1, R3u.11.
- **K4 `order.js` + `Site.order_page()`** (stage 7): the shared three-step order or booking flow: step bar, summary beside or under, Back and `#order-2` history, remove buttons, per-step checks, `role="status"`, POST to MyIsraelRental then WhatsApp with the total from `window.MIR_PRICES`, prefill (first possible day, qty 1), closed-day and over-limit line, done screen, fixed test hooks (`#st-add` etc.), gift section. The shared Add handler and basket count from `gc.js` move into it. Covers R3k.6-R3k.10, R3s.25, R3e.19, R3x.10, R3u.2, R3g.12, R0b.13, R3j.11, R3j.14, R3l.3, R3x.14.
- **K5 `site.css` v2 base** (stages 4, 9): every interactive element has rest/hover/pressed/disabled/focus/error states by selector (a new button class cannot skip them); min tap 44 px; sentences >= 14 px on phones (fix `--t-1`), 12 px for labels only; type/space scales with a lint on page CSS; one radius, one shadow, motion tokens (no linear, <= 500 ms, 100 ms stagger); no horizontal scroll; `.bar` room; reduced-motion block; `.btn` nowrap. Covers R3s.1, R3e.9, R3s.22, R3e.8, R3x.13, R3e.14, R3c.9, R3e.16, R3g.4, R3s.23, R3a.6, R3f.7, R3s.29, R3f.5, R3s.7.
- **K6 `kit.photo()` / `kit.picture()`** (stage 2): every image with width/height in an aspect-ratio slot, first picture eager with fetchpriority, others lazy by position, fade-in, `<picture>` wide/tall/ultra variants, alt required. Covers R3s.2, R3s.24, R3x.8, R3p.6, R3g.15.
- **K7 `kit.section()` and page templates** (stages 4, 5): sections declared with a size (s/m/l) and a layout from kit.css; the build refuses three of the same height in a row or the same layout twice; page-order templates per category from `playbooks.md` (what, trust, cost, action; prices before form); sections sized to fit 1280x650 (clamp padding, max-height under the menu bar). Covers R3v.6, R3v.7, R3p.6, R3.11, R3.12, R6.1, R3t.1-3, R3b.4, R3s.28, R3h.8.
- **K8 `kit.facts()`** (stage 3): dotted facts line, wraps by item, separators drawn by CSS, never mid-item, stacks under 420 px. Covers R3a.8, R3v.14.
- **K9 `kit.deal()` / price component** (stage 6): floor percent badge, struck-through separate price, button text with a number, all from `prices.json` (Gremier `price_row` does it by hand). Covers R3j.7, R3j.10, R3j.14, R3c.6, R3.14, R4.1.
- **K10 `kit.choice()` / `kit.tabs()`** (stages 4, 6): radio tiles (no select), choice drives hero/colour/order, next photo preloaded and decoded before the swap, same-place states, always a way out. Covers R3n.3, R3h.10, R3s.2, R3c.5, R3s.18, R3s.27, R3x.3.
- **K11 `kit.items()` / `kit.sizes()` / `kit.compare()`** (stages 4, 6): the one product card (photo, name, size/servings, price, same-height button, one `allows` string used by card, basket and message). Covers R3e.10, R3p.7, R3l.2, R3l.4, R3x.4, R3u.3, R3t.2, R3s.29, R3s.10.
- **K12 `kit.over()`** (stage 3): text-over-media pattern with a soft edge shade token, contrast-safe, a container for buttons, no full-photo overlay. Covers R5b.3, R3z.4, R3s.8, R3e.8, R3s.26.
- **K13 already there:** footer, menu, bar, gallery, FAQ, gift, contacts, JSON-LD (R3v.1, R3v.2, R3k.2, R3t.4, R3a.6, R3m.1, R3o.4).
- **K14 `kit.pin()`:** overlays placed by measurement inside the media element, `data-clip-ok` (R3a.3, R3c.13).
- **K15 kit.css pieces made default-safe** (arrive, depth, rot, tilt, light, fan, curtain, statement; R3u.5-9, R3v.8, R3f.9, R3a.5): each already has phone and reduced-motion versions; gate depth to `hover: hover`.
- **K16 `kit.lang()`:** Hebrew twin from `copy.json`, `dir=rtl`, Hebrew font swap, mirrored carousel (R3.6, R3e.17).
- **K17 small optional pieces:** `kit.maker()`, `kit.stat()`, `kit.band()`, `kit.map()`, `kit.offer()`, `kit.guarantee()`, `kit.proof()`, `kit.tag()`, `kit.readout()`, `kit.words()`, `kit.progress()`, `kit.overlap_card()`, `kit.taste()`, `kit.turn()`, `kit.carousel()`, `kit.sheet()` (R3e.22, R3s.14, R3b.2, R3u.10, R3c.7, R3j.1-5, R3c.3, R3s.9, R3i.3, R3x.6, R3x.12, R3z.1, R3z.3, R3x.1, R3x.2, R3e.17).

### New generator scripts and what they cover

- **G1 `site-spec` (stage 1):** `blueprint.mjs` answers become `site.json` (category, film yes/no, slug, contacts, lead time, closures, offers, kinds, product list, signature, event, ground, owner photo) read by `build.py` and every generator; also an asset manifest that fails the build on a missing href/src. Covers R0b.1, R3t.1, R6.1, R3g.18, R3k.1, R3r.1, R3s.21 and every ASK rule.
- **G2 `gen-owner-questions.mjs` (stage 1):** writes `message-to-owner.md` and `OWNER-QUESTIONS.md` from the record's gaps plus the spec (contacts per number, worries, FAQ 5-8, guarantee, offers and end dates, servings, closed days and limits, photo-to-item, similar-item choices, after-order text, stamp card). Covers R2.2, R2.3, R3o.4, R3c.3, R3c.7, R3j.1-5, R3j.12, R3l.1, R3u.3, R8.9, R3c.8, R4.1.
- **G3 `copy-lint` + `copy.json` (stage 1):** all page copy lives in one `copy.json` (EN and HE) and is linted before any HTML is written: banned phrases, punctuation and they/them, claim-needs-proof table, record-cited numbers, labels >= 3 words, closing-line rules, lines over 20 words sent once for `copy-pass.md`, h1 holds the search words and a listing name. Covers R2.1, R3.1-R3.5, R3.7, R3.8, R5.1-R5.4, R5b.8, R3z.6, R3u.14, R3l.7, R8a.1, R3c.6.
- **G4 `gen-brand.mjs` (stage 2):** from the logo and photos writes `BRAND.md` AND the `:root` tokens (one source), picks accent/ink/ground and the shop button colour with contrast measured (4.5:1 on the button, 3:1 from the ground), fonts only from the approved list and not used by another site. Covers R3x.7, R3g.1, R3g.19, R3g.11, R3c.2, R3p.3, R3e.8.
- **G5 `gen-assets.mjs` (stage 2):** numbered sheet of owner photos, duplicate drop, kind labels, hero picked by resolution, extension via `extend_photo.py`, `<picture>` variants, webp <= 600 KB, og 1200x630, posters, one grade, cut-out check, one master per item with every appearance cropped from it. Covers R3o.6, R3g.15, R3p.6, R3s.24, R3c.14, R3g.14, R3h.12, R8.1, R8.2, R3l.6, R3n.1, R3o.1.
- **G6 `gen-brief.mjs` (stages 2, 3):** writes `film-brief.md` and still briefs with every required section as a field (object list with source and end, How it really happens, Key moment, Looks real with a named real photograph, Clip plan, frame 1/middle/last) and the standing prompt text with its negative list (no orange glow, no colour cast, no text, labels or logos, no cross-fade between different objects, no bite or chew, opaque satin liquids, thin steam from behind, bright light); also the one layout sketch for a product set. Covers R3h.18, R3h.19, R3h.22, R3h.23, R8.6, R8.7, R8.8, R8.3, R3o.2, R3o.3, R3w.1-3, R3w.5, R3w.7, R8.4.
- **G7 `gen-clips.mjs` (stages 2, 3):** one API call per clip after `get_cost`, then automatically check-clip, brightness, 4 fps and 8 fps sheet, product-match sheet, text-in-image check (OCR), seam difference score against the previous clip, a try counter (stop at 2), the fixed keyframe encode for the scroll film and a loop encode for ambient video. Covers R3h.7, R3h.11, R3h.13, R3h.14, R3h.19, R3h.23, R3h.24, R3o.3, R3w.4, R3w.6, R8.3.
- **G8 `gen-prices.mjs` (stage 6):** `prices.json`, the per-unit table, percent savings (floor, against the smallest size), group-only savings, an owner claim the prices contradict found and sent to G2. Covers R3j.7-R3j.14, R0b.3.
- **G9 `gen-layout-plan.mjs` (stages 1, 4):** before any CSS: section heights (never three the same), layouts (never twice in a row), effect budget (one signature, >= 3 accents), opening-idea options from `docs/inspo` with pictures, fingerprint clash pre-check against every existing site, label shape, previous-two-sites exclusion; writes the CONCEPT.md skeleton. Covers R3v.6, R3v.7, R3v.8, R3f.2, R3g.17, R3p.3, R0b.4i, R3q.1, R7.1, R3u.8, R3x.6, R5a.7, R3f.4.
- **G10 `gen-review-sheets.mjs` (stage 11):** one command renders the six sizes (touch emulation for phones), English and Hebrew, scroll-stop sheets, the set sheet (R8.1), the one-look sheet (R3h.12), product beside owner photo, first screen beside the closest reference, effect frames at 0/25/50/75/100%. The remaining EYE rules are looked at on these. Covers R3a.1, R3a.7, R3n.4, R3f.2, R8.1, R3h.12, R3w.7, R3s.28.
- **G11 `gen-report.mjs` (stages 10, 11):** report.md with "Not done yet" and "For your call" from open blueprint lines; RULES.md through the existing `blueprint.mjs --rules` (R3u.13, R3r.3).
- **G12 `source-log.mjs` (stage 4):** every Mobbin/21st/Inspo search is logged with its source into REFERENCES.md and the CONCEPT.md fields (R3c.1, R3g.17, R0b.4i).

### The 15 rules (or groups) that would save the most retries if built in first

Ordered by how directly a Gremier retry hit them and how much of the build one piece removes.

1. R5b.3 (with R3e.8, R3s.26): text over a picture. K12 `kit.over` + K2 grid rows: phone text capped at 40% of the picture, headline box never overlapping the button, 14 px floor for sentences (fix the 13 px `--t-1`). Removes check-photo-clear, readable and check-overlap retries and the low-contrast headline/button overlap.
2. R3h.25 (with R3h.5, R3h.17): nothing covers a scroll film. K3 has no word slot over the picture; chapters in an edge slot <= 3%.
3. R3h.24: film video in sync and never freezing. K3 v2 plus a fixed keyframe encode in G7, scrub end taken from check-clip.
4. R3h.20: opening scroll at least 3 screens at 60 fps. K3 enforces the minimum height and poster-first loading.
5. R3p.6 (with R3a.4, R3c.13): sections and photos fit 1280x650 and 1536x753. K7/K8 sizing rules and K6 slots, so no section can be taller than the screen.
6. R3v.6 (with R3v.7): three sections the same height. K7 `kit.section(size)` + G9 plan, with a build-time assert.
7. R3x.8: web basics (titles 60, descriptions 155, far images lazy, one h1, og size). K1 `Site.write` assertions + K6 lazy by position.
8. R3s.2 (with R3h.10): a lazy photo making a choice jump. K6 aspect-ratio slots and K10 preload-and-decode before the swap (lift Gremier `home.js`).
9. R3u.5 (with R3h.1, R3g.13): the first screen arriving and the opening full-screen. K2 builds the arrival, the 100svh stage and the 2-5 word headline rule in.
10. R3e.9 and R3s.1: buttons with hover and pressed states. K5 selector-level states so a new button class cannot skip them.
11. R3k.7 (with R3s.25, R3g.12, R3k.8, R3k.10): the order flow and its test hooks (`#st-add`). K4 shared order.js with the same ids on every site (Gremier copied 168 lines).
12. R3a.8 (with R3v.14): dotted facts line wrapping. K8 `kit.facts`.
13. R8.3 (with R3o.3, R3o.2, R3w.2): generated stills with an orange glow or made-up label text. G6 standing prompt and negative list, G7 OCR and colour-delta gate.
14. R3h.18, R3h.19, R3h.23, R3h.7 (with R3w.4): clips that cross-fade between different objects, and extra generations. G6 object-list and clip-plan fields required; G7 check-clip, seam score and a two-try limit after each clip.
15. R3s.19 (with R3.4, R3.13): per-page title/description/og and punctuation lint at write time (K1 + G3), so no late head-tag and copy fixes across every page.

### Suggested order of work

1. K5 base CSS fix, K1 guards, K6 photo, K8 facts: small, every new site gets them at once, fixes items 5, 7, 8, 10, 12.
2. K2 opening + K12 over, then K3 film v2: items 1-4, 9.
3. K4 order flow (item 11), K7 + G9 section and layout plan (item 6).
4. G6/G7 generation (items 13, 14) and G3 copy lint (item 15).
5. G1 site-spec so blueprint answers feed all of the above; G10 sheets last, replacing the remaining EYE hunts.

Scope note: per Tzvi's rule that an approved site is never altered, each piece is added to the starter as something a new build takes; existing builds keep their own copies.
