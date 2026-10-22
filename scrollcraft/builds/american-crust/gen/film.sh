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
  -map "[v]" -an -c:v libx264 -preset slow -crf 24 -movflags +faststart ../../assets/opening.mp4
ffmpeg -v error -y -sseof -0.1 -i c3-brag.mp4 -frames:v 1 -vf scale=1920:1080 -q:v 82 ../../assets/film-poster.webp
