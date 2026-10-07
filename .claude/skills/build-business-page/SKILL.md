---
name: build-business-page
description: Tzvi's complete method for building a website or landing page for a business (any site, any stack), including scroll cinematic pages. Use when building, redesigning or reviewing a business's home page, landing page, scroll page or AI-generated page, before showing it to the owner. Points to the same tools (design-kit skills incl. scroll-craft, Inspo, Mobbin, Higgsfield) and covers facts and honesty, copy voice, the category checklist, motion and video build rules, a worked cinematic example, and the review loop with four scripts (readability, cut-off, overlay alignment, preview video).
---

# Building a page for a business

Distilled from the MyIsraelRental page rules (`docs/page-generation-rules.md`
in that repo, where the full history and examples live) and the corrections
Tzvi made on real builds. Every rule here is a defect that once reached him.

The job in one line: **arrange what the business told you into the clearest
page for someone deciding whether to use them, without adding a single fact
of your own.**

## 0. Use the same tools (this is what gives the full capability)

Invoke these rather than improvising; each is what the rules below were
learned with. Check what is connected in this session first.

**Skills (design-kit plugin)**
- `design-kit:design-pipeline`: the router; start here if unsure which to use.
- `design-kit:scroll-craft`: **the scroll cinematic.** Any page where
  scrolling drives the story (pinned scenes, scrubbed video, split stage, a
  signature move). It brings the engine (`scrollcraft.js/.css`), the eight
  grammars, devices, feeling curve, the uniqueness registry (FINGERPRINTS),
  asset generation through kie.ai, `encode.sh`, `shoot.mjs` and its own verify
  steps. Build the cinematic with it, then hold the result to this skill.
- `design-kit:taste-skill` (anti-generic design), `design-kit:brandkit`
  (identity from their logo and photos), `design-kit:redesign-skill`
  (upgrading an existing page), `design-kit:image-to-code-skill` (from a mockup).
- Grading, by something other than the maker: `design-kit:page-conversion-review`
  (honest persuasion), `design-kit:design-loop` (critic loop and checks),
  `design-kit:visual-diff` (against a mockup), `design-kit:dead-ends`.
- `interview-me`: only when there is no brief and the facts aren't available.

**Connections (MCP)**
- **Inspo**: before designing, study the category: one `recommend`, one or
  two `search_screens`, `get_screen` on 3 to 5 keepers. Take composition,
  not looks. The six-point checklist in section 3 came from this study.
- **Mobbin**: how a category's flows and sections work (devices, not mood).
- **Higgsfield**, connected two ways: the **MCP connection** for one-off
  stills, clips and upscales while building, and the **API** (Python SDK
  `higgsfield-client`, key in `HF_KEY` in a gitignored `.env.local`, never
  printed; worked example `backend/higgsfield_demo/main.py` in the
  MyIsraelRental repo) when a site or script must generate on its own. API
  credits are prepaid and separate from the web plan; every call is billable,
  so confirm before running one. Methods and model choices in
  `reference/media-and-video.md`.
- **Browser pane / preview**: show the rendered page; never ask the owner to
  sign in to see it.

**Local tools**: Playwright (the scripts here), ffmpeg (encoding, previews),
Python with OpenCV (finding spots in frames, steadying clips, motion masks).

**Files in this skill**
- `reference/full-rules.md`: the complete MyIsraelRental rulebook (hard rules
  table, category study, playbooks with recipes, three-option rule, AI media
  policy, Blender, scroll sections, open decisions). This page is the
  distilled version; read the full one for anything not covered here.
- `reference/playbooks.md`: per kind of business.
- `reference/media-and-video.md`: generating, steadying, masking, encoding,
  placing overlays, recording previews.
- `examples/la-cholent/`: a finished cinematic page (index.html) and its
  brief: the split-stage grammar, knob signature move, kosher band, phone
  order bar, every rule applied. `examples/FINGERPRINTS-myisraelrental.md`:
  the looks already used, which a new page must differ from.
- `scripts/`: `readable.mjs`, `cutoff.mjs`, `overlay-truth.mjs`, `record.mjs`.

## 1. Facts: only theirs

- **Never re-ask what they already told us.** Read the record, every
  listing, hours, photos and flyer text first; anything answered there is
  never asked, not even to confirm.
