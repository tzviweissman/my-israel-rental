#!/bin/bash
# Burst forwards, the same burst backwards (the flakes fly back together and
# the piece reforms as the camera zooms back), then the fall into the box:
# 300 frames for the canvas.
set -e
cd "$(dirname "$0")"
PY=C:/Users/tzviw/Documents/my-israel-rental/backend/.venv/Scripts/python.exe
ffmpeg -loglevel error -y -i e1.mp4 -i e2.mp4 -filter_complex "[0:v]split[a][b];[b]reverse[r];[1:v]scale=2560:1440,setsar=1[c];[a][r][c]concat=n=3:v=1[v]" -map "[v]" -c:v libx264 -crf 14 film3.mp4
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 film3.mp4)
R=$($PY -c "print(300/$D)")
rm -rf ../../assets/film && mkdir -p ../../assets/film/d ../../assets/film/m
ffmpeg -loglevel error -y -i film3.mp4 -vf "fps=$R,eq=gamma=1.17:saturation=1.04,scale=1680:-2:flags=lanczos" -frames:v 300 -c:v libwebp -quality 70 ../../assets/film/d/%04d.webp
ffmpeg -loglevel error -y -i film3.mp4 -vf "fps=$R,eq=gamma=1.17:saturation=1.04,crop=iw*0.45:ih,scale=760:-2:flags=lanczos" -frames:v 300 -c:v libwebp -quality 66 ../../assets/film/m/%04d.webp
ls ../../assets/film/d | wc -l; du -sh ../../assets/film/d ../../assets/film/m
