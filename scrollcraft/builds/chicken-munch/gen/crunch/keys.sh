#!/bin/bash
# "The crunch" (Tzvi, 17 Oct 2026, after "I don't like your wow moment"):
# macro advert film. A corn flake tender floats, snaps in half in slow
# motion with crumbs bursting at the camera, then the camera pulls back to
# the full box. Bright yellow, subject centred with margin for phones.
cd "$(dirname "$0")"
PY=/c/Users/tzviw/Documents/my-israel-rental/backend/.venv/Scripts/python.exe
G="high-end fast food commercial photograph, sunny saturated lemon yellow background filling the frame, crisp bright studio light with a warm rim light, ultra sharp macro detail, the subject centred with wide empty yellow margin on both sides, no text, no logos, no hands, no people, photorealistic"
k() { [ -f "$1-0.png" ] || $PY ../still.py "$1.png" 16:9 "$2, $G" || echo "STILL $1 FAILED"; }
k c1 "Extreme macro of a single thick golden corn flake crusted fried chicken tender floating in mid air, every crunchy corn flake shard catching the light, a few crumbs drifting below it"
k c2 "Extreme macro, frozen in slow motion: a thick golden corn flake crusted fried chicken tender snapping in half in mid air, juicy white chicken meat inside with a wisp of steam, dozens of golden corn flake crumbs and shards bursting outward toward the camera"
k c3 "An open rectangular kraft brown cardboard catering box with its clear-window kraft lid propped open behind it, seen from the front at a slight angle from above, completely full of fried chicken: corn flake crusted chicken, dark crushed pretzel crusted chicken, puffed rice crusted chicken fingers, golden schnitzel bites and sticky glazed orange chicken bites, a few golden crumbs settling on the yellow table around it"
echo KEYS DONE
