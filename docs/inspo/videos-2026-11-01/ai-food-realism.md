# Notes: making AI food video look real (7 videos)

Method: read the 4 transcripts; pulled frames at on-screen moments (prompt panels, skill, settings) and densely sampled the 3 short food ads (every 0.4-3 s). Frames are 640 px wide, so fine texture was judged at that size only. Descriptions of the 3 short ads contain NO prompts (only tool names). Not read: comments (skipped).
Tags: [F] frame-verified, [N] narration only, [D] description only.

## 1. 2hJsvDSPWYM, Dan Kieft, "Realistic AI Videos with Seedance 2.5" (sponsored by Higgsfield)
Idea: realism comes from imperfection and from how a human would have filmed it; compare several models rather than trust one.
- Models [N]: Seedance 2.5 1080p best for realism but expensive; Kling "3"/"Flux 3" (transcript garbled, treat the name as unverified) gets "80-90%" cheaper; MiniMax Hailuo worse with no references; Kling 4 "less realistic" on first look (he had not tried it). 
- Draft trick [N][F panel seen: "Seedance 2.5 Draft, 5s, 16:9, 480p, Bitrate High, Generate draft 15 credits"]: iterate at 480p draft (cheap, and low quality "helps the realistic aesthetic"), then upscale the keeper once to 1080p.
- Image prompt formula CTLT (Camera, Tone, Lighting, Texture) [F table]: Camera = lens/framing ("Candid 35 mm film photograph, 12 mm fisheye, slightly elevated side view, wide full-body, crooked horizon, slight motion blur"); Tone = mood + who/what/where; Lighting ("harsh direct on-camera flash"); Texture = physical materials ("matte ivory bones, glossy marbled meat with visible fat and uneven edges"). Example is a skeleton, not food; the structure is what transfers.
- Deliberate imperfection [N]: lowest resolution (1K), "badly compressed camcorder", disposable-camera flash, iPhone selfie look; "imperfect looks more realistic". 
- Video camera tricks [N, two example clips seen F]: handheld (small shakes that react to the scene), crash zoom, voyeuristic, whip pan, walking backwards, blocking the frame (someone walks in front), exposure adjustment (inside to outside), focus hunting. Combine several. His own prompt is a long structured block with [Generation Goal], [Reference Asset Roles] (@image1 supplies only X), [Event Script], [Camera and Sound] [F, small].
- Discount: gangster chimp / monkeys / skeleton examples, "contrast levels" virality talk, Skool community funnel, Higgsfield sponsor. No food content at all.

## 2. kFKpcCHkuPI, Higgsfield AI, 30 s delivery ad in Seedance 2.5 (title says "3-step realistic commercials"; content is a directing walkthrough)
Idea: lock every asset as a picture first, then give the video model a timed script with anchors; fix the shots that go wrong by making the prompt explicit.
- Models [N]: Soul Cinema for characters/locations (8 images = 1 credit); SeaDream 5.0 Pro to edit a picture while keeping its light and texture; Claude to write character-sheet and edit prompts; Seedance 2.5 in Cinema Studio for video, elements attached automatically from names used in the prompt; ~200 credits per ~17 s take; ~2,100 credits for the 30 s ad including retries (sponsor-friendly figure, but it is what he states).
- Reference-first [N]: plain grey background character sheets (face + outfit front/back) for consistency; locations built with image references; use a 3/4 angle so camera moves have depth to grab.
- Food specifically [N]: he put the plates of food INTO the location reference picture, so no separate food reference was needed; extras (all four musicians) made as one reference image.
- Timed prompt [F, text shown]: made by a Claude skill "higgsfield-timed-prompts". Shape: time ranges per shot ("1.5-6.8 s"), lens (28 mm, 24 mm), where the camera physically travels, when focus racks ("focus on Jenny; focus racks to the vase"), BACKGROUND landmarks for each seat, exact second a line or action lands ("At 8.55 s while the mouth is still open..."), one expression held for the shot, and negatives in plain words ("No particles, glow, smoke or flash. The chicken leg exists only in this shot").
- Fixes that worked [N, a landmark overlay card seen F]: (1) model put a character on the wrong sofa because the prompt never assigned a seat, so he added an establishing wide shot and tied each seat to a background landmark ("skylines behind Mika, shelves behind Jenny, red lamp behind Alex"); (2) reverse-angle shot kept showing a wall, so he spelled out where the camera stands and what must be visible; (3) extra place setting appeared, so he gave a colour-coded top-down map picture (orange/blue/green per person, plates and phone placed) as a reference, then mapped colours to characters in the prompt. Transferable: when the model invents objects, give a layout picture, not more words.
- Cut tricks [N]: hide a cut behind a person's back; match pose and camera motion across the cut; change audio first.
- Discount: Discord contest, subscribe pleas, fictional app, price vs live-action claim. Not seen working food motion in close-up: eating shown only briefly, not verified in frames (I did not sample the result clips).

