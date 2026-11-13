"""The four concept stills of the journey (gen/journey-brief.md). Billable Higgsfield API, soul/standard.
HF_KEY from backend/.env.local; never read or printed. Run from the build folder: python gen/journey_stills.py [names]"""
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path('C:/Users/tzviw/Documents/my-israel-rental/backend/.env.local'))
import higgsfield_client  # noqa: E402

LOOK = ('Photorealistic premium coffee advertising photograph. Warm cream plaster wall behind with soft leaf shadows, '
        'low golden sunlight from the right and slightly behind, a light oak table, shallow depth of field, the subject '
        'sharp and centred with plain wall on both sides. Coffee is opaque deep brown, never glassy. No text, no logos, '
        'no labels, no hands, no people.')
SHOTS = {
    'grind': 'Dark roasted coffee beans falling through the air from above into the clear glass hopper of a matte black '
             'burr coffee grinder standing on the table; beans frozen sharp mid-air, a few bouncing in the half-full hopper.',
    'powder': 'Close-up of the outlet of a plain matte black burr coffee grinder with no label, no badge and no writing on it: freshly ground coffee pours out of it as a soft '
              'stream of very fine dark brown powder, every tiny grain sharp, a light haze of coffee dust in the sunlight, '
              'falling straight down out of the picture.',
    'powder-out': 'Close-up of the outlet of a plain matte black burr coffee grinder with no label, no badge and no writing on '
                  'it, at the top of the picture: freshly ground coffee pours out of it as one soft stream of very fine dark '
                  'brown powder, every grain sharp, falling straight down through the middle of the picture and out of the '
                  'bottom edge; nothing below it, only the cream wall behind.',
    'pour-start': 'A tall clear glass full of ice cubes standing on the table in the middle of the picture; dark cold brew coffee '
                  'pours into it in one thin smooth stream falling straight down from the top edge of the picture, the glass '
                  'a third full of dark coffee, the ice catching the sun.',
    'w1': 'Product advertising photograph on a plain seamless warm cream background that fills the whole picture: one matte '
          'black burr coffee grinder with a clear glass hopper floats in the middle of the picture in mid-air, there is NO '
          'table, NO floor, NO surface and NO shadow on any surface below it, only the plain cream background all around; its '
          'open outlet spout points straight down at the bottom of the grinder; dark roasted coffee beans fall into the hopper '
          'from above out of the top edge of the picture, every bean sharp mid-air; soft even daylight from the left. Plain '
          'grinder with no label, no badge and no writing.',
    'steep': 'A thin stream of freshly ground coffee falling from above into a tall clear glass jar of cold water with '
             'ice cubes; where the grounds hit the water, soft smoky dark brown clouds of coffee bloom and curl downward '
             'through the clear cold water like ink, matte and opaque, no glow, no orange light inside the water; the top '
             'of the water still clear, the bottom turning dark brown.',
    'tap': 'A large round clear glass drink dispenser jar with a white lid, standing on a tall white ceramic hourglass '
           'shaped base, full to the top with dark cold brew coffee and ice cubes; dark cold brew running in one smooth '
           'stream from its small white plastic tap into a tall clear glass of ice cubes on the table below.',
    'pour': 'Cold milk pouring from above into a tall clear glass of iced cold brew coffee, the white milk curling and '
            'swirling through the dark coffee in soft marbled ribbons, ice cubes, condensation on the glass.',
}
Path('gen/journey').mkdir(exist_ok=True); Path('gen/world').mkdir(exist_ok=True)
SUF = ''   # second tries keep the first files


def one(name):
    final = {}
    r = higgsfield_client.subscribe('higgsfield-ai/soul/standard',
        arguments={'prompt': f'{SHOTS[name]} {LOOK}', 'resolution': '1080p', 'aspect_ratio': '16:9', 'num_images': 1},
        on_queue_update=lambda s: final.update(s=s))
    if not isinstance(final.get('s'), higgsfield_client.Completed) or not (r or {}).get('images'):
        return f'{name} FAILED {type(final.get("s")).__name__}'
    q = urllib.request.Request(r['images'][0]['url'], headers={'User-Agent': 'Mozilla/5.0'})
    open((f'gen/world/{name}.png' if name.startswith('w') else f'gen/journey/{name}{SUF}.png'), 'wb').write(urllib.request.urlopen(q).read())
    return f'{name} saved {r.get("request_id", "")}'


with ThreadPoolExecutor(4) as x:
    print(*x.map(one, sys.argv[1:] or list(SHOTS)), sep='\n')
