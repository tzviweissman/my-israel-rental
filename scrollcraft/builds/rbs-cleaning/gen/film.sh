# The whole opening: squeegee (gen/wipe-brief.md), then the pull-back (gen/pull-brief.md), one film. Run from the build folder.
# gen/pull/d-timed.mp4 is gen/pull/d.mp4 with 1.96-3.46 s slowed 1.6 times by motion interpolation: it rushed (check-clip)
# cuts: 5.35
F=assets/film; W=gen/wipe/b.mp4; P=gen/pull/d-timed.mp4; rm -f $F/d/* $F/m/*
PAN="875-375*(3*pow(min(1\,t/7.4)\,2)-2*pow(min(1\,t/7.4)\,3))"   # the phone frame drifts left to take in the sofa, easing with the camera
D="[0:v]trim=0.7:6.05,setpts=PTS-STARTPTS,crop=1700:956:555:242,scale=1920:1080:flags=lanczos,setsar=1[a];[1:v]setpts=PTS-STARTPTS,scale=1920:1080:flags=lanczos,setsar=1,tpad=stop_mode=clone:stop_duration=0.6[b];[a][b]concat=n=2:v=1[o]"
M="[0:v]trim=0.7:6.05,setpts=PTS-STARTPTS,crop=538:956:1136:242,scale=720:1280:flags=lanczos,setsar=1[a];[1:v]setpts=PTS-STARTPTS,crop=810:1440:'$PAN':0,scale=720:1280:flags=lanczos,setsar=1,tpad=stop_mode=clone:stop_duration=0.6[b];[a][b]concat=n=2:v=1[o]"
ENC="-c:v libx264 -g 1 -crf 24 -preset slow -pix_fmt yuv420p -movflags +faststart -an"
ffmpeg -loglevel error -y -i $W -i $P -filter_complex "$D" -map "[o]" $ENC $F/opening-d.mp4
ffmpeg -loglevel error -y -i $W -i $P -filter_complex "$M" -map "[o]" $ENC $F/opening-m.mp4
ffmpeg -loglevel error -y -i $F/opening-d.mp4 -vf "scale=1600:900,fps=10" -c:v libwebp -quality 70 $F/d/%04d.webp
ffmpeg -loglevel error -y -i $F/opening-m.mp4 -vf "fps=10" -c:v libwebp -quality 70 $F/m/%04d.webp
