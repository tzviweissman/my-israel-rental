# Rules for AI-built pages

Written 23 Sep 2026 (Tzvi: "create rules so we can get the best output for users").
The rulebook the page generator follows when it builds a business page, and the
automatic check that throws away any page breaking it.

- Builds on `docs/ai-page-builder-spec.md` (the vocabulary, P2 dials, P4 quality
  floor, P4a clarity floor, P7 brief). Where that document says what the builder
  IS, this one says how a page it makes must be BUILT and WRITTEN.
- Draws on what we already learned: the three practice pages (`scrollcraft/builds/`:
  Blazin' Boards, Lechem Emek, Michal Simkin, and `scrollcraft/FINGERPRINTS.md`),
  the design-kit skills (scroll-craft, taste-skill, page-conversion-review,
  design-loop, visual-diff), the project's frontend skill, and the session
  lessons on generated video. Sections 5a to 5c, 8 and 9 are where those live.
- The check: `backend/utils/page_rules.py` (`check_composition`, `check_options`, `check_unique`).
  Every rule below marked with an id in `code` is enforced there, with the same id.
- The golden set: `backend/tests/test_page_rules.py`. One business per playbook with
  a page that passes in English and Hebrew, and one case per way of failing.
  **When a bad page slips through in real use, it becomes a case there.** That is
  how these rules get better over time.

**Cleaned 22 Oct 2026 (Tzvi).** Each repeated rule now has one home and the
other places say "see Xn.m". Where two rules disagreed, the newest decision won;
the lines dated 22 Oct 2026 in `hero`, `urgency`, 3g.3, 3g.13, 3j, 3o.1, 5b.2
and section 8 are those decisions.

**How a rule is added, so it is right the first time (Tzvi, 27 Oct 2026: "can we make sure our rules are always correct the first time?").**
RS Modest's opening took three rounds: a crop that zoomed in (3c.12 allowed a crop with `data-crop-ok`),
then a blurred frame round the photo that was our own idea, written up before Tzvi saw it ("a weird grey
area"), and only then the extended photo. Each round was a rule or fix decided from a description. So a
new rule, or a fix that will become one, goes through these steps before it is written down:

1. **Find every line it touches**: search this document, `docs/rules-checklist.md`, the skill and the
   scripts for the same subject. The new rule changes those lines in the same edit, so it has one home
   and no two lines disagree.
2. **Show it working before writing it**: a before and after picture on the site that caused it, at a
   laptop and a phone size. Tzvi says yes to the picture, not to a description. A fix that is our own
   design choice, not what Tzvi asked for, is a proposal until he has seen it.
3. **Try it on every live site it covers** (`frontend/public/pages/pages.json`): run its check, or look,
   on each, and list the ones that fail. Fix them, or write why they are exempt. A rule that fails sites
   Tzvi is happy with is wrong, not the sites.
4. **The check must catch the original mistake**: run it on the before state (it fails) and the after
   state (it passes). A check that passes both is not checking the rule.
5. **Write how, not only what**: the steps, the tool and settings, a worked example folder, and what was
   tried and rejected with why, so the next build does it right without rediscovering it.
6. **The same day**: the checklist line with its check, the skill's copy (`full-rules.md`), the build
   order (0b) if it changes when something is done, and a memory note.

When a new kind of case still finds a gap, the rule is fixed at its one home, never patched beside it.

The AI is not switched on yet. When it is, it receives this document's rules as
its instructions, and nothing it makes reaches an owner without passing the check.

---

## 1. The job, in one line

Arrange what the business told us into the clearest page for someone deciding
whether to use them, in their language, without adding a single fact of our own.

## 2. What the AI gets, and the only facts it may use

- **The brief** (P7b; Tzvi rejected most of it on 24 Sep 2026, see the spec's
  "Tzvi's verdict on the six questions": the generator decides what leads, the
  look and the main button, and the owner is asked for facts only): what they show, what visitors should do, who it's for,
  where their prices sit, up to two strengths, their 200-character note.
- **The business**: name, description, areas, hours, languages, founding year,
  licence number, kosher certificate, verified, review count and average.
- **Their listings**: titles, descriptions, prices, photos.
- **Their photos**: cover, logo, listing photos. Referenced, never copied or linked.

**Never re-ask what they already told us** (Tzvi, 6 Oct 2026, playing a
new owner: "all of these questions can be answered from looking at her
page"). Before asking anything, read everything they have given: the
business record, every listing and its tiers, their hours, their photos and
the words on their flyers. A question whose answer is anywhere in that is
never put to them, not even as a confirmation. Ask only what is missing (a
price they left out, their languages, a qualification a claim would need,
photos of themselves) or what two of their own sources contradict.

**What the owner is asked** (Tzvi, 6 Oct 2026, playing the owner of
KasherMyBnb: "dont ask a business that question"). Only facts about their
own business that the record leaves open or contradicts: where they work,
how far ahead to book, who books them, their languages. Never anything
about how we build: no tools, credits, image sources, plans, vendors or
design choices. When our tooling hits a wall (a generator refuses, credits
run out), we solve it or build with what we have, and the owner never
hears about it.

**Anything not in that list does not go on the page.** Not a number, not a
"since 1998", not "fresh every morning", not "trusted by families". If the owner
did not say it and we cannot prove it, it is not true as far as the page knows.

## 3. Hard rules (checked: a page breaking one is thrown away and remade)

Never patched. A patched page is one nobody chose (P1, P4a).

| Id | Rule |
|---|---|
| `schema` | Only our blocks, variants and dials. No links, no code, no styles. |
| `language` | Everything written is in the page's language. A Hebrew page has Hebrew in every line (their business name may stay as it is). |
| `hero` | A headline at the top that says **what the customer gets** (their result, in the owner's words; Tzvi, 22 Oct 2026). Where the business is goes in the one short line or the small label. At most 10 words, with at most 20 words under it, are ceilings only: the first screen follows 3g.13, the single home. Never just their name again, since the page already shows it. One hero only. |
| `congruency` | The headline or the line under it names something they actually sell, in the words of their own listings. A place name alone doesn't count. |
| `numbers` | Every number on the page comes from their own words or our facts (their prices, founding year, review count). |
| `claims` | A claim needs its proof or the owner's own words. **Kosher** needs a certificate, and is said only on a food business. **Licensed** needs a licence number. **Verified** needs verification. **Reviews, stars, "customers love"** need reviews. **Years, "since", "established"** need a founding year. **English** needs English among their languages. Only the owner's own words can back **best, #1, leading, award, the only, cheapest, guarantee, insured, 24/7, emergency, fresh daily, delivery, trusted by, thousands of**, or anything medical (**cure, heal, weight loss, treatment for**). |
| `urgency` | The single home of the no-fake-urgency rule. Never: "only 3 left", "hurry", "today only", "booked 11 times", "limited time", "don't miss", "ends soon", or any countdown without a real end date. Nothing we hold is a real, current count. "Open only on Fridays" is a fact, not urgency. An offer that really ends on a date shows that date ("Until 31 Oct"). Standing discounts (students, soldiers, olim) are not time-limited and need no date (Tzvi, 22 Oct 2026). |
| `generic` | No sentence that could describe any business: "welcome to", "look no further", "one-stop shop", "passionate about", "quality you can trust", "your satisfaction", "world-class", "top-notch" (and the Hebrew equivalents). |
| `punctuation` | No exclamation marks. No long dashes (the site's copy rule). No words in capitals unless it's their name. |
| `structure` | At most 10 blocks. No doubled contact, facts or gallery. No two dividers in a row, and don't end on one. |
| `signature` | At most one scroll section per page, with its material. The size ladder needs one of their store listings with at least 3 products they measured. One signature, one peak: see 5a.7. |
| `action` | What the brief asks visitors to do has a place to do it: book or order needs the services block, message needs contact, visit needs the facts (hours, address). |
| `images` | Only their own photos, and only ones that exist. A photo gallery needs at least 3 photos. Full-bleed imagery needs a cover photo. |
| `prices` | Loud prices only when there are prices, and never on a premium or quote-based brief. A premium brief is never packed. |
| `playbook` | The category's lead block comes first and its must-have blocks are there (section 6). |

Three options (P7d, `check_options`; **only for the automatic page builder**: a
hand build picks one direction itself and says why in one line, 3c.1): each
passes on its own, and **they really differ**. Every pair differs in at least two dials or in the order of blocks, and
no two share a headline. Three near-copies is one option shown three times.

**Every page is its own** (`check_unique`; Tzvi, 23 Sep 2026: "not every page
should have a rolling jar, each should be unique"). A new page differs from
each of the last ten live pages on at least 4 of the 6 FINGERPRINTS dimensions
(the fingerprint registry rule, `scrollcraft/FINGERPRINTS.md`): what leads, the
order of sections, the hero's shape, imagery, type, and density. This is the one
number for pages we build by hand; the automatic page builder, whose block
library has fewer moves, asks 3 of 6 (`MIN_FINGERPRINT_DIFF` in
`backend/utils/page_rules.py`). (3g.17 adds that no effect is
reused from the last two pages.)

## 3. (cont.) The sections every page has (Tzvi, 6 Oct 2026)

"Each page needs a dramatic hero, feature section, cta section, faq question
which you can ask them to send, and social proof if they have."

1. **A dramatic hero.** The first screen is the page's boldest moment: their
   product or setting full-bleed, the headline at display scale, strong
   contrast. Never a small card floating on a quiet picture. It still answers
   the four questions (what, where, why trust, what next), within the limits of
   3g.13, and for a film opening 3h.
2. **A features section.** What they offer, laid out so it can be scanned:
   one item per service or product, each with its price and what is included,
   in their words.
3. **A call-to-action section.** A section of its own near the end whose only
   job is the one action, with the price or proof beside the button. The
   button in the hero does not replace it.
4. **An FAQ, in their words.** We never write the answers. The owner is asked
   to send the questions customers ask them, with their answers; to help,
   we suggest the questions that matter in their category (section 6). Until
   they send them, the page has no FAQ section at all (never an empty one or
   a made-up one), and the FAQ is listed as a content gap.
5. **Social proof, only if real.** Reviews on our platform, or testimonials
   and reviews the owner sends with the customer's name and permission. If
   there are none, no section, no placeholder, no "trusted by"; the owner is
   asked whether they have any.

The owner's message after a build asks for the FAQ and any reviews in one
plain request (it is a question about their business, so it is allowed).

**How the FAQ is asked** (Tzvi, 6 Oct 2026: "show example questions relevant
to their business"). The request carries 5 to 8 example questions written
for this business, never a generic list. Each one comes from something real:
a price or fee they listed, an exclusion or limit in their own words, their
areas, their busiest season, the people who book them, or what a customer in
their category must know before booking. For KasherMyBnb that meant asking
about the travel fee outside Jerusalem, booking before Pesach, whether a
guest must be home, frying pans and non-steel pots, dishwashers and glass
stovetops, and what the guest receives afterwards. The examples are prompts
only: the owner picks the ones customers really ask, answers in their own
words, and adds their own. Nothing reaches the page until they answer, and
any question they skip is left off.

## 3a. Look through it, fix it, then show it (Tzvi, 5 Oct 2026)

**One command runs every check** (24 Oct 2026): `node scripts/check-build.mjs scrollcraft/builds/<folder>` runs check-site, check-fits, check-motion and readable on every page, then check-concept, check-fingerprints and check-rules. A site is shown or published only after it passes. Builders start from `docs/build-brief-template.md`.

"In the future look through the page the AI creates before showing the
business owner and implement the fixes and then show the finished product."

The owner never sees a first draft. Every page passes this review before it
reaches them, and the review is done on the **rendered page**, not on the
composition:

1. **Render it** the way a visitor meets it: laptop and phone width, English
   and Hebrew, normal and reduced motion. A scroll page is walked top to
   bottom at several positions per section, never judged from one screenshot.
2. **Look at every screen** for anything that reads as broken or unfinished,
   even when no rule names it. Caught on L.A. Cholent: a section that went to
   an empty grey panel between two moments and looked like a failed load;
   a heading sliding under the next panel; a dial landing off the object it
   belongs to while the section scrolled away; text over the brightest part
   of a photo.
3. **Measure** what can be measured: contrast on the rendered frames, no
   sideways scroll, nothing waiting at opacity 0, the hard rules above.
4. **Fix every finding and render it again.** Repeat until a full pass finds
   nothing. A fix is checked on the screen it was for, not assumed.
5. **Only then show the owner**, with the finished page and a short note of
   what was fixed. Anything that could not be fixed (it needs their content,
   their decision, or a real device) is said plainly, never hidden.

**Build rules that stop these defects being made in the first place** (from
the L.A. Cholent fixes, 5 Oct 2026). Each one is a defect that shipped to Tzvi
once:

| Rule | The defect it prevents |
|---|---|
| **Anything placed on a spot in a photo or video is placed by measurement, never by eye.** Find the object's position and size in the real frames with a detector (circle finder, edge or colour match) at several points through the clip, and drive the overlay from that measured path. | The knob landed beside the slow cooker's dial instead of on it. |
| **An overlay that has to stay on moving media lives inside the same element as the media**, positioned in that element's own percentages. Never chase a moving picture with script while the page scrolls: the browser moves the page a frame before the script runs, so the overlay trails behind. | The knob drifted off the dial as the section scrolled away. |
| **If the camera moves, steady the clip on the spot before building on it.** Find the spot in every frame and warp the clip so it never moves, then fix the overlay to that one point. Never key an overlay to the video's playback time: the frame on screen lags the time the browser reports, by a different amount on every machine and screen size. | The knob sat on the dial on the build machine and beside it on Tzvi's wider screen, because it followed the clip's clock rather than its picture. |
| **Nothing moves without a reason.** This governs ambient background clips and ordinary sections; a 3h film opening follows 3h instead. A clip behind text holds still except the subject (steam, a pour); no drift, breathing zoom or shifting in and out. Freeze the frame and mask the motion to where it belongs. | The pot screen "shifted in and out" while only numbers changed. |
| **Text never re-wraps while its container animates.** A column that widens, narrows or slides keeps its words at a fixed width set for the narrowest it ever gets, or the words fade between states; they are never reflowed live. | The from-scratch words jumped between lines as the panel widened. |
| **No in-between state may look unfinished.** Every transition is checked at its middle, not only its ends: when content leaves an area, the area goes to the page's own ground (or the next content arrives), never to a bare panel. | The from-scratch side became an empty grey strip mid-scroll. |
| **Text over imagery follows 5b.3**, and is also checked on the narrowest screen. If a later panel slides over a column of text, the text column is narrowed so it is never covered. | Headline text slid under the widening panel; a line sat on the bright steel of the pot. |
| **A section that holds the screen still (pinned) is designed to fit its content at 1280x650** (the shortest common screen; the six sizes are in 3p.6). Anything taller than the screen is cut off, because the held screen cannot scroll. Size its contents to the screen height (fewer lines, smaller type, two columns). If it truly cannot fit, it plays as the page scrolls without holding the screen, and it is still the page's signature (5a.7, 3f.2). The last section, where the order is, is never held. This is the single home of the held-screen rule; 3c.12, 3f.3 and 3p.6 point here (Tzvi, 22 Oct 2026). | "Turn it to your size" was cut off on Tzvi's 1536x753 laptop; the chores list and the "Choose your size" button ran off the bottom below about 820px. |
| **A line of items separated by dots never wraps.** If it might wrap, stack the items instead; a wrapped dotted line starts with a stray dot. | The price, kosher and area line under the button wrapped with a dot at the start of its second line. |
| **Something fixed to the screen (a bottom bar) never covers content.** Content that can sit under it gets room for it. | The phone order bar covered the last two lines of the "Lid on. Low." screen. |
| **A label never covers the thing it labels.** Where a card names a spot in a picture, work out where that spot lands on screen once the camera settles, and if the card would sit on it, the card takes the other side (right on a laptop, top on a phone) for that spot. | On KasherMyBnb the "Oven, with racks" card sat on the oven on a phone (6 Oct 2026, caught in review). |
| **A caption stays up until the next one replaces it.** While the camera travels between two spots, the last card stays; the screen is never left with no words. | KasherMyBnb's first draft showed bare kitchen between stations. |
| **A payoff is seen where it happens, on every device, and from its start.** Anything that builds to a moment (a counter, a clock, a progress line, a price counting up) is on screen from the moment it starts counting and is checked at its start and its finish on a phone and a laptop. Whatever hides a bar or a button must never hide the thing whose finish the visitor is meant to see. | Michal Yodaiken's session clock ran to 30:00 on a laptop, but on a phone the bar holding it slid away just before it got there, because the bar left with its button (7 Oct 2026). |
| **Every state is checked on the device that shows it.** A look that depends on the device (hover only, touch only, short screens, phone bar on or off) is checked, screenshotted and recorded as that device: touch emulation for phones, never a narrow desktop window. | Michal's preview video showed outline buttons no phone ever draws, because it was recorded as a narrow desktop (fixed in `record.mjs`, 7 Oct 2026). |
| **Two rules that touch the same element are checked together.** When one rule changes an element (hide the bar's button over the booking section), check what else lives in that element and keep it. | The "no second button" rule took the session clock with it. |

**And checked by a script, every time:**

- **Overlays:** for every overlay meant to sit on something in a picture,
  hide the overlay, screenshot, find the real spot in the screenshot with the
  detector, and measure the gap. Do it at several scroll positions and at the
  six sizes of 3p.6; more than 4px off fails the page. Comparing the overlay with the page's own numbers is
  not the check, because those numbers are what can be wrong. A screenshot that
  "looks right" is not the check either.
- **Cut off:** for every held screen, at several scroll positions, find any
  visible text, button or control that sticks out past its edges. Run it at
  the six sizes of 3p.6 (the script may add more). Anything cut off at any
  size fails the page. The short laptop height (1280x650) is not optional: the
  default 900px-tall test is exactly the screen that hides this.
- **Phones as phones, and every payoff at its moment** (Tzvi, 7 Oct 2026):
  see the payoff, device-state and two-rules rows of the table above. Phones are
  checked and recorded with touch emulation (`record.mjs` does it for any width
  under 600).

## 3b. The category checklist (from the Inspo study)

Every page, before anyone sees it, is held against what the best real sites
for its kind of business have in common (the "Category study (Inspo, Sep
2026)" section of `docs/ai-page-builder-spec.md`, and the matching recipe in
`backend/utils/page_recipes.py`). A hand-built or scroll page is held to this
as much as a generated one: the L.A. Cholent page was built without it and
failed four of the six until it was applied (Tzvi, 6 Oct 2026). Each failure is
fixed using only the business's own words and facts.

1. **The first screen answers all four questions:** what it is, where, why
   trust it, what to do next. The line under the name says plainly what you
   get (for food, it names the food and how it arrives, not a slogan). What
   the first screen may hold is 3g.13, the single home.
2. **Proof touches the main button:** the price, the credential (a kosher
   certificate, a licence, years in business) or the rating sits right beside
   or under it, never only in a section further down.
3. **One solid ACTION per screen.** The header button and the phone bar repeat
   the same action; over a hero that already shows a solid button the header
   button is outline. Everything else is an outline, a link or a small tile. Wording and destination: 5b.2.
4. **With few photos, facts carry the page:** a list of what they offer, the
   key facts, nothing padded.
5. **For a place, hours and where come before the description.**
6. **On a phone the action is pinned to the bottom** with the price or the
   proof beside it, from after the first screen until the section where you
   order.
   If the bar also carries something that runs with the scroll (a counter,
   a clock, a progress line), the bar is there from the very first screen
   and only its button waits (the payoff row of the 3a table).

For a food business also: **a kosher certificate is a small labelled band
just after the opening**, never crowding the button and never only at the
bottom. **The certificate is stated at most twice on the page, as a sentence
or a band** (the single home of the kosher count; Tzvi, 22 Oct 2026). A small
identical kosher tag on items (3s.9) does not count toward the two.

The page goes to the owner only when all six (and the food rule, where it
applies) pass, with the review in §3a.

## 3c. From the design and persuasion study (Tzvi, 7 Oct 2026)

Six videos Tzvi chose, watched frame by frame: AI design with and without
real references, the psychology of habit, premium e-commerce, beginner UI
mistakes, a product page taken from 2% to 7%, and Claude making video in
code. Each rule names what it prevents.

1. **References first, always.** Before designing, search every source we
   have: Inspo, Mobbin and 21st, each time (Tzvi, 7 Oct 2026: "also look at
   Mobbin and our other inspo sources so we have many options, and so you can
   see how similar business categories built their sites"). Look first at how
   businesses of the same kind built theirs (trainers for a trainer, bakeries
   for a bakery), then keep 3 to 5 real screens and write down in CONCEPT.md
   which ones were used. Take their structure (what sits where, what is
   beside the button), never their look; the palette and type come from the
   business. Without the business's own colours a reference gets cloned.
   **We choose** (Tzvi, 7 Oct 2026: "you always choose a button function or
   arrow or different types of features section by looking at our Inspo skill
   and Mobbin and 21st"): the builder picks from what the research found for
   this kind of business and says in one line what was picked and why. No
   options page is put to Tzvi or the owner unless asked for (section 8a).
   **Every piece is searched fresh for that build, 21st included:** see 3g.17,
   the single home of that rule.
   *Prevents: the page every AI makes from memory, and the flat page with
   nothing that reacts.*
2. **No AI default look.** Cream ground with a serif headline and one
   italic word is banned unless the business's own brand is exactly that.
   It is the combination that is banned: an emphasised word on
   another ground stays allowed, set apart by weight or style and not by the
   accent colour (3g.3; `docs/page-builder-design-rules.md` 3.2, 3.4 and
   Part 10 apply the same rules to generated pages).
   Sections must separate: at least one section on a contrasting ground (a
   dark band, their brand colour), not only hairlines between near-identical
   blocks. *Prevents: "anyone landing on this would know it's AI".*
3. **Proof sits where the worry is.** Every worry the owner names ("will it
   arrive hot", "do I need to be home") gets its answer right beside the
   button or the price it belongs to, in their words. Never a wall of
   one-line reviews. The strongest proof is the hardest to fake: a
   certificate, a licence, a named review, a specific guarantee.
4. **Show it in use.** Lead with the owner's photo of the product or service
   being used, served or delivered, not the item alone on white (the
   "imagination gap"). What may be generated is the
   policy at the top of section 8 (best made by editing their own photo,
   kind 2); food in motion is 3o.1.
5. **Choices are visible.** Sizes, flavours and tiers are tiles to tap,
   never a dropdown. A short note may say how each differs, in the owner's
   words. "Most popular" appears only when the owner says so (Tzvi, 22 Oct
   2026). Bundles show their saving as 3j says.
6. **The button says what happens next.** "Order, delivered Friday",
   "Book a time", never just "Submit" or "Buy now", and the same words
   everywhere (5b.2). Under it, a row of up to three icons with the
   owner's real guarantees: delivery area, kosher, returns, a guarantee.
7. **Offers are contained.** A time-limited offer shows its real end date; a
   first-order offer says so. Standing discounts (students, soldiers, olim)
   are not time-limited and need no date (3j.4). "Ends soon" with no real
   date stays banned (`urgency`). No permanent sale, never a discount on the
   thing they are known for unless they say so.
8. **Say what happens after the order.** If the owner tells us about the
   first days (reheat before serving, the first lesson is gentle, a stain
   lightens after a day), the page and the order-tracking page say it before
   it happens. Whoever names that moment first decides how it is read.
9. **One system, quietly.** One corner radius, one icon set (lucide), one
   soft shadow (3s.3), no two-colour gradients, no arrows or outlines that do
   nothing. Every button visibly reacts when pressed and shows when it is
   working. *Prevents: the beginner look.*
10. **Come-back features only where they help the customer.** Saved items,
    reorder, order updates and an owner's setup checklist, yes. Never fake
    urgency (the `urgency` rule, section 3), endless feeds, random rewards, or streaks that guilt people.
11. **Video is drawn, then checked.** A preview video is rendered frame by
    frame (each frame a function of its time), never recorded live, so it
    never stutters and comes out the same every time: the skill's
    `record.mjs` does this (rebuilt 7 Oct 2026) and writes a contact sheet.
    Before any video is sent, look at the sheet, fix, render again. Anything
    paid (generated stills or clips) waits for the owner's yes on two or
    three style frames.

12. **Everything fits on one screen** (Tzvi, 7 Oct 2026, from
    woodwrights.co.nz). Wherever a visitor stops scrolling, each photo is
    seen whole together with its words and price, and no block is taller
    than the screen. Held screens: 3a. The measured check, the six screen
    sizes and how to cap photos and headlines: 3p.6.
    *Prevents: seeing half a picture and scrolling to find what it is about
    (Michal Yodaiken's 1-to-1 tile was 940px tall).*
    **A big photo keeps its own shape** (Tzvi, 26 Oct 2026, RS Modest
    Activewear: "the wow page is too zoomed in so i cant see many details").
    A photo is never forced into a box of a very different shape: a tall
    photo of the product in a wide opening showed only a slice of it.
    **Extend the photo to the screen's shape; never zoom, never frame it**
    (Tzvi, 27 Oct 2026: "we cant make it fill the screen and not zoom in?",
    then "you should always do this"). A framed photo with a blurred copy
    around it read as a grey area, and filling the screen by cropping cut
    the outfit in half; both were taken back. Done every time a full-screen
    or large photo has another shape than its box:
    1. Pad the photo to the box's shape with its own edge colour (the
       product where it should sit, empty space where the words go), so
       the generator only has to continue plain wall and floor.
    2. Ask an image model (nano_banana_2, 2k, the canvas's aspect ratio) to
       fill only the padded area with more of the same room, no new objects.
       The outpaint tool is not used: it re-made the whole scene twice
       (moved the bag, added plants, cut the leggings).
    3. Paste the original photo back over its own place with a feathered
       seam (align with SIFT if the model moved it), so the product's pixels
       never change. Look at the seam at full size.
    4. One version per screen shape: wide (16:9) and extra wide (21:9; stretching only the plain wall is fine) for
       laptops, tall (9:16) for phones, chosen with `<picture>`.
    The steps are one script, `scrollcraft/starter/extend_photo.py` (`pad`,
    then the fill, then `paste` and `ultra`; it refuses a fill in which the
    model resized or moved the photo). Done at build-order step 2 (§0b),
    before the first draft.
    Worked example: rs-modest-activewear/gen/wide-brief.md. A photo of a
    real place (the owner's store, a venue) is not extended, since that
    invents a place that does not exist: it keeps a crop that shows its main
    thing and is marked `data-crop-ok`. check-fits fails a big photo that
    shows under 70% of its width or height, the opening's included.

**Three more questions for the owner**, asked with the FAQ request
(section 3, cont.) and only when their page does not already answer them:
- What do customers worry about before they order or book?
- What happens in the first days after they get it?
- Do you have a photo of it being used, served or delivered?

**Nothing cut off, and clean cut-outs (Tzvi, 12 Oct 2026).** Every label,
number, ruler and photo sits wholly inside the section that holds it at every
screen size; something that flies in from off-screen (`data-clip-ok`) may be
cut only while it travels, never once landed. Checked on every page with the
skill's `scripts/clipped.mjs` (the six sizes of 3p.6 and more, the whole scroll; the cut-off check for
held screens is in 3a). A cut-out photo
is one subject: no stray garnish sliced off at the photo's edge, no specks, no
pale fringe; cleaned with `scripts/cutout.py` and checked with `--check`, then
looked at on a dark and a light ground. Defects that made these rules: the
"10 cm" under Blazin' Boards' growing board was sliced in half, the landed
board ran 42px off a short laptop, and the board photo kept a cut-off olive.

## 3e. From the twelve UI videos (Tzvi, 8 Oct 2026)

Twelve YouTube talks on landing pages, product pages, UI craft, motion and
"addictive" apps, watched as video (frames every 3-10 s, frame strips for
motion), the transcript only alongside. Tzvi approved every rule below and the
two proposals at the end ("add all the rules and go with your proposals").
Per-video notes, timestamps and key frames: `docs/ui-videos/notes/`; the full
draft with sources: `docs/ui-videos/draft-rules.md`.

**Order and the first screen**
1. Sections follow the visitor's questions in order: what is it, can I trust it,
   what does it cost, what do I do. Menu and prices come before any enquiry form.
2. A small label above the headline says who it is for and where ("Home-baked
   buns, Ramat Eshkol"). On the first screen the label counts as the one
   short line of 3g.13 (so the first screen has the label or a line under the
   headline, not both).
3. Each section has one job and ends on the same single action (label and
   destination: 5b.2).
4. The headline says what the customer gets, not what the business does.
5. The page's words match what sent the visitor there (the ad, the WhatsApp
   message, the listing).

**Buttons and prices**
6. The button says what happens, with a real number when there is one: "Order 4
   buns, ₪55", "Show 12 sessions".
7. Price, unit and action sit together; packages are tiles with name and price.
8. Every word is at least 12 px, and a sentence on a phone at least 14 px, at
   4.5:1 contrast (3:1 for large text), measured by `readable.mjs`. Button text
   is at least 4.5:1 on its fill, measured, never judged by eye (a bright
   green measured 1.8:1 in one of the videos).
9. Every button has rest, hover, pressed and disabled states; every field has
   focus and error states with a message; every action shows a confirmation
   ("Sent", "Copied"). Anything hover-only has a visible version on phones.

**Cards, type and spacing**
10. A card has one reading order: the name largest, one emphasised fact
    (usually the price, in the main text colour, bold and large; the accent
    colour is for the main button only, 3g.3), the rest lighter. Card photos
    are big, never thumbnails.
11. Design for the worst content: long names truncate; an icon on a photo sits on
    a solid circle or a gradient, never straight on the picture (text on a photo: 5b.3).
12. Words sit on the picture with a soft edge shade (5b.3, the home of this
    rule); a plain strip under the photo only where the picture is too busy.
13. Spacing on a 4 px grid: related things close, unrelated things clearly apart;
    items of one kind identical (icon size, row height).
14. One body family in up to three weights, at most six text sizes; headings
    tightened about -2% with 110-120% line height. Test Hebrew before the
    tightening applies to it.
15. One corner radius for images and buttons alike.

**Motion**
16. Never linear easing: ease-out or a spring. A transition grows from what was
    tapped and finishes under 0.5 s.
17. A carousel shows a sliver of the next card, and every swipe has visible
    buttons or dots, mirrored in Hebrew. A bottom sheet closes by swipe-down AND
    a close button.
18. An ambient background video only (a film opening follows 3h, not this rule):
    camera locked, subtle, a seamless loop of about 6 s, with a still poster and
    a still for reduced motion.

**Flows and coming back (the honest form of "addictive" design)**
19. Every flow has a visible end: a clear "Done" screen after ordering, lists that
    end, "Save and finish later" on long forms.
20. Progress only with true numbers: "Step 2 of 4", "Session 6 of 12", "5th loaf
    free, you have 3" (only for a loyalty offer the owner really runs).
21. A reminder only for something real the customer left unfinished (an
    unconfirmed booking, a saved order), sent once, with an off switch.
22. The owner stays visible as a person: name, real photo, direct WhatsApp.

**How we work**
23. After building, review a screenshot section by section, a reference for each
    point, rank the top five fixes, then keep or reject each with a reason.
24. Keep the source link with every Mobbin, Inspo and 21st reference in CONCEPT.md
    (3q; the searches: 3g.17).
25. Components from 21st or from generated code get a polish pass for hover,
    focus and pressed states before they ship.

**Rejected, as shown in the videos (see also the `urgency` rule, section 3):** countdowns, "limited time", "offer ends
soon", "selling fast", "only 13 left", "3 spots open" (unless it is the owner's
real availability); strike-through prices never charged; "$80 of value" gifts;
a monthly price shown while billing quarterly; intro prices that renew higher;
invented counters; "Trusted by 10k+", logo walls, "As seen on", award laurels;
invented "Best match" or "Popular" badges; stars and counts without real
reviews; sweepstakes; random rewards; streaks; endless feeds; likes,
leaderboards, fake unread badges; slide-to-confirm on ordinary forms.

**Settled with Tzvi:**
- Scroll: one video says never hijack the scroll. Our pinned sections stay (each
  fits one screen and never traps the order section), but the scroll's own speed
  and direction are never taken over.
- Backgrounds: one video builds from stock and AI backgrounds only. Ours follows
  the generated-media policy at the top of section 8; food in motion follows
  3o.1; people shown as their staff or customers and their actual premises stay
  real.

## 0b. The build order, learned from the last builds (Tzvi, 15 Oct 2026)

Tzvi: "i want you to learn from the mistakes that you make when creating
pages so that you can create them faster". Each step below is a mistake from
The Gift Boutique (13 to 14 Oct) or Michal Balloons (14 to 15 Oct) that cost
a round with Tzvi. Done in this order, none of them happens.

1. **Read the record, then the real address.** Use the business's actual
   slug from the live record when publishing (Michal Balloons was first
   published under a made-up slug the site would never serve).
2. **Look at every photo first.** Flag duplicates, screenshots, small sizes
   and overlays at once, and ask the owner for more in the same message
   (Michal's only photo was uploaded twice and was a phone screenshot; the
   Gift Boutique's were 300 px crops from a flyer).
   **Start building the moment the questions go out** (Tzvi, 17 Oct 2026,
   on Chicken Munch: "start building the website so their wait is shorter
   when they give you their answers"). Build from what the record and
   photos already give; leave out the parts only their answers can fill (no
   placeholders, no "coming soon"). Ask only for what is needed, or for what
   would make the page significantly better, such as more photos. When the
   answers arrive, they slot into a page that already passes its checks.
   **Check the shape of every big photo now, not after the first draft**
   (Tzvi, 27 Oct 2026, after RS Modest's opening was cropped, then framed,
   then extended: "make sure we know how to make a page for it the correct
   way the first time"). For the opening photo and any photo shown
   full-screen or large, compare its shape to a laptop (16:9) and a phone
   (9:16). If it differs, extend it before the first draft with
   `scrollcraft/starter/extend_photo.py` (§3c.12): `pad`, one nano_banana_2
   fill per shape (about 1.5 credits each, named with the cost in the
   owner's first message), `paste`, `ultra`. The page is built on the
   extended pictures from the start, so it never ships zoomed or framed. A
   photo of a real place is not extended: it keeps a crop and `data-crop-ok`.
3. **List every live-site action the build needs and ask for all of them in
   one go**: loading products, turning on delivery, settings. A blocked write
   discovered after a push left the Gift Boutique page showing one ₪10 item.
   **Check the listing's prices and currency against their own menu first**
   (Chicken Munch, 17 Oct 2026: one "premium chicken box" at 140 USD that was
   not on his shekel menu card). Flag any mismatch in the first message, and
   load the real menu into their shop with fixed product ids, so the page's
   order form saves each order with a tracking link before it opens WhatsApp.
4. **Research before building**: Mobbin and 21st per section (§3g.17). Both
   builds first reused the previous page's effects.
   **Every source before any idea** (Tzvi, 28 Oct 2026, after Bake away's first three opening ideas were
   made and paid for from one saved folder: "did you look through all our inspo sources", then "how can
   we make sure you never skip them"). Before any idea is shown or any credit spent, the build holds
   `REFERENCES.md`: one line for every source in `docs/inspo/README.md` and every `docs/inspo` folder
   (a new source is required at once), plus Inspo, Mobbin (mobbin.com links), 21st (21st.dev links) and
   what other sites already use (fingerprints), each saying what was taken or why nothing fits.
   `node scripts/check-references.mjs <build>` checks it; check-concept (so publish and the commit check)
   runs it; and a Claude Code hook (`scripts/hooks/require-references.mjs`) blocks Higgsfield generation
   for the build being worked on until it passes. Sites published before this rule are not asked for one.
   Worked example: `scrollcraft/builds/bake-away/REFERENCES.md`.
5. **Plan the phone frame before generating.** A clip made at 16:9 had to be
   re-cropped three times for phones (the box drifted off centre; the arch
   came out tiny). Generate with the subject centred and a margin, and
   decide the phone crop or layout from the first frames.
   **Confirm the motion in numbered steps before generating** (Tzvi, 18 Oct
   2026: "if you arent 100% certain what i want then ask"). When the owner or
   Tzvi describes an effect or sends a reference, write it back as steps
   ("1 floats, 2 snaps, 3 blasts apart, 4 flies back together, 5 drops in the
   box") and generate only once those steps are confirmed. "The pieces will
   fly out" meant two different things on Chicken Munch and cost two rounds
   of paid clips.
6. **Run generation in the background while the page is written**, with a
   script that saves the job number and retries a slow status check (a read
   timeout lost a paid clip). Never wait idle on a clip.
7. **Text over imagery gets its edge shade (or small solid card) from the
   start**, measured against the brightest frame (§5b.3). It was added after
   the check failed three times.
8. **The header and every main button go to the quickest way to order from
   the first draft** (section 8, The quickest way to order; wording: 5b.2), not after Tzvi asks.
9. **One idea per page, used once** (5a.6, 5a.7): the Gift Boutique had three
   ribbons.
10. **Run all three checks before any link, screenshot or video reaches
    Tzvi**: the wow test (§3n), clipped.mjs (now also catches a pinned
    block sliding under the header), readable.mjs. A link was sent before
    the checks and showed a cut-off card.
11. **The owner's video last**, from the live page, after the checks.

## 3f. Effects are seen whole, and there are enough of them (Tzvi, 13 Oct 2026)

From The Gift Boutique's first draft: "the ribbon is already gone by the time
i scroll down to see the different pictures so i miss most of the effect and
its a bit bland there isnt many affects".

1. **A scroll effect plays while its subject is wholly on screen.** Either
   hold the subject (a sticky stage that fits the screen, see below) and run
   the effect over the hold, or start it only once the whole subject is in
   view and finish it before any of it leaves. Never key it to the subject
   *entering* the screen. Check: capture the effect at 0, 25, 50, 75 and
   100 percent on a laptop, a short laptop and a phone; in every frame the
   whole subject is visible and the effect is visibly mid-way where it should be.
2. **Every page fills its effect budget, not just its limit.** Before
   building, write in CONCEPT.md (3q): one signature moment (staged in steps and held
   where it fits 1280x650, otherwise playing as the page scrolls without
   holding the screen, 3a; either way it is the page's signature and peak,
   5a.7); at least three accents (an opening that arrives
   in order, one scroll-tied detail in the middle of the page, a payoff at the
   close that answers the signature); and quiet touches (sections ease in,
   buttons react to hover and press, tiles lift). Then tick each one off on
   the captured frames. One effect on an otherwise still page is a draft.
3. **A held stage fits with everything fixed around it** (fit and cut-off checks:
   3a). Its height is the
   screen minus the sticky header and minus the phone's bottom bar, so the
   bar never covers its last line. Things that travel out of the stage
   (a bow lifting away) live outside any frame that clips, so they leave whole.
4. **A motif is never doubled.** When an effect reuses part of the logo
   (the bow), it never lands on the logo that already has it.
5. **Widths of text are in em or rem, never ch.** Chrome works ch out from
   the fallback font and keeps it after the web font arrives: the headline
   came out narrow and five lines tall on first load.
6. **A text shimmer is a layer over the letters, never the letters' own
   background** (background-clip: text). The letters keep their real colour,
   so they stay readable and the readability check can measure them.
7. **A bottom bar fits at 360 px wide:** its label shrinks or wraps, its
   button never does. Check the button's words end inside the button.
8. **A scroll-tied effect finishes while its subject is still in the middle
   of the screen.** From Rendrly's "How switching works" (13 Oct 2026), whose
   lines filled with colour as you scrolled: "the coloring only finishes when
   im past it". Progress ran until the list had moved most of the way up and
   partly off a short laptop. Map progress from when the subject is in view
   (its top passing about 85% of the way down) to when its centre reaches the
   middle of the screen, never to when it leaves. Check with
   `scripts/scroll-finish.mjs`: at 1920x1080, 1440x900, 1536x753, 1280x650,
   390x844 and 360x640 the subject's top is still on screen and its centre no
   higher than 40% of the screen at the moment the effect completes.
9. **A list that stacks on a phone runs item by item there.** One progress
   for the whole list suits a row of items side by side on a laptop; stacked,
   the list is taller than half the screen and the later items light up late.
   On a phone each item lights as it reaches about 80% of the way down the
   screen, and the line to the next item fills while that item travels up to
   the same point.
10. **An effect that plays once starts where the visitor will see it, or is
    tied to the scroll.** Rendrly's first version lit the steps one after
    another, starting the moment the list's edge entered the screen; on a
    normal scroll it was over before anyone got there ("theres no affect").
    Start a one-time effect only when its subject is wholly in view (or, if
    it is taller than half the screen, when its top reaches the middle, so a
    hidden photo is not held blank for long), or tie its progress to the
    scroll so it waits for the visitor. Section reveals that hide a whole
    section keep an early start: holding them back leaves a blank band. The
    page builder does this in `useFx` (frontend/src/components/pagebuilder/v3/
    effects.js): list and photo showpieces get `.is-seen` by `seenEnough`.

## 3g. From the six design videos (Tzvi, 14 Oct 2026)

Six videos Tzvi sent ("i want to you to watch the videos themselves to see
how professional designers make beautiful unique websites"), watched as
frames, not transcripts. Notes, timestamps and saved frames:
`docs/ui-videos/notes/` (Wkf2IjZrRt4, _2FlJYE4p3Q, qTWOkhytG0M, VwGrXe2ricE,
fq3wx-AR6B0, snErQUyqwCU). All six are mostly sales pitches; only their
design craft is taken. Their demo sites invent reviews, counters ("174
bottles", "4.8 stars"), logo walls, a form that sends nowhere and footage
passed off as the business's own: none of that is ever copied (section 1).
Tzvi approved all twelve, then three more (13 to 15) after asking how they
make their sites so beautiful: the imagery first, and almost nothing else.

1. **A style sheet before building.** Every page starts with a short written
   sheet: accent, ink, ground, the two faces (headline and text; at most a third
   for one label style), the one radius, and the motion
   limits (what may move, how fast, what never moves). Every section follows
   it, so a fix is made once. Kept in the build's CONCEPT.md (3q).
2. **The AI-look tells, added to rule 3c.2.** None of these on a page: a
   default system or template font, a purple or two-colour gradient, exactly
   three identical cards in a row, frosted glass used everywhere, a headline
   any competitor could also use.
3. **The accent colour is for the main button only** (Tzvi, 22 Oct 2026; this
   replaces "one accent word or object per screen"). Everything else is ink
   and grey. **Prices are in the main text colour, bold and large**, never in
   the accent. A word that matters (the thing they sell) may be set apart by
   weight or style in the text colour, at most one per screen. This is the
   single home of the accent rule. The cream ground + serif + italic word
   combination stays banned unless it is their brand (3c.2).
4. **Every motion has one job**: guide the eye, confirm an action, or reveal
   the next thing. A loop starts and ends on the same frame (no visible
   jump). Text settles into place, soft to sharp, without a bounce. Rows of a
   list may arrive one after another, about 100 ms apart. A menu hover reacts
   in under 300 ms.
5. **The story in chapters.** A scroll film or held section carries short
   labelled steps from the business's real process (ingredient, dough, oven,
   box; survey, kasher, check), one line each, changing as the scroll moves,
   ending on the finished thing and the main button.
6. **The index list**, as a design option for a menu or price list: large
   names on thin rules, a short note and the price on the same line, the row
   under the pointer filling solid (a tap on a phone). Suits gift shops,
   bakeries, menus.
7. **One closing signature**: the business name set huge and cropped by the
   bottom edge, or one playful moment kept to the footer or the not-found
   page. Never more than one, never in the way of the order path.
8. **Text over video or a busy photo:** see 5b.3, the single home.
9. **A small working piece where it helps**: a mini order card that shows
   the real price as the quantity changes, a date checker, a size picker with
   their real photos. It must really work and send where it says.
10. **Words: the customer's problem first**, then what the business does
    about it, in the owner's words. Any line a competitor could also say is
    rewritten until it could only be this business.
11. **Fonts from a short approved list** that covers Latin and Hebrew, each
    licence checked for commercial web use (never "free for personal use").
    Kept in `reference/design-rules.md`; a face is added there before it is
    used on a page.
12. **Build order.** The bones first (opening, what they offer, how to
    order, contact), then separate passes for polish, motion and phone width.
    Stills of every section are checked before motion is added; fixes are
    batched into one round; then a real test goes through every form and
    order button (to a test business, never the owner's live inbox) before
    the owner sees the page.

13. **The opening screen holds four things at most** (Tzvi, 14 Oct 2026,
    after "did you see how they make each website so nice they look
    beautiful"): the beautiful sites open on the picture, a headline of two
    to five words, at most one short line, and one button. The header does
    not count. **This is the single rule for the first screen, and it wins**
    over every other count of what the top may hold: the `hero` hard rule's 10
    words and 20 words under it, 5b.1's four pieces of text and 5.3's headline
    formula are ceilings, not targets. Every other mention points here.
    - **The headline says what the customer gets** (Tzvi, 22 Oct 2026): their
      result, in the owner's words.
    - **Where the business is** goes in the one short line or the small label
      of 3e.2. The label counts as the one short line, so there is the label
      or a line, not both. On the first screen, 3t.3's big line is this
      headline.
    - **Trust proof** (a hechsher, "delivered across Israel") is the one short
      line or sits right under the button.
    - Everything else moves down the page.
14. **One colour grade across every image.** Every photo and clip on a page
    shares one light and colour mood (warm candlelight, cool morning, soft
    daylight), graded to match before it goes on the page; the page's
    colours are taken from that grade. Nothing looks pasted in from another
    shoot.
15. **A made-for-them cinematic opening.** Every page opens on a picture or
    film made for that business at full quality: their own product,
    set in a generated, lit setting that fits them (a generated setting is
    never presented as their real premises; their real premises appear only
    in their own photos), or their photo brought to life (a slow push-in,
    candlelight, steam), made in Higgsfield (section 8). Never a small flyer
    crop or a low-resolution photo as the hero. The cost is told to Tzvi
    before each generation, one is made and checked before any more. The film
    opening itself is specified in 3h.

16. **The opening has a wow: something happens.** The rule, the test and the
    gate are in 3n (the wow gate), the single home. The film that delivers it
    is 3h.

17. **Every page's effects are its own, found fresh on Mobbin and 21st**
    (Tzvi, 15 Oct 2026: "make sure you are always making unique effects from
    mobbin and 21st dev", after Michal Balloons was started with the Gift
    Boutique's gold-filling rows and no research). Before any section or
    effect is built: one Mobbin, one 21st and one Inspo search for that piece,
    for this business; pick from what they return and name the source in the
    build's CONCEPT.md (3q) and in the reply ("What we make: after Fiverr's services
    list, Mobbin"). 21st is searched for sections and for the details that make a
    page feel finished: the button's hover and press, an arrow that moves, a tile
    that lifts, how a price is set (Tzvi, 7 Oct 2026). Never reuse an effect from the last two pages built; the
    FINGERPRINTS file lists what each page used and a new page is checked
    against it before anyone sees it. The effects library is a shelf of
    tested extras, never the starting point.
    **Every piece, not only every page** (Tzvi, 7 Oct 2026, after the Blazin'
    Boards and KasherMyBnb buttons came from the library instead): the button,
    the arrow, each card or list effect and each section each get their own
    search on Mobbin, 21st and Inspo for that kind of business, before anything
    is taken from the effects library. The note says, for each pick, where it
    came from: a new search (name the site or component) or the library. An
    effect still needs its reason (3c.9): one that says what a control does
    passes, one that only decorates does not. This is the single home of the
    fresh-search rule; 3c.1, 3e.24, 0b.4 and 8a point here.

## 3h. The cinematic film opening (Tzvi, 16 Oct 2026, after a video of a fruit-juice site, PULP)

**Smooth, slow enough to see, and clean** (Tzvi, 24-25 Oct 2026, Blazin' Boards: "the board flies in but not smoothly ... a meatboard on a meatboard ... part of the picture is cut off ... the effects and the pictures are a little delayed"; Bun Intended: "it moves too glitchy and quick for me to see the full effect clearly"). Every scroll-driven opening:
1. **Runs at 60 fps.** Scrolling it keeps frames under 20 ms. No full-screen blended (mix-blend-mode) or blurred (backdrop-filter) layers over a moving scene, no filters on moving images, no per-frame redraw of text on a canvas (draw it once offscreen), and the shown progress eases toward the scroll so wheel notches glide.
2. **Is long enough to see.** At least 3 screens of scroll, about 4 to 4.5 for a story with several beats; each beat holds long enough to read.
3. **Shows the product on a plain ground of its own world**, never on a photo of the same kind of product (a board on a board).
4. **Keeps the product and every photo whole**: nothing cut by the screen edge or by the photo's own framing, unless the bleed is clearly deliberate; crop out half props.
5. **Loads the first screen first**: the opening's images preloaded, everything below lazy.
check-site SMOOTH and SLOW enforce 1 and 2; 3 to 5 are looked at on the sheet before showing.

Tzvi: "it looks wow, much nicer than what you made for the brown box ... every
detail is crisp and clear and makes a person want to try some." Side by side,
The Brown Box's first opening was a locked camera on a small bowl against a
flat studio wall, beside the text, encoded soft. PULP's was one full-screen
film the scroll drives: a strawberry on the vine at sunrise falls, fruit
tumbles through the dark, splashes, swirls into the blend and the camera pulls
out to the jar, with a new line of huge words over each scene.

1. **One unbroken shot, full screen, that travels.** The camera may move when
   it follows the product's own journey (this amends 5a.2, "the product
   performs, not the camera": a camera move is allowed when it IS the story,
   never for its own sake). The film fills the screen; it is not a box beside
   the text. **A 3h film opening IS the page's one signature scroll section**
   (see 5a.7). The film
   is a held stage and must pass the 3a fit and cut-off checks. Its first screen
   follows 3g.13.
2. **From where it comes from to their product.** The film tells the
   product's path (the ingredient, how it is made, how it is served) and ends
   on their real product and the button. Every step is a fact of theirs or
   plainly true of the ingredient; nothing invented ("picked at dawn" only if
   they said so).
3. **Advert-grade frames.** Macro, shallow focus, warm light, a ground lit
   enough to pass 3h.11 that the colour can glow against, detail in the air (droplets,
   crumbs, steam). A flat, evenly lit studio backdrop fails.
4. **Crisp.** Generate at the highest resolution the model gives; the page
   draws the film as a sequence of sharp frames on a canvas (or a near
   lossless video) sized to the screen; never shrink it, mask its edges or
   squeeze it into a column.
5. **Chapter lines.** Two to six words, over the film (small and at an edge, see 3h.9 and 5b.3), a new line for
   each scene, in the owner's words and facts; this amends the 3a rule
   "Nothing moves without a reason" (a clip behind text holds still) for the
   film opening only: the line follows 5b.3, measured at the film's brightest
   frame.
6. **Three concepts as stills first,** each a different film, before any clip
   is paid for; the chosen one is challenged once (what is weak, what is
   missing) before rendering. They go to Tzvi in the message that starts the
   build, never after it, unless the opening is already an event built from
   their own thing (Chicken Munch's bowl drop, KasherMyBnB's kitchen walk): a
   full-screen event in code counts as the wow, a photo or type beside the
   cards does not (22 Oct 2026, "why do i keep needing to tell you to make the
   wow moment", then "these have a wow moment already"; check-site OPENING,
   every category). Each wow idea is found, not
   invented: search Mobbin, Inspo and 21st (and docs/inspo) for that kind of
   business's openings first, and every idea names the reference it came
   from (Tzvi, 23 Oct 2026: "for the wow use mobbin and our inspo and 21st for
   inspiration"); check-concept fails a Wow gate with no Mobbin link and no
   Inspo or docs/inspo reference.
7. **Seams checked.** Every clip starts on the last frame of the one before
   (one clip per physical step, as before); after rendering, compare the
   frames either side of each join and regenerate a clip whose join jumps.
8. **Contrast after the film.** The section after the opening changes the
   mood boldly (after a lit film, a bold colour block) so the page wakes up
   instead of continuing in one tone.

9. **Bright enough to see, and the words never cover the action** (Tzvi,
   16 Oct 2026 on The Brown Box film: "very dark and hard to see and the
   words block a lot of what's going on"). Brightness is settled in 11 (the
   subject reads at a glance on a phone in daylight). Chapter lines sit at the bottom edge (or
   the side the subject is not on), at most a third of the screen's height,
   on the soft edge shade of 5b.3 only; no big dark patches or scrims over
   the film. Check every scene's frame for what the words cover: if they sit
   on the thing that is happening, move or shrink them.
10. **A choice changes what you see.** When a visitor picks an option (a bowl,
   a size, a flavour), its picture, words and button change with it; a
   picture that stays the same reads as broken (Tzvi: "nothing changes when
   choosing a different bowl type"). One photo per option, all from one
   shoot, sharp at the size shown: never a small crop from a screenshot
   blown up.

11. **Light it bright from the start, then measure** (Tzvi, 16 Oct 2026:
   "at first it was too dark so i dont want similar issues by future builds").
   The Brown Box film was prompted for "a rich deep brown-black background" and
   came out averaging 19 out of 100; it had to be graded up afterwards. So:
   prompts ask for bright, warm, soft light with the subject fully lit and a
   mid-tone or light ground (golden, cream, sky), never "dark", "black" or
   "moody" as the default; a dark ground only when the business's own look is
   dark, and then the subject is still lit. Check every film and every set of
   generated stills with `scripts/brightness.py` before it goes on a page:
   middle third at least 33, whole frame at least 22, average at least 30
   (out of 100); a product dark by nature (acai, chocolate) is lit and set on a
   lighter ground rather than pushed until it turns milky. Under that, grade up (ffmpeg eq=gamma) or regenerate. Then
   look at it on a phone screen in daylight, not only on a laptop.
   Seen in the Christian Peverelli video (16 Oct 2026): the sites that look
   expensive light the subject itself, not just the room. A light-blue studio
   ground with a fully lit orange car, or a pale ground with a glowing amber
   object; where a section is dark, the photo inside it is bright and sharp, with
   a neon or warm rim line on the floor. Dark never means the subject is dim. Even the dark sites in the five videos
   (a coffee pour, a perfume, a car) keep the subject brighter than everything
   around it (3i.1). **This item is the single home for brightness**: 3h.3,
   3h.9 and 3i.1 point here.
12. **One look per product, everywhere on the page** (Tzvi, 17 Oct 2026, on
   Chicken Munch: "the chicken types dont look accurate like the poppers for
   example in the full box look different than when choosing each type",
   then "make a rule so we dont have the same issue come up again"). The
   film's box was generated once and the seven style close-ups separately,
   each from its own text prompt, so the same item came out as two different
   foods: glazed bites in the box, popcorn in red sauce in the picker. So:
   - Every picture of the same item (film, close-up, picker, tile, card,
     order form) shows the same object. Pick one master image per item
     first: their own photo where there is one, otherwise the generated
     frame the film ends on. Every other picture of it is cut or zoomed from
     that master, or edited with the master as the reference image. Never
     generate the same item twice from words alone.
   - Before any picture is generated, write down which master each item's
     pictures come from. Generate the film first and the item pictures from
     its final frame, not the other way round.
   - When the item names are theirs but their look is unknown (a menu with
     no photos), only the names go on the page. Then ask the owner for one
     photo of each, or to confirm which piece in a picture is which. Never
     guess which generated piece is "Fruity Chicken".
   - Check before showing: put every appearance of each item side by side
     on one sheet (film frame, close-up, tile). If two could pass for
     different foods, they fail.
*Items 13 to 16 are about generated food in motion. It is allowed only in this
film, advert style, under the frame-by-frame checks of 3o.1 (the single home of
that policy).*

13. **One cause, one motion** (Tzvi, 18 Oct 2026, on Chicken Munch: "when its
   pulled apart first crumbs fall down and they kind of look like blocks then
   it afterwards explodes outward it doesnt look natural"). The snap clip
   already broke the tender its own way (crumbs dropping as orange lumps
   into a pile under it), then a second clip started an explosion from that
   pile, and code crumbs joined later still: three kinds of physics for one
   break. So:
   - The thing that causes an effect and its result happen together, in one
     clip: the force that splits the chicken is the force that throws the
     flakes. Never let one clip finish an event one way and the next clip
     start it again another way.
   - Plan the cut before generating: end the lead-in clip on the last frame
     before its event begins (the tender still whole) and generate the
     event itself as a single clip from there, its peak pinned by an end
     frame where needed.
   - Pieces made in code start on the exact frame of the cause and travel
     the same way as the generated pieces, never a beat later.
   - Pieces added in code must be the same material as the film's own, in the
     same light: Chicken Munch's cut-out shards came from a separate photo,
     paler, flat, with a white halo from that photo's background, and Tzvi
     saw at once they "look a bit fake". Prefer a clip that throws the pieces
     itself; if code pieces are needed, cut them from the film's own frames
     and check one large, at full size, against the film before using them.
   - Watch every effect at 4 frames a second or more, before anything is
     shown, looking for: pieces that fall and then fly, a pause where nothing
     moves in the middle of an action, debris that does not look like the real
     material (blobs or blocks instead of flakes), a heap or floor that
     appears from nowhere, and the same faults played backwards on the way
     back. Any one of them is a fail.
14. **The product stays recognisable through the whole effect** (Tzvi, 18 Oct
   2026: "you dont see much of the chicken"). The burst version flew the camera
   into the flakes until no chicken was left on screen. The effect happens to
   the product with the product in view; a moving camera never loses it. On a
   phone the frame widens during the effect if the pieces travel past the crop.
15. **Pin the peak of a big motion with an end frame.** Generated clips play
   motion down: Chicken Munch's first blast barely moved. For an explosion,
   pour or splash, make a still of the peak moment first and give it to the
   clip as its last frame, so the clip must travel all the way there.
16. **A clip played backwards is a free second scene.** Explode, then fly back
   together, is one clip played forwards and then backwards with the scroll,
   so it returns exactly the way it broke. Consider it on every film; it
   halves that scene's cost. The faults of 3h.13 played backwards are faults
   too.
17. **Words and film take turns.** A giant name sits on the plain ground and
   the film appears as the letters part, never letters over the picture; at
   the end the film moves aside first and the headline arrives once there is
   room. The readability check failed both ways on Chicken Munch until they
   took turns.

18. **The story must be physically possible before anything is generated**
   (Tzvi, 25 Oct 2026, on LS Fruit Platter: "the watermelon inside just
   disappears ... before you make a video you need to make sure everything
   looks natural and makes sense"). Write the film as a list of every object
   on screen and, for each one, where it comes from and where it ends up:
   in frame at the start, enters past an edge, is cut from something we
   saw, or leaves past an edge. If any object appears from nowhere, turns
   into a different thing, or leaves no trace (a watermelon's red flesh, a
   grape that was never there), the idea is wrong; change the idea, not the
   prompt. A start and end frame cannot fix an impossible middle: the model
   fills it with a morph. "A watermelon bursts into a whole platter of other
   fruit" failed twice for exactly this reason, both times on its middle.
   Show Tzvi the object list with the steps, and watch every generated clip
   at 8 fps asking the same question of each object.
   **The test is whether it looks off, not strict physics** (Tzvi, 26 Oct
   2026: "as long as it doesnt look off its ok if it appears"). Something
   may appear on the way (more balloons filling an arch, a few more rolls in
   a box) if, watched at normal speed, it looks natural and nobody would
   notice. It fails when a viewer would see something wrong: a thing melting
   into a different thing, a pile morphing into boxes, a piece popping in or
   vanishing in plain sight. The 8 fps watch finds candidates; the normal-
   speed watch decides. Plan with the object list all the same: a plan where
   everything has a route is what keeps a clip from looking off.
19. **Generate once: plan the clips so the model never has to invent**
   (Tzvi, 26 Oct 2026, after Noa Levi's drawer took two films and the fruit
   burst two: "make a rule that will help prevent needing to make many
   generations from mistakes"). Most bad clips are bad plans, not bad luck:
   a video model blends its first frame into its last, and whatever has no
   route between them comes out as a morph. **A better prompt helps a
   little; the real fix is choosing a story that is physically possible
   before generating** (Tzvi, 26 Oct 2026). Never answer a failed clip with
   a reworded prompt alone: first ask which object had no route, and change
   the story. Before any video is generated:
   1. **The ends hold the same things.** List the objects in the start
      frame and in the end frame. Every object in the end frame is in the
      start frame, or enters past an edge during the clip, and everything
      in the start frame is still there or leaves past an edge. If one has
      no route (boxes in the after photo that the before photo does not
      have), do not prompt around it: split the film at that point with a
      still made in between, or change the idea.
   2. **One kind of action per clip** (taking out, or putting in, or
      pouring; never taking out and putting in and folding in one clip).
      A second kind of action is a second clip, chained: the end frame of
      one is the start frame of the next.
   3. **Stills before video.** Make every in-between still first (2
      credits each, edited from the owner's photo), check each against the
      object list, and only then spend on video.
   4. **Write what frame 1, the middle and the last frame show** for each
      clip in the brief before generating, and judge the 8 fps watch
      against that, object by object.
   5. **Two tries per clip at most.** A clip that fails twice means the
      plan is wrong: bring a new plan to Tzvi instead of a third try.
   Worked example: scrollcraft/builds/noa-levi-home-styling/gen/tidy-brief-v3.md
   (the drawer is emptied, then filled boxes go in, in three clips between
   four stills).
20. **One scroll effect per page** (Tzvi, 29 Oct 2026: "there shouldnt be two
    scroll affects on one page especially on mobile where people just want to
    see the products and order fast its a bit annoying"). The opening film is
    the page's one scroll effect; everything after it scrolls normally. A
    second thing that holds the page while the scroll changes it (a flavour,
    size or step that turns as you scroll) becomes a tap: the same spot, the
    same pictures, changed by tapping a chip or a photo. Bake away's flavour
    spot held the page for eight screens after the film; it now changes on a
    tap. `scripts/check-one-scroll.mjs` fails any page with two sections that
    pin while the page scrolls more than half a screen (run by check-build and
    publish-page).

## 3i. From the professional sites in five videos (Tzvi, 16 Oct 2026)

Tzvi: "pull out other things from these professional websites ... watch the
videos themselves". The finished sites in five videos were studied frame by
frame; full notes in docs/ui-videos/notes/sites-2026-10-16.md.

1. **The product is the brightest thing on screen.** Brightness is settled in
   3h.11; shadows are 3s.3.
2. **A choice changes the hero itself.** Picking a flavour, size or style
   changes the main picture and the section's colour, not only a card below
   (the matcha site's drink turns pink for Strawberry; the car site's tabs
   open the hood). One picture per option from one shoot, a 300 to 500 ms
   cross-fade, the section's ground easing to that option's colour.
3. **A live readout tied to the scroll**, only when it shows a true fact of
   their process (the coffee site's "PULL 12.2 s" counting with the pour):
   small mono type at a corner, never a made-up number and never a "01/06"
   section counter.
4. **Words and object overlap.** A cut-out product sits partly in front of
   (or behind) the headline so the two read as one picture; a product may
   carry through several sections as the page scrolls. Only if `readable.mjs` still
   passes on the covered letters; never over the action (3i.8).
5. **One colour family per section, with one or two hard breaks**: each
   section's ground matches its product (peach, red, cream) instead of one
   tone all the way down; one or two bold bands reset attention.
6. **Floating cut-out tiles**: rounded tiles holding their ingredients or
   products, tilted 6 to 12 degrees around a heading or menu, drifting a
   little with the scroll; all from one shoot.
7. **Buttons that look pressable**: a darker bottom edge that sinks on
   press; optionally a small floating pill menu at the bottom centre that
   stays on screen.
8. **One word or short line per scene with room around it**, on empty
   ground beside the subject ("Amber." "Oud." "Smoke."), never on it.
9. **Tap-able dots on the product** that open a short caption in their
   words (what is in a gift box, which balloons make an arch), placed by
   measurement as in 3a (overlays).
10. **A glowing line along the floor under a lit product.** (The giant
    cropped wordmark to close the page is the closing signature of 3g.7.)

## 3j. Buying psychology, only the honest kind (Tzvi, 19 Oct 2026)

From "20 most powerful psychological tricks brands use to get you to buy"
(attentioncurve.com), checked against these rules. Already covered elsewhere:
social proof (real reviews only, section 3 (cont.) item 5), colour (from their
logo and photos, 5b.4), the senses (big real photos, 3h), their story in their
words, and bundles with the real saving (below). Added:

1. **A guarantee beside the button.** If the owner offers one (money back, "we
   redo it free", free cancellation), it sits under or beside the main button,
   in their words. People hesitate less when they know they cannot lose. Ask
   every owner: "Do you offer any guarantee or promise?" None means none.
2. **One add-on before ordering.** On the order page, one real, relevant
   suggestion from their own menu ("Add a 9x13 rice? ₪75, goes well with a
   pan"), with an Add button and a "No thanks". It shows only when it fits the
   order, goes away once added or turned down, and is never pre-ticked.
3. **Give first.** A free taster, sample, first consultation, quote or
   inspection that the owner really offers becomes the headline offer, beside
   the main button.
4. **Discounts for a group** (students, soldiers, first order, olim) only when
   the owner offers one, said once near the price. These are standing discounts,
   not time-limited, and need no end date (`urgency`).
5. **Come back.** A real stamp card ("every 10th box free") or a "Reorder"
   button, only when the owner runs it. Never streaks, points with no
   value, or a reminder for something the customer did not start.
6. **The middle option.** With three sizes or packages, the one most customers
   should pick is shown as the natural pick ("Feeds 8 to 10" is the family
   size). Never invent an option to make another look good, and "Most
   popular" only when the owner says so.

Never: invented scarcity or countdowns ("only 3 left", "ends tonight"), a
"was" price that was never charged, changing their prices to .90 or .99
endings, or an endorsement they do not have. These break trust and the hard
rules (section 3).

**Show the deal, when it is real** (Tzvi, 20 Oct 2026: "a strong psychology
technique is when people feel like they are getting a deal ... it should show
what they save when purchasing a 4 pack rather than a single ... a board
double the size should technically be double the price, if it's not they are
getting a deal"). Work it out from the owner's own prices, never invent it:
- **the saving is shown as a percentage, with the real separate price struck
  through beside the new price** (Tzvi, 22 Oct 2026; this replaces the 20 Oct
  rule that allowed only money). Tzvi's example: a 4-pack is $15 and single
  packs are $5 each, so the badge says "25% off", $20 is shown struck through,
  and $15 next to it. The struck-through price must be real: the same items
  bought separately at the business's real prices, or a price really charged
  before; never invented. Percentage = (separate minus new) divided by
  separate, rounded DOWN to a whole number. The badge is two or three words
  ("25% off"). When the separate prices vary across a range, "up to" only for
  the true top ("Up to 20% off");
- **any saving, for anything** (a bigger size, a pack, a bundle, a package,
  a monthly plan, a longer session, more of the same; Tzvi, 21 Oct 2026: "it
  should work for any comparisons") is shown only when it is true like for
  like:
  1. compare only the same thing in a different amount: the same contents,
     the same service, the same product line (a Large Premium board against
     the Small and Medium Premium, never the regular Medium; a 6-jar bundle
     against six single jars of those flavours; a 2-hour session against two
     1-hour sessions of the same service);
  2. work it out per unit first, in a table of every option (per jar, per
     square centimetre, per person, per hour, per kilo, whatever the owner
     sells by);
     For anything sold by how many it feeds or serves, the unit is one person,
     compared at the same end of each range (most people against most people,
     fewest against fewest), never by counting whole smaller items needed to
     feed one end of the bigger one's range: Chicken Munch's Grand ($140,
     feeds 8 to 10) was wrongly left without a saving because two Minis
     ($138) feed 8, while per person it is $14 against the Mini's $17.25
     (Tzvi, 22 Oct 2026: "why didn't you catch the Grand's savings");
  3. the bigger option shows a saving only if its unit price is lower than
     EVERY smaller option of the same thing, and the saving is measured
     against the cheapest of them, never against one dearer outlier
     (Blazin' Boards' "Save $77" was measured against the one overpriced
     Medium, while the Large cost the same per square centimetre as the Mini
     and the Small: it saved nothing);
  4. where options differ in more than amount (different contents, extras,
     quality), there is no saving to show;
  5. a lone saving among many products shows none (Tzvi, 21 Oct 2026: "if
     there will only be one savings then everything else looks overpriced so
     don't write the savings"), but judge it by the group it belongs to, so it
     makes sense ("if a store only has 2 products like a single pack and a
     double pack ... it won't look bad"): compare each small group of sizes of
     one thing within itself (a single and a double pack, a 4 and an 8 box,
     a 9x13 pan and a roaster, the Munch boxes against each other, two
     programmes and their bundle, a service and the same service with its
     add-on) and its saving is shown; only where the site sells many things
     and one item alone carries a badge (Blazin' Boards' Large Premium among
     a dozen boards) is it left off, and the lower price speaks for itself;
- **never say how much more the bigger one costs** (Tzvi, 20 Oct 2026: "don't
  say how much more it costs"); the only thing said is the saving, as the
  percentage badge and the struck-through price above;
- a combined service against its parts booked apart, shown the same way
  (Elisheva: gel with removal ₪110 against ₪130 booked apart: "15% off", ₪130
  struck through);
- in the basket, single items a package would make cheaper get one line with
  the saving and a Switch button;
- an owner's own savings claim the prices contradict is not printed: ask
  them (The Whipped Cup's "save 30+" is ₪20 for six Classic jars).

## 3k. A website, not a page (Tzvi, 19 Oct 2026)

Tzvi: "I want our pages to be used instead of websites so they need to look
like websites and behave like websites with multiple pages." A paid build is a
small website. A single page stays fine for a business with little to say
(one service, one price, few photos).

1. **Pages by kind of business**, from what the owner gave us (no page without
   real content):
   - food: Home, Shop, Contact (About when they send their story)
   - service: Home, Book, Our work, Contact (About when they send it)
   - rental: Home, The apartment, Photos, Availability, Contact
   - shop or gifts: Home, Shop, About, Contact
   **The menu and the order are ONE page, the Shop** (Book for a service;
   Tzvi, 20 Oct 2026: "merge them and make it the standard"). A separate
   Menu page made the visitor read the items, then find them again on the
   Order page. The Shop is built as a product page (docs/inspo/
   product-pages-2026-10-20): one item at a time on a stage, its real photo
   big, name, price and "+" facts beside it, the stage taking the item's
   colour, quantity and the total in the button; switching items crossfades;
   packages below with their choices under them (3l); the basket, delivery
   and details at the end of the same page; the phone bar shows the basket.
   Old Menu and Order addresses forward to the Shop. The Whipped Cup's
   shop.html and Nails by Elisheva's book.html are the worked examples.
   **The order itself is in steps** (Tzvi, 20 Oct 2026: "make steps the rule
   for order pages", from Blazin Boards' order): choosing stays on the Shop
   (or the first screen of Book); the order after it is one question per
   screen: Step 1 Your basket (or Your nails, Your board), Step 2 When and
   where (delivery or pickup, the day, the time), Step 3 Your details, then
   the message. A bar of three lines above says "Step N: name"; the order and
   its total stay beside every step (under it on a phone); the main button
   names the next step ("Continue to delivery") and on the last step what
   happens with the total ("Send order on WhatsApp, ₪163"); a Back button;
   the browser's back button goes back one step (#order-2); each step checks
   only its own fields before moving on. **Every line in the basket has a
   remove button** (a bin, 40 px, "Remove X from the basket"), packages
   included, beside its stepper (Tzvi, 20 Oct 2026). scripts/check-site.mjs
   FLOW walks the steps; The Whipped Cup's shop.html is the worked example.
   Each page is `<page>.html` in the build folder; publish-page.mjs serves it
   at /business/<slug>/<page> and on the business's own host at /<page>.
2. **One menu bar on every page**, identical markup: their name (to Home), the
   pages, the one Order or Book button (wording and destination: 5b.2) with a count of
   what is in the basket.
   The current page is marked (`aria-current="page"`). On a phone the pages
   fold into a Menu button that opens a panel with a Close button and closes
   on Escape or a tap on a link.
3. **One footer on every page**: how to reach them, the page links, the
   MyIsraelRental line.
4. **Shared files**: `site.css` (all styles) and `site.js` (menu bar, phone
   bar, reveals, basket) used by every page; page-only code stays in that
   page. A class name used by a page section (`.open`, `.in`) is never reused
   for a state of a shared part: the phone menu once took the opening's
   centring because both used `.open` (Chicken Munch, 19 Oct 2026).
5. **Each page has its own title, description and link preview image**
   (`og:title`, `og:description`, `og:image`), so a link to the Menu shows the
   menu.
6. **The basket lives between pages**: an Add button anywhere puts the item in
   (localStorage, with `?add=<item>` on the link as a fallback) and opens the
   order page with it already there. The browser back button works the normal
   way: no page hijacks it.
7. **Check every page**, not only the home page: clipped.mjs and readable.mjs
   on each, the phone menu opened, and an Add on one page reaching the order
   page.


**Every order is saved before WhatsApp opens** (Tzvi, 22 Oct 2026: "when someone clicks order it saves all the information to the site and then redirects them to WhatsApp with a pre typed message"). The order or booking button first POSTs the order to MyIsraelRental through the business's order form (`/api/marketplace/order-form/<gig>/orders`, the way Chicken Munch's order.html does; bookings and quotes through their own endpoints), so it reaches the owner's dashboard, the customer gets a tracking link and the review request follows; only then does it open WhatsApp with the order written out. Every product on the site exists as a product of that business's listing (same name and price), so the saved order names real products. If saving fails, WhatsApp still opens (the customer is never stuck), and the failure is logged. check-site SAVE fails a page whose order reaches WhatsApp without that POST first.

## 3l. Similar products: every difference is said on the item (Tzvi, 19 Oct 2026)

Chicken Munch's order page let a customer choose kinds of chicken for every
box and pan alike, while the owner allows several kinds only in the boxes and
the large Roaster, and one kind in a 9x13 pan. Tzvi: "make a rule for similar
products, we need to make sure everything is clear."

1. **Ask before building the order form.** For every family of similar items
   (sizes, boxes, pans, packages, sessions), ask the owner: what can the
   customer choose in each one, and how many? (kinds, flavours, sauces,
   colours, extras, what is included and what is not). Never assume one item's
   rules apply to its siblings.
2. **Say it on the item, before it is added.** Each item carries its own
   short line of what it allows ("Up to 4 kinds of chicken · 3 sauces",
   "1 kind of chicken", "Mix as many kinds as you like"), in the same words on
   the menu tile, the order line and the order message. A one-choice item is
   marked differently from the many-choice ones.
3. **Choices belong to the item, not the form.** Options appear under the item
   once it is added, only for items that allow them. One choice is a radio
   set; a limit greys out the rest when it is reached; an item that needs a
   choice cannot be sent without it, with the reason beside it. Never one
   shared set of options for items with different rules.
4. **Three or more alike: compare at a glance.** Show what differs side by
   side (feeds, kinds, sauces, price), and nothing that is the same for all.
5. **The order reaches the owner itemised**: each item with its own choices
   under it, so nothing is left to guess.
6. **A picture is of that item as it is sold now.** If the owner no longer
   makes it that way, no picture is better than a misleading one (Chicken
   Munch's platter photo, 19 Oct 2026).
7. **Check**: read each item alone. Could a customer tell what they get and
   what they can choose, without reading any other item?

## 3m. Places the owner fills, so the page grows without breaking (Tzvi, 19 Oct 2026)

Tzvi: "if Chicken Munch wants to add more pictures, how would he do that
without it ruining the page look or layout?", and then: "I don't want to keep
personally building pages, I want it to be automated." An owner never adds by
dragging things around; every designed page has fixed places that grow by
themselves, in the page's own style. The same places are what an automated
update will fill.

1. **A gallery on every designed page**: a section with `data-mir-gallery`
   (and `data-max`), a `[data-mir-photos]` list and a
   `<template data-mir-photo>` holding one `<img data-f="img">` in a frame of
   one shape, `hidden` until filled. The owner adds, orders, removes and sets
   the focus of photos in the dashboard (Edit your page, Photos);
   `frontend/public/pages/mir-gallery.js` lays them out, crops each around its
   focus, leaves out photos under 640px wide, and sets `data-count` so the page
   can lay out one, two or four photos well. Chicken Munch's "From our
   kitchen" is the worked example.
2. **Items they sell come from their shop** wherever the page lists products:
   `data-mir-catalog` (`mir-catalog.js`), so a new item, a price change or out
   of stock shows in the page's own tile design. Where an order form has
   per-item rules (3l), those rules are part of the item's data.
3. **Fixed places for details, never free text boxes**: hours, delivery areas
   and fees, a guarantee, FAQ, reviews, each with its spot and a length limit.
4. **Bigger changes** (a new section, a new look) are a design job, not an
   owner edit.

## 3n. The wow gate, scored before anyone sees the page (Tzvi, 19 Oct 2026)

The Whipped Cup and Nails by Elisheva were shown with openings that moved (a
cloud puffing, a photo swapping) and Tzvi found both bland: "I thought we have
rules to prevent this, why was it bland?" The rules said "open on an event"
and "one signature moment", and a small animation passed them on paper. The
gap: nothing measured whether it was strong, so the builder graded its own
work by the letter. From now on a page is not shown until it scores all five,
written into the build notes with one line of proof each:

1. **Their strongest real photo, big.** The best photo the owner has fills at
   least half of the first screen on a laptop and on a phone. Not a small
   card, not a shape cut out of it.
2. **One signature moment that only this business could have**, built from
   their own thing (their steps, their range, their product), that the
   visitor drives: a scroll scene or a choice. Chicken Munch: his bowl dropped
   across CHICKEN. The Whipped Cup: her three steps filling a glass as you
   scroll. Elisheva: tap a shade and the whole opening takes that colour.
3. **The visitor's choice changes the page**, not just one picture (the
   colour, the hero, the order).
4. **Side by side with a reference.** A screenshot of the first screen next to
   the closest Awwwards reference in docs/inspo for that kind of business; if
   ours is plainly weaker, it is not shown.
5. **The one-sentence test, told to someone else**: "you land and ___
   happens". If the sentence is about a decoration ("a cloud puffs"), it
   fails; it must be about them ("you pick a shade and her real work fills the
   screen in it").

A page that fails any of the five goes back to the build, not to Tzvi.

**What the opening must do: something happens** (Tzvi, 14 Oct 2026, on a
pretty but still opening, a slow push-in on their gift: "i dont like it there
isnt enough of a wow factor", then "make sure we have a rule so we dont have
bland boring pages like the original"). A beautiful picture that only drifts is
not enough. The opening shows an event, a real material changing in front of the
visitor, tied to what the business does: a gift box opening and light pouring
out, juice or honey pouring, dough rising, a cake being sliced, a kitchen
transformed, a perfume drop splashing, clouds parting. It is driven by the
scroll or plays as the page arrives, it is generated in steps (section 8), and
it ends on their real product and the button. Generated food in motion follows
3o.1. Run item 5 on the first five seconds and on the first full scroll: if the
answer is "nothing", "the camera moves" or "it fades in", the opening is redone
before it is shown. The whole page passes the same test section by section
(3f.2: one held signature and at least three accents), so no page reads as a
list of still sections. The film opening that delivers the wow is 3h.

## 3o. Lessons from the Chicken Munch, Whipped Cup and Elisheva builds (Tzvi, 19 Oct 2026)

1. **Generated food in motion is allowed only in the full-screen opening film
   (3h)** (Tzvi, 22 Oct 2026). It is made in advert style and checked frame by
   frame at 4 frames a second or more: no food appearing from nowhere, no
   glass or neon look, pieces never fade or vanish. **Everywhere else on the
   page, food stays the owner's real photo.** The single home of this policy;
   3h.13 to 3h.16, 3e and section 8 point here. Why the limit: in the page body
   generated food motion (a split piece, crumbs flying, a sauce splash, a toss,
   a drop into a bowl) looked fake every time, because the model invents the
   food between the frames and makes it smooth, shiny and watery. Outside the
   film the wow comes from their real photo moved as one solid piece (Chicken
   Munch's bowl dropped across CHICKEN), big type, and the visitor's own
   choices. Outside the film, generate only scenery, light or steam, or a
   drawing that is plainly a drawing (The Whipped Cup's glass).
2. **If a liquid must be generated** (in the opening film, 3o.1), prompt the
   material as well as the advert look: opaque, satin, specks and bubbles, a
   gentle pour that folds and piles up. "High-speed advert splash, glossy, rim
   light" on its own gives glass or neon. Check the still for see-through or
   glowing edges before showing.
3. **Check product colours look true.** A coloured cloth can cast onto the
   product (Chicken Munch's kraft bowl came out blue-grey). Fix only that
   object's cast (gen/kraft.py is the worked example), never the food.
4. **Label every contact by what it does**: "WhatsApp or call", "Call only,
   no WhatsApp", "Text". Ask the owner which number takes what; never assume a
   number has WhatsApp.
5. **Check the currency sign renders in the heading font.** Some display faces
   have no ₪ and fall back to a broken glyph: set the sign in the body face
   (`<span class="sym">`, Elisheva's page).
6. **One photo per kind, from everything the owner sent.** Look at all of
   them on one numbered sheet, skip duplicates (the same photo sent three
   times), and ask about any photo whose kind is not clear before naming it.
7. **Screenshots as photos**: crop at the screenshot's real resolution (scale
   the boxes by its width), take only the photo area, and ask the owner for
   the originals in the first message.

## 3p. No two businesses look alike, and builds start from the starter (Tzvi, 19 Oct 2026)

Tzvi: "make sure that businesses don't come out too similar." Nails by
Elisheva first came out with nearly Aidy Yaniv's fonts (Cormorant Garamond, a
script, Jost), and Chicken Munch shares Anton with Michal Yodaiken.

1. **Start from `scrollcraft/starter`** (README there): `fetch_business.py`
   pulls the record and every photo onto one numbered sheet in one command;
   `sitekit.py`, `site.css` and `site.js` give the menu bar, phone menu,
   footer, phone bar, contacts labelled by what they do, owner-filled gallery
   and questions. The starter is how the site works, never how it looks.
2. **The look is chosen fresh for each business** from its own logo, photos
   and menu, and written into `scrollcraft/fingerprints.json` (hero,
   signature, nav, close, layout, ground, own_colours) before any section is
   built.
3. **`node scripts/check-fingerprints.mjs <build>` must pass** before the
   page is shown and again before it is published: no heading face shared
   with another site, no shared body face plus script, no two brand colours
   alike (unless they are the business's own), and the design different on at
   least 4 of 6. On a clash the new site changes; an existing site is never
   changed to make room.
4. **Effects are checked too** (Tzvi, 20 Oct 2026: "we already have rules to
   make effects different, like buttons and arrow effects, so why do you keep
   making everything so similar"). Rule 3c said to search fresh for every
   effect, but nothing checked it, and all nine live pages faded their
   sections in the same way, most with the same hover lift and arrows; The
   Whipped Cup's steps then lit up one by one as you scroll, as on other
   pages. Each site lists its effects in `fingerprints.json` under `effects`,
   one id per kind (button, link, tile, reveal, steps, price, heading, plus
   any `other`), ids from `_effects` (the effects library's B, L, T, P, H codes
   and ours). Two sites may share effects worth 2 points (Tzvi: "it's ok if 2
   effects match"); an obvious effect, one a visitor sees without hunting for
   it (marked `loud`: how sections appear, how steps are shown, heading
   animations, scenes), counts 2, a quiet one (a hover, an arrow, how a price
   is set) counts 1. So two quiet effects may match, or one loud one, never
   more. A new effect gets a new id in `_effects`. CONCEPT.md's `## Effects`
   says where each one came from (3q).
5. **One small touch only this business would have** (Tzvi, 20 Oct 2026, on
   The Whipped Cup's cloud for a mouse pointer and Elisheva's sweep in the
   chosen polish shade: "we need to do more unique things like that"). Taken
   from their product, tagline or craft, never a stock effect: CONCEPT.md's
   `## Effects` has a `- touch:` line, and check-concept refuses it missing.
6. **Fits on one screen is measured, at six sizes** (Tzvi, 20 Oct 2026: "not
   everything is fitting on one screen, wasn't that already a rule"). Rule
   3c.12 had no check, and The Whipped Cup's sections came out up to twice a
   laptop screen's height. **The six screen sizes, the one list every rule and
   script points to:** laptops 1280x650, 1440x900, 1536x753 and 1920x1080,
   phones 390x844 and 360x640 (the sizes `scripts/check-fits.mjs` uses; other
   scripts may add more, these six are always included).
   `node scripts/check-fits.mjs <urls>` must pass for every page: each section
   fits below the menu bar at the laptop sizes, and no photo is taller than the
   screen at any of the six. To make it fit: cap a photo by the screen's height
   (`svh`), a big headline too (`min(clamp(...), N svh)`), and put a main
   tile's photo beside its words rather than words under a tall picture. Held
   screens: 3a. A photo from a phone is never blown up past its own size to
   fill a wide screen (her 1170px photo filled 1920px and looked zoomed in).
7. **Similar items look the same way** (Tzvi: "part of a great website is
   consistency"): if one flavour's thumbnail is one jar, every flavour's is
   one jar; a list where pointing at an item changes a big photo changes it
   for every item.

## 3q. The concept sheet, checked at publish (Tzvi, 19 Oct 2026)

Tzvi: "we need originality like this in our pages, you need to use our inspo
sources better, why are you making bland websites and not following our
rules." The originality that worked came from the business's own words (The
Whipped Cup's "your cup, your cloud" became a walk on the clouds), and the
bland versions were built without opening the saved inspiration at all.

Before any section is built, the build folder gets `CONCEPT.md`: three or
more opening ideas, each citing a saved effect from `docs/inspo` by its
picture; one idea marked "Own:" from the business's own words or world (its
tagline, its process, its place); which was chosen and why; the five wow-gate
answers (3n); a `## Effects` line per kind with its id and where it came from
(a named 21st, Mobbin or Inspo search, or a `docs/inspo` picture); and the
passing line from check-fingerprints (3p).
`node scripts/check-concept.mjs <build>` checks it, and `publish-page.mjs`
refuses to put a NEW page live without it. Read the saved effects for the
kind of business (the part files' "For ..." sections and pictures) every
time; never design from defaults.

CONCEPT.md is also where the style sheet (3g.1), the effect budget (3f.2) and
the effect sources (3g.17) are written. `BRIEF.md` is retired: CONCEPT.md
replaces it everywhere (Tzvi, 22 Oct 2026).


## 3r. Checked by the scripts, then by someone else, before anyone sees it (Tzvi, 20 Oct 2026)

Tzvi: "make sure the rules will prevent this in the future, why didn't the
existing rules prevent this." On The Whipped Cup he found a photo blown up
until it looked zoomed in, sections twice a laptop screen's height, one
flavour shown as one jar and the others as four, a big photo that did not
change with the flavour, and package choices he could not find. Fits on one
screen (3c.12), one photo per kind (3o.6) and choices under their item (3l)
were already rules. They did not prevent it because rules held in the
builder's head drift, and the builder then graded its own work (the same
cause as 3n and 3q). So every rule that can be measured is a script, and
the rest is looked at by someone who did not build it:

1. **Scripts, all of them, on every page of the site**: `clipped.mjs`,
   `readable.mjs`, `scripts/check-fits.mjs` (fits the screen at the six sizes
   of 3p.6; no photo shown past 1.35 times its size),
   `scripts/check-fingerprints.mjs`, `scripts/check-concept.mjs`.
   `publish-page.mjs` refuses a new page that fails check-fits,
   check-fingerprints or check-concept.
2. **An independent review**: a Sonnet subagent that did not build the page
   uses it at laptop and phone size against `docs/page-review-checklist.md`
   (consistency, things respond the way they look, every choice under its
   item, photos, the screen, their facts, the one touch). The builder fixes
   every FAIL and the reviewer looks again.
3. **Only then** is it shown to Tzvi. A rule Tzvi has to point out twice gets
   a script or a checklist line the same day.


**Every rule, every site, before anyone sees it (Tzvi, 22 Oct 2026: "why do we keep skipping rules").**
`docs/rules-checklist.md` lists every rule that can be judged on a finished site, each with how it is
checked (a script, or what exactly to look at). Each build keeps a `RULES.md` answering every line
(`pass:`, `n/a:` or `fix:`, with what was looked at), and `node scripts/check-rules.mjs <build>` must
pass before a site is shown to Tzvi or the owner or published. It fails when a line is missing or
unanswered, when a fix is open, or when the site changed after RULES.md was written. Briefs to helpers
point at the whole checklist, never at chosen sections. A rule added here is added to the checklist the
same day, with its check.

## 3s. Feels like a real, high-end website, and checked for glitches (Tzvi, 20 Oct 2026)

From nine design videos Tzvi sent ("learn and tell me how we can apply them to our pages to make them
feel like real websites that are professional, modern, high end and beautiful"; notes in
docs/ui-videos/notes/2026-10-20-nine-videos.md). He approved all of them ("yes add them all").

**It feels finished (the craft)
1. Everything you can press answers within 100 ms: a pressed state (slightly
   smaller or darker) and a hover state, cancelled if you scroll away.
2. Nothing jumps: late photos and content fade in over 200 to 400 ms into
   space already kept for them; choosing something never moves the layout.
3. One shadow, the soft kind (the single home of the shadow rule; 3c.9 and
   3i.1 point here): light, about 3 px down, about 30 px blur, no spread,
   tinted with the background or brand colour, never black or a dark default.
4. One left edge: headings, text and buttons line up on the same margin.
5. A name is at least 1.25 times the size of the line under it, and heavier.
6. Controls that do the same job look the same (height, corner, style).
7. Buttons in sentence case; dividers pale; no "Price:" style labels; body
   lines 1.5 to 1.6 apart; contrast never lowered to look soft.
8. Buttons over a photo sit in a soft container, checked on a light and a
   dark photo.
9. One colour per meaning, everywhere (the kosher tag looks the same on
   every item; it does not count toward the two mentions of the certificate
   in 3b).
10. The picture appears the moment a thing is named.

**It sells like a premium brand (honestly)
11. One true sentence beside the price says why it costs that (handmade,
    the ingredient, the time it takes), not hidden on an About page.
12. The maker and their real work right after the opening; at least one
    real photo of the product in use or a real setting.
13. Proof sorted by worry: it works, people like me buy it, they will
    deliver; each beside the worry it answers. A guarantee states its limit
    (the limit makes it believable).
14. Real numbers big (three times the body size) with a one-line label, only
    numbers the owner gives.
15. A choice changes the big photo to that choice, with one line about it
    ("light, not too sweet") that also works on a tap.
16. Fewer choices first: a plain question ("How many coffees?", "How many
    people?") before a long list; the first or middle option is the sensible
    one, chosen on purpose.
17. Every option shows its consequence (price, time, slot) and the button
    names it ("Book Sat 11:30", "Add 2 jars, ₪96").
18. Not available shows the nearest real alternative; every choice list has
    a way out ("None", "Other", "I'm not sure").
19. The same promise line and photos on the link preview, the home page and
    the shop.

**Never (the videos' sales tricks)
Invented reviews or counts ("4.9 from 221", "500+ sold this week"), fake
scarcity or countdowns, logo walls, slogans that promise
a journey. Already banned (3j); these videos are full of them.

**Prices, the way shops show them** (Tzvi, 20 Oct 2026: "on The Whipped Cup by
the prices there's too many words"): a real saving is the real separate price
struck through beside the price and a two or three word percentage badge
("25% off"), as 3j says, never a sentence; the button carries the offer and its
price, so no line explains it again. Prices are in the main text colour, bold
and large (3g.3).

**Checked, not remembered.** `node scripts/check-site.mjs <every page>` fails: BROKEN (script or
console error, a 404, a dead link between pages), SHIFT (layout moves after loading or when a choice is
tapped), GLYPH (a character the fonts lack, like ₪ or →: load a face that has it, or draw it), STATE
(a button with no hover or pressed state), TAP (under 40 px on a phone, or overlapping), ALIGN (text
2 to 12 px off its section's edge, same-kind buttons of different sizes, a card name under 1.25x its
line), OVERLAP (two lines of words cover each other anywhere, pinned scenes included, at 1366x768,
1280x720, 1440x900 or 390x844: the common short laptops, where Michal Simkin's quotes sat on her heading
on 26 Oct 2026 while every check looked at 1440x900), PHONE (sideways scroll, the bottom bar over a button at the end), MEDIA (a photo over 600 KB,
an image without its size, a video without a poster, words left hidden with motion off) and FLOW (an
empty form that sends or says nothing, a filled one that sends no message or not the shown total).
`node scripts/check-motion.mjs <pages>` fails a choice that jumps, flashes a blank or old frame
(also on two quick taps), or does not take its colour. Both run with the other checks (3r) before
anything is shown, and publish-page refuses a new page that fails them.

**Studying a video** (Tzvi: "how can you go through videos better to catch everything"): see
docs/ui-videos/HOW-TO-WATCH.md. Every change a video shows becomes a line in a before-and-after
table, and every line is then checked against every page we are building, fixed or marked not
relevant, the same day.

## 3t. Each site looks like real sites of its own category (Tzvi, 22 Oct 2026; replaces "sections change worlds" of 21 Oct)

Tzvi, after we gave every site Moto Card's dark full-bleed look: "go through [Awwwards' Sites of the Day] to see how different business categories make websites ... because not all websites look like the moto one." Study, with screenshots of every site and 3 to 5 points per business of ours: docs/inspo/awwwards-anatomy-2026-10-22/ (food, shops, events-sports-homes, services) and docs/inspo/moto-card-2026-10-21/.

**Every site declares its category** in CONCEPT.md and on every page (`<meta name="site-category" content="...">`) and follows that category's pattern below. A business that fits two takes the one its customers buy by (a bakery with a shop counter is `place`; one that only delivers is `food-shop`). What all categories share: a real opening that is an event (3h, 3g.13), one action identical everywhere (5b.2), the product hero shot for product photos (section 8), a real footer (a last big line, the button, link columns, contact), and real details only (prices, sizes, hours, streets).

| Category | Our sites | Ground and colour | Pictures | How it sells | Type and density |
|---|---|---|---|---|---|
| `food-shop` (food and drink sold as products) | The Whipped Cup, Bun Intended, Chicken Munch, L.A. Cholent, The Brown Box, LS Fruit Platter, Blazin' Boards | Bright or warm, light ground; colour changes **per product** (each flavour, box or size brings its own colour room), not per section. A darker warm ground only for a premium dark brand (Blazin' Boards). | The packed product as a product hero shot or a clean cut-out on a flat colour; lifestyle photos only in the story band. | You can buy from the first screen: "Order" in the bar, and every product card carries photo, name, size or servings, price and an Add button. Ingredients, allergens and kosher in small type. | One loud heavy family, or one thin serif; short text. A founder or kitchen story band mid-page with the owner's real photo. |
| `place` (bakery counter, cafe, restaurant, venue) | Lechem Emek | One ground for the whole page (3 of 5 real sites), warm or moody. | Atmosphere: the room, dishes on the table, the people; framed or round, full-bleed only at the top. | "Order" or "Reserve" always in the bar; hours, address, phone and map near the top; the menu as a plain text list with prices. | Serif headings, more text than a shop. |
| `fashion-shop` (clothes, gifts, products to browse) | RS Modest Activewear, The Gift Boutique | White or beige throughout, at most one accent colour. | Product grid on or just below the first screen (3 to 4 across), studio shots on one plain ground; one or two lifestyle photos for mood; an occasion row for gifts. | Name, size and price under each item, sold-out shown honestly; small button in the bar repeated at the product; a "how it works" strip and FAQ (delivery, returns). | Sans or thin serif, small calm type, airy. Shop address and hours before the footer. |
| `beauty` (nails, hair, wigs, care) | Elisheva, Michal Simkin | Warm cream or white throughout. | Close-ups of real work (hands, hair), photos inside the cream rather than alternating full screens; the owner's portrait beside her own words. | "Book" fixed in the top bar all the way down; treatments as rows or image pairs with "from" price and duration; a booking page with a date picker. | Thin large serif, tiny labels, one paragraph per section. |
| `events` (decor, event services) | Michal's Balloons | Colour may change per section, taken from her real work. | Open on photos of real past events; small photos in the body; past events as a strip or dated list. | "Ask for a quote" in the bar and the first screen; packages as rows with a "from" price; how far ahead to book. | Short page, one family, capitals for headings, little text, a giant name in the footer. |
| `trainer` (sport, fitness, classes) | Michal Yodaiken | Black and white alternating, one accent colour. | People in action, tight crops, never studio on white. | Booking on the first screen (a card or button); 3 to 4 offer cards with prices side by side; a proof block (numbers, named quotes, certificates); FAQ and a short form. | Heavy capitals. |
| `service` (home and local services) | KasherMyBnB, Noa Levi | Light ground for facts, one dark section for the story; one accent. | The real person and the real work (kitchens done, rooms before and after), never a mood film alone; finished work as a grid. | Line one says what and where; 3 to 6 named services or numbered steps, one picture each; a number block (jobs done, cities) only if true; one button to a call or quote form that says what to send. | One typeface, plain and direct. |
| `rental` (our listings) | MyIsraelRental listings | Light and warm for holiday homes, one calm tone for premium long-term. | Big photos, a plan or distance line, the owner as a person (round photo, first name). | A booking calendar or "Ask about these dates" on every listing; a "Book" pill always in the bar; the listing in numbered parts with real numbers (rooms, beds, metres, distance, price). | Short: one sentence per room, big facts. |

**The owner's own look wins over the category's ground** (Tzvi, 22 Oct 2026: Chicken Munch's owner wanted a dark theme): if the owner asked for dark or light, or their brand is plainly one, keep it and follow the rest of the category's pattern (how it sells, pictures, type) on that ground. Write the owner's wish in CONCEPT.md. Moto Card's model (dark, full-bleed photo screens alternating with white rests) fits only `trainer`, a moody `place` or a luxury brand; it is never the default.

scripts/check-site.mjs reads the page's `site-category` and checks its pattern: CATEGORY (the meta is missing or unknown), BUY (`food-shop` and `fashion-shop`: a price and an Add or Order control are visible within the first two screens), WORLDS (`trainer` only: at least a third of sections are picture and no three plain sections in a row) and OPENING (every category: the first screen is an event, 3h; `events`, `beauty`, `place` and `trainer` also open mostly on a picture or film).

## 4. What is reported to the owner instead (content gaps)

Some things are missing because of the business's data, not the page: no reviews
yet, no founding year, a service with no Hebrew name, no action chosen in the
brief. All three options would share them, so **they never reject a page**. They
come back as `content_gaps` and are what the owner is asked to add, most useful
first. The page itself must still look deliberate without them: "Ask for a
quote" instead of a missing price, no reviews section instead of an empty one.

## 5. How to write

1. **Their words first.** Reuse the owner's own phrasing from their description
   and note wherever it works. We tidy; we don't replace their voice.
2. **Specific over generic.** "Sourdough and challah in Beit Shemesh" beats "Quality
   baked goods". A sentence has to be about this business.
3. **Headline formula: what the customer gets** (their result, in the owner's
   words; Tzvi, 22 Oct 2026). At most 10 words (a ceiling: the first screen
   follows 3g.13, with where the business is in the one short line or the
   small label). The name is already on the page.
4. **The lede says the one thing a visitor needs to act.** How to order, by when,
   what a first visit costs, which areas they cover. One or two short sentences.
5. **One emphasised word at most**, in the text colour, never the accent
   colour. See 3g.3.
6. **Plain words.** Say it the way the owner would say it to a customer. No
   marketing voice, no exclamation marks, no long dashes.
7. **Hebrew is written, not translated.** Natural Hebrew word order and phrasing,
   plural and gender forms right, the same facts as the English. A Hebrew page is
   judged in Hebrew.
8. **Address the visitor as "you"**, never the business's customers in the third
   person. On the page the business speaks as "we" or in its own name.
   **Never "they", "them" or "their" for the business itself** (Tzvi, 7 Oct
   2026): the page is the business talking about itself. "We confirm your board
   and the day", never "They confirm the board"; "You pay us directly", never
   "You pay them the way they take it"; "Our full price list", never "Their
   price list". That covers labels, form hints, error messages, captions, alt
   text and footers too. Before a page is shown, search its visible text for
   they, them and their, and keep only those about the visitor's own guests.
   **And the English has to make sense** (same day): read every line aloud as
   the owner would say it to a customer; a line written from our side ("as the
   business sets them", "between you and them") is rewritten from theirs.
9. **Strengths only if backed.** At most two, and a checkable one (kosher,
   experience, licensed, English) appears only with its proof.
10. **A professional voice, always** (Tzvi, 6 Oct 2026). The page speaks the way a
   respected business would in print. Describe the customer's problem in neutral
   terms; never tease, scold or talk down to the visitor, and no slang or jokey
   asides. "You are nowhere near done" became "Thursday night, with hours of
   preparation still ahead"; "Guess the spices" became "Balance the seasoning".
   Before showing, read every line aloud as the owner and ask: would they print
   this on their menu? If not, rewrite it.
11. **Short labels are still full phrases** (Tzvi, 6 Oct 2026). A proof line or
   badge may be brief, but it has to read as a phrase a person would say, with
   the relationship spelled out. "Kosher, Rabbi Weiner" left out what the rabbi
   has to do with it; it became "Kosher, hechsher from Rabbi Weiner". "Jerusalem,
   all over Israel" mashed two facts together; it became "Made in Jerusalem,
   delivered across Israel". Use the category's own term (hechsher, licensed,
   certified), a verb for each place (made in, based in, delivered to), and the
   word people actually use with it: a hechsher is "from" a rabbi, not "of".

## 5a. Lessons from the practice pages

What Blazin' Boards, Lechem Emek and Michal Simkin taught, in the order they matter:

1. **Find what the business actually has before choosing a look.** Their photos,
   their numbers, the one fact that is really theirs. Blazin' Boards sells boards in
   sizes; that became the page.
2. **The product performs, not the camera.** Movement shows the thing they sell
   (amended 16 Oct 2026, §3h: the camera may travel when it follows the product's journey).
   Zooming for its own sake "isn't doing anything" (Tzvi on Blazin' Boards rev 2);
   the jar rolling as the page scrolled was the part that worked.
3. **People, work and place are shown in their own photographs.** "A generated
   face here would be a lie about a client" (Michal Simkin). Rev 3 of Blazin'
   Boards used the owner's own photos. For what may be generated, see section 8.
4. **Only their numbers**, never round marketing ones.
5. **No blank screens.** Every screen shows something of theirs.
6. **One signature idea, and it is theirs.** The test: could a visitor describe it
   to a friend in one sentence? (Boards growing through real sizes with a ruler and
   their prices; real clients' own before and after; one scroll taking a bakery from
   night to dawn.) Never carried over to the next business.
7. **One peak per page.** One moment gets the most room and quiet before it; a page
   with three peaks has none. The ending resolves on the action, never fades out. This (with 6) is the
   single home of the one-idea, one-peak, one-signature rule. A 3h film opening
   IS the page's one peak and one signature scroll section; everything else is
   an accent (3f.2).
8. **Check what renders, not what was written.** An independent pass on Blazin'
   Boards found a bar that measured 102px where 84 was assumed, hiding content, and a
   button that went to the top of the page and looked broken.

## 5b. Design craft (taste-skill, scroll-craft, the frontend skill)

1. **The first screen is 3g.13, the single home.** Elsewhere at the top of a
   page (an inner page, a section), at most 4 pieces of text, the headline at
   most 2 lines, the line under it at most 20 words.
2. **One button, one label** (the single home; 3b.3, 3e.3, 3k.2, 3t.4 and
   section 8 point here). The main button has the same words and the same
   destination everywhere: the header bar, the sections that sell, the phone
   bar and the footer. Over a photo the bar's version may be the outline
   style. If the button says "Order", it says "Order" everywhere, not "Buy" in
   one place and "Get yours" in another. The destination is the quickest way
   to order (section 8). The same one-wording rule covers every other purpose.
   - **End on what the customer gains** (Tzvi, 7 Oct 2026). A finish line, last
     step or closing moment names the result for the customer, never just
     "done", "finished" or "complete"; use the owner's own benefit words. The
     workout page's session clock said "Session done" at 30:00; it says "A
     stronger, healthier you", from her own description.
   - **Every line makes sense where it sits.** Read it in its place: it must not
     look like the next item of the list above it. "Or WhatsApp me" under four
     places to train read as a fifth place.
   - **"Or" and "prefer" only when the other choice is on the page.** A contact
     offered as an alternative needs a visible, named first option. When it is
     the only one, state it: "WhatsApp Michal: 07563 299474", not "Prefer
     WhatsApp?" (a button that silently opens our chat does not count as a
     visible option).
3. **Text over imagery** (the single home of this rule). Words sit on the
   picture, on a photo or film, with a soft shade along the edge the words sit
   on, contrast measured on the brightest frame (`readable.mjs`); a small solid
   card is allowed; big dark pools, full-frame darkening and frosted glass are
   not. A plain strip under the photo only where the picture is too busy for
   words to sit on it. 3a, 3e.12, 3g.8, 3h.5, 3h.9, 3t.2 and 0b.7 point here.
4. **No default "premium" palette** (warm cream with brass or oxblood) and no
   AI purple. The palette comes from their logo and photos.
5. **No fake screenshots, no generic names or faces, no too-perfect numbers.**
6. **No scroll cues, no "01/06" counters, no label above every section.**
7. **The maker doesn't grade its own work** (design-loop). The checker grades the
   rules; a separate critic, not the generator, judges the rest.

## 5c. Persuasion, and only the honest kind (page-conversion-review)

Each is backed by several independent sources; the count is in brackets.

1. **Repeat the promise that brought them** (4). If a flyer, a QR code or a listing
   said "challah for Shabbat", the headline says "challah for Shabbat". Checked as
   `congruency`.
2. **Reassurance right beside the button** (5): see 3b.2.
3. **What happens next as steps, not a paragraph** (4): "Order by Thursday, collect
   Friday morning".
4. **One job per page** (4). One leading action; the rest visibly secondary.
5. **Specific real numbers beat round ones and beat adjectives**, and never a range
   where one number exists. A total on a button only when it is real.
6. **Friction that filters or invests helps; friction that taxes hurts.** Asking the
   event date helps a caterer; asking for an account before a question hurts.
7. **Never the dark patterns**: see the `urgency` and `claims` rules (section 3).

## 6. Playbooks for the most common businesses

The categories with the most businesses on the live site on 23 Sep 2026 (public
pages: 48 services from 41 businesses; 165 rentals). The number in each heading is how many businesses offer that category. Each playbook says what a
visitor is deciding, what leads the page, the proof that matters, the action, and
the mistakes to avoid. The lead block and must-have blocks are checked
(`playbook`); the rest guides the AI.

Examples are illustrations for an imaginary business, never text to reuse.

**Recipes** (24 Sep 2026): each playbook now names the page recipe it uses,
from the category study of real sites in `docs/ai-page-builder-spec.md`
("Category study (Inspo, Sep 2026)"). The recipes are data in
`backend/utils/page_recipes.py`; the brief's `showing` picks one, and the
playbook still decides what may lead. What the study found that holds for
every category: the first screen answers the four questions in one tight
stack, proof touches the main button, one solid button per screen, and with
few photos the facts carry the page rather than a padded gallery.

### Shops and products (16 businesses: bakeries, dips, boards, gifts)
- **Deciding:** what it looks like, what it costs, whether it's kosher, how to get it.
- **Lead:** the catalogue with photos and prices (`services`), or a photo gallery
  when there are at least 3 photos. **Must have:** services.
- **Proof:** kosher certificate (food only), reviews.
- **Action:** order when there is a store listing, else message.
- **Dials:** grid imagery, normal or loud prices unless premium.
- **Avoid:** "fresh daily", "delivery" or "free delivery" unless they said so;
  kosher without a certificate; hiding prices they gave us.
- *Example headline:* "Sourdough and challah in Beit Shemesh".
- **Recipe:** `catalogue`; a food shop with a kosher certificate gets `food`.
  Study: the products come straight after one photo and one line, three to
  eight of them in the first screen, under a plain heading. The size ladder
  only when three products are measured.

### Personal care (5: hair, beauty, spa, therapy)
- **Deciding:** results, trust with their body, who does it, how easy it is to book.
- **Lead:** services with durations and prices, or their own photos. **Must have:** services.
- **Proof:** reviews, years in business, verified.
- **Action:** book.
- **Dials:** calm: airy or balanced, quiet or normal prices.
- **Avoid:** medical or result promises ("cures", "heals", "anti-aging results");
  before/after images that aren't theirs.
- **Recipe:** `services`. Study (booking-app profiles for salons): each
  treatment as a compact row with its duration and price; the rating or a
  credential touching the Book button.

### Home services and repair (5: handymen, electricians, plumbers)
- **Deciding:** can they fix my problem, how soon, do they cover my area, are they licensed.
- **Lead:** the jobs they do (`services`, list) or the facts (areas, hours, licence).
  **Must have:** services and facts.
- **Proof:** licence number, years, reviews.
- **Action:** message for a quote, or book.
- **Dials:** balanced or packed, grotesque type, quiet prices on a quote brief.
- **Avoid:** "24/7", "emergency", "same day" unless they said so; "licensed"
  without a licence number; "insured".
- **Recipe:** `services`, facts first. Study: with no photos, the sparsest
  real handyman profiles still read as deliberate because the facts carry
  them (licence, years, hours, languages) above a plain list of jobs. With
  many jobs, the headline names two and says "and more".

### Events and catering (4)
- **Deciding:** the food, the kosher level, whether they do my size of event, the date.
- **Lead:** their food photos (`gallery`, 3 or more) or the menus. **Must have:**
  services and facts.
- **Proof:** kosher certificate, reviews.
- **Action:** message with the date, or book.
- **Dials:** full-bleed imagery with a cover photo, normal prices.
- **Avoid:** "any size event", guest counts, kosher level beyond the certificate.
- **Recipe:** `food`, whatever `showing` says. Study: the headline names the
  food, not a mission; the certificate sits as its own small band right
  after the lead (our facts band, second) and in the proof line, never
  crowding the button. No site studied showed kosher; organic and allergen
  labels were the nearest pattern.

### Cleaning services (3)
- **Deciding:** what's included, the price, reliability, the area.
- **Lead:** services with prices, or facts. **Must have:** services and facts.
- **Proof:** reviews, verified, years.
- **Action:** book.
- **Avoid:** "insured", "background-checked", "eco products" unless they said so.
- **Recipe:** `services`.

### Health and fitness (2: trainers, classes)
- **Deciding:** who the trainer is, the kind of sessions, where, when, the price.
- **Lead:** services, or their own photos. **Must have:** services.
- **Proof:** reviews, years, licence where relevant.
- **Action:** book.
- **Avoid:** weight-loss or health promises, medical words, body-image pressure.
- **Recipe:** `services` (`one-thing` for a trainer with one session type).

### Travel and tourism (2: guides, tours)
- **Deciding:** the route, the language, how long, the price per person, a licensed guide.
- **Lead:** photos (`gallery`, 3 or more) or the tours. **Must have:** services and facts.
- **Proof:** licence number for "licensed guide", English among their languages, reviews.
- **Action:** book or message.
- **Avoid:** "licensed guide" without a licence; famous-landmark photos that
  aren't theirs; group-size or "best views" claims.
- **Recipe:** `one-thing` for one tour, `services` for several. Study: every
  tour page shows what is included and the route as steps; we have no block
  for either yet (spec, gap 4).

### Rentals (165 listings: 104 long-term, 56 vacation)
Not buildable yet: the block library has no property block (open decision 2).
When it does:
- **Deciding:** photos, price per night or month, location, availability, rules.
- **Lead:** photos, then price and dates.
- **Proof:** verified stays (the new reviews), verified owner.
- **Action:** book or message.
- **Avoid:** distances ("2 minutes from the Kotel") and "luxury" unless the owner
  wrote them.
- **Recipe:** `properties`, which today works only when a host's stays are
  business listings. Study: every reference centres the units (photo, price
  with its period, rating) and puts the host after them, with the host's
  proof directly above "Message". The property block needs: photo, title,
  price per night or month, rooms and size, stay type, one Message action.

### Any other category
- **Lead:** services, facts or gallery. **Must have:** services.
- The hard rules and the writing rules apply unchanged.

## 7. Choosing the three options (automatic page builder only)

This section is for the automatic page builder only. A hand build picks one
direction itself, says why in one line, and puts no options page to Tzvi or the
owner unless asked (3c.1, 8a).

Give the owner a real choice between three directions, each true to the brief:

1. **The brief taken straight:** the dials briefToTheme() would set, the playbook lead.
2. **Photo-led:** when there are enough photos, a gallery or full-bleed lead;
   otherwise a different lead from the playbook.
3. **Words-led:** facts or services first, denser or quieter, a different type pairing.

Each has its own headline. None breaks a hard rule. Built as
`page_recipes.options()`: words-led takes the next type pairing, one step
denser, and the services as a list.

**Nothing the AI makes goes live on its own** (Tzvi, 23 Sep 2026). The pattern
Shopify and Wix use: what the AI makes is a draft. The owner picks one of the
three, previews it as a customer sees it on a phone and a laptop, and only a
**Publish** button puts it on their page. The live page stays untouched until
then. Every published version is kept, and one tap puts an earlier one back (P7g).
Publish is offered only for a page that passes the check.

## 8. Photos, video and the tools

**The generated-media policy** (the single home; 3c.4, 3e, 3g.15, 5a.3 and
3t.2 point here). Tzvi's rules, newest first:
- **Food in motion is generated only in the full-screen opening film (3h), and
  nowhere else** (22 Oct 2026). The conditions are in 3o.1. Everywhere else the
  food is the owner's real photo.
- **The generator is Higgsfield, every time**, for real-material effects and
  for generated media (13 Oct 2026, the newer rule): the MCP connection while
  building, the API when it refuses. kie.ai only if Higgsfield cannot do it.
- Otherwise generated or edited images may go anywhere on the page, product
  cards and choice tiles included, without a label (8 Oct 2026), made as little
  as possible and from the owner's own photo where there is one.
- Never a generated person presented as their staff or customer, never their
  premises made up, no text baked into an image.
- The owner approves every piece before it can be used.

**A set of images reads as one shoot** (Tzvi, 8 Oct 2026). Category tiles,
product grids, any row of pictures side by side: the same camera angle, the
same light from the same side, the same plain background, the subject at the
same size and crop. That sameness is most of what makes a row look high-end
(the reference was adr.it's food tiles). Fourteen stock photos from fourteen
photographers, with their backgrounds cut out afterwards, never match:
different angles and colour, rough cut-out edges, mismatched shadows, slices
of plate left behind. Next to a real set they look cheap. So, in this order:
1. The business's own photos, if they were shot the same way.
2. Otherwise generate the whole set in one pass from one style preamble,
   reused word for word in every prompt (Higgsfield). Product pictures are
   edited from their own photo, never made again from words alone (3h.12).
3. Stock only as a last resort, and only from one photographer's matching
   series.
Look at the whole set as one contact sheet before it goes on a page, and
redo any image that breaks the set. Food for a kosher audience is
kosher-appropriate in every image: no meat with cheese or cream, no
shellfish, no pork.


**The product hero shot** (Tzvi, 22 Oct 2026, after 16 advertising product photos: "do you see a pattern or a rule you can make for showing products ... we should make this a rule"; pictures in docs/inspo/product-shots-2026-10-22/). Every main product picture (a hero, a size or flavour photo, a product card) is set up the way those adverts are:
1. **One product, the hero.** Large, centred or on the thirds, pin sharp, seen at eye level or a little below, turned slightly (three-quarter), never flat from straight above unless every picture in the set is.
2. **It stands on something from its own world.** A stone, a block of wood, moss, a rock, marble, a board: a plinth that lifts it off the ground. Never floating in empty space, unless its ingredients float with it.
3. **Its own ingredients around it.** The props say what is inside: mint leaves round a mint cream, cinnamon and vanilla round an amber perfume, pineapple slices round a pineapple drink, honey round a honey balm. For our food: the raw fruit beside a platter, coffee beans and cream by a coffee jar, cinnamon sticks by a bun. Only what is really in it.
4. **One colour story.** The background is a soft gradient of the product's own colour (or its complement), and the props share that palette. No second loud colour.
5. **One light.** A warm key light from the side or behind, a soft glow or rim on the edges, soft shadows; the background softly out of focus.
6. **Still or caught mid-air, one or the other.** A calm still life for luxury, care and gifts; ingredients or a splash frozen mid-air for energy (drinks, snacks). Never both in one picture.
7. **The product is theirs, exactly.** Their real item, edited from their own photo (relit, set on the plinth, props and background added round it), never redrawn from words. Check every piece against their photo; redo any that changed (the Small platter lost its pineapple crown on the first try, 22 Oct). **The reference is a close crop of that one item**, never the whole photo of several, and the prompt names the item's own traits to keep (its shape, colour, glaze, how it was made) and changes only the camera, light and setting. Never words that idealise it ("perfectly centred", "a clearly readable spiral", "crisp neat lines"): the generator makes it look like a stock photo instead of theirs. Bun Intended, 24 Oct: the whole box photo plus a prompt written for the page's design gave a paler, flatter, perfect-spiral bun in a square tray; a crop of their bun and "keep it exactly as it is, only change the camera" gave theirs. Show it beside their photo before using it.
8. **A set shares one scene** (the rule above): every size or flavour gets the same plinth, props, light and angle.

Prompt shape that gives this (one line each, reused word for word across a set): the product and its plinth; the ingredients round it; the background colour; the light; the camera (eye level, three-quarter, shallow depth); "photorealistic advertising product photography, sharp product, no text added".


**Right the first time, before any paid generation** (Tzvi, 24 Oct 2026, after the Bun Intended bun took two tries: "make a rule that will help us get it right the first time so we dont waste credits and waste time"). Before the first credit is spent, write `gen/<name>-brief.md` in the build and check it against these, then generate once:
1. **The reference is cut first**: a close crop of the one item to show (their exact bun, platter, board), saved beside the brief. Never their whole photo of several items.
2. **Describe what the crop shows**: look at the crop and write the item's own traits as they are (shape, height, colour, how it is rolled, poured or cut, topping, container, how many). The prompt keeps all of them, word for word.
3. **Change only what the page needs**: the camera angle, the light, the setting. Say "keep it exactly as it is, only change ..." and name the change.
4. **No idealising or design words**: never "perfect", "neat", "symmetrical", "clearly readable", "crisp lines", or what the page will do with it. Those make a stock photo.
5. **Match the set**: if other shots of this business exist, reuse their setting and light lines word for word (point 8 above).
6. **Stills before video**: a 2-credit still is checked and approved before a 10-credit clip, and the clip starts from that approved still.
7. **Compare before showing**: put the result beside their photo and check each trait from step 2; any that changed is fixed in one redo that names only that trait. Then show Tzvi the pair.
8. **Log it**: the brief keeps the reference, the exact prompt, the model and the result, so the next shot for that business reuses what worked.
9. **Their words are pasted, never generated** (24 Oct, the hero-shot run: the tub read 50GRAM, then 60GRAM; a lid had the wrong phone number twice; "Stir wall"; invented tag words). Read every word on the result at full size against their photo. When any word differs, cut their real label from their photo and paste it on in code (perspective-free when the label faces the camera); a second generation to fix small print failed three times out of three.
10. **2k from the first try**: the default 1K made every small label unreadable and cost a redo; 2k is 2 credits.
11. **The first shot of a set is the scene for the rest**: pass it as the second reference ("the first image is the product, the second is the scene") rather than describing the scene again in words (that drifted every time). Its flaws copy too, so it is approved before the rest are made.
12. **Keep their camera**: a photo taken from straight above stays overhead for the whole set (tilting it made a bun and a tub stand on their edge); a side photo stays at eye level.
13. **Too small to edit**: under about 500 px, or a label that cannot be read in their photo, ask the owner for a photo (message-to-owner.md) instead of generating (the 239 px gift boxes came back with invented tags and a different bowl).
14. **Look for their photos before saying there is none**: owner photos are often only in the main checkout (src/owner, untracked), not in a fresh worktree; search there and in their listing before asking.


**AI images and video** (Higgsfield). Tzvi, 23 Sep 2026: owners should be
able to look professional even when their own photos aren't, "a moist steaming
piece of meat being sliced" on Blazin' Boards (food in motion is now film-only,
3o.1). Two kinds, in this order:

1. **Enhanced from theirs.** Their own photos and clips made to look professional:
   relit, cleaned up, sharpened, or animated from their actual photo (steam rising,
   the knife moving). It is still their product, so it can go anywhere, including
   the product cards.
2. **Generated to make the page look its best** (Tzvi, 8 Oct 2026, replacing the
   earlier "never on the product cards": "change the rule that we can generate
   images so we can have pages look nicer"). The policy above says where.
   Start from what the business already has and generate as little as
   possible: a missing flavour or size is made by editing their own photo of a
   sibling item (their iced cinnamon bun, re-topped as espresso or chocolate), so
   the product stays theirs in shape, dough and light. Only items they really sell,
   in the toppings, sizes and colours they really make.

For both (the limits are in the policy above):
- Prompts respect the business. On a kosher business nothing non-kosher is in the
  frame and no meat with dairy; the Blazin' Boards prompts excluded dairy, pork and
  shellfish because the flyer carries a hechsher.
- Today the builder can place neither: images are references to their own uploaded
  photos only (open decision 5).

**Movement that copies a reference is built in code, not generated.** Generated
video reinterprets the reference on every render, so rerolling can't converge on
"exactly like this". Offer the code-built version instead.

**If it would look better as a generated clip, generate it** (Tzvi, 8 Oct 2026:
"make it a rule for future to do this to make things look realistic to have the
best effect", then "anything that would look better as a generated clip should be
generated"). For every moving piece, ask: would a filmed clip look better than
what code can draw? If yes, it is a generated clip, never SVG or CSS. Always yes
for real materials and anything whose realism is the point: glaze or chocolate
pouring and spreading, cream, sauce, steam, melting cheese, water, smoke, fabric,
food being cut, served or assembled, a product being opened or used. Food in motion
(glaze, cream, sauce, cheese, food cut or served) is generated only in the opening
film (3o.1); elsewhere the owner's real photo is used. Code stays
for what code does better: text, interface, layout, exact choreography copied
from a reference (above), and motion tied to scroll position or a counter. Code-drawn liquid reads as a tube and a fade however it is
tuned; the Bun Intended drizzle was built in code twice and both times "doesn't
look real, you don't see the texture spreading". How:
- Bracket the clip with their own product: the start frame is their item before
  (the plain bun), the end frame is their item after (the same bun, topped, edited
  from their photo). A start-and-end-frame model (MiniMax H3 Max, about 12.5
  credits for 5 s at 768p) fills only the pour in between, so the product stays
  theirs and the clip lands exactly on the still that the page shows next.
- Put both frames on the page's own background colour, so the clip sits on the
  page with no box around it. Locked-off camera, the item never moves.
- Code still does the choreography: when it plays (on a choice, on scroll), the
  swap to the still at the end, the layout. Reduced motion shows the still.
- Preflight the cost (get_cost) and generate one first; look at it before the rest.
- **Generated in Higgsfield, every time** (Tzvi, 13 Oct 2026: "whenever generating
  an effect like this ribbon or the cinnamon buns drizzle by bun intended we should
  generate from higgsfield"). Any real-material effect (a ribbon untying, a drizzle,
  a pour, fabric, steam) is made with Higgsfield: the MCP connection while building,
  the API when it refuses. Never drawn in code first to "try it", and never another
  generator unless Higgsfield cannot do it (then kie.ai). The Gift Boutique ribbon was drawn as CSS bars and a cartoon bow and
  read as fake ("doesn't look elegant, it looks fake"), the same failure as the
  Bun Intended drizzle.
- **Every generated motion shows the real physical process, and flows** (Tzvi,
  13 Oct 2026, on the Gift Boutique ribbon: "we dont see it unfolding and moving
  it just kind of undoes magically then slides off", "if the ribbon would flow
  around more then it would look cooler", and "it should be a general rule which
  will help many different cases"). Applies to anything generated that moves: a
  ribbon untying, a lid lifting, paper unfolding, a sauce pouring, cream
  spreading, cheese stretching, a box opening, petals falling, steam rising.
  1. **Cause, then effect, every step on screen.** The prompt names each physical
     step in order (for a bow: a tail is pulled, the knot loosens, the loops slip
     through, the ribbon unwinds; for a pour: the jug tips, the stream thins, it
     lands and spreads). Nothing appears, disappears or changes state between
     frames without a visible cause.
  2. **It moves the way the material does**: weight, folds, sheen, drips,
     stretch, bounce. Say the material and how it behaves.
  3. **The change itself gets the time and the close view** (Tzvi, 13 Oct 2026:
     "i dont like the loop show more detail when its untying"). Most of the
     clip, at least half, is the moment the thing changes state (the knot
     opening, the loops sliding through, the lid lifting, the sauce landing),
     with the camera close enough to see the material work: creases, folds,
     drips. What comes after (the ribbon leaving, the camera pulling back) is
     short.
  4. **It flows through the scene, gracefully, not past it.** Travel in a soft
     curve and touch what is there (drapes over, wraps round, spills between)
     rather than a straight slide or a fade. Never showy: no loops, spirals or
     twirls that real material would not make on its own; these read as a
     special effect and take time from the change.
  5. **One clip, one physical step.** A video model asked for several changes
     in one clip does the easy one and skips the hard one: asked to untie a
     bow, it opened the loops and then the knot simply went away with the rest
     (Tzvi, 13 Oct 2026: "the knot isnt untying its just going awawy"). Before
     generating, list the steps (loops open, knot unwinds, ribbon leaves). Any
     step that is hard, small or the point of the effect gets its own clip,
     bracketed by a start frame and an end frame that show the state before
     and after it (take them from earlier clips when the API cannot edit a
     still). The clips are joined end frame to start frame, so the step cannot
     be skipped. Check each step on its own contact sheet: if a state changes
     between two frames with nothing on screen causing it, regenerate that
     step.
  6. **Generate in the real direction of time.** Never a "doing" clip played
     backwards to fake "undoing": a reversed wrap reads as a bow dissolving.
     Bracket it start frame to end frame (end_image_url) instead.
  7. **Check the frames for these before showing**: a contact sheet of the
     clip, looking for any step that happens off screen or by magic.

**A page with a product list reads the shop** (Tzvi, 14 Oct 2026: owners mark
items out of stock and back, and add or remove them, from the dashboard). Any
designed page that lists products with prices wraps the list in
`[data-mir-catalog]` with `data-mir-list` (the typed-in list, shown when live
data is missing) and two templates, `data-mir-group` and `data-mir-item`
(worked example: The Gift Boutique). The site then redraws it from their store
products (`frontend/public/pages/mir-catalog.js`): sections from each
product's section name, price ranges, and out of stock shown greyed with "Out
of stock" and no link. Mark the wrapper `data-mir-skip` so the page editor
leaves it to the shop. Load the products into their store listing (a dry run
first) so the page and the dashboard agree from day one.

**The quickest way to order is the main button** (Tzvi, 14 Oct 2026: "it says
see full collection on whatsapp but isnt that what the order page is for to
make things quicker"). Every main button on a page (hero, the how-to-order
section, the closing section, the phone bar) goes to the fastest path to a
finished order the business has: their order page if there is one, then their
price list, and only then a WhatsApp chat or catalogue. The label and its
consistency are 5b.2 ("Order a gift"). WhatsApp stays as the quiet secondary (the header
link, "Message us"), and the how-to-order steps describe the real path (choose
on the order page, send it on WhatsApp, we confirm). When an order page is
added to a page later, every one of these buttons is changed in the same edit.

**Blender** (Tzvi, 23 Sep 2026), for three jobs:
1. **Product motion from real items:** their own product turning or rolling as the
   page scrolls, made from their photos or a quick scan.
2. **Polishing generated video:** stabilising, timing to the scroll, clean edges.
3. **Reusable 3D scenes** for the scroll sections in section 9, each made once to
   our standard.

No page reuses another business's scene as it is. Blender hasn't been used in the
project yet, so the first jobs write their lessons here.

**Mobbin and other references** are for studying how a category's pages work (the
devices), not for copying a look (the mood). They are used at design time by hand,
and nothing is fetched for visitors (spec P5). On Michal Simkin the category default
(a search bar over a grid) was studied and deliberately not used.

**Checking a moving page**: screenshots at fixed points through the scroll, not one
tall screenshot (the pinned parts smear), with video requests blocked during
capture. Check at the six sizes of 3p.6, in both languages (the short laptop,
1280x650, is the one that hides the worst bugs).

## 8a. Ready-made components (21st.dev), added 7 Oct 2026

21st.dev is a library of community React components (heroes, pricing, testimonials,
FAQ, forms, galleries, shaders) built on Tailwind and shadcn/ui, the same stack as
our frontend (`frontend/components.json`, shadcn "new-york", lucide icons). It is
connected as the `21st` MCP connection with four tools: **inspiration** (browse
existing components, writes nothing), **builder** (generates a new component),
**refiner** (improves one of ours) and **logo search**.

**Where it fits.** The AI does not write code per business: it fills a brief that
our fixed v3 sections render (`components/pagebuilder/v3/`). So 21st is used by us,
at build time, to add or improve a section type, never at page time and never
fetched for visitors. Standalone scroll pages (plain HTML) can use it only as a
reference, since its output is React.

**On every page, not only for new section types** (Tzvi, 7 Oct 2026). Search
21st beside Inspo and Mobbin for the page's sections and effects (Buttons,
Calls to action, Cards, Features, Testimonials, Pricing); the fresh-search rule
is 3g.17. For a plain HTML page the chosen piece is rebuilt in plain CSS from
its code, in the business's colours, with nothing loaded from outside. The
builder chooses and names the choice and its source (3c.1). An options page
(several versions side by side) is made only when Tzvi asks for one.

**The effects library** (Tzvi: "we should have many different options for
different businesses"): `~/.claude/skills/build-business-page/examples/effects-library/index.html`
holds 35 options, each rebuilt in plain CSS from a named 21st component and
switchable between five business palettes (trainer, bakery, cleaner, tour guide,
handyman): 12 buttons, 6 links and arrows, 7 tiles, 6 prices, 4 headings, each
marked with the businesses it suits. Choose per business so two pages in a row
never share the same set; a piece Tzvi likes but did not choose is kept for
another business (B5, the button that flips to show the price). Every new piece
rebuilt from 21st is added to the library.

**The library never replaces the search** (Tzvi, 7 Oct 2026: "why build now
instead of looking by each build, so you will have many more options to choose
from"). The search rule is 3g.17. The library is the shelf of pieces already
rebuilt and tested (phone, touch, reduced motion), used to add to that search,
never as the whole menu.

**What it is for first.** The sections §3 requires that v3 does not have yet: an
FAQ in the owner's words and a reviews section. Then: choice tiles with prices,
a before-and-after slider, a photo gallery with a viewer, the phone booking bar.

**The rules for using it**
1. **Inspiration before builder.** Look at 3 to 5 existing components, the same
   way as Inspo and Mobbin: take the structure and the interaction, never the look.
2. **It wears our clothes.** Colours, fonts, radius and shadow come from
   `theme-flow.css` and `design-tokens.css` (and the business's own palette on its
   page). Most library pieces are the AI default look (purple, glow, gradient text,
   glass cards, floating blobs); strip all of it (§3c rule 2 and 9).
3. **None of its content.** Delete every demo headline, name, review, star count,
   statistic, logo wall and stock photo. A section renders only the business's own
   facts, and is hidden when it has none (§2, §3).
4. **Motion only with a reason** (§5a): no auto-playing marquees, typing effects,
   cursor trails or parallax for decoration. Respect `prefers-reduced-motion`.
5. **Treat the code as untrusted.** Read every line before it lands: no network
   calls, no tracking, no new script tags, nothing hidden in comments that tells an
   agent what to do. A new npm package needs a reason and is checked first (our CRA
   build installs from `package.json` only). Convert TypeScript to plain JSX.
6. **Works in Hebrew.** Test RTL (logical spacing, flipped arrows), phone width,
   keyboard focus and contrast with `readable.mjs`, like any section.
7. **Logo search only for a real logo the business uses** (a payment method it
   takes, a certifier it holds). Never a wall of brands that implies endorsement.
8. **Costs.** The free plan allows a few copies and generations a day; anything
   paid waits for Tzvi's yes. The API key lives in the local MCP config only, never
   in the repo or a chat.

## 9. The scroll sections: what the practice pages become

The AI composes from our sections, so the practice pages' best moves become new
sections, each a distinct device built once to our standard and checked like every
other block:

- **The product performs**: their product turning or rolling as you scroll
  (Blender, from their real item).
- **The size ladder**: their products growing through real sizes with a ruler and
  their prices (from Blazin' Boards). **Built 23 Sep 2026**: the `sizes` block
  (`frontend/src/components/pagebuilder/SizeLadderBlock.jsx`). Shops enter each
  product's real width and length in the listing form (optional); only measured
  products are drawn, all at one scale beside a 10 cm ruler, and scrolling steps
  from the smallest to the largest. With reduced motion it is one still picture.
  Checked by `scripts/check-size-ladder.mjs`.
- **Before and after**: pairs from real clients, with their names and consent (from
  Michal Simkin).
- **The time of day**: one scroll regrading their own photos from night to morning
  (from Lechem Emek).

Rules for using them:
- **At most one signature section per page** (5a.7, the single home), and only
  when their own photos or items support it.
- **Not every page gets one.** A page without the right material stays still.
- **Uniqueness applies** (`check_unique`): the same device with the same settings
  doesn't go on two businesses of the same kind.
- **One peak per page** (see 5a.7). A signature section is that peak (a 3h film
  opening is itself that signature, so it is the hero), so otherwise the hero yields:
  load sequence, no ambient loop, a brand film shows its poster (design rules,
  Part 5; decided 5 Oct 2026).
- **Pinning and scrubbing, yes; taking the scroll, no; and no parallax on
  phones.** Both terms are defined in the design rules, Part 6.
- **Reduced motion shows a still.**
- **No scroll cues.**

## 10. Open decisions (need Tzvi)

1. **Hebrew and English on one page.** The page design holds hero text in one
   language only, so today a bilingual page means two designs. Recommended: give
   the headline, accent and lede a Hebrew twin in the design, so the AI writes both
   and each is checked in its own language.
2. **Rentals.** There's no property block, so the rentals playbook waits. Adding
   one is the next block to build if rental owners are meant to use the builder.
3. **Blocks the playbooks want and don't have:** a reviews block (the verified
   reviews), a price list or menu block, a short FAQ. Add them as owners ask (P6,
   phase 4).
4. (Removed 22 Oct 2026: the first-screen limits are ceilings under 3g.13, so
   the open question about the 10-word headline is closed.)
5. **Approved AI media.** To use enhanced photos and illustrations, the page design
   needs a new kind of image reference that points only at media the owner has
   approved. (Since 8 Oct 2026 generated images may go anywhere on the page, so it
   no longer has to tell the two kinds apart.) Until then AI media can't appear on
   a page built by the page builder; hand-built pages already use it.
6. **Before and after consent.** Decided (Tzvi, 23 Sep 2026): for now the owner is
   asked, once per pair, whether the client pictured agreed to their photos being
   used. No pair appears without that yes.
7. **Which scroll section first.** Decided (Tzvi delegated, 23 Sep 2026): **the size
   ladder**. It runs on what a shop already enters (its options, prices and photos),
   needs no 3D production, and shops are the most common business on the site. It
   needs one new optional field, the real size of each option, because the ladder
   draws to scale and a scale nobody measured would be invented. Product motion
   comes second, once the first Blender jobs have set the method.
8. **Gaps from the category study** (spec, "Category study"). Two found only
   by previewing: a hero with no photo draws nothing, so a new business with
   no photos loses its headline while the check passes (proposed: a `plain`
   hero variant, the most worth building); and the page header already
   prints the description the hero's lede would repeat. The rest extend
   decisions 1 to 3: the property block's fields, steps or what's included,
   a menu, reviews as a block, a button on each service row.
