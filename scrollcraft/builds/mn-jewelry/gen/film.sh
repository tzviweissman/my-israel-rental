#!/bin/sh
# The home opening, one film that follows the scroll, made in code from the pieces' studio pictures (gen/scenes.html,
# photographed by gen/scenes.mjs; Tzvi, 10 Nov 2026): light crosses their twist ring as its gold turns white, yellow, rose,
# four more of their pieces drift by in boxes, and the ring settles in the middle. No generated clip ("it looks so fake")
# and no 3D ("the rings look very fake"): Tzvi, 9 Nov 2026.
cd "$(dirname "$0")/.." && rm -rf assets/film && mkdir -p assets/film/d assets/film/m
for k in wide:d:1920:1080:1680 tall:m:1080:1920:720; do
  IFS=: read n s w h f <<EOF2
$k
EOF2
  ffmpeg -v error -y -framerate 24 -i "gen/scenes/$n/%04d.png" -vf "scale=$w:$h:flags=lanczos,format=yuv420p" -c:v libx264 -crf 16 -preset medium "gen/film/opening-$n.mp4"
  # still frames (12 a second): the picture until the video plays, the fallback without it, reduced motion's last frame
  ffmpeg -v error -y -i "gen/film/opening-$n.mp4" -vf "fps=12,scale=$f:-2:flags=lanczos" -c:v libwebp -quality 72 "assets/film/$s/%04d.webp"
  # as video tied to the scroll (film.js data-video): every frame a keyframe so any moment shows at once
  ffmpeg -v error -y -i "gen/film/opening-$n.mp4" -c:v libx264 -g 1 -crf 22 -preset slow -pix_fmt yuv420p -an -movflags +faststart "assets/film/opening-$s.mp4"
done
ls assets/film/d | wc -l; ls assets/film/m | wc -l; du -sh assets/film/*
