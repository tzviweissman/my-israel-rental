#!/bin/bash
# The Brown Box film (Tzvi, 16 Oct 2026: "go with your combined film").
# Keyframes K1..K5 are stills in one style; each clip starts on the LAST
# FRAME of the clip before and ends on the next keyframe (end_image_url),
# so the film is one unbroken shot. Subject centred with margin for phones.
set -e
PY=/c/Users/tzviw/Documents/my-israel-rental/backend/.venv/Scripts/python.exe
G="cinematic food commercial photograph, macro lens, shallow depth of field, warm golden rim light, rich deep brown-black background, ultra sharp detail, the subject centred with empty margin on both sides, no text, no logos, no hands, no people, photorealistic"
cd v2
k() { [ -f "$1-0.png" ] || $PY ../still.py "$1.png" 16:9 "$2, $G"; }
k k2b "Extreme close-up of thick glossy deep purple acai puree swirling and folding in slow motion, rich purple ripples catching warm golden light, a few dark acai berries sinking into the swirl"
k k3b "A thick ribbon of deep purple acai puree folding into a clear plastic takeaway bowl, the bowl half full, glossy surface, seen from slightly above"
k k4b "Banana slices, frozen blueberries and golden granola clusters falling in slow motion with a glossy ribbon of peanut butter, just above a clear plastic takeaway bowl filled with smooth purple acai, seen from slightly above"
k k5b "A clear plastic takeaway bowl of purple acai topped with a row of banana slices, frozen blueberries and golden granola, with a zigzag drizzle of peanut butter across the top, seen from slightly above"
last() { ffmpeg -loglevel error -y -sseof -0.05 -i "$1" -frames:v 1 -update 1 "$2"; }
c() { # name start end prompt
  [ -f "$1.mp4" ] || $PY ../clip.py "$2" "$1.mp4" 6 "$4 One continuous shot, smooth slow camera, real physics, nothing appears or vanishes by magic." "$3"
}
c f1 k1-0.png k2b-0.png "The camera follows the ripe acai berries as they let go of the palm branch and fall through warm light, down into a deep purple acai swirl that rises to fill the frame."
last f1.mp4 f1-end.png
c f2 f1-end.png k3b-0.png "The thick purple acai swirl flows forward and folds down in a heavy ribbon into a clear plastic takeaway bowl, the camera easing back to see the bowl fill."
last f2.mp4 f2-end.png
c f3 f2-end.png k4b-0.png "The camera rises slightly as banana slices, frozen blueberries, golden granola and a ribbon of peanut butter fall in slow motion from above toward the bowl of smooth purple acai."
last f3.mp4 f3-end.png
c f4 f3-end.png k5b-0.png "The banana slices, blueberries and granola land softly on the purple acai in neat rows, and the peanut butter settles in a zigzag drizzle across the top."
last f4.mp4 f4-end.png
c f5 f4-end.png k3-0.png "The camera rises smoothly to look straight down as the finished bowl is set inside an open kraft brown box, the lid lifting above it and warm light spilling around the bowl."
echo DONE
