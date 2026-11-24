#!/bin/sh
# The opening film (rule 3h): Boil (their dough into the pot), Bake (the tray in the oven), Brag (their everything bagels).
# Clips are MiniMax H3 from the stills in gen/film (each still made from their own photos). 0.35 s dissolves between chapters.
# Chapters start at 0, 4.65 and 6.8 s: the word marks in gen/build.py follow these.
cd "$(dirname "$0")/film"
ffmpeg -v error -y -i c1-boil.mp4 -ss 0.5 -t 2.5 -i c2-bake.mp4 -i c3-brag.mp4 -filter_complex "\
[0:v]trim=0:5,setpts=PTS-STARTPTS,scale=1920:1080,fps=24,format=yuv420p[a];\
[1:v]setpts=PTS-STARTPTS,scale=1920:1080,fps=24,format=yuv420p[b];\
[2:v]trim=0:5,setpts=PTS-STARTPTS,scale=1920:1080,fps=24,format=yuv420p[c];\
[a][b]xfade=transition=fade:duration=0.35:offset=4.65[ab];\
[ab][c]xfade=transition=fade:duration=0.35:offset=6.8[v]" \
  -map "[v]" -an -c:v libx264 -preset slow -crf 24 -movflags +faststart opening.mp4
# Pizza too (the owner, via Tzvi 23 Nov 2026: the opening "only showcases the bagels"): c4-pizza, MiniMax H3 from the
# film's last frame (s4-start.png) to s4-end.png (Qwen Image 3 edit of that frame: the camera a metre left, a baked cheese
# pie on its board, the bagels at the right edge; cut 16:9 from its square). The camera pulls back and left; the pie comes
# in past the left edge, the bagel board leaves past the right. Joined with a straight cut: its first frame is the last.
ffmpeg -v error -y -i opening.mp4 -i c4-pizza.mp4 -filter_complex "\
[1:v]trim=start_frame=1,setpts=PTS-STARTPTS,scale=1920:1080,fps=24,format=yuv420p[p];\
[0:v][p]concat=n=2:v=1[v]" -map "[v]" -an -c:v libx264 -preset slow -crf 24 -movflags +faststart opening-full.mp4
ffmpeg -v error -y -sseof -0.1 -i opening-full.mp4 -frames:v 1 -q:v 82 ../../assets/film-poster.webp
# The film follows the scroll (Tzvi, 22 Oct 2026: "once the video ends they cant see it again"): 233 frames (150 before
# the pizza) drawn on a canvas, chosen by scroll, as on The Brown Box. Laptop 1680 wide 16:9; phone a 9:16 crop at
# 720x1280, centred a little right of the middle so the pot, the tray, the pile of bagels and the pie stay in frame.
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 opening-full.mp4)
cd ../../assets && rm -rf film && mkdir -p film/d film/m
ffmpeg -v error -y -i ../gen/film/opening-full.mp4 -vf "fps=233/$D,scale=1680:-2:flags=lanczos" -frames:v 233 -c:v libwebp -quality 70 film/d/%04d.webp
ffmpeg -v error -y -i ../gen/film/opening-full.mp4 -vf "fps=233/$D,crop=ih*9/16:ih:(iw-ih*9/16)*0.56:0,scale=720:1280:flags=lanczos" -frames:v 233 -c:v libwebp -quality 66 film/m/%04d.webp
# The phone plays it by itself on repeat (Tzvi, 29 Oct 2026): the phone frames at 15 fps, the pie held a moment, then a
# soft fade back to the first frame
python ../../../starter/phone_loop.py film/m film/phone-loop.mp4
ls film/d | wc -l; du -sh film/d film/m film/phone-loop.mp4
