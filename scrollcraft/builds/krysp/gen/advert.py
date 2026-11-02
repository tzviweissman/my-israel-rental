"""Krysp advert film (gen/advert-brief.md): one billable Seedance 2.5 reference-to-video clip through the Higgsfield API.
    python advert.py            submit, save the request id to film/advert.mp4.req, wait, download
    python advert.py --resume   pick up the job already running
References: the storyboard (film/SB-a.png) and the chew (film/W0.png). HF_KEY from backend/.env.local; never read or printed.
"""
import sys
import time
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
load_dotenv(Path('C:/Users/tzviw/Documents/my-israel-rental/backend/.env.local'))
import higgsfield_client  # noqa: E402

MODEL = 'bytedance/seedance-2.5/reference-to-video'
OUT = HERE / 'film' / 'advert.mp4'
PROMPT = (HERE / 'advert-prompt.txt').read_text(encoding='utf-8').strip()


def wait(ctl):
    for _ in range(240):  # up to ~40 min
        try:
            st = ctl.status()
        except Exception as e:  # noqa: BLE001 - a slow status check is not a failed job
            print('status check failed, retrying:', type(e).__name__, flush=True)
            time.sleep(10)
            continue
        if isinstance(st, higgsfield_client.Completed):
            r = None
            for _ in range(5):
                try:
                    r = higgsfield_client.sync_client.result(ctl.request_id)
                    break
                except Exception:  # noqa: BLE001
                    time.sleep(5)
            url = (r or {}).get('video', {}).get('url')
            if not url:
                sys.exit(f'FAILED: no video in {r}')
            urllib.request.urlretrieve(url, OUT)
            print('saved', OUT)
            return
        if isinstance(st, tuple(higgsfield_client.DONE_STATUSES)):
            sys.exit(f'FAILED: {type(st).__name__}')
        time.sleep(10)
    sys.exit('FAILED: still not done after 40 minutes; resume later with --resume')


if len(sys.argv) > 1 and sys.argv[1] == '--resume':
    rid = Path(str(OUT) + '.req').read_text().splitlines()[0]
    wait(higgsfield_client.sync_client.get_request_controller(rid))
    sys.exit(0)

args = {
    'prompt': PROMPT,
    'image_urls': [higgsfield_client.upload_file(str(HERE / 'film' / 'SB-a.png')),
                   higgsfield_client.upload_file(str(HERE / 'film' / 'W0.png'))],
    'duration': 12, 'resolution': '720p', 'aspect_ratio': '16:9', 'generate_audio': False,
}
ctl = higgsfield_client.submit(MODEL, arguments=args)
Path(str(OUT) + '.req').write_text(f'{ctl.request_id}\n{ctl.status_url}\n{ctl.response_url}\n')
print('submitted', ctl.request_id, flush=True)
wait(ctl)
