#!/bin/sh
# The snap film (gen/snap-brief.md): c1 bends and snaps (S0 to S1), c2 goes round the frozen break (S1 to S2),
# c3 lets time run and tilts down onto her board (S2 to S3, her photo extended). Clips are MiniMax H3 between
# those stills, so each clip ends where the next begins and they join without a dissolve. The break is held
# 2.5 s for the labels and the board 1.5 s for its price: 4.6 + 6.5 + 2.5 + 4.85 + 1.5 = 19.95 s, the marks in gen/build.py.
cd "$(dirname "$0")/film"
# c1 starts at 1.9 s: before that the model briefly drew chocolate onto the plain half (rule 3o.1, nothing from nowhere).
# c3 is cut from 2.25 to 3.9 s, the peach left empty between the halves leaving and the cloth and board arriving (no blank
# screens; the independent review found 3.04 to 3.75 was not enough, the phone crop went blank first).
# The last 1.5 s are her real photo (S3.png, extended, rules 3c.12), faded in over the clip's own end in 0.4 s.
ffmpeg -v error -y -i c1-snap.mp4 -i c2-round.mp4 -i c3-board.mp4 -loop 1 -t 1.9 -i S3.png -filter_complex "[0:v]trim=1.9:6.5,setpts=PTS-STARTPTS,scale=2752:1536,fps=24,format=yuv420p[a];[1:v]trim=0:6.5,setpts=PTS-STARTPTS,scale=2752:1536,fps=24,format=yuv420p,tpad=stop_mode=clone:stop_duration=2.5[b];[2:v]scale=2752:1536,fps=24,format=yuv420p,split[c1][c2];[c1]trim=0:2.25,setpts=PTS-STARTPTS[c1t];[c2]trim=3.9:6.5,setpts=PTS-STARTPTS[c2t];[c1t][c2t]concat=n=2:v=1:a=0[c];[3:v]scale=2752:1536,fps=24,format=yuv420p,setsar=1,settb=1/24[d];[a][b]concat=n=2:v=1:a=0[ab];[ab][c]concat=n=2:v=1:a=0,fps=24,settb=1/24[abc];[abc][d]xfade=transition=fade:duration=0.4:offset=18.05[v]"   -map "[v]" -an -c:v libx264 -preset slow -crf 18 -movflags +faststart opening.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 opening.mp4
# 180 frames chosen by scroll (film.js). Laptop 16:9 at 1680 wide; phone a centred 4:3 crop, the shape of her photo,
# so the break sits in the middle and her board ends whole.
cd ../../assets && rm -rf film && mkdir -p film/d film/m
ffmpeg -v error -y -i ../gen/film/opening.mp4 -vf "fps=180/19.95,scale=1680:-2:flags=lanczos" -frames:v 180 -c:v libwebp -quality 72 film/d/%04d.webp
ffmpeg -v error -y -i ../gen/film/opening.mp4 -vf "fps=180/19.95,crop=ih*4/3:ih:(iw-ih*4/3)/2:0,scale=864:648:flags=lanczos" -frames:v 180 -c:v libwebp -quality 70 film/m/%04d.webp
ls film/d | wc -l; du -sh film/d film/m
