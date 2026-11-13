#!/bin/sh
# The cold brew journey (gen/film-brief.md): C1 grind, C2 steep, C3 pour, C4 back to their bar, joined with 0.4 s
# dissolves, then a 0.5 s fade into their own photo (C4's own last frame jumps, check-clip 6.50 s), held 0.7 s.
# Each clip loses its first and last 0.25 s where the model eases in and out (Clip plan, Trim).
# Chapter starts (s): GRIND 0, STEEP 5.7, POUR 11.4, YOURS 17.1; total about 23.9 s.
set -e
cd "$(dirname "$0")/film"
ffmpeg -v error -y -i C1.mp4 -i C2.mp4 -i C3.mp4 -i C4.mp4 -loop 1 -t 1.6 -i ../journey/bar-end.png -filter_complex "\
[0:v]trim=0.25:6.35,setpts=PTS-STARTPTS,scale=1920:1080,fps=24,format=yuv420p[a];\
[1:v]trim=0.25:6.35,setpts=PTS-STARTPTS,scale=1920:1080,fps=24,format=yuv420p[b];\
[2:v]trim=0.25:6.35,setpts=PTS-STARTPTS,scale=1920:1080,fps=24,format=yuv420p[c];\
[3:v]trim=0.25:6.35,setpts=PTS-STARTPTS,scale=1920:1080,fps=24,format=yuv420p[d];\
[4:v]scale=1920:1080,fps=24,format=yuv420p[e];\
[a][b]xfade=transition=fade:duration=0.4:offset=5.7[ab];\
[ab][c]xfade=transition=fade:duration=0.4:offset=11.4[abc];\
[abc][d]xfade=transition=fade:duration=0.4:offset=17.1[abcd];\
[abcd][e]xfade=transition=fade:duration=0.5:offset=22.7[v]" \
  -map "[v]" -an -c:v libx264 -preset slow -crf 22 -movflags +faststart opening.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 opening.mp4
# the film follows the scroll: frames for the canvas (laptop 16:9, phone 9:16 crop kept on the action in the middle)
cd ../../assets && rm -rf film && mkdir -p film/d film/m
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 ../gen/film/opening.mp4)
ffmpeg -v error -y -i ../gen/film/opening.mp4 -vf "fps=180/$D,scale=1680:-2:flags=lanczos" -frames:v 180 -c:v libwebp -quality 70 film/d/%04d.webp
ffmpeg -v error -y -i ../gen/film/opening.mp4 -vf "fps=180/$D,crop=ih*9/16:ih:(iw-ih*9/16)*0.5:0,scale=720:1280:flags=lanczos" -frames:v 180 -c:v libwebp -quality 66 film/m/%04d.webp
# played as real video (rules 3h.22): every frame a keyframe so any scroll point shows at once
ffmpeg -v error -y -i ../gen/film/opening.mp4 -vf scale=1600:-2 -c:v libx264 -g 1 -crf 31 -pix_fmt yuv420p -an -movflags +faststart film/opening-d.mp4
ffmpeg -v error -y -i ../gen/film/opening.mp4 -vf "crop=ih*9/16:ih:(iw-ih*9/16)*0.5:0,scale=720:1280" -c:v libx264 -g 1 -crf 31 -pix_fmt yuv420p -an -movflags +faststart film/opening-m.mp4
ls film/d | wc -l; du -sh film/d film/m film/opening-d.mp4 film/opening-m.mp4
