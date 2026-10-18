#!/bin/bash
# Snap, blast, blast backwards, snap backwards (the halves rejoin into the
# whole tender), then the drop into the box: 360 frames for the canvas.
set -e
cd "$(dirname "$0")"
PY=C:/Users/tzviw/Documents/my-israel-rental/backend/.venv/Scripts/python.exe
ffmpeg -loglevel error -y -i g1.mp4 -i h2.mp4 -i e2.mp4 -filter_complex "[0:v]scale=2560:1440,setsar=1,split[g][gb];[1:v]scale=2560:1440,setsar=1,split[h][hb];[hb]reverse[hr];[gb]reverse[gr];[2:v]scale=2560:1440,setsar=1[e];[g][h][hr][gr][e]concat=n=5:v=1[v]" -map "[v]" -c:v libx264 -crf 14 film4.mp4
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 film4.mp4)
R=$($PY -c "print(360/$D)")
rm -rf ../../assets/film && mkdir -p ../../assets/film/d ../../assets/film/m
ffmpeg -loglevel error -y -i film4.mp4 -vf "fps=$R,eq=gamma=1.17:saturation=1.04,scale=1680:-2:flags=lanczos" -frames:v 360 -c:v libwebp -quality 70 ../../assets/film/d/%04d.webp
ffmpeg -loglevel error -y -i film4.mp4 -vf "fps=$R,eq=gamma=1.17:saturation=1.04,crop=iw*0.8:ih,scale=1100:-2:flags=lanczos" -frames:v 360 -c:v libwebp -quality 66 ../../assets/film/m/%04d.webp
echo "duration $D"; ls ../../assets/film/d | wc -l; du -sh ../../assets/film/d ../../assets/film/m
