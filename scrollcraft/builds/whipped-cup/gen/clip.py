"""One billable Higgsfield API clip: python clip.py <start.png> <out.mp4> <seconds> "<prompt>" [end.png]
MiniMax H3 image-to-video; end_image_url makes the clip land on a chosen frame.
HF_KEY comes from backend/.env.local; never read or printed here.

The request id is written to <out>.req as soon as the job is accepted, and a
status check that times out is retried, not fatal (14 Oct 2026: a read
timeout while polling lost a paid clip). To pick up a job already running:
python clip.py --resume <out.mp4>
"""
import sys
import time
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[4] / "backend" / ".env.local")
import higgsfield_client  # noqa: E402

MODEL = 'minimax/h3/image-to-video'


def wait(ctl, out):
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
            urllib.request.urlretrieve(url, out)
            print('saved', out)
            return
        if isinstance(st, tuple(higgsfield_client.DONE_STATUSES)):
            sys.exit(f'FAILED: {type(st).__name__}')
        time.sleep(10)
    sys.exit('FAILED: still not done after 40 minutes; resume later with --resume')


if sys.argv[1] == '--resume':
    out = sys.argv[2]
    rid = Path(out + '.req').read_text().splitlines()[0]
    wait(higgsfield_client.sync_client.get_request_controller(rid), out)
    sys.exit(0)

start, out, secs, prompt = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
args = {'prompt': prompt, 'image_url': higgsfield_client.upload_file(start), 'duration': secs}
if len(sys.argv) > 5:
    args['end_image_url'] = higgsfield_client.upload_file(sys.argv[5])
ctl = higgsfield_client.submit(MODEL, arguments=args)
Path(out + '.req').write_text(f'{ctl.request_id}\n{ctl.status_url}\n{ctl.response_url}\n')
print('submitted', ctl.request_id, flush=True)
wait(ctl, out)
