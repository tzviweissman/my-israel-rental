#!/bin/sh
# The advert film (gen/advert-brief.md), 2 Nov 2026. Replaces the snap film (in git history before this date).
# Tzvi picked take B (MiniMax H3 at 2K, film/advert-minimax.mp4) over the Seedance take, then:
#   "the crack isnt smooth so maybe just show the full bar and show it brokn open on the board"
#   "just cut the random rice peices but leave the rest"
# So: impact and orbit (0 to 3.86 s), the close-up slowed 1.5x (its pan lurched in check-clip), then the halves on the
# board (10.27 s on) held 1 s; that part (film/advert-B-gen.mp4) had its loose rice removed by a Seedance 2.5 video edit
# through the API (gen/edit.py, film/advert-B-norice.mp4). Her real board photo (S3, extended) dissolves in over 0.8 s.
# cuts: 2.02 3.86 5.75 8.3
cd "$(dirname "$0")/film"
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 advert-B-norice.mp4)
OFF=$(python -c "print(round($D-0.8,3))")
ffmpeg -v error -y -i advert-B-norice.mp4 -loop 1 -framerate 24 -t 3.3 -i S3.png -filter_complex "\
[0:v]scale=2560:1440:flags=lanczos,fps=24,format=yuv420p,setsar=1,settb=1/24[a];\
[1:v]scale=5120:2880,zoompan=z='1.08-0.08*on/79':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=2560x1440:fps=24,format=yuv420p,setsar=1,settb=1/24[e];\
[a][e]xfade=transition=fade:duration=0.8:offset=$OFF[v]" \
  -map "[v]" -an -c:v libx264 -preset medium -crf 18 -movflags +faststart opening.mp4
T=$(ffprobe -v error -show_entries format=duration -of csv=p=0 opening.mp4); echo "$T"
# Every frame of the film (24 a second), chosen by scroll and blended between neighbours (film.js; Tzvi 3 Nov: "the motions dont look smooth"). Laptop 16:9 at 1680 wide; phone a centred 4:3 crop, the shape of her photo.
cd ../../assets && rm -rf film && mkdir -p film/d film/m
ffmpeg -v error -y -i ../gen/film/opening.mp4 -vf "scale=1680:-2:flags=lanczos" -c:v libwebp -quality 70 film/d/%04d.webp
ffmpeg -v error -y -i ../gen/film/opening.mp4 -vf "crop=ih*4/3:ih:(iw-ih*4/3)/2:0,scale=864:648:flags=lanczos" -c:v libwebp -quality 70 film/m/%04d.webp
ls film/d | wc -l; ls film/m | wc -l; du -sh film/d film/m
# the film as video, tied to the scroll (film.js data-video, rules 3h.22): every frame a keyframe so any moment shows at once
ffmpeg -v error -y -i ../gen/film/opening.mp4 -vf "scale=1920:-2:flags=lanczos" -c:v libx264 -g 1 -crf 24 -preset slow -pix_fmt yuv420p -an -movflags +faststart film/opening-d.mp4
ffmpeg -v error -y -i ../gen/film/opening.mp4 -vf "crop=ih*4/3:ih:(iw-ih*4/3)/2:0,scale=1024:768:flags=lanczos" -c:v libx264 -g 1 -crf 24 -preset slow -pix_fmt yuv420p -an -movflags +faststart film/opening-m.mp4
