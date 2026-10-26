# Brief: the opening film, version 2 (written before generating, 25 Oct 2026)

Why: Tzvi, 25 Oct: "it shows the fruit floating out of the watermelon and then rise and then fall onto the board but the watermelon pieces just disappear" and "the scene doesnt make sense". In assets/opening.mp4 the two halves are clean up to 1.30 s, then the camera jumps to a third piece in the middle, and every rind is gone by the landing.

Tzvi approved these five steps (25 Oct, "yes to the five steps"):
1. A whole watermelon on the red ground; a knife cuts it in two (kept: the first 1.30 s of the current film).
2. The two halves fall open to the left and right and rock to a stop. They stay on screen for the whole film.
3. From between the halves the fruit bursts upward: watermelon wedges, green and red grapes, melon, pineapple, pomegranate.
4. The fruit hangs for a moment, then drops and lands arranged on her long wooden board, between the two empty halves.
5. The last picture is her Large platter as in her photo, with the two empty halves beside the board; it holds, then fades back to step 1 and repeats.

## Step A: the end still (image edit)
- Base, kept exactly: assets/opening-end.webp (her Large board on the red ground, already matched to her photo src/owner/p06.jpg; see opening-film-compare.jpg).
- Reference for the halves: the frame at 1.30 s of the current film (gen/v2-start.png), the same two halves.
- Prompt idea: keep the photo exactly as it is (ground, light, board, every fruit in its place). Only add the two watermelon halves from the second image, now hollowed out (green striped rind outside, pale inside, no red flesh), lying open on the red ground: one to the left of the board's left end, one to the right beyond the pomegranate and handle. Natural contact shadows. Nothing else changes.
- No design words, no idealising.
- Check beside her photo: board, fruit order (green grapes left, pineapple crown, red grapes, pomegranate right, melon fan front, watermelon wedges behind), handle, then the halves' rind matches the start frame.

## Step B: the burst (one clip, start and end frame pinned)
- Start: gen/v2-start.png (1.30 s of the current film). End: the approved end still.
- One cause, one motion (rule 3h.13): the halves roll apart to their end places while the fruit bursts up from between them, hangs, then lands on the board. No cut, no new pieces appearing, nothing vanishing.
- Joined to the first 1.30 s of the current film at that exact frame.

## Then
- The page: hold the end picture, crossfade back to the first frame, play again (assets loop), with reduced motion showing the end picture only.
- Tool, model and exact prompts are logged in this file once run.

## Result of the first attempt, and the change of idea (25-26 Oct 2026)
Kling 3.0 Pro through the Higgsfield API (gen/film_v2.py), start gen/v2-start.jpg, end gen/opening-end-v2.jpg, prompt in film_v2.py. The halves stayed on screen, but their red flesh vanished while they rolled rind-up, a whole round slice grew out of a small middle piece, and pineapple pieces faded in the air. Tzvi: "it still doesnt make sense the watermelon inside just disapears". The idea itself was impossible (one watermelon cannot become a platter of other fruit), so it is dropped; rule 3h.18 written. Tzvi chose idea 1, fruit rain: gen/opening-film-v3-brief.md.