## 3. P7pH_1zFKbE, Dan Kieft, Nano Banana Pro + Kling 2.5 Turbo (Nike-style sports ad)
Idea: storyboard in stills, then animate each still in three difficulty tiers; use start AND end frame for transitions.
- Settings [F panel]: Kling 2.5 Turbo, 1080p, 5 s shown (a 10 s player also seen), Generate cost 6-12 credits; image: Nano Banana Pro, 16:9, 4K.
- Easiest tier, near-static close-up [F prompt]: "focused eyes, blinking once, looking at the same place. Add very subtle skin shimmer from sweat. Keep the camera almost still with a slight natural handheld motion." Small, physical, single motion. His result: "blink is not that powerful", regenerate several times.
- Medium tier [N]: character action; "animate the player lifting the ball slightly higher and releasing it in a smooth controlled shooting motion"; rotating the ball in the hands worked; hard actions (football play) did not, so he changed the action (walking backwards to the free kick) to something the model could do.
- Transition tier [N, prompt text F partial]: first frame = ball in hand, last frame = ball at the player's foot; prompt says "The camera follows up-right with the ball and keeps it centered. Do not let the ball go left or backwards. Keep motion smooth and steady... No stopping. Camera keeps a soft handheld drift". Admits one transition glitched (missed target) but the morph was good.
- Lesson [N]: describe the camera as if directing a cameraman; ask an LLM for a camera/lens description line (he used "Sony A7R, rich bokeh").
- Discount: celebrity likenesses (do not copy), community funnel.

## 4. cGTBzed4S4w, AI Video School, "Stop writing prompts"
Idea: give an LLM the model's official prompting documentation (custom GPT / Gem with the doc as knowledge), tell it your idea, let it write the model-optimised prompt; iterate by telling it what went wrong, with a screenshot.
- Process [N, nothing verified in frames; I did not pull frames, narration only]: save the model's prompt-guide as PDF (Higgsfield, Kling, Luma, Vidu, Runway, Veo each have one; Veo via DeepMind > Gemini docs > video generation > prompt writing), upload as knowledge, new chat per project because long chats forget the doc. Ask for prompts for several models at once and compare.
- Discount: no food, no settings, no prompt examples worth copying; it is a workflow tip. Useful here because our prompts could be generated against the Seedance/Kling/Veo docs rather than guessed.

## 5. nTEqfQWzkYU, Lubos Belak, Food Texture Study (Kling AI 4K, 1 min) [D: brief only, "macro study of various food textures. Make it cinematic", music/SFX from ElevenLabs; no prompts given]
Frame-judged, shot by shot (what looks real and why):
- 0:01 scallop pulled up with a thin cream thread dripping: REAL-ish. Opaque matte cream, thread thins and breaks plausibly; background soft. [F]
- 0:04-0:10 seared scallop on a pale purée, foam creeping up the side: REAL. Caramelised crust with specific pits, foam with irregular bubble sizes, purée that is matte and slightly lumpy. [F]
- 0:07 splash crown around the scallop: MOSTLY REAL but the weakest frame; the crown is symmetric and thin-edged, and a red droplet sits oddly. [F]
- 0:13 macro of orange broth with oil droplets and seeds: GOOD but slightly glassy/glossy; oil beads look a bit too uniform and jewel-like. [F]
- 0:16-0:21 big transparent bubbles on cream: the bubble film is clean and glass-like (more "CG glass" than real surface tension); fine as abstract, risky for sauce. [F]
- 0:22-0:24 burrata cut open, milk flowing out: REAL. Skin has pores, the white matte inside has curd chunks, the liquid is opaque milk with soft highlights, not glass. Held 2-3 s with tiny slow motion. [F]
- 0:28-0:31 cream/yoghurt macro: REAL. Soft peaks, matte, no glare. [F]
- 0:34-0:37 plum with a fork, red syrup running down: syrup on fruit skin looks believable (thick, slow, with bloom on the skin) but the syrup is a very clean saturated red. [F]
- 0:38-0:43 red syrup dripping from a spoon against black: gloss and shape of a hanging drop are good, BUT it reads as clear amber-red glass/jelly with no opaque body, the glassy look we want to avoid. Light is clean, which helps it look "ad". [F]
- 0:46 wagyu-style marbled block with blood: marbling pattern too regular and repeated (stripes), a bit synthetic. [F]
Pattern: the real-looking shots are OPAQUE, matte or semi-matte, thick substances moving SLOWLY with one clear event per shot, in macro with shallow focus, one soft light. The fake-looking ones are TRANSPARENT liquids (glass-like), perfect symmetry, very uniform patterns. Camera mostly still or slight drift.
- Discount: Kling marketing end card ("Native 4K, one-click output"); no way to know how many takes were discarded.

