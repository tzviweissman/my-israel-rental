#!/bin/sh
# The opening film (rule 3h) in four chapters (24 Nov 2026; Tzvi: the pizza tacked on after Brag "just randomly shows
# the pizza at the end", so the pizza now runs through the story):
#   Boil    their bagel dough into the pot (c1, 22 Oct)
#   Stretch hands stretch the pizza dough, sauce in a spiral, cheese on top (c2, s2-stretch-start -> s2-stretch-end)
#   Bake    gloved hands slide the same tray (raw pie, raw everything bagels) into the oven (c3a, s3-door -> s3-raw),
#           then the bake speeded up: the cheese melts and browns, the bagels turn golden (c3b, s3-raw -> s3-baked)
#   Brag    the pie on its board, a slice lifting with stretching cheese, the whole bagel stack beside it, both in the
#           right two thirds of the frame (c4b, from s4-brag) (Tzvi, 25 Nov 2026: the bake "just appear[ed] cooked"
#           and the bagels at the end were cut off)
# MiniMax H3 clips (starter/clip.py), 0.35 s dissolves. Chapters start at 0, 4.65, 10.5 and 20.3 s of 26.3:
# the word marks in index.html (.18, .40, .77 of the scroll) follow these.
cd "$(dirname "$0")/film"
ffmpeg -v error -y -i c1-boil.mp4 -i c2-stretch.mp4 -i c3a-in.mp4 -i c3b-bake.mp4 -i c4b-brag.mp4 -filter_complex "[0:v]trim=0:5,setpts=PTS-STARTPTS,scale=1920:1080,fps=24,format=yuv420p[a];[1:v]trim=0:6.2,setpts=PTS-STARTPTS,scale=1920:1080,fps=24,format=yuv420p[b];[2:v]trim=0:4.5,setpts=PTS-STARTPTS,scale=1920:1080,fps=24,format=yuv420p[c];[3:v]trim=0:6,setpts=PTS-STARTPTS,scale=1920:1080,fps=24,format=yuv420p[d];[4:v]trim=0:6,setpts=PTS-STARTPTS,scale=1920:1080,fps=24,format=yuv420p[e];[a][b]xfade=transition=fade:duration=0.35:offset=4.65[ab];[ab][c]xfade=transition=fade:duration=0.35:offset=10.5[abc];[abc][d]xfade=transition=fade:duration=0.35:offset=14.65[abcd];[abcd][e]xfade=transition=fade:duration=0.35:offset=20.3[v]"   -map "[v]" -an -c:v libx264 -pix_fmt yuv420p -preset slow -crf 24 -movflags +faststart opening.mp4
ffmpeg -v error -y -sseof -0.1 -i opening.mp4 -frames:v 1 -q:v 82 ../../assets/film-poster.webp
# The film follows the scroll (Tzvi, 22 Oct 2026: "once the video ends they cant see it again"): 250 frames drawn on a
# canvas, chosen by scroll, as on The Brown Box. Laptop 1680 wide 16:9; phone a 9:16 crop at 720x1280, centred a
# little right of the middle for Boil and Stretch. The phone's narrow crop cannot hold the bagels and the pie at once,
# so it slides: to the bagels as the tray goes in, across to the pie as it bakes, then from the pie to the bagel stack in Brag
# (R is the crop's place, 0 = left edge, 1 = right edge).
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 opening.mp4)
R='if(lt(t,10.5),0.56,if(lt(t,15),0.56-0.48*(t-10.5)/4.5,if(lt(t,20.3),0.08+0.67*(t-15)/5.3,if(lt(t,20.8),0.75-0.29*(t-20.3)/0.5,0.46+0.36*min(1,(t-20.8)/5)))))'
cd ../../assets && rm -rf film && mkdir -p film/d film/m
ffmpeg -v error -y -i ../gen/film/opening.mp4 -vf "fps=250/$D,scale=1680:-2:flags=lanczos" -frames:v 250 -c:v libwebp -quality 70 film/d/%04d.webp
ffmpeg -v error -y -i ../gen/film/opening.mp4 -vf "fps=250/$D,crop=w=ih*9/16:h=ih:x='(iw-ow)*$R':y=0,scale=720:1280:flags=lanczos" -frames:v 250 -c:v libwebp -quality 66 film/m/%04d.webp
# The phone plays it by itself on repeat (Tzvi, 29 Oct 2026), at the film's own pace: a 24 fps set of the same phone
# crop, not the 250 scroll frames, which at 15 fps squeezed the 26 s film into 17 s (26 Nov 2026)
rm -rf /tmp/amc-m24 && mkdir -p /tmp/amc-m24
ffmpeg -v error -y -i ../gen/film/opening.mp4 -vf "fps=24,crop=w=ih*9/16:h=ih:x='(iw-ow)*$R':y=0,scale=720:1280:flags=lanczos" -q:v 3 /tmp/amc-m24/%04d.jpg
python ../../../starter/phone_loop.py /tmp/amc-m24 film/phone-loop.mp4 24
rm -rf /tmp/amc-m24
ls film/d | wc -l; du -sh film/d film/m film/phone-loop.mp4
