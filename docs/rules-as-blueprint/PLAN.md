# Rules as a building blueprint: the plan (12 Nov 2026)

Tzvi: "can we make the rules a building blueprint so it builds off them ... instead build off it so its quicker to build
because we have less checks and retries", then "i want all the rules to work this way".

Today the rules are a list the finished site is checked against: build, about fifty checks, fix, check again. The plan
turns every rule into a part the site is built from, so the checks become one confirming pass. The full sort of all 242
rule ids is in inventory.md (who builds each one, the check that confirms it, which ones cost a retry on Gremier).

## How a build will work

1. **Fetch the business** (as now).
2. **Answer the blueprint** (`node scripts/blueprint.mjs <site>`): about 30 plain questions instead of 242 free-text
   plans: the kind of business, what they sell, the page colour (from their photos), the join method for the opening
   (slides, camera journey, layered world, guide, morph, or moving layout), the story's steps and big words, which
   photos to use. The answers are saved as `site.json`. Facts only the owner knows go straight into the owner message.
3. **Generate** (`node scripts/build-site.mjs <site>`): reads `site.json` and writes the site from kit parts that are made
   to the rules: the head and tags, the opening for the chosen join method, the sections in a height and layout plan
   that never repeats, the product cards, the shop and its order steps, the footer, the copy checked as it is written.
   For a film it writes the brief, the prompts (the same ground and light in every one, from the brand colours) and the
   clip chain (each clip starts on the last frame of the one before).
4. **Make the pictures and clips** the generator asked for; each one checked as it arrives (brightness, made-up text,
   orange glow, a fade between two objects), before the next is paid for.
5. **One confirming pass**: the same checks as today, run once. Because the parts follow the rules, they should pass.
6. **One review** by someone who did not build it, and Tzvi.

Live sites are not touched: each build keeps its own copy of the starter, so only new builds use the new kit.

## The work, in order (each step makes every new site better at once)

| Step | What | Retries it removes |
|---|---|---|
| 1 | Base styles: 14 px floor for phone sentences, a hover and press state on every control, 44 px taps, section padding that fits 1280x650 | phone text, missing states, too-tall sections |
| 2 | Page writer guards: title 60 and description 155 characters, one h1, share tags on every page, far pictures lazy, no long dashes or exclamation marks | web basics, punctuation |
| 3 | Kit parts: picture (sized, extended not cropped), facts line (never wraps with a dot), text over a photo (tight shade, never over 40% on a phone, kept clear of buttons) | phone cover, the facts dots, the headline over the button |
| 4 | Opening and film: one opening part per join method, words placed by the part (never over the film), at least 3 screens of scroll, video tied to the scroll, phone ending whole | film covered, out of sync, too short, not full screen, first screen not arriving |
| 5 | Shop and order: one shared order flow (basket, three steps, saved before WhatsApp, the test hooks built in), choice swaps that preload their photos | order test, a choice jumping |
| 6 | Section plan: the generator lays out sections so no three are the same height and no layout repeats | section heights |
| 7 | Generation pipeline: brief and prompts written for you, each still and clip checked on arrival, two tries at most | orange glow, made-up labels, cross-fades, extra spend |
| 8 | The blueprint questions and `site.json`, and `build-site.mjs` that reads them | the free-text plan that nothing read |
| 9 | Review sheets and the report written by the generator | hand-written RULES.md and report |

## The new rules (from the Pinterest coffee site and the six sites, docs/inspo/videos-2026-11-12)

Each is added the same day in its one home (the rulebook), the digest, the checklist, and as a kit part or generator
step, so it is followed by building, not only checked:

1. One smooth story: an opening is one continuous story, no cuts or fades; the blueprint asks which join method.
2. One world: one ground (the page's colour) and one light through the whole film.
3. Same objects: whatever carries the product is the same object from start to end (the clip chain does this).
4. Huge words in the picture: one or two words per step, in the clear space, behind the product where possible.
5. Slow and few: one subject, large and centred; each step held about one screen of scroll.
6. Pinterest and our saved library on every build, the reason for the choice written into the concept.

## Then

Gremier is rebuilt from it as the first site, to prove it: the fewer checks that fail on its first pass, the better the
kit. Anything that still fails becomes a fix to the kit part, not to the site.
