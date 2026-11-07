# Videos made in code

Tzvi, 7 Nov 2026, from Tyler Mommsen's video (notes in `docs/inspo/videos-2026-11-06/`). A film is an HTML page
with `window.seek(seconds)`. `scripts/code-video.mjs` draws it frame by frame and joins the frames with ffmpeg, so
the timing is exact on any machine. It needs no paid generation and no new package.

    node scripts/code-video.mjs scroll <url> <dir> --frames 90 --screens 1.5   record a real page scrolling on a phone
    node scripts/code-video.mjs render <film.html> <out.mp4> --w 1080 --h 1920 --dur 22.5 --query "lang=he&clips=file:///..." --audio x.wav
    node scripts/code-video.mjs sheet <out.mp4> <sheet.jpg>                     a frame every half second, to critique

HyperFrames (the free tool in the video) was not used: running its package on this machine was refused, and
Playwright and ffmpeg do the same job.

## The brief, before any code

- **Product**: what it is, the promise, what to show, in order.
- **Story**: one idea runs through the whole film. Every scene turns into the next; no fades or cuts. No "headline
  on the left, card on the right".
- **Format**: size, frame rate, exact length. WhatsApp Status and Reels: 1080x1920.
- **Look**: exact colours, one accent, the fonts, what to avoid.
- **Motion**: the camera never stops; real depth. Nothing sits frozen.
- **Sound**: made in code (Python, standard library), every sound on the frame of its action.
- **Check**: render, read the frame sheet, critique it as a senior motion designer (story, layout, spacing, type,
  timing, readability), fix, render again. At least four rounds, and write down what changed each round.

An ad film is still an ad: its blueprint (`docs/ads/blueprints/<name>.md`, `scripts/ad-blueprint.mjs`) is answered
first. Recorded sites are real pages recorded live; nothing on screen is drawn to look like a site.

## Example

`docs/ads/video/mir-sites-video/`: film.html (one phone never leaves the screen; each business's colours pour out
of it) and sound.py. The recorded stills are not kept in git; record them again with `scroll`.
