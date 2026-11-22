# Ruben Stom channel study, 22 Nov 2026

Method per video: transcript panel read with get_page_text in the user's Chrome (video 1 used the saved VTT captions), then bursts of 4 to 5 frames about 0.35 s apart (video slowed to 0.1x, zoom of the player rect at scale 0.4). Frames are real video frames, so what moves is described from the burst. Motion is judged from 5 stills, so easing curves are read from spacing only and marked "partly verified".

---

## 1. 5EABQy-8uwo | Design a Fully Animated Website Hero with AI (Claude Code) [transcript from saved VTT + frame bursts]

**One idea:** sketch the concept in Figma first (two rough boards: a grid of placeholders, and one open project page) and paste the sketch with each text prompt. Result is much closer than text alone.

**Workflow:** four prompts, one per behaviour. (1) the infinite draggable grid; (2) click a tile and it opens to a project page; (3) next/previous project wipe; (4) loading animation. Dark site on purpose because the shown designs are bright. Font: Source Serif 4 for titles, Inter for body and labels, thin hairline dividers.

**Exact asks:** images are 9:16 originals but the grid shows only the top crop; first 4:3, changed to square (4:3 felt cluttered). Latin square pattern so no duplicate image sits next to itself. Capsule nav pill top centre: name left, burger right, dark frosted glass.

**Animations (burst frames):**
- Grid drag with inertia (`5EABQy-8uwo-grid-drag-a.png`, `...-b-after-inertia.png`): tiles slide as one sheet to the upper left, tiles leaving one edge re-enter on the other. After release it keeps gliding and slows to a stop (first two frames nearly identical, then movement, so a long ease-out). Nav pill stays fixed on top, tiles pass under it.
- Open project: tile grows and moves to the right, grid fades to pure black, image changes from cropped square to full tall 9:16 (reveal, not just scale). Left card slides in, text fades in section by section after the image settles. Close reverses exactly into its tile (narration; not burst-verified).
- Wipe between projects (`...-project-page-dark-card-left.png`, `...-wipe-text-fades-out.png`): left text fades to black, the grey/black card covers the screen, new project is swapped behind it, then the card retracts and reveals. Slow, with a different easing out than back (narration; frames show the text fading then the blank black card).
- Loading: tiles fade in one by one and drop a few pixels into place, diagonal from top left to bottom right (narration only, not captured).

**Discount:** free download "in the description" is a funnel. Hero is a portfolio, not a business site.

---

## 2. Op5kncXOL-A | Watch Me Build an Animated Website with Claude Fable 5.2 (11:21) [transcript panel + frame bursts]

**One idea:** a three-colour image system. Every generated picture allots three colours to three objects (white/cream subject, dark chocolate brown accent, beige plaster wall) and the rest of the scene matches. That is why a whole site's pictures look like one photo shoot.

**Workflow:** concept first (Crimson Pro variable serif; full black plus lighter greys for text hierarchy; sections alternate white and warm off-white; wireframe of the visitor route: full-screen mood hero, short intro, three featured projects, horizontal props gallery, one quote, journal, footer; then a draft design used as the reference for Claude). Pictures: Higgsfield Soul 2.0, through the Higgsfield MCP inside the Claude chat. Cost quoted: Soul 2.0 is 1/8 credit per image against 10 credits for GPT Image 2.5 at 2K (80 times cheaper), with natural film imperfections; weak on hands, fixed by sending the image to Nano Banana or GPT Image for a re-take. Build in Claude Code with Fable 5.2 (says Opus 5.5 would be almost identical, Sonnet and Haiku skip small things). Project folder with a `visuals` folder.

**Prompt layout (exact order):** goal and where the visuals are, layout top to bottom, design tokens (colours, font, 12 column grid), then a long animation block. Dictated with a voice transcriber. New pages reuse the same layout. A blog page is built once "to be reused as a template" so new posts need only text and images. Updating later: CMS (Sanity) for clients, or just ask Claude again in the project; GitHub lets him edit from a phone.

**Animations (burst frames):**
- Intro, two words split open (`Op5kncXOL-A-split-intro-halves-opening.png`, `...-wide.png`): the name "Ada Moreau" sits centred on white. A thin hairline appears between the two words and lengthens to full height. The page then parts along that line: left half and right half slide apart (left text moving left, right text moving right) and the hero photo is revealed in the widening gap, until the photo fills the screen. About 1 s from hairline to open at 0.1x capture spacing; the halves accelerate (slow start, fast middle). Fully verified from 10 frames.
- Hero uses the same split to change to the next image (narration).
- Featured projects: wipe reveal tied to scroll (image uncovered as you scroll), then images falling into place at different speeds, then wipe reveal on hover for project thumbnails, text reveal for the quote and parallax on its background (narration; layout frame `...-featured-project-layout.png`).
- Page transition: dark panel fills the browser then is pushed upward revealing the new page (narration; my burst missed it, only the finished page was captured).
- Hero images get video: sideways pan with a breeze in a curtain, made with the MiniMax model through the same MCP (narration).
- Mobile: fewer things, one image per project instead of two, four column grid, props grid in two columns.

**Rule he states:** "only animations with a clear purpose", and reuse the same split motion and timing in several places so the site feels consistent.

**Discount:** sponsor is Higgsfield; PromptGrid free library is a funnel; the 80x price is his own comparison of credits.

---

## 3. nPVv0aRp0Y4 | How to Design Insane Animated Websites with AI (12:05) [transcript panel + frame bursts]

**One idea:** a site gets memorable by breaking exactly one rule of a normal website ("land at the top, scroll to the bottom"). Seven types, ordered subtle to unique, each with the three things to name in the prompt.

**The seven and what to prompt for:**
1. **Mirror (split screen).** Say what is on each half, how each half moves on scroll (stays, moves along, moves opposite) and the moment they line up in the middle. Needs high colour contrast between halves, or let motion separate them. Mobile: stack the blocks and keep the same effect sideways. Design each section as its own canvas like a slide. Images were generated to match the block colours.
2. **Horizontal scroll.** A normal mouse wheel must move the page sideways; say how the visitor knows where they are (progress bar or counter) and whether it snaps to each step. Always add an arrow or scroll cue. Works like a magazine or fold-out brochure.
3. **Timeline.** Name what runs along the line (years, steps, months), how the line moves (draws itself or a counter ticks) and what appears at each point. Keep it short.
4. **Draggable canvas.** Floor plan you zoom into; infinite loop canvas for many projects; best on phones. Use the word "inertia" (flick, glide, ease to a stop). Avoid video, optimise images.
5. **Scroll scrubbing video.** Scroll plays the video, scroll up plays it backwards. Done as dozens of still images, because video files cannot jump to exact frames. Prompt: start frame and end frame (Soul 2.0 still, then the same picture in full bloom), a locked camera with slow even change, and "turn the video into an image sequence that follows the scroll". Video model named: Kling 4.0.
6. **Interface sites.** The site looks like a program the visitor already knows (calendar that opens on this week and books a slot, photo library app, browser inside a browser, design app with artboards and a layers panel). Keep contact reachable. Use a wireframe image as reference.
7. **Physics.** Matter.js: gravity, restitution (bounce), friction, constraints (a sign hanging from two cords). Calm sites: low bounce. On a phone a finger on an object drags it, a finger elsewhere scrolls.

**Animations (burst frames):**
- Mirror (`nPVv0aRp0Y4-mirror-split-list-left-photos-right-a.png`, `...-b.png`): left half is a list of project titles, the active title is large and dark, neighbours faint; right half is a column of photos. On scroll the photo column moves DOWN while the title list moves UP, so the current title and its photo meet in the middle (the "Linen Room" photo and title at the centre, then "The Long Table" arrives). Left panel then gets a thin rounded border frame. Smooth, about 1 title per second at 0.1x capture. Verified from 4 frames.
- Hero with live clock (`nPVv0aRp0Y4-hero-live-clock-sunset.png`): full-bleed terrace photo, a large serif clock (19:28 to 19:40 across 4 frames, so it is sped up or scroll-driven) and a line "The sun is still warm on the wall". The clock is the unexpected detail. Partly verified (could not tell if driven by scroll or time).

**Discount:** sponsored by Higgsfield; the free prompt pack is a funnel; no mobile tests shown beyond narration.

---

## 4. QunIbbJ6ZgI | Animate Insane Websites with AI (8:45, 47K views) [transcript panel + frame burst]

**One idea:** choose motion with intent. Five animations, subtle to dramatic, each with what to name in the prompt and when NOT to use it.

1. **Reveal** (fade, wipe, slide): prompt names type, direction, and which elements. Avoid on a busy site ("when everything moves, nothing stands out"). Use to make people curious about what comes next. Examples: wipe when a section enters, text reveal on scroll, thumbnails fading up one after another, a whole section sliding up over the previous one.
2. **Parallax** (stacked layers, floating images at different speeds, image moving inside its own frame like a window): easiest to prompt. Images need extra room to travel, so turn it OFF on mobile.
3. **Loading / intro**: describe the sequence step by step (what first, how it moves, how it hands over); give a reference image of the loading state; keep it to a few seconds; first visit only; skip it on information sites (a restaurant menu). It also buys time to load heavy files.
4. **Travel** (images fly toward the visitor, orbit a centre, 3D spiral, images on a sphere, or the viewer inside the sphere): prompt = the path, then speed and direction (gentle continuous, or faster tied to scroll). Compress and resize images to their on-screen size; no video inside.
5. **Video animation**: play on load, on a trigger, or scrubbed by scroll (scroll plays, scroll up rewinds). Videos made with Seedance 2.5 with a start frame and an end frame; the end frame of one video is the start frame of the next so the hand-off is invisible, and each end frame is planned as a section. Web files: compressed WebM with MP4 fallback for play-on-load; for scrubbing, a compressed image sequence (scrubs smoother than a video file).

**Animation seen (burst):** loader on his Cadence animation library site (`QunIbbJ6ZgI-intro-images-drift-around-wordmark.png`, `...-intro-fades-to-white.png`): the word "Cadence" sits centred on white while small photos of different sizes (landscapes, a woman in linen) drift around it at slightly different speeds; then everything, photos and word, fades to white together, leaving a blank page before the site. About 1 s from drifting to blank. Partly verified: two mid-roll ads interrupted the second burst, so the "travel" and sphere demos were NOT captured; they are narration only.

