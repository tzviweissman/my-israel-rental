#!/bin/sh
# The opening as five slides (gen/film-brief.md, Slides, 12 Nov 2026): one clip per slide, no dissolves.
#   s1 C1b  beans pour into the grinder, its cup fills with fresh grounds
#   s2 C2   grounds fall in from the top of the slide into the jar of cold water, which steeps dark
#   s3 C3b  cold brew pours in from the top over ice (its first half, before the model's fade)
#   s4 C3b  milk pours in from the top and swirls (its second half, after the fade)
#   s5 C4   the camera pulls back to their own coffee bar
# Laptop 1600 wide 16:9; phone a 9:16 crop centred on the falling coffee (x as a share of the free width).
# Every frame a keyframe, so the scroll can move to any moment at once (rules 3h.22). Posters are each slide's first frame.
set -e
cd "$(dirname "$0")/film"
OUT=../../assets/film; mkdir -p $OUT
one() {  # name clip from to cropx
  ffmpeg -v error -y -ss $3 -to $4 -i $2 -vf "scale=1600:-2" -c:v libx264 -g 1 -crf 30 -pix_fmt yuv420p -an -movflags +faststart $OUT/$1-d.mp4
  ffmpeg -v error -y -ss $3 -to $4 -i $2 -vf "crop=ih*9/16:ih:(iw-ih*9/16)*$5:0,scale=720:1280" -c:v libx264 -g 1 -crf 30 -pix_fmt yuv420p -an -movflags +faststart $OUT/$1-m.mp4
  ffmpeg -v error -y -i $OUT/$1-d.mp4 -frames:v 1 -c:v libwebp -quality 72 $OUT/$1-d.webp
  ffmpeg -v error -y -i $OUT/$1-m.mp4 -frames:v 1 -c:v libwebp -quality 70 $OUT/$1-m.webp
}
one s1 C1b.mp4 0.25 6.30 0.50
one s2 C2.mp4 0.25 6.35 0.50
one s3 C3b.mp4 0.25 3.40 0.47
one s4 C3b.mp4 3.95 6.35 0.48
one s5 C4.mp4 0.25 6.35 0.47
du -ch $OUT/s?-*.mp4 | tail -1
