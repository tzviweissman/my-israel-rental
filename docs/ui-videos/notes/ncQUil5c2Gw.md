# ncQUil5c2Gw: "Claude Opus 5.5 is INSANE for Mobile App Animations (Apple's Dynamic Island)"
Jason Lee, 25:44, watched 29 Oct 2026.

Method: subtitles (youtube_transcript_api; the yt-dlp subtitle download hit HTTP 429) + 772 frames at 1 per 2 s + 279 scene-change frames + full-size frames read at 4:30 (prompt), 5:45, 6:12, 8:15, 19:20 (hero), 20:50 (GitHub), 22:25 (FAQ) + strips at 6 fps (6:12) and 5 fps (19:08). The phone part (Expo, real device, 15:00-18:15) was not read at full size, so it is narration only. The water-rising animation itself was not caught in the strip (the crop showed only counter and dot changes).

## The one transferable idea
Build any moving UI in the browser first as a small prototype WITH test buttons ("+ Drink", "Reset") that fire each state change, so the owner can judge the animation before the real build. Ask for 3 variants of each (A/B/C), pick one, then derive the next pieces from the picked one. Feedback on motion is given as a screen recording with voice, not screenshots and arrows.

## Table
| Time | Before | After / technique | Exact detail | Frame-verified or narration only |
|---|---|---|---|---|
| 3:06 | No design direction | One Pinterest screenshot ("iPhone dynamic island animations") given to the model as reference | Whole image given, not one cropped item | narration + frame (prompt thumbnail grid) |
| 3:32-4:30 | Model guesses platform limits | Tell it to follow the official guidelines; no URL given, it finds 4 sources itself | Prompt text: "Study and follow apple's guidelines/docs on creating these." Says it takes font sizes and animation length from them | frame (prompt) + narration |
| 4:16-4:50 | One design | Ask for 3 variations incl. minimal, compact, expanded | Prompt: "give me 3 different variations (including the minimal, compact and expanded versions)... Show the designs on a real iphone 18 mockup. Build in localhost, show controls to preview animation when drink is added and reset." Effort High (says Medium often enough); "/design" skill invoked | frame |
| 5:16-6:30 | Static mockups | Browser prototype, three phones side by side (A Ring, B Cells, C Glass) with "+ Drink" (teal pill) and "Reset" (dark pill) under them; clicking adds a drink, water rises in the glass, counter 1.3 to 1.5 of 2 L, countdown 41:30 to 45:00 | Teal taken from the app's own colour; weekly row of drops M T W T F S S, filled = goal met | frame (5:45, 6:12, strip); the rise motion is narration only |
| 6:32 | Judge by imagining | "A really easy way to test out your animations before we deploy to the actual phone" | Test controls are asked for, not default | narration |
| 7:16-8:30 | Pick one design | Pick C, ask for lock-screen versions and a square widget "based on the above design"; 3 lock variants (1 Frosted, 2 Light, ...) and widgets shown beside them; picks frosted + the one with a water wave | Frosted = glass look tinted by the wallpaper | frame (8:15) |
| 8:37-8:52 | Screenshots with arrows for changes | Screen recording with voice, saved as video, dropped into the model | "quicker than taking a screenshot, doing markups, arrows and lines" | narration |
| 9:07-9:39 | Context fills silently | Desktop "session rails" shows context breakdown; compacts at about 300-400k tokens; Compact button | Tool-specific | narration |
| 11:53-12:22 | Browser prototype only | Rebuild in React Native via Expo + EAS dev build; add a Settings switch to turn the feature on/off | Needs paid Apple developer account (about $99/year); Expo Go cannot test widgets | narration |
| 15:20-18:13 | n/a | On the real phone: tap + Drink logs a glass; countdown starts; leave the app and the island keeps showing; long press expands; widget button logs a drink without opening the app; matches the prototype "pretty much exactly" | iOS only | narration; phone frames not read |
| 18:43-18:58 | n/a | Landing page prompt, short: "Build a landing page based on the app that we just created. Make sure the website is full of beautiful animations that are taken from the app designs. Also, showcase the animations of the dynamic island, lock screen, and the ability to track the water intake." Built last "so Claude has the most amount of context" | Folder of earlier files gives context | narration |
| 19:08-19:20 | Flat hero | Hero: water-ripple tile background, mascot on a float that "moves around as I move my cursor", big faint wordmark behind, wavy cream edge at the bottom; headline "Drink more water with Brownie"; black App Store button + ghost "See it live" button; black "Get Brownie" nav pill | Pointer movement is narrated; the 5 fps strip shows only a small drift of the character | frame + narration |
| 19:29-20:01 | n/a | Feature cards "all clickable", floating items, a gallery of app screens (he rejects it), drink-type scroller, swimming mascot reused from an app screen | Assets reused from the app's own screens | narration + frame (strip end) |
| 20:01-21:33 | Copy lists features ("AI slop") | Give the model a copywriting skill repo (Corey Haines marketingskills, 56.8k stars on screen), ask it to SUGGEST changes first, then apply them "shorter"; add reviews and FAQ | Result: "less wordy and more punchy", "written for the user in mind" | frame (GitHub) + narration |
| 22:16-22:25 | n/a | FAQ as white rounded cards; small teal circle "+" turns into "x" when open; answer shown inside the same card; several open at once | Heading "Good questions"; sample: "Will it nag me all day?" "No. Brownie only nudges you after 45 minutes without a drink. Change the gap or turn reminders off in Settings." | frame (22:25); the opening motion is narration only ("I love how these cards open") |
| 22:32 | n/a | "Takes you 90% of the way... never take this as it is" | | narration |
| 22:47-25:18 | n/a | Hostinger connector uploads the site | Sponsored segment | narration |

## Discount
- Dynamic Island, Live Activities, Expo, Apple developer account, React Native: iOS apps, nothing carries to a website.
- 22:47 onward is an ad (Hostinger, code); price claims unchecked.
- The 100k per month figure for the inspiration app is his claim, not shown.
- Pointer-follow mascot and ripple background are decoration; our rule in section 8a (line 2150: no cursor trails or parallax for decoration) bans them.
- The video has no mobile-web micro-animation detail (no easing values, no durations); the only numbers are in the app UI.

## Comments (14 returned)
No corrections. Questions only (which tool shows the mockups side by side, whether the animations are Lottie, both unanswered in the pull); one comment claims Apple flags AI-pattern code (opinion, unverified).

## Ours?
Rows we do NOT already do per the rules:
1. Throwaway browser prototype with test buttons that fire each state (add to basket, reset) before a moving piece goes into a page. Extends 3f (effects are seen whole) and 0b (build order). We have scripts that watch effects, but no step that asks for demo controls.
2. Three variants A/B/C of one component side by side, owner picks, later pieces derive from the pick. Extends 3q (concept sheet) / 3p. Done at page level (section 7, three options), not at component level.
3. Screen recording with voice as the change request. Extends 3r (checked before shown); a working habit for Tzvi's own feedback, not a site rule.
4. Copy pass run as "suggest first, then apply shorter" with a review step. Extends section 5 (how to write). Voice rules exist; the suggest-before-apply order is new.
5. FAQ card as a rounded white card with a "+" that turns into "x", answer opening inside the same card. Extends the FAQ item in 3 (cont.), line 147; the open motion is not specified there.
6. Check the real phone against the prototype side by side ("pretty much exactly the same"). Extends 3a / 3s phone verification.
7. Ask the model to follow the platform's official docs and let it find the sources. Weak fit; only useful when building against an outside spec (WhatsApp links, payment pages).
