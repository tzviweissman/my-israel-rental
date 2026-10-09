"""One billable Higgsfield API still: python still.py <out.png> <aspect> "<prompt>"
HF_KEY comes from backend/.env.local; never read or printed here."""
import sys, urllib.request
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[4] / "backend" / ".env.local")
import higgsfield_client
out, aspect, prompt = sys.argv[1], sys.argv[2], sys.argv[3]
final = {}
r = higgsfield_client.subscribe('higgsfield-ai/soul/standard',
    arguments={'prompt': prompt, 'resolution': '1080p', 'aspect_ratio': aspect, 'num_images': 2},
    on_queue_update=lambda s: final.update(s=s))
if not isinstance(final.get('s'), higgsfield_client.Completed) or not (r or {}).get('images'):
    sys.exit(f"FAILED: {type(final.get('s')).__name__} {sorted((r or {}).keys())}")
[urllib.request.urlretrieve(im['url'], out.replace('.png', f'-{i}.png')) for i, im in enumerate(r['images'])]
print('saved', out)
