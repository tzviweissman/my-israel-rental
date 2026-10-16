#!/bin/bash
# The five film clips as frames for the canvas: 300 frames (10 per second),
# laptop 1920 wide 16:9, phone a centred 9:16 crop at 720x1280.
set -e
cd "$(dirname "$0")/v2"
printf "file f1.mp4\nfile f2.mp4\nfile f3.mp4\nfile f4.mp4\nfile f5.mp4\n" > films.txt
ffmpeg -loglevel error -y -f concat -i films.txt -c:v libx264 -crf 14 film.mp4
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 film.mp4)
R=$(python -c "print(300/$D)")
rm -rf ../../assets/film && mkdir -p ../../assets/film/d ../../assets/film/m
ffmpeg -loglevel error -y -i film.mp4 -vf "fps=$R,eq=eval=frame:gamma='1.45+0.38*max(0,1-t/13)+0.22*between(t,10,19)':brightness='0.03+0.05*max(0,1-t/13)':saturation=1.12:contrast=1.04,scale=1680:-2:flags=lanczos" -frames:v 300 -c:v libwebp -quality 66 ../../assets/film/d/%04d.webp
ffmpeg -loglevel error -y -i film.mp4 -vf "fps=$R,eq=eval=frame:gamma='1.45+0.38*max(0,1-t/13)+0.22*between(t,10,19)':brightness='0.03+0.05*max(0,1-t/13)':saturation=1.12:contrast=1.04,crop=ih*9/16:ih,scale=720:1280:flags=lanczos" -frames:v 300 -c:v libwebp -quality 62 ../../assets/film/m/%04d.webp
ls ../../assets/film/d | wc -l; du -sh ../../assets/film/d ../../assets/film/m
