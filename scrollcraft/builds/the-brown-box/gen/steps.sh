#!/bin/bash
# The bowl builds: one still, then one clip per physical step, each clip
# starting on the last frame of the one before (no image-edit model on the API).
set -e
PY=../../../../backend/.venv/Scripts/python.exe
LOOK="three-quarter view from slightly above, warm cream table and warm cream wall behind, soft daylight from the upper left, the bowl centred with wide empty margins on every side, photorealistic food photography, no text, no hands, no people"
[ -f steps/f0-0.png ] || $PY still.py steps/f0.png 16:9 "An empty clear round plastic takeaway bowl standing on a table, $LOOK"
last() { ffmpeg -loglevel error -y -sseof -0.05 -i "$1" -frames:v 1 -update 1 "$2"; }
[ -f steps/c1.mp4 ] || $PY clip.py steps/f0-0.png steps/c1.mp4 6 "A thick, smooth, deep purple acai puree pours slowly from above into the empty clear bowl, folding over itself as it fills the bowl about three quarters full, then the surface settles flat and glossy. The camera stays completely still. Real thick puree, it moves like thick frozen yogurt."
last steps/c1.mp4 steps/f1.png
[ -f steps/c2.mp4 ] || $PY clip.py steps/f1.png steps/c2.mp4 6 "Round banana slices and frozen blueberries fall gently from above one at a time and land on the smooth purple acai surface, each one settling where it lands, until a neat row of banana slices and a heap of blueberries cover half the top. The camera stays completely still. Real fruit, natural weight, nothing appears without falling in."
last steps/c2.mp4 steps/f2.png
[ -f steps/c3.mp4 ] || $PY clip.py steps/f2.png steps/c3.mp4 6 "Golden crunchy granola is sprinkled from above in a soft shower, the clusters bouncing a little and settling over the uncovered half of the acai beside the fruit, until that half is covered in granola. The camera stays completely still. Real granola clusters, natural weight."
last steps/c3.mp4 steps/f3.png
echo DONE
