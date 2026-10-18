#!/bin/bash
# The three clips as one film of frames for the canvas: 240 frames.
# d/: laptop, 1680 wide 16:9. m/: phone, the centre of the frame (the box and
# its margin) at 760 wide, drawn on the yellow above the words.
set -e
cd "$(dirname "$0")"
printf "file f1.mp4\nfile f2.mp4\nfile f3.mp4\n" > films.txt
ffmpeg -loglevel error -y -f concat -i films.txt -c:v libx264 -crf 14 film.mp4
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 film.mp4)
R=$("C:/Users/tzviw/Documents/my-israel-rental/backend/.venv/Scripts/python.exe" -c "print(240/$D)")
rm -rf ../../assets/film && mkdir -p ../../assets/film/d ../../assets/film/m
ffmpeg -loglevel error -y -i film.mp4 -vf "fps=$R,eq=gamma=1.17:saturation=1.04,scale=1680:-2:flags=lanczos" -frames:v 240 -c:v libwebp -quality 70 ../../assets/film/d/%04d.webp
ffmpeg -loglevel error -y -i film.mp4 -vf "fps=$R,eq=gamma=1.17:saturation=1.04,crop=iw*0.45:ih,scale=760:-2:flags=lanczos" -frames:v 240 -c:v libwebp -quality 66 ../../assets/film/m/%04d.webp
ls ../../assets/film/d | wc -l; du -sh ../../assets/film/d ../../assets/film/m
