# Photos, generated media and video: the methods that worked

Learned building L.A. Cholent (Oct 2026) and the MyIsraelRental hero (Sep 2026).
The worked page is `examples/la-cholent/` (its BRIEF.md says what every asset is).

## Choosing what to generate

- Their own photos first, wherever they are good enough. Generated media is
  for the setting and props (a kitchen, a candlelit table, a closed pot),
  never their product shown as theirs. On L.A. Cholent the only cholent on
  the page is their own photograph.
- **"Make it like this video" means the same choreography.** Generated video
  only matches the look; it reinterprets the reference on every render, so
  rerolling never converges. Say so before spending credits and build the
  motion in code (CSS, canvas, WebGL) instead. Three rounds and ~1,600
  credits were spent learning this.
- Check credits before a batch (Higgsfield `balance`; kie.ai `kie.mjs probe`).
  Submit generations one at a time if a batch reports a false "out of credits".

## Higgsfield (MCP connector, and the Python SDK)

- Stills: `generate_image` with `gpt_image_2_5` at 16:9 (and a 9:16 or
  cropped phone version). Then `upscale_image` (bytedance) for a 2K source.
- Clips: `generate_video` with `seedance_2_5`, giving the still as the
  `start_image` (omni reference), 5s, a small physical motion only (steam,
  a pour, candle flicker). Then `upscale_video` if needed.
- **The MCP connection can refuse** with "Requires basic plan or higher"
  even with credits showing (seen 6 Oct 2026 on the free web plan). Then
  use the API, and never mention it to the business owner.
- **API model ids are not the MCP's names, and the SDK's README example
  (`bytedance/seedream/v4/text-to-image`) returns `model_not_found`.** The
  real list is `https://docs.higgsfield.ai/docs/openapi.json` (paths are the
  ids). Probe an id at no cost by submitting without a prompt: a validation
  error means it exists, `model_not_found` / `model_blocked` means not.
  Working still: `higgsfield-ai/soul/standard`, `aspect_ratio` one of
  9:16, 16:9, 4:3, 3:4, 1:1, 2:3, 3:2, `resolution` 720p or 1080p
  (returns 2048x1152 at 16:9), result in `images[0].url`. Video:
  `bytedance/seedance-2.5/text-to-video`. Worked script:
  `scrollcraft/builds/kashermybnb/gen/still.py` in the MyIsraelRental repo.
- From code: the `higgsfield-client` Python SDK (`subscribe` with
  `on_queue_update`), key in `HF_KEY` in a gitignored `.env.local`
  (`key-id:key-secret`), never printed. Worked example in the
  MyIsraelRental repo: `backend/higgsfield_demo/main.py`. Billing is prepaid
  API credits, separate from the web plan.

## Making a clip behave on a scroll page

1. **Encode for scrubbing**: every frame a keyframe-ish dense GOP, or scroll
   scrubbing stutters. scroll-craft's `encode.sh` does it (`mobile` arg for
   the phone file). Always make a separate phone encode.
2. **Nothing moves without a reason.** Generated clips drift, zoom and
   "breathe". Behind text, freeze everything but the subject:
   - pick the cleanest frame as a still;
   - build a feathered mask over only the area that should move (the steam
     corridor above the pot);
   - composite: still everywhere, the clip only inside the mask.
   Measure it: per-pixel frame difference outside the mask should be ~0
   (L.A. Cholent went from 2.67 to 0.02). A motion map (mean abs diff across
   frames) shows where the clip is moving before you decide.
3. **If the camera moves and something must sit on a spot** (a knob on a
   dial), steady the clip first: find the spot in every frame with a detector
   (OpenCV `HoughCircles` for round things), fit a smooth path (cubic
   polynomial), and `warpAffine` each frame so the spot never moves. Then the
   overlay is fixed to one point.
4. **Overlays live inside the media's element**, positioned in fractions of
   that element (e.g. `DIAL_AT = [x, y, size]` of the frame), so they move
   with it at every size. Never position them with scroll script, never key
   them to `video.currentTime`.
5. **Measure spots, never eyeball them**: sample frames, find the target with
   the detector, record its fraction of the frame. Then prove it on the
   rendered page with `scripts/overlay-truth.mjs` at six sizes (max 4px).
6. Poster images: frame 0 of the clip as `.webp` so the first paint matches
   the video, and a still for reduced motion.
7. Phones: size the media to the space actually left over by the text
   (measure the text's height in script), crop toward the subject, never put
   media behind words it can collide with.

## Checking and showing

- Screenshots at many scroll positions (pinned parts smear in one tall
  shot), with video paused or blocked during capture where it helps.
- Widths 375, 390, 768, ~1000 (Tzvi's usual window, and the band between
  breakpoints that once cropped a hero), 1280, 1440, 1536x753, 1920.
- Owner preview: `scripts/record.mjs` makes a phone-size MP4 scroll-through,
  about 45 seconds, fine for WhatsApp. It draws the video frame by frame
  rather than recording the screen: the page's clock, its animations, its
  videos and the scroll are set for each frame's exact time, then the frame
  is captured. So a heavy page never stutters, and two runs match (to the
  eye; a darkened background video can differ by a few decoder pixels). It
  takes about 0.3 s a frame, so 6 to 8 minutes for a phone preview, and it
  writes `<name>-sheet.jpg`, a contact sheet to check before sending. Never publish a page carrying a
  real business's branding as a public artifact; send the video instead.