## 6. 4qtEIxhAFYg, Shahrukh AI Art, restaurant commercial (23 s) [D: no prompts or tools named]
- 0:01 chef tossing dough: plausible dough disc but the chef/kitchen is clearly generated and "film-set clean". [F]
- 0:02-0:05 toppings exploding out of a pizza: FAKE. Ingredients float with no physics; they appear from nowhere, the pizza grows layers in the air; at 0:03-0:04 a mozzarella slab melts into a blob under a pan and the frame cuts to a blank white smoke wall (a smoke/steam wipe hides the cut); 0:05 cheese stretches like fabric. Strong "skips physical steps / pieces fade in" example. [F]
- 0:06-0:07 fries falling into a pile with seasoning dust: BETTER. Fries are rigid, fall under gravity, land in a pile; dust particles in the dark. Reads convincingly at this size, though the pile at 0:07 has slightly doubled fries. [F]
- 0:07-0:08 burger assembling from a floating stack: the stack hovers; again "assembly in the air", but each layer looks right. [F]
- 0:08-0:09 smoke wipes in front of the burger, then a macro of the burger: the smoke wipe is again a cut-hider; real shot good (cheese melted over patty, bun with seeds) but the cheese slice is a smooth matte tongue. [F]
- 0:10 hand takes a fry from a wire basket: GOOD. Real physical contact, fries have varied shapes. [F]
- 0:11-0:17 three diners talking: faces are the weakest (hands/eyes soft, the face at 0:13 gesticulating looks plastic). [F]
- 0:18-0:22 night restaurant with neon "EAT TIME": architecture stable, camera slow push; background cars at 0:18 smear; text is readable and stable (rare). [F]
Transferable: the generator can do rigid falling objects, wire baskets, hand-to-food contact; it fails on mid-air assembly and melting cheese. Smoke is used as a masking wipe, which works as an edit device but is a sign of a cut, not of one continuous take.

## 7. KGMTH5HigCE, Mahix Matix, HelloFresh spec ad (23 s) [D: "Seedance 2.0, Kling 3.0, Suno AI"; no prompts]. Spec work by third party, not HelloFresh; do not imitate brand.
Best-looking food of the seven. Frame-judged at 0.4 s steps:
- 0:01 patty on grill with smoke: REAL. Crusty browned edges, wisps of smoke curl and separate, grill bars with soot, dark ground. [F]
- 0:03 buns toasting, 0:05 melted cheese: REAL. Cheese drapes over the patty and over 1.5 s (4.4-5.6) hardly moves: slow melt, stays opaque yellow, matte-satin, not glassy. Steam rises and drifts left. [F]
- 0:05-0:06 kale leaf with water droplets falling: GOOD. Droplets are small and varied in size, leaf veins visible. A slight issue: droplets are bright and a few seem to appear in mid-air. [F]
- 0:07-0:08 hand lifting bacon from paper towel: GOOD. Bacon has fat and meat bands, the paper has texture, fingers are right (no extra digits seen). [F]
- 0:08-0:09 SAUCE POUR onto a bun: BEST sauce frame in the set. Opaque, matte pinkish-cream ("burger sauce"), thick ribbon that leaves a swirl/mound on the bun, ribbon thins slightly, no glass look, no neon. The sauce is slightly waxy at the swirl. [F]
- 0:10-0:11 hands placing tomato on lettuce: GOOD, fingers deform very slightly between frames but pass at speed. [F]
- 0:13-0:15 smiling woman holds burger, then bites: face is good for a clip; lens flares/bokeh circles added deliberately (they sell "real lens"). The bite at 0:15 is shown from above with the face hiding the contact (no tearing shown). [F]
Why it reads real: warm hard sun, shallow focus, consistent kitchen palette across shots; one simple action per 2 s shot; opaque thickened liquids; steam kept thin and drifting; practical lens flares; the bite avoided or hidden. Cuts are normal editing cuts, not smoke wipes.

---
# Across videos

