# Notes: six "AI cinematic scroll website" videos (watched 1 Nov 2026)
Method: full transcript read + 8-9 frames per video (contact sheets, a few zoomed frames). Transcripts carry no timestamps; frame times were estimated from text position, so some frames missed their moment. FRAME = seen on screen; NARR = narration only. Comments NOT read (skipped, optional).

## 1. mFgRGSOGNPM  Komputer Mechanic (22 min): watch / car "exploded view" on scroll, Claude Code + Higgsfield MCP
Idea: two stages. (1) Build the whole STATIC site from one generated reference image (single source of truth) with a capped review loop; (2) only then add the scroll animation, with the hero HTML hidden so the video's first frame IS the static hero.
Mechanics:
- Reference image: Seedream 5.0 Pro or Nano Banana Pro on Higgsfield, 6 inspiration screenshots (Pinterest, Dribbble, Awwwards, Collect UI, Mobbin) as references, 16:9, batch 1 (NARR; result FRAME).
- Prompt pack: briefing prompt (backup before any change, credit check before each generation, one step at a time) -> MCP smoke test (cheapest image) -> "study reference.png like a forensic guy" -> `/goal` prompt: plain HTML+CSS only (no npm/python), Claude picks its own helper agents, a reviewer sub-agent compares headless-browser screenshots to the reference; stop at first "pass" OR 5 review rounds (without the cap a reviewer never stops). Animation explicitly excluded from this stage to save tokens.
- Animation prompt: hide all hero HTML = start frame; image-to-video with Seedance ("2.5" spoken; the FRAME shows a Higgsfield job and price table); product "slowly disassembles into an exploded view, every component drifting apart; scrolling back reverses".
- COST TRICK (FRAME 17:30): iterate at 480p draft = 31 credits; final 1080p = 123 credits (draft ~25% of final). Re-render at 1080p only after motion is approved.
- Direction fix: parts first scattered/tumbled; he asked "same axis" (wrong), then corrected to "each part moves along its OWN mounting axis: crystal lifts straight off the dial normal, nothing tumbles, no part touches frame edge, one unbroken take, locked exposure, no on-screen text, 480p draft" (FRAME 19:00 prompt text). Lesson: spell out the physics per part.
- Prompt polishing: write the raw complaint with two screenshots (reference vs built), have Claude rewrite it as a precise agent brief; restrict to 2 changes at a time.
- `/goal clear` after Stop, or the goal restarts.
- Page after the hero (FRAME 20:30 + NARR): hero explodes -> "Signature" section with the watch on a planet-arc horizon -> 360 rotation with three variants -> inspection close-up -> CTA -> footer. Car site: bonnet opens, engine out, tyres pop out (NARR only).
- Loading: put a ~3 s loading animation so frames are loaded before scrolling (NARR). Mobile: "shrink the animation" (NARR, never shown).
Verified by frame: static hero quality (dark/amber, giant ghost word behind product), draft price table, prompt text, signature section. NARR only: loader, mobile, 360 section, car site.
Discount: sponsor video for Higgsfield, "$10,000" title, model-name branding (mangled), prompt-pack funnel. Mobile/performance is a one-line afterthought.

## 2. ZfYvv-0l9NA  Nick Saraev (14 min): Claude Code + taste-skill + Kling 3.0 -> frame-sequence scroll
Idea: hero loop video + a second "exploding view" clip converted to JPEG frames scrubbed by scroll; then fix lag by asking Claude to optimise, 3-4 rounds until visual quality starts to drop.
Mechanics:
- Skill: github Leonxlnx/taste-skill (spacing, high-end luxury rules) for a one-shot layout.
- Kling 3.0 via Higgsfield, 5 s, 16:9, 1080p = 7.5 credits (~$0.36 on the $29/600-credit plan; FRAME 7:20 settings). Generate 2-3 variants at once, keep the best. Hero prompt: "high-quality 3D render style video panning through a 3D interior design scene, white background, super high-quality, like something on a landing page". Exploder prompt: "high-quality exploding view animation of a home... No text, white background. Explode in all directions including vertically and horizontally; none of it should go outside the bounds of the video". Globe loop: start image from Nano Banana, "rotating in exactly the same place, centre of mass should not move, rotating perfectly on its axis".
- Hero: clip as background with an "inward masking gradient" (radial vignette) so it fades into the page colour; Claude also tied it to mouse position (parallax). Hero compressed 5.3 MB -> 252 KB by asking "make the hero faster" (NARR + on-screen speech).
- Scroll: first version video.currentTime scrub = choppy/laggy. Fix = extract frames as optimised JPEGs, bind frame index to scroll position, preload. FRAME 11:40: 121 frames re-extracted at 960 px wide, 2.3 MB total (was 4 MB). FRAME 9:30: 400vh-tall scroll section (about 3 full viewport heights of scroll), sticky pinned video, 3 text panels fading in/out at thresholds, radial vignette, text-shadow. Then text put on a frosted card (cream/75 bg, backdrop-blur 24px, rounded 2rem, ring-1) because text "fights the animation".
- Hosting: Netlify free, one click. Mobile NOT done ("say mobile-optimise 3-4 times").
Verified: sticky/400vh/121 frames/960 px/2.3 MB/frosted card, credits 7.5. NARR: 252 KB figure, Netlify.
Discount: "$5-10k a pop", "<10 min / $2-3" claims; he admits residual lag, two videos on one page, background colour mismatch left, no mobile pass.

