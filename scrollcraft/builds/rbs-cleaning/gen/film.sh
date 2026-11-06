# The whole opening: squeegee (gen/wipe-brief.md), then the pull-back (gen/pull-brief.md), one film. Run from the build folder.
# gen/view2/pull-timed.mp4 is gen/view2/pull.mp4 ending at 7.3 s, with 3.04-3.5 s slowed 1.6 times by motion interpolation: it rushed (check-clip)
# cuts: 7.3
F=assets/film; W=gen/view2/wipe.mp4; P=gen/view2/pull-timed.mp4; rm -f $F/d/* $F/m/*
PAN="875-375*(3*pow(min(1\,t/7.3)\,2)-2*pow(min(1\,t/7.3)\,3))"   # the phone frame drifts left to take in the sofa, easing with the camera
D="[0:v]trim=0.4:7.7,setpts=PTS-STARTPTS,scale=1920:1080:flags=lanczos,setsar=1[a];[1:v]scale=1920:1080:flags=lanczos,setsar=1,tpad=stop_mode=clone:stop_duration=0.6[b];[a][b]concat=n=2:v=1[o]"
M="[0:v]trim=0.4:7.7,setpts=PTS-STARTPTS,crop=810:1440:875:0,scale=720:1280:flags=lanczos,setsar=1[a];[1:v]crop=810:1440:'$PAN':0,scale=720:1280:flags=lanczos,setsar=1,tpad=stop_mode=clone:stop_duration=0.6[b];[a][b]concat=n=2:v=1[o]"
ENC="-c:v libx264 -g 1 -crf 29 -preset slow -pix_fmt yuv420p -movflags +faststart -an"
ffmpeg -loglevel error -y -i $W -i $P -filter_complex "$D" -map "[o]" $ENC $F/opening-d.mp4
ffmpeg -loglevel error -y -i $W -i $P -filter_complex "$M" -map "[o]" $ENC $F/opening-m.mp4
ffmpeg -loglevel error -y -i $F/opening-d.mp4 -vf "scale=1600:900,fps=10" -c:v libwebp -quality 70 $F/d/%04d.webp
ffmpeg -loglevel error -y -i $F/opening-m.mp4 -vf "fps=10" -c:v libwebp -quality 70 $F/m/%04d.webp