**Discount:** the free Cadence library (100+ animations with copy-prompt and copy-code) is the funnel; no timings given for any effect; "premium" claims not measured.

---

## 5. V16Yhbu2eKg | 3 Ways to Animate Insane Websites with AI Video (7:55) [transcript panel + frame bursts]

**One idea:** plan the END frame first. Every hero is a Kling 4.0 clip between a start frame and an end frame; the page lands on the end frame, which has empty space reserved for the text.

**Three hero types and exact settings:**
1. **Light reveal.** Camera locked, subject still, only the light moves. Higgsfield > Create video > Kling 4.0 > Frames mode with start frame (near black) and end frame; 1080p; 10 s (Kling 4.0 allows up to 30 s, Kling 3.0 15 s); ratio copied from the frames (16:9); credit cost shown on the Generate button. Key prompt words: "static locked-off camera, nothing moves except the light", start in near-total darkness, "soft morning light fills the room slowly, as if a curtain is gently opened". Site: full-screen video hero, plays once on load, copy fades in after the product is revealed. Returning visitors get the end state straight away through a poster image of the end frame. Scroll version (car, headlights first, studio lights up as you scroll, caption per stage): ask for an image sequence and strip the sound (Kling adds sound by default).
2. **Arrival shot** (his most used). One continuous 10 s shot: camera starts inside a hotel room, flies out, 180 degree orbit, pulls back; headline appears in the empty sky and the booking bar comes up when it lands. Give a reference image, keyframes for each move, and a very detailed end frame ("the most important part": wide shot, camera above the roof, clear sky for text). His comparison: Seedance 2.5 cost 4x as much and could not do the orbit or end frame. Edit-video button can turn it to night with fireworks. Product version: orbiting sneaker landing in side profile; variations of the end frame made with Nano Banana 2.1, each tied to a colour swatch.
3. **Branching hero.** Two videos that start from exactly the same image, ending on different end frames (poses). Each half of the page is a choice: hover fades the other half back (or black and white to colour), click and the camera pushes in; panel and text appear just before the video ends; going back shows the start frame again. Make the choice obvious in the first second. Fits a split offer (two collections, dance or yoga).

**Animations (burst frames):**
- Light reveal (`V16Yhbu2eKg-light-reveal-start-near-black.png`, `...-sweep-from-left.png`): coffee site "ALBA". For about 1.3 s of video the room is nearly black with only the nav and a faint bag visible; then a warm band of light sweeps in from the LEFT across the plaster wall and wooden table, revealing the beans bowl, bag, pour-over and lamp. Nav stays fixed throughout. No camera motion. Verified from 6 frames; the sweep is slow (the light travels about a third of the width in under 1 s of video).
- Arrival (`V16Yhbu2eKg-arrival-end-frame-empty-sky.png`): the hotel facade "Hotel Aurelion" in blue-hour light with a large clear sky band above for the headline. 3 frames over 0.8 s showed only a gentle drift (camera settling), so the orbit itself was NOT captured; end-frame composition verified.
- Branching hero (`V16Yhbu2eKg-branching-hero-two-halves.png`): two models stand side by side in front of a stone balustrade, the page is split in two halves with a small "Women" and "Men" label at the bottom of each half; the right half shows a lighter overlay (hover state). Static in my frames, so the push-in and fade were not captured.

**Discount:** Higgsfield sponsor; "4x as expensive" and "could not" are one comparison by him; free prompt pack is a funnel.

---

## 6. eQEkqBqFF6s | Watch Me Build an Animated Mobile Website with AI (and How to Sell It) (7:45) [transcript panel + frame burst]

**One idea:** a phone-first opening video (9:16, fills the whole phone screen) where a sealed paper card opens like a door, the video stops on the open card, and the text fades in positioned relative to the video so it always lands inside the card. One prompt builds the whole site.

**Workflow:** visuals in Lovart 2.0 using its agent "Arti" (asks preferences, keeps one consistent style across a canvas): watercolour illustrations on plain white plus embossed paper cards, no text in the images; models named GPT Image 2.5 (images) and Seedance 2.5 (video). Opening video: pick two images as start and end frame, ask for a 5 s video "where the card opens like a door", 9:16. First try failed (start frame did not cover the screen), he told the agent what went wrong and the second try was right. Build in Claude Code: project folder with a `visuals` folder; prompt starts with the goal, points at the folder (Claude matches files itself), asks for white backgrounds to be removed with multiply blend, layout top to bottom (hero one phone screen tall; video plays once, stops on the open card, names/date/venue fade in; note; timeline; location; dress code and signature), fonts Cormorant plus Tangerine for the signature. Feel "slow and soft, nothing bounces, everything fades in gently". Timeline line draws itself as you scroll; each moment's icon and time slide in. Hosting: free Cloudflare connected inside Claude; one domain with a custom trail per client, no backend.

**Animation (burst, 5 frames about 0.4 s apart):** (`eQEkqBqFF6s-invite-card-opens-like-door.png`, `...-invite-card-opened.png`): a cream card with a wax seal and pampas grass sits on screen; a thin gold vertical line appears down the centre seam; the two halves open apart like double doors with a warm tan interior showing in the gap, and the seal slides to the right; the camera then looks at the open card with a lace-edge top. Total about 1.5 s of video in the captured part. Verified for the opening; the text fade-in after it was not captured.

**Selling (discount most of it):** sell to wedding planners and venues on revenue split, or as Etsy digital products; he sells themes on Etsy himself. Lovart is the sponsor. Income claim in the title is not shown.

---

## 7. wbVWftxYNzY | Watch me build an animated website with Claude Opus 5.5 (7:34, 14K views) [transcript panel + frame burst]

**One idea:** one hand-drawn line is the whole design. It draws itself down the page with the scroll (scrubbed, undraws when you scroll back) and the chapters hang off it. Also: the rule "where the image and the text disagree, follow the image" in the prompt.

**Workflow:** concept image as "source of truth" (that exact sentence). Poppins light with tight tracking for headings, medium caps for years, Square Peg handwriting only for note cards; off-white page so white photo cards separate. Visuals with the Higgsfield MCP: calm photos, warm muted colours, soft light, lots of empty space around the subject (the page is busy), two images per chapter (main and small card), GPT Image 2.5 at high fidelity, 2K, mixed 3:4 and 16:9. One extra image is a sheet of scribbles (suns, hearts, spirals), never shown, used as a style reference because loose doodle style is hard to describe in words. Files numbered in page order in an `images` folder. Model: Opus 5.5 ("almost as powerful as Fable 5 at a fraction of the cost"). Prompt order: goal, feeling (sketchbook), stack (plain HTML, CSS, JS plus animation libraries), the scribble reference, design concept as source of truth, design tokens, then animations, starting with performance rules because a line down the whole page can make scrolling lag. Photo card: white border like a print, paper grain, photo blended with multiply. Line built with varying thickness like a real pen. Opus did the mobile layout by itself without being asked, and he prefers it (a vertical line suits a phone).

**Animations:** hero intro: headline words rise one by one while every hero doodle draws itself stroke by stroke with a random delay each (so it feels hand-drawn). Line is scroll-scrubbed. Photo chapters: main card reveals top down, small card pops over its corner with a small bounce. Blue pen marks (underline, circle, strikethrough) draw one after another when a chapter enters (the 2017 chapter crosses out a logo). Frames: `wbVWftxYNzY-hero-doodles-blue-pen-underline.png` (headline "Every journey starts with a line", small line-art doodles scattered around, a blue pen underline under "one thread", a "scroll to follow" cue) and `...-scroll-line-starts-drawing.png` (headline scrolls up, a pinned photo card and the line start at the bottom, next chapter title "A sketchbook" arrives). The site is shown tilted in perspective on a laptop, so frame motion = page scroll only. Verified: hero layout, underline, scroll start. Not captured: stroke-by-stroke drawing and the bounce.

**Discount:** Higgsfield sponsor; "Opus 5.5 almost as good as Fable 5" is his opinion.

---

## 8. ot93rO2flS8 | Claude for Animated Website Designs (8:09) [transcript panel + frame burst]

**One idea:** make the pictures cohesive with a SKILL, a saved instruction document for the image agent (Lovart "Neutral Toned Visual System") that holds the style, hex colours, lighting and texture, then add the website's design tokens to the same skill so promos (ads, posters, flyers, banners) come back on brand.

**Workflow:** skill asks the same questions each time (mine, added by him), you upload a product image, it asks keep branding / unbranded mockup / apply my logo, makes a "master image" that sets the style for the whole campaign, you approve, it generates a set with different props and models. Hex codes for backgrounds in the skill. All images on one model (GPT Image 2.5 high fidelity) on purpose, because different models drift even with the same prompt. Build with Opus 5.5 in Claude. Prompt structure: goal (skincare landing page, reference image attached, visuals in `visuals` folder), layout top to bottom, dictated by voice, design tokens (alternating section colours, button, text, type: Verdana all caps labels, Times New Roman for body and big headings), then animations: intro curtain (a curtain lifting to reveal the site), blur reveal for hero text, wipe reveals for sections, calm continuous ticker of images. Only said "responsive": Opus swiped sideways in one section and made a thumbnail grid in another. Caveat: text baked into generated promo images cannot be restyled (Lovart can extract it for edit only).

**Animation prompt text seen on screen (frame, partly legible):** "Eyebrow: wipe in from left to right with clip-path over 1.2 seconds. Cards: each image rises like a blind, revealed with clip-path from the bottom, while scaling from 1.25 to 1. Stagger the three cards 120ms apart. Split section: the small image wipes in like an aperture and the portrait wipes in from the left. Journal section: the image and the white panel wipe in together as one unit, with the clip-path on the grid rather than on each piece, so they never separate." This level of numbers (seconds, scale, stagger ms) is what makes it work.

**Animations (burst):** (`ot93rO2flS8-split-section-image-wipes-in-beside-animation-prompt.png`): a split section where the portrait of a man applying cream is uncovered from the left with a clean vertical clip edge, over about 1 s, while the small image and paragraph are already in place. (`...-image-ticker-strip-below-newsletter.png`): a horizontal strip of square photos below the newsletter band moves slowly right to left in a continuous loop; photos of different sizes at the edges. Verified for these two; the intro curtain was not captured. Opening 3 s of the video itself shows a tilted perspective wall of the same photos (tile wall in 3D) as the cover.

