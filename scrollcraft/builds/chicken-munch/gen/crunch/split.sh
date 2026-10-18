#!/bin/bash
# Tzvi, 18 Oct 2026: the crumbs first fell down as blocks, then a separate
# explosion followed. One motion instead: from the whole tender (g1 cut at
# 3.8 s, before it cracks), the split and the explosion happen together,
# ending on the same exploded frame (x1).
cd "$(dirname "$0")"
PY=/c/Users/tzviw/Documents/my-israel-rental/backend/.venv/Scripts/python.exe
[ -f s2.mp4 ] || $PY ../clip.py s1.png s2.mp4 6 "The whole corn flake crusted chicken tender bursts apart in one sudden slow-motion explosion: it splits in the middle and in the same instant the two halves are blasted out to the left and right while hundreds of golden corn flake shards shoot outward from the break in every direction, straight toward the camera. Nothing falls down, nothing piles up below; every crumb flies outward with the force of the burst. The camera holds still and wide so both halves stay in frame. One continuous shot, bright lemon yellow background, real physics." x1-0.png || echo "CLIP s2 FAILED"
echo SPLIT DONE
