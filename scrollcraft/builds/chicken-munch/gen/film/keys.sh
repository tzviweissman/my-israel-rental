#!/bin/bash
# Chicken Munch film keyframes (Tzvi, 17 Oct 2026: "do 1"). Bright yellow
# table like their own photo (page rules 3h.11: lit, never dark), subject
# centred with yellow margin so a 9:16 phone crop holds it.
set -e
PY=/c/Users/tzviw/Documents/my-israel-rental/backend/.venv/Scripts/python.exe
G="bright commercial food photograph, three-quarter top-down view, sunny saturated lemon yellow tabletop filling the whole background, crisp bright daylight with soft short shadows, ultra sharp detail, the box centred with wide empty yellow margin on both sides, no text, no logos, no labels, no hands, no people, photorealistic"
cd "$(dirname "$0")"
k() { [ -f "$1-0.png" ] || $PY ../still.py "$1.png" 16:9 "$2, $G"; }
k k1 "An empty open rectangular kraft brown cardboard catering box with its clear-window kraft lid propped open behind it, a small black dish of ketchup and a small black dish of white dipping sauce beside it"
[ "$1" = first ] && exit 0
k k2 "An open rectangular kraft brown cardboard catering box with its clear-window kraft lid propped open behind it, the left half filled with golden corn flake crusted fried chicken pieces and dark brown crushed pretzel crusted chicken, the right half still empty, a small black dish of ketchup and a small black dish of white dipping sauce beside it"
k k3 "An open rectangular kraft brown cardboard catering box with its clear-window kraft lid propped open behind it, completely full of fried chicken: crispy puffed rice crusted chicken fingers, golden corn flake crusted chicken, dark crushed pretzel crusted chicken, golden breaded schnitzel bites, sticky glossy orange glazed chicken bites, and a row of small round sauce pots with plain black lids, a small black dish of ketchup and a small black dish of white dipping sauce beside it"
echo KEYS DONE
