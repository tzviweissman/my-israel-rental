"""One billable Higgsfield API clip: python clip.py <start.png> <out.mp4> <seconds> "<prompt>" [end.png]
MiniMax H3 image-to-video; end_image_url makes the clip land on a chosen frame.
HF_KEY comes from backend/.env.local; never read or printed here."""
import sys, urllib.request
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[5] / "backend" / ".env.local")
import higgsfield_client
start, out, secs, prompt = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
args = {'prompt': prompt, 'image_url': higgsfield_client.upload_file(start), 'duration': secs}
if len(sys.argv) > 5:
    args['end_image_url'] = higgsfield_client.upload_file(sys.argv[5])
final = {}
r = higgsfield_client.subscribe('minimax/h3/image-to-video', arguments=args,
    on_queue_update=lambda s: final.update(s=s))
if not isinstance(final.get('s'), higgsfield_client.Completed) or not (r or {}).get('video'):
    sys.exit(f"FAILED: {type(final.get('s')).__name__} {r}")
urllib.request.urlretrieve(r['video']['url'], out)
print('saved', out)
