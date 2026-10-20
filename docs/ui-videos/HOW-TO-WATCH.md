# How to study a design video so nothing is missed

Tzvi, 20 Oct 2026: "how can you go through videos better to catch everything
that would help us". The strawberry product page video (GGg61sdEjeI) was
watched twice and its notes even listed "20% off, not 20% OFF DISCOUNT" and
the old price struck through, yet The Whipped Cup still printed a sentence
under every price. Two failures: the frames were too sparse and small to read
every change, and nobody checked each change against our pages afterwards.

## 1. See every screen, readable
- Pull a frame at every scene change, not every 5 s:
  `ffmpeg -i v.mp4 -vf "select='gt(scene,0.06)',showinfo" -vsync vfr f%04d.png`
  plus one every 2 s as a floor, at full size (1280 px or the video's own).
- Read text on the frames at full size, zooming into each before and after.
  Contact sheets are for finding moments, never for reading words or sizes.
- Wherever something moves, a strip at 6 to 10 fps across the move.
- The transcript (yt-dlp subtitles, else youtube_transcript_api) laid against
  the timestamps: every instruction the presenter SAYS gets its own line too.

## 2. Write down every change, not "lessons"
A table, one row per change shown or said, before the summary:

| Time | Before | After | Exact detail (words, sizes, colours, spacing) | Ours? |

"20% OFF DISCOUNT" to "20% off"; "$6.20" with "$7.00" struck through beside
it; title 16 to 22 px. A row is never merged into a general lesson.

## 3. Two watchers
Two helpers watch the same video separately; a third merges the two tables
and lists what only one caught. Then a spot check of five random rows
against the frames.

## 4. Apply the same day
For every row, for every page being built (and the starter): already done,
fixed now, or not relevant (say why). The result is a checklist in the notes
file with page names ticked. A row that can be measured becomes a check in
scripts/check-site.mjs; one that cannot becomes a line in
docs/page-review-checklist.md.

## 5. Show Tzvi the before and after
For each video, two or three screenshots of our page before and after its
changes, so he can see the video was used, not just read.
