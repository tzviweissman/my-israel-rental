#!/bin/bash
# Second try: the blast's end is pinned to a still of the exploded moment, so
# the clip has to travel there (the first try barely moved).
cd "$(dirname "$0")"
PY=/c/Users/tzviw/Documents/my-israel-rental/backend/.venv/Scripts/python.exe
[ -f x1-0.png ] || $PY ../still.py x1.png 16:9 "Frozen high-speed photograph of an explosion of fried chicken: the two halves of a thick golden corn flake crusted chicken tender blasted far apart, one half near the left side and one near the right side of the frame, both showing juicy white meat, and between them hundreds of golden corn flake shards and crumbs exploding outward in every direction toward the camera, filling the frame, sunny saturated lemon yellow background, crisp bright studio light, ultra sharp, no text, no hands, no people, photorealistic" || echo "STILL FAILED"
[ -f h2.mp4 ] || $PY ../clip.py g1-end.png h2.mp4 6 "The two halves of the corn flake chicken tender are blasted apart in a powerful slow-motion explosion, flying out to the left and right while hundreds of golden corn flake shards burst outward in every direction toward the camera. The camera holds still and wide so both halves stay in frame. One continuous shot, bright lemon yellow background, real physics." x1-0.png || echo "CLIP h2 FAILED"
echo BLAST2 DONE
