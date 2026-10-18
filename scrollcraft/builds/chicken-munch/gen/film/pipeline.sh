#!/bin/bash
# Chicken Munch film + style close-ups. The film is one chained shot: each
# clip starts on the last frame of the one before (no end frames, so the box
# stays the same box), all on the bright yellow table.
cd "$(dirname "$0")"
PY=/c/Users/tzviw/Documents/my-israel-rental/backend/.venv/Scripts/python.exe
last() { ffmpeg -loglevel error -y -sseof -0.05 -i "$1" -frames:v 1 -update 1 "$2"; }
T="One continuous shot on the same yellow table and the same kraft box, steady camera, real physics, every piece falls from above the frame and lands, nothing appears or vanishes by magic, bright daylight."
c() { [ -f "$1.mp4" ] || $PY ../clip.py "$2" "$1.mp4" 6 "$3 $T" || echo "CLIP $1 FAILED"; }
c f1 k1-0.png "Golden corn flake crusted fried chicken pieces and dark brown crushed pretzel crusted chicken pieces drop one by one into the empty open kraft box and settle in its left half."
last f1.mp4 f1-end.png
c f2 f1-end.png "Crispy puffed rice crusted chicken fingers and golden breaded schnitzel bites drop one by one into the kraft box and fill its right half beside the corn flake and pretzel chicken."
last f2.mp4 f2-end.png
c f3 f2-end.png "Sticky glossy orange glazed chicken bites drop into the last gaps of the full kraft box, then the camera slowly pushes in on the box full of fried chicken."
last f3.mp4 f3-end.png
echo FILM DONE
# style close-ups, one round kraft bowl each, on a plain coloured ground
S="bright commercial food photograph, close-up from a three-quarter angle, a round kraft paper takeaway bowl heaped with the chicken, crisp bright daylight, ultra sharp crunchy texture, the bowl centred with margin, no text, no logos, no hands, no people, photorealistic"
s() { [ -f "st-$1-0.png" ] || $PY ../still.py "st-$1.png" 1:1 "$2, on a plain smooth $3 background, $S" || echo "STILL $1 FAILED"; }
s classic "Classic American fried chicken tenders with a craggy golden crunchy buttermilk crust" "warm amber orange"
s hot "Bite-sized popcorn chicken poppers tossed in a glossy spicy red pepper sauce" "bright tomato red"
s shnitzel "Golden breadcrumb coated bite-sized chicken schnitzel pieces" "soft cream"
s fruity "Sticky glossy apricot and orange glazed fried chicken bites" "light peach orange"
s cornflakes "Fried chicken pieces coated in a thick crispy golden corn flake crust" "lemon yellow"
s pretzel "Chicken pieces coated in a dark brown crushed pretzel crust" "light kraft tan"
s rice "Chicken fingers coated in crispy puffed rice crispies, pale golden and bumpy" "pale sky blue"
echo ALL DONE
