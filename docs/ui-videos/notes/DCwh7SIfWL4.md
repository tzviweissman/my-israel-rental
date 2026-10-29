# DCwh7SIfWL4 - "Claude Websites Just got a HUGE Upgrade ($20,000 sites)"

Channel: Jack Roberts. Length 10:15. Watched 2026-10-29.
Method: subtitles (youtube_transcript_api; yt-dlp subs hit HTTP 429) + 290 scene-change frames + 308 frames at 1 per 2 s (720p, scaled to 1280), contact sheets to find moments, 20 key frames read at full size. No strips at 6-10 fps: the only moving pieces (Glaido scroll film, Nexbot robot) are recorded by the presenter in a small window and are shown mostly as the narration, so motion was judged from successive 2 s frames only.

## The one transferable idea
Two cheap proofs that make a scroll-film site feel finished: (1) the film is planned as a 4-frame storyboard (rough line-art sketches first, then the approved real stills with captions) before any clip is made; (2) the site ships with a three-way switch "Motion: Off / On / X-ray" so the viewer, or the owner, can see the page without motion and see which parts are code and which are generated. Everything else is Spline 3D plus promotion.

## Table
| Time | Before | After / technique | Exact detail (words, prompts, settings, sizes, colours) | Verified |
|---|---|---|---|---|
| 0:00-2:50 | Claude can build 3D, but cannot be edited by hand | Spline MCP connector: Claude drives a real 3D editor, you adjust objects, lights, materials, physics, camera yourself; each prompt saves a version | "Claude is basically like the driver, the 3D world engineer"; sample scene shown: cube, pink sphere, teal torus, yellow cone on dark | narration + frame (e0089 etc.) |
| 3:00-3:45 | No reference | Pick TWO references: one for the website look, one for the 3D hero ("there can only be one hero") | Spline Community, search "robot" (picked Nexbot); referral.styles, Mobbin for the site look (Mercury liked); drop screenshots / URLs into Claude | frame e0089 "Pick 2 references: one for the website, one for the 3D hero, so Claude copies a look, not a guess" |
| 4:37-5:15 | - | Connect Spline | Settings > Connectors > Add custom connector, URL `https://mcp.spline.design/mcp`; in Claude Code `/mcp`, pick spline, authenticate (OAuth page app.spline.design/oauth/consent) | frame e0158, e0152 |
| 3 steps | - | "Connect it / Tell it what to build / Put it on your site" | Tell it: "Recreate this 3D scene in Spline..." with a screenshot attached; then "fix one thing by hand so it is exactly yours"; then Export > Web embed | frame e0158 |
| 5:25-6:35 | - | Higgsfield connector for images and video | Claude: plus > Connectors > Browse connectors > search Higgsfield > Connect; account created first; Higgsfield page offers ChatGPT / Claude / Claude Code / Telegram / CLI tabs | frames e0182, cs7 |
| ~6:50 (frames 4:15-7:00 of promo) | One sentence of brief | Storyboard in two passes: pass 1 four rough line-art sketches (typewriter, hand on wall, hand over device, key), pass 2 four photoreal stills with a green tick on each approved one | Captions on the stills: "We tapped keys." / "Now we talk." / "Glaido." Hero = painted a hand on a cave wall ("We painted."), typewriter, keyboard, voice key | frames e0209, e0210 |
| 7:00-7:20 | - | Glaido demo site: scroll film made of generated stills/clips in a framed rounded panel with a 5-dot progress indicator under it; short caption centred above the film | Caption "We painted." etc. in white, sans, ~16 px over the film; dots bottom centre of the panel | frames e0214, e0216 |
| 7:00 | Fixed headline | Rotating word in the headline, with a particle shape beside it | "Voice intelligence for [Cursor / Slack / Notion / Claude / Codex]" - the word sits in a dark pill with an app icon; a lime particle cloud forms the logo | frames cs8 row 3, cs6 row 3 (narration "beautiful particle animation") |
| 7:25-7:40 | Plain page | Switch bottom right of the page: Motion | Off | On | X-ray. X-ray draws a dashed outline around each generated or coded block with a label, and a tally bottom left | frame e0226: label "Code - Spline 3D - press and hold the key"; tally "2 Higgsfield assets - 250 credits / 5 code loops - 0 credits" |
| 7:15 | Static price | Pricing calculator: two sliders ("Words you type a day", "Your time is worth $/hour") give "You get back 20 hours a month - That is $1,210 of your time." (3,000 words, $60/hr); at 6,900 words and $200/hr it shows 46 hours, $3,059 | Footnote "Estimate: typing at 40 words a minute, talking at 150, 22 work days." Under it two plans: Free (2,000 words a week) and Pro $17/month; Pro button lime | frames e0229, e0231 (all values read off the frames) |
| 7:20 | - | Section headlines are 2 short lines | "One key. Every app." (small grey label "Dictation" above); "Hold. Talk. Let go."; "Start free. Upgrade to fly." | frames e0221, e0229 |
| 8:00-9:00 | - | Other generated pieces: a video that zooms in; three images that appear; LED eyes that follow the cursor (Spline) | narration only; sites shown: Nexbot (Spline robot following cursor), PULP juice site (generated fruit film, "Only fruit gets in."), Chrome Juice | narration + cs9/cs10 frames |
| skill page | - | "Living Site: the 3D website skill" (Notion, download living-site-skill.zip, 168 KB) | Levels: 1 live 3D with Spline ("One showpiece the visitor can play with"); 2 film and images with Higgsfield ("One continuous scroll film, no cuts"); 3 living motion graphics Claude draws in code ("They explain your product"); "A great start. Claude copies a real site you love, then adds the three levels."; "A final check, so nothing ships with a stuck scroll or a grey box." Set up: 10 minutes | frame e0121 |
| 9:21-10:10 | - | Caveats the presenter states | Spline free tier has a daily cap; unlimited needs a paid plan | narration only |