**Discount:** Lovart sponsor; the skill is free as a funnel; Opus responsiveness claim shown on his one site only.

---

## 9. I-poegj2Yvg | Claude Code for Animated Hero Design (7:09, "Field flight") [transcript panel + frame burst]

**One idea:** a hero where the camera never moves; about 8 photo cards on a ring around the frame edges travel away from you in depth, never starting behind the wordmark, and follow the mouse with exaggerated parallax (nearest about 200 px, farthest about 60 px, "that difference is the whole effect").

**Workflow:** concept in Figma first (reference image plus two mobile references: hero with hamburger, open menu). Near-black background, grey only, matching B&W photography; Tenor Sans caps with 50% letter spacing; wordmark in a white-to-light-grey gradient reused on the nav icons; Newsreader soft grey body. Photos: one real image, Claude wrote a set of prompts for a whole photoshoot around it ("same person, same location, same light, different framing and poses"), generated with Nano Banana 1:1 at 2K through Higgsfield with the original reference uploaded with every prompt. Build with Opus 5 (best model on the Pro plan without extra usage). Prompt order: goal, reference image, layout, design tokens, then the animation. A soft dark blurred ellipse sits above the images and behind the text for readability. First result had two bugs: blur applied to the whole layer (a wall of frosted glass) and parallax applied to text and nav too; one follow-up prompt fixed both. Opening: wordmark fades in one letter at a time, then the field flight starts, cards fade in, last the nav and body copy ("stack the animations so nothing arrives at the same time"). Mobile: nav row swaps for a hamburger at a breakpoint, field flight stretched to a vertical shape (it was tuned for 16:9), tap opens a full-screen frosted blur layer then menu items animate in one by one top to bottom.

**Animation (burst, 5 frames):** (`I-poegj2Yvg-field-flight-cards-a.png`, `...-b.png`): the huge letter-spaced word "FETCHED" stays still on a near-black page. Small square grey photo cards (woman in a field) drift around it: cards at different sizes, the far ones are small and faded, the near ones bigger and sharper; over the burst one card on the right fades and shrinks as it recedes while another grows in at the top and bottom edges. Cards move slowly (a few px per frame at 0.1x capture, so about 20 to 40 px per second). Mouse parallax was not visible in the frames, so it is narration only.

**Discount:** the older version was a looping video; he now argues code beats video here. Free download is a funnel.

---

## 10. WficN4HcfKw | Claude Code for Animated Hero Design, Fable 5.1 + Genjutsu (8:29) [transcript panel + frame burst]

**One idea:** a full-screen looping hero where the subject (a runner on a treadmill) stays pixel-identical while the SETTING changes through four scenes. Because the runner never moves between clips, the scroll hand-off between scenes is invisible.

**Workflow and settings:** four Figma versions of the design (same layout, different copy and background) to check legibility on every scene before Claude sees it. Finlandica everywhere: wordmark caps with 50% letter spacing, buttons and eyebrow medium at 20%, heading semi-bold. Card and buttons are frosted glass, full black at 20% opacity, so they stay legible over any background. Images: GPT Image 2 in Higgsfield, 2K, 16:9; first a side view of the runner in a private gym, then that image as a reference with "keep treadmill, runner, pose and exact position unchanged, replace only the background" for a track, a woodland trail, a living room, with the same warm low sunlight so they feel like a set. Loop: Seedance 2.5, the same image as start AND end frame (no seam), "locked-off side view", "even repeatable running cycle", 10 s, 16:9, 1080p, high bit rate. Variants: Genjutsu (Higgsfield motion-transfer / object-swap model): upload the loop, add one reference image, 1080p. With an empty prompt it only changed the floor a little; a short prompt saying what stays and what changes worked. He says 6 s would have been enough (cost follows the length of the uploaded clip). Build: Fable 5.1, prompt = goal, reference images, layout (wordmark, vertical nav buttons, full-screen loop, glass card), tokens, copy per scene, animations: scroll reveal where the current video stays and the incoming video rises to cover it, card text animates out as a section leaves and back in when the new one settles. No follow-up prompt needed.

**Costs he states (credits, plan-dependent):** GPT Image 2.5 credits each, about 30 tried = about 75; Seedance loop 90; each Genjutsu clip 99; total 565 credits, just under $28 on the monthly Plus plan. (Checked only against his on-screen words, not the API.)

**Animation (burst):** (`WficN4HcfKw-northmill-hero-frosted-card.png`): the hero arrives out of black (about 1 s of near-black), then "NORTHMILL" in wide light caps across the top, a frosted dark card lower right with headline "Condition first, everything else follows", small vertical nav on the right edge, the runner in a dim gym. Static start; I could not capture the scene-to-scene scroll rise, so that is narration only.

**Discount:** Higgsfield and Genjutsu are sponsor products; the 70% off link is a funnel.

---

## 11. doO2ANZL0J8 | Claude Code + Blender for Animated Hero Design (10:44) [transcript panel + frame burst]

**One idea:** control the camera by blocking the shot in Blender with grey stand-in blocks (previz, as in film), then give that previz video to Seedance as a motion reference. Camera and timing become exact. On the site, the scroll steers that video ("you steer the camera yourself").

**Workflow:** four Figma designs (intro/loading state, three hero sections). Cormorant medium with 20% letter spacing for the editorial feel, Montserrat caps for nav and pill button (caps only), black and white UI with one dark beige accent on the call to action because the images drive the design (ivory, bright white, deep dark accents). Setup (one time): download the Higgsfield Blender plugin, copy the Higgsfield Bridge MCP link, add it as a custom connector in Claude, drag the zip onto Blender's viewport. Previz prompt: connect to Blender through the Bridge, "build a nine second previz in a single shot", a vertical orbital camera that rises over the subject, passes directly overhead and dives through the ground, three times in a row; everything grey, black and white checkerboard ground (gives the video model depth), red blocks where the models stand; three scenes (first with three characters, then one each). Token heavy (a hotel scene took about 90 minutes), so write the first prompt in great detail, with Claude's help. Images: GPT Image 2, 2K (Seedance tops out at 1080p so 4K is wasted), 16:9 on purpose for room to push the model left or right. Seedance 2.5: upload the 4 references and the previz, 9 s, 16:9, 1080p. Prompt layout is Higgsfield's: references first, a technical block (camera look, lighting), then the shot split by frame numbers (24 fps, 9 s = 216 frames). The end shot did not match the 4th reference, he kept it. Models keep eye contact with the camera all the way. Build: Opus 5, effort high.

**Animation rules in the site prompt (strong, transferable):** loading state = video starts and wordmark fades in on top. Land on a "resting" frame where the model faces the camera at eye height, choose a frame with no motion blur, and EASE THE PLAYBACK RATE DOWN rather than pausing ("if you simply stop a video on a frame, it reads as a bug or a freeze"). Nav fades in after the hero settles, then text and button; on scroll they fade out. The page itself never scrolls: the scroll gesture is captured and advances the video to the next resting scene. First result: models cut off by the beige top bar, awkward pauses, and alternating the model left/right (good in Figma) looked messy live because the video had to travel sideways; a follow-up fixed it.

**Animation (burst):** (`doO2ANZL0J8-pollen-hero-resting-eye-contact.png`, `...-head-over-orbit-motion-blur.png`): fashion site "POLLEN", small caps nav left and right, centred wordmark. The model stands in the white stair hall at rest, looking at the lens; then the camera begins to rise: the frame fills with heavy vertical motion blur and the model slides down out of the frame, a bare wall scrolls past. Earlier frames showed the three-model market street scene cutting in. Speed: the blur appears within about 0.4 s of video. Verified the rest and the start of the climb; the full overhead pass was not captured.

**Discount:** Higgsfield sponsors the Blender plugin; the previz costs a lot of time and tokens by his own count, so not a cheap default.

---

## 12. F3hLSg3XcoE | Fable 5 + Higgsfield for Beautiful Websites (8:53, "Studio Palette") [transcript panel + frame burst]

**One idea:** an intro the visitor reads as ONE photograph that then splits into twelve: a single image fades in alone, the stack behind it opens into a ring that orbits the wordmark, and on click each image leaves the ring at the instant it is flat to the viewer and flies to its place in a four-column grid.

**Workflow and exact asks:** Figma concept plus a second design only to show the loading state (a ring of images around the wordmark: "very difficult to explain with text alone"). Grey tones only apart from the images; Poppins throughout (regular body, caps medium for eyebrows and nav); project grid boxed by vertical and horizontal hairline dividers (what gives the editorial feel). Image prompt written by Claude from a few liked examples plus a note on what he likes in each, in TWO paragraphs: (1) what is in the frame (environment, model, layout), (2) the feel (colour tones, camera specifics, vibe). Paragraph 2 can be reused across a shoot "like a filter in Photoshop". Per image: some still and calm, some with motion (blur, mid-step poses). Nano Banana 2K, 3:4 (4K is overkill for web), 12 images. MCP warning: it may silently generate a second version and spend credits; tell it "do not generate additional images without asking me first". Build in Claude Code with Fable 5, effort high. Prompt: goal (single page portfolio), reference images, visuals folder, loading sequence (screen empty, one image fades in, all twelve stacked behind it in the same spot, then the stack opens and settles into a slowly orbiting ring while wordmark and button fade in), transition on click (images leave one at a time, ONLY when at zero degrees on the far right of the ring so they depart flat), then page top to bottom, tokens, notes "everything eases softly and nothing snaps". Tweaks: faster orbit; use the image order of his reference rather than random; relocation top left to bottom right; homepage fades in only after all images landed so they do not overlap. Extra: a hover video per tile made with the MCP in the same chat, same 3:4, the original image kept as the start frame so the image-to-video hand-off is invisible, plays only on hover.

**Animation (burst):** (`F3hLSg3XcoE-intro-one-image-alone-on-white.png`, `...-intro-ring-orbits-wordmark.png`): the site is shown tilted on a laptop. The screen goes from grey to white, a single portrait photo sits alone in the centre; about 0.5 s later the ring of about 12 photos exists around the big "Studio Palette" wordmark and a small pill button, photos slightly rotated and slowly turning around the circle (a few px per 0.35 s). Frames in between (the bloom itself) were not captured, so the bloom is narration only. Grid relocation not captured.

**Discount:** sponsor Higgsfield; the first-result "close to what I had in mind" is his own judgement.

---

