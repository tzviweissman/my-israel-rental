"""Fill the padded part of a canvas, one billable image: python gen/fill.py <canvas.png> <out.png> <aspect> "<prompt>"
HF_KEY comes from backend/.env.local in the main checkout; never read or printed here."""
import sys, urllib.request
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path("C:/Users/tzviw/Documents/my-israel-rental/backend/.env.local"))
import higgsfield_client
canvas, out, aspect, prompt = sys.argv[1:5]
url = higgsfield_client.upload_file(canvas)
for model in ('google/nano-banana-2', 'nano-banana-2', 'google/nano-banana-pro', 'nano-banana-pro', 'bytedance/seedream/v4/edit'):
    args = {'prompt': prompt, 'aspect_ratio': aspect, 'resolution': '2k', 'image_urls': [url], 'image_url': url, 'image_references': [url]}
    try:
        r = higgsfield_client.subscribe(model, arguments=args)
    except Exception as e:  # noqa: BLE001
        print(model, 'refused:', type(e).__name__, str(e)[:160], flush=True)
        continue
    ims = (r or {}).get('images') or []
    if ims:
        urllib.request.urlretrieve(ims[0]['url'], out)
        print('saved', out, 'with', model)
        sys.exit(0)
    print(model, 'no image:', sorted((r or {}).keys()), flush=True)
sys.exit('FAILED: no fill model answered')
