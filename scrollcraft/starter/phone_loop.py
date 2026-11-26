"""The phone opening that plays by itself on repeat (Tzvi, 29 Oct 2026: "on mobile we should remove the scroll and it
should just play on repeat"), from a site's phone frames: python phone_loop.py <frames dir> <out.mp4> [fps] [--tail S]

    python ../../starter/phone_loop.py assets/film/m assets/film/phone-loop.mp4

The frames (0001.webp...) at 15 fps, the last one held a second, then a 0.6 s fade back to the first. Run it again
whenever the frames change: a film script that clears assets/film/ removes the loop too (American Crust, 23 Nov 2026,
when the loop had no script and was rebuilt from memory). The page shows it as data-loop on the opening section.

--tail S, an option for new sites (26 Nov 2026, from The Brown Box's held product): the film plays once and its last S
seconds then rock back and forth, so the opening rests on the finished product instead of fading back to the start.
The file is the film, the tail reversed, then the tail forward again (it starts and ends on the last frame, so the
rocking is seamless). The page plays it without loop and, at each end, jumps back to the rocking part:
    vid.loop = false; vid.addEventListener('ended', function () { vid.currentTime = vid.duration - 2 * S; vid.play(); });
Pick a tail where something still moves (steam, a pour settling, a slow turn); a tail that is still looks frozen.
"""
import subprocess
import sys
from pathlib import Path

args = sys.argv[1:]
tail = 0.0
if '--tail' in args:
    i = args.index('--tail'); tail = float(args[i + 1]); del args[i:i + 2]
src, out = Path(args[0]), args[1]
fps = int(args[2]) if len(args) > 2 else 15
frames = sorted(src.glob('*.webp')) or sorted(src.glob('*.jpg'))
if not frames:
    sys.exit(f'no frames in {src}')
ext, hold, fade = frames[0].suffix, 1.0, 0.6
seq = str(src / f'%04d{ext}')
# yuv420p on the output: xfade hands libx264 4:4:4, which phones do not play (the American Crust loop sat on its first
# frame on every phone, 25 Nov 2026); publish-page refuses any other format
enc = ['-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-crf', '28', '-preset', 'slow', '-movflags', '+faststart', out]
if tail:
    k = max(2, round(tail * fps))
    if k >= len(frames):
        sys.exit(f'--tail {tail} is the whole film ({len(frames)} frames)')
    first_tail = int(frames[-k].stem)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(fps), '-i', seq,
                    '-framerate', str(fps), '-start_number', str(first_tail), '-i', seq, '-filter_complex',
                    '[0:v]format=yuv420p[a];[1:v]format=yuv420p,split[t1][t2];[t1]reverse[r];[a][r][t2]concat=n=3:v=1:a=0[v]',
                    '-map', '[v]', *enc], check=True)
    print('wrote', out, f'({len(frames)} frames, {(len(frames) + 2 * k) / fps:.1f} s; rocking part: the last {2 * k / fps:.2f} s)')
else:
    offset = len(frames) / fps + hold - fade
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(fps), '-i', seq,
                    '-loop', '1', '-t', str(fade + 0.7), '-i', str(frames[0]), '-filter_complex',
                    f'[0:v]tpad=stop_mode=clone:stop_duration={hold},format=yuv420p,settb=1/{fps},fps={fps}[a];'
                    f'[1:v]format=yuv420p,settb=1/{fps},fps={fps}[b];[a][b]xfade=transition=fade:duration={fade}:offset={offset:.3f}[v]',
                    '-map', '[v]', *enc], check=True)
    print('wrote', out, f'({len(frames)} frames, {offset + fade + 0.7:.1f} s)')
