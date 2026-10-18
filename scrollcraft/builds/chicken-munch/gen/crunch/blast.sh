#!/bin/bash
# Tzvi, 18 Oct 2026: "the split the chicken in half clip from before and the
# pieces explode out then reverse back in". One new clip from the snap's last
# frame; the page plays snap, blast, blast backwards, snap backwards (the
# halves rejoin), then the drop into the box (e2 starts on the whole tender).
cd "$(dirname "$0")"
PY=/c/Users/tzviw/Documents/my-israel-rental/backend/.venv/Scripts/python.exe
[ -f h1.mp4 ] || $PY ../clip.py g1-end.png h1.mp4 6 "The two halves of the corn flake crusted chicken tender fly apart to the left and right in slow motion while hundreds of golden corn flake shards explode outward from between them in every direction, the white juicy meat of both halves clearly visible the whole time. The camera stays wide and pulls back slightly so both halves always stay fully in frame. One continuous shot, bright lemon yellow background, crisp bright studio light, ultra sharp, real physics." || echo "CLIP h1 FAILED"
echo BLAST DONE