## 13. I0Eb0Vi5OEg | Claude Code + Seedance 2.5 for Beautiful Websites (11:59) [transcript panel + frame burst]

**One idea:** the same static site, then the same site with only motion added ("Not a single design choice changed"). He proves the value of motion with a before/after, and builds ONE SECTION PER PROMPT: each section has its own exported Figma image as reference, built static first, animations added later, top to bottom.

**Workflow and settings:** Figma sections exported one by one. Crimson Text in ONE weight only (near black regular for headings and body; caps with wide letter spacing in lighter grey for eyebrows). Section backgrounds alternate: white hero, black intro, white featured work, warm cream close. Seedance 2.5 via Lovart: up to 30 s in one pass, up to 30 reference images, 10 video and 10 audio clips (he found it ignores some of 30 sheets); the real gain is accuracy: label text on bottles legible while orbiting, shapes stay consistent, hands. Use Lovart's Video Gen panel instead of the agent for expensive models because it shows the credit cost. Clip recipes: hero portrait with a static camera, "only the shadows move slowly as if wind passes through branches above her"; tennis player extreme slow motion with a locked camera (focus shift from foreground to background, net stays accurate); flat-lay product where only the light sweeps in an arc from upper right to upper left, camera static (a cheap way to make a static portfolio look high end); start frame plus end frame for a slow pull-back. Build in Claude Code with Opus 5, effort high; first prompt only the static desktop hero, "structure the code so new sections can be added without rebuilding anything"; prompts written by speaking into a voice transcriber, then a Claude chat turns that into one clean prompt (1 to 2 minutes per section).

**Animations asked for:** hero title typewriter (first part fixed, only the phrase after it types); hero gallery of five videos playing in sequence and auto-rotating; paragraph colour wipe tied to scroll (dark grey to white, text already there, "you're just uncovering it"); video of moving light with parallax AND scroll scrubbing on the same element; featured projects gently fade up as they enter (he asks for this in almost every project, works on anything); scrubbed scale: video starts at 45% of its size, centred, scales to 100% as the section scrolls through, footage plays in step so it reaches its end together with the full size, scrolling back reverses both, wordmark does not scale; "the footage itself is already zooming, so it feels much bigger than it is".

**Animations (burst):** (`I0Eb0Vi5OEg-hero-typewriter-and-video-gallery-progress-ring.png`): hero title "A Brand That Resonates" with a blinking text cursor, a small caps subtitle, a thin circular progress ring above the row of five tall photo tiles (the ring is the timer for the auto-rotating video gallery, one tile active, in colour; others waiting). Site shown tilted on a laptop. (`...-scrubbed-scale-prompt-on-screen.png`): his own prompt text for the scrubbed scale is readable beside the clip (the sentences above are from it). Verified: cursor, ring timer, prompt wording. Not captured: the actual 45% to 100% growth.

**Costs he states:** 175 credits for five 5-second top-quality clips ($0.70 to $1.40 by plan), a little over 1000 credits for the 30-second clips ($4 to $8); Claude $20 Pro plan, no hourly limit hit. (His words, not API prices.)

**Discount:** Lovart sponsor; Seedance accuracy claims shown on his own test clips.

---

## 14. oc-GHIxZkes | AI Hero Video Battle: 9 Models Tested (11:35) [transcript panel + frame burst]

**One idea:** one prompt, one shot, nine video models, judged as a web designer: usability for a hero (does the end frame leave room for text, is the product and logo accurate, is the cup the right size) matters more than "wow". The cheap MiniMax H3 won.

**The test (exact):** 10 s, 16:9, 1080p where allowed; a coffee company's Halloween pumpkin-spice hero; the same product reference image (with logo) on every model; opens in a spooky place with the cup NOT visible, the camera travels forward through creepy events in one continuous shot (model invents the setting), ends in front of a sinister man who serves the drink; product on the LEFT of the final frame to leave room for hero text; negative prompt: "no cuts and no text other than a logo on the cup". Credits as he states them: Wan 3.0 Prime 35 (cup came out huge, unusable); Gemini Omni Flash 1.1 45 (printed "one continuous shot" into the video, ignored reference, unusable); MiniMax H3 20 (best: swampy forest, a shadowy figure who steps out from behind a tree as the reveal, nailed text and left placement); FLUX 3 80 (reference image fills the frame for one second first, two cinnamon sticks, botched text); Grok Imagine 1.5 45 (only 720p with a reference, cut to another scene, extra cinnamon stick); Seedance 2.0 120 (smooth, creative alley, glitching pumpkin, ignored the reveal); Seedance 2.5 160 (8x MiniMax; great lighting, depth blur on the man, accurate product, no real flaws); Kling 3.0 Omni 15 (okay but boring); Kling 4.0 10 (temporary discount, normally 40; slow start then speeds up, accurate). Podium: Seedance 2.5 and Kling 4.0 high quality; MiniMax overall winner because the end shot has a soft dark background that works behind text, props stay consistent, and it is cheap. A lightning flash on top was added with Claude. MiniMax is also his pick when start frame and end frame must be exact (seamless loops).

**Video on a website (explicit list, transferable):** tell Claude "load fast": compress; a lower resolution version for phones; WebM (30 to 50% smaller at the same quality) with fallback; image sequence for scroll-scrubbed video; a poster image so there is never a black box; the video itself does not rank but page speed does; keep the H1 and copy as real HTML, never text inside the video.

**Animation (burst, 4 frames):** (`oc-GHIxZkes-winner-hero-swamp-start.png`, `...-camera-pushed-forward.png`): the winning clip in a laptop mock-up with "localhost" and a transparent nav (logo left, MENU / LOCATIONS / OUR STORY, a pill button on the right). Camera moves forward slowly through the swamp: the two glowing pumpkins grow and drift apart, a skeletal hand rises from the ground on the right, a dark figure appears behind a tree trunk in the last frame. Pace: pumpkins grew by about 40% across 1.4 s of video. Verified from 4 frames; the text and final serve shot were not captured.

**Discount:** Higgsfield sponsor; "one shot per model" means a single sample each (his own sample, not a benchmark); credit prices change (Kling 4.0 was discounted).

---

## 15. OoRjBPxKN24 | Parallax Hero Design with GPT-6 Astra (6:31) [transcript panel + frame burst]

**One idea:** a parallax hero from ONE photo cut into depth layers (sky, dunes, model plus foreground pebbles) with the brand wordmark sitting BEHIND the model, each layer moving at its own speed on scroll (closer layer moves more). The cutting is done by a three-step prompt, so the technique is repeatable for any photo.

**Photo requirements:** clear lines so parts separate cleanly; everything in focus; an empty area (sky) where the wordmark goes. More layers = more depth.

**Prompt 1 (layer split), three steps:** (1) analyse the uploaded image and find layers: background first, then objects between background and subject, then the subject and foreground; (2) separate and generate each layer as its own image through the Higgsfield plugin with GPT Image 2.5, chosen because it outputs an ALPHA channel (real transparency; Nano Banana fills with solid white); (3) deliver all layers in one gallery for download. **Prompt 2 (hero build):** full-screen parallax hero, the scene is one photo split into a background and several transparent images; a large wordmark sits behind the transparent images; layout top to bottom (nav, wordmark, images); tokens: an elegant serif paired with a sans-serif, colours taken from the photo; animation: each layer moves at its own speed, the closer the more. Built in ChatGPT with GPT-6 Astra and the Higgsfield plugin inside ChatGPT (no Claude here), which is the one video where the builder is not Claude. Add-ons: new elements (clouds, a hot air balloon) are first generated INTO the original image so they match the lighting, then separated to transparent layers (adding them to the first reference makes separation harder); clouds as an infinite horizontal ticker; images follow the mouse on hover; same in 3D so the section tilts slightly under the mouse.

**Animation (burst):** (`OoRjBPxKN24-solenne-wordmark-behind-model.png`): "SOLENNE" in huge, wide serif letters spans the top, the model stands in front of the middle letters (letters hidden behind her body and dress), a frosted card bottom left "The Ivory collection" with two buttons, a pill nav at top. (`...-wordmark-sinks-behind-dunes-on-scroll.png`): after a scroll the wordmark has moved DOWN to sit between the sky and the dune line, still behind the model, while the model and foreground rocks stay near put: the word and the model move at different speeds (depth). A cut from a black frame with a fast horizontal wipe (a laptop sliding in) opens the demo. Verified for two positions; the speed ratio could not be measured.

**Discount:** Higgsfield sponsor; the earlier videos use Claude and this one ChatGPT, so which tool does the layer cut best is not compared.

---

## 16. FO24eqAlQds | Testing GPT-6 ASTRA for Webdesign (10:45) [transcript panel + frame burst]

**One idea:** a fair way to judge a builder: three tasks (total freedom, "learn my style from nine of my sites", a long story prompt), each model makes a whole new site. His verdict: GPT-6 Astra gave cleaner designs than Fable 5.1 in all three; both can build 99% of sites, the difference is design judgement.

**Useful parts:** test 2 prompt: "I have a collection of coding projects, pick up my design style, my image style and the motion techniques, then create the most interesting new hero". Both models detected his fonts (Cormorant plus Montserrat caps), loading screen, black pill button. Fable's clever idea: three Higgsfield videos of a character looking left to right, following the mouse. Astra's: a hero where the picture grows and pushes its neighbours away to move into the next section. Test 1: the Fable result looked "AI-made" (font choice, cluttered hero, a barely visible background video, a video looping back and forth like a bug, a misaligned area); Astra used a scroll-tied video, clearer hierarchy and a clickable fake software UI. Time and cost: Fable 21 min, about 22,000 tokens; Astra 24 min and 98% of a five-hour limit. Test 3 gave each model 600 Higgsfield credits for a mood-board story; Fable's story was "creepy" and badly spaced.

**Animation (burst):** (`FO24eqAlQds-astra-hero-full-bleed-video.png`, `...-astra-hero-shrinks-to-framed-carousel.png`): site "interval." (the Test 2 result). A full-bleed desert video fills the screen with a huge serif headline "Where the quiet moves." (last word italic) and a thin nav. On scroll the whole video shrinks from edge to edge down to a framed card in the middle of a cream page, neighbouring photos peeking in at both sides, a small three-item index at the bottom. The fabric in the clip keeps moving inside the shrinking frame. The shrink itself fell between my frames, so its speed is unmeasured.

