"""Is a film or set of frames bright enough to see? (Tzvi, 16 Oct 2026: The
Brown Box film was "very dark and hard to see"; it was shot on a deep
brown-black ground and only graded up afterwards.)

    python brightness.py <folder of frames | video.mp4> [--every N]

For each frame (or every Nth): mean brightness of the whole frame and of its
middle third (where the subject usually is), 0 to 100. Fails (exit 1) when
any checked frame's middle third is under 33 or the whole frame under 22, or
when the film's average is under 30. (Calibrated on The Brown Box: the first
film averaged 19 and failed; the graded one averages 35. A product that is dark by
nature (acai, chocolate, coffee) sits near 33 in the middle at best: push it
further and it turns milky; lighten the ground instead.) Grade up (ffmpeg eq=gamma=...) or
regenerate with brighter light before building the page.
"""
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageStat

src = Path(sys.argv[1])
every = int(sys.argv[sys.argv.index('--every') + 1]) if '--every' in sys.argv else 10
if src.is_file():
    tmp = Path(tempfile.mkdtemp())
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', str(src), '-vf', 'fps=2,scale=480:-2', str(tmp / '%04d.png')], check=True)
    frames = sorted(tmp.glob('*.png'))
    every = 1
else:
    frames = sorted(p for p in src.iterdir() if p.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp'))
frames = frames[::every]


def luma(im):
    return ImageStat.Stat(im.convert('L')).mean[0] / 2.55


bad, total = [], []
for f in frames:
    im = Image.open(f)
    w, h = im.size
    whole = luma(im)
    mid = luma(im.crop((w // 3, h // 3, 2 * w // 3, 2 * h // 3)))
    total.append(whole)
    if mid < 33 or whole < 22:
        bad.append(f'{f.name}: whole {whole:.0f}, middle {mid:.0f}')
avg = sum(total) / max(1, len(total))
print(f'{len(frames)} frames, average brightness {avg:.0f}')
for b in bad:
    print('DARK', b)
if bad or avg < 30:
    print('too dark: grade up or regenerate with brighter light')
    sys.exit(1)
print('bright enough')
