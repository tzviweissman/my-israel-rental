# Five videos, 6 Nov 2026

Method: full captions of all five (yt-dlp), plus 72 stills from chosen moments (yt-dlp stream + ffmpeg).
Not done: sound, continuous motion, and the comments. Nothing here has been made a rule yet.

| Video | Who | Worth |
|---|---|---|
| These 12 Mistakes Make Your App Feel CHEAP (q4TdOOkCDbw) | Wyatt Feaster, 3 Nov | High. A checklist for our forms and dashboard. Mobbin sponsor |
| How To Create Insane Motion Graphics With Opus 5.5 (2moKxAZjwCE) | Tyler Mommsen, 14 Oct | High. Video made in code. Higgsfield affiliate link |
| Build and animate award winning websites using Claude (kau9QOV1G8E) | AyzZ, 31 Oct | Medium-high. Fixing motion with references. Sells his design studio |
| Top 15 Tricks for INSTANTLY Better Claude Designs (rU5llKCPPwI) | Futurepedia, 4 Nov | Medium. New sources, directions and tweaks. Funnel to a free guide |
| 5 Ways to ACTUALLY Build Beautiful Websites Using Claude (83geKREHQY0) | Mikey Website, 1 Aug | Low. Long Base44 course funnel; unsourced numbers |

## Said by more than one

- A detailed brief beats a short one: Mommsen, AyzZ, Mikey, Futurepedia (4).
- Look at the result and critique it in rounds: Mommsen, AyzZ, Futurepedia (3).
- References name the exact part to take: AyzZ, Futurepedia (2).
- One icon set: Feaster, Futurepedia (2). One accent colour with a set job: Mikey, Mommsen (2).

## What feels cheap (Feaster)

Premium apps leave no doubt; cheap ones leave uncertainty. The twelve: no legal line above a send button; an empty
state with no way out; no helper text saying what an action does; no success state; generic errors; a plain spinner;
asking for what is already known; mismatched icons; vague button words; permissions before value; no "clear all
filters"; hiding text needed to decide. Seen in frames: "An error occurred" beside "Use at least 8 characters"; a
refund policy cut off by "More" right above "Buy now".

Our code, 6 Nov (counted by file, not yet looked at on screen): "Something went wrong" in 12 files; spinners in 136,
skeleton loaders in 1; no terms or privacy line in the code of OrderPage.jsx or QuoteRequest.jsx.

## Video made in code (Mommsen)

Remotion or HyperFrames: free, Claude writes the scenes, renders them and joins the frames. Generators are only for
what code cannot draw, such as real faces. The brief, read from the frames:

- PRODUCT: what it is, the promise, features in order.
- STORY: one idea through the whole film (a red line that never leaves the screen and ends as the logo). Every scene
  turns into the next, no fades or cuts. No "headline left, card right".
- FORMAT: 1920x1080, 60 fps, exact length, MP4.
- LOOK: exact colours, one accent, fonts, what to avoid.
- MOTION: the camera always moves slowly, real depth, motion blur.
- SOUND: music and effects made in code, each on the exact frame of its action.
- QUALITY CHECK: render, look at a frame every half second, critique as a senior motion designer, fix, at least four rounds.

"One prompt" videos really take many prompts over hours. Heavy on a subscription.

## Fixing motion (AyzZ)

- Describe every section's motion in plain words, build once, then fix only what failed. He does not attempt references for everything up front.
- For what still fails, give a screen recording of the motion. His strongest claim; shown working on the cards and the sideways scroll.
- For a hover or a change of state, draw both states and say which is which.
- Draw the hard piece (he drew the glow from vector shapes in Figma) and give a screenshot.
- A cut-out's bottom edge showed while scrolling: pin it to the bottom of the screen until the next piece covers it.
- Carry one subject through sections: portrait into a card, the card grows into the next section, fly inside the logo into the next.
- Phone last, with a rough drawing per broken section.
- Discount: needs a designer in Figma, and no sound business reason is given for that much motion. He says himself the folders were still not fixed.

## Sources and directions (Futurepedia)

- New sources seen in the frames: styles.refero.design, 60fps.design, gsap.com, fontshare.com, iconify.design, icons8.com,
  lordicon.com, navbar.gallery, footer.design, reactbits.dev, motion-primitives.com, canvasui.dev.
- Have Claude search a gallery and give its three best with reasons.
- Six meaningfully different directions before building, then combine pieces.
- Tweaks: one page with switches for hero layout, type, buttons, accent and interactions. Includes a list of interaction ideas (frame at 400s).
- Voice: study five real brands in the category, write a voice guide, rewrite the copy.
- Impeccable, a free skills package with a critique command. Third party: read it before installing.

## Colour and hero (Mikey)

Say where the accent may appear (CTAs, active states, hovers only). Describe colour by a real object (a Bloomberg
terminal's black, a heart-rate monitor's glow). 60/30/10. "Whitespace is the primary design directive".

Discount: "82% prefer dark mode", "17 to 50 ms" and "60 to 70% of persuasion" are given with no source. His hero
prompt on screen (16:45) says to write copy as if the business is 6 years old with 340 active members: invented proof,
which our rules forbid.

## Conflicts with what we already decided

- MyIsraelRental's own colours are locked; colour advice applies only to business sites.
- Figma-first needs a designer. Our builds have none, so only the "draw both states" part carries over.
- AyzZ's carried-through scroll scenes must stay inside "effects, never too much" (rules 3h.20).
