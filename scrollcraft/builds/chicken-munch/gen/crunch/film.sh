#!/bin/bash
# The crunch, two chained clips with chosen end frames (MiniMax H3).
cd "$(dirname "$0")"
PY=/c/Users/tzviw/Documents/my-israel-rental/backend/.venv/Scripts/python.exe
T="One continuous shot, bright yellow background, real physics, slow motion, nothing appears or vanishes by magic."
c() { [ -f "$1.mp4" ] || $PY ../clip.py "$2" "$1.mp4" 6 "$4 $T" "$3" || echo "CLIP $1 FAILED"; }
c g1 c1-0.png c2-0.png "The floating corn flake crusted chicken tender turns slowly toward the camera, then snaps cleanly in half in slow motion: golden corn flake crumbs and shards burst outward toward the lens and a wisp of steam rises from the juicy white meat inside."
ffmpeg -loglevel error -y -sseof -0.05 -i g1.mp4 -frames:v 1 -update 1 g1-end.png
c g2 g1-end.png ../film/f3-end.png "The two halves and the golden crumbs fall away slowly as the camera pulls back and down, revealing an open kraft box completely full of fried chicken on the yellow table, the crumbs landing on the chicken."
echo FILM DONE
