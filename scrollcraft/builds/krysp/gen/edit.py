"""One billable Seedance 2.5 video edit through the Higgsfield API: python edit.py <in.mp4> <out.mp4> "<prompt>"
    python edit.py --resume <out.mp4>    pick up a job already running
HF_KEY from backend/.env.local; never read or printed.
"""
import sys
import time
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path('C:/Users/tzviw/Documents/my-israel-rental/backend/.env.local'))
import higgsfield_client  # noqa: E402

MODEL = 'bytedance/seedance-2.5/video-edit'


def wait(ctl, out):
    for _ in range(240):
        try:
            st = ctl.status()
        except Exception as e:  # noqa: BLE001
            print('status check failed, retrying:', type(e).__name__, flush=True)
            time.sleep(10)
            continue
        if isinstance(st, higgsfield_client.Completed):
            r = higgsfield_client.sync_client.result(ctl.request_id)
            url = (r or {}).get('video', {}).get('url')
            if not url:
                sys.exit(f'FAILED: no video in {r}')
            urllib.request.urlretrieve(url, out)
            print('saved', out)
            return
        if isinstance(st, tuple(higgsfield_client.DONE_STATUSES)):
            r = higgsfield_client.sync_client.result(ctl.request_id)
            sys.exit(f'FAILED: {type(st).__name__}: {(r or {}).get("error")}')
        time.sleep(10)
    sys.exit('FAILED: still not done after 40 minutes; resume later with --resume')


if sys.argv[1] == '--resume':
    out = sys.argv[2]
    rid = Path(out + '.req').read_text().splitlines()[0]
    wait(higgsfield_client.sync_client.get_request_controller(rid), out)
    sys.exit(0)

src, out, prompt = sys.argv[1], sys.argv[2], sys.argv[3]
args = {'prompt': prompt, 'video_url': higgsfield_client.upload_file(src), 'resolution': '720p', 'generate_audio': False}
ctl = higgsfield_client.submit(MODEL, arguments=args)
Path(out + '.req').write_text(f'{ctl.request_id}\n{ctl.status_url}\n{ctl.response_url}\n')
print('submitted', ctl.request_id, flush=True)
wait(ctl, out)
