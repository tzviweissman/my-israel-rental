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
| `hero` | A headline at the top that says **what they do and where**, in at most 10 words, with at most 20 words under it. Never just their name again, since the page already shows it. One hero only. |
| `congruency` | The headline or the line under it names something they actually sell, in the words of their own listings. A place name alone doesn't count. |
| `numbers` | Every number on the page comes from their own words or our facts (their prices, founding year, review count). |
| `claims` | A claim needs its proof or the owner's own words. **Kosher** needs a certificate, and is said only on a food business. **Licensed** needs a licence number. **Verified** needs verification. **Reviews, stars, "customers love"** need reviews. **Years, "since", "established"** need a founding year. **English** needs English among their languages. Only the owner's own words can back **best, #1, leading, award, the only, cheapest, guarantee, insured, 24/7, emergency, fresh daily, delivery, trusted by, thousands of**, or anything medical (**cure, heal, weight loss, treatment for**). |
| `urgency` | Never: "only 3 left", "hurry", "today only", "booked 11 times", "limited time", "don't miss". Nothing we hold is a real, current count. "Open only on Fridays" is a fact, not urgency. |
| `generic` | No sentence that could describe any business: "welcome to", "look no further", "one-stop shop", "passionate about", "quality you can trust", "your satisfaction", "world-class", "top-notch" (and the Hebrew equivalents). |
| `punctuation` | No exclamation marks. No long dashes (the site's copy rule). No words in capitals unless it's their name. |
| `structure` | At most 10 blocks. No doubled contact, facts or gallery. No two dividers in a row, and don't end on one. |
| `signature` | At most one scroll section per page, with its material. The size ladder needs one of their store listings with at least 3 products they measured. |
| `action` | What the brief asks visitors to do has a place to do it: book or order needs the services block, message needs contact, visit needs the facts (hours, address). |
| `images` | Only their own photos, and only ones that exist. A photo gallery needs at least 3 photos. Full-bleed imagery needs a cover photo. |
| `prices` | Loud prices only when there are prices, and never on a premium or quote-based brief. A premium brief is never packed. |
| `playbook` | The category's lead block comes first and its must-have blocks are there (section 6). |

Three options (P7d, `check_options`): each passes on its own, and **they really
differ**. Every pair differs in at least two dials or in the order of blocks, and
no two share a headline. Three near-copies is one option shown three times.

**Every page is its own** (`check_unique`; Tzvi, 23 Sep 2026: "not every page
should have a rolling jar, each should be unique"). A new page must differ from
each recent page of the same kind of business on at least 3 of 6 things: what
leads, the order of sections, the hero's shape, imagery, type, and density. The
hand-built pages already hold themselves to 4 of 6 (`scrollcraft/FINGERPRINTS.md`).

## 3. (cont.) The sections every page has (Tzvi, 6 Oct 2026)

"Each page needs a dramatic hero, feature section, cta section, faq question
which you can ask them to send, and social proof if they have."

1. **A dramatic hero.** The first screen is the page's boldest moment: their
   product or setting full-bleed, the headline at display scale, strong
   contrast. Never a small card floating on a quiet picture. It still answers
   the four questions (what, where, why trust, what next).
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
| **Text never re-wraps while its container animates.** A column that widens, narrows or slides keeps its words at a fixed width set for the narrowest it ever gets, or the words fade between states; they are never reflowed live. | The from-scratch words jumped between lines as the panel widened. |
| **No in-between state may look unfinished.** Every transition is checked at its middle, not only its ends: when content leaves an area, the area goes to the page's own ground (or the next content arrives), never to a bare panel. | The from-scratch side became an empty grey strip mid-scroll. |
| **Text over imagery is checked at the brightest frame under it and on the narrowest screen.** If a later panel slides over a column of text, the text column is narrowed so it is never covered. | Headline text slid under the widening panel; a line sat on the bright steel of the pot. |
| **A section that holds the screen still (pinned) must fit its content on the shortest common screen.** Anything taller than the screen is cut off, because the held screen cannot scroll. Size its contents to the screen height (fewer lines, smaller type, two columns), and if it still cannot fit at 650px tall, it does not hold the screen: it becomes an ordinary section at least one screen tall, which can grow. The last section, where the order is, is never held for this reason. | "Turn it to your size" was cut off on Tzvi's 1536x753 laptop; the chores list and the "Choose your size" button ran off the bottom below about 820px. |
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
  detector, and measure the gap. Do it at several scroll positions and at least
  six screen sizes (wide and short laptop, full HD, tablet, phone); more than
  4px off fails the page. Comparing the overlay with the page's own numbers is
  not the check, because those numbers are what can be wrong. A screenshot that
  "looks right" is not the check either.
- **Cut off:** for every held screen, at several scroll positions, find any
  visible text, button or control that sticks out past its edges. Run it at
  nine sizes: 1280x650, 1366x657, 1536x753, 1280x720, 1440x900, 1920x1080,
  375x667, 390x844 and 360x640. Anything cut off at any size fails the page.
  The short laptop heights are not optional: the default 900px-tall test is
  exactly the screen that hides this.
- **Phones as phones, and every payoff at its moment** (Tzvi, 7 Oct 2026:
  "make sure similar issues don't happen in the future"). Phones are checked
  and recorded with touch emulation (`record.mjs` does it for any width under
  600), so hover-only and touch-only looks are seen as a visitor sees them.
  Anything the page builds to (a counter's finish, a bar changing colour, a
  closing line) is screenshotted at that moment on a phone and a laptop, and a
  rule that hides part of a bar or section is checked against everything else
  that lives there.

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
   get (for food, it names the food and how it arrives, not a slogan).
2. **Proof touches the main button:** the price, the credential (a kosher
   certificate, a licence, years in business) or the rating sits right beside
   or under it, never only in a section further down.
3. **One solid button per screen.** Everything else is an outline, a link or
   a small tile.
4. **With few photos, facts carry the page:** a list of what they offer, the
   key facts, nothing padded.
5. **For a place, hours and where come before the description.**
6. **On a phone the action is pinned to the bottom** with the price or the
   proof beside it, from after the first screen until the section where you
   order.
   If the bar also carries something that runs with the scroll (a counter,
   a clock, a progress line), the bar is there from the very first screen
   and only its button waits: a running element never appears late, and
   never leaves before its finish (Tzvi, 7 Oct 2026: Michal Yodaiken's
   session clock first showed five seconds in, then vanished before 30:00).

For a food business also: **a kosher certificate is a small labelled band
just after the opening**, never crowding the button and never only at the
bottom, and kosher is said at most twice on the page.

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
   for a bakery), then keep 3 to 5 real screens and write down which ones
   were used in the brief. Take their structure (what sits where, what is
   beside the button), never their look; the palette and type come from the
   business. Without the business's own colours a reference gets cloned.
   **And 21st.dev, every page** (Tzvi, 7 Oct 2026: "besides Mobbin and
   whatever other inspiration sources we have, also look at 21st for ideas
   for different sections and different effects, to make pages look as
   professional as possible"). Search it for the sections the page needs
   and for the details that make it feel finished: the button's hover and
   press, an arrow that moves, a tile that lifts, how a price is set. Show
   the owner 3 or 4 options built in their colours before choosing (section
   8a). An effect still needs its reason (rule 9): one that says what a
   control does passes, one that only decorates does not.
   *Prevents: the page every AI makes from memory, and the flat page with
   nothing that reacts.*
2. **No AI default look.** Cream ground with a serif headline and one
   italic word is banned unless the business's own brand is exactly that.
   It is the combination that is banned: the page builder's one-word accent
   on another ground stays allowed (`docs/page-builder-design-rules.md`
   3.2, 3.4 and Part 10, where all eleven rules are applied to generated
   pages).
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
   "imagination gap"). A generated image may only set the scene around their
   own picture; it never stands in for what the customer gets.
5. **Choices are visible.** Sizes, flavours and tiers are tiles to tap,
   never a dropdown. A short note may say how each differs, in the owner's
   words. "Most popular" appears only when the owner marks it or orders show
   it. Bundles show what they save, in real numbers.
6. **The button says what happens next.** "Order, delivered Friday",
   "Book a time", never just "Submit" or "Buy now", and the same words
   everywhere (section 5). Under it, a row of up to three icons with the
   owner's real guarantees: delivery area, kosher, returns, a guarantee.
7. **Offers are contained.** Every offer has an end date or is limited to
   a first order. Prefer free delivery over an amount, or a bundle, to a
   percentage off. No permanent sale, never a discount on the thing they are
   known for unless they say so.
8. **Say what happens after the order.** If the owner tells us about the
   first days (reheat before serving, the first lesson is gentle, a stain
   lightens after a day), the page and the order-tracking page say it before
   it happens. Whoever names that moment first decides how it is read.
9. **One system, quietly.** One corner radius, one icon set (lucide), one
   soft shadow, no two-colour gradients, no arrows or outlines that do
   nothing. Every button visibly reacts when pressed and shows when it is
   working. *Prevents: the beginner look.*
10. **Come-back features only where they help the customer.** Saved items,
    reorder, order updates and an owner's setup checklist, yes. Never fake
    urgency, endless feeds, random rewards, or streaks that guilt people.
11. **Video is drawn, then checked.** A preview video is rendered frame by
    frame (each frame a function of its time), never recorded live, so it
    never stutters and comes out the same every time: the skill's
    `record.mjs` does this (rebuilt 7 Oct 2026) and writes a contact sheet.
    Before any video is sent, look at the sheet, fix, render again. Anything
    paid (generated stills or clips) waits for the owner's yes on two or
    three style frames.

12. **Everything fits on one screen** (Tzvi, 7 Oct 2026, from
    woodwrights.co.nz). Wherever a visitor stops scrolling, each photo is
    seen whole together with its words and price: no block (a hero's copy and
    button, a heading, a tile, a list, the closing offer) is taller than the
    screen, on a short laptop (1280x650) as much as on 1440x900 and a phone.
    A photo is capped by the screen's height (`svh`), a big headline too
    (`min(clamp(...), N svh)`), and a main tile puts its photo beside its
    words rather than words under a tall picture. Checked by measuring every
    block's height at the three sizes, never by eye. *Prevents: seeing half a
    picture and scrolling to find what it is about (Michal Yodaiken's
    1-to-1 tile was 940px tall).*

**Three more questions for the owner**, asked with the FAQ request
(section 3, cont.) and only when their page does not already answer them:
- What do customers worry about before they order or book?
- What happens in the first days after they get it?
- Do you have a photo of it being used, served or delivered?

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
3. **Headline formula: what + where**, or what + for whom. At most 10 words.
   The name is already on the page.
4. **The lede says the one thing a visitor needs to act.** How to order, by when,
   what a first visit costs, which areas they cover. One or two short sentences.
5. **One accent word at most**, and it's a word that matters (the thing they sell),
   not decoration.
6. **Plain words.** Say it the way the owner would say it to a customer. No
   marketing voice, no exclamation marks, no long dashes.
7. **Hebrew is written, not translated.** Natural Hebrew word order and phrasing,
   plural and gender forms right, the same facts as the English. A Hebrew page is
   judged in Hebrew.
8. **Address the visitor as "you"**, never the business's customers in the third
   person. On the page the business speaks as "we" or in its own name.
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
2. **The product performs, not the camera.** Movement shows the thing they sell.
   Zooming for its own sake "isn't doing anything" (Tzvi on Blazin' Boards rev 2);
   the jar rolling as the page scrolled was the part that worked.
3. **Only their photographs of their work, people and place.** "A generated face
   here would be a lie about a client" (Michal Simkin). Rev 3 of Blazin' Boards
   dropped generated media and used the owner's own photos.
4. **Only their numbers**, never round marketing ones.
5. **No blank screens.** Every screen shows something of theirs.
6. **One signature idea, and it is theirs.** The test: could a visitor describe it
   to a friend in one sentence? (Boards growing through real sizes with a ruler and
   their prices; real clients' own before and after; one scroll taking a bakery from
   night to dawn.) Never carried over to the next business.
7. **One peak per page.** One moment gets the most room and quiet before it; a page
   with three peaks has none. The ending resolves on the action, never fades out.
8. **Check what renders, not what was written.** An independent pass on Blazin'
   Boards found a bar that measured 102px where 84 was assumed, hiding content, and a
   button that went to the top of the page and looked broken.

## 5b. Design craft (taste-skill, scroll-craft, the frontend skill)

1. **The top of the page holds at most 4 pieces of text**, the headline takes at
   most 2 lines, and the line under it at most 20 words.
2. **One wording per purpose.** If the button says "Order", it says "Order"
   everywhere, not "Buy" in one place and "Get yours" in another.
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
3. **Text never sits straight on a photo.** A band or a shaded edge behind it,
   never a full-frame darkening.
4. **No default "premium" palette** (warm cream with brass or oxblood) and no
   AI purple. The palette comes from their logo and photos (P7c).
5. **No fake screenshots, no generic names or faces, no too-perfect numbers.**
6. **No scroll cues, no "01/06" counters, no label above every section.**
7. **The maker doesn't grade its own work** (design-loop). The checker grades the
   rules; a separate critic, not the generator, judges the rest.

## 5c. Persuasion, and only the honest kind (page-conversion-review)

Each is backed by several independent sources; the count is in brackets.

1. **Repeat the promise that brought them** (4). If a flyer, a QR code or a listing
   said "challah for Shabbat", the headline says "challah for Shabbat". Checked as
   `congruency`.
2. **Reassurance right beside the button** (5). The proof line (rating, verified,
   years, kosher) already sits beside the main button on every page.
3. **What happens next as steps, not a paragraph** (4): "Order by Thursday, collect
   Friday morning".
4. **One job per page** (4). One leading action; the rest visibly secondary.
5. **Specific real numbers beat round ones and beat adjectives**, and never a range
   where one number exists. A total on a button only when it is real.
6. **Friction that filters or invests helps; friction that taxes hurts.** Asking the
   event date helps a caterer; asking for an account before a question hurts.
7. **Never the dark patterns**: fake scarcity or urgency, countdowns, invented
   counts, hidden low ratings (section 3, `urgency` and `claims`).

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

## 7. Choosing the three options

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

**AI images and video** (Higgsfield, kie.ai). Tzvi, 23 Sep 2026: owners should be
able to look professional even when their own photos aren't, "a moist steaming
piece of meat being sliced" on Blazin' Boards. Two tools, in this order:

1. **Enhanced from theirs.** Their own photos and clips made to look professional:
   relit, cleaned up, sharpened, or animated from their actual photo (steam rising,
   the knife moving). It is still their product, so it can go anywhere, including
   the product cards.
2. **Illustrations.** Fully generated "appetite" shots of the same kind of item they
   really sell (sliced brisket for a business that sells brisket, never a dish they
   don't make). Allowed in the atmosphere parts of the page (hero, section
   backgrounds, the scroll sections), **never on the product cards**, where people
   choose what they will actually get. Each carries a small "Illustration" note.

For both:
- The owner approves every piece before it can be used.
- Never a generated person presented as their staff or customer, and never their
  premises made up.
- No text baked into an image.
- Prompts respect the business. On a kosher business nothing non-kosher is in the
  frame and no meat with dairy; the Blazin' Boards prompts excluded dairy, pork and
  shellfish because the flyer carries a hechsher.
- Today the builder can place neither: images are references to their own uploaded
  photos only (open decision 5).

**Movement that copies a reference is built in code, not generated.** Generated
video reinterprets the reference on every render, so rerolling can't converge on
"exactly like this". Offer the code-built version instead.

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
capture. Check at 375, 768, about 1000, and 1280 wide, in both languages, and at a
real laptop height.

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

**On every page, not only for new section types** (Tzvi, 7 Oct 2026). Beside
Inspo and Mobbin, search 21st for the page's sections and its effects (Buttons,
Calls to action, Cards, Features, Testimonials, Pricing). For a plain HTML page
the chosen piece is rebuilt in plain CSS from its code, in the business's
colours, with nothing loaded from outside. Show 3 or 4 options side by side on a
test page so the owner picks by pointing and tapping (worked example:
`scrollcraft/builds/michal-yodaiken/buttons.html`, where Tzvi chose the outline
that fills with her pink and moves its arrow).

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
from"). Every build starts with a fresh 21st search for that business's
sections and effects, which reaches thousands of pieces; the library is the
shelf of ones already rebuilt and tested (phone, touch, reduced motion), used to
add to that search, never as the whole menu.

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
- **At most one signature section per page**, and only when their own photos or
  items support it.
- **Not every page gets one.** A page without the right material stays still.
- **Uniqueness applies** (`check_unique`): the same device with the same settings
  doesn't go on two businesses of the same kind.
- **One peak per page.** A signature section is that peak, so the hero yields:
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
4. **Advice rules.** Everything above rejects. If some rules turn out too strict
   in practice (say, the 10-word headline), they can become advice fed back to the
   AI instead of a rejection. Decide once there are real pages to look at.
5. **Approved AI media.** To use enhanced photos and illustrations, the page design
   needs a new kind of image reference that points only at media the owner has
   approved, and knows which of the two kinds each piece is (so an illustration can
   be kept off the product cards and carry its note). Until then AI media can't
   appear on a built page.
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
