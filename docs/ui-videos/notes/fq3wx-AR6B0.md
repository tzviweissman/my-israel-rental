# Jack Roberts: "Claude Motion Design Just Destroyed Website Builders ($10,000 Websites)"
- Channel Jack Roberts, https://youtu.be/fq3wx-AR6B0, length 19:37 (1177 s). Method: frames every 5 s (15 contact sheets, all viewed; the sheets after ~15:00 are a MongoDB sponsor segment, skimmed), 0.25 s strips at 2:08 (dock to hop nav) and 12:02 (Claude Design page scroll). Transcript read (auto captions via youtube_transcript_api). The video is partly a sales pitch (his paid community, Higgsfield, MongoDB sponsor); the useful part is the demos.

## What is shown
- 0:00-0:30 Intro stills: a brush stroke of orange/lilac paint on white paper ("One stroke."), a generated video clip, with overlay text in a bold serif/italic mix.
- 0:30-2:00 "X-ray" toggle: highlights which parts of a page are generated video (Higgsfield) and which are live code. Hero = full-width generated clip (paint swirl) with code-drawn paint strokes flying across and a small mascot character that follows the scroll and reacts.
- 1:35-2:15 Code-only components on white pages with small labelled cards: morph nav menu (dark card, dropdown morphs), holographic sticker (character on dark, rainbow sheen follows the cursor), liquid dock (macOS-style icon row on a pastel gradient; icons scale on hover, the big "Claude" headline changes to "Music" as you hover another icon), hop nav (pill nav, the mascot jumps to the clicked item), bloom footer (flowers grow when you submit an email field), "A friend for your cursor" (mascot follows the pointer along a ground line).
- 2:08-2:12 strip: dock hover swaps the headline in about 0.25 s; the hovered dock icon lifts roughly 10 px and enlarges; on scroll the dock shrinks and the next section's nav pill appears with the mascot hopping onto it.
- 6:40-9:00 Gallery of one-off interactions: jelly buttons (squash on press), 404 page as a lime-green runner game with the mascot jumping over blocks, breakout-game footer on navy, command bar (Cmd-K style palette), flip-board departures banner, map footer, image-trail cursor, 3D spin gallery, day/night toggle scene (green hills, house), bento grid where one card is highlighted.
- 8:15-10:00 Glaido app onboarding built the same way: dark UI, lime-green primary button, step cards "Let's get started", "Connect to your world", "Try command mode", "You're ready to go", ending on a green particle burst "Welcome to Glaido".
- 9:20-11:30 Dark showcase page "Motion graphics on top of your footage": a framed video panel with tabs, painted-stroke clip, a purple night scene with a drawn bird and desk, and an "Every moving bit has a job" row of three cards (loop drawn in code, character that reacts, X-ray on/off).
- 12:00-13:30 "Kinetic" demo site: full-bleed red page, big glossy red 3D disc in the centre, huge sans headline bottom-left ("One app for all your motion"), floating pill nav bottom-centre, sections change background red to white to pink; the 3D object changes shape per section (disc, sphere, torus on a podium, card). Giant "Kinetic" wordmark footer, cropped by the bottom edge. The 12:02 strip shows a lime/magenta panel with a spring character animating inside a laptop frame as the page scrolls.
- 13:30-14:20 "Claude Design" page: huge condensed black caps headline on white, lime and magenta sticker-style cards, mascot walking over the page.
- 14:20-15:50 "Atelier" agency site: white hero with orange/lilac paint-smear shapes sweeping in from both edges and a rocket graphic; "Real results from real clients" stat cards (9 days, 3x, 48h, 98, 140+, 1 look) in pastel tiles; a testimonial in large serif on dark; "The 20 second film" section with a framed autoplay video and play bar; huge lowercase "atelier" wordmark footer on black.
- 15:00-19:00 Back-end talk (MongoDB), dark dashboard, kanban board; little design content.

