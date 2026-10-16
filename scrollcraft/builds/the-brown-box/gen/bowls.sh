#!/bin/bash
# One photo per bowl, one shoot: same clear takeaway bowl, same bright light,
# same angle, so choosing a bowl swaps the picture (Tzvi, 16 Oct 2026).
PY=/c/Users/tzviw/Documents/my-israel-rental/backend/.venv/Scripts/python.exe
L="in a clear round plastic takeaway bowl filled with smooth purple acai, toppings arranged in neat rows across the top, three-quarter view from slightly above, bright soft daylight, warm cream background and table, crisp sharp food photography, the bowl centred with margin, no text, no hands, no people"
cd bowls
$PY ../still.py classic.png 1:1 "An acai bowl topped with a row of banana slices, a row of frozen blueberries and a row of golden granola, $L" &
$PY ../still.py tropical.png 1:1 "An acai bowl topped with a row of frozen mango cubes, a row of frozen pineapple chunks and a row of golden granola, $L" &
$PY ../still.py sunrise.png 1:1 "An acai bowl topped with a row of diced green apple, a row of frozen mango cubes and a row of golden granola, $L" &
$PY ../still.py superfruit.png 1:1 "An acai bowl topped with a row of kiwi slices, a row of frozen blueberries and a row of banana slices, $L" &
$PY ../still.py own.png 1:1 "An acai bowl topped with four rows: kiwi slices, dates, chocolate chips and golden granola, $L" &
wait; echo DONE
