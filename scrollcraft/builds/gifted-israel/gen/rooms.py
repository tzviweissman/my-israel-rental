"""One billable Higgsfield API still per room and shape: the opening's seven rooms (gen/rooms-brief.md).
python gen/rooms.py [set-shape ...], e.g. terracotta-wide honey-tall; writes gen/rooms/<set>-<shape>.jpg. Run from the build folder.
The set lines are gen/scene.py's, word for word. HF_KEY comes from backend/.env.local; never read or printed here."""
import re, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
from PIL import Image
from dotenv import load_dotenv
load_dotenv(Path(r'C:/Users/tzviw/Documents/my-israel-rental/backend/.env.local'))
import higgsfield_client

src = open('gen/scene.py', encoding='utf8').read()
SETS = dict(re.findall(r"^ '([a-z]+)': '([^']+)',$", src, re.M))
END = ('Shallow depth of field. The top of the block is empty and clear, nothing stands or lies there. '
       'No product, no bottle, no vase, no people, no text. Photorealistic advertising still life photography.')
SHAPE = {'wide': ('16:9', 'Wide picture: the block in the middle, its top a little below the middle of the picture, plenty of wall on both sides.'),
         'tall': ('9:16', 'Tall picture: the block in the middle, its top about two thirds of the way down, plenty of wall above for words.')}
Path('gen/rooms').mkdir(exist_ok=True)


def one(job):
    name, shape = job.rsplit('-', 1)
    ar, line = SHAPE[shape]
    final = {}
    r = higgsfield_client.subscribe('higgsfield-ai/soul/standard',
        arguments={'prompt': f'{SETS[name]} {line} {END}', 'resolution': '1080p', 'aspect_ratio': ar, 'num_images': 1},
        on_queue_update=lambda s: final.update(s=s))
    if not isinstance(final.get('s'), higgsfield_client.Completed) or not (r or {}).get('images'):
        return f'{job} FAILED {type(final.get("s")).__name__}'
    q = urllib.request.Request(r['images'][0]['url'], headers={'User-Agent': 'Mozilla/5.0'})
    Image.open(BytesIO(urllib.request.urlopen(q).read())).convert('RGB').save(f'gen/rooms/{job}.jpg', quality=90)
    return f'{job} saved {r.get("request_id", "")}'


jobs = sys.argv[1:] or [f'{n}-{s}' for n in ('terracotta', 'honey', 'plum', 'blue', 'pomegranate', 'olive', 'teal') for s in SHAPE]
with ThreadPoolExecutor(5) as x:
    print(*x.map(one, jobs), sep='\n')