## 3. 3qboPqfaDgo  Code And Create (10 min): headphones, ONE fixed full-screen scrubbed video behind the whole page, GSAP + Lenis
Idea: a single fixed full-screen clip scrubbed by total page scroll progress; sections scroll over it on glass panels with dark overlays/gradients for legibility. Plan assets first (brand kit file, 3 reference stills), then generate one clip from them.
Mechanics (FRAME unless noted):
- Order: folder skeleton (assets/images, videos, references, copy, website) -> brand-kit.md (name, slogan, palette, type, 12-section structure, video brief) -> 3 reference stills via GPT Image 2 (hero with dark negative space for text; material macro; workspace) -> video from those refs -> project-level Claude skill (SKILL.md) holding brand tokens, GSAP ScrollTrigger + Lenis setup, glass UI, video-scrub logic, "all-keyframe H.264 encoding" rule, section recipes (pinned reveals, glass cards, footer dissolve-to-black, video freeze-during-pin) -> build.
- Video as delivered (FRAME 5:40): Seedance 2.0 reference-driven, 1920x1080, ~15.07 s, 24 fps, 361 frames, 13.7 MB. Single take, three phases: (1) wide hero composition with right side kept darker/emptier for headline + CTA; (2) slow push toward earcup/headband, shallow DoF, subtle orbital drift; (3) slow pull-back/orbit to workspace mood. Prompt rules: no people, logos, text, fast cuts, shake. Audio is generated by default; strip it.
- It took 3 attempts: first two renders were false-flagged as NSFW (filter misreads warm soft curved macro leather as skin); the third pulled phase 2 back and dropped the tightest leather macro. Advice from the output: do the extreme macro as a separate short clip.
- Stack: Vite + vanilla JS, GSAP ScrollTrigger, Lenis smooth scroll; video.currentTime mapped to progress.
- Result (FRAME 9:00): "Silence, engineered." hero, dark, amber accent used sparingly.
Verified: spec table, skill header, folder structure, hero look. NARR only: smoothness of the scrub (never shown scrolling), mobile (not discussed at all).
Discount: Higgsfield MCP advert; currentTime scrubbing on a 13.7 MB 24 fps MP4 is exactly what video 2 found choppy and nobody tested here. No performance or phone discussion.

## 4. GJxchJkk4Lk  Jason Lee (19 min): cabin booking site, drone fly-through scrolled; Claude Design then Claude Code + "scroll-world" skill
Idea: ask the agent for a PLAN (shot list / camera path) and approve it before any generation; check the stills it generated before they become a video.
Mechanics:
- Claude Design (claude.ai/design) for the static site first: "it already has taste", fewer wasted regenerations than Code. Always give a REFERENCE (Pinterest/Dribbble screenshot -> colours, fonts, button style); "without it it's like telling a builder build me a nice house". Prompt includes business, palette, room list, hero, sections; Claude wrote the room descriptions, he chose. Higgsfield MCP makes all images (Claude cannot).
- Export zip -> Claude Code; install github oso95/scroll-world skill (FRAME 9:40: 4.7k stars, v0.4.0; README lines: "mobile is a native 9:16 portrait chain"; FRAME 10:00: ships a Python background-removal script, a JS playback engine, batch generation scripts; needs ffmpeg, Pillow, Higgsfield CLI). Invoke `/scroll-world`, "tell me your plan of what the shot will look like before building anything".
- FRAME 11:00: plan = 7-leg camera path table: 1 Arrival (low over water at dusk, mist), 2 Deck & fire, 3 Great room (orbit round stove), 4 Kitchen, 5 Nook, 6 Bedroom, 7 Bath, then out; "each leg ends settling into a slow forward drift and the next begins on it, that's the motion-handoff". Hero HTML stays; the fly-through replaces the hero scroll only; rest of site stays static.
- Problems he admits: inconsistent generated stills (an unrequested outdoor sauna came from one reference still; no floor plan so rooms in random order). Fix: approve the stills in Higgsfield first, give a floor plan, dictate the flight path.
- Static page pattern (FRAME 0:01-0:09): numbered "02 / 07" counter, room name as big heading, one short line, two pill tags, large image cards, sticky nav with a pill CTA, a thin progress line along the top.
- Hosting via Hostinger MCP (sponsor). Inspiration lists: Awwwards, LottieFiles, 21st.dev.
Verified: Claude Design UI, hero + room sections, scroll-world GitHub page, camera table. NOT shown: the finished scroll behaviour of the fly-through, the video fps/length/encoding.
Discount: Hostinger sponsorship + coupon, "$10,000", cost talk about model names.

