"""One billable Higgsfield API still edited from a picture: python still.py <out.png> <ref> "<prompt>"
Tries the names in hf.IMAGE_EDIT in order (an unknown name costs nothing). The result keeps the model's own shape,
often square: cut it to the screen through plain background only, or extend it (extend_photo.py), never crop the subject.
Copy into a build's gen/ only to change it; otherwise run it from here."""
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import hf  # noqa: E402

hf.load_key()
import higgsfield_client as h  # noqa: E402

out, ref, prompt = sys.argv[1:4]
url = h.upload_file(ref)
for model in hf.IMAGE_EDIT:
    try:
        r = h.subscribe(model, arguments={'prompt': prompt, 'image_urls': [url], 'resolution': '2k'})
    except Exception as e:  # noqa: BLE001 - a name the API does not have
        print('no:', model, type(e).__name__, str(e)[:120], flush=True)
        continue
    ims = (r or {}).get('images') or []
    if ims:
        urllib.request.urlretrieve(ims[0]['url'], out)
        print('saved', out, 'with', model)
        sys.exit(0)
    print('empty:', model, sorted((r or {}).keys()), flush=True)
sys.exit('no edit model on the API: update hf.IMAGE_EDIT')
