#!/bin/sh
# The snap film (gen/snap-brief.md). Remade 1 Nov 2026 after Tzvi: "the bend and the the snap dont look natural".
#   c1a  the bend: the whole chew bows and one crack opens where it will break (S0 to S0b)
#   c1b  the tear, as slow motion (take B of two, remade 1 Nov after Tzvi's "fix it"; take A failed check-clip JUMP):
#        sticky peanut-butter strands stretch across the gap, thin and break back into each face, grains pull loose, the
#        halves part (S0b to S1); 1.0 to 2.0 s, where the gap opens and the strands first stretch, plays at half speed
#        (the review: the strands seemed to appear at once), and its last 2 s, the grains' drift to S1, play 2.5x so
#        they land on clip 2's first frame. The break is now held 1.5 s (no labels to read there any more).
#   c2   the camera goes round the frozen break (S1 to S2), held 2.5 s
#   S3   her real board photo, extended (rules 3c.12), dissolving in over 0.8 s and drawing back slowly for 3.5 s.
#        Clip 3 (time running again, a tilt down onto the board) was dropped: check-clip found it rushing at up to 47 a
#        frame (smooth films stay under 7) and an empty peach second in the middle.
# 6.5 + 5.5 + 0.8 + 6.5 + 1.5 + 3.5 - 0.8 = 23.5 s; the marks in gen/build.py follow it.
# cuts: 20.4
cd "$(dirname "$0")/film"
V="scale=2752:1536,fps=24,format=yuv420p,setsar=1"
ffmpeg -v error -y -i c1a-bend.mp4 -i c1b-tear.mp4 -i c2-round.mp4 -loop 1 -framerate 24 -t 3.5 -i S3.png -filter_complex "\
[0:v]trim=0:6.5,setpts=PTS-STARTPTS,$V[a];\
[1:v]$V,split=4[b0][b1][b2][b3];\
[b0]trim=0:1.0,setpts=PTS-STARTPTS[b0t];[b1]trim=1.0:2.0,setpts=2*(PTS-STARTPTS),fps=24[b1t];[b2]trim=2.0:4.5,setpts=PTS-STARTPTS[b2t];[b3]trim=4.5:6.5,setpts=0.4*(PTS-STARTPTS),fps=24[b3t];\
[2:v]trim=0:6.5,setpts=PTS-STARTPTS,$V,tpad=stop_mode=clone:stop_duration=1.5[c];\
[3:v]scale=5504:3072,zoompan=z='1.08-0.08*on/83':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=2752x1536:fps=24,format=yuv420p,setsar=1,settb=1/24[e];\
[a][b0t][b1t][b2t][b3t][c]concat=n=6:v=1:a=0,fps=24,settb=1/24[all];\
[all][e]xfade=transition=fade:duration=0.8:offset=20.0[v]" \
  -map "[v]" -an -c:v libx264 -preset medium -crf 18 -movflags +faststart opening.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 opening.mp4
# 200 frames chosen by scroll (film.js). Laptop 16:9 at 1680 wide; phone a centred 4:3 crop, the shape of her photo,
# so the break sits in the middle and her board ends whole.
cd ../../assets && rm -rf film && mkdir -p film/d film/m
ffmpeg -v error -y -i ../gen/film/opening.mp4 -vf "fps=200/23.5,scale=1680:-2:flags=lanczos" -frames:v 200 -c:v libwebp -quality 70 film/d/%04d.webp
ffmpeg -v error -y -i ../gen/film/opening.mp4 -vf "fps=200/23.5,crop=ih*4/3:ih:(iw-ih*4/3)/2:0,scale=864:648:flags=lanczos" -frames:v 200 -c:v libwebp -quality 70 film/m/%04d.webp
ls film/d | wc -l; du -sh film/d film/m