## 5. VBvxHIkvjeo  CreatorKore (16 min): matcha cup splash, free tools, start/end-frame video -> JPEG sequence
Idea: START frame + END frame of the effect as two images -> "frames to video" -> convert to JPEG frames.
Mechanics (FRAME unless NARR):
- Start image: Gemini, "iced matcha cup, take-away, no lid and straw", centred on BLACK background, vertical. End image: Google Whisk with the first image as subject plus an "end frame" prompt from his paid community, adapted by Gemini to this product. Whisk first ripped the cup apart; fix = "keep the cup the same, add flying ice cubes and liquid shots in the air", then "liquid flying into the drink and splashing".
- Video: Google Flow, mode "Frames to video" (not text-to-video), Veo 3.1 QUALITY model (not Fast), download upscaled 1080p (FRAME 8:40 menu: GIF 270p, 720p, upscaled 1080p, 4K). The prompt module text on screen (FRAME 7:30): fluids "arrested in mid-air, fragmented into globules, aerosols"; "razor-sharp definition, zero motion blur".
- Frames: ezgif.com video-to-JPG, start 2 s, end 8 s, 29 fps (FRAME 10:00 settings) -> 168 JPGs (count NARR). Zip into Antigravity (Gemini 3 Pro, "planning" mode) with a web-gen prompt adapted to the product; static export deployed by Netlify drop.
- Result (FRAME 13:40-15:00): splash behind big product names; headline text sits directly on the splash ("THE DIRTY POUR" on the cup), legibility poor; he concedes "visuals not super crisp, more frames would help".
Verified: tool menus, settings, resulting page. Weakest end result of the six.
Discount: free-community upsell, "sell for a ton of money", no mobile or performance, low-res frames. Useful only as the cheap start/end-frame recipe.

## 6. 4doKHpXFcqs  Profit Studio (28 min): perfume "petals to product", Claude Code + Higgsfield, priced plan with approval gates
Idea: the brief makes Claude PLAN, PRICE and ask approval before each paid generation; anchor image -> opening frame -> film, each checked against the brief; then the clip's real numbers drive the scroll design.
Mechanics (FRAME):
- His guide page (funnel) converts choices (product, signature moment, look, goal, production level Essential/Balanced/Showcase) into prompts; keep only the sequence.
- Plan (FRAME 13:20): anchor image 15 credits, opening frame 15, film 48, total 78. Cheaper path offered: film at 1080p = 12 credits and images "high" at 4.25 each = 20.5 total, "looks nearly as good on most screens". Extras (a ritual scene etc.) only if named. Actual spend 80-82 after one failed 2-credit "widening" attempt that Claude itself advised dropping.
- Assets (FRAME 16:40): anchor 3840x2160 (the film's FINAL frame, closing image); opening frame 3840x2160 (the film's FIRST frame, shown while the film loads); film 4K, 24 fps, 8.04 s, 193 frames, no audio, plays forward, movement ends ~6.5 s.
- Claude's own site fixes from those facts (FRAME z1000): nearly-still first ~2.3 s gets very little scroll distance; end playback at ~7.3 s so the final hold is under a second; add a subtle zoom-in because the clip's camera does not move; PHONES: smaller frames cut from the CENTRE of the same film, the bottle fits inside that crop, no separate phone visuals.
- Claude launched a local preview, scrolled it, checked sizes and mobile, fixed (NARR + FRAME of its screenshot); then a refine prompt (more premium type/spacing, keep bottle + main animation).
- Look (FRAME 0:12): serif "Made for the hours after dark." left, bottle centre, dark amber, tiny uppercase spaced nav. Mid-scroll FRAME 19:40: near-black screen with two small text blocks and big dead areas.
Verified: cost table, clip facts, plan text, hero. NARR only: mobile working, scrub smoothness, quality after refinement.
Discount: Hostinger coupon and guide funnel (about half the runtime), hype, "works great on mobile" asserted not shown.

---
# Across videos

