"""Re-light an owner's product photos as one shop shoot (rules 3ag.1, Cakes by Tova 19 Nov 2026): the same pieces from
the same angle, on one plain ground, in soft daylight, with the foil, counters, hands and flash gone. One billable
Higgsfield API picture per photo (read the price with get_cost first). Never put a result on a page before checking it
piece by piece beside the original: scripts/product-match-sheet.py <result> <original> <sheet.jpg>.

    <backend venv python> scrollcraft/starter/relight_photo.py <out dir> <photo> [more photos] [--ground "..."] [--shape 3:4]

Writes <out dir>/<photo name>.png. HF_KEY from the main checkout's backend/.env.local, never printed."""
import argparse
import urllib.request
from pathlib import Path

from dotenv import load_dotenv
from PIL import Image

load_dotenv(Path('C:/Users/tzviw/Documents/my-israel-rental/backend/.env.local'))
import higgsfield_client  # noqa: E402

PROMPT = ('Re-photograph exactly these products as a professional shop product photo. Keep every single piece exactly as '
          'it is: the same number of pieces, the same shapes, sizes, colours, toppings, sprinkles, icing, writing and '
          'arrangement, from the same camera angle. Change only what is around them and the light: replace any foil tray, '
          'counter, table, box edge, plastic wrap, hand or clutter with {ground}, and light it with soft window daylight '
          'from the upper left with gentle natural shadows, no flash glare. No new food, no props, no garnish, no text, no '
          'logos. Photographic, natural colours, not glossy, not illustrated.')

a = argparse.ArgumentParser()
a.add_argument('out'); a.add_argument('photos', nargs='+')
a.add_argument('--ground', default='a plain warm cream linen surface (#F4EDE4)')
a.add_argument('--shape', default='3:4')
o = a.parse_args()
out = Path(o.out); out.mkdir(parents=True, exist_ok=True)
for ph in map(Path, o.photos):
    png = out / f'{ph.stem}-src.png'; Image.open(ph).convert('RGB').save(png)
    r = higgsfield_client.subscribe('marketing-studio/image/sunburst',
                                    arguments={'prompt': PROMPT.format(ground=o.ground), 'image_urls': [higgsfield_client.upload_file(str(png))],
                                               'aspect_ratio': o.shape, 'resolution': '2k', 'quality': 'medium', 'enhance_prompt': False})
    url = (r.get('images') or [{}])[0].get('url') if isinstance(r, dict) else None
    if not url:
        print(ph.name, 'no picture:', str(r)[:300]); continue
    urllib.request.urlretrieve(url, out / f'{ph.stem}.png'); print(ph.name, 'saved')