**Discount:** opinion test, one run per model, his taste as judge; Higgsfield sponsor; model versions will date quickly.

---

## Videos not watched

None left. The 11 skipped ones were watched later the same day, see sections 17 to 27 below.

## Added later the same day: the last 11 videos (sections 17 to 27)

Same method: transcript panel read with get_page_text in the user's Chrome, then bursts of 4 to 5 zoomed frames with the video slowed to 0.1x. Frame names start with the video id. In every demo clip the site is shown tilted on a laptop or in a flat browser frame, so what moves is read from the spacing between frames and marked "partly verified" where the burst missed the key moment. Where a video repeats an earlier one I say "repeats" and add only what is new.

---

## 17. HrD3y4bwHcg | Design a Real Shopify Store with AI (8:26, 882 views) [transcript + one frame burst]

**One idea:** vibecoded sites have no CMS, so a shop needs the Shopify back end. A sponsored app (Instant AI, affiliate link) builds Shopify pages by prompting an agent, and every button and product is linked to a real product, so the price and photo update by themselves.

**Workflow:** Figma concept first, used as a reference image and as the source of the design tokens. Tokens: cream and white sections alternating with no borders or lines, taupe and brown accents, Alegreya for display, Inter for body and eyebrows, 4 px corner radius on buttons, images and blocks ("sharp felt rigid, large felt playful"). He designed only the hero, not the whole page, because the app has pre-made sections he restyles. The tokens go into the app's brand kit once (typed in by talking the agent through the design), then every prompt after that skips them. Adding a section: pick a pre-made template, select it on the canvas (it is tagged in the chat), say "style it with the brand kit", then ask for a matching image and to fill it with real products. Static versus dynamic content: dynamic is linked to a Shopify product. Publish turns the design into Liquid code inside the theme.

**Animation:** only two, both prompted. A slider with a ticker (continuous sideways drift of three product photos, third one cut by the edge: `HrD3y4bwHcg-instant-ai-prompt-ticker-on-slider.png` shows the prompt "Add a ticker animation to the images" typed into the agent beside the page). And fade-ins on scroll with a delay for each section so they arrive one by one ("small details like these make it feel luxurious"). Motion itself not captured, it is narration.

**Discount:** sponsor and affiliate; only a hero, no checkout shown; the claim "secure" is his.

**Repeats:** concept in Figma, brand kit as tokens, alternate backgrounds. **New for us:** none for the look; relevant only as a reminder that a real shop needs a real back end, which we already do not fake.

---

## 18. BVMuRw8BgJg | Design an Animated Website Hero Using Framer and AI (10:07, 10 months old) [transcript + frame burst]

**One idea:** a floating subject with a transparent background. Generate the subject on a flat green background, animate it, remove the green in a video editor, export WebM with alpha, and lay it over a separate background picture in the hero.

**Exact steps:** (1) Nano Banana: hyper-realistic astronaut floating in space, helmet blacked out, looking slightly to the side, 4:5. (2) Same model: replace the background with a common green-screen green. (3) Background: Photoshop magic wand on the subject, expand a few pixels, Generative Fill to remove him, adjust contrast, export JPEG at 60% quality. (4) Veo 3.1 in Gemini with a prompt that explicitly says do not zoom, spin or reposition the subject ("the trick is not to overdo the movement"). (5) Premiere Pro: Ultra Key, preset Aggressive, fine-tune the mask, export WebM, codec VP9, alpha channel included. A free plugin is needed because Premiere has no WebM export; the other route is MOV then CloudConvert. Downside he states: some browsers do not support WebM alpha, so keep a GIF or PNG fallback. (6) Framer: 800 px hero, black, container 80% wide with max 1200 px, nav bar absolute so it floats, Inter, button with rounded edges, video 500 px wide absolute, background image on an absolute stack set to fill. Effects: a subtle appear effect on load that slides the astronaut in from the right, a scroll effect that moves him once the visitor scrolls, parallax on the background at 40% speed.

**Animation (burst, `BVMuRw8BgJg-astronaut-floats-over-headline-a.png` and `-b.png`):** the headline "A NEW ERA" is fixed on black. The astronaut drifts slowly in place, the whole body tilting and shifting a few pixels up and left across the burst, and he sits in FRONT of the last letters of the headline, so the transparent video overlaps the text. Calm, no zoom, matches his prompt. The slide-in from the right and the scroll move were not in my frames (narration only).

**Discount:** old video, no sponsor line; keys on the Premiere plugin and Photoshop (paid tools). The alpha-channel problem across browsers is real and he gives no test of it.

**New:** green-screen method for a transparent video; VP9 with alpha plus a PNG fallback (0 hits for green screen, alpha and VP9 in our rules). **Caution:** a transparent WebM is a heavy path; our own rule of "real HTML text, picture under it" is simpler for most businesses.

---

## 19. 47geVNoSrz4 | Design a Fully Animated Website with AI, Claude Code (7:50, 10K views) [transcript + frame bursts]

**Repeats video 1** (five-minute Figma sketch per page, grey tones, ticker row, white block on click, black info panel). **New:**

- **State to state prompting:** describe an opening state, then the transition, then a resting state; showing both states is what makes the move smooth. "This is how I create more advanced animations, section by section."
- **Put the centre image last:** the flip intro cycles seven photos in the middle; the fourth (the one in the centre of the final row) is the LAST in the flip so it lands and stays when the row spreads out.
- **Ask the model to explain first:** when something went wrong he wrote what he thought was wrong and asked Claude to say if it understood, then replied "you understand now, make the adjustments". It worked first time. Sketches are only a backup: the text prompt wins over the picture.
- **One after the other, on purpose:** click, white block covers the site, THEN the image relocates to the right half, THEN a second image fades in on the left. "This gives the slow, luxurious feel." Info page: black block over everything except the nav, then image, paragraphs, quote fade in one at a time.
- Hover: all the other images dim. Each image used once, spread evenly.