## Technique ranking (independent videos showing it)
1. Scroll position drives a pre-rendered AI clip: currentTime or JPEG frames (all 6; frames explicit in v2, v5; currentTime in v2 first try, v3).
2. Plan/approve/price before paid generation; one anchor or reference first (v1, v3, v4, v6).
3. Per-part physics / explicit shot path in the prompt (v1 own-axis rule, v4 7-leg path, v3 3 phases, v2 "nothing outside bounds").
4. Static site first, from a reference image/design; animation second (v1, v4, v6; v2/v3 hero first).
5. Stills as the clip's start/end so page and film join (v1 hero HTML hidden = frame 0; v5 start+end frame; v6 anchor = last frame, opening frame = first and loading poster).
6. Inspiration screenshots before design (v1, v4; v2 via taste-skill).
7. Legibility treatment over moving media: dark overlay/vignette/gradient, text-shadow, frosted card (v2, v3; v5 fails to do it).
8. Draft cheap, finalise expensive (v1 480p/1080p; v6 cheaper path; v2 variants).
9. Agent verifies in a local/headless browser (v1, v6, lightly v4).
10. Ask the agent to "make it faster" in rounds, compress hero (v2; v6 phone crop; v1 loader).

## Lessons for our pages (video in brackets)
Opening film planning
- Get the shot plan (legs, ends, holds) approved BEFORE generating; inspect generated stills for stray objects, because one still contaminated the film (v4's sauna) [v4, v6].
- Generate anchor (end) and opening (start) stills first; use the opening still as the poster while the film loads and as film frame 0; film's last frame = the page's next section visual, so no jump [v1, v5, v6].
- Hide the HTML hero so the film's first frame carries it, then fade the HTML in over it [v1].
- Read the clip's real facts (fps, length, when motion stops) and set scroll pacing from them: a near-still first ~2 s gets little scroll distance, stop ~0.7 s before the end so the final hold is short, add a slow zoom if the camera is static [v6].
- One physics sentence per moving part; no tumbling; nothing leaves the frame; locked exposure; no text; one unbroken take [v1, v2, v3].
- Leave one side dark/empty for headline and CTA in the hero composition [v3, v6].
- Extreme macro of soft warm textures (leather; likely food) can trip the content filter; separate short clip, retry [v3].
- Draft at low resolution (480p ~ quarter of final cost); final render only after motion is accepted [v1, v6]. Generate 2-3 variants at once [v2].
Encoding / scrubbing / performance
- currentTime scrubbing of a normal MP4 stuttered in the only video that tried and measured by eye (v2); fixed by JPEG frames bound to scroll with preload. v3 relies on all-keyframe H.264 + currentTime but never shows it smooth.
- Numbers seen: 121 frames at 960 px = 2.3 MB total (v2); 168 frames from 6 s at 29 fps (v5, soft); 361 frames/13.7 MB 15 s 1080p MP4 (v3); 4K 8 s 193 frames source (v6). Scroll section 400vh, about 3 extra viewport heights (v2).
- Hero loop compression 5.3 MB -> 252 KB (v2). Don't run a hero video and a frame sequence at once on weak phones (v2 admits it).
- Loading screen ~3 s so frames are cached before scrolling (v1, NARR).
Layout / typography
- Big serif headline, tiny spaced uppercase nav, few words per screen, amber on near-black (v1, v3, v6); numbered counter "02 / 07", big room/section heading, one line, two pill tags, image cards (v4).
- Frosted card behind text over moving media: ~75% fill, blur 24 px, 2 rem radius, hairline ring [v2]. Never raw text on a busy splash [v5].
- Avoid long near-black stretches with tiny text (v6 19:40).
Phones
- Only v6 gives a method: smaller frames cut from the centre of the same film, check the subject still fits the crop; v4's skill README mentions a native 9:16 portrait chain. None shown on a real phone; all other mobile claims are asserted. Our own phone rules stay stricter than anything here.
Process
- Reference image = single source of truth, reviewer pass with a cap (first pass or 5 rounds) [v1]. Rewrite a complaint through an AI as a precise brief with both screenshots; max 2 changes per round [v1].
- Brand-kit file first, then a project skill fixing stack and rules [v3]. Backup before each change; credit check before each generation [v1, v6].
- Free hosting: Netlify (v2, v5); Hostinger MCP is sponsor-driven (v4, v6).

## What not to trust
All "$5-10k" claims, all Hostinger/Higgsfield funnels, mobile claims, smoothness claims (nobody measures fps or shows a phone scrolling). Weakest results: v5 (text on splash, soft frames) and v6's mid-scroll dark stretches. Best-looking: v1 watch, v3/v4 stills.
Not done: comments (not read); frame times were guessed so exact scroll-behaviour moments for v3/v4/v6 finished sites were not captured.
