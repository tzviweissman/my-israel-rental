"""One billable MiniMax H3 clip through the Higgsfield API (gen/film-brief.md, Clip plan). HF_KEY from
backend/.env.local; never read or printed. python gen/clip.py <C1|C2|C3|C4>   -> gen/film/<name>.mp4
The request id goes to <out>.req as soon as the job is accepted; a slow status check is retried, not fatal."""
import sys
import time
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
FILM = HERE / 'film'; FILM.mkdir(exist_ok=True)
J = HERE / 'journey'
load_dotenv(Path('C:/Users/tzviw/Documents/my-israel-rental/backend/.env.local'))
import higgsfield_client as h  # noqa: E402

KEEP = ('Real photographed coffee: opaque deep brown cold brew, real ice with frost, never glassy, no glow. Warm cream wall '
        'with soft leaf shadows, low golden sun from the right, light oak table. One continuous shot, one smooth slow '
        'motion-control camera move, no cuts. Nothing appears from nowhere or vanishes. No hands, people, text or logos.')
CLIPS = {
    'C1b': (J / 'grind.png', None,
            'Dark roasted coffee beans keep pouring from above into the clear hopper of this black burr grinder. The camera '
            'glides slowly and smoothly straight down this same grinder to its outlet at the bottom, where fine dark coffee '
            'powder streams out in one soft stream and falls straight down out of the bottom edge of the picture, every '
            'grain sharp; nothing below it. '),
    'C3b': (J / 'pour-start.png', J / 'pour.png',
            'Dark cold brew pours from the top of the picture in one thin stream into the tall glass of ice until it is full, '
            'then the stream stops; cold milk then pours in from the top and curls through the dark coffee in soft ribbons, '
            'as in the last picture. The glass stays in place; the camera moves very slightly closer. '),
    'C1': (J / 'grind.png', J / 'powder.png',
           'Dark roasted coffee beans keep pouring from above into the clear hopper of the black burr grinder. The camera '
           'glides slowly straight down the grinder, following the beans down through it, to its outlet at the bottom, where '
           'fine dark coffee powder streams out and falls, every grain sharp, exactly as in the last picture. '),
    'C2': (J / 'steep-3.png', J / 'steep-done.png',
           'The last coffee grounds settle into the jar of cold water and stop falling. The soft dark brown clouds of coffee '
           'slowly spread and curl through the clear water like ink until the whole jar is evenly deep dark cold brew, as in '
           'the last picture. The jar stays still; the camera barely moves, a slow gentle push in. '),
    'C3': (J / 'tap-2.png', J / 'pour.png',
           'Cold brew runs from the dispenser tap into the glass of ice, then the stream stops. The camera moves smoothly down '
           'and in to the tall glass until it fills the frame, and cold milk begins to pour into it from above and swirls '
           'through the dark coffee in soft ribbons, as in the last picture. '),
    'C4': (J / 'pour.png', J / 'bar-end.png',
           'Milk keeps swirling slowly through the iced coffee. The camera pulls back smoothly and steadily, and the glass '
           'settles into a whole coffee bar on a sunlit table with a dispenser of cold brew, syrup bottles, milk, cups and '
           'straws, ending exactly on the last picture, which does not change. '),
}


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
            urllib.request.urlretrieve(url, out); print('saved', out); return
        if isinstance(st, tuple(h.DONE_STATUSES)):
            sys.exit(f'FAILED: {type(st).__name__}')
        time.sleep(10)
    sys.exit('FAILED: still not done after 40 minutes')


name = sys.argv[1]
start, end, prompt = CLIPS[name]
out = FILM / f'{name}.mp4'
args = {'duration': 6, 'resolution': '2K', 'aspect_ratio': '16:9', 'prompt': prompt + KEEP, 'image_url': h.upload_file(str(start))}
if end:
    args['end_image_url'] = h.upload_file(str(end))
ctl = h.submit('minimax/h3/image-to-video', arguments=args)
Path(str(out) + '.req').write_text(f'{ctl.request_id}\n{ctl.status_url}\n{ctl.response_url}\n')
print('submitted', name, ctl.request_id, flush=True)
wait(ctl, out)