## Candidate rules for us
1. **Put one real photo or short clip full-width in the hero and let a small amount of code motion sit over it, never replace it.** SHOWN 0:30-1:30, 9:20-10:30, 14:20-15:30 / SAID 9:00-9:50. For us: the bakery's own oven clip fills the hero; a drawn flour dust or ribbon overlay may drift over it.
2. **Every moving element must have one job (guide, confirm, or reveal).** SHOWN 10:15-10:50 ("Every moving bit has a job") / SAID 10:15-10:30. For us: test each animation against "what does this tell the visitor?" and delete decoration-only motion.
3. **Looping motion must start and end on the same frame.** SHOWN 10:30 loop card / SAID 10:20-10:40. For us: ambient loops (steam, ribbon, sparkle) are seamless, checked by playing 3 cycles with no visible jump.
4. **Give navigation one small, quick hover reaction (scale 1.1-1.3x, under 300 ms).** SHOWN 1:35-2:15, strip 2:08 (dock, hop nav) / SAID 1:35-2:00. For us: the Order / WhatsApp / Menu row lifts on hover and the active-page marker slides to the chosen item.
5. **One interactive "delight" element per site, in the footer or the 404, not scattered.** SHOWN 6:40-8:00 (404 runner, breakout footer, bloom footer) / SAID 6:55-7:30. For us: a gift shop 404 where a ribbon unrolls back to "Take me home"; a caterer footer where a plate fills as you type a phone number. Max one per site.
6. **A giant brand wordmark cropped by the page bottom works as a footer sign-off.** SHOWN 12:30-13:00 ("Kinetic"), 15:20 ("atelier"). For us: the business name at about 20vw, cropped by the bottom edge, in the brand colour.
7. **Make the headline huge and short, bottom-left over the image, 5 words or fewer.** SHOWN 12:00-12:30, 13:30-14:00 / SAID none. For us: "Fresh challah, Fridays." at about 96px over the hero, start-aligned (right-aligned in RTL), one line on a laptop.
8. **Backgrounds and the hero object may change per section, but keep one accent colour per page.** SHOWN 12:00-13:30 (red / white / pink); the multi-colour pages at 6:40-9:00 are showcases, not real sites. For us: alternate white and one tint; the locked brand palette still wins.
9. **Use a stat-card row only with real numbers.** SHOWN 14:50-15:20 (9 days, 3x, 98) / SAID 14:40. For us: "Since 1998" or "3 branches" only if true; otherwise skip the row.
10. **Frame a short film in a card with a visible play bar and a plain label ("The 20 second film").** SHOWN 15:25-15:40 / SAID 13:50. For us: a 20 s kitchen or bakery clip in a rounded frame, captioned, controls visible, poster frame set, muted by default.
11. **Pick references first, then match them section by section.** SHOWN 3:35-5:00 (reference sites, Mobbin) / SAID 3:36-4:10. For us: keep 2 to 3 reference screenshots with the build brief and compare the render to them.
12. **Keep a review-only overlay that marks what is a generated video and what is code (his "X-ray").** SHOWN 0:30-1:00, 10:50-11:30 / SAID 0:30-1:00. For us: use it in our review loop so a generated clip is never passed off as the business's own footage.
13. **Check mobile of the interactive pieces separately.** SHOWN 12:20 / SAID 12:20-12:40. For us: every hover effect gets a tap equivalent; a dock-style row becomes a bottom bar of 4 icons.
14. **Order or quote steps: one question per card, one accent primary button, a clear final "You're ready" state.** SHOWN 8:15-9:20. For us: a kitchen kashering quote form as 3 short steps ending in a confirmation card that says what happens next.

### Rejected or restricted for honesty
- Stat cards ("9 days / 3x / 98", "40,000 makers"), "love from our clients" quotes and the "I sent a voice note on Monday" testimonial (15:10-15:50): demo inventions. Use only real, sourced figures and quotes with permission.
- Logo wall "Made with the tools you already use" (Figma, Notion, Vercel...) (15:05): needs permission; local businesses should not show one.
- Generated people (smiling woman, man in a video, stock-like lifestyle clips) passed off as customers or staff: only the business's own footage may be shown as theirs; never present generated people as "our team".
- Game-to-unlock-pricing (6:55-7:10, "win the game to give your email"): hides prices behind friction; restricted to the 404 page only.
- Particle burst, flame and 3D-object heroes (Kinetic): heavy and off-brand for a bakery or trainer; use only with a static fallback and reduced-motion support.
- The MongoDB, Higgsfield, paid-community and "$10,000 websites" content: sales material, not design.

### Frames
- frames/fq3wx-AR6B0-0145.jpg: liquid dock, headline swaps on hover
- frames/fq3wx-AR6B0-0650.jpg: 404 as a runner game with mascot
- frames/fq3wx-AR6B0-0730.jpg: flip-board departures banner
- frames/fq3wx-AR6B0-0920.jpg: "Motion graphics on top of your footage" framed video
- frames/fq3wx-AR6B0-1215.jpg: Kinetic red full-bleed hero with 3D disc
- frames/fq3wx-AR6B0-1335.jpg: Claude Design page, huge condensed headline and sticker cards
