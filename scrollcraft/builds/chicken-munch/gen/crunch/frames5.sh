#!/bin/bash
# The whole tender turns (g1 cut before it cracks), splits and explodes in one
# motion (s2, its still tail trimmed), the same backwards, the turn backwards,
# then the drop into the box: 300 frames.
set -e
cd "$(dirname "$0")"
PY=C:/Users/tzviw/Documents/my-israel-rental/backend/.venv/Scripts/python.exe
ffmpeg -loglevel error -y -i g1a.mp4 -i s2t.mp4 -i e2.mp4 -filter_complex "[0:v]scale=2560:1440,setsar=1,fps=24,split[g][gb];[1:v]scale=2560:1440,setsar=1,fps=24,split[h][hb];[hb]reverse[hr];[gb]reverse[gr];[2:v]scale=2560:1440,setsar=1,fps=24[e];[g][h][hr][gr][e]concat=n=5:v=1[v]" -map "[v]" -c:v libx264 -crf 14 film5.mp4
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 film5.mp4)
R=$($PY -c "print(300/$D)")
rm -rf ../../assets/film && mkdir -p ../../assets/film/d ../../assets/film/m
ffmpeg -loglevel error -y -i film5.mp4 -vf "fps=$R,eq=gamma=1.17:saturation=1.04,scale=1680:-2:flags=lanczos" -frames:v 300 -c:v libwebp -quality 70 ../../assets/film/d/%04d.webp
ffmpeg -loglevel error -y -i film5.mp4 -vf "fps=$R,eq=gamma=1.17:saturation=1.04,crop=iw*0.8:ih,scale=1100:-2:flags=lanczos" -frames:v 300 -c:v libwebp -quality 66 ../../assets/film/m/%04d.webp
echo "duration $D"; for f in g1a s2t e2; do ffprobe -v error -show_entries format=duration -of csv=p=0 $f.mp4; done