- **Ask the owner only about their business**: facts the record leaves
  open or contradicts (where they work, booking lead time, who books them,
  languages). Never about how we build: no tools, credits, image sources,
  plans, vendors or design. A tooling problem is ours to solve silently.

- Use only what the business gave you: name, description, areas, hours,
  languages, founding year, licence or certificate, reviews, prices, products,
  photos. **Anything not in that list does not go on the page.** No "since
  1998", "fresh every morning", "trusted by families", no round marketing
  numbers.
- A claim needs its proof. Kosher needs a certificate (and only on food).
  Licensed needs a licence number. Years or "since" need a founding year.
  Ratings and "customers love" need real reviews. Only the owner's own words
  can back best, #1, award, guarantee, insured, 24/7, emergency, fresh daily,
  delivery, or anything medical.
- No fake urgency, ever: "only 3 left", "hurry", "today only", countdowns,
  invented counts. "Open only on Fridays" is a fact, not urgency.
- Generated images and video: allowed for atmosphere (hero, backgrounds,
  scroll scenes) and to enhance their own photos. Never on product cards
  where people choose what they get, never a generated person shown as their
  staff or customer, never their premises made up, no text baked in. Respect
  the business (a kosher business: nothing non-kosher, no meat with dairy).
  Movement copied from a reference video is built in code, not generated.

## 2. How to write

1. **Their words first.** Reuse the owner's phrasing; tidy, never replace their voice.
2. **Specific over generic.** "Sourdough and challah in Beit Shemesh", not
   "quality baked goods". Banned: welcome to, look no further, one-stop shop,
   passionate about, quality you can trust, world-class, top-notch.
3. **Headline: what + where** (or what + for whom), at most 10 words. The name
   is already on the page.
4. **The line under it says what you get**, plainly (food: the food and how it
   arrives, not a slogan). At most 20 words.
