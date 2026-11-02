# 5QM78yqpONI: "How to Build Your First Website with Claude Code + Seedance 2.5"

Channel: Mikey Website. Length 25:56. Watched 29 Oct 2026.
Method: subtitles (English auto, 642 lines) + 778 frames (one every 2 s, 1280 px) + 498 scene-change frames (gt 0.06) generated; about 20 frames read at full size around every on-screen prompt, setting and finished page. No 6-10 fps strips: the video has no scroll effect or transition worth stripping (the finished site is only shown as a hero loop and a still scroll). Frames of the mobile devtools check (narrated at 23:28-23:49) were NOT found among the frames read; that step is narration only. The sheet-of-contact step failed (ffmpeg tile error), so frames were picked by transcript time instead.

## The one transferable idea
Order of work: generate the mood clip first (30 s, 16:9, 1080p, slow, calm, "space for text"), then build a working static site with a placeholder hero and check it, then swap the clip in as a full-bleed muted looping hero behind a flat dark overlay. We already do the first half (film first); the new bit is "check the whole static structure BEFORE the video goes in, so only one layer changes at a time".

## Table

| Time | Before | After / technique | Exact detail | Verified |
|---|---|---|---|---|
| 0:16-0:49 | One AI tool does everything | Split: video model sets atmosphere, Claude Code builds site | "visual direction influences the site from the very beginning" | narration |
| 4:19-5:30 | n/a | Hero clip wanted calm: slow movement, controlled light, "enough visual space for the website content" | "the goal is not constant action" | narration |
| 5:54-6:40 | Defaults | Dreamina (dreamina.capcut.com) settings: model Dreamina Seedance 2.5, mode "AI Video / Omni reference", aspect 16:9, 720P to 1080P, duration 4s to 30s | Needs paid plan for HD and long clips (narrated). Aspect menu offers 21:9, 16:9, 4:3, 1:1, 3:4, 9:16; resolution 480P/720P/1080P | frame-verified (t0191, t0207) |
| 6:51-7:20 | n/a | Video prompt: mood, light, camera, environment, not an object list | Typed: "Cinematic slow panning shot through a modern luxury architectural interior, open concept living space, warm ambient sunlight streaming through floor-to-ceiling glass windows, minimalist Italian furniture, polished dark concrete floors, subtle dust motes floating in light rays, natural oak wood panelling, elegant indoor foliage, smooth stabilized tracking shot, high-end architectural magazine aesthetic, perfectly fluid continuous motion." | frame-verified (t0216) |
| 7:28-7:56 | n/a | Review the clip before keeping: smooth camera, natural shadows and sunlight, no warping furniture or walls, fits brand calm | checklist spoken | narration |
| 8:00-8:11 | Watermarked | Download with "Remove watermarks" on, "Save preference". Dialog says enabling it makes you responsible for disclosing AI-generated content | | frame-verified (t0243) |
| 9:15-10:05 | n/a | One new folder per project ("luxury studio build"), set as the Claude Code working directory so files are written straight in | | narration |
| 10:20-12:30 | n/a | First prompt builds three files (index.html, styles.css, app.js) in ONE pass with full spec, real sections (no empty placeholders), static dark placeholder hero | Colours on screen: background #121212 ("deep charcoal slate"), text #F5F4F0 ("warm alabaster"), gold accent #C5A059. Fixed semi-transparent header; links Services, Portfolio, Studio, Contact plus "Book Consultation" button. Hero heading "Architectural Sanctuaries Crafted for Modern Living", buttons "Explore Portfolio" / "Inquire Today". Sections: Core Services (Architectural Planning, Bespoke Interiors, Spatial Styling, 3-column grid), Portfolio cards with hover, About the studio with stats, inquiry form. "clean semantic HTML, modular CSS using global variables, JavaScript for smooth scrolling and header interactions". Claude Code shown on Sonnet 5, effort High. | frame-verified (t0325, t0420, t0735); prompt text visible only to its first ~10 lines |
| 13:10-13:30 | n/a | Ask Claude to run the site on port 8080 and open localhost | | narration |
| 15:08-15:40 | n/a | STOP and scroll the whole static page before adding video: sections present, nav works, grids balanced, form aligned, spacing fine, "easier to fix now than adjust several layers later" | | narration |
| 16:44-17:15 | n/a | Put video in project: new subfolder assets, rename to hero-video.mp4 (path assets/hero-video.mp4) so Claude can reference it | | narration (folder itself not framed) |
| 17:36-19:00 | Static textured hero | Replace with HTML5 video: autoplay, muted, loop, playsinline; fills 100% hero width and height; object-fit cover; absolutely positioned behind heading and both CTAs; flat dark overlay about 40% black | Claude's reply on screen: stacking order media z-0, overlay z-1, content and scroll cue z-2; overlay `rgba(0,0,0,0.4)`; it verified `paused:false, readyState:4` in the browser | frame-verified (t0675) |
| 19:07-20:20 | n/a | Judge the clip as part of the page: loads at once, plays smoothly, no scroll jank, hero text stays centred | claims "no noticeably affecting scroll performance or frame rate"; not measured (no fps or Lighthouse shown) | narration |
| 20:44-21:10 | 40% overlay | Found a flaw: when the camera reaches sunlit areas, white serif heading loses contrast. Fix is "slightly darker" overlay, no number given | frame at t0584 shows the lighter wood panel left of the heading with body paragraph visibly low contrast | frame-verified (t0584) for the flaw; fix amount not stated |
| 22:20-23:20 | n/a | One polish prompt: darker overlay; smoother hover transitions on nav links, buttons, portfolio cards; same vertical padding on every section; multi-column grids collapse to single column; mobile nav toggles smoothly; hero video scales without overflow or performance lag | Prompt on screen begins "Execute a comprehensive design and performance polish pass across index.html, styles.css, and app.js. Slightly darken the hero video overlay opacity so white serif text remains perfectly crisp even during bright sunlight video frames. Add refined hover state transitions..." | frame-verified (t0675) |
| 23:00-23:50 | n/a | Claude's own log of the polish: adds hero-video performance handling in app.js (+31 lines), mobile nav toggle icon animation, overflow-safety rules at the mobile breakpoint; notes the headless browser shows the video "paused but not disabled" so it checks readyState | | frame-verified (t0700) |
| 23:26-23:49 | n/a | Presenter checks in Chrome F12 mobile view: video fills, type scales, grids stack | | narration only (no frame seen) |
| 24:19-24:50 | n/a | Final site: floating back-to-top button, custom dropdowns and budget select in the form | back-to-top arrow visible bottom right | frame-verified (t0735) |

