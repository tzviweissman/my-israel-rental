#!/bin/bash
# Topping tiles for the menu (after the Kumo matcha site's fruit tiles, video
# VwGrXe2ricE): one shoot, the same cream ground and soft daylight, top-down.
PY=/c/Users/tzviw/Documents/my-israel-rental/backend/.venv/Scripts/python.exe
L="seen from directly above, centred with wide even margin, on a plain warm cream paper background, bright soft daylight from the upper left, crisp sharp food photography, no bowl, no plate, no text, no hands"
cd tops
$PY ../still.py banana.png 1:1 "Five fresh banana slices in a loose little heap, $L" &
$PY ../still.py blueberry.png 1:1 "A small heap of frozen blueberries with a light frost, $L" &
$PY ../still.py granola.png 1:1 "A small heap of golden crunchy granola clusters with oats, $L" &
$PY ../still.py mango.png 1:1 "A small heap of bright orange mango cubes, $L" &
$PY ../still.py kiwi.png 1:1 "Four fresh kiwi slices overlapping, $L" &
$PY ../still.py pineapple.png 1:1 "A small heap of golden yellow pineapple chunks, $L" &
wait; echo DONE