## Discount
- "$20,000 sites" in the title: no price, no client, no proof shown; the demo sites (Glaido, Nexbot, PULP) are the presenter's own promo pieces; Glaido is his sponsor product.
- Spline 3D is the main subject; we have one scroll effect per page, so a second 3D "showpiece" is out.
- Funnels: Skool community, "Agentic OS" masterclass, Glaido free month, bit.ly links, Higgsfield referral link ("link down below").
- Skipped entirely: mobile, load weight, cost per page (the X-ray tally 250 credits is the only cost number), accessibility, Hebrew/RTL, and how the order flow works. Spline embed weight on a phone is never discussed.
- Spline MCP URL, versions and "Opus 5.5" are read off a screen, not tested by us.

## Comments (9 returned, 40 requested)
- "This is a Spline product demo" and "these are just free stuff from Spline": reply from the author that Spline is not a sponsor. Presenter says himself it is not sponsored.
- Two viewers say the video is hard to follow; author asked where they get lost.
- "I need to pay for 3-4 different AIs": a cost objection, matches our own note (Claude + Higgsfield + Spline + Glaido).
- Question on installing into WordPress with SEO: answered with an Elementor reply, off topic for us.
- One joke comment (7:05) about a reverse-engineered "Easy Button". No factual corrections found.

## Ours?  (rows we do NOT already do)
Already ours: stills approved before clips (rules 3h.17 / section 8 item 6), chapter lines of 2-6 words over the film (3h.5), reduced motion shows a still (section 9), one hero reference (3h concepts), final check for stuck scroll / blank box (3a, 3s glitches).
1. **Rough line-art storyboard before the stills**: 4 frames, 1 sentence caption each (e.g. "We tapped keys."), shown before any still is generated. Extends 3h (the "Three concepts as stills first" item, 3h.6) and 8 item 6.
2. **A Motion Off / On switch on the page**, bottom right, so the owner can see the page without motion. Extends 3s (checked for glitches; "words left hidden with motion off") and 3f; would also help the owner review. Needs Tzvi's call on whether visitors see it.
3. **X-ray overlay** that labels each generated or coded block and totals the credits ("2 assets - 250 credits"). Extends 3q (concept sheet) / 3r (review) as an owner-facing proof of what was generated; internal only, not for the public site.
4. **Two references, one per job** (site look vs. hero look) named separately in the brief. Extends 3p / 3b.
5. **A savings calculator with two sliders** ("words a day", "time worth") and a footnote stating the assumptions (40 vs 150 words a minute, 22 work days). Extends 3j (show the deal in money: real, like for like); only for businesses where a saving can be computed honestly.
6. **Rotating word in the headline** ("for Cursor / Slack / Notion") with a pill behind the word. Extends 3g / 3i devices; but it is a second moving piece, so by our one-effect rule it is probably out. Flag only.
7. **Particle-cloud logo formation** beside the headline: same one-effect conflict as row 6; not recommended.
