"""The phone opening that plays by itself on repeat (Tzvi, 29 Oct 2026: "on mobile we should remove the scroll and it
should just play on repeat"), from a site's phone frames: python phone_loop.py <frames dir> <out.mp4> [fps]

    python ../../starter/phone_loop.py assets/film/m assets/film/phone-loop.mp4

The frames (0001.webp...) at 15 fps, the last one held a second, then a 0.6 s fade back to the first. Run it again
whenever the frames change: a film script that clears assets/film/ removes the loop too (American Crust, 23 Nov 2026,
when the loop had no script and was rebuilt from memory). The page shows it as data-loop on the opening section.
"""
import subprocess
import sys
from pathlib import Path

src, out = Path(sys.argv[1]), sys.argv[2]
fps = int(sys.argv[3]) if len(sys.argv) > 3 else 15
frames = sorted(src.glob('*.webp')) or sorted(src.glob('*.jpg'))
if not frames:
    sys.exit(f'no frames in {src}')
ext, hold, fade = frames[0].suffix, 1.0, 0.6
offset = len(frames) / fps + hold - fade
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(fps), '-i', str(src / f'%04d{ext}'),
                '-loop', '1', '-t', str(fade + 0.7), '-i', str(frames[0]), '-filter_complex',
                f'[0:v]tpad=stop_mode=clone:stop_duration={hold},format=yuv420p,settb=1/{fps},fps={fps}[a];'
                f'[1:v]format=yuv420p,settb=1/{fps},fps={fps}[b];[a][b]xfade=transition=fade:duration={fade}:offset={offset:.3f}[v]',
                # yuv420p on the output too: xfade hands libx264 4:4:4, which phones do not play (the American Crust
                # loop sat on its first frame on every phone, 25 Nov 2026)
                '-map', '[v]', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-crf', '28', '-preset', 'slow', '-movflags', '+faststart', out], check=True)
print('wrote', out, f'({len(frames)} frames, {offset + fade + 0.7:.1f} s)')
