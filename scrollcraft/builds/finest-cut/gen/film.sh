#!/bin/sh
# The Golden mountains film (gen/mountains-brief.md). Run from gen/ after clip.py skim and climb, and film_stills.py.
# C1's middle lurched in check-clip, so it is slowed 1.7x with new frames drawn between; the last of C1 is C2's first.
cd film
ffmpeg -v error -y -i C1.mp4 -filter_complex "[0:v]fps=24,format=yuv420p,split=3[x][y][z];\
[x]trim=0:1.45,setpts=PTS-STARTPTS[a];\
[y]trim=1.45:3.65,setpts=1.7*(PTS-STARTPTS),minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:vsbmc=1[b];\
[z]trim=3.65,setpts=PTS-STARTPTS[c];[a][b][c]concat=n=3[v]" -map "[v]" -c:v libx264 -crf 14 -preset fast -an a.mp4
ffmpeg -v error -y -i C2.mp4 -loop 1 -i edges.png -filter_complex "[1:v]format=rgba,fade=t=in:st=3.7:d=0.6:alpha=1[e];\
[0:v]fps=24,trim=start_frame=1,setpts=PTS-STARTPTS[s];[s][e]overlay=shortest=1,format=yuv420p[v]" -map "[v]" -c:v libx264 -crf 14 -preset fast -an b.mp4
cd .. && python film_tall.py && sh film_tail.sh
