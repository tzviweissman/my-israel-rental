"""The one-world opening (gen/film-brief.md, One world): four billable MiniMax H3 clips through the Higgsfield API, each
starting on the last frame of the one before, so the camera never cuts and the grinder, jar and glass stay the same.
HF_KEY from backend/.env.local; never read or printed.   python gen/world.py [W1 W2 W3 W4]   (from the build folder)
A clip already saved is not made again; its last frame is taken again."""
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
W = HERE / 'world'
load_dotenv(Path('C:/Users/tzviw/Documents/my-israel-rental/backend/.env.local'))
import higgsfield_client as h  # noqa: E402

KEEP = ('One continuous shot: the camera moves smoothly and slowly straight DOWN the whole time, no cuts, no fades. A plain warm '
        'cream background all around, soft daylight from the left, a light oak table far below. Real photographed coffee: '
        'opaque deep brown, real ice, never glassy, no glow. Nothing appears from nowhere or vanishes. No hands, people, text '
        'or logos.')
STEPS = {
    'W1': (None, 'Coffee beans keep pouring from above into the clear hopper of this black grinder floating in the air. The camera '
                 'travels slowly down the grinder to its spout at the bottom, where fine dark coffee powder begins to stream out '
                 'in one soft stream and falls straight down. '),
    'W2': (None, 'The camera keeps travelling down with the falling stream of fine coffee powder, down to one tall clear glass jar '
                 'of cold water and ice standing on the oak table below. The powder falls into the water, dark brown clouds of '
                 'coffee bloom and curl through it like ink, and the water slowly turns to deep dark cold brew. '),
    'W3': (None, 'The same tall glass of iced coffee stays in the middle of the picture; the coffee keeps darkening until it is '
                 'evenly deep cold brew; then cold milk pours into it from above out of the top edge of the picture and curls down '
                 'through the dark coffee in soft white ribbons. The camera moves very slightly closer and slightly down. '),
    'W4': ('bar-end', 'The camera pulls back smoothly and steadily from the iced coffee, and the glass settles into a whole coffee bar '
                      'on a sunlit table with a dispenser of cold brew, syrup bottles, milk, cups and straws, ending exactly on the '
                      'last picture, which does not change. '),
}
ORDER = ['W1', 'W2', 'W3', 'W4']


def last_frame(clip, out):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-sseof', '-0.3', '-i', str(clip), '-frames:v', '1', str(out)], check=True)


def wait(ctl, out):
    for _ in range(240):
        try:
            st = ctl.status()
        except Exception as e:  # noqa: BLE001
            print('status check failed, retrying:', type(e).__name__, flush=True); time.sleep(10); continue
        if isinstance(st, h.Completed):
            r = None
            for _ in range(5):
                try:
                    r = h.sync_client.result(ctl.request_id); break
                except Exception:  # noqa: BLE001
                    time.sleep(5)
            url = (r or {}).get('video', {}).get('url')
            if not url:
                sys.exit(f'FAILED: no video in {r}')
            urllib.request.urlretrieve(url, out); print('saved', out, flush=True); return
        if isinstance(st, tuple(h.DONE_STATUSES)):
            sys.exit(f'FAILED: {type(st).__name__}')
        time.sleep(10)
    sys.exit('FAILED: still not done after 40 minutes')


for name in sys.argv[1:] or ORDER:
    i = ORDER.index(name)
    start = W / 'w1.png' if i == 0 else W / f'{ORDER[i - 1]}-last.png'
    out = W / f'{name}.mp4'
    if not out.exists():
        end, prompt = STEPS[name]
        args = {'duration': 6, 'resolution': '2K', 'aspect_ratio': '16:9', 'prompt': prompt + KEEP, 'image_url': h.upload_file(str(start))}
        if end:
            args['end_image_url'] = h.upload_file(str(HERE / 'journey' / f'{end}.png'))
        ctl = h.submit('minimax/h3/image-to-video', arguments=args)
        Path(str(out) + '.req').write_text(f'{ctl.request_id}\n{ctl.status_url}\n{ctl.response_url}\n')
        print('submitted', name, ctl.request_id, flush=True)
        wait(ctl, out)
    last_frame(out, W / f'{name}-last.png')
print('chain done')