5. **A professional voice, always.** Write the way a respected business would
   in print. Describe the customer's problem in neutral terms; never tease,
   scold or talk down ("You are nowhere near done" became "Thursday night,
   with hours of preparation still ahead"). No slang or jokey asides. Test:
   would the owner print this line on their menu?
6. **Short labels are still full phrases.** A proof line or badge spells out
   the relationship with the word people actually use: "Kosher, hechsher from
   Rabbi Weiner", not "Kosher, Rabbi Weiner"; "Made in Jerusalem, delivered
   across Israel", not "Jerusalem, all over Israel".
7. **Plain punctuation.** No exclamation marks, no long dashes, no capitals
   unless it is their name. (A quote of the owner may keep theirs.)
8. **Address the visitor as "you"**; the business speaks as "we" or its name.
9. **One wording per purpose.** If the button says "Order", it says "Order" everywhere.
10. **Other languages are written, not translated** (Hebrew: natural word
    order, right gender and plural forms, RTL layout checked).

## 3. The category checklist (what the best real sites share)

Every page passes all six before anyone sees it:

1. **The first screen answers four questions:** what it is, where, why trust
   it, what to do next.
2. **Proof touches the main button:** price, credential or rating right beside it.
3. **One solid button per screen.** Everything else is outline, link or tile.
4. **With few photos, facts carry the page** (what they offer, key facts), never a padded gallery.
5. **For a place, hours and where come before the description.**
6. **On a phone the action is pinned to the bottom** with the price or proof,
   from after the first screen until the order section.

Food: a certificate is a small labelled band just after the opening, never
crowding the button, said at most twice on the page.

Per-category guidance (what a visitor decides, what leads, proof, action,
what to avoid): `reference/playbooks.md`.

## 3b. The sections every page has (Tzvi, 6 Oct 2026)

1. **A dramatic hero**: their product or setting full-bleed, the headline at
   display scale, strong contrast; never a small card on a quiet picture.
2. **A features section**: one scannable item per service or product, price
   and what is included, in their words.
3. **A CTA section** of its own near the end: the one action, proof beside it.
4. **An FAQ in their words**: ask the owner to send their customers' questions
   with their answers (suggest the questions that matter in their category).
   No FAQ section until they do; never invented, never empty. **The request
   shows 5 to 8 example questions written for this business**, each drawn
   from something real in their listing (a fee, an exclusion, their areas,
   their busy season, who books them) or what their category must know
   before booking. The owner answers the ones customers really ask, in their
   own words; skipped questions stay off the page.
5. **Social proof only if real**: platform reviews, or testimonials the owner
   sends with name and permission. None means no section, and ask them.

## 4. Design and story

- Find what the business actually has before choosing a look; the page is
  built around the one thing that is really theirs.
- **The product performs, not the camera.** Motion shows what they sell; no zooming for its own sake.
- **One signature idea per page**, describable in one sentence, never reused
  for the next business. **One peak**; the ending resolves on the action.
- No blank screens, no scroll cues, no "01/06" counters, no label above every section.
- Top of the page: at most 4 pieces of text, headline at most 2 lines.
- Text never sits straight on a photo: a band or shaded edge behind it.
- No default "premium" palette (cream with brass) and no AI purple; the
  palette comes from their logo and photos.
- Honest persuasion only: repeat the promise that brought them, reassurance
  beside the button, next steps as steps, one job per page, real specific numbers.

## 5. Build rules (each one shipped as a defect once)

| Rule | The defect it prevents |
|---|---|
| Anything placed on a spot in a photo or video is placed **by measurement** (a detector on the real frames), never by eye. | A knob landed beside the pot's dial. |
| An overlay that must stay on moving media **lives inside the media's element**, in its own percentages. Never chase it with script on scroll. | The knob trailed the dial as the page scrolled. |
| **If the camera moves, steady the clip** on the spot first; never key an overlay to video playback time. | The knob was right on one screen, off on another. |
| **Nothing moves without a reason.** A clip behind text holds still except the subject (steam, a pour); no drift, breathing zoom or shifting in and out. Freeze the frame and mask the motion to where it belongs. | The pot screen "shifted in and out" while only numbers changed. |
| **Text never re-wraps while its container animates.** Fixed width for the narrowest state, or fade between states. | Words jumped lines as a panel widened. |
| **No in-between state looks unfinished.** Check every transition at its middle; an emptied area goes to the page ground, never a bare panel. | An empty grey strip mid-scroll. |
| **Text over imagery is checked at the brightest frame** and narrowest screen. | A line sat on bright steel. |
| **A pinned section must fit at 650px tall**, or it is not pinned. The order section is never pinned. | The order controls were cut off on a 1536x753 laptop. |
| **A line of items separated by dots never wraps.** Stack them if it might. | A stray dot started the second line. |
| **A fixed bar never covers content.** Give content room for it. | The phone order bar hid two lines. |
| **A label never covers the thing it labels.** Compute where the spot lands once the camera settles; if the card would sit on it, the card takes the other side for that spot. | The oven card sat on the oven on a phone. |
| **A caption stays up until the next one replaces it**, including while the camera travels. | Bare kitchen between stations. |

## 6. Look through it, fix it, then show it

The owner never sees a first draft. Before showing anything:

1. **Render it** as a visitor meets it: laptop and phone, each language, normal
   and reduced motion. Walk a scroll page top to bottom at several positions
   per section, never one screenshot. Include a short laptop (1536x753 or
   1280x650); the default 900px-tall test hides the worst bugs.
2. **Look at every screen** for anything broken or unfinished, even if no rule names it.
3. **Run the checks** (scripts below; run from the project folder so they find its Playwright):
   - `node ~/.claude/skills/build-business-page/scripts/readable.mjs <url>`:
     every visible word at six sizes and many scroll points; fails under 12px,
     a sentence under 14px on a phone, or contrast under 4.5:1 (3:1 large)
     against the real pixels behind it, photos and video included.
   - `node ~/.claude/skills/build-business-page/scripts/cutoff.mjs <url>`:
     anything cut off by a pinned or full-screen section at nine sizes.
   - `scripts/overlay-truth.mjs <url> <overlay> <section>`: for anything
     placed on a spot in a picture; hides it, finds the real spot with
     OpenCV, measures the miss at six sizes; over 4px fails.
   - The cinematic's own checks from scroll-craft (`shoot.mjs` at 1440x900,
     390x844 and reduced motion).
4. **Fix every finding, render again**, repeat until a full pass is clean.
5. **Then show the owner** the finished page with a short plain note of what
   was fixed and what could not be (needs their content, a decision, or a real
   device). For a shareable preview:
   `node <skill>/scripts/record.mjs <url> 390 844 preview-phone.mp4`.
