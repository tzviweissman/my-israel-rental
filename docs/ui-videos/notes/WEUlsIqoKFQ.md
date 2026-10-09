# how to build STUNNING websites

- Channel: Andres The Designer
- URL: https://youtu.be/WEUlsIqoKFQ
- Length: 6:13 (373 s)
- Watched: frames every 3 s (11 contact sheets), key frames at full size; transcript read alongside. The tools were visible on screen.

## What is shown

Claim: sites that stand out share a beautiful full-bleed background (image or video) behind a short headline and one input or button. Workflow: find image, restyle, widen, animate, assemble in a site builder.

- 0:00-0:18 Montage of hero pages: a red "DESIGN. DISRUPT. CONQUER." page with figures, a night scene with a person at a desk among flowers, a mountain valley ("Beyond silence, we build the eternal."), a ring-of-flowers scene. Each is one big image with a one-line headline in serif or heavy display type.
- 0:18-0:42 Origin (personal finance tool) is the main example. The hero is only clouds and blue sky with "Own your wealth." in italic serif, one chat-style input, a "Get started" button and award laurels. No graphs in the hero. When product UI appears later while scrolling, it sits on photographic backdrops (desert and sea images). Frame: frames/WEUlsIqoKFQ-0024.jpg
- 0:44-0:54 Three steps on screen: 1 Find backgrounds, 2 Animate them, 3 Publish with Framer.
- 1:09-1:48 Step 1. Pinterest searched for "background sky", following similar-image rabbit holes; Midjourney Explore as second source. Says: Pinterest is better for deep browsing of similar styles.
- 1:48-2:02 Restyle a chosen reference in an image model; two models' outputs shown side by side (one stays closer to the reference, the other changes it more).
- 2:04-2:42 Widening in Figma: portrait image set to 16:9 using Figma's expand, dragging proportionally and leaving room where text and the CTA will go. Lasso an object to remove it.
- 2:45-3:12 Step 2. In Higgsfield the image is the start frame, model MiniMax H3, prompt along the lines of "subtly animate, do not move the camera", 6 s, 2K. The result is a gentle loop.
- 3:12-4:12 Step 3, Framer. Its built-in agent is asked for a full-viewport-height hero with a video background component. The result starts with a sample ocean video and "CRAFTED IN MOTION"; the generated video is uploaded in its place. The AI-added dark overlay is deleted because the starry sky already gives contrast. The heading is moved to the top instead of the centre for readability on small viewports. Text changed to "IMAGINE YOUR LOVE STORY". Frames: frames/WEUlsIqoKFQ-0336.jpg, frames/WEUlsIqoKFQ-0430.jpg
- 4:30-5:23 Chat composer: a screenshot of the Origin page is given to the agent, which builds a similar input. The output is imperfect, so the designer adds hover states on buttons, a hover border on the input, tuned shadows, a typing effect and a send button that turns active when text is entered.
- 5:23-5:42 Final hero in preview with typed text and active send button; two alternate heroes shown. Frame: frames/WEUlsIqoKFQ-0536.jpg
- 5:42-6:13 Outro, resources link, meme clips and a verse. No design content.

Tools named: Pinterest, Midjourney, ChatGPT and Gemini image models, Figma (expand, lasso remove), Higgsfield with MiniMax H3, Framer with its agent. The video is sponsored by Framer.

## Candidate rules for us

| # | Rule (testable) | Evidence | SHOWN or SAID |
|---|---|---|---|
| 1 | Hero = one full-bleed image or short video, one short headline, one primary action. No dashboards, grids or product UI in the hero. Check: hero holds at most headline, one subline, one CTA (plus an optional secondary link). | 0:00-0:42 | SHOWN |
| 2 | Use the owner's REAL photos or footage as the background (their bakery counter, the coach mid-session, the actual tour route). Generated scenes must never stand in for the business, its food, its people or its premises. Mood imagery is decoration only. | 0:00-5:42 (all scenes are AI or stock) | SHOWN; the honesty limit is ours |
| 3 | If the source image is portrait, extend it to 16:9 and leave clean space for headline and CTA before building. Phone-first: also check the portrait crop and keep the subject in frame. | 2:04-2:42 | SHOWN and SAID |
| 4 | Video backgrounds: subtle, camera locked, about 6 s loop. Add a still poster for slow phones, stay still for prefers-reduced-motion, keep the file small. | 2:45-3:12 | SHOWN and SAID (6 s, subtle); poster and reduced-motion are ours |
| 5 | Keep an overlay only if text fails contrast; the presenter deleted the default overlay because the image already had a dark area under the text. Test contrast on the actual pixels. | 3:36-4:12 | SHOWN and SAID |
| 6 | On small viewports put the headline near the top of the frame so it is readable and does not cover the subject. | 3:54-4:13 | SAID; repositioning shown |
| 7 | Display type choices shown: italic serif emphasis or heavy caps. Hebrew has neither italic nor caps, so pick a Hebrew-capable face first and test the look afterwards. | 0:00-0:42 | SHOWN; Hebrew caveat is ours |
| 8 | Generated components need a human polish pass: hover and focus states, borders, shadows, active states. Check each interactive element has all states. | 4:48-5:23 | SHOWN and SAID |
| 9 | A hero "chat composer" input is only valid if it is a real enquiry box that reaches the owner. A typing animation implying an assistant that answers would be dishonest. | 4:30-5:42 | SHOWN; honesty condition is ours |

### Rejected

- Rejected: the award laurels and "trusted by" marks in the Origin hero. Never add awards, press logos or counts the business cannot document.
- Rejected: the stat row "250+ / 95% / 10+" in the first montage (0:12-0:15). We use only owner-verified numbers.
- Rejected: the "limited time" chip on the Origin hero (0:24). No time-limited tags without a real, dated offer.
- The workflow depends on paid tools (Higgsfield, Framer) and the video is sponsored by Framer; our stack is our own React/HTML, so only the ideas carry over.

## Key frames

- frames/WEUlsIqoKFQ-0024.jpg (Origin sky hero: one image, headline, one input)
- frames/WEUlsIqoKFQ-0336.jpg (Framer hero with video background)
- frames/WEUlsIqoKFQ-0430.jpg (final hero, heading positioned at top)
- frames/WEUlsIqoKFQ-0536.jpg (finished hero with working composer)
