#!/bin/bash
# The burst (Tzvi, 18 Oct 2026, with a reference clip of an explosion filling
# the frame): the tender's flakes explode out toward the camera; the page then
# plays the same clip BACKWARDS, so the camera zooms back and the flakes fly
# back together and the piece reforms (built in code, not generated); then
# the whole tender falls into the full box, landing on the same frame the
# picker zooms into (page rules 3h.12).
cd "$(dirname "$0")"
PY=/c/Users/tzviw/Documents/my-israel-rental/backend/.venv/Scripts/python.exe
T="Bright lemon yellow background, crisp bright studio light, ultra sharp, real physics, nothing appears or vanishes by magic."
[ -f e1.mp4 ] || $PY ../clip.py c1-0.png e1.mp4 6 "The floating corn flake crusted chicken tender bursts apart in a powerful slow-motion explosion of hundreds of golden corn flake shards and crumbs flying outward in every direction, straight toward the camera, as the camera pushes in fast into the burst until golden flakes fill the whole frame. One continuous shot. $T" || echo "CLIP e1 FAILED"
[ -f e2.mp4 ] || $PY ../clip.py c1-0.png e2.mp4 6 "The floating corn flake crusted chicken tender drops straight down in slow motion and lands on top of an open kraft box completely full of fried chicken as the camera follows it down and the box fills the frame. One continuous shot. $T" g2-end.png || echo "CLIP e2 FAILED"
echo BURST DONE