## Ranked techniques for realistic food, liquid and texture motion
1. One physical event per shot, 2-4 s, of a THICK OPAQUE substance (cream, cheese, sauce, purée) moving slowly. Transparent syrup/oil/bubble shots read as glass. (5, 7 [F]; 6 counter-example [F])
2. Choose events the model can really do: rigid objects falling into a pile (fries), a hand lifting/placing food, steam rising, thick sauce pouring, cheese lying and slowly sliding, cutting open a soft cheese. Avoid mid-air assembly, melting from solid to blob in air, chewing and tearing. (5, 6, 7 [F])
3. Start and end frames that bracket the real action, plus "do not" lines for the usual mistakes ("do not let the ball go left or backwards, keep motion smooth and steady, no stopping"). Use the real product photo as the end frame so the thing that arrives is the thing that is sold. (3 [F/N], 2 [N])
4. Put every object that must exist INTO the reference picture (plates in the location image; layout map with colours when the model adds extras). Words alone did not stop extra place settings or wrong seating. (2 [N + one card F])
5. Time-coded shot script with lens, camera path, when focus moves, the exact second an action lands, one expression per shot, and plain negatives ("no particles, glow, smoke or flash"). (2 [F text])
6. Light and camera like a real shoot: one hard or soft motivated light, shallow depth of field, slight handheld, practical lens flare. Add imperfection (grain, 480p draft, compression) rather than perfect sharpness. (1, 3, 7 [F, N])
7. Hide cuts with real edit tools (match pose, hide behind a person, cut on the action) not with smoke wipes. Smoke wipes look like an effect. (2 [N], 6 [F])
8. Iterate cheap, finish once: draft 480p for tests, upscale the keeper. (1 [N, panel F])
9. Let an LLM write the model-specific prompt from the model's own docs; keep the human on the idea and on the "what went wrong" feedback. (4 [N], 2 [N])
10. Use the camera and fix what fails by adding explicit, named positions ("camera beside the building looking out to the valley, the table beyond the musicians"). (2 [N])

## What none of these videos solved (say so honestly)
- No video shows a verified method for chewing/tearing; the one bite (7, 0:15) hides the contact. 
- No prompt in any video targets sauce physics directly; the good sauce pour (7) is judged from frames only; we do not know its prompt.
- No seeds or negative-prompt fields were shown; negatives appear only as plain sentences in the prompt (2). No evidence either way for seed use.
- Durations: the best close-up shots are ~2-4 s; nothing was verified on 10 s+ food takes.

## Checklist for a food opening-film shot
[ ] Start frame AND end frame are the owner's real photo (or crops of it); same item, same light. (3, 2)
[ ] Write the true physical story in numbered steps; each step is something that can happen: gravity, hand, steam, a flow, a cut. If a step is impossible, split it into two shots with a real cut. (6 counter, 2)
[ ] One event per shot, 2-4 s; thick/opaque substance; slow. (5, 7)
[ ] Anything that must be in frame (plates, pieces, count of items) is in the reference image; if the model keeps adding items, supply a layout map. (2)
[ ] Prompt names: lens, camera path (still / slow push / slight handheld), light direction and hardness, background, texture words ("matte", "satin", "opaque", "crumbly", "uneven edges"), and plain negatives. (1 CTLT, 2, 3)
[ ] Steam: thin wisps drifting one way, in the prompt, not a smoke wall. (7 vs 6)
[ ] Liquids: say "thick, opaque, matte-satin, slow, leaves a mound" (7 sauce pour); avoid "glossy/glass/clear". (5, 7)
[ ] Test at 480p/draft first, judge at 4+ fps frame sheet, then upscale. (1)
[ ] Check against failure list: pieces appearing from nowhere, floating assembly, symmetrical splashes, glassy syrup, repeated patterns, soft faces and hands, smoke wipe as a cut. (5, 6, 7 frame judgments)
[ ] Edit: real cuts on action; hide transitions behind a moving object/person; keep a consistent palette across shots. (2, 7)

## Prompt template (assembled from the videos; not a copy of any one; test before trusting)
```
[Shot, 3 s] Macro, 100 mm lens, camera locked off with a very slight handheld drift. 
Subject: <the owner's real product, as in the start frame>, on <real surface>.
Action (one only): <thick, opaque sauce> pours slowly from a spoon onto the <product>, forms a ribbon that thins and settles into a swirl mound; nothing else moves except a thin wisp of steam drifting left.
Texture: matte-to-satin, opaque, slightly uneven, visible crumbs/pores; not glossy, not translucent, no glass-like highlights.
Light: one warm window light from camera right, soft fall-off, shallow depth of field, background soft.
Start frame: <photo A>. End frame: <photo B, same product, finished state>.
Do not: add or remove pieces, make liquids clear or neon, fade items in, add smoke walls or glow, change the product's shape or count, cut the frame.
```
Per-line origin: shot/lens/camera (1, 3), single action and end-frame (3, 2), texture words (1 "Texture" row, 5/7 judging), "Do not" lines in plain words (3 "do not let the ball go left", 2 "no particles, glow, smoke or flash").

## Handoff note
Frame work was at 640 px; fine detail (e.g. whether syrup reads glassy at full 4K) was judged at that size. Model names in the Dan Kieft transcript are auto-caption mangled ("Cidence", "Flux 3", "Sea Dream", "Clink"); version numbers like Seedance 2.5, Kling 3.0/4.0 are as heard and may not match real products.