## What to discount
- The video's quality claims ("looks expensive", "no warping") are the presenter's eye only; no measurement of fps, load time, file size, contrast ratio or phone behaviour.
- The 30 s clip is a plain 30-second muted loop; the seam where it restarts was never shown, and the file size (30 s of 1080p) was never mentioned. Heavy for a phone connection (a viewer comment asks exactly this, no reply).
- Seedance 2.5 / Dreamina are not our tool (we use Higgsfield). Dates and capabilities (launched 31 Jul 2026, up to 30 s) are the presenter's claims.
- Skipped entirely: accessibility (no reduced-motion handling, no poster image or fallback shown), mobile frames, cost in credits (a number 13260 sits by the send button; it looks like a balance, not a price), loading with video off, how the site is hosted, multi-page structure, ordering, SEO.
- The funnel: free $499 masterclass link at 2:40 and 25:38; the top comment is the same link.
- The flat 40% overlay is the thing we ruled out for film openings (see Ours? below); the video's own result shows it fails on bright frames.

## Comment corrections
Top 40 comments fetched: only 11 exist. Nothing corrects the video. One is the masterclass link; one asks "what about slower internet users?" (3 likes, no reply, a fair gap); one asks whether this scales to bigger multi-page sites (no reply); one is confused about the "reference control" part, which the video indeed never demonstrates (Omni reference is shown only as a mode label).

## Ours?
Rows we do NOT already do per the rules:
1. Build and check the full static page with a placeholder hero BEFORE the video goes in, so one layer changes at a time (extends 0b build order and 3a).
2. Pass/fail line for "no warping, natural shadows, no object changing shape" on the clip BEFORE it enters the page (we have 3h.18/3h.19 for possibility of the story; a plain review checklist of the finished clip is slightly different; extends 3h).
3. Disclosure note: Dreamina's watermark dialog says the user is responsible for disclosing AI-generated content. We have no rule on telling the owner their site's film is AI-generated (extends 8, photos/video and tools; applies to any generator).
4. Claude's habit of confirming `paused:false, readyState:4` and stacking order (z-0 media, z-1 overlay, z-2 content) in the browser after wiring the video: we check frames and fps, but not as a stated autoplay check (extends 3s glitch checks).
Not ours to copy: the flat 40% black overlay (rules 3h.9: "no big dark patches or scrims over the film"; use the soft edge shade of 5b.3), the unmeasured performance and mobile claims, the 30 s plain loop, the "check mobile by eye in devtools" (we measure at set sizes in 3a/3s).
