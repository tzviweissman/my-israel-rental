"""One billable Higgsfield API clip: python clip.py <start.png> <out.mp4> <seconds> "<prompt>" [end.png]
MiniMax H3 image-to-video, as whipped-cup/gen/clip.py. HF_KEY stays in the main checkout's backend/.env.local."""
import sys, time, urllib.request
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path("C:/Users/tzviw/Documents/my-israel-rental/backend/.env.local"))
import higgsfield_client
MODEL = 'minimax/h3/image-to-video'
def wait(ctl, out):
    for _ in range(240):
        try: st = ctl.status()
        except Exception as e: print('status check failed, retrying:', type(e).__name__, flush=True); time.sleep(10); continue
        if isinstance(st, higgsfield_client.Completed):
            r = None
            for _ in range(5):
                try: r = higgsfield_client.sync_client.result(ctl.request_id); break
                except Exception: time.sleep(5)
            url = (r or {}).get('video', {}).get('url')
            if not url: sys.exit(f'FAILED: no video in {r}')
            urllib.request.urlretrieve(url, out); print('saved', out); return
        if isinstance(st, tuple(higgsfield_client.DONE_STATUSES)): sys.exit(f'FAILED: {type(st).__name__}')
        time.sleep(10)
    sys.exit('FAILED: still not done after 40 minutes; resume with --resume')
if sys.argv[1] == '--resume':
    wait(higgsfield_client.sync_client.get_request_controller(Path(sys.argv[2] + '.req').read_text().splitlines()[0]), sys.argv[2]); sys.exit(0)
start, out, secs, prompt = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
args = {'prompt': prompt, 'image_url': higgsfield_client.upload_file(start), 'duration': secs}
if len(sys.argv) > 5: args['end_image_url'] = higgsfield_client.upload_file(sys.argv[5])
ctl = higgsfield_client.submit(MODEL, arguments=args)
Path(out + '.req').write_text(f'{ctl.request_id}\n{ctl.status_url}\n{ctl.response_url}\n')
print('submitted', ctl.request_id, flush=True)
wait(ctl, out)
