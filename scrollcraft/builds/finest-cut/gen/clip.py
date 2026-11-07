"""One billable MiniMax H3 clip through the Higgsfield API (gen/mountains-brief.md). HF_KEY from backend/.env.local; never read or printed.
    python clip.py skim    references: their crust, their cups, the drawn composition; 6 s; film/C1.mp4
    python clip.py climb   start film/S2-real.png, end film/S3.png; 6 s; film/C2.mp4
The request id goes to <out>.req as soon as the job is accepted; a slow status check is retried, not fatal.
"""
import sys
import time
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
FILM = HERE / 'film'
load_dotenv(Path('C:/Users/tzviw/Documents/my-israel-rental/backend/.env.local'))
import higgsfield_client as h  # noqa: E402

KEEP = ('Real photographed fried chicken: thick, opaque, golden crumbed crust with visible crumbs and pores, matte to satin, '
        'never glassy. Only the camera moves; the food stays perfectly still and keeps its shapes. Warm light on the food from '
        'behind and above, the far distance falling into black. Thin wisps of steam drift slowly left. Do not add or remove pieces, '
        'do not add hands, utensils, text, sparks, glow, particles or smoke walls. No cuts.')
SKIM = ('One continuous shot on a tiny probe lens, one smooth motion-control move. The camera flies slowly forward, very low, a '
        'centimetre above a huge landscape made of this exact fried chicken from the reference pictures, so the ridges of crust rise '
        'like golden mountains on both sides and in front, with very deep perspective. It glides between the ridges and rises slightly '
        'over a crest, and ends looking over the three round sauce cups with the black logo lids from the reference, lying ahead like '
        'lakes in the landscape, as in the composition reference. ' + KEEP)
CLIMB = ('One continuous shot, one smooth motion-control move. From low over the three sauce cups the camera rises straight up and '
         'tilts down in one soft curve, climbing higher and higher, until the whole board is seen from directly above on black stone, '
         'exactly as in the last picture, where it stops. ' + KEEP)


def wait(ctl, out):
    for _ in range(240):
        try:
            st = ctl.status()
        except Exception as e:  # noqa: BLE001
            print('status check failed, retrying:', type(e).__name__, flush=True)
            time.sleep(10)
            continue
        if isinstance(st, h.Completed):
            r = None
            for _ in range(5):
                try:
                    r = h.sync_client.result(ctl.request_id)
                    break
                except Exception:  # noqa: BLE001
                    time.sleep(5)
            url = (r or {}).get('video', {}).get('url')
            if not url:
                sys.exit(f'FAILED: no video in {r}')
            urllib.request.urlretrieve(url, out)
            print('saved', out)
            return
        if isinstance(st, tuple(h.DONE_STATUSES)):
            sys.exit(f'FAILED: {type(st).__name__}')
        time.sleep(10)
    sys.exit('FAILED: still not done after 40 minutes')


which = sys.argv[1]
base = {'duration': 6, 'resolution': '2K', 'aspect_ratio': '16:9'}
if which == 'skim':
    out = FILM / 'C1.mp4'
    model, args = 'minimax/h3/reference-to-video', {**base, 'prompt': SKIM, 'image_urls': [
        h.upload_file(str(FILM / n)) for n in ('ref-crust.png', 'ref-cups.png', 'S2.png')]}
else:
    out = FILM / 'C2.mp4'
    model, args = 'minimax/h3/image-to-video', {**base, 'prompt': CLIMB,
        'image_url': h.upload_file(str(FILM / 'S2-real.png')), 'end_image_url': h.upload_file(str(FILM / 'S3.png'))}
ctl = h.submit(model, arguments=args)
Path(str(out) + '.req').write_text(f'{ctl.request_id}\n{ctl.status_url}\n{ctl.response_url}\n')
print('submitted', ctl.request_id, flush=True)
wait(ctl, out)
