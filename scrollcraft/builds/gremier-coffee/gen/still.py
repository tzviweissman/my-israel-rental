"""One billable Higgsfield API still edited from their own crop: python still.py <out.png> <ref> <aspect> "<prompt>"
HF_KEY from backend/.env.local; never read or printed. Tries the edit models the account may have; an unknown id costs nothing."""
import sys, urllib.request
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path('C:/Users/tzviw/Documents/my-israel-rental/backend/.env.local'))
import higgsfield_client as h
out, ref, aspect, prompt = sys.argv[1:5]
url = h.upload_file(ref)
for model, args in [
    ('google/nano-banana-2/edit', {'prompt': prompt, 'image_urls': [url], 'aspect_ratio': aspect, 'resolution': '2k'}),
    ('nano-banana-2', {'prompt': prompt, 'image_urls': [url], 'aspect_ratio': aspect, 'resolution': '2k'}),
    ('nano_banana_2', {'prompt': prompt, 'image_urls': [url], 'aspect_ratio': aspect, 'resolution': '2k'}),
    ('bytedance/seedream/v4/edit', {'prompt': prompt, 'image_urls': [url], 'aspect_ratio': aspect, 'resolution': '2K'}),
]:
    try:
        r = h.subscribe(model, arguments=args)
    except Exception as e:  # an id the API does not have
        print('no:', model, type(e).__name__, str(e)[:120], flush=True); continue
    ims = (r or {}).get('images') or []
    if ims:
        urllib.request.urlretrieve(ims[0]['url'], out); print('saved', out, 'with', model); sys.exit(0)
    print('empty:', model, sorted((r or {}).keys()), flush=True)
sys.exit('no edit model on the API')
