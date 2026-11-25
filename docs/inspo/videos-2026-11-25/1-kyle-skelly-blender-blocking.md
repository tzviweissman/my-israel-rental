# Kyle Skelly, "Claude + Blender + Seedance 2.5 = Insane Websites"

youtu.be/mvfo3pUiCCA, 9:19, 633K views. Sponsored by Higgsfield.

How it was read: the YouTube transcript panel in Chrome, plus 6 frames (5 saved here). Two mid-roll ads ate the first
round of frames; the second round was clean.

## The one idea

Plan the camera move as a rough moving model before paying for the clip. "When you're working with AI videos, one of
the biggest problems is you never really know what you're going to get."

## How he does it

1. **A blocking scene in Blender.** He types one prompt into Higgsfield's Blender plugin, for example: "Design me a
   scene with a private jet that's overlooking Big Ben, London City skyline. Keep it low poly and simple. It's just
   for blocking. 10 seconds long. Camera should pan out of the window and then down at the cityscape to reveal Big
   Ben." It took about 10 minutes and made grey shapes with a keyframed camera.
2. **A playblast** (Blender's quick preview render): 1080p MP4.
3. **Claude watches the playblast** and writes "a detailed second by second prompt" for the video model, with the
   look added in words (cinematic lighting, Big Ben lit). Frame-verified: the prompt in Higgsfield reads like
   "8-9s: The camera decelerates into a slow drift, framing Big Ben centre-frame..." (`mvfo3pUiCCA-blocking-to-seconds-prompt.png`).
4. **The clip is generated** with that prompt, plus a reference picture of the real product or character when there
   is one (10 to 12 s, 16:9, 1080p).
5. **On the site the clip is scrubbed by the scroll.**

He first tried the same idea as words only. It "does look good, but it doesn't quite have the pacing or the dynamic
camera moves that we want".

## The four sites (frame-verified)

- **Through a plane window into a city, then a mountain above clouds that fades to white** into the next section
  (`mvfo3pUiCCA-window-flythrough-oregon-hero.png`: "Experience Oregon" over the clip).
- **An exploded product.** A VR headset pulls apart into its lenses, boards and shell as you scroll, then a feature
  card rises beside it (`mvfo3pUiCCA-exploded-product-on-scroll.png`). He admits the parts "might not be the most
  accurate".
- **A character film planned around the words.** The camera turns round a samurai, who then moves to the right half
  so feature text sits on the left, then whips to the left for the next feature. "We want to have this as like one
  continuous video that just kind of fills the frame." (`mvfo3pUiCCA-character-film-hero.png`)
- **A small video card grows into the next full-screen film** (`mvfo3pUiCCA-card-grows-into-next-film.png`).

## What to ignore

- The Higgsfield sponsorship and his paid course.
- The Blender plugin and bridge are Higgsfield's MCP route. Our paid generation goes only through `scripts/hf.py`,
  so we would use Blender on its own (free) for the rough, never their bridge.
- No phone check, no cost per clip, no word on how many tries each clip took.
- Game and gadget demos: none of them is a small local business.

## What it means here

- We plan films as stills: the sketch sheet (3h.6), start, middle and end pictures (3al.5), the end frame first
  (3al.1), a scroll timeline (3ak.2) and motion written with numbers (3al.4). What we never have is the **moving**
  rough. A camera path is exactly the thing stills cannot show.
- Section 8 of the rulebook already names Blender for three jobs and says "Blender hasn't been used in the project
  yet". Camera blocking would be a fourth job, and the easiest first one.
- The "words on alternating sides" film is a good fit for our end-frame-first rule: plan where the subject stands at
  each feature so the words have their own clear half.
- A window, arch or door opening onto the product is already a motion in `scrollcraft/motions.json` ("window").