**Animation (burst `47geVNoSrz4-burnett-ticker-row-drifting-left-a.png`, `-b.png`):** site "Burnett". A single row of tall portrait photos with title and caption under each, on white, the wordmark centred at the top. The row drifts right to left, about 4 px per frame in the 504 px frame, no stopping. The demo opens on a dim, tilted laptop that levels and brightens as the row is already moving. The 7-photo flip intro and the click transition were NOT in my frames (they sit in the video's first seconds as narration over a cut), so they are narration only.

**Discount:** free download funnel; the two hour build claim is his own.

---

## 20. aBdxnhKegRU | Design a Fully Animated Website with AI, Claude Code, split screen (7:19, 2.2K views) [transcript + frame bursts]

**One idea:** a split screen where the two halves always move in opposite directions ("push and pull"), reused as the signature for every transition: opening, project scroll, project pages, menu.

**Repeats video 3's mirror type** with a real build. **New and exact:**
- Foundation prompt first: purpose, split-screen architecture and the signature scroll animation, even though the first section does not use it yet, "the first prompt lays the foundation for the whole website". Then the home page and the vertical project scroll, then image path and tokens (fonts, colours, dividers).
- Prompt writing: sketch in Figma kept simple ("too much detail confuses the model"), describe everything per section, dictate it with a voice transcriber, paste it into a Claude chat and ask for a proper prompt. "What matters most is getting the first prompt right: if unclear, Claude may pick the wrong library or stack."
- **Scroll he did not want:** the first build locked scroll to exactly one project per step (he had asked for that). He wanted smooth scrolling that still ends with the title matching its thumbnail.
- **Alignment is the weak spot:** Claude cannot tell from a reference which things line up (project text with the logo, centre versus left). State alignment in the first prompt.
- Hover: darken the thumbnail slightly, zoom in, show a plus icon. Click: image fills the right half, a white block on the left is pushed down, text fades in one by one.
- Menu covers only the right half, slides in, the burger turns into a close button, items and the studio block fade in one at a time.
- Loader: two images push in, one fills the left half and one the right, from opposite vertical directions; random pair each visit, never the same project on both sides; the logo slowly expands to a wider letter spacing "as if it breathes outwards".

**Animation (bursts):**
- Opening (`aBdxnhKegRU-kendall-split-opening-wordmark-on-seam.png`): site "KENDALL". Two full-height photos side by side, a woman in a field on the left and a man in a chair on the right. The widely spaced wordmark sits across the seam in the middle. Across 4 frames the wordmark stays still and fades out and the two photos hold; the push-in itself (images entering from top and bottom) fell before my first frame, so it is narration.
- Project scroll (`aBdxnhKegRU-split-scroll-titles-up-photos-down-a.png`, `-b.png`): left half a list of titles on white (Daylight, Northlight, Aperture, Monolith), the active one large, neighbours small and faint; right half a column of photos on off-white. Between the two frames the title list moves UP (Northlight to Aperture in the centre) while the photo column moves DOWN, so each title and its photo meet in the middle. Smooth, about one title per two frames. Fully verified from 4 frames; same behaviour as video 3, in a finished site.

**Discount:** the Opus 4.8 mention dates quickly; free files are the funnel; thanks for 1000 subscribers is padding.

---

## 21. SLnGJ9iezYo | Design an Animated Website Hero with AI, Claude and Higgsfield, the light switch (7:05, 6.4K views) [transcript + frame bursts]

**One idea:** one hero, two states, dark and lit. A toggle sits on the letter "O" of a giant wordmark. Flip it and the whole room lights up; while the lights are off, the cursor is a soft flashlight that reveals the lit room underneath.

**Steps and settings:** two Figma sketches (dark and lit) with the toggle on the "O". Image: Nano Banana, a cosy living room with a fireplace plus a "style prompt" from his free library (a partial prompt pasted at the END of every image prompt: here warm tones, bright lighting, high contrast). Iterate one change at a time (lamp, hanging lamp, rounder sofa), then a lit evening version, then a version with everything dimmed except the fireplace = the "lights off" frame. Warning he gives: every AI edit re-renders the whole image, so quality slowly drops after many edits on the same image. Video: Higgsfield Cinema Studio 2.5, NOT the newer Seedance, because the move is simple: the same image as start and end frame, a fixed camera, "leave everything exactly as is, only animate the flames"; cheaper. Toggle: a designer lamp switch in a direct front view, perfectly symmetrical so it sits on the "O"; a second image of the same switch flipped; circular mask in Photoshop; two transparent PNGs. Four assets in all. Build prompts: layout (nav in the corners, logo almost full width, toggle on the "O", a subtle gradient at the top for the nav, a stronger one at the bottom fading to black), then the videos autoplay muted loop, then the cursor (only when lights are off, heavy feathered edge "like a soft brush stroke"), then the loader (full black with only the wordmark and toggle, then the rest fades in around them without the logo shifting). First result had the logo misaligned; uploading the Figma sketch fixed it ("five minutes of sketching saved half an hour").

**Unprompted detail:** when the cursor leaves the window the spotlight dims out slowly. Claude added it as clean-up logic.

**Animation (bursts):**
- `SLnGJ9iezYo-sommers-dark-room-spotlight-lights-lamp.png`: "SOMMERS" in huge white caps across a dark room, the round marble toggle with a brass switch inside the "O", fire glowing. In the burst a patch of the lit room (a lamp on the right) shows where the cursor moves. Subtle, the cursor itself not drawn. Partly verified.
- `SLnGJ9iezYo-sommers-toggle-dark-start.png` to `...-toggle-lit-end.png`: over 4 frames the room goes from nearly dark to fully lit: lampshade, plant, bookshelf and sofa appear, a warm glow rises from the bottom. The wordmark and toggle do not move. A cross-fade of two videos, about 1 to 2 s at real speed (spacing estimate, partly verified).

**Discount:** free files funnel; the flashlight idea is in our page-rule notes (a "flashlight hero" is named at line 2185) but not as a rule.

**New:** the on/off toggle as a content switch; the end of the cursor effect (fade out on leave); one change per generation; "style prompt" pasted at the end.

---

## 22. -dkB7O48-xA | Design an Animated Website Hero with AI, Claude and Higgsfield, scrub reveal (6:25, 14K views) [transcript + frame bursts]

**One idea:** a video that only plays when you scroll (scrub) and that grows from a half-screen image into the full screen, while the heading moves and the quote is covered. He built the REVERSED version too and preferred it: start full screen and shrink into the side image to reveal the quote.

**Steps and settings:** warm-tone style prompt (free library) plus a reference photo of the model, "place her in a kitchen" and nothing else (the style prompt does the rest). Second image: the same room with the model removed = end frame. Seedance 2.0, start frame and end frame, prompt "make the subject walk out of the frame". For the reversed version: the same two images with start and end swapped (she walks INTO the scene). Do not play the video backwards: Claude asked if he wanted that, and she would walk backwards. Claude Design (the design app): he tried it first and was disappointed (did not read the Figma file, sliders too limited, "useful for exploring ideas and wireframes"). Handed off to Claude Code, which understood the same prompts much better. Build section by section; the transition last. Transition prompt: the right-side image becomes full screen on scroll; the quote on the bottom left is covered; the large heading moves from top left to the centre. He told Claude to ask questions if unsure (a branch for the experiment). Loader: blank full screen to the site while the logo stays and turns from dark brown to white.

**Animation (bursts):**
- Loader (`-dkB7O48-xA-loader-blank-with-brown-wordmark.png` and the next frames): a warm grey blank with "KATE MONROE" in dark brown letter-spaced caps; the kitchen photo fades up through the blank (washed out, then full colour), the wordmark ends in white over the photo and a small subtitle appears. Verified from 8 frames.
- Reversed transition (`-dkB7O48-xA-hero-start-brown-panel-video-right.png`, `-dkB7O48-xA-video-grows-left-over-panel-wordmark-centres.png`): start state is a brown panel on the left with the wordmark top left, a small bedroom thumbnail and a quote bottom left, and the right half a video of the woman standing at a kitchen island. During the scroll the video grows to the LEFT, covering the panel from the right; the wordmark slides toward the centre and its letters pass over the picture in white; the thumbnail and quote are covered by the picture. Verified from 4 frames; speed follows the scroll.

**Discount:** Seedance 2.0 and the model versions date quickly; "under 90 minutes" is his claim.

**New:** the reversed direction as a deliberate test; "ask the model to ask you" on a risky change; same start and end images swapped to make the opposite walk.

---

## 23. mRYHgnnrCks | Build an Animated Website Hero with AI, Claude Code, sphere (8:09, 7.5K views) [transcript + frame bursts]

**One idea:** photos mounted on an invisible 3D sphere that orbits the centred logo, some in front of the logo and some behind it, grabbed and spun by the visitor.

**Exact asks:** Figma shows the orbit by placing the images in a rough sphere shape, larger ones closer, lower opacity for far ones (start state), plus a second reference for the project page (end state). Warm off-white, Tenor Sans caps with wide spacing. Prompt order: nav, background, sphere with images and logo, then ALL animations. Spread the images with a **Fibonacci spiral** so they are even and not clumped at the poles. **Billboarding:** cards always rotate to face the viewer, never show their thin edge. Cards fade in one by one and bloom outward from the centre; one slow rotation every 50 seconds; a gentle bob per card, out of sync; grab and release keeps spinning then slows "like it has weight"; hover makes the card fully opaque and holds still, remembers its place and glides back when released. Build mistakes: images overlapped the nav, and Claude put the logo BEHIND the whole sphere instead of inside it. One prompt on a new branch fixed all. Transition on click, strictly in order: the clicked image stays where it is and everything else fades, THEN it moves to the right side and fills it, THEN the text fades in on the left one element at a time. He kept the transition out of the first prompt on purpose ("the harder, more fragile part"). Precision trick: ask Claude for the distance in pixels (paragraph to the bottom of the window) and answer with an exact number instead of "a bit higher". Mobile, top to bottom: logo left plus burger, stacked nav, the sphere tilted so the orbit is vertical, allowed to overflow the screen a little so images stay big, project page as picture on top, text under.

**Animation (bursts):** `mRYHgnnrCks-clares-photo-sphere-around-logo-a.png`, `-b.png`: site "CLARES". About ten photo cards float around the centred wordmark, never turning their edge, different sizes, and some overlap the letters (a card hides the "S") while others sit behind them. Across the second burst the arrangement changes: cards swap sides slowly and the bottom card slides, so it is a slow orbit, a few px per frame. Verified: layout, in front and behind the logo, billboard look. `mRYHgnnrCks-clares-project-page-text-left-image-right.png`: project page "Reverie", a tall horse and woman photo on the right, heading and short text on the left. In the next frames the text fades out and the image gets smaller, which looks like the way out (closing), partly verified. The click transition itself and the drag were not captured.

**Discount:** free files funnel; "I'd pick this for my portfolio" is a portfolio, not a business.

**New:** Fibonacci spread, billboarding, hover that holds and remembers, "momentum like weight", nothing like it in our rules (0 hits for Fibonacci and billboard). Related: ring intro (12), field flight (9).

---

## 24. LYZbx1PYzfA | Build an Animated Website Hero with AI, Claude Code and Lovart, bottles (9:49, 4.1K views) [transcript + frame bursts]

**One idea:** the invisible video handoff. A dark backlit video plays once; at its last frame it is silently replaced by four stacked images in the same place and size (background plus one transparent PNG per bottle), because a video cannot be interactive and layers can. Then the page scrolls and the bottles move.

**Steps:** a few low-quality iPhone photos of a brandless bottle on white paper (different angles, plain contrasting background, clear textures). Lovart agent: beige gradient background, three bottles each on a walnut pedestal; four at once; upscale on the canvas. Logo: he placed the text roughly on the bottle in a photo editor as a position reference, plus a white-on-black logo image. ChatGPT image model is the default; hands looked plastic, so switch to Nano Banana for those. After the logo version exists, use ONLY that image as reference. Dark version with lights off and a soft backlight = start frame; select two images and ask for a transition = video. Remove background on the canvas for the three bottles. Only two Claude Code prompts: (1) play the video once, at its last frame swap to the stacked images, "layer the images on top of the video, hidden, reveal when it ended"; (2) scroll scrub: the bottles line up in a row while the logo rises from behind them, tied to the scroll position and reversible; then the logo shrinks into the nav, and only after it settles the nav items and the tagline fade in one after the other. Fonts Aboreto for the wordmark, Noto Serif body. Colour choice: the beige is chosen to flatter the bottles, the cap wood matches the pedestal. Adjusted only the quote size. A Lovart skill makes on-brand mockup images; a screen recording is placed on it in Photoshop and exported as video.

**Animation (burst):** `LYZbx1PYzfA-nula-backlit-silhouettes-start.png` (three black bottle shapes on a deep brown ground), `LYZbx1PYzfA-nula-glow-appears-inside-bottles.png` (a thin amber glow appears inside the bottles, the white "NULA" label starts to show), `LYZbx1PYzfA-nula-fully-lit-end-frame.png` (warm beige studio, walnut pedestals, labels readable). Camera locked, only the light rises, about 4 frames from black silhouette to lit. The handoff and the scroll were not in the demo clip I could reach, so they are narration only (the page text said it plays on load).

**Discount:** Lovart sponsor, he says he will be honest and does name two weak spots (hands, forgetting the ratio costs tokens).

**New:** the handoff as an explicit pattern (0 hits for hand-off), the dark silhouette start that the light then fills (our 3ah light sweep is close), remove-background on the canvas. **Repeats** videos 5 (light reveal), 15 (layers).

---

## 25. vQm2DcpFjaM | Design an Animated Website with AI, Fable 5 and Lovart, scroll-jacking (9:04, 4.6K views) [transcript + frame bursts]

**One idea:** one chain of AI videos that reads as a single continuous shot. Order on the canvas: line drawing, realistic render, top-down, floor plan, three-quarter, night, wide day shot. Each video's last frame is the next one's first frame, and the page "eases to a stop and lands softly on each section" while scroll drives the video.

**Settings:** Seedance 2.0 in Lovart, 1080p not 4K (it goes onto a website and gets compressed), up to 15 s. Use the video menu, not the agent, so the credit cost shows before you commit. His comparison: the fast model 70 credits and the flagship 200 for the same clip; the fast one pushed hard to reach the end frame (dust clouds out of nowhere); flagship felt calmer, so only flagship afterwards. Images: one villa prompt (warm setting, background haze, soft sun flare), then "more shots from the same photo shoot, same lighting, same setting, only different angles", ten at a time in batches of five. Build: Fable 5 in Claude Code. Prompt order strictly top to bottom, never jumping back: goal (single page for an architecture studio, scroll-jacking), where the visuals are, the loader (logo centred, the drawing fades in), then each section with text, design, and its in-animation (how it comes in from the section before). Then a block "Global Behavior and Motion": the video handoffs, static nav at the top (not fixed), no audio, convert videos to WebM (Claude installs the tool itself). Last the tokens: background, font sizes, fonts. Cormorant for headings AND body, off-white not pure white, white text over the one dark image. Prompt dictated by voice, cleaned by Claude.

**Animation (bursts):**
- `vQm2DcpFjaM-linden-line-drawing-start-frame.png` to `vQm2DcpFjaM-linden-drawing-becomes-photo-wordmark.png`: a black-and-white line drawing of a desert villa on a mountain ground becomes the same view as a warm photo with sun flare, the framing identical; the wordmark "LINDEN" appears at the top. The change is a dissolve of two frames (no camera move), then the sun flare grows. Partly verified (4 frames, spacing only).
- `vQm2DcpFjaM-floor-plan-section-text-left-video-right.png`: a section on off-white with a small eyebrow, the heading "Drawing It Out, Getting Technical" and a paragraph on the left, and the top-down floor plan as a framed card on the right with a thin outline. In the last frame the heading fades while the card stays. Scroll bar visible on the right.

**Discount:** Lovart sponsor; the 70 vs 200 credits is one clip.

**New:** the whole page as one chained shot with each end frame planned as a section (also said in video 4); a "Global Behavior" block in the prompt; WebM conversion asked for inside the build prompt. **Matches** our scroll film rules (3aa); no change needed there.

---

## 26. mN2YIXtrcaM | Create Animated Websites with AI, Claude and Higgsfield (12:27, 1.3K views) [transcript + frame bursts]

**One idea:** build section by section, never one-shot. "I see a lot of people try to one-shot a website; this is the main difference between another AI-looking website and a customised one."

**Steps:** wireframe from his free app, style prompt (muted, sage green undertones, background haze, heavy lens bloom), Nano Banana at 4K in Higgsfield, many at once. Videos: Cinema Studio 2.5 (the older version) with a start and end frame and a camera movement preset, "consumes eight times less credits" than newer ones, prompt short ("the model slowly turns around and walks away"). Clips combined in any editor, exported MP4. About video: same image as start and end for a seamless loop. Project folder (Dropbox) with a visuals folder. Claude app on the $20 Pro plan, Opus 4.7. First prompt sets up fonts (Source Serif headings, Inter body), colours and animation helpers so only used fonts load. Then a pattern: add a section, adjust until happy, next. Hero prompt: two logo PNGs (black and white), the video, full white loader with a black logo that fades out while the logo stays and turns white on the video; the video converted to WebM by Claude itself. Run the site on a local server and look in a full browser, not the preview panel. Quote section: Claude writes a personal quote and gently animates it. Gallery: "come up with a playful way", a reference found online, lots of white space so the images have room for parallax. Fixes: fourth image placed more to the left, fade-in "too clunky" slowed. About: looping video left, two paragraphs right; the model compressed that video by itself because of the earlier prompt (his proof for building in sections). Responsive in its own step after saving to GitHub: burger, keep the full-screen hero video, REMOVE parallax on mobile and use one column ("less interesting, but more user friendly"). Final polish list: clunky scroll animation, spelling, image corner radius, custom cursor, semi-transparent blurred nav. Then Vercel for hosting and Sanity as a CMS for clients.

**Animation (bursts):** `mN2YIXtrcaM-robert-stanley-hero-reel-white-nav.png`: "ROBERT STANLEY" wordmark on a white bar, a full-width video reel of a couple embracing seen through the open window of an old truck; the window frame slides slowly sideways across the burst (the reel is a slow camera drift). `mN2YIXtrcaM-off-grid-gallery-three-heights.png`: white page, three portraits at different heights and sizes with wide gaps (off-grid), a strip of a fourth image peeking in at the top. The parallax speeds were not visible in these static frames, so they are narration.

**Discount:** Claude sponsor ad before the video; "Opus 4.7 is intelligent" is a remark.

**Repeats** many earlier lessons; the strongest repeated one is section by section (video 13 too).

---

## 27. MJojygFwGjA | Build an Animated Website with AI, Claude Code, Studio Monet (9:01, 1.6K views) [transcript + frame bursts]

**One idea:** write four reference images, one per intro phase (start state, text on image, title split, the midpoint of the scroll), because the scroll animation cannot be shown in one still. The midpoint "may look like an error" on purpose: text still low, an off-white block and the image only halfway up.

**Steps:** Newsreader for the wordmark and body, Montserrat small caps for eyebrows, lots of white space ("empty space is what makes the few elements you do place feel intentional"). Project page designed too: brief with a large image, three images with a ticker, concept, then previous and next project buttons; sections alternate white and off-white. Frosted glass menu pill and a white logo on the project page, because both sit on a photo. Visuals: one chosen image in Lovart, "a set of 20 photos from the same photo shoot, same colour tones, same setting, same model", Nano Banana, wide 4:3. Three prompts: (1) foundation plus intro phases (spiral, fade in, title split); (2) project scroll; (3) project page. **Spiral:** the six images should not take the shortest straight path to the centre but follow a curved arc that bows in the same rotational direction. **Scroll:** left and right titles push up like a vertical carousel while a full-width panel rises from the bottom over the old image and reveals the new one: "the image itself does not move, the panel sweeping up reveals it. That makes it a wipe rather than a push." Scroll is continuous, not one project per step: it settles softly on each project, and if you scroll hard you fly through several and it still lands softly. Project page: hover = plus icon plus slight dark; click = image expands to full screen then the page opens. Alignment stated exactly: heading aligned to the top of the image, text left margin equal to the image's right margin. Weak spot again: font and image sizes and spacing, centre versus left alignment.

**Animation (bursts):**
- Intro (`MJojygFwGjA-studio-monet-six-images-arrive-from-edges-a.png`, `-b.png`): a white page with "Studio Monet" and a tiny "ART DIRECTION" centred. About 2 s of nothing, then photos of a woman in a cream sweater on a tennis court come in from the edges of the screen toward the centre, different sizes and slightly rotated, ending around the title. (The tilted laptop frame is only the video's mock-up.) The curved path and the stack were NOT clear in 5 frames; the arrival from the edges is verified.
- Title split and scroll (`MJojygFwGjA-title-split-labels-beside-image.png`, `MJojygFwGjA-panel-rises-wipes-over-image-labels-up.png`): a big framed photo of the tennis player in the middle on off-white, the wordmark and a small MENU pill at the top, "STUDY / 11/08/2026" on the left and "IN MOTION / Photography" on the right. In the next frames both labels move UP and fade while a white panel rises from the bottom edge over the old image and a new picture (a net and racket) appears under it. Verified: matches his "panel wipe, image does not move" description. Speed: about one project change per second at 0.1x capture.

**Discount:** free files; two clean limits he names himself (size and alignment).

**Repeats** videos 1, 3, 20 (carousel opposite). **New:** midpoint reference frame; the explicit sentence "wipe, not push"; "one-step lock" fix; alignment written as margins in the prompt.

---

## What these 11 added (short)

Mostly repeats: eight of the eleven are the same series (Figma sketch, a style prompt, a start and end frame, build section by section) with a different hero. New material is in the techniques, not in the workflow: the video-to-layers handoff (24), the light switch with a cursor flashlight (21), a transparent WebM subject over a headline (18), the 3D photo sphere with billboarding (23), a single chained shot of videos with scroll-jacking (25), the reversed scroll reveal (22), the midpoint reference frame and the "wipe, not push" sentence (27), and state to state prompting (19). Shopify (17) is mainly a sponsor demo; the real-shop lesson is that a shop needs a back end, which his tool links to products.


---

# What it means for our sites (27 videos, grouped by theme)

Our method for comparison: starter kit (scrollcraft/starter), opening film from Higgsfield stills and clips played by the scroll (rules 3aa), rules in `docs/page-generation-rules.md` (3a to 3aj) and `docs/rules-checklist.md` (sections 1 to 9, 8b, 8c). I searched both files for each term to judge new versus known (0 hits means the word is not in the rules). Not applied to any file; these are options for new sites only.

Approved by Tzvi, 22 Nov 2026: the applicable lessons are page rules 3al.1 to 3al.9 (checklist R3al.1 to R3al.9).

## A. Plan the end frame, then the camera (strongest lesson: videos 4, 5, 6, 10, 11, 13)
- Every hero clip has a start frame AND an end frame, and the end frame is designed first with empty room for the text (5: "the most important part"; 10 and 11). **Known in part:** our rules mention end frames (9 hits). **New:** the reserved text area written into the prompt ("camera above the roof, clear sky"), the product placed on the left on purpose (14), and the same image as start AND end for a seamless loop (10).
- Locked-camera wording: "static locked-off camera, nothing moves except the light" (5, 10, 13). **New as an explicit prompt phrase.**
- Blender previz (11): grey blocks, checkerboard ground, red blocks mark the models, a nine second camera move; the Seedance prompt split by frame numbers (24 fps, 9 s = 216 frames). Our rules mention Blender 4 times. **New:** the red/grey/checkerboard convention and the frame-number prompt. Costly in time and tokens (his hotel scene took about 90 minutes), so only for a hero that truly needs a custom camera move.
- Resting frame (11): land on a frame with no motion blur and EASE THE PLAYBACK RATE DOWN, never just pause ("reads as a bug or a freeze"). **New** (0 hits). The scroll gesture is captured to advance the video; the page itself does not scroll.

## B. Hero ideas we do not have yet (1 to 2 videos each)
- **Light reveal** (5; also 13 flat-lay light sweep): near-black room, warm light sweeps in from one side across the product. Our rule 3ah already has a light sweep (Tova). **Known;** new is his recipe and a poster of the end frame for returning visitors. Burst: `V16Yhbu2eKg-light-reveal-sweep-from-left.png`.
- **Branching hero** (5): two clips from the same start image, each half of the page a choice, hover fades the other half, click pushes in. **New** (0 hits). Fits a business with two offers.
- **Split intro** (2; wipe in 1): the two words of the name split along a hairline and the page opens into the hero photo (`Op5kncXOL-A-split-intro-halves-opening.png`); the same split reused for hero image changes (one signature move used in several places). **New as a motion,** pure code, no paid generation.
- **Ring intro** (12): one photo, then a ring of twelve around the wordmark, each leaving the ring at zero degrees into a grid. **New.** Field flight (9) and sphere/orbit (4) are "travel" animations, also new; watch rule 3ai (three decorations at most).

## C. Scroll as the camera (3, 4, 5, 13; 11 and 14 mention it)
- Scrub video as an image sequence, not a video file: **already ours** (rule 3aa; 6 hits for scrub). **New details** from video 14: compressed WebM (30 to 50% smaller) with MP4 fallback for play-on-load, a lower resolution version for phones, a poster image so there is never a black box, strip the sound (Kling adds it), keep H1 and copy as real HTML (0 hits for WebM).
- Scrubbed scale (13): the video starts at 45% size and reaches 100% as the footage reaches its end; wordmark does not scale. **New, concrete numbers.**
- Full-bleed hero video that shrinks to a framed card with neighbours peeking in (16). **New.**

## D. One look for all pictures (2, 7, 8, 9, 10, 12)
- Three-colour image system: three colours given to three objects, the rest of the scene matched (2). Our rules mention three colours twice; **new:** allocation per object.
- A saved "skill" with hex colours, lighting and textures, one image model every time because models drift even with the same prompt (8); extend it with the site's design tokens so ads and flyers come back on brand (relevant to our ad studio). **New as a reusable skill.**
- A photoshoot from one picture: Claude writes the set of prompts, the reference uploaded with every prompt (9). Prompt in two paragraphs, content versus feel, the second reusable "like a filter" (12). **New.**
- A sheet of scribbles used only as a style reference (7). **New.**
- MCP warning: tell it not to generate extra images without asking (12). Fits our credit rules.

## E. How to prompt (about 10 of 16 repeat one layout)
- Goal, reference image, visuals folder, layout top to bottom, design tokens, animations last and longest (2, 6, 7, 8, 9, 10, 11, 12, 13). **Already ours.** A Figma or wireframe image beside the text (1, 3, 5, 7, 9, 10, 11, 12, 13): **known** (concept sheets, 3q).
- **New:** "where the image and the text disagree, follow the image" (7); ONE SECTION PER PROMPT with its own exported reference image, static first, motion later (13); alternating the model left and right looked good in Figma but failed live because the video had to travel sideways (11): test motion limits live before designing around them.
- Animation lines with numbers: "wipe in left to right with clip-path over 1.2 s", "cards rise like a blind, scale 1.25 to 1, 120 ms apart", "nearest cards travel 200 px, far ones 60 px", "video begins at 45%" (8, 9, 13). We check motion feel; **new:** seconds, scale and stagger go into the prompt (0 hits for clip-path).
- The right word for the effect: "inertia" for drag glide (1, 3; 0 hits), "multiply" blend for paper grain (6, 7), "scrub", "parallax", "alpha" (15; 0 hits).
- Dictate long prompts by voice, have a chat turn it into one clean prompt (2, 8, 13).

## F. Layered parallax from one photo (15; parallax also in 4 and 16)
- Three-step prompt: find depth layers, cut each as its own PNG with an alpha channel (GPT Image 2.5, because Nano Banana fills white), deliver as one gallery; the wordmark sits behind the model. **New** (0 hits). Add clouds or props by generating them INTO the picture first so lighting matches, then cutting them out.

## G. Page types that break one rule (3)
- Mirror split with opposite scroll directions: known (5 hits). Horizontal scroll with snap and a counter, a timeline whose line draws itself (3, 6, 7), a draggable infinite canvas with inertia (1, 3), interface sites that look like a calendar or photo app, physics with Matter.js: **mostly new as types**, and each fits only some businesses (a calendar site for classes or bookings, a floor plan for a venue). Our rule 3t (site follows its category) is the filter.
- The hand-drawn line down the page with doodles and note cards (7): a personal-story look, probably not for rentals.

## H. Restraint (the part that matters most for us)
- "Only animations with a clear purpose" (2); a reveal on a busy page makes nothing stand out (4); parallax OFF on mobile (4); skip intros on information sites such as a restaurant menu, keep intros to a few seconds and first visit only (4). **Matches our rules 3ac and 3ai;** reinforces them.
- A before/after of the same site static versus animated (13): a clean way to show a client why motion matters. **New idea for our sales pages.**

## I. Quality control he models
- Check legibility on every scene before building (four versions of one design, 10). Tell the model black hair never overlaps black nav text (11). A soft dark ellipse for text readability, not a blur on the whole layer (a bug in 9).
- Judge video models for a hero, not for wow: product accurate, text on the cup readable, end frame with room for copy, price (14). MiniMax H3 for exact frames and cheap, Kling 4.0 for camera, Seedance 2.5 for lighting. **Check any credit number against our API before using it (our rule: prices only from the API).**

## J. New themes from videos 17 to 27 (NEW = 0 hits in our two rules files; KNOWN = already in our rules or notes)
- **Invisible handoff from video to layers** (24): the video plays once, at its last frame it is swapped for stacked images in the same place and size, so the page can then be interactive. Also the chain of videos where each end frame is the next start frame, planned as sections (25, 4, 11). **NEW** (0 hits for handoff). Fits our scroll films (3aa) because it solves "video cannot be interactive".
- **Light switch and cursor flashlight** (21): two states of one hero, a toggle on a letter, the lit room revealed under the cursor with a soft edge, the glow fading when the cursor leaves. **Partly KNOWN** (a flashlight hero is named in our page-rule notes, not as a rule); the toggle as a content switch and the fade-out on leave are **NEW**. Only for a business whose story is light or mood (a restaurant, a hotel, a lamp shop).
- **State to state prompting** (19, 22, 27): describe the opening state, the transition, the resting state, and give the midpoint of a scroll animation as its own reference image (27). **NEW as a method;** our concept sheets (3q) have start and end but not a midpoint.
- **Sequenced, never together** (19, 20, 23): click, cover, THEN relocate, THEN fade the text in one element at a time; in the prompt say "only after the previous step has settled". **Partly KNOWN** (our rules have one hit for one-after-another); **NEW** as a stated rule for page transitions.
- **Panel wipe, not push** (27): the picture does not move, a panel rises over it. Titles push up like a carousel in the same moment. **NEW** as wording; the effect is close to our wipe reveals.
- **Soft-stop continuous scroll** (27, 25): lands softly on each section, and a harder scroll flies through several and still lands softly. A one-step-per-scroll lock was the thing he had to undo (20). **NEW** (0 hits for scroll-jacking). Watch for accessibility and for keyboard and touch use; he does not test them.
- **3D photo sphere** (23): Fibonacci spread, billboarded cards, out-of-sync bob, hover that holds and returns, momentum on release, the logo INSIDE the sphere. **NEW** (0 hits). One more "travel" effect with the ring (12), field flight (9) and sphere (4): pick at most one per site (rule 3ai).
- **Transparent video subject** (18): green screen, key out, WebM VP9 with alpha, PNG or GIF fallback; sits in front of the headline. **NEW** (0 hits for green screen, alpha, VP9). Heavy and fragile across browsers; for a business site a transparent PNG layer (15) is simpler.
- **Reversed reveal as a test** (22): build the opposite scroll direction on a branch and keep the better one; do not play the video backwards, swap the start and end frames instead. **NEW.**
- **Dark to lit video start** (24, 21, 5): silhouettes with backlight, then the product fills with light. **KNOWN** (light sweep, 3ah) and repeated by three videos.
- **Ask the model to explain, ask it to question you, ask for pixel distances** (19, 22, 23): three habits that cut back-and-forth. **NEW** as prompting habits (0 hits). Cheap to add to our build checklist.
- **State alignment up front** (20, 27, 19): the model cannot see which things line up; write "heading aligned with the top of the image, text left margin equal to the image's right margin". **NEW.**
- **Style prompt pasted at the END of every image prompt** (21, 22, 26): a partial prompt for light and mood from a library. **NEW as a named tool** (0 hits); our rule of one image system (D) is the same idea. Also: one edit per generation, because every AI edit re-renders the whole image and quality drops (21).
- **Real shop needs a real back end** (17): a vibecoded shop lacks login, product management, reviews, payments and shipping; his answer is a builder that writes Liquid into Shopify and links every product. **Not for us to copy** (we do not build on Shopify) but it confirms why we never fake shop content or checkout.
- **Finishing list at the end** (26): a custom cursor, a semi-transparent blurred nav, image corner radius, clunky scroll, spelling, and "a final check that everything is clean". **Known** in part (check scripts); the custom cursor is **NEW** and should stay optional.
- **What not to take:** Claude Design for a ready concept (22, he gave up), the 90-minute and 30-minute build claims (his own), model and credit comparisons (one clip each, check our API), the Instant AI, Lovart and Higgsfield funnels.

## Counts at a glance (of the 27 watched; the first 16 in brackets)
Figma or wireframe reference beside the prompt: 19 (9). Same prompt layout, goal then reference then layout then tokens then animations: about 19 (about 10). Loading or intro animation: 16 (7). Start plus end frame: 13 (8). Wipe or clip-path or block reveal: 8 (5). Scroll scrub or scroll-jacking: 7 (4). One image system, style prompt or reference photoshoot: 13 (6). Frosted glass or blurred card, nav or menu: 6 (4). Locked-camera phrase: 4 (3). Logo or wordmark behind or inside the subject: 5 (3). Voice dictation of prompts: 5 (3). Inertia or drag: 3 (2). Mobile-specific rethink (fewer images, burger, stacked halves, parallax off): 9 (7). Build section by section instead of one shot: about 14 (about 8). Sequenced one-after-the-other transitions stated in the prompt: 8. Alignment named as a weak spot of the model: 2 (20, 27).

## Trust notes
Every video is sponsored by Higgsfield, Lovart or (video 17) an app he is paid by, or at least ends with a free prompt download, the funnel. Credit costs are his words, not API prices. "Best model" verdicts rest on one sample each. No video shows a real business site with real content, forms, accessibility or load-speed tests; all examples are portfolios or fictional brands, so mobile and performance claims are asserted, not measured.

The 11 videos in sections 17 to 27 add the same trust gaps: no real business content, no accessibility, speed or mobile tests, and every demo is a portfolio or a made-up brand. Frame-verified: video 20 split scroll, 22 loader and reversed reveal, 21 light-up, 27 panel wipe, 24 light rising. Narration only: 19 flip intro and click, 23 drag and click, 18 slide-in, 26 parallax speeds, 24 handoff and scroll.
