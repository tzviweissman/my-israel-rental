#!/bin/sh
# Laptop and phone films from a.mp4 and b.mp4 (film.sh makes those). Run from gen/.
# The climb lands on their real photo at a known place (align.py: 1.249 x the window of pano, measured), so the dissolve has no ghost.
cd film
printf "file 'a.mp4'\nfile 'b.mp4'\n" > ab.txt
ffmpeg -v error -y -f concat -safe 0 -i ab.txt -c copy ab.mp4
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 ab.mp4); OFF=$(python -c "print(round($D-0.8,3))"); echo "ab $D"
# laptop: dissolve to their photo, hold, then draw back until the board sits right with room for the words (crop cannot change size, so the picture is scaled instead)
E="min(1,max(0,(t-1.3)/2.6))"; S="($E*$E*(3-2*$E))"; K="(1-0.2*$S)"
ffmpeg -v error -y -i ab.mp4 -loop 1 -framerate 24 -t 4.4 -i pano.png -filter_complex "\
[1:v]scale=w='2*trunc(3675*$K/2)':h='2*trunc(1800*$K/2)':eval=frame:flags=lanczos,crop=2560:1440:x='979*$K*(1-$S)':y='180*$K*(1-$S)',format=yuv420p,setsar=1,settb=1/24,fps=24[e];\
[0:v]format=yuv420p,setsar=1,settb=1/24,fps=24[f];[f][e]xfade=transition=fade:duration=0.8:offset=$OFF[v]" -map "[v]" -c:v libx264 -crf 15 -preset medium -an -movflags +faststart opening.mp4
# phone: the middle of the film, drawing back as it climbs until the board fills the phone's width where its own picture has it; the frame's lower edge fades into the dark
F="min(1,max(0,(t-9.2)/(${D}-9.2)))"; Z="($F*$F*(3-2*$F))"; SC="(1.111+(0.3203-1.111)*$Z)"
ffmpeg -v error -y -f lavfi -i "color=c=0x070605:s=720x1600:r=24:d=$D" -i ab.mp4 -loop 1 -framerate 24 -t 4.4 -i tall.png -loop 1 -framerate 24 -i fade.png -filter_complex "\
[1:v]fps=24,format=rgba[r];[3:v]format=gray[m];[r][m]alphamerge,scale=w='2*trunc(2560*$SC/2)':h='2*trunc(1440*$SC/2)':eval=frame:flags=bicubic[z];\
[0:v][z]overlay=x='-1062+1071*$Z':y='290*$Z':eval=frame:shortest=1,format=yuv420p,setsar=1,settb=1/24,fps=24[f];\
[2:v]scale=720:1600,format=yuv420p,setsar=1,settb=1/24,fps=24[e];[f][e]xfade=transition=fade:duration=0.8:offset=$OFF[v]" -map "[v]" -c:v libx264 -crf 15 -preset medium -an -movflags +faststart opening-m.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 opening.mp4
cd ../../assets && rm -rf film && mkdir -p film/d film/m
ffmpeg -v error -y -i ../gen/film/opening.mp4 -vf "fps=12,scale=1680:-2:flags=lanczos" -c:v libwebp -quality 62 film/d/%04d.webp
ffmpeg -v error -y -i ../gen/film/opening-m.mp4 -vf "fps=12" -c:v libwebp -quality 62 film/m/%04d.webp
ffmpeg -v error -y -i ../gen/film/opening.mp4 -vf "scale=1920:-2:flags=lanczos" -c:v libx264 -g 1 -crf 25 -preset slow -pix_fmt yuv420p -an -movflags +faststart film/opening-d.mp4
ffmpeg -v error -y -i ../gen/film/opening-m.mp4 -c:v libx264 -g 1 -crf 26 -preset slow -pix_fmt yuv420p -an -movflags +faststart film/opening-m.mp4
ls film/d | wc -l; du -sh film film/d film/m
